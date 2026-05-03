import { query } from "./lib/functionBuilders";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
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
import { getWorkspaceStatsActionableReadyCount } from "./lib/readModelHelpers";
import { resolveWorkspaceUseCaseKey } from "../shared/lib/workspaceUseCases";
import {
  isSetupSessionAccessibleForUser,
  isWorkspaceAccessibleForUser,
  resolveSetupSessionEntitlementSlot,
  resolveWorkspaceEntitlementSlot,
} from "./lib/workspaceEntitlements";
import { deriveWorkspaceSystemStatus } from "./lib/workspaceSystem";
import {
  preferredShellContextValidator,
  shouldPreferWorkspaceContext,
} from "./lib/preferredShellContext";

async function getWorkspaceActiveStyleProfileState(
  ctx: Pick<QueryCtx, "db">,
  workspaceId: Id<"workspaces"> | null | undefined
) {
  if (!workspaceId) {
    return {
      platform: null as "twitter" | "linkedin" | null,
      status: null as
        | "none"
        | "collecting"
        | "analyzing"
        | "ready"
        | "failed"
        | null,
    };
  }

  const profiles = await ctx.db
    .query("workspaceStyleProfiles")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const rank = { analyzing: 2, collecting: 1 } as const;
  const activeProfiles = profiles
    .filter(
      (
        profile
      ): profile is (typeof profiles)[number] & {
        platform: "twitter" | "linkedin";
        status: "collecting" | "analyzing";
      } => profile.status === "collecting" || profile.status === "analyzing"
    )
    .sort((left, right) => {
      const rankDelta = rank[right.status] - rank[left.status];
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return left.platform === "twitter" ? -1 : 1;
    });

  if (activeProfiles.length > 0) {
    return {
      platform: activeProfiles[0].platform,
      status: activeProfiles[0].status,
    };
  }

  const twitterProfile = profiles.find(
    (profile) => profile.platform === "twitter"
  );
  return {
    platform: twitterProfile?.platform ?? null,
    status: twitterProfile?.status ?? "none",
  };
}

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
    notificationWorkspaceId: null as string | null,
    activeWorkspaceStyleProfileStatus: null as
      | "none"
      | "collecting"
      | "analyzing"
      | "ready"
      | "failed"
      | null,
    activeWorkspaceStyleProfilePlatform: null as "twitter" | "linkedin" | null,
    activeSetupSessionId: null as string | null,
    actionableReadyCount: 0,
    readyQualifiedEnrichedCount: 0,
    pendingNotificationCount: 0,
    workspaceSystemStatus: null as ReturnType<
      typeof deriveWorkspaceSystemStatus
    > | null,
    activeSetupSession: null as null | {
      sessionId: string;
      threadId: string;
      status: string;
      displayName: string;
      useCaseKey: string;
    },
    lockedWorkspaceCount: 0,
    lockedDraftCount: 0,
    showUnlockCta: false,
    unlockCtaLabel: "Unlock workspaces",
    switcherItems: [] as Array<
      | {
          kind: "workspace";
          value: string;
          label: string;
          workspaceId: string;
          isActive: boolean;
          locked: boolean;
          entitlementSlot: number;
        }
      | {
          kind: "draft";
          value: string;
          label: string;
          sessionId: string;
          threadId: string;
          isActive: boolean;
          locked: boolean;
          entitlementSlot: number;
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
      locked: boolean;
      entitlementSlot: number;
    }
  | {
      kind: "draft";
      value: string;
      label: string;
      sessionId: string;
      threadId: string;
      isActive: boolean;
      locked: boolean;
      entitlementSlot: number;
    };

export const getAppShellState = query({
  args: {
    preferredContext: preferredShellContextValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return getEmptyShellState();
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return getEmptyShellState();
    }

    const [activeSession, defaultWorkspace, workspaces] = await Promise.all([
      getActiveSetupSessionForUser(ctx.db, user._id, {
        includeRefine: false,
      }),
      getDefaultWorkspaceForUser(ctx, user._id),
      ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect(),
    ]);

    const accessibleActiveSession =
      isActiveSetupSession(activeSession) &&
      (await isSetupSessionAccessibleForUser(ctx, activeSession))
        ? activeSession
        : null;
    const preferWorkspaceContext = shouldPreferWorkspaceContext(
      args.preferredContext,
      defaultWorkspace
    );

    const workspaceItems = await Promise.all(
      workspaces
        .filter((workspace) => Boolean(workspace.setupCompletedAt))
        .map(async (workspace) => {
          const entitlementSlot = await resolveWorkspaceEntitlementSlot(
            ctx,
            workspace
          );
          const locked = !(await isWorkspaceAccessibleForUser(ctx, workspace));

          return {
            kind: "workspace" as const,
            value: String(workspace._id),
            label: workspace.name,
            workspaceId: String(workspace._id),
            locked,
            entitlementSlot,
            isActive:
              preferWorkspaceContext
                ? defaultWorkspace?._id === workspace._id
                : accessibleActiveSession &&
                    accessibleActiveSession.targetWorkspaceId
                  ? accessibleActiveSession.targetWorkspaceId === workspace._id
                  : !accessibleActiveSession &&
                  defaultWorkspace?._id === workspace._id,
          };
        })
    );

    const switcherItems: ShellSwitcherItem[] = [...workspaceItems];

    if (isActiveSetupSession(activeSession)) {
      const sessionLocked = !(await isSetupSessionAccessibleForUser(
        ctx,
        activeSession
      ));
      const sessionEntitlementSlot = await resolveSetupSessionEntitlementSlot(
        ctx,
        activeSession
      );
      const isRefineFromWorkspace = Boolean(activeSession.refineFromWorkspace);

      switcherItems.unshift({
        kind: "draft" as const,
        value: String(activeSession._id),
        label: getSetupSessionDisplayName(activeSession),
        sessionId: String(activeSession._id),
        threadId: activeSession.setupThreadId,
        isActive: !sessionLocked && !preferWorkspaceContext,
        locked: sessionLocked,
        entitlementSlot: sessionEntitlementSlot,
      });

      // Refine-from-/workspace runs embedded next to the workspace form; do not
      // lock navigation to /agent/setup (OnboardingLockGuardProvider).
      if (!sessionLocked && !preferWorkspaceContext) {
        const activeStyleProfileState = activeSession.targetWorkspaceId
          ? await getWorkspaceActiveStyleProfileState(
              ctx,
              activeSession.targetWorkspaceId
            )
          : await getWorkspaceActiveStyleProfileState(
              ctx,
              defaultWorkspace?._id ?? null
            );
        const lockedWorkspaceCount = workspaceItems.filter(
          (item) => item.locked
        ).length;
        const lockedDraftCount = switcherItems.filter(
          (item) => item.kind === "draft" && item.locked
        ).length;
        const totalLockedCount = lockedWorkspaceCount + lockedDraftCount;

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
          notificationWorkspaceId: activeSession.targetWorkspaceId
            ? String(activeSession.targetWorkspaceId)
            : null,
          activeWorkspaceStyleProfileStatus: activeStyleProfileState.status,
          activeWorkspaceStyleProfilePlatform: activeStyleProfileState.platform,
          activeSetupSessionId: String(activeSession._id),
          actionableReadyCount: 0,
          readyQualifiedEnrichedCount: 0,
          workspaceSystemStatus: null,
          activeSetupSession: {
            sessionId: String(activeSession._id),
            threadId: activeSession.setupThreadId,
            status: activeSession.status,
            displayName: getSetupSessionDisplayName(activeSession),
            useCaseKey: resolveWorkspaceUseCaseKey(activeSession.useCaseKey),
          },
          lockedWorkspaceCount,
          lockedDraftCount,
          showUnlockCta: totalLockedCount > 0,
          unlockCtaLabel:
            totalLockedCount === 1 ? "Unlock workspace" : "Unlock workspaces",
          switcherItems,
          userVisibleIssueState: mapInternalIssueCodeToUserVisibleIssueState(),
        };
      }
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
    const actionableReadyCount =
      getWorkspaceStatsActionableReadyCount(workspaceStats);
    const readyQualifiedEnrichedCount =
      workspaceStats.readyQualifiedEnrichedCount;
    const hasRequiredSetupData =
      hasRequiredWorkspaceAgentData(defaultWorkspace);
    const activeStyleProfileState = await getWorkspaceActiveStyleProfileState(
      ctx,
      defaultWorkspace._id
    );
    const lockState = deriveWorkspaceLockState({
      hasWorkspace: true,
      hasRequiredSetupData,
      readyCount: actionableReadyCount,
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
      notificationWorkspaceId: String(defaultWorkspace._id),
      activeWorkspaceStyleProfileStatus:
        activeStyleProfileState.status ?? "none",
      activeWorkspaceStyleProfilePlatform:
        activeStyleProfileState.platform ?? null,
      activeSetupSessionId: null,
      actionableReadyCount,
      readyQualifiedEnrichedCount,
      pendingNotificationCount: workspaceStats.pendingNotificationCount,
      workspaceSystemStatus: deriveWorkspaceSystemStatus(defaultWorkspace),
      activeSetupSession: null,
      lockedWorkspaceCount: workspaceItems.filter((item) => item.locked).length,
      lockedDraftCount: switcherItems.filter(
        (item) => item.kind === "draft" && item.locked
      ).length,
      showUnlockCta: switcherItems.some((item) => item.locked),
      unlockCtaLabel:
        switcherItems.filter((item) => item.locked).length === 1
          ? "Unlock workspace"
          : "Unlock workspaces",
      switcherItems,
      userVisibleIssueState: mapInternalIssueCodeToUserVisibleIssueState(
        defaultWorkspace.onboardingIssueStatusCode
      ),
    };
  },
});
