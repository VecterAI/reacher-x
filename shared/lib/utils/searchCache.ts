/**
 * Search Results Caching System
 *
 * Implements 10-minute TTL caching with LRU eviction policy for search results.
 * Reduces API calls and improves user experience for recently searched keywords.
 *
 * References:
 * - LRU Cache Algorithm: https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU
 * - React Query caching patterns: https://tanstack.com/query/latest
 * - HTTP Cache-Control strategies: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
 */

import { getLocalStorage, setLocalStorage } from "./localStorage";
import type { SearchResult } from "@/features/search/hooks/useTwitterSearch";

// Storage key for search cache
const SEARCH_CACHE_KEY = "reacherx_search_cache";

// Cache configuration
const CACHE_CONFIG = {
  TTL_MS: 10 * 60 * 1000, // 10 minutes
  MAX_ENTRIES: 50, // Maximum cached searches (LRU eviction)
  MAX_STORAGE_SIZE: 5 * 1024 * 1024, // 5MB localStorage limit
} as const;

export interface CachedSearchResult {
  key: string; // Unique cache key
  query: string;
  exactMatch: boolean;
  result: SearchResult;
  cachedAt: number; // Unix timestamp
  lastAccessed: number; // For LRU tracking
  size: number; // Approximate size in bytes
}

export interface SearchCache {
  entries: Record<string, CachedSearchResult>;
  totalSize: number;
  lastCleanup: number;
}

/**
 * Generate cache key for search parameters
 * Reference: HTTP cache key generation best practices
 */
function generateCacheKey(query: string, exactMatch: boolean): string {
  const normalized = query.trim().toLowerCase();
  const matchType = exactMatch ? "exact" : "fuzzy";
  return `search_${btoa(normalized)}_${matchType}`;
}

/**
 * Estimate size of cached data in bytes
 * Used for cache size management
 */
function estimateSize(data: SearchResult): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    // Fallback estimation
    return JSON.stringify(data).length * 2; // Rough UTF-16 estimation
  }
}

/**
 * Load search cache from localStorage
 */
function loadSearchCache(): SearchCache {
  try {
    const stored = getLocalStorage(SEARCH_CACHE_KEY);
    if (!stored) {
      return {
        entries: {},
        totalSize: 0,
        lastCleanup: Date.now(),
      };
    }

    const cache: SearchCache = JSON.parse(stored);

    // Validate cache structure
    if (!cache.entries || typeof cache.entries !== "object") {
      console.warn("[SEARCH_CACHE] Invalid cache structure, resetting");
      return {
        entries: {},
        totalSize: 0,
        lastCleanup: Date.now(),
      };
    }

    return cache;
  } catch (error) {
    console.warn("[SEARCH_CACHE] Failed to load search cache:", error);
    return {
      entries: {},
      totalSize: 0,
      lastCleanup: Date.now(),
    };
  }
}

/**
 * Save search cache to localStorage
 */
function saveSearchCache(cache: SearchCache): boolean {
  try {
    const serialized = JSON.stringify(cache);

    // Check if serialized data exceeds storage limits
    if (serialized.length > CACHE_CONFIG.MAX_STORAGE_SIZE) {
      console.warn(
        "[SEARCH_CACHE] Cache too large, performing aggressive cleanup"
      );
      return false;
    }

    return setLocalStorage(SEARCH_CACHE_KEY, serialized);
  } catch (error) {
    console.warn("[SEARCH_CACHE] Failed to save search cache:", error);
    return false;
  }
}

/**
 * Clean expired entries from cache
 * Reference: TTL cache implementation patterns
 */
function cleanExpiredEntries(cache: SearchCache): SearchCache {
  const now = Date.now();
  const cleaned: SearchCache = {
    entries: {},
    totalSize: 0,
    lastCleanup: now,
  };

  Object.entries(cache.entries).forEach(([key, entry]) => {
    if (now - entry.cachedAt < CACHE_CONFIG.TTL_MS) {
      cleaned.entries[key] = entry;
      cleaned.totalSize += entry.size;
    }
  });

  const removedCount =
    Object.keys(cache.entries).length - Object.keys(cleaned.entries).length;
  if (removedCount > 0) {
    console.log(`[SEARCH_CACHE] Cleaned ${removedCount} expired entries`);
  }

  return cleaned;
}

/**
 * Implement LRU eviction when cache exceeds size limits
 * Reference: LRU implementation patterns
 */
function evictLRUEntries(cache: SearchCache): SearchCache {
  const entries = Object.values(cache.entries);

  if (entries.length <= CACHE_CONFIG.MAX_ENTRIES) {
    return cache;
  }

  // Sort by lastAccessed (LRU first)
  const sortedEntries = entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

  // Keep only the most recent MAX_ENTRIES
  const toKeep = sortedEntries.slice(-CACHE_CONFIG.MAX_ENTRIES);

  const newCache: SearchCache = {
    entries: {},
    totalSize: 0,
    lastCleanup: cache.lastCleanup,
  };

  toKeep.forEach((entry) => {
    newCache.entries[entry.key] = entry;
    newCache.totalSize += entry.size;
  });

  const evictedCount = entries.length - toKeep.length;
  console.log(`[SEARCH_CACHE] Evicted ${evictedCount} LRU entries`);

  return newCache;
}

/**
 * Get cached search result
 */
export function getCachedSearchResult(
  query: string,
  exactMatch: boolean
): SearchResult | null {
  try {
    const cache = loadSearchCache();
    const key = generateCacheKey(query, exactMatch);
    const entry = cache.entries[key];

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.cachedAt > CACHE_CONFIG.TTL_MS) {
      console.log(`[SEARCH_CACHE] Cache entry expired for: "${query}"`);
      return null;
    }

    // Update last accessed time (LRU tracking)
    entry.lastAccessed = Date.now();
    cache.entries[key] = entry;
    saveSearchCache(cache);

    console.log(`[SEARCH_CACHE] Cache hit for: "${query}"`);
    return entry.result;
  } catch (error) {
    console.warn("[SEARCH_CACHE] Error retrieving cached result:", error);
    return null;
  }
}

/**
 * Cache search result
 */
export function cacheSearchResult(
  query: string,
  exactMatch: boolean,
  result: SearchResult
): boolean {
  try {
    let cache = loadSearchCache();

    // Clean expired entries first
    cache = cleanExpiredEntries(cache);

    const key = generateCacheKey(query, exactMatch);
    const size = estimateSize(result);
    const now = Date.now();

    const entry: CachedSearchResult = {
      key,
      query: query.trim(),
      exactMatch,
      result,
      cachedAt: now,
      lastAccessed: now,
      size,
    };

    // Add new entry
    cache.entries[key] = entry;
    cache.totalSize += size;

    // Apply LRU eviction if needed
    cache = evictLRUEntries(cache);

    const success = saveSearchCache(cache);

    if (success) {
      console.log(
        `[SEARCH_CACHE] Cached result for: "${query}" (${size} bytes)`
      );
    }

    return success;
  } catch (error) {
    console.error("[SEARCH_CACHE] Error caching search result:", error);
    return false;
  }
}

/**
 * Check if search result is cached
 */
export function isSearchCached(query: string, exactMatch: boolean): boolean {
  const cached = getCachedSearchResult(query, exactMatch);
  return cached !== null;
}

/**
 * Clear specific cached search
 */
export function clearCachedSearch(query: string, exactMatch: boolean): boolean {
  try {
    const cache = loadSearchCache();
    const key = generateCacheKey(query, exactMatch);

    if (cache.entries[key]) {
      cache.totalSize -= cache.entries[key].size;
      delete cache.entries[key];

      const success = saveSearchCache(cache);
      if (success) {
        console.log(`[SEARCH_CACHE] Cleared cache for: "${query}"`);
      }
      return success;
    }

    return true; // Nothing to clear
  } catch (error) {
    console.error("[SEARCH_CACHE] Error clearing cached search:", error);
    return false;
  }
}

/**
 * Clear all cached searches
 */
export function clearAllSearchCache(): boolean {
  try {
    const success = setLocalStorage(
      SEARCH_CACHE_KEY,
      JSON.stringify({
        entries: {},
        totalSize: 0,
        lastCleanup: Date.now(),
      })
    );

    if (success) {
      console.log("[SEARCH_CACHE] Cleared all cached searches");
    }

    return success;
  } catch (error) {
    console.error("[SEARCH_CACHE] Error clearing search cache:", error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export interface SearchCacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate?: number; // Can be calculated over time
  oldestEntry?: {
    query: string;
    cachedAt: number;
  };
  newestEntry?: {
    query: string;
    cachedAt: number;
  };
  sizeByQuery: Array<{
    query: string;
    size: number;
    cachedAt: number;
  }>;
}

export function getSearchCacheStats(): SearchCacheStats {
  const cache = loadSearchCache();
  const entries = Object.values(cache.entries);

  const stats: SearchCacheStats = {
    totalEntries: entries.length,
    totalSize: cache.totalSize,
    sizeByQuery: entries.map((entry) => ({
      query: entry.query,
      size: entry.size,
      cachedAt: entry.cachedAt,
    })),
  };

  if (entries.length > 0) {
    const sorted = entries.sort((a, b) => a.cachedAt - b.cachedAt);
    stats.oldestEntry = {
      query: sorted[0].query,
      cachedAt: sorted[0].cachedAt,
    };
    stats.newestEntry = {
      query: sorted[sorted.length - 1].query,
      cachedAt: sorted[sorted.length - 1].cachedAt,
    };
  }

  return stats;
}

/**
 * Perform maintenance on search cache
 * Should be called periodically to keep cache healthy
 */
export function maintainSearchCache(): boolean {
  try {
    let cache = loadSearchCache();

    // Only run maintenance if it's been a while
    const maintenanceInterval = 60 * 60 * 1000; // 1 hour
    if (Date.now() - cache.lastCleanup < maintenanceInterval) {
      return true;
    }

    console.log("[SEARCH_CACHE] Performing cache maintenance");

    // Clean expired entries
    cache = cleanExpiredEntries(cache);

    // Apply LRU eviction
    cache = evictLRUEntries(cache);

    return saveSearchCache(cache);
  } catch (error) {
    console.error("[SEARCH_CACHE] Error during cache maintenance:", error);
    return false;
  }
}
