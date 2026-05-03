import { summarizeTwitterPost } from "../../shared/lib/twitter/contracts";
import { extractLinkedInUsername } from "../../shared/lib/utils/url/socialProfiles";
import { normalizeLinkedInMediaType } from "../../shared/lib/linkedin/media";

type ProspectPlatform = "twitter" | "linkedin";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asTimestampMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }
  return undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  const next = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
  return next as T;
}

function compactArray<T>(value: Array<T | null | undefined>): T[] {
  return value.filter((entry): entry is T => entry !== null && entry !== undefined);
}

function sanitizeTwitterUserForWorkflow(
  value: unknown
): Record<string, unknown> | undefined {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return undefined;
  }

  return compactObject({
    id_str: asString(record.id_str) ?? asString(record.id),
    name: asString(record.name),
    screen_name: asString(record.screen_name) ?? asString(record.handle),
    description: asString(record.description) ?? asString(record.bio),
    location: asString(record.location),
    url: asString(record.url) ?? asString(record.profileUrl),
    followers_count: asNumber(record.followers_count),
    friends_count: asNumber(record.friends_count),
    created_at: asString(record.created_at),
    verified: asBoolean(record.verified),
    verified_type: asString(record.verified_type),
    profile_image_url_https:
      asString(record.profile_image_url_https) ?? asString(record.avatarUrl),
    profile_banner_url: asString(record.profile_banner_url),
  });
}

function sanitizeLinkedInAuthorForWorkflow(
  value: unknown
): Record<string, unknown> | undefined {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return undefined;
  }

  return compactObject({
    name:
      (asString(record.name) ??
        [asString(record.firstName), asString(record.lastName)]
          .filter(Boolean)
          .join(" ")
          .trim()) ||
      undefined,
    headline: asString(record.headline),
    urn: asString(record.urn),
    id: asString(record.id),
    url: asString(record.url) ?? asString(record.profileUrl),
    profilePictureURL:
      asString(record.profilePictureURL) ?? asString(record.avatarUrl),
  });
}

function sanitizeTwitterPostForWorkflow(
  value: unknown
): Record<string, unknown> | null {
  const summary = summarizeTwitterPost(value);
  if (!summary) {
    return null;
  }

  return compactObject({
    platform: "twitter",
    ref: summary.ref,
    textPreview: summary.textPreview,
    url: summary.url,
    createdAt: summary.createdAt,
    author: summary.author,
    metrics: summary.metrics,
    media: summary.media,
    inReplyToPostId: summary.inReplyToPostId,
    inReplyToHandle: summary.inReplyToHandle,
    quotePostId: summary.quotePostId,
    lang: summary.lang,
    source: summary.source,
  });
}

function sanitizeLinkedInPostForWorkflow(
  value: unknown
): Record<string, unknown> | null {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return null;
  }

  const author = isRecord(record.author) ? record.author : null;
  const postedAt = isRecord(record.postedAt) ? record.postedAt : null;
  const engagements = isRecord(record.engagements) ? record.engagements : null;
  const metrics = isRecord(record.metrics) ? record.metrics : null;
  const postId =
    asString(record.id) ?? asString(record.postID) ?? asString(record.urn);
  const text = asString(record.text);
  const postUrl = asString(record.url) ?? asString(record.postURL);
  const authorUrl = asString(author?.url);

  if (!postId || !text) {
    return null;
  }

  const createdAt =
    asTimestampMs(record.createdAt) ?? asTimestampMs(postedAt?.timestamp) ?? 0;

  const media = compactArray(
    (Array.isArray(record.media)
      ? record.media
      : Array.isArray(record.mediaContent)
        ? record.mediaContent
        : []
    ).map((item) => {
      const mediaRecord = isRecord(item) ? item : null;
      if (!mediaRecord) {
        return null;
      }

      const rawType = asString(mediaRecord.type);
      const url = asString(mediaRecord.url);
      const normalizedType = normalizeLinkedInMediaType(rawType, url);
      if (!normalizedType || !url) {
        return null;
      }

      return compactObject({
        type: normalizedType,
        url,
        posterUrl: asString(mediaRecord.posterUrl),
        title: asString(mediaRecord.title),
        description: asString(mediaRecord.description),
        faviconUrl: asString(mediaRecord.faviconUrl),
      });
    })
  );

  return compactObject({
    id: postId,
    platform: "linkedin",
    url: asString(record.url) ?? asString(record.postURL),
    author: compactObject({
      name:
        (asString(author?.name) ??
          [asString(author?.firstName), asString(author?.lastName)]
            .filter(Boolean)
            .join(" ")
            .trim()) ||
        undefined,
      handle:
        (postUrl ? extractLinkedInUsername(postUrl) : undefined) ??
        (authorUrl ? extractLinkedInUsername(authorUrl) : undefined),
      avatarUrl:
        asString(author?.avatarUrl) ?? asString(author?.profilePictureURL),
      profileUrl: asString(author?.profileUrl) ?? asString(author?.url),
      headline: asString(author?.headline),
      id: asString(author?.id),
    }),
    text,
    createdAt,
    metrics: compactObject({
      reactions:
        asNumber(metrics?.reactions) ?? asNumber(engagements?.totalReactions),
      comments:
        asNumber(metrics?.comments) ?? asNumber(engagements?.commentsCount),
      reposts:
        asNumber(metrics?.reposts) ?? asNumber(engagements?.repostsCount),
      quotes: asNumber(metrics?.quotes),
      views: asNumber(metrics?.views),
    }),
    media: media.length > 0 ? media : undefined,
  });
}

export function sanitizeTwitterProfileForWorkflow(
  value: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = sanitizeTwitterUserForWorkflow(value);
  return sanitized ?? {};
}

export function sanitizeLinkedInProfileForWorkflow(
  value: Record<string, unknown>
): Record<string, unknown> {
  const geo = isRecord(value.geo) ? value.geo : null;
  const positions = Array.isArray(value.position) ? value.position : [];
  const profileUrl = asString(value.url);
  const usernameFromUrl = profileUrl
    ? extractLinkedInUsername(profileUrl)
    : undefined;
  const sanitizedPositions = compactArray(
    positions.slice(0, 3).map((item) => {
      const position = isRecord(item) ? item : null;
      if (!position) {
        return null;
      }
      const companyName = asString(position.companyName);
      if (!companyName) {
        return null;
      }
      return { companyName };
    })
  );

  return compactObject({
    urn: asString(value.urn),
    id: asString(value.id),
    username: asString(value.username) ?? asString(value.publicIdentifier) ?? usernameFromUrl,
    publicIdentifier: asString(value.publicIdentifier),
    linkedinUrl: asString(value.linkedinUrl) ?? profileUrl,
    url: profileUrl,
    firstName: asString(value.firstName),
    lastName: asString(value.lastName),
    name:
      (asString(value.name) ??
        [asString(value.firstName), asString(value.lastName)]
          .filter(Boolean)
          .join(" ")
          .trim()) ||
      undefined,
    headline: asString(value.headline),
    summary: asString(value.summary),
    description: asString(value.description),
    website: asString(value.website),
    profilePictureURL:
      asString(value.profilePictureURL) ?? asString(value.avatarUrl),
    geo:
      geo && asString(geo.full)
        ? {
            full: asString(geo.full),
          }
        : undefined,
    position: sanitizedPositions.length > 0 ? sanitizedPositions : undefined,
  });
}

export function sanitizeLinkedInContactInfoForWorkflow(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  const websites = Array.isArray(value.websites) ? value.websites : [];

  return compactObject({
    emailAddress: asString(value.emailAddress),
    websites:
      websites.length > 0
        ? compactArray(
            websites.slice(0, 3).map((item) => {
              const website = isRecord(item) ? item : null;
              const url = asString(website?.url);
              return url ? { url } : null;
            })
          )
        : undefined,
  });
}

export function sanitizeLinkedInCompanyDataForWorkflow(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  const fundingData = isRecord(value.fundingData) ? value.fundingData : null;
  const lastFundingRound = isRecord(fundingData?.lastFundingRound)
    ? fundingData?.lastFundingRound
    : null;
  const moneyRaised = isRecord(lastFundingRound?.moneyRaised)
    ? lastFundingRound?.moneyRaised
    : null;
  const headquarter = isRecord(value.headquarter) ? value.headquarter : null;

  return compactObject({
    linkedinUrl: asString(value.linkedinUrl),
    name: asString(value.name),
    website: asString(value.website),
    description: asString(value.description),
    headquarter:
      headquarter &&
      (asString(headquarter.city) || asString(headquarter.country))
        ? compactObject({
            city: asString(headquarter.city),
            country: asString(headquarter.country),
          })
        : undefined,
    fundingData:
      lastFundingRound && moneyRaised
        ? {
            lastFundingRound: compactObject({
              fundingType: asString(lastFundingRound.fundingType),
              moneyRaised: compactObject({
                amount: asString(moneyRaised.amount),
                currencyCode: asString(moneyRaised.currencyCode),
              }),
            }),
          }
        : undefined,
  });
}

export function sanitizeProspectDataForWorkflow(
  data: unknown,
  platform: ProspectPlatform
): Record<string, unknown> {
  const record = isRecord(data) ? data : {};

  if (platform === "twitter") {
    const user = isRecord(record.user) ? record.user : undefined;
    const author = isRecord(record.author) ? record.author : undefined;
    const baseProfile = sanitizeTwitterProfileForWorkflow(user ?? author ?? record);

    return compactObject({
      ...baseProfile,
      user: user ? sanitizeTwitterProfileForWorkflow(user) : undefined,
      author: author ? sanitizeTwitterProfileForWorkflow(author) : undefined,
    });
  }

  const author = isRecord(record.author) ? record.author : undefined;
  const baseProfile = sanitizeLinkedInProfileForWorkflow(record);

  return compactObject({
    ...baseProfile,
    author: author ? sanitizeLinkedInAuthorForWorkflow(author) : undefined,
  });
}

export function sanitizeProspectEvidencePostsForWorkflow(
  posts: unknown[] | undefined,
  platform: ProspectPlatform
): Array<Record<string, unknown>> {
  const list = Array.isArray(posts) ? posts : [];

  return compactArray(
    list.map((post) =>
      platform === "twitter"
        ? sanitizeTwitterPostForWorkflow(post)
        : sanitizeLinkedInPostForWorkflow(post)
    )
  );
}

export function getWorkflowEvidencePostId(
  post: Record<string, unknown>
): string | undefined {
  if (
    post.platform === "twitter" &&
    isRecord(post.ref) &&
    typeof post.ref.postId === "string"
  ) {
    return post.ref.postId;
  }

  return asString(post.id_str) ?? asString(post.postID) ?? asString(post.id);
}

export function getWorkflowEvidencePostText(
  post: Record<string, unknown>
): string {
  return (
    asString(post.full_text) ??
    asString(post.text) ??
    asString(post.textPreview) ??
    ""
  );
}

export function getWorkflowEvidencePostUrl(
  post: Record<string, unknown>
): string | undefined {
  return asString(post.postURL) ?? asString(post.url);
}

export function getWorkflowEvidencePostCreatedAt(
  post: Record<string, unknown>
): string | undefined {
  const postedAt = isRecord(post.postedAt) ? post.postedAt : null;
  const timestamp =
    asTimestampMs(post.tweet_created_at) ??
    asTimestampMs(post.created_at) ??
    asTimestampMs(post.createdAt) ??
    asTimestampMs(postedAt?.timestamp);

  return timestamp ? new Date(timestamp).toISOString() : undefined;
}

export function getWorkflowEvidencePostLikeCount(
  post: Record<string, unknown>
): number {
  const metrics = isRecord(post.metrics) ? post.metrics : null;
  const engagements = isRecord(post.engagements) ? post.engagements : null;

  return (
    asNumber(post.favorite_count) ??
    asNumber(metrics?.likes) ??
    asNumber(metrics?.reactions) ??
    asNumber(engagements?.totalReactions) ??
    0
  );
}

export function getWorkflowEvidencePostRepostCount(
  post: Record<string, unknown>
): number {
  const metrics = isRecord(post.metrics) ? post.metrics : null;
  const engagements = isRecord(post.engagements) ? post.engagements : null;

  return (
    asNumber(post.retweet_count) ??
    asNumber(metrics?.reposts) ??
    asNumber(engagements?.repostsCount) ??
    0
  );
}
