import { notFound, redirect } from "next/navigation";
import { UseCaseSuccessPage } from "@/features/webapp/ui/pages/UseCaseSuccessPage";
import {
  isWorkspaceEntityRouteSlug,
  isWorkspaceSuccessRouteSlug,
} from "@/shared/lib/workspaceRoutes";

interface UseCaseSuccessRouteProps {
  params: Promise<{ slug: string }>;
}

export default async function UseCaseSuccessRoute({
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
