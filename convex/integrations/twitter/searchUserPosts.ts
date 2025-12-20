"use node";

// convex/integrations/twitter/searchUserPosts.ts
// Search for a user's posts containing specific keywords for qualification evidence

import { action, internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { retrier } from "../../lib/retrier";
import type { TwitterPost } from "./searchPosts";

// ============================================================================
// Logging
// ============================================================================

interface LogContext {
  operation: string;
  screenName?: string;
  keyword?: string;
  postsFound?: number;
  error?: string;
  durationMs?: number;
  keywordCount?: number;
  batchCount?: number;
  queryCount?: number;
  batches?: string[];
}

function log(
  level: "info" | "warn" | "error",
  message: string,
  context: LogContext
) {
  const logData = {
    timestamp: new Date().toISOString(),
    service: "twitter/searchUserPosts",
    level,
    message,
    ...context,
  };

  if (level === "error") {
    console.error("[twitter/searchUserPosts]", JSON.stringify(logData, null, 2));
  } else if (level === "warn") {
    console.warn("[twitter/searchUserPosts]", JSON.stringify(logData, null, 2));
  } else {
    console.log("[twitter/searchUserPosts]", JSON.stringify(logData, null, 2));
  }
}

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

// ============================================================================
// Helpers
// ============================================================================

function getApiKey(): string | null {
  return process.env.SOCIALAPI_API_KEY ?? null;
}

/**
 * Build search query for user posts with keyword.
 * Uses from:screen_name operator (Twitter's required format).
 * Note: Twitter search requires username (screen_name), not numeric user ID.
 */
function buildUserKeywordQuery(screenName: string, keyword: string, exactPhrase: boolean): string {
  const keywordPart = exactPhrase ? `"${keyword}"` : keyword;
  return `from:${screenName} ${keywordPart}`;
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

/**
 * Internal action that performs the actual HTTP fetch to Twitter API.
 * Handles pagination internally - loops until maxPosts reached or no more pages.
 * Throws on failure so the retrier can catch and retry.
 */
export const searchUserPostsInternal = internalAction({
  args: {
    query: v.string(),
    maxPosts: v.optional(v.number()), // Default 20, max posts to collect
  },
  handler: async (_, args): Promise<InternalSearchResult> => {
    const apiKey = getApiKey();
    const maxPosts = args.maxPosts ?? 20;
    const MAX_PAGES = 5; // Safety limit to prevent infinite loops

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
    while (allPosts.length < maxPosts && page < MAX_PAGES) {
      const params = new URLSearchParams();
      params.set("query", args.query);
      params.set("type", "Latest");
      if (cursor) {
        params.set("cursor", cursor);
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
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const tweets = data.tweets ?? [];
      
      allPosts.push(...tweets);
      page++;

      // Check if more pages available
      if (!data.next_cursor || tweets.length === 0) {
        break; // No more pages
      }

      cursor = data.next_cursor;

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
    const startTime = Date.now();
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
          durationMs: Date.now() - startTime,
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
          durationMs: Date.now() - startTime,
        },
      };
    }

    log("info", "Starting user posts search (Parallel Batched)", {
      operation: "searchUserPosts",
      screenName: args.screenName,
      keywordCount: args.keywords.length,
    });


    // 1. Create Queries
    // SocialAPI format: from:username keyword keyword keyword
    // According to Twitter search operators, space-separated keywords work as AND
    // We create one query per keyword for better reliability
    const queries: string[] = args.keywords.map(
      (keyword) => `from:${args.screenName} ${keyword}`
    );

    log("info", "Created search queries", {
      operation: "searchUserPosts",
      screenName: args.screenName,
      queryCount: queries.length,
      batches: queries,
    });

    // 2. Execute Batches in Parallel
    // Each query gets a proportional share of maxPosts to collect
    const allPosts: TwitterPost[] = [];
    const postsPerQuery = Math.ceil(maxPosts / queries.length);
    
    const results = await Promise.allSettled(
      queries.map(async (query: string) => {
        // Use retrier for each batch with pagination support
         const runId = await retrier.run(
          ctx,
          internal.integrations.twitter.searchUserPosts.searchUserPostsInternal,
          { query, maxPosts: postsPerQuery }
        );

        // Poll for completion (short timeout per batch since we want speed)
        // Twitter API is usually fast.
        const maxAttempts = 30; // 15 seconds max
        for (let i = 0; i < maxAttempts; i++) {
            const status = await retrier.status(ctx, runId);
            if (status.type === "completed") {
                if (status.result.type === "success") {
                    return (status.result.returnValue as InternalSearchResult).posts;
                } else if (status.result.type === "failed") {
                    throw new Error(status.result.error);
                } else {
                    throw new Error("Action canceled or unknown error");
                }
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error("Timeout waiting for search batch");
      })
    );

    // 3. Process Results
    for (const result of results) {
        if (result.status === 'fulfilled') {
            allPosts.push(...result.value);
        } else {
            // Log failure but continue with other batches
             log("warn", `Batch failed: ${result.reason}`, {
                 operation: "searchUserPosts",
                 screenName: args.screenName,
                 error: String(result.reason)
            });
        }
    }

    const uniquePosts = deduplicatePosts(allPosts).slice(0, maxPosts);

    // 4. Identify Matched Keywords locally
    // Since we used OR queries, we check which keywords are present in the found posts
    const matchedKeywordsSet = new Set<string>();
    const lowerKeywords = args.keywords.map(k => k.toLowerCase());
    
    for (const post of uniquePosts) {
        const text = (post.full_text || post.text || "").toLowerCase();
        for (const kw of lowerKeywords) {
            if (text.includes(kw)) {
                matchedKeywordsSet.add(kw);
            }
        }
    }

    const durationMs = Date.now() - startTime;

    log("info", "User posts search completed", {
      operation: "searchUserPosts",
      screenName: args.screenName,
      postsFound: uniquePosts.length,
      durationMs,
    });

    return {
      success: uniquePosts.length > 0,
      posts: uniquePosts,
      matchedKeywords: Array.from(matchedKeywordsSet),
      stats: {
        screenName: args.screenName,
        keywordsSearched: args.keywords.length,
        totalPostsFound: allPosts.length,
        uniquePosts: uniquePosts.length,
        durationMs,
      },
    };
  },
});
