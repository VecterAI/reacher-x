// features/search/contexts/SortContext.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from "react";

import type { SortState } from "../types";
import type { SortOption } from "../lib/schemas";
import { getDefaultSortState } from "../lib/utils";

interface SortContextType {
  isSortMode: boolean;
  currentSort: SortOption;
  isModified: boolean;
  openSort: () => void;
  closeSort: () => void;
  updateSort: (sort: SortOption) => void;
  resetSort: () => void;
}

const SortContext = createContext<SortContextType | undefined>(undefined);

export function SortProvider({ children }: { children: ReactNode }) {
  const [isSortMode, setIsSortMode] = useState(false);
  const [sortState, setSortState] = useState<SortState>(() =>
    getDefaultSortState()
  );

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

  const updateSort = useCallback((sort: SortOption) => {
    setSortState({ sortBy: sort });
    console.log("Applying sort:", sort);
    // TODO: Add actual sort application logic here
  }, []);

  const resetSort = useCallback(() => {
    const defaultSort = getDefaultSortState();
    setSortState(defaultSort);
    console.log("Resetting sort to:", defaultSort.sortBy);
  }, []);

  const contextValue = useMemo(
    () => ({
      isSortMode,
      currentSort: sortState.sortBy,
      isModified: computedValues.isModified,
      openSort,
      closeSort,
      updateSort,
      resetSort,
    }),
    [
      isSortMode,
      sortState.sortBy,
      computedValues.isModified,
      openSort,
      closeSort,
      updateSort,
      resetSort,
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
