import { extractLinkedInUsername } from "../../../shared/lib/utils/url/socialProfiles";

type LooseRecord = Record<string, unknown>;

const LINKEDIN_POST_URN_PREFIXES = [
  "urn:li:activity:",
  "urn:li:ugcpost:",
  "urn:li:share:",
];

function asRecord(value: unknown): LooseRecord | null {
  return typeof value === "object" && value !== null
    ? (value as LooseRecord)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isLinkedInPostUrn(value?: string | null): boolean {
  const trimmed = asString(value)?.toLowerCase();
  return trimmed
    ? LINKEDIN_POST_URN_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
    : false;
}

export function normalizeLinkedInProfileQueryUrn(
  value?: string | null
): string | undefined {
  const trimmed = asString(value);
  if (!trimmed || isLinkedInPostUrn(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function requireLinkedInProfileQueryUrn(value?: string | null): string {
  const profileUrn = normalizeLinkedInProfileQueryUrn(value);
  if (!profileUrn) {
    throw new Error(
      "LinkedIn profile URN required; received a post/activity URN or an empty value."
    );
  }
  return profileUrn;
}

export function resolveLinkedInProspectProfileIdentifiers(
  prospect: Record<string, unknown>
): {
  username?: string;
  profileUrn?: string;
} {
  const data = asRecord(prospect.data);
  const socialProfiles = asRecord(prospect.socialProfiles);
  const linkedInProfile = asRecord(socialProfiles?.linkedin);
  const author = asRecord(data?.author);

  const profileUrl =
    asString(linkedInProfile?.url) ??
    asString(author?.url) ??
    asString(prospect.profileUrl);
  const username =
    asString(linkedInProfile?.username) ??
    asString(data?.username) ??
    (profileUrl ? extractLinkedInUsername(profileUrl) : undefined);
  const profileUrn =
    normalizeLinkedInProfileQueryUrn(asString(prospect.linkedinUserUrn)) ??
    normalizeLinkedInProfileQueryUrn(asString(linkedInProfile?.urn)) ??
    normalizeLinkedInProfileQueryUrn(asString(author?.urn)) ??
    normalizeLinkedInProfileQueryUrn(asString(author?.id)) ??
    normalizeLinkedInProfileQueryUrn(asString(data?.profileUrn)) ??
    normalizeLinkedInProfileQueryUrn(asString(data?.urn));

  return {
    username,
    profileUrn,
  };
}
