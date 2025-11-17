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
import { useQueryState, parseAsString } from "nuqs";
import { getDefaultFilterState } from "../lib/utils";
import { useFilterStorage } from "../hooks/useFilterStorage";
import {
  applyClientSideFilters,
  getUnimplementedFilters,
} from "../lib/filterUtils";
import type { Tweet } from "@/features/threads/types";
import { logger } from "@/shared/lib/logger";

interface FilterContextType {
  isFilterMode: boolean;
  appliedFilters: FilterState;
  draftFilters: FilterState;
  hasChanges: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  isFormDirty: boolean;
  canApplyChanges: boolean;
  firstActiveFilter: { name: string; count: number } | null;
  unimplementedFilters: string[];
  suggestionUsers: string[];
  openFilter: () => void;
  closeFilter: () => void;
  updateDraftFilters: (filters: FilterState) => void;
  updateFormDirtyState: (isDirty: boolean) => void;
  setSuggestionUsers: (users: string[]) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  loadFiltersForKeyword: (keyword: string) => void;
  saveFiltersForKeyword: (keyword: string) => void;
  filterTweets: (tweets: Tweet[]) => {
    filteredTweets: Tweet[];
    filterSummary: string;
  };
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

// Add filter name mappings
const filterNameMap: Record<keyof FilterState, string> = {
  verified: "Verified",
  unverified: "Unverified",
  from: "From",
  to: "To",
  mention: "Mention",
  list: "List",
  dateRange: "Date range",
  lastXValue: "Last X",
  lastXUnit: "Last X unit",
  customRangeStart: "Custom range",
  customRangeEnd: "Custom range",
  url: "URL",
  language: "Language",
  excludeUsers: "Excluded users",
  mediaPresence: "Media presence",
  images: "Images",
  twitterImages: "Twitter images",
  videos: "Videos",
  periscope: "Periscope",
  nativeVideo: "Native video",
  consumerVideo: "Consumer video",
  proVideo: "Pro video",
  vine: "Vine",
  spaces: "Spaces",
  links: "Links",
  mentions: "Mentions",
  news: "News",
  hashtags: "Hashtags",
  hideSensitiveContent: "Hide sensitive content",
  engagement: "Engagement",
  minLikes: "Min likes",
  maxLikes: "Max likes",
  minReplies: "Min replies",
  maxReplies: "Max replies",
  minRetweets: "Min retweets",
  maxRetweets: "Max retweets",
};

export function FilterProvider({ children }: { children: ReactNode }) {
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() =>
    getDefaultFilterState()
  );
  const [draftFilters, setDraftFilters] = useState<FilterState>(() =>
    getDefaultFilterState()
  );
  const [q] = useQueryState("q", parseAsString.withDefault(""));
  const [suggestionUsers, setSuggestionUsersState] = useState<string[]>([]);

  // Filter storage hook
  const { saveFilterSettings, getFilterSettings, clearFilterSettings } =
    useFilterStorage();

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

    // Count array-based filters
    if (
      Array.isArray(filters.excludeUsers) &&
      filters.excludeUsers.length > 0
    ) {
      count++;
    }

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

  // Helper function to get first active filter and remaining count
  const getFirstActiveFilter = useCallback(
    (filters: FilterState): { name: string; count: number } | null => {
      const defaultFilters = getDefaultFilterState();
      let firstActive: { name: string; count: number } | null = null;
      let remainingCount = 0;

      // Check text-based filters first (they're usually the most important)
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
      ] as const;

      for (const field of textFields) {
        const value = filters[field];
        if (value && String(value).trim() !== "") {
          if (!firstActive) {
            firstActive = { name: filterNameMap[field], count: 0 };
          } else {
            remainingCount++;
          }
        }
      }

      // Check date range
      if (filters.dateRange && filters.dateRange !== defaultFilters.dateRange) {
        if (!firstActive) {
          firstActive = { name: filterNameMap.dateRange, count: 0 };
        } else {
          remainingCount++;
        }
      }

      // Check excluded users (array-based)
      if (
        Array.isArray(filters.excludeUsers) &&
        filters.excludeUsers.length > 0
      ) {
        if (!firstActive) {
          firstActive = { name: filterNameMap.excludeUsers, count: 0 };
        } else {
          remainingCount++;
        }
      }

      // Check language
      if (filters.language && filters.language !== defaultFilters.language) {
        if (!firstActive) {
          firstActive = { name: filterNameMap.language, count: 0 };
        } else {
          remainingCount++;
        }
      }

      // Check media presence
      if (
        filters.mediaPresence &&
        filters.mediaPresence !== defaultFilters.mediaPresence
      ) {
        if (!firstActive) {
          firstActive = { name: filterNameMap.mediaPresence, count: 0 };
        } else {
          remainingCount++;
        }
      }

      // Check engagement
      if (
        filters.engagement &&
        filters.engagement !== defaultFilters.engagement
      ) {
        if (!firstActive) {
          firstActive = { name: filterNameMap.engagement, count: 0 };
        } else {
          remainingCount++;
        }
      }

      // Check custom date range
      if (filters.customRangeStart || filters.customRangeEnd) {
        if (!firstActive) {
          firstActive = { name: filterNameMap.customRangeStart, count: 0 };
        } else {
          remainingCount++;
        }
      }

      // Check boolean filters
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
      ] as const;

      for (const field of booleanFields) {
        const currentValue = filters[field];
        const defaultValue = defaultFilters[field];
        if (currentValue !== defaultValue) {
          if (!firstActive) {
            firstActive = { name: filterNameMap[field], count: 0 };
          } else {
            remainingCount++;
          }
        }
      }

      if (firstActive) {
        firstActive.count = remainingCount;
      }

      return firstActive;
    },
    []
  );

  // Memoized computed values
  const computedValues = useMemo(() => {
    const defaultFilters = getDefaultFilterState();

    const hasChanges =
      JSON.stringify(appliedFilters) !== JSON.stringify(draftFilters);

    const hasActiveFilters =
      JSON.stringify(appliedFilters) !== JSON.stringify(defaultFilters);

    const activeFilterCount = countActiveFilters(appliedFilters);
    const firstActiveFilter = getFirstActiveFilter(appliedFilters);

    // NEW: Apply button should only be enabled when there are changes AND user has interacted with form
    const canApplyChanges = hasChanges && isFormDirty;

    return {
      hasChanges,
      hasActiveFilters,
      activeFilterCount,
      firstActiveFilter,
      canApplyChanges,
    };
  }, [
    appliedFilters,
    draftFilters,
    isFormDirty,
    countActiveFilters,
    getFirstActiveFilter,
  ]);

  const openFilter = useCallback(() => {
    // When opening, sync draft with applied filters and reset dirty state
    setDraftFilters(appliedFiltersRef.current);
    setIsFormDirty(false);
    setIsFilterMode(true);
  }, []);

  const closeFilter = useCallback(() => {
    setIsFilterMode(false);
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

  const applyFilters = useCallback(async () => {
    const currentDraft = draftFiltersRef.current;
    setAppliedFilters(currentDraft);
    setIsFormDirty(false);
    setIsFilterMode(false);

    logger.info("Applying filters:", currentDraft);

    const currentQuery = q;
    if (currentQuery) {
      saveFilterSettings(currentQuery, currentDraft);
      logger.info(
        "[FILTER_CONTEXT] Saved filter settings for keyword:",
        currentQuery
      );
    }
  }, [saveFilterSettings]);

  const resetFilters = useCallback(async () => {
    const defaultFilters = getDefaultFilterState();
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setIsFormDirty(false);

    const currentQuery = q;
    if (currentQuery) {
      try {
        clearFilterSettings(currentQuery);
        logger.info(
          "[FILTER_CONTEXT] Cleared stored filter settings after reset"
        );
      } catch (error) {
        logger.warn(
          "[FILTER_CONTEXT] Failed to clear stored filter settings:",
          error
        );
      }
    }
  }, [clearFilterSettings]);

  // Load filters for a specific keyword
  const loadFiltersForKeyword = useCallback(
    (keyword: string) => {
      const storedFilters = getFilterSettings(keyword);
      if (storedFilters) {
        // Migrate legacy default language "en" to "all" when no other content filters are set
        const migrated: FilterState = { ...storedFilters };
        if (migrated.language === "en") {
          migrated.language = "all";
        }
        setAppliedFilters(migrated);
        setDraftFilters(migrated);
        logger.info("[FILTER_CONTEXT] Loaded filters for keyword:", keyword);
      } else {
        // Reset to defaults if no stored filters
        const defaultFilters = getDefaultFilterState();
        setAppliedFilters(defaultFilters);
        setDraftFilters(defaultFilters);
        logger.info("[FILTER_CONTEXT] No stored filters for keyword:", keyword);
      }
    },
    [getFilterSettings]
  );

  // Save filters for a specific keyword
  const saveFiltersForKeyword = useCallback(
    (keyword: string) => {
      saveFilterSettings(keyword, appliedFilters);
      logger.info("[FILTER_CONTEXT] Saved filters for keyword:", keyword);
    },
    [saveFilterSettings, appliedFilters]
  );

  // Filter tweets using client-side filtering
  const filterTweets = useCallback(
    (tweets: Tweet[]) => {
      const result = applyClientSideFilters(tweets, appliedFilters);
      return {
        filteredTweets: result.filteredTweets,
        filterSummary: result.filterSummary,
      };
    },
    [appliedFilters]
  );

  // Get unimplemented filters
  const unimplementedFilters = useMemo(() => {
    return getUnimplementedFilters(appliedFilters);
  }, [appliedFilters]);

  const contextValue = useMemo(
    () => ({
      isFilterMode,
      appliedFilters,
      draftFilters,
      hasChanges: computedValues.hasChanges,
      hasActiveFilters: computedValues.hasActiveFilters,
      activeFilterCount: computedValues.activeFilterCount,
      firstActiveFilter: computedValues.firstActiveFilter,
      isFormDirty,
      canApplyChanges: computedValues.canApplyChanges,
      unimplementedFilters,
      suggestionUsers,
      openFilter,
      closeFilter,
      updateDraftFilters,
      updateFormDirtyState,
      setSuggestionUsers: (users: string[]) => {
        try {
          const normalized = Array.from(
            new Set(
              (users || [])
                .filter((v) => typeof v === "string")
                .map((v) => v.trim().replace(/^@+/, "").toLowerCase())
                .filter((v) => v.length > 0 && /^[a-z0-9_]{1,15}$/.test(v))
            )
          ).slice(0, 200);
          setSuggestionUsersState(normalized);
        } catch {
          setSuggestionUsersState([]);
        }
      },
      applyFilters,
      resetFilters,
      loadFiltersForKeyword,
      saveFiltersForKeyword,
      filterTweets,
    }),
    [
      isFilterMode,
      appliedFilters,
      draftFilters,
      computedValues,
      isFormDirty,
      unimplementedFilters,
      suggestionUsers,
      openFilter,
      closeFilter,
      updateDraftFilters,
      updateFormDirtyState,
      applyFilters,
      resetFilters,
      loadFiltersForKeyword,
      saveFiltersForKeyword,
      filterTweets,
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
