import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import {
  getWorkspaceUseCase,
  resolveWorkspaceEntityPluralLabel,
} from "@/shared/lib/workspaceUseCases";

const PEOPLE_FEATURE_TEXT = /qualified prospects|people who match/;

/** Swap “qualified prospects” for use-case entity wording (pricing + plans). */
export function resolvePlanFeatureEntityCopy(
  feature: string,
  entityPlural: string = getWorkspaceUseCase(undefined).entityPlural
): string {
  return feature
    .replace(
      "24/7 sourcing, qualification, enrichment & outreach",
      "Find people, check matches, gather details, and reach out, 24/7"
    )
    .replace(
      PEOPLE_FEATURE_TEXT,
      `${resolveWorkspaceEntityPluralLabel(entityPlural).toLowerCase()} who match`
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
