"use node";

// convex/integrations/linkedin/searchUserPosts.ts
// Search for a user's posts containing specific keywords for qualification evidence

import { action, internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { retrier } from "../../lib/retrier";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { requestLinkdApiData } from "./linkdapiClient";

// ============================================================================
// Logging
// ============================================================================

interface LogContext {
  operation: string;
  urn?: string;
  keyword?: string;
  postsFound?: number;
  error?: string;
  durationMs?: number;
}

function log(
  level: "info" | "warn" | "error",
  message: string,
  context: LogContext
) {
  const logData = {
    timestamp: new Date().toISOString(),
    service: "linkedin/searchUserPosts",
    level,
    message,
    ...context,
  };

  if (level === "error") {
    console.error(
      "[linkedin/searchUserPosts]",
      JSON.stringify(logData, null, 2)
    );
  } else if (level === "warn") {
    console.warn(
      "[linkedin/searchUserPosts]",
      JSON.stringify(logData, null, 2)
    );
  } else {
    console.info(
      "[linkedin/searchUserPosts]",
      JSON.stringify(logData, null, 2)
    );
  }
}

// ============================================================================
// Types
// ============================================================================

export interface LinkedInPost {
  urn: string;
  postID: string;
  postURL: string;
  text: string;
  author: {
    name: string;
    headline: string;
    urn: string;
    id: string;
    url: string;
    profilePictureURL?: string;
  };
  postedAt: {
    timestamp: number;
    fullDate: string;
    relativeDay: string;
  };
  engagements: {
    totalReactions: number;
    commentsCount: number;
    repostsCount: number;
    reactions?: Array<{
      reactionType: string;
      reactionCount: number;
    }>;
  };
  mediaContent?: Array<{
    type: string;
    url: string;
  }>;
}

export interface UserPostsSearchResult {
  success: boolean;
  posts: LinkedInPost[];
  matchedKeywords: string[];
  error?: string;
  stats: {
    urn: string;
    keywordsSearched: number;
    totalPostsFound: number;
    uniquePosts: number;
    durationMs: number;
  };
}

interface InternalSearchResult {
  success: boolean;
  posts: LinkedInPost[];
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

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

/**
 * Internal action that performs the actual HTTP fetch to LinkedIn API.
 * Handles pagination internally - loops until maxPosts reached or no more pages.
 * Uses `start` offset for pagination (LinkdAPI style).
 */
export const searchUserPostsInternal = internalAction({
  args: {
    urn: v.string(),
    keyword: v.optional(v.string()),
    datePosted: v.optional(v.string()), // "past-24h", "past-week", "past-month", "past-year"
    maxPosts: v.optional(v.number()), // Default 20, max posts to collect
  },
  handler: async (ctx, args): Promise<InternalSearchResult> => {
    const maxPosts = args.maxPosts ?? 20;
    const MAX_PAGES = 5; // Safety limit
    const PAGE_SIZE = 10; // LinkdAPI default page size

    const allPosts: LinkedInPost[] = [];
    let start = 0;
    let page = 0;

    // Pagination loop: fetch pages until we have enough posts or no more pages
    while (allPosts.length < maxPosts && page < MAX_PAGES) {
      const data = await requestLinkdApiData<{
        posts?: LinkedInPost[];
        hasMore?: boolean;
      }>(ctx, {
        path: "/api/v1/search/posts",
        query: {
          fromMember: args.urn,
          sortBy: "date_posted",
          start,
          keyword: args.keyword,
          datePosted: args.datePosted,
        },
        consumer: `linkedin.searchUserPosts:${args.urn}:${args.keyword ?? "all"}:${start}`,
      });

      const posts = data.posts ?? [];
      allPosts.push(...posts);
      page++;

      // Check if more pages available
      if (!data.hasMore || posts.length === 0) {
        break; // No more pages
      }

      start += PAGE_SIZE;
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
 * 1. Try with keyword + date filter (past-month)
 * 2. If no results, try without date filter
 * 3. Search all keywords in parallel
 * 4. Deduplicate results
 *
 * @example
 * const result = await ctx.runAction(api.integrations.linkedin.searchUserPosts.searchUserPosts, {
 *   urn: "ACoAABYrFkMBC7rsx_EOLFLBZrG7-N-IDnL2aCQ", // Use URN, not username
 *   keywords: ["lead gen", "cold outreach", "prospecting"],
 *   maxPosts: 20,
 * });
 */
export const searchUserPosts = action({
  args: {
    urn: v.string(), // Use URN (stable), not username
    keywords: v.array(v.string()),
    maxPosts: v.optional(v.number()), // Default 20
  },
  handler: async (ctx, args): Promise<UserPostsSearchResult> => {
    const startTime = getCurrentUTCTimestamp();
    const maxPosts = args.maxPosts ?? 20;

    if (!args.urn || args.urn.trim().length === 0) {
      return {
        success: false,
        posts: [],
        matchedKeywords: [],
        error: "URN is required",
        stats: {
          urn: args.urn,
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
          urn: args.urn,
          keywordsSearched: 0,
          totalPostsFound: 0,
          uniquePosts: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    log("info", "Starting user posts search", {
      operation: "searchUserPosts",
      urn: args.urn,
    });

    const allPosts: LinkedInPost[] = [];
    const matchedKeywords: string[] = [];

    // Search each keyword (with staggering)
    for (let i = 0; i < args.keywords.length; i++) {
      const keyword = args.keywords[i];

      // Check if we already have enough posts
      if (deduplicatePosts(allPosts).length >= maxPosts) {
        break;
      }

      let posts: LinkedInPost[] = [];

      try {
        // Add stagger delay (500ms between requests)
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }

        // Try with past-month filter first
        const postsNeeded = maxPosts - deduplicatePosts(allPosts).length;
        const runId = await retrier.run(
          ctx,
          internal.integrations.linkedin.searchUserPosts
            .searchUserPostsInternal,
          {
            urn: args.urn,
            keyword,
            datePosted: "past-month",
            maxPosts: postsNeeded,
          }
        );

        // Poll for completion
        let result: InternalSearchResult | null = null;
        let attempts = 0;
        const maxAttempts = 60; // 30 seconds max

        while (attempts < maxAttempts) {
          const status = await retrier.status(ctx, runId);
          if (status.type === "inProgress") {
            await new Promise((r) => setTimeout(r, 500));
            attempts++;
            continue;
          }
          if (status.type === "completed" && status.result.type === "success") {
            result = status.result.returnValue as InternalSearchResult;
          }
          break;
        }

        if (result?.success && result.posts.length > 0) {
          posts = result.posts;
        } else {
          // Fallback: try without date filter
          const fallbackPostsNeeded =
            maxPosts - deduplicatePosts(allPosts).length;
          const fallbackRunId = await retrier.run(
            ctx,
            internal.integrations.linkedin.searchUserPosts
              .searchUserPostsInternal,
            { urn: args.urn, keyword, maxPosts: fallbackPostsNeeded }
          );

          attempts = 0;
          while (attempts < maxAttempts) {
            const status = await retrier.status(ctx, fallbackRunId);
            if (status.type === "inProgress") {
              await new Promise((r) => setTimeout(r, 500));
              attempts++;
              continue;
            }
            if (
              status.type === "completed" &&
              status.result.type === "success"
            ) {
              result = status.result.returnValue as InternalSearchResult;
              if (result?.success) {
                posts = result.posts;
              }
            }
            break;
          }
        }

        if (posts.length > 0) {
          allPosts.push(...posts);
          matchedKeywords.push(keyword);
          log("info", "Found posts for keyword", {
            operation: "searchUserPosts",
            urn: args.urn,
            keyword,
            postsFound: posts.length,
          });
        }
      } catch (error) {
        log("warn", "Failed to search keyword", {
          operation: "searchUserPosts",
          urn: args.urn,
          keyword,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Continue with other keywords
      }
    }

    const uniquePosts = deduplicatePosts(allPosts).slice(0, maxPosts);
    const durationMs = getCurrentUTCTimestamp() - startTime;

    log("info", "User posts search completed", {
      operation: "searchUserPosts",
      urn: args.urn,
      postsFound: uniquePosts.length,
      durationMs,
    });

    return {
      success: uniquePosts.length > 0,
      posts: uniquePosts,
      matchedKeywords,
      stats: {
        urn: args.urn,
        keywordsSearched: args.keywords.length,
        totalPostsFound: allPosts.length,
        uniquePosts: uniquePosts.length,
        durationMs,
      },
    };
  },
});
