/**
 * Notification Helpers
 *
 * Consolidated helpers for notification-related functionality.
 * Single source of truth for all notification utilities.
 */

import type { Doc } from "../_generated/dataModel";

// ============================================================================
// Prospect Display Fields (for outreachNotifications)
// ============================================================================

type ProspectData = Record<string, unknown>;
type ProspectUser = Record<string, unknown>;

/**
 * Extract avatar URL from raw prospect data.
 * Handles Twitter (user.profile_image_url_https) and LinkedIn (profileImage).
 */
export function extractAvatarUrl(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as ProspectData;

  // Twitter: user.profile_image_url_https
  const user = d.user as ProspectUser | undefined;
  if (typeof user?.profile_image_url_https === "string") {
    return user.profile_image_url_https;
  }

  // LinkedIn: profileImage
  if (typeof d.profileImage === "string") {
    return d.profileImage;
  }

  return undefined;
}

/**
 * Extract display name from raw prospect data.
 * Falls back through: enriched displayName → data.user.name → undefined.
 */
export function extractDisplayName(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as ProspectData;

  // Twitter: user.name
  const user = d.user as ProspectUser | undefined;
  if (typeof user?.name === "string") {
    return user.name;
  }

  // LinkedIn: name field
  if (typeof d.name === "string") {
    return d.name;
  }

  return undefined;
}

/**
 * Extract screen name from prospect (Twitter @handle or LinkedIn username).
 * Used for internal tracking, not displayed in titles per user feedback.
 */
export function extractScreenName(
  prospect: Pick<Doc<"prospects">, "data" | "socialProfiles"> | null
): string | undefined {
  if (!prospect) return undefined;

  // Try socialProfiles first (enriched data)
  if (prospect.socialProfiles?.twitter?.username) {
    return prospect.socialProfiles.twitter.username;
  }
  if (prospect.socialProfiles?.linkedin?.username) {
    return prospect.socialProfiles.linkedin.username;
  }

  // Fallback to raw data
  const data = prospect.data as ProspectData | undefined;
  const user = data?.user as ProspectUser | undefined;
  if (typeof user?.screen_name === "string") {
    return user.screen_name;
  }

  return undefined;
}

/**
 * Get all prospect display fields for notification creation.
 * Convenience function combining all extractors.
 */
export function getProspectDisplayFields(prospect: Doc<"prospects"> | null): {
  prospectAvatarUrl: string | undefined;
  prospectDisplayName: string | undefined;
  prospectType: Doc<"prospects">["prospectType"];
  prospectPlatform: Doc<"prospects">["platform"] | undefined;
  prospectScreenName: string | undefined;
} {
  if (!prospect) {
    return {
      prospectAvatarUrl: undefined,
      prospectDisplayName: undefined,
      prospectType: undefined,
      prospectPlatform: undefined,
      prospectScreenName: undefined,
    };
  }

  return {
    prospectAvatarUrl: extractAvatarUrl(prospect.data),
    prospectDisplayName:
      prospect.displayName || extractDisplayName(prospect.data),
    prospectType: prospect.prospectType,
    prospectPlatform: prospect.platform,
    prospectScreenName: extractScreenName(prospect),
  };
}
