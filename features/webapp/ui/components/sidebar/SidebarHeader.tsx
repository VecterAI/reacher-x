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

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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

// Polar checkout URL from environment variable
const CHECKOUT_URL = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL;

export function SidebarHeader() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { isAuthenticated, isLoading: authLoading, workspace } = useAuth();

  // Get current user plan
  const plan = useQuery(
    api.plans.getCurrentPlan,
    isAuthenticated ? {} : "skip"
  );

  // Determine tier
  const isFree = !plan || plan.tier === "free";
  const workspaceName = workspace?.name || "Default workspace";

  // Loading state - show skeleton during auth loading OR plan loading
  const isLoading = authLoading || (isAuthenticated && plan === undefined);

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
        {isFree ? (
          // Upgrade button opens Polar checkout
          <Button size="icon" className="h-8 w-8" variant="secondary" asChild>
            <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
              <UpgradeIcon className="fill-current" />
            </a>
          </Button>
        ) : (
          // New workspace button
          <Button size="icon" className="h-8 w-8" variant="secondary" asChild>
            <Link href="/workspace/new">
              <AddIcon className="fill-current" />
            </Link>
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
      <Button variant="secondary" size="sm" className="w-full" asChild>
        <Link href="/workspace/new">
          <AddIcon className="fill-current" />
          New workspace
        </Link>
      </Button>

      {/* Workspace switcher using Select component */}
      <Select value={workspace?._id ?? "default"} disabled>
        <SelectTrigger size="sm" className="w-full">
          <FolderIcon className="h-4 w-4 shrink-0 fill-current" />
          <SelectValue>{workspaceName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={workspace?._id ?? "default"}>
            {workspaceName}
          </SelectItem>
        </SelectContent>
      </Select>
    </SidebarHeaderBase>
  );
}
