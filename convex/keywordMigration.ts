import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  migrateKeywordsFromLocalStorageArgsValidator,
  syncKeywordsWithLocalStorageArgsValidator,
  getKeywordsForLocalSyncArgsValidator,
} from "./validators";

/**
 * Migrate keyword data from localStorage to Convex
 * This handles the transition from anonymous usage to authenticated usage
 */
export const migrateKeywordsFromLocalStorage = mutation({
  args: migrateKeywordsFromLocalStorageArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get default workspace if not specified
    let workspaceId = args.workspaceId;
    if (!workspaceId) {
      const workspace = await ctx.db
        .query("workspaces")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", user._id).eq("isDefault", true)
        )
        .first();

      if (!workspace) {
        throw new Error("No workspace found");
      }
      workspaceId = workspace._id;
    }

    const now = Date.now();
    const migratedKeywords: Array<{
      localStorageId: string;
      convexId: Id<"keywords">;
    }> = [];
    const errors: string[] = [];

    // Process each keyword
    for (const keywordData of args.keywords) {
      try {
        // Check if keyword already exists (by text and exactMatch)
        const existing = await ctx.db
          .query("keywords")
          .withIndex("by_user_keyword", (q) =>
            q
              .eq("userId", user._id)
              .eq("keyword", keywordData.keyword.trim().toLowerCase())
              .eq("exactMatch", keywordData.exactMatch)
          )
          .first();

        if (existing) {
          // Merge data - keep the most recent lastUsedAt and higher searchCount
          const mergedData = {
            lastUsedAt: Math.max(existing.lastUsedAt, keywordData.lastUsedAt),
            searchCount: Math.max(
              existing.searchCount,
              keywordData.searchCount
            ),
            isPinned: existing.isPinned || keywordData.isPinned,
            pinnedAt: existing.pinnedAt || keywordData.pinnedAt,
            status: (existing.status === "high_value" ||
            keywordData.status === "high_value"
              ? "high_value"
              : existing.status === "discarded" ||
                  keywordData.status === "discarded"
                ? "discarded"
                : "active") as "active" | "high_value" | "discarded",
            decayedScore: Math.max(
              existing.decayedScore,
              keywordData.decayedScore
            ),
            votes: [...existing.votes, ...keywordData.votes].sort(
              (a, b) => a.timestamp - b.timestamp
            ),
            metadata: { ...existing.metadata, ...keywordData.metadata },
            syncVersion: existing.syncVersion + 1,
            lastSyncedAt: now,
            syncSource: "migration" as const,
            migratedFromLocalStorage: true,
            localStorageId: keywordData.id,
          };

          await ctx.db.patch(existing._id, mergedData);
          migratedKeywords.push({
            localStorageId: keywordData.id,
            convexId: existing._id,
          });

          // Log sync operation
          await ctx.db.insert("syncOperations", {
            userId: user._id,
            operationType: "migrate",
            keywordId: existing._id,
            localData: keywordData,
            remoteData: mergedData,
            resolution: "merged_existing",
            timestamp: now,
            success: true,
          });
        } else {
          // Create new keyword
          const newKeyword = {
            userId: user._id,
            workspaceId,
            keyword: keywordData.keyword.trim().toLowerCase(),
            exactMatch: keywordData.exactMatch,
            lastUsedAt: keywordData.lastUsedAt,
            searchCount: keywordData.searchCount,
            isPinned: keywordData.isPinned,
            pinnedAt: keywordData.pinnedAt,
            source: keywordData.source,
            status: keywordData.status,
            decayedScore: keywordData.decayedScore,
            votes: keywordData.votes,
            metadata: keywordData.metadata,
            syncVersion: 1,
            lastSyncedAt: now,
            syncSource: "migration" as const,
            migratedFromLocalStorage: true,
            localStorageId: keywordData.id,
          };

          const convexId = await ctx.db.insert("keywords", newKeyword);
          migratedKeywords.push({
            localStorageId: keywordData.id,
            convexId,
          });

          // Log sync operation
          await ctx.db.insert("syncOperations", {
            userId: user._id,
            operationType: "migrate",
            keywordId: convexId,
            localData: keywordData,
            remoteData: newKeyword,
            resolution: "created_new",
            timestamp: now,
            success: true,
          });
        }
      } catch (error) {
        const errorMsg = `Failed to migrate keyword "${keywordData.keyword}": ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(errorMsg);
        console.error(errorMsg, error);

        // Log failed operation
        await ctx.db.insert("syncOperations", {
          userId: user._id,
          operationType: "migrate",
          keywordId: undefined,
          localData: keywordData,
          remoteData: null,
          resolution: "failed",
          timestamp: now,
          success: false,
          error: errorMsg,
        });
      }
    }

    return {
      success: errors.length === 0,
      migratedCount: migratedKeywords.length,
      errorCount: errors.length,
      migratedKeywords,
      errors,
    };
  },
});

/**
 * Get migration status for a user
 */
export const getMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      return null;
    }

    // Get user's default workspace
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", user._id).eq("isDefault", true)
      )
      .first();

    if (!workspace) {
      return null;
    }

    // Check if user has any migrated keywords
    const migratedKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .filter((q) => q.eq(q.field("migratedFromLocalStorage"), true))
      .collect();

    // Get migration operations
    const migrationOps = await ctx.db
      .query("syncOperations")
      .withIndex("by_operation_type", (q) => q.eq("operationType", "migrate"))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .order("desc")
      .take(10);

    return {
      hasMigratedKeywords: migratedKeywords.length > 0,
      migratedKeywordCount: migratedKeywords.length,
      lastMigrationAttempt: migrationOps[0]?.timestamp || null,
      migrationSuccess: migrationOps[0]?.success || false,
      recentMigrationOps: migrationOps,
    };
  },
});

/**
 * Sync keywords between local storage and Convex
 * This handles ongoing synchronization for authenticated users
 */
export const syncKeywordsWithLocalStorage = mutation({
  args: syncKeywordsWithLocalStorageArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get default workspace if not specified
    let workspaceId = args.workspaceId;
    if (!workspaceId) {
      const workspace = await ctx.db
        .query("workspaces")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", user._id).eq("isDefault", true)
        )
        .first();

      if (!workspace) {
        throw new Error("No workspace found");
      }
      workspaceId = workspace._id;
    }

    const now = Date.now();
    const syncResults = {
      created: 0,
      updated: 0,
      conflicts: 0,
      errors: 0,
    };

    // Get all existing keywords for this user
    const existingKeywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const existingByKey = new Map(
      existingKeywords.map((k) => [`${k.keyword}:${k.exactMatch}`, k])
    );

    // Process each local keyword
    for (const localKeyword of args.localKeywords) {
      try {
        const key = `${localKeyword.keyword.trim().toLowerCase()}:${localKeyword.exactMatch}`;
        const existing = existingByKey.get(key);

        if (!existing) {
          // Create new keyword
          const newKeyword = {
            userId: user._id,
            workspaceId,
            keyword: localKeyword.keyword.trim().toLowerCase(),
            exactMatch: localKeyword.exactMatch,
            lastUsedAt: localKeyword.lastUsedAt,
            searchCount: localKeyword.searchCount,
            isPinned: localKeyword.isPinned,
            pinnedAt: localKeyword.pinnedAt,
            source: localKeyword.source,
            status: localKeyword.status,
            decayedScore: localKeyword.decayedScore,
            votes: localKeyword.votes,
            metadata: localKeyword.metadata,
            syncVersion: 1,
            lastSyncedAt: now,
            syncSource: "local" as const,
            migratedFromLocalStorage: false,
            localStorageId: localKeyword.id,
          };

          await ctx.db.insert("keywords", newKeyword);
          syncResults.created++;

          // Log sync operation
          await ctx.db.insert("syncOperations", {
            userId: user._id,
            operationType: "create",
            keywordId: undefined,
            localData: localKeyword,
            remoteData: newKeyword,
            timestamp: now,
            success: true,
          });
        } else {
          // Check for conflicts and resolve
          const hasConflict =
            existing.lastUsedAt !== localKeyword.lastUsedAt ||
            existing.searchCount !== localKeyword.searchCount ||
            existing.isPinned !== localKeyword.isPinned ||
            existing.decayedScore !== localKeyword.decayedScore;

          if (hasConflict) {
            // Resolve conflict by taking the "better" values
            const resolvedData = {
              lastUsedAt: Math.max(
                existing.lastUsedAt,
                localKeyword.lastUsedAt
              ),
              searchCount: Math.max(
                existing.searchCount,
                localKeyword.searchCount
              ),
              isPinned: existing.isPinned || localKeyword.isPinned,
              pinnedAt: existing.pinnedAt || localKeyword.pinnedAt,
              status: (existing.status === "high_value" ||
              localKeyword.status === "high_value"
                ? "high_value"
                : existing.status === "discarded" ||
                    localKeyword.status === "discarded"
                  ? "discarded"
                  : "active") as "active" | "high_value" | "discarded",
              decayedScore: Math.max(
                existing.decayedScore,
                localKeyword.decayedScore
              ),
              votes: [...existing.votes, ...localKeyword.votes]
                .sort((a, b) => a.timestamp - b.timestamp)
                .filter(
                  (vote, index, arr) =>
                    index === 0 || vote.timestamp !== arr[index - 1].timestamp
                ), // Remove duplicates
              metadata: { ...existing.metadata, ...localKeyword.metadata },
              syncVersion: existing.syncVersion + 1,
              lastSyncedAt: now,
              syncSource: "local" as const,
            };

            await ctx.db.patch(existing._id, resolvedData);
            syncResults.updated++;
            syncResults.conflicts++;

            // Log conflict resolution
            await ctx.db.insert("syncOperations", {
              userId: user._id,
              operationType: "conflict_resolve",
              keywordId: existing._id,
              localData: localKeyword,
              remoteData: resolvedData,
              resolution: "local_wins_with_merge",
              timestamp: now,
              success: true,
            });
          }
        }
      } catch (error) {
        syncResults.errors++;
        console.error(
          `Failed to sync keyword "${localKeyword.keyword}":`,
          error
        );

        // Log error
        await ctx.db.insert("syncOperations", {
          userId: user._id,
          operationType: "update",
          keywordId: undefined,
          localData: localKeyword,
          remoteData: null,
          resolution: "failed",
          timestamp: now,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return syncResults;
  },
});

/**
 * Get keywords that need to be synced to local storage
 * This returns keywords that have been updated on the server since last sync
 */
export const getKeywordsForLocalSync = query({
  args: getKeywordsForLocalSyncArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      return [];
    }

    // Get default workspace if not specified
    let workspaceId = args.workspaceId;
    if (!workspaceId) {
      const workspace = await ctx.db
        .query("workspaces")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", user._id).eq("isDefault", true)
        )
        .first();

      if (!workspace) {
        return [];
      }
      workspaceId = workspace._id;
    }

    // Get keywords updated since last sync
    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .filter((q) => q.gt(q.field("lastSyncedAt"), args.lastSyncTimestamp))
      .collect();

    return keywords.map((keyword) => ({
      id: keyword._id,
      keyword: keyword.keyword,
      exactMatch: keyword.exactMatch,
      createdAt: keyword._creationTime,
      lastUsedAt: keyword.lastUsedAt,
      searchCount: keyword.searchCount,
      isPinned: keyword.isPinned,
      pinnedAt: keyword.pinnedAt,
      source: keyword.source,
      status: keyword.status,
      votes: keyword.votes,
      decayedScore: keyword.decayedScore,
      metadata: keyword.metadata,
      syncVersion: keyword.syncVersion,
      lastSyncedAt: keyword.lastSyncedAt,
    }));
  },
});
