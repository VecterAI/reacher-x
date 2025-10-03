// features/search/hooks/useChunkedFiltering.ts
"use client";

import { useState, useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tweet } from "@/features/threads/types";
import { chunkTweets, mergeChunks } from "@/shared/lib/utils/chunkTweets";
import { logger } from "@/shared/lib/logger";

interface ChunkResult {
  tweets: Tweet[];
  chunkIndex: number;
  meta?: {
    originalCount?: number;
    filteredCount?: number;
    processingTimeMs?: number;
  };
}

interface ChunkProgress {
  total: number;
  resolved: number;
  withResults: number;
}

export function useChunkedFiltering() {
  const filterTweetChunk = useAction(api.llmFilterChunked.filterTweetChunk);

  // Track resolved chunks by chunk index
  const [resolvedChunks, setResolvedChunks] = useState<
    Map<number, ChunkResult>
  >(new Map());
  const [pendingChunks, setPendingChunks] = useState<Set<number>>(new Set());
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress>({
    total: 0,
    resolved: 0,
    withResults: 0,
  });

  // Track current chunk set identifier (for pagination)
  const currentChunkSetRef = useRef<string>("");

  /**
   * Filters multiple chunks in parallel
   * Returns the first non-empty chunk immediately for display
   * Caches remaining chunks for "Load More" button
   */
  const filterChunksParallel = useCallback(
    async (
      tweets: Tweet[],
      originalQuery: string,
      userDescription: string | null,
      chunkSetId: string, // Unique ID for this set of chunks (e.g., "page_1")
      onProgress?: (progress: ChunkProgress) => void
    ): Promise<{
      firstChunk: Tweet[] | null;
      allChunksResolved: boolean;
      totalChunks: number;
      waitForAll: Promise<void>;
    }> => {
      logger.info("[CHUNKED_FILTER] Starting parallel filtering", {
        totalTweets: tweets.length,
        chunkSetId,
        hasDescription: !!userDescription,
      });

      // Clear previous state if this is a new chunk set
      if (currentChunkSetRef.current !== chunkSetId) {
        setResolvedChunks(new Map());
        setPendingChunks(new Set());
        currentChunkSetRef.current = chunkSetId;
      }

      // Split tweets into chunks of 5
      const chunks = chunkTweets(tweets, 5);
      if (chunks.length === 0) {
        logger.warn("[CHUNKED_FILTER] No chunks created from tweets");
        return {
          firstChunk: null,
          allChunksResolved: true,
          totalChunks: 0,
          waitForAll: Promise.resolve(),
        };
      }

      logger.info("[CHUNKED_FILTER] Created chunks", {
        chunkCount: chunks.length,
        chunkSetId,
      });

      // Initialize progress
      const initialProgress: ChunkProgress = {
        total: chunks.length,
        resolved: 0,
        withResults: 0,
      };
      setChunkProgress(initialProgress);
      onProgress?.(initialProgress);

      // Set all chunks as pending
      const allIndices = new Set(chunks.map((__, i) => i));
      setPendingChunks(allIndices);

      // Track first non-empty chunk with a promise that resolves early
      let resolveFirstChunk: ((tweets: Tweet[]) => void) | null = null;
      const firstChunkPromise = new Promise<Tweet[] | null>((resolve) => {
        resolveFirstChunk = (tweets: Tweet[]) => resolve(tweets);

        // If no non-empty chunk found after all resolve, return null
        setTimeout(() => resolve(null), 1500); // shorter timeout to enable fast auto-advance
      });

      // Create promises for all chunks
      // CRITICAL: These promises START IMMEDIATELY when created!
      // All chunks are sent to Grok AT THE SAME TIME (parallel)
      const chunkStartTime = Date.now();
      let completed = 0;
      let resolvedAll = false;
      let resolveAll: () => void = () => {};
      const waitForAll = new Promise<void>((resolve) => {
        resolveAll = () => {
          if (!resolvedAll) {
            resolvedAll = true;
            resolve();
          }
        };
      });
      chunks.map((chunk, index) => {
        logger.info(`[CHUNKED_FILTER] 🚀 Starting chunk ${index} (PARALLEL)`, {
          chunkIndex: index,
          tweetCount: chunk.length,
          timestamp: Date.now() - chunkStartTime + "ms from start",
          chunkSetId,
        });

        return filterTweetChunk({
          tweets: { tweets: chunk },
          chunkIndex: index,
          originalQuery,
          userDescription: userDescription || undefined,
        })
          .then((result) => {
            const resolveTime = Date.now() - chunkStartTime;
            logger.info(`[CHUNKED_FILTER] ✅ Chunk ${index} COMPLETED`, {
              success: result.success,
              tweetCount: result.data?.tweets?.length || 0,
              timeFromStart: resolveTime + "ms",
              message: `Chunk ${index} took ${resolveTime}ms (all started at 0ms)`,
              chunkSetId,
            });

            // Update resolved chunks
            setResolvedChunks((prev) => {
              const next = new Map(prev);
              next.set(index, result.data);
              return next;
            });

            // Remove from pending
            setPendingChunks((prev) => {
              const next = new Set(prev);
              next.delete(index);
              return next;
            });

            // Update progress
            setChunkProgress((prev) => {
              const newProgress = {
                ...prev,
                resolved: prev.resolved + 1,
                withResults:
                  prev.withResults + (result.data?.tweets?.length > 0 ? 1 : 0),
              };
              onProgress?.(newProgress);
              return newProgress;
            });

            // Resolve first chunk promise if this chunk has tweets
            if (
              resolveFirstChunk &&
              result.success &&
              result.data?.tweets?.length > 0
            ) {
              logger.info(
                `[CHUNKED_FILTER] First non-empty chunk found: ${index} - RESOLVING IMMEDIATELY!`,
                {
                  tweetCount: result.data.tweets.length,
                  chunkSetId,
                }
              );
              resolveFirstChunk(result.data.tweets);
              resolveFirstChunk = null; // Prevent resolving again
            }

            // Track completion
            completed += 1;
            if (completed >= chunks.length) resolveAll();
            return result;
          })
          .catch((error) => {
            logger.error(`[CHUNKED_FILTER] Chunk ${index} failed:`, {
              error: error instanceof Error ? error.message : "Unknown error",
              chunkSetId,
            });

            // Remove from pending even on error
            setPendingChunks((prev) => {
              const next = new Set(prev);
              next.delete(index);
              return next;
            });

            // Update progress
            setChunkProgress((prev) => {
              const newProgress = {
                ...prev,
                resolved: prev.resolved + 1,
              };
              onProgress?.(newProgress);
              return newProgress;
            });

            // Return empty result on error - wrap in Promise.resolve for type safety
            const fallback = {
              success: false,
              data: {
                tweets: [],
                chunkIndex: index,
                meta: {
                  originalCount: chunk.length,
                  filteredCount: 0,
                },
              },
            } as const;

            // Track completion on error as well
            completed += 1;
            if (completed >= chunks.length) resolveAll();
            return Promise.resolve(fallback);
          });
      });

      // PROOF OF PARALLEL EXECUTION:
      // The loop above (chunks.map) completes in <1ms because it just creates promises
      // All promises started executing immediately (see logs above with "0ms from start")
      const mapCompleteTime = Date.now() - chunkStartTime;
      logger.info(
        "[CHUNKED_FILTER] 🎯 PROOF: All chunks started in PARALLEL!",
        {
          totalChunks: chunks.length,
          mapCompletedIn: mapCompleteTime + "ms",
          proof: `Map loop took only ${mapCompleteTime}ms. All ${chunks.length} chunks are now running concurrently!`,
          expectedBehavior:
            "You'll see chunks complete at different times (1/4, 2/4, etc) as they race",
          chunkSetId,
        }
      );

      // Wait for FIRST non-empty chunk (or timeout)
      const firstChunk = await firstChunkPromise;

      logger.info("[CHUNKED_FILTER] Returning from filterChunksParallel", {
        hasFirstChunk: !!firstChunk,
        firstChunkSize: firstChunk?.length || 0,
        chunkSetId,
      });

      return {
        firstChunk,
        allChunksResolved: false, // Still processing in background
        totalChunks: chunks.length,
        waitForAll,
      };
    },
    [filterTweetChunk]
  );

  /**
   * Gets all resolved chunks merged into a single array
   * Clears the resolved chunks cache after retrieval
   */
  const getAllResolvedChunks = useCallback((): Tweet[] => {
    const chunks: Tweet[][] = [];

    // Sort by chunk index to maintain order
    const sortedEntries = Array.from(resolvedChunks.entries()).sort(
      ([indexA], [indexB]) => indexA - indexB
    );

    sortedEntries.forEach(([, result]) => {
      if (result.tweets && result.tweets.length > 0) {
        chunks.push(result.tweets);
      }
    });

    const merged = mergeChunks(chunks);

    logger.info("[CHUNKED_FILTER] Retrieved all resolved chunks", {
      chunkCount: chunks.length,
      totalTweets: merged.length,
    });

    // Clear resolved chunks after retrieval
    setResolvedChunks(new Map());

    return merged;
  }, [resolvedChunks]);

  /**
   * Checks if there are resolved chunks waiting to be displayed
   */
  const hasResolvedChunks = useCallback((): boolean => {
    const hasChunks = resolvedChunks.size > 0;
    logger.info("[CHUNKED_FILTER] Checking for resolved chunks", {
      count: resolvedChunks.size,
      hasChunks,
    });
    return hasChunks;
  }, [resolvedChunks]);

  /**
   * Gets the total number of tweets in resolved chunks
   */
  const getResolvedChunkTweetCount = useCallback((): number => {
    let count = 0;
    resolvedChunks.forEach((result) => {
      count += result.tweets?.length || 0;
    });
    return count;
  }, [resolvedChunks]);

  /**
   * Clears all chunk state
   */
  const clearChunkState = useCallback(() => {
    setResolvedChunks(new Map());
    setPendingChunks(new Set());
    setChunkProgress({ total: 0, resolved: 0, withResults: 0 });
    currentChunkSetRef.current = "";
    logger.info("[CHUNKED_FILTER] Cleared all chunk state");
  }, []);

  return {
    // Methods
    filterChunksParallel,
    getAllResolvedChunks,
    hasResolvedChunks,
    getResolvedChunkTweetCount,
    clearChunkState,

    // State
    chunkProgress,
    pendingChunks,
    resolvedChunks,
  };
}
