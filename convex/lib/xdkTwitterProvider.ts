"use node";

import { Buffer } from "node:buffer";
import { ApiError, type Client } from "@xdevplatform/xdk";
import type { CuratedTwitterActionKey } from "./twitterActionCatalog";
import type {
  Entities,
  Media,
  Tweet,
  User,
} from "../../features/threads/types";
import type {
  HydratedTwitterConversationPayload,
  HydratedTwitterProfile,
  TwitterTimelineMode,
} from "../../shared/lib/twitter/hydration";

export type TwitterActionFailureClass =
  | "reauth_required"
  | "scope_missing"
  | "duplicate_content"
  | "rate_limited"
  | "transient_network"
  | "api_policy_forbidden"
  | "content_too_long"
  | "target_not_found"
  | "unknown_error";

export interface TwitterActionFailure {
  classification: TwitterActionFailureClass;
  message: string;
  retryable: boolean;
  suggestion?: string;
  code?: number;
  details?: unknown;
}

export interface XProviderContext {
  client: Client;
  xUserId: string;
  username?: string;
  connectedAccountId?: string;
}

export interface TwitterActionExecutionResult {
  success: true;
  actionKey: CuratedTwitterActionKey;
  toolSlug: string;
  toolVersion: string;
  result: unknown;
  createdTweetId?: string;
  postedText?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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

function toLegacyNumberId(value: unknown): number | undefined {
  const parsed = asNumber(value);
  return typeof parsed === "number" ? parsed : undefined;
}

function getNextToken(meta: any): string | undefined {
  return meta?.nextToken ?? meta?.next_token ?? meta?.paginationToken;
}

const X_POST_FIELDS = [
  "author_id",
  "conversation_id",
  "created_at",
  "entities",
  "in_reply_to_user_id",
  "lang",
  "note_tweet",
  "public_metrics",
  "source",
  "referenced_tweets",
] as const;

const X_POST_EXPANSIONS = [
  "attachments.media_keys",
  "author_id",
  "in_reply_to_user_id",
  "referenced_tweets.id",
] as const;

const X_USER_FIELDS = [
  "created_at",
  "description",
  "entities",
  "location",
  "name",
  "profile_banner_url",
  "profile_image_url",
  "protected",
  "public_metrics",
  "url",
  "username",
  "verified",
] as const;

const X_MEDIA_FIELDS = [
  "alt_text",
  "duration_ms",
  "height",
  "media_key",
  "preview_image_url",
  "type",
  "url",
  "variants",
  "width",
] as const;

const DEFAULT_TIMELINE_PAGE_SIZE = 10;
const MAX_TIMELINE_SCAN_PAGES = 6;
const MAX_CONVERSATION_PAGES = 5;
const TIMELINE_FETCH_PAGE_SIZE = 100;
const CONVERSATION_FETCH_PAGE_SIZE = 100;

type TimelineCursorState = {
  rawPageToken?: string;
  offset: number;
};

type XLookupContext = {
  users: Map<string, Record<string, unknown>>;
  media: Map<string, Record<string, unknown>>;
  posts: Map<string, Record<string, unknown>>;
};

function encodeTimelineCursor(state: TimelineCursorState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodeTimelineCursor(cursor?: string): TimelineCursorState {
  if (!cursor) {
    return { offset: 0 };
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as TimelineCursorState;
    return {
      rawPageToken: asString(decoded.rawPageToken),
      offset:
        typeof decoded.offset === "number" && decoded.offset >= 0
          ? decoded.offset
          : 0,
    };
  } catch {
    return { offset: 0 };
  }
}

function buildLookupContext(response: any): XLookupContext {
  const includes = isRecord(response?.includes) ? response.includes : {};
  const users = new Map<string, Record<string, unknown>>();
  const media = new Map<string, Record<string, unknown>>();
  const posts = new Map<string, Record<string, unknown>>();

  for (const user of asArray<Record<string, unknown>>(includes.users)) {
    const id = asString(user.id);
    if (id) {
      users.set(id, user);
    }
  }

  for (const item of asArray<Record<string, unknown>>(includes.media)) {
    const mediaKey = asString(item.mediaKey) ?? asString(item.media_key);
    if (mediaKey) {
      media.set(mediaKey, item);
    }
  }

  for (const post of [
    ...asArray<Record<string, unknown>>(response?.data),
    ...asArray<Record<string, unknown>>(includes.posts),
    ...asArray<Record<string, unknown>>(includes.tweets),
  ]) {
    const id = asString(post.id);
    if (id) {
      posts.set(id, post);
    }
  }

  return { users, media, posts };
}

function mapProfileUrlEntity(value: unknown): {
  url: string;
  expanded_url: string;
  display_url: string;
  indices: [number, number];
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const url = asString(value.url);
  const expandedUrl =
    asString(value.expandedUrl) ?? asString(value.expanded_url);
  const displayUrl = asString(value.displayUrl) ?? asString(value.display_url);
  const start = asNumber(value.start) ?? 0;
  const end = asNumber(value.end) ?? start;

  if (!url || !expandedUrl || !displayUrl) {
    return null;
  }

  return {
    url,
    expanded_url: expandedUrl,
    display_url: displayUrl,
    indices: [start, end],
  };
}

function mapUserEntities(
  user: Record<string, unknown>
): HydratedTwitterProfile["entities"] {
  const entities = isRecord(user.entities) ? user.entities : undefined;
  if (!entities) {
    return undefined;
  }

  const descriptionUrls = asArray(
    isRecord(entities.description)
      ? entities.description.urls
      : entities.descriptionUrls
  )
    .map(mapProfileUrlEntity)
    .filter((value): value is NonNullable<typeof value> => value !== null);
  const urlUrls = asArray(
    isRecord(entities.url) ? entities.url.urls : entities.urlUrls
  )
    .map(mapProfileUrlEntity)
    .filter((value): value is NonNullable<typeof value> => value !== null);

  if (descriptionUrls.length === 0 && urlUrls.length === 0) {
    return undefined;
  }

  return {
    description:
      descriptionUrls.length > 0 ? { urls: descriptionUrls } : undefined,
    url: urlUrls.length > 0 ? { urls: urlUrls } : undefined,
  };
}

function mapXUserToLegacyProfile(
  user: Record<string, unknown>
): HydratedTwitterProfile {
  const publicMetrics = isRecord(user.publicMetrics) ? user.publicMetrics : {};
  const username =
    asString(user.username) ??
    asString(user.screenName) ??
    asString(user.handle);

  return {
    id: toLegacyNumberId(user.id) ?? 0,
    id_str: asString(user.id) ?? "",
    name: asString(user.name) ?? username ?? "Unknown",
    screen_name: username ?? "unknown",
    username,
    location: asString(user.location),
    url: asString(user.url),
    description: asString(user.description),
    protected: Boolean(user.protected),
    verified: Boolean(user.verified),
    followers_count: asNumber(publicMetrics.followersCount) ?? 0,
    friends_count: asNumber(publicMetrics.followingCount) ?? 0,
    listed_count: asNumber(publicMetrics.listedCount) ?? 0,
    favourites_count: 0,
    statuses_count: asNumber(publicMetrics.tweetCount) ?? 0,
    created_at: asString(user.createdAt) ?? "",
    profile_banner_url:
      asString(user.profileBannerUrl) ?? asString(user.profile_banner_url),
    banner_url:
      asString(user.profileBannerUrl) ?? asString(user.profile_banner_url),
    profile_image_url_https:
      asString(user.profileImageUrl) ?? asString(user.profile_image_url) ?? "",
    can_dm: false,
    entities: mapUserEntities(user),
  };
}

function mapXUserToLegacyUser(
  user?: Record<string, unknown>
): User | undefined {
  return user ? mapXUserToLegacyProfile(user) : undefined;
}

function mapXMediaToLegacyMedia(value: Record<string, unknown>): Media | null {
  const type = asString(value.type);
  const mediaUrl =
    asString(value.url) ??
    asString(value.previewImageUrl) ??
    asString(value.preview_image_url);
  if (!type || !mediaUrl) {
    return null;
  }

  const width = asNumber(value.width);
  const height = asNumber(value.height);
  const previewUrl =
    asString(value.previewImageUrl) ?? asString(value.preview_image_url);
  const variants = asArray<Record<string, unknown>>(value.variants).map(
    (variant) => ({
      content_type:
        asString(variant.contentType) ??
        asString(variant.content_type) ??
        "application/octet-stream",
      url: asString(variant.url) ?? "",
      bitrate: asNumber(variant.bitrate),
    })
  );

  return {
    media_key: asString(value.mediaKey) ?? asString(value.media_key),
    media_url_https: mediaUrl,
    type,
    url: mediaUrl,
    display_url: previewUrl ?? mediaUrl,
    expanded_url: previewUrl ?? mediaUrl,
    ext_alt_text: asString(value.altText) ?? asString(value.alt_text),
    original_info:
      typeof width === "number" && typeof height === "number"
        ? {
            width,
            height,
            focus_rects: [],
          }
        : undefined,
    video_info:
      variants.length > 0
        ? {
            aspect_ratio:
              typeof width === "number" && typeof height === "number"
                ? [width, height]
                : [1, 1],
            duration_millis:
              asNumber(value.durationMs) ?? asNumber(value.duration_ms),
            variants: variants.filter((variant) => Boolean(variant.url)),
          }
        : undefined,
  };
}

function toEntityIndices(value: Record<string, unknown>): [number, number] {
  const start = asNumber(value.start) ?? 0;
  const end = asNumber(value.end) ?? start;
  return [start, end];
}

function mapXEntitiesToLegacyEntities(
  post: Record<string, unknown>,
  lookups: XLookupContext
): Entities | undefined {
  const entities = isRecord(post.entities) ? post.entities : undefined;
  const mediaKeys = asArray<string>(
    isRecord(post.attachments)
      ? (post.attachments.mediaKeys ?? post.attachments.media_keys)
      : undefined
  );
  const media = mediaKeys
    .map((mediaKey) => lookups.media.get(mediaKey))
    .filter((value): value is Record<string, unknown> => Boolean(value))
    .map(mapXMediaToLegacyMedia)
    .filter((value): value is Media => value !== null);
  const urls = asArray<Record<string, unknown>>(entities?.urls)
    .map((urlEntity) => {
      const url = asString(urlEntity.url);
      const expandedUrl =
        asString(urlEntity.expandedUrl) ?? asString(urlEntity.expanded_url);
      const displayUrl =
        asString(urlEntity.displayUrl) ?? asString(urlEntity.display_url);
      if (!url || !expandedUrl || !displayUrl) {
        return null;
      }
      return {
        url,
        expanded_url: expandedUrl,
        display_url: displayUrl,
        indices: toEntityIndices(urlEntity),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);
  const mentions = asArray<Record<string, unknown>>(entities?.mentions).map(
    (mention) => ({
      id: toLegacyNumberId(mention.id),
      id_str: asString(mention.id) ?? "",
      name: asString(mention.name) ?? asString(mention.username) ?? "",
      screen_name: asString(mention.username) ?? "",
      indices: toEntityIndices(mention),
    })
  );
  const hashtags = asArray<Record<string, unknown>>(entities?.hashtags).map(
    (hashtag) => ({
      text: asString(hashtag.tag) ?? asString(hashtag.text) ?? "",
      indices: toEntityIndices(hashtag),
    })
  );
  const symbols = asArray<Record<string, unknown>>(entities?.cashtags).map(
    (cashtag) => ({
      text: asString(cashtag.tag) ?? asString(cashtag.text) ?? "",
      indices: toEntityIndices(cashtag),
    })
  );

  if (
    media.length === 0 &&
    urls.length === 0 &&
    mentions.length === 0 &&
    hashtags.length === 0 &&
    symbols.length === 0
  ) {
    return undefined;
  }

  return {
    media: media.length > 0 ? media : undefined,
    urls: urls.length > 0 ? urls : undefined,
    user_mentions: mentions.length > 0 ? mentions : undefined,
    hashtags: hashtags.length > 0 ? hashtags : undefined,
    symbols: symbols.length > 0 ? symbols : undefined,
  };
}

function getPostText(post: Record<string, unknown>): string {
  const noteTweet = isRecord(post.noteTweet) ? post.noteTweet : undefined;
  return asString(noteTweet?.text) ?? asString(post.text) ?? "";
}

function getReferencedTweets(post: Record<string, unknown>) {
  return asArray<Record<string, unknown>>(
    post.referencedTweets ?? post.referenced_tweets
  );
}

function mapXPostToLegacyTweet(
  post: Record<string, unknown>,
  lookups: XLookupContext,
  seen: Set<string> = new Set()
): Tweet {
  const postId = asString(post.id) ?? "";
  const nextSeen = new Set(seen);
  if (postId) {
    nextSeen.add(postId);
  }

  const authorId = asString(post.authorId) ?? asString(post.author_id);
  const author = authorId ? lookups.users.get(authorId) : undefined;
  const referencedTweets = getReferencedTweets(post);
  const quotedRef = referencedTweets.find((item) => item.type === "quoted");
  const retweetedRef = referencedTweets.find(
    (item) => item.type === "retweeted"
  );
  const replyRef = referencedTweets.find((item) => item.type === "replied_to");
  const quotedPostId = asString(quotedRef?.id);
  const retweetedPostId = asString(retweetedRef?.id);
  const quotedPost =
    quotedPostId && !nextSeen.has(quotedPostId)
      ? lookups.posts.get(quotedPostId)
      : undefined;
  const retweetedPost =
    retweetedPostId && !nextSeen.has(retweetedPostId)
      ? lookups.posts.get(retweetedPostId)
      : undefined;
  const inReplyToUserId =
    asString(post.inReplyToUserId) ?? asString(post.in_reply_to_user_id);
  const replyUser = inReplyToUserId
    ? lookups.users.get(inReplyToUserId)
    : undefined;
  const publicMetrics = isRecord(post.publicMetrics) ? post.publicMetrics : {};
  const text = getPostText(post);

  return {
    tweet_created_at: asString(post.createdAt) ?? asString(post.created_at),
    id: toLegacyNumberId(post.id),
    id_str: postId || undefined,
    conversation_id_str:
      (asString(post.conversationId) ??
        asString(post.conversation_id) ??
        postId) ||
      undefined,
    text: text || null,
    full_text: text,
    source: asString(post.source),
    truncated: false,
    in_reply_to_status_id: toLegacyNumberId(replyRef?.id),
    in_reply_to_status_id_str: asString(replyRef?.id),
    in_reply_to_user_id: toLegacyNumberId(inReplyToUserId),
    in_reply_to_user_id_str: inReplyToUserId,
    in_reply_to_screen_name: asString(replyUser?.username),
    user: mapXUserToLegacyUser(author),
    quoted_status_id: toLegacyNumberId(quotedPostId),
    quoted_status_id_str: quotedPostId,
    is_quote_status: Boolean(quotedPostId),
    quoted_status: quotedPost
      ? mapXPostToLegacyTweet(quotedPost, lookups, nextSeen)
      : undefined,
    retweeted_status: retweetedPost
      ? mapXPostToLegacyTweet(retweetedPost, lookups, nextSeen)
      : undefined,
    quote_count: asNumber(publicMetrics.quoteCount) ?? 0,
    reply_count: asNumber(publicMetrics.replyCount) ?? 0,
    retweet_count: asNumber(publicMetrics.retweetCount) ?? 0,
    favorite_count: asNumber(publicMetrics.likeCount) ?? 0,
    views_count:
      asNumber(publicMetrics.impressionCount) ??
      asNumber(post.viewCount) ??
      asNumber(post.views) ??
      0,
    bookmark_count:
      asNumber(publicMetrics.bookmarkCount) ??
      asNumber(post.bookmarkCount) ??
      0,
    lang: asString(post.lang),
    entities: mapXEntitiesToLegacyEntities(post, lookups),
    is_pinned: false,
  };
}

function mapPostsResponseToLegacyTweets(response: any): Tweet[] {
  const lookups = buildLookupContext(response);
  return asArray<Record<string, unknown>>(response?.data).map((post) =>
    mapXPostToLegacyTweet(post, lookups)
  );
}

function isReplyPost(post: Record<string, unknown>): boolean {
  const referencedTweets = getReferencedTweets(post);
  return (
    referencedTweets.some((item) => item.type === "replied_to") ||
    Boolean(
      asString(post.inReplyToUserId) ?? asString(post.in_reply_to_user_id)
    )
  );
}

function isQuotePost(post: Record<string, unknown>): boolean {
  const referencedTweets = getReferencedTweets(post);
  return referencedTweets.some((item) => item.type === "quoted");
}

function isRetweetPost(post: Record<string, unknown>): boolean {
  const referencedTweets = getReferencedTweets(post);
  return referencedTweets.some((item) => item.type === "retweeted");
}

function matchesTimelineMode(
  post: Record<string, unknown>,
  mode: TwitterTimelineMode
): boolean {
  switch (mode) {
    case "posts":
      return !isReplyPost(post) && !isQuotePost(post) && !isRetweetPost(post);
    case "replies":
      return isReplyPost(post);
    case "quotes":
      return isQuotePost(post);
    default:
      return true;
  }
}

async function fetchTimelinePage(
  context: XProviderContext,
  userId: string,
  paginationToken?: string
) {
  return await context.client.users.getPosts(userId, {
    maxResults: TIMELINE_FETCH_PAGE_SIZE,
    paginationToken,
    tweetFields: [...X_POST_FIELDS],
    userFields: [...X_USER_FIELDS],
    mediaFields: [...X_MEDIA_FIELDS],
    expansions: [...X_POST_EXPANSIONS],
  });
}

async function fetchRecentConversationPage(
  context: XProviderContext,
  conversationId: string,
  nextToken?: string
) {
  return await context.client.posts.searchRecent(
    `conversation_id:${conversationId}`,
    {
      maxResults: CONVERSATION_FETCH_PAGE_SIZE,
      nextToken,
      tweetFields: [...X_POST_FIELDS],
      userFields: [...X_USER_FIELDS],
      mediaFields: [...X_MEDIA_FIELDS],
      expansions: [...X_POST_EXPANSIONS],
    }
  );
}

export async function getHydratedProfileByUsername(
  context: XProviderContext,
  username: string
): Promise<{
  profileUserId: string;
  profile: HydratedTwitterProfile;
}> {
  const response = await context.client.users.getByUsername(username, {
    userFields: [...X_USER_FIELDS],
    expansions: ["pinned_tweet_id"],
  });
  const user = isRecord(response.data) ? response.data : null;

  if (!user) {
    throw new Error(`Could not find @${username} on X.`);
  }

  return {
    profileUserId: asString(user.id) ?? "",
    profile: mapXUserToLegacyProfile(user),
  };
}

export async function getHydratedTimelinePage(
  context: XProviderContext,
  args: {
    userId: string;
    mode: TwitterTimelineMode;
    cursor?: string;
    maxResults?: number;
  }
): Promise<{
  tweets: Tweet[];
  nextCursor?: string;
}> {
  const limit = Math.max(
    1,
    Math.min(args.maxResults ?? DEFAULT_TIMELINE_PAGE_SIZE, 20)
  );
  let collected: Tweet[] = [];
  let pageState = decodeTimelineCursor(args.cursor);

  for (
    let pageIndex = 0;
    pageIndex < MAX_TIMELINE_SCAN_PAGES && collected.length < limit;
    pageIndex += 1
  ) {
    const response = await fetchTimelinePage(
      context,
      args.userId,
      pageState.rawPageToken
    );
    const rawPosts = asArray<Record<string, unknown>>(response.data).filter(
      (post) => matchesTimelineMode(post, args.mode)
    );
    const pageTweets = mapPostsResponseToLegacyTweets({
      ...response,
      data: rawPosts,
    });
    const remainingTweets = pageTweets.slice(pageState.offset);
    const nextRawToken = getNextToken(response.meta);
    const needed = limit - collected.length;

    if (remainingTweets.length > 0) {
      collected = collected.concat(remainingTweets.slice(0, needed));
      const consumedFromPage =
        pageState.offset + Math.min(remainingTweets.length, needed);

      if (collected.length >= limit) {
        if (consumedFromPage < pageTweets.length) {
          return {
            tweets: collected,
            nextCursor: encodeTimelineCursor({
              rawPageToken: pageState.rawPageToken,
              offset: consumedFromPage,
            }),
          };
        }

        return {
          tweets: collected,
          nextCursor: nextRawToken
            ? encodeTimelineCursor({ rawPageToken: nextRawToken, offset: 0 })
            : undefined,
        };
      }
    }

    if (!nextRawToken) {
      return { tweets: collected };
    }

    pageState = { rawPageToken: nextRawToken, offset: 0 };
  }

  return {
    tweets: collected,
    nextCursor:
      collected.length > 0 && pageState.rawPageToken
        ? encodeTimelineCursor(pageState)
        : undefined,
  };
}

export async function getHydratedPostsByIds(
  context: XProviderContext,
  postIds: string[]
): Promise<Tweet[]> {
  const uniquePostIds = Array.from(
    new Set(postIds.map((postId) => postId.trim()).filter(Boolean))
  );
  if (uniquePostIds.length === 0) {
    return [];
  }

  const response = await context.client.posts.getByIds(uniquePostIds, {
    tweetFields: [...X_POST_FIELDS],
    userFields: [...X_USER_FIELDS],
    mediaFields: [...X_MEDIA_FIELDS],
    expansions: [...X_POST_EXPANSIONS],
  });

  return mapPostsResponseToLegacyTweets(response);
}

export async function getHydratedPostById(
  context: XProviderContext,
  postId: string
): Promise<Tweet | null> {
  const tweets = await getHydratedPostsByIds(context, [postId]);
  return tweets.find((tweet) => tweet.id_str === postId) ?? tweets[0] ?? null;
}

export async function getHydratedConversationByThreadId(
  context: XProviderContext,
  threadId: string
): Promise<HydratedTwitterConversationPayload> {
  const seedTweet = await getHydratedPostById(context, threadId);
  const conversationId = seedTweet?.conversation_id_str ?? threadId;
  const tweetsById = new Map<string, Tweet>();

  if (seedTweet?.id_str) {
    tweetsById.set(seedTweet.id_str, seedTweet);
  }

  const rootTweet =
    conversationId !== threadId
      ? await getHydratedPostById(context, conversationId)
      : seedTweet;
  if (rootTweet?.id_str) {
    tweetsById.set(rootTweet.id_str, rootTweet);
  }

  let nextToken: string | undefined;
  for (let page = 0; page < MAX_CONVERSATION_PAGES; page += 1) {
    const response = await fetchRecentConversationPage(
      context,
      conversationId,
      nextToken
    );
    for (const tweet of mapPostsResponseToLegacyTweets(response)) {
      if (tweet.id_str) {
        tweetsById.set(tweet.id_str, tweet);
      }
    }

    nextToken = getNextToken(response.meta);
    if (!nextToken) {
      break;
    }
  }

  const tweets = Array.from(tweetsById.values()).sort((left, right) => {
    const leftTime = Date.parse(left.tweet_created_at ?? "") || 0;
    const rightTime = Date.parse(right.tweet_created_at ?? "") || 0;
    return leftTime - rightTime;
  });

  return {
    threadId,
    conversationId,
    tweets,
    fetchedAt: Date.now(),
  };
}

function pickMessageFromErrorData(data: unknown): string | undefined {
  if (typeof data === "string") {
    const trimmed = data.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const message = pickMessageFromErrorData(item);
      if (message) {
        return message;
      }
    }
    return undefined;
  }

  if (!isRecord(data)) {
    return undefined;
  }

  const directCandidates = [
    data.detail,
    data.message,
    data.title,
    data.error,
    data.error_description,
    data.description,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const nestedCandidates = [
    data.errors,
    data.problem,
    data.problems,
    data.data,
  ];
  for (const candidate of nestedCandidates) {
    const message = pickMessageFromErrorData(candidate);
    if (message) {
      return message;
    }
  }

  return undefined;
}

function pickErrorCode(error: ApiError): number | undefined {
  if (typeof error.status === "number") {
    return error.status;
  }
  return undefined;
}

function pickErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const apiMessage = pickMessageFromErrorData(error.data) ?? error.message;
    return typeof apiMessage === "string" && apiMessage.trim().length > 0
      ? apiMessage
      : error.message;
  }

  return error instanceof Error ? error.message : "Unknown X API error";
}

export function getXExecutionFailure(error: unknown): TwitterActionFailure {
  const message = pickErrorMessage(error);
  const normalized = message.toLowerCase();
  const code = error instanceof ApiError ? pickErrorCode(error) : undefined;
  const details = error instanceof ApiError ? error.data : undefined;

  if (code === 429 || normalized.includes("rate limit")) {
    return {
      classification: "rate_limited",
      message,
      retryable: true,
      code,
      details,
    };
  }

  if (
    code === 401 ||
    normalized.includes("unauthorized") ||
    normalized.includes("authentication")
  ) {
    return {
      classification: "reauth_required",
      message,
      retryable: false,
      code,
      details,
    };
  }

  if (
    normalized.includes("scope") ||
    normalized.includes("permission") ||
    normalized.includes("not permitted")
  ) {
    return {
      classification: "scope_missing",
      message,
      retryable: false,
      suggestion:
        "Reconnect your X account and approve the required permissions.",
      code,
      details,
    };
  }

  if (
    normalized.includes("duplicate") ||
    normalized.includes("already been posted")
  ) {
    return {
      classification: "duplicate_content",
      message,
      retryable: false,
      suggestion: "Edit the message before trying again.",
      code,
      details,
    };
  }

  if (
    normalized.includes("too long") ||
    normalized.includes("character") ||
    normalized.includes("280")
  ) {
    return {
      classification: "content_too_long",
      message,
      retryable: false,
      suggestion: "Shorten the content before retrying.",
      code,
      details,
    };
  }

  if (
    code === 403 ||
    normalized.includes("forbidden") ||
    normalized.includes("blocked")
  ) {
    return {
      classification: "api_policy_forbidden",
      message,
      retryable: false,
      code,
      details,
    };
  }

  if (code === 404 || normalized.includes("not found")) {
    return {
      classification: "target_not_found",
      message,
      retryable: false,
      code,
      details,
    };
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("temporarily unavailable")
  ) {
    return {
      classification: "transient_network",
      message,
      retryable: true,
      code,
      details,
    };
  }

  return {
    classification: "unknown_error",
    message,
    retryable: false,
    code,
    details,
  };
}

function extractId(result: any): string | undefined {
  return (
    result?.data?.id ?? result?.data?.tweetId ?? result?.data?.dmConversationId
  );
}

export async function getMe(context: XProviderContext) {
  return await context.client.users.getMe({
    userFields: ["id", "name", "username", "profile_image_url"],
  });
}

export async function createPost(
  context: XProviderContext,
  args: { text: string; mediaIds?: string[] }
) {
  return await context.client.posts.create({
    text: args.text,
    ...(args.mediaIds && args.mediaIds.length > 0
      ? { media: { mediaIds: args.mediaIds } }
      : {}),
  });
}

export async function replyToPost(
  context: XProviderContext,
  args: { postId: string; text: string; mediaIds?: string[] }
) {
  return await context.client.posts.create({
    text: args.text,
    reply: {
      inReplyToTweetId: args.postId,
    },
    ...(args.mediaIds && args.mediaIds.length > 0
      ? { media: { mediaIds: args.mediaIds } }
      : {}),
  });
}

export async function likePost(context: XProviderContext, postId: string) {
  return await context.client.users.likePost(context.xUserId, {
    body: { tweetId: postId },
  });
}

export async function unlikePost(context: XProviderContext, postId: string) {
  return await context.client.users.unlikePost(context.xUserId, postId);
}

export async function repostPost(context: XProviderContext, postId: string) {
  return await context.client.users.repostPost(context.xUserId, {
    body: { tweetId: postId },
  });
}

export async function unrepostPost(context: XProviderContext, postId: string) {
  return await context.client.users.unrepostPost(context.xUserId, postId);
}

export async function bookmarkPost(context: XProviderContext, postId: string) {
  return await context.client.users.createBookmark(context.xUserId, {
    tweetId: postId,
  });
}

export async function unbookmarkPost(
  context: XProviderContext,
  postId: string
) {
  return await context.client.users.deleteBookmark(context.xUserId, postId);
}

export async function followUser(
  context: XProviderContext,
  targetUserId: string
) {
  return await context.client.users.followUser(context.xUserId, {
    body: { targetUserId },
  });
}

export async function unfollowUser(
  context: XProviderContext,
  targetUserId: string
) {
  return await context.client.users.unfollowUser(context.xUserId, targetUserId);
}

export async function sendDmToParticipant(
  context: XProviderContext,
  participantId: string,
  text: string
) {
  return await context.client.directMessages.createByParticipantId(
    participantId,
    {
      body: { text },
    }
  );
}

export async function sendDmToConversation(
  context: XProviderContext,
  conversationId: string,
  text: string
) {
  return await context.client.directMessages.createByConversationId(
    conversationId,
    {
      body: { text },
    }
  );
}

export async function getDmEvents(
  context: XProviderContext,
  options?: { maxResults?: number; paginationToken?: string }
) {
  return await context.client.directMessages.getEvents({
    maxResults: options?.maxResults,
    paginationToken: options?.paginationToken,
    dmEventFields: [
      "id",
      "text",
      "created_at",
      "sender_id",
      "dm_conversation_id",
    ],
    userFields: ["id", "name", "username", "profile_image_url"],
  });
}

export async function getDmEventsByConversationId(
  context: XProviderContext,
  conversationId: string,
  options?: { maxResults?: number; paginationToken?: string }
) {
  return await context.client.directMessages.getEventsByConversationId(
    conversationId,
    {
      maxResults: options?.maxResults,
      paginationToken: options?.paginationToken,
      dmEventFields: [
        "id",
        "text",
        "created_at",
        "sender_id",
        "dm_conversation_id",
      ],
      userFields: ["id", "name", "username", "profile_image_url"],
    }
  );
}

export async function getLikedPosts(
  context: XProviderContext,
  options?: { maxResults?: number; paginationToken?: string }
) {
  return await context.client.users.getLikedPosts(context.xUserId, {
    maxResults: options?.maxResults,
    paginationToken: options?.paginationToken,
  });
}

export async function getBookmarks(
  context: XProviderContext,
  options?: { maxResults?: number; paginationToken?: string }
) {
  return await context.client.users.getBookmarks(context.xUserId, {
    maxResults: options?.maxResults,
    paginationToken: options?.paginationToken,
  });
}

export async function getFollowing(
  context: XProviderContext,
  options?: { maxResults?: number; paginationToken?: string }
) {
  return await context.client.users.getFollowing(context.xUserId, {
    maxResults: options?.maxResults,
    paginationToken: options?.paginationToken,
  });
}

export async function getRepostedBy(
  context: XProviderContext,
  postId: string,
  options?: { maxResults?: number; paginationToken?: string }
) {
  return await context.client.posts.getRepostedBy(postId, {
    maxResults: options?.maxResults,
    paginationToken: options?.paginationToken,
    userFields: ["id", "username"],
  });
}

export async function getPostsByIds(
  context: XProviderContext,
  postIds: string[]
) {
  return await context.client.posts.getByIds(postIds, {
    tweetFields: [
      "conversation_id",
      "author_id",
      "created_at",
      "public_metrics",
    ],
    userFields: ["id", "name", "username", "profile_image_url"],
    expansions: ["author_id"],
  });
}

export async function executeCuratedTwitterAction(
  context: XProviderContext,
  input: {
    actionKey: CuratedTwitterActionKey;
    toolSlug: string;
    toolVersion: string;
    tweetId?: string;
    targetUserId?: string;
    text?: string;
    conversationId?: string;
    mediaUrls?: string[];
  }
): Promise<TwitterActionExecutionResult> {
  switch (input.actionKey) {
    case "like_post":
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result: await likePost(context, input.tweetId!),
      };
    case "unlike_post":
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result: await unlikePost(context, input.tweetId!),
      };
    case "bookmark_post":
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result: await bookmarkPost(context, input.tweetId!),
      };
    case "unbookmark_post":
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result: await unbookmarkPost(context, input.tweetId!),
      };
    case "retweet_post":
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result: await repostPost(context, input.tweetId!),
      };
    case "unretweet_post":
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result: await unrepostPost(context, input.tweetId!),
      };
    case "follow_user":
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result: await followUser(context, input.targetUserId!),
      };
    case "unfollow_user":
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result: await unfollowUser(context, input.targetUserId!),
      };
    case "create_post": {
      if (input.mediaUrls && input.mediaUrls.length > 0) {
        throw new Error(
          "Media uploads are not yet enabled in the X SDK path. Remove attachments and try again."
        );
      }
      const result = await createPost(context, { text: input.text! });
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result,
        createdTweetId: extractId(result),
        postedText: input.text,
      };
    }
    case "reply_to_post": {
      if (input.mediaUrls && input.mediaUrls.length > 0) {
        throw new Error(
          "Media uploads are not yet enabled in the X SDK path. Remove attachments and try again."
        );
      }
      const result = await replyToPost(context, {
        postId: input.tweetId!,
        text: input.text!,
      });
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result,
        createdTweetId: extractId(result),
        postedText: input.text,
      };
    }
    case "send_dm": {
      const result = await sendDmToParticipant(
        context,
        input.targetUserId!,
        input.text!
      );
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result,
        createdTweetId: extractId(result),
        postedText: input.text,
      };
    }
    case "send_dm_in_existing_conversation": {
      const result = await sendDmToConversation(
        context,
        input.conversationId!,
        input.text!
      );
      return {
        success: true,
        actionKey: input.actionKey,
        toolSlug: input.toolSlug,
        toolVersion: input.toolVersion,
        result,
        createdTweetId: extractId(result),
        postedText: input.text,
      };
    }
    default:
      throw new Error(`Unsupported X action: ${input.actionKey}`);
  }
}
