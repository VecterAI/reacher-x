"use node";

// convex/integrations/twitter/searchPosts.ts
// Twitter post search via socialapi.io with exact phrase matching and automatic retry

import { action, internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { retrier } from "../../lib/retrier";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import type { RunId } from "@convex-dev/action-retrier";
import { acquireSocialApiBudget } from "../../lib/socialApiBudget";
import { twitterSearchTypeValidator } from "../../validators";

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
  matchedQueriesByPostId: Record<string, string[]>;
  queryResults?: Array<{
    query: string;
    posts: TwitterPost[];
    nextCursor?: string;
    hasMore: boolean;
    success: boolean;
    error?: string;
  }>;
  errors: Array<{ query: string; error: string }>;
  queryStats: Array<{
    query: string;
    postsFound: number;
    success: boolean;
    error?: string;
  }>;
  stats: {
    queriesExecuted: number;
    queriesSucceeded: number;
    queriesFailed: number;
    totalPostsFound: number;
    uniquePosts: number;
    durationMs: number;
  };
}

/** Internal search result from fetch action */
interface InternalSearchResult {
  success: boolean;
  posts: TwitterPost[];
  nextCursor?: string;
  hasMore: boolean;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Gets Unix timestamp for N years ago.
 * Used for limiting search results to recent posts.
 */
function getTimestampYearsAgo(years: number): number {
  const now = new Date();
  now.setFullYear(now.getFullYear() - years);
  return Math.floor(now.getTime() / 1000);
}

/** Default time limit: 2 years ago */
const DEFAULT_SINCE_TIMESTAMP = getTimestampYearsAgo(2);

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
 * Builds query with time limit using since_time operator.
 * Per SocialAPI docs, since_time uses Unix timestamp.
 */
function buildQueryWithTimeLimit(
  query: string,
  sinceTimestamp?: number
): string {
  const ts = sinceTimestamp ?? DEFAULT_SINCE_TIMESTAMP;
  return `${query} since_time:${ts}`;
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

function normalizeQueryList(queries: string[]) {
  return [
    ...new Set(
      queries.map((query) => query.trim()).filter((query) => query.length > 0)
    ),
  ];
}

/**
 * Flatten a tweet to prevent exceeding Convex's 16-level document nesting limit.
 * The SocialAPI response includes recursive `quoted_status` and `retweeted_status`
 * fields (Tweet containing Tweet containing Tweet…). We keep one level of nesting
 * so the UI can still render quote-tweet cards, but strip the recursion beyond that.
 */
export function flattenTweetForStorage<T>(tweet: T): T {
  const raw = tweet as Record<string, unknown>;
  const result = { ...raw };

  const stripRecursion = (
    nested: Record<string, unknown>
  ): Record<string, unknown> => {
    const { quoted_status: _qs, retweeted_status: _rs, ...rest } = nested;
    return rest;
  };

  if (result.quoted_status && typeof result.quoted_status === "object") {
    result.quoted_status = stripRecursion(
      result.quoted_status as Record<string, unknown>
    );
  }
  if (result.retweeted_status && typeof result.retweeted_status === "object") {
    result.retweeted_status = stripRecursion(
      result.retweeted_status as Record<string, unknown>
    );
  }

  return result as T;
}

// ============================================================================
// Internal Actions (for retrier)
// ============================================================================

/**
 * Internal action that performs the actual HTTP fetch to Twitter API.
 * Throws on failure so the retrier can catch and retry.
 */
export const searchInternal = internalAction({
  args: {
    query: v.string(),
    type: v.optional(twitterSearchTypeValidator),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<InternalSearchResult> => {
    const apiKey = getApiKey();

    if (!apiKey) {
      // Don't retry configuration errors
      return {
        success: false,
        posts: [],
        hasMore: false,
        error: "SOCIALAPI_API_KEY environment variable not set",
      };
    }

    const params = new URLSearchParams();
    params.set("query", args.query);
    params.set("type", args.type ?? "Latest");
    if (args.cursor) {
      params.set("cursor", args.cursor);
    }

    const url = `https://api.socialapi.me/twitter/search?${params.toString()}`;

    await acquireSocialApiBudget(ctx, "twitter.searchPosts.searchInternal");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Throw to trigger retry for transient failures
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data: ApiResponse = await response.json();

    return {
      success: true,
      posts: (data.tweets ?? []).map(flattenTweetForStorage),
      nextCursor: data.next_cursor,
      hasMore: !!data.next_cursor,
    };
  },
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Search Twitter posts with exact phrase matching and automatic retry.
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
    type: v.optional(twitterSearchTypeValidator),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SearchResult> => {
    const startTime = getCurrentUTCTimestamp();

    if (!args.query || args.query.trim().length === 0) {
      console.warn("[twitter/searchPosts] Empty query provided");
      return {
        success: false,
        posts: [],
        hasMore: false,
        error: "Query cannot be empty",
        stats: {
          query: args.query,
          postsFound: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    const exactQuery = buildExactPhraseQuery(args.query);
    // Apply 2-year time limit to avoid fetching ancient posts
    const queryWithTimeLimit = buildQueryWithTimeLimit(exactQuery);

    console.info(`[twitter/searchPosts] Starting search`, {
      query: exactQuery,
      cursor: args.cursor,
    });

    try {
      // Use retrier to run the internal action with automatic retry
      const runId = await retrier.run(
        ctx,
        internal.integrations.twitter.searchPosts.searchInternal,
        {
          query: queryWithTimeLimit,
          type: args.type,
          cursor: args.cursor,
        }
      );

      // Poll for completion
      let result: InternalSearchResult | null = null;
      while (true) {
        const status = await retrier.status(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (status.type === "completed") {
          if (status.result.type === "success") {
            result = status.result.returnValue as InternalSearchResult;
          } else if (status.result.type === "failed") {
            console.error(
              `[twitter/searchPosts] Retrier exhausted all retries`,
              { query: exactQuery, error: status.result.error }
            );
            return {
              success: false,
              posts: [],
              hasMore: false,
              error: `Failed after retries: ${status.result.error}`,
              stats: {
                query: exactQuery,
                postsFound: 0,
                durationMs: getCurrentUTCTimestamp() - startTime,
              },
            };
          } else {
            // canceled
            return {
              success: false,
              posts: [],
              hasMore: false,
              error: "Request was canceled",
              stats: {
                query: exactQuery,
                postsFound: 0,
                durationMs: getCurrentUTCTimestamp() - startTime,
              },
            };
          }
        }
        break;
      }

      if (!result) {
        return {
          success: false,
          posts: [],
          hasMore: false,
          error: "Unknown error",
          stats: {
            query: exactQuery,
            postsFound: 0,
            durationMs: getCurrentUTCTimestamp() - startTime,
          },
        };
      }

      const durationMs = getCurrentUTCTimestamp() - startTime;

      if (!result.success) {
        console.error(`[twitter/searchPosts] Search failed: ${result.error}`);
        return {
          success: false,
          posts: [],
          hasMore: false,
          error: result.error,
          stats: {
            query: exactQuery,
            postsFound: 0,
            durationMs,
          },
        };
      }

      console.info(`[twitter/searchPosts] Search completed`, {
        query: exactQuery,
        postsFound: result.posts.length,
        hasMore: result.hasMore,
      });

      return {
        success: true,
        posts: result.posts,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        stats: {
          query: exactQuery,
          postsFound: result.posts.length,
          durationMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[twitter/searchPosts] Unexpected error: ${errorMessage}`);
      return {
        success: false,
        posts: [],
        hasMore: false,
        error: `Failed to search: ${errorMessage}`,
        stats: {
          query: exactQuery,
          postsFound: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }
  },
});

export const searchRaw = action({
  args: {
    query: v.string(),
    type: v.optional(twitterSearchTypeValidator),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SearchResult> => {
    const startTime = getCurrentUTCTimestamp();
    const rawQuery = args.query.trim();

    if (!rawQuery) {
      return {
        success: false,
        posts: [],
        hasMore: false,
        error: "Query cannot be empty",
        stats: {
          query: args.query,
          postsFound: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    try {
      const runId = await retrier.run(
        ctx,
        internal.integrations.twitter.searchPosts.searchInternal,
        {
          query: rawQuery,
          type: args.type,
          cursor: args.cursor,
        }
      );

      let result: InternalSearchResult | null = null;
      while (true) {
        const status = await retrier.status(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (status.type === "completed") {
          if (status.result.type === "success") {
            result = status.result.returnValue as InternalSearchResult;
          } else if (status.result.type === "failed") {
            return {
              success: false,
              posts: [],
              hasMore: false,
              error: `Failed after retries: ${status.result.error}`,
              stats: {
                query: rawQuery,
                postsFound: 0,
                durationMs: getCurrentUTCTimestamp() - startTime,
              },
            };
          } else {
            return {
              success: false,
              posts: [],
              hasMore: false,
              error: "Request was canceled",
              stats: {
                query: rawQuery,
                postsFound: 0,
                durationMs: getCurrentUTCTimestamp() - startTime,
              },
            };
          }
        }
        break;
      }

      if (!result) {
        return {
          success: false,
          posts: [],
          hasMore: false,
          error: "Unknown error",
          stats: {
            query: rawQuery,
            postsFound: 0,
            durationMs: getCurrentUTCTimestamp() - startTime,
          },
        };
      }

      return {
        success: result.success,
        posts: result.posts,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        error: result.error,
        stats: {
          query: rawQuery,
          postsFound: result.posts.length,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        posts: [],
        hasMore: false,
        error: `Failed to search: ${errorMessage}`,
        stats: {
          query: rawQuery,
          postsFound: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }
  },
});

/**
 * Search Twitter posts with multiple queries (batch) with automatic retry per query.
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
    type: v.optional(twitterSearchTypeValidator),
    maxQueriesPerBatch: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BatchSearchResult> => {
    const startTime = getCurrentUTCTimestamp();

    const uniqueQueries = [
      ...new Set(
        args.queries
          .map((q) => q.trim().toLowerCase())
          .filter((q) => q.length > 0)
      ),
    ];

    const maxQueries = args.maxQueriesPerBatch ?? 20;
    const queriesToExecute = uniqueQueries.slice(0, maxQueries);

    if (queriesToExecute.length === 0) {
      console.warn("[twitter/searchPosts] No valid queries provided");
      return {
        success: false,
        posts: [],
        matchedQueriesByPostId: {},
        errors: [{ query: "*", error: "No valid queries provided" }],
        queryStats: [],
        stats: {
          queriesExecuted: 0,
          queriesSucceeded: 0,
          queriesFailed: 0,
          totalPostsFound: 0,
          uniquePosts: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    console.info(`[twitter/searchPosts] Starting batch search`, {
      queriesCount: queriesToExecute.length,
    });

    // Kick off all queries with retrier plus a small launch stagger.
    const runPromises: Array<{
      query: string;
      runIdPromise: Promise<RunId>;
    }> = [];

    for (let i = 0; i < queriesToExecute.length; i++) {
      const query = queriesToExecute[i];
      const exactQuery = buildExactPhraseQuery(query);
      const queryWithTimeLimit = buildQueryWithTimeLimit(exactQuery);

      const delay = i * 75;

      const runIdPromise = new Promise<RunId>((resolve, reject) => {
        void (async () => {
          try {
            await new Promise((r) => setTimeout(r, delay));
            const runId = await retrier.run(
              ctx,
              internal.integrations.twitter.searchPosts.searchInternal,
              {
                query: queryWithTimeLimit,
                type: args.type,
              }
            );
            resolve(runId);
          } catch (error) {
            reject(error);
          }
        })();
      });

      runPromises.push({ query: exactQuery, runIdPromise });
    }

    // Wait for all retrier runs to be initiated
    const runIds: Array<{
      query: string;
      runId: RunId | null;
      error?: string;
    }> = [];
    for (const { query, runIdPromise } of runPromises) {
      try {
        const runId = await runIdPromise;
        runIds.push({ query, runId });
      } catch (error) {
        runIds.push({
          query,
          runId: null,
          error: error instanceof Error ? error.message : "Failed to start",
        });
      }
    }

    // Poll all runs for completion
    const allPosts: TwitterPost[] = [];
    const matchedQueriesByPostId = new Map<string, Set<string>>();
    const errors: Array<{ query: string; error: string }> = [];
    const queryStats: Array<{
      query: string;
      postsFound: number;
      success: boolean;
      error?: string;
    }> = [];
    let queriesSucceeded = 0;
    let totalPostsFound = 0;

    for (const { query, runId, error: startError } of runIds) {
      if (!runId) {
        errors.push({ query, error: startError ?? "Failed to start" });
        queryStats.push({
          query,
          postsFound: 0,
          success: false,
          error: startError ?? "Failed to start",
        });
        continue;
      }

      try {
        // Poll for this run's completion
        let result: InternalSearchResult | null = null;
        let attempts = 0;
        const maxAttempts = 120; // 60 seconds max wait

        while (attempts < maxAttempts) {
          const status = await retrier.status(ctx, runId);
          if (status.type === "inProgress") {
            await new Promise((resolve) => setTimeout(resolve, 500));
            attempts++;
            continue;
          }

          if (status.type === "completed") {
            if (status.result.type === "success") {
              result = status.result.returnValue as InternalSearchResult;
            } else if (status.result.type === "failed") {
              errors.push({ query, error: status.result.error });
            } else {
              errors.push({ query, error: "Request was canceled" });
            }
          }
          break;
        }

        if (attempts >= maxAttempts) {
          errors.push({ query, error: "Timeout waiting for result" });
          queryStats.push({
            query,
            postsFound: 0,
            success: false,
            error: "Timeout waiting for result",
          });
          continue;
        }

        if (result && result.success) {
          allPosts.push(...result.posts);
          totalPostsFound += result.posts.length;
          queriesSucceeded++;
          queryStats.push({
            query,
            postsFound: result.posts.length,
            success: true,
          });

          for (const post of result.posts) {
            const existingQueries =
              matchedQueriesByPostId.get(post.id_str) ?? new Set<string>();
            existingQueries.add(query);
            matchedQueriesByPostId.set(post.id_str, existingQueries);
          }

          console.info(`[twitter/searchPosts] Query completed`, {
            query,
            postsFound: result.posts.length,
          });
        } else if (result && !result.success) {
          errors.push({ query, error: result.error ?? "Unknown error" });
          queryStats.push({
            query,
            postsFound: 0,
            success: false,
            error: result.error ?? "Unknown error",
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ query, error: errorMessage });
        queryStats.push({
          query,
          postsFound: 0,
          success: false,
          error: errorMessage,
        });
      }
    }

    const uniquePosts = deduplicatePosts(allPosts);
    const durationMs = getCurrentUTCTimestamp() - startTime;

    console.info(`[twitter/searchPosts] Batch search completed`, {
      queriesCount: queriesToExecute.length,
      totalPostsFound,
      uniquePosts: uniquePosts.length,
    });

    return {
      success: queriesSucceeded > 0,
      posts: uniquePosts,
      matchedQueriesByPostId: Object.fromEntries(
        Array.from(matchedQueriesByPostId.entries()).map(
          ([postId, queries]) => [postId, Array.from(queries)]
        )
      ),
      errors,
      queryStats,
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

export const searchRawBatch = action({
  args: {
    queries: v.array(v.string()),
    type: v.optional(twitterSearchTypeValidator),
    maxQueriesPerBatch: v.optional(v.number()),
    cursorsByQuery: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<BatchSearchResult> => {
    const startTime = getCurrentUTCTimestamp();
    const queriesToExecute = normalizeQueryList(args.queries).slice(
      0,
      args.maxQueriesPerBatch ?? 20
    );
    const cursorsByQuery = (args.cursorsByQuery ?? {}) as Record<
      string,
      string | undefined
    >;

    if (queriesToExecute.length === 0) {
      return {
        success: false,
        posts: [],
        matchedQueriesByPostId: {},
        queryResults: [],
        errors: [{ query: "*", error: "No valid queries provided" }],
        queryStats: [],
        stats: {
          queriesExecuted: 0,
          queriesSucceeded: 0,
          queriesFailed: 0,
          totalPostsFound: 0,
          uniquePosts: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    const runPromises: Array<{
      query: string;
      runIdPromise: Promise<RunId>;
    }> = [];

    for (let index = 0; index < queriesToExecute.length; index += 1) {
      const query = queriesToExecute[index];
      const delay = index * 75;
      const runIdPromise = new Promise<RunId>((resolve, reject) => {
        void (async () => {
          try {
            await new Promise((r) => setTimeout(r, delay));
            resolve(
              await retrier.run(
                ctx,
                internal.integrations.twitter.searchPosts.searchInternal,
                {
                  query,
                  type: args.type,
                  cursor: cursorsByQuery[query],
                }
              )
            );
          } catch (error) {
            reject(error);
          }
        })();
      });

      runPromises.push({ query, runIdPromise });
    }

    const runIds: Array<{
      query: string;
      runId: RunId | null;
      error?: string;
    }> = [];
    for (const { query, runIdPromise } of runPromises) {
      try {
        runIds.push({ query, runId: await runIdPromise });
      } catch (error) {
        runIds.push({
          query,
          runId: null,
          error: error instanceof Error ? error.message : "Failed to start",
        });
      }
    }

    const allPosts: TwitterPost[] = [];
    const matchedQueriesByPostId = new Map<string, Set<string>>();
    const errors: Array<{ query: string; error: string }> = [];
    const queryResults: Array<{
      query: string;
      posts: TwitterPost[];
      nextCursor?: string;
      hasMore: boolean;
      success: boolean;
      error?: string;
    }> = [];
    const queryStats: Array<{
      query: string;
      postsFound: number;
      success: boolean;
      error?: string;
    }> = [];
    let queriesSucceeded = 0;
    let totalPostsFound = 0;

    for (const { query, runId, error: startError } of runIds) {
      if (!runId) {
        errors.push({ query, error: startError ?? "Failed to start" });
        queryStats.push({
          query,
          postsFound: 0,
          success: false,
          error: startError ?? "Failed to start",
        });
        queryResults.push({
          query,
          posts: [],
          hasMore: false,
          success: false,
          error: startError ?? "Failed to start",
        });
        continue;
      }

      let result: InternalSearchResult | null = null;
      let attempts = 0;
      while (attempts < 120) {
        const status = await retrier.status(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          attempts += 1;
          continue;
        }

        if (status.type === "completed") {
          if (status.result.type === "success") {
            result = status.result.returnValue as InternalSearchResult;
          } else if (status.result.type === "failed") {
            errors.push({ query, error: status.result.error });
          } else {
            errors.push({ query, error: "Request was canceled" });
          }
        }
        break;
      }

      if (attempts >= 120) {
        errors.push({ query, error: "Timeout waiting for result" });
        queryStats.push({
          query,
          postsFound: 0,
          success: false,
          error: "Timeout waiting for result",
        });
        queryResults.push({
          query,
          posts: [],
          hasMore: false,
          success: false,
          error: "Timeout waiting for result",
        });
        continue;
      }

      if (result?.success) {
        allPosts.push(...result.posts);
        totalPostsFound += result.posts.length;
        queriesSucceeded += 1;
        queryStats.push({
          query,
          postsFound: result.posts.length,
          success: true,
        });

        for (const post of result.posts) {
          const queries = matchedQueriesByPostId.get(post.id_str) ?? new Set();
          queries.add(query);
          matchedQueriesByPostId.set(post.id_str, queries);
        }
        queryResults.push({
          query,
          posts: result.posts,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          success: true,
        });
      } else if (result && !result.success) {
        errors.push({ query, error: result.error ?? "Unknown error" });
        queryStats.push({
          query,
          postsFound: 0,
          success: false,
          error: result.error ?? "Unknown error",
        });
        queryResults.push({
          query,
          posts: [],
          hasMore: false,
          success: false,
          error: result.error ?? "Unknown error",
        });
      }
    }

    const uniquePosts = deduplicatePosts(allPosts);

    return {
      success: queriesSucceeded > 0,
      posts: uniquePosts,
      matchedQueriesByPostId: Object.fromEntries(
        Array.from(matchedQueriesByPostId.entries()).map(
          ([postId, queries]) => [postId, Array.from(queries)]
        )
      ),
      queryResults,
      errors,
      queryStats,
      stats: {
        queriesExecuted: queriesToExecute.length,
        queriesSucceeded,
        queriesFailed: errors.length,
        totalPostsFound,
        uniquePosts: uniquePosts.length,
        durationMs: getCurrentUTCTimestamp() - startTime,
      },
    };
  },
});
