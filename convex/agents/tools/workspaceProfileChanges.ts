"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { icpFormEntrySchema } from "../../../shared/lib/schemas/validation";
import { getWorkspaceUseCase } from "../../../shared/lib/workspaceUseCases";
import { createWorkspaceProfileChangeArtifact } from "../../../shared/lib/json-render/agentArtifacts";
import { resolveWorkspaceMemoryContext } from "./workspaceMemoryHelpers";
import { runLoggedAgentTool } from "./logging";

async function resolveProfileChangeContext(
  ctx: Parameters<typeof resolveWorkspaceMemoryContext>[0],
  moduleName: string
): Promise<{
  userId: Id<"users"> | null;
  workspaceId: Id<"workspaces"> | null;
  profileLabelPlural: string;
}> {
  const resolved = await resolveWorkspaceMemoryContext(ctx, moduleName, null);
  const userId = resolved.userId;
  const workspaceId = resolved.workspaceId
    ? (resolved.workspaceId as Id<"workspaces">)
    : null;
  if (!userId || !workspaceId) {
    return {
      userId,
      workspaceId,
      profileLabelPlural: "Ideal profiles",
    };
  }

  const workspace = await ctx.runQuery(internal.workspaces.getById, {
    workspaceId,
  });
  return {
    userId,
    workspaceId,
    profileLabelPlural: getWorkspaceUseCase(workspace?.useCaseKey)
      .profileLabelPlural,
  };
}

const proposedProfilesSchema = z
  .array(icpFormEntrySchema)
  .min(1)
  .describe(
    "The complete proposed ideal-profile list. Each profile represents one distinct persona. Preserve every unchanged saved profile and include all requested additions, updates, and removals. Channels may only use X/Twitter or LinkedIn."
  );

export const proposeWorkspaceProfiles = createTool({
  description:
    "Create or refine the single pending workspace-wide ideal-profile proposal. Use only when the user explicitly asks to add, update, or remove ideal profiles. Inspect the workspace first, then pass the complete resulting profile list. This stages a review card and never changes saved workspace data.",
  inputSchema: z.object({
    profiles: proposedProfilesSchema,
  }),
  execute: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    message: string;
    requestId?: string;
    revision?: number;
    addedTitles?: string[];
    updatedTitles?: string[];
    removedTitles?: string[];
    artifact?: ReturnType<typeof createWorkspaceProfileChangeArtifact>;
  }> =>
    runLoggedAgentTool(
      ctx,
      { moduleName: "proposeWorkspaceProfiles", args },
      async (logEvent) => {
        const context = await resolveProfileChangeContext(
          ctx,
          "proposeWorkspaceProfiles"
        );
        if (!context.userId || !context.workspaceId || !ctx.threadId) {
          return {
            success: false,
            message:
              "I couldn't determine which workspace should receive this proposal.",
          };
        }

        try {
          const result = await ctx.runMutation(
            internal.workspaceProfileChanges.upsertPendingInternal,
            {
              userId: context.userId,
              workspaceId: context.workspaceId,
              threadId: ctx.threadId,
              proposedIcps: args.profiles,
            }
          );
          const artifact = createWorkspaceProfileChangeArtifact({
            requestId: result.requestId,
          });
          logEvent.set({
            workspace: { id: context.workspaceId },
            workspace_profile_change: {
              id: result.requestId,
              revision: result.revision,
            },
          });
          return {
            success: true,
            message: `${context.profileLabelPlural} proposal ready for review.`,
            requestId: result.requestId,
            revision: result.revision,
            addedTitles: result.addedTitles,
            updatedTitles: result.updatedTitles,
            removedTitles: result.removedTitles,
            artifact,
          };
        } catch (error) {
          logEvent.error(error);
          return {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "Could not prepare the workspace profile proposal.",
          };
        }
      }
    ),
});

export const approveWorkspaceProfiles = createTool({
  description:
    "Apply the single pending workspace ideal-profile proposal. Call only when the user explicitly approves or asks to apply the proposal. The workspace and proposal are resolved from thread context; no IDs are accepted.",
  inputSchema: z.object({}),
  execute: async (
    ctx
  ): Promise<{
    success: boolean;
    message: string;
    artifact?: ReturnType<typeof createWorkspaceProfileChangeArtifact>;
  }> => {
    const context = await resolveProfileChangeContext(
      ctx,
      "approveWorkspaceProfiles"
    );
    if (!context.userId || !context.workspaceId) {
      return {
        success: false,
        message: "I couldn't resolve a workspace proposal to approve.",
      };
    }

    const result = await ctx.runMutation(
      internal.workspaceProfileChanges.approvePendingForWorkspaceInternal,
      {
        userId: context.userId,
        workspaceId: context.workspaceId,
      }
    );
    if (result.outcome === "missing") {
      return { success: false, message: "There is no pending proposal." };
    }
    const artifact = result.requestId
      ? createWorkspaceProfileChangeArtifact({
          requestId: result.requestId,
        })
      : undefined;
    if (result.outcome === "stale") {
      return {
        success: false,
        message:
          "The workspace changed after this proposal was prepared. Create a fresh proposal before applying it.",
        artifact,
      };
    }
    return {
      success: result.outcome === "applied",
      message:
        result.outcome === "applied"
          ? `${context.profileLabelPlural} updated.`
          : "This proposal is no longer pending approval.",
      artifact,
    };
  },
});

export const rejectWorkspaceProfiles = createTool({
  description:
    "Reject the single pending workspace ideal-profile proposal. Call when the user explicitly declines or cancels the proposed profile changes. No IDs are accepted.",
  inputSchema: z.object({}),
  execute: async (
    ctx
  ): Promise<{
    success: boolean;
    message: string;
    artifact?: ReturnType<typeof createWorkspaceProfileChangeArtifact>;
  }> => {
    const context = await resolveProfileChangeContext(
      ctx,
      "rejectWorkspaceProfiles"
    );
    if (!context.userId || !context.workspaceId) {
      return {
        success: false,
        message: "I couldn't resolve a workspace proposal to reject.",
      };
    }

    const result = await ctx.runMutation(
      internal.workspaceProfileChanges.rejectPendingForWorkspaceInternal,
      {
        userId: context.userId,
        workspaceId: context.workspaceId,
      }
    );
    if (result.outcome === "missing") {
      return { success: false, message: "There is no pending proposal." };
    }
    return {
      success: true,
      message: `${context.profileLabelPlural} proposal rejected.`,
      artifact: createWorkspaceProfileChangeArtifact({
        requestId: result.requestId,
      }),
    };
  },
});
