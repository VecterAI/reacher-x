// app/(webapp)/search/components/SearchLayout.tsx
"use client";

import { FilterContent } from "@/features/search/ui/components/FilterContent";
import { useFilter } from "@/features/search/contexts/FilterContext";
import { cn } from "@/shared/lib/utils/utils";

interface SearchLayoutProps {
  children: React.ReactNode;
}

export function SearchLayout({ children }: SearchLayoutProps) {
  const {
    isFilterMode,
    filterState,
    updateFilters,
    applyFilters,
    resetFilters,
    closeFilter,
  } = useFilter();

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
      {isFilterMode && (
        <div className="w-full">
          <FilterContent
            filters={filterState}
            onFiltersChange={updateFilters}
            onApply={applyFilters}
            onReset={resetFilters}
            onBack={closeFilter}
          />
        </div>
      )}
    </div>
  );
}
