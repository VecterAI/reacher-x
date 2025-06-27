// features/search/hooks/useTwitterSearch.ts
"use client";

import { useState, useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearchHistory } from "./useSearchHistory";
import { Tweet } from "@/features/threads/types";
import { getWorkspaceDescription } from "@/shared/lib/utils/localStorage";
import { generateRequestId } from "@/shared/lib/utils/request";
import {
  getCachedSearchResult,
  cacheSearchResult,
  maintainSearchCache,
} from "@/shared/lib/utils/searchCache";

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const REQUEST_DEBOUNCE_TIME = 500; // 500ms debounce to prevent duplicate requests

export interface SearchResult {
  tweets: Tweet[];
  meta?: {
    originalCount?: number;
    filteredCount?: number;
    llmProcessedCount?: number;
    filterSummary?: string;
    confidenceStats?: {
      min: number;
      max: number;
      avg: number;
    };
    has_next_page?: boolean;
    next_cursor?: string;
    processingTimeMs?: number;
    llmProcessingTimeMs?: number;
    requestId?: string;
  };
}

export function useTwitterSearch() {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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

  const { addToHistory } = useSearchHistory();
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

      // Access user description from localStorage with error handling
      let userDescription: string | null = null;
      try {
        userDescription = getWorkspaceDescription();
        console.log(
          `[TWITTER_SEARCH] ${searchRequestId} - Retrieved user description from localStorage:`,
          {
            hasDescription: !!userDescription,
            descriptionLength: userDescription?.length || 0,
            descriptionPreview: userDescription
              ? userDescription.substring(0, 50) + "..."
              : null,
          }
        );
      } catch (localStorageError) {
        console.error(
          `[TWITTER_SEARCH] ${searchRequestId} - Failed to access localStorage:`,
          localStorageError
        );
        // Continue without description rather than failing
      }

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
              !forceNoFilter &&
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
                      confidenceStats: newMeta.confidenceStats, // Use stats from latest batch
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

            // Add to local search history only for initial search (not pagination)
            if (!cursor) {
              console.log(
                `[TWITTER_SEARCH] ${searchRequestId} - Adding to search history:`,
                {
                  query: query.trim(),
                  exactMatch,
                  resultCount: finalResults.tweets.length,
                }
              );
              addToHistory(
                query.trim(),
                exactMatch,
                finalResults.tweets.length
              );

              // Cache the search result for initial searches only
              const cacheSuccess = cacheSearchResult(
                query.trim(),
                exactMatch,
                finalResults
              );
              console.log(
                `[TWITTER_SEARCH] ${searchRequestId} - Cache result:`,
                {
                  cached: cacheSuccess,
                  query: query.trim(),
                  exactMatch,
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
    [searchTwitterAction, filterTweetsAction, addToHistory] // Stable dependencies
  );

  // Enhanced clear function with logging
  const clearResults = useCallback(() => {
    console.log("[TWITTER_SEARCH] Clearing search results and state");
    setResults(null);
    setError(null);
    setRetryCount(0);
    lastRequestRef.current = null;
    pendingRequestRef.current = null;
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
  };
}
