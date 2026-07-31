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
