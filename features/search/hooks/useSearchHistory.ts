// features/search/hooks/useSearchHistory.ts
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  getKeywords,
  type UnifiedKeyword,
} from "@/shared/lib/utils/unifiedKeywordStore";
import { formatTimestampForDisplay } from "@/shared/lib/utils/timeUtils";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

// This type remains useful for components that need both raw and formatted timestamps
export interface KeywordItemWithRawTimestamp extends KeywordItem {
  rawTimestamp: number;
  isPinned?: boolean;
  exactMatch?: boolean;
}

export function useSearchHistory() {
  const [allKeywords, setAllKeywords] = useState<UnifiedKeyword[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Function to refresh keywords from the store
  const refreshKeywords = useCallback(() => {
    setAllKeywords(getKeywords());
    setIsLoaded(true);
  }, []);

  // Load all keywords on mount and create a listener for storage changes
  useEffect(() => {
    refreshKeywords();

    const handleStorageChange = () => {
      console.log(
        "[useSearchHistory] Detected storage change, refreshing keywords."
      );
      refreshKeywords();
    };

    window.addEventListener("onLocalStorageChange", handleStorageChange);
    return () => {
      window.removeEventListener("onLocalStorageChange", handleStorageChange);
    };
  }, [refreshKeywords]);

  // Convert to KeywordItem format for general purpose use
  const history: KeywordItem[] = useMemo(
    () =>
      allKeywords.map((item) => ({
        id: item.id,
        keyword: item.keyword,
        timestamp: formatTimestampForDisplay(item.lastUsedAt),
        isPinned: item.isPinned,
        exactMatch: item.exactMatch,
      })),
    [allKeywords]
  );

  // Enhanced version with raw timestamps for accurate grouping
  const historyWithRawTimestamp: KeywordItemWithRawTimestamp[] = useMemo(
    () =>
      allKeywords.map((item) => ({
        id: item.id,
        keyword: item.keyword,
        timestamp: formatTimestampForDisplay(item.lastUsedAt),
        rawTimestamp: item.lastUsedAt,
        isPinned: item.isPinned,
        exactMatch: item.exactMatch,
      })),
    [allKeywords]
  );

  return {
    history,
    historyWithRawTimestamp,
    isLoaded,
  };
}
