import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Types for keyword operations
export interface KeywordData {
  keyword: string;
  exactMatch: boolean;
  source: "user_created" | "ai_suggestion" | "ai_reprompt";
  metadata?: {
    originalKeywordId?: string;
    rationale?: string;
    searchIntent?: string;
    confidence?: number;
    [key: string]: unknown;
  };
}

export interface KeywordUpdateData {
  lastUsedAt?: number;
  searchCount?: number;
  isPinned?: boolean;
  pinnedAt?: number;
  status?: "active" | "high_value" | "discarded";
  decayedScore?: number;
  votes?: Array<{
    vote: "up" | "down";
    timestamp: number;
    tweetId?: string;
  }>;
  metadata?: {
    [key: string]: unknown;
  };
}

/**
 * Get current user's keywords with optional filtering
 */
export const getUserKeywords = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("high_value"),
        v.literal("discarded")
      )
    ),
    pinnedOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    sortBy: v.optional(
      v.union(
        v.literal("lastUsedAt"),
        v.literal("searchCount"),
        v.literal("decayedScore")
      )
    ),
  },
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

    // Build query with proper ordering
    let query = ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc");

    // Apply filters
    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    if (args.pinnedOnly) {
      query = query.filter((q) => q.eq(q.field("isPinned"), true));
    }

    // Apply limit
    const limit = args.limit || 100;
    return await query.take(limit);
  },
});

/**
 * Find a keyword by text and exact match setting
 */
export const findKeywordByText = query({
  args: {
    keyword: v.string(),
    exactMatch: v.boolean(),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
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
        return null;
      }
      workspaceId = workspace._id;
    }

    // Find keyword
    return await ctx.db
      .query("keywords")
      .withIndex("by_user_keyword", (q) =>
        q
          .eq("userId", user._id)
          .eq("keyword", args.keyword.trim().toLowerCase())
          .eq("exactMatch", args.exactMatch)
      )
      .first();
  },
});

/**
 * Add or update a keyword (upsert operation)
 */
export const upsertKeyword = mutation({
  args: {
    keywordData: v.object({
      keyword: v.string(),
      exactMatch: v.boolean(),
      source: v.union(
        v.literal("user_created"),
        v.literal("ai_suggestion"),
        v.literal("ai_reprompt")
      ),
      metadata: v.optional(v.any()),
    }),
    updateData: v.optional(
      v.object({
        lastUsedAt: v.optional(v.number()),
        searchCount: v.optional(v.number()),
        isPinned: v.optional(v.boolean()),
        pinnedAt: v.optional(v.number()),
        status: v.optional(
          v.union(
            v.literal("active"),
            v.literal("high_value"),
            v.literal("discarded")
          )
        ),
        decayedScore: v.optional(v.number()),
        votes: v.optional(
          v.array(
            v.object({
              vote: v.union(v.literal("up"), v.literal("down")),
              timestamp: v.number(),
              tweetId: v.optional(v.string()),
            })
          )
        ),
      })
    ),
    workspaceId: v.optional(v.id("workspaces")),
    syncSource: v.optional(
      v.union(v.literal("local"), v.literal("remote"), v.literal("migration"))
    ),
  },
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
    const normalizedKeyword = args.keywordData.keyword.trim().toLowerCase();

    // Check if keyword already exists
    const existing = await ctx.db
      .query("keywords")
      .withIndex("by_user_keyword", (q) =>
        q
          .eq("userId", user._id)
          .eq("keyword", normalizedKeyword)
          .eq("exactMatch", args.keywordData.exactMatch)
      )
      .first();

    if (existing) {
      // Update existing keyword
      const updateData = {
        ...args.updateData,
        lastUsedAt: args.updateData?.lastUsedAt || now,
        searchCount: (existing.searchCount || 0) + 1,
        syncVersion: existing.syncVersion + 1,
        lastSyncedAt: now,
        syncSource: args.syncSource || "remote",
      };

      await ctx.db.patch(existing._id, updateData);

      // Log sync operation
      await ctx.db.insert("syncOperations", {
        userId: user._id,
        operationType: "update",
        keywordId: existing._id,
        localData: args.updateData,
        remoteData: updateData,
        timestamp: now,
        success: true,
      });

      return existing._id;
    } else {
      // Create new keyword
      const newKeyword = {
        userId: user._id,
        workspaceId,
        keyword: normalizedKeyword,
        exactMatch: args.keywordData.exactMatch,
        lastUsedAt: args.updateData?.lastUsedAt || now,
        searchCount: args.updateData?.searchCount || 1,
        isPinned: args.updateData?.isPinned || false,
        pinnedAt: args.updateData?.pinnedAt,
        source: args.keywordData.source,
        status: args.updateData?.status || "active",
        decayedScore: args.updateData?.decayedScore || 0,
        votes: args.updateData?.votes || [],
        metadata: args.keywordData.metadata,
        syncVersion: 1,
        lastSyncedAt: now,
        syncSource: args.syncSource || "remote",
      };

      const keywordId = await ctx.db.insert("keywords", newKeyword);

      // Log sync operation
      await ctx.db.insert("syncOperations", {
        userId: user._id,
        operationType: "create",
        keywordId,
        localData: args.updateData,
        remoteData: newKeyword,
        timestamp: now,
        success: true,
      });

      return keywordId;
    }
  },
});

/**
 * Update a keyword by ID
 */
export const updateKeyword = mutation({
  args: {
    keywordId: v.id("keywords"),
    updateData: v.object({
      lastUsedAt: v.optional(v.number()),
      searchCount: v.optional(v.number()),
      isPinned: v.optional(v.boolean()),
      pinnedAt: v.optional(v.number()),
      status: v.optional(
        v.union(
          v.literal("active"),
          v.literal("high_value"),
          v.literal("discarded")
        )
      ),
      decayedScore: v.optional(v.number()),
      votes: v.optional(
        v.array(
          v.object({
            vote: v.union(v.literal("up"), v.literal("down")),
            timestamp: v.number(),
            tweetId: v.optional(v.string()),
          })
        )
      ),
      metadata: v.optional(v.any()),
    }),
    syncSource: v.optional(
      v.union(v.literal("local"), v.literal("remote"), v.literal("migration"))
    ),
  },
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

    // Get keyword and verify ownership
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword || keyword.userId !== user._id) {
      throw new Error("Keyword not found or not authorized");
    }

    const now = Date.now();
    const updateData = {
      ...args.updateData,
      syncVersion: keyword.syncVersion + 1,
      lastSyncedAt: now,
      syncSource: args.syncSource || "remote",
    };

    await ctx.db.patch(args.keywordId, updateData);

    // Log sync operation
    await ctx.db.insert("syncOperations", {
      userId: user._id,
      operationType: "update",
      keywordId: args.keywordId,
      localData: args.updateData,
      remoteData: updateData,
      timestamp: now,
      success: true,
    });

    return args.keywordId;
  },
});

/**
 * Delete a keyword
 */
export const deleteKeyword = mutation({
  args: {
    keywordId: v.id("keywords"),
    syncSource: v.optional(
      v.union(v.literal("local"), v.literal("remote"), v.literal("migration"))
    ),
  },
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

    // Get keyword and verify ownership
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword || keyword.userId !== user._id) {
      throw new Error("Keyword not found or not authorized");
    }

    await ctx.db.delete(args.keywordId);

    // Log sync operation
    await ctx.db.insert("syncOperations", {
      userId: user._id,
      operationType: "delete",
      keywordId: args.keywordId,
      localData: keyword,
      remoteData: null,
      timestamp: Date.now(),
      success: true,
    });

    return true;
  },
});

/**
 * Toggle pin status of a keyword
 */
export const toggleKeywordPin = mutation({
  args: {
    keywordId: v.id("keywords"),
    syncSource: v.optional(
      v.union(v.literal("local"), v.literal("remote"), v.literal("migration"))
    ),
  },
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

    // Get keyword and verify ownership
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword || keyword.userId !== user._id) {
      throw new Error("Keyword not found or not authorized");
    }

    const now = Date.now();
    const isPinned = !keyword.isPinned;

    await ctx.db.patch(args.keywordId, {
      isPinned,
      pinnedAt: isPinned ? now : undefined,
      syncVersion: keyword.syncVersion + 1,
      lastSyncedAt: now,
      syncSource: args.syncSource || "remote",
    });

    // Log sync operation
    await ctx.db.insert("syncOperations", {
      userId: user._id,
      operationType: "update",
      keywordId: args.keywordId,
      localData: { isPinned, pinnedAt: isPinned ? now : undefined },
      remoteData: { isPinned, pinnedAt: isPinned ? now : undefined },
      timestamp: now,
      success: true,
    });

    return { isPinned, pinnedAt: isPinned ? now : undefined };
  },
});

/**
 * Record a vote for a keyword
 */
export const recordKeywordVote = mutation({
  args: {
    keywordId: v.id("keywords"),
    vote: v.union(v.literal("up"), v.literal("down")),
    tweetId: v.optional(v.string()),
    syncSource: v.optional(
      v.union(v.literal("local"), v.literal("remote"), v.literal("migration"))
    ),
  },
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

    // Get keyword and verify ownership
    const keyword = await ctx.db.get(args.keywordId);
    if (!keyword || keyword.userId !== user._id) {
      throw new Error("Keyword not found or not authorized");
    }

    const now = Date.now();
    const newVote = {
      vote: args.vote,
      timestamp: now,
      tweetId: args.tweetId,
    };

    const updatedVotes = [...(keyword.votes || []), newVote];

    // Calculate new decayed score
    const VOTE_WEIGHTS = { up: 1, down: -1.5 };
    const DECAY_RATE = 0.05;

    let decayedScore = 0;
    updatedVotes.forEach((vote) => {
      const daysOld = (now - vote.timestamp) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-DECAY_RATE * daysOld);
      const voteValue = VOTE_WEIGHTS[vote.vote];
      decayedScore += voteValue * decayFactor;
    });

    // Determine status based on score
    let status = keyword.status;
    if (decayedScore > 2) status = "high_value";
    else if (decayedScore < -2) status = "discarded";
    else status = "active";

    await ctx.db.patch(args.keywordId, {
      votes: updatedVotes,
      decayedScore,
      status,
      syncVersion: keyword.syncVersion + 1,
      lastSyncedAt: now,
      syncSource: args.syncSource || "remote",
    });

    // Log sync operation
    await ctx.db.insert("syncOperations", {
      userId: user._id,
      operationType: "update",
      keywordId: args.keywordId,
      localData: { vote: newVote },
      remoteData: { votes: updatedVotes, decayedScore, status },
      timestamp: now,
      success: true,
    });

    return { decayedScore, status };
  },
});

/**
 * Get sync operations for debugging
 */
export const getSyncOperations = query({
  args: {
    limit: v.optional(v.number()),
    operationType: v.optional(
      v.union(
        v.literal("create"),
        v.literal("update"),
        v.literal("delete"),
        v.literal("migrate"),
        v.literal("conflict_resolve")
      )
    ),
  },
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

    let query = ctx.db
      .query("syncOperations")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", user._id))
      .order("desc");

    if (args.operationType) {
      query = query.filter((q) =>
        q.eq(q.field("operationType"), args.operationType)
      );
    }

    const limit = args.limit || 50;
    return await query.take(limit);
  },
});

/**
 * Get keyword statistics for a user
 */
export const getKeywordStats = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
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
        return null;
      }
      workspaceId = workspace._id;
    }

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const stats = {
      totalKeywords: keywords.length,
      activeKeywords: keywords.filter((k) => k.status === "active").length,
      highValueKeywords: keywords.filter((k) => k.status === "high_value")
        .length,
      discardedKeywords: keywords.filter((k) => k.status === "discarded")
        .length,
      pinnedKeywords: keywords.filter((k) => k.isPinned).length,
      totalSearches: keywords.reduce((sum, k) => sum + k.searchCount, 0),
      averageScore:
        keywords.length > 0
          ? keywords.reduce((sum, k) => sum + k.decayedScore, 0) /
            keywords.length
          : 0,
      bySource: {
        user_created: keywords.filter((k) => k.source === "user_created")
          .length,
        ai_suggestion: keywords.filter((k) => k.source === "ai_suggestion")
          .length,
        ai_reprompt: keywords.filter((k) => k.source === "ai_reprompt").length,
      },
    };

    return stats;
  },
});
