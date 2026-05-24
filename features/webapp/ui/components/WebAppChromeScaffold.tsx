import type { CSSProperties, ReactNode } from "react";
import {
  Sidebar,
  SidebarProvider as UISidebarProvider,
} from "@/shared/ui/components/Sidebar";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Button } from "@/shared/ui/components/Button";
import { PanelLeft } from "lucide-react";
import { Header } from "./Header";
import { WorkspaceActivityTracker } from "./WorkspaceActivityTracker";
import { WorkspaceTransitionBar } from "./WorkspaceTransitionBar";
import {
  SidebarContentWrapper,
  SidebarFooter,
  SidebarHeader,
  SidebarNavigation,
  SidebarWrapper,
} from "./sidebar";
import {
  FolderIcon,
  FramePersonIcon,
  ArchiveIcon,
  BidLandscapeIcon,
  CreditCardIcon,
  SettingsIcon,
  ManageAccountsIcon,
  UpgradeIcon,
} from "@/shared/ui/components/icons";
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON } from "@/shared/lib/sidebarState";

type WebAppChromeScaffoldProps = {
  initialSidebarOpen: boolean;
  mode: "live" | "loading";
  children: ReactNode;
};

const desktopSidebarStyle = {
  "--sidebar-width": SIDEBAR_WIDTH,
  "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
} as CSSProperties;

export function WebAppChromeScaffold({
  initialSidebarOpen,
  mode,
  children,
}: WebAppChromeScaffoldProps) {
  if (mode === "loading") {
    return <WebAppChromeLoadingShell>{children}</WebAppChromeLoadingShell>;
  }

  return (
    <UISidebarProvider defaultOpen={initialSidebarOpen}>
      <SidebarWrapper>
        <Header />
        <WorkspaceActivityTracker />
        <WorkspaceTransitionBar />
        <div className="w-full pt-12">
          <div className="flex h-[calc(100dvh-3rem)] min-h-0 overflow-hidden">
            <Sidebar collapsible="icon" style={desktopSidebarStyle}>
              <SidebarHeader />
              <SidebarContentWrapper>
                <SidebarNavigation />
              </SidebarContentWrapper>
              <SidebarFooter />
            </Sidebar>
            <main className="flex h-full min-h-0 w-full flex-col overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarWrapper>
    </UISidebarProvider>
  );
}

export function WebAppLoadingContentSkeleton() {
  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col">
      <div className="border-border/50 bg-background/80 m-3 min-h-0 flex-1 rounded-lg border md:m-4" />
    </div>
  );
}

function WebAppChromeLoadingShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="bg-background min-h-dvh w-full"
      data-webapp-loading-shell
      aria-hidden
    >
      <header className="border-border bg-background fixed top-0 right-0 left-0 z-20 flex h-12 items-center justify-between border-b pr-4 pl-2 md:pr-2">
        <div className="flex items-center">
          <div className="w-12 text-center font-mono text-[1.75rem] leading-[normal!important] font-medium">
            🆁
          </div>
          <span className="border-border mr-2 inline-block border-r border-l px-2 py-[0.969rem] font-mono text-xs font-bold">
            v4.0 beta
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            tabIndex={-1}
            aria-hidden="true"
          >
            <SidebarTriggerIconOnly />
          </Button>
        </div>
        <nav className="flex items-center gap-0 md:gap-4" aria-hidden="true">
          <menu className="flex items-center gap-2">
            <li>
              <Skeleton className="h-6 w-6 rounded-md" />
            </li>
            <li>
              <Skeleton className="h-8 w-8 rounded-full" />
            </li>
          </menu>
        </nav>
      </header>

      <div className="w-full pt-12">
        <div className="flex h-[calc(100dvh-3rem)] min-h-0 overflow-hidden">
          <aside
            className="bg-sidebar border-sidebar-border hidden h-full shrink-0 border-r md:flex"
            data-sidebar-loading-width
          >
            <div className="flex h-full w-full flex-col">
              <div className="flex flex-col gap-2 p-2">
                <div className="flex flex-col gap-2" data-sidebar-expanded-only>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <UpgradeIcon className="fill-current" />
                    Upgrade plan
                  </Button>
                  <div className="border-input bg-background text-muted-foreground flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <FolderIcon className="h-4 w-4 shrink-0 fill-current" />
                      <Skeleton className="h-4 w-24 rounded-sm" />
                    </div>
                    <Skeleton className="h-4 w-4 rounded-sm" />
                  </div>
                </div>

                <div
                  className="items-center justify-center"
                  data-sidebar-collapsed-only
                >
                  <Button
                    variant="secondary"
                    className="h-8 w-8"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <UpgradeIcon className="fill-current" />
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden py-1">
                <LoadingSidebarGroup
                  labelWidth="3rem"
                  items={[
                    <FramePersonIcon key="people" className="fill-current" />,
                    <ArchiveIcon key="archive" className="fill-current" />,
                  ]}
                />
                <LoadingSidebarGroup
                  labelWidth="3.5rem"
                  items={[
                    <BidLandscapeIcon
                      key="analytics"
                      className="fill-current"
                    />,
                  ]}
                />
                <LoadingSidebarGroup
                  labelWidth="3.75rem"
                  items={[
                    <CreditCardIcon key="plans" className="fill-current" />,
                    <SettingsIcon key="settings" className="fill-current" />,
                    <ManageAccountsIcon
                      key="accounts"
                      className="fill-current"
                    />,
                  ]}
                />
              </div>

              <div className="p-2">
                <div
                  className="flex h-8 items-center gap-2 rounded-md px-2"
                  data-sidebar-loading-row
                >
                  <FolderIcon className="h-4 w-4 shrink-0 fill-current opacity-70" />
                  <Skeleton
                    className="h-4 flex-1 rounded-sm"
                    data-sidebar-expanded-only
                  />
                </div>
              </div>
            </div>
          </aside>

          <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSidebarGroup({
  labelWidth,
  items,
}: {
  labelWidth: string;
  items: ReactNode[];
}) {
  return (
    <div className="px-2" data-sidebar-loading-group>
      <div
        className="mb-1 flex h-8 items-center px-2"
        data-sidebar-expanded-only
      >
        <Skeleton className="h-3 rounded-sm" style={{ width: labelWidth }} />
      </div>

      <div className="flex flex-col gap-1">
        {items.map((icon, index) => (
          <div
            key={index}
            className="flex h-8 items-center gap-2 rounded-md px-2"
            data-sidebar-loading-row
          >
            <div className="text-sidebar-foreground/80 h-4 w-4 shrink-0">
              {icon}
            </div>
            <Skeleton
              className="h-4 flex-1 rounded-sm"
              data-sidebar-expanded-only
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SidebarTriggerIconOnly() {
  return (
    <>
      <PanelLeft className="size-4" aria-hidden="true" />
      <span className="sr-only">Toggle Sidebar</span>
    </>
  );
}
