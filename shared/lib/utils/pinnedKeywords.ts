/**
 * Pinned Keywords Management System
 *
 * Clean localStorage-based system for managing pinned keywords.
 * Follows the same patterns as existing keywordStorage.ts for consistency.
 *
 * UPDATED: Now uses timezone-aware UTC timestamps for consistency across all user types
 *
 * References:
 * - localStorage Best Practices: https://developer.mozilla.org/en-US/docs/Web/API/Storage
 * - Data normalization patterns: Redux Toolkit Query approach
 * - Optimistic updates: React Query patterns
 * - UTC timestamp storage: W3C timezone best practices
 */

import { getLocalStorage, setLocalStorage } from "./localStorage";
import { generateUniqueId } from "./request";
import { getCurrentUTCTimestamp } from "./timeUtils";

// Storage key for pinned keywords
const PINNED_KEYWORDS_KEY = "reacherx_pinned_keywords";

// Configuration
const PINNED_KEYWORDS_CONFIG = {
  MAX_PINNED_KEYWORDS: 20, // Future: can be subscription-based
  CACHE_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

export interface PinnedKeyword {
  id: string;
  keyword: string;
  pinnedAt: number; // UTC timestamp in milliseconds
  source: "suggestion" | "search" | "manual";
  metadata?: {
    originalKeywordId?: string; // ID from search history or suggestions
    searchQuery?: string; // Query that led to this keyword
    confidence?: number; // If from AI suggestions
  };
}

export interface PinnedKeywordsCache {
  keywords: PinnedKeyword[];
  lastUpdated: number; // UTC timestamp
}

/**
 * Load pinned keywords from localStorage
 */
function loadPinnedKeywords(): PinnedKeyword[] {
  try {
    const stored = getLocalStorage(PINNED_KEYWORDS_KEY);
    if (!stored) return [];

    const cache: PinnedKeywordsCache = JSON.parse(stored);

    // Check if cache is still valid
    if (
      getCurrentUTCTimestamp() - cache.lastUpdated >
      PINNED_KEYWORDS_CONFIG.CACHE_TTL_MS
    ) {
      console.log("[PINNED_KEYWORDS] Cache expired, clearing data");
      return [];
    }

    // Ensure all keywords have valid UTC timestamps and filter out invalid ones
    const validatedKeywords = cache.keywords.filter((keyword) => {
      // Check if we already have a valid timestamp
      if (typeof keyword.pinnedAt === "number" && keyword.pinnedAt > 0) {
        return true;
      }

      // Log warning for items that will be filtered out
      console.warn(
        "[PINNED_KEYWORDS] Filtering out keyword with invalid timestamp:",
        {
          keyword: keyword.keyword,
          invalidTimestamp: keyword.pinnedAt,
        }
      );
      return false;
    });

    return validatedKeywords || [];
  } catch (error) {
    console.warn("[PINNED_KEYWORDS] Failed to load pinned keywords:", error);
    return [];
  }
}

/**
 * Save pinned keywords to localStorage
 */
function savePinnedKeywords(keywords: PinnedKeyword[]): boolean {
  try {
    const cache: PinnedKeywordsCache = {
      keywords,
      lastUpdated: getCurrentUTCTimestamp(),
    };

    return setLocalStorage(PINNED_KEYWORDS_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("[PINNED_KEYWORDS] Failed to save pinned keywords:", error);
    return false;
  }
}

/**
 * Get all pinned keywords sorted by most recently pinned
 */
export function getPinnedKeywords(): PinnedKeyword[] {
  return loadPinnedKeywords().sort((a, b) => b.pinnedAt - a.pinnedAt);
}

/**
 * Check if a keyword is pinned
 */
export function isKeywordPinned(keyword: string): boolean {
  const pinned = loadPinnedKeywords();
  return pinned.some((k) => k.keyword.toLowerCase() === keyword.toLowerCase());
}

/**
 * Pin a keyword
 */
export function pinKeyword(
  keyword: string,
  source: PinnedKeyword["source"] = "manual",
  metadata?: PinnedKeyword["metadata"]
): boolean {
  try {
    const keywords = loadPinnedKeywords();
    const normalizedKeyword = keyword.trim();

    // Check if already pinned
    if (
      keywords.some(
        (k) => k.keyword.toLowerCase() === normalizedKeyword.toLowerCase()
      )
    ) {
      console.log(
        `[PINNED_KEYWORDS] Keyword already pinned: "${normalizedKeyword}"`
      );
      return false;
    }

    // Check limit
    if (keywords.length >= PINNED_KEYWORDS_CONFIG.MAX_PINNED_KEYWORDS) {
      console.warn(
        `[PINNED_KEYWORDS] Cannot pin more than ${PINNED_KEYWORDS_CONFIG.MAX_PINNED_KEYWORDS} keywords`
      );
      return false;
    }

    const newPinnedKeyword: PinnedKeyword = {
      id: generateUniqueId("pinned"),
      keyword: normalizedKeyword,
      pinnedAt: getCurrentUTCTimestamp(), // Always use UTC timestamp
      source,
      metadata,
    };

    keywords.push(newPinnedKeyword);
    const success = savePinnedKeywords(keywords);

    if (success) {
      console.log(
        `[PINNED_KEYWORDS] Successfully pinned: "${normalizedKeyword}" at ${new Date(newPinnedKeyword.pinnedAt).toISOString()}`
      );
    }

    return success;
  } catch (error) {
    console.error("[PINNED_KEYWORDS] Error pinning keyword:", error);
    return false;
  }
}

/**
 * Unpin a keyword
 */
export function unpinKeyword(keyword: string): boolean {
  try {
    const keywords = loadPinnedKeywords();
    const normalizedKeyword = keyword.trim().toLowerCase();

    const filteredKeywords = keywords.filter(
      (k) => k.keyword.toLowerCase() !== normalizedKeyword
    );

    if (filteredKeywords.length === keywords.length) {
      console.log(`[PINNED_KEYWORDS] Keyword not found: "${keyword}"`);
      return false;
    }

    const success = savePinnedKeywords(filteredKeywords);

    if (success) {
      console.log(`[PINNED_KEYWORDS] Successfully unpinned: "${keyword}"`);
    }

    return success;
  } catch (error) {
    console.error("[PINNED_KEYWORDS] Error unpinning keyword:", error);
    return false;
  }
}

/**
 * Unpin keyword by ID
 */
export function unpinKeywordById(id: string): boolean {
  try {
    const keywords = loadPinnedKeywords();
    const keywordToRemove = keywords.find((k) => k.id === id);
    const filteredKeywords = keywords.filter((k) => k.id !== id);

    if (filteredKeywords.length === keywords.length) {
      console.log(`[PINNED_KEYWORDS] Keyword ID not found: "${id}"`);
      return false;
    }

    const success = savePinnedKeywords(filteredKeywords);

    if (success && keywordToRemove) {
      console.log(
        `[PINNED_KEYWORDS] Successfully unpinned keyword "${keywordToRemove.keyword}" with ID: "${id}"`
      );
    }

    return success;
  } catch (error) {
    console.error("[PINNED_KEYWORDS] Error unpinning keyword by ID:", error);
    return false;
  }
}

/**
 * Clear all pinned keywords
 */
export function clearAllPinnedKeywords(): boolean {
  try {
    const success = savePinnedKeywords([]);
    if (success) {
      console.log("[PINNED_KEYWORDS] Cleared all pinned keywords");
    }
    return success;
  } catch (error) {
    console.error("[PINNED_KEYWORDS] Error clearing pinned keywords:", error);
    return false;
  }
}

/**
 * Get pinned keywords statistics
 */
export interface PinnedKeywordsStats {
  total: number;
  bySources: Record<PinnedKeyword["source"], number>;
  oldestPinned?: {
    keyword: string;
    pinnedAt: number;
  };
  newestPinned?: {
    keyword: string;
    pinnedAt: number;
  };
}

export function getPinnedKeywordsStats(): PinnedKeywordsStats {
  const keywords = loadPinnedKeywords();

  const stats: PinnedKeywordsStats = {
    total: keywords.length,
    bySources: {
      suggestion: keywords.filter((k) => k.source === "suggestion").length,
      search: keywords.filter((k) => k.source === "search").length,
      manual: keywords.filter((k) => k.source === "manual").length,
    },
  };

  if (keywords.length > 0) {
    const sorted = keywords.sort((a, b) => a.pinnedAt - b.pinnedAt);
    stats.oldestPinned = {
      keyword: sorted[0].keyword,
      pinnedAt: sorted[0].pinnedAt,
    };
    stats.newestPinned = {
      keyword: sorted[sorted.length - 1].keyword,
      pinnedAt: sorted[sorted.length - 1].pinnedAt,
    };
  }

  return stats;
}

/**
 * Search pinned keywords with highlighting support
 */
export function searchPinnedKeywords(
  query: string,
  maxResults: number = 10
): PinnedKeyword[] {
  if (!query.trim()) return [];

  const keywords = loadPinnedKeywords();
  const normalizedQuery = query.toLowerCase().trim();

  return keywords
    .filter((keyword) =>
      keyword.keyword.toLowerCase().includes(normalizedQuery)
    )
    .sort((a, b) => {
      // Prioritize exact matches, then substring matches, then recency
      const aExact = a.keyword.toLowerCase() === normalizedQuery;
      const bExact = b.keyword.toLowerCase() === normalizedQuery;

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Both are substring matches or both are exact, sort by recency
      return b.pinnedAt - a.pinnedAt;
    })
    .slice(0, maxResults);
}

/**
 * Convert PinnedKeyword to KeywordItem format for compatibility
 */
export function pinnedKeywordToKeywordItem(pinned: PinnedKeyword): {
  id: string;
  keyword: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
} {
  return {
    id: pinned.id,
    keyword: pinned.keyword,
    timestamp: new Date(pinned.pinnedAt).toISOString(),
    metadata: {
      ...pinned.metadata,
      source: pinned.source,
      isPinned: true,
    },
  };
}
