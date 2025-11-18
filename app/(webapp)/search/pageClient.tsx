// app/(webapp)/search/pageClient.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import {
  useQueryState,
  useQueryStates,
  parseAsString,
  parseAsBoolean,
  parseAsStringEnum,
} from "nuqs";
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
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/components/ToggleGroup";
import {
  FilledTwitterIcon,
  FilledLinkedinIcon,
} from "@/shared/ui/components/icons";
import {
  FilledFilterAltIcon,
  FilterAltIcon,
  SwapVertIcon,
} from "@/shared/ui/components/icons";
import { Tweet as TweetComponent } from "@/features/webapp/ui/components/Tweet";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { useTwitterSearch } from "@/features/search/hooks/useTwitterSearch";
import { useLinkedInSearch } from "@/features/search/hooks/useLinkedInSearch";
import { useKeywordSuggestions } from "@/features/keywords/hooks/useKeywordSuggestions";
import { useOptimisticSearch } from "@/features/search/hooks/useOptimisticSearch";
import { useOptimisticLinkedInSearch } from "@/features/search/hooks/useOptimisticLinkedInSearch";
import { Tweet } from "@/features/threads/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";

// Keyword storage is handled via useKeywordSync
import { useKeywordSync } from "@/shared/hooks/useKeywordSync";
import { startSearch, endSearch } from "@/shared/lib/utils/performance";
import { cacheTweet } from "@/shared/lib/utils/tweetCache";
import { base64UrlEncodeUtf8 } from "@/shared/lib/utils/encoding";
import { cacheLinkedInPost } from "@/shared/lib/utils/linkedinPostCache";
import {
  LinkedInPostCard,
  LinkedInPostCardSkeleton,
} from "@/features/webapp/ui/components/LinkedInPostCard";
import type { LinkedInSortOption } from "@/features/search/ui/components/SortContentLinkedIn";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { logger } from "@/shared/lib/logger";
import { extractKeywordsFromQuery } from "@/shared/lib/utils/highlighting";
import { toast } from "sonner";

// Valid tab types (include 'reposts' for LinkedIn)
const validTabs = ["all", "posts", "replies", "quotes", "reposts"] as const;
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
  const [committedQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [committedExactMatch] = useQueryState(
    "exact",
    parseAsBoolean.withDefault(false)
  );
  const computedHighlightQueries = useMemo(() => {
    if (committedExactMatch) return [];
    return extractKeywordsFromQuery(committedQuery);
  }, [committedQuery, committedExactMatch]);

  // Track the keyword ID that led to the current search
  const [currentKeywordId] = useQueryState("keywordId", parseAsString);

  // Draft state (being edited)
  const [draftQuery, setDraftQuery] = useState(committedQuery);
  const [draftExactMatch, setDraftExactMatch] = useState(committedExactMatch);

  // UI state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [activePlatform, setActivePlatform] = useQueryState(
    "pf",
    parseAsStringEnum(["twitter", "linkedin"]).withDefault("twitter")
  );

  // Storage keys
  const SCROLL_STORAGE_KEY_BASE = "searchScrollPosition";

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringEnum([...validTabs]).withDefault("all")
  );

  const [, setGroupStates] = useQueryStates(
    {
      q: parseAsString,
      exact: parseAsBoolean,
      keywordId: parseAsString,
      tab: parseAsStringEnum([...validTabs]),
      pf: parseAsStringEnum(["twitter", "linkedin"]),
    },
    { history: "replace" }
  );

  // Persist and sync tab with URL + per-query session storage
  const updateActiveTab = useCallback(
    (tab: ValidTab) => {
      setActiveTab(tab);
      const q =
        (typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("q")
          : searchParams.get("q")) || "__noquery__";
      sessionStorage.setItem(`activeTab::${q}`, tab);
    },
    [setActiveTab, searchParams]
  );

  useEffect(() => {
    const hasTabParam = searchParams.has("tab");
    const q = searchParams.get("q") || "__noquery__";
    const pf = searchParams.get("pf");
    const isLinkedIn = pf === "linkedin";
    if (!hasTabParam) {
      const stored = sessionStorage.getItem(`activeTab::${q}`);
      if (stored) {
        if (isLinkedIn && stored === "reposts") {
          setActiveTab(stored as ValidTab);
        } else if (validTabs.includes(stored as ValidTab)) {
          setActiveTab(stored as ValidTab);
        }
      }
    }
  }, [searchParams, setActiveTab]);

  // (moved below hook declarations to avoid TDZ)

  // Helper function to safely get the current tab
  const getCurrentTab = useCallback((): ValidTab => {
    return validTabs.includes(activeTab) ? activeTab : "all";
  }, [activeTab]);

  // For URL persistence, allow LinkedIn-specific tab 'reposts'
  const getUrlTabParam = useCallback((): ValidTab => {
    if (activePlatform === "linkedin" && activeTab === "reposts") {
      return "reposts";
    }
    return getCurrentTab();
  }, [activePlatform, activeTab, getCurrentTab]);

  // Sanitize tab selection when switching platforms
  useEffect(() => {
    if (activePlatform === "twitter" && activeTab === "reposts") {
      setActiveTab("all");
      return;
    }
    if (
      activePlatform === "linkedin" &&
      (activeTab === "replies" || activeTab === "quotes")
    ) {
      setActiveTab("all");
    }
  }, [activePlatform, activeTab, setActiveTab]);

  const getScrollKey = useCallback(() => {
    const q = committedQuery || "__noquery__";
    const tab = validTabs.includes(activeTab) ? activeTab : "all";
    return `${SCROLL_STORAGE_KEY_BASE}::${q}::${tab}`;
  }, [committedQuery, activeTab]);

  // Avoid unnecessary forced re-keys; keep a stable key unless committed values actually change
  const [inputKey, setInputKey] = useState(0);

  // Track if we're in the middle of a commit operation to prevent revert
  const isCommittingRef = useRef(false);

  // Track whether the first commit for current committed values has started
  const hasInitialCommitStartedRef = useRef(false);

  // Guard to avoid repeated auto-chaining on the same cursor
  const lastAutoChainedCursorRef = useRef<string | null>(null);
  const autoChainingAttemptsRef = useRef<number>(0);

  // User description sourced from unified keywords hook

  // Removed local merge progress bar (single header bar UX)

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
    // Chunked filtering methods
    hasResolvedChunks,
    getResolvedChunkTweetCount,
    mergeResolvedChunks,
    chunkProgress,
  } = useTwitterSearch();

  // LinkedIn search hook (chunked)
  const {
    search: searchLinkedIn,
    results: liResults,
    loading: liLoading,
    error: liError,
    clear: clearLinkedIn,
    hasResolvedChunks: liHasResolvedChunks,
    getResolvedChunkPostCount: liGetResolvedCount,
    mergeResolvedChunks: liMergeResolvedChunks,
    chunkProgress: liChunkProgress,
  } = useLinkedInSearch();

  const searchTweetsRef = useRef(searchTweets);
  useEffect(() => {
    searchTweetsRef.current = searchTweets;
  }, [searchTweets]);
  const searchLinkedInRef = useRef(searchLinkedIn);
  useEffect(() => {
    searchLinkedInRef.current = searchLinkedIn;
  }, [searchLinkedIn]);
  const clearResultsRef = useRef(clearResults);
  useEffect(() => {
    clearResultsRef.current = clearResults;
  }, [clearResults]);
  const clearLinkedInRef = useRef(clearLinkedIn);
  useEffect(() => {
    clearLinkedInRef.current = clearLinkedIn;
  }, [clearLinkedIn]);

  // Show a friendly toast when Twitter isn’t available
  useEffect(() => {
    if (error) {
      toast.error("Error!", {
        description:
          "Twitter search isn't available right now. Please try again later.",
      });
    }
  }, [error]);

  // Show a friendly toast when LinkedIn isn’t available
  useEffect(() => {
    if (liError) {
      toast.error("Error!", {
        description:
          "LinkedIn search isn't available right now. Please try again later.",
      });
    }
  }, [liError]);

  // LinkedIn client-side sort state (persisted per query via sessionStorage)
  const [liSort, setLiSort] = useState<LinkedInSortOption>("newest_first");
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`liSort::${committedQuery}`);
      if (stored) setLiSort(stored as LinkedInSortOption);
      else setLiSort("newest_first");
    } catch {
      setLiSort("newest_first");
    }
  }, [committedQuery]);
  useEffect(() => {
    const handler = () => {
      try {
        const stored = sessionStorage.getItem(`liSort::${committedQuery}`);
        if (stored) setLiSort(stored as LinkedInSortOption);
      } catch {}
    };
    window.addEventListener("reacherx:liSortChanged", handler as EventListener);
    return () =>
      window.removeEventListener(
        "reacherx:liSortChanged",
        handler as EventListener
      );
  }, [committedQuery]);

  // Switch to the first platform that returns results for the query
  const platformAutoSelectedRef = useRef(false);
  // Reset auto-select when query changes
  useEffect(() => {
    platformAutoSelectedRef.current = false;
  }, [committedQuery]);
  useEffect(() => {
    const pfParam = searchParams.get("pf");
    const hasExplicitPf = pfParam === "twitter" || pfParam === "linkedin";
    if (hasExplicitPf) {
      platformAutoSelectedRef.current = true;
      return;
    }
    if (!committedQuery || platformAutoSelectedRef.current) return;
    const twCount = results?.tweets?.length || 0;
    const liCount = liResults?.posts?.length || 0;
    if (twCount > 0 || liCount > 0) {
      const nextPf: "twitter" | "linkedin" =
        twCount > 0 ? "twitter" : "linkedin";
      platformAutoSelectedRef.current = true;
      setActivePlatform(nextPf);
    }
  }, [
    results?.tweets?.length,
    liResults?.posts?.length,
    committedQuery,
    searchParams,
    setActivePlatform,
  ]);

  // Filter context
  const { filterTweets, loadFiltersForKeyword } = useFilter();

  // Sort context
  const { sortTweets: sortTweetsForContext, loadSortForKeyword } = useSort();

  // Keyword suggestions hook
  const {
    suggestions: keywordSuggestions,
    loading: suggestionsLoading,
    isHydrating: suggestionsHydrating,
    recordKeywordUsage,
    userDescription: unifiedUserDescription,
  } = useKeywordSuggestions();

  // Optimistic search hook
  const { getOptimisticResult, clearOptimisticCache } = useOptimisticSearch();
  const { getOptimisticLinkedInResult } = useOptimisticLinkedInSearch();

  // Add safeguards against infinite loops
  const isInitialSearchDone = useRef(false);
  const lastCommittedQuery = useRef<string>("");
  const lastCommittedExactMatch = useRef<boolean>(false);

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

  // Publish latest results to global for live filter suggestions regardless of list visibility
  // Watch the tweets array reference so this fires whenever results update
  useEffect(() => {
    if (results?.tweets) {
      try {
        (
          globalThis as unknown as {
            __reacherx_current_tweets__?: Tweet[];
          }
        ).__reacherx_current_tweets__ = results.tweets;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("reacherx:resultsUpdated"));
        }
      } catch {}
    }
  }, [results?.tweets]);

  // Restore scroll position for the ScrollArea viewport
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    if (!viewport) return;
    const key = getScrollKey();
    const saved = sessionStorage.getItem(key);
    if (!saved) return;
    const pos = parseInt(saved, 10);
    if (!Number.isNaN(pos)) {
      const t = setTimeout(() => {
        viewport.scrollTop = pos;
      }, 50);
      return () => clearTimeout(t);
    }
  }, [getScrollKey, activeTab, results]);

  // Save scroll on unload/navigation
  useEffect(() => {
    const save = () => {
      const viewport = scrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement | null;
      if (!viewport) return;
      const key = getScrollKey();
      sessionStorage.setItem(key, String(viewport.scrollTop));
    };
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, [getScrollKey]);
  // Sync draft state with committed state when URL changes
  useEffect(() => {
    logger.info("[SEARCH_PAGE] URL sync effect triggered:", {
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
      logger.info(
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
    hasInitialCommitStartedRef.current = false;

    // Only trigger search if we have a query, and prevent duplicate initial searches
    if (committedQuery && committedQuery.trim()) {
      logger.info("[SEARCH_PAGE] Triggering search for:", {
        query: committedQuery,
        exactMatch: committedExactMatch,
        hasUserDescription: !!unifiedUserDescription,
      });

      // Start performance monitoring
      startSearch(committedQuery);

      // Check for optimistic results first
      const optimisticResult = getOptimisticResult(
        committedQuery,
        committedExactMatch
      );
      if (optimisticResult) {
        logger.info("[SEARCH_PAGE] Using optimistic result:", {
          tweetCount: optimisticResult.tweets.length,
        });
        // Clear optimistic cache after using it
        clearOptimisticCache();
        // End performance monitoring with optimistic results
        endSearch(committedQuery, optimisticResult.tweets.length);
        // Continue with normal search flow
      }

      const optimisticLinkedIn = getOptimisticLinkedInResult(
        committedQuery,
        committedExactMatch
      );
      if (optimisticLinkedIn) {
        logger.info("[SEARCH_PAGE] Using optimistic LinkedIn result:", {
          postCount: optimisticLinkedIn.posts.length,
        });
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

          await setGroupStates(
            {
              q: committedQuery,
              exact: committedExactMatch,
              keywordId,
              tab: getUrlTabParam(),
              pf: activePlatform,
            },
            { history: "replace" }
          );

          // Mark that the initial commit has started
          hasInitialCommitStartedRef.current = true;

          searchTweetsRef.current(
            committedQuery,
            committedExactMatch,
            false,
            undefined,
            keywordId // use as keywordKey
          );
          // Launch LinkedIn in parallel
          searchLinkedInRef.current(
            committedQuery,
            committedExactMatch,
            undefined,
            keywordId ? `${keywordId}|li` : undefined
          );
          isInitialSearchDone.current = true;
        } catch (err) {
          logger.error("[SEARCH_PAGE] Failed to commit search:", err);
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    } else {
      logger.info("[SEARCH_PAGE] Clearing results - no query");
      clearResultsRef.current();
      clearLinkedInRef.current();
      isInitialSearchDone.current = false;
    }
  }, [
    committedQuery,
    committedExactMatch,
    unifiedUserDescription,
    getOptimisticResult,
    clearOptimisticCache,
    getOptimisticLinkedInResult,
    loadFiltersForKeyword,
    loadSortForKeyword,
    addOrUseKeyword,
    currentKeywordId,
    getUrlTabParam,
    activePlatform,
    setGroupStates,
  ]);

  // Handle load more - intelligently decides between showing cached chunks or fetching next page
  const handleLoadMore = useCallback(() => {
    if (activePlatform === "twitter") {
      if (hasResolvedChunks()) {
        const cachedTweetCount = getResolvedChunkTweetCount();
        logger.info("[SEARCH_PAGE] Merging cached chunks (twitter):", {
          count: cachedTweetCount,
        });
        mergeResolvedChunks();
        return;
      }
      if (results?.meta?.next_cursor && committedQuery && !loading) {
        logger.info(
          "[SEARCH_PAGE] Loading more results with cursor (twitter):",
          {
            cursor: results.meta.next_cursor,
            currentResultsCount: results.tweets.length,
          }
        );
        searchTweets(
          committedQuery,
          committedExactMatch,
          false,
          results.meta.next_cursor,
          currentKeywordId || undefined
        );
      }
      return;
    }
    // LinkedIn branch
    if (liHasResolvedChunks()) {
      const count = liGetResolvedCount();
      logger.info("[SEARCH_PAGE] Merging cached chunks (linkedin):", { count });
      liMergeResolvedChunks();
      return;
    }
    if (
      liResults?.meta?.next_cursor !== undefined &&
      committedQuery &&
      !liLoading
    ) {
      logger.info(
        "[SEARCH_PAGE] Loading more results with cursor (linkedin):",
        {
          cursor: liResults.meta.next_cursor,
          currentResultsCount: liResults.posts.length,
        }
      );
      searchLinkedIn(
        committedQuery,
        committedExactMatch,
        liResults.meta.next_cursor,
        currentKeywordId ? `${currentKeywordId}|li` : undefined
      );
    }
  }, [
    activePlatform,
    // Twitter deps
    hasResolvedChunks,
    getResolvedChunkTweetCount,
    mergeResolvedChunks,
    results?.meta?.next_cursor,
    results?.tweets?.length,
    loading,
    searchTweets,
    // LinkedIn deps
    liHasResolvedChunks,
    liGetResolvedCount,
    liMergeResolvedChunks,
    liResults?.meta?.next_cursor,
    liResults?.posts?.length,
    liLoading,
    searchLinkedIn,
    // shared
    committedQuery,
    committedExactMatch,
    currentKeywordId,
  ]);

  // Auto-fetch next page only after chunk set completes and server shows zero kept
  useEffect(() => {
    const nextCursor = results?.meta?.next_cursor;
    const hasZeroServerKept =
      chunkProgress.isComplete && chunkProgress.withResults === 0;
    if (
      autoAdvanceState === "idle" &&
      hasZeroServerKept &&
      !!nextCursor &&
      !!committedQuery &&
      !loading
    ) {
      // Prevent double-triggering for the same cursor
      if (lastAutoChainedCursorRef.current === nextCursor) return;
      const hasMorePages = !!results?.meta?.has_next_page;
      const cap = autoAdvanceCap;
      if (!hasMorePages || autoChainingAttemptsRef.current >= cap) {
        return;
      }
      autoChiningLog(nextCursor, autoChainingAttemptsRef.current + 1, cap);
      lastAutoChainedCursorRef.current = nextCursor;
      autoChainingAttemptsRef.current += 1;

      logger.info(
        "[SEARCH_PAGE] Auto-fetching next page after empty chunk set",
        {
          cursor: nextCursor,
        }
      );
      searchTweets(
        committedQuery,
        committedExactMatch,
        false,
        nextCursor,
        currentKeywordId || undefined
      );
    }
  }, [
    autoAdvanceState,
    chunkProgress.isComplete,
    chunkProgress.withResults,
    results?.meta?.next_cursor,
    committedQuery,
    committedExactMatch,
    loading,
    currentKeywordId,
    searchTweets,
    results?.meta?.has_next_page,
    autoAdvanceCap,
  ]);

  useEffect(() => {
    autoChainingAttemptsRef.current = 0;
    lastAutoChainedCursorRef.current = null;
  }, [committedQuery, committedExactMatch]);

  const lastAutoChainedCursorRefLinkedIn = useRef<number | null>(null);
  const autoChainingAttemptsRefLinkedIn = useRef<number>(0);
  useEffect(() => {
    autoChainingAttemptsRefLinkedIn.current = 0;
    lastAutoChainedCursorRefLinkedIn.current = null;
  }, [committedQuery, committedExactMatch]);

  useEffect(() => {
    const nextCursor = liResults?.meta?.next_cursor;
    const hasZeroServerKept =
      liChunkProgress.isComplete && liChunkProgress.withResults === 0;
    if (
      hasZeroServerKept &&
      nextCursor !== undefined &&
      !!committedQuery &&
      !liLoading
    ) {
      if (lastAutoChainedCursorRefLinkedIn.current === nextCursor) return;
      const hasMorePages = !!liResults?.meta?.has_next_page;
      const cap = autoAdvanceCap;
      if (!hasMorePages || autoChainingAttemptsRefLinkedIn.current >= cap) {
        return;
      }
      lastAutoChainedCursorRefLinkedIn.current = nextCursor;
      autoChainingAttemptsRefLinkedIn.current += 1;
      searchLinkedIn(
        committedQuery,
        committedExactMatch,
        nextCursor,
        currentKeywordId ? `${currentKeywordId}|li` : undefined
      );
    }
  }, [
    liChunkProgress.isComplete,
    liChunkProgress.withResults,
    liResults?.meta?.next_cursor,
    committedQuery,
    committedExactMatch,
    liLoading,
    liResults?.meta?.has_next_page,
    autoAdvanceCap,
    searchLinkedIn,
    currentKeywordId,
  ]);

  function autoChiningLog(cursor: string, attempt: number, cap: number) {
    try {
      logger.info("[SEARCH_PAGE] Auto-chaining next page", {
        cursor,
        attempt,
        cap,
      });
    } catch {}
  }

  // Revert draft state whenever search mode exits without commit
  useEffect(() => {
    if (!isSearchMode && !isCommittingRef.current) {
      if (
        draftQuery !== committedQuery ||
        draftExactMatch !== committedExactMatch
      ) {
        logger.info(
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
        reposts: [],
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

    logger.info("[SEARCH_PAGE] Filtered, sorted, and categorized tweets:", {
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
      // For cross-platform safety, alias 'reposts' to 'posts' in Twitter context
      reposts: posts,
      filterSummary,
    };
  }, [results?.tweets, filterTweets, sortTweetsForContext]);

  // Removed user-facing per-tab results header; keep info in dev Alert only

  // Auto-merge cached chunks once when timeline is empty, otherwise rely on button
  useEffect(() => {
    const currentTabResults = filteredResults[getCurrentTab()];
    if (currentTabResults.length === 0 && hasResolvedChunks()) {
      logger.info(
        "[SEARCH_PAGE] Auto-merging cached chunks into empty timeline"
      );
      mergeResolvedChunks();
    }
  }, [filteredResults, getCurrentTab, hasResolvedChunks, mergeResolvedChunks]);

  // LinkedIn: auto-merge when empty to avoid long skeletons
  useEffect(() => {
    if (activePlatform !== "linkedin") return;
    const hasAnyLinkedIn = (liResults?.posts?.length || 0) > 0;
    if (!hasAnyLinkedIn && liHasResolvedChunks()) {
      logger.info(
        "[SEARCH_PAGE] Auto-merging cached chunks (linkedin) into empty timeline"
      );
      liMergeResolvedChunks();
    }
  }, [
    activePlatform,
    liResults?.posts?.length,
    liHasResolvedChunks,
    liMergeResolvedChunks,
  ]);

  // Enhanced load more logic (Twitter): show when cached resolved chunks exist or more pages
  const shouldShowLoadMoreTwitter = useMemo(() => {
    // If there are resolved chunks waiting, always show the button
    if (hasResolvedChunks()) {
      return true;
    }

    // Otherwise, show only if we have results and more pages
    if (!results?.meta?.has_next_page) {
      return false;
    }
    const currentTabResults = filteredResults[getCurrentTab()];
    return currentTabResults.length > 0;
  }, [
    hasResolvedChunks,
    results?.meta?.has_next_page,
    filteredResults,
    getCurrentTab,
  ]);

  // Enhanced load more logic (LinkedIn): platform-specific state
  const shouldShowLoadMoreLinkedIn = useMemo(() => {
    // Do not show Load more when an error is present
    if (liError) return false;
    if (liHasResolvedChunks()) return true;
    if (!liResults?.meta?.has_next_page) return false;
    return (liResults?.posts?.length || 0) > 0;
  }, [
    liHasResolvedChunks,
    liResults?.meta?.has_next_page,
    liResults?.posts?.length,
    liError,
  ]);

  // LinkedIn split for tabs (All | Posts | Reposts)
  const linkedInSplit = useMemo(() => {
    const unsorted = (liResults?.posts || []) as UnifiedPost[];
    const sorted = [...unsorted].sort((a, b) => {
      const aR = a.metrics?.reactions ?? 0;
      const bR = b.metrics?.reactions ?? 0;
      const aC = a.metrics?.comments ?? 0;
      const bC = b.metrics?.comments ?? 0;
      const aP = a.metrics?.reposts ?? 0;
      const bP = b.metrics?.reposts ?? 0;
      switch (liSort) {
        case "oldest_first":
          return (a.createdAt || 0) - (b.createdAt || 0);
        case "most_reacted_first":
          return bR - aR || (b.createdAt || 0) - (a.createdAt || 0);
        case "least_reacted_first":
          return aR - bR || (a.createdAt || 0) - (b.createdAt || 0);
        case "most_commented_first":
          return bC - aC || (b.createdAt || 0) - (a.createdAt || 0);
        case "least_commented_first":
          return aC - bC || (a.createdAt || 0) - (b.createdAt || 0);
        case "most_reposted_first":
          return bP - aP || (b.createdAt || 0) - (a.createdAt || 0);
        case "least_reposted_first":
          return aP - bP || (a.createdAt || 0) - (b.createdAt || 0);
        case "newest_first":
        default:
          return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });
    const originals = sorted.filter((post) => {
      const raw = post?.raw as { resharedPostContent?: unknown } | undefined;
      return !raw?.resharedPostContent;
    });
    const reshares = sorted.filter((post) => {
      const raw = post?.raw as { resharedPostContent?: unknown } | undefined;
      return !!raw?.resharedPostContent;
    });
    return {
      all: sorted,
      posts: originals,
      reposts: reshares,
    };
  }, [liResults?.posts, liSort]);

  // Render tweet list component
  const renderTweetList = (tweets: Tweet[], tab: ValidTab) => {
    const isActiveTab = getCurrentTab() === tab;
    return (
      <div className="divide-y">
        {loading && tweets.length === 0 && isActiveTab ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-2">
                <article
                  className="group flex w-full cursor-pointer gap-2 overflow-hidden"
                  aria-label="Loading tweet"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="mt-1 h-8 w-8 rounded-full bg-muted" />
                    {/* No vertical separator in search skeletons */}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <header className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <Skeleton className="h-4 w-6" />
                    </header>
                    <div className="my-2 space-y-2">
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-4/6" />
                      <Skeleton className="h-4 w-3/6" />
                    </div>
                    {i === 2 && (
                      <div className="mt-2">
                        <Skeleton className="h-6 w-24" />
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-4">
                      <Skeleton className="h-6 w-12" />
                      <Skeleton className="h-6 w-12" />
                      <Skeleton className="h-6 w-12" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        ) : tweets.length > 0 ? (
          tweets.map((tweet, idx) => (
            <div
              key={
                tweet.id_str ||
                tweet.id ||
                `${tweet.user?.screen_name ?? "u"}-${tweet.tweet_created_at ?? "t"}-${idx}`
              }
              className="px-4 py-2"
              onClick={(e) => {
                const target = e.target as HTMLElement | null;
                // Ignore non-primary clicks, modified clicks, or if a text selection exists
                const hasSelection =
                  typeof window !== "undefined" &&
                  !!window.getSelection()?.toString();
                if (
                  e.defaultPrevented ||
                  e.button !== 0 ||
                  e.metaKey ||
                  e.ctrlKey ||
                  e.shiftKey ||
                  e.altKey ||
                  hasSelection ||
                  e.detail > 1
                ) {
                  return;
                }
                // Ignore clicks inside interactive elements
                const interactive = target?.closest(
                  "a,button,[role=button],img,video,media-chrome,input,textarea,iframe,[contenteditable=true]"
                );
                if (interactive) {
                  return;
                }
                try {
                  // Cache for instant hydration on detail page
                  cacheTweet(tweet);
                } catch {}

                // Expose current page tweets globally for filter suggestions (best-effort)
                try {
                  (
                    globalThis as unknown as {
                      __reacherx_current_tweets__?: Tweet[];
                    }
                  ).__reacherx_current_tweets__ = tweets;
                } catch {}

                // Pack minimal tweet payload in URL param (base64) to avoid effects on target page
                let packed = "";
                try {
                  packed = base64UrlEncodeUtf8(JSON.stringify(tweet));
                } catch {}
                const id = tweet.id_str || String(tweet.id ?? "");
                const params = new URLSearchParams();
                if (packed) params.set("t", packed);
                if (currentKeywordId) params.set("keywordId", currentKeywordId);
                if (committedQuery) params.set("q", committedQuery);
                params.set("exact", committedExactMatch ? "true" : "false");
                params.set("tab", getUrlTabParam());
                // Save current scroll immediately before navigation
                const viewport = scrollAreaRef.current?.querySelector(
                  "[data-radix-scroll-area-viewport]"
                ) as HTMLElement | null;
                if (viewport) {
                  const key = getScrollKey();
                  sessionStorage.setItem(key, String(viewport.scrollTop));
                }
                router.push(`/post/${id}?${params.toString()}`, {
                  scroll: false,
                });
              }}
            >
              <TweetComponent
                tweet={tweet}
                characterLimit={280}
                showFullContent={false}
                showThread={true}
                highlightQueries={
                  committedExactMatch
                    ? [committedQuery]
                    : computedHighlightQueries
                }
                votingContext={
                  currentKeywordId && committedQuery
                    ? {
                        keywordId: currentKeywordId,
                        searchQuery: committedQuery,
                        exact: committedExactMatch,
                      }
                    : undefined
                }
              />
            </div>
          ))
        ) : (
          // Empty state (only when not loading)
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No results found
            </p>
            {chunkProgress.isComplete &&
              chunkProgress.withResults === 0 &&
              results?.meta?.originalCount &&
              results.meta.originalCount > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  All {results.meta.originalCount} posts were filtered out
                </p>
              )}
          </div>
        )}
        {shouldShowLoadMoreTwitter && (
          <div className="space-y-2 p-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
                        : hasResolvedChunks()
                          ? `Load more (${getResolvedChunkTweetCount()} new)`
                          : "Load more"}
                  </Button>
                </TooltipTrigger>
                {hasResolvedChunks() && (
                  <TooltipContent>
                    Feed will refresh with new results. Nothing will disappear.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
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
  };

  // Render LinkedIn list
  const renderLinkedInList = (posts: UnifiedPost[]) => {
    return (
      <div className="divide-y">
        {posts.length === 0 && liLoading && !liError ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-2">
                <LinkedInPostCardSkeleton />
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          posts.map((post, idx) => (
            <div key={`${post.id}-${idx}`} className="px-4 py-2">
              <LinkedInPostCard
                post={post}
                highlightQueries={
                  committedExactMatch
                    ? [committedQuery]
                    : computedHighlightQueries
                }
                onClick={() => {
                  try {
                    cacheLinkedInPost(post.id, post);
                  } catch {}
                  let packed = "";
                  try {
                    packed = base64UrlEncodeUtf8(JSON.stringify(post));
                  } catch {}
                  const params = new URLSearchParams();
                  if (packed) {
                    params.set("t", packed);
                  }
                  if (currentKeywordId) {
                    params.set("keywordId", currentKeywordId);
                  }
                  if (committedQuery) {
                    params.set("q", committedQuery);
                  }
                  params.set("exact", committedExactMatch ? "true" : "false");
                  params.set("tab", getUrlTabParam());
                  const viewport = scrollAreaRef.current?.querySelector(
                    "[data-radix-scroll-area-viewport]"
                  ) as HTMLElement | null;
                  if (viewport) {
                    const key = getScrollKey();
                    sessionStorage.setItem(key, String(viewport.scrollTop));
                  }
                  const url = `/post/linkedin/${post.id}?${params.toString()}`;
                  router.push(url, { scroll: false });
                }}
              />
            </div>
          ))
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No results found
            </p>
          </div>
        )}
        {shouldShowLoadMoreLinkedIn && (
          <div className="space-y-2 p-4">
            <Button
              variant="default"
              size="xs"
              className="mx-auto block"
              onClick={handleLoadMore}
              disabled={liLoading || !!liError}
            >
              {liLoading
                ? "Loading..."
                : liHasResolvedChunks()
                  ? `Load more (${liGetResolvedCount()} new)`
                  : "Load more"}
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Commit draft state (search execution)
  const handleSearch = useCallback(
    async (searchQuery: string, isExactMatch: boolean) => {
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery) return;

      logger.info("[SEARCH_PAGE] Committing search:", {
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

      await setGroupStates(
        {
          q: trimmedQuery,
          exact: isExactMatch,
          keywordId,
          tab: getUrlTabParam(),
          pf: activePlatform,
        },
        { history: "push" }
      );
    },
    [addOrUseKeyword, getUrlTabParam, activePlatform, setGroupStates]
  );

  // Handle keyword selection from suggestions
  const handleKeywordClick = useCallback(
    async (item: KeywordItem) => {
      logger.info("[SEARCH_PAGE] Keyword selected from suggestions:", {
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

      await setGroupStates(
        {
          q: item.keyword,
          exact: !!item.exactMatch,
          keywordId,
          tab: getUrlTabParam(),
          pf: activePlatform,
        },
        { history: "push" }
      );
    },
    [
      recordKeywordUsage,
      addOrUseKeyword,
      getUrlTabParam,
      activePlatform,
      setGroupStates,
    ]
  );

  // Update draft state
  const handleQueryChange = useCallback((newQuery: string) => {
    logger.info("[SEARCH_PAGE] Draft query updated:", { newQuery });
    setDraftQuery(newQuery);
  }, []);

  // Handle search input focus
  const handleSearchFocus = useCallback(() => {
    logger.info("[SEARCH_PAGE] Search input focused - entering search mode");
    setIsSearchMode(true);
  }, []);

  // Handle search input blur with delay for click events
  const handleSearchBlur = useCallback(() => {
    setTimeout(() => {
      if (
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        logger.info("[SEARCH_PAGE] Search input blurred - exiting search mode");
        setIsSearchMode(false);
      }
    }, 150);
  }, []);

  // Handle input start
  const handleInputStart = useCallback(() => {
    logger.info("[SEARCH_PAGE] User started typing - entering search mode");
    setIsSearchMode(true);
  }, []);

  // Manual revert function
  const revertToCommittedState = useCallback(() => {
    logger.info("[SEARCH_PAGE] Manual revert to committed state triggered");
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
        logger.info(
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
        "flex h-full min-h-0 w-full max-w-lg flex-col",
        // Conditionally apply the border only when neither panel is open
        !isFilterMode && !isSortMode && "md:border-r md:border-border"
      )}
    >
      {/* Search header */}
      <header className="sticky z-10 bg-background p-4 pb-1">
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
        {/* Platform toggles row */}
        <div className="mt-4 flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="xs"
            value={activePlatform}
            onValueChange={(val) => {
              if (!val) return;
              const nextPlatform = val as "twitter" | "linkedin";
              platformAutoSelectedRef.current = true;
              setActivePlatform(nextPlatform);
            }}
            aria-label="Select platform"
          >
            {(() => {
              const twCount = results?.tweets?.length || 0;
              const isTwLoading = !!committedQuery && !!loading && !error;
              const showTwSkeletonInline = isTwLoading && twCount === 0;
              return (
                <ToggleGroupItem
                  value="twitter"
                  aria-label="Twitter"
                  title="Twitter"
                  className={cn("gap-1", isTwLoading && "opacity-70")}
                  aria-busy={isTwLoading}
                >
                  <FilledTwitterIcon />
                  {showTwSkeletonInline ? (
                    <AsciiSpinnerText
                      text=""
                      className="ml-1 text-xs text-muted-foreground"
                    />
                  ) : (
                    <AnimatedNumber
                      value={twCount}
                      key={
                        activePlatform === "twitter"
                          ? "twitter-active"
                          : "twitter"
                      }
                      animateOnMount={activePlatform === "twitter"}
                      className="text-xs font-medium leading-none"
                    />
                  )}
                </ToggleGroupItem>
              );
            })()}
            {(() => {
              const liCount = liResults?.posts?.length || 0;
              const isLiLoading = !!committedQuery && !!liLoading && !liError;
              const showLiSkeletonInline = isLiLoading && liCount === 0;
              return (
                <ToggleGroupItem
                  value="linkedin"
                  aria-label="LinkedIn"
                  title="LinkedIn"
                  className={cn("gap-1", isLiLoading && "opacity-70")}
                  aria-busy={isLiLoading}
                >
                  <FilledLinkedinIcon />
                  {showLiSkeletonInline ? (
                    <AsciiSpinnerText
                      text=""
                      className="ml-1 text-xs text-muted-foreground"
                    />
                  ) : (
                    <AnimatedNumber
                      value={liCount}
                      key={
                        activePlatform === "linkedin"
                          ? "linkedin-active"
                          : "linkedin"
                      }
                      animateOnMount={activePlatform === "linkedin"}
                      className="text-xs font-medium leading-none"
                    />
                  )}
                </ToggleGroupItem>
              );
            })()}
          </ToggleGroup>
        </div>
      </header>

      {/* Comprehensive Search Debug Information */}
      {process.env.NODE_ENV === "development" && (
        <Alert className="mx-4 mt-2 max-h-24 w-auto overflow-y-auto">
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
                <div>Active Platform: {activePlatform}</div>
                <div>Keyword ID: {currentKeywordId || "None"}</div>
              </div>

              {/* User Context */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-green-600">
                  User Context:
                </div>
                <div>
                  <span>User Description:</span>
                  <span className="ml-1">
                    {unifiedUserDescription
                      ? `${unifiedUserDescription.length} chars`
                      : "None"}
                  </span>
                </div>
              </div>

              {/* Search State */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-purple-600">
                  Search State (Twitter):
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

              {/* Chunked Filtering State */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-cyan-600">
                  Chunked Filtering (Twitter):
                </div>
                <div>
                  Has Cached Chunks: {hasResolvedChunks() ? "Yes" : "No"}
                </div>
                <div>Cached Tweet Count: {getResolvedChunkTweetCount()}</div>
                <div>
                  Chunk Progress: {chunkProgress.resolved}/{chunkProgress.total}
                </div>
                <div>Chunks with Results: {chunkProgress.withResults}</div>
                {/* Merging progress removed - single header progress bar UX */}
              </div>

              {/* LinkedIn State */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-emerald-600">
                  Search State (LinkedIn):
                </div>
                <div>Loading: {liLoading ? "Yes" : "No"}</div>
                <div>Has Results: {liResults ? "Yes" : "No"}</div>
                <div>Results Count: {liResults?.posts?.length || 0}</div>
                <div className="font-semibold text-cyan-600">
                  Chunked Filtering (LinkedIn):
                </div>
                <div>
                  Has Cached Chunks: {liHasResolvedChunks() ? "Yes" : "No"}
                </div>
                <div>Cached Post Count: {liGetResolvedCount()}</div>
                <div>
                  Chunk Progress: {liChunkProgress.resolved}/
                  {liChunkProgress.total}
                </div>
                <div>Chunks with Results: {liChunkProgress.withResults}</div>
              </div>

              {/* Error State */}
              {error && (
                <div className="space-y-1 border-t pt-1">
                  <div className="font-semibold text-red-600">Error State:</div>
                  <div className="text-destructive">Error: {error}</div>
                  <div>Error Time: {new Date().toLocaleTimeString()}</div>
                </div>
              )}
              {liError && (
                <div className="space-y-1 border-t pt-1">
                  <div className="font-semibold text-red-600">
                    LinkedIn Error:
                  </div>
                  <div className="text-destructive">Error: {liError}</div>
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
                  <div>• Kept: {results.tweets.length}</div>
                  {results.meta.originalCount !== undefined && (
                    <div>
                      • Filtered out:{" "}
                      {Math.max(
                        0,
                        (results.meta.originalCount || 0) -
                          results.tweets.length
                      )}
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
                  {/* Server truth for kept results across chunks */}
                  <div>• Server kept chunks: {chunkProgress.withResults}</div>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Conditional content area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {/* Scoped fix: neutralize Radix ScrollArea internal wrapper on /search */}
        <ScrollArea
          ref={scrollAreaRef}
          className="search-scrollarea h-full overscroll-contain"
          onScrollCapture={() => {
            const viewport = scrollAreaRef.current?.querySelector(
              "[data-radix-scroll-area-viewport]"
            ) as HTMLElement | null;
            if (!viewport) return;
            const key = getScrollKey();
            sessionStorage.setItem(key, String(viewport.scrollTop));
          }}
        >
          {isSearchMode ? (
            <SearchContent
              suggestions={keywordSuggestions}
              currentQuery={draftQuery}
              onKeywordClick={(item) => {
                if (item.kind === "suggestion") {
                  handleKeywordClick(item);
                }
              }}
              loading={suggestionsLoading || !!suggestionsHydrating}
              className={cn("duration-200 animate-in fade-in-50", "space-y-2")}
            />
          ) : (
            <div
              className={cn("duration-200 animate-in fade-in-50")}
              role="main"
              aria-label="Search results"
            >
              {activePlatform === "twitter" ? (
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => {
                    logger.info("[SEARCH_PAGE] Tab changed:", {
                      from: activeTab,
                      to: value,
                    });
                    updateActiveTab(value as ValidTab);
                  }}
                >
                  {/* Tabs Header with Filters and Sort */}
                  <div className="mx-4 mt-4 flex items-center justify-between gap-1">
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
                        id="rx-tour-filter"
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
                        id="rx-tour-sort"
                        variant="outline"
                        size="xsIcon"
                        onClick={openSort}
                        aria-haspopup="dialog"
                        aria-expanded={isSortMode}
                        aria-controls="search-sort-panel"
                        className="relative"
                      >
                        <SwapVertIcon className="fill-current" />
                        {isSortModified && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                        )}
                      </Button>
                    </div>
                  </div>
                  {/* Tab Contents */}
                  <TabsContent value="all">
                    {renderTweetList(filteredResults.all, "all")}
                  </TabsContent>
                  <TabsContent value="posts">
                    {renderTweetList(filteredResults.posts, "posts")}
                  </TabsContent>
                  <TabsContent value="replies">
                    {renderTweetList(filteredResults.replies, "replies")}
                  </TabsContent>
                  <TabsContent value="quotes">
                    {renderTweetList(filteredResults.quotes, "quotes")}
                  </TabsContent>
                </Tabs>
              ) : (
                <Tabs
                  value={
                    activeTab === "replies" || activeTab === "quotes"
                      ? "all"
                      : activeTab
                  }
                  onValueChange={(value) => {
                    const mapped =
                      value === "replies" || value === "quotes"
                        ? "all"
                        : (value as ValidTab);
                    updateActiveTab(mapped);
                  }}
                >
                  <div className="mx-4 mt-4 flex items-center justify-between gap-1">
                    <TabsList size="sm">
                      <TabsTrigger size="sm" value="all">
                        All
                      </TabsTrigger>
                      <TabsTrigger size="sm" value="posts">
                        Posts
                      </TabsTrigger>
                      <TabsTrigger size="sm" value="reposts">
                        Reposts
                      </TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        className="gap-1"
                        disabled
                      >
                        <FilterAltIcon className="fill-current opacity-50" />
                        Filter
                      </Button>
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
                        {liSort !== "newest_first" && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                        )}
                      </Button>
                    </div>
                  </div>
                  <TabsContent value="all">
                    {renderLinkedInList(linkedInSplit.all)}
                  </TabsContent>
                  <TabsContent value="posts">
                    {renderLinkedInList(linkedInSplit.posts)}
                  </TabsContent>
                  <TabsContent value="reposts">
                    {renderLinkedInList(linkedInSplit.reposts)}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
