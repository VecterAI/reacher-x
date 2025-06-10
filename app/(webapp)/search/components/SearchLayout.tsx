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
    <div className="flex min-h-screen">
      {/* Main Content - SearchResultsPage */}
      <div
        className={cn(
          "min-w-0 flex-1",
          // Mobile: completely hide when in filter mode
          // Desktop: always show (side-by-side)
          isFilterMode ? "hidden md:block" : "block"
        )}
      >
        {children}
      </div>

      {/* Filter Panel */}
      {isFilterMode && (
        <div
          className={cn(
            // Mobile: full screen replacement
            "fixed inset-0 z-50 bg-background md:relative md:inset-auto md:z-auto",
            // Desktop: fixed width sidebar
            "w-full md:w-80 md:flex-shrink-0 md:border-l"
          )}
        >
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
