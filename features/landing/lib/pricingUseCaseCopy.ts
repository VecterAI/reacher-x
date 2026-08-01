import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";

const QUALIFIED_PROSPECTS_TEXT = "qualified prospects";

/** Swap “qualified prospects” for use-case entity wording (pricing + plans). */
export function resolvePlanFeatureEntityCopy(
  feature: string,
  entityPlural: string
): string {
  return feature.replace(
    QUALIFIED_PROSPECTS_TEXT,
    `qualified ${entityPlural.toLowerCase()}`
  );
}

export function resolvePricingFeatureCopy(
  feature: string,
  useCaseKey: WorkspaceUseCaseKey
): string {
  return resolvePlanFeatureEntityCopy(
    feature,
    getWorkspaceUseCase(useCaseKey).entityPlural
  );
}
