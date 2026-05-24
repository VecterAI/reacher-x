import type { Doc, Id } from "../_generated/dataModel";

export type ProspectListSortOption =
  | "best_fit_first"
  | "lowest_fit_first"
  | "newest_first"
  | "oldest_first"
  | "individuals_first"
  | "organizations_first";

export const DEFAULT_PROSPECT_LIST_SORT: ProspectListSortOption =
  "best_fit_first";

type NormalizedProspectType = Exclude<
  Doc<"prospects">["prospectType"],
  undefined
>;

export function normalizeProspectListSort(
  sortBy?: ProspectListSortOption
): ProspectListSortOption {
  return sortBy ?? DEFAULT_PROSPECT_LIST_SORT;
}

function normalizeProspectType(
  prospectType: Doc<"prospectSummaries">["prospectType"] | undefined
): NormalizedProspectType {
  return prospectType ?? "unknown";
}

function getTypeRank(
  sortBy: ProspectListSortOption,
  prospectType: NormalizedProspectType
): number {
  switch (sortBy) {
    case "individuals_first":
      if (prospectType === "individual") return 0;
      if (prospectType === "organization") return 1;
      return 2;
    case "organizations_first":
      if (prospectType === "organization") return 0;
      if (prospectType === "individual") return 1;
      return 2;
    default:
      return 0;
  }
}

/**
 * Sort order matches prospectSummaries indexes: descending by
 * sortQualificationScore, then prospectCreatedAt, then prospectId.
 * "Better" rows appear earlier in the feed.
 */
export type FeedAnchorKey = {
  sortBy: ProspectListSortOption;
  anchorSortScore: number;
  anchorProspectCreatedAt: number;
  anchorProspectType: NormalizedProspectType;
  anchorProspectId: Id<"prospects">;
};

export function summaryRowToAnchorKey(
  row: Pick<
    Doc<"prospectSummaries">,
    | "sortQualificationScore"
    | "prospectCreatedAt"
    | "prospectId"
    | "prospectType"
  >,
  sortBy: ProspectListSortOption
): FeedAnchorKey {
  return {
    sortBy,
    anchorSortScore: row.sortQualificationScore,
    anchorProspectCreatedAt: row.prospectCreatedAt,
    anchorProspectType: normalizeProspectType(row.prospectType),
    anchorProspectId: row.prospectId,
  };
}

export function compareProspectRowsForSort(
  left: Pick<
    Doc<"prospectSummaries">,
    | "sortQualificationScore"
    | "prospectCreatedAt"
    | "prospectId"
    | "prospectType"
  >,
  right: Pick<
    Doc<"prospectSummaries">,
    | "sortQualificationScore"
    | "prospectCreatedAt"
    | "prospectId"
    | "prospectType"
  >,
  sortBy: ProspectListSortOption
): number {
  const normalizedSort = normalizeProspectListSort(sortBy);

  if (
    normalizedSort === "individuals_first" ||
    normalizedSort === "organizations_first"
  ) {
    const leftRank = getTypeRank(
      normalizedSort,
      normalizeProspectType(left.prospectType)
    );
    const rightRank = getTypeRank(
      normalizedSort,
      normalizeProspectType(right.prospectType)
    );

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
  }

  if (normalizedSort === "newest_first" || normalizedSort === "oldest_first") {
    if (left.prospectCreatedAt !== right.prospectCreatedAt) {
      return normalizedSort === "newest_first"
        ? right.prospectCreatedAt - left.prospectCreatedAt
        : left.prospectCreatedAt - right.prospectCreatedAt;
    }
    if (left.sortQualificationScore !== right.sortQualificationScore) {
      return right.sortQualificationScore - left.sortQualificationScore;
    }
  } else if (normalizedSort === "lowest_fit_first") {
    if (left.sortQualificationScore !== right.sortQualificationScore) {
      return left.sortQualificationScore - right.sortQualificationScore;
    }
    if (left.prospectCreatedAt !== right.prospectCreatedAt) {
      return right.prospectCreatedAt - left.prospectCreatedAt;
    }
  } else {
    if (left.sortQualificationScore !== right.sortQualificationScore) {
      return right.sortQualificationScore - left.sortQualificationScore;
    }
    if (left.prospectCreatedAt !== right.prospectCreatedAt) {
      return right.prospectCreatedAt - left.prospectCreatedAt;
    }
  }

  if (left.prospectId === right.prospectId) {
    return 0;
  }

  return left.prospectId > right.prospectId ? -1 : 1;
}

export function isBetterInFeedOrder(
  row: Pick<
    Doc<"prospectSummaries">,
    | "sortQualificationScore"
    | "prospectCreatedAt"
    | "prospectId"
    | "prospectType"
  >,
  than: FeedAnchorKey
): boolean {
  return (
    compareProspectRowsForSort(
      row,
      {
        sortQualificationScore: than.anchorSortScore,
        prospectCreatedAt: than.anchorProspectCreatedAt,
        prospectId: than.anchorProspectId,
        prospectType: than.anchorProspectType,
      },
      than.sortBy
    ) < 0
  );
}

export function isInFitScoreRange(
  score: number,
  fitScoreMin: number,
  fitScoreMax: number
): boolean {
  return score >= fitScoreMin && score <= fitScoreMax;
}
