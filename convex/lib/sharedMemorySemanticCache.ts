import { createStableHash } from "./memoryHelpers";

/**
 * Shared-memory semantic search results are stable for short windows, and the
 * same (workspace, query) pair recurs across retries and batch evaluations.
 * Caching the resolved memory IDs avoids paying for identical vector searches
 * while leaving freshness checks to the canonical-store resolution step.
 */
export const SHARED_MEMORY_SEMANTIC_CACHE_TTL_MS = 10 * 60 * 1000;
export const SHARED_MEMORY_SEMANTIC_CACHE_MAX_ENTRIES = 256;

type SharedMemorySemanticCacheEntry = {
  workspaceId: string;
  query: string;
  expiresAtMs: number;
  memoryIds: string[];
};

const sharedMemorySemanticCache = new Map<
  string,
  SharedMemorySemanticCacheEntry
>();

export function buildSharedMemorySemanticCacheKey(args: {
  workspaceId: string;
  query: string;
}): string {
  return `${args.workspaceId}:${createStableHash(args.query)}`;
}

export function getCachedSharedMemorySemanticIds(args: {
  workspaceId: string;
  query: string;
  nowMs: number;
}): string[] | null {
  const key = buildSharedMemorySemanticCacheKey({
    workspaceId: args.workspaceId,
    query: args.query,
  });
  const entry = sharedMemorySemanticCache.get(key);
  if (!entry) {
    return null;
  }
  if (
    entry.workspaceId !== args.workspaceId ||
    entry.query !== args.query ||
    entry.expiresAtMs <= args.nowMs
  ) {
    sharedMemorySemanticCache.delete(key);
    return null;
  }
  // Refresh insertion order so hot entries survive capacity pruning.
  sharedMemorySemanticCache.delete(key);
  sharedMemorySemanticCache.set(key, entry);
  return [...entry.memoryIds];
}

export function setCachedSharedMemorySemanticIds(args: {
  workspaceId: string;
  query: string;
  memoryIds: string[];
  nowMs: number;
}): void {
  const key = buildSharedMemorySemanticCacheKey({
    workspaceId: args.workspaceId,
    query: args.query,
  });
  sharedMemorySemanticCache.delete(key);
  sharedMemorySemanticCache.set(key, {
    workspaceId: args.workspaceId,
    query: args.query,
    expiresAtMs: args.nowMs + SHARED_MEMORY_SEMANTIC_CACHE_TTL_MS,
    memoryIds: [...args.memoryIds],
  });
  pruneSharedMemorySemanticCache(args.nowMs);
}

export function clearSharedMemorySemanticCache(): void {
  sharedMemorySemanticCache.clear();
}

function pruneSharedMemorySemanticCache(nowMs: number): void {
  for (const [key, entry] of sharedMemorySemanticCache) {
    if (entry.expiresAtMs <= nowMs) {
      sharedMemorySemanticCache.delete(key);
    }
  }
  while (
    sharedMemorySemanticCache.size > SHARED_MEMORY_SEMANTIC_CACHE_MAX_ENTRIES
  ) {
    const oldestKey = sharedMemorySemanticCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    sharedMemorySemanticCache.delete(oldestKey);
  }
}
