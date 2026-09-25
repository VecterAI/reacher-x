import { beforeEach, describe, expect, test } from "vitest";
import {
  buildSharedMemorySemanticCacheKey,
  clearSharedMemorySemanticCache,
  getCachedSharedMemorySemanticIds,
  setCachedSharedMemorySemanticIds,
  SHARED_MEMORY_SEMANTIC_CACHE_MAX_ENTRIES,
  SHARED_MEMORY_SEMANTIC_CACHE_TTL_MS,
} from "./sharedMemorySemanticCache";

const NOW_MS = 1_000_000;

function fillCache(entryCount: number, args?: { nowMs?: number }) {
  for (let index = 0; index < entryCount; index += 1) {
    setCachedSharedMemorySemanticIds({
      workspaceId: `wsp${index.toString().padStart(4, "0")}`,
      query: "same query",
      memoryIds: [`memory-${index}`],
      nowMs: args?.nowMs ?? NOW_MS,
    });
  }
}

describe("shared memory semantic cache", () => {
  beforeEach(() => {
    clearSharedMemorySemanticCache();
  });

  test("returns stored ids for the same workspace and query", () => {
    setCachedSharedMemorySemanticIds({
      workspaceId: "wsp1",
      query: "qualify saas founders",
      memoryIds: ["m1", "m2"],
      nowMs: NOW_MS,
    });

    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp1",
        query: "qualify saas founders",
        nowMs: NOW_MS + 1,
      })
    ).toEqual(["m1", "m2"]);
  });

  test("misses for a different query or workspace", () => {
    setCachedSharedMemorySemanticIds({
      workspaceId: "wsp1",
      query: "qualify saas founders",
      memoryIds: ["m1"],
      nowMs: NOW_MS,
    });

    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp1",
        query: "qualify newsletter creators",
        nowMs: NOW_MS + 1,
      })
    ).toBeNull();
    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp2",
        query: "qualify saas founders",
        nowMs: NOW_MS + 1,
      })
    ).toBeNull();
  });

  test("misses and drops entries once the ttl expires", () => {
    setCachedSharedMemorySemanticIds({
      workspaceId: "wsp1",
      query: "qualify saas founders",
      memoryIds: ["m1"],
      nowMs: NOW_MS,
    });

    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp1",
        query: "qualify saas founders",
        nowMs: NOW_MS + 5_999,
      })
    ).toEqual(["m1"]);
    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp1",
        query: "qualify saas founders",
        nowMs: NOW_MS + 600_001,
      })
    ).toBeNull();
  });

  test("overwriting a key replaces the entry and refreshes it", () => {
    setCachedSharedMemorySemanticIds({
      workspaceId: "wsp1",
      query: "q",
      memoryIds: ["old"],
      nowMs: NOW_MS,
    });
    setCachedSharedMemorySemanticIds({
      workspaceId: "wsp1",
      query: "q",
      memoryIds: ["new"],
      nowMs: NOW_MS + 1000,
    });

    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp1",
        query: "q",
        nowMs: NOW_MS + 1001,
      })
    ).toEqual(["new"]);
  });

  test("prunes expired entries before evicting live ones at capacity", () => {
    fillCache(SHARED_MEMORY_SEMANTIC_CACHE_MAX_ENTRIES);
    // Expire every entry, then add one fresh entry beyond capacity.
    setCachedSharedMemorySemanticIds({
      workspaceId: "wsp-fresh",
      query: "same query",
      memoryIds: ["memory-fresh"],
      nowMs: NOW_MS + SHARED_MEMORY_SEMANTIC_CACHE_TTL_MS + 1,
    });

    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp0000",
        query: "same query",
        nowMs: NOW_MS + SHARED_MEMORY_SEMANTIC_CACHE_TTL_MS + 1,
      })
    ).toBeNull();
    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp-fresh",
        query: "same query",
        nowMs: NOW_MS + SHARED_MEMORY_SEMANTIC_CACHE_TTL_MS + 1,
      })
    ).toEqual(["memory-fresh"]);
  });

  test("evicts the least recently used entry when all entries are live", () => {
    fillCache(SHARED_MEMORY_SEMANTIC_CACHE_MAX_ENTRIES);
    // A hit moves wsp0000 to the back of the eviction order.
    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp0000",
        query: "same query",
        nowMs: NOW_MS,
      })
    ).toEqual(["memory-0"]);

    setCachedSharedMemorySemanticIds({
      workspaceId: "wsp-new",
      query: "same query",
      memoryIds: ["memory-new"],
      nowMs: NOW_MS,
    });

    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp0000",
        query: "same query",
        nowMs: NOW_MS + 1,
      })
    ).toEqual(["memory-0"]);
    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp0001",
        query: "same query",
        nowMs: NOW_MS + 1,
      })
    ).toBeNull();
    expect(
      getCachedSharedMemorySemanticIds({
        workspaceId: "wsp-new",
        query: "same query",
        nowMs: NOW_MS + 1,
      })
    ).toEqual(["memory-new"]);
  });

  test("keys differ across workspaces for identical queries", () => {
    expect(
      buildSharedMemorySemanticCacheKey({
        workspaceId: "wsp1",
        query: "q",
      })
    ).not.toEqual(
      buildSharedMemorySemanticCacheKey({
        workspaceId: "wsp2",
        query: "q",
      })
    );
  });
});
