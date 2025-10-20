// features/search/hooks/useTwitterSearch.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tweet } from "@/features/threads/types";
import { useWorkspaceProfile } from "@/shared/hooks/useWorkspaceProfile";
import { generateRequestId } from "@/shared/lib/utils/request";
import { isLlmFilterDisabled } from "@/shared/lib/utils/featureFlags";
import {
  getCachedSearchResult,
  cacheSearchResult,
  updateCachedSearchResult,
  maintainSearchCache,
} from "@/shared/lib/utils/searchCache";
import { logger } from "@/shared/lib/logger";

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const REQUEST_DEBOUNCE_TIME = 500; // 500ms debounce to prevent duplicate requests
const AUTO_ADVANCE_CAP = 3; // Max chained pages fetched automatically when a page yields 0 kept

export interface SearchResult {
  tweets: Tweet[];
  meta?: {
    originalCount?: number;
    filteredCount?: number;
    llmProcessedCount?: number;
    filterSummary?: string;
    has_next_page?: boolean;
    next_cursor?: string;
    processingTimeMs?: number;
    llmProcessingTimeMs?: number;
    requestId?: string;
    chunkSetId?: string;
  };
}

type AutoAdvanceState = "idle" | "chaining" | "stopped";
type AutoAdvanceStopReason = "foundKept" | "noMorePages" | "cap" | "error";

export function useTwitterSearch() {
  type ProgressOperation = "initial" | "loadMore";
  type ProgressPhase =
    | "queued"
    | "searching"
    | "chunking"
    | "filtering"
    | "finalizing"
    | "complete";

  const { description: unifiedDescription } = useWorkspaceProfile();
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Auto-advance UI + logging state
  const [autoAdvanceState, setAutoAdvanceState] =
    useState<AutoAdvanceState>("idle");
  const [autoAdvancePagesChecked, setAutoAdvancePagesChecked] =
    useState<number>(0);
  const [autoAdvanceStopReason, setAutoAdvanceStopReason] =
    useState<AutoAdvanceStopReason | null>(null);
  const [autoAdvanceFoundCount, setAutoAdvanceFoundCount] = useState<number>(0);
  const [autoAdvanceFoundFromPage, setAutoAdvanceFoundFromPage] = useState<
    number | null
  >(null);

  // Use ref to access current results without causing dependency issues
  const resultsRef = useRef<SearchResult | null>(null);
  resultsRef.current = results;

  // Guard against state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const setIfMounted = useCallback((fn: () => void) => {
    if (!isMountedRef.current) return;
    fn();
  }, []);

  // Request deduplication and rate limiting
  const lastRequestRef = useRef<{
    query: string;
    exactMatch: boolean;
    cursor?: string;
    timestamp: number;
  } | null>(null);
  const pendingRequestRef = useRef<Promise<void> | null>(null);

  const searchTwitterAction = useAction(api.twitterSearch.searchTwitter);
  const searchTwitterChunkedFiltered = useAction(
    api.twitterSearch.searchTwitterChunkedFiltered
  );
  const upsertProgress = useMutation(api.searchProgress.upsertProgress);
  const completeProgress = useMutation(api.searchProgress.completeProgress);
  // Removed client-side chunking state
  // const chunkedFiltering = useChunkedFiltering();

  // Server-driven chunk set state
  const [currentChunkSetId, setCurrentChunkSetId] = useState<string | null>(
    null
  );
  const chunkSetStatus = useQuery(
    api.searchChunks.getChunkSetStatus,
    currentChunkSetId ? { chunkSetId: currentChunkSetId } : "skip"
  );
  const chunkSetTweets = useQuery(
    api.searchChunks.getResolvedTweetsForSet,
    currentChunkSetId ? { chunkSetId: currentChunkSetId } : "skip"
  );
  const consumeResolvedForSet = useMutation(
    api.searchChunks.consumeResolvedTweetsForSet
  );

  // Track current page number for chunk set IDs
  const currentPageRef = useRef<number>(0);
  // Track whether current run's header progress has been completed
  const progressCompletedRef = useRef<boolean>(false);

  // Initialize cache maintenance
  useEffect(() => {
    maintainSearchCache();
  }, []);

  // Helper function to merge pagination results
  const mergePaginationResults = useCallback(
    (
      existingResults: SearchResult,
      newTweets: Tweet[],
      transformedResults: SearchResult,
      customFilteredCount?: number
    ): SearchResult => {
      const existingMeta = existingResults.meta || {};

      // Build a set of existing tweet keys to prevent duplicates across pages
      const makeKey = (t: Tweet) =>
        String(
          t.id_str ||
            t.id ||
            `${t.user?.screen_name ?? "u"}-${t.tweet_created_at ?? "t"}`
        );
      const existingKeys = new Set(existingResults.tweets.map(makeKey));
      const seenNew = new Set<string>();
      const dedupedNewTweets = newTweets.filter((t) => {
        const k = makeKey(t);
        if (existingKeys.has(k)) return false;
        if (seenNew.has(k)) return false;
        seenNew.add(k);
        return true;
      });

      const mergedTweets = [...existingResults.tweets, ...dedupedNewTweets];

      return {
        tweets: mergedTweets,
        meta: {
          ...transformedResults.meta,
          originalCount:
            (existingMeta.originalCount || 0) +
            transformedResults.tweets.length,
          filteredCount:
            customFilteredCount ??
            existingResults.tweets.length + dedupedNewTweets.length,
          llmProcessedCount:
            (existingMeta.llmProcessedCount || 0) +
            (transformedResults.meta?.llmProcessedCount || 0),
        },
      };
    },
    []
  );

  // Stable search function with enhanced logging and automatic LLM filtering
  const searchTweets = useCallback(
    async (
      query: string,
      exactMatch: boolean,
      forceNoFilter = false, // New parameter to opt out of filtering if needed
      cursor?: string,
      keywordKey?: string
    ) => {
      const searchStartTime = Date.now();
      const searchRequestId = generateRequestId("search");

      logger.info(
        `[TWITTER_SEARCH] Starting search request ${searchRequestId}`,
        {
          query: query.trim(),
          exactMatch,
          forceNoFilter,
          cursor,
          timestamp: new Date().toISOString(),
        }
      );

      if (!query.trim()) {
        logger.warn(
          `[TWITTER_SEARCH] ${searchRequestId} - Empty query provided`
        );
        setError("Please enter a search query");
        return;
      }

      const userDescription: string | null = unifiedDescription || null;
      const hasValidDescription =
        typeof userDescription === "string" &&
        userDescription.trim().length >= 64 &&
        userDescription.trim().length <= 512;

      // Request deduplication - prevent duplicate requests
      const now = Date.now();
      const currentRequest = {
        query: query.trim(),
        exactMatch,
        cursor,
        timestamp: now,
      };

      // Check if this is a duplicate request within the debounce time
      if (
        lastRequestRef.current &&
        lastRequestRef.current.query === currentRequest.query &&
        lastRequestRef.current.exactMatch === currentRequest.exactMatch &&
        lastRequestRef.current.cursor === currentRequest.cursor &&
        now - lastRequestRef.current.timestamp < REQUEST_DEBOUNCE_TIME
      ) {
        logger.info(
          `[TWITTER_SEARCH] ${searchRequestId} - Skipping duplicate request`
        );
        return;
      }

      // If there's already a pending request, wait for it to complete
      if (pendingRequestRef.current) {
        logger.info(
          `[TWITTER_SEARCH] ${searchRequestId} - Waiting for pending request to complete`
        );
        await pendingRequestRef.current;
        return;
      }

      lastRequestRef.current = currentRequest;

      // Track pagination for chunk set IDs
      if (!cursor) {
        currentPageRef.current = 0; // Reset for new search
      } else {
        currentPageRef.current += 1; // Increment for pagination
      }

      // Check cache for non-pagination requests (initial searches only)
      if (!cursor) {
        const cachedResult = getCachedSearchResult(query.trim(), exactMatch);
        if (cachedResult) {
          logger.info(
            `[TWITTER_SEARCH] ${searchRequestId} - Using cached result:`,
            {
              query: query.trim(),
              exactMatch,
              cachedTweetCount: cachedResult.tweets.length,
            }
          );
          setResults(cachedResult);
          // Bind server chunk set if present in metadata
          const cachedChunkSetId = cachedResult.meta?.chunkSetId || null;
          if (cachedChunkSetId) {
            setCurrentChunkSetId(cachedChunkSetId);
          }
          setLoading(false);
          setError(null);
          setRetryCount(0);
          return;
        }
      }

      const executeSearch = async () => {
        setLoading(true);
        setError(null);
        const operation: ProgressOperation = cursor ? "loadMore" : "initial";
        // Reset completion flag for this run
        progressCompletedRef.current = false;
        // Optimistic progress: queued -> searching
        if (keywordKey) {
          try {
            await upsertProgress({
              keywordKey,
              operation,
              phase: "queued" satisfies ProgressPhase,
              value: 5,
            });
            await upsertProgress({
              keywordKey,
              operation,
              phase: "searching" satisfies ProgressPhase,
              value: 30,
            });
          } catch {}
        }

        let attempts = 0;
        let lastError: unknown = null;
        // Track all chunk sets started in this run; finalize after all complete
        const runWaits: Promise<void>[] = [];

        while (attempts < MAX_RETRIES) {
          try {
            logger.info(
              `[TWITTER_SEARCH] ${searchRequestId} - Attempting Twitter API search (attempt ${attempts + 1})`,
              {
                query: query.trim(),
                exactMatch,
                cursor,
              }
            );

            const twitterSearchStartTime = Date.now();
            const searchResult = await searchTwitterAction({
              query: query.trim(),
              exactMatch,
              cursor,
            });
            const twitterSearchEndTime = Date.now();

            logger.info(
              `[TWITTER_SEARCH] ${searchRequestId} - Twitter API search completed:`,
              {
                success: searchResult?.success,
                twitterApiTimeMs: twitterSearchEndTime - twitterSearchStartTime,
                resultCount: searchResult?.data?.tweets?.length || 0,
                hasNextPage: searchResult?.data?.has_next_page,
                nextCursor: searchResult?.data?.next_cursor,
              }
            );

            if (!searchResult?.success) {
              // Handle rate limiting with specific messaging
              if (searchResult.error && /429/.test(searchResult.error)) {
                logger.warn(
                  `[TWITTER_SEARCH] ${searchRequestId} - Rate limit exceeded`
                );
                setError(
                  "Rate limit exceeded. Please wait a minute before trying again."
                );
                setLoading(false);
                return;
              }

              // If the error is a 4xx (except 429), do not retry
              if (
                searchResult.error &&
                /4\d\d/.test(searchResult.error) &&
                !/429/.test(searchResult.error)
              ) {
                // Surface friendly toast message for query length violations
                if (/512|Maximum/.test(searchResult.error)) {
                  setError("Search is limited to 512 characters.");
                  setLoading(false);
                  return;
                }
                throw new Error(searchResult.error);
              }

              throw new Error(searchResult.error || "Search failed");
            }

            // Transform Twitter API response to our format
            const transformedResults: SearchResult = {
              tweets: searchResult.data?.tweets || [],
              meta: {
                has_next_page: searchResult.data?.has_next_page,
                next_cursor: searchResult.data?.next_cursor,
                originalCount: searchResult.data?.tweets?.length || 0,
              },
            };

            logger.info(
              `[TWITTER_SEARCH] ${searchRequestId} - Twitter data transformed:`,
              {
                tweetsCount: transformedResults.tweets.length,
                hasNextPage: transformedResults.meta?.has_next_page,
              }
            );

            // Determine if this is pagination (has cursor and existing results)
            const isPagination = cursor && resultsRef.current?.tweets;
            let finalResults = transformedResults;

            // Apply automatic LLM filtering if we have tweets and conditions are met
            const shouldApplyFilter =
              !isLlmFilterDisabled() &&
              !forceNoFilter &&
              hasValidDescription &&
              Array.isArray(transformedResults.tweets) &&
              transformedResults.tweets.length > 0;

            if (shouldApplyFilter) {
              // Update progress to chunking phase
              if (keywordKey) {
                try {
                  await upsertProgress({
                    keywordKey,
                    operation,
                    phase: "chunking" satisfies ProgressPhase,
                    value: 40,
                  });
                } catch {}
              }

              logger.info(
                `[TWITTER_SEARCH] ${searchRequestId} - Applying ${isPagination ? "incremental" : "initial"} SERVER chunked filtering`,
                {
                  isPagination,
                  hasUserDescription: !!userDescription,
                  userDescriptionLength: userDescription?.length || 0,
                  previousResultsCount: isPagination
                    ? resultsRef.current?.tweets.length
                    : 0,
                }
              );

              try {
                const filterStartTime = Date.now();

                // Call server action to perform search + start chunking
                const start = await searchTwitterChunkedFiltered({
                  query: query.trim(),
                  exactMatch,
                  cursor,
                  keywordKey: keywordKey || "",
                  operation,
                  userDescription: userDescription || undefined,
                });

                if (!start?.success) {
                  throw new Error(start?.error || "Search failed");
                }

                const filteredTweets = (start.data?.tweets || []) as Tweet[];
                const hasNextPage = start.data?.meta?.has_next_page;
                const nextCursor = start.data?.meta?.next_cursor;
                const originalCount = start.data?.meta?.originalCount || 0;
                const chunkSetId = start.data?.meta?.chunkSetId;

                if (chunkSetId) setCurrentChunkSetId(chunkSetId);

                logger.info(
                  `[TWITTER_SEARCH] ${searchRequestId} - Server chunking started`,
                  {
                    filterTimeMs: Date.now() - filterStartTime,
                    originalNewCount: originalCount,
                    firstChunkTweetCount: filteredTweets.length,
                    chunkSetId,
                  }
                );

                if (isPagination && resultsRef.current) {
                  const existingMeta = resultsRef.current.meta || {};

                  finalResults = mergePaginationResults(
                    resultsRef.current,
                    filteredTweets,
                    {
                      tweets: [],
                      meta: {
                        has_next_page: hasNextPage,
                        next_cursor: nextCursor,
                        originalCount,
                      },
                    },
                    resultsRef.current.tweets.length + filteredTweets.length
                  );

                  finalResults.meta = {
                    ...finalResults.meta,
                    processingTimeMs: Date.now() - filterStartTime,
                    filterSummary: `Total: ${resultsRef.current.tweets.length + filteredTweets.length} tweets from ${(existingMeta.originalCount || 0) + originalCount} original (server chunked filtering)`,
                    chunkSetId,
                  };

                  logger.info(
                    `[TWITTER_SEARCH] ${searchRequestId} - Merged filtered pagination results (server)`,
                    {
                      previousFilteredCount: resultsRef.current.tweets.length,
                      newFilteredCount: filteredTweets.length,
                      totalFilteredCount: finalResults.tweets.length,
                      totalOriginalCount: finalResults.meta?.originalCount,
                      chunkSetId,
                    }
                  );
                } else {
                  // Initial search: use first chunk as filtered results
                  finalResults = {
                    tweets: filteredTweets,
                    meta: {
                      has_next_page: hasNextPage,
                      next_cursor: nextCursor,
                      originalCount,
                      filteredCount: filteredTweets.length,
                      filterSummary: `Showing first ${filteredTweets.length} tweets (server chunked filtering)`,
                      processingTimeMs: Date.now() - filterStartTime,
                      chunkSetId,
                    },
                  };
                }

                // Removed early auto-advance on first empty chunk; gating moved to page based on server chunk set completion and withResults === 0.
                logger.info(
                  `[TWITTER_SEARCH] ${searchRequestId} - Applied server LLM filtering successfully`
                );
              } catch (filterError) {
                logger.error(
                  `[TWITTER_SEARCH] ${searchRequestId} - Server LLM filtering error:`,
                  {
                    error:
                      filterError instanceof Error
                        ? filterError.message
                        : "Unknown error",
                    stack:
                      filterError instanceof Error
                        ? filterError.stack
                        : undefined,
                  }
                );

                // Fallback: run non-filtered search if server filtering fails
                const searchResult = await searchTwitterAction({
                  query: query.trim(),
                  exactMatch,
                  cursor,
                });
                if (searchResult?.success) {
                  finalResults = {
                    tweets: searchResult.data?.tweets || [],
                    meta: {
                      has_next_page: searchResult.data?.has_next_page,
                      next_cursor: searchResult.data?.next_cursor,
                      originalCount: searchResult.data?.tweets?.length || 0,
                    },
                  };
                } else {
                  throw new Error(searchResult?.error || "Search failed");
                }
              }
            } else {
              // No filtering: run plain search
              const searchResult = await searchTwitterAction({
                query: query.trim(),
                exactMatch,
                cursor,
              });

              if (!searchResult?.success) {
                // Handle rate limiting with specific messaging
                if (searchResult.error && /429/.test(searchResult.error)) {
                  logger.warn(
                    `[TWITTER_SEARCH] ${searchRequestId} - Rate limit exceeded`
                  );
                  setError(
                    "Rate limit exceeded. Please wait a minute before trying again."
                  );
                  setLoading(false);
                  return;
                }

                // If the error is a 4xx (except 429), do not retry
                if (
                  searchResult.error &&
                  /4\d\d/.test(searchResult.error) &&
                  !/429/.test(searchResult.error)
                ) {
                  if (/512|Maximum/.test(searchResult.error)) {
                    setError("Search is limited to 512 characters.");
                    setLoading(false);
                    return;
                  }
                  throw new Error(searchResult.error);
                }

                throw new Error(searchResult.error || "Search failed");
              }

              finalResults = {
                tweets: searchResult.data?.tweets || [],
                meta: {
                  has_next_page: searchResult.data?.has_next_page,
                  next_cursor: searchResult.data?.next_cursor,
                  originalCount: searchResult.data?.tweets?.length || 0,
                },
              };
            }

            setResults(finalResults);
            setRetryCount(0); // Reset retry count on success

            // Handle caching based on whether this is initial search or pagination
            if (!cursor) {
              // Initial search: cache the complete result
              const cacheSuccess = cacheSearchResult(
                query.trim(),
                exactMatch,
                finalResults
              );
              logger.info(
                `[TWITTER_SEARCH] ${searchRequestId} - Cache initial result:`,
                {
                  cached: cacheSuccess,
                  query: query.trim(),
                  exactMatch,
                  tweetCount: finalResults.tweets.length,
                }
              );
            } else {
              // Pagination: update existing cache with expanded results
              const updateSuccess = updateCachedSearchResult(
                query.trim(),
                exactMatch,
                finalResults
              );
              logger.info(
                `[TWITTER_SEARCH] ${searchRequestId} - Update cached result with pagination:`,
                {
                  updated: updateSuccess,
                  query: query.trim(),
                  exactMatch,
                  totalTweetCount: finalResults.tweets.length,
                  isPagination: true,
                }
              );
            }

            const searchEndTime = Date.now();
            logger.info(
              `[TWITTER_SEARCH] ${searchRequestId} - Search request completed successfully:`,
              {
                totalTimeMs: searchEndTime - searchStartTime,
                finalTweetCount: finalResults.tweets.length,
                wasFiltered: shouldApplyFilter,
                hasNextPage: finalResults.meta?.has_next_page,
              }
            );

            // Wait for all chunks in this run to finish before finalizing progress
            try {
              await Promise.all(runWaits);
            } catch {}
            setLoading(false);
            if (keywordKey && !progressCompletedRef.current) {
              try {
                const lastOperation: ProgressOperation = cursor
                  ? "loadMore"
                  : "initial";
                await upsertProgress({
                  keywordKey,
                  operation: lastOperation,
                  phase: "finalizing" satisfies ProgressPhase,
                  value: 95,
                });
                await completeProgress({
                  keywordKey,
                  operation: lastOperation,
                });
                progressCompletedRef.current = true;
              } catch {}
            }
            return;
          } catch (err: unknown) {
            lastError = err;
            attempts++;
            logger.error(
              `[TWITTER_SEARCH] ${searchRequestId} - Search attempt ${attempts} failed:`,
              {
                error: err instanceof Error ? err.message : "Unknown error",
                stack: err instanceof Error ? err.stack : undefined,
                attempt: attempts,
                maxRetries: MAX_RETRIES,
              }
            );

            // Only retry on network errors or 5xx
            if (
              typeof err === "object" &&
              err !== null &&
              "message" in err &&
              typeof (err as { message: string }).message === "string" &&
              /4\d\d/.test((err as { message: string }).message) &&
              !/429/.test((err as { message: string }).message)
            ) {
              logger.info(
                `[TWITTER_SEARCH] ${searchRequestId} - 4xx error detected, not retrying`
              );
              break;
            }
            if (attempts === MAX_RETRIES) {
              logger.error(
                `[TWITTER_SEARCH] ${searchRequestId} - Max retries reached`
              );
              break;
            }

            const retryDelayMs = RETRY_DELAY * attempts;
            logger.info(
              `[TWITTER_SEARCH] ${searchRequestId} - Retrying in ${retryDelayMs}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          }
        }

        const errorMessage =
          typeof lastError === "object" &&
          lastError !== null &&
          "message" in lastError &&
          typeof (lastError as { message: string }).message === "string"
            ? (lastError as { message: string }).message
            : "An unexpected error occurred. Please try again later.";

        logger.error(
          `[TWITTER_SEARCH] ${searchRequestId} - Search request failed after all retries:`,
          {
            finalError: errorMessage,
            attempts,
            totalTimeMs: Date.now() - searchStartTime,
          }
        );

        setError(errorMessage);
        setRetryCount((prev) => prev + 1);
        setLoading(false);
        if (keywordKey && !progressCompletedRef.current) {
          try {
            const lastOperation: ProgressOperation = cursor
              ? "loadMore"
              : "initial";
            await upsertProgress({
              keywordKey,
              operation: lastOperation,
              phase: "finalizing" satisfies ProgressPhase,
              value: 95,
            });
            await completeProgress({
              keywordKey,
              operation: lastOperation,
            });
            progressCompletedRef.current = true;
          } catch {}
        }
      };

      // Store the pending request promise
      pendingRequestRef.current = executeSearch();

      try {
        await pendingRequestRef.current;
      } finally {
        pendingRequestRef.current = null;
      }
    },
    [
      searchTwitterAction,
      unifiedDescription,
      upsertProgress,
      completeProgress,
      searchTwitterChunkedFiltered,
      mergePaginationResults,
      // chunkedFiltering,
    ] // Stable dependencies
  );

  // Enhanced clear function with logging
  const clearResults = useCallback(() => {
    logger.info("[TWITTER_SEARCH] Clearing search results and state");
    setResults(null);
    setError(null);
    setRetryCount(0);
    lastRequestRef.current = null;
    pendingRequestRef.current = null;
    setAutoAdvanceState("idle");
    setAutoAdvancePagesChecked(0);
    setAutoAdvanceStopReason(null);
    setAutoAdvanceFoundCount(0);
    setAutoAdvanceFoundFromPage(null);
    // Clear server-driven chunking state
    setCurrentChunkSetId(null);
    currentPageRef.current = 0;
  }, []);

  const clearError = useCallback(() => {
    logger.info("[TWITTER_SEARCH] Clearing error state");
    setError(null);
    setRetryCount(0);
  }, []);

  // Merge resolved chunks into current results (server-side atomic consumption)
  const mergeResolvedChunks = useCallback(async () => {
    if (!resultsRef.current) {
      logger.warn("[TWITTER_SEARCH] No results to merge");
      return;
    }
    if (!currentChunkSetId) {
      logger.warn("[TWITTER_SEARCH] No current chunk set to consume");
      return;
    }

    try {
      const { tweets, count } = await consumeResolvedForSet({
        chunkSetId: currentChunkSetId,
      });

      const resolvedTweets = (tweets || []) as Tweet[];

      if (resolvedTweets.length === 0) {
        logger.info("[TWITTER_SEARCH] No server-resolved tweets to merge");
        return;
      }

      // Dedup new tweets against existing, and within the new batch
      const makeKey = (t: Tweet) =>
        String(
          t.id_str ||
            t.id ||
            `${t.user?.screen_name ?? "u"}-${t.tweet_created_at ?? "t"}`
        );
      const existingKeys = new Set(
        (resultsRef.current.tweets || []).map(makeKey)
      );
      const seenNew = new Set<string>();
      const dedupedNewTweets = resolvedTweets.filter((t) => {
        const k = makeKey(t);
        if (existingKeys.has(k)) return false;
        if (seenNew.has(k)) return false;
        seenNew.add(k);
        return true;
      });

      if (dedupedNewTweets.length === 0) {
        logger.info(
          "[TWITTER_SEARCH] All server-resolved tweets were duplicates; skipping merge",
          {
            currentCount: resultsRef.current.tweets.length,
            newCount: count ?? resolvedTweets.length,
          }
        );
        return;
      }

      logger.info("[TWITTER_SEARCH] Consumed resolved chunks from server:", {
        currentCount: resultsRef.current.tweets.length,
        newCount: count ?? resolvedTweets.length,
        mergedNewCount: dedupedNewTweets.length,
      });

      const mergedResults: SearchResult = {
        tweets: [...resultsRef.current.tweets, ...dedupedNewTweets],
        meta: {
          ...resultsRef.current.meta,
          filteredCount:
            resultsRef.current.tweets.length + dedupedNewTweets.length,
        },
      };

      setIfMounted(() => setResults(mergedResults));

      // Persist merged results back to cache if we have a current request
      const req = lastRequestRef.current;
      if (req) {
        try {
          updateCachedSearchResult(req.query, req.exactMatch, mergedResults);
        } catch {}
      }

      logger.info("[TWITTER_SEARCH] Server chunks merged successfully:", {
        mergedCount: dedupedNewTweets.length,
        totalCount: mergedResults.tweets.length,
      });
    } catch (err) {
      logger.error("[TWITTER_SEARCH] Failed to consume/merge chunks:", err);
    }
  }, [currentChunkSetId, consumeResolvedForSet, setIfMounted]);

  return {
    searchTweets,
    results,
    loading,
    error,
    retryCount,
    clearResults,
    clearError,
    autoAdvanceState,
    autoAdvancePagesChecked,
    autoAdvanceStopReason,
    autoAdvanceFoundCount,
    autoAdvanceFoundFromPage,
    autoAdvanceCap: AUTO_ADVANCE_CAP,

    // Chunked filtering methods
    hasResolvedChunks: () => {
      const resolvedTweets = (chunkSetTweets?.tweets || []) as Tweet[];
      if (!resolvedTweets.length) return false;
      const makeKey = (t: Tweet) =>
        String(
          t.id_str ||
            t.id ||
            `${t.user?.screen_name ?? "u"}-${t.tweet_created_at ?? "t"}`
        );
      const existingKeys = new Set(
        (resultsRef.current?.tweets || []).map(makeKey)
      );
      for (const t of resolvedTweets) {
        if (!existingKeys.has(makeKey(t))) return true;
      }
      return false;
    },
    getResolvedChunkTweetCount: () => {
      const resolvedTweets = (chunkSetTweets?.tweets || []) as Tweet[];
      if (!resolvedTweets.length) return 0;
      const makeKey = (t: Tweet) =>
        String(
          t.id_str ||
            t.id ||
            `${t.user?.screen_name ?? "u"}-${t.tweet_created_at ?? "t"}`
        );
      const existingKeys = new Set(
        (resultsRef.current?.tweets || []).map(makeKey)
      );
      return resolvedTweets.filter((t) => !existingKeys.has(makeKey(t))).length;
    },
    mergeResolvedChunks,
    chunkProgress: {
      total: chunkSetStatus?.total || 0,
      resolved: chunkSetStatus?.resolved || 0,
      withResults: chunkSetStatus?.withResults || 0,
      isComplete: !!chunkSetStatus?.isComplete,
    },
  };
}
