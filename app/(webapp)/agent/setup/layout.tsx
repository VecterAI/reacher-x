import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageMetadata } from "@/shared/lib/metadata";

export const metadata: Metadata = createPageMetadata("Agent Setup");

export default function AgentSetupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
