"use node";

// convex/integrations/bishopi.ts
// Bishopi.io API integration for keyword discovery

import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { retrier } from "../lib/retrier";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

// ============================================================================
// Logging
// ============================================================================

interface BishopiLogContext {
  operation: string;
  seedKeywords?: string[];
  keywordsCount?: number;
  rawCount?: number;
  transformedCount?: number;
  uniqueCount?: number;
  durationMs?: number;
  error?: string;
  httpStatus?: number;
}

function logBishopi(
  level: "info" | "warn" | "error",
  message: string,
  context: BishopiLogContext
) {
  const logData = {
    timestamp: new Date().toISOString(),
    service: "bishopi",
    level,
    message,
    ...context,
  };

  if (level === "error") {
    console.error("[bishopi]", JSON.stringify(logData, null, 2));
  } else if (level === "warn") {
    console.warn("[bishopi]", JSON.stringify(logData, null, 2));
  } else {
    console.info("[bishopi]", JSON.stringify(logData, null, 2));
  }
}

// ============================================================================
// Types
// ============================================================================

/** Raw keyword data from bishopi.io API response */
interface BishopiKeywordData {
  se_type: string;
  keyword: string;
  location_code: number;
  language_code: string;
  keyword_info: {
    se_type: string;
    last_updated_time: string;
    competition: number;
    competition_level: string;
    cpc: number;
    search_volume: number;
    low_top_of_page_bid: number;
    high_top_of_page_bid: number;
    categories: number[];
    monthly_searches: Array<{
      year: number;
      month: number;
      search_volume: number;
    }>;
    search_volume_trend: {
      monthly: number;
      quarterly: number;
      yearly: number;
    };
  } | null;
  keyword_properties: {
    se_type: string;
    core_keyword: string;
    synonym_clustering_algorithm: string;
    keyword_difficulty: number;
    detected_language: string;
    is_another_language: boolean;
  } | null;
  search_intent_info: {
    se_type: string;
    main_intent: string;
    foreign_intent: string[];
    last_updated_time: string;
  } | null;
}

interface BishopiApiResponse {
  status: string;
  code: number;
  data: BishopiKeywordData[];
}

/** Discovered keyword with search metadata */
export interface DiscoveredKeyword {
  keyword: string;
  searchVolume: number;
  competition?: number;
  competitionLevel?: string;
  cpc?: number;
  trend?: {
    monthly?: number;
    quarterly?: number;
    yearly?: number;
  };
  keywordDifficulty?: number;
  searchIntent?: string;
}

/** Result from the internal fetch action */
interface FetchResult {
  success: boolean;
  data?: BishopiKeywordData[];
  error?: string;
  httpStatus?: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalizes a keyword for deduplication (lowercase, trimmed)
 */
function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().trim();
}

/**
 * Transforms raw bishopi.io data to our normalized format
 */
function transformKeywordData(
  raw: BishopiKeywordData
): DiscoveredKeyword | null {
  // Skip if no keyword info (no search data available)
  if (!raw.keyword_info) {
    return null;
  }

  return {
    keyword: raw.keyword,
    searchVolume: raw.keyword_info.search_volume,
    competition: raw.keyword_info.competition,
    competitionLevel: raw.keyword_info.competition_level,
    cpc: raw.keyword_info.cpc,
    trend: raw.keyword_info.search_volume_trend
      ? {
          monthly: raw.keyword_info.search_volume_trend.monthly,
          quarterly: raw.keyword_info.search_volume_trend.quarterly,
          yearly: raw.keyword_info.search_volume_trend.yearly,
        }
      : undefined,
    keywordDifficulty: raw.keyword_properties?.keyword_difficulty,
    searchIntent: raw.search_intent_info?.main_intent,
  };
}

/**
 * Deduplicates keywords, keeping the version with highest search volume
 */
function deduplicateKeywords(
  keywords: DiscoveredKeyword[]
): DiscoveredKeyword[] {
  const keywordMap = new Map<string, DiscoveredKeyword>();

  for (const keyword of keywords) {
    const normalizedKey = normalizeKeyword(keyword.keyword);
    const existing = keywordMap.get(normalizedKey);

    // Keep the keyword with higher search volume
    if (!existing || keyword.searchVolume > existing.searchVolume) {
      keywordMap.set(normalizedKey, keyword);
    }
  }

  return Array.from(keywordMap.values());
}

// ============================================================================
// Internal Actions (for retrier)
// ============================================================================

/**
 * Internal action that performs the actual HTTP fetch to Bishopi API.
 * This is wrapped by the retrier for automatic retry on failure.
 * Throws on failure so the retrier can catch and retry.
 */
export const fetchKeywordIdeasInternal = internalAction({
  args: {
    keywords: v.array(v.string()),
  },
  handler: async (_, args): Promise<FetchResult> => {
    const apiKey = process.env.BISHOPI_API_KEY;

    if (!apiKey) {
      // Don't retry configuration errors
      return {
        success: false,
        error: "BISHOPI_API_KEY environment variable not set",
      };
    }

    // Join keywords with comma for API request (don't encode commas, API expects them)
    const keywordsParam = args.keywords.join(", ");
    const url = `https://api.bishopi.io/keyword_ideas/?keywords=${encodeURI(keywordsParam)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Throw to trigger retry for transient failures
      throw new Error(`Bishopi API returned ${response.status}: ${errorText}`);
    }

    const data: BishopiApiResponse = await response.json();

    if (data.status !== "success" || !Array.isArray(data.data)) {
      throw new Error(
        `Unexpected response format: status=${data.status}, data type=${typeof data.data}`
      );
    }

    return {
      success: true,
      data: data.data,
    };
  },
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches keyword ideas from bishopi.io API with automatic retry.
 *
 * @param seedKeywords - Array of seed keywords to discover related keywords
 * @returns Deduplicated array of discovered keywords with metadata
 *
 * @example
 * const keywords = await ctx.runAction(api.integrations.bishopi.fetchKeywordIdeas, {
 *   seedKeywords: ["customer acquisition", "lead generation"]
 * });
 */
export const fetchKeywordIdeas = action({
  args: {
    seedKeywords: v.array(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    keywords: DiscoveredKeyword[];
    error?: string;
    stats?: {
      seedKeywordsCount: number;
      rawKeywordsCount: number;
      transformedCount: number;
      uniqueCount: number;
      durationMs: number;
    };
  }> => {
    const startTime = getCurrentUTCTimestamp();

    // Deduplicate and normalize seed keywords before API call
    const uniqueSeedKeywords = [
      ...new Set(args.seedKeywords.map(normalizeKeyword)),
    ].filter((kw) => kw.length > 0);

    if (uniqueSeedKeywords.length === 0) {
      logBishopi("warn", "No valid seed keywords provided", {
        operation: "fetchKeywordIdeas",
        seedKeywords: args.seedKeywords,
      });
      return {
        success: false,
        keywords: [],
        error: "No valid seed keywords provided",
      };
    }

    logBishopi("info", "Starting keyword discovery with retrier", {
      operation: "fetchKeywordIdeas",
      seedKeywords: uniqueSeedKeywords,
      keywordsCount: uniqueSeedKeywords.length,
    });

    try {
      // Use retrier to run the internal action with automatic retry
      const runId = await retrier.run(
        ctx,
        internal.integrations.bishopi.fetchKeywordIdeasInternal,
        { keywords: uniqueSeedKeywords }
      );

      // Poll for completion
      let result: FetchResult | null = null;
      while (true) {
        const status = await retrier.status(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (status.type === "completed") {
          if (status.result.type === "success") {
            result = status.result.returnValue as FetchResult;
          } else if (status.result.type === "failed") {
            logBishopi("error", "Retrier exhausted all retries", {
              operation: "fetchKeywordIdeas",
              error: status.result.error,
              durationMs: getCurrentUTCTimestamp() - startTime,
            });
            return {
              success: false,
              keywords: [],
              error: `Failed after retries: ${status.result.error}`,
            };
          } else {
            // canceled
            return {
              success: false,
              keywords: [],
              error: "Request was canceled",
            };
          }
        }
        break;
      }

      if (!result || !result.success || !result.data) {
        return {
          success: false,
          keywords: [],
          error: result?.error ?? "Unknown error",
        };
      }

      // Transform and filter out null results
      const transformedKeywords = result.data
        .map(transformKeywordData)
        .filter((kw): kw is DiscoveredKeyword => kw !== null);

      // Deduplicate by keyword, keeping highest search volume
      const deduplicatedKeywords = deduplicateKeywords(transformedKeywords);

      // Sort by search volume (highest first)
      deduplicatedKeywords.sort((a, b) => b.searchVolume - a.searchVolume);

      const durationMs = getCurrentUTCTimestamp() - startTime;

      logBishopi("info", "Keyword discovery completed successfully", {
        operation: "fetchKeywordIdeas",
        seedKeywords: uniqueSeedKeywords,
        rawCount: result.data.length,
        transformedCount: transformedKeywords.length,
        uniqueCount: deduplicatedKeywords.length,
        durationMs,
      });

      // Log top discovered keywords for debugging
      if (deduplicatedKeywords.length > 0) {
        console.info("[bishopi] Top discovered keywords:", {
          count: deduplicatedKeywords.length,
          top5: deduplicatedKeywords.slice(0, 5).map((kw) => ({
            keyword: kw.keyword,
            searchVolume: kw.searchVolume,
            intent: kw.searchIntent,
          })),
        });
      }

      return {
        success: true,
        keywords: deduplicatedKeywords,
        stats: {
          seedKeywordsCount: uniqueSeedKeywords.length,
          rawKeywordsCount: result.data.length,
          transformedCount: transformedKeywords.length,
          uniqueCount: deduplicatedKeywords.length,
          durationMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logBishopi("error", "Unexpected error in fetchKeywordIdeas", {
        operation: "fetchKeywordIdeas",
        error: errorMessage,
        durationMs: getCurrentUTCTimestamp() - startTime,
      });
      return {
        success: false,
        keywords: [],
        error: `Failed to fetch keywords: ${errorMessage}`,
      };
    }
  },
});
