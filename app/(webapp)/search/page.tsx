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
import { TweetCard } from "@/features/threads/ui/components/TweetCard";
import { useTwitterSearch } from "@/features/search/hooks/useTwitterSearch";
import { useKeywordSuggestions } from "@/features/keywords/hooks/useKeywordSuggestions";
import { Tweet } from "@/features/threads/types";
import { getWorkspaceDescription } from "@/shared/lib/utils/localStorage";

// Valid tab types
const validTabs = ["all", "posts", "replies", "quotes"] as const;
type ValidTab = (typeof validTabs)[number];

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
  const { openFilter, isFilterMode, hasActiveFilters, activeFilterCount } =
    useFilter();
  const { openSort, isSortMode, isModified: isSortModified } = useSort();

  // Committed state (from URL - source of truth)
  const committedQuery = searchParams.get("q") || "";
  const committedExactMatch = searchParams.get("exact") === "true";

  // Draft state (being edited)
  const [draftQuery, setDraftQuery] = useState(committedQuery);
  const [draftExactMatch, setDraftExactMatch] = useState(committedExactMatch);

  // UI state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<ValidTab>("all");

  // Force re-render key for SearchInput when reverting
  const [inputKey, setInputKey] = useState(0);

  // Track if we're in the middle of a commit operation to prevent revert
  const isCommittingRef = useRef(false);

  // User description state for logging
  const [userDescription, setUserDescription] = useState<string | null>(null);

  // Twitter search hook
  const { searchTweets, results, loading, error, retryCount, clearResults } =
    useTwitterSearch();

  // Keyword suggestions hook
  const { suggestions: keywordSuggestions, recordKeywordUsage } =
    useKeywordSuggestions();

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
    setInputKey((prev) => prev + 1);
    isCommittingRef.current = false;

    // Only trigger search if we have a query, and prevent duplicate initial searches
    if (committedQuery && committedQuery.trim()) {
      console.log("[SEARCH_PAGE] Triggering search for:", {
        query: committedQuery,
        exactMatch: committedExactMatch,
        hasUserDescription: !!userDescription,
      });
      searchTweets(committedQuery, committedExactMatch);
      isInitialSearchDone.current = true;
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

  // Separate tweets by type for proper TabsContent usage
  const tweetsByType = useMemo(() => {
    if (!results?.tweets) {
      return {
        all: [],
        posts: [],
        replies: [],
        quotes: [],
      };
    }

    const posts = results.tweets.filter(
      (tweet) => !tweet.in_reply_to_status_id_str && !tweet.quoted_status_id_str
    );
    const replies = results.tweets.filter(
      (tweet) => tweet.in_reply_to_status_id_str
    );
    const quotes = results.tweets.filter((tweet) => tweet.quoted_status_id_str);

    console.log("[SEARCH_PAGE] Categorized tweets:", {
      total: results.tweets.length,
      posts: posts.length,
      replies: replies.length,
      quotes: quotes.length,
    });

    return {
      all: results.tweets,
      posts,
      replies,
      quotes,
    };
  }, [results?.tweets]);

  // Commit draft state (search execution)
  const handleSearch = useCallback(
    (searchQuery: string, isExactMatch: boolean) => {
      console.log("[SEARCH_PAGE] Committing search:", {
        searchQuery: searchQuery.trim(),
        isExactMatch,
        hasUserDescription: !!userDescription,
      });

      isCommittingRef.current = true;
      setIsSearchMode(false);

      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      if (isExactMatch) {
        params.set("exact", "true");
      }

      router.push(`/search?${params.toString()}`);
    },
    [router, userDescription]
  );

  // Handle keyword selection from suggestions
  const handleKeywordClick = useCallback(
    (item: KeywordItem) => {
      console.log("[SEARCH_PAGE] Keyword selected from suggestions:", {
        keyword: item.keyword,
        hasUserDescription: !!userDescription,
      });

      // Record keyword usage for performance tracking
      recordKeywordUsage(item.id, item.keyword);

      isCommittingRef.current = true;
      setIsSearchMode(false);

      const params = new URLSearchParams();
      params.set("q", item.keyword);

      router.push(`/search?${params.toString()}`);
    },
    [router, userDescription, recordKeywordUsage]
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

  // Enhanced results display message
  const getResultsMessage = useCallback(() => {
    const currentResults = tweetsByType[getCurrentTab()];
    const meta = results?.meta;

    if (!meta) {
      return `${currentResults.length} results${committedQuery ? ` for "${committedQuery}"` : ""}`;
    }

    // Show filtering information if available
    if (meta.filteredCount !== undefined && meta.originalCount !== undefined) {
      const filtered = meta.originalCount - meta.filteredCount;
      return `${currentResults.length} results${committedQuery ? ` for "${committedQuery}"` : ""} (${filtered} filtered by AI)`;
    }

    return `${currentResults.length} results${committedQuery ? ` for "${committedQuery}"` : ""}`;
  }, [tweetsByType, getCurrentTab, results?.meta, committedQuery]);

  // Render tweet list component
  const renderTweetList = (tweets: Tweet[]) => (
    <div className="divide-y">
      {tweets.length > 0 ? (
        tweets.map((tweet) => (
          <div key={tweet.id_str} className="p-4">
            <TweetCard
              threadId={tweet.conversation_id_str || tweet.id_str || ""}
              staticTweet={tweet}
              size="sm"
              bordered={false}
              showFullContent={false}
              showThread={true}
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
      {results?.meta?.has_next_page && (
        <div className="p-4">
          <Button
            variant="default"
            size="xs"
            className="mx-auto block"
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full pt-4 md:h-full md:w-[514px]",
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

      {/* Enhanced debug info with LLM filtering details */}
      {process.env.NODE_ENV === "development" && (
        <div className="mx-4 mt-2 space-y-1 text-xs text-muted-foreground">
          <div>Committed: &quot;{committedQuery}&quot;</div>
          <div>Draft: &quot;{draftQuery}&quot;</div>
          <div>Mode: {isSearchMode ? "Search" : "Results"}</div>
          <div>Active Tab: {activeTab}</div>
          <div>
            User Description:{" "}
            {userDescription ? `${userDescription.length} chars` : "None"}
          </div>
          {results?.meta && (
            <div className="space-y-1 border-t pt-1">
              <div>Search Results Meta:</div>
              {results.meta.originalCount !== undefined && (
                <div>• Original: {results.meta.originalCount}</div>
              )}
              {results.meta.filteredCount !== undefined && (
                <div>• Filtered: {results.meta.filteredCount}</div>
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
              {results.meta.confidenceStats && (
                <div>
                  • Confidence: {results.meta.confidenceStats.min.toFixed(2)}-
                  {results.meta.confidenceStats.max.toFixed(2)} (avg:{" "}
                  {results.meta.confidenceStats.avg.toFixed(2)})
                </div>
              )}
              {results.meta.requestId && (
                <div>• Request ID: {results.meta.requestId}</div>
              )}
            </div>
          )}
          {error && <div className="text-destructive">Error: {error}</div>}
          {retryCount > 0 && <div>Retry count: {retryCount}</div>}
        </div>
      )}

      {/* Conditional content area */}
      <div className="mt-4">
        {isSearchMode ? (
          <SearchContent
            suggestions={keywordSuggestions}
            recentKeywords={recentKeywords}
            allKeywords={mockAllKeywords}
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

              {/* Enhanced results count with filtering info */}
              <div className="mx-4 mt-3 text-sm text-muted-foreground">
                {getResultsMessage()}
                {/* Show additional filtering info if available */}
                {results?.meta?.filterSummary && (
                  <div className="mt-1 text-xs">
                    {results.meta.filterSummary}
                  </div>
                )}
              </div>

              {/* Tab Contents */}
              <TabsContent value="all">
                {renderTweetList(tweetsByType.all)}
              </TabsContent>

              <TabsContent value="posts">
                {renderTweetList(tweetsByType.posts)}
              </TabsContent>

              <TabsContent value="replies">
                {renderTweetList(tweetsByType.replies)}
              </TabsContent>

              <TabsContent value="quotes">
                {renderTweetList(tweetsByType.quotes)}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
