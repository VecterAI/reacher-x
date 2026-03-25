import type { Doc } from "@/convex/_generated/dataModel";
import {
  extractLinkedInUsername,
  extractTwitterUsername,
} from "@/shared/lib/utils/url/socialProfiles";

export interface ProspectDisplayData {
  avatarUrl?: string;
  displayName: string;
  profileUrl?: string;
  twitterUsername?: string;
  linkedinUsername?: string;
  verified: boolean;
  title?: string;
  prospectType?: Doc<"prospects">["prospectType"];
  conversationPlaceholderLabel: string;
}

export type ProspectCardRecord = Doc<"prospects"> | Doc<"prospectSummaries">;

function isProspectSummaryRecord(
  prospect: ProspectCardRecord
): prospect is Doc<"prospectSummaries"> {
  return "prospectId" in prospect;
}

/**
 * Extract display-first prospect identity fields used across prospect surfaces.
 * This keeps avatar/name/verified/profile URL fallbacks consistent everywhere.
 */
export function getProspectDisplayData(
  prospect: ProspectCardRecord
): ProspectDisplayData {
  if (isProspectSummaryRecord(prospect)) {
    return {
      avatarUrl: prospect.avatarUrl,
      displayName: prospect.displayName,
      profileUrl: prospect.profileUrl,
      twitterUsername: prospect.twitterUsername,
      linkedinUsername: prospect.linkedInUsername,
      verified: prospect.verified,
      title: prospect.title,
      prospectType: prospect.prospectType,
      conversationPlaceholderLabel: prospect.conversationPlaceholderLabel,
    };
  }

  const data = prospect.data as Record<string, unknown> | undefined;
  const socialProfiles = prospect.socialProfiles as
    | {
        twitter?: { username?: string; url?: string };
        linkedin?: { username?: string; url?: string };
      }
    | undefined;

  let avatarUrl: string | undefined;
  let displayName = prospect.displayName;
  let profileUrl =
    socialProfiles?.twitter?.url || socialProfiles?.linkedin?.url || undefined;
  let twitterUsername = socialProfiles?.twitter?.username;
  let linkedinUsername = socialProfiles?.linkedin?.username;
  let verified = false;

  if (prospect.platform === "twitter" && data) {
    const user = data.user as Record<string, unknown> | undefined;
    avatarUrl = (user?.profile_image_url_https as string) || undefined;
    displayName = displayName || (user?.name as string) || undefined;
    twitterUsername =
      twitterUsername || (user?.screen_name as string) || undefined;
    const vt = user?.verified_type;
    const verifiedByType =
      typeof vt === "string" && vt.length > 0 && vt !== "none";
    verified = Boolean(user?.verified) || verifiedByType;
    profileUrl = twitterUsername
      ? `https://x.com/${twitterUsername}`
      : undefined;
  } else if (prospect.platform === "linkedin" && data) {
    const author = data.author as Record<string, unknown> | undefined;
    avatarUrl = (author?.profilePictureURL as string) || undefined;
    displayName = displayName || (author?.name as string) || undefined;
    profileUrl = (author?.url as string) || profileUrl;
    linkedinUsername =
      linkedinUsername ||
      (typeof author?.username === "string" ? author.username : undefined);
  }

  twitterUsername = twitterUsername || extractTwitterUsername(profileUrl || "");
  linkedinUsername =
    linkedinUsername || extractLinkedInUsername(profileUrl || "");

  const conversationPlaceholderLabel =
    prospect.platform === "twitter"
      ? twitterUsername
        ? `@${twitterUsername}`
        : displayName || "this person/org"
      : linkedinUsername || displayName || "this person/org";

  return {
    avatarUrl,
    displayName: displayName || "Unknown",
    profileUrl,
    twitterUsername,
    linkedinUsername,
    verified,
    title: prospect.title,
    prospectType: prospect.prospectType,
    conversationPlaceholderLabel,
  };
}
