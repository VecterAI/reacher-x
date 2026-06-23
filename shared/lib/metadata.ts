import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseDefinition,
} from "@/shared/lib/workspaceUseCases";
import {
  getWorkspaceUseCaseKeyForEntitySlug,
  getWorkspaceUseCaseKeyForSuccessSlug,
} from "@/shared/lib/workspaceRoutes";
import {
  parseWorkspaceUseCaseKeyParam,
  WORKSPACE_USE_CASE_STORAGE_KEY,
} from "@/shared/lib/workspaceUseCaseCache";

export const APP_NAME = "🆁 ReacherX";
export const APP_DESCRIPTION =
  "Open-source, self-improving △ Agent that finds the people you need in real time.";

export function createPageMetadata(
  title: string,
  description = APP_DESCRIPTION
): Metadata {
  return {
    title,
    description,
  };
}

export async function getActiveWorkspaceUseCaseMetadata(): Promise<WorkspaceUseCaseDefinition> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(WORKSPACE_USE_CASE_STORAGE_KEY)?.value;
  const useCaseKey = parseWorkspaceUseCaseKeyParam(cookieValue);

  return getWorkspaceUseCase(useCaseKey);
}

export function getMetadataForWorkspaceSlug(slug: string): Metadata | null {
  const entityUseCaseKey = getWorkspaceUseCaseKeyForEntitySlug(slug);
  if (entityUseCaseKey) {
    const useCase = getWorkspaceUseCase(entityUseCaseKey);
    return createPageMetadata(
      useCase.pageLabels.entities,
      useCase.shortDescription
    );
  }

  const successUseCaseKey = getWorkspaceUseCaseKeyForSuccessSlug(slug);
  if (successUseCaseKey) {
    const useCase = getWorkspaceUseCase(successUseCaseKey);
    return createPageMetadata(
      useCase.pageLabels.converts,
      useCase.successDefinition
    );
  }

  return null;
}

export function getDetailTitleForWorkspaceEntitySlug(
  slug: string
): string | null {
  const useCaseKey = getWorkspaceUseCaseKeyForEntitySlug(slug);
  if (!useCaseKey) return null;

  const useCase = getWorkspaceUseCase(useCaseKey);
  return `${useCase.entitySingular} Details`;
}
