// features/search/hooks/useLinkedInSearch.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { logger } from "@/shared/lib/logger";
import { isLlmFilterDisabled } from "@/shared/lib/utils/featureFlags";
import { generateRequestId } from "@/shared/lib/utils/request";
import { useWorkspaceProfile } from "@/shared/hooks/useWorkspaceProfile";
import {
  getCachedLinkedInSearchResult,
  cacheLinkedInSearchResult,
  updateCachedLinkedInSearchResult,
  maintainLinkedInSearchCache,
} from "@/shared/lib/utils/linkedinSearchCache";

export interface LinkedInSearchResult {
  posts: UnifiedPost[];
  meta?: {
    has_next_page?: boolean;
    next_cursor?: number;
    originalCount?: number;
    chunkSetId?: string | null;
  };
}

type ProgressOperation = "initial" | "loadMore";

export function useLinkedInSearch() {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  const REQUEST_DEBOUNCE_TIME = 500;
  const [results, setResults] = useState<LinkedInSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { description: unifiedDescription } = useWorkspaceProfile();

  // Server-driven chunking state
  const [currentChunkSetId, setCurrentChunkSetId] = useState<string | null>(
    null
  );
  const chunkSetStatus = useQuery(
    api.searchChunks.getChunkSetStatus,
    currentChunkSetId ? { chunkSetId: currentChunkSetId } : "skip"
  );
  const chunkSetPosts = useQuery(
    api.searchChunks.getResolvedTweetsForSet,
    currentChunkSetId ? { chunkSetId: currentChunkSetId } : "skip"
  );
  const consumeResolvedForSet = useMutation(
    api.searchChunks.consumeResolvedTweetsForSet
  );

  const last = useRef<{
    q: string;
    exact: boolean;
    cursor?: number;
  } | null>(null);
  const lastRequestRef = useRef<{
    query: string;
    exact: boolean;
    cursor?: number;
    timestamp: number;
  } | null>(null);
  const pendingRequestRef = useRef<Promise<void> | null>(null);
  const resultsRef = useRef<LinkedInSearchResult | null>(null);
  resultsRef.current = results;

  // Track last progress context for server-driven completion
  const lastProgressRef = useRef<{
    keywordKey?: string;
    operation: ProgressOperation;
  } | null>(null);

  const searchLinkedInSimple = useAction(api.linkedinSearch.searchLinkedIn);
  const searchLinkedInChunked = useAction(
    api.linkedinSearch.searchLinkedInChunkedFiltered
  );
  const upsertProgress = useMutation(api.searchProgress.upsertProgress);
  const completeProgress = useMutation(api.searchProgress.completeProgress);

  const search = useCallback(
    async (q: string, exact: boolean, cursor?: number, keywordKey?: string) => {
      const searchRequestId = generateRequestId("li_search");
      const startTime = Date.now();
      logger.info(`[LINKEDIN_SEARCH] Starting search ${searchRequestId}`, {
        query: q.trim(),
        exact,
        cursor,
        keywordKey,
        disableFilter: isLlmFilterDisabled(),
        ts: new Date().toISOString(),
      });

      const trimmed = q.trim();
      if (!trimmed) {
        setError("Please enter a search query");
        return;
      }
      if (
        last.current &&
        last.current.q === trimmed &&
        last.current.exact === exact &&
        last.current.cursor === cursor
      ) {
        return;
      }

      const now = Date.now();
      const currentRequest = {
        query: trimmed,
        exact,
        cursor,
        timestamp: now,
      };
      if (
        lastRequestRef.current &&
        lastRequestRef.current.query === currentRequest.query &&
        lastRequestRef.current.exact === currentRequest.exact &&
        lastRequestRef.current.cursor === currentRequest.cursor &&
        now - lastRequestRef.current.timestamp < REQUEST_DEBOUNCE_TIME
      ) {
        return;
      }
      if (pendingRequestRef.current) {
        await pendingRequestRef.current;
        return;
      }
      lastRequestRef.current = currentRequest;

      const executeSearch = async () => {
        setLoading(true);
        setError(null);
        last.current = { q: trimmed, exact, cursor };
        try {
          const operation: ProgressOperation = cursor ? "loadMore" : "initial";
          const disableFilter = isLlmFilterDisabled();
          // Cache warm-path for initial searches (no progress upsert on cache hit)
          if (!cursor) {
            const cached = getCachedLinkedInSearchResult(trimmed, exact);
            if (cached) {
              logger.info(
                `[LINKEDIN_SEARCH] ${searchRequestId} - Using cached result`,
                {
                  posts: cached.posts.length,
                  hasNext: !!cached.meta?.has_next_page,
                }
              );
              const cachedChunkSetId = cached.meta?.chunkSetId || null;
              if (cachedChunkSetId) setCurrentChunkSetId(cachedChunkSetId);
              last.current = { q: trimmed, exact, cursor };
              setResults(cached);
              setLoading(false);
              setError(null);
              return;
            }
          }
          // Only start/track progress when not serving from cache
          // Track progress context for later completion when server chunking ends
          lastProgressRef.current = { keywordKey, operation };
          if (keywordKey) {
            try {
              await upsertProgress({
                keywordKey,
                operation,
                phase: "queued",
                value: 5,
              });
              await upsertProgress({
                keywordKey,
                operation,
                phase: "searching",
                value: 30,
              });
            } catch {}
          }
          if (disableFilter) {
            // Simple, non-LLM path for speed and to respect the disable flag
            const res = await searchLinkedInSimple({
              query: trimmed,
              exactMatch: exact,
              cursor,
              sortBy: "date_posted",
            });
            if (!res?.success) {
              if (res?.error && /429/.test(res.error)) {
                setError(
                  "Rate limit exceeded. Please wait a minute before trying again."
                );
                setLoading(false);
                return;
              }
              throw new Error(res?.error || "Search failed");
            }
            const meta = (res.data || {}) as {
              posts?: UnifiedPost[];
              has_next_page?: boolean;
              next_cursor?: number;
            };
            const posts = (meta.posts || []).map((p) => ({
              ...p,
              platform: "linkedin" as const,
            }));
            const newPage: LinkedInSearchResult = {
              posts,
              meta: {
                has_next_page: meta?.has_next_page,
                next_cursor: meta?.next_cursor,
                originalCount: posts.length,
                chunkSetId: null,
              },
            };
            setCurrentChunkSetId(null);
            setResults((prev) => {
              if (cursor && prev) {
                const existing = new Set(prev.posts.map((p) => p.id));
                const deduped = newPage.posts.filter(
                  (p) => !existing.has(p.id)
                );
                return {
                  posts: [...prev.posts, ...deduped],
                  meta: newPage.meta,
                };
              }
              return newPage;
            });
            // Cache/store results
            try {
              if (!cursor) {
                cacheLinkedInSearchResult(trimmed, exact, newPage);
              } else {
                updateCachedLinkedInSearchResult(trimmed, exact, (prev) => {
                  if (!prev) return newPage;
                  const existing = new Set(prev.posts.map((p) => p.id));
                  const deduped = newPage.posts.filter(
                    (p) => !existing.has(p.id)
                  );
                  return {
                    posts: [...prev.posts, ...deduped],
                    meta: { ...(prev.meta || {}), ...newPage.meta },
                  };
                });
              }
            } catch {}
            if (keywordKey) {
              try {
                await upsertProgress({
                  keywordKey,
                  operation,
                  phase: "finalizing",
                  value: 95,
                });
                await completeProgress({ keywordKey, operation });
              } catch {}
            }
            logger.info(
              `[LINKEDIN_SEARCH] ${searchRequestId} - simple results`,
              {
                posts: posts.length,
                hasNext: !!newPage.meta?.has_next_page,
                nextCursor: newPage.meta?.next_cursor,
                tookMs: Date.now() - startTime,
              }
            );
          } else {
            const res = await searchLinkedInChunked({
              query: trimmed,
              exactMatch: exact,
              cursor,
              keywordKey: keywordKey || "",
              operation,
              userDescription: unifiedDescription || undefined,
            });
            if (!res?.success) {
              throw new Error(res?.error || "Search failed");
            }
            const meta = (res.data?.meta || {}) as {
              originalCount?: number;
              has_next_page?: boolean;
              next_cursor?: number;
              chunkSetId?: string;
            };
            if (meta?.chunkSetId) setCurrentChunkSetId(meta.chunkSetId);

            const firstChunkPosts = (res.data?.posts || []) as UnifiedPost[];
            const newPage: LinkedInSearchResult = {
              posts: (firstChunkPosts || []).map((p) => ({
                ...p,
                platform: "linkedin" as const,
              })),
              meta: {
                has_next_page: meta?.has_next_page,
                next_cursor: meta?.next_cursor,
                originalCount: meta?.originalCount,
                chunkSetId: meta?.chunkSetId || null,
              },
            };
            if (keywordKey) {
              try {
                await upsertProgress({
                  keywordKey,
                  operation,
                  phase: "chunking",
                  value: 40,
                });
              } catch {}
            }
            setResults((prev) => {
              if (cursor && prev) {
                // merge (dedupe by id)
                const existing = new Set(prev.posts.map((p) => p.id));
                const deduped = newPage.posts.filter(
                  (p) => !existing.has(p.id)
                );
                return {
                  posts: [...prev.posts, ...deduped],
                  meta: newPage.meta,
                };
              }
              return newPage;
            });
            // Cache/store results
            try {
              if (!cursor) {
                cacheLinkedInSearchResult(trimmed, exact, newPage);
              } else {
                updateCachedLinkedInSearchResult(trimmed, exact, (prev) => {
                  if (!prev) return newPage;
                  const existing = new Set(prev.posts.map((p) => p.id));
                  const deduped = newPage.posts.filter(
                    (p) => !existing.has(p.id)
                  );
                  return {
                    posts: [...prev.posts, ...deduped],
                    meta: { ...(prev.meta || {}), ...newPage.meta },
                  };
                });
              }
            } catch {}
            logger.info(
              `[LINKEDIN_SEARCH] ${searchRequestId} - chunked first page`,
              {
                firstChunk: newPage.posts.length,
                hasNext: !!newPage.meta?.has_next_page,
                nextCursor: newPage.meta?.next_cursor,
                chunkSetId: newPage.meta?.chunkSetId,
                tookMs: Date.now() - startTime,
              }
            );
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : "Search failed";
          if (/429/.test(message)) {
            setError(
              "Rate limit exceeded. Please wait a minute before trying again."
            );
          } else {
            setError(message);
          }
        } finally {
          setLoading(false);
          if (keywordKey) {
            try {
              const lastOp: ProgressOperation = cursor ? "loadMore" : "initial";
              await upsertProgress({
                keywordKey,
                operation: lastOp,
                phase: "finalizing",
                value: 95,
              });
              await completeProgress({ keywordKey, operation: lastOp });
            } catch {}
          }
        }
      };

      let attempts = 0;
      let lastError: unknown = null;
      pendingRequestRef.current = (async () => {
        while (attempts < MAX_RETRIES) {
          try {
            await executeSearch();
            pendingRequestRef.current = null;
            return;
          } catch (err) {
            lastError = err;
            attempts++;
            if (
              typeof err === "object" &&
              err !== null &&
              "message" in err &&
              typeof (err as { message: string }).message === "string" &&
              /4\d\d/.test((err as { message: string }).message) &&
              !/429/.test((err as { message: string }).message)
            ) {
              break;
            }
            if (attempts === MAX_RETRIES) {
              break;
            }
            const delayMs = RETRY_DELAY * attempts;
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
        pendingRequestRef.current = null;
        if (lastError) {
          const message =
            typeof lastError === "object" &&
            lastError !== null &&
            "message" in lastError &&
            typeof (lastError as { message: string }).message === "string"
              ? (lastError as { message: string }).message
              : "An unexpected error occurred. Please try again later.";
          logger.error("[LINKEDIN_SEARCH] search failed after retries", {
            error: message,
            attempts,
          });
          setError(message);
          setLoading(false);
        }
      })();

      try {
        await pendingRequestRef.current;
      } finally {
        pendingRequestRef.current = null;
      }
    },
    [
      searchLinkedInSimple,
      searchLinkedInChunked,
      upsertProgress,
      completeProgress,
      unifiedDescription,
    ]
  );

  // Finalize progress when server chunking completes (chunked path)
  useEffect(() => {
    const p = lastProgressRef.current;
    if (!p?.keywordKey) return;
    if (chunkSetStatus?.isComplete) {
      (async () => {
        try {
          await upsertProgress({
            keywordKey: p.keywordKey!,
            operation: p.operation,
            phase: "finalizing",
            value: 95,
          });
          await completeProgress({
            keywordKey: p.keywordKey!,
            operation: p.operation,
          });
        } catch {}
      })();
    }
  }, [chunkSetStatus?.isComplete, upsertProgress, completeProgress]);

  const mergeResolvedChunks = useCallback(async () => {
    if (!resultsRef.current) return;
    if (!currentChunkSetId) return;
    try {
      const { tweets, count } = await consumeResolvedForSet({
        chunkSetId: currentChunkSetId,
      });
      const newPosts = (tweets || []) as unknown as UnifiedPost[];
      if (!Array.isArray(newPosts) || newPosts.length === 0) return;

      // Dedupe by id
      const existingIds = new Set(
        (resultsRef.current.posts || []).map((p) => p.id)
      );
      const deduped = newPosts.filter((p) => !existingIds.has(p.id));
      if (deduped.length === 0) return;

      setResults((prev) => {
        if (!prev) {
          return {
            posts: deduped,
            meta: { chunkSetId: currentChunkSetId, has_next_page: false },
          };
        }
        return {
          posts: [...prev.posts, ...deduped],
          meta: { ...(prev.meta || {}), chunkSetId: currentChunkSetId },
        };
      });

      const req =
        (last.current as { q: string; exact: boolean } | null) ||
        (lastRequestRef.current
          ? {
              q: lastRequestRef.current.query,
              exact: lastRequestRef.current.exact,
            }
          : null);
      if (req) {
        try {
          updateCachedLinkedInSearchResult(req.q, req.exact, (prev) => {
            if (!prev) {
              return {
                posts: deduped,
                meta: { chunkSetId: currentChunkSetId, has_next_page: false },
              };
            }
            const existing = new Set(prev.posts.map((p) => p.id));
            const dedupedForCache = deduped.filter((p) => !existing.has(p.id));
            return {
              posts: [...prev.posts, ...dedupedForCache],
              meta: { ...(prev.meta || {}), chunkSetId: currentChunkSetId },
            };
          });
        } catch {}
      }

      logger.info("[LINKEDIN_SEARCH] merged resolved chunks", {
        mergedCount: deduped.length,
        count,
      });
    } catch (err) {
      logger.error("[LINKEDIN_SEARCH] consume/merge failed", err);
    }
  }, [consumeResolvedForSet, currentChunkSetId]);

  const hasResolvedChunks = useCallback(() => {
    const resolved = (chunkSetPosts?.tweets || []) as unknown[];
    if (!resolved.length) return false;
    const existingIds = new Set(
      (resultsRef.current?.posts || []).map((p) => p.id)
    );
    for (const anyPost of resolved as unknown as UnifiedPost[]) {
      if (!existingIds.has(anyPost.id)) return true;
    }
    return false;
  }, [chunkSetPosts?.tweets]);

  const getResolvedChunkPostCount = useCallback(() => {
    const resolved = (chunkSetPosts?.tweets || []) as unknown[];
    if (!resolved.length) return 0;
    const existingIds = new Set(
      (resultsRef.current?.posts || []).map((p) => p.id)
    );
    return (resolved as unknown as UnifiedPost[]).filter(
      (p) => !existingIds.has(p.id)
    ).length;
  }, [chunkSetPosts?.tweets]);

  const clear = useCallback(() => {
    setResults(null);
    setError(null);
    setLoading(false);
    last.current = null;
    setCurrentChunkSetId(null);
  }, []);

  useEffect(() => {
    return () => {
      last.current = null;
    };
  }, []);

  useEffect(() => {
    maintainLinkedInSearchCache();
  }, []);

  useEffect(() => {
    const hasId = !!currentChunkSetId;
    const isEmpty = (resultsRef.current?.posts?.length || 0) === 0;
    const hasServer = (chunkSetStatus?.withResults || 0) > 0;
    if (hasId && isEmpty && hasServer) {
      mergeResolvedChunks();
    }
  }, [currentChunkSetId, chunkSetStatus?.withResults, mergeResolvedChunks]);

  return {
    search,
    results,
    loading,
    error,
    clear,
    // Chunked filtering helpers
    hasResolvedChunks,
    getResolvedChunkPostCount,
    mergeResolvedChunks,
    chunkProgress: {
      total: chunkSetStatus?.total || 0,
      resolved: chunkSetStatus?.resolved || 0,
      withResults: chunkSetStatus?.withResults || 0,
      isComplete: !!chunkSetStatus?.isComplete,
    },
  };
}
