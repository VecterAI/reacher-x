"use node";

// convex/integrations/twitter/searchUserPosts.ts
// Search for a user's posts containing specific keywords for qualification evidence

import { action, internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { logger } from "../../../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { acquireSocialApiBudget } from "../../lib/socialApiBudget";
import { type TwitterPost, flattenTweetForStorage } from "./searchPosts";
const twitterSearchUserPostsLogger = logger.withScope("TwitterSearchUserPosts");

// ============================================================================
// Types
// ============================================================================

export interface UserPostsSearchResult {
  success: boolean;
  posts: TwitterPost[];
  matchedKeywords: string[];
  error?: string;
  stats: {
    screenName: string;
    keywordsSearched: number;
    totalPostsFound: number;
    uniquePosts: number;
    durationMs: number;
  };
}

interface InternalSearchResult {
  success: boolean;
  posts: TwitterPost[];
  error?: string;
}

type SocialApiFetchResult =
  | {
      success: true;
      data: Record<string, unknown>;
    }
  | {
      success: false;
      error: string;
      retryable: boolean;
      creditsExhausted: boolean;
    };

const SEARCH_USER_POSTS_MAX_PAGES = 5;
const SEARCH_USER_POSTS_QUERY_CONCURRENCY = 3;
const SOCIAL_API_PAGE_FETCH_MAX_ATTEMPTS = 4;
const SOCIAL_API_RETRY_BASE_MS = 750;
const SOCIAL_API_RETRY_MAX_MS = 6_000;

// ============================================================================
// Helpers
// ============================================================================

function getApiKey(): string | null {
  return process.env.SOCIALAPI_API_KEY ?? null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSocialApiRetryDelayMs(attempt: number): number {
  const backoff = Math.min(
    SOCIAL_API_RETRY_MAX_MS,
    SOCIAL_API_RETRY_BASE_MS * 2 ** attempt
  );
  const jitter = Math.floor(Math.random() * SOCIAL_API_RETRY_BASE_MS);
  return backoff + jitter;
}

function buildUserKeywordQuery(
  screenName: string,
  keyword: string,
  exactPhrase: boolean
): string {
  const keywordPart = exactPhrase ? `"${keyword}"` : keyword;
  return `from:${screenName} ${keywordPart}`;
}

function normalizeKeywords(keywords: string[]): string[] {
  return [
    ...new Set(
      keywords
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0)
    ),
  ];
}

function formatSocialApiError(
  status: number,
  body: string
): {
  error: string;
  retryable: boolean;
  creditsExhausted: boolean;
} {
  const normalizedBody = body.trim();
  const bodySnippet =
    normalizedBody.length > 200
      ? `${normalizedBody.slice(0, 197)}...`
      : normalizedBody;
  const fallbackMessage = bodySnippet || `HTTP ${status}`;

  if (status === 402) {
    return {
      error: `SocialAPI credits exhausted (402 Payment Required): ${fallbackMessage}`,
      retryable: false,
      creditsExhausted: true,
    };
  }

  if (status === 429) {
    return {
      error: `SocialAPI rate limited request (429): ${fallbackMessage}`,
      retryable: true,
      creditsExhausted: false,
    };
  }

  if (status >= 500) {
    return {
      error: `SocialAPI server error (${status}): ${fallbackMessage}`,
      retryable: true,
      creditsExhausted: false,
    };
  }

  return {
    error: `SocialAPI request failed (${status}): ${fallbackMessage}`,
    retryable: status === 408 || status === 409,
    creditsExhausted: false,
  };
}

async function fetchSearchPage(
  ctx: ActionCtx,
  args: { apiKey: string; query: string; cursor?: string }
): Promise<SocialApiFetchResult> {
  for (
    let attempt = 0;
    attempt < SOCIAL_API_PAGE_FETCH_MAX_ATTEMPTS;
    attempt++
  ) {
    const params = new URLSearchParams();
    params.set("query", args.query);
    params.set("type", "Latest");
    if (args.cursor) {
      params.set("cursor", args.cursor);
    }

    const url = `https://api.socialapi.me/twitter/search?${params.toString()}`;

    try {
      await acquireSocialApiBudget(ctx, "twitter.searchUserPosts.page");
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorResult = formatSocialApiError(response.status, errorText);
        if (
          !errorResult.retryable ||
          attempt === SOCIAL_API_PAGE_FETCH_MAX_ATTEMPTS - 1
        ) {
          return {
            success: false,
            error: errorResult.error,
            retryable: errorResult.retryable,
            creditsExhausted: errorResult.creditsExhausted,
          };
        }

        await delay(getSocialApiRetryDelayMs(attempt));
        continue;
      }

      const data = (await response.json()) as Record<string, unknown>;
      return { success: true, data };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown network error";
      if (attempt === SOCIAL_API_PAGE_FETCH_MAX_ATTEMPTS - 1) {
        return {
          success: false,
          error: `SocialAPI request failed: ${errorMessage}`,
          retryable: true,
          creditsExhausted: false,
        };
      }

      await delay(getSocialApiRetryDelayMs(attempt));
    }
  }

  return {
    success: false,
    error: "SocialAPI request failed after all retry attempts",
    retryable: true,
    creditsExhausted: false,
  };
}

function deduplicatePosts(posts: TwitterPost[]): TwitterPost[] {
  const seen = new Map<string, TwitterPost>();
  for (const post of posts) {
    if (!seen.has(post.id_str)) {
      seen.set(post.id_str, post);
    }
  }
  return Array.from(seen.values());
}

/**
 * Internal action that performs the actual HTTP fetch to Twitter API.
 * Handles pagination internally - loops until maxPosts reached or no more pages.
 * Retries transient upstream failures inline so callers can degrade gracefully
 * without emitting noisy retrier component errors for recoverable provider blips.
 */
export const searchUserPostsInternal = internalAction({
  args: {
    query: v.string(),
    maxPosts: v.optional(v.number()), // Default 20, max posts to collect
  },
  handler: async (ctx, args): Promise<InternalSearchResult> => {
    const apiKey = getApiKey();
    const maxPosts = args.maxPosts ?? 20;

    if (!apiKey) {
      return {
        success: false,
        posts: [],
        error: "SOCIALAPI_API_KEY environment variable not set",
      };
    }

    const allPosts: TwitterPost[] = [];
    let cursor: string | undefined = undefined;
    let page = 0;

    // Pagination loop: fetch pages until we have enough posts or no more pages
    while (allPosts.length < maxPosts && page < SEARCH_USER_POSTS_MAX_PAGES) {
      const pageResult = await fetchSearchPage(ctx, {
        apiKey,
        query: args.query,
        cursor,
      });

      if (!pageResult.success) {
        return {
          success: allPosts.length > 0,
          posts: allPosts.slice(0, maxPosts),
          error: pageResult.error,
        };
      }

      const data = pageResult.data;
      const rawTweets = Array.isArray(data.tweets) ? data.tweets : [];
      const tweets: TwitterPost[] = rawTweets.map((tweet) =>
        flattenTweetForStorage(tweet as TwitterPost)
      );

      allPosts.push(...tweets);
      page++;

      // Check if more pages available
      const nextCursor =
        typeof data.next_cursor === "string" ? data.next_cursor : undefined;
      if (!nextCursor || tweets.length === 0) {
        break; // No more pages
      }

      cursor = nextCursor;

      // Small delay between pagination requests to be respectful
      if (allPosts.length < maxPosts) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return {
      success: true,
      posts: allPosts.slice(0, maxPosts),
    };
  },
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Search for a user's posts containing specific keywords.
 * Used for qualification evidence gathering.
 *
 * Strategy:
 * 1. Batch keywords into OR queries (respecting Twitter's 512 char limit)
 * 2. Execute batches in parallel
 * 3. Deduplicate results
 * 4. Match keywords locally
 *
 * @example
 * const result = await ctx.runAction(api.integrations.twitter.searchUserPosts.searchUserPosts, {
 *   screenName: "elonmusk", // Use screen_name (username), NOT numeric user ID
 *   keywords: ["lead gen", "cold outreach", "prospecting"],
 *   maxPosts: 20,
 * });
 */
export const searchUserPosts = action({
  args: {
    screenName: v.string(), // Use screen_name (username) - Twitter's from: operator requires this
    keywords: v.array(v.string()),
    maxPosts: v.optional(v.number()), // Default 20
  },
  handler: async (ctx, args): Promise<UserPostsSearchResult> => {
    const startTime = getCurrentUTCTimestamp();
    const maxPosts = args.maxPosts ?? 20;

    if (!args.screenName || args.screenName.trim().length === 0) {
      return {
        success: false,
        posts: [],
        matchedKeywords: [],
        error: "Screen name (username) is required",
        stats: {
          screenName: args.screenName,
          keywordsSearched: 0,
          totalPostsFound: 0,
          uniquePosts: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    if (args.keywords.length === 0) {
      return {
        success: false,
        posts: [],
        matchedKeywords: [],
        error: "At least one keyword is required",
        stats: {
          screenName: args.screenName,
          keywordsSearched: 0,
          totalPostsFound: 0,
          uniquePosts: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    const normalizedKeywords = normalizeKeywords(args.keywords);
    if (normalizedKeywords.length === 0) {
      return {
        success: false,
        posts: [],
        matchedKeywords: [],
        error: "At least one non-empty keyword is required",
        stats: {
          screenName: args.screenName,
          keywordsSearched: 0,
          totalPostsFound: 0,
          uniquePosts: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    // 1. Create Queries
    // SocialAPI format: from:username keyword keyword keyword
    // We create one query per keyword for better reliability, but we only run a
    // few at once to keep provider load smooth during bursts.
    const queries: string[] = normalizedKeywords.map((keyword) =>
      buildUserKeywordQuery(args.screenName, keyword, false)
    );

    // 2. Execute Batches in Parallel
    // Each query gets a proportional share of maxPosts to collect.
    // We process queries in small chunks to avoid large provider bursts.
    const allPosts: TwitterPost[] = [];
    const postsPerQuery = Math.ceil(maxPosts / queries.length);
    const batchErrors: string[] = [];
    let fatalError: string | undefined;

    for (
      let startIndex = 0;
      startIndex < queries.length;
      startIndex += SEARCH_USER_POSTS_QUERY_CONCURRENCY
    ) {
      const queryChunk = queries.slice(
        startIndex,
        startIndex + SEARCH_USER_POSTS_QUERY_CONCURRENCY
      );
      const chunkResults = await Promise.all(
        queryChunk.map((query) =>
          ctx.runAction(
            internal.integrations.twitter.searchUserPosts
              .searchUserPostsInternal,
            { query, maxPosts: postsPerQuery }
          )
        )
      );

      for (const [index, result] of chunkResults.entries()) {
        const query = queryChunk[index];
        if (result.posts.length > 0) {
          allPosts.push(...result.posts);
        }

        if (!result.success && result.error) {
          batchErrors.push(result.error);
          twitterSearchUserPostsLogger.warn("Batch failed for query", {
            screenName: args.screenName,
            query,
            errorMessage: result.error,
          });

          if (result.error.includes("credits exhausted")) {
            fatalError = result.error;
          }
        }
      }

      if (fatalError) {
        break;
      }

      if (deduplicatePosts(allPosts).length >= maxPosts) {
        break;
      }
    }

    // 3. Process Results
    const uniquePosts = deduplicatePosts(allPosts).slice(0, maxPosts);

    // 4. Identify Matched Keywords locally
    const matchedKeywordsSet = new Set<string>();
    const lowerKeywords = normalizedKeywords.map((keyword) =>
      keyword.toLowerCase()
    );

    for (const post of uniquePosts) {
      const text = (post.full_text || post.text || "").toLowerCase();
      for (const kw of lowerKeywords) {
        if (text.includes(kw)) {
          matchedKeywordsSet.add(kw);
        }
      }
    }

    const durationMs = getCurrentUTCTimestamp() - startTime;
    const aggregatedError =
      fatalError ??
      (uniquePosts.length === 0 && batchErrors.length > 0
        ? Array.from(new Set(batchErrors)).join(" | ")
        : undefined);

    if (aggregatedError) {
      twitterSearchUserPostsLogger.warn(
        "User posts search completed with provider degradation",
        {
          screenName: args.screenName,
          postsFound: uniquePosts.length,
          durationMs,
          errorMessage: aggregatedError,
        }
      );
    }

    return {
      success: uniquePosts.length > 0,
      posts: uniquePosts,
      matchedKeywords: Array.from(matchedKeywordsSet),
      error: aggregatedError,
      stats: {
        screenName: args.screenName,
        keywordsSearched: normalizedKeywords.length,
        totalPostsFound: allPosts.length,
        uniquePosts: uniquePosts.length,
        durationMs,
      },
    };
  },
});
