"use node";
import { generateTargetingSpecForProfiles } from "./lib/setupGenerationCore";
import { resolveWorkspaceUseCaseKey } from "../shared/lib/workspaceUseCases";
import { clearWorkspaceKeywords } from "./lib/keywordResetCore";
import { getWorkspaceIcpRefreshFingerprint } from "./lib/workspaceIcpSignalsCore";

import { syntheticProfileExamplesSchema } from "./agents/tools/schemas";
import { validateSyntheticProfileExamples } from "./lib/syntheticProfileCore";
import { z } from "zod";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { robustGenerateObject } from "./lib/ai";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { getWorkspaceUseCase } from "../shared/lib/workspaceUseCases";
import {
  hasAnyWorkspaceIcpSyntheticPosts,
  listWorkspaceIcpSignalMissingIndices,
  restoreWorkspaceIcpSignalsFromReference,
  summarizeWorkspaceIcpSignalRefresh,
  type WorkspaceIcp,
} from "./lib/workspaceIcpSignalsCore";
import { icpValidator, workspaceUseCaseKeyValidator } from "./validators";

const workspaceIcpSignalsSchema = z.object({
  syntheticExamples: syntheticProfileExamplesSchema,
  syntheticPosts: z
    .array(z.string().min(20).max(320))
    .min(5)
    .max(10)
    .describe("5-10 realistic social posts this ICP would write"),
  qualificationKeywords: z
    .array(z.string().min(2).max(40))
    .min(5)
    .max(10)
    .describe(
      "5-10 short keyword phrases for verifying ICP fit in the prospect's own posts"
    ),
});

function buildWorkspaceIcpSignalsSystemPrompt(useCaseKey?: unknown): string {
  const useCase = getWorkspaceUseCase(useCaseKey);

  return `You generate realistic profile targeting data for ${useCase.displayName}.

You will receive one ideal ${useCase.entitySingular.toLowerCase()} profile for a workspace.

Return:
0. syntheticExamples: exactly two fictional people illustrating this persona, one twitter and one linkedin, each with displayName, title, and natural first-person bio. Twitter bios max 160 characters. Do not invent real identities, URLs, contacts, or scores. These examples steer targeting; never use their names or incidental details as search requirements or evidence.
1. syntheticPosts: 5-10 realistic first-person social posts this profile would actually write
2. qualificationKeywords: 5-10 short phrases (max 40 chars) that help verify this profile from the prospect's own posts

Rules:
- Keep posts grounded in the ICP's stated pain points and goals
- Make the posts sound natural on ${useCase.entityPlural.toLowerCase()}' preferred channels
- Favor pain, intent, frustration, urgency, and fit signals
- Keep qualificationKeywords short, searchable, and specific
- Avoid generic filler phrases
- Do not mention the user's product directly unless the ICP realistically would`;
}

function buildWorkspaceIcpSignalsUserPrompt(args: {
  workspaceDescription: string;
  icp: WorkspaceIcp;
}): string {
  return `Refresh the targeting signals for this ICP.

Workspace description:
${args.workspaceDescription}

ICP title:
${args.icp.title}

ICP description:
${args.icp.description}

ICP pain points:
${args.icp.painPoints.map((painPoint) => `- ${painPoint}`).join("\n")}

Preferred channels:
${args.icp.channels.join(", ")}

Return only the structured result.`;
}

async function generateWorkspaceIcpSignals(args: {
  icp: WorkspaceIcp;
  useCaseKey?: unknown;
  workspaceDescription: string;
}): Promise<
  Pick<
    WorkspaceIcp,
    "qualificationKeywords" | "syntheticPosts" | "syntheticExamples"
  >
> {
  const { object } = await robustGenerateObject({
    operation: "generateWorkspaceIcpSignals",
    schema: workspaceIcpSignalsSchema,
    system: buildWorkspaceIcpSignalsSystemPrompt(args.useCaseKey),
    prompt: buildWorkspaceIcpSignalsUserPrompt(args),
    temperature: 0.6,
    maxRetries: 2,
    routing: "onboarding",
  });

  validateSyntheticProfileExamples([
    { ...args.icp, syntheticExamples: object.syntheticExamples },
  ]);
  return {
    syntheticExamples: object.syntheticExamples,
    syntheticPosts: object.syntheticPosts,
    qualificationKeywords: object.qualificationKeywords,
  };
}

function normalizeTargetIndices(
  targetIndices: number[] | undefined,
  icpCount: number
): number[] {
  const normalizedIndices = new Set<number>();

  for (const index of targetIndices ?? []) {
    if (Number.isInteger(index) && index >= 0 && index < icpCount) {
      normalizedIndices.add(index);
    }
  }

  return Array.from(normalizedIndices).sort((a, b) => a - b);
}

async function refreshWorkspaceIcpProfiles(args: {
  icps: WorkspaceIcp[];
  targetIndices: number[];
  useCaseKey?: unknown;
  workspaceDescription: string;
}): Promise<{
  success: boolean;
  icps: WorkspaceIcp[];
  refreshedIndices: number[];
  failedIndices: number[];
  missingIndices: number[];
}> {
  const nextIcps = args.icps.map((icp) => ({ ...icp }));
  const refreshResults = await Promise.all(
    args.targetIndices.map(async (index) => {
      const icp = nextIcps[index];

      if (!icp) {
        return { index, outcome: "skipped" as const };
      }

      try {
        const generatedSignals = await generateWorkspaceIcpSignals({
          icp,
          useCaseKey: args.useCaseKey,
          workspaceDescription: args.workspaceDescription,
        });

        return {
          index,
          outcome: "refreshed" as const,
          icp: {
            ...icp,
            syntheticExamples: generatedSignals.syntheticExamples,
            syntheticPosts: generatedSignals.syntheticPosts,
            qualificationKeywords: generatedSignals.qualificationKeywords,
          },
        };
      } catch (error) {
        console.error("[WorkspaceIcpSignals] Failed to refresh ICP signals", {
          error:
            error instanceof Error
              ? error.message
              : "Unknown ICP signal refresh error",
          index,
        });
        return { index, outcome: "failed" as const };
      }
    })
  );
  const refreshedIndices: number[] = [];
  const failedIndices: number[] = [];

  for (const result of refreshResults) {
    if (result.outcome === "refreshed") {
      nextIcps[result.index] = result.icp;
      refreshedIndices.push(result.index);
    } else if (result.outcome === "failed") {
      failedIndices.push(result.index);
    }
  }

  const summary = summarizeWorkspaceIcpSignalRefresh({
    icps: nextIcps,
    failedIndices,
  });

  return {
    success: summary.success,
    icps: nextIcps,
    refreshedIndices,
    failedIndices,
    missingIndices: summary.missingIndices,
  };
}

export const generateWorkspaceIcpSignalsForProfilesInternal = internalAction({
  args: {
    icps: v.array(icpValidator),
    targetIndices: v.array(v.number()),
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),
    workspaceDescription: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    icps: v.array(icpValidator),
    refreshedIndices: v.array(v.number()),
    failedIndices: v.array(v.number()),
    missingIndices: v.array(v.number()),
  }),
  handler: async (_ctx, args) => {
    const normalizedTargetIndices = normalizeTargetIndices(
      args.targetIndices,
      args.icps.length
    );
    const targetIndices =
      normalizedTargetIndices.length > 0
        ? normalizedTargetIndices
        : listWorkspaceIcpSignalMissingIndices(args.icps);

    return await refreshWorkspaceIcpProfiles({
      icps: args.icps,
      targetIndices,
      useCaseKey: args.useCaseKey,
      workspaceDescription: args.workspaceDescription,
    });
  },
});

export const refreshWorkspaceIcpSignalsInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    targetIndices: v.optional(v.array(v.number())),
    restartWorkflow: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    outcome:
      | "workspace_not_ready"
      | "superseded"
      | "refreshed"
      | "noop"
      | "partial_failure";
    refreshedIndices: number[];
    restoredIndices: number[];
    failedIndices: number[];
    missingIndices: number[];
  }> => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (
      !workspace ||
      !Array.isArray(workspace.icps) ||
      workspace.icps.length === 0
    ) {
      return {
        success: false,
        outcome: "workspace_not_ready" as const,
        refreshedIndices: [] as number[],
        restoredIndices: [] as number[],
        failedIndices: [] as number[],
        missingIndices: [] as number[],
      };
    }

    let nextIcps = workspace.icps.map((icp: WorkspaceIcp) => ({ ...icp }));
    const normalizedTargetIndices = normalizeTargetIndices(
      args.targetIndices,
      nextIcps.length
    );
    const referenceProfilesResult = await ctx.runQuery(
      internal.setupSessions.getLatestGeneratedProfilesForWorkspaceInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    const restoreResult = restoreWorkspaceIcpSignalsFromReference({
      icps: nextIcps,
      referenceIcps:
        workspace.targetingLearningResetAt === undefined
          ? (referenceProfilesResult?.generatedProfiles ?? [])
          : [],
      excludedIndices: normalizedTargetIndices,
    });
    nextIcps = restoreResult.nextIcps;

    const targetIndices =
      normalizedTargetIndices.length > 0
        ? normalizedTargetIndices
        : listWorkspaceIcpSignalMissingIndices(nextIcps);
    const refreshResult = await refreshWorkspaceIcpProfiles({
      icps: nextIcps,
      targetIndices,
      useCaseKey: workspace.useCaseKey,
      workspaceDescription:
        workspace.improvedDescription || workspace.description,
    });
    nextIcps = refreshResult.icps;
    const shouldClearSystemIssue = refreshResult.success;
    const updatedAt = getCurrentUTCTimestamp();

    let published = false;
    let mayRestart = false;
    let publishedFingerprint: string | undefined;
    if (refreshResult.success) {
      const targetingSpec =
        workspace.onboardingIssueStatusCode === "icp_refresh_required" ||
        !workspace.targetingSpec
          ? await generateTargetingSpecForProfiles({
              description: workspace.description,
              profiles: nextIcps,
              currentTargetingSpec: workspace.targetingSpec,
              useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
            })
          : workspace.targetingSpec;
      // Old query queues must not survive a targeting edit. Each batch is fenced
      // to the same input revision as publication and restart.
      if (workspace.onboardingIssueStatusCode === "icp_refresh_required") {
        await clearWorkspaceKeywords(
          ctx,
          args.workspaceId,
          getWorkspaceIcpRefreshFingerprint(workspace)
        );
      }
      const result = await ctx.runMutation(
        internal.workspaces.updateWorkspaceIcpSignalsInternal,
        {
          workspaceId: args.workspaceId,
          expectedTargetingFingerprint:
            getWorkspaceIcpRefreshFingerprint(workspace),
          icps: nextIcps,
          targetingSpec,
          clearSystemIssue: shouldClearSystemIssue,
          lastGeneratedAt: updatedAt,
        }
      );
      published = result.updated;
      mayRestart = result.mayRestart;
      publishedFingerprint = result.publishedFingerprint;
    }

    const shouldRestartWorkflow =
      published &&
      mayRestart &&
      Boolean(args.restartWorkflow || workspace.icpRefreshResumeRequested) &&
      shouldClearSystemIssue &&
      (workspace.onboardingIssueStatusCode === "icp_refresh_required" ||
        !hasAnyWorkspaceIcpSyntheticPosts(workspace.icps));

    if (shouldRestartWorkflow && publishedFingerprint) {
      await ctx.runAction(
        internal.workspaces.restartProspectingWorkflowForSetupInternal,
        {
          workspaceId: args.workspaceId,
          expectedTargetingFingerprint: publishedFingerprint,
        }
      );
    }

    return {
      success: refreshResult.success && published,
      outcome:
        refreshResult.success && !published
          ? ("superseded" as const)
          : refreshResult.success
            ? refreshResult.refreshedIndices.length > 0 ||
              restoreResult.restoredIndices.length > 0
              ? ("refreshed" as const)
              : ("noop" as const)
            : ("partial_failure" as const),
      refreshedIndices: refreshResult.refreshedIndices,
      restoredIndices: restoreResult.restoredIndices,
      failedIndices: refreshResult.failedIndices,
      missingIndices: refreshResult.missingIndices,
    };
  },
});
