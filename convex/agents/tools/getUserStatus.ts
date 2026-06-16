// convex/agents/tools/getUserStatus.ts
// Get current user status and workspace state

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { hasRequiredWorkspaceAgentData } from "../../lib/workspaceSetup";
import { buildSetupFlowState } from "../../lib/setupFlowCore";
import { isPaidPlanTier, type PlanTier } from "../../lib/planConstants";

// ============================================================================
// Tool
// ============================================================================

/**
 * Gets the current user's status and workspace state.
 * Used to determine which conversation flow to follow.
 */
export const getUserStatus = createTool({
  description:
    "Get the current user's onboarding, workspace, plan, and connection state. Call this first so your greeting and next step match the real setup flow.",
  inputSchema: z.object({}),
  execute: async (
    ctx
  ): Promise<{
    firstName?: string;
    hasWorkspace: boolean;
    workspaceSetupComplete: boolean;
    inSetupFlow: boolean;
    setupSessionMode?: "first_workspace" | "new_workspace";
    setupSessionStatus?: string;
    currentStepId?: string;
    currentStepNumber?: number;
    totalSteps?: number;
    visibleSteps?: Array<{ id: string; label: string; stepNumber: number }>;
    googleConnected: boolean;
    xConnected: boolean;
    planTier: PlanTier;
    workspaces: Array<{ id: string; name: string; role: "owner" }>;
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
        workspaceSetupComplete: false,
        inSetupFlow: Boolean(setupSession),
        setupSessionMode: setupSession?.mode,
        setupSessionStatus: setupSession?.status,
        googleConnected: false,
        xConnected: false,
        planTier: "free",
        workspaces: [],
        hasIcps: false,
      };
    }

    const userId = ctx.userId as Id<"users">;
    const [user, workspace, workspaces, flowContext] = await Promise.all([
      ctx.runQuery(internal.users.getUserByIdInternal, { userId }),
      ctx.runQuery(internal.workspaces.getDefaultWorkspaceInternal, {
        userId,
      }),
      ctx.runQuery(internal.workspaces.getUserWorkspacesInternal, { userId }),
      ctx.runQuery(internal.setupSessions.getSetupUserFlowContextInternal, {
        userId,
      }),
    ]);
    const googleConnected = Boolean(user?.email);
    const visibleSetupState = setupSession
      ? buildSetupFlowState({
          status: setupSession.status,
          requiresConnections: !(googleConnected && flowContext.xConnected),
          requiresPlan: !isPaidPlanTier(flowContext.planTier),
        })
      : null;

    if (!workspace) {
      return {
        firstName: user?.firstName,
        hasWorkspace: false,
        workspaceSetupComplete: false,
        inSetupFlow: Boolean(setupSession),
        setupSessionMode: setupSession?.mode,
        setupSessionStatus: setupSession?.status,
        currentStepId: visibleSetupState?.currentStepId,
        currentStepNumber: visibleSetupState?.currentStepNumber,
        totalSteps: visibleSetupState?.totalSteps,
        visibleSteps: visibleSetupState?.visibleSteps,
        googleConnected,
        xConnected: flowContext.xConnected,
        planTier: flowContext.planTier,
        workspaces: workspaces.map(
          (item: { _id: Id<"workspaces">; name: string }) => ({
            id: String(item._id),
            name: item.name,
            role: "owner" as const,
          })
        ),
        hasIcps: false,
      };
    }

    // A workspace is only complete once the agent-ready setup data exists.
    const hasIcps = Array.isArray(workspace.icps) && workspace.icps.length > 0;
    const workspaceSetupComplete = hasRequiredWorkspaceAgentData(workspace);

    return {
      firstName: user?.firstName,
      hasWorkspace: true,
      workspaceSetupComplete,
      inSetupFlow: Boolean(setupSession),
      setupSessionMode: setupSession?.mode,
      setupSessionStatus: setupSession?.status,
      currentStepId: visibleSetupState?.currentStepId,
      currentStepNumber: visibleSetupState?.currentStepNumber,
      totalSteps: visibleSetupState?.totalSteps,
      visibleSteps: visibleSetupState?.visibleSteps,
      googleConnected,
      xConnected: flowContext.xConnected,
      planTier: flowContext.planTier,
      workspaces: workspaces.map(
        (item: { _id: Id<"workspaces">; name: string }) => ({
          id: String(item._id),
          name: item.name,
          role: "owner" as const,
        })
      ),
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      existingDescription: workspace.description,
      hasIcps,
    };
  },
});
