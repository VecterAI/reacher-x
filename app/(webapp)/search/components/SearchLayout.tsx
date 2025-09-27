// app/(webapp)/search/components/SearchLayout.tsx
"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { FilterContent } from "@/features/search/ui/components/FilterContent";
import { SortContent } from "@/features/search/ui/components/SortContent";
import { useFilter } from "@/features/search/contexts/FilterContext";
import { useSort } from "@/features/search/contexts/SortContext";
import { ProfilePanel } from "@/features/profile/ui/components/ProfilePanel";
import {
  ProfileProvider,
  useProfile,
} from "@/features/profile/contexts/ProfileContext";
import { cn } from "@/shared/lib/utils/utils";

interface SearchLayoutProps {
  children: React.ReactNode;
}

function Inner({ children }: { children: React.ReactNode }) {
  const {
    isFilterMode,
    draftFilters,
    updateDraftFilters,
    applyFilters,
    resetFilters,
    closeFilter,
  } = useFilter();

  const { isSortMode, currentSort, updateSort, resetSort, closeSort } =
    useSort();
  const { isOpen: isProfileOpen, closeProfile } = useProfile();

  // Track previous values to detect open events
  const prevProfileOpen = useRef(isProfileOpen);
  const prevFilterMode = useRef(isFilterMode);
  const prevSortMode = useRef(isSortMode);

  useEffect(() => {
    // Profile just opened -> close existing filter/sort
    if (!prevProfileOpen.current && isProfileOpen) {
      if (isSortMode) closeSort();
      if (isFilterMode) closeFilter();
    }
    prevProfileOpen.current = isProfileOpen;
  }, [isProfileOpen, isFilterMode, isSortMode, closeFilter, closeSort]);

  useEffect(() => {
    // Filter just opened -> close profile
    if (!prevFilterMode.current && isFilterMode) {
      if (isProfileOpen) closeProfile();
    }
    prevFilterMode.current = isFilterMode;
  }, [isFilterMode, isProfileOpen, closeProfile]);

  useEffect(() => {
    // Sort just opened -> close profile
    if (!prevSortMode.current && isSortMode) {
      if (isProfileOpen) closeProfile();
    }
    prevSortMode.current = isSortMode;
  }, [isSortMode, isProfileOpen, closeProfile]);

  // Determine which panel is active
  const isPanelOpen = isFilterMode || isSortMode || isProfileOpen;

  // Memoize the filter panel
  const filterPanel = useMemo(() => {
    if (!isFilterMode) return null;

    return (
      <div className="w-full">
        <FilterContent
          filters={draftFilters}
          onFiltersChange={updateDraftFilters}
          onApply={applyFilters}
          onReset={resetFilters}
          onBack={closeFilter}
        />
      </div>
    );
  }, [
    isFilterMode,
    draftFilters,
    updateDraftFilters,
    applyFilters,
    resetFilters,
    closeFilter,
  ]);

  // Memoize the sort panel
  const sortPanel = useMemo(() => {
    if (!isSortMode) return null;

    return (
      <div className="w-full">
        <SortContent
          currentSort={currentSort}
          onSortChange={updateSort}
          onReset={resetSort}
          onBack={closeSort}
        />
      </div>
    );
  }, [isSortMode, currentSort, updateSort, resetSort, closeSort]);

  return (
    <div className="flex max-w-full justify-start">
      {/* Main Content - SearchResultsPage */}
      <div
        className={cn(
          "min-w-full md:min-w-fit",
          // Mobile: completely hide when any panel is open
          // Desktop: always show (side-by-side)
          isPanelOpen ? "hidden md:block" : "block"
        )}
      >
        {children}
      </div>

      {/* Active Panel */}
      {filterPanel}
      {/* Only show sort when profile is not open */}
      {!isProfileOpen && sortPanel}
      {/* Profile panel on the right (desktop), Drawer on mobile handled inside ProfilePanel if needed */}
      {isProfileOpen && <ProfilePanel />}
    </div>
  );
}

export const SearchLayout = memo<SearchLayoutProps>(function SearchLayout({
  children,
}) {
  return (
    <ProfileProvider>
      <Inner>{children}</Inner>
    </ProfileProvider>
  );
});
