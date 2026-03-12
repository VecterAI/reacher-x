import { notFound } from "next/navigation";
import { UseCaseProspectPage } from "@/features/prospects/ui/pages/UseCaseProspectPage";
import { isWorkspaceEntityRouteSlug } from "@/shared/lib/workspaceRoutes";

interface UseCaseProspectRouteProps {
  params: Promise<{ slug: string; id: string }>;
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
