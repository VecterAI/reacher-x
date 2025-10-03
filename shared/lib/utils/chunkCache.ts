import { Tweet } from "@/features/threads/types";
import { logger } from "@/shared/lib/logger";

/**
 * Cache key prefix for chunk storage
 */
const CHUNK_CACHE_PREFIX = "rx_chunk_";

/**
 * Generates a cache key for a specific search query
 */
function getCacheKey(query: string, exactMatch: boolean): string {
  const normalized = query.trim().toLowerCase();
  const matchSuffix = exactMatch ? "_exact" : "_fuzzy";
  return `${CHUNK_CACHE_PREFIX}${normalized}${matchSuffix}`;
}

/**
 * Saves resolved chunks to sessionStorage for page refresh optimization
 * @param query - Search query
 * @param exactMatch - Whether exact match was used
 * @param chunks - Array of tweet chunks to cache
 */
export function saveChunksToSession(
  query: string,
  exactMatch: boolean,
  chunks: Tweet[][]
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getCacheKey(query, exactMatch);
    const data = {
      chunks,
      timestamp: Date.now(),
      query,
      exactMatch,
    };
    sessionStorage.setItem(key, JSON.stringify(data));
    logger.info("[CHUNK_CACHE] Saved chunks to session:", {
      key,
      chunkCount: chunks.length,
      totalTweets: chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    });
  } catch (error) {
    logger.error("[CHUNK_CACHE] Failed to save chunks:", error);
  }
}

/**
 * Loads cached chunks from sessionStorage
 * @param query - Search query
 * @param exactMatch - Whether exact match was used
 * @returns Array of cached tweet chunks, or empty array if none found
 */
export function loadChunksFromSession(
  query: string,
  exactMatch: boolean
): Tweet[][] {
  if (typeof window === "undefined") return [];

  try {
    const key = getCacheKey(query, exactMatch);
    const stored = sessionStorage.getItem(key);

    if (!stored) {
      logger.info("[CHUNK_CACHE] No cached chunks found for query");
      return [];
    }

    const data = JSON.parse(stored);
    const age = Date.now() - data.timestamp;
    const MAX_AGE = 5 * 60 * 1000; // 5 minutes

    if (age > MAX_AGE) {
      logger.info("[CHUNK_CACHE] Cached chunks expired, clearing");
      sessionStorage.removeItem(key);
      return [];
    }

    logger.info("[CHUNK_CACHE] Loaded chunks from session:", {
      key,
      chunkCount: data.chunks.length,
      totalTweets: data.chunks.reduce(
        (sum: number, chunk: Tweet[]) => sum + chunk.length,
        0
      ),
      age: Math.round(age / 1000) + "s",
    });

    return data.chunks;
  } catch (error) {
    logger.error("[CHUNK_CACHE] Failed to load chunks:", error);
    return [];
  }
}

/**
 * Clears cached chunks for a specific query
 * @param query - Search query
 * @param exactMatch - Whether exact match was used
 */
export function clearChunks(query: string, exactMatch: boolean): void {
  if (typeof window === "undefined") return;

  try {
    const key = getCacheKey(query, exactMatch);
    sessionStorage.removeItem(key);
    logger.info("[CHUNK_CACHE] Cleared chunks for query:", { key });
  } catch (error) {
    logger.error("[CHUNK_CACHE] Failed to clear chunks:", error);
  }
}

/**
 * Clears all cached chunks (useful for cleanup)
 */
export function clearAllChunks(): void {
  if (typeof window === "undefined") return;

  try {
    const keys = Object.keys(sessionStorage);
    const chunkKeys = keys.filter((key) => key.startsWith(CHUNK_CACHE_PREFIX));

    chunkKeys.forEach((key) => sessionStorage.removeItem(key));

    logger.info("[CHUNK_CACHE] Cleared all chunks:", {
      count: chunkKeys.length,
    });
  } catch (error) {
    logger.error("[CHUNK_CACHE] Failed to clear all chunks:", error);
  }
}
