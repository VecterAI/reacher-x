"use node";

import { api, internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import type { ToolContext } from "./helpers";
import type {
  TwitterPostRef,
  TwitterPostSummary,
} from "../../../../shared/lib/twitter/contracts";
import {
  buildTwitterPostUrl,
  summarizeTwitterPost,
} from "../../../../shared/lib/twitter/contracts";
import {
  normalizeTwitterUrlEntities,
  selectProfileWebsiteHref,
  type TwitterUrlEntity,
} from "../../../../shared/lib/twitter/profileLinks";
import { resolveProspectTwitterIdentity } from "../../../../shared/lib/twitter/prospectTwitterIdentity";
import { extractLinkedInUsername } from "../../../../shared/lib/utils/url/socialProfiles";
import {
  buildRelationshipDisplay,
  mapSocialApiProfile,
} from "../../../lib/socialApiTwitterMap";
import { acquireSocialApiBudget } from "../../../lib/socialApiBudget";
import { hydrateTwitterProfileLinkMetadata } from "../../../lib/twitterProfileLinkResolver";
import type { LinkedInProfilePost } from "../../../integrations/linkedin/getProfilePosts";

export type SocialContextMode =
  | "prospect_profile"
  | "platform_profile"
  | "posts"
  | "thread"
  | "activity_summary";

export type SocialDisplayEntity =
  | "prospect_profile"
  | "twitter_profile"
  | "linkedin_profile"
  | "post"
  | "post_list"
  | "thread";

export type SocialContextPlatform = "auto" | "twitter" | "linkedin";

export type SocialContextSelection =
  | "latest"
  | "oldest"
  | "best_for_reply"
  | "discovery";

type ProspectPipelineStage =
  | "new"
  | "contacted"
  | "in_progress"
  | "converted"
  | "archived";

export type SocialThreadResult = {
  rootPostId?: string;
  posts: NormalizedSocialPost[];
  hasMoreReplies?: boolean;
};

export type ProspectSummary = {
  id: string;
  workspaceId: string;
  displayName: string;
  title?: string;
  briefIntro?: string;
  platform: "twitter" | "linkedin";
  prospectType?: "individual" | "organization" | "unknown";
  status?: ProspectPipelineStage;
  pipelineStage?: ProspectPipelineStage;
  stageTimestamps?: Partial<Record<ProspectPipelineStage, number>>;
  qualifiedAt?: number;
  readyAt?: number;
  createdAt?: number;
  verified: boolean;
  avatarUrl?: string;
  profileUrl?: string;
  twitterUsername?: string;
  linkedinUsername?: string;
  company?: string;
  websiteUrl?: string;
  websiteHref?: string;
  websiteDisplayText?: string;
  bioUrlEntities?: TwitterUrlEntity[];
  location?: string;
  updatedAt?: number;
};

export type GenericProspectProfile = ProspectSummary & {
  kind: "prospect";
  socialProfiles?: {
    twitter?: {
      username?: string;
      profileUrl?: string;
    };
    linkedin?: {
      username?: string;
      profileUrl?: string;
    };
  };
};

export type TwitterProfileSummary = {
  kind: "twitter";
  username: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
  bannerUrl?: string;
  profileUrl?: string;
  verified: boolean;
  bio?: string;
  location?: string;
  websiteUrl?: string;
  followersCount?: number;
  followingCount?: number;
  tweetCount?: number;
  joinedAt?: string;
  relationshipMessage?: string;
  relationshipBadge?: "none" | "you_following" | "follows_you" | "mutual";
  relationshipPrimaryAction?: "follow" | "unfollow";
  relationshipPrimaryLabel?: "Follow" | "Unfollow";
};

export type LinkedInProfileSummary = {
  kind: "linkedin";
  username?: string;
  firstName?: string;
  displayName: string;
  avatarUrl?: string;
  profilePictureUrl?: string;
  bannerUrl?: string;
  backgroundImageUrl?: string;
  profileUrl?: string;
  headline?: string;
  summary?: string;
  location?: string;
  followerCount?: number;
  connectionCount?: number;
  isPremium?: boolean;
  currentCompanyName?: string;
  currentCompanyLogo?: string;
  currentCompanyWebsite?: string;
  contact?: {
    websites?: Array<{ url: string; category?: string }>;
  };
  positions?: Array<{
    companyName: string;
    companyLogo?: string;
    isCurrent?: boolean;
  }>;
  currentCompany?: {
    name: string;
    website?: string;
    logoUrl?: string;
  };
};

export type NormalizedSocialProfile =
  | GenericProspectProfile
  | TwitterProfileSummary
  | LinkedInProfileSummary;

export type NormalizedSocialPost = {
  id: string;
  platform: "twitter" | "linkedin";
  createdAt: number;
  textPreview: string;
  url?: string;
  metrics?: {
    reactions?: number;
    comments?: number;
    reposts?: number;
    quotes?: number;
    views?: number;
  };
  isReply?: boolean;
  author?: {
    id?: string;
    handle?: string;
    name?: string;
    avatarUrl?: string;
    profileUrl?: string;
    headline?: string;
  };
  ref?: TwitterPostRef;
  summary?: TwitterPostSummary;
  rawData: unknown;
};

export type SocialContextSelectionResult = {
  requested?: SocialContextSelection;
  matchedPostIds: string[];
  rationale?: string;
};

export type SocialContextActivitySummary = {
  lastPostAt?: number;
  postCountInRange: number;
  hasFreshPost: boolean;
};

export type ResolvedSocialContext = {
  prospect: ProspectSummary;
  resolvedPlatform: "twitter" | "linkedin";
  profile?: NormalizedSocialProfile;
  posts: NormalizedSocialPost[];
  thread?: SocialThreadResult;
  activitySummary?: SocialContextActivitySummary;
  selection?: SocialContextSelectionResult;
};

type ResolveSocialContextArgs = {
  mode: SocialContextMode;
  platform?: SocialContextPlatform;
  selection?: SocialContextSelection;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  includeReplies?: boolean;
  postId?: string;
  query?: string;
};

type ProspectDoc = Record<string, unknown> & {
  _id: string;
  workspaceId: string;
  platform: "twitter" | "linkedin";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asPipelineStage(value: unknown): ProspectPipelineStage | undefined {
  return value === "new" ||
    value === "contacted" ||
    value === "in_progress" ||
    value === "converted" ||
    value === "archived"
    ? value
    : undefined;
}

function asStageTimestamps(
  value: unknown
): Partial<Record<ProspectPipelineStage, number>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const stageTimestamps: Partial<Record<ProspectPipelineStage, number>> = {};
  for (const stage of [
    "new",
    "contacted",
    "in_progress",
    "converted",
    "archived",
  ] as const) {
    const timestamp = asNumber(value[stage]);
    if (timestamp !== undefined) {
      stageTimestamps[stage] = timestamp;
    }
  }

  return Object.keys(stageTimestamps).length > 0 ? stageTimestamps : undefined;
}

function toTimestampMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function truncateText(value: string, maxLength = 280): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function parseDateBoundary(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getMetricsCount(
  metrics: NormalizedSocialPost["metrics"],
  key: keyof NonNullable<NormalizedSocialPost["metrics"]>
): number {
  return metrics?.[key] ?? 0;
}

function resolveProspectSummary(prospect: ProspectDoc): ProspectSummary {
  const data = isRecord(prospect.data) ? prospect.data : undefined;
  const socialProfiles = isRecord(prospect.socialProfiles)
    ? (prospect.socialProfiles as Record<string, unknown>)
    : undefined;
  const twitterSocial = isRecord(socialProfiles?.twitter)
    ? (socialProfiles?.twitter as Record<string, unknown>)
    : undefined;
  const linkedinSocial = isRecord(socialProfiles?.linkedin)
    ? (socialProfiles?.linkedin as Record<string, unknown>)
    : undefined;

  if (prospect.platform === "twitter") {
    const user = isRecord(data?.user)
      ? (data?.user as Record<string, unknown>)
      : undefined;
    const username =
      asString(twitterSocial?.username) ?? asString(user?.screen_name);
    const profileUrl = username ? `https://x.com/${username}` : undefined;
    const verifiedType = asString(user?.verified_type);
    return {
      id: prospect._id,
      workspaceId: prospect.workspaceId,
      displayName:
        asString(prospect.displayName) ??
        asString(user?.name) ??
        asString(prospect.title) ??
        "Unknown",
      title: asString(prospect.title),
      briefIntro: asString(prospect.briefIntro),
      platform: "twitter",
      prospectType:
        (asString(prospect.prospectType) as
          | "individual"
          | "organization"
          | "unknown"
          | undefined) ?? "unknown",
      status: asPipelineStage(prospect.status),
      pipelineStage: asPipelineStage(prospect.pipelineStage),
      stageTimestamps: asStageTimestamps(prospect.stageTimestamps),
      qualifiedAt: asNumber(prospect.qualifiedAt),
      readyAt: asNumber(prospect.readyAt),
      createdAt: asNumber(prospect._creationTime),
      verified:
        Boolean(user?.verified) ||
        (typeof verifiedType === "string" &&
          verifiedType.length > 0 &&
          verifiedType !== "none"),
      avatarUrl: asString(user?.profile_image_url_https),
      profileUrl,
      twitterUsername: username,
      company: asString(prospect.company),
      websiteUrl: asString(prospect.websiteUrl),
      websiteHref: selectProfileWebsiteHref(
        asString(prospect.websiteHref),
        asString(prospect.websiteUrl)
      ),
      websiteDisplayText: asString(prospect.websiteDisplayText),
      bioUrlEntities: normalizeTwitterUrlEntities(prospect.bioUrlEntities),
      location: asString(prospect.location) ?? asString(user?.location),
      updatedAt:
        asNumber(prospect.updatedAt) ?? asNumber(prospect._creationTime),
    };
  }

  const author = isRecord(data?.author)
    ? (data?.author as Record<string, unknown>)
    : undefined;
  const profileUrl =
    asString(linkedinSocial?.url) ??
    asString(author?.url) ??
    asString(prospect.profileUrl);
  const linkedinUsername =
    asString(linkedinSocial?.username) ??
    extractLinkedInUsername(profileUrl ?? "");

  return {
    id: prospect._id,
    workspaceId: prospect.workspaceId,
    displayName:
      asString(prospect.displayName) ??
      asString(author?.name) ??
      asString(prospect.title) ??
      "Unknown",
    title: asString(prospect.title),
    briefIntro: asString(prospect.briefIntro),
    platform: "linkedin",
    prospectType:
      (asString(prospect.prospectType) as
        | "individual"
        | "organization"
        | "unknown"
        | undefined) ?? "unknown",
    status: asPipelineStage(prospect.status),
    pipelineStage: asPipelineStage(prospect.pipelineStage),
    stageTimestamps: asStageTimestamps(prospect.stageTimestamps),
    qualifiedAt: asNumber(prospect.qualifiedAt),
    readyAt: asNumber(prospect.readyAt),
    createdAt: asNumber(prospect._creationTime),
    verified: false,
    avatarUrl: asString(author?.profilePictureURL),
    profileUrl,
    linkedinUsername,
    company: asString(prospect.company),
    websiteUrl: asString(prospect.websiteUrl),
    websiteHref: selectProfileWebsiteHref(
      asString(prospect.websiteHref),
      asString(prospect.websiteUrl)
    ),
    websiteDisplayText: asString(prospect.websiteDisplayText),
    bioUrlEntities: normalizeTwitterUrlEntities(prospect.bioUrlEntities),
    location: asString(prospect.location),
    updatedAt: asNumber(prospect.updatedAt) ?? asNumber(prospect._creationTime),
  };
}

function toGenericProspectProfile(
  prospect: ProspectDoc,
  summary: ProspectSummary
): GenericProspectProfile {
  const socialProfiles = isRecord(prospect.socialProfiles)
    ? (prospect.socialProfiles as Record<string, unknown>)
    : undefined;
  const twitterSocial = isRecord(socialProfiles?.twitter)
    ? (socialProfiles?.twitter as Record<string, unknown>)
    : undefined;
  const linkedinSocial = isRecord(socialProfiles?.linkedin)
    ? (socialProfiles?.linkedin as Record<string, unknown>)
    : undefined;

  return {
    kind: "prospect",
    ...summary,
    socialProfiles: {
      twitter:
        summary.twitterUsername || asString(twitterSocial?.url)
          ? {
              username:
                summary.twitterUsername ?? asString(twitterSocial?.username),
              profileUrl: summary.twitterUsername
                ? `https://x.com/${summary.twitterUsername}`
                : asString(twitterSocial?.url),
            }
          : undefined,
      linkedin:
        summary.linkedinUsername || asString(linkedinSocial?.url)
          ? {
              username:
                summary.linkedinUsername ?? asString(linkedinSocial?.username),
              profileUrl: asString(linkedinSocial?.url) ?? summary.profileUrl,
            }
          : undefined,
    },
  };
}

function normalizeTwitterPost(post: unknown): NormalizedSocialPost | null {
  const summary = summarizeTwitterPost(post);
  if (!summary?.ref.postId) {
    return null;
  }

  return {
    id: summary.ref.postId,
    platform: "twitter",
    createdAt: summary.createdAt ?? 0,
    textPreview: summary.textPreview,
    url:
      summary.url ||
      buildTwitterPostUrl({
        postId: summary.ref.postId,
        authorHandle: summary.author?.handle,
      }),
    metrics: summary.metrics
      ? {
          reactions: summary.metrics.likes,
          comments: summary.metrics.replies,
          reposts: summary.metrics.reposts,
          quotes: summary.metrics.quotes,
          views: summary.metrics.views,
        }
      : undefined,
    isReply: Boolean(summary.inReplyToPostId),
    author: summary.author
      ? {
          id: summary.author.id,
          handle: summary.author.handle,
          name: summary.author.name,
          avatarUrl: summary.author.avatarUrl,
          profileUrl: summary.author.profileUrl,
        }
      : undefined,
    ref: summary.ref,
    summary,
    rawData: post,
  };
}

function normalizeLinkedInPost(post: unknown): NormalizedSocialPost | null {
  if (!isRecord(post)) {
    return null;
  }

  const raw = isRecord(post.raw) ? post.raw : post;
  const author = isRecord(post.author)
    ? (post.author as Record<string, unknown>)
    : isRecord(raw.author)
      ? (raw.author as Record<string, unknown>)
      : undefined;
  const postId =
    asString(post.id) ??
    asString(post.urn) ??
    asString(raw.id) ??
    asString(raw.urn) ??
    asString(raw.postID);
  if (!postId) {
    return null;
  }

  const text =
    asString(post.text) ?? asString(raw.text) ?? asString(raw.comment) ?? "";
  const metricsRecord = isRecord(post.metrics)
    ? (post.metrics as Record<string, unknown>)
    : isRecord(raw.engagements)
      ? (raw.engagements as Record<string, unknown>)
      : undefined;

  return {
    id: postId,
    platform: "linkedin",
    createdAt:
      asNumber(post.createdAt) ??
      toTimestampMs(raw.postedAt) ??
      asNumber(raw.createdAt) ??
      0,
    textPreview: truncateText(text, 320),
    url: asString(post.url) ?? asString(raw.url),
    metrics: metricsRecord
      ? {
          reactions:
            asNumber(metricsRecord.reactions) ??
            asNumber(metricsRecord.totalReactions),
          comments:
            asNumber(metricsRecord.comments) ??
            asNumber(metricsRecord.commentsCount),
          reposts:
            asNumber(metricsRecord.reposts) ??
            asNumber(metricsRecord.repostsCount),
        }
      : undefined,
    author: author
      ? {
          id: asString(author.id),
          handle: asString(author.handle),
          name: asString(author.name),
          avatarUrl:
            asString(author.avatarUrl) ?? asString(author.profilePictureURL),
          profileUrl: asString(author.profileUrl) ?? asString(author.url),
          headline: asString(author.headline),
        }
      : undefined,
    rawData: post,
  };
}

function dedupePosts(posts: NormalizedSocialPost[]): NormalizedSocialPost[] {
  const seen = new Set<string>();
  const deduped: NormalizedSocialPost[] = [];
  for (const post of posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    deduped.push(post);
  }
  return deduped;
}

function sortPostsDescending(
  posts: NormalizedSocialPost[]
): NormalizedSocialPost[] {
  return [...posts].sort((a, b) => b.createdAt - a.createdAt);
}

function filterPostsByDateRange(
  posts: NormalizedSocialPost[],
  dateFrom?: string,
  dateTo?: string
): NormalizedSocialPost[] {
  const min = parseDateBoundary(dateFrom);
  const max = parseDateBoundary(dateTo);
  return posts.filter((post) => {
    if (min !== undefined && post.createdAt < min) return false;
    if (max !== undefined && post.createdAt > max) return false;
    return true;
  });
}

function buildSelectionResult(
  posts: NormalizedSocialPost[],
  requested?: SocialContextSelection
): SocialContextSelectionResult | undefined {
  if (!requested || posts.length === 0) {
    return undefined;
  }

  if (requested === "latest" || requested === "oldest") {
    return {
      requested,
      matchedPostIds: [posts[0].id],
      rationale:
        requested === "latest"
          ? "Selected the newest post by timestamp."
          : "Selected the oldest post by timestamp.",
    };
  }

  if (requested === "discovery") {
    return {
      requested,
      matchedPostIds: [posts[0].id],
      rationale: "Selected the original discovery/source post.",
    };
  }

  const selected = chooseBestReplyCandidate(posts);
  return {
    requested,
    matchedPostIds: selected ? [selected.id] : [],
    rationale: selected
      ? "Selected the strongest recent post for a natural reply based on recency, substance, and conversation potential."
      : "No strong reply candidate was found.",
  };
}

function chooseBestReplyCandidate(
  posts: NormalizedSocialPost[]
): NormalizedSocialPost | null {
  const engagementBaitPattern =
    /\b(looking for|who wants|drop your|reply below|comment below|repost|retweet to|follow for|giveaway)\b/i;

  let best: { post: NormalizedSocialPost; score: number } | null = null;
  for (const post of posts) {
    const reactions = getMetricsCount(post.metrics, "reactions");
    const comments = getMetricsCount(post.metrics, "comments");
    const reposts = getMetricsCount(post.metrics, "reposts");
    const ageHours =
      post.createdAt > 0
        ? Math.max(0, (Date.now() - post.createdAt) / (1000 * 60 * 60))
        : 999;
    const textLength = post.textPreview.trim().length;
    const hasSubstance = textLength >= 40 ? 1 : textLength >= 16 ? 0.5 : 0;
    const replyPenalty = post.isReply ? 1.5 : 0;
    const baitPenalty = engagementBaitPattern.test(post.textPreview) ? 2 : 0;
    const recencyScore =
      ageHours <= 12 ? 4 : ageHours <= 48 ? 3 : ageHours <= 168 ? 2 : 1;
    const conversationScore =
      recencyScore +
      hasSubstance * 3 +
      Math.min(comments, 10) * 0.3 +
      Math.min(reactions, 25) * 0.08 +
      Math.min(reposts, 10) * 0.05 -
      replyPenalty -
      baitPenalty;

    if (!best || conversationScore > best.score) {
      best = { post, score: conversationScore };
    }
  }

  return best?.post ?? null;
}

async function fetchSocialApiJson(
  ctx: ToolContext,
  consumer: string,
  path: string,
  params?: URLSearchParams
) {
  const apiKey = process.env.SOCIALAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SOCIALAPI_API_KEY is not set");
  }

  await acquireSocialApiBudget(ctx as any, consumer);
  const url = `https://api.socialapi.me${path}${params ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      body || `SocialAPI request failed with status ${response.status}`
    );
  }

  return await response.json();
}

function resolveLinkedInIdentity(prospect: ProspectDoc) {
  const socialProfiles = isRecord(prospect.socialProfiles)
    ? (prospect.socialProfiles as Record<string, unknown>)
    : undefined;
  const socialLinkedIn = isRecord(socialProfiles?.linkedin)
    ? (socialProfiles?.linkedin as Record<string, unknown>)
    : undefined;
  const data = isRecord(prospect.data) ? prospect.data : undefined;
  const author = isRecord(data?.author)
    ? (data.author as Record<string, unknown>)
    : undefined;
  const profileUrl =
    asString(socialLinkedIn?.url) ??
    asString(author?.url) ??
    asString(prospect.profileUrl);

  return {
    username:
      asString(socialLinkedIn?.username) ??
      (profileUrl ? extractLinkedInUsername(profileUrl) : undefined),
    providerId:
      asString(prospect.linkedinUserUrn) ??
      asString(socialLinkedIn?.urn) ??
      asString(author?.urn),
  };
}

async function fetchTwitterProfile(
  ctx: ToolContext,
  username: string
): Promise<TwitterProfileSummary> {
  try {
    const result = await ctx.runAction(api.socialapi.getTwitterProfileDisplay, {
      username,
    });
    const profile = result.profile as unknown as Record<string, unknown>;
    const entities = isRecord(profile.entities) ? profile.entities : null;
    const urlEntity = entities && isRecord(entities.url) ? entities.url : null;
    const urlEntries = Array.isArray(urlEntity?.urls) ? urlEntity.urls : [];
    const firstUrlEntry = isRecord(urlEntries[0]) ? urlEntries[0] : null;
    const profileUrl = `https://x.com/${result.username}`;

    return {
      kind: "twitter",
      username: result.username,
      userId: result.profileUserId,
      displayName: asString(profile.name) ?? result.username,
      avatarUrl: asString(profile.profile_image_url_https),
      bannerUrl:
        asString(profile.banner_url) ?? asString(profile.profile_banner_url),
      profileUrl,
      verified: Boolean(profile.verified),
      bio: asString(profile.description),
      location: asString(profile.location),
      websiteUrl:
        (firstUrlEntry ? asString(firstUrlEntry.expanded_url) : undefined) ??
        asString(profile.url),
      followersCount: asNumber(profile.followers_count),
      followingCount: asNumber(profile.friends_count),
      tweetCount: asNumber(profile.statuses_count),
      joinedAt: asString(profile.created_at),
      relationshipMessage: result.relationship.message,
      relationshipBadge: result.relationship.badge,
      relationshipPrimaryAction: result.relationship.primaryAction,
      relationshipPrimaryLabel: result.relationship.primaryLabel,
    };
  } catch {
    const rawProfile = await fetchSocialApiJson(
      ctx,
      "outreach.getSocialContext.twitterProfile",
      `/twitter/user/${username}`
    );
    const mappedProfile = mapSocialApiProfile(rawProfile);
    const profile = mappedProfile
      ? ((await hydrateTwitterProfileLinkMetadata(mappedProfile))
          .profile as unknown as Record<string, unknown>)
      : ({} as Record<string, unknown>);
    const entities = isRecord(profile.entities) ? profile.entities : null;
    const urlEntity = entities && isRecord(entities.url) ? entities.url : null;
    const urlEntries = Array.isArray(urlEntity?.urls) ? urlEntity.urls : [];
    const firstUrlEntry = isRecord(urlEntries[0]) ? urlEntries[0] : null;
    const resolvedUsername = asString(profile.username) ?? username;
    const profileUrl = `https://x.com/${resolvedUsername}`;
    const relationship = buildRelationshipDisplay({
      resolution: "requires_connection",
      viewerFollowsTarget: false,
      targetFollowsViewer: false,
    });

    return {
      kind: "twitter",
      username: resolvedUsername,
      userId: asString(profile.id_str),
      displayName: asString(profile.name) ?? resolvedUsername,
      avatarUrl: asString(profile.profile_image_url_https),
      bannerUrl:
        asString(profile.banner_url) ?? asString(profile.profile_banner_url),
      profileUrl,
      verified: Boolean(profile.verified),
      bio: asString(profile.description),
      location: asString(profile.location),
      websiteUrl:
        (firstUrlEntry ? asString(firstUrlEntry.expanded_url) : undefined) ??
        asString(profile.url),
      followersCount: asNumber(profile.followers_count),
      followingCount: asNumber(profile.friends_count),
      tweetCount: asNumber(profile.statuses_count),
      joinedAt: asString(profile.created_at),
      relationshipMessage: relationship.message,
      relationshipBadge: relationship.badge,
      relationshipPrimaryAction: relationship.primaryAction,
      relationshipPrimaryLabel: relationship.primaryLabel,
    };
  }
}

async function fetchTwitterPosts(args: {
  ctx: ToolContext;
  username: string;
  includeReplies: boolean;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<NormalizedSocialPost[]> {
  const modes: Array<"posts" | "replies"> = args.includeReplies
    ? ["posts", "replies"]
    : ["posts"];
  const collected: NormalizedSocialPost[] = [];

  for (const mode of modes) {
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < 2; pageIndex += 1) {
      const page = await args.ctx.runAction(
        api.socialapi.getHydratedTwitterTimelineFromSocialApi,
        {
          username: args.username,
          mode,
          cursor,
        }
      );

      for (const tweet of page.tweets) {
        const normalized = normalizeTwitterPost(tweet);
        if (normalized) {
          collected.push(normalized);
        }
      }

      cursor = page.nextCursor;
      if (!cursor) {
        break;
      }

      const filtered = filterPostsByDateRange(
        collected,
        args.dateFrom,
        args.dateTo
      );
      if (filtered.length >= args.limit * 2) {
        break;
      }
    }
  }

  return dedupePosts(sortPostsDescending(collected));
}

async function fetchTwitterPostById(
  ctx: ToolContext,
  postId: string
): Promise<NormalizedSocialPost | null> {
  const hydrated = await ctx.runAction(
    api.socialapi.getTwitterPostsByIdsFromSocialApi,
    {
      tweetIds: [postId],
    }
  );

  return (
    hydrated.tweets
      .map((tweet: unknown) => normalizeTwitterPost(tweet))
      .find(
        (tweet: NormalizedSocialPost | null): tweet is NormalizedSocialPost =>
          tweet?.id === postId
      ) ?? null
  );
}

async function fetchLinkedInProfile(
  ctx: ToolContext,
  prospect: ProspectDoc
): Promise<LinkedInProfileSummary | null> {
  try {
    const result = await ctx.runAction(api.linkedin.getLinkedInProfile, {
      prospectId: prospect._id as Id<"prospects">,
    });

    if (!result) {
      return null;
    }
    const currentPosition = result.positions.find(
      (position: (typeof result.positions)[number]) => position.isCurrent
    );
    const supplemental = await ctx
      .runAction(api.linkedin.getLinkedInProfileSupplemental, {
        prospectId: prospect._id as Id<"prospects">,
        profileUrn: result.urn,
        username: result.username,
        providerId: result.urn,
        currentCompanyId: currentPosition?.companyId,
        currentCompanyName:
          result.currentCompany?.name ?? currentPosition?.companyName,
      })
      .catch(() => null);
    const merged = {
      ...result,
      ...supplemental,
      contact: supplemental?.contact ?? result.contact,
      currentCompany: supplemental?.currentCompany ?? result.currentCompany,
      featuredPosts: supplemental?.featuredPosts ?? result.featuredPosts,
      positions: result.positions,
      recentPosts: result.recentPosts,
      recentPostsCursor: result.recentPostsCursor,
    };
    const mergedCurrentPosition = merged.positions.find(
      (position: (typeof merged.positions)[number]) => position.isCurrent
    );
    const currentCompany =
      merged.currentCompany ??
      (mergedCurrentPosition
        ? {
            name: mergedCurrentPosition.companyName,
            website: mergedCurrentPosition.companyUrl,
            logoUrl: mergedCurrentPosition.companyLogo,
          }
        : undefined);

    return {
      kind: "linkedin",
      username: merged.username,
      firstName: merged.firstName,
      displayName: merged.displayName,
      avatarUrl: merged.profilePictureUrl,
      profilePictureUrl: merged.profilePictureUrl,
      bannerUrl: merged.backgroundImageUrl,
      backgroundImageUrl: merged.backgroundImageUrl,
      profileUrl: merged.profileUrl,
      headline: merged.headline,
      summary: merged.summary,
      location: merged.location,
      followerCount: merged.followerCount,
      connectionCount: merged.connectionCount,
      isPremium: merged.isPremium,
      currentCompanyName: currentCompany?.name,
      currentCompanyLogo: currentCompany?.logoUrl,
      currentCompanyWebsite: currentCompany?.website,
      contact: merged.contact,
      positions: merged.positions.map(
        (position: (typeof merged.positions)[number]) => ({
          companyName: position.companyName,
          companyLogo: position.companyLogo,
          isCurrent: position.isCurrent,
        })
      ),
      currentCompany,
    };
  } catch {
    const identity = resolveLinkedInIdentity(prospect);
    if (!identity.username && !identity.providerId) {
      return null;
    }

    const result = await ctx.runAction(
      internal.integrations.linkedin.getProfile.getProfile,
      {
        username: identity.username,
        urn: identity.providerId,
        includeContactInfo: false,
      }
    );

    if (!result.success || !result.profile) {
      return null;
    }

    const profile = result.profile;
    const currentPosition =
      profile.fullPositions.find(
        (position: { end?: { year?: number | null } | null }) =>
          !position.end?.year
      ) ??
      profile.position.find(
        (position: { end?: { year?: number | null } | null }) =>
          !position.end?.year
      );

    return {
      kind: "linkedin",
      username: profile.username,
      displayName: `${profile.firstName} ${profile.lastName}`.trim(),
      avatarUrl: profile.profilePicture,
      profileUrl: identity.username
        ? `https://linkedin.com/in/${identity.username}`
        : undefined,
      headline: profile.headline,
      summary: profile.summary,
      location: profile.geo?.full,
      currentCompanyName: currentPosition?.companyName,
    };
  }
}

async function fetchLinkedInPosts(
  ctx: ToolContext,
  prospect: ProspectDoc
): Promise<NormalizedSocialPost[]> {
  try {
    const result = await ctx.runAction(api.linkedin.getLinkedInProfile, {
      prospectId: prospect._id as Id<"prospects">,
    });

    if (!result) {
      return [];
    }

    return dedupePosts(
      sortPostsDescending(
        result.recentPosts
          .map((post: unknown) => normalizeLinkedInPost(post))
          .filter(
            (post: NormalizedSocialPost | null): post is NormalizedSocialPost =>
              post !== null
          )
      )
    );
  } catch {
    const identity = resolveLinkedInIdentity(prospect);
    if (!identity.providerId) {
      return [];
    }

    const result = await ctx.runAction(
      internal.integrations.linkedin.getProfilePosts.getProfilePostsInternal,
      {
        urn: identity.providerId,
        maxPosts: 20,
      }
    );

    return dedupePosts(
      sortPostsDescending(
        result.posts
          .map((post: LinkedInProfilePost) =>
            normalizeLinkedInPost({
              id: post.urn,
              url: post.url,
              text: post.text,
              createdAt: post.postedAt,
              author: {
                name: post.author?.name,
                headline: post.author?.headline,
                profilePictureURL: post.author?.profilePictureURL,
                url: post.author?.url,
                urn: post.author?.urn,
              },
              metrics: {
                reactions: post.engagements?.totalReactions,
                comments: post.engagements?.commentsCount,
                reposts: post.engagements?.repostsCount,
              },
              raw: post,
            })
          )
          .filter(
            (post: NormalizedSocialPost | null): post is NormalizedSocialPost =>
              post !== null
          )
      )
    );
  }
}

async function fetchTwitterThread(
  ctx: ToolContext,
  postId: string
): Promise<SocialThreadResult> {
  const thread = await ctx.runAction(api.socialapi.getConversationContext, {
    rootTweetId: postId,
  });

  return {
    rootPostId: thread.rootTweetId,
    posts: dedupePosts(
      sortPostsDescending(
        thread.tweets
          .map((tweet: unknown) => normalizeTwitterPost(tweet))
          .filter(
            (
              tweet: NormalizedSocialPost | null
            ): tweet is NormalizedSocialPost => tweet !== null
          )
      )
    ),
    hasMoreReplies: thread.hasMoreReplies,
  };
}

async function fetchLinkedInThread(args: {
  ctx: ToolContext;
  prospectId: Id<"prospects">;
  postId?: string;
  fallbackPostData?: unknown;
}): Promise<SocialThreadResult> {
  const thread = await args.ctx.runAction(
    api.linkedin.getLinkedInPostThreadContext,
    {
      prospectId: args.prospectId,
      postId: args.postId,
      postData: args.fallbackPostData,
    }
  );

  const posts = [normalizeLinkedInPost(thread.resolvedPost)].filter(
    (post): post is NormalizedSocialPost => post !== null
  );

  return {
    rootPostId: thread.resolvedPostId,
    posts,
  };
}

function buildActivitySummary(
  posts: NormalizedSocialPost[]
): SocialContextActivitySummary {
  const latest = posts.length > 0 ? sortPostsDescending(posts)[0] : undefined;
  const lastPostAt = latest?.createdAt;
  const hasFreshPost =
    typeof lastPostAt === "number" &&
    lastPostAt > 0 &&
    Date.now() - lastPostAt < 24 * 60 * 60 * 1000;

  return {
    lastPostAt,
    postCountInRange: posts.length,
    hasFreshPost,
  };
}

function applySelection(
  posts: NormalizedSocialPost[],
  prospect: ProspectDoc,
  selection?: SocialContextSelection
): {
  posts: NormalizedSocialPost[];
  selectionResult?: SocialContextSelectionResult;
} {
  if (!selection || posts.length === 0) {
    return { posts };
  }

  if (selection === "latest") {
    const sorted = sortPostsDescending(posts);
    return {
      posts: sorted.slice(0, 1),
      selectionResult: buildSelectionResult(sorted.slice(0, 1), selection),
    };
  }

  if (selection === "oldest") {
    const sorted = [...posts].sort((a, b) => a.createdAt - b.createdAt);
    return {
      posts: sorted.slice(0, 1),
      selectionResult: buildSelectionResult(sorted.slice(0, 1), selection),
    };
  }

  if (selection === "discovery") {
    const discoveryPost =
      prospect.platform === "twitter"
        ? normalizeTwitterPost(prospect.data)
        : normalizeLinkedInPost(prospect.data);
    const selectedPosts = discoveryPost ? [discoveryPost] : posts.slice(0, 1);
    return {
      posts: selectedPosts,
      selectionResult: buildSelectionResult(selectedPosts, selection),
    };
  }

  const best = chooseBestReplyCandidate(posts);
  return {
    posts: best ? [best] : [],
    selectionResult: buildSelectionResult(best ? [best] : [], selection),
  };
}

export async function resolveSocialContext(
  ctx: ToolContext,
  args: ResolveSocialContextArgs
): Promise<ResolvedSocialContext> {
  const threadContext = await ctx.runQuery(
    internal.prospectThreads.getThreadProspectContext,
    {
      threadId: ctx.threadId!,
    }
  );

  if (!threadContext?.prospectId) {
    throw new Error(
      "Could not determine prospect. Please call this from a prospect thread."
    );
  }

  const prospect = (await ctx.runQuery(internal.prospects.getProspectInternal, {
    prospectId: threadContext.prospectId,
  })) as ProspectDoc | null;

  if (!prospect) {
    throw new Error("Prospect not found");
  }

  const prospectSummary = resolveProspectSummary(prospect);
  const resolvedPlatform =
    args.platform && args.platform !== "auto"
      ? args.platform
      : prospectSummary.platform;
  const limit = Math.min(20, Math.max(1, args.limit ?? 5));
  const includeReplies = args.includeReplies ?? true;

  let profile: NormalizedSocialProfile | undefined;
  let posts: NormalizedSocialPost[] = [];
  let thread: SocialThreadResult | undefined;

  if (args.mode === "prospect_profile") {
    profile = toGenericProspectProfile(prospect, prospectSummary);
  }

  if (
    args.mode === "platform_profile" ||
    args.mode === "posts" ||
    args.mode === "activity_summary" ||
    args.mode === "thread"
  ) {
    if (resolvedPlatform === "twitter") {
      const twitterIdentity = resolveProspectTwitterIdentity(prospect);
      if (!twitterIdentity.username) {
        throw new Error("This prospect does not have a Twitter username.");
      }

      if (args.mode === "platform_profile") {
        profile = await fetchTwitterProfile(ctx, twitterIdentity.username);
      }

      if (
        args.mode === "posts" ||
        args.mode === "activity_summary" ||
        args.mode === "thread"
      ) {
        posts = await fetchTwitterPosts({
          ctx,
          username: twitterIdentity.username,
          includeReplies,
          limit,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        });
      }

      if (args.mode === "thread") {
        const rootPostId = args.postId ?? posts[0]?.id;
        if (!rootPostId) {
          throw new Error("A postId is required to load a thread.");
        }
        thread = await fetchTwitterThread(ctx, rootPostId);
      }
    } else {
      if (args.mode === "platform_profile") {
        profile = (await fetchLinkedInProfile(ctx, prospect)) ?? undefined;
      }

      if (
        args.mode === "posts" ||
        args.mode === "activity_summary" ||
        args.mode === "thread"
      ) {
        posts = await fetchLinkedInPosts(ctx, prospect);
      }

      if (args.mode === "thread") {
        thread = await fetchLinkedInThread({
          ctx,
          prospectId: threadContext.prospectId as Id<"prospects">,
          postId: args.postId ?? posts[0]?.id,
          fallbackPostData: posts[0]?.rawData,
        });
      }
    }
  }

  const filteredPosts = filterPostsByDateRange(
    posts,
    args.dateFrom,
    args.dateTo
  );
  let selectedPosts: {
    posts: NormalizedSocialPost[];
    selectionResult?: SocialContextSelectionResult;
  };

  if (args.mode === "posts" && args.postId) {
    let requestedPosts = filteredPosts.filter(
      (post) => post.id === args.postId
    );

    if (requestedPosts.length === 0 && resolvedPlatform === "twitter") {
      const hydratedPost = await fetchTwitterPostById(ctx, args.postId);
      requestedPosts = hydratedPost
        ? filterPostsByDateRange([hydratedPost], args.dateFrom, args.dateTo)
        : [];
    }

    if (requestedPosts.length === 0) {
      throw new Error(
        `Could not find requested ${resolvedPlatform} post ${args.postId}.`
      );
    }

    selectedPosts = {
      posts: requestedPosts,
      selectionResult: {
        requested: args.selection,
        matchedPostIds: requestedPosts.map((post) => post.id),
        rationale: "Selected the explicitly requested post.",
      },
    };
  } else {
    selectedPosts =
      args.mode === "posts"
        ? applySelection(filteredPosts, prospect, args.selection)
        : { posts: filteredPosts, selectionResult: undefined };
  }

  if (args.mode === "posts") {
    posts = selectedPosts.posts.slice(0, limit);
  } else {
    posts = filteredPosts.slice(0, limit);
  }

  const activitySummary =
    args.mode === "posts" || args.mode === "activity_summary"
      ? buildActivitySummary(filteredPosts)
      : undefined;

  return {
    prospect: prospectSummary,
    resolvedPlatform,
    profile,
    posts,
    thread,
    activitySummary,
    selection: selectedPosts.selectionResult,
  };
}
