// app/(webapp)/search/components/SearchLayout.tsx
"use client";

import { memo, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Progress } from "@/shared/ui/components/Progress";
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
import { getCachedSearchResult } from "@/shared/lib/utils/searchCache";

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
  const { isOpen: isProfileOpen } = useProfile();

  const searchParams = useSearchParams();
  const keywordId = searchParams.get("keywordId");
  const committedQuery = searchParams.get("q") || "";
  const committedExact = searchParams.get("exact") === "true";
  const progressDoc = useQuery(
    api.searchProgress.getActiveByKeyword,
    keywordId ? { keywordKey: keywordId } : "skip"
  );

  // Determine which panel is active
  const isPanelOpen = isFilterMode || isSortMode || isProfileOpen;

  // Memoize the filter panel
  const filterPanel = useMemo(() => {
    if (!isFilterMode) return null;

    // Build author suggestions from cached search results for current query
    let suggestionUsers: string[] = [];
    try {
      if (committedQuery.trim()) {
        const cached = getCachedSearchResult(committedQuery, committedExact);
        const names = (cached?.tweets || [])
          .map((t) => t.user?.screen_name)
          .filter(
            (v): v is string => typeof v === "string" && v.trim().length > 0
          )
          .map((v) => v.trim().replace(/^@+/, "").toLowerCase());
        suggestionUsers = Array.from(new Set(names)).slice(0, 200);
      }
    } catch {}

    return (
      <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden md:min-w-0 md:flex-1">
        <FilterContent
          filters={draftFilters}
          onFiltersChange={updateDraftFilters}
          onApply={applyFilters}
          onReset={resetFilters}
          onBack={closeFilter}
          suggestionUsers={suggestionUsers}
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
    committedQuery,
    committedExact,
  ]);

  // Memoize the sort panel
  const sortPanel = useMemo(() => {
    if (!isSortMode) return null;

    return (
      <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden md:min-w-0 md:flex-1">
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
    <div className="flex h-full min-h-0 max-w-full justify-start overflow-hidden">
      {/* Progress under main header only on /search */}
      {keywordId && progressDoc && !progressDoc.isComplete && (
        <div className="fixed left-0 right-0 top-12 z-30">
          <Progress
            className="h-0.5"
            value={Math.min(100, Math.max(0, progressDoc.value || 0))}
          />
        </div>
      )}

      {/* Main Content - SearchResultsPage */}
      <div
        className={cn(
          "h-full min-h-0 w-full max-w-lg overflow-hidden",
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

export const SearchLayout = memo<SearchLayoutProps>(({ children }) => {
  return (
    <ProfileProvider>
      <Inner>{children}</Inner>
    </ProfileProvider>
  );
});

SearchLayout.displayName = "SearchLayout";
