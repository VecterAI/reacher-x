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

export function SidebarFooter() {
  return (
    <SidebarFooterBase>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Default workspace">
            <FilledFolderIcon className="fill-foreground" />
            <span className="truncate">Default workspace</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooterBase>
  );
}
