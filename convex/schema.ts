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
});
