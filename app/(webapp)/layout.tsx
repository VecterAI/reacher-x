// app/(webapp)/layout.tsx
import {
  Sidebar,
  SidebarProvider,
  SidebarRail,
} from "@/shared/ui/components/Sidebar";
import { Header } from "@/features/webapp/ui/components/Header";
import { ReactNode } from "react";
import { KeywordHistory } from "@/features/history/ui/components/KeywordHistory";

export default function WebAppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Header />
      <div className="pt-12">
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
            <KeywordHistory />
            <SidebarRail />
          </Sidebar>
          <main>{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
