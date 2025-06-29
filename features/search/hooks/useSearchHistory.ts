// features/search/hooks/useSearchHistory.ts
"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { generateUniqueId } from "@/shared/lib/utils/request";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

interface SearchHistoryItem {
  id: string;
  keyword: string;
  exactMatch: boolean;
  timestamp: number;
  resultsCount?: number;
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
        timestamp: Date.now(),
        resultsCount,
      };

      console.log("[SEARCH_HISTORY] Adding to history:", {
        keyword: newItem.keyword,
        id: newItem.id,
        timestamp: newItem.timestamp,
        exactMatch,
        resultsCount,
      });

      setHistory((prev) => {
        console.log("[SEARCH_HISTORY] Previous history:", {
          count: prev.length,
          keywords: prev.map((h) => h.keyword),
        });

        // Remove duplicate queries (same keyword)
        const filtered = prev.filter(
          (item) => item.keyword.toLowerCase() !== query.trim().toLowerCase()
        );

        console.log("[SEARCH_HISTORY] After filtering duplicates:", {
          originalCount: prev.length,
          filteredCount: filtered.length,
          removedDuplicates: prev.length - filtered.length,
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
    timestamp: formatTimestamp(item.timestamp),
  }));

  // Enhanced version with raw timestamps for accurate grouping
  const keywordItemsWithRawTimestamp: KeywordItemWithRawTimestamp[] =
    history.map((item) => ({
      id: item.id,
      keyword: item.keyword,
      timestamp: formatTimestamp(item.timestamp), // Formatted for display
      rawTimestamp: item.timestamp, // Raw for grouping
    }));

  // Debug logging for current state
  console.log("[SEARCH_HISTORY] Current state:", {
    isLoaded,
    historyCount: history.length,
    keywordItemsCount: keywordItems.length,
    enhancedItemsCount: keywordItemsWithRawTimestamp.length,
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

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Handle cases where the timestamp is in the future or exactly now
  if (diffInSeconds <= 0) return "now";

  // Less than 60 seconds - show "now"
  if (diffInSeconds < 60) return "now";

  // Less than 60 minutes - show minutes
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;

  // Less than 24 hours - show hours
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;

  // Less than 7 days - show days
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;

  // 7 days or older - show formatted date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
