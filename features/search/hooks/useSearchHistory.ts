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

      setHistory((prev) => {
        // Remove duplicate queries (same keyword)
        const filtered = prev.filter(
          (item) => item.keyword.toLowerCase() !== query.trim().toLowerCase()
        );

        // Add new item at the beginning and limit to 50 items
        return [newItem, ...filtered].slice(0, 50);
      });
    },
    [setHistory]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  // Convert to KeywordItem format for existing components
  const keywordItems: KeywordItem[] = history.map((item) => ({
    id: item.id,
    keyword: item.keyword,
    timestamp: formatTimestamp(item.timestamp),
  }));

  return {
    history: keywordItems,
    addToHistory,
    clearHistory,
    isLoaded,
  };
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  );

  if (diffInHours < 1) return "now";
  if (diffInHours < 24) return `${diffInHours}h`;
  if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
