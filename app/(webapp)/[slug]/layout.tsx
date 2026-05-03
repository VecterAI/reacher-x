import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WORKSPACE_DYNAMIC_ROUTE_STATIC_PARAMS } from "@/shared/lib/workspaceRoutes";
import { getMetadataForWorkspaceSlug } from "@/shared/lib/metadata";

export function generateStaticParams() {
  return WORKSPACE_DYNAMIC_ROUTE_STATIC_PARAMS;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  return getMetadataForWorkspaceSlug(slug) ?? {};
}

export default function WorkspaceSlugLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
