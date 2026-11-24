import type { Doc } from "@/convex/_generated/dataModel";

/** A list row; dashboard rows also say whether the user opened it. */
export type ProspectListRow = Doc<"prospectSummaries"> & { opened?: boolean };

export function dedupeProspectListResults(
  results: readonly ProspectListRow[]
): ProspectListRow[] {
  const seen = new Set<ProspectListRow["_id"]>();

  return results.filter((prospect) => {
    if (seen.has(prospect._id)) return false;
    seen.add(prospect._id);
    return true;
  });
}

export function shouldShowProspectFeedSkeleton(args: {
  browseMode: boolean;
  firstPageLoading: boolean;
  countsPending: boolean;
  expectedResultCount?: number;
  displayedResultCount: number;
}): boolean {
  if (args.firstPageLoading) return true;
  if (!args.browseMode) return false;

  return (
    args.countsPending ||
    (args.expectedResultCount !== undefined &&
      args.expectedResultCount > 0 &&
      args.displayedResultCount === 0)
  );
}
