// features/search/hooks/useOptimisticSearch.ts
"use client";

import { useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getWorkspaceDescription } from "@/shared/lib/utils/localStorage";
import { isLlmFilterDisabled } from "@/shared/lib/utils/featureFlags";

import {
  getCachedSearchResult,
  cacheSearchResult,
} from "@/shared/lib/utils/searchCache";
import type { SearchResult } from "./useTwitterSearch";

// Global cache for optimistic search results
const optimisticSearchCache = new Map<string, SearchResult>();

export function useOptimisticSearch() {
  const searchTwitterAction = useAction(api.twitterSearch.searchTwitter);
  const filterTweetsAction = useAction(api.llmFilter.filterTweetsWithLLM);
  const pendingSearches = useRef<Set<string>>(new Set());

  const startOptimisticSearch = useCallback(
    async (query: string, exactMatch: boolean) => {
      const searchKey = `${query.trim()}_${exactMatch}`;

      // Check if already searching
      if (pendingSearches.current.has(searchKey)) {
        return;
      }

      // Check cache first
      const cachedResult = getCachedSearchResult(query.trim(), exactMatch);
      if (cachedResult) {
        optimisticSearchCache.set(searchKey, cachedResult);
        return;
      }

      pendingSearches.current.add(searchKey);

      try {
        // Get user description for filtering
        let userDescription: string | null = null;
        try {
          userDescription = getWorkspaceDescription();
        } catch (error) {
          console.warn(
            "[OPTIMISTIC_SEARCH] Failed to get user description:",
            error
          );
        }

        const hasValidDescription =
          typeof userDescription === "string" &&
          userDescription.trim().length >= 64 &&
          userDescription.trim().length <= 512;

        // Start Twitter search
        const searchResult = await searchTwitterAction({
          query: query.trim(),
          exactMatch,
        });

        if (!searchResult?.success) {
          console.warn(
            "[OPTIMISTIC_SEARCH] Twitter search failed:",
            searchResult?.error
          );
          return;
        }

        // Transform results
        const transformedResults: SearchResult = {
          tweets: searchResult.data?.tweets || [],
          meta: {
            has_next_page: searchResult.data?.has_next_page,
            next_cursor: searchResult.data?.next_cursor,
            originalCount: searchResult.data?.tweets?.length || 0,
          },
        };

        // Apply LLM filtering only when we have tweets and a valid description
        if (
          !isLlmFilterDisabled() &&
          transformedResults.tweets.length > 0 &&
          hasValidDescription
        ) {
          try {
            const filterResult = await filterTweetsAction({
              tweets: {
                tweets: transformedResults.tweets,
                meta: transformedResults.meta,
              },
              originalQuery: query.trim(),
              userDescription: userDescription || undefined,
            });

            if (filterResult.success && filterResult.data) {
              const finalResults: SearchResult = {
                tweets: filterResult.data.tweets,
                meta: {
                  ...transformedResults.meta,
                  ...filterResult.data.meta,
                  originalCount: transformedResults.tweets.length,
                },
              };

              // Cache the optimistic result
              optimisticSearchCache.set(searchKey, finalResults);
              cacheSearchResult(query.trim(), exactMatch, finalResults);
            } else {
              // Use unfiltered results if filtering fails
              optimisticSearchCache.set(searchKey, transformedResults);
              cacheSearchResult(query.trim(), exactMatch, transformedResults);
            }
          } catch (filterError) {
            console.warn(
              "[OPTIMISTIC_SEARCH] LLM filtering failed:",
              filterError
            );
            optimisticSearchCache.set(searchKey, transformedResults);
            cacheSearchResult(query.trim(), exactMatch, transformedResults);
          }
        } else {
          // No filtering needed
          optimisticSearchCache.set(searchKey, transformedResults);
          cacheSearchResult(query.trim(), exactMatch, transformedResults);
        }
      } catch (error) {
        console.error("[OPTIMISTIC_SEARCH] Search failed:", error);
      } finally {
        pendingSearches.current.delete(searchKey);
      }
    },
    [searchTwitterAction, filterTweetsAction]
  );

  const getOptimisticResult = useCallback(
    (query: string, exactMatch: boolean) => {
      const searchKey = `${query.trim()}_${exactMatch}`;
      return optimisticSearchCache.get(searchKey);
    },
    []
  );

  const clearOptimisticCache = useCallback(() => {
    optimisticSearchCache.clear();
  }, []);

  return {
    startOptimisticSearch,
    getOptimisticResult,
    clearOptimisticCache,
  };
}
