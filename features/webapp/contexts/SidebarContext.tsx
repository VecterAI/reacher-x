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
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
// No direct store mutations used here; handled via useKeywordSync
import type { UnifiedKeyword } from "@/shared/lib/utils/unifiedKeywordStore";
import { useUnifiedKeywords } from "@/shared/hooks/useUnifiedKeywords";
import { useKeywordSync } from "@/shared/hooks/useKeywordSync";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";
import { groupKeywordsByTime } from "@/features/webapp/lib/keywordUtils";
import { getUserTimezoneInfo } from "@/shared/lib/utils/timeUtils";
import type { KeywordItemWithRawTimestamp } from "@/features/search/hooks/useSearchHistory"; // This type is still useful
import { logger } from "@/shared/lib/logger";

interface SidebarContextType {
  // Search state
  searchQuery: string;
  isSearching: boolean;
  setSearchQuery: (query: string) => void;

  // Loading
  isLoaded: boolean;

  // Keywords state (now derived from a single source)
  allKeywords: UnifiedKeyword[];
  pinnedKeywords: UnifiedKeyword[];
  groupedHistory: Record<string, KeywordItem[]>;
  filteredGroupedHistory: Record<string, KeywordItemWithRawTimestamp[]>;
  filteredKeywords: (KeywordItemWithRawTimestamp & { isPinned: boolean })[];
  recentKeywords: KeywordItemWithRawTimestamp[];

  // Actions
  handleTogglePin: (id: string) => void;
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
  const {
    addOrUseKeyword,
    togglePin: togglePinUnified,
    deleteKeyword: deleteKeywordUnified,
  } = useKeywordSync();
  const [searchQuery, setSearchQuery] = useState("");

  const { keywords: allKeywords, isLoaded } = useUnifiedKeywords();

  // Memoize timezone info as it rarely changes
  const timezoneInfo = useMemo(() => getUserTimezoneInfo(), []);

  // --- DERIVED STATE ---
  // All other keyword lists are now derived from the single `allKeywords` state.

  // Get pinned keywords
  const pinnedKeywords = useMemo(
    () => allKeywords.filter((kw) => kw.isPinned),
    [allKeywords]
  );

  // Adapt UnifiedKeyword[] to KeywordItemWithRawTimestamp[] for grouping function
  const historyWithRawTimestamp = useMemo((): KeywordItemWithRawTimestamp[] => {
    return allKeywords.map((kw) => ({
      kind: "history",
      id: kw.id,
      keyword: kw.keyword,
      timestamp: new Date(kw.lastUsedAt).toISOString(),
      rawTimestamp: kw.lastUsedAt,
      isPinned: kw.isPinned,
      exactMatch: kw.exactMatch,
    }));
  }, [allKeywords]);

  // Group search history
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

      if (filteredItems.length > 0) {
        filtered[group] = filteredItems as KeywordItemWithRawTimestamp[];
      }
    });

    return filtered;
  }, [groupedHistory, pinnedKeywords]);

  // Combine all keywords into a single list for searching
  const searchableKeywords = useMemo<
    Array<KeywordItemWithRawTimestamp & { isPinned: boolean }>
  >(() => {
    return allKeywords.map((kw) => ({
      kind: "history",
      id: kw.id,
      keyword: kw.keyword,
      rawTimestamp: kw.lastUsedAt,
      isPinned: kw.isPinned,
      exactMatch: kw.exactMatch,
      timestamp: new Date(kw.lastUsedAt).toISOString(),
    }));
  }, [allKeywords]);

  // Filter keywords based on search query
  const filteredKeywords = useMemo<
    Array<KeywordItemWithRawTimestamp & { isPinned: boolean }>
  >(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const query = searchQuery.toLowerCase();
    return searchableKeywords.filter((item) =>
      item.keyword.toLowerCase().includes(query)
    );
  }, [searchQuery, searchableKeywords]);

  // Get recent keywords
  const recentKeywords = useMemo(() => {
    return historyWithRawTimestamp.slice(0, 5);
  }, [historyWithRawTimestamp]);

  // --- ACTIONS ---

  const handleTogglePin = useCallback(
    async (id: string) => {
      const success = await togglePinUnified(id);
      if (success) {
        logger.info(`[SIDEBAR_CONTEXT] Toggled pin status for ID: ${id}`);
      }
    },
    [togglePinUnified]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const success = await deleteKeywordUnified(id);
      if (success) {
        logger.info(`[SIDEBAR_CONTEXT] Deleted keyword with ID: ${id}`);
      }
    },
    [deleteKeywordUnified]
  );

  const handleNewKeyword = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleKeywordSelect = useCallback(
    async (keyword: string) => {
      // Find the keyword in our store to get its exact match setting
      const existingKeyword = allKeywords.find(
        (k) => k.keyword.toLowerCase() === keyword.toLowerCase()
      );

      // Add keyword to store (local + Convex if authenticated) and get the ID
      const keywordId = await addOrUseKeyword(
        keyword,
        "user_created",
        existingKeyword?.exactMatch ?? false
      );

      const params = new URLSearchParams();
      params.set("q", keyword);
      if (existingKeyword?.exactMatch) {
        params.set("exact", "true");
      }
      params.set("keywordId", keywordId);
      // Use replace for faster navigation
      router.replace(`/search?${params.toString()}`);
    },
    [router, allKeywords, addOrUseKeyword]
  );

  const handleKeywordItemSelect = useCallback(
    async (item: KeywordItem | KeywordItemWithRawTimestamp) => {
      // If the item has exactMatch property, use it directly
      if ("exactMatch" in item && item.exactMatch !== undefined) {
        const keywordId = await addOrUseKeyword(
          item.keyword,
          "user_created",
          item.exactMatch
        );

        const params = new URLSearchParams();
        params.set("q", item.keyword);
        if (item.exactMatch) {
          params.set("exact", "true");
        }
        params.set("keywordId", keywordId);
        router.replace(`/search?${params.toString()}`);
      } else {
        // Fallback to the existing logic
        handleKeywordSelect(item.keyword);
      }
    },
    [handleKeywordSelect, router, addOrUseKeyword]
  );

  // Computed values
  const pinnedCount = pinnedKeywords.length;
  const isSearching = searchQuery.trim().length > 0;

  const value = useMemo(
    () => ({
      searchQuery,
      isSearching,
      setSearchQuery,
      isLoaded,
      allKeywords,
      pinnedKeywords,
      groupedHistory,
      filteredGroupedHistory,
      filteredKeywords,
      recentKeywords,
      handleTogglePin,
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
      isLoaded,
      allKeywords,
      pinnedKeywords,
      groupedHistory,
      filteredGroupedHistory,
      filteredKeywords,
      recentKeywords,
      handleTogglePin,
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
