"use node";

// convex/integrations/twitter/searchPosts.ts
// Twitter post search via socialapi.io with exact phrase matching and automatic retry

import { action, internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { getRetriedActionStatus, runRetriedAction } from "../../lib/retrier";
import { logger } from "../../../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import type { RunId } from "@convex-dev/action-retrier";
import { fetchSocialApi } from "../../lib/socialApiFetch";
import {
  twitterProspectingQueryPlanValidator,
  twitterSearchTypeValidator,
} from "../../validators";
import {
  compactTwitterSearchPost,
  compactTwitterSearchResults,
  normalizeTwitterSearchCursor,
  type TwitterPost,
} from "../../lib/twitterSearchResultCore";
import {
  buildTwitterProspectingProviderQuery,
  getNextTwitterSearchCursor,
  getNewestTwitterPostId,
  type TwitterProspectingQueryPlan,
  type TwitterQueryStat,
} from "../../lib/twitterProspectingSearchCore";
import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
export type {
  TwitterPost,
  TwitterUser,
} from "../../lib/twitterSearchResultCore";
const twitterSearchPostsLogger = logger.withScope("TwitterSearchPosts");

// ============================================================================
// Types
// ============================================================================

/** socialapi.io search response */
interface ApiResponse {
  next_cursor?: unknown;
  tweets?: unknown[];
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

export interface ProspectingBatchSearchResult extends BatchSearchResult {
  exactFallbackQueries: string[];
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
export function flattenTweetForStorage(tweet: unknown): TwitterPost | null {
  return compactTwitterSearchPost(tweet);
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
    workspaceId: v.optional(v.id("workspaces")),
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

    const response = await fetchSocialApi(
      ctx,
      "twitter.searchPosts.searchInternal",
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
      args.workspaceId ? { workspaceId: args.workspaceId } : undefined
    );

    if (!response.ok) {
      const errorText = await response.text();
      // Throw to trigger retry for transient failures
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data: ApiResponse = await response.json();

    const nextCursor = normalizeTwitterSearchCursor(data.next_cursor);

    return {
      success: true,
      posts: compactTwitterSearchResults(data.tweets ?? []),
      nextCursor,
      hasMore: nextCursor !== undefined,
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
      twitterSearchPostsLogger.warn("Empty query provided");
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

    try {
      // Use retrier to run the internal action with automatic retry
      const runId = await runRetriedAction(
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
        const status = await getRetriedActionStatus(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (status.type === "completed") {
          if (status.result.type === "success") {
            result = status.result.returnValue as InternalSearchResult;
          } else if (status.result.type === "failed") {
            twitterSearchPostsLogger.error(
              "Search retrier exhausted all retries",
              { query: exactQuery },
              new Error(status.result.error)
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
        twitterSearchPostsLogger.error("Search failed", {
          query: exactQuery,
          errorMessage: result.error ?? "Unknown error",
        });
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
      twitterSearchPostsLogger.error(
        "Unexpected search error",
        { query: exactQuery },
        error instanceof Error ? error : new Error(String(errorMessage))
      );
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
      const runId = await runRetriedAction(
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
        const status = await getRetriedActionStatus(ctx, runId);
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
      twitterSearchPostsLogger.warn("No valid queries provided");
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
            const runId = await runRetriedAction(
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
          const status = await getRetriedActionStatus(ctx, runId);
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
              await runRetriedAction(
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
        const status = await getRetriedActionStatus(ctx, runId);
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

type ProspectingQueryPageResult = {
  success: boolean;
  posts: TwitterPost[];
  pagesFetched: number;
  error?: string;
};

async function runProspectingSearchPage(
  ctx: ActionCtx,
  args: {
    workspaceId: Id<"workspaces">;
    query: string;
    type: "Latest" | "Top";
    cursor?: string;
  }
): Promise<InternalSearchResult> {
  const runId = await runRetriedAction(
    ctx,
    internal.integrations.twitter.searchPosts.searchInternal,
    args
  );

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await getRetriedActionStatus(ctx, runId);
    if (status.type === "inProgress") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }

    if (status.type === "completed") {
      if (status.result.type === "success") {
        return status.result.returnValue as InternalSearchResult;
      }
      if (status.result.type === "failed") {
        return {
          success: false,
          posts: [],
          hasMore: false,
          error: status.result.error,
        };
      }
      return {
        success: false,
        posts: [],
        hasMore: false,
        error: "Request was canceled",
      };
    }
  }

  return {
    success: false,
    posts: [],
    hasMore: false,
    error: "Timeout waiting for result",
  };
}

async function collectProspectingQueryPages(
  ctx: ActionCtx,
  args: {
    workspaceId: Id<"workspaces">;
    query: string;
    type: "Latest" | "Top";
    maxPages: number;
  }
): Promise<ProspectingQueryPageResult> {
  const postsById = new Map<string, TwitterPost>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let pagesFetched = 0;
  let error: string | undefined;

  for (let page = 0; page < args.maxPages; page += 1) {
    const result = await runProspectingSearchPage(ctx, {
      workspaceId: args.workspaceId,
      query: args.query,
      type: args.type,
      cursor,
    });

    if (!result.success) {
      error = result.error ?? "Unknown SocialAPI search error";
      break;
    }

    pagesFetched += 1;
    for (const post of result.posts) {
      postsById.set(post.id_str, post);
    }

    const nextCursor = getNextTwitterSearchCursor({
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      pagePostCount: result.posts.length,
      seenCursors,
    });
    if (!nextCursor) {
      break;
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return {
    success: pagesFetched > 0,
    posts: Array.from(postsById.values()),
    pagesFetched,
    error,
  };
}

/**
 * Durable-workflow search path. It applies freshness/checkpoint constraints,
 * follows a bounded number of SocialAPI cursors, and attributes every request
 * to the originating workspace.
 */
export const searchProspectingBatch = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    queries: v.array(twitterProspectingQueryPlanValidator),
    type: v.optional(twitterSearchTypeValidator),
    maxQueriesPerBatch: v.optional(v.number()),
    maxPagesPerQuery: v.optional(v.number()),
    sinceTimestampSeconds: v.number(),
  },
  handler: async (ctx, args): Promise<ProspectingBatchSearchResult> => {
    const startTime = getCurrentUTCTimestamp();
    const maxQueries = Math.max(
      1,
      Math.min(10, Math.floor(args.maxQueriesPerBatch ?? 10))
    );
    const maxPages = Math.max(
      1,
      Math.min(3, Math.floor(args.maxPagesPerQuery ?? 3))
    );
    const plansByQuery = new Map<string, TwitterProspectingQueryPlan>();
    for (const plan of args.queries) {
      const query = plan.query.trim();
      if (!query || plansByQuery.has(query.toLowerCase())) continue;
      plansByQuery.set(query.toLowerCase(), { ...plan, query });
      if (plansByQuery.size >= maxQueries) break;
    }
    const plans = Array.from(plansByQuery.values());

    if (plans.length === 0) {
      return {
        success: false,
        posts: [],
        matchedQueriesByPostId: {},
        errors: [{ query: "*", error: "No valid queries provided" }],
        queryStats: [],
        exactFallbackQueries: [],
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

    const results = await Promise.all(
      plans.map(async (plan) => {
        const run = async (searchMode: "exact" | "raw") =>
          await collectProspectingQueryPages(ctx, {
            workspaceId: args.workspaceId,
            query: buildTwitterProspectingProviderQuery({
              query: plan.query,
              searchMode,
              sinceTimestampSeconds: args.sinceTimestampSeconds,
              sinceId: plan.sinceId,
            }),
            type: args.type ?? "Latest",
            maxPages,
          });

        try {
          const initial = await run(plan.searchMode);
          const shouldFallback =
            plan.searchMode === "exact" &&
            initial.success &&
            initial.posts.length === 0;
          const fallback = shouldFallback ? await run("raw") : undefined;
          const posts = deduplicatePosts([
            ...initial.posts,
            ...(fallback?.posts ?? []),
          ]);
          const success = fallback?.success ?? initial.success;
          const error = fallback?.error ?? initial.error;
          return {
            plan,
            posts,
            success,
            error,
            pagesFetched: initial.pagesFetched + (fallback?.pagesFetched ?? 0),
            exactFallback: shouldFallback,
          };
        } catch (error) {
          return {
            plan,
            posts: [] as TwitterPost[],
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            pagesFetched: 0,
            exactFallback: false,
          };
        }
      })
    );

    const postsById = new Map<string, TwitterPost>();
    const matchedQueriesByPostId = new Map<string, Set<string>>();
    const errors: Array<{ query: string; error: string }> = [];
    const queryStats: TwitterQueryStat[] = [];

    for (const result of results) {
      if (result.error) {
        errors.push({ query: result.plan.query, error: result.error });
      }
      queryStats.push({
        query: result.plan.query,
        postsFound: result.posts.length,
        pagesFetched: result.pagesFetched,
        newestPostId: getNewestTwitterPostId(result.posts),
        success: result.success,
        error: result.error,
      });
      for (const post of result.posts) {
        postsById.set(post.id_str, post);
        const queries =
          matchedQueriesByPostId.get(post.id_str) ?? new Set<string>();
        queries.add(result.plan.query);
        matchedQueriesByPostId.set(post.id_str, queries);
      }
    }

    const posts = Array.from(postsById.values());
    const successfulResults = results.filter((result) => result.success);
    return {
      success: successfulResults.length > 0,
      posts,
      matchedQueriesByPostId: Object.fromEntries(
        Array.from(matchedQueriesByPostId.entries()).map(
          ([postId, queries]) => [postId, Array.from(queries)]
        )
      ),
      errors,
      queryStats,
      exactFallbackQueries: results
        .filter((result) => result.exactFallback)
        .map((result) => result.plan.query),
      stats: {
        queriesExecuted: plans.length,
        queriesSucceeded: successfulResults.length,
        queriesFailed: results.length - successfulResults.length,
        totalPostsFound: results.reduce(
          (total, result) => total + result.posts.length,
          0
        ),
        uniquePosts: posts.length,
        durationMs: getCurrentUTCTimestamp() - startTime,
      },
    };
  },
});
