import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageMetadata } from "@/shared/lib/metadata";

export const metadata: Metadata = createPageMetadata("Agent Ops");

export default function AgentOpsLayout({ children }: { children: ReactNode }) {
  return children;
}
