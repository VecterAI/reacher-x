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
    onboardingCompletedAt: v.optional(v.number()),
    // Cross-device tour persistence
    tourState: v.optional(v.any()),
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
    // Profile refresh + rate limit backoff metadata
    lastProfileRefreshedAt: v.optional(v.number()),
    rateLimitResetAt: v.optional(v.number()),
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
    // Optional provenance for description generation
    descriptionSource: v.optional(
      v.union(v.literal("manual"), v.literal("url"))
    ),
    sourceUrl: v.optional(v.string()),
    lastGeneratedAt: v.optional(v.number()),
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

  // Per-keyword search progress (reactive, ephemeral)
  search_progress: defineTable({
    // String key to support local-first keywords before a Convex Id exists
    keywordKey: v.string(),
    // Operation type: initial search vs pagination
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    // Lifecycle phase for UX mapping
    phase: v.union(
      v.literal("queued"),
      v.literal("searching"),
      v.literal("chunking"),
      v.literal("filtering"),
      v.literal("finalizing"),
      v.literal("complete")
    ),
    // 0-100 progress value
    value: v.number(),
    // Whether the progress is complete (used to hide in UI)
    isComplete: v.boolean(),
    // Updated timestamp for picking the freshest progress when multiple exist
    updatedAt: v.number(),
  })
    .index("by_keyword", ["keywordKey"])
    .index("by_keyword_operation", ["keywordKey", "operation"]),

  // Keyword Suggestions Schema - persisted suggestions for authenticated users
  keywordSuggestions: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    keyword: v.string(),
    isUsed: v.boolean(),
    generatedAt: v.number(),
    usedAt: v.optional(v.number()),
    userDescription: v.optional(v.string()),
    batchRequestId: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        source: v.optional(v.string()),
        generatedAt: v.optional(v.number()),
        usedFallback: v.optional(v.boolean()),
        exactMatch: v.optional(v.boolean()),
        // Verification proof fields
        verificationScore: v.optional(v.number()), // Grok score 0-100
        examplesCount: v.optional(v.number()), // Number of example tweets Grok surfaced
        validatedAt: v.optional(v.number()), // When Grok validated
        validationModel: v.optional(v.string()), // e.g., grok-4-fast-reasoning
        resultCount: v.optional(v.number()), // Our post-check result count from twitterSearch
        // Provenance marker for battle-tested generation path
        battleTested: v.optional(v.boolean()),
      })
    ),
  })
    .index("by_workspace_isUsed_generatedAt", [
      "workspaceId",
      "isUsed",
      "generatedAt",
    ])
    .index("by_workspace_description_isUsed_generatedAt", [
      "workspaceId",
      "userDescription",
      "isUsed",
      "generatedAt",
    ])
    .index("by_user", ["userId"]),

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

  // Reply Queue for Twitter/X replies
  replyQueue: defineTable({
    userId: v.id("users"),
    tweetId: v.string(), // Original tweet being replied to
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())), // Descriptions for each media item
    originalTweetAuthor: v.optional(v.string()), // For better notification UX
    replyPreview: v.optional(v.string()), // First 50 chars of reply text
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("retrying")
    ),
    retryCount: v.number(),
    maxRetries: v.number(),
    scheduledAt: v.number(), // When to process
    processedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    twitterReplyId: v.optional(v.string()), // Successfully posted reply ID
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_scheduled", ["scheduledAt", "status"]),

  // User notification state tracking
  userNotificationState: defineTable({
    userId: v.id("users"),
    replyId: v.id("replyQueue"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    userSeenAt: v.optional(v.number()), // When user last saw this notification
    userDismissedAt: v.optional(v.number()), // When user dismissed it
    originalTweetAuthor: v.optional(v.string()), // For better UX
    replyPreview: v.optional(v.string()), // First 50 chars of reply text
  })
    .index("by_user_reply", ["userId", "replyId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_unseen", ["userId", "userSeenAt"]),

  // Reply Queue Logs for debugging and monitoring
  replyQueueLogs: defineTable({
    queueId: v.id("replyQueue"),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_queue_id", ["queueId"]),

  // Media uploads for temporary storage
  mediaUploads: defineTable({
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    uploadedAt: v.number(),
  }).index("by_uploaded_at", ["uploadedAt"]),

  // removed: server-side cachedProfiles table (client LRU/TTL handles caching)
  searchChunkSets: defineTable({
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    chunkSetId: v.string(),
    total: v.number(),
    resolved: v.number(),
    withResults: v.number(),
    isComplete: v.boolean(),
  })
    .index("by_set", ["chunkSetId"])
    .index("by_keyword_operation", ["keywordKey", "operation"]),

  searchChunkResults: defineTable({
    chunkSetId: v.string(),
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    chunkIndex: v.number(),
    tweets: v.array(v.any()),
    originalCount: v.number(),
    filteredCount: v.number(),
    mergedAt: v.optional(v.number()),
  })
    .index("by_set_index", ["chunkSetId", "chunkIndex"])
    .index("by_set", ["chunkSetId"]),
});
