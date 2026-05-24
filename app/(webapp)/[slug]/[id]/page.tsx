import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { UseCaseProspectPage } from "@/features/prospects/ui/pages/UseCaseProspectPage";
import { WebAppLoadingContentSkeleton } from "@/features/webapp/ui/components";
import { isWorkspaceEntityRouteSlug } from "@/shared/lib/workspaceRoutes";

interface UseCaseProspectRouteProps {
  params: Promise<{ slug: string; id: string }>;
}

export default function UseCaseProspectRoute({
  params,
}: UseCaseProspectRouteProps) {
  return (
    <Suspense fallback={<WebAppLoadingContentSkeleton />}>
      <ResolvedUseCaseProspectRoute params={params} />
    </Suspense>
  );
}

async function ResolvedUseCaseProspectRoute({
  params,
}: UseCaseProspectRouteProps) {
  await connection();

  const { slug, id } = await params;

  if (!isWorkspaceEntityRouteSlug(slug)) {
    notFound();
  }

  return <UseCaseProspectPage entitySlug={slug} prospectId={id} />;
}
