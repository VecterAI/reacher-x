// features/search/contexts/FilterContext.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

import type { FilterState } from "../types";

interface FilterContextType {
  isFilterMode: boolean;
  filterState: FilterState;
  openFilter: () => void;
  closeFilter: () => void;
  updateFilters: (filters: FilterState) => void;
  applyFilters: () => void;
  resetFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({});

  const openFilter = useCallback(() => {
    setIsFilterMode(true);
  }, []);

  const closeFilter = useCallback(() => {
    setIsFilterMode(false);
  }, []);

  const updateFilters = useCallback((filters: FilterState) => {
    setFilterState(filters);
  }, []);

  const applyFilters = useCallback(() => {
    setIsFilterMode(false);
    // Apply filters logic here
    console.log("Applying filters:", filterState);
  }, [filterState]);

  const resetFilters = useCallback(() => {
    setFilterState({});
  }, []);

  return (
    <FilterContext.Provider
      value={{
        isFilterMode,
        filterState,
        openFilter,
        closeFilter,
        updateFilters,
        applyFilters,
        resetFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
}
