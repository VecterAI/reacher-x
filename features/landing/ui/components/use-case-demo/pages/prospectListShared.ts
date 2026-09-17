import {
  getProspectListFilterArgs,
  type ProspectListFilters,
} from "@/features/prospects/lib/prospectListFilters";
import type { ProspectListSortOption } from "@/features/prospects/lib/prospectListSort";
import { compareProspectRowsForSort } from "@/convex/lib/prospectListFeedUtils";
/**
 * Shared helpers for the demo prospect list pages.
 */
import type { CSSProperties } from "react";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * The real list pages use
 * `md:[grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]`.
 * Inside the fixed 1280px demo canvas, viewport media queries do not track
 * the canvas, so the same value is applied as an inline style (the canvas
 * always renders the desktop layout).
 */
export const DEMO_PROSPECT_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,20rem),1fr))",
};

export function matchesProspectSearch(
  prospect: Doc<"prospects">,
  query: string
): boolean {
  const haystack = [
    prospect.displayName,
    prospect.title,
    prospect.briefIntro,
    prospect.company,
    prospect.location,
    ...(prospect.matchedKeywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

/** Local dataset adapter using the app's filter arguments and exact sort comparator. */
export function filterAndSortDemoProspects(
  prospects: Doc<"prospects">[],
  query: string,
  filters: ProspectListFilters,
  sort: ProspectListSortOption,
  now?: Date
) {
  const args = getProspectListFilterArgs(filters, now);
  const needle = query.trim().toLowerCase();
  return prospects
    .filter((p) => {
      const score = p.qualificationScore ?? 0;
      return (
        (!args.platform || p.platform === args.platform) &&
        (!args.prospectType ||
          (p.prospectType ?? "individual") === args.prospectType) &&
        score >= args.fitScoreMin &&
        score <= args.fitScoreMax &&
        (args.createdAfterMs === undefined ||
          p._creationTime >= args.createdAfterMs) &&
        (args.createdBeforeMs === undefined ||
          p._creationTime < args.createdBeforeMs) &&
        (!needle || matchesProspectSearch(p, needle))
      );
    })
    .sort((a, b) =>
      compareProspectRowsForSort(
        {
          sortQualificationScore: a.qualificationScore ?? 0,
          prospectCreatedAt: a._creationTime,
          prospectId: a._id,
          prospectType: a.prospectType,
        },
        {
          sortQualificationScore: b.qualificationScore ?? 0,
          prospectCreatedAt: b._creationTime,
          prospectId: b._id,
          prospectType: b.prospectType,
        },
        sort
      )
    );
}
