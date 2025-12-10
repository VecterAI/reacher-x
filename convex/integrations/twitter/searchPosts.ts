"use node";

// convex/integrations/twitter/searchPosts.ts
// Twitter post search via socialapi.io with exact phrase matching

import { action } from "../../_generated/server";
import { v } from "convex/values";

// ============================================================================
// Logging
// ============================================================================

interface LogContext {
  operation: string;
  query?: string;
  queriesCount?: number;
  postsFound?: number;
  uniquePosts?: number;
  cursor?: string;
  hasMore?: boolean;
  durationMs?: number;
  error?: string;
  httpStatus?: number;
}

function log(
  level: "info" | "warn" | "error",
  message: string,
  context: LogContext
) {
  const logData = {
    timestamp: new Date().toISOString(),
    service: "twitter/searchPosts",
    level,
    message,
    ...context,
  };

  if (level === "error") {
    console.error("[twitter/searchPosts]", JSON.stringify(logData, null, 2));
  } else if (level === "warn") {
    console.warn("[twitter/searchPosts]", JSON.stringify(logData, null, 2));
  } else {
    console.log("[twitter/searchPosts]", JSON.stringify(logData, null, 2));
  }
}

// ============================================================================
// Types
// ============================================================================

/** Twitter user from socialapi.io */
export interface TwitterUser {
  id: number;
  id_str: string;
  name: string;
  screen_name: string;
  location?: string;
  url?: string;
  description?: string;
  protected: boolean;
  verified: boolean;
  followers_count: number;
  friends_count: number;
  listed_count: number;
  favourites_count: number;
  statuses_count: number;
  created_at: string;
  profile_banner_url?: string;
  profile_image_url_https: string;
  can_dm: boolean;
}

/** Twitter post (tweet) from socialapi.io search */
export interface TwitterPost {
  tweet_created_at: string;
  id_str: string;
  conversation_id_str?: string;
  text?: string;
  full_text?: string;
  source?: string;
  in_reply_to_status_id_str?: string;
  in_reply_to_user_id_str?: string;
  in_reply_to_screen_name?: string;
  user: TwitterUser;
  is_quote_status?: boolean;
  quoted_status_id_str?: string;
  quote_count?: number;
  reply_count?: number;
  retweet_count?: number;
  favorite_count?: number;
  views_count?: number;
  bookmark_count?: number;
  lang?: string;
  entities?: {
    urls?: Array<{
      url: string;
      expanded_url: string;
      display_url: string;
    }>;
    hashtags?: Array<{ text: string }>;
    user_mentions?: Array<{
      id_str: string;
      name: string;
      screen_name: string;
    }>;
  };
}

/** socialapi.io search response */
interface ApiResponse {
  next_cursor?: string;
  tweets: TwitterPost[];
}

/** Single search result */
export interface SearchResult {
  success: boolean;
  posts: TwitterPost[];
  nextCursor?: string;
  hasMore: boolean;
  error?: string;
  stats: {
    query: string;
    postsFound: number;
    durationMs: number;
  };
}

/** Batch search result */
export interface BatchSearchResult {
  success: boolean;
  posts: TwitterPost[];
  errors: Array<{ query: string; error: string }>;
  stats: {
    queriesExecuted: number;
    queriesSucceeded: number;
    queriesFailed: number;
    totalPostsFound: number;
    uniquePosts: number;
    durationMs: number;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Wraps query in quotes for exact phrase matching.
 * Skips if already quoted.
 */
function buildExactPhraseQuery(query: string): string {
  const trimmed = query.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }

  return `"${trimmed}"`;
}

/**
 * Gets API key from environment
 */
function getApiKey(): string | null {
  return process.env.SOCIALAPI_API_KEY ?? null;
}

/**
 * Deduplicates posts by id_str
 */
function deduplicatePosts(posts: TwitterPost[]): TwitterPost[] {
  const seen = new Map<string, TwitterPost>();

  for (const post of posts) {
    if (!seen.has(post.id_str)) {
      seen.set(post.id_str, post);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Search Twitter posts with exact phrase matching.
 *
 * @example
 * const result = await ctx.runAction(api.integrations.twitter.searchPosts.search, {
 *   query: "struggling to find customers",
 *   type: "Latest",
 * });
 */
export const search = action({
  args: {
    query: v.string(),
    type: v.optional(v.union(v.literal("Latest"), v.literal("Top"))),
    cursor: v.optional(v.string()),
  },
  handler: async (_, args): Promise<SearchResult> => {
    const startTime = Date.now();
    const apiKey = getApiKey();

    if (!apiKey) {
      log("error", "Missing API key", {
        operation: "search",
        error: "SOCIALAPI_API_KEY environment variable not set",
      });
      return {
        success: false,
        posts: [],
        hasMore: false,
        error: "API key not configured",
        stats: {
          query: args.query,
          postsFound: 0,
          durationMs: Date.now() - startTime,
        },
      };
    }

    if (!args.query || args.query.trim().length === 0) {
      log("warn", "Empty query provided", {
        operation: "search",
        query: args.query,
      });
      return {
        success: false,
        posts: [],
        hasMore: false,
        error: "Query cannot be empty",
        stats: {
          query: args.query,
          postsFound: 0,
          durationMs: Date.now() - startTime,
        },
      };
    }

    const exactQuery = buildExactPhraseQuery(args.query);

    log("info", "Starting search", {
      operation: "search",
      query: exactQuery,
      cursor: args.cursor,
    });

    try {
      const params = new URLSearchParams();
      params.set("query", exactQuery);
      params.set("type", args.type ?? "Latest");
      if (args.cursor) {
        params.set("cursor", args.cursor);
      }

      const url = `https://api.socialapi.me/twitter/search?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        log("error", "API returned error status", {
          operation: "search",
          query: exactQuery,
          httpStatus: response.status,
          error: errorText,
          durationMs: Date.now() - startTime,
        });
        return {
          success: false,
          posts: [],
          hasMore: false,
          error: `API returned ${response.status}: ${errorText}`,
          stats: {
            query: exactQuery,
            postsFound: 0,
            durationMs: Date.now() - startTime,
          },
        };
      }

      const data: ApiResponse = await response.json();
      const durationMs = Date.now() - startTime;

      log("info", "Search completed", {
        operation: "search",
        query: exactQuery,
        postsFound: data.tweets?.length ?? 0,
        hasMore: !!data.next_cursor,
        durationMs,
      });

      return {
        success: true,
        posts: data.tweets ?? [],
        nextCursor: data.next_cursor,
        hasMore: !!data.next_cursor,
        stats: {
          query: exactQuery,
          postsFound: data.tweets?.length ?? 0,
          durationMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      log("error", "Network or parsing error", {
        operation: "search",
        query: exactQuery,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });
      return {
        success: false,
        posts: [],
        hasMore: false,
        error: `Failed to search: ${errorMessage}`,
        stats: {
          query: exactQuery,
          postsFound: 0,
          durationMs: Date.now() - startTime,
        },
      };
    }
  },
});

/**
 * Search Twitter posts with multiple queries (batch).
 * Deduplicates results across all queries.
 *
 * @example
 * const result = await ctx.runAction(api.integrations.twitter.searchPosts.searchBatch, {
 *   queries: ["struggling to find customers", "need help with leads"],
 *   type: "Latest",
 * });
 */
export const searchBatch = action({
  args: {
    queries: v.array(v.string()),
    type: v.optional(v.union(v.literal("Latest"), v.literal("Top"))),
    maxQueriesPerBatch: v.optional(v.number()),
  },
  handler: async (_, args): Promise<BatchSearchResult> => {
    const startTime = Date.now();
    const apiKey = getApiKey();

    if (!apiKey) {
      log("error", "Missing API key", {
        operation: "searchBatch",
        error: "SOCIALAPI_API_KEY environment variable not set",
      });
      return {
        success: false,
        posts: [],
        errors: [{ query: "*", error: "API key not configured" }],
        stats: {
          queriesExecuted: 0,
          queriesSucceeded: 0,
          queriesFailed: 0,
          totalPostsFound: 0,
          uniquePosts: 0,
          durationMs: Date.now() - startTime,
        },
      };
    }

    const uniqueQueries = [
      ...new Set(
        args.queries.map((q) => q.trim().toLowerCase()).filter((q) => q.length > 0)
      ),
    ];

    const maxQueries = args.maxQueriesPerBatch ?? 20;
    const queriesToExecute = uniqueQueries.slice(0, maxQueries);

    if (queriesToExecute.length === 0) {
      log("warn", "No valid queries provided", {
        operation: "searchBatch",
        queriesCount: 0,
      });
      return {
        success: false,
        posts: [],
        errors: [{ query: "*", error: "No valid queries provided" }],
        stats: {
          queriesExecuted: 0,
          queriesSucceeded: 0,
          queriesFailed: 0,
          totalPostsFound: 0,
          uniquePosts: 0,
          durationMs: Date.now() - startTime,
        },
      };
    }

    log("info", "Starting batch search", {
      operation: "searchBatch",
      queriesCount: queriesToExecute.length,
    });

    const allPosts: TwitterPost[] = [];
    const errors: Array<{ query: string; error: string }> = [];
    let queriesSucceeded = 0;
    let totalPostsFound = 0;

    for (const query of queriesToExecute) {
      const exactQuery = buildExactPhraseQuery(query);

      try {
        const params = new URLSearchParams();
        params.set("query", exactQuery);
        params.set("type", args.type ?? "Latest");

        const url = `https://api.socialapi.me/twitter/search?${params.toString()}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          errors.push({
            query: exactQuery,
            error: `API returned ${response.status}: ${errorText}`,
          });
          log("warn", "Query failed", {
            operation: "searchBatch",
            query: exactQuery,
            httpStatus: response.status,
            error: errorText,
          });
          continue;
        }

        const data: ApiResponse = await response.json();
        const posts = data.tweets ?? [];

        allPosts.push(...posts);
        totalPostsFound += posts.length;
        queriesSucceeded++;

        log("info", "Query completed", {
          operation: "searchBatch",
          query: exactQuery,
          postsFound: posts.length,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ query: exactQuery, error: errorMessage });
        log("warn", "Query error", {
          operation: "searchBatch",
          query: exactQuery,
          error: errorMessage,
        });
      }

      // 500ms delay = max 120 requests/minute (matches socialapi.io rate limit)
      if (queriesToExecute.indexOf(query) < queriesToExecute.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const uniquePosts = deduplicatePosts(allPosts);
    const durationMs = Date.now() - startTime;

    log("info", "Batch search completed", {
      operation: "searchBatch",
      queriesCount: queriesToExecute.length,
      postsFound: totalPostsFound,
      uniquePosts: uniquePosts.length,
      durationMs,
    });

    return {
      success: queriesSucceeded > 0,
      posts: uniquePosts,
      errors,
      stats: {
        queriesExecuted: queriesToExecute.length,
        queriesSucceeded,
        queriesFailed: errors.length,
        totalPostsFound,
        uniquePosts: uniquePosts.length,
        durationMs,
      },
    };
  },
});

