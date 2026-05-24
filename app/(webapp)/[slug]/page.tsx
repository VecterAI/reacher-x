import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { UseCaseSuccessPage } from "@/features/webapp/ui/pages/UseCaseSuccessPage";
import { WebAppLoadingContentSkeleton } from "@/features/webapp/ui/components";
import {
  isWorkspaceEntityRouteSlug,
  isWorkspaceSuccessRouteSlug,
} from "@/shared/lib/workspaceRoutes";

interface UseCaseSuccessRouteProps {
  params: Promise<{ slug: string }>;
}

export default function UseCaseSuccessRoute({
  params,
}: UseCaseSuccessRouteProps) {
  return (
    <Suspense fallback={<WebAppLoadingContentSkeleton />}>
      <ResolvedUseCaseSuccessRoute params={params} />
    </Suspense>
  );
}

async function ResolvedUseCaseSuccessRoute({
  params,
}: UseCaseSuccessRouteProps) {
  const { slug } = await params;

  if (isWorkspaceEntityRouteSlug(slug)) {
    redirect("/");
  }

  if (!isWorkspaceSuccessRouteSlug(slug)) {
    notFound();
  }

  return <UseCaseSuccessPage slug={slug} />;
}
