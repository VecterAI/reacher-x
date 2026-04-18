export type ProspectListSortOption =
  | "best_fit_first"
  | "lowest_fit_first"
  | "newest_first"
  | "oldest_first"
  | "individuals_first"
  | "organizations_first";

export const DEFAULT_PROSPECT_LIST_SORT: ProspectListSortOption =
  "best_fit_first";

export const PROSPECT_LIST_SORT_LABELS: Record<
  ProspectListSortOption,
  string
> = {
  best_fit_first: "Best fit first",
  lowest_fit_first: "Lowest fit first",
  newest_first: "Newest first",
  oldest_first: "Oldest first",
  individuals_first: "Individuals first",
  organizations_first: "Organizations first",
};

export function getProspectListSortLabel(sort: ProspectListSortOption): string {
  return PROSPECT_LIST_SORT_LABELS[sort];
}

export function isDefaultProspectListSort(
  sort: ProspectListSortOption
): boolean {
  return sort === DEFAULT_PROSPECT_LIST_SORT;
}

export function areProspectListSortsEqual(
  left: ProspectListSortOption,
  right: ProspectListSortOption
): boolean {
  return left === right;
}

export function getProspectListSortSummary(
  sort: ProspectListSortOption
): string | null {
  if (isDefaultProspectListSort(sort)) {
    return null;
  }

  return getProspectListSortLabel(sort);
}

export function hasActiveProspectListSort(
  sort: ProspectListSortOption
): boolean {
  return !isDefaultProspectListSort(sort);
}
