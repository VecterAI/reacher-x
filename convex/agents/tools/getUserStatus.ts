// convex/agents/tools/getUserStatus.ts
// Get current user status and workspace state

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { hasRequiredWorkspaceAgentData } from "../../lib/workspaceSetup";

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
  handler: async (
    ctx
  ): Promise<{
    hasWorkspace: boolean;
    needsV4Migration: boolean;
    inSetupFlow: boolean;
    setupSessionMode?: "first_workspace" | "new_workspace";
    setupSessionStatus?: string;
    workspaceId?: string;
    workspaceName?: string;
    existingDescription?: string;
    hasIcps: boolean;
  }> => {
    const setupSession = ctx.threadId
      ? await ctx.runQuery(internal.setupSessions.getByThreadIdInternal, {
          threadId: ctx.threadId,
        })
      : null;

    // ctx.userId is the user ID from the agent context
    if (!ctx.userId) {
      return {
        hasWorkspace: false,
        needsV4Migration: false,
        inSetupFlow: Boolean(setupSession),
        setupSessionMode: setupSession?.mode,
        setupSessionStatus: setupSession?.status,
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
        inSetupFlow: Boolean(setupSession),
        setupSessionMode: setupSession?.mode,
        setupSessionStatus: setupSession?.status,
        hasIcps: false,
      };
    }

    // A workspace is only complete once the agent-ready setup data exists.
    const hasIcps = Array.isArray(workspace.icps) && workspace.icps.length > 0;
    const needsV4Migration = !hasRequiredWorkspaceAgentData(workspace);

    return {
      hasWorkspace: true,
      needsV4Migration,
      inSetupFlow: Boolean(setupSession),
      setupSessionMode: setupSession?.mode,
      setupSessionStatus: setupSession?.status,
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      existingDescription: workspace.description,
      hasIcps,
    };
  },
});
