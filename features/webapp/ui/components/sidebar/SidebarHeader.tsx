"use client";
/**
 * SidebarHeader Component
 *
 * Displays tier-based content in the sidebar header:
 * - Free tier: "Upgrade" button
 * - Paid tier: "New workspace" button + workspace switcher dropdown
 *
 * References:
 * - Compound Components: https://kentcdodds.com/blog/compound-components-with-react-hooks
 * - Responsive Design: https://web.dev/responsive-web-design-basics/
 */

import { useAction, useMutation } from "convex/react";
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
import { AddIcon, FolderIcon, UpgradeIcon } from "@/shared/ui/components/icons";
import { useAuth, useQueryWithStatus } from "@/shared/hooks";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceTransition } from "@/features/webapp/contexts/WorkspaceTransitionContext";
import { useStore } from "@nanostores/react";
import { $onboardingLock } from "@/shared/stores/onboarding";
import {
  $preferredShellContext,
  setPreferredShellContext,
} from "@/shared/stores/preferredShellContext";
import { useNewWorkspaceDraftFlow } from "@/features/webapp/hooks/useNewWorkspaceDraftFlow";

export function SidebarHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { isAuthenticated, isLoading: authLoading, workspace } = useAuth();
  const locked = useStore($onboardingLock);
  const preferredShellContext = useStore($preferredShellContext);
  const setDefaultWorkspace = useMutation(api.workspaces.setDefaultWorkspace);
  const startCheckoutFlow = useAction(api.billing.startCheckoutFlow);
  const { startTransition, completeTransition, resetTransition } =
    useWorkspaceTransition();

  // Get current user plan
  const planQuery = useQueryWithStatus(
    api.plans.getCurrentPlan,
    isAuthenticated ? {} : "skip"
  );
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    isAuthenticated ? {} : "skip"
  );
  const subscriptionQuery = useQueryWithStatus(
    api.polar.getSubscription,
    isAuthenticated ? {} : "skip"
  );
  const workspaceCreationEligibilityQuery = useQueryWithStatus(
    api.plans.getWorkspaceCreationEligibility,
    isAuthenticated ? {} : "skip"
  );
  const plan = planQuery.data;
  const shellState = shellStateQuery.data;
  const subscription = subscriptionQuery.data;
  const workspaceCreationEligibility = workspaceCreationEligibilityQuery.data;
  const { modal, requestNewWorkspace } = useNewWorkspaceDraftFlow({
    enabled: isAuthenticated && !locked,
  });

  const switcherItems = useMemo(
    () => shellState?.switcherItems ?? [],
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
  const [isStartingUpgrade, setIsStartingUpgrade] = useState(false);
  const selectedWorkspaceId = optimisticWorkspaceId || activeSwitcherValue;

  // Determine tier
  const isFree = !plan || plan.tier === "free";
  const workspaceName =
    switcherItems.find((candidate) => candidate.value === selectedWorkspaceId)
      ?.label ||
    workspace?.name ||
    "No workspace yet";
  const canCreateWorkspace = workspaceCreationEligibility?.allowed === true;
  const showUpgradeCta =
    plan?.tier !== "pro" && (isFree || !canCreateWorkspace);

  // Loading state - show skeleton during auth loading or query resolution.
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

  const handleUpgradeCheckout = useCallback(async () => {
    if (locked || isStartingUpgrade || typeof window === "undefined") {
      return;
    }

    const currentUrl = new URL(window.location.href);
    setIsStartingUpgrade(true);
    try {
      const { url } = await startCheckoutFlow({
        tier: isFree ? "base" : "pro",
        billingPeriod:
          subscription?.recurringInterval === "year" ? "yearly" : "monthly",
        source: "sidebar_upgrade",
        origin: currentUrl.origin,
        returnTo: `${currentUrl.pathname}${currentUrl.search}`,
      });
      window.location.assign(url);
    } catch (error) {
      toast.error("Could not start checkout", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      setIsStartingUpgrade(false);
    }
  }, [
    isFree,
    isStartingUpgrade,
    locked,
    startCheckoutFlow,
    subscription?.recurringInterval,
  ]);

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

      if (targetItem.kind === "draft") {
        setPreferredShellContext("setup_session");
        router.push(
          `/agent/setup?sessionId=${targetItem.sessionId}&threadId=${encodeURIComponent(targetItem.threadId)}`
        );
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
        console.error("[SidebarHeader] Failed to switch workspace:", error);
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
      selectedWorkspaceId,
      setDefaultWorkspace,
      startTransition,
      switcherItems,
    ]
  );

  if (isLoading) {
    return (
      <SidebarHeaderBase>
        {!isCollapsed && <Skeleton className="h-9 w-full" />}
      </SidebarHeaderBase>
    );
  }

  // Not authenticated - show empty header
  if (!isAuthenticated) {
    return <SidebarHeaderBase />;
  }

  // Collapsed state - show icon button
  if (isCollapsed) {
    return (
      <SidebarHeaderBase>
        {showUpgradeCta ? (
          <Button
            size="icon"
            className="h-8 w-8"
            variant="secondary"
            disabled={locked || isStartingUpgrade}
            onClick={() => void handleUpgradeCheckout()}
          >
            <UpgradeIcon className="fill-current" />
          </Button>
        ) : canCreateWorkspace && !isSwitchingWorkspace ? (
          <Button
            size="icon"
            className="h-8 w-8"
            variant="secondary"
            disabled={locked}
            onClick={() => void requestNewWorkspace()}
          >
            <AddIcon className="fill-current" />
          </Button>
        ) : (
          <Button size="icon" className="h-8 w-8" variant="secondary" disabled>
            <AddIcon className="fill-current" />
          </Button>
        )}
      </SidebarHeaderBase>
    );
  }

  // Free tier: Show "Upgrade" button
  if (isFree) {
    return (
      <SidebarHeaderBase>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={locked || isStartingUpgrade}
          onClick={() => void handleUpgradeCheckout()}
        >
          <UpgradeIcon className="fill-current" />
          Upgrade plan
        </Button>
      </SidebarHeaderBase>
    );
  }

  // Paid tier: Show "New workspace" button + workspace switcher
  return (
    <SidebarHeaderBase className="gap-2">
      {/* New workspace button */}
      {canCreateWorkspace && !isSwitchingWorkspace ? (
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
      ) : showUpgradeCta ? (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={locked || isStartingUpgrade}
          onClick={() => void handleUpgradeCheckout()}
        >
          <UpgradeIcon className="fill-current" />
          Upgrade plan
        </Button>
      ) : (
        <Button variant="secondary" size="sm" className="w-full" disabled>
          <AddIcon className="fill-current" />
          New workspace
        </Button>
      )}

      {/* Workspace switcher — stays interactive during onboarding */}
      <Select
        value={selectedWorkspaceId}
        onValueChange={(workspaceId) => {
          void handleWorkspaceSwitch(workspaceId);
        }}
        disabled={switcherItems.length <= 1 || isSwitchingWorkspace}
      >
        <SelectTrigger size="sm" className="w-full gap-2">
          <FolderIcon className="h-4 w-4 shrink-0 fill-current" />
          <SelectValue className="min-w-0 flex-1 truncate">
            {workspaceName}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {switcherItems.length > 0 ? (
            switcherItems.map((workspaceOption) => (
              <SelectItem
                key={workspaceOption.value}
                value={workspaceOption.value}
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
