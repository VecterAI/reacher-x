/**
 * Lightweight Tweet Cache
 *
 * Purpose: show a clicked tweet instantly on the post detail page by
 * hydrating from localStorage first, then optionally fetching fresher data.
 *
 * Design:
 * - Per-tweet entries keyed by tweetId (id_str)
 * - TTL-based expiration (default 10 minutes)
 * - Small fixed-size LRU to avoid localStorage bloat
 */

import { getLocalStorage, setLocalStorage } from "./localStorage";
import type { Tweet } from "@/features/threads/types";

const STORAGE_KEY = "reacherx_tweet_cache";

const CONFIG = {
  TTL_MS: 10 * 60 * 1000,
  MAX_ENTRIES: 200,
} as const;

type CacheEntry = {
  tweetId: string;
  tweet: Tweet;
  cachedAt: number;
  lastAccessed: number;
};

type TweetCacheState = {
  entries: Record<string, CacheEntry>; // tweetId -> entry
  order: string[]; // LRU order, most-recent at end
};

function load(): TweetCacheState {
  const raw = getLocalStorage(STORAGE_KEY);
  if (!raw) return { entries: {}, order: [] };
  try {
    const parsed = JSON.parse(raw) as TweetCacheState;
    return parsed && parsed.entries && parsed.order
      ? parsed
      : { entries: {}, order: [] };
  } catch {
    return { entries: {}, order: [] };
  }
}

function save(state: TweetCacheState) {
  try {
    setLocalStorage(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function evictIfNeeded(state: TweetCacheState) {
  while (state.order.length > CONFIG.MAX_ENTRIES) {
    const oldest = state.order.shift();
    if (oldest) delete state.entries[oldest];
  }
}

export function cacheTweet(tweet: Tweet) {
  const tweetId = tweet.id_str || String(tweet.id || "");
  if (!tweetId) return;

  const state = load();
  const now = Date.now();
  const entry: CacheEntry = {
    tweetId,
    tweet,
    cachedAt: now,
    lastAccessed: now,
  };

  state.entries[tweetId] = entry;
  // Move to MRU
  state.order = state.order.filter((id) => id !== tweetId);
  state.order.push(tweetId);
  evictIfNeeded(state);
  save(state);
}

export function getCachedTweet(tweetId: string): Tweet | null {
  if (!tweetId) return null;
  const state = load();
  const entry = state.entries[tweetId];
  if (!entry) return null;

  // TTL check
  if (Date.now() - entry.cachedAt > CONFIG.TTL_MS) {
    // Expired; remove softly
    delete state.entries[tweetId];
    state.order = state.order.filter((id) => id !== tweetId);
    save(state);
    return null;
  }

  // touch LRU
  entry.lastAccessed = Date.now();
  state.order = state.order.filter((id) => id !== tweetId);
  state.order.push(tweetId);
  save(state);
  return entry.tweet;
}

export function clearTweet(tweetId: string) {
  const state = load();
  delete state.entries[tweetId];
  state.order = state.order.filter((id) => id !== tweetId);
  save(state);
}
