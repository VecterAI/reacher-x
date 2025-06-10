// app/(webapp)/search/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { SearchContent } from "@/features/search/ui/components/SearchContent";
import { useFilter } from "@/features/search/contexts/FilterContext";
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
import { FilterAltIcon, SwapVertIcon } from "@/shared/ui/components/icons";
import { MockTweetCard } from "@/features/search/ui/components/MockTweetCard";

// Valid tab types
const validTabs = ["all", "posts", "replies", "quotes"] as const;
type ValidTab = (typeof validTabs)[number];

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

// Mock tweet data structure matching your types
const mockTweets = [
  {
    id: "1",
    id_str: "1234567890",
    threadId: "thread_1",
    user: {
      id: 123,
      id_str: "123",
      name: "Customer",
      screen_name: "Customer",
      location: "San Francisco, CA",
      url: "https://reacherx.com",
      description: "Building the future of customer acquisition",
      protected: false,
      verified: false,
      followers_count: 1250,
      friends_count: 300,
      listed_count: 15,
      favourites_count: 2340,
      statuses_count: 450,
      created_at: "2020-01-15T10:30:00.000Z",
      profile_image_url_https: "",
      can_dm: true,
    },
    text: "@Vecterz Find #unlimited customers for your products/services with the help of advance search of ReacherX. https://reacherx.com",
    created_at: "2025-06-01T14:03:44.000Z",
    reply_count: 12,
    retweet_count: 45,
    quote_count: 8,
    favorite_count: 156,
    views_count: 2340,
    type: "post" as const,
  },
  {
    id: "2",
    id_str: "1234567891",
    threadId: "thread_2",
    user: {
      id: 124,
      id_str: "124",
      name: "Web Developer",
      screen_name: "webdev_pro",
      location: "Remote",
      description: "Full-stack developer sharing web dev tips and tricks",
      protected: false,
      verified: true,
      followers_count: 5420,
      friends_count: 890,
      listed_count: 45,
      favourites_count: 12300,
      statuses_count: 2340,
      created_at: "2019-05-20T14:22:00.000Z",
      profile_image_url_https: "",
      can_dm: true,
    },
    text: "Struggling with web development? Here are 5 tips that changed my career: 1. Master the fundamentals 2. Build projects 3. Join communities 4. Never stop learning 5. Share your knowledge",
    created_at: "2025-06-01T13:30:22.000Z",
    reply_count: 34,
    retweet_count: 123,
    quote_count: 15,
    favorite_count: 567,
    views_count: 4520,
    type: "post" as const,
  },
  {
    id: "3",
    id_str: "1234567892",
    threadId: "thread_1",
    user: {
      id: 125,
      id_str: "125",
      name: "Sarah Chen",
      screen_name: "sarahc_dev",
      location: "New York, NY",
      description: "Product designer who codes",
      protected: false,
      verified: false,
      followers_count: 890,
      friends_count: 456,
      listed_count: 12,
      favourites_count: 3450,
      statuses_count: 678,
      created_at: "2021-03-10T09:15:00.000Z",
      profile_image_url_https: "",
      can_dm: true,
    },
    text: "@Customer This looks amazing! I've been looking for something exactly like this. How does the pricing work?",
    created_at: "2025-06-01T13:45:15.000Z",
    reply_count: 5,
    retweet_count: 2,
    quote_count: 0,
    favorite_count: 23,
    views_count: 145,
    type: "reply" as const,
    in_reply_to_status_id_str: "1234567890",
  },
  {
    id: "4",
    id_str: "1234567893",
    threadId: "thread_3",
    user: {
      id: 126,
      id_str: "126",
      name: "Tech Startup",
      screen_name: "techstartup2025",
      location: "Austin, TX",
      description: "Early stage startup building the future",
      protected: false,
      verified: true,
      followers_count: 2340,
      friends_count: 567,
      listed_count: 23,
      favourites_count: 5670,
      statuses_count: 890,
      created_at: "2022-08-01T16:45:00.000Z",
      profile_image_url_https: "",
      can_dm: true,
    },
    text: "Quote tweet: This is exactly what we need for our customer acquisition! https://twitter.com/Customer/status/1234567890",
    created_at: "2025-06-01T12:20:33.000Z",
    reply_count: 8,
    retweet_count: 34,
    quote_count: 3,
    favorite_count: 89,
    views_count: 890,
    type: "quote" as const,
    quoted_status_id_str: "1234567890",
  },
];

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openFilter, isFilterMode } = useFilter();

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

  // Tab state
  const [activeTab, setActiveTab] = useState<ValidTab>("all");

  // Force re-render key for SearchInput when reverting
  const [inputKey, setInputKey] = useState(0);

  // Track if we're in the middle of a commit operation to prevent revert
  const isCommittingRef = useRef(false);

  // Helper function to safely get the current tab
  const getCurrentTab = useCallback((): ValidTab => {
    return validTabs.includes(activeTab) ? activeTab : "all";
  }, [activeTab]);

  // Sync draft state with committed state when URL changes
  useEffect(() => {
    setDraftQuery(committedQuery);
    setDraftExactMatch(committedExactMatch);
    setIsSearchMode(false);
    setInputKey((prev) => prev + 1);
    isCommittingRef.current = false;
  }, [committedQuery, committedExactMatch]);

  // Revert draft state whenever search mode exits without commit
  useEffect(() => {
    if (!isSearchMode && !isCommittingRef.current) {
      if (
        draftQuery !== committedQuery ||
        draftExactMatch !== committedExactMatch
      ) {
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
    const posts = mockTweets.filter((tweet) => tweet.type === "post");
    const replies = mockTweets.filter((tweet) => tweet.type === "reply");
    const quotes = mockTweets.filter((tweet) => tweet.type === "quote");

    return {
      all: mockTweets,
      posts,
      replies,
      quotes,
    };
  }, []);

  // Commit draft state (search execution)
  const handleSearch = useCallback(
    (searchQuery: string, isExactMatch: boolean) => {
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
    [router]
  );

  // Handle keyword selection from suggestions
  const handleKeywordClick = useCallback(
    (item: KeywordItem) => {
      isCommittingRef.current = true;
      setIsSearchMode(false);

      const params = new URLSearchParams();
      params.set("q", item.keyword);

      router.push(`/search?${params.toString()}`);
    },
    [router]
  );

  // Update draft state
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

  // Handle input start
  const handleInputStart = useCallback(() => {
    setIsSearchMode(true);
  }, []);

  // Manual revert function
  const revertToCommittedState = useCallback(() => {
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

  // Render tweet list component
  const renderTweetList = (tweets: typeof mockTweets) => (
    <div className="divide-y">
      {tweets.length > 0 ? (
        tweets.map((tweet) => (
          <div key={tweet.id} className="p-4">
            <MockTweetCard tweet={tweet} />
          </div>
        ))
      ) : (
        <p className="text-lg font-medium text-muted-foreground">
          No results found
        </p>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="max-w-lg pt-4 md:border-r md:border-border"
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

      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mx-4 mt-2 text-xs text-muted-foreground">
          <div>Committed: &quot;{committedQuery}&quot;</div>
          <div>Draft: &quot;{draftQuery}&quot;</div>
          <div>Mode: {isSearchMode ? "Search" : "Results"}</div>
          <div>Active Tab: {activeTab}</div>
        </div>
      )}

      {/* Conditional content area */}
      <div className="mt-4">
        {isSearchMode ? (
          <SearchContent
            suggestions={mockSuggestions}
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
              onValueChange={(value) => setActiveTab(value as ValidTab)}
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
                    <FilterAltIcon className="fill-current" />
                    Filter
                  </Button>
                  <Button variant="outline" size="xsIcon">
                    <SwapVertIcon className="fill-current" />
                  </Button>
                </div>
              </div>

              {/* Results count */}
              <div className="mx-4 mt-3 text-sm text-muted-foreground">
                {tweetsByType[getCurrentTab()].length} results
                {committedQuery && ` for "${committedQuery}"`}
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
