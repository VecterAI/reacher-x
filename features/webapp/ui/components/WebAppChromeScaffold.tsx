import { Suspense, type CSSProperties, type ReactNode } from "react";
import {
  Sidebar,
  SidebarProvider as UISidebarProvider,
} from "@/shared/ui/components/Sidebar";
import { Badge } from "@/shared/ui/components/Badge";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Button } from "@/shared/ui/components/Button";
import { PanelLeft } from "lucide-react";
import { Header } from "./Header";
import { WorkspaceActivityTracker } from "./WorkspaceActivityTracker";
import { WorkspaceTransitionBar } from "./WorkspaceTransitionBar";
import { SidebarContentWrapper } from "./sidebar/SidebarContentWrapper";
import { SidebarFooter } from "./sidebar/SidebarFooter";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { SidebarHeaderSkeleton } from "./sidebar/SidebarHeaderSkeleton";
import { SidebarNavigation } from "./sidebar/SidebarNavigation";
import { SidebarWrapper } from "./sidebar/SidebarWrapper";
import {
  FolderIcon,
  FramePersonIcon,
  ArchiveIcon,
  BidLandscapeIcon,
  CreditCardIcon,
  SettingsIcon,
  ManageAccountsIcon,
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
        <Suspense fallback={<HeaderLoadingBar />}>
          <Header />
        </Suspense>
        <Suspense fallback={null}>
          <WorkspaceActivityTracker />
        </Suspense>
        <WorkspaceTransitionBar />
        <div className="w-full pt-12">
          <div className="flex h-[calc(100dvh-3rem)] min-h-0 overflow-hidden">
            <Sidebar collapsible="icon" style={desktopSidebarStyle}>
              <Suspense fallback={<SidebarHeaderSkeleton />}>
                <SidebarHeader />
              </Suspense>
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
  return <div className="bg-background flex min-h-0 flex-1 flex-col" />;
}

function HeaderLoadingBar() {
  return (
    <header className="border-border bg-background fixed top-0 right-0 left-0 z-20 flex h-12 items-center justify-between border-b pr-4 pl-2 md:pr-2">
      <div className="flex items-center">
        <div className="w-12 text-center font-mono text-[1.75rem] leading-[normal!important] font-medium">
          🆁
        </div>
        <span className="border-border mr-2 inline-flex border-r border-l px-2 py-[0.969rem]">
          <Badge variant="outline-strong">v4 beta</Badge>
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
          <span className="border-border mr-2 inline-flex border-r border-l px-2 py-[0.969rem]">
            <Badge variant="outline-strong">v4 beta</Badge>
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
              <SidebarHeaderSkeleton />

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden py-1">
                <LoadingSidebarGroup
                  labelWidth="3rem"
                  items={[
                    {
                      id: "people",
                      icon: <FramePersonIcon className="fill-current" />,
                    },
                    {
                      id: "archive",
                      icon: <ArchiveIcon className="fill-current" />,
                    },
                  ]}
                />
                <LoadingSidebarGroup
                  labelWidth="3.5rem"
                  items={[
                    {
                      id: "analytics",
                      icon: <BidLandscapeIcon className="fill-current" />,
                    },
                  ]}
                />
                <LoadingSidebarGroup
                  labelWidth="3.75rem"
                  items={[
                    {
                      id: "plans",
                      icon: <CreditCardIcon className="fill-current" />,
                    },
                    {
                      id: "settings",
                      icon: <SettingsIcon className="fill-current" />,
                    },
                    {
                      id: "accounts",
                      icon: <ManageAccountsIcon className="fill-current" />,
                    },
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
  items: Array<{ id: string; icon: ReactNode }>;
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
        {items.map((item) => (
          <div
            key={item.id}
            className="flex h-8 items-center gap-2 rounded-md px-2"
            data-sidebar-loading-row
          >
            <div className="text-sidebar-foreground/80 h-4 w-4 shrink-0">
              {item.icon}
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
