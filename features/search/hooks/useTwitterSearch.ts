// features/search/hooks/useTwitterSearch.ts
"use client";

import { useState, useCallback, useRef } from "react";
import { useAction } from "convex/react";
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
      cursor?: string
    ) => {
      const searchStartTime = Date.now();
      const searchRequestId = generateRequestId("search");

      console.log(
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
        console.warn(
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
        console.log(
          `[TWITTER_SEARCH] ${searchRequestId} - Skipping duplicate request`
        );
        return;
      }

      // If there's already a pending request, wait for it to complete
      if (pendingRequestRef.current) {
        console.log(
          `[TWITTER_SEARCH] ${searchRequestId} - Waiting for pending request to complete`
        );
        await pendingRequestRef.current;
        return;
      }

      lastRequestRef.current = currentRequest;

      // Check cache for non-pagination requests (initial searches only)
      if (!cursor) {
        const cachedResult = getCachedSearchResult(query.trim(), exactMatch);
        if (cachedResult) {
          console.log(
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

        let attempts = 0;
        let lastError: unknown = null;

        while (attempts < MAX_RETRIES) {
          try {
            console.log(
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

            console.log(
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
                console.warn(
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

            console.log(
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
              console.log(
                `[TWITTER_SEARCH] ${searchRequestId} - Applying ${isPagination ? "incremental" : "initial"} LLM filtering:`,
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
                // Only filter NEW tweets (transformedResults.tweets), not all accumulated tweets
                const filterResult = await filterTweetsAction({
                  tweets: {
                    tweets: transformedResults.tweets, // Only NEW tweets
                    meta: transformedResults.meta,
                  },
                  originalQuery: query.trim(),
                  userDescription: userDescription || undefined,
                });
                const filterEndTime = Date.now();

                console.log(
                  `[TWITTER_SEARCH] ${searchRequestId} - LLM filtering completed:`,
                  {
                    filterSuccess: filterResult.success,
                    filterTimeMs: filterEndTime - filterStartTime,
                    originalNewCount: transformedResults.tweets.length,
                    filteredNewCount: filterResult.data?.tweets?.length || 0,
                    reductionPercentage:
                      transformedResults.tweets.length > 0
                        ? (
                            ((transformedResults.tweets.length -
                              (filterResult.data?.tweets?.length || 0)) /
                              transformedResults.tweets.length) *
                            100
                          ).toFixed(1) + "%"
                        : "0%",
                    requestId: filterResult.metadata?.requestId,
                  }
                );

                if (filterResult.success && filterResult.data) {
                  // For pagination: merge filtered new tweets with existing filtered tweets
                  if (isPagination && resultsRef.current) {
                    const existingMeta = resultsRef.current.meta || {};
                    const newMeta = filterResult.data.meta || {};

                    finalResults = mergePaginationResults(
                      resultsRef.current,
                      filterResult.data.tweets,
                      transformedResults,
                      resultsRef.current.tweets.length +
                        filterResult.data.tweets.length
                    );

                    // Add specific meta properties for filtered results
                    finalResults.meta = {
                      ...finalResults.meta,
                      processingTimeMs: newMeta.processingTimeMs,
                      llmProcessingTimeMs: newMeta.llmProcessingTimeMs,
                      requestId: newMeta.requestId,
                      filterSummary: `Total: ${resultsRef.current.tweets.length + filterResult.data.tweets.length} tweets from ${(existingMeta.originalCount || 0) + transformedResults.tweets.length} original`,
                    };

                    console.log(
                      `[TWITTER_SEARCH] ${searchRequestId} - Merged filtered pagination results:`,
                      {
                        previousFilteredCount: resultsRef.current.tweets.length,
                        newFilteredCount: filterResult.data.tweets.length,
                        totalFilteredCount: finalResults.tweets.length,
                        totalOriginalCount: finalResults.meta?.originalCount,
                      }
                    );

                    // Auto-advance on pagination if this page kept 0 and there are more pages
                    if (
                      (filterResult.data?.tweets?.length || 0) === 0 &&
                      searchResult.data?.has_next_page &&
                      searchResult.data?.next_cursor
                    ) {
                      console.log(
                        `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_START (pagination): current page kept 0, chaining next pages`,
                        {
                          cap: AUTO_ADVANCE_CAP,
                          nextCursor: searchResult.data.next_cursor,
                        }
                      );
                      setAutoAdvanceState("chaining");
                      setAutoAdvancePagesChecked(0);
                      setAutoAdvanceStopReason(null);
                      setAutoAdvanceFoundCount(0);
                      setAutoAdvanceFoundFromPage(null);

                      let pagesFetched = 0;
                      let nextCursor = searchResult.data.next_cursor as
                        | string
                        | undefined;
                      let found = false;
                      let lastHasNext: boolean | undefined =
                        searchResult.data?.has_next_page;

                      while (nextCursor && pagesFetched < AUTO_ADVANCE_CAP) {
                        pagesFetched += 1;
                        const stepStart = Date.now();
                        console.log(
                          `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_STEP (pagination)`,
                          { pagesFetched, cursor: nextCursor }
                        );

                        const pageRes = await searchTwitterAction({
                          query: query.trim(),
                          exactMatch,
                          cursor: nextCursor,
                        });
                        const pageEnd = Date.now();

                        if (!pageRes?.success) {
                          console.warn(
                            `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_STEP failed (pagination)`,
                            { error: pageRes?.error }
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

                        lastHasNext = pageRes.data?.has_next_page;
                        // Track only lastHasNext; lastCursor not used

                        // Filter this chained page
                        const pageFilterStart = Date.now();
                        const pageFilter = await filterTweetsAction({
                          tweets: {
                            tweets: pageTransformed.tweets,
                            meta: pageTransformed.meta,
                          },
                          originalQuery: query.trim(),
                          userDescription: userDescription || undefined,
                        });
                        const pageFilterEnd = Date.now();

                        console.log(
                          `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_STEP filtered (pagination)`,
                          {
                            success: pageFilter.success,
                            timeMs:
                              pageEnd -
                              stepStart +
                              (pageFilterEnd - pageFilterStart),
                            kept: pageFilter.data?.tweets?.length || 0,
                            hasNext: pageRes.data?.has_next_page,
                            nextCursor: pageRes.data?.next_cursor,
                          }
                        );

                        setAutoAdvancePagesChecked(pagesFetched);

                        if (
                          pageFilter.success &&
                          pageFilter.data &&
                          pageFilter.data.tweets.length > 0
                        ) {
                          found = true;
                          setAutoAdvanceFoundCount(
                            pageFilter.data.tweets.length
                          );
                          setAutoAdvanceFoundFromPage(pagesFetched);
                          setAutoAdvanceState("stopped");
                          setAutoAdvanceStopReason("foundKept");

                          // Merge and stop chain
                          finalResults = mergePaginationResults(
                            resultsRef.current,
                            pageFilter.data.tweets,
                            pageTransformed,
                            (resultsRef.current?.tweets.length || 0) +
                              pageFilter.data.tweets.length
                          );

                          const nm = pageFilter.data.meta || {};
                          finalResults.meta = {
                            ...finalResults.meta,
                            processingTimeMs: nm.processingTimeMs,
                            llmProcessingTimeMs: nm.llmProcessingTimeMs,
                            requestId: nm.requestId,
                            filterSummary: `Total: ${(resultsRef.current?.tweets.length || 0) + pageFilter.data.tweets.length} tweets from ${(existingMeta.originalCount || 0) + pageTransformed.tweets.length} original`,
                          };

                          break;
                        }

                        nextCursor = pageRes.data?.next_cursor as
                          | string
                          | undefined;
                        if (!pageRes.data?.has_next_page) {
                          // No more pages
                          setAutoAdvanceState("stopped");
                          setAutoAdvanceStopReason("noMorePages");
                          break;
                        }
                      }

                      if (!found) {
                        // Chain finished without finding kept tweets
                        if (lastHasNext === false) {
                          // Update meta to reflect end of pages
                          finalResults = {
                            tweets: resultsRef.current?.tweets || [],
                            meta: {
                              ...(resultsRef.current?.meta || {}),
                              has_next_page: false,
                              next_cursor: undefined,
                            },
                          };
                        }

                        if (autoAdvanceState !== "stopped") {
                          setAutoAdvanceState("stopped");
                          setAutoAdvanceStopReason(
                            lastHasNext === false ? "noMorePages" : "cap"
                          );
                        }
                      }
                    }
                  } else {
                    // Initial search: use filtered results directly
                    finalResults = {
                      tweets: filterResult.data.tweets,
                      meta: {
                        ...transformedResults.meta,
                        ...filterResult.data.meta,
                        originalCount: transformedResults.tweets.length,
                      },
                    };
                  }
                  // Auto-advance (initial search) when API returned tweets but LLM kept none and there are more pages
                  if (
                    !isPagination &&
                    transformedResults.tweets.length > 0 &&
                    (finalResults.tweets.length === 0 ||
                      (finalResults.meta?.filteredCount || 0) === 0) &&
                    searchResult.data?.has_next_page &&
                    searchResult.data?.next_cursor &&
                    hasValidDescription
                  ) {
                    console.log(
                      `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_START (initial): first page kept 0, chaining next pages`,
                      {
                        cap: AUTO_ADVANCE_CAP,
                        nextCursor: searchResult.data.next_cursor,
                      }
                    );
                    setAutoAdvanceState("chaining");
                    setAutoAdvancePagesChecked(0);
                    setAutoAdvanceStopReason(null);
                    setAutoAdvanceFoundCount(0);
                    setAutoAdvanceFoundFromPage(null);

                    let pagesFetched = 0;
                    let nextCursor = searchResult.data.next_cursor as
                      | string
                      | undefined;
                    let accumulated: SearchResult = {
                      tweets: [],
                      meta: {
                        has_next_page: searchResult.data.has_next_page,
                        next_cursor: nextCursor,
                        originalCount: transformedResults.tweets.length,
                        filteredCount: 0,
                      },
                    };

                    let found = false;
                    while (nextCursor && pagesFetched < AUTO_ADVANCE_CAP) {
                      pagesFetched += 1;
                      console.log(
                        `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_STEP (initial)`,
                        { pagesFetched, cursor: nextCursor }
                      );

                      const pageStart = Date.now();
                      const pageRes = await searchTwitterAction({
                        query: query.trim(),
                        exactMatch,
                        cursor: nextCursor,
                      });
                      const pageEnd = Date.now();

                      if (!pageRes?.success) {
                        console.warn(
                          `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_STEP failed (initial):`,
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

                      console.log(
                        `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_STEP fetched (initial)`,
                        {
                          timeMs: pageEnd - pageStart,
                          count: pageTransformed.tweets.length,
                          hasNext: pageTransformed.meta?.has_next_page,
                        }
                      );

                      if (
                        !isLlmFilterDisabled() &&
                        hasValidDescription &&
                        pageTransformed.tweets.length > 0
                      ) {
                        const pageFilterStart = Date.now();
                        const pageFilter = await filterTweetsAction({
                          tweets: {
                            tweets: pageTransformed.tweets,
                            meta: pageTransformed.meta,
                          },
                          originalQuery: query.trim(),
                          userDescription: userDescription || undefined,
                        });
                        const pageFilterEnd = Date.now();

                        console.log(
                          `[TWITTER_SEARCH] ${searchRequestId} - AUTO_ADVANCE_STEP filtered (initial)`,
                          {
                            success: pageFilter.success,
                            timeMs: pageFilterEnd - pageFilterStart,
                            kept: pageFilter.data?.tweets?.length || 0,
                          }
                        );

                        if (pageFilter.success && pageFilter.data) {
                          if (pageFilter.data.tweets.length > 0) {
                            // Merge and stop auto-advance
                            found = true;
                            setAutoAdvanceFoundCount(
                              pageFilter.data.tweets.length
                            );
                            setAutoAdvanceFoundFromPage(pagesFetched);
                            setAutoAdvanceState("stopped");
                            setAutoAdvanceStopReason("foundKept");
                            accumulated = {
                              tweets: pageFilter.data.tweets,
                              meta: {
                                ...pageTransformed.meta,
                                ...pageFilter.data.meta,
                                originalCount:
                                  (accumulated.meta?.originalCount || 0) +
                                  pageTransformed.tweets.length,
                              },
                            };
                            finalResults = accumulated;
                            nextCursor = pageRes.data?.next_cursor;
                            break;
                          }
                        }
                      }

                      nextCursor = pageRes.data?.next_cursor;
                      if (!pageRes.data?.has_next_page) {
                        setAutoAdvanceState("stopped");
                        setAutoAdvanceStopReason("noMorePages");
                        break;
                      }

                      setAutoAdvancePagesChecked(pagesFetched);
                    }

                    if (!found && autoAdvanceState !== "stopped") {
                      setAutoAdvanceState("stopped");
                      setAutoAdvanceStopReason("cap");
                    }
                  }

                  console.log(
                    `[TWITTER_SEARCH] ${searchRequestId} - Applied LLM filtering successfully`
                  );
                } else {
                  console.warn(
                    `[TWITTER_SEARCH] ${searchRequestId} - LLM filtering failed, using unfiltered results:`,
                    {
                      filterError: filterResult.error,
                    }
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
                console.error(
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
              console.log(
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
              console.log(
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
              console.log(
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
            console.log(
              `[TWITTER_SEARCH] ${searchRequestId} - Search request completed successfully:`,
              {
                totalTimeMs: searchEndTime - searchStartTime,
                finalTweetCount: finalResults.tweets.length,
                wasFiltered: shouldApplyFilter,
                hasNextPage: finalResults.meta?.has_next_page,
              }
            );

            setLoading(false);
            return;
          } catch (err: unknown) {
            lastError = err;
            attempts++;
            console.error(
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
              console.log(
                `[TWITTER_SEARCH] ${searchRequestId} - 4xx error detected, not retrying`
              );
              break;
            }
            if (attempts === MAX_RETRIES) {
              console.error(
                `[TWITTER_SEARCH] ${searchRequestId} - Max retries reached`
              );
              break;
            }

            const retryDelayMs = RETRY_DELAY * attempts;
            console.log(
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

        console.error(
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
    ] // Stable dependencies
  );

  // Enhanced clear function with logging
  const clearResults = useCallback(() => {
    console.log("[TWITTER_SEARCH] Clearing search results and state");
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
  }, []);

  const clearError = useCallback(() => {
    console.log("[TWITTER_SEARCH] Clearing error state");
    setError(null);
    setRetryCount(0);
  }, []);

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
  };
}
