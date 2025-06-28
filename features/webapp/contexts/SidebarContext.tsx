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

interface SidebarContextType {
  // Search state
  searchQuery: string;
  isSearching: boolean;
  setSearchQuery: (query: string) => void;

  // Keywords state
  pinnedKeywords: PinnedKeyword[];
  groupedHistory: Record<string, KeywordItem[]>;
  allKeywords: (KeywordItem & { isPinned: boolean; source: string })[];
  filteredKeywords: (KeywordItem & { isPinned: boolean; source: string })[];
  recentKeywords: KeywordItem[];

  // Actions
  handlePin: (id: string, keyword: string) => void;
  handleUnpin: (id: string) => void;
  handleDelete: (id: string) => void;
  handleNewKeyword: () => void;
  handleKeywordSelect: (keyword: string) => void;
  handleKeywordItemSelect: (item: KeywordItem) => void;

  // Computed values
  pinnedCount: number;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedKeywords, setPinnedKeywords] = useState<PinnedKeyword[]>([]);

  // Get search history
  const { history } = useSearchHistory();

  // Load pinned keywords on mount
  useEffect(() => {
    setPinnedKeywords(getPinnedKeywords());
  }, []);

  // Convert search history to grouped format
  const groupedHistory = useMemo(() => {
    return groupKeywordsByTime(history);
  }, [history]);

  // Flatten all keywords for searching
  const allKeywords = useMemo(() => {
    const keywords: (KeywordItem & { isPinned: boolean; source: string })[] =
      [];

    // Add pinned keywords
    pinnedKeywords.forEach((item) => {
      keywords.push({
        id: item.id,
        keyword: item.keyword,
        timestamp: new Date(item.pinnedAt).toISOString(),
        metadata: item.metadata,
        isPinned: true,
        source: "pinned",
      });
    });

    // Add history keywords
    Object.entries(groupedHistory).forEach(([group, items]) => {
      items.forEach((item: KeywordItem) => {
        keywords.push({ ...item, isPinned: false, source: group });
      });
    });

    return keywords;
  }, [pinnedKeywords, groupedHistory]);

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
    return history.slice(0, 5);
  }, [history]);

  // Actions
  const handlePin = useCallback((id: string, keyword: string) => {
    const success = pinKeyword(keyword, "manual");
    if (success) {
      setPinnedKeywords(getPinnedKeywords());
      console.log("Pinned keyword:", keyword);
    }
  }, []);

  const handleUnpin = useCallback((id: string) => {
    const success = unpinKeywordById(id);
    if (success) {
      setPinnedKeywords(getPinnedKeywords());
      console.log("Unpinned keyword:", id);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    // TODO: Implement delete from search history
    console.log("Delete keyword:", id);
  }, []);

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
    (item: KeywordItem) => {
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
    }),
    [
      searchQuery,
      isSearching,
      pinnedKeywords,
      groupedHistory,
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
