// convex/twitterSearch.ts
import { v } from "convex/values";
import { action } from "./_generated/server";
import type { Tweet, Entities } from "../features/threads/types";

// Constants for API configuration
// TEMPORARY: Using webhook.site to prevent credit usage during debugging
const TWITTER_API_BASE_URL =
  "https://webhook.site/b47a9d11-d1be-41e6-99f5-e49f6441c4a0";
// Original URL (commented out to prevent credit usage):
// const TWITTER_API_BASE_URL =
//   "https://api.twitterapi.io/twitter/tweet/advanced_search";
const MAX_QUERY_LENGTH = 500;
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Twitter API response types
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
  inReplyToId: string;
  conversationId: string;
  inReplyToUserId: string;
  inReplyToUsername: string;
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

// Utility function to convert camelCase to snake_case
function toSnakeCase(str: string): string {
  return str
    .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    .replace(/^_/, ""); // Remove leading underscore if present
}

// Utility function to recursively convert object keys to snake_case
function convertToSnakeCase<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(convertToSnakeCase) as T;
  }

  if (obj !== null && typeof obj === "object") {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        const snakeKey = toSnakeCase(key);
        acc[snakeKey] = convertToSnakeCase(value);
        return acc;
      },
      {} as Record<string, unknown>
    ) as T;
  }

  return obj;
}

// Transform Twitter API response to match our expected format
function transformTwitterResponse(response: TwitterApiResponse): {
  tweets: Tweet[];
  has_next_page: boolean;
  next_cursor: string;
} {
  if (!response?.tweets) {
    return {
      tweets: [],
      has_next_page: false,
      next_cursor: "",
    };
  }

  const transformedTweets = response.tweets.map(
    (tweet): Tweet => ({
      id: parseInt(tweet.id, 10),
      id_str: tweet.id,
      text: tweet.text,
      full_text: tweet.text,
      tweet_created_at: tweet.createdAt,
      source: tweet.source,
      retweet_count: tweet.retweetCount,
      reply_count: tweet.replyCount,
      favorite_count: tweet.likeCount,
      quote_count: tweet.quoteCount,
      views_count: tweet.viewCount,
      lang: tweet.lang,
      bookmark_count: tweet.bookmarkCount,
      in_reply_to_status_id_str: tweet.inReplyToId,
      conversation_id_str: tweet.conversationId,
      in_reply_to_user_id_str: tweet.inReplyToUserId,
      in_reply_to_screen_name: tweet.inReplyToUsername,
      user: tweet.author
        ? {
            id: parseInt(tweet.author.id, 10),
            id_str: tweet.author.id,
            name: tweet.author.name,
            screen_name: tweet.author.userName,
            verified: tweet.author.isVerified,
            profile_image_url_https: tweet.author.profilePicture,
            protected: false,
            followers_count: tweet.author.followers,
            friends_count: tweet.author.following,
            listed_count: 0,
            favourites_count: tweet.author.favouritesCount,
            statuses_count: tweet.author.statusesCount,
            created_at: tweet.author.createdAt,
            can_dm: tweet.author.canDm,
          }
        : undefined,
      entities: tweet.entities || {},
      quoted_status: tweet.quoted_tweet
        ? {
            ...convertToSnakeCase(tweet.quoted_tweet),
            id: parseInt(tweet.quoted_tweet.id, 10),
          }
        : undefined,
      retweeted_status: tweet.retweeted_tweet
        ? {
            ...convertToSnakeCase(tweet.retweeted_tweet),
            id: parseInt(tweet.retweeted_tweet.id, 10),
          }
        : undefined,
    })
  );

  return {
    tweets: transformedTweets,
    has_next_page: response.has_next_page,
    next_cursor: response.next_cursor,
  };
}

export const searchTwitter = action({
  args: {
    query: v.string(),
    exactMatch: v.boolean(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { query, exactMatch, cursor }) => {
    try {
      // Validate query length
      if (query.length > MAX_QUERY_LENGTH) {
        throw new Error(
          `Query too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.`
        );
      }

      // TEMPORARY: Return mock data when using webhook endpoint
      if (TWITTER_API_BASE_URL.includes("webhook.site")) {
        console.log("Using mock data for webhook endpoint");

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const mockTweets: Tweet[] = [
          {
            id: 1234567890,
            id_str: "1234567890",
            text: `Mock tweet about ${query}. This is a test tweet to simulate API response while debugging infinite loop issues. Mock tweet about ${query}. This is a test tweet to simulate API response while debugging infinite loop issues. Mock tweet about ${query}. This is a test tweet to simulate API response while debugging infinite loop issues.`,
            full_text: `Mock tweet about ${query}. This is a test tweet to simulate API response while debugging infinite loop issues. Mock tweet about ${query}. This is a test tweet to simulate API response while debugging infinite loop issues. Mock tweet about ${query}. This is a test tweet to simulate API response while debugging infinite loop issues.`,
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
      let searchQuery = query.trim();
      if (exactMatch) {
        searchQuery = `"${searchQuery}"`;
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

        return {
          success: true,
          data: transformedResults,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error) {
          if (error.name === "AbortError") {
            throw new Error("Request timed out. Please try again.");
          }
          throw error;
        }
        throw new Error("An unexpected error occurred during the API call.");
      }
    } catch (error) {
      console.error("Twitter search error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
});
