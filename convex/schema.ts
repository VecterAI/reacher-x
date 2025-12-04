// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { tweetValidator } from "./validators";

// Plan tier type for type safety
const planTierValidator = v.union(
  v.literal("free"),
  v.literal("base"),
  v.literal("pro")
);

// Agent thread type
const agentThreadTypeValidator = v.union(
  v.literal("onboarding"),
  v.literal("prospecting")
);

// Agent thread status
const agentThreadStatusValidator = v.union(
  v.literal("active"),
  v.literal("awaiting_approval"),
  v.literal("complete"),
  v.literal("failed")
);

// Agent message role
const agentMessageRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("thought") // Chain-of-thought / reasoning
);

// Prospect platform
const prospectPlatformValidator = v.union(
  v.literal("twitter"),
  v.literal("linkedin")
);

// Prospect status
const prospectStatusValidator = v.union(
  v.literal("new"),
  v.literal("reviewed"),
  v.literal("contacted"),
  v.literal("converted"),
  v.literal("archived")
);

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

  // v4: Enhanced workspaces with ICP and agent-generated content
  workspaces: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.string(), // Agent-generated, approved description
    // v4: Manual description if user wrote it themselves
    manualDescription: v.optional(v.string()),
    // v4: Ideal Customer Profile - array of target customer types
    icp: v.optional(v.array(v.string())),
    // Optional provenance for description generation
    descriptionSource: v.optional(
      v.union(v.literal("manual"), v.literal("url"), v.literal("agent"))
    ),
    sourceUrl: v.optional(v.string()),
    lastGeneratedAt: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    isDefault: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  // v4: Agent conversation threads
  agentThreads: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    type: agentThreadTypeValidator,
    status: agentThreadStatusValidator,
    // Metadata for the thread (e.g., approved ICP data, keywords)
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"])
    .index("by_workspace", ["workspaceId"]),

  // v4: Agent messages within a thread
  agentMessages: defineTable({
    threadId: v.id("agentThreads"),
    role: agentMessageRoleValidator,
    content: v.string(),
    // Tool calls, intermediate results, structured data
    toolCalls: v.optional(v.array(v.any())),
    toolResults: v.optional(v.array(v.any())),
    // For thought messages: what action/tool triggered this
    thoughtType: v.optional(v.string()),
  }).index("by_thread", ["threadId"]),

  // v4: Prospects found by the agent
  prospects: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    platform: prospectPlatformValidator,
    // External ID from the platform (tweet ID, post ID, profile ID)
    externalId: v.string(),
    // Platform-specific data (profile, post, engagement metrics)
    data: v.any(),
    // AI-generated match score (0-100)
    matchScore: v.optional(v.number()),
    // Why this prospect was matched
    matchReason: v.optional(v.string()),
    // Keywords that triggered this prospect
    matchedKeywords: v.optional(v.array(v.string())),
    status: prospectStatusValidator,
    // Notes or tags added by user
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_platform", ["workspaceId", "platform"])
    .index("by_user", ["userId"])
    .index("by_external_id", ["workspaceId", "platform", "externalId"]),

  // v4: User plans and limits
  userPlans: defineTable({
    userId: v.id("users"),
    tier: planTierValidator,
    // Limits based on tier
    prospectsLimit: v.number(), // -1 for unlimited
    workspacesLimit: v.number(),
    // Usage tracking
    currentProspectsCount: v.number(),
    currentWorkspacesCount: v.number(),
    // External subscription ID (for future billing integration)
    externalSubscriptionId: v.optional(v.string()),
    // When the plan was last updated
    updatedAt: v.number(),
    // When the plan expires (for paid plans)
    expiresAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

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

  // v4: Keywords for prospect discovery
  workspaceKeywords: defineTable({
    workspaceId: v.id("workspaces"),
    // Original seed keywords (from ICP/description analysis)
    seedKeywords: v.array(v.string()),
    // Keywords discovered via bishopi.io with metadata
    discoveredKeywords: v.array(
      v.object({
        keyword: v.string(),
        searchVolume: v.number(),
        competition: v.optional(v.number()), // 0-1 scale
        competitionLevel: v.optional(v.string()), // LOW, MEDIUM, HIGH
        cpc: v.optional(v.number()),
        trend: v.optional(
          v.object({
            monthly: v.optional(v.number()),
            quarterly: v.optional(v.number()),
            yearly: v.optional(v.number()),
          })
        ),
        keywordDifficulty: v.optional(v.number()),
        searchIntent: v.optional(v.string()), // informational, transactional, etc.
      })
    ),
    // Social media queries derived from keywords
    socialQueries: v.array(v.string()),
    // When keywords were last refreshed
    lastRefreshedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),
});
