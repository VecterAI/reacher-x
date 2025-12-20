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
          // Synthetic posts: realistic tweets/posts this ICP would write
          syntheticPosts: v.optional(v.array(v.string())),
          // Keywords for qualification evidence search
          qualificationKeywords: v.optional(v.array(v.string())),
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
    
    // Continuous prospecting workflow tracking
    prospectingWorkflowId: v.optional(v.string()), // Active workflow ID from Convex Workflow
    prospectingWorkflowStatus: v.optional(
      v.union(
        v.literal("running"),
        v.literal("paused"),
        v.literal("stopped"),
        v.literal("limit_reached")
      )
    ),
    prospectingWorkflowStartedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  /**
   * Keywords for prospect discovery (row-per-keyword design).
   * Each keyword is a separate row for uniqueness enforcement and better querying.
   */
  keywords: defineTable({
    workspaceId: v.id("workspaces"),
    // Keyword type: seed (from ICP), discovered (from Bishopi), social_query (for Twitter/LinkedIn)
    type: v.union(
      v.literal("seed"),
      v.literal("discovered"),
      v.literal("social_query")
    ),
    // Normalized value for uniqueness (lowercase, trimmed)
    value: v.string(),
    // Original value before normalization (optional)
    originalValue: v.optional(v.string()),
    // Source of the keyword
    source: v.optional(v.string()), // "agent", "bishopi", "manual"
    // Status
    status: v.optional(v.union(v.literal("active"), v.literal("deprecated"))),
    // Metadata for discovered keywords (from Bishopi)
    searchVolume: v.optional(v.number()),
    competition: v.optional(v.number()), // 0-1 scale
    competitionLevel: v.optional(v.string()), // LOW, MEDIUM, HIGH
    cpc: v.optional(v.number()),
    keywordDifficulty: v.optional(v.number()),
    searchIntent: v.optional(v.string()), // informational, transactional, etc.
    trend: v.optional(
      v.object({
        monthly: v.optional(v.number()),
        quarterly: v.optional(v.number()),
        yearly: v.optional(v.number()),
      })
    ),
    // For social_query type: associated monitor ID (if any)
    monitorId: v.optional(v.string()),
    
    // =========================================================================
    // Platform-specific search tracking (for social_query type)
    // =========================================================================
    // Twitter search tracking
    lastSearchedTwitterAt: v.optional(v.number()),
    twitterResultsCount: v.optional(v.number()),
    // LinkedIn search tracking
    lastSearchedLinkedInAt: v.optional(v.number()),
    linkedinResultsCount: v.optional(v.number()),
    
    // Legacy usage stats (kept for backwards compatibility)
    resultsCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "type"])
    .index("by_workspace_value", ["workspaceId", "value"])
    .index("by_workspace_type_status", ["workspaceId", "type", "status"])
    // New indexes for efficient search tracking queries
    .index("by_workspace_type_twitter", ["workspaceId", "type", "lastSearchedTwitterAt"])
    .index("by_workspace_type_linkedin", ["workspaceId", "type", "lastSearchedLinkedInAt"]),

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
    
    // =========================================================================
    // Qualification Fields (Step 2)
    // =========================================================================
    qualificationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("qualified"),
        v.literal("disqualified")
      )
    ),
    // Qualification score (0-100, threshold ≥80 for qualified)
    qualificationScore: v.optional(v.number()),
    // When the prospect was qualified
    qualifiedAt: v.optional(v.number()),
    // Evidence posts used for qualification (max 20)
    evidencePosts: v.optional(v.array(v.any())),
    // Which searchKeywords matched in evidence
    qualificationKeywords: v.optional(v.array(v.string())),
    // Authenticity analysis for bot detection
    authenticity: v.optional(
      v.object({
        isLikelyBot: v.boolean(),
        accountAge: v.optional(v.number()), // Days since account creation
        followersCount: v.optional(v.number()),
        followingCount: v.optional(v.number()),
        engagementRate: v.optional(v.number()), // 0-1 scale
        flags: v.optional(v.array(v.string())), // Suspicious signals
      })
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_platform", ["workspaceId", "platform"])
    .index("by_user", ["userId"])
    .index("by_external_id", ["workspaceId", "platform", "externalId"])
    .index("by_workspace_qualification", ["workspaceId", "qualificationStatus"]),

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

  // ============================================================================
  // SocialAPI Monitors (Twitter 24/7 Prospecting)
  // ============================================================================

  /**
   * SocialAPI Search Query Monitors for continuous Twitter prospecting.
   * Each monitor runs searches on a schedule and sends new tweets via webhook.
   */
  socialQueryMonitors: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    // SocialAPI monitor ID (returned when creating monitor)
    monitorId: v.string(),
    // The search query being monitored
    query: v.string(),
    // Refresh frequency in seconds (default: 86400 = 24 hours)
    refreshFrequency: v.number(),
    // Monitor status
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("deleted")
    ),
    // Timestamps
    createdAt: v.number(),
    lastWebhookAt: v.optional(v.number()),
    // Stats
    totalProspectsFound: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_monitor_id", ["monitorId"])
    .index("by_workspace_status", ["workspaceId", "status"]),
});

