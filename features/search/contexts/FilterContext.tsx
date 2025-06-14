// features/search/contexts/FilterContext.tsx
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

import type { FilterState } from "../types";
import { getDefaultFilterState } from "../lib/utils";

interface FilterContextType {
  isFilterMode: boolean;
  appliedFilters: FilterState;
  draftFilters: FilterState;
  hasChanges: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  isFormDirty: boolean;
  canApplyChanges: boolean; // NEW: Combined logic for Apply button
  openFilter: () => void;
  closeFilter: () => void;
  updateDraftFilters: (filters: FilterState) => void;
  updateFormDirtyState: (isDirty: boolean) => void; // NEW: Track form interaction
  applyFilters: () => void;
  resetFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false); // NEW: Track user interaction
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() =>
    getDefaultFilterState()
  );
  const [draftFilters, setDraftFilters] = useState<FilterState>(() =>
    getDefaultFilterState()
  );

  // Use ref to access current state in callbacks
  const appliedFiltersRef = useRef<FilterState>(appliedFilters);
  const draftFiltersRef = useRef<FilterState>(draftFilters);
  appliedFiltersRef.current = appliedFilters;
  draftFiltersRef.current = draftFilters;

  // Helper function to count active filters (non-default values)
  const countActiveFilters = useCallback((filters: FilterState): number => {
    const defaultFilters = getDefaultFilterState();
    let count = 0;

    // Count text-based filters
    const textFields = [
      "from",
      "to",
      "mention",
      "list",
      "url",
      "lastXValue",
      "minLikes",
      "maxLikes",
      "minReplies",
      "maxReplies",
      "minRetweets",
      "maxRetweets",
    ];
    textFields.forEach((field) => {
      if (
        filters[field as keyof FilterState] &&
        String(filters[field as keyof FilterState]).trim() !== ""
      ) {
        count++;
      }
    });

    // Count date range filters (non-default)
    if (filters.dateRange && filters.dateRange !== defaultFilters.dateRange) {
      count++;
    }

    // Count language filter (non-default)
    if (filters.language && filters.language !== defaultFilters.language) {
      count++;
    }

    // Count media presence filter (non-default)
    if (
      filters.mediaPresence &&
      filters.mediaPresence !== defaultFilters.mediaPresence
    ) {
      count++;
    }

    // Count engagement filter (non-default)
    if (
      filters.engagement &&
      filters.engagement !== defaultFilters.engagement
    ) {
      count++;
    }

    // Count custom date range
    if (filters.customRangeStart || filters.customRangeEnd) {
      count++;
    }

    // Count boolean filters that differ from default
    const booleanFields = [
      "verified",
      "unverified",
      "images",
      "twitterImages",
      "videos",
      "periscope",
      "nativeVideo",
      "consumerVideo",
      "proVideo",
      "vine",
      "spaces",
      "links",
      "mentions",
      "news",
      "hashtags",
      "hideSensitiveContent",
    ];
    booleanFields.forEach((field) => {
      const currentValue = filters[field as keyof FilterState];
      const defaultValue = defaultFilters[field as keyof FilterState];
      if (currentValue !== defaultValue) {
        count++;
      }
    });

    return count;
  }, []);

  // Memoized computed values
  const computedValues = useMemo(() => {
    const defaultFilters = getDefaultFilterState();

    const hasChanges =
      JSON.stringify(appliedFilters) !== JSON.stringify(draftFilters);

    const hasActiveFilters =
      JSON.stringify(appliedFilters) !== JSON.stringify(defaultFilters);

    const activeFilterCount = countActiveFilters(appliedFilters);

    // NEW: Apply button should only be enabled when there are changes AND user has interacted with form
    const canApplyChanges = hasChanges && isFormDirty;

    return {
      hasChanges,
      hasActiveFilters,
      activeFilterCount,
      canApplyChanges,
    };
  }, [appliedFilters, draftFilters, isFormDirty, countActiveFilters]);

  const openFilter = useCallback(() => {
    // When opening, sync draft with applied filters and reset dirty state
    setDraftFilters(appliedFiltersRef.current);
    setIsFormDirty(false); // NEW: Reset dirty state when opening
    setIsFilterMode(true);
  }, []);

  const closeFilter = useCallback(() => {
    setIsFilterMode(false);
    // Don't reset dirty state here - let it persist until next open or apply
  }, []);

  const updateDraftFilters = useCallback((filters: FilterState) => {
    // Deep comparison to prevent unnecessary state updates
    const currentDraft = draftFiltersRef.current;
    if (JSON.stringify(currentDraft) !== JSON.stringify(filters)) {
      setDraftFilters(filters);
    }
  }, []);

  // NEW: Function to update form dirty state from FilterContent
  const updateFormDirtyState = useCallback((isDirty: boolean) => {
    setIsFormDirty(isDirty);
  }, []);

  const applyFilters = useCallback(() => {
    const currentDraft = draftFiltersRef.current;
    setAppliedFilters(currentDraft);
    setIsFormDirty(false); // NEW: Reset dirty state after applying
    setIsFilterMode(false);

    console.log("Applying filters:", currentDraft);
    // TODO: Add your actual filter application logic here
  }, []);

  const resetFilters = useCallback(() => {
    const defaultFilters = getDefaultFilterState();
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setIsFormDirty(false); // NEW: Reset dirty state after reset
  }, []);

  const contextValue = useMemo(
    () => ({
      isFilterMode,
      appliedFilters,
      draftFilters,
      hasChanges: computedValues.hasChanges,
      hasActiveFilters: computedValues.hasActiveFilters,
      activeFilterCount: computedValues.activeFilterCount,
      isFormDirty,
      canApplyChanges: computedValues.canApplyChanges,
      openFilter,
      closeFilter,
      updateDraftFilters,
      updateFormDirtyState,
      applyFilters,
      resetFilters,
    }),
    [
      isFilterMode,
      appliedFilters,
      draftFilters,
      computedValues,
      isFormDirty,
      openFilter,
      closeFilter,
      updateDraftFilters,
      updateFormDirtyState,
      applyFilters,
      resetFilters,
    ]
  );

  return (
    <FilterContext.Provider value={contextValue}>
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
