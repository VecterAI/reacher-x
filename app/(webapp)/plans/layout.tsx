import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageMetadata } from "@/shared/lib/metadata";

export const metadata: Metadata = createPageMetadata("Plans");

export default function PlansLayout({ children }: { children: ReactNode }) {
  return children;
}
