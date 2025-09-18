// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { tweetValidator } from "./validators";

export default defineSchema({
  users: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
  }).index("by_workos_user_id", ["workosUserId"]),

  socialAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    screenName: v.optional(v.string()), // Twitter handle (e.g., @username)
    name: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    accessToken: v.string(), // Encrypted access token
    refreshToken: v.optional(v.string()), // Encrypted refresh token
    expiresAt: v.optional(v.number()),
    tokenType: v.optional(v.string()),
    scope: v.optional(v.string()),
  }).index("by_user_provider", ["userId", "provider"]),

  waitlist: defineTable({
    email: v.string(),
    twitter: v.optional(v.string()),
  }).index("by_email", ["email"]),

  threads: defineTable({
    threadId: v.string(),
    postedAt: v.number(),
    tweets: v.array(tweetValidator),
  })
    .index("by_threadId", ["threadId"])
    .index("by_postedAt", ["postedAt"]),

  workspaces: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.string(),
    imageUrl: v.optional(v.string()),
    isDefault: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  // Keyword History Schema - Robust design for sync and data integrity
  keywords: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),

    // Core keyword data
    keyword: v.string(),
    exactMatch: v.boolean(),

    // History tracking
    lastUsedAt: v.number(),
    searchCount: v.number(),

    // Pinned status
    isPinned: v.boolean(),
    pinnedAt: v.optional(v.number()),

    // Performance tracking
    source: v.union(
      v.literal("user_created"),
      v.literal("ai_suggestion"),
      v.literal("ai_reprompt")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("high_value"),
      v.literal("discarded")
    ),
    decayedScore: v.number(),

    // Vote tracking
    votes: v.array(
      v.object({
        vote: v.union(v.literal("up"), v.literal("down")),
        timestamp: v.number(),
        tweetId: v.optional(v.string()),
      })
    ),

    // Metadata for AI suggestions
    metadata: v.optional(v.any()),

    // Sync tracking for conflict resolution
    syncVersion: v.number(), // Incremented on each update
    lastSyncedAt: v.number(),
    syncSource: v.union(
      v.literal("local"),
      v.literal("remote"),
      v.literal("migration")
    ),

    // Migration tracking
    migratedFromLocalStorage: v.optional(v.boolean()),
    localStorageId: v.optional(v.string()), // Original localStorage ID for reference
  })
    .index("by_user_keyword", ["userId", "keyword", "exactMatch"])
    .index("by_user_last_used", ["userId", "lastUsedAt"])
    .index("by_user_pinned", ["userId", "isPinned", "pinnedAt"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_sync_version", ["userId", "syncVersion"]),

  // Sync operations log for debugging and conflict resolution
  syncOperations: defineTable({
    userId: v.id("users"),
    operationType: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("migrate"),
      v.literal("conflict_resolve")
    ),
    keywordId: v.optional(v.id("keywords")),
    localData: v.optional(v.any()), // Snapshot of local data
    remoteData: v.optional(v.any()), // Snapshot of remote data
    resolution: v.optional(v.string()), // How conflict was resolved
    timestamp: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
  })
    .index("by_user_timestamp", ["userId", "timestamp"])
    .index("by_operation_type", ["operationType", "timestamp"]),
});
