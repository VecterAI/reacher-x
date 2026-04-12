import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageMetadata } from "@/shared/lib/metadata";

export const metadata: Metadata = createPageMetadata("Analytics");

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return children;
}
