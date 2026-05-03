import type { Doc } from "../_generated/dataModel";

type ProspectFieldsForSearch = Pick<
  Doc<"prospects">,
  | "displayName"
  | "title"
  | "briefIntro"
  | "matchedKeywords"
  | "location"
  | "company"
  | "websiteUrl"
  | "qualificationKeywords"
  | "notes"
  | "tags"
  | "finance"
  | "painPoints"
  | "socialProfiles"
>;

/**
 * Builds a single searchable string for Convex full-text index + display.
 * Excludes raw platform `data` and does not add qualification scores as tokens.
 */
export function buildProspectSearchText(
  prospect: ProspectFieldsForSearch,
  extras: {
    profileUrl?: string | null;
    twitterUsername?: string | null;
    linkedInUsername?: string | null;
  }
): string {
  const parts: string[] = [];

  if (prospect.displayName?.trim()) parts.push(prospect.displayName.trim());
  if (prospect.title?.trim()) parts.push(prospect.title.trim());
  if (prospect.briefIntro?.trim()) parts.push(prospect.briefIntro.trim());
  if (prospect.company?.trim()) parts.push(prospect.company.trim());
  if (prospect.websiteUrl?.trim()) {
    parts.push(prospect.websiteUrl.trim());
    try {
      const host = new URL(
        prospect.websiteUrl.startsWith("http")
          ? prospect.websiteUrl
          : `https://${prospect.websiteUrl}`
      ).hostname.replace(/^www\./, "");
      if (host) parts.push(host);
    } catch {
      // ignore invalid URL
    }
  }
  if (prospect.location?.trim()) parts.push(prospect.location.trim());
  if (extras.profileUrl?.trim()) parts.push(extras.profileUrl.trim());
  if (extras.twitterUsername?.trim())
    parts.push(
      extras.twitterUsername.trim(),
      `@${extras.twitterUsername.trim()}`
    );
  if (extras.linkedInUsername?.trim())
    parts.push(extras.linkedInUsername.trim());

  if (prospect.matchedKeywords?.length) {
    parts.push(
      ...prospect.matchedKeywords.map((k) => k.trim()).filter(Boolean)
    );
  }
  if (prospect.qualificationKeywords?.length) {
    parts.push(
      ...prospect.qualificationKeywords.map((k) => k.trim()).filter(Boolean)
    );
  }
  if (prospect.finance?.displayValue?.trim()) {
    parts.push(prospect.finance.displayValue.trim());
  }
  if (prospect.notes?.trim()) parts.push(prospect.notes.trim());
  if (prospect.tags?.length) {
    parts.push(...prospect.tags.map((t) => t.trim()).filter(Boolean));
  }
  if (prospect.painPoints?.length) {
    for (const pp of prospect.painPoints) {
      if (pp.pain?.trim()) parts.push(pp.pain.trim());
      if (pp.solution?.trim()) parts.push(pp.solution.trim());
    }
  }

  const sp = prospect.socialProfiles;
  const tw = sp?.twitter?.username?.trim();
  if (tw) parts.push(tw, `@${tw}`);
  const li = sp?.linkedin?.username?.trim();
  if (li) parts.push(li);

  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined.length > 0 ? joined : " ";
}
