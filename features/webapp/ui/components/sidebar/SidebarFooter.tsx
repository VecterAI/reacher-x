"use client";
/**
 * SidebarFooter Component
 *
 * Displays the footer section of the sidebar with workspace information.
 * Simple and focused component following the Single Responsibility Principle.
 *
 * References:
 * - Component Design Patterns: https://react.dev/learn/thinking-in-react
 * - Semantic HTML Footer: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/footer
 */

import {
  SidebarFooter as SidebarFooterBase,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/shared/ui/components/Sidebar";
import { FolderIcon } from "@/shared/ui/components/icons";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/shared/hooks/useAuth";
import { usePathname } from "next/navigation";
import { useStore } from "@nanostores/react";
import { $onboardingLock } from "@/shared/stores/onboarding";
import { usePreferredShellQueryArgs } from "@/shared/hooks/usePreferredShellQueryArgs";
import { useQueryWithStatus } from "@/shared/hooks/useQueryWithStatus";

export function SidebarFooter() {
  const { isLoading: authLoading, workspace } = useAuth();
  const pathname = usePathname();
  const locked = useStore($onboardingLock);
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    preferredShellQueryArgs
  );
  const shellState = shellStateQuery.data;
  const isActive = pathname === "/workspace";
  const isLoading = authLoading || shellStateQuery.isPending;
  const workspaceName =
    shellState?.activeContextType === "setup_session"
      ? (shellState.activeSetupSession?.displayName ??
        workspace?.name ??
        "No workspace yet")
      : (workspace?.name ?? "No workspace yet");

  if (isLoading) {
    return (
      <SidebarFooterBase>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-hidden="true"
              className="pointer-events-none"
              tabIndex={-1}
            >
              <FolderIcon className="fill-foreground" />
              <Skeleton className="h-4 flex-1 rounded-sm" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooterBase>
    );
  }

  return (
    <SidebarFooterBase>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={workspaceName}
            isActive={isActive}
            disabled={locked}
            asChild={!locked}
          >
            {locked ? (
              <>
                <FolderIcon className="fill-foreground" />
                <span className="truncate">{workspaceName}</span>
              </>
            ) : (
              <Link id="rx-tour-workspace" href="/workspace">
                <FolderIcon className="fill-foreground" />
                <span className="truncate">{workspaceName}</span>
              </Link>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooterBase>
  );
}
