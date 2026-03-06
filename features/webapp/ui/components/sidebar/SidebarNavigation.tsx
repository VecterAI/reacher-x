"use client";
/**
 * SidebarNavigation Component
 *
 * Renders the main navigation section of the sidebar with three groups:
 * - People: Prospects, Contacts, Archive
 * - Insights: Analytics
 * - Accounts: Settings (collapsible) → Connected accounts
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
  FramePersonIcon,
  AccountBoxIcon,
  ArchiveIcon,
  BidLandscapeIcon,
} from "@/shared/ui/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@nanostores/react";
import { $onboardingLock } from "@/shared/stores/onboarding";

export function SidebarNavigation() {
  const pathname = usePathname();
  const locked = useStore($onboardingLock);

  return (
    <>
      {/* People Group */}
      <SidebarGroup>
        <SidebarGroupLabel>People</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {/* Prospects */}
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Prospects"
                isActive={pathname === "/"}
                disabled={locked}
                asChild={!locked}
              >
                {locked ? (
                  <>
                    <FramePersonIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Prospects</span>
                  </>
                ) : (
                  <Link href="/">
                    <FramePersonIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Prospects</span>
                  </Link>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Converts */}
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Converts"
                isActive={pathname === "/converts"}
                disabled={locked}
                asChild={!locked}
              >
                {locked ? (
                  <>
                    <AccountBoxIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Converts</span>
                  </>
                ) : (
                  <Link href="/converts">
                    <AccountBoxIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Converts</span>
                  </Link>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Archives */}
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Archives"
                isActive={pathname === "/archives"}
                disabled={locked}
                asChild={!locked}
              >
                {locked ? (
                  <>
                    <ArchiveIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Archives</span>
                  </>
                ) : (
                  <Link href="/archives">
                    <ArchiveIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Archives</span>
                  </Link>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Insights Group */}
      <SidebarGroup>
        <SidebarGroupLabel>Insights</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Analytics"
                isActive={pathname === "/analytics"}
                disabled={locked}
                asChild={!locked}
              >
                {locked ? (
                  <>
                    <BidLandscapeIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Analytics</span>
                  </>
                ) : (
                  <Link href="/analytics">
                    <BidLandscapeIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Analytics</span>
                  </Link>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Accounts Group */}
      <SidebarGroup>
        <SidebarGroupLabel>Accounts</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {/* Settings with sub-menu */}
            <SidebarMenuItem>
              <Collapsible
                defaultOpen={pathname.startsWith("/settings")}
                className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90"
              >
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Settings" disabled={locked}>
                    <SettingsIcon className="fill-sidebar-foreground" />
                    <span className="truncate">Settings</span>
                    <ChevronRightIcon className="fill-sidebar-foreground ml-auto transition-transform" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        tooltip="Connected accounts"
                        isActive={pathname === "/settings/connected-accounts"}
                        disabled={locked}
                        asChild={!locked}
                      >
                        {locked ? (
                          <>
                            <ManageAccountsIcon className="fill-sidebar-foreground" />
                            <span className="truncate">Connected accounts</span>
                          </>
                        ) : (
                          <Link href="/settings/connected-accounts">
                            <ManageAccountsIcon className="fill-sidebar-foreground" />
                            <span className="truncate">Connected accounts</span>
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
