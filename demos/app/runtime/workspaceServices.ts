import {
  isProspectActionableReady,
  isProspectReadyQualifiedEnriched,
} from "@/convex/lib/readModelHelpers";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";
import { viewer } from "./appFixtures";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { deriveWorkspaceSystemStatus } from "@/convex/lib/workspaceSystem";

export function registerWorkspaceServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>,
  pendingNotificationCount: () => number
) {
  const workspaceFor = (id: string) => {
    const target = state.workspaces.find((item) => item._id === id);
    if (!target) throw new Error("Unknown workspace");
    return target;
  };
  const workspace = () => workspaceFor(state.selectedWorkspaceId);
  const prospects = () =>
    state.prospects.filter(
      (item) => item.workspaceId === state.selectedWorkspaceId
    );
  client.register(api.workspacePlanUsage.getServerTime, () =>
    getCurrentUTCTimestamp()
  );
  client.register(api.workspacePlanUsage.getCurrent, ({ workspaceId }) => {
    const current = workspaceFor(workspaceId);
    return {
      workspaceId: current._id,
      workspaceName: current.name,
      entityPlural: "people",
      discoveryVerb: "finding" as const,
      tier: "pro" as const,
      used: state.prospects.filter(
        (person) => person.workspaceId === workspaceId
      ).length,
      limit: 1000,
      cycleEnd: getCurrentUTCTimestamp() + 86400000,
      noticeKey: `demo-usage-${workspaceId}`,
      noticeDismissed: false,
      limitReached: false,
    };
  });
  client.register(api.users.getCurrentUser, () => viewer);
  client.register(api.workspaces.getDefaultWorkspace, workspace);
  client.register(api.workspaces.getUserWorkspaces, () => state.workspaces);
  client.register(
    api.workspacePlanStarts.getWorkspacePlanStartPreviewQuery,
    ({ workspaceId }) => ({
      draftPlanCount: [...state.plans.values()].filter(
        ({ plan }) =>
          plan.workspaceId === workspaceId && plan.status === "draft"
      ).length,
      draftPlanCountIsCapped: false,
    })
  );
  client.register(api.workspaces.getWorkspaceSetupStatus, () => ({
    status: "complete" as const,
    workspace: {
      id: workspace()._id,
      name: workspace().name,
      description: workspace().description,
      fitScoreMin: 70,
      fitScoreMax: 100,
      useCaseKey: workspace().useCaseKey,
      reportingTimeZone: "UTC",
    },
  }));
  const getShellState = (): FunctionReturnType<
    typeof api.shell.getAppShellState
  > => ({
    activeContextType: "workspace" as const,
    locked: false,
    lockState: "ready" as const,
    redirect: { sessionId: null, threadId: null, href: "/" },
    effectiveUseCaseKey: workspace().useCaseKey!,
    activeWorkspaceId: state.selectedWorkspaceId,
    notificationWorkspaceId: state.selectedWorkspaceId,
    activeWorkspaceStyleProfileStatus: "ready" as const,
    activeWorkspaceStyleProfilePlatform: "twitter" as const,
    activeSetupSessionId: null,
    actionableReadyCount: prospects().filter(isProspectActionableReady).length,
    readyQualifiedEnrichedCount: prospects().filter(
      isProspectReadyQualifiedEnriched
    ).length,
    pendingNotificationCount: pendingNotificationCount(),
    workspaceSystemStatus: deriveWorkspaceSystemStatus(workspace()),
    activeSetupSession: null,
    lockedWorkspaceCount: 0,
    lockedDraftCount: 0,
    showUnlockCta: false,
    unlockCtaLabel: "Unlock workspaces",
    switcherItems: state.workspaces.map((item, index) => ({
      kind: "workspace" as const,
      value: item._id,
      label: item.name,
      workspaceId: item._id,
      isActive: item._id === state.selectedWorkspaceId,
      locked: false,
      entitlementSlot: index + 1,
    })),
    userVisibleIssueState: { status: "none" as const, message: null },
  });
  client.register(api.shell.getAppShellState, getShellState);
  client.register(api.plans.getCurrentPlan, () => ({
    tier: "pro" as const,
    subscriptionTier: "pro" as const,
    workspaces: {
      used: state.workspaces.length,
      limit: 5,
      percentUsed: state.workspaces.length * 20,
    },
    complimentaryGrant: null,
    expiresAt: undefined,
    polarCustomerId: "demo_customer",
  }));
  client.register(api.plans.getWorkspaceCreationEligibility, () => ({
    allowed: true,
    tier: "pro" as const,
    used: state.workspaces.length,
    limit: 5,
    remaining: 5 - state.workspaces.length,
  }));
  client.register(api.workspaces.getWorkspaceDeletions, () => []);
  client.register(api.setupSessions.getNewWorkspaceDecisionState, () => ({
    activeDraft: null,
  }));
  client.register(api.workspaces.recordWorkspaceActivity, () => ({
    updated: true,
    now: getCurrentUTCTimestamp(),
  }));
  client.register(
    api.workspaces.setDefaultWorkspace,
    async ({ workspaceId }) => {
      workspaceFor(workspaceId);
      await new Promise((resolve) => setTimeout(resolve, 180));
      state.selectedWorkspaceId = workspaceId;
      return { workspaceId, switched: true };
    }
  );
  return { getShellState };
}
