import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth } from "convex/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  getKeywords,
  addOrUseKeyword,
  togglePin,
  deleteKeyword,
  recordVote,
  getKeywordById,
  findKeywordByTextAndExactMatch,
  UnifiedKeyword,
} from "../lib/utils/unifiedKeywordStore";
import { useAuth } from "./useAuth";

/**
 * Hook for syncing keyword data between localStorage and Convex
 *
 * This hook provides a unified interface for keyword operations that:
 * 1. Works with localStorage for unauthenticated users
 * 2. Syncs with Convex for authenticated users
 * 3. Handles conflict resolution and data integrity
 * 4. Provides optimistic updates for better UX
 */
export function useKeywordSync() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { userId, workspace } = useAuth();

  // Convex mutations
  const upsertKeyword = useMutation(api.keywords.upsertKeyword);
  const deleteKeywordRemote = useMutation(api.keywords.deleteKeyword);
  const togglePinRemote = useMutation(api.keywords.toggleKeywordPin);
  const recordVoteRemote = useMutation(api.keywords.recordKeywordVote);
  const syncKeywords = useMutation(
    api.keywordMigration.syncKeywordsWithLocalStorage
  );
  const getKeywordsForSync = useQuery(
    api.keywordMigration.getKeywordsForLocalSync,
    isAuthenticated && userId ? { lastSyncTimestamp: 0 } : "skip"
  );

  // Local state
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInProgress = useRef(false);
  // Track in-flight upserts to dedupe rapid identical submissions
  const inflightUpsertsRef = useRef<Map<string, Promise<unknown>>>(new Map());

  // Get keywords from appropriate source
  const getKeywordsData = useCallback(() => {
    if (isAuthenticated && userId) {
      // Authenticated: UI should source from Convex via useUnifiedKeywords/useSearchHistory.
      // Return empty to avoid transient local -> remote oscillation.
      return [] as UnifiedKeyword[];
    }
    // Unauthenticated: use localStorage
    return getKeywords();
  }, [isAuthenticated, userId]);

  // Sync local changes to Convex
  const syncToConvex = useCallback(async () => {
    if (!isAuthenticated || !userId || !workspace || syncInProgress.current) {
      return;
    }

    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      const localKeywords = getKeywords();

      if (localKeywords.length > 0) {
        const result = await syncKeywords({
          localKeywords: localKeywords.map((kw) => ({
            id: kw.id,
            keyword: kw.keyword,
            exactMatch: kw.exactMatch,
            createdAt: kw.createdAt,
            lastUsedAt: kw.lastUsedAt,
            searchCount: kw.searchCount,
            isPinned: kw.isPinned,
            pinnedAt: kw.pinnedAt,
            source: kw.source,
            status: kw.status,
            votes: kw.votes,
            decayedScore: kw.decayedScore,
            metadata: kw.metadata,
          })),
          workspaceId: workspace._id,
        });

        console.log("✅ Keywords synced to Convex:", result);
      }
    } catch (error) {
      console.error("❌ Failed to sync keywords to Convex:", error);
    } finally {
      syncInProgress.current = false;
      setIsSyncing(false);
    }
  }, [isAuthenticated, userId, workspace, syncKeywords]);

  // Sync changes from Convex to local
  const syncFromConvex = useCallback(async () => {
    if (!isAuthenticated || !userId || !getKeywordsForSync) {
      return;
    }

    try {
      const remoteKeywords = getKeywordsForSync;

      if (remoteKeywords && remoteKeywords.length > 0) {
        // Update local storage with remote changes
        // This would require updating the unifiedKeywordStore
        console.log("📥 Syncing keywords from Convex:", remoteKeywords.length);
      }
    } catch (error) {
      console.error("❌ Failed to sync keywords from Convex:", error);
    }
  }, [isAuthenticated, userId, getKeywordsForSync]);

  // Unified keyword operations
  const addOrUseKeywordUnified = useCallback(
    async (
      keyword: string,
      source: UnifiedKeyword["source"] = "user_created",
      exactMatch: boolean = false,
      metadata?: UnifiedKeyword["metadata"]
    ) => {
      // Always update local storage first for optimistic updates
      const keywordId = addOrUseKeyword(keyword, source, exactMatch, metadata);

      // If authenticated, sync to Convex
      if (isAuthenticated && userId && workspace) {
        try {
          const normalized = keyword.trim().toLowerCase();
          const inflightKey = `${workspace._id}:${normalized}:${exactMatch ? 1 : 0}`;

          // If an identical upsert is already in-flight, skip starting another
          if (inflightUpsertsRef.current.has(inflightKey)) {
            return keywordId;
          }

          const promise = upsertKeyword({
            keywordData: {
              keyword,
              exactMatch,
              source,
              metadata,
            },
            updateData: {
              lastUsedAt: Date.now(),
            },
            workspaceId: workspace._id,
            syncSource: "local",
          })
            .catch((error) => {
              console.error("Failed to sync keyword to Convex:", error);
            })
            .finally(() => {
              inflightUpsertsRef.current.delete(inflightKey);
            });

          inflightUpsertsRef.current.set(inflightKey, promise);
          // Fire-and-forget to keep UI responsive; local ID is already returned
        } catch (error) {
          console.error("Failed to schedule Convex upsert:", error);
        }
      }

      return keywordId;
    },
    [isAuthenticated, userId, workspace, upsertKeyword]
  );

  const togglePinUnified = useCallback(
    async (id: string) => {
      // Authenticated path: operate on Convex directly using the provided ID
      if (isAuthenticated && userId && workspace) {
        try {
          // First attempt: assume `id` is a Convex ID (as provided by useUnifiedKeywords)
          await togglePinRemote({
            keywordId: id as Id<"keywords">,
            syncSource: "local",
          });
          return true;
        } catch (primaryError) {
          // Fallback: `id` may be a localStorage ID. Resolve via local keyword and upsert to get Convex ID
          try {
            const localKeyword = getKeywordById(id);
            if (!localKeyword) {
              throw primaryError;
            }

            const remoteId = await upsertKeyword({
              keywordData: {
                keyword: localKeyword.keyword,
                exactMatch: localKeyword.exactMatch,
                source: localKeyword.source,
                metadata: localKeyword.metadata,
              },
              updateData: {
                lastUsedAt: Date.now(),
              },
              workspaceId: workspace._id,
              syncSource: "local",
            });

            await togglePinRemote({
              keywordId: remoteId as Id<"keywords">,
              syncSource: "local",
            });
            return true;
          } catch (fallbackError) {
            console.error(
              "Failed to sync pin toggle to Convex:",
              fallbackError
            );
            return false;
          }
        }
      }

      // Unauthenticated path: localStorage only
      return togglePin(id);
    },
    [isAuthenticated, userId, workspace, upsertKeyword, togglePinRemote]
  );

  const deleteKeywordUnified = useCallback(
    async (id: string) => {
      // When authenticated, prefer Convex as source of truth.
      if (isAuthenticated && userId && workspace) {
        try {
          // First attempt: assume `id` is a Convex ID (as provided by useUnifiedKeywords)
          await deleteKeywordRemote({
            keywordId: id as Id<"keywords">,
            syncSource: "local",
          });

          // Best effort: remove locally only if this exact ID exists in local storage
          const localMatch = getKeywordById(id);
          if (localMatch) {
            deleteKeyword(id);
          }
          return true;
        } catch (primaryError) {
          // Fallback: `id` may be a localStorage ID. Resolve via local keyword and upsert to get Convex ID.
          try {
            const localKeyword = getKeywordById(id);
            if (!localKeyword) {
              throw primaryError;
            }

            const remoteId = await upsertKeyword({
              keywordData: {
                keyword: localKeyword.keyword,
                exactMatch: localKeyword.exactMatch,
                source: localKeyword.source,
                metadata: localKeyword.metadata,
              },
              updateData: {
                lastUsedAt: Date.now(),
              },
              workspaceId: workspace._id,
              syncSource: "local",
            });

            await deleteKeywordRemote({
              keywordId: remoteId as Id<"keywords">,
              syncSource: "local",
            });

            // Remove the local keyword by its local ID to keep parity
            deleteKeyword(id);
            return true;
          } catch (fallbackError) {
            console.error(
              "Failed to resolve and delete keyword in Convex:",
              fallbackError
            );
            return false;
          }
        }
      }

      // Unauthenticated: operate purely on local storage
      return deleteKeyword(id);
    },
    [isAuthenticated, userId, workspace, upsertKeyword, deleteKeywordRemote]
  );

  const recordVoteUnified = useCallback(
    async (
      keywordId: string,
      vote: "up" | "down",
      metadata?: { tweetId?: string }
    ) => {
      const isAuthed = isAuthenticated && !!userId && !!workspace;

      // Unauthenticated: local only
      if (!isAuthed) {
        return recordVote(keywordId, vote, metadata);
      }

      // Authenticated: remote only with pre-resolved Convex ID
      try {
        let remoteId: Id<"keywords">;

        // If keywordId looks like a localStorage ID (e.g., "kw_..."), upsert to get Convex ID
        if (keywordId.startsWith("kw_")) {
          const localKeyword = getKeywordById(keywordId);
          if (!localKeyword) {
            // As a fallback, try remote upsert with minimal info (will create if missing)
            const createdId = await upsertKeyword({
              keywordData: {
                keyword: keywordId, // best-effort; should rarely happen
                exactMatch: false,
                source: "user_created",
              },
              updateData: { lastUsedAt: Date.now() },
              workspaceId: workspace!._id,
              syncSource: "local",
            });
            remoteId = createdId as Id<"keywords">;
          } else {
            const createdId = await upsertKeyword({
              keywordData: {
                keyword: localKeyword.keyword,
                exactMatch: localKeyword.exactMatch,
                source: localKeyword.source,
                metadata: localKeyword.metadata,
              },
              updateData: { lastUsedAt: Date.now() },
              workspaceId: workspace!._id,
              syncSource: "local",
            });
            remoteId = createdId as Id<"keywords">;
          }
        } else {
          // Assume it's already a Convex Id
          remoteId = keywordId as Id<"keywords">;
        }

        await recordVoteRemote({
          keywordId: remoteId,
          vote,
          tweetId: metadata?.tweetId,
          syncSource: "local",
        });

        return true;
      } catch (error) {
        console.error("Failed to sync vote to Convex:", error);
        return false;
      }
    },
    [isAuthenticated, userId, workspace, recordVoteRemote, upsertKeyword]
  );

  // Auto-sync when authentication state changes
  useEffect(() => {
    if (isAuthenticated && userId && !authLoading) {
      // Sync local changes to Convex
      syncToConvex();
    }
  }, [isAuthenticated, userId, authLoading, syncToConvex]);

  // Auto-sync from Convex periodically
  useEffect(() => {
    if (!(isAuthenticated && userId)) return;

    let interval: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (document.visibilityState !== "visible") return;
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          syncFromConvex();
        }
      }, 30000);
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    start();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  }, [isAuthenticated, userId, syncFromConvex]);

  return {
    // Data
    keywords: getKeywordsData(),
    isSyncing,
    isAuthenticated,

    // Operations
    addOrUseKeyword: addOrUseKeywordUnified,
    togglePin: togglePinUnified,
    deleteKeyword: deleteKeywordUnified,
    recordVote: recordVoteUnified,

    // Sync operations
    syncToConvex,
    syncFromConvex,

    // Utilities
    findKeyword: findKeywordByTextAndExactMatch,
  };
}
