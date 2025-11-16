// shared/lib/utils/linkedinSearchCache.ts
// Lightweight LRU + TTL cache for LinkedIn search results (per query+exact).
// Mirrors the structure used for Twitter search cache but stores UnifiedPost[] pages.
import { getLocalStorage, setLocalStorage } from "./localStorage";
import { base64UrlEncodeUtf8 } from "./encoding";
import type { UnifiedPost } from "@/shared/lib/platforms/types";

const STORAGE_KEY = "reacherx_linkedin_search_cache";

const CONFIG = {
  TTL_MS: 10 * 60 * 1000, // 10 minutes
  MAX_ENTRIES: 50,
} as const;

export interface LinkedInSearchResultCache {
  posts: UnifiedPost[];
  meta?: {
    has_next_page?: boolean;
    next_cursor?: number;
    originalCount?: number;
    chunkSetId?: string | null;
  };
}

interface CacheEntry {
  key: string;
  query: string;
  exact: boolean;
  result: LinkedInSearchResultCache;
  cachedAt: number;
  lastAccessed: number;
  size: number;
}

interface CacheState {
  entries: Record<string, CacheEntry>;
}

function now() {
  return Date.now();
}

function estimateSize(obj: unknown): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return 0;
  }
}

function makeKey(query: string, exact: boolean): string {
  return base64UrlEncodeUtf8(`${query}::${exact ? "1" : "0"}`);
}

function load(): CacheState {
  try {
    const raw = getLocalStorage(STORAGE_KEY);
    if (!raw) return { entries: {} };
    const parsed = JSON.parse(raw) as CacheState;
    return parsed && parsed.entries ? parsed : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

function save(state: CacheState) {
  try {
    setLocalStorage(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function evictLRU(state: CacheState) {
  const keys = Object.keys(state.entries);
  if (keys.length <= CONFIG.MAX_ENTRIES) return;
  const sorted = keys
    .map((k) => state.entries[k])
    .sort((a, b) => a.lastAccessed - b.lastAccessed);
  const toRemove = sorted.slice(
    0,
    Math.max(0, keys.length - CONFIG.MAX_ENTRIES)
  );
  for (const e of toRemove) {
    delete state.entries[e.key];
  }
}

export function getCachedLinkedInSearchResult(
  query: string,
  exact: boolean
): LinkedInSearchResultCache | null {
  const state = load();
  const key = makeKey(query.trim(), exact);
  const entry = state.entries[key];
  if (!entry) return null;
  if (now() - entry.cachedAt > CONFIG.TTL_MS) {
    delete state.entries[key];
    save(state);
    return null;
  }
  entry.lastAccessed = now();
  state.entries[key] = entry;
  save(state);
  return entry.result;
}

export function cacheLinkedInSearchResult(
  query: string,
  exact: boolean,
  result: LinkedInSearchResultCache
): boolean {
  try {
    const state = load();
    const key = makeKey(query.trim(), exact);
    const entry: CacheEntry = {
      key,
      query: query.trim(),
      exact,
      result,
      cachedAt: now(),
      lastAccessed: now(),
      size: estimateSize(result),
    };
    state.entries[key] = entry;
    evictLRU(state);
    save(state);
    return true;
  } catch {
    return false;
  }
}

export function updateCachedLinkedInSearchResult(
  query: string,
  exact: boolean,
  updater: (prev: LinkedInSearchResultCache | null) => LinkedInSearchResultCache
): boolean {
  try {
    const state = load();
    const key = makeKey(query.trim(), exact);
    const prev = state.entries[key]?.result || null;
    const next = updater(prev);
    const entry: CacheEntry = {
      key,
      query: query.trim(),
      exact,
      result: next,
      cachedAt: state.entries[key]?.cachedAt ?? now(),
      lastAccessed: now(),
      size: estimateSize(next),
    };
    state.entries[key] = entry;
    evictLRU(state);
    save(state);
    return true;
  } catch {
    return false;
  }
}

export function maintainLinkedInSearchCache(): void {
  try {
    const state = load();
    const nowTs = now();
    for (const [key, entry] of Object.entries(state.entries)) {
      if (nowTs - entry.cachedAt > CONFIG.TTL_MS) {
        delete state.entries[key];
      }
    }
    evictLRU(state);
    save(state);
  } catch {}
}
