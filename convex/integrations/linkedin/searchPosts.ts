"use node";

// convex/integrations/linkedin/searchPosts.ts
// LinkedIn post search via linkdapi.com with exact phrase matching and automatic retry

import { action, internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { retrier } from "../../lib/retrier";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import type { RunId } from "@convex-dev/action-retrier";
import {
  linkedinSortOrderValidator,
  linkedinTimeFilterValidator,
} from "../../validators";

// ============================================================================
// Types
// ============================================================================

/** LinkedIn post author */
export interface LinkedInAuthor {
  name: string;
  headline: string;
  urn: string;
  id: string;
  url: string;
  profilePictureURL: string;
}

/** LinkedIn post timestamp */
export interface LinkedInPostedAt {
  timestamp: number;
  fullDate: string;
  relativeDay: string;
}

/** LinkedIn reaction */
export interface LinkedInReaction {
  reactionType: string;
  reactionCount: number;
}

/** LinkedIn engagements */
export interface LinkedInEngagements {
  totalReactions: number;
  commentsCount: number;
  repostsCount: number;
  reactions: LinkedInReaction[] | null;
}

/** LinkedIn media content */
export interface LinkedInMediaContent {
  type: string;
  url: string;
}

/** LinkedIn post from linkdapi.com search */
export interface LinkedInPost {
  urn: string;
  postID: string;
  postURL: string;
  text: string;
  author: LinkedInAuthor;
  postedAt: LinkedInPostedAt;
  engagements: LinkedInEngagements;
  mediaContent: LinkedInMediaContent[];
}

/** linkdapi.com API response */
interface ApiResponse {
  success: boolean;
  statusCode: number;
  message: string;
  errors: unknown;
  data: {
    posts: LinkedInPost[];
    total: number;
    start: number;
    count: number;
    hasMore: boolean;
  };
}

/** Single search result */
export interface SearchResult {
  success: boolean;
  posts: LinkedInPost[];
  total: number;
  start: number;
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
  posts: LinkedInPost[];
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

/** Internal search result from fetch action */
interface InternalSearchResult {
  success: boolean;
  posts: LinkedInPost[];
  total: number;
  start: number;
  hasMore: boolean;
  error?: string;
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
  return process.env.LINKDAPI_API_KEY ?? null;
}

/**
 * Deduplicates posts by postID
 */
function deduplicatePosts(posts: LinkedInPost[]): LinkedInPost[] {
  const seen = new Map<string, LinkedInPost>();

  for (const post of posts) {
    if (!seen.has(post.postID)) {
      seen.set(post.postID, post);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Internal Actions (for retrier)
// ============================================================================

/**
 * Internal action that performs the actual HTTP fetch to LinkedIn API.
 * Throws on failure so the retrier can catch and retry.
 */
export const searchInternal = internalAction({
  args: {
    query: v.string(),
    start: v.optional(v.number()),
    sortBy: v.optional(linkedinSortOrderValidator),
    datePosted: v.optional(linkedinTimeFilterValidator),
    authorJobTitle: v.optional(v.string()),
  },
  handler: async (_, args): Promise<InternalSearchResult> => {
    const apiKey = getApiKey();

    if (!apiKey) {
      // Don't retry configuration errors
      return {
        success: false,
        posts: [],
        total: 0,
        start: 0,
        hasMore: false,
        error: "LINKDAPI_API_KEY environment variable not set",
      };
    }

    const params = new URLSearchParams();
    params.set("keyword", args.query);
    if (args.start !== undefined) {
      params.set("start", args.start.toString());
    }
    if (args.sortBy) {
      params.set("sortBy", args.sortBy);
    }
    if (args.datePosted) {
      params.set("datePosted", args.datePosted);
    }
    if (args.authorJobTitle) {
      params.set("authorJobTitle", args.authorJobTitle);
    }

    const url = `https://linkdapi.com/api/v1/search/posts?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-linkdapi-apikey": apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Throw to trigger retry for transient failures
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    return {
      success: true,
      posts: data.data.posts ?? [],
      total: data.data.total,
      start: data.data.start,
      hasMore: data.data.hasMore,
    };
  },
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Search LinkedIn posts with exact phrase matching and automatic retry.
 *
 * @example
 * const result = await ctx.runAction(api.integrations.linkedin.searchPosts.search, {
 *   query: "struggling to find customers",
 *   sortBy: "relevance",
 * });
 */
export const search = action({
  args: {
    query: v.string(),
    start: v.optional(v.number()),
    sortBy: v.optional(linkedinSortOrderValidator),
    datePosted: v.optional(linkedinTimeFilterValidator),
    authorJobTitle: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SearchResult> => {
    const startTime = getCurrentUTCTimestamp();

    if (!args.query || args.query.trim().length === 0) {
      console.warn("[linkedin/searchPosts] Empty query provided");
      return {
        success: false,
        posts: [],
        total: 0,
        start: 0,
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

    console.info(`[linkedin/searchPosts] Starting search`, {
      query: exactQuery,
      start: args.start,
    });

    try {
      // Use retrier to run the internal action with automatic retry
      const runId = await retrier.run(
        ctx,
        internal.integrations.linkedin.searchPosts.searchInternal,
        {
          query: exactQuery,
          start: args.start,
          sortBy: args.sortBy,
          datePosted: args.datePosted,
          authorJobTitle: args.authorJobTitle,
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
              `[linkedin/searchPosts] Retrier exhausted all retries`,
              { query: exactQuery, error: status.result.error }
            );
            return {
              success: false,
              posts: [],
              total: 0,
              start: 0,
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
              total: 0,
              start: 0,
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
          total: 0,
          start: 0,
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
        console.error(`[linkedin/searchPosts] Search failed: ${result.error}`);
        return {
          success: false,
          posts: [],
          total: 0,
          start: 0,
          hasMore: false,
          error: result.error,
          stats: {
            query: exactQuery,
            postsFound: 0,
            durationMs,
          },
        };
      }

      console.info(`[linkedin/searchPosts] Search completed`, {
        query: exactQuery,
        postsFound: result.posts.length,
        hasMore: result.hasMore,
      });

      return {
        success: true,
        posts: result.posts,
        total: result.total,
        start: result.start,
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
      console.error(`[linkedin/searchPosts] Unexpected error: ${errorMessage}`);
      return {
        success: false,
        posts: [],
        total: 0,
        start: 0,
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

/**
 * Search LinkedIn posts with multiple queries (batch) with automatic retry per query.
 * Deduplicates results across all queries.
 *
 * @example
 * const result = await ctx.runAction(api.integrations.linkedin.searchPosts.searchBatch, {
 *   queries: ["struggling to find customers", "need help with leads"],
 *   sortBy: "relevance",
 * });
 */
export const searchBatch = action({
  args: {
    queries: v.array(v.string()),
    sortBy: v.optional(linkedinSortOrderValidator),
    datePosted: v.optional(linkedinTimeFilterValidator),
    authorJobTitle: v.optional(v.string()),
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
      console.warn("[linkedin/searchPosts] No valid queries provided");
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
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    console.info(`[linkedin/searchPosts] Starting batch search`, {
      queriesCount: queriesToExecute.length,
    });

    // Kick off all queries with retrier, staggered to respect rate limits
    const runPromises: Array<{
      query: string;
      runIdPromise: Promise<RunId>;
    }> = [];

    for (let i = 0; i < queriesToExecute.length; i++) {
      const query = queriesToExecute[i];
      const exactQuery = buildExactPhraseQuery(query);

      // Stagger starts by 2500ms to respect rate limits (conservative for linkdapi)
      const delay = i * 2500;

      const runIdPromise = new Promise<RunId>(async (resolve, reject) => {
        try {
          await new Promise((r) => setTimeout(r, delay));
          const runId = await retrier.run(
            ctx,
            internal.integrations.linkedin.searchPosts.searchInternal,
            {
              query: exactQuery,
              sortBy: args.sortBy,
              datePosted: args.datePosted,
              authorJobTitle: args.authorJobTitle,
            }
          );
          resolve(runId);
        } catch (error) {
          reject(error);
        }
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
    const allPosts: LinkedInPost[] = [];
    const errors: Array<{ query: string; error: string }> = [];
    let queriesSucceeded = 0;
    let totalPostsFound = 0;

    for (const { query, runId, error: startError } of runIds) {
      if (!runId) {
        errors.push({ query, error: startError ?? "Failed to start" });
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
          continue;
        }

        if (result && result.success) {
          allPosts.push(...result.posts);
          totalPostsFound += result.posts.length;
          queriesSucceeded++;

          console.info(`[linkedin/searchPosts] Query completed`, {
            query,
            postsFound: result.posts.length,
          });
        } else if (result && !result.success) {
          errors.push({ query, error: result.error ?? "Unknown error" });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ query, error: errorMessage });
      }
    }

    const uniquePosts = deduplicatePosts(allPosts);
    const durationMs = getCurrentUTCTimestamp() - startTime;

    console.info(`[linkedin/searchPosts] Batch search completed`, {
      queriesCount: queriesToExecute.length,
      totalPostsFound,
      uniquePosts: uniquePosts.length,
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
