// convex/integrations/bishopi.ts
// Bishopi.io API integration for keyword discovery

import { action } from "../_generated/server";
import { v } from "convex/values";

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
    console.log("[bishopi]", JSON.stringify(logData, null, 2));
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
function transformKeywordData(raw: BishopiKeywordData): DiscoveredKeyword | null {
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
// Actions
// ============================================================================

/**
 * Fetches keyword ideas from bishopi.io API
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
  handler: async (_, args): Promise<{
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
    const startTime = Date.now();
    const apiKey = process.env.BISHOPI_API_KEY;

    if (!apiKey) {
      logBishopi("error", "Missing API key", {
        operation: "fetchKeywordIdeas",
        error: "BISHOPI_API_KEY environment variable not set",
      });
      return {
        success: false,
        keywords: [],
        error: "Bishopi API key not configured",
      };
    }

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

    // Join keywords with comma for API request
    const keywordsParam = encodeURIComponent(uniqueSeedKeywords.join(", "));
    const url = `https://api.bishopi.io/keyword_ideas/?keywords=${keywordsParam}`;

    logBishopi("info", "Starting keyword discovery", {
      operation: "fetchKeywordIdeas",
      seedKeywords: uniqueSeedKeywords,
      keywordsCount: uniqueSeedKeywords.length,
    });

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logBishopi("error", "API returned error status", {
          operation: "fetchKeywordIdeas",
          httpStatus: response.status,
          error: errorText,
          durationMs: Date.now() - startTime,
        });
        return {
          success: false,
          keywords: [],
          error: `Bishopi API returned ${response.status}: ${errorText}`,
        };
      }

      const data: BishopiApiResponse = await response.json();

      if (data.status !== "success" || !Array.isArray(data.data)) {
        logBishopi("error", "Unexpected API response format", {
          operation: "fetchKeywordIdeas",
          error: `status: ${data.status}, data type: ${typeof data.data}`,
          durationMs: Date.now() - startTime,
        });
        return {
          success: false,
          keywords: [],
          error: "Unexpected response format from Bishopi API",
        };
      }

      // Transform and filter out null results
      const transformedKeywords = data.data
        .map(transformKeywordData)
        .filter((kw): kw is DiscoveredKeyword => kw !== null);

      // Deduplicate by keyword, keeping highest search volume
      const deduplicatedKeywords = deduplicateKeywords(transformedKeywords);

      // Sort by search volume (highest first)
      deduplicatedKeywords.sort((a, b) => b.searchVolume - a.searchVolume);

      const durationMs = Date.now() - startTime;

      logBishopi("info", "Keyword discovery completed successfully", {
        operation: "fetchKeywordIdeas",
        seedKeywords: uniqueSeedKeywords,
        rawCount: data.data.length,
        transformedCount: transformedKeywords.length,
        uniqueCount: deduplicatedKeywords.length,
        durationMs,
      });

      // Log top discovered keywords for debugging
      if (deduplicatedKeywords.length > 0) {
        console.log("[bishopi] Top discovered keywords:", {
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
          rawKeywordsCount: data.data.length,
          transformedCount: transformedKeywords.length,
          uniqueCount: deduplicatedKeywords.length,
          durationMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logBishopi("error", "Network or parsing error", {
        operation: "fetchKeywordIdeas",
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });
      return {
        success: false,
        keywords: [],
        error: `Failed to fetch keywords: ${errorMessage}`,
      };
    }
  },
});

