import { query } from "./lib/functionBuilders";
import {
  getUserByIdentity,
  getDefaultWorkspaceForUser,
} from "./lib/accessHelpers";
import {
  getActiveSetupSessionForUser,
  getSetupSessionDisplayName,
  isActiveSetupSession,
} from "./lib/setupSessionCore";
import { getWorkspaceStatsSnapshot } from "./workspaceStats";
import { hasRequiredWorkspaceAgentData } from "./lib/workspaceSetup";
import {
  deriveWorkspaceLockState,
  mapInternalIssueCodeToUserVisibleIssueState,
} from "./lib/onboardingNavigation";
import { resolveWorkspaceUseCaseKey } from "../shared/lib/workspaceUseCases";

function getEmptyShellState() {
  return {
    activeContextType: null as "workspace" | "setup_session" | null,
    locked: false,
    lockState: "no_workspace" as const,
    redirect: {
      sessionId: null as string | null,
      threadId: null as string | null,
      href: "/agent/setup",
    },
    effectiveUseCaseKey: null as string | null,
    activeWorkspaceId: null as string | null,
    activeSetupSessionId: null as string | null,
    readyQualifiedEnrichedCount: 0,
    activeSetupSession: null as null | {
      sessionId: string;
      threadId: string;
      status: string;
      displayName: string;
      useCaseKey: string;
    },
    switcherItems: [] as Array<
      | {
          kind: "workspace";
          value: string;
          label: string;
          workspaceId: string;
          isActive: boolean;
        }
      | {
          kind: "draft";
          value: string;
          label: string;
          sessionId: string;
          threadId: string;
          isActive: boolean;
        }
    >,
    userVisibleIssueState: mapInternalIssueCodeToUserVisibleIssueState(),
  };
}

type ShellSwitcherItem =
  | {
      kind: "workspace";
      value: string;
      label: string;
      workspaceId: string;
      isActive: boolean;
    }
  | {
      kind: "draft";
      value: string;
      label: string;
      sessionId: string;
      threadId: string;
      isActive: boolean;
    };

export const getAppShellState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return getEmptyShellState();
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return getEmptyShellState();
    }

    const [activeSession, defaultWorkspace, workspaces] = await Promise.all([
      getActiveSetupSessionForUser(ctx.db, user._id),
      getDefaultWorkspaceForUser(ctx, user._id),
      ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect(),
    ]);

    const switcherItems: ShellSwitcherItem[] = workspaces.map((workspace) => ({
      kind: "workspace" as const,
      value: String(workspace._id),
      label: workspace.name,
      workspaceId: String(workspace._id),
      isActive:
        activeSession && activeSession.targetWorkspaceId
          ? activeSession.targetWorkspaceId === workspace._id
          : !activeSession && defaultWorkspace?._id === workspace._id,
    }));

    if (isActiveSetupSession(activeSession)) {
      const isRefineFromWorkspace = Boolean(activeSession.refineFromWorkspace);

      switcherItems.unshift({
        kind: "draft" as const,
        value: String(activeSession._id),
        label: getSetupSessionDisplayName(activeSession),
        sessionId: String(activeSession._id),
        threadId: activeSession.setupThreadId,
        isActive: true,
      });

      // Refine-from-/workspace runs embedded next to the workspace form; do not
      // lock navigation to /agent/setup (OnboardingLockGuardProvider).
      return {
        activeContextType: "setup_session" as const,
        locked: isRefineFromWorkspace
          ? false
          : activeSession.status !== "ready",
        lockState: activeSession.status,
        redirect: {
          sessionId: String(activeSession._id),
          threadId: activeSession.setupThreadId,
          href: `/agent/setup?sessionId=${activeSession._id}&threadId=${encodeURIComponent(activeSession.setupThreadId)}`,
        },
        effectiveUseCaseKey: resolveWorkspaceUseCaseKey(
          activeSession.useCaseKey
        ),
        activeWorkspaceId: activeSession.targetWorkspaceId
          ? String(activeSession.targetWorkspaceId)
          : defaultWorkspace
            ? String(defaultWorkspace._id)
            : null,
        activeSetupSessionId: String(activeSession._id),
        readyQualifiedEnrichedCount: 0,
        activeSetupSession: {
          sessionId: String(activeSession._id),
          threadId: activeSession.setupThreadId,
          status: activeSession.status,
          displayName: getSetupSessionDisplayName(activeSession),
          useCaseKey: resolveWorkspaceUseCaseKey(activeSession.useCaseKey),
        },
        switcherItems,
        userVisibleIssueState: mapInternalIssueCodeToUserVisibleIssueState(),
      };
    }

    if (!defaultWorkspace) {
      // Authenticated user with no default workspace must stay on setup; keep
      // `locked` true so OnboardingLockGuardProvider does not bounce `/agent/setup`
      // back to `/` while the home page redirects incomplete setup to `/agent/setup`.
      return { ...getEmptyShellState(), locked: true };
    }

    const workspaceStats = await getWorkspaceStatsSnapshot({
      db: ctx.db,
      workspace: defaultWorkspace,
    });
    const readyQualifiedEnrichedCount =
      workspaceStats.readyQualifiedEnrichedCount;
    const hasRequiredSetupData =
      hasRequiredWorkspaceAgentData(defaultWorkspace);
    const lockState = deriveWorkspaceLockState({
      hasWorkspace: true,
      hasRequiredSetupData,
      readyQualifiedEnrichedCount,
    });

    return {
      activeContextType: "workspace" as const,
      locked: lockState !== "ready",
      lockState,
      redirect: {
        sessionId: null,
        threadId: defaultWorkspace.onboardingThreadId ?? null,
        href: defaultWorkspace.onboardingThreadId
          ? `/agent/setup?threadId=${encodeURIComponent(defaultWorkspace.onboardingThreadId)}`
          : "/agent/setup",
      },
      effectiveUseCaseKey: resolveWorkspaceUseCaseKey(
        defaultWorkspace.useCaseKey
      ),
      activeWorkspaceId: String(defaultWorkspace._id),
      activeSetupSessionId: null,
      readyQualifiedEnrichedCount,
      activeSetupSession: null,
      switcherItems,
      userVisibleIssueState: mapInternalIssueCodeToUserVisibleIssueState(
        defaultWorkspace.onboardingIssueStatusCode
      ),
    };
  },
});
