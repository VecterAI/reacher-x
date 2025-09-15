// features/search/hooks/useSearchHistory.ts
"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  getKeywords,
  type UnifiedKeyword,
} from "@/shared/lib/utils/unifiedKeywordStore";
import { formatTimestampForDisplay } from "@/shared/lib/utils/timeUtils";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";
import { useConvexAuth } from "convex/react";
import { useAuth } from "@/shared/hooks/useAuth";

// This type remains useful for components that need both raw and formatted timestamps
export interface KeywordItemWithRawTimestamp extends KeywordItem {
  rawTimestamp: number;
  isPinned?: boolean;
  exactMatch?: boolean;
}

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
  const { isAuthenticated } = useConvexAuth();
  const { workspace } = useAuth();

  // Query Convex for keywords if authenticated
  const convexKeywords = useQuery(
    api.keywords.getUserKeywords,
    isAuthenticated && workspace
      ? {
          workspaceId: workspace._id,
          sortBy: "lastUsedAt",
          limit: 100,
        }
      : "skip"
  );

  // ✅ Use a state trigger for localStorage changes to force re-render
  const [storageVersion, setStorageVersion] = useState(0);

  // ✅ Calculate local keywords during render instead of using state + Effect
  const localKeywords = useMemo(() => {
    if (!isAuthenticated) {
      return getKeywords();
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, storageVersion]); // storageVersion needed for localStorage change detection

  // ✅ Calculate loading state during render instead of using state + Effect
  const isLoaded = useMemo(() => {
    if (isAuthenticated) {
      return convexKeywords !== undefined;
    }
    return true; // Local storage is always "loaded" immediately
  }, [isAuthenticated, convexKeywords]);

  // ✅ Calculate keywords during render instead of using state + Effect
  const allKeywords = useMemo(() => {
    if (isAuthenticated && convexKeywords) {
      // Convert Convex keywords to UnifiedKeyword format
      return convexKeywords.map(
        (kw) =>
          ({
            id: kw._id,
            keyword: kw.keyword,
            exactMatch: kw.exactMatch,
            createdAt: kw.createdAt,
            lastUsedAt: kw.lastUsedAt,
            searchCount: kw.searchCount,
            isPinned: kw.isPinned,
            pinnedAt: kw.pinnedAt,
            source: kw.source,
            status: kw.status,
            votes: kw.votes,
            decayedScore: kw.decayedScore,
            metadata: kw.metadata,
          }) as UnifiedKeyword
      );
    } else {
      return localKeywords;
    }
  }, [isAuthenticated, convexKeywords, localKeywords]);

  // ✅ Fixed: Proper useEffect syntax and logic
  useEffect(() => {
    if (!isAuthenticated) {
      const handleStorageChange = () => {
        console.log(
          "[useSearchHistory] Detected storage change, refreshing keywords."
        );
        // Increment version to trigger re-render and recalculation
        setStorageVersion((prev) => prev + 1);
      };

      window.addEventListener("onLocalStorageChange", handleStorageChange);
      return () => {
        window.removeEventListener("onLocalStorageChange", handleStorageChange);
      };
    }
  }, [isAuthenticated]);

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
    // Additional data for debugging
    dataSource: isAuthenticated ? "convex" : "localStorage",
    totalCount: allKeywords.length,
  };
}
