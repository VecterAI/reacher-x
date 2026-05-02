/**
 * Derive X/Twitter display identity and user id from a stored prospect document.
 * Used by Convex DM flows and agent tools — single source of truth.
 */
import { extractTwitterUsername } from "../utils/url/socialProfiles";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** Numeric X user id when present on enriched prospect data (`id_str` / `rest_id`). */
function readTwitterUserId(user: Record<string, unknown>): string | undefined {
  const idStr = asString(user.id_str);
  if (idStr) return idStr;
  const restId = asString(user.rest_id);
  if (restId) return restId;
  const id = user.id;
  if (typeof id === "number" && Number.isFinite(id)) {
    return String(Math.trunc(id));
  }
  if (typeof id === "string" && /^\d+$/.test(id.trim())) {
    return id.trim();
  }
  return undefined;
}

export type ProspectTwitterIdentity = {
  username?: string;
  displayName: string;
  title?: string;
  avatarUrl?: string;
  profileUrl?: string;
  verified?: boolean;
  canDm?: boolean;
  /** X user id for API participant_id when enrichment stored it */
  userId?: string;
};

/**
 * @param prospect - Typically `Doc<"prospects">` or a plain object with the same fields
 */
export function resolveProspectTwitterIdentity(
  prospect: Record<string, unknown>
): ProspectTwitterIdentity {
  const data = asRecord(prospect.data);
  const socialProfiles = asRecord(prospect.socialProfiles);
  const twitterSocial = asRecord(socialProfiles?.twitter);
  const user = asRecord(data?.user);
  const username =
    asString(user?.screen_name) ??
    asString(twitterSocial?.username) ??
    extractTwitterUsername(asString(twitterSocial?.url) ?? "") ??
    extractTwitterUsername(asString(prospect.profileUrl) ?? "");
  const avatarUrl =
    asString(user?.profile_image_url_https) ??
    asString(user?.profile_image_url) ??
    asString(prospect.avatarUrl);
  const displayName =
    asString(prospect.displayName) ??
    asString(user?.name) ??
    username ??
    "Unknown";
  const profileUrl = username
    ? `https://x.com/${username}`
    : asString(twitterSocial?.url);
  const verified =
    asBoolean(user?.verified) ??
    (typeof user?.verified_type === "string" && user.verified_type !== "none");
  const canDm =
    asBoolean(user?.receivesYourDm) ??
    asBoolean(user?.receives_your_dm) ??
    asBoolean(user?.canDm) ??
    asBoolean(user?.can_dm);

  const userId = user ? readTwitterUserId(user) : undefined;

  return {
    username,
    displayName,
    title: asString(prospect.title),
    avatarUrl,
    profileUrl,
    verified,
    canDm,
    userId,
  };
}
