// app/(webapp)/layout.tsx
import {
  Sidebar,
  SidebarProvider as UISidebarProvider,
} from "@/shared/ui/components/Sidebar";
import { Header } from "@/features/webapp/ui/components/Header";
import { ReactNode } from "react";
import { SidebarProvider } from "@/features/webapp/contexts/SidebarContext";
import { SidebarSearchHeader } from "@/features/webapp/ui/components/SidebarSearchHeader";
import { SidebarContentWrapper } from "@/features/webapp/ui/components/SidebarContentWrapper";
import { SidebarNavigation } from "@/features/webapp/ui/components/SidebarNavigation";
import { SidebarResources } from "@/features/webapp/ui/components/SidebarResources";
import { SidebarKeywords } from "@/features/webapp/ui/components/SidebarKeywords";
import { SidebarFooter } from "@/features/webapp/ui/components/SidebarFooter";

export default function WebAppLayout({ children }: { children: ReactNode }) {
  return (
    <UISidebarProvider>
      <SidebarProvider>
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
      </SidebarProvider>
    </UISidebarProvider>
  );
}
