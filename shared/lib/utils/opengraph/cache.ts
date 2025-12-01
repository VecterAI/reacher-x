/**
 * Open Graph Data Caching System
 *
 * Provides intelligent caching for Open Graph data to improve performance
 * and reduce unnecessary network requests.
 */

import { OpenGraphData } from "./types";

interface CacheEntry {
  data: OpenGraphData | null;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheOptions {
  maxSize?: number;
  defaultTtl?: number; // Default TTL in milliseconds (1 hour)
  cleanupInterval?: number; // Cleanup interval in milliseconds (5 minutes)
}

class OpenGraphCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private defaultTtl: number;
  private cleanupInterval: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTtl = options.defaultTtl || 60 * 60 * 1000; // 1 hour
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes

    this.startCleanupTimer();
  }

  /**
   * Get cached Open Graph data for a URL
   */
  get(url: string): OpenGraphData | null | undefined {
    const entry = this.cache.get(url);

    if (!entry) {
      return undefined; // Not in cache
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(url);
      return undefined; // Expired
    }

    return entry.data;
  }

  /**
   * Set Open Graph data in cache
   */
  set(url: string, data: OpenGraphData | null, ttl?: number): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(url, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
    });
  }

  /**
   * Check if URL is in cache and not expired
   */
  has(url: string): boolean {
    const entry = this.cache.get(url);
    if (!entry) return false;

    const now = Date.now();
    return now - entry.timestamp <= entry.ttl;
  }

  /**
   * Remove specific URL from cache
   */
  delete(url: string): boolean {
    return this.cache.delete(url);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp <= entry.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries,
      maxSize: this.maxSize,
    };
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.cache.delete(key));
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }
}

// Global cache instance
export const openGraphCache = new OpenGraphCache({
  maxSize: 100,
  defaultTtl: 60 * 60 * 1000, // 1 hour
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
});

/**
 * Hook for React components to use the cache
 */
export function useOpenGraphCache() {
  return {
    get: (url: string) => openGraphCache.get(url),
    set: (url: string, data: OpenGraphData | null, ttl?: number) =>
      openGraphCache.set(url, data, ttl),
    has: (url: string) => openGraphCache.has(url),
    delete: (url: string) => openGraphCache.delete(url),
    clear: () => openGraphCache.clear(),
    getStats: () => openGraphCache.getStats(),
  };
}

