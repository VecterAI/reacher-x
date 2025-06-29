// features/search/hooks/useSearchHistory.ts
"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { generateUniqueId } from "@/shared/lib/utils/request";
import {
  getCurrentUTCTimestamp,
  formatTimestampForDisplay,
  validateAndNormalizeTimestamp,
} from "@/shared/lib/utils/timeUtils";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

interface SearchHistoryItem {
  id: string;
  keyword: string;
  exactMatch: boolean;
  timestamp: number; // Always UTC timestamp in milliseconds
  resultsCount?: number;
  // Migration field for backward compatibility
  legacyTimestamp?: string | number;
}

// Extended interface for internal use with raw timestamps
export interface KeywordItemWithRawTimestamp extends KeywordItem {
  rawTimestamp: number; // Unix timestamp for accurate grouping
}

export function useSearchHistory() {
  const [history, setHistory, isLoaded] = useLocalStorage<SearchHistoryItem[]>(
    "reacherx_search_history",
    []
  );

  const addToHistory = useCallback(
    (query: string, exactMatch: boolean, resultsCount = 0) => {
      const newItem: SearchHistoryItem = {
        id: generateUniqueId("search_history"),
        keyword: query.trim(),
        exactMatch,
        timestamp: getCurrentUTCTimestamp(), // Always use UTC timestamp
        resultsCount,
      };

      console.log("[SEARCH_HISTORY] Adding to history:", {
        keyword: newItem.keyword,
        id: newItem.id,
        timestamp: newItem.timestamp,
        utcTime: new Date(newItem.timestamp).toISOString(),
        exactMatch,
        resultsCount,
      });

      setHistory((prev) => {
        console.log("[SEARCH_HISTORY] Previous history:", {
          count: prev.length,
          keywords: prev.map((h) => h.keyword),
        });

        // Filter out items with invalid timestamps and migrate valid ones
        const migratedHistory = prev
          .filter((item) => {
            // First check if we already have a valid timestamp
            if (typeof item.timestamp === "number" && item.timestamp > 0) {
              return true;
            }

            // Try to validate and migrate legacy timestamp
            const validation = validateAndNormalizeTimestamp(
              item.legacyTimestamp || item.timestamp
            );

            return validation.isValid;
          })
          .map((item) => {
            // Apply migration only to items that need it
            if (typeof item.timestamp !== "number" || item.timestamp < 0) {
              const validation = validateAndNormalizeTimestamp(
                item.legacyTimestamp || item.timestamp
              );

              if (validation.isValid && validation.utcTimestamp) {
                console.warn(
                  "[SEARCH_HISTORY] Migrated legacy timestamp for:",
                  {
                    keyword: item.keyword,
                    oldTimestamp: item.timestamp,
                    newTimestamp: validation.utcTimestamp,
                  }
                );
                return {
                  ...item,
                  timestamp: validation.utcTimestamp,
                  legacyTimestamp: item.timestamp,
                };
              }
            }
            return item;
          });

        // Remove duplicate queries (same keyword)
        const filtered = migratedHistory.filter(
          (item) => item.keyword.toLowerCase() !== query.trim().toLowerCase()
        );

        console.log("[SEARCH_HISTORY] After filtering duplicates:", {
          originalCount: migratedHistory.length,
          filteredCount: filtered.length,
          removedDuplicates: migratedHistory.length - filtered.length,
        });

        // Add new item at the beginning and limit to 50 items
        const newHistory = [newItem, ...filtered].slice(0, 50);

        console.log("[SEARCH_HISTORY] New history:", {
          count: newHistory.length,
          keywords: newHistory.map((h) => h.keyword),
        });

        return newHistory;
      });
    },
    [setHistory]
  );

  const removeFromHistory = useCallback(
    (id: string) => {
      console.log("[SEARCH_HISTORY] Removing from history:", { id });
      setHistory((prev) => {
        const filtered = prev.filter((item) => item.id !== id);
        console.log("[SEARCH_HISTORY] After removal:", {
          originalCount: prev.length,
          newCount: filtered.length,
        });
        return filtered;
      });
    },
    [setHistory]
  );

  const clearHistory = useCallback(() => {
    console.log("[SEARCH_HISTORY] Clearing all history");
    setHistory([]);
  }, [setHistory]);

  // Convert to KeywordItem format for existing components
  const keywordItems: KeywordItem[] = history.map((item) => ({
    id: item.id,
    keyword: item.keyword,
    timestamp: formatTimestampForDisplay(item.timestamp), // Use timezone-aware formatting
  }));

  // Enhanced version with raw timestamps for accurate grouping
  const keywordItemsWithRawTimestamp: KeywordItemWithRawTimestamp[] =
    history.map((item) => ({
      id: item.id,
      keyword: item.keyword,
      timestamp: formatTimestampForDisplay(item.timestamp), // Formatted for display
      rawTimestamp: item.timestamp, // Raw UTC timestamp for grouping
    }));

  // Debug logging for current state
  console.log("[SEARCH_HISTORY] Current state:", {
    isLoaded,
    historyCount: history.length,
    keywordItemsCount: keywordItems.length,
    enhancedItemsCount: keywordItemsWithRawTimestamp.length,
    sampleTimestamps: history.slice(0, 3).map((h) => ({
      keyword: h.keyword,
      timestamp: h.timestamp,
      utcTime: new Date(h.timestamp).toISOString(),
      displayTime: formatTimestampForDisplay(h.timestamp),
    })),
  });

  return {
    history: keywordItems,
    historyWithRawTimestamp: keywordItemsWithRawTimestamp,
    rawHistory: history, // Original data for debugging
    addToHistory,
    removeFromHistory,
    clearHistory,
    isLoaded,
  };
}
