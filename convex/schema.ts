// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { tweetValidator } from "./validators";

// ============================================================================
// Validators
// ============================================================================

// Plan tier type for type safety
const planTierValidator = v.union(
  v.literal("free"),
  v.literal("base"),
  v.literal("pro")
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

// ============================================================================
// Schema
// ============================================================================

export default defineSchema({
  // ============================================================================
  // Core User Tables
  // ============================================================================

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

  // ============================================================================
  // Workspace & Business Tables
  // ============================================================================

  /**
   * User workspaces with ICP and agent-generated content.
   * 
   * v4 fields:
   * - seedDescription: Original description from URL analysis or manual input
   * - improvedDescription: AI-enhanced version of the description
   * - icps: Array of Ideal Customer Profile segments with detailed structure
   */
  workspaces: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.string(), // Agent-generated, approved description (legacy or current)
    
    // v4 NEW: Seed description (original from URL/manual input)
    seedDescription: v.optional(v.string()),
    
    // v4 NEW: AI-enhanced description
    improvedDescription: v.optional(v.string()),
    
    // v4 NEW: Structured Ideal Customer Profiles
    icps: v.optional(
      v.array(
        v.object({
          title: v.string(), // e.g., "Solo SaaS Founders"
          description: v.string(), // Who they are
          painPoints: v.array(v.string()), // Their problems
          channels: v.array(v.string()), // Where to find them (Twitter, LinkedIn)
        })
      )
    ),
    
    // Legacy: Manual description (deprecated, use seedDescription)
    manualDescription: v.optional(v.string()),
    
    // Legacy: Simple ICP array (deprecated, use icps)
    icp: v.optional(v.array(v.string())),
    
    // Provenance for description generation
    descriptionSource: v.optional(
      v.union(v.literal("manual"), v.literal("url"), v.literal("agent"))
    ),
    sourceUrl: v.optional(v.string()),
    
    // Timestamps
    lastGeneratedAt: v.optional(v.number()),
    setupCompletedAt: v.optional(v.number()), // v4: When setup wizard finished
    
    imageUrl: v.optional(v.string()),
    isDefault: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  /**
   * Keywords for prospect discovery.
   */
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

  // ============================================================================
  // Prospect Tables
  // ============================================================================

  /**
   * Prospects found by the agent.
   */
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

  // ============================================================================
  // User Plans & Limits
  // ============================================================================

  /**
   * User subscription plans and usage limits.
   */
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

  // ============================================================================
  // Legacy/Utility Tables
  // ============================================================================

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

  // Reply Queue for Twitter/X replies
  replyQueue: defineTable({
    userId: v.id("users"),
    tweetId: v.string(), // Original tweet being replied to
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    originalTweetAuthor: v.optional(v.string()),
    replyPreview: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("retrying")
    ),
    retryCount: v.number(),
    maxRetries: v.number(),
    scheduledAt: v.number(),
    processedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    twitterReplyId: v.optional(v.string()),
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
    userSeenAt: v.optional(v.number()),
    userDismissedAt: v.optional(v.number()),
    originalTweetAuthor: v.optional(v.string()),
    replyPreview: v.optional(v.string()),
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
});
