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
  ManageAccountsIcon,
} from "@/shared/ui/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarNavigation() {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/onboarding");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation.</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Replies */}
          {/* <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Replies"
              isActive={pathname === "/replies"}
              asChild
            >
              <Link href="/replies">
                <QuickPhrasesIcon className="fill-sidebar-foreground" />
                <span className="truncate">Replies</span>
                <SidebarMenuBadge className="font-mono text-muted-foreground">
                  02
                </SidebarMenuBadge>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem> */}

          {/* Customers */}
          {/* <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Customers"
              isActive={pathname === "/customers"}
              asChild
            >
              <Link href="/customers">
                <GroupIcon className="fill-sidebar-foreground" />
                <span className="truncate">Customers</span>
                <SidebarMenuBadge className="font-mono text-muted-foreground">
                  02
                </SidebarMenuBadge>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem> */}

          {/* Settings with sub-menu */}
          <SidebarMenuItem>
            <Collapsible className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Settings" disabled={isOnboarding}>
                  <SettingsIcon className="fill-sidebar-foreground" />
                  <span className="truncate">Settings</span>
                  <ChevronRightIcon className="ml-auto fill-sidebar-foreground transition-transform" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuItem>
                    {isOnboarding ? (
                      <SidebarMenuButton tooltip="Linked accounts" disabled>
                        <ManageAccountsIcon className="fill-sidebar-foreground" />
                        <span className="truncate">Linked accounts</span>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        tooltip="Linked accounts"
                        isActive={pathname === "/settings/linked-accounts"}
                        asChild
                      >
                        <Link href="/settings/linked-accounts">
                          <ManageAccountsIcon className="fill-sidebar-foreground" />
                          <span className="truncate">Linked accounts</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
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

