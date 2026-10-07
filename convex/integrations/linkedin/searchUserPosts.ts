"use node";

// convex/integrations/linkedin/searchUserPosts.ts
// Search for a user's posts containing specific keywords for qualification evidence

import { action, internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { getProviderSearchMaxRuntimeMs } from "../../lib/retrier";
import { logger } from "../../../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { requestLinkdApiData } from "./linkdapiClient";
import {
  normalizeLinkedInProfileQueryUrn,
  requireLinkedInProfileQueryUrn,
} from "./profileIdentity";
import {
  getUserPostSearchOutcome,
  isUserPostSearchSuccessful,
  type UserPostSearchOutcome,
} from "../../lib/userPostSearchCore";
const linkedInSearchUserPostsLogger = logger.withScope(
  "LinkedInSearchUserPosts"
);

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
  outcome: UserPostSearchOutcome;
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
    const profileUrn = requireLinkedInProfileQueryUrn(args.urn);
    const maxPosts = args.maxPosts ?? 20;
    const MAX_PAGES = 5; // Safety limit
    const PAGE_SIZE = 10; // LinkdAPI default page size
    // Stop paginating after a bounded runtime so a slow provider can never
    // pin this action (and its GB-hours) open for minutes on end.
    const startedAt = getCurrentUTCTimestamp();
    const maxRuntimeMs = getProviderSearchMaxRuntimeMs();

    const allPosts: LinkedInPost[] = [];
    let start = 0;
    let page = 0;

    // Pagination loop: fetch pages until we have enough posts or no more pages
    while (allPosts.length < maxPosts && page < MAX_PAGES) {
      if (page > 0 && getCurrentUTCTimestamp() - startedAt > maxRuntimeMs) {
        linkedInSearchUserPostsLogger.warn(
          "Stopping user posts search pagination after runtime budget",
          { urn: profileUrn, keyword: args.keyword ?? "all", page }
        );
        break;
      }
      const data = await requestLinkdApiData<{
        posts?: LinkedInPost[];
        hasMore?: boolean;
      }>(ctx, {
        path: "/api/v1/search/posts",
        query: {
          fromMember: profileUrn,
          sortBy: "date_posted",
          start,
          keyword: args.keyword,
          datePosted: args.datePosted,
        },
        consumer: `linkedin.searchUserPosts:${profileUrn}:${args.keyword ?? "all"}:${start}`,
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
 * Upper bound on the whole multi-keyword search so the orchestration action
 * can never approach the 10-minute action limit. Individual keyword searches
 * are additionally bounded by the per-attempt pagination budget in
 * `searchUserPostsInternal`.
 */
const CORE_MAX_RUNTIME_MS = 4 * 60 * 1000;

/**
 * Orchestration for multi-keyword user-post evidence searches.
 *
 * Each keyword search is awaited directly (one action per keyword, results
 * always consumed — nothing is left running after this action returns) with a
 * past-month filter first and a full-history fallback when the filtered
 * search comes back empty.
 *
 * Workflow callers should prefer `startUserPostsSearchForResult` (see
 * integrations/linkedin/searchUserPostsQueue.ts), which runs this action via
 * the action retrier so the workflow waits on free durable sleeps instead of
 * billing a live action.
 */
export const searchUserPostsCore = internalAction({
  args: {
    urn: v.string(),
    keywords: v.array(v.string()),
    maxPosts: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<UserPostsSearchResult> => {
    const startTime = getCurrentUTCTimestamp();
    const maxPosts = args.maxPosts ?? 20;
    const profileUrn = normalizeLinkedInProfileQueryUrn(args.urn);

    if (!profileUrn) {
      return {
        success: false,
        outcome: "error",
        posts: [],
        matchedKeywords: [],
        error:
          "LinkedIn profile URN required; received a post/activity URN instead.",
        stats: {
          urn: args.urn,
          keywordsSearched: args.keywords.length,
          totalPostsFound: 0,
          uniquePosts: 0,
          durationMs: getCurrentUTCTimestamp() - startTime,
        },
      };
    }

    const allPosts: LinkedInPost[] = [];
    const matchedKeywords: string[] = [];
    const searchErrors: string[] = [];

    for (let i = 0; i < args.keywords.length; i++) {
      const keyword = args.keywords[i];

      // Check if we already have enough posts
      if (deduplicatePosts(allPosts).length >= maxPosts) {
        break;
      }

      // Stop after a bounded overall runtime; return partial results rather
      // than approaching the action time limit.
      if (i > 0 && getCurrentUTCTimestamp() - startTime > CORE_MAX_RUNTIME_MS) {
        searchErrors.push(
          `Search runtime budget exceeded; skipped ${args.keywords.length - i} remaining keywords`
        );
        break;
      }

      try {
        // Add stagger delay (500ms between requests)
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }

        // Try with past-month filter first
        const postsNeeded = maxPosts - deduplicatePosts(allPosts).length;
        let keywordAttempt = await searchUserPostsForKeyword(ctx, {
          urn: profileUrn,
          keyword,
          maxPosts: postsNeeded,
          datePosted: "past-month",
        });

        // Only fall back to a full-history search when the filtered search
        // genuinely found nothing — a provider failure would fail the
        // fallback too and double the load during an outage.
        if (keywordAttempt.posts.length === 0 && !keywordAttempt.error) {
          // Fallback: try without date filter
          const fallbackPostsNeeded =
            maxPosts - deduplicatePosts(allPosts).length;
          const fallbackAttempt = await searchUserPostsForKeyword(ctx, {
            urn: profileUrn,
            keyword,
            maxPosts: fallbackPostsNeeded,
          });
          keywordAttempt = fallbackAttempt;
        }

        if (keywordAttempt.posts.length > 0) {
          allPosts.push(...keywordAttempt.posts);
          matchedKeywords.push(keyword);
        } else if (keywordAttempt.error) {
          searchErrors.push(keywordAttempt.error);
        }
      } catch (error) {
        searchErrors.push(
          error instanceof Error ? error.message : "LinkedIn search failed"
        );
        linkedInSearchUserPostsLogger.warn(
          "Failed to search keyword",
          { urn: profileUrn, keyword },
          error instanceof Error ? error : new Error(String(error))
        );
        // Continue with other keywords
      }
    }

    return buildUserPostsSearchResult({
      urn: profileUrn,
      keywords: args.keywords,
      maxPosts,
      allPosts,
      matchedKeywords,
      searchErrors,
      startTime,
    });
  },
});

/**
 * Search for a user's posts containing specific keywords.
 * Used for qualification evidence gathering.
 *
 * Strategy:
 * 1. Try with keyword + date filter (past-month)
 * 2. If no results, try without date filter
 * 3. Search keywords sequentially with staggered requests
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
    const profileUrn = normalizeLinkedInProfileQueryUrn(args.urn);

    if (!args.urn || args.urn.trim().length === 0) {
      return {
        success: false,
        outcome: "error",
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

    if (!profileUrn) {
      return {
        success: false,
        outcome: "error",
        posts: [],
        matchedKeywords: [],
        error:
          "LinkedIn profile URN required; received a post/activity URN instead.",
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
        outcome: "error",
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

    return await ctx.runAction(
      internal.integrations.linkedin.searchUserPosts.searchUserPostsCore,
      {
        urn: profileUrn,
        keywords: args.keywords,
        maxPosts: args.maxPosts,
      }
    );
  },
});

// ============================================================================
// Helpers
// ============================================================================

/**
 * One keyword attempt: past-month filter when requested, full-history
 * otherwise. Awaited directly so the result is always consumed — the old
 * fire-and-poll flow left slow searches running unobserved after the caller
 * gave up, billing compute nobody read.
 */
async function searchUserPostsForKeyword(
  ctx: ActionCtx,
  args: {
    urn: string;
    keyword: string;
    maxPosts: number;
    datePosted?: string;
  }
): Promise<{ posts: LinkedInPost[]; error?: string }> {
  const result: InternalSearchResult = await ctx.runAction(
    internal.integrations.linkedin.searchUserPosts.searchUserPostsInternal,
    {
      urn: args.urn,
      keyword: args.keyword,
      maxPosts: args.maxPosts,
      ...(args.datePosted !== undefined ? { datePosted: args.datePosted } : {}),
    }
  );
  if (result.success) {
    return { posts: result.posts };
  }
  return {
    posts: [],
    error: result.error ?? `LinkedIn search failed for ${args.keyword}`,
  };
}

/**
 * Shared result assembly for the public wrapper and the workflow-facing
 * core: dedupe, aggregate errors, and classify the search outcome.
 */
function buildUserPostsSearchResult(args: {
  urn: string;
  keywords: string[];
  maxPosts: number;
  allPosts: LinkedInPost[];
  matchedKeywords: string[];
  searchErrors: string[];
  startTime: number;
}): UserPostsSearchResult {
  const uniquePosts = deduplicatePosts(args.allPosts).slice(0, args.maxPosts);
  const durationMs = getCurrentUTCTimestamp() - args.startTime;
  const error =
    uniquePosts.length === 0 && args.searchErrors.length > 0
      ? [...new Set(args.searchErrors)].join(" | ")
      : undefined;

  const outcome = getUserPostSearchOutcome({
    postCount: uniquePosts.length,
    error,
  });
  return {
    success: isUserPostSearchSuccessful(outcome),
    outcome,
    posts: uniquePosts,
    matchedKeywords: args.matchedKeywords,
    error,
    stats: {
      urn: args.urn,
      keywordsSearched: args.keywords.length,
      totalPostsFound: args.allPosts.length,
      uniquePosts: uniquePosts.length,
      durationMs,
    },
  };
}
