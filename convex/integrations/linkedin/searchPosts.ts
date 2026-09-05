"use node";

// convex/integrations/linkedin/searchPosts.ts
// LinkedIn post search via linkdapi.com with adaptive query execution and retry

import { action, internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { getRetriedActionStatus, runRetriedAction } from "../../lib/retrier";
import { logger } from "../../../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import type { RunId } from "@convex-dev/action-retrier";
import {
  getNextLinkedInPostsSearchStart,
  LINKEDIN_POSTS_DEFAULT_PAGE_SIZE,
  LINKEDIN_POSTS_MAX_PAGES_PER_QUERY,
  normalizeLinkedInPostAuthorJobTitle,
} from "../../lib/linkedinSearchHelpers";
import {
  linkedinSortOrderValidator,
  linkedinTimeFilterValidator,
} from "../../validators";
import { requestLinkdApiData } from "./linkdapiClient";
const linkedInSearchPostsLogger = logger.withScope("LinkedInSearchPosts");

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
  searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
  error?: string;
  stats: {
    query: string;
    postsFound: number;
    durationMs: number;
    searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
  };
}

/** Batch search result */
export interface BatchSearchResult {
  success: boolean;
  posts: LinkedInPost[];
  matchedQueriesByPostId: Record<string, string[]>;
  errors: Array<{ query: string; error: string }>;
  queryStats: Array<{
    query: string;
    postsFound: number;
    success: boolean;
    searchMode?: "plain_relevance" | "plain_date" | "exact_phrase";
    error?: string;
  }>;
  queryResults: Array<{
    authorJobTitle?: string;
    query: string;
    postsFound: number;
    searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
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
  posts: LinkedInPost[];
  total: number;
  start: number;
  count: number;
  hasMore: boolean;
  searchMode?: "plain_relevance" | "plain_date" | "exact_phrase";
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function buildExactPhraseQuery(query: string): string {
  const trimmed = query.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }

  return `"${trimmed}"`;
}

function normalizeQueryList(queries: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const query of queries) {
    const trimmed = query.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function shouldUseExactPhraseFallback(query: string) {
  const trimmed = query.trim();
  if (trimmed.length === 0 || trimmed.length > 40) {
    return false;
  }

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 2 || wordCount > 5) {
    return false;
  }

  return !/[?!.,]/.test(trimmed);
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

const RETRIED_ACTION_POLL_INTERVAL_MS = 500;
const RETRIED_ACTION_MAX_POLL_ATTEMPTS = 120;

async function waitForPostSearchResult(
  ctx: ActionCtx,
  runId: RunId
): Promise<InternalSearchResult> {
  let pollAttempts = 0;

  while (pollAttempts < RETRIED_ACTION_MAX_POLL_ATTEMPTS) {
    const status = await getRetriedActionStatus(ctx, runId);
    if (status.type === "inProgress") {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRIED_ACTION_POLL_INTERVAL_MS)
      );
      pollAttempts += 1;
      continue;
    }

    if (status.type === "completed") {
      if (status.result.type === "success") {
        return status.result.returnValue as InternalSearchResult;
      }

      if (status.result.type === "failed") {
        throw new Error(status.result.error);
      }

      throw new Error("Request was canceled");
    }
  }

  throw new Error("Timeout waiting for result");
}

async function collectPaginatedPostResults(
  ctx: ActionCtx,
  args: {
    query: string;
    searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
    sortBy: "relevance" | "date_posted";
    datePosted?: "past-24h" | "past-week" | "past-month" | "past-year";
    authorJobTitle?: string;
    initialResult: InternalSearchResult;
  }
): Promise<InternalSearchResult> {
  const posts = [...args.initialResult.posts];
  let lastResult = args.initialResult;
  let nextStart = getNextLinkedInPostsSearchStart(
    args.initialResult.start,
    args.initialResult.count || LINKEDIN_POSTS_DEFAULT_PAGE_SIZE
  );
  const seenStarts = new Set<number>([args.initialResult.start]);

  for (
    let pageIndex = 1;
    pageIndex < LINKEDIN_POSTS_MAX_PAGES_PER_QUERY;
    pageIndex += 1
  ) {
    if (!lastResult.hasMore || seenStarts.has(nextStart)) {
      break;
    }

    seenStarts.add(nextStart);

    try {
      const runId = await runRetriedAction(
        ctx,
        internal.integrations.linkedin.searchPosts.searchInternal,
        {
          query: args.query,
          searchMode: args.searchMode,
          start: nextStart,
          sortBy: args.sortBy,
          datePosted: args.datePosted,
          authorJobTitle: args.authorJobTitle,
        }
      );
      const pageResult = await waitForPostSearchResult(ctx, runId);

      posts.push(...pageResult.posts);
      lastResult = pageResult;
      nextStart = getNextLinkedInPostsSearchStart(
        pageResult.start,
        pageResult.count || LINKEDIN_POSTS_DEFAULT_PAGE_SIZE
      );
    } catch {
      break;
    }
  }

  return {
    ...lastResult,
    posts,
    searchMode: args.searchMode,
  };
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
    searchMode: v.optional(
      v.union(
        v.literal("plain_relevance"),
        v.literal("plain_date"),
        v.literal("exact_phrase")
      )
    ),
    start: v.optional(v.number()),
    sortBy: v.optional(linkedinSortOrderValidator),
    datePosted: v.optional(linkedinTimeFilterValidator),
    authorJobTitle: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<InternalSearchResult> => {
    const authorJobTitle = normalizeLinkedInPostAuthorJobTitle(
      args.authorJobTitle
    );
    const data = await requestLinkdApiData<ApiResponse["data"]>(ctx, {
      path: "/api/v1/search/posts",
      query: {
        keyword: args.query,
        start: args.start,
        sortBy: args.sortBy,
        datePosted: args.datePosted,
        authorJobTitle,
      },
      consumer: `linkedin.searchPosts:${args.searchMode ?? "plain_relevance"}:${args.query}`,
    });

    return {
      success: true,
      posts: data.posts ?? [],
      total: data.total,
      start: data.start,
      count: data.count,
      hasMore: data.hasMore,
      searchMode: args.searchMode,
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
      linkedInSearchPostsLogger.warn("Empty query provided");
      return {
        success: false,
        posts: [],
        total: 0,
        start: 0,
        hasMore: false,
        searchMode: "plain_relevance",
        error: "Query cannot be empty",
        stats: {
          query: args.query,
          postsFound: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
          searchMode: "plain_relevance",
        },
      };
    }

    const attempts: Array<{
      query: string;
      searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
      sortBy: "relevance" | "date_posted";
      datePosted?: "past-24h" | "past-week" | "past-month" | "past-year";
    }> = [
      {
        query: args.query.trim(),
        searchMode: "plain_relevance",
        sortBy: args.sortBy ?? "relevance",
        datePosted: args.datePosted,
      },
    ];

    if (args.datePosted === undefined) {
      attempts.push({
        query: args.query.trim(),
        searchMode: "plain_date",
        sortBy: "date_posted",
      });
    }

    if (shouldUseExactPhraseFallback(args.query)) {
      attempts.push({
        query: buildExactPhraseQuery(args.query),
        searchMode: "exact_phrase",
        sortBy: args.sortBy ?? "relevance",
        datePosted: args.datePosted,
      });
    }

    try {
      let finalError = "Unknown error";

      for (const attempt of attempts) {
        const runId = await runRetriedAction(
          ctx,
          internal.integrations.linkedin.searchPosts.searchInternal,
          {
            query: attempt.query,
            searchMode: attempt.searchMode,
            start: args.start,
            sortBy: attempt.sortBy,
            datePosted: attempt.datePosted,
            authorJobTitle: args.authorJobTitle,
          }
        );

        let result: InternalSearchResult | null = null;
        try {
          const initialResult = await waitForPostSearchResult(ctx, runId);
          result = await collectPaginatedPostResults(ctx, {
            query: attempt.query,
            searchMode: attempt.searchMode,
            sortBy: attempt.sortBy,
            datePosted: attempt.datePosted,
            authorJobTitle: args.authorJobTitle,
            initialResult,
          });
        } catch (error) {
          finalError =
            error instanceof Error
              ? `Failed after retries: ${error.message}`
              : "Failed after retries";
        }

        if (!result) {
          continue;
        }

        if (!result.success) {
          finalError = result.error ?? finalError;
          continue;
        }

        if (result.posts.length === 0) {
          continue;
        }

        const durationMs = getCurrentUTCTimestamp() - startTime;
        return {
          success: true,
          posts: result.posts,
          total: result.total,
          start: result.start,
          hasMore: result.hasMore,
          searchMode: attempt.searchMode,
          stats: {
            query: args.query.trim(),
            postsFound: result.posts.length,
            durationMs,
            searchMode: attempt.searchMode,
          },
        };
      }

      return {
        success: false,
        posts: [],
        total: 0,
        start: 0,
        hasMore: false,
        searchMode: "plain_relevance",
        error: finalError,
        stats: {
          query: args.query.trim(),
          postsFound: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
          searchMode: "plain_relevance",
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      linkedInSearchPostsLogger.error(
        "Unexpected search error",
        { query: args.query.trim() },
        error instanceof Error ? error : new Error(String(errorMessage))
      );
      return {
        success: false,
        posts: [],
        total: 0,
        start: 0,
        hasMore: false,
        searchMode: "plain_relevance",
        error: `Failed to search: ${errorMessage}`,
        stats: {
          query: args.query.trim(),
          postsFound: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
          searchMode: "plain_relevance",
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

    const uniqueQueries = normalizeQueryList(args.queries);
    const authorJobTitle = normalizeLinkedInPostAuthorJobTitle(
      args.authorJobTitle
    );

    const maxQueries = args.maxQueriesPerBatch ?? 20;
    const queriesToExecute = uniqueQueries.slice(0, maxQueries);

    if (queriesToExecute.length === 0) {
      linkedInSearchPostsLogger.warn("No valid queries provided");
      return {
        success: false,
        posts: [],
        matchedQueriesByPostId: {},
        errors: [{ query: "*", error: "No valid queries provided" }],
        queryStats: [],
        queryResults: [],
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

    // Kick off all queries with retrier. LinkdAPI pacing is enforced centrally
    // by the shared budget gate in the transport helper.
    const runPromises: Array<{
      query: string;
      attempts: Array<{
        query: string;
        searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
        sortBy: "relevance" | "date_posted";
        datePosted?: "past-24h" | "past-week" | "past-month" | "past-year";
        authorJobTitle?: string;
      }>;
      runIdPromise: Promise<RunId>;
    }> = [];

    for (let i = 0; i < queriesToExecute.length; i++) {
      const query = queriesToExecute[i];
      const baseAttempts: Array<{
        query: string;
        searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
        sortBy: "relevance" | "date_posted";
        datePosted?: "past-24h" | "past-week" | "past-month" | "past-year";
      }> = [
        {
          query,
          searchMode: "plain_relevance",
          sortBy: args.sortBy ?? "relevance",
          datePosted: args.datePosted,
        },
      ];

      if (args.datePosted === undefined) {
        baseAttempts.push({
          query,
          searchMode: "plain_date",
          sortBy: "date_posted",
        });
      }

      if (shouldUseExactPhraseFallback(query)) {
        baseAttempts.push({
          query: buildExactPhraseQuery(query),
          searchMode: "exact_phrase",
          sortBy: args.sortBy ?? "relevance",
          datePosted: args.datePosted,
        });
      }

      const attempts: Array<{
        query: string;
        searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
        sortBy: "relevance" | "date_posted";
        datePosted?: "past-24h" | "past-week" | "past-month" | "past-year";
        authorJobTitle?: string;
      }> = authorJobTitle
        ? [
            ...baseAttempts.map((attempt) => ({
              ...attempt,
              authorJobTitle,
            })),
            ...baseAttempts,
          ]
        : baseAttempts;

      const runIdPromise = new Promise<RunId>((resolve, reject) => {
        void (async () => {
          try {
            const runId = await runRetriedAction(
              ctx,
              internal.integrations.linkedin.searchPosts.searchInternal,
              {
                query: attempts[0].query,
                searchMode: attempts[0].searchMode,
                sortBy: attempts[0].sortBy,
                datePosted: attempts[0].datePosted,
                authorJobTitle: attempts[0].authorJobTitle,
              }
            );
            resolve(runId);
          } catch (error) {
            reject(error);
          }
        })();
      });

      runPromises.push({ query, attempts, runIdPromise });
    }

    // Wait for all retrier runs to be initiated
    const runIds: Array<{
      query: string;
      attempts: Array<{
        query: string;
        searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
        sortBy: "relevance" | "date_posted";
        datePosted?: "past-24h" | "past-week" | "past-month" | "past-year";
        authorJobTitle?: string;
      }>;
      runId: RunId | null;
      error?: string;
    }> = [];
    for (const { query, attempts, runIdPromise } of runPromises) {
      try {
        const runId = await runIdPromise;
        runIds.push({ query, attempts, runId });
      } catch (error) {
        runIds.push({
          query,
          attempts,
          runId: null,
          error: error instanceof Error ? error.message : "Failed to start",
        });
      }
    }

    // Poll all runs for completion
    const allPosts: LinkedInPost[] = [];
    const matchedQueriesByPostId = new Map<string, Set<string>>();
    const errors: Array<{ query: string; error: string }> = [];
    const queryStats: Array<{
      query: string;
      postsFound: number;
      success: boolean;
      searchMode?: "plain_relevance" | "plain_date" | "exact_phrase";
      error?: string;
    }> = [];
    const queryResults: BatchSearchResult["queryResults"] = [];
    let queriesSucceeded = 0;
    let totalPostsFound = 0;

    for (const { query, attempts, runId, error: startError } of runIds) {
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
        let activeRunId: RunId | null = runId;
        let finalMode: "plain_relevance" | "plain_date" | "exact_phrase" =
          attempts[0].searchMode;
        let matched = false;
        let finalError: string | undefined;

        for (
          let attemptIndex = 0;
          attemptIndex < attempts.length;
          attemptIndex += 1
        ) {
          const attempt = attempts[attemptIndex];
          let result: InternalSearchResult | null = null;
          try {
            const initialResult = await waitForPostSearchResult(
              ctx,
              activeRunId!
            );
            result = await collectPaginatedPostResults(ctx, {
              query: attempt.query,
              searchMode: attempt.searchMode,
              sortBy: attempt.sortBy,
              datePosted: attempt.datePosted,
              authorJobTitle: attempt.authorJobTitle,
              initialResult,
            });
          } catch (error) {
            finalError =
              error instanceof Error ? error.message : "Unknown error";
          }

          if (result && result.success && result.posts.length > 0) {
            allPosts.push(...result.posts);
            totalPostsFound += result.posts.length;
            queriesSucceeded++;
            finalMode = attempt.searchMode;
            queryStats.push({
              query,
              postsFound: result.posts.length,
              success: true,
              searchMode: attempt.searchMode,
            });
            queryResults.push({
              authorJobTitle: attempt.authorJobTitle,
              query,
              postsFound: result.posts.length,
              searchMode: attempt.searchMode,
            });

            for (const post of result.posts) {
              const existingQueries =
                matchedQueriesByPostId.get(post.postID) ?? new Set<string>();
              existingQueries.add(query);
              matchedQueriesByPostId.set(post.postID, existingQueries);
            }

            matched = true;
            break;
          }

          if (attemptIndex === attempts.length - 1) {
            finalMode = attempt.searchMode;
            finalError = result?.error ?? finalError;
            break;
          }

          const nextAttempt = attempts[attemptIndex + 1];
          activeRunId = await runRetriedAction(
            ctx,
            internal.integrations.linkedin.searchPosts.searchInternal,
            {
              query: nextAttempt.query,
              searchMode: nextAttempt.searchMode,
              sortBy: nextAttempt.sortBy,
              datePosted: nextAttempt.datePosted,
              authorJobTitle: nextAttempt.authorJobTitle,
            }
          );
        }

        if (!matched) {
          errors.push({ query, error: finalError ?? "Unknown error" });
          queryStats.push({
            query,
            postsFound: 0,
            success: false,
            searchMode: finalMode,
            error: finalError ?? "Unknown error",
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
      queryResults,
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
