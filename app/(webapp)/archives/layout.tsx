import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageMetadata } from "@/shared/lib/metadata";

export const metadata: Metadata = createPageMetadata("Archives");

export default function ArchivesLayout({ children }: { children: ReactNode }) {
  return children;
}
