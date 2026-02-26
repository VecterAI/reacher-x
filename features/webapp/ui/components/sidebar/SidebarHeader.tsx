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

import { useMutation, useQuery } from "convex/react";
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
import { useAuth } from "@/shared/hooks/useAuth";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceTransition } from "@/features/webapp/contexts/WorkspaceTransitionContext";

// Polar checkout URL from environment variable
const CHECKOUT_URL = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL;

export function SidebarHeader() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { isAuthenticated, isLoading: authLoading, workspace } = useAuth();
  const setDefaultWorkspace = useMutation(api.workspaces.setDefaultWorkspace);
  const { startTransition, completeTransition, resetTransition } =
    useWorkspaceTransition();

  // Get current user plan
  const plan = useQuery(
    api.plans.getCurrentPlan,
    isAuthenticated ? {} : "skip"
  );
  const userWorkspaces = useQuery(
    api.workspaces.getUserWorkspaces,
    isAuthenticated ? {} : "skip"
  );
  const workspaceCreationEligibility = useQuery(
    api.plans.getWorkspaceCreationEligibility,
    isAuthenticated ? {} : "skip"
  );

  const workspaces = useMemo(() => userWorkspaces ?? [], [userWorkspaces]);
  const activeWorkspaceId =
    workspace?._id ??
    workspaces.find((candidate) => candidate.isDefault)?._id ??
    workspaces[0]?._id ??
    "";
  const [optimisticWorkspaceId, setOptimisticWorkspaceId] =
    useState<string>(activeWorkspaceId);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const selectedWorkspaceId = optimisticWorkspaceId || activeWorkspaceId;

  // Determine tier
  const isFree = !plan || plan.tier === "free";
  const workspaceName =
    workspaces.find((candidate) => candidate._id === selectedWorkspaceId)
      ?.name ||
    workspace?.name ||
    "Default workspace";
  const canCreateWorkspace = workspaceCreationEligibility?.allowed === true;
  const showUpgradeCta =
    plan?.tier !== "pro" && (isFree || !canCreateWorkspace);

  // Loading state - show skeleton during auth loading or query resolution.
  const isLoading =
    authLoading ||
    (isAuthenticated &&
      (plan === undefined ||
        userWorkspaces === undefined ||
        workspaceCreationEligibility === undefined));

  useEffect(() => {
    if (!isSwitchingWorkspace) {
      setOptimisticWorkspaceId(activeWorkspaceId);
    }
  }, [activeWorkspaceId, isSwitchingWorkspace]);

  const handleWorkspaceSwitch = useCallback(
    async (workspaceId: string) => {
      if (
        !workspaceId ||
        isSwitchingWorkspace ||
        workspaceId === selectedWorkspaceId
      ) {
        return;
      }

      const targetWorkspaceName =
        workspaces.find((candidate) => candidate._id === workspaceId)?.name ??
        "workspace";

      setOptimisticWorkspaceId(workspaceId);
      setIsSwitchingWorkspace(true);
      startTransition("switching_workspace");

      try {
        await setDefaultWorkspace({
          workspaceId: workspaceId as Id<"workspaces">,
        });
        completeTransition();
        toast.success("Workspace switched", {
          description: `Now using ${targetWorkspaceName}.`,
        });
      } catch (error) {
        setOptimisticWorkspaceId(activeWorkspaceId);
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
      activeWorkspaceId,
      completeTransition,
      isSwitchingWorkspace,
      resetTransition,
      selectedWorkspaceId,
      setDefaultWorkspace,
      startTransition,
      workspaces,
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
          // Upgrade button opens Polar checkout.
          <Button size="icon" className="h-8 w-8" variant="secondary" asChild>
            <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
              <UpgradeIcon className="fill-current" />
            </a>
          </Button>
        ) : canCreateWorkspace && !isSwitchingWorkspace ? (
          // New workspace button (eligible paid user).
          <Button size="icon" className="h-8 w-8" variant="secondary" asChild>
            <Link href="/agent?action=newWorkspace">
              <AddIcon className="fill-current" />
            </Link>
          </Button>
        ) : (
          // At hard cap (e.g. pro tier): keep touchpoint visible but disabled.
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
        <Button variant="secondary" size="sm" className="w-full" asChild>
          <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
            <UpgradeIcon className="fill-current" />
            Upgrade plan
          </a>
        </Button>
      </SidebarHeaderBase>
    );
  }

  // Paid tier: Show "New workspace" button + workspace switcher
  return (
    <SidebarHeaderBase className="gap-2">
      {/* New workspace button */}
      {canCreateWorkspace && !isSwitchingWorkspace ? (
        <Button variant="secondary" size="sm" className="w-full" asChild>
          <Link href="/agent?action=newWorkspace">
            <AddIcon className="fill-current" />
            New workspace
          </Link>
        </Button>
      ) : showUpgradeCta ? (
        <Button variant="secondary" size="sm" className="w-full" asChild>
          <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
            <UpgradeIcon className="fill-current" />
            Upgrade plan
          </a>
        </Button>
      ) : (
        <Button variant="secondary" size="sm" className="w-full" disabled>
          <AddIcon className="fill-current" />
          New workspace
        </Button>
      )}

      {/* Workspace switcher using Select component */}
      <Select
        value={selectedWorkspaceId}
        onValueChange={(workspaceId) => {
          void handleWorkspaceSwitch(workspaceId);
        }}
        disabled={workspaces.length <= 1 || isSwitchingWorkspace}
      >
        <SelectTrigger size="sm" className="w-full gap-2">
          <FolderIcon className="h-4 w-4 shrink-0 fill-current" />
          <SelectValue className="min-w-0 flex-1 truncate">
            {workspaceName}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {workspaces.length > 0 ? (
            workspaces.map((workspaceOption) => (
              <SelectItem key={workspaceOption._id} value={workspaceOption._id}>
                {workspaceOption.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="no-workspace" disabled>
              No workspace
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </SidebarHeaderBase>
  );
}
