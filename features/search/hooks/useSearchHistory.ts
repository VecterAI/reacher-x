// features/search/hooks/useSearchHistory.ts
"use client";

import { useMemo } from "react";
// UnifiedKeyword type not needed directly here
import { formatTimestampForDisplay } from "@/shared/lib/utils/timeUtils";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";
import { useUnifiedKeywords } from "@/shared/hooks/useUnifiedKeywords";

// This type remains useful for components that need both raw and formatted timestamps
export type KeywordItemWithRawTimestamp = Extract<
  KeywordItem,
  { kind: "history" | "similar" }
> & {
  rawTimestamp: number;
};

/**
 * Hook for managing keyword search history with proper data source handling
 *
 * This hook follows the workspace pattern:
 * - Unauthenticated users: Data stored in localStorage only
 * - Authenticated users: Data stored in Convex, localStorage cleared after migration
 * - No double rendering: All calculations done during render, no unnecessary effects
 *
 * Usage:
 * ```tsx
 * const { history, isLoaded, dataSource } = useSearchHistory();
 * ```
 */
export function useSearchHistory() {
  const { keywords: allKeywords, isLoaded, dataSource } = useUnifiedKeywords();

  // Convert to KeywordItem format for general purpose use
  const history: KeywordItem[] = useMemo(
    () =>
      allKeywords.map((item) => ({
        kind: "history",
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
        kind: "history",
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
    // Additional data for debugging
    dataSource,
    totalCount: allKeywords.length,
  };
}
