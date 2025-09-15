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
import { FilledFolderIcon } from "@/shared/ui/components/icons";
import Link from "next/link";
import { useEnsureWorkspace } from "@/shared/hooks/useEnsureWorkspace";
import { usePathname } from "next/navigation";

export function SidebarFooter() {
  const { workspace } = useEnsureWorkspace();
  const pathname = usePathname();
  const isActive = pathname === "/workspace";
  const workspaceName = workspace?.name || "Workspace";
  return (
    <SidebarFooterBase>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={workspaceName}
            isActive={isActive}
            asChild
          >
            <Link href="/workspace">
              <FilledFolderIcon className="fill-foreground" />
              <span className="truncate">{workspaceName}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooterBase>
  );
}
