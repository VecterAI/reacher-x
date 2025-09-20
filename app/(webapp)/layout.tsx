// app/(webapp)/layout.tsx
import {
  Sidebar,
  SidebarProvider as UISidebarProvider,
} from "@/shared/ui/components/Sidebar";
import { Header } from "@/features/webapp/ui/components/Header";
import { ReactNode, Suspense } from "react";
import {
  SidebarSearchHeader,
  SidebarContentWrapper,
  SidebarNavigation,
  SidebarResources,
  SidebarKeywords,
  SidebarFooter,
  SidebarWrapper,
  NotificationProvider,
} from "@/features/webapp/ui/components";

export default function WebAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <UISidebarProvider>
        <NotificationProvider>
          <SidebarWrapper>
            <Header />
            <div className="w-full pt-12">
              {/* Match header height */}
              <div className="flex">
                <Sidebar
                  collapsible="icon"
                  style={
                    {
                      "--sidebar-width": "16rem",
                      "--sidebar-width-icon": "3rem",
                    } as React.CSSProperties
                  }
                >
                  <SidebarSearchHeader />
                  <SidebarContentWrapper>
                    <SidebarNavigation />
                    <SidebarResources />
                    <SidebarKeywords />
                  </SidebarContentWrapper>
                  <SidebarFooter />
                </Sidebar>
                <main className="w-full">{children}</main>
              </div>
            </div>
          </SidebarWrapper>
        </NotificationProvider>
      </UISidebarProvider>
    </Suspense>
  );
}
