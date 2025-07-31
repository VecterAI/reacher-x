"use client";

import { useSearchParams } from "next/navigation";
import { SidebarProvider } from "@/features/webapp/contexts/SidebarContext";
import { ReactNode } from "react";

export function SidebarWrapper({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const activeKeyword = searchParams.get("q") || "";

  return (
    <SidebarProvider activeKeyword={activeKeyword}>{children}</SidebarProvider>
  );
}
