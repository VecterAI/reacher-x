// app/(webapp)/layout.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  Sidebar,
  SidebarProvider as UISidebarProvider,
} from "@/shared/ui/components/Sidebar";
import { Header } from "@/features/webapp/ui/components/Header";
import { ReactNode, Suspense } from "react";
import {
  SidebarHeader,
  SidebarContentWrapper,
  SidebarNavigation,
  SidebarFooter,
  SidebarWrapper,
  NotificationProvider,
  OnboardingLockGuardProvider,
  WorkspaceTransitionBar,
} from "@/features/webapp/ui/components";
import { ProfileProvider } from "@/features/profile/contexts/TwitterProfileContext";
import { ProspectProfileProvider } from "@/features/prospects/contexts";
import { WorkspaceTransitionProvider } from "@/features/webapp/contexts/WorkspaceTransitionContext";
import { ActiveUseCaseLabelsProvider } from "@/shared/contexts/ActiveUseCaseLabelsProvider";
import {
  parseWorkspaceUseCaseKeyParam,
  WORKSPACE_USE_CASE_STORAGE_KEY,
} from "@/shared/lib/workspaceUseCaseCache";
import { WebAppShellFallback } from "./WebAppShellFallback";

export const metadata: Metadata = {
  title: "ReacherX",
  description: "AI search engine to find potential customers on the web.",
};

async function WebAppLayoutWithCookies({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get(WORKSPACE_USE_CASE_STORAGE_KEY)?.value;
  const initialUseCaseKey = parseWorkspaceUseCaseKeyParam(cookieRaw);

  return (
    <ActiveUseCaseLabelsProvider initialUseCaseKey={initialUseCaseKey}>
      <Suspense>
        <UISidebarProvider>
          <NotificationProvider>
            <ProfileProvider>
              <ProspectProfileProvider>
                <WorkspaceTransitionProvider>
                  <OnboardingLockGuardProvider>
                    <SidebarWrapper>
                      <Header />
                      <WorkspaceTransitionBar />
                      <div className="w-full pt-12">
                        {/* Match header height */}
                        <div className="flex h-[calc(100dvh-3rem)] min-h-0 overflow-hidden">
                          <Sidebar
                            collapsible="icon"
                            style={
                              {
                                "--sidebar-width": "16rem",
                                "--sidebar-width-icon": "3rem",
                              } as React.CSSProperties
                            }
                          >
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
                  </OnboardingLockGuardProvider>
                </WorkspaceTransitionProvider>
              </ProspectProfileProvider>
            </ProfileProvider>
          </NotificationProvider>
        </UISidebarProvider>
      </Suspense>
    </ActiveUseCaseLabelsProvider>
  );
}

export default function WebAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<WebAppShellFallback />}>
      <WebAppLayoutWithCookies>{children}</WebAppLayoutWithCookies>
    </Suspense>
  );
}
