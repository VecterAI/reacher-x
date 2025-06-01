// app/(webapp)/search/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { SearchContent } from "@/features/search/ui/components/SearchContent";
import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils/utils";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

// Mock data - in real app, these would come from your data layer
const mockSuggestions: KeywordItem[] = [
  { id: "1", keyword: "help me in web dev" },
  { id: "2", keyword: "can't do web dev" },
  { id: "3", keyword: "web dev sucks" },
  { id: "4", keyword: "need a web dev" },
  { id: "5", keyword: "suck at web dev" },
];

const mockAllKeywords: KeywordItem[] = [
  { id: "6", keyword: "need a web dev", timestamp: "Mar 22, 2025" },
  { id: "7", keyword: "suck at web dev", timestamp: "9h" },
  { id: "8", keyword: "web dev suck", timestamp: "Mar 22, 2025" },
  { id: "9", keyword: "web dev sucks", timestamp: "10h" },
  { id: "10", keyword: "mobile dev sucks", timestamp: "Mar 21, 2025" },
  { id: "11", keyword: "help with web development", timestamp: "Mar 20, 2025" },
  { id: "12", keyword: "web developer needed", timestamp: "Mar 19, 2025" },
  { id: "13", keyword: "frontend development help", timestamp: "Mar 18, 2025" },
  { id: "14", keyword: "struggling with web dev", timestamp: "Mar 17, 2025" },
  {
    id: "15",
    keyword: "web programming assistance",
    timestamp: "Mar 16, 2025",
  },
];

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Committed state (from URL - source of truth)
  const committedQuery = searchParams.get("q") || "";
  const committedExactMatch = searchParams.get("exact") === "true";

  // Draft state (being edited)
  const [draftQuery, setDraftQuery] = useState(committedQuery);
  const [draftExactMatch, setDraftExactMatch] = useState(committedExactMatch);

  // UI state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [loading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Force re-render key for SearchInput when reverting
  const [inputKey, setInputKey] = useState(0);

  // Track if we're in the middle of a commit operation to prevent revert
  const isCommittingRef = useRef(false);

  // Sync draft state with committed state when URL changes
  useEffect(() => {
    setDraftQuery(committedQuery);
    setDraftExactMatch(committedExactMatch);
    setIsSearchMode(false);
    setInputKey((prev) => prev + 1); // Force SearchInput re-render
    isCommittingRef.current = false; // Reset commit flag
  }, [committedQuery, committedExactMatch]);

  // **CORE FIX**: Revert draft state whenever search mode exits without commit
  useEffect(() => {
    if (!isSearchMode && !isCommittingRef.current) {
      // Only revert if we're not in the middle of a commit operation
      if (
        draftQuery !== committedQuery ||
        draftExactMatch !== committedExactMatch
      ) {
        console.log("Auto-reverting to committed state:", {
          from: { query: draftQuery, exactMatch: draftExactMatch },
          to: { query: committedQuery, exactMatch: committedExactMatch },
        });

        setDraftQuery(committedQuery);
        setDraftExactMatch(committedExactMatch);
        setInputKey((prev) => prev + 1); // Force SearchInput re-render
      }
    }
  }, [
    isSearchMode,
    draftQuery,
    draftExactMatch,
    committedQuery,
    committedExactMatch,
  ]);

  // Get recent keywords (excluding current committed query)
  const recentKeywords = useMemo(
    () =>
      mockAllKeywords
        .filter(
          (item) => item.keyword.toLowerCase() !== committedQuery.toLowerCase()
        )
        .slice(0, 5),
    [committedQuery]
  );

  // Commit draft state (search execution)
  const handleSearch = useCallback(
    (searchQuery: string, isExactMatch: boolean) => {
      console.log("Search committed:", { searchQuery, isExactMatch });

      // Mark as committing to prevent auto-revert
      isCommittingRef.current = true;

      // Exit search mode
      setIsSearchMode(false);

      // Commit the state by navigating (updates URL)
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      if (isExactMatch) {
        params.set("exact", "true");
      }

      router.push(`/search?${params.toString()}`);
    },
    [router]
  );

  // Handle keyword selection from suggestions (also commits)
  const handleKeywordClick = useCallback(
    (item: KeywordItem) => {
      console.log("Keyword selected:", item);

      // Mark as committing to prevent auto-revert
      isCommittingRef.current = true;

      // Exit search mode
      setIsSearchMode(false);

      // Commit by navigating to search results
      const params = new URLSearchParams();
      params.set("q", item.keyword);

      router.push(`/search?${params.toString()}`);
    },
    [router]
  );

  // Update draft state (uncommitted changes)
  const handleQueryChange = useCallback((newQuery: string) => {
    setDraftQuery(newQuery);
  }, []);

  // Handle search input focus
  const handleSearchFocus = useCallback(() => {
    setIsSearchMode(true);
  }, []);

  // Handle search input blur with delay for click events
  const handleSearchBlur = useCallback(() => {
    setTimeout(() => {
      if (
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        setIsSearchMode(false);
      }
    }, 150);
  }, []);

  // Handle input start (when user begins typing)
  const handleInputStart = useCallback(() => {
    setIsSearchMode(true);
  }, []);

  // Manual revert function (for Escape key and other explicit revert actions)
  const revertToCommittedState = useCallback(() => {
    console.log("Manual revert to committed state:", {
      from: { query: draftQuery, exactMatch: draftExactMatch },
      to: { query: committedQuery, exactMatch: committedExactMatch },
    });

    setDraftQuery(committedQuery);
    setDraftExactMatch(committedExactMatch);
    setIsSearchMode(false);
    setInputKey((prev) => prev + 1); // Force SearchInput re-render

    // Remove focus from input
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  }, [committedQuery, committedExactMatch, draftQuery, draftExactMatch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSearchMode) {
        e.preventDefault();
        revertToCommittedState();
      }
    },
    [isSearchMode, revertToCommittedState]
  );

  // Add global keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={containerRef}
      className="max-w-lg pt-4 md:min-h-screen md:border-r md:border-border"
    >
      {/* Search header - now uses draft state */}
      <div className="mx-4">
        <SearchInput
          key={inputKey} // Force re-render when reverting
          ref={searchInputRef}
          defaultValue={draftQuery}
          defaultExactMatch={draftExactMatch}
          placeholder="Type keywords..."
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          onInputStart={handleInputStart}
          showExactMatch={true}
          aria-expanded={isSearchMode}
        />
      </div>

      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mx-4 mt-2 text-xs text-muted-foreground">
          <div>Committed: &quot;{committedQuery}&quot;</div>
          <div>Draft: &quot;{draftQuery}&quot;</div>
          <div>Mode: {isSearchMode ? "Search" : "Results"}</div>
          <div>IsCommitting: {isCommittingRef.current ? "Yes" : "No"}</div>
        </div>
      )}

      {/* Conditional content area with smooth transitions */}
      <div className="mt-4">
        {isSearchMode ? (
          <SearchContent
            suggestions={mockSuggestions}
            recentKeywords={recentKeywords}
            allKeywords={mockAllKeywords}
            currentQuery={draftQuery} // Use draft query for suggestions
            onKeywordClick={handleKeywordClick}
            loading={loading}
            className={cn(
              "duration-200 animate-in fade-in-50 slide-in-from-top-2",
              "space-y-2"
            )}
          />
        ) : (
          <div
            className={cn(
              "duration-200 animate-in fade-in-50 slide-in-from-bottom-2",
              "space-y-4"
            )}
            role="main"
            aria-label="Search results"
          >
            {/* Search results content */}
            <div className="border-b p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <span className="text-sm font-medium">C</span>
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-medium">Customer</span>
                    <span className="text-sm text-muted-foreground">
                      @Customer
                    </span>
                    <span className="rounded bg-black px-2 py-0.5 text-xs text-white">
                      Load new
                    </span>
                  </div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Replying to <span className="text-primary">@Customer</span>
                  </div>
                  <p className="mb-3 text-sm">
                    @Vecterz Find{" "}
                    <span className="text-amber-600">#unlimited</span>{" "}
                    <span className="font-medium">customers</span> for your{" "}
                    <span className="font-medium">products/services</span> with
                    the help of advance search of ReacherX.
                  </p>
                  <a
                    href="https://reacherx.com"
                    className="text-sm text-primary hover:underline"
                  >
                    https://reacherx.com
                  </a>

                  {/* Placeholder images grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="aspect-video rounded bg-muted" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* More results placeholder */}
            <div className="mx-4 rounded-lg border bg-muted/50 p-4">
              <div className="text-center text-sm text-muted-foreground">
                {committedQuery ? (
                  <>Search results for &quot;{committedQuery}&quot;</>
                ) : (
                  "More search results would appear here..."
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
