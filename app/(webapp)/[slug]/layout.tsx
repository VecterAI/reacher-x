import type { ReactNode } from "react";
import { WORKSPACE_DYNAMIC_ROUTE_STATIC_PARAMS } from "@/shared/lib/workspaceRoutes";

export function generateStaticParams() {
  return WORKSPACE_DYNAMIC_ROUTE_STATIC_PARAMS;
}

export default function WorkspaceSlugLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
