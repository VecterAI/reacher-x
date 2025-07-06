// features/search/hooks/useFilterStorage.ts
"use client";

import { useCallback } from "react";
import type { FilterState } from "../types";

const FILTER_STORAGE_KEY = "reacher_x_filter_settings";

interface StoredFilterSettings {
  [keyword: string]: {
    filters: FilterState;
    timestamp: number;
  };
}

export function useFilterStorage() {
  // Get stored filter settings
  const getStoredSettings = useCallback((): StoredFilterSettings => {
    if (typeof window === "undefined") return {};

    try {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn("[FILTER_STORAGE] Failed to parse stored settings:", error);
      return {};
    }
  }, []);

  // Save filter settings for a keyword
  const saveFilterSettings = useCallback(
    (keyword: string, filters: FilterState) => {
      if (typeof window === "undefined") return;

      try {
        const settings = getStoredSettings();
        settings[keyword] = {
          filters,
          timestamp: Date.now(),
        };

        // Clean up old entries (keep only last 100 keywords)
        const entries = Object.entries(settings);
        if (entries.length > 100) {
          const sortedEntries = entries.sort(
            (a, b) => b[1].timestamp - a[1].timestamp
          );
          const cleanedSettings: StoredFilterSettings = {};
          sortedEntries.slice(0, 100).forEach(([key, value]) => {
            cleanedSettings[key] = value;
          });
          localStorage.setItem(
            FILTER_STORAGE_KEY,
            JSON.stringify(cleanedSettings)
          );
        } else {
          localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(settings));
        }

        console.log(
          "[FILTER_STORAGE] Saved filter settings for keyword:",
          keyword
        );
      } catch (error) {
        console.error(
          "[FILTER_STORAGE] Failed to save filter settings:",
          error
        );
      }
    },
    [getStoredSettings]
  );

  // Get filter settings for a keyword
  const getFilterSettings = useCallback(
    (keyword: string): FilterState | null => {
      if (typeof window === "undefined") return null;

      try {
        const settings = getStoredSettings();
        const keywordSettings = settings[keyword];

        if (keywordSettings) {
          console.log(
            "[FILTER_STORAGE] Found stored filter settings for keyword:",
            keyword
          );
          return keywordSettings.filters;
        }

        return null;
      } catch (error) {
        console.warn("[FILTER_STORAGE] Failed to get filter settings:", error);
        return null;
      }
    },
    [getStoredSettings]
  );

  // Clear filter settings for a keyword
  const clearFilterSettings = useCallback(
    (keyword: string) => {
      if (typeof window === "undefined") return;

      try {
        const settings = getStoredSettings();
        delete settings[keyword];
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(settings));
        console.log(
          "[FILTER_STORAGE] Cleared filter settings for keyword:",
          keyword
        );
      } catch (error) {
        console.error(
          "[FILTER_STORAGE] Failed to clear filter settings:",
          error
        );
      }
    },
    [getStoredSettings]
  );

  // Get all stored keywords
  const getStoredKeywords = useCallback((): string[] => {
    const settings = getStoredSettings();
    return Object.keys(settings);
  }, [getStoredSettings]);

  // Check if a keyword has stored filter settings
  const hasStoredSettings = useCallback(
    (keyword: string): boolean => {
      const settings = getStoredSettings();
      return keyword in settings;
    },
    [getStoredSettings]
  );

  // Get the most recently used keywords with filter settings
  const getRecentKeywordsWithFilters = useCallback(
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
    saveFilterSettings,
    getFilterSettings,
    clearFilterSettings,
    getStoredKeywords,
    hasStoredSettings,
    getRecentKeywordsWithFilters,
  };
}
