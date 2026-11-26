export type LinkedInProspectEntityType = "person" | "company";

const LINKEDIN_COMPANY_URN_PREFIX_RE =
  /^urn:li:(?:fsd_company|organization|company):/i;
const LINKEDIN_COMPANY_URL_RE = /linkedin\.com\/company\//i;

function toTrimmedString(value?: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extract the numeric LinkedIn company ID from a company/organization URN
 * (including `urn:li:fsd_company:`, `urn:li:organization:`, `urn:li:company:`)
 * or raw numeric string.
 */
export function normalizeLinkedInCompanyId(
  value?: string | null
): string | undefined {
  const normalized = toTrimmedString(value)?.replace(
    LINKEDIN_COMPANY_URN_PREFIX_RE,
    ""
  );
  return normalized && /^\d+$/.test(normalized) ? normalized : undefined;
}

/**
 * Determine whether a LinkedIn prospect/identity points to a company page
 * rather than an individual member profile.
 */
export function isLinkedInCompanyIdentity(args: {
  providerId?: string | null;
  profileUrl?: string | null;
  prospectType?: string | null;
  authorType?: string | null;
}): boolean {
  const providerId = toTrimmedString(args.providerId);
  if (providerId && LINKEDIN_COMPANY_URN_PREFIX_RE.test(providerId)) {
    return true;
  }

  const profileUrl = toTrimmedString(args.profileUrl);
  if (profileUrl && LINKEDIN_COMPANY_URL_RE.test(profileUrl)) {
    return true;
  }

  const prospectType = toTrimmedString(args.prospectType)?.toLowerCase();
  if (prospectType === "organization" || prospectType === "company") {
    return true;
  }

  const authorType = toTrimmedString(args.authorType)?.toLowerCase();
  return authorType === "company" || authorType === "organization";
}

/** Resolve company lookup args (`id` or `name` slug) for `getCompany`. */
export function resolveLinkedInCompanyLookupArgs(identity: {
  providerId?: string | null;
  username?: string | null;
  displayName?: string | null;
}): { id?: string; name?: string } {
  const companyId = normalizeLinkedInCompanyId(identity.providerId);
  const slug = toTrimmedString(identity.username);
  const displayName = toTrimmedString(identity.displayName);

  if (companyId) {
    return {
      id: companyId,
      name: slug,
    };
  }

  return {
    name: slug ?? displayName,
  };
}
