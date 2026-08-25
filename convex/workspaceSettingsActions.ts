"use node";

import type { WorkflowId } from "@convex-dev/workflow";
import type { ProviderMetadata } from "ai";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action } from "./lib/functionBuilders";
import { workflow } from "./lib/workflow";
import { classifySetupInput } from "./lib/setupInputClassificationCore";
import { generateInitialSetupDraft } from "./lib/setupGenerationCore";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import {
  mergeRegeneratedWorkspaceProfiles,
  resolveManualProfilesForTargetingUpdate,
  runPostSaveProspectingMaintenance,
} from "./lib/workspaceTargetingUpdateCore";
import { validateDescription } from "../shared/lib/utils/validation/validation";
import { icpValidator, workspaceUseCaseKeyValidator } from "./validators";

type WorkspaceProfile = NonNullable<Doc<"workspaces">["icps"]>[number];
type WorkspaceTargetingResult = {
  workspaceId: Doc<"workspaces">["_id"];
  improvedDescription: string;
  useCaseKey: NonNullable<Doc<"workspaces">["useCaseKey"]>;
  generatedProfileCount: number;
  preservedManualProfileCount: number;
  profiles: WorkspaceProfile[];
  deletedKeywordCount: number;
  prospectingRestarted: boolean;
};

async function recordGenerationTelemetry(
  ctx: ActionCtx,
  args: {
    agentName: string;
    telemetry: {
      model: string;
      providerMetadata?: ProviderMetadata;
      request: { prompt: string; system: string };
      response: unknown;
      usage: { providerSelected?: string | null };
    };
    threadId?: string;
    userId: string;
  }
) {
  await Promise.all([
    ctx.runMutation(internal.agentTelemetry.insertUsageEvent, {
      agentName: args.agentName,
      model: args.telemetry.model,
      provider: args.telemetry.usage.providerSelected ?? undefined,
      providerMetadata: args.telemetry.providerMetadata,
      threadId: args.threadId,
      usage: args.telemetry.usage,
      userId: args.userId,
    }),
    persistRawModelResponse(ctx, {
      agentName: args.agentName,
      providerMetadata: args.telemetry.providerMetadata,
      request: args.telemetry.request,
      response: args.telemetry.response,
      threadId: args.threadId,
      userId: args.userId,
    }),
  ]);
}

async function clearWorkspaceKeywords(
  ctx: ActionCtx,
  workspaceId: Doc<"workspaces">["_id"]
) {
  let deleted = 0;
  let hasMore = true;

  while (hasMore) {
    const result: { deleted: number; hasMore: boolean } = await ctx.runMutation(
      internal.keywords.deleteWorkspaceKeywordsBatchInternal,
      { workspaceId, limit: 250 }
    );
    deleted += result.deleted;
    hasMore = result.hasMore;
  }

  return deleted;
}

export const regenerateWorkspaceTargeting = action({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    sourceUrl: v.optional(v.string()),
    rawUserDescription: v.string(),
    currentProfiles: v.array(icpValidator),
  },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    improvedDescription: v.string(),
    useCaseKey: workspaceUseCaseKeyValidator,
    generatedProfileCount: v.number(),
    preservedManualProfileCount: v.number(),
    profiles: v.array(icpValidator),
    deletedKeywordCount: v.number(),
    prospectingRestarted: v.boolean(),
  }),
  handler: async (ctx, args): Promise<WorkspaceTargetingResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const workspace: Doc<"workspaces"> | null = await ctx.runQuery(
      internal.workspaces.getWorkspaceForTargetingUpdateInternal,
      { workspaceId: args.workspaceId, userId: user._id }
    );
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const rawUserDescription = args.rawUserDescription.trim();
    const validation = validateDescription(rawUserDescription, true);
    if (!validation.isValid) {
      throw new Error(validation.error ?? "Audience description is invalid");
    }

    const classification = await classifySetupInput(rawUserDescription);
    await recordGenerationTelemetry(ctx, {
      agentName: "Workspace Input Classifier",
      telemetry: classification.telemetry,
      threadId: workspace.onboardingThreadId,
      userId: String(user._id),
    });
    if (!classification.accepted) {
      throw new Error(
        "Describe the people you want to find and why you want to reach them."
      );
    }

    const manualProfiles = resolveManualProfilesForTargetingUpdate({
      existingProfiles: workspace.icps ?? [],
      submittedProfiles: args.currentProfiles,
    });
    const generation = await generateInitialSetupDraft({
      currentProfiles: manualProfiles,
      operation: "regenerateWorkspaceTargeting",
      seedDescription: rawUserDescription,
      useCaseKey: classification.useCaseKey,
    });
    await recordGenerationTelemetry(ctx, {
      agentName: "Workspace Targeting Generator",
      telemetry: generation.telemetry,
      threadId: workspace.onboardingThreadId,
      userId: String(user._id),
    });

    let refreshedManualProfiles: WorkspaceProfile[] = manualProfiles;
    if (manualProfiles.length > 0) {
      const signalRefresh: {
        success: boolean;
        icps: WorkspaceProfile[];
      } = await ctx.runAction(
        internal.workspaceIcpSignals
          .generateWorkspaceIcpSignalsForProfilesInternal,
        {
          icps: manualProfiles,
          targetIndices: manualProfiles.map((_profile, index) => index),
          useCaseKey: classification.useCaseKey,
          workspaceDescription: generation.improvedDescription,
        }
      );
      if (!signalRefresh.success) {
        throw new Error(
          "The profiles could not be updated. Your current workspace is unchanged."
        );
      }
      refreshedManualProfiles = signalRefresh.icps;
    }

    const profiles = mergeRegeneratedWorkspaceProfiles({
      generatedProfiles: generation.icps,
      manualProfiles: refreshedManualProfiles,
    });
    await ctx.runMutation(
      internal.workspaces.applyRegeneratedWorkspaceTargetingInternal,
      {
        workspaceId: workspace._id,
        userId: user._id,
        name: args.name,
        sourceUrl: args.sourceUrl?.trim() || undefined,
        rawUserDescription,
        improvedDescription: generation.improvedDescription,
        icps: profiles,
        useCaseKey: classification.useCaseKey,
      }
    );

    if (workspace.prospectingWorkflowId) {
      try {
        await workflow.cancel(
          ctx,
          workspace.prospectingWorkflowId as WorkflowId
        );
      } catch (error) {
        console.warn(
          "[WorkspaceSettingsActions] Could not cancel the prior prospecting workflow",
          error
        );
      }
    }
    const maintenance = await runPostSaveProspectingMaintenance({
      stopProspecting:
        workspace.prospectingWorkflowId ||
        workspace.prospectingWorkflowStatus === "running"
          ? () =>
              ctx.runMutation(
                internal.workflows.prospecting.updateWorkflowStatus,
                { workspaceId: workspace._id, status: "stopped" }
              )
          : undefined,
      clearKeywords: () => clearWorkspaceKeywords(ctx, workspace._id),
      restartProspecting: async () => {
        const restartResult: { success: boolean } = await ctx.runAction(
          internal.workspaces.startProspectingWorkflowInternal,
          { workspaceId: workspace._id }
        );
        return restartResult.success;
      },
      onError: (error) => {
        console.error(
          "[WorkspaceSettingsActions] Targeting was saved, but prospecting could not restart",
          error
        );
      },
    });

    return {
      workspaceId: workspace._id,
      improvedDescription: generation.improvedDescription,
      useCaseKey: classification.useCaseKey,
      generatedProfileCount: profiles.length - refreshedManualProfiles.length,
      preservedManualProfileCount: refreshedManualProfiles.length,
      profiles,
      deletedKeywordCount: maintenance.deletedKeywordCount,
      prospectingRestarted: maintenance.prospectingRestarted,
    };
  },
});
