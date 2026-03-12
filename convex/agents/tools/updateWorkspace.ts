// convex/agents/tools/updateWorkspace.ts
// Update an existing workspace with v4 fields

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal, components } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { icpSchema } from "./schemas";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { getSetupThreadTitle } from "../../lib/setupThreadHelpers";
import { resolveSetupThreadState } from "./workspaceSetupContext";

// ============================================================================
// Tool
// ============================================================================

/**
 * Updates an existing workspace with v4 fields (improved description and ICPs).
 * Use for v3 → v4 migration or when user wants to update their workspace.
 */
export const updateWorkspace = createTool({
  description:
    "Update an existing workspace with improved description and ICPs. Use this for v3 → v4 migration or when updating an existing workspace. ONLY call after user approval.",
  args: z.object({
    workspaceId: z.string().describe("The workspace ID to update"),
    seedDescription: z
      .string()
      .optional()
      .describe("New seed description if updating"),
    improvedDescription: z.string().describe("The AI-improved description"),
    icps: z
      .array(icpSchema)
      .min(2)
      .max(4)
      .describe("The approved ICP segments"),
    sourceUrl: z
      .string()
      .url()
      .optional()
      .describe("The source URL if provided"),
    descriptionSource: z
      .enum(["url", "manual", "agent"])
      .optional()
      .describe("Source of the description"),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    workspaceId?: string;
    error?: string;
  }> => {
    try {
      const setupThreadState = await resolveSetupThreadState(ctx, ctx.threadId);

      await ctx.runMutation(internal.workspaces.updateWorkspaceInternal, {
        workspaceId: args.workspaceId as Id<"workspaces">,
        seedDescription: args.seedDescription,
        improvedDescription: args.improvedDescription,
        description: args.improvedDescription, // Also update main description
        icps: args.icps,
        sourceUrl: args.sourceUrl,
        descriptionSource: args.descriptionSource,
        useCaseKey: setupThreadState?.useCaseKey,
        setupCompletedAt: getCurrentUTCTimestamp(),
      });

      if (ctx.threadId) {
        try {
          const setupSession = await ctx.runQuery(
            internal.setupSessions.getByThreadIdInternal,
            { threadId: ctx.threadId }
          );
          await ctx.runMutation(
            internal.workspaces.setOnboardingThreadInternal,
            {
              workspaceId: args.workspaceId as Id<"workspaces">,
              threadId: ctx.threadId,
            }
          );
          await ctx.runMutation(components.agent.threads.updateThread, {
            threadId: ctx.threadId,
            patch: {
              title: getSetupThreadTitle(args.workspaceId),
            },
          });
          if (setupSession) {
            await ctx.runMutation(
              internal.setupSessions.recordProvisionedWorkspaceInternal,
              {
                sessionId: setupSession._id,
                targetWorkspaceId: args.workspaceId as Id<"workspaces">,
                workspaceName: setupSession.draftName ?? "Workspace",
              }
            );
          }
        } catch (threadLinkError) {
          console.warn(
            "[updateWorkspace] Failed to link setup thread to workspace:",
            threadLinkError
          );
        }
      }

      return {
        success: true,
        workspaceId: args.workspaceId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to update workspace: ${errorMessage}`,
      };
    }
  },
});
