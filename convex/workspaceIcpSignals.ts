"use node";

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
  type WorkspaceIcp,
} from "./lib/workspaceIcpSignalsCore";

const workspaceIcpSignalsSchema = z.object({
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
}): Promise<Pick<WorkspaceIcp, "qualificationKeywords" | "syntheticPosts">> {
  const { object } = await robustGenerateObject({
    operation: "generateWorkspaceIcpSignals",
    schema: workspaceIcpSignalsSchema,
    system: buildWorkspaceIcpSignalsSystemPrompt(args.useCaseKey),
    prompt: buildWorkspaceIcpSignalsUserPrompt(args),
    temperature: 0.6,
    maxRetries: 2,
    routing: "fast",
  });

  return {
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

export const refreshWorkspaceIcpSignalsInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    targetIndices: v.optional(v.array(v.number())),
    restartWorkflow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
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
    const referenceProfilesResult = await ctx.runQuery(
      internal.setupSessions.getLatestGeneratedProfilesForWorkspaceInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    const restoreResult = restoreWorkspaceIcpSignalsFromReference({
      icps: nextIcps,
      referenceIcps: referenceProfilesResult?.generatedProfiles ?? [],
    });
    nextIcps = restoreResult.nextIcps;

    const normalizedTargetIndices = normalizeTargetIndices(
      args.targetIndices,
      nextIcps.length
    );
    const targetIndices =
      normalizedTargetIndices.length > 0
        ? normalizedTargetIndices
        : listWorkspaceIcpSignalMissingIndices(nextIcps);

    const refreshedIndices: number[] = [];
    const failedIndices: number[] = [];

    for (const index of targetIndices) {
      const icp = nextIcps[index];

      if (!icp) {
        continue;
      }

      try {
        const generatedSignals = await generateWorkspaceIcpSignals({
          icp,
          useCaseKey: workspace.useCaseKey,
          workspaceDescription:
            workspace.improvedDescription || workspace.description,
        });

        nextIcps[index] = {
          ...icp,
          syntheticPosts: generatedSignals.syntheticPosts,
          qualificationKeywords: generatedSignals.qualificationKeywords,
        };
        refreshedIndices.push(index);
      } catch (error) {
        failedIndices.push(index);
        console.error("[WorkspaceIcpSignals] Failed to refresh ICP signals", {
          error:
            error instanceof Error
              ? error.message
              : "Unknown ICP signal refresh error",
          index,
          workspaceId: String(args.workspaceId),
        });
      }
    }

    const missingIndices = listWorkspaceIcpSignalMissingIndices(nextIcps);
    const shouldClearSystemIssue = missingIndices.length === 0;
    const updatedAt = getCurrentUTCTimestamp();

    if (
      restoreResult.restoredIndices.length > 0 ||
      refreshedIndices.length > 0 ||
      shouldClearSystemIssue
    ) {
      await ctx.runMutation(
        internal.workspaces.updateWorkspaceIcpSignalsInternal,
        {
          workspaceId: args.workspaceId,
          icps: nextIcps,
          clearSystemIssue: shouldClearSystemIssue,
          lastGeneratedAt: updatedAt,
        }
      );
    }

    const shouldRestartWorkflow =
      Boolean(args.restartWorkflow) &&
      shouldClearSystemIssue &&
      (workspace.onboardingIssueStatusCode === "icp_refresh_required" ||
        !hasAnyWorkspaceIcpSyntheticPosts(workspace.icps));

    if (shouldRestartWorkflow) {
      if (workspace.prospectingWorkflowStatus === "running") {
        await ctx.runMutation(
          internal.workflows.prospecting.updateWorkflowStatus,
          {
            workspaceId: args.workspaceId,
            status: "stopped",
          }
        );
      }

      await ctx.runAction(
        internal.workspaces.startProspectingWorkflowInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
    }

    return {
      success: failedIndices.length === 0,
      outcome:
        failedIndices.length === 0
          ? refreshedIndices.length > 0 ||
            restoreResult.restoredIndices.length > 0
            ? ("refreshed" as const)
            : ("noop" as const)
          : ("partial_failure" as const),
      refreshedIndices,
      restoredIndices: restoreResult.restoredIndices,
      failedIndices,
      missingIndices,
    };
  },
});
