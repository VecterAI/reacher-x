import { normalizeMemoryText } from "./memoryHelpers";
import type {
  DiscoveryStage,
  WorkspaceTargetingSpec,
} from "./targetingSpecCore";

/** A title alone cannot establish a required workflow/intent criterion. */
export function resolvePeopleQueryStage(
  query: string,
  stage: DiscoveryStage,
  spec?: WorkspaceTargetingSpec
): DiscoveryStage {
  const hasRequiredWorkflow = spec?.criteria.some(
    (c) =>
      c.kind === "required" &&
      c.category !== "profile_fit" &&
      c.evidence !== "profile"
  );
  const isRoleOnly = spec?.searchHints.roleTitles.some(
    (role) => normalizeMemoryText(role) === normalizeMemoryText(query)
  );
  return hasRequiredWorkflow && isRoleOnly ? "broad" : stage;
}

/** Keep a standalone named-entity query: extra verbs can suppress useful results. */
export function hasDiscoveryEntityCoverage(
  queries: readonly string[],
  entities: readonly string[]
): boolean {
  const meaningfulEntities = entities.map(normalizeMemoryText).filter(Boolean);
  return (
    meaningfulEntities.length === 0 ||
    queries.some((query) => {
      const normalized = normalizeMemoryText(query)
        .replace(/^["“”']+|["“”']+$/g, "")
        .trim();
      return meaningfulEntities.includes(normalized);
    })
  );
}
