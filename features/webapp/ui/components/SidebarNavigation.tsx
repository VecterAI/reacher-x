"use client";
/**
 * SidebarNavigation Component
 *
 * Renders the main navigation section of the sidebar with collapsible menu items.
 * Follows the Compound Component pattern for better composition.
 *
 * References:
 * - Compound Components: https://kentcdodds.com/blog/compound-components-with-react-hooks
 * - WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
 */

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/shared/ui/components/Sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/components/Collapsible";
import {
  ChevronRightIcon,
  SettingsIcon,
  GroupIcon,
  QuickPhrasesIcon,
  ManageAccountsIcon,
} from "@/shared/ui/components/icons";

export function SidebarNavigation() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation.</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Replies */}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Replies">
              <QuickPhrasesIcon className="fill-sidebar-foreground" />
              <span className="truncate">Replies</span>
              <SidebarMenuBadge className="font-mono text-muted-foreground">
                02
              </SidebarMenuBadge>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Customers */}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Customers">
              <GroupIcon className="fill-sidebar-foreground" />
              <span className="truncate">Customers</span>
              <SidebarMenuBadge className="font-mono text-muted-foreground">
                02
              </SidebarMenuBadge>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Settings with sub-menu */}
          <SidebarMenuItem>
            <Collapsible className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Settings">
                  <SettingsIcon className="fill-sidebar-foreground" />
                  <span className="truncate">Settings</span>
                  <ChevronRightIcon className="ml-auto fill-sidebar-foreground transition-transform" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Linked accounts">
                      <ManageAccountsIcon className="fill-sidebar-foreground" />
                      <span className="truncate">Linked accounts</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
