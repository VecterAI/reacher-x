// app/(webapp)/search/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { SearchContent } from "@/features/search/ui/components/SearchContent";
import { useFilter } from "@/features/search/contexts/FilterContext";
import { useSort } from "@/features/search/contexts/SortContext";
import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils/utils";
import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/shared/ui/components/Tabs";
import { Button } from "@/shared/ui/components/Button";
import {
  FilledFilterAltIcon,
  FilterAltIcon,
  SwapVertIcon,
} from "@/shared/ui/components/icons";
import { Tweet as TweetComponent } from "@/features/threads/ui/components/Tweet";
import { useTwitterSearch } from "@/features/search/hooks/useTwitterSearch";
import { useKeywordSuggestions } from "@/features/keywords/hooks/useKeywordSuggestions";
import { useOptimisticSearch } from "@/features/search/hooks/useOptimisticSearch";
import { Tweet } from "@/features/threads/types";
import { getWorkspaceDescription } from "@/shared/lib/utils/localStorage";
// Keyword storage is handled via useKeywordSync
import { useKeywordSync } from "@/shared/hooks/useKeywordSync";
import { startSearch, endSearch } from "@/shared/lib/utils/performance";
import { cacheTweet } from "@/shared/lib/utils/tweetCache";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";

// Valid tab types
const validTabs = ["all", "posts", "replies", "quotes"] as const;
type ValidTab = (typeof validTabs)[number];

// Note: Keyword data is now managed by individual components using real search history

export default function SearchResultsPage() {
  // Unified keyword sync (local first, Convex when authenticated)
  const { addOrUseKeyword } = useKeywordSync();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openFilter, isFilterMode, hasActiveFilters, activeFilterCount } =
    useFilter();
  const { openSort, isSortMode, isModified: isSortModified } = useSort();

  // Committed state (from URL - source of truth)
  const committedQuery = searchParams.get("q") || "";
  const committedExactMatch = searchParams.get("exact") === "true";

  // Track the keyword ID that led to the current search
  const currentKeywordId = searchParams.get("keywordId") || "";

  // Draft state (being edited)
  const [draftQuery, setDraftQuery] = useState(committedQuery);
  const [draftExactMatch, setDraftExactMatch] = useState(committedExactMatch);

  // UI state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<ValidTab>("all");

  // Avoid unnecessary forced re-keys; keep a stable key unless committed values actually change
  const [inputKey, setInputKey] = useState(0);

  // Track if we're in the middle of a commit operation to prevent revert
  const isCommittingRef = useRef(false);

  // User description state for logging
  const [userDescription, setUserDescription] = useState<string | null>(null);

  // Twitter search hook
  const {
    searchTweets,
    results,
    loading,
    error,
    retryCount,
    clearResults,
    autoAdvanceState,
    autoAdvancePagesChecked,
    autoAdvanceStopReason,
    autoAdvanceFoundCount,
    autoAdvanceFoundFromPage,
    autoAdvanceCap,
  } = useTwitterSearch();

  // Filter context
  const { filterTweets, loadFiltersForKeyword } = useFilter();

  // Sort context
  const { sortTweets: sortTweetsForContext, loadSortForKeyword } = useSort();

  // Keyword suggestions hook
  const { suggestions: keywordSuggestions, recordKeywordUsage } =
    useKeywordSuggestions();

  // Optimistic search hook
  const { getOptimisticResult, clearOptimisticCache } = useOptimisticSearch();

  // Add safeguards against infinite loops
  const isInitialSearchDone = useRef(false);
  const lastCommittedQuery = useRef<string>("");
  const lastCommittedExactMatch = useRef<boolean>(false);

  // Load user description from localStorage for display purposes
  useEffect(() => {
    try {
      const description = getWorkspaceDescription();
      setUserDescription(description);
      console.log("[SEARCH_PAGE] Loaded user description from localStorage:", {
        hasDescription: !!description,
        descriptionLength: description?.length || 0,
      });
    } catch (error) {
      console.error("[SEARCH_PAGE] Failed to load user description:", error);
    }
  }, []);

  // Cleanup optimistic cache on unmount
  useEffect(() => {
    return () => {
      clearOptimisticCache();
    };
  }, [clearOptimisticCache]);

  // Monitor results loading for performance tracking
  useEffect(() => {
    if (results && !loading && committedQuery) {
      endSearch(committedQuery, results.tweets.length);
    }
  }, [results, loading, committedQuery]);

  // Helper function to safely get the current tab
  const getCurrentTab = useCallback((): ValidTab => {
    return validTabs.includes(activeTab) ? activeTab : "all";
  }, [activeTab]);

  // Sync draft state with committed state when URL changes
  useEffect(() => {
    console.log("[SEARCH_PAGE] URL sync effect triggered:", {
      committedQuery,
      committedExactMatch,
      lastCommittedQuery: lastCommittedQuery.current,
      lastCommittedExactMatch: lastCommittedExactMatch.current,
      timestamp: new Date().toISOString(),
    });

    // Prevent infinite loops by checking if the committed values actually changed
    if (
      committedQuery === lastCommittedQuery.current &&
      committedExactMatch === lastCommittedExactMatch.current
    ) {
      console.log(
        "[SEARCH_PAGE] No actual change in committed values, skipping search"
      );
      return;
    }

    // Update tracking refs
    lastCommittedQuery.current = committedQuery;
    lastCommittedExactMatch.current = committedExactMatch;

    setDraftQuery(committedQuery);
    setDraftExactMatch(committedExactMatch);
    setIsSearchMode(false);
    // Only nudge the input when the values truly changed (we already guard at the top)
    setInputKey((prev) => prev + 1);
    isCommittingRef.current = false;

    // Only trigger search if we have a query, and prevent duplicate initial searches
    if (committedQuery && committedQuery.trim()) {
      console.log("[SEARCH_PAGE] Triggering search for:", {
        query: committedQuery,
        exactMatch: committedExactMatch,
        hasUserDescription: !!userDescription,
      });

      // Start performance monitoring
      startSearch(committedQuery);

      // Check for optimistic results first
      const optimisticResult = getOptimisticResult(
        committedQuery,
        committedExactMatch
      );
      if (optimisticResult) {
        console.log("[SEARCH_PAGE] Using optimistic result:", {
          tweetCount: optimisticResult.tweets.length,
        });
        // Clear optimistic cache after using it
        clearOptimisticCache();
        // End performance monitoring with optimistic results
        endSearch(committedQuery, optimisticResult.tweets.length);
        // Continue with normal search flow - the optimistic result will be used
        // by the useTwitterSearch hook's cache mechanism
      }

      // Run async side-effects (Convex upsert + URL update) safely
      let cancelled = false;
      const run = async () => {
        try {
          // Load filters/sort for this keyword (local only)
          loadFiltersForKeyword(committedQuery);
          loadSortForKeyword(committedQuery);

          let keywordId = currentKeywordId;
          if (!keywordId) {
            keywordId = await addOrUseKeyword(
              committedQuery,
              "user_created",
              committedExactMatch
            );
            if (cancelled) return;
          }

          const params = new URLSearchParams();
          params.set("q", committedQuery);
          if (committedExactMatch) {
            params.set("exact", "true");
          }
          params.set("keywordId", keywordId);

          router.replace(`/search?${params.toString()}`, { scroll: false });

          searchTweets(committedQuery, committedExactMatch);
          isInitialSearchDone.current = true;
        } catch (err) {
          console.error("[SEARCH_PAGE] Failed to commit search:", err);
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    } else {
      console.log("[SEARCH_PAGE] Clearing results - no query");
      clearResults();
      isInitialSearchDone.current = false;
    }
  }, [
    committedQuery,
    committedExactMatch,
    searchTweets,
    clearResults,
    userDescription,
    router,
    getOptimisticResult,
    clearOptimisticCache,
    loadFiltersForKeyword,
    loadSortForKeyword,
    addOrUseKeyword,
    currentKeywordId,
  ]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (results?.meta?.next_cursor && committedQuery && !loading) {
      console.log("[SEARCH_PAGE] Loading more results with cursor:", {
        cursor: results.meta.next_cursor,
        currentResultsCount: results.tweets.length,
      });
      searchTweets(
        committedQuery,
        committedExactMatch,
        false, // Keep automatic filtering enabled for pagination
        results.meta.next_cursor
      );
    }
  }, [
    results?.meta?.next_cursor,
    committedQuery,
    committedExactMatch,
    loading,
    searchTweets,
    results?.tweets.length,
  ]);

  // Revert draft state whenever search mode exits without commit
  useEffect(() => {
    if (!isSearchMode && !isCommittingRef.current) {
      if (
        draftQuery !== committedQuery ||
        draftExactMatch !== committedExactMatch
      ) {
        console.log(
          "[SEARCH_PAGE] Reverting draft state to committed values:",
          {
            draftQuery,
            committedQuery,
            draftExactMatch,
            committedExactMatch,
          }
        );
        setDraftQuery(committedQuery);
        setDraftExactMatch(committedExactMatch);
        setInputKey((prev) => prev + 1);
      }
    }
  }, [
    isSearchMode,
    draftQuery,
    draftExactMatch,
    committedQuery,
    committedExactMatch,
  ]);

  // Note: RecentKeywords and SimilarKeywords now manage their own data internally

  // Apply client-side filtering, sorting, and separate tweets by type
  const filteredResults = useMemo(() => {
    if (!results?.tweets) {
      return {
        all: [],
        posts: [],
        replies: [],
        quotes: [],
        filterSummary: "",
      };
    }

    // Apply client-side filtering
    const { filteredTweets, filterSummary } = filterTweets(results.tweets);

    // Apply sorting to the filtered tweets
    const sortedTweets = sortTweetsForContext(filteredTweets);

    const posts = sortedTweets.filter(
      (tweet) => !tweet.in_reply_to_status_id_str && !tweet.quoted_status_id_str
    );
    const replies = sortedTweets.filter(
      (tweet) => tweet.in_reply_to_status_id_str
    );
    const quotes = sortedTweets.filter((tweet) => tweet.quoted_status_id_str);

    console.log("[SEARCH_PAGE] Filtered, sorted, and categorized tweets:", {
      original: results.tweets.length,
      filtered: filteredTweets.length,
      sorted: sortedTweets.length,
      posts: posts.length,
      replies: replies.length,
      quotes: quotes.length,
      filterSummary,
    });

    return {
      all: sortedTweets,
      posts,
      replies,
      quotes,
      filterSummary,
    };
  }, [results?.tweets, filterTweets, sortTweetsForContext]);

  // Removed user-facing per-tab results header; keep info in dev Alert only

  // Enhanced load more logic that considers client-side filtering
  const shouldShowLoadMore = useMemo(() => {
    // Don't show if no more pages available
    if (!results?.meta?.has_next_page) {
      return false;
    }

    // Don't show if current tab has no results (client-side filtering removed all)
    const currentTabResults = filteredResults[getCurrentTab()];
    if (currentTabResults.length === 0) {
      return false;
    }

    // Show the button if we have results and more pages are available
    // The button will be disabled during loading but still visible
    return currentTabResults.length > 0;
  }, [results?.meta?.has_next_page, filteredResults, getCurrentTab]);

  // Render tweet list component
  const renderTweetList = (tweets: Tweet[]) => (
    <div className="divide-y">
      {tweets.length > 0 ? (
        tweets.map((tweet) => (
          <div
            key={tweet.id_str}
            className="px-4 py-2"
            onClick={() => {
              try {
                // Cache for instant hydration on detail page
                cacheTweet(tweet);
              } catch {}

              // Pack minimal tweet payload in URL param (base64) to avoid effects on target page
              let packed = "";
              try {
                packed = btoa(JSON.stringify(tweet));
              } catch {}
              const id = tweet.id_str || String(tweet.id);
              const params = new URLSearchParams();
              if (packed) params.set("t", packed);
              if (currentKeywordId) params.set("keywordId", currentKeywordId);
              if (committedQuery) params.set("q", committedQuery);
              router.push(`/post/${id}?${params.toString()}`);
            }}
          >
            <TweetComponent
              tweet={tweet}
              characterLimit={280}
              showFullContent={false}
              showThread={true}
              votingContext={
                currentKeywordId && committedQuery
                  ? {
                      keywordId: currentKeywordId,
                      searchQuery: committedQuery,
                    }
                  : undefined
              }
            />
          </div>
        ))
      ) : (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No results found
          </p>
          {results?.meta?.filteredCount === 0 &&
            results?.meta?.originalCount &&
            results.meta.originalCount > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                All {results.meta.originalCount} tweets were filtered out by AI
                lead qualification
              </p>
            )}
        </div>
      )}
      {shouldShowLoadMore && (
        <div className="p-4">
          <Button
            variant="default"
            size="xs"
            className="mx-auto block"
            onClick={handleLoadMore}
            disabled={loading || autoAdvanceState === "chaining"}
          >
            {autoAdvanceState === "chaining"
              ? `Searching next pages (${Math.min(
                  autoAdvancePagesChecked,
                  autoAdvanceCap
                )}/${autoAdvanceCap})...`
              : loading
                ? "Loading..."
                : "Load more"}
          </Button>
          {/* Auto-advance helper text */}
          {autoAdvanceState === "chaining" && (
            <div className="mt-1 text-center text-[10px] text-muted-foreground">
              Checking next pages automatically…
            </div>
          )}
          {autoAdvanceState === "stopped" &&
            autoAdvanceStopReason === "foundKept" && (
              <div className="mt-1 text-center text-[10px] text-muted-foreground">
                Found {autoAdvanceFoundCount} result
                {autoAdvanceFoundCount === 1 ? "" : "s"} from page{" "}
                {autoAdvanceFoundFromPage}.
              </div>
            )}
          {autoAdvanceState === "stopped" &&
            autoAdvanceStopReason === "cap" && (
              <div className="mt-1 text-center text-[10px] text-muted-foreground">
                Checked {autoAdvancePagesChecked} page
                {autoAdvancePagesChecked === 1 ? "" : "s"} automatically — no
                relevant results. Click Load more to continue.
              </div>
            )}
          {autoAdvanceState === "stopped" &&
            autoAdvanceStopReason === "noMorePages" && (
              <div className="mt-1 text-center text-[10px] text-muted-foreground">
                No more results.
              </div>
            )}
        </div>
      )}
    </div>
  );

  // Commit draft state (search execution)
  const handleSearch = useCallback(
    async (searchQuery: string, isExactMatch: boolean) => {
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery) return;

      console.log("[SEARCH_PAGE] Committing search:", {
        searchQuery: trimmedQuery,
        isExactMatch,
      });

      isCommittingRef.current = true;
      setIsSearchMode(false);

      // Add keyword to store (local + Convex if authenticated) and get the ID
      const keywordId = await addOrUseKeyword(
        trimmedQuery,
        "user_created",
        isExactMatch
      );

      const params = new URLSearchParams();
      params.set("q", trimmedQuery);
      if (isExactMatch) {
        params.set("exact", "true");
      }
      params.set("keywordId", keywordId);

      router.push(`/search?${params.toString()}`);
    },
    [router, addOrUseKeyword]
  );

  // Handle keyword selection from suggestions
  const handleKeywordClick = useCallback(
    async (item: KeywordItem) => {
      console.log("[SEARCH_PAGE] Keyword selected from suggestions:", {
        keyword: item.keyword,
        exactMatch: item.exactMatch,
      });

      // Add keyword to store (local + Convex if authenticated) and get the ID
      const keywordId = await addOrUseKeyword(
        item.keyword,
        "ai_suggestion",
        item.exactMatch ?? false, // Use the stored exact match setting
        item.metadata
      );
      recordKeywordUsage(item.id, item.keyword); // This hook can still be used for other analytics

      isCommittingRef.current = true;
      setIsSearchMode(false);

      const params = new URLSearchParams();
      params.set("q", item.keyword);
      if (item.exactMatch) {
        params.set("exact", "true");
      }
      params.set("keywordId", keywordId);

      router.push(`/search?${params.toString()}`);
    },
    [router, recordKeywordUsage, addOrUseKeyword]
  );

  // Update draft state
  const handleQueryChange = useCallback((newQuery: string) => {
    console.log("[SEARCH_PAGE] Draft query updated:", { newQuery });
    setDraftQuery(newQuery);
  }, []);

  // Handle search input focus
  const handleSearchFocus = useCallback(() => {
    console.log("[SEARCH_PAGE] Search input focused - entering search mode");
    setIsSearchMode(true);
  }, []);

  // Handle search input blur with delay for click events
  const handleSearchBlur = useCallback(() => {
    setTimeout(() => {
      if (
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        console.log("[SEARCH_PAGE] Search input blurred - exiting search mode");
        setIsSearchMode(false);
      }
    }, 150);
  }, []);

  // Handle input start
  const handleInputStart = useCallback(() => {
    console.log("[SEARCH_PAGE] User started typing - entering search mode");
    setIsSearchMode(true);
  }, []);

  // Manual revert function
  const revertToCommittedState = useCallback(() => {
    console.log("[SEARCH_PAGE] Manual revert to committed state triggered");
    setDraftQuery(committedQuery);
    setDraftExactMatch(committedExactMatch);
    setIsSearchMode(false);
    setInputKey((prev) => prev + 1);

    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  }, [committedQuery, committedExactMatch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSearchMode) {
        e.preventDefault();
        console.log(
          "[SEARCH_PAGE] Escape key pressed - reverting to committed state"
        );
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
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-col pt-4",
        // Conditionally apply the border only when neither panel is open
        !isFilterMode && !isSortMode && "md:border-r md:border-border"
      )}
    >
      {/* Search header */}
      <div className="mx-4">
        <SearchInput
          key={inputKey}
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

      {/* Comprehensive Search Debug Information */}
      {process.env.NODE_ENV === "development" && (
        <Alert className="mx-4 mt-2 w-auto">
          <AlertTitle>Debug - Search & Results</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            <div className="space-y-2">
              {/* Query State */}
              <div className="space-y-1">
                <div className="font-semibold text-blue-600">Query State:</div>
                <div>Committed: &quot;{committedQuery}&quot;</div>
                <div>Draft: &quot;{draftQuery}&quot;</div>
                <div>Exact Match: {committedExactMatch ? "Yes" : "No"}</div>
                <div>Mode: {isSearchMode ? "Search" : "Results"}</div>
                <div>Active Tab: {activeTab}</div>
                <div>Keyword ID: {currentKeywordId || "None"}</div>
              </div>

              {/* User Context */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-green-600">
                  User Context:
                </div>
                <div>
                  User Description:{" "}
                  {userDescription ? `${userDescription.length} chars` : "None"}
                </div>
              </div>

              {/* Search State */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-purple-600">
                  Search State:
                </div>
                <div>Loading: {loading ? "Yes" : "No"}</div>
                <div>Has Results: {results ? "Yes" : "No"}</div>
                <div>Results Count: {results?.tweets?.length || 0}</div>
                <div>Retry Count: {retryCount}</div>
                <div>Filter Mode: {isFilterMode ? "Yes" : "No"}</div>
                <div>Sort Mode: {isSortMode ? "Yes" : "No"}</div>
                <div>
                  Active Filters: {hasActiveFilters ? activeFilterCount : 0}
                </div>
                <div>Sort Modified: {isSortModified ? "Yes" : "No"}</div>
              </div>

              {/* Error State */}
              {error && (
                <div className="space-y-1 border-t pt-1">
                  <div className="font-semibold text-red-600">Error State:</div>
                  <div className="text-destructive">Error: {error}</div>
                  <div>Error Time: {new Date().toLocaleTimeString()}</div>
                </div>
              )}

              {/* Search Results Meta - Dev only */}
              {process.env.NODE_ENV === "development" && results?.meta && (
                <div className="space-y-1 border-t pt-1">
                  <div className="font-semibold text-orange-600">
                    Search Results Meta:
                  </div>
                  {results.meta.originalCount !== undefined && (
                    <div>• Original: {results.meta.originalCount}</div>
                  )}
                  {results.meta.filteredCount !== undefined && (
                    <div>• Kept: {results.meta.filteredCount}</div>
                  )}
                  {results.meta.originalCount !== undefined &&
                    results.meta.filteredCount !== undefined && (
                      <div>
                        • Filtered out:{" "}
                        {results.meta.originalCount -
                          results.meta.filteredCount}
                      </div>
                    )}
                  {results.meta.llmProcessedCount !== undefined && (
                    <div>• LLM Processed: {results.meta.llmProcessedCount}</div>
                  )}
                  {results.meta.processingTimeMs !== undefined && (
                    <div>• Total Time: {results.meta.processingTimeMs}ms</div>
                  )}
                  {results.meta.llmProcessingTimeMs !== undefined && (
                    <div>• LLM Time: {results.meta.llmProcessingTimeMs}ms</div>
                  )}
                  {/* Confidence stats removed in new LLM schema */}
                  {results.meta.requestId && (
                    <div>• Request ID: {results.meta.requestId}</div>
                  )}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Conditional content area */}
      <div className="mt-4 min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full overscroll-contain">
          {isSearchMode ? (
            <SearchContent
              suggestions={keywordSuggestions}
              currentQuery={draftQuery}
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
                "duration-200 animate-in fade-in-50 slide-in-from-bottom-2"
              )}
              role="main"
              aria-label="Search results"
            >
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  console.log("[SEARCH_PAGE] Tab changed:", {
                    from: activeTab,
                    to: value,
                  });
                  setActiveTab(value as ValidTab);
                }}
              >
                {/* Tabs Header with Filters and Sort */}
                <div className="mx-4 flex items-center justify-between gap-1">
                  <TabsList size="sm">
                    <TabsTrigger size="sm" value="all">
                      All
                    </TabsTrigger>
                    <TabsTrigger size="sm" value="posts">
                      Posts
                    </TabsTrigger>
                    <TabsTrigger size="sm" value="replies">
                      Replies
                    </TabsTrigger>
                    <TabsTrigger size="sm" value="quotes">
                      Quotes
                    </TabsTrigger>
                  </TabsList>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="gap-1"
                      onClick={openFilter}
                      aria-haspopup="dialog"
                      aria-expanded={isFilterMode}
                      aria-controls="search-filter-panel"
                    >
                      {hasActiveFilters && activeFilterCount > 0 ? (
                        <FilledFilterAltIcon className="fill-current" />
                      ) : (
                        <FilterAltIcon className="fill-current" />
                      )}
                      {hasActiveFilters && activeFilterCount > 0 ? (
                        <span className="font-mono text-xs">
                          {activeFilterCount}
                        </span>
                      ) : (
                        "Filter"
                      )}
                    </Button>
                    {/* Updated Sort Button with Dot Indicator */}
                    <Button
                      variant="outline"
                      size="xsIcon"
                      onClick={openSort}
                      aria-haspopup="dialog"
                      aria-expanded={isSortMode}
                      aria-controls="search-sort-panel"
                      className="relative"
                    >
                      <SwapVertIcon className="fill-current" />
                      {/* Dot indicator when sort is modified */}
                      {isSortModified && (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Removed user-facing results count per tab */}

                {/* Tab Contents */}
                <TabsContent value="all">
                  {renderTweetList(filteredResults.all)}
                </TabsContent>

                <TabsContent value="posts">
                  {renderTweetList(filteredResults.posts)}
                </TabsContent>

                <TabsContent value="replies">
                  {renderTweetList(filteredResults.replies)}
                </TabsContent>

                <TabsContent value="quotes">
                  {renderTweetList(filteredResults.quotes)}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
