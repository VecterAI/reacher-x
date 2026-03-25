import type { Doc, Id } from "../_generated/dataModel";

/**
 * Locked merge: Tier1 = intersection (FT relevance order), Tier2 = FT-only, Tier3 = semantic-only not on this FT page.
 */
export function mergeTierOrderedProspectIds(
  ftPage: Doc<"prospectSummaries">[],
  semanticOrderedIds: Id<"prospects">[]
): Id<"prospects">[] {
  const semanticSet = new Set(semanticOrderedIds.map(String));
  const ftIdSet = new Set(ftPage.map((r) => String(r.prospectId)));

  const tier1 = ftPage.filter((r) => semanticSet.has(String(r.prospectId)));
  const tier2 = ftPage.filter((r) => !semanticSet.has(String(r.prospectId)));
  const tier3 = semanticOrderedIds.filter((id) => !ftIdSet.has(String(id)));

  return [
    ...tier1.map((r) => r.prospectId),
    ...tier2.map((r) => r.prospectId),
    ...tier3,
  ];
}
