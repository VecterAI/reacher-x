// features/search/hooks/useTwitterSearch.ts
"use client";

import { useState, useCallback, useRef } from "react";
import { useAction, useMutation } from "convex/react";
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
import { useChunkedFiltering } from "./useChunkedFiltering";

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

  // Request deduplication and rate limiting
  const lastRequestRef = useRef<{
    query: string;
    exactMatch: boolean;
    cursor?: string;
    timestamp: number;
  } | null>(null);
  const pendingRequestRef = useRef<Promise<void> | null>(null);

  const searchTwitterAction = useAction(api.twitterSearch.searchTwitter);
  const filterTweetsAction = useAction(api.llmFilter.filterTweetsWithLLM);
  const upsertProgress = useMutation(api.searchProgress.upsertProgress);
  const completeProgress = useMutation(api.searchProgress.completeProgress);

  // Chunked filtering hook
  const chunkedFiltering = useChunkedFiltering();

  // Track current page number for chunk set IDs
  const currentPageRef = useRef<number>(0);
  // Track whether current run's header progress has been completed
  const progressCompletedRef = useRef<boolean>(false);

  // Initialize cache maintenance
  useState(() => {
    maintainSearchCache();
  });

  // Helper function to merge pagination results
  const mergePaginationResults = (
    existingResults: SearchResult,
    newTweets: Tweet[],
    transformedResults: SearchResult,
    customFilteredCount?: number
  ): SearchResult => {
    const existingMeta = existingResults.meta || {};

    return {
      tweets: [...existingResults.tweets, ...newTweets],
      meta: {
        ...transformedResults.meta,
        originalCount:
          (existingMeta.originalCount || 0) + transformedResults.tweets.length,
        filteredCount:
          customFilteredCount ??
          existingResults.tweets.length + newTweets.length,
        llmProcessedCount:
          (existingMeta.llmProcessedCount || 0) +
          (transformedResults.meta?.llmProcessedCount || 0),
      },
    };
  };

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
                `[TWITTER_SEARCH] ${searchRequestId} - Applying ${isPagination ? "incremental" : "initial"} CHUNKED filtering:`,
                {
                  tweetsToFilter: transformedResults.tweets.length,
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

                // Generate unique chunk set ID for this page
                const chunkSetId = `page_${currentPageRef.current}_${isPagination ? "load" : "initial"}`;

                // Use chunked filtering for parallel processing
                const { firstChunk, allChunksResolved, waitForAll } =
                  await chunkedFiltering.filterChunksParallel(
                    transformedResults.tweets,
                    query.trim(),
                    userDescription || null,
                    chunkSetId,
                    (progress) => {
                      // Update progress dynamically as chunks resolve
                      // BUT: Don't update if all chunks are resolved (prevents overwriting completion)
                      if (
                        keywordKey &&
                        progress.resolved < progress.total &&
                        !progressCompletedRef.current
                      ) {
                        const progressValue =
                          40 +
                          Math.round((45 * progress.resolved) / progress.total);
                        try {
                          upsertProgress({
                            keywordKey,
                            operation,
                            phase: "filtering" satisfies ProgressPhase,
                            value: progressValue,
                          }).catch(() => {});
                        } catch {}
                      }
                    }
                  );
                // Ensure we finalize only after this page's chunks are all done
                runWaits.push(waitForAll);

                const filterEndTime = Date.now();

                // Use first chunk as the immediate result (or empty if no chunks had results)
                const filteredTweets = firstChunk || [];

                logger.info(
                  `[TWITTER_SEARCH] ${searchRequestId} - Chunked LLM filtering completed:`,
                  {
                    filterTimeMs: filterEndTime - filterStartTime,
                    originalNewCount: transformedResults.tweets.length,
                    firstChunkTweetCount: filteredTweets.length,
                    allChunksResolved,
                    chunkSetId,
                    reductionPercentage:
                      transformedResults.tweets.length > 0
                        ? (
                            ((transformedResults.tweets.length -
                              filteredTweets.length) /
                              transformedResults.tweets.length) *
                            100
                          ).toFixed(1) + "%"
                        : "0%",
                  }
                );

                if (filteredTweets.length > 0 || allChunksResolved) {
                  // For pagination: merge filtered new tweets with existing filtered tweets
                  if (isPagination && resultsRef.current) {
                    const existingMeta = resultsRef.current.meta || {};

                    finalResults = mergePaginationResults(
                      resultsRef.current,
                      filteredTweets,
                      transformedResults,
                      resultsRef.current.tweets.length + filteredTweets.length
                    );

                    // Add specific meta properties for filtered results
                    finalResults.meta = {
                      ...finalResults.meta,
                      processingTimeMs: filterEndTime - filterStartTime,
                      llmProcessingTimeMs: filterEndTime - filterStartTime,
                      filterSummary: `Total: ${resultsRef.current.tweets.length + filteredTweets.length} tweets from ${(existingMeta.originalCount || 0) + transformedResults.tweets.length} original (chunked filtering)`,
                    };

                    logger.info(
                      `[TWITTER_SEARCH] ${searchRequestId} - Merged filtered pagination results:`,
                      {
                        previousFilteredCount: resultsRef.current.tweets.length,
                        newFilteredCount: filteredTweets.length,
                        totalFilteredCount: finalResults.tweets.length,
                        totalOriginalCount: finalResults.meta?.originalCount,
                        chunkSetId,
                      }
                    );

                    // With chunked filtering, pagination is simplified:
                    // - First chunk shows immediately
                    // - Remaining chunks are cached
                    // - User clicks "Load More" to show cached chunks or fetch next page
                    // No need for complex auto-advance logic here
                    logger.info(
                      `[TWITTER_SEARCH] ${searchRequestId} - Pagination handled via chunked filtering, ${chunkedFiltering.resolvedChunks.size} chunks cached`,
                      {
                        hasMorePages: searchResult.data?.has_next_page,
                        nextCursor: searchResult.data?.next_cursor,
                        firstChunkSize: filteredTweets.length,
                      }
                    );
                  } else {
                    // Initial search: use first chunk as filtered results
                    finalResults = {
                      tweets: filteredTweets,
                      meta: {
                        ...transformedResults.meta,
                        originalCount: transformedResults.tweets.length,
                        filteredCount: filteredTweets.length,
                        filterSummary: `Showing first ${filteredTweets.length} tweets (chunked filtering)`,
                        processingTimeMs: filterEndTime - filterStartTime,
                      },
                    };
                  }
                  // With chunked filtering, auto-advance: if the first chunk is empty
                  // try next pages quickly to surface something useful
                  if (
                    filteredTweets.length === 0 &&
                    searchResult.data?.has_next_page
                  ) {
                    logger.info(
                      `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_START: first chunk empty, chaining next pages`,
                      {
                        cap: AUTO_ADVANCE_CAP,
                        nextCursor: searchResult.data?.next_cursor,
                        isPagination: !!isPagination,
                      }
                    );
                    setAutoAdvanceState("chaining");
                    setAutoAdvancePagesChecked(0);
                    setAutoAdvanceStopReason(null);
                    setAutoAdvanceFoundCount(0);
                    setAutoAdvanceFoundFromPage(null);

                    let pagesFetched = 0;
                    let nextCursor = searchResult.data?.next_cursor as
                      | string
                      | undefined;

                    let found = false;
                    while (nextCursor && pagesFetched < AUTO_ADVANCE_CAP) {
                      pagesFetched += 1;
                      setAutoAdvancePagesChecked(pagesFetched);
                      logger.info(
                        `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_STEP`,
                        { pagesFetched, cursor: nextCursor }
                      );

                      const pageRes = await searchTwitterAction({
                        query: query.trim(),
                        exactMatch,
                        cursor: nextCursor,
                      });

                      if (!pageRes?.success) {
                        logger.warn(
                          `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_STEP failed:`,
                          pageRes?.error
                        );
                        setAutoAdvanceState("stopped");
                        setAutoAdvanceStopReason("error");
                        break;
                      }

                      const pageTransformed: SearchResult = {
                        tweets: pageRes.data?.tweets || [],
                        meta: {
                          has_next_page: pageRes.data?.has_next_page,
                          next_cursor: pageRes.data?.next_cursor,
                          originalCount: pageRes.data?.tweets?.length || 0,
                        },
                      };

                      if (
                        !isLlmFilterDisabled() &&
                        hasValidDescription &&
                        pageTransformed.tweets.length > 0
                      ) {
                        const advPageId = `auto_${currentPageRef.current}_${pagesFetched}`;
                        const { firstChunk: advFirst, waitForAll: advWait } =
                          await chunkedFiltering.filterChunksParallel(
                            pageTransformed.tweets,
                            query.trim(),
                            userDescription || null,
                            advPageId
                          );
                        // Track this auto-advance page's completion
                        runWaits.push(advWait);

                        const advKept = advFirst || [];
                        if (advKept.length > 0) {
                          found = true;
                          setAutoAdvanceFoundCount(advKept.length);
                          setAutoAdvanceFoundFromPage(pagesFetched);
                          setAutoAdvanceState("stopped");
                          setAutoAdvanceStopReason("foundKept");

                          if (isPagination && resultsRef.current) {
                            finalResults = mergePaginationResults(
                              resultsRef.current,
                              advKept,
                              pageTransformed,
                              resultsRef.current.tweets.length + advKept.length
                            );
                          } else {
                            finalResults = {
                              tweets: advKept,
                              meta: {
                                ...pageTransformed.meta,
                                originalCount:
                                  pageTransformed.meta?.originalCount || 0,
                                filteredCount: advKept.length,
                              },
                            };
                          }
                          nextCursor = pageRes.data?.next_cursor;
                          break;
                        }
                      }

                      nextCursor = pageRes.data?.next_cursor;
                      if (!pageRes.data?.has_next_page) {
                        setAutoAdvanceState("stopped");
                        setAutoAdvanceStopReason("noMorePages");
                        // Complete even if nothing was found
                        if (keywordKey && !progressCompletedRef.current) {
                          try {
                            await upsertProgress({
                              keywordKey,
                              operation,
                              phase: "finalizing" satisfies ProgressPhase,
                              value: 95,
                            });
                            await completeProgress({ keywordKey, operation });
                            progressCompletedRef.current = true;
                          } catch {}
                        }
                        break;
                      }
                    }

                    if (!found && autoAdvanceState !== "stopped") {
                      setAutoAdvanceState("stopped");
                      setAutoAdvanceStopReason("cap");
                    }
                    // Do not complete here; we'll finalize after all runWaits resolve
                  }

                  logger.info(
                    `[TWITTER_SEARCH] ${searchRequestId} - Applied LLM filtering successfully`
                  );
                } else {
                  logger.warn(
                    `[TWITTER_SEARCH] ${searchRequestId} - Chunked filtering returned no results, using unfiltered results`
                  );

                  // For pagination with failed filtering: merge unfiltered new tweets with existing results
                  if (isPagination && resultsRef.current) {
                    finalResults = mergePaginationResults(
                      resultsRef.current,
                      transformedResults.tweets,
                      transformedResults
                    );
                  }
                  // For initial search: use unfiltered results (finalResults already set above)
                }
              } catch (filterError) {
                logger.error(
                  `[TWITTER_SEARCH] ${searchRequestId} - LLM filtering error:`,
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

                // For pagination with error: merge unfiltered new tweets with existing results
                if (isPagination && resultsRef.current) {
                  finalResults = mergePaginationResults(
                    resultsRef.current,
                    transformedResults.tweets,
                    transformedResults
                  );
                }
                // For initial search: use unfiltered results (finalResults already set above)
              }
            } else {
              logger.info(
                `[TWITTER_SEARCH] ${searchRequestId} - Skipping LLM filtering:`,
                {
                  forceNoFilter,
                  hasValidDescription,
                  hasTweets: Array.isArray(transformedResults.tweets),
                  tweetsCount: transformedResults.tweets?.length || 0,
                }
              );

              // For pagination without filtering: merge all tweets
              if (isPagination && resultsRef.current) {
                finalResults = mergePaginationResults(
                  resultsRef.current,
                  transformedResults.tweets,
                  transformedResults
                );
              }
              // For initial search: use results as-is (finalResults already set above)
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
      filterTweetsAction,
      unifiedDescription,
      autoAdvanceState,
      upsertProgress,
      completeProgress,
      chunkedFiltering,
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
    // Clear chunked filtering state
    chunkedFiltering.clearChunkState();
    currentPageRef.current = 0;
  }, [chunkedFiltering]);

  const clearError = useCallback(() => {
    logger.info("[TWITTER_SEARCH] Clearing error state");
    setError(null);
    setRetryCount(0);
  }, []);

  // Merge resolved chunks into current results
  const mergeResolvedChunks = useCallback(() => {
    const resolvedTweets = chunkedFiltering.getAllResolvedChunks();

    if (!resultsRef.current || resolvedTweets.length === 0) {
      logger.warn("[TWITTER_SEARCH] No results or resolved tweets to merge");
      return;
    }

    logger.info("[TWITTER_SEARCH] Merging resolved chunks into results:", {
      currentCount: resultsRef.current.tweets.length,
      newCount: resolvedTweets.length,
    });

    // Merge the new tweets with existing results
    const mergedResults: SearchResult = {
      tweets: [...resultsRef.current.tweets, ...resolvedTweets],
      meta: {
        ...resultsRef.current.meta,
        filteredCount: resultsRef.current.tweets.length + resolvedTweets.length,
      },
    };

    setResults(mergedResults);
    logger.info("[TWITTER_SEARCH] Chunks merged successfully:", {
      totalCount: mergedResults.tweets.length,
    });
  }, [chunkedFiltering]);

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
    hasResolvedChunks: chunkedFiltering.hasResolvedChunks,
    getResolvedChunkTweetCount: chunkedFiltering.getResolvedChunkTweetCount,
    mergeResolvedChunks,
    chunkProgress: chunkedFiltering.chunkProgress,
  };
}
