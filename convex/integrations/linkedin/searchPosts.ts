"use node";

// convex/integrations/linkedin/searchPosts.ts
// LinkedIn post search via linkdapi.com with exact phrase matching

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
  start?: number;
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
    service: "linkedin/searchPosts",
    level,
    message,
    ...context,
  };

  if (level === "error") {
    console.error("[linkedin/searchPosts]", JSON.stringify(logData, null, 2));
  } else if (level === "warn") {
    console.warn("[linkedin/searchPosts]", JSON.stringify(logData, null, 2));
  } else {
    console.log("[linkedin/searchPosts]", JSON.stringify(logData, null, 2));
  }
}

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
// Actions
// ============================================================================

/**
 * Search LinkedIn posts with exact phrase matching.
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
    sortBy: v.optional(v.union(v.literal("relevance"), v.literal("date_posted"))),
    datePosted: v.optional(
      v.union(
        v.literal("past-24h"),
        v.literal("past-week"),
        v.literal("past-month"),
        v.literal("past-year")
      )
    ),
    authorJobTitle: v.optional(v.string()),
  },
  handler: async (_, args): Promise<SearchResult> => {
    const startTime = Date.now();
    const apiKey = getApiKey();

    if (!apiKey) {
      log("error", "Missing API key", {
        operation: "search",
        error: "LINKDAPI_API_KEY environment variable not set",
      });
      return {
        success: false,
        posts: [],
        total: 0,
        start: 0,
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
        total: 0,
        start: 0,
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
      start: args.start,
    });

    try {
      const params = new URLSearchParams();
      params.set("keyword", exactQuery);
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
          total: 0,
          start: 0,
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

      if (!data.success) {
        log("error", "API returned unsuccessful response", {
          operation: "search",
          query: exactQuery,
          error: data.message,
          durationMs,
        });
        return {
          success: false,
          posts: [],
          total: 0,
          start: 0,
          hasMore: false,
          error: data.message,
          stats: {
            query: exactQuery,
            postsFound: 0,
            durationMs,
          },
        };
      }

      log("info", "Search completed", {
        operation: "search",
        query: exactQuery,
        postsFound: data.data.posts?.length ?? 0,
        hasMore: data.data.hasMore,
        durationMs,
      });

      return {
        success: true,
        posts: data.data.posts ?? [],
        total: data.data.total,
        start: data.data.start,
        hasMore: data.data.hasMore,
        stats: {
          query: exactQuery,
          postsFound: data.data.posts?.length ?? 0,
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
        total: 0,
        start: 0,
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
 * Search LinkedIn posts with multiple queries (batch).
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
    sortBy: v.optional(v.union(v.literal("relevance"), v.literal("date_posted"))),
    datePosted: v.optional(
      v.union(
        v.literal("past-24h"),
        v.literal("past-week"),
        v.literal("past-month"),
        v.literal("past-year")
      )
    ),
    authorJobTitle: v.optional(v.string()),
    maxQueriesPerBatch: v.optional(v.number()),
  },
  handler: async (_, args): Promise<BatchSearchResult> => {
    const startTime = Date.now();
    const apiKey = getApiKey();

    if (!apiKey) {
      log("error", "Missing API key", {
        operation: "searchBatch",
        error: "LINKDAPI_API_KEY environment variable not set",
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

    const allPosts: LinkedInPost[] = [];
    const errors: Array<{ query: string; error: string }> = [];
    let queriesSucceeded = 0;
    let totalPostsFound = 0;

    for (const query of queriesToExecute) {
      const exactQuery = buildExactPhraseQuery(query);

      try {
        const params = new URLSearchParams();
        params.set("keyword", exactQuery);
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

        if (!data.success) {
          errors.push({ query: exactQuery, error: data.message });
          log("warn", "Query returned unsuccessful", {
            operation: "searchBatch",
            query: exactQuery,
            error: data.message,
          });
          continue;
        }

        const posts = data.data.posts ?? [];

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

      // 2500ms delay = max 24 requests/minute (conservative for linkdapi rate limits)
      if (queriesToExecute.indexOf(query) < queriesToExecute.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
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

