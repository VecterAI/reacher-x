import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageMetadata } from "@/shared/lib/metadata";

export const metadata: Metadata = createPageMetadata("Agent History");

export default function AgentHistoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
