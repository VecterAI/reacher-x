import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageMetadata } from "@/shared/lib/metadata";

export const metadata: Metadata = createPageMetadata("Workspace Setup");

export default function WorkspaceSetupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
