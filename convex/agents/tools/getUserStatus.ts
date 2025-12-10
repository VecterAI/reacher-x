// convex/agents/tools/getUserStatus.ts
// Get current user status and workspace state

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

// ============================================================================
// Tool
// ============================================================================

/**
 * Gets the current user's status and workspace state.
 * Used to determine which conversation flow to follow.
 */
export const getUserStatus = createTool({
  description:
    "Get the current user's status including whether they have a workspace and if it needs v4 migration. Call this at the start of the conversation to understand the user's state.",
  args: z.object({}),
  handler: async (ctx): Promise<{
    hasWorkspace: boolean;
    needsV4Migration: boolean;
    workspaceId?: string;
    workspaceName?: string;
    existingDescription?: string;
    hasIcps: boolean;
  }> => {
    // ctx.userId is the user ID from the agent context
    if (!ctx.userId) {
      return {
        hasWorkspace: false,
        needsV4Migration: false,
        hasIcps: false,
      };
    }

    // Get user's default workspace
    const workspace = await ctx.runQuery(
      internal.workspaces.getDefaultWorkspaceInternal,
      { userId: ctx.userId as Id<"users"> }
    );

    if (!workspace) {
      return {
        hasWorkspace: false,
        needsV4Migration: false,
        hasIcps: false,
      };
    }

    // Check if workspace has v4 fields (icps array with structure)
    const hasIcps = Array.isArray(workspace.icps) && workspace.icps.length > 0;
    const needsV4Migration = !hasIcps;

    return {
      hasWorkspace: true,
      needsV4Migration,
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      existingDescription: workspace.description,
      hasIcps,
    };
  },
});
