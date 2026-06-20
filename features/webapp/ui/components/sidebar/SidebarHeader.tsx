"use client";
/**
 * SidebarHeader Component
 *
 * Displays tier-based content in the sidebar header:
 * - Top button: Upgrade plan / New workspace / Request custom limit
 * - Select switcher: Always visible, all tiers, with footer CTA
 */

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  SidebarHeader as SidebarHeaderBase,
  useSidebar,
} from "@/shared/ui/components/Sidebar";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import {
  AddIcon,
  FolderIcon,
  LockIcon,
  MailIcon,
  UpgradeIcon,
} from "@/shared/ui/components/icons";
import {
  useAuth,
  usePreferredShellQueryArgs,
  useQueryWithStatus,
} from "@/shared/hooks";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceTransition } from "@/features/webapp/contexts/WorkspaceTransitionContext";
import { useStore } from "@nanostores/react";
import { $onboardingLock } from "@/shared/stores/onboarding";
import {
  setPreferredShellContext,
  usePreferredShellContext,
} from "@/shared/stores/preferredShellContext";
import { useNewWorkspaceDraftFlow } from "@/features/webapp/hooks/useNewWorkspaceDraftFlow";
import { getPlansUpgradeHref } from "@/features/billing/lib/plansUpgradeUrl";
import { buildSetupHref } from "@/shared/lib/urls/setupHref";
import { logger } from "@/shared/lib/logger";

const HIGHEST_TIER = "pro";
const CUSTOM_LIMIT_EMAIL = "creativecoder.crco@gmail.com";
const sidebarHeaderLogger = logger.withScope("SidebarHeader");

type WorkspaceSwitcherItem = {
  value: string;
  label: string;
  isActive?: boolean;
  locked?: boolean;
  kind?: "draft" | "workspace" | string;
  workspaceId?: string;
  sessionId?: string;
  threadId?: string;
};

export function SidebarHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { isAuthenticated, isLoading: authLoading, workspace } = useAuth();
  const locked = useStore($onboardingLock);
  const preferredShellContext = usePreferredShellContext();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const setDefaultWorkspace = useMutation(api.workspaces.setDefaultWorkspace);
  const { startTransition, completeTransition, resetTransition } =
    useWorkspaceTransition();

  const planQuery = useQueryWithStatus(
    api.plans.getCurrentPlan,
    isAuthenticated ? {} : "skip"
  );
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    isAuthenticated ? preferredShellQueryArgs : "skip"
  );
  const workspaceCreationEligibilityQuery = useQueryWithStatus(
    api.plans.getWorkspaceCreationEligibility,
    isAuthenticated ? {} : "skip"
  );
  const plan = planQuery.data;
  const shellState = shellStateQuery.data;
  const workspaceCreationEligibility = workspaceCreationEligibilityQuery.data;
  const { activeDraft, modal, requestNewWorkspace } = useNewWorkspaceDraftFlow({
    enabled: isAuthenticated && !locked,
  });

  const switcherItems = useMemo<WorkspaceSwitcherItem[]>(
    () => (shellState?.switcherItems ?? []) as WorkspaceSwitcherItem[],
    [shellState?.switcherItems]
  );
  const defaultActiveSwitcherValue =
    switcherItems.find((candidate) => candidate.isActive)?.value ?? "";
  const activeSwitcherValue =
    preferredShellContext === "workspace" && shellState?.activeWorkspaceId
      ? shellState.activeWorkspaceId
      : preferredShellContext === "setup_session" &&
          shellState?.activeSetupSessionId
        ? shellState.activeSetupSessionId
        : defaultActiveSwitcherValue;
  const [optimisticWorkspaceId, setOptimisticWorkspaceId] =
    useState<string>(activeSwitcherValue);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const selectedWorkspaceId = optimisticWorkspaceId || activeSwitcherValue;

  const isFree = !plan || plan.tier === "free";
  const isHighestTier = plan?.tier === HIGHEST_TIER;
  const canCreateWorkspace = workspaceCreationEligibility?.allowed === true;
  const hasActiveNewWorkspaceDraft = activeDraft?.mode === "new_workspace";
  const canRequestWorkspaceDraft =
    !isFree && (canCreateWorkspace || hasActiveNewWorkspaceDraft);
  const hasLockedItems = shellState?.showUnlockCta ?? false;
  const workspaceName =
    switcherItems.find((candidate) => candidate.value === selectedWorkspaceId)
      ?.label ||
    shellState?.activeSetupSession?.displayName ||
    workspace?.name ||
    "No workspace yet";

  const isLoading =
    authLoading ||
    (isAuthenticated &&
      (planQuery.isPending ||
        shellStateQuery.isPending ||
        workspaceCreationEligibilityQuery.isPending));

  useEffect(() => {
    if (!isSwitchingWorkspace) {
      setOptimisticWorkspaceId(activeSwitcherValue);
    }
  }, [activeSwitcherValue, isSwitchingWorkspace]);

  const openPlansUpgrade = useCallback(() => {
    if (locked) return;
    router.push(getPlansUpgradeHref());
  }, [locked, router]);

  const handleWorkspaceSwitch = useCallback(
    async (nextValue: string) => {
      if (
        !nextValue ||
        isSwitchingWorkspace ||
        nextValue === selectedWorkspaceId
      ) {
        return;
      }

      const targetItem = switcherItems.find(
        (candidate) => candidate.value === nextValue
      );
      if (!targetItem) {
        return;
      }

      if (targetItem.locked) {
        openPlansUpgrade();
        return;
      }

      if (targetItem.kind === "draft" && targetItem.threadId) {
        setPreferredShellContext("setup_session");
        router.push(buildSetupHref(targetItem.threadId));
        return;
      }

      const targetWorkspaceName = targetItem.label;
      const previousPreferredShellContext = preferredShellContext;

      setOptimisticWorkspaceId(nextValue);
      setIsSwitchingWorkspace(true);
      startTransition("switching_workspace");
      setPreferredShellContext("workspace");

      try {
        await setDefaultWorkspace({
          workspaceId: targetItem.workspaceId as Id<"workspaces">,
        });
        if (pathname === "/agent/setup") {
          router.replace("/");
        } else {
          router.refresh();
        }
        completeTransition();
        toast.success("Workspace switched", {
          description: `Now using ${targetWorkspaceName}.`,
        });
      } catch (error) {
        setOptimisticWorkspaceId(activeSwitcherValue);
        setPreferredShellContext(previousPreferredShellContext);
        resetTransition();
        toast.error("Couldn't switch workspace", {
          description: "Please try again.",
        });
        sidebarHeaderLogger.error("Failed to switch workspace", error);
      } finally {
        setIsSwitchingWorkspace(false);
      }
    },
    [
      activeSwitcherValue,
      completeTransition,
      isSwitchingWorkspace,
      pathname,
      preferredShellContext,
      router,
      resetTransition,
      openPlansUpgrade,
      selectedWorkspaceId,
      setDefaultWorkspace,
      startTransition,
      switcherItems,
    ]
  );

  // --- Select footer CTA ---
  const selectFooter = useMemo(() => {
    if (hasLockedItems) {
      return (
        <div className="border-t p-1">
          <button
            type="button"
            className="focus:bg-accent focus:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none"
            onPointerDown={(e) => {
              e.preventDefault();
              openPlansUpgrade();
            }}
          >
            <LockIcon className="h-4 w-4 shrink-0 fill-current" />
            {shellState?.unlockCtaLabel ?? "Unlock workspaces"}
          </button>
        </div>
      );
    }

    // Paid user with capacity, or with an existing draft to resolve.
    if (canRequestWorkspaceDraft) {
      return (
        <div className="border-t p-1">
          <button
            type="button"
            className="focus:bg-accent focus:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none"
            disabled={locked || isSwitchingWorkspace}
            onPointerDown={(e) => {
              e.preventDefault();
              void requestNewWorkspace();
            }}
          >
            <AddIcon className="h-4 w-4 shrink-0 fill-current" />
            New workspace
          </button>
        </div>
      );
    }

    // Free user or paid at limit (not highest tier) → "New workspace" opens pricing
    if (isFree || !isHighestTier) {
      return (
        <div className="border-t p-1">
          <button
            type="button"
            className="focus:bg-accent focus:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none"
            onPointerDown={(e) => {
              e.preventDefault();
              openPlansUpgrade();
            }}
          >
            <AddIcon className="h-4 w-4 shrink-0 fill-current" />
            New workspace
          </button>
        </div>
      );
    }

    // Pro at limit → disabled "New workspace"
    if (isHighestTier && !canCreateWorkspace) {
      return (
        <div className="border-t p-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm opacity-50 select-none"
            disabled
          >
            <AddIcon className="h-4 w-4 shrink-0 fill-current" />
            New workspace
          </button>
        </div>
      );
    }

    return null;
  }, [
    hasLockedItems,
    isFree,
    isHighestTier,
    canCreateWorkspace,
    canRequestWorkspaceDraft,
    locked,
    isSwitchingWorkspace,
    openPlansUpgrade,
    requestNewWorkspace,
    shellState?.unlockCtaLabel,
  ]);

  if (isLoading) {
    return (
      <SidebarHeaderBase>
        {!isCollapsed && <Skeleton className="h-9 w-full" />}
      </SidebarHeaderBase>
    );
  }

  if (!isAuthenticated) {
    return <SidebarHeaderBase />;
  }

  // Collapsed state
  if (isCollapsed) {
    if (canRequestWorkspaceDraft) {
      return (
        <SidebarHeaderBase>
          <Button
            size="icon"
            className="h-8 w-8"
            variant="secondary"
            disabled={locked}
            onClick={() => void requestNewWorkspace()}
          >
            <AddIcon className="fill-current" />
          </Button>
        </SidebarHeaderBase>
      );
    }

    if (isHighestTier && !canCreateWorkspace) {
      return (
        <SidebarHeaderBase>
          <Button
            size="icon"
            className="h-8 w-8"
            variant="secondary"
            disabled={locked}
            onClick={() => {
              window.location.href = `mailto:${CUSTOM_LIMIT_EMAIL}?subject=${encodeURIComponent("Request custom workspace limit")}`;
            }}
          >
            <MailIcon className="fill-current" />
          </Button>
        </SidebarHeaderBase>
      );
    }

    // Free / Base → upgrade icon
    return (
      <SidebarHeaderBase>
        <Button
          size="icon"
          className="h-8 w-8"
          variant="secondary"
          disabled={locked}
          onClick={() => openPlansUpgrade()}
        >
          <UpgradeIcon className="fill-current" />
        </Button>
      </SidebarHeaderBase>
    );
  }

  // --- Top button ---
  let topButton: React.ReactNode = null;
  if (canRequestWorkspaceDraft) {
    // Paid user with capacity, or with an existing draft to resolve.
    topButton = (
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={locked}
        onClick={() => void requestNewWorkspace()}
      >
        <AddIcon className="fill-current" />
        New workspace
      </Button>
    );
  } else if (isHighestTier && !canCreateWorkspace) {
    // Pro at limit → Request custom limit
    topButton = (
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={locked}
        onClick={() => {
          window.location.href = `mailto:${CUSTOM_LIMIT_EMAIL}?subject=${encodeURIComponent("Request custom workspace limit")}`;
        }}
      >
        <MailIcon className="fill-current" />
        Request custom limit
      </Button>
    );
  } else {
    // Free / Base → Upgrade plan
    topButton = (
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={locked}
        onClick={() => openPlansUpgrade()}
      >
        <UpgradeIcon className="fill-current" />
        Upgrade plan
      </Button>
    );
  }

  return (
    <SidebarHeaderBase className="gap-2">
      {topButton}

      <Select
        value={selectedWorkspaceId}
        onValueChange={(value) => {
          void handleWorkspaceSwitch(value);
        }}
        disabled={switcherItems.length <= 1 || isSwitchingWorkspace}
      >
        <SelectTrigger size="sm" className="w-full gap-2">
          <FolderIcon className="h-4 w-4 shrink-0 fill-current" />
          <SelectValue className="min-w-0 flex-1 truncate">
            {workspaceName}
          </SelectValue>
        </SelectTrigger>
        <SelectContent footer={selectFooter}>
          {switcherItems.length > 0 ? (
            switcherItems.map((workspaceOption: WorkspaceSwitcherItem) => (
              <SelectItem
                key={workspaceOption.value}
                value={workspaceOption.value}
                disabled={workspaceOption.locked}
              >
                {workspaceOption.label}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="no-workspace" disabled>
              No workspace
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {modal}
    </SidebarHeaderBase>
  );
}
