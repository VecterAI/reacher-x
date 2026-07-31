/**
 * UseCaseDemoShell
 * Static replica of the real app shell (WebAppChromeScaffold): fixed-height
 * header, left sidebar with navigation, and a scrollable main area.
 * Reuses the prop-driven shared sidebar primitives and copies the exact
 * structure/classes of the wired Header and sidebar components, but runs
 * entirely on static demo data: no auth, no Convex, no routing.
 * Sidebar items switch the demo's active page via local state; labels adapt
 * to the active demo use case via DemoShellContext.
 *
 * The real Sidebar component positions itself `fixed` with a 100vh height,
 * which does not work inside the scaled demo canvas (viewport units ignore
 * the canvas), so the sidebar chrome is replicated here in normal flow with
 * the same widths, colors, and collapsible="icon" behavior.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { getWorkspaceSystemStatusDotClassName } from "@/features/webapp/lib/workspaceSystemStatusTone";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/components/Collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import {
  SidebarContent,
  SidebarFooter as SidebarFooterBase,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader as SidebarHeaderBase,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/components/Sidebar";
import {
  AccountBoxIcon,
  ActivityZoneIcon,
  AddIcon,
  ArchiveIcon,
  BidLandscapeIcon,
  ChangeHistoryIcon,
  ChevronRightIcon,
  CreditCardIcon,
  DataUsageIcon,
  FolderIcon,
  FramePersonIcon,
  ManageAccountsIcon,
  NotificationsIcon,
  SettingsIcon,
} from "@/shared/ui/components/icons";
import { DemoAgentStatusDialog } from "./DemoAgentStatusDialog";
import { DEMO_USER_AVATAR_URL, useDemoShell } from "./demoShellContext";

export type DemoPageKey =
  | "prospects"
  | "converts"
  | "archives"
  | "agent"
  | "agent_ops"
  | "analytics"
  | "plans"
  | "usage"
  | "settings"
  | "workspace"
  | "notifications";

const DEMO_USER_INITIALS = "DU";

export function UseCaseDemoShell({
  children,
  activePage,
  onNavigate,
}: {
  children: React.ReactNode;
  activePage: DemoPageKey;
  onNavigate: (page: DemoPageKey) => void;
}) {
  return (
    <SidebarProvider className="h-full min-h-0">
      <DemoShellLayout activePage={activePage} onNavigate={onNavigate}>
        {children}
      </DemoShellLayout>
    </SidebarProvider>
  );
}

function DemoShellLayout({
  children,
  activePage,
  onNavigate,
}: {
  children: React.ReactNode;
  activePage: DemoPageKey;
  onNavigate: (page: DemoPageKey) => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <DemoHeader onNavigate={onNavigate} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar (in-flow replica of the real fixed sidebar) */}
        <aside
          data-collapsible={collapsed ? "icon" : ""}
          className={cn(
            "group bg-sidebar text-sidebar-foreground flex h-full shrink-0 flex-col border-r transition-[width] duration-200 ease-linear",
            collapsed ? "w-12" : "w-64"
          )}
        >
          <DemoSidebarHeader collapsed={collapsed} onNavigate={onNavigate} />
          <SidebarContent>
            <DemoSidebarNavigation
              activePage={activePage}
              onNavigate={onNavigate}
            />
          </SidebarContent>
          <DemoSidebarFooter activePage={activePage} onNavigate={onNavigate} />
        </aside>

        {/* Main content area (the real page renders here) */}
        <main className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Static replica of features/webapp/ui/components/Header.tsx
 * Same classes and structure; brand and user menu are inert, the agent
 * status button opens the demo status dialog, and the notifications bell
 * navigates to the demo notifications page with the real badge treatment.
 */
function DemoHeader({
  onNavigate,
}: {
  onNavigate: (page: DemoPageKey) => void;
}) {
  const { pendingNotificationCount } = useDemoShell();
  const [statusOpen, setStatusOpen] = React.useState(false);
  const dotClassName = getWorkspaceSystemStatusDotClassName("running");

  return (
    <header className="border-border bg-background flex h-12 w-full shrink-0 items-center justify-between border-b pr-4 md:pr-2">
      <div className="flex items-center">
        <span
          aria-hidden="true"
          className="w-12 text-center font-mono text-[1.75rem] leading-[normal!important] font-medium"
        >
          🆁
        </span>
        <span className="border-border mr-2 inline-flex border-r border-l px-2 py-[0.969rem]">
          <Badge variant="outline-strong">v4 beta</Badge>
        </span>
        <SidebarTrigger />
      </div>

      <nav className="flex items-center gap-0 md:gap-4" aria-label="Demo">
        <menu className="flex items-center gap-2" aria-label="Demo navigation">
          <li>
            <Button
              variant="ghost"
              size="xsIcon"
              aria-label="△ Agent is active"
              title="△ Agent is active"
              onClick={() => setStatusOpen(true)}
              className="relative"
            >
              <ChangeHistoryIcon
                aria-hidden="true"
                className="size-4 fill-current"
              />
              <span className="ring-background absolute top-0 right-0 size-2 translate-x-1/4 -translate-y-1/4 rounded-full ring-2">
                <span
                  className={cn("block size-full rounded-full", dotClassName)}
                />
              </span>
            </Button>
          </li>
          <li>
            <Button
              variant="ghost"
              size="xsIcon"
              aria-label="Notifications"
              className="relative"
              onClick={() => onNavigate("notifications")}
            >
              <NotificationsIcon className="fill-current" aria-hidden="true" />
              {pendingNotificationCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="border-background absolute -top-2 left-2.5 flex h-5 min-w-5 items-center justify-center border px-1 text-[10px]"
                >
                  <AnimatedNumber
                    value={pendingNotificationCount}
                    suffix={pendingNotificationCount >= 100 ? "+" : undefined}
                    animateOnMount
                  />
                </Badge>
              ) : null}
            </Button>
          </li>
          <li>
            <Button variant="ghost" size="icon" aria-label="User menu">
              <Avatar className="size-8">
                <AvatarImage src={DEMO_USER_AVATAR_URL} alt="Demo user" />
                <AvatarFallback>{DEMO_USER_INITIALS}</AvatarFallback>
              </Avatar>
            </Button>
          </li>
        </menu>
      </nav>

      <DemoAgentStatusDialog open={statusOpen} onOpenChange={setStatusOpen} />
    </header>
  );
}

/**
 * Static replica of the expanded/collapsed SidebarHeader states.
 * The workspace select is functional and switches the demo workspace.
 * The demo workspace is on a paid plan at its workspace limit, so "New
 * workspace" opens the plans page, matching the real at-limit behavior.
 */
function DemoSidebarHeader({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate: (page: DemoPageKey) => void;
}) {
  const { workspaces, activeWorkspace, setActiveWorkspaceId } = useDemoShell();

  if (collapsed) {
    return (
      <SidebarHeaderBase>
        <Button
          size="icon"
          className="h-8 w-8"
          variant="secondary"
          onClick={() => onNavigate("plans")}
          title="New workspace (opens plans at the workspace limit)"
        >
          <AddIcon className="fill-current" />
        </Button>
      </SidebarHeaderBase>
    );
  }

  return (
    <SidebarHeaderBase className="gap-2">
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => onNavigate("plans")}
        title="New workspace (opens plans at the workspace limit)"
      >
        <AddIcon className="fill-current" />
        New workspace
      </Button>
      <Select value={activeWorkspace.id} onValueChange={setActiveWorkspaceId}>
        <SelectTrigger size="sm" className="w-full gap-2">
          <FolderIcon className="h-4 w-4 shrink-0 fill-current" />
          <SelectValue className="min-w-0 flex-1 truncate" />
        </SelectTrigger>
        <SelectContent
          footer={
            <div className="border-t p-1">
              <button
                type="button"
                className="focus:bg-accent focus:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none"
                onClick={() => onNavigate("plans")}
              >
                <AddIcon className="h-4 w-4 shrink-0 fill-current" />
                New workspace
              </button>
            </div>
          }
        >
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              {workspace.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SidebarHeaderBase>
  );
}

/**
 * Static replica of SidebarNavigation. Identical groups, icons, and labels
 * (adapted to the active demo use case). Items are buttons that switch the
 * demo's active page (no routing). Settings expands its collapsible
 * sub-menu exactly like the real sidebar.
 */
function DemoSidebarNavigation({
  activePage,
  onNavigate,
}: {
  activePage: DemoPageKey;
  onNavigate: (page: DemoPageKey) => void;
}) {
  const { labels } = useDemoShell();
  const { pageLabels } = labels;
  const [settingsOpen, setSettingsOpen] = React.useState(
    activePage === "settings"
  );

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>People</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={pageLabels.entities}
                isActive={activePage === "prospects"}
                onClick={() => onNavigate("prospects")}
              >
                <FramePersonIcon className="fill-sidebar-foreground" />
                <span className="truncate">{pageLabels.entities}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={pageLabels.converts}
                isActive={activePage === "converts"}
                onClick={() => onNavigate("converts")}
              >
                <AccountBoxIcon className="fill-sidebar-foreground" />
                <span className="truncate">{pageLabels.converts}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={pageLabels.archives}
                isActive={activePage === "archives"}
                onClick={() => onNavigate("archives")}
              >
                <ArchiveIcon className="fill-sidebar-foreground" />
                <span className="truncate">{pageLabels.archives}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Agent</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Agent"
                isActive={activePage === "agent"}
                onClick={() => onNavigate("agent")}
              >
                <ChangeHistoryIcon className="fill-sidebar-foreground" />
                <span className="truncate">Agent</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Agent observability"
                isActive={activePage === "agent_ops"}
                onClick={() => onNavigate("agent_ops")}
              >
                <ActivityZoneIcon className="fill-sidebar-foreground" />
                <span className="truncate">Agent observability</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Insights</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={pageLabels.analytics}
                isActive={activePage === "analytics"}
                onClick={() => onNavigate("analytics")}
              >
                <BidLandscapeIcon className="fill-sidebar-foreground" />
                <span className="truncate">{pageLabels.analytics}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Accounts</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Plans"
                isActive={activePage === "plans"}
                onClick={() => onNavigate("plans")}
              >
                <CreditCardIcon className="fill-sidebar-foreground" />
                <span className="truncate">Plans</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Usage"
                isActive={activePage === "usage"}
                onClick={() => onNavigate("usage")}
              >
                <DataUsageIcon className="fill-sidebar-foreground" />
                <span className="truncate">Usage</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Collapsible
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                className="group/collapsible [&[data-state=open]>button>svg:last-child]:rotate-90"
              >
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip="Settings"
                    isActive={activePage === "settings"}
                  >
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
                        isActive={activePage === "settings"}
                        onClick={() => onNavigate("settings")}
                      >
                        <ManageAccountsIcon className="fill-sidebar-foreground" />
                        <span className="truncate">Connected accounts</span>
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

/** Static replica of SidebarFooter: workspace item, navigates like the real app. */
function DemoSidebarFooter({
  activePage,
  onNavigate,
}: {
  activePage: DemoPageKey;
  onNavigate: (page: DemoPageKey) => void;
}) {
  const { activeWorkspace } = useDemoShell();

  return (
    <SidebarFooterBase>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={activeWorkspace.name}
            isActive={activePage === "workspace"}
            onClick={() => onNavigate("workspace")}
          >
            <FolderIcon className="fill-foreground" />
            <span className="truncate">{activeWorkspace.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooterBase>
  );
}
