// app/(webapp)/search/components/SearchLayout.tsx
"use client";

import { memo, useMemo } from "react";
import { FilterContent } from "@/features/search/ui/components/FilterContent";
import { useFilter } from "@/features/search/contexts/FilterContext";
import { cn } from "@/shared/lib/utils/utils";

interface SearchLayoutProps {
  children: React.ReactNode;
}

export const SearchLayout = memo<SearchLayoutProps>(function SearchLayout({
  children,
}) {
  const {
    isFilterMode,
    draftFilters, // Use draft filters for the form
    updateDraftFilters,
    applyFilters,
    resetFilters,
    closeFilter,
  } = useFilter();

  // Memoize the filter panel to prevent unnecessary re-renders
  const filterPanel = useMemo(() => {
    if (!isFilterMode) return null;

    return (
      <div className="w-full">
        <FilterContent
          filters={draftFilters} // Pass draft filters
          onFiltersChange={updateDraftFilters} // Update draft
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

  return (
    <div className="flex max-w-full justify-start">
      {/* Main Content - SearchResultsPage */}
      <div
        className={cn(
          "min-w-full md:min-w-fit",
          // Mobile: completely hide when in filter mode
          // Desktop: always show (side-by-side)
          isFilterMode ? "hidden md:block" : "block"
        )}
      >
        {children}
      </div>

      {/* Filter Panel */}
      {filterPanel}
    </div>
  );
});
