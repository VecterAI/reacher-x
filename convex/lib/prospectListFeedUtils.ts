import type { Doc, Id } from "../_generated/dataModel";

/**
 * Sort order matches prospectSummaries indexes: descending by
 * sortQualificationScore, then prospectCreatedAt, then prospectId.
 * "Better" rows appear earlier in the feed.
 */
export type FeedAnchorKey = {
  anchorSortScore: number;
  anchorProspectCreatedAt: number;
  anchorProspectId: Id<"prospects">;
};

export function summaryRowToAnchorKey(
  row: Pick<
    Doc<"prospectSummaries">,
    "sortQualificationScore" | "prospectCreatedAt" | "prospectId"
  >
): FeedAnchorKey {
  return {
    anchorSortScore: row.sortQualificationScore,
    anchorProspectCreatedAt: row.prospectCreatedAt,
    anchorProspectId: row.prospectId,
  };
}

export function isBetterInFeedOrder(
  row: Pick<
    Doc<"prospectSummaries">,
    "sortQualificationScore" | "prospectCreatedAt" | "prospectId"
  >,
  than: FeedAnchorKey
): boolean {
  if (row.sortQualificationScore > than.anchorSortScore) {
    return true;
  }
  if (row.sortQualificationScore < than.anchorSortScore) {
    return false;
  }
  if (row.prospectCreatedAt > than.anchorProspectCreatedAt) {
    return true;
  }
  if (row.prospectCreatedAt < than.anchorProspectCreatedAt) {
    return false;
  }
  return row.prospectId > than.anchorProspectId;
}

export function isInFitScoreRange(
  score: number,
  fitScoreMin: number,
  fitScoreMax: number
): boolean {
  return score >= fitScoreMin && score <= fitScoreMax;
}
