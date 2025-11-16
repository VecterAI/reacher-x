// shared/lib/utils/linkedinPostCache.ts
// Small LRU cache for LinkedIn posts to enable instant detail view rendering.
// Mirrors tweetCache shape but simplified for LinkedIn.

import { getLocalStorage, setLocalStorage } from "./localStorage";

const KEY = "reacherx_linkedin_post_cache";
const MAX_ENTRIES = 200;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface CachedLinkedInPost {
  id: string;
  post: unknown; // keep flexible; UI will cast to its shape
  cachedAt: number;
  lastAccessed: number;
}

interface CacheState {
  entries: Record<string, CachedLinkedInPost>;
}

function load(): CacheState {
  try {
    const raw = getLocalStorage(KEY);
    if (!raw) return { entries: {} };
    const parsed = JSON.parse(raw) as CacheState;
    return parsed?.entries ? parsed : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

function save(state: CacheState) {
  try {
    return setLocalStorage(KEY, JSON.stringify(state));
  } catch {
    return false;
  }
}

export function cacheLinkedInPost(id: string, post: unknown) {
  const state = load();
  const now = Date.now();
  state.entries[id] = {
    id,
    post,
    cachedAt: now,
    lastAccessed: now,
  };
  // Evict LRU if needed
  const keys = Object.keys(state.entries);
  if (keys.length > MAX_ENTRIES) {
    const sorted = Object.values(state.entries).sort(
      (a, b) => a.lastAccessed - b.lastAccessed
    );
    const toRemove = sorted.slice(0, keys.length - MAX_ENTRIES);
    for (const e of toRemove) delete state.entries[e.id];
  }
  save(state);
}

export function getCachedLinkedInPost<T = unknown>(id: string): T | null {
  const state = load();
  const entry = state.entries[id];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    delete state.entries[id];
    save(state);
    return null;
  }
  entry.lastAccessed = Date.now();
  state.entries[id] = entry;
  save(state);
  return (entry.post as T) ?? null;
}

export function touchLinkedInPostLRU(id: string) {
  const state = load();
  const entry = state.entries[id];
  if (!entry) return;
  entry.lastAccessed = Date.now();
  save(state);
}
