import { Suspense, type CSSProperties, type ReactNode } from "react";
import {
  Sidebar,
  SidebarProvider as UISidebarProvider,
} from "@/shared/ui/components/Sidebar";
import { DEFAULT_SIDEBAR_OPEN } from "@/shared/lib/sidebarState";
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON } from "@/shared/lib/sidebarState";
import { Header } from "./Header";
import { WorkspaceActivityTracker } from "./WorkspaceActivityTracker";
import { WorkspaceTransitionBar } from "./WorkspaceTransitionBar";
import { SidebarContentWrapper } from "./sidebar/SidebarContentWrapper";
import { SidebarFooter } from "./sidebar/SidebarFooter";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { SidebarHeaderSkeleton } from "./sidebar/SidebarHeaderSkeleton";
import { SidebarNavigation } from "./sidebar/SidebarNavigation";
import { SidebarWrapper } from "./sidebar/SidebarWrapper";

type WebAppChromeScaffoldProps = {
  children: ReactNode;
};

const desktopSidebarStyle = {
  "--sidebar-width": SIDEBAR_WIDTH,
  "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
} as CSSProperties;

export function WebAppChromeScaffold({ children }: WebAppChromeScaffoldProps) {
  return (
    <UISidebarProvider defaultOpen={DEFAULT_SIDEBAR_OPEN}>
      <SidebarWrapper>
        <Header />
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
