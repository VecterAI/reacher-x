// convex/twitterSearch.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { logger } from "../shared/lib/logger";
import { searchTwitterArgsValidator } from "./validators";
import {
  QUERY_CHAR_LIMIT,
  normalizeQuery,
} from "../shared/lib/utils/queryLimit";
// @Web Best practice: keep all X API calls on the server; do not expose tokens to clients.
import type { Tweet, Entities, User, Media } from "../features/threads/types";

// Constants for API configuration
const TWITTER_API_BASE_URL =
  "https://api.twitterapi.io/twitter/tweet/advanced_search";
const MAX_QUERY_LENGTH = QUERY_CHAR_LIMIT; // 512 per X recent search docs
const REQUEST_TIMEOUT = 20000; // 20 seconds

/**
 * ROBUST TWITTER API TRANSFORMATION SYSTEM
 *
 * This transformation system is based on established patterns:
 * 1. Domain-Driven Design - Explicit mapping between external API and internal types
 * 2. Data Mapper Pattern - Separates API concerns from business logic
 * 3. Validation-First Approach - Ensures data integrity at transformation boundaries
 *
 * References:
 * - Martin Fowler's "Patterns of Enterprise Application Architecture"
 * - Clean Architecture by Robert Martin
 * - Twitter API v2 Documentation for field mappings
 */

// Twitter API response types (camelCase as provided by API)
interface TwitterApiUser {
  type: string;
  userName: string;
  url: string;
  twitterUrl: string;
  id: string;
  name: string;
  isVerified: boolean;
  isBlueVerified: boolean;
  verifiedType: string | null;
  profilePicture: string;
  coverPicture: string;
  description: string;
  location: string;
  followers: number;
  following: number;
  status: string;
  canDm: boolean;
  canMediaTag: boolean;
  createdAt: string;
  entities: {
    description: unknown;
    url: unknown;
  };
  fastFollowersCount: number;
  favouritesCount: number;
  hasCustomTimelines: boolean;
  isTranslator: boolean;
  mediaCount: number;
  statusesCount: number;
  withheldInCountries: string[];
  affiliatesHighlightedLabel: Record<string, unknown>;
  possiblySensitive: boolean;
  pinnedTweetIds: string[];
  profile_bio: {
    description: string;
    entities: unknown;
  };
  isAutomated: boolean;
  automatedBy: unknown;
}

interface TwitterApiTweet {
  type: string;
  id: string;
  url: string;
  twitterUrl: string;
  text: string;
  source: string;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount: number;
  createdAt: string;
  lang: string;
  bookmarkCount: number;
  isReply: boolean;
  inReplyToId: string | null;
  conversationId: string;
  inReplyToUserId: string | null;
  inReplyToUsername: string | null;
  author: TwitterApiUser;
  extendedEntities: Record<string, unknown>;
  card: unknown;
  place: Record<string, unknown>;
  entities: Entities;
  quoted_tweet: TwitterApiTweet | null;
  retweeted_tweet: TwitterApiTweet | null;
}

interface TwitterApiResponse {
  tweets: TwitterApiTweet[];
  has_next_page: boolean;
  next_cursor: string;
}

/**
 * Field mapping dictionary for explicit Twitter API to internal format conversion
 * This approach is more maintainable and debuggable than generic snake_case conversion
 */
const TWEET_FIELD_MAPPINGS = {
  // Core tweet fields
  id: (value: string) => parseInt(value, 10),
  id_str: (value: string) => value,
  text: (value: string) => value,
  full_text: (value: string) => value, // Use same as text for this API
  tweet_created_at: (value: string) => value,
  source: (value: string) => value,
  lang: (value: string) => value,

  // Engagement metrics - CRITICAL MAPPING
  retweet_count: (value: number) => value,
  reply_count: (value: number) => value,
  favorite_count: (value: number) => value, // API: likeCount -> Internal: favorite_count
  quote_count: (value: number) => value,
  views_count: (value: number) => value,
  bookmark_count: (value: number) => value,

  // Reply chain fields
  conversation_id_str: (value: string) => value,
  in_reply_to_status_id_str: (value: string | null) => value || undefined,
  in_reply_to_user_id_str: (value: string | null) => value || undefined,
  in_reply_to_screen_name: (value: string | null) => value || undefined,
} as const;

const USER_FIELD_MAPPINGS = {
  id: (value: string) => parseInt(value, 10),
  id_str: (value: string) => value,
  name: (value: string) => value,
  screen_name: (value: string) => value, // API: userName -> Internal: screen_name
  verified: (value: boolean) => value, // API: primary flag
  profile_image_url_https: (value: string) => value, // API: profilePicture
  protected: () => false, // Default value as API doesn't provide this
  followers_count: (value: number) => value, // API: followers
  friends_count: (value: number) => value, // API: following
  listed_count: () => 0, // Default value as API doesn't provide this
  favourites_count: (value: number) => value,
  statuses_count: (value: number) => value,
  created_at: (value: string) => value,
  can_dm: (value: boolean) => value,
} as const;

/**
 * Safely extract and transform user data
 * Follows defensive programming principles to handle missing or malformed data
 */
function transformUser(
  apiUser: TwitterApiUser | null | undefined
): User | undefined {
  if (!apiUser) return undefined;

  try {
    // Normalize verification across fields per twitterapi.io docs
    const isVerifiedAggregate = Boolean(
      apiUser.isVerified || apiUser.isBlueVerified || apiUser.verifiedType
    );
    return {
      id: USER_FIELD_MAPPINGS.id(apiUser.id),
      id_str: USER_FIELD_MAPPINGS.id_str(apiUser.id),
      name: USER_FIELD_MAPPINGS.name(apiUser.name),
      screen_name: USER_FIELD_MAPPINGS.screen_name(apiUser.userName),
      verified: USER_FIELD_MAPPINGS.verified(isVerifiedAggregate),
      profile_image_url_https: USER_FIELD_MAPPINGS.profile_image_url_https(
        apiUser.profilePicture
      ),
      protected: USER_FIELD_MAPPINGS.protected(),
      followers_count: USER_FIELD_MAPPINGS.followers_count(apiUser.followers),
      friends_count: USER_FIELD_MAPPINGS.friends_count(apiUser.following),
      listed_count: USER_FIELD_MAPPINGS.listed_count(),
      favourites_count: USER_FIELD_MAPPINGS.favourites_count(
        apiUser.favouritesCount
      ),
      statuses_count: USER_FIELD_MAPPINGS.statuses_count(apiUser.statusesCount),
      created_at: USER_FIELD_MAPPINGS.created_at(apiUser.createdAt),
      can_dm: USER_FIELD_MAPPINGS.can_dm(apiUser.canDm),
    };
  } catch (error) {
    logger.error("Error transforming user data:", error, apiUser);
    return undefined;
  }
}

/**
 * Transform a single tweet with comprehensive field mapping and validation
 * This function handles the core business logic of converting API responses to internal format
 */
// Add helper to infer visible text range based on entities
function inferDisplayTextRange(
  text: string | undefined,
  entities: Entities | undefined
): [number, number] | undefined {
  if (!text || typeof text !== "string") return undefined;

  const len = text.length;
  let start = 0;

  // Normalize mentions list
  const mentions = Array.isArray(entities?.user_mentions)
    ? entities!.user_mentions
        .slice()
        .sort((a, b) => a.indices[0] - b.indices[0])
    : [];

  // Advance start past leading mentions + surrounding whitespace
  if (mentions.length > 0) {
    let pos = 0;
    while (pos < len) {
      // Skip leading spaces/tabs
      while (pos < len && /[\t ]/.test(text[pos])) pos++;
      const next = mentions.find((m) => m.indices[0] === pos);
      if (!next) break;
      pos = next.indices[1];
      // Skip spaces/tabs after mention
      while (pos < len && /[\t ]/.test(text[pos])) pos++;
    }
    start = pos;
  } else {
    // Fallback regex when entities missing
    const m = text.match(/^(@[A-Za-z0-9_]+(?:[\t ]+|$))+?/);
    if (m) start = m[0].length;
  }

  // Determine trailing media t.co URL indices (pic.twitter.com)
  const mediaTcoIndices: Array<[number, number]> = Array.isArray(entities?.urls)
    ? entities!.urls
        .filter(
          (u) =>
            typeof u?.display_url === "string" &&
            /^pic\.twitter\.com\b/i.test(u.display_url)
        )
        .map((u) => u.indices)
        .sort((a, b) => b[1] - a[1])
    : [];

  // Trim trailing whitespace
  let trimmedEnd = len;
  while (trimmedEnd > start && /[\t \n\r]/.test(text[trimmedEnd - 1])) {
    trimmedEnd--;
  }

  // Remove trailing media URLs iteratively
  for (const [s, e] of mediaTcoIndices) {
    if (e === trimmedEnd) {
      trimmedEnd = s;
      while (trimmedEnd > start && /[\t \n\r]/.test(text[trimmedEnd - 1])) {
        trimmedEnd--;
      }
    } else if (e < trimmedEnd) {
      // Once we hit a URL that ends before current end, stop
      break;
    }
  }

  // Ensure bounds are sane
  if (start < 0) start = 0;
  if (trimmedEnd < start) trimmedEnd = start;
  if (trimmedEnd > len) trimmedEnd = len;

  return [start, trimmedEnd];
}

function transformTweet(apiTweet: TwitterApiTweet): Tweet {
  try {
    // Core tweet data transformation
    const baseTweet: Tweet = {
      id: TWEET_FIELD_MAPPINGS.id(apiTweet.id),
      id_str: TWEET_FIELD_MAPPINGS.id_str(apiTweet.id),
      text: TWEET_FIELD_MAPPINGS.text(apiTweet.text),
      full_text: TWEET_FIELD_MAPPINGS.full_text(apiTweet.text),
      tweet_created_at: TWEET_FIELD_MAPPINGS.tweet_created_at(
        apiTweet.createdAt
      ),
      source: TWEET_FIELD_MAPPINGS.source(apiTweet.source),
      lang: TWEET_FIELD_MAPPINGS.lang(apiTweet.lang),

      // Engagement metrics with proper field mapping
      retweet_count: TWEET_FIELD_MAPPINGS.retweet_count(apiTweet.retweetCount),
      reply_count: TWEET_FIELD_MAPPINGS.reply_count(apiTweet.replyCount),
      favorite_count: TWEET_FIELD_MAPPINGS.favorite_count(apiTweet.likeCount), // KEY FIX
      quote_count: TWEET_FIELD_MAPPINGS.quote_count(apiTweet.quoteCount),
      views_count: TWEET_FIELD_MAPPINGS.views_count(apiTweet.viewCount),
      bookmark_count: TWEET_FIELD_MAPPINGS.bookmark_count(
        apiTweet.bookmarkCount
      ),

      // Conversation and reply chain
      conversation_id_str: TWEET_FIELD_MAPPINGS.conversation_id_str(
        apiTweet.conversationId
      ),
      in_reply_to_status_id_str: TWEET_FIELD_MAPPINGS.in_reply_to_status_id_str(
        apiTweet.inReplyToId
      ),
      in_reply_to_user_id_str: TWEET_FIELD_MAPPINGS.in_reply_to_user_id_str(
        apiTweet.inReplyToUserId
      ),
      in_reply_to_screen_name: TWEET_FIELD_MAPPINGS.in_reply_to_screen_name(
        apiTweet.inReplyToUsername
      ),

      // User information
      user: transformUser(apiTweet.author),

      // Entities (preserve as-is since they're already in correct format)
      entities: apiTweet.entities || {},
    };

    // Within transformTweet after baseTweet creation
    const inferredRange = inferDisplayTextRange(
      baseTweet.full_text ?? baseTweet.text ?? undefined,
      baseTweet.entities
    );
    if (inferredRange) {
      baseTweet.display_text_range = inferredRange;
    }

    // Map extended media entities (photos/videos/gifs) when available
    const extMediaRaw = (apiTweet.extendedEntities as { media?: unknown })
      ?.media;
    const extendedMedia = Array.isArray(extMediaRaw)
      ? (extMediaRaw as Array<Record<string, unknown>>)
      : undefined;
    if (extendedMedia && extendedMedia.length > 0) {
      const media = extendedMedia
        .map((m) => {
          const mediaUrlHttpsMaybe =
            (m["media_url_https"] as string | undefined) ||
            (typeof m["media_url"] === "string"
              ? (m["media_url"] as string).replace(/^http:/, "https:")
              : undefined);

          if (!mediaUrlHttpsMaybe) return null;
          const mediaUrlHttps = mediaUrlHttpsMaybe as string;

          const ema = m["ext_media_availability"] as
            | Record<string, unknown>
            | undefined;
          const status =
            ema && typeof ema["status"] === "string"
              ? (ema["status"] as string)
              : undefined;

          const oiRaw = m["original_info"] as
            | Record<string, unknown>
            | undefined;
          const original_info =
            oiRaw &&
            typeof oiRaw["height"] === "number" &&
            typeof oiRaw["width"] === "number"
              ? {
                  height: oiRaw["height"] as number,
                  width: oiRaw["width"] as number,
                  focus_rects: Array.isArray(oiRaw["focus_rects"])
                    ? (
                        oiRaw["focus_rects"] as Array<Record<string, unknown>>
                      ).map((fr) => ({
                        x: Number(fr["x"] ?? 0),
                        y: Number(fr["y"] ?? 0),
                        w: Number(fr["w"] ?? 0),
                        h: Number(fr["h"] ?? 0),
                      }))
                    : [],
                }
              : undefined;

          const viRaw = m["video_info"] as Record<string, unknown> | undefined;
          const video_info = viRaw
            ? {
                aspect_ratio: Array.isArray(viRaw["aspect_ratio"])
                  ? (viRaw["aspect_ratio"] as number[])
                  : [16, 9],
                duration_millis:
                  typeof viRaw["duration_millis"] === "number"
                    ? (viRaw["duration_millis"] as number)
                    : undefined,
                variants: Array.isArray(viRaw["variants"])
                  ? (viRaw["variants"] as Array<Record<string, unknown>>).map(
                      (v) => ({
                        content_type: (v["content_type"] as string) || "",
                        url: (v["url"] as string) || "",
                        bitrate:
                          typeof v["bitrate"] === "number"
                            ? (v["bitrate"] as number)
                            : undefined,
                      })
                    )
                  : [],
              }
            : undefined;

          const sizesRaw = m["sizes"] as Record<string, unknown> | undefined;
          const sizes = sizesRaw
            ? {
                large: sizesRaw["large"]
                  ? {
                      h:
                        ((sizesRaw["large"] as Record<string, unknown>)[
                          "h"
                        ] as number) ?? 0,
                      w:
                        ((sizesRaw["large"] as Record<string, unknown>)[
                          "w"
                        ] as number) ?? 0,
                      resize: (sizesRaw["large"] as Record<string, unknown>)[
                        "resize"
                      ] as string | undefined,
                    }
                  : undefined,
                medium: sizesRaw["medium"]
                  ? {
                      h:
                        ((sizesRaw["medium"] as Record<string, unknown>)[
                          "h"
                        ] as number) ?? 0,
                      w:
                        ((sizesRaw["medium"] as Record<string, unknown>)[
                          "w"
                        ] as number) ?? 0,
                      resize: (sizesRaw["medium"] as Record<string, unknown>)[
                        "resize"
                      ] as string | undefined,
                    }
                  : undefined,
                small: sizesRaw["small"]
                  ? {
                      h:
                        ((sizesRaw["small"] as Record<string, unknown>)[
                          "h"
                        ] as number) ?? 0,
                      w:
                        ((sizesRaw["small"] as Record<string, unknown>)[
                          "w"
                        ] as number) ?? 0,
                      resize: (sizesRaw["small"] as Record<string, unknown>)[
                        "resize"
                      ] as string | undefined,
                    }
                  : undefined,
                thumb: sizesRaw["thumb"]
                  ? {
                      h:
                        ((sizesRaw["thumb"] as Record<string, unknown>)[
                          "h"
                        ] as number) ?? 0,
                      w:
                        ((sizesRaw["thumb"] as Record<string, unknown>)[
                          "w"
                        ] as number) ?? 0,
                      resize: (sizesRaw["thumb"] as Record<string, unknown>)[
                        "resize"
                      ] as string | undefined,
                    }
                  : undefined,
              }
            : undefined;

          const indices = Array.isArray(m["indices"])
            ? (m["indices"] as number[])
            : undefined;

          return {
            display_url: m["display_url"] as string | undefined,
            expanded_url: m["expanded_url"] as string | undefined,
            id_str:
              (m["id_str"] as string | undefined) ||
              (typeof m["id"] === "string" ? (m["id"] as string) : undefined),
            indices,
            media_key: m["media_key"] as string | undefined,
            media_url_https: mediaUrlHttps,
            type: m["type"] as string | undefined,
            url: m["url"] as string | undefined,
            ext_alt_text: m["ext_alt_text"] as string | undefined,
            ext_media_availability: status ? { status } : undefined,
            sizes,
            original_info,
            video_info,
            additional_media_info: m["additional_media_info"]
              ? {
                  monetizable:
                    ((m["additional_media_info"] as Record<string, unknown>)[
                      "monetizable"
                    ] as boolean) || undefined,
                }
              : undefined,
          } as Media;
        })
        .filter((x): x is Media => x !== null);

      baseTweet.entities = {
        ...(baseTweet.entities || {}),
        media,
      };
    }

    // CRITICAL FIX: Derive quote tweet fields
    if (apiTweet.quoted_tweet) {
      baseTweet.quoted_status_id = parseInt(apiTweet.quoted_tweet.id, 10);
      baseTweet.quoted_status_id_str = apiTweet.quoted_tweet.id;
      baseTweet.is_quote_status = true;
      // Recursively transform the quoted tweet
      baseTweet.quoted_status = transformTweet(apiTweet.quoted_tweet);
    }

    // CRITICAL FIX: Derive retweet fields
    if (apiTweet.retweeted_tweet) {
      // Recursively transform the retweeted tweet
      baseTweet.retweeted_status = transformTweet(apiTweet.retweeted_tweet);
    }

    // Derive additional computed fields for proper categorization
    if (apiTweet.inReplyToId) {
      baseTweet.in_reply_to_status_id = parseInt(apiTweet.inReplyToId, 10);
    }
    if (apiTweet.inReplyToUserId) {
      baseTweet.in_reply_to_user_id = parseInt(apiTweet.inReplyToUserId, 10);
    }

    return baseTweet;
  } catch (error) {
    logger.error("Error transforming tweet:", error, apiTweet);
    // Return a minimal valid tweet to prevent complete failure
    return {
      id: parseInt(apiTweet.id, 10),
      id_str: apiTweet.id,
      text: apiTweet.text,
      tweet_created_at: apiTweet.createdAt,
      entities: {},
    };
  }
}

/**
 * Transform Twitter API response to match our expected format
 * Includes comprehensive error handling and validation
 */
function transformTwitterResponse(response: TwitterApiResponse): {
  tweets: Tweet[];
  has_next_page: boolean;
  next_cursor: string;
} {
  if (!response?.tweets) {
    logger.warn("No tweets in API response");
    return {
      tweets: [],
      has_next_page: false,
      next_cursor: "",
    };
  }

  const transformedTweets = response.tweets
    .map(transformTweet)
    .filter((tweet): tweet is Tweet => tweet !== null); // Remove any failed transformations

  // Log transformation stats for debugging
  logger.info(
    `Transformed ${transformedTweets.length}/${response.tweets.length} tweets successfully`
  );

  // Log quote tweet statistics for debugging
  const quoteTweets = transformedTweets.filter(
    (tweet) => tweet.quoted_status_id_str
  );
  const replyTweets = transformedTweets.filter(
    (tweet) => tweet.in_reply_to_status_id_str
  );
  logger.info(
    `Quote tweets: ${quoteTweets.length}, Reply tweets: ${replyTweets.length}`
  );

  // Validation: Ensure critical fields are properly set for quote tweets
  quoteTweets.forEach((tweet) => {
    if (!tweet.quoted_status_id_str || !tweet.is_quote_status) {
      logger.error("Invalid quote tweet transformation:", {
        id: tweet.id_str,
        hasQuotedStatusIdStr: !!tweet.quoted_status_id_str,
        hasIsQuoteStatus: !!tweet.is_quote_status,
        hasQuotedStatus: !!tweet.quoted_status,
      });
    }
  });

  return {
    tweets: transformedTweets,
    has_next_page: response.has_next_page,
    next_cursor: response.next_cursor,
  };
}

// Add: robust server-side query gating helpers
function matchesQueryText(
  text: string | undefined,
  query: string,
  exact: boolean
): boolean {
  const q = normalizeQuery(query).toLowerCase();
  const t = (text || "").toLowerCase();
  if (!q) return false;

  if (exact) {
    return t.includes(q);
  }

  const tokens = q
    .split(/\s+/)
    .map((tok) => tok.trim())
    .filter((tok) => tok.length >= 2);
  if (tokens.length === 0) return false;

  return tokens.some((tok) => t.includes(tok));
}

function tweetMatchesQuery(
  tweet: Tweet,
  query: string,
  exact: boolean
): boolean {
  // Check main tweet text
  if (matchesQueryText((tweet.full_text || tweet.text) ?? "", query, exact)) {
    return true;
  }

  // Check quoted tweet text
  if (tweet.quoted_status) {
    if (
      matchesQueryText(
        (tweet.quoted_status.full_text || tweet.quoted_status.text) ?? "",
        query,
        exact
      )
    ) {
      return true;
    }
  }

  // Check retweeted tweet text
  if (tweet.retweeted_status) {
    if (
      matchesQueryText(
        (tweet.retweeted_status.full_text || tweet.retweeted_status.text) ?? "",
        query,
        exact
      )
    ) {
      return true;
    }
  }

  return false;
}

// Removed duplicate gating helpers (kept the first, multiline versions above)
export const searchTwitter = action({
  args: searchTwitterArgsValidator,
  handler: async (ctx, { query, exactMatch, cursor }) => {
    try {
      // Validate query length (after normalization, plus quotes if exact)
      const normalized = normalizeQuery(query);
      const effectiveLength = normalized.length + (exactMatch ? 2 : 0);
      if (effectiveLength > MAX_QUERY_LENGTH) {
        throw new Error(
          `Query too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.`
        );
      }

      // TEMPORARY: Return mock data when using webhook endpoint
      // Mock data includes comprehensive examples of posts, quotes, and replies for testing
      if (TWITTER_API_BASE_URL.includes("webhook.site")) {
        logger.info("Using enhanced mock data with quote and reply examples");

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const mockTweets: Tweet[] = [
          {
            id: 1234567890,
            id_str: "1234567890",
            text: `Mock tweet about ${query}. This is a test tweet to simulate API response while debugging infinite loop issues.`,
            full_text: `Mock tweet about ${query}. This is a test tweet to simulate API response while debugging infinite loop issues.`,
            tweet_created_at: new Date().toISOString(),
            source: "Mock Client",
            retweet_count: 5,
            reply_count: 2,
            favorite_count: 10,
            quote_count: 1,
            views_count: 100,
            lang: "en",
            bookmark_count: 3,
            in_reply_to_status_id_str: undefined,
            conversation_id_str: "1234567890",
            in_reply_to_user_id_str: undefined,
            in_reply_to_screen_name: undefined,
            user: {
              id: 987654321,
              id_str: "987654321",
              name: "Mock User",
              screen_name: "mockuser",
              verified: false,
              profile_image_url_https: "https://via.placeholder.com/400x400",
              protected: false,
              followers_count: 1000,
              friends_count: 500,
              listed_count: 10,
              favourites_count: 2000,
              statuses_count: 5000,
              created_at: "2020-01-01T00:00:00.000Z",
              can_dm: true,
            },
            entities: {
              hashtags: [],
              symbols: [],
              user_mentions: [],
              urls: [],
            },
          },
          {
            id: 1234567891,
            id_str: "1234567891",
            text: `Another mock tweet for "${query}". This helps test pagination and multiple results.`,
            full_text: `Another mock tweet for "${query}". This helps test pagination and multiple results.`,
            tweet_created_at: new Date(Date.now() - 3600000).toISOString(),
            source: "Mock Web App",
            retweet_count: 2,
            reply_count: 1,
            favorite_count: 7,
            quote_count: 0,
            views_count: 50,
            lang: "en",
            bookmark_count: 1,
            in_reply_to_status_id_str: undefined,
            conversation_id_str: "1234567891",
            in_reply_to_user_id_str: undefined,
            in_reply_to_screen_name: undefined,
            user: {
              id: 987654322,
              id_str: "987654322",
              name: "Another Mock User",
              screen_name: "anothermockuser",
              verified: true,
              profile_image_url_https: "https://via.placeholder.com/400x400",
              protected: false,
              followers_count: 5000,
              friends_count: 1000,
              listed_count: 25,
              favourites_count: 3000,
              statuses_count: 8000,
              created_at: "2019-01-01T00:00:00.000Z",
              can_dm: false,
            },
            entities: {
              hashtags: [],
              symbols: [],
              user_mentions: [],
              urls: [],
            },
          },
          // OLDER TWEET FOR DATE FILTERING TEST
          {
            id: 1234567894,
            id_str: "1234567894",
            text: `This is an older tweet about ${query} from 10 days ago.`,
            full_text: `This is an older tweet about ${query} from 10 days ago.`,
            tweet_created_at: new Date(
              Date.now() - 10 * 24 * 60 * 60 * 1000
            ).toISOString(),
            source: "Mock Old Client",
            retweet_count: 1,
            reply_count: 0,
            favorite_count: 3,
            quote_count: 0,
            views_count: 25,
            lang: "en",
            bookmark_count: 0,
            in_reply_to_status_id_str: undefined,
            conversation_id_str: "1234567894",
            in_reply_to_user_id_str: undefined,
            in_reply_to_screen_name: undefined,
            user: {
              id: 987654326,
              id_str: "987654326",
              name: "Old Mock User",
              screen_name: "oldmockuser",
              verified: false,
              profile_image_url_https: "https://via.placeholder.com/400x400",
              protected: false,
              followers_count: 800,
              friends_count: 400,
              listed_count: 5,
              favourites_count: 1200,
              statuses_count: 2500,
              created_at: "2020-01-01T00:00:00.000Z",
              can_dm: true,
            },
            entities: {
              hashtags: [],
              symbols: [],
              user_mentions: [],
              urls: [],
            },
          },
          // MOCK QUOTE TWEET - Critical for testing Quotes tab
          {
            id: 1234567892,
            id_str: "1234567892",
            text: `I love these types of tweets about ${query} 😂, Felt a FOMO`,
            full_text: `I love these types of tweets about ${query} 😂, Felt a FOMO`,
            tweet_created_at: new Date(Date.now() - 7200000).toISOString(),
            source: "Mock iPhone",
            retweet_count: 1,
            reply_count: 0,
            favorite_count: 3,
            quote_count: 0,
            views_count: 75,
            lang: "en",
            bookmark_count: 1,
            conversation_id_str: "1234567892",
            // CRITICAL FIELDS FOR QUOTES TAB
            quoted_status_id: 1234567890,
            quoted_status_id_str: "1234567890",
            is_quote_status: true,
            quoted_status: {
              id: 1234567890,
              id_str: "1234567890",
              text: `Original tweet about ${query} that got quoted`,
              full_text: `Original tweet about ${query} that got quoted`,
              tweet_created_at: new Date(Date.now() - 10800000).toISOString(),
              source: "Mock Original",
              retweet_count: 2,
              reply_count: 1,
              favorite_count: 5,
              quote_count: 1,
              views_count: 50,
              lang: "en",
              bookmark_count: 0,
              conversation_id_str: "1234567890",
              user: {
                id: 987654323,
                id_str: "987654323",
                name: "Original Mock User",
                screen_name: "originalmockuser",
                verified: false,
                profile_image_url_https: "https://via.placeholder.com/400x400",
                protected: false,
                followers_count: 2000,
                friends_count: 800,
                listed_count: 5,
                favourites_count: 1500,
                statuses_count: 3000,
                created_at: "2018-01-01T00:00:00.000Z",
                can_dm: true,
              },
              entities: {
                hashtags: [],
                symbols: [],
                user_mentions: [],
                urls: [],
              },
            },
            user: {
              id: 987654324,
              id_str: "987654324",
              name: "Quote Mock User",
              screen_name: "quotemockuser",
              verified: false,
              profile_image_url_https: "https://via.placeholder.com/400x400",
              protected: false,
              followers_count: 1500,
              friends_count: 600,
              listed_count: 8,
              favourites_count: 2500,
              statuses_count: 4000,
              created_at: "2021-01-01T00:00:00.000Z",
              can_dm: true,
            },
            entities: {
              hashtags: [],
              symbols: [],
              user_mentions: [],
              urls: [],
            },
          },
          // MOCK REPLY TWEET - For testing Replies tab
          {
            id: 1234567893,
            id_str: "1234567893",
            text: `@mockuser I totally agree about ${query}! This is exactly what I needed.`,
            full_text: `@mockuser I totally agree about ${query}! This is exactly what I needed.`,
            tweet_created_at: new Date(Date.now() - 5400000).toISOString(),
            source: "Mock Reply Client",
            retweet_count: 0,
            reply_count: 0,
            favorite_count: 2,
            quote_count: 0,
            views_count: 25,
            lang: "en",
            bookmark_count: 0,
            // CRITICAL FIELDS FOR REPLIES TAB
            in_reply_to_status_id: 1234567890,
            in_reply_to_status_id_str: "1234567890",
            in_reply_to_user_id: 987654321,
            in_reply_to_user_id_str: "987654321",
            in_reply_to_screen_name: "mockuser",
            conversation_id_str: "1234567890",
            user: {
              id: 987654325,
              id_str: "987654325",
              name: "Reply Mock User",
              screen_name: "replymockuser",
              verified: false,
              profile_image_url_https: "https://via.placeholder.com/400x400",
              protected: false,
              followers_count: 500,
              friends_count: 300,
              listed_count: 2,
              favourites_count: 800,
              statuses_count: 1200,
              created_at: "2022-01-01T00:00:00.000Z",
              can_dm: true,
            },
            entities: {
              hashtags: [],
              symbols: [],
              user_mentions: [],
              urls: [],
            },
          },
        ];

        return {
          success: true,
          data: {
            tweets: mockTweets,
            has_next_page: !cursor, // Only show "next page" for first request
            next_cursor: cursor ? "" : "mock_cursor_12345",
          },
        };
      }

      // Get and validate API key (for real API calls)
      const twitterApiKey = process.env.TWITTER_API_KEY;
      if (!twitterApiKey) {
        throw new Error(
          "Twitter API key not configured. Please set TWITTER_API_KEY in your Convex environment variables."
        );
      }

      // Format query for Twitter search
      let searchQuery = normalized;
      if (exactMatch) {
        const alreadyQuoted =
          searchQuery.startsWith('"') &&
          searchQuery.endsWith('"') &&
          searchQuery.length >= 2;
        if (!alreadyQuoted) {
          searchQuery = `"${searchQuery}"`;
        }
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        // Build URL with cursor if provided
        const url = new URL(TWITTER_API_BASE_URL);
        url.searchParams.set("queryType", "Latest");
        url.searchParams.set("query", searchQuery);
        if (cursor) {
          url.searchParams.set("cursor", cursor);
        }

        // Call Twitter API with proper error handling
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "X-API-Key": twitterApiKey,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Twitter API error: ${response.status} - ${errorData.message || response.statusText}`
          );
        }

        const results = (await response.json()) as TwitterApiResponse;
        const transformedResults = transformTwitterResponse(results);

        // New: server-side query gating
        const gatedTweets = transformedResults.tweets.filter((t) =>
          tweetMatchesQuery(t, query, exactMatch)
        );
        const removedCount =
          transformedResults.tweets.length - gatedTweets.length;

        if (removedCount > 0) {
          logger.info(
            "[TWITTER_SEARCH] Query gating removed mismatched tweets",
            {
              query: normalizeQuery(query),
              exactMatch,
              removed: removedCount,
              kept: gatedTweets.length,
              has_next_page: transformedResults.has_next_page,
              next_cursor: transformedResults.next_cursor,
            }
          );
        }

        return {
          success: true,
          data: {
            tweets: gatedTweets,
            has_next_page: transformedResults.has_next_page,
            next_cursor: transformedResults.next_cursor,
          },
        };
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        const err = error as { name?: string; message?: string } | null;
        const name = err?.name;
        const message = err?.message ?? "";
        const isAbort =
          name === "AbortError" ||
          message === "AbortError" ||
          /aborted/i.test(message);

        if (isAbort) {
          const timeoutError = new Error(
            "Request timed out. Please try again."
          );
          timeoutError.name = "TimeoutError";
          throw timeoutError;
        }

        if (error instanceof Error) {
          throw error;
        }
        throw new Error("An unexpected error occurred during the API call.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        logger.warn("Twitter search timed out", { query, cursor });
      } else {
        logger.error("Twitter search error:", error);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
});

export const searchTwitterChunkedFiltered = action({
  args: v.object({
    query: v.string(),
    exactMatch: v.boolean(),
    cursor: v.optional(v.string()),
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    userDescription: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    { query, exactMatch, cursor, keywordKey, operation, userDescription }
  ): Promise<{
    success: boolean;
    data?: {
      tweets: unknown[];
      meta: {
        originalCount: number;
        has_next_page?: boolean;
        next_cursor?: string;
        chunkSetId: string;
      };
    };
    error?: string;
  }> => {
    // Fetch tweets via existing action
    const res: {
      success: boolean;
      data?: {
        tweets: Tweet[];
        has_next_page: boolean;
        next_cursor: string;
      };
      error?: string;
    } = await ctx.runAction(api.twitterSearch.searchTwitter, {
      query,
      exactMatch,
      cursor,
    });
    if (!res?.success) {
      return { success: false, error: res?.error || "Search failed" };
    }

    const transformed = {
      tweets: res.data?.tweets || [],
      has_next_page: res.data?.has_next_page,
      next_cursor: res.data?.next_cursor,
    } as const;

    const chunkSetId = `page_${Date.now()}_${cursor ? "load" : "initial"}`;
    const start: {
      success: boolean;
      data: { firstChunkTweets: unknown[]; chunkSetId: string };
    } = await ctx.runAction(api.llmFilterChunked.startServerChunking, {
      keywordKey,
      operation,
      originalQuery: query.trim(),
      userDescription,
      tweets: { tweets: transformed.tweets },
      chunkSetId,
      pollMs: 3000,
    });

    return {
      success: true,
      data: {
        tweets: start.data.firstChunkTweets || [],
        meta: {
          originalCount: transformed.tweets.length,
          has_next_page: transformed.has_next_page,
          next_cursor: transformed.next_cursor,
          chunkSetId,
        },
      },
    };
  },
});
