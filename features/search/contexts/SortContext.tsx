// features/search/contexts/SortContext.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useMemo,
} from "react";

import type { SortState } from "../types";
import type { SortOption } from "../lib/schemas";
import { getDefaultSortState } from "../lib/utils";
import { useQueryState, parseAsString } from "nuqs";
import { useSortStorage } from "../hooks/useSortStorage";
import { sortTweets } from "../lib/sortUtils";
import type { Tweet } from "@/features/threads/types";
import { logger } from "@/shared/lib/logger";

interface SortContextType {
  isSortMode: boolean;
  currentSort: SortOption;
  isModified: boolean;
  openSort: () => void;
  closeSort: () => void;
  updateSort: (sort: SortOption) => void;
  resetSort: () => void;
  loadSortForKeyword: (keyword: string) => void;
  saveSortForKeyword: (keyword: string) => void;
  sortTweets: (tweets: Tweet[]) => Tweet[];
}

const SortContext = createContext<SortContextType | undefined>(undefined);

export function SortProvider({ children }: { children: ReactNode }) {
  const [isSortMode, setIsSortMode] = useState(false);
  const [sortState, setSortState] = useState<SortState>(() =>
    getDefaultSortState()
  );
  const [q] = useQueryState("q", parseAsString.withDefault(""));

  // Sort storage hook
  const { saveSortSettings, getSortSettings, clearSortSettings } =
    useSortStorage();

  // Use ref to access current state in callbacks
  const sortStateRef = useRef<SortState>(sortState);
  sortStateRef.current = sortState;

  // Computed values
  const computedValues = useMemo(() => {
    const defaultSort = getDefaultSortState();
    const isModified = sortState.sortBy !== defaultSort.sortBy;

    return {
      isModified,
    };
  }, [sortState]);

  const openSort = useCallback(() => {
    setIsSortMode(true);
  }, []);

  const closeSort = useCallback(() => {
    setIsSortMode(false);
  }, []);

  const updateSort = useCallback(
    (sort: SortOption) => {
      setSortState({ sortBy: sort });
      logger.info("Applying sort:", sort);

      // Save sort preferences for the current keyword if we have one
      const currentQuery = q;
      if (currentQuery) {
        saveSortSettings(currentQuery, { sortBy: sort });
        logger.info(
          "[SORT_CONTEXT] Saved sort settings for keyword:",
          currentQuery
        );
      }
    },
    [saveSortSettings]
  );

  const resetSort = useCallback(() => {
    const defaultSort = getDefaultSortState();
    setSortState(defaultSort);
    logger.info("Resetting sort to:", defaultSort.sortBy);

    // Clear stored sort settings for the current keyword
    const currentQuery = q;
    if (currentQuery) {
      try {
        clearSortSettings(currentQuery);
        logger.info("[SORT_CONTEXT] Cleared stored sort settings after reset");
      } catch (error) {
        logger.warn(
          "[SORT_CONTEXT] Failed to clear stored sort settings:",
          error
        );
      }
    }
  }, [clearSortSettings]);

  // Load sort for a specific keyword
  const loadSortForKeyword = useCallback(
    (keyword: string) => {
      const storedSort = getSortSettings(keyword);
      if (storedSort) {
        setSortState(storedSort);
        logger.info("[SORT_CONTEXT] Loaded sort for keyword:", keyword);
      } else {
        // Reset to defaults if no stored sort
        const defaultSort = getDefaultSortState();
        setSortState(defaultSort);
        logger.info("[SORT_CONTEXT] No stored sort for keyword:", keyword);
      }
    },
    [getSortSettings]
  );

  // Save sort for a specific keyword
  const saveSortForKeyword = useCallback(
    (keyword: string) => {
      saveSortSettings(keyword, sortState);
      logger.info("[SORT_CONTEXT] Saved sort for keyword:", keyword);
    },
    [saveSortSettings, sortState]
  );

  // Sort tweets using the current sort state
  const sortTweetsForContext = useCallback(
    (tweets: Tweet[]) => {
      return sortTweets(tweets, sortState.sortBy);
    },
    [sortState.sortBy]
  );

  const contextValue = useMemo(
    () => ({
      isSortMode,
      currentSort: sortState.sortBy,
      isModified: computedValues.isModified,
      openSort,
      closeSort,
      updateSort,
      resetSort,
      loadSortForKeyword,
      saveSortForKeyword,
      sortTweets: sortTweetsForContext,
    }),
    [
      isSortMode,
      sortState.sortBy,
      computedValues.isModified,
      openSort,
      closeSort,
      updateSort,
      resetSort,
      loadSortForKeyword,
      saveSortForKeyword,
      sortTweetsForContext,
    ]
  );

  return (
    <SortContext.Provider value={contextValue}>{children}</SortContext.Provider>
  );
}

export function useSort() {
  const context = useContext(SortContext);
  if (context === undefined) {
    throw new Error("useSort must be used within a SortProvider");
  }
  return context;
}
