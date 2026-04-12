import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UseCaseProspectPage } from "@/features/prospects/ui/pages/UseCaseProspectPage";
import { isWorkspaceEntityRouteSlug } from "@/shared/lib/workspaceRoutes";
import {
  APP_DESCRIPTION,
  getDetailTitleForWorkspaceEntitySlug,
} from "@/shared/lib/metadata";

interface UseCaseProspectRouteProps {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata({
  params,
}: UseCaseProspectRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const title = getDetailTitleForWorkspaceEntitySlug(slug);

  return title
    ? {
        title,
        description: APP_DESCRIPTION,
      }
    : {};
}

export default async function UseCaseProspectRoute({
  params,
}: UseCaseProspectRouteProps) {
  const { slug, id } = await params;

  if (!isWorkspaceEntityRouteSlug(slug)) {
    notFound();
  }

  return <UseCaseProspectPage entitySlug={slug} prospectId={id} />;
}
