"use client";
/**
 * SidebarContext - Manages shared state and functionality across sidebar components
 *
 * This context follows the React Context API best practices:
 * - Separates state management from UI components (Single Responsibility Principle)
 * - Provides type-safe context with TypeScript
 * - Uses React.memo and useCallback for performance optimization
 *
 * References:
 * - React Context API: https://react.dev/reference/react/createContext
 * - TypeScript with React Context: https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/context
 * - Performance optimization: https://react.dev/reference/react/memo
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useSearchHistory } from "@/features/search/hooks/useSearchHistory";
import {
  getPinnedKeywords,
  pinKeyword,
  unpinKeywordById,
  type PinnedKeyword,
} from "@/shared/lib/utils/pinnedKeywords";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";
import { groupKeywordsByTime } from "@/features/webapp/lib/keywordUtils";
import { getUserTimezoneInfo } from "@/shared/lib/utils/timeUtils";
import type { KeywordItemWithRawTimestamp } from "@/features/search/hooks/useSearchHistory";

interface SidebarContextType {
  // Search state
  searchQuery: string;
  isSearching: boolean;
  setSearchQuery: (query: string) => void;

  // Keywords state
  pinnedKeywords: PinnedKeyword[];
  groupedHistory: Record<string, KeywordItem[]>;
  filteredGroupedHistory: Record<string, KeywordItemWithRawTimestamp[]>;
  allKeywords: (KeywordItemWithRawTimestamp & {
    isPinned: boolean;
    source: string;
  })[];
  filteredKeywords: (KeywordItemWithRawTimestamp & {
    isPinned: boolean;
    source: string;
  })[];
  recentKeywords: KeywordItemWithRawTimestamp[];

  // Actions
  handlePin: (item: KeywordItemWithRawTimestamp) => void;
  handleUnpin: (id: string) => void;
  handleDelete: (id: string) => void;
  handleNewKeyword: () => void;
  handleKeywordSelect: (keyword: string) => void;
  handleKeywordItemSelect: (
    item: KeywordItem | KeywordItemWithRawTimestamp
  ) => void;

  // Computed values
  pinnedCount: number;
  activeKeyword: string;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
  activeKeyword: string;
}

export function SidebarProvider({
  children,
  activeKeyword,
}: SidebarProviderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedKeywords, setPinnedKeywords] = useState<PinnedKeyword[]>([]);

  // Get search history with enhanced timestamp support
  const {
    historyWithRawTimestamp,
    removeFromHistory,
    removeFromHistoryByKeyword,
  } = useSearchHistory();

  // Load pinned keywords on mount
  useEffect(() => {
    setPinnedKeywords(getPinnedKeywords());
  }, []);

  // Memoize timezone info as it rarely changes
  const timezoneInfo = useMemo(() => getUserTimezoneInfo(), []);

  // Convert search history to grouped format using raw timestamps for accuracy
  const groupedHistory = useMemo(() => {
    return groupKeywordsByTime(historyWithRawTimestamp, timezoneInfo);
  }, [historyWithRawTimestamp, timezoneInfo]);

  // Create filtered grouped history that excludes pinned keywords
  const filteredGroupedHistory = useMemo(() => {
    const pinnedKeywordSet = new Set(
      pinnedKeywords.map((pk) => pk.keyword.toLowerCase())
    );

    const filtered: Record<string, KeywordItemWithRawTimestamp[]> = {};

    Object.entries(groupedHistory).forEach(([group, items]) => {
      const filteredItems = items.filter(
        (item) => !pinnedKeywordSet.has(item.keyword.toLowerCase())
      );

      // Only include groups that have items after filtering
      if (filteredItems.length > 0) {
        filtered[group] = filteredItems as KeywordItemWithRawTimestamp[];
      }
    });

    return filtered;
  }, [groupedHistory, pinnedKeywords]);

  // Flatten all keywords for searching with deduplication
  const allKeywords = useMemo(() => {
    const keywords: (KeywordItemWithRawTimestamp & {
      isPinned: boolean;
      source: string;
    })[] = [];
    const seenKeywords = new Set<string>();

    // Add pinned keywords first
    pinnedKeywords.forEach((item) => {
      const keywordLower = item.keyword.toLowerCase();
      seenKeywords.add(keywordLower);
      keywords.push({
        id: item.id,
        keyword: item.keyword,
        timestamp: new Date(
          item.originalTimestamp || item.pinnedAt
        ).toISOString(),
        rawTimestamp: item.originalTimestamp || item.pinnedAt,
        isPinned: true,
        source: "pinned",
        metadata: item.metadata,
      });
    });

    // Add history keywords (skip if already pinned)
    Object.entries(filteredGroupedHistory).forEach(([group, items]) => {
      items.forEach((item) => {
        const keywordLower = item.keyword.toLowerCase();
        if (!seenKeywords.has(keywordLower)) {
          seenKeywords.add(keywordLower);
          keywords.push({ ...item, isPinned: false, source: group });
        }
      });
    });

    return keywords;
  }, [pinnedKeywords, filteredGroupedHistory]);

  // Filter keywords based on search query
  const filteredKeywords = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    return allKeywords.filter((item) =>
      item.keyword.toLowerCase().includes(query)
    );
  }, [searchQuery, allKeywords]);

  // Get recent keywords
  const recentKeywords = useMemo(() => {
    return historyWithRawTimestamp.slice(0, 5);
  }, [historyWithRawTimestamp]);

  // Actions
  const handlePin = useCallback((item: KeywordItemWithRawTimestamp) => {
    // Prepare metadata with original keyword ID if this is from search history
    const metadata = item.id.startsWith("search_history_")
      ? { originalKeywordId: item.id }
      : undefined;

    const success = pinKeyword(
      item.keyword,
      "manual",
      metadata,
      item.rawTimestamp
    );

    if (success) {
      setPinnedKeywords(getPinnedKeywords());
      console.log(
        `[SIDEBAR_CONTEXT] Successfully pinned keyword "${item.keyword}" with original ID: ${item.id}`
      );
    }
  }, []);

  const handleUnpin = useCallback((id: string) => {
    const success = unpinKeywordById(id);
    if (success) {
      setPinnedKeywords(getPinnedKeywords());
    }
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      console.log(
        `[SIDEBAR_CONTEXT] Attempting to delete keyword with ID: ${id}`
      );

      // Determine the source based on ID prefix
      if (id.startsWith("pinned_")) {
        // Handle pinned keyword deletion - remove from BOTH pinned and search history
        const pinnedKeywords = getPinnedKeywords();
        const pinnedKeyword = pinnedKeywords.find((p) => p.id === id);

        if (!pinnedKeyword) {
          console.warn(
            `[SIDEBAR_CONTEXT] Pinned keyword not found with ID: ${id}`
          );
          return;
        }

        // Remove from pinned keywords first
        const unpinSuccess = unpinKeywordById(id);
        if (unpinSuccess) {
          setPinnedKeywords(getPinnedKeywords());
          console.log(
            `[SIDEBAR_CONTEXT] Successfully removed pinned keyword with ID: ${id}`
          );
        }

        // Also remove from search history if we have the original ID
        const originalKeywordId = pinnedKeyword.metadata?.originalKeywordId;
        if (originalKeywordId && removeFromHistory) {
          removeFromHistory(originalKeywordId);
          console.log(
            `[SIDEBAR_CONTEXT] Successfully removed from search history with original ID: ${originalKeywordId}`
          );
        } else if (!originalKeywordId) {
          // If no original ID, try to find by keyword text in search history
          console.log(
            `[SIDEBAR_CONTEXT] No original keyword ID found, attempting to remove by keyword text: "${pinnedKeyword.keyword}"`
          );

          if (removeFromHistoryByKeyword) {
            removeFromHistoryByKeyword(pinnedKeyword.keyword);
            console.log(
              `[SIDEBAR_CONTEXT] Successfully removed from search history by keyword: "${pinnedKeyword.keyword}"`
            );
          } else {
            console.warn(
              `[SIDEBAR_CONTEXT] removeFromHistoryByKeyword function not available`
            );
          }
        }
      } else if (id.startsWith("search_history_")) {
        // Handle search history deletion only
        if (removeFromHistory) {
          removeFromHistory(id);
          console.log(
            `[SIDEBAR_CONTEXT] Successfully deleted search history keyword with ID: ${id}`
          );
        } else {
          console.warn(
            `[SIDEBAR_CONTEXT] removeFromHistory function not available`
          );
        }
      } else {
        // Handle other keyword types (performance tracking, etc.)
        console.warn(
          `[SIDEBAR_CONTEXT] Unknown keyword ID format: ${id}. Attempting fallback deletion.`
        );

        // Try both methods as fallback for unknown ID formats
        let deletedFromPinned = false;
        let deletedFromHistory = false;

        try {
          if (unpinKeywordById(id)) {
            deletedFromPinned = true;
            setPinnedKeywords(getPinnedKeywords());
          }
        } catch (error) {
          console.warn(
            `[SIDEBAR_CONTEXT] Fallback pinned deletion failed:`,
            error
          );
        }

        try {
          if (removeFromHistory) {
            removeFromHistory(id);
            deletedFromHistory = true;
          }
        } catch (error) {
          console.warn(
            `[SIDEBAR_CONTEXT] Fallback history deletion failed:`,
            error
          );
        }

        if (!deletedFromPinned && !deletedFromHistory) {
          console.warn(
            `[SIDEBAR_CONTEXT] Failed to delete keyword with unknown ID format: ${id}`
          );
        }
      }
    },
    [removeFromHistory, removeFromHistoryByKeyword]
  );

  const handleNewKeyword = useCallback(() => {
    // Navigate to home page for new keyword creation
    router.push("/");
  }, [router]);

  const handleKeywordSelect = useCallback(
    (keyword: string) => {
      // Navigate to search results page with this keyword
      const params = new URLSearchParams();
      params.set("q", keyword);
      router.push(`/search?${params.toString()}`);
    },
    [router]
  );

  const handleKeywordItemSelect = useCallback(
    (item: KeywordItem | KeywordItemWithRawTimestamp) => {
      handleKeywordSelect(item.keyword);
    },
    [handleKeywordSelect]
  );

  // Computed values
  const pinnedCount = pinnedKeywords.length;
  const isSearching = searchQuery.trim().length > 0;

  const value = useMemo(
    () => ({
      searchQuery,
      isSearching,
      setSearchQuery,
      pinnedKeywords,
      groupedHistory,
      filteredGroupedHistory,
      allKeywords,
      filteredKeywords,
      recentKeywords,
      handlePin,
      handleUnpin,
      handleDelete,
      handleNewKeyword,
      handleKeywordSelect,
      handleKeywordItemSelect,
      pinnedCount,
      activeKeyword,
    }),
    [
      searchQuery,
      isSearching,
      pinnedKeywords,
      groupedHistory,
      filteredGroupedHistory,
      allKeywords,
      filteredKeywords,
      recentKeywords,
      handlePin,
      handleUnpin,
      handleDelete,
      handleNewKeyword,
      handleKeywordSelect,
      handleKeywordItemSelect,
      pinnedCount,
      activeKeyword,
    ]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
}
