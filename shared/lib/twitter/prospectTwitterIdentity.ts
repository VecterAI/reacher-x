/**
 * Derive X/Twitter display identity and user id from a stored prospect document.
 * Used by Convex DM flows and agent tools — single source of truth.
 */
import { extractTwitterUsername } from "../utils/url/socialProfiles";
import {
  getTwitterProfileWebsiteEntity,
  selectProfileWebsiteHref,
} from "./profileLinks";

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

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
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
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  profileUrl?: string;
  websiteUrl?: string;
  location?: string;
  followersCount?: number;
  followingCount?: number;
  joinedAt?: string;
  verified?: boolean;
  canDm?: boolean;
  /** X user id for API participant_id when enrichment stored it */
  userId?: string;
};

/**
 * @param prospect - Typically `Doc<"prospects">` or a plain object with the same fields
 */
export function resolveProspectTwitterIdentity(
  prospect: unknown
): ProspectTwitterIdentity {
  const prospectRecord = asRecord(prospect) ?? {};
  const data = asRecord(prospectRecord.data);
  const socialProfiles = asRecord(prospectRecord.socialProfiles);
  const twitterSocial = asRecord(socialProfiles?.twitter);
  const user = asRecord(data?.user);
  const userWebsiteEntity = user
    ? getTwitterProfileWebsiteEntity(user)
    : undefined;
  const username =
    asString(user?.screen_name) ??
    asString(twitterSocial?.username) ??
    extractTwitterUsername(asString(twitterSocial?.url) ?? "") ??
    extractTwitterUsername(asString(prospectRecord.profileUrl) ?? "");
  const avatarUrl =
    asString(user?.profile_image_url_https) ??
    asString(user?.profile_image_url) ??
    asString(prospectRecord.avatarUrl);
  const displayName =
    asString(prospectRecord.displayName) ??
    asString(user?.name) ??
    username ??
    "Unknown";
  const profileUrl = username
    ? `https://x.com/${username}`
    : asString(twitterSocial?.url);
  const bio = asString(user?.description);
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
    title: asString(prospectRecord.title),
    bio,
    avatarUrl,
    bannerUrl: asString(user?.profile_banner_url),
    profileUrl,
    websiteUrl:
      selectProfileWebsiteHref(
        asString(prospectRecord.websiteHref),
        asString(prospectRecord.websiteUrl)
      ) ??
      selectProfileWebsiteHref(
        userWebsiteEntity?.expanded_url,
        asString(user?.url)
      ),
    location: asString(user?.location),
    followersCount: asNumber(user?.followers_count),
    followingCount: asNumber(user?.friends_count),
    joinedAt: asString(user?.created_at),
    verified,
    canDm,
    userId,
  };
}
