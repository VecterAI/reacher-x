import type {
  Entities,
  Media,
  Tweet,
  User,
} from "../../features/threads/types";

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
  "receives_your_dm",
  "url",
  "username",
  "verified",
  "verified_type",
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

function getXAppBearerToken(): string {
  const value = process.env.X_API_BEARER_TOKEN?.trim();
  if (!value) {
    throw new Error("X_API_BEARER_TOKEN is not set in the Convex environment.");
  }
  return value;
}

type XLookupContext = {
  users: Map<string, Record<string, unknown>>;
  media: Map<string, Record<string, unknown>>;
  posts: Map<string, Record<string, unknown>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedRecord(
  source: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> | undefined {
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) {
      return value;
    }
  }
  return undefined;
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

function getResponsePosts(response: Record<string, unknown>) {
  if (Array.isArray(response.data)) {
    return response.data as Record<string, unknown>[];
  }
  return isRecord(response.data)
    ? [response.data as Record<string, unknown>]
    : [];
}

function buildLookupContext(response: Record<string, unknown>): XLookupContext {
  const includes = isRecord(response.includes) ? response.includes : {};
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
    ...getResponsePosts(response),
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

function toEntityIndices(value: Record<string, unknown>): [number, number] {
  const start = asNumber(value.start) ?? 0;
  const end = asNumber(value.end) ?? start;
  return [start, end];
}

function isXUserVerified(user: Record<string, unknown>): boolean {
  if (user.verified === true) {
    return true;
  }
  const verifiedType = asString(user.verified_type);
  return Boolean(verifiedType && verifiedType !== "none");
}

function mapXUserToLegacyUser(
  user?: Record<string, unknown>
): User | undefined {
  if (!user) {
    return undefined;
  }

  const publicMetrics =
    getNestedRecord(user, "publicMetrics", "public_metrics") ?? {};
  const username =
    asString(user.username) ??
    asString(user.screenName) ??
    asString(user.handle);

  return {
    id: toLegacyNumberId(user.id) ?? 0,
    id_str: asString(user.id) ?? "",
    name: asString(user.name) ?? username ?? "Unknown",
    screen_name: username ?? "unknown",
    location: asString(user.location),
    url: asString(user.url),
    description: asString(user.description),
    protected: Boolean(user.protected),
    verified: isXUserVerified(user),
    followers_count:
      asNumber(publicMetrics.followersCount) ??
      asNumber(publicMetrics.followers_count) ??
      0,
    friends_count:
      asNumber(publicMetrics.followingCount) ??
      asNumber(publicMetrics.following_count) ??
      0,
    listed_count:
      asNumber(publicMetrics.listedCount) ??
      asNumber(publicMetrics.listed_count) ??
      0,
    favourites_count: 0,
    statuses_count:
      asNumber(publicMetrics.tweetCount) ??
      asNumber(publicMetrics.tweet_count) ??
      0,
    created_at: asString(user.createdAt) ?? asString(user.created_at) ?? "",
    profile_banner_url:
      asString(user.profileBannerUrl) ??
      asString(user.profile_banner_url) ??
      undefined,
    profile_image_url_https:
      asString(user.profileImageUrl) ?? asString(user.profile_image_url) ?? "",
    can_dm: Boolean(
      user.receivesYourDm ?? user.receives_your_dm ?? user.canDm ?? user.can_dm
    ),
  };
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
  const noteTweet = getNestedRecord(post, "noteTweet", "note_tweet");
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
  const publicMetrics =
    getNestedRecord(post, "publicMetrics", "public_metrics") ?? {};
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
    quote_count:
      asNumber(publicMetrics.quoteCount) ??
      asNumber(publicMetrics.quote_count) ??
      0,
    reply_count:
      asNumber(publicMetrics.replyCount) ??
      asNumber(publicMetrics.reply_count) ??
      0,
    retweet_count:
      asNumber(publicMetrics.retweetCount) ??
      asNumber(publicMetrics.retweet_count) ??
      0,
    favorite_count:
      asNumber(publicMetrics.likeCount) ??
      asNumber(publicMetrics.like_count) ??
      0,
    views_count:
      asNumber(publicMetrics.impressionCount) ??
      asNumber(publicMetrics.impression_count) ??
      asNumber(post.viewCount) ??
      asNumber(post.views) ??
      0,
    bookmark_count:
      asNumber(publicMetrics.bookmarkCount) ??
      asNumber(publicMetrics.bookmark_count) ??
      asNumber(post.bookmarkCount) ??
      0,
    lang: asString(post.lang),
    entities: mapXEntitiesToLegacyEntities(post, lookups),
    is_pinned: false,
  };
}

function mapPostsResponseToLegacyTweets(response: Record<string, unknown>) {
  const lookups = buildLookupContext(response);
  return getResponsePosts(response).map((post) =>
    mapXPostToLegacyTweet(post, lookups)
  );
}

function buildXHydrationParams() {
  const params = new URLSearchParams();
  params.set("tweet.fields", X_POST_FIELDS.join(","));
  params.set("user.fields", X_USER_FIELDS.join(","));
  params.set("media.fields", X_MEDIA_FIELDS.join(","));
  params.set("expansions", X_POST_EXPANSIONS.join(","));
  return params;
}

async function fetchXAppJson(path: string, params?: URLSearchParams) {
  const response = await fetch(
    `https://api.x.com${path}${params ? `?${params.toString()}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${getXAppBearerToken()}`,
        Accept: "application/json",
      },
    }
  );

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `X API request failed (${response.status} ${response.statusText})`
    );
  }

  return payload;
}

export function normalizePublicTweetIds(tweetIds: string[]): string[] {
  const deduped = new Set<string>();

  for (const rawTweetId of tweetIds) {
    const tweetId = rawTweetId.trim();
    if (!tweetId || deduped.has(tweetId)) {
      continue;
    }

    deduped.add(tweetId);
    if (deduped.size === 100) {
      break;
    }
  }

  return [...deduped];
}

export async function fetchPublicTweetsFromXApi(
  tweetIds: string[]
): Promise<Tweet[]> {
  const normalizedIds = normalizePublicTweetIds(tweetIds);
  if (normalizedIds.length === 0) {
    return [];
  }

  const params = buildXHydrationParams();
  params.set("ids", normalizedIds.join(","));

  const response = await fetchXAppJson("/2/tweets", params);
  const tweetsById = new Map(
    mapPostsResponseToLegacyTweets(response).map((tweet) => [
      tweet.id_str,
      tweet,
    ])
  );

  return normalizedIds.flatMap((tweetId) => {
    const tweet = tweetsById.get(tweetId);
    return tweet ? [tweet] : [];
  });
}
