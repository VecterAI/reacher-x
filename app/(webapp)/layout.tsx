// app/(webapp)/layout.tsx
import type { Metadata } from "next";
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
} from "@/features/webapp/ui/components";
import { ProfileProvider } from "@/features/profile/contexts/TwitterProfileContext";
import { ProspectProfileProvider } from "@/features/prospects/contexts";

export const metadata: Metadata = {
  title: "ReacherX",
  description: "AI search engine to find potential customers on the web.",
};

export default function WebAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <UISidebarProvider>
        <NotificationProvider>
          <ProfileProvider>
            <ProspectProfileProvider>
              <SidebarWrapper>
                <Header />
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
            </ProspectProfileProvider>
          </ProfileProvider>
        </NotificationProvider>
      </UISidebarProvider>
    </Suspense>
  );
}
