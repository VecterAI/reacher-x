import type { Doc } from "@/convex/_generated/dataModel";

type ProspectSearchRecord = Pick<
  Doc<"prospectSummaries">,
  | "briefIntro"
  | "displayName"
  | "linkedInUsername"
  | "matchedKeywords"
  | "profileUrl"
  | "title"
  | "twitterUsername"
>;

export function matchesProspectSearch(
  prospect: ProspectSearchRecord,
  searchQuery: string
): boolean {
  if (!searchQuery.trim()) {
    return true;
  }

  const query = searchQuery.toLowerCase();
  const searchableText = [
    prospect.displayName,
    prospect.title,
    prospect.briefIntro,
    prospect.profileUrl,
    prospect.twitterUsername,
    prospect.linkedInUsername,
    ...(prospect.matchedKeywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}
