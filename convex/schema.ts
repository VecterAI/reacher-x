// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  tweetValidator,
  planTierValidator,
  prospectPlatformValidator,
  prospectStatusValidator,
  outreachPlanStatusValidator,
  outreachTaskTypeValidator,
  outreachTaskStatusValidator,
  prospectActivityTypeValidator,
  outreachNotificationTypeValidator as notificationTypeValidator,
  outreachNotificationStatusValidator as notificationStatusValidator,
  outreachStrategyValidator,
  outreachTaskTimingValidator,
  outreachTaskApprovalContextValidator,
  descriptionSourceValidator,
  keywordTypeValidator,
  keywordStatusValidator,
  qualificationStatusValidator,
  prospectTypeValidator,
  enrichmentStatusValidator,
  workspaceWorkflowStatusValidator,
  monitorStatusValidator,
  logLevelValidator,
  replyQueueStatusValidator,
  replyNotificationStatusValidator,
  pipelineStageValidator,
  planGenerationStatusValidator,
} from "./validators";

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
    // Cross-device tour persistence (UI state, shape varies by tour version)
    tourState: v.optional(v.any()),
  })
    .index("by_workos_user_id", ["workosUserId"])
    .index("by_email", ["email"]),

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

    // Provenance for description generation
    descriptionSource: v.optional(descriptionSourceValidator),
    sourceUrl: v.optional(v.string()),

    // Timestamps
    lastGeneratedAt: v.optional(v.number()),
    setupCompletedAt: v.optional(v.number()), // v4: When setup wizard finished

    imageUrl: v.optional(v.string()),
    isDefault: v.boolean(),
    updatedAt: v.number(),

    // Continuous prospecting workflow tracking
    prospectingWorkflowId: v.optional(v.string()), // Active workflow ID from Convex Workflow
    prospectingWorkflowStatus: v.optional(workspaceWorkflowStatusValidator),
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
    type: keywordTypeValidator,
    // Normalized value for uniqueness (lowercase, trimmed)
    value: v.string(),
    // Original value before normalization (optional)
    originalValue: v.optional(v.string()),
    // Source of the keyword
    source: v.optional(v.string()), // "agent", "bishopi", "manual"
    // Status
    status: v.optional(keywordStatusValidator),
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
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "type"])
    .index("by_workspace_value", ["workspaceId", "value"])
    .index("by_workspace_type_status", ["workspaceId", "type", "status"])
    // New indexes for efficient search tracking queries
    .index("by_workspace_type_twitter", [
      "workspaceId",
      "type",
      "lastSearchedTwitterAt",
    ])
    .index("by_workspace_type_linkedin", [
      "workspaceId",
      "type",
      "lastSearchedLinkedInAt",
    ]),

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
    // NOTE: v.any() is intentional - stores raw external API responses from Twitter/LinkedIn
    data: v.any(),

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
    qualificationStatus: v.optional(qualificationStatusValidator),
    // Qualification score (0-100, threshold ≥80 for qualified)
    qualificationScore: v.optional(v.number()),
    // When the prospect was qualified
    qualifiedAt: v.optional(v.number()),
    // Evidence posts used for qualification (max 20)
    // NOTE: v.any() is intentional - stores raw external API post data
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

    // =========================================================================
    // Enrichment Fields (Step 3)
    // =========================================================================

    // Type detection: individual person or organization/company
    prospectType: v.optional(prospectTypeValidator),

    // Core profile fields (extracted from platform data)
    displayName: v.optional(v.string()),
    title: v.optional(v.string()), // e.g., "Solo SaaS Founder"
    briefIntro: v.optional(v.string()), // 1-2 sentence summary
    company: v.optional(v.string()), // Company name/affiliation
    websiteUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    location: v.optional(v.string()),

    // Pipeline stage tracking
    pipelineStage: v.optional(pipelineStageValidator),
    // Timestamps for each pipeline stage (when the stage was reached)
    stageTimestamps: v.optional(
      v.object({
        new: v.optional(v.number()),
        contacted: v.optional(v.number()),
        in_progress: v.optional(v.number()),
        converted: v.optional(v.number()),
        archived: v.optional(v.number()),
      })
    ),

    // Finance data with evidence tracking
    finance: v.optional(
      v.object({
        displayValue: v.string(), // e.g., "$9000-$14000"
        type: v.optional(v.string()), // "mrr", "arr", "revenue", "funding"
        amount: v.optional(v.number()),
        currency: v.optional(v.string()),
        evidencePosts: v.array(v.any()), // Posts where this was mentioned
      })
    ),

    // Pain points with solution matching (Value Proposition Canvas)
    painPoints: v.optional(
      v.array(
        v.object({
          pain: v.string(),
          solution: v.optional(v.string()), // Matched from ICP or "-"
          evidencePosts: v.array(v.any()), // Posts where pain was mentioned
        })
      )
    ),

    // Social profiles for cross-platform (future use)
    socialProfiles: v.optional(
      v.object({
        twitter: v.optional(
          v.object({
            username: v.string(),
            url: v.string(),
            profileId: v.optional(v.string()),
          })
        ),
        linkedin: v.optional(
          v.object({
            username: v.string(),
            url: v.string(),
            urn: v.optional(v.string()),
          })
        ),
      })
    ),

    // Enrichment metadata
    enrichedAt: v.optional(v.number()),
    enrichmentStatus: v.optional(enrichmentStatusValidator),

    // Auto outreach plan generation status (for >= 90 score prospects)
    planGenerationStatus: v.optional(planGenerationStatusValidator),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_platform", ["workspaceId", "platform"])
    .index("by_user", ["userId"])
    .index("by_external_id", ["workspaceId", "platform", "externalId"])
    .index("by_workspace_qualification", ["workspaceId", "qualificationStatus"])
    .index("by_workspace_enrichment", ["workspaceId", "enrichmentStatus"]),

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
    status: replyQueueStatusValidator,
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
    status: replyNotificationStatusValidator,
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
    level: logLevelValidator,
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
    status: monitorStatusValidator,
    // Timestamps
    lastWebhookAt: v.optional(v.number()),
    // Stats
    totalProspectsFound: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_monitor_id", ["monitorId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  /**
   * Prospect Monitors for tracking responses via SocialAPI User Tweets Monitor.
   * Created after posting an outreach comment to detect when prospect responds.
   */
  prospectMonitors: defineTable({
    // Links to the prospect we're monitoring
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    // SocialAPI monitor ID (returned when creating user-tweets monitor)
    monitorId: v.string(),
    // The prospect's Twitter user ID being monitored
    monitoredUserId: v.string(),
    monitoredUsername: v.string(),
    // Link to the outreach plan that triggered this monitor
    planId: v.optional(v.id("outreachPlans")),
    // The tweet ID we're watching for replies to
    ourTweetId: v.optional(v.string()),
    // Monitor status
    status: monitorStatusValidator,
    // Timestamps
    lastWebhookAt: v.optional(v.number()),
    // Expiration (auto-delete after plan completes or timeout)
    expiresAt: v.optional(v.number()),
  })
    .index("by_prospect", ["prospectId"])
    .index("by_monitor_id", ["monitorId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_plan", ["planId"]),

  // ============================================================================
  // Outreach System Tables
  // ============================================================================

  /**
   * Outreach plans for prospects.
   * One active plan per prospect at a time.
   */
  outreachPlans: defineTable({
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    status: outreachPlanStatusValidator,
    // Strategy generated by the agent
    strategy: outreachStrategyValidator,
    // Agent thread for plan refinement
    threadId: v.optional(v.string()),
    // SocialAPI User Tweets Monitor ID for response detection
    activeMonitorId: v.optional(v.string()),
    // Workflow ID for sendEvent (to resume after human approval)
    workflowId: v.optional(v.string()),
    // Plan versioning
    version: v.number(),
    updatedAt: v.number(),
  })
    .index("by_prospect", ["prospectId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_user", ["userId"]),

  /**
   * Individual tasks within an outreach plan.
   */
  outreachTasks: defineTable({
    planId: v.id("outreachPlans"),
    order: v.number(),
    type: outreachTaskTypeValidator,
    description: v.string(),
    status: outreachTaskStatusValidator,
    // Timing configuration
    timing: outreachTaskTimingValidator,
    // Target tweet for comment tasks
    targetTweetId: v.optional(v.string()),
    // Content for comment tasks
    content: v.optional(v.string()),
    // Optional media edits attached during approval before posting
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    // Snapshot for deterministic panel hydration/reopen
    approvalContext: v.optional(outreachTaskApprovalContextValidator),
    // Execution tracking
    scheduledAt: v.optional(v.number()),
    executedAt: v.optional(v.number()),
    // Result data (e.g., posted tweet ID)
    resultData: v.optional(v.any()),
    // Error message if failed
    errorMessage: v.optional(v.string()),
  })
    .index("by_plan", ["planId"])
    .index("by_plan_status", ["planId", "status"])
    .index("by_plan_order", ["planId", "order"])
    .index("by_target_tweet", ["targetTweetId"]),

  /**
   * Activity log for prospects (timeline).
   */
  prospectActivityLog: defineTable({
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    type: prospectActivityTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    // Additional metadata (e.g., plan ID, task ID)
    metadata: v.optional(v.any()),
  })
    .index("by_prospect", ["prospectId"])
    .index("by_workspace", ["workspaceId"]),

  /**
   * Unified notifications for the outreach system.
   */
  outreachNotifications: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    type: notificationTypeValidator,
    title: v.string(),
    message: v.string(),
    status: notificationStatusValidator,
    // Optional references
    prospectId: v.optional(v.id("prospects")),
    planId: v.optional(v.id("outreachPlans")),
    taskId: v.optional(v.id("outreachTasks")),
    // Denormalized prospect data for efficient display
    prospectAvatarUrl: v.optional(v.string()),
    prospectDisplayName: v.optional(v.string()),
    prospectType: v.optional(prospectTypeValidator),
    prospectScreenName: v.optional(v.string()),
    replyCount: v.optional(v.number()),
    // For ask_human: tool call and thread context
    toolCallId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    // Timestamps
    seenAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_workspace", ["workspaceId"]),
});
