// app/(webapp)/search/components/SearchLayout.tsx
"use client";

import { memo, useMemo } from "react";
import { FilterContent } from "@/features/search/ui/components/FilterContent";
import { SortContent } from "@/features/search/ui/components/SortContent";
import { useFilter } from "@/features/search/contexts/FilterContext";
import { useSort } from "@/features/search/contexts/SortContext";
import { cn } from "@/shared/lib/utils/utils";

interface SearchLayoutProps {
  children: React.ReactNode;
}

export const SearchLayout = memo<SearchLayoutProps>(function SearchLayout({
  children,
}) {
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

  // Determine which panel is active
  const isPanelOpen = isFilterMode || isSortMode;

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
      {sortPanel}
    </div>
  );
});
