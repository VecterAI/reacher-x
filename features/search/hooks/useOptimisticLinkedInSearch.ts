"use client";

import { useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isLlmFilterDisabled } from "@/shared/lib/utils/featureFlags";
import type { UnifiedPost } from "@/shared/lib/platforms/types";

export interface OptimisticLinkedInResult {
  posts: UnifiedPost[];
  meta?: {
    has_next_page?: boolean;
    next_cursor?: number;
    originalCount?: number;
  };
}

const optimisticLinkedInCache = new Map<string, OptimisticLinkedInResult>();

export function useOptimisticLinkedInSearch() {
  const searchLinkedInAction = useAction(api.linkedinSearch.searchLinkedIn);
  const pending = useRef<Set<string>>(new Set());

  const startOptimisticLinkedInSearch = useCallback(
    async (query: string, exactMatch: boolean) => {
      const key = `${query.trim()}_${exactMatch}`;
      if (pending.current.has(key)) return;
      if (optimisticLinkedInCache.has(key)) return;
      pending.current.add(key);
      try {
        const res = await searchLinkedInAction({
          query: query.trim(),
          exactMatch,
        });
        if (!res?.success) return;
        const meta = (res.data || {}) as {
          posts?: UnifiedPost[];
          has_next_page?: boolean;
          next_cursor?: number;
        };
        const posts = (meta.posts || []).map((p) => ({
          ...p,
          platform: "linkedin" as const,
        }));
        const result: OptimisticLinkedInResult = {
          posts,
          meta: {
            has_next_page: meta?.has_next_page,
            next_cursor: meta?.next_cursor,
            originalCount: posts.length,
          },
        };
        if (isLlmFilterDisabled()) {
          optimisticLinkedInCache.set(key, result);
        } else {
          optimisticLinkedInCache.set(key, result);
        }
      } finally {
        pending.current.delete(key);
      }
    },
    [searchLinkedInAction]
  );

  const getOptimisticLinkedInResult = useCallback(
    (query: string, exactMatch: boolean) => {
      const key = `${query.trim()}_${exactMatch}`;
      return optimisticLinkedInCache.get(key);
    },
    []
  );

  const clearOptimisticLinkedInCache = useCallback(() => {
    optimisticLinkedInCache.clear();
  }, []);

  return {
    startOptimisticLinkedInSearch,
    getOptimisticLinkedInResult,
    clearOptimisticLinkedInCache,
  };
}
