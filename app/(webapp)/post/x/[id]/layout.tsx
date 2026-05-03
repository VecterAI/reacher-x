import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageMetadata } from "@/shared/lib/metadata";

export const metadata: Metadata = createPageMetadata("Post");

export default function XPostLayout({ children }: { children: ReactNode }) {
  return children;
}
