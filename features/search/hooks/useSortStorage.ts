// features/search/hooks/useSortStorage.ts
"use client";

import { useCallback } from "react";
import type { SortState } from "../types";

const SORT_STORAGE_KEY = "reacher_x_sort_settings";

interface StoredSortSettings {
  [keyword: string]: {
    sort: SortState;
    timestamp: number;
  };
}

export function useSortStorage() {
  // Get stored sort settings
  const getStoredSettings = useCallback((): StoredSortSettings => {
    if (typeof window === "undefined") return {};

    try {
      const stored = localStorage.getItem(SORT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn("[SORT_STORAGE] Failed to parse stored settings:", error);
      return {};
    }
  }, []);

  // Save sort settings for a keyword
  const saveSortSettings = useCallback(
    (keyword: string, sort: SortState) => {
      if (typeof window === "undefined") return;

      try {
        const settings = getStoredSettings();
        settings[keyword] = {
          sort,
          timestamp: Date.now(),
        };

        // Clean up old entries (keep only last 100 keywords)
        const entries = Object.entries(settings);
        if (entries.length > 100) {
          const sortedEntries = entries.sort(
            (a, b) => b[1].timestamp - a[1].timestamp
          );
          const cleanedSettings: StoredSortSettings = {};
          sortedEntries.slice(0, 100).forEach(([key, value]) => {
            cleanedSettings[key] = value;
          });
          localStorage.setItem(
            SORT_STORAGE_KEY,
            JSON.stringify(cleanedSettings)
          );
        } else {
          localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(settings));
        }

        console.log("[SORT_STORAGE] Saved sort settings for keyword:", keyword);
      } catch (error) {
        console.error("[SORT_STORAGE] Failed to save sort settings:", error);
      }
    },
    [getStoredSettings]
  );

  // Get sort settings for a keyword
  const getSortSettings = useCallback(
    (keyword: string): SortState | null => {
      if (typeof window === "undefined") return null;

      try {
        const settings = getStoredSettings();
        const keywordSettings = settings[keyword];

        if (keywordSettings) {
          console.log(
            "[SORT_STORAGE] Found stored sort settings for keyword:",
            keyword
          );
          return keywordSettings.sort;
        }

        return null;
      } catch (error) {
        console.warn("[SORT_STORAGE] Failed to get sort settings:", error);
        return null;
      }
    },
    [getStoredSettings]
  );

  // Clear sort settings for a keyword
  const clearSortSettings = useCallback(
    (keyword: string) => {
      if (typeof window === "undefined") return;

      try {
        const settings = getStoredSettings();
        delete settings[keyword];
        localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(settings));
        console.log(
          "[SORT_STORAGE] Cleared sort settings for keyword:",
          keyword
        );
      } catch (error) {
        console.error("[SORT_STORAGE] Failed to clear sort settings:", error);
      }
    },
    [getStoredSettings]
  );

  // Get all stored keywords
  const getStoredKeywords = useCallback((): string[] => {
    const settings = getStoredSettings();
    return Object.keys(settings);
  }, [getStoredSettings]);

  // Check if a keyword has stored sort settings
  const hasStoredSettings = useCallback(
    (keyword: string): boolean => {
      const settings = getStoredSettings();
      return keyword in settings;
    },
    [getStoredSettings]
  );

  // Get the most recently used keywords with sort settings
  const getRecentKeywordsWithSort = useCallback(
    (limit: number = 10): Array<{ keyword: string; timestamp: number }> => {
      const settings = getStoredSettings();
      const entries = Object.entries(settings)
        .map(([keyword, data]) => ({ keyword, timestamp: data.timestamp }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return entries;
    },
    [getStoredSettings]
  );

  return {
    saveSortSettings,
    getSortSettings,
    clearSortSettings,
    getStoredKeywords,
    hasStoredSettings,
    getRecentKeywordsWithSort,
  };
}
