// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  icpValidator,
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
  prospectActivityMetadataValidator,
  descriptionSourceValidator,
  keywordTypeValidator,
  keywordStatusValidator,
  qualificationStatusValidator,
  prospectTypeValidator,
  enrichmentStatusValidator,
  workspaceWorkflowStatusValidator,
  workspaceOnboardingIssueSourceValidator,
  workspaceOnboardingIssueStatusCodeValidator,
  monitorStatusValidator,
  monitorHealthStatusValidator,
  pipelineStageValidator,
  planGenerationStatusValidator,
  outreachPlanArchiveHoldValidator,
  hourlyAnalyticsCountsValidator,
  readModelRolloutScopeValidator,
  readModelRolloutStatusValidator,
  memorySourceTypeValidator,
  memoryEvaluatorRunStatusValidator,
  memorySuggestionStatusValidator,
  memoryWorkflowEventStatusValidator,
  memoryWorkflowEventTypeValidator,
  workspaceUseCaseKeyValidator,
  refineRollbackSnapshotValidator,
  queryCandidateDuplicateReasonValidator,
  queryCandidateStatusValidator,
  queryCandidateTypeValidator,
  setupSessionModeValidator,
  setupSessionStatusValidator,
  setupSessionPreferenceValidator,
  setupProspectOriginValidator,
  workspaceMemoryCategoryValidator,
  workspaceMemorySourceValidator,
  twitterActionRiskLevelValidator,
  twitterActionProviderValidator,
  twitterActionApprovalModeValidator,
  twitterActionEntityTypeValidator,
  twitterActionUiArtifactTypeValidator,
  twitterActionRequestStatusValidator,
  twitterActionArgumentsSnapshotValidator,
  twitterActionErrorSummaryValidator,
  twitterActionResultSummaryValidator,
  twitterPostRefValidator,
  twitterPostSummaryValidator,
  twitterInteractionDiscoverySourceValidator,
  twitterInteractionOriginValidator,
  twitterConversationParticipantValidator,
  xAccountStatusValidator,
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

  xAccounts: defineTable({
    userId: v.id("users"),
    xUserId: v.string(),
    username: v.string(),
    displayName: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    grantedScopes: v.array(v.string()),
    tokenType: v.string(),
    status: xAccountStatusValidator,
    lastVerifiedAt: v.optional(v.number()),
    lastRefreshAttemptAt: v.optional(v.number()),
    lastRefreshError: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_x_user_id", ["xUserId"]),

  xAuthSessions: defineTable({
    userId: v.id("users"),
    state: v.string(),
    redirectUri: v.string(),
    codeVerifier: v.string(),
    expiresAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_state", ["state"])
    .index("by_user_expires_at", ["userId", "expiresAt"]),

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
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),

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
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),

    imageUrl: v.optional(v.string()),
    isDefault: v.boolean(),
    updatedAt: v.number(),

    // Continuous prospecting workflow tracking
    prospectingWorkflowId: v.optional(v.string()), // Active workflow ID from Convex Workflow
    prospectingWorkflowStatus: v.optional(workspaceWorkflowStatusValidator),
    prospectingWorkflowStartedAt: v.optional(v.number()),

    // Persisted internal onboarding issue state (for safe user-visible mapping)
    onboardingIssueStatusCode: v.optional(
      workspaceOnboardingIssueStatusCodeValidator
    ),
    onboardingIssueSource: v.optional(workspaceOnboardingIssueSourceValidator),
    onboardingIssueUpdatedAt: v.optional(v.number()),
    // Setup thread that created/updated this workspace (used to restore onboarding UI context)
    onboardingThreadId: v.optional(v.string()),

    /** Previous config after last successful refine; used for Base/Pro rollback. */
    refineRollbackSnapshot: v.optional(refineRollbackSnapshotValidator),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  /**
   * Canonical onboarding/setup session state.
   * Drafts live here until a real workspace is provisioned and the first ready
   * onboarding step completes.
   */
  workspaceSetupSessions: defineTable({
    userId: v.id("users"),
    mode: setupSessionModeValidator,
    status: setupSessionStatusValidator,
    setupThreadId: v.string(),
    workflowId: v.optional(v.string()),
    useCaseKey: workspaceUseCaseKeyValidator,
    draftOrdinal: v.number(),
    draftName: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    seedDescription: v.optional(v.string()),
    improvedDescription: v.optional(v.string()),
    generatedProfiles: v.optional(v.array(icpValidator)),
    connectionsCompletedAt: v.optional(v.number()),
    planChoice: v.optional(planTierValidator),
    preferenceChoice: v.optional(setupSessionPreferenceValidator),
    existingWorkspaceId: v.optional(v.id("workspaces")),
    targetWorkspaceId: v.optional(v.id("workspaces")),
    /** True when session was created from /workspace Refine audience (skip post-preview onboarding). */
    refineFromWorkspace: v.optional(v.boolean()),
    previewDiscoveryStartedAt: v.optional(v.number()),
    previewProspectIds: v.optional(v.array(v.id("prospects"))),
    previewReadyAt: v.optional(v.number()),
    previewApprovedAt: v.optional(v.number()),
    generationRequestedAt: v.optional(v.number()),
    generationCompletedAt: v.optional(v.number()),
    generationErrorAt: v.optional(v.number()),
    lastAgentActionAt: v.optional(v.number()),
    lastUserActionAt: v.optional(v.number()),
    lastActiveAt: v.optional(v.number()),
    statusUpdatedAt: v.number(),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    discardedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_last_active", ["userId", "lastActiveAt"])
    .index("by_setup_thread", ["setupThreadId"])
    .index("by_target_workspace", ["targetWorkspaceId"])
    .index("by_existing_workspace", ["existingWorkspaceId"]),

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
    // Canonical identity used by the memory system for deterministic uniqueness.
    canonicalValue: v.optional(v.string()),
    canonicalHash: v.optional(v.string()),
    canonicalKey: v.optional(v.string()),
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
    // Links active execution state back to the originating memory candidate.
    activatedQueryCandidateId: v.optional(v.id("queryCandidates")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "type"])
    .index("by_workspace_value", ["workspaceId", "value"])
    .index("by_workspace_canonical_hash", ["workspaceId", "canonicalHash"])
    .index("by_workspace_canonical_key", ["workspaceId", "canonicalKey"])
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
    origin: setupProspectOriginValidator,
    setupSessionId: v.optional(v.id("workspaceSetupSessions")),
    setupRevision: v.optional(v.number()),
    previewSelectedAt: v.optional(v.number()),
    previewRank: v.optional(v.number()),
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

    // Durable workflow IDs for cancel-on-archive (mirrors outreachPlans.workflowId pattern)
    qualificationWorkflowId: v.optional(v.string()),
    enrichmentWorkflowId: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_origin", ["workspaceId", "origin"])
    .index("by_workspace_origin_revision", [
      "workspaceId",
      "origin",
      "setupRevision",
    ])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_platform", ["workspaceId", "platform"])
    .index("by_user", ["userId"])
    .index("by_external_id", ["workspaceId", "platform", "externalId"])
    .index("by_setup_session_revision", ["setupSessionId", "setupRevision"])
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
    /** Polar customer UUID for server-side order history and billing APIs */
    polarCustomerId: v.optional(v.string()),
    // When the plan was last updated
    updatedAt: v.number(),
    // When the plan expires (for paid plans)
    expiresAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  /**
   * Snapshotted usage per billing or calendar cycle for the Plans page.
   */
  planUsageCycles: defineTable({
    userId: v.id("users"),
    tier: planTierValidator,
    cycleStart: v.number(),
    cycleEnd: v.number(),
    prospectsUsed: v.number(),
    prospectsLimit: v.number(),
    workspacesUsed: v.number(),
    workspacesLimit: v.number(),
    isCurrent: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_user_cycle_start", ["userId", "cycleStart"])
    .index("by_user_is_current", ["userId", "isCurrent"]),

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
    keywordId: v.optional(v.id("keywords")),
    queryCandidateId: v.optional(v.id("queryCandidates")),
    // SocialAPI monitor ID (returned when creating monitor)
    monitorId: v.string(),
    // The search query being monitored
    query: v.string(),
    // Refresh frequency in seconds (default: 86400 = 24 hours)
    refreshFrequency: v.number(),
    // Monitor status
    status: monitorStatusValidator,
    healthStatus: v.optional(monitorHealthStatusValidator),
    // Timestamps
    lastWebhookAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastErrorAt: v.optional(v.number()),
    lastErrorMessage: v.optional(v.string()),
    failureCount: v.optional(v.number()),
    // Stats
    totalProspectsFound: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_monitor_id", ["monitorId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_health", ["workspaceId", "healthStatus"])
    .index("by_keyword", ["keywordId"]),

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

  socialApiBudgetState: defineTable({
    provider: v.string(),
    nextAvailableAt: v.number(),
    updatedAt: v.number(),
    lastConsumer: v.optional(v.string()),
  }).index("by_provider", ["provider"]),

  /**
   * Canonical relationship table between prospects and agent threads.
   * Thread titles may stay human-readable, but this mapping is the source of truth.
   */
  prospectThreads: defineTable({
    prospectId: v.id("prospects"),
    threadId: v.string(),
    userId: v.id("users"),
  })
    .index("by_prospect", ["prospectId"])
    .index("by_thread", ["threadId"])
    .index("by_user", ["userId"]),

  /**
   * Lightweight prospect list-card read model.
   * Keeps shell/list queries off the heavyweight prospects table.
   */
  prospectSummaries: defineTable({
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    platform: prospectPlatformValidator,
    origin: setupProspectOriginValidator,
    setupSessionId: v.optional(v.id("workspaceSetupSessions")),
    setupRevision: v.optional(v.number()),
    previewSelectedAt: v.optional(v.number()),
    previewRank: v.optional(v.number()),
    status: prospectStatusValidator,
    qualificationStatus: v.optional(qualificationStatusValidator),
    enrichmentStatus: v.optional(enrichmentStatusValidator),
    planGenerationStatus: v.optional(planGenerationStatusValidator),
    readyQualifiedEnriched: v.boolean(),
    sortQualificationScore: v.number(),
    qualificationScore: v.optional(v.number()),
    prospectCreatedAt: v.number(),
    updatedAt: v.number(),
    displayName: v.string(),
    title: v.optional(v.string()),
    briefIntro: v.optional(v.string()),
    matchedKeywords: v.optional(v.array(v.string())),
    location: v.optional(v.string()),
    financeDisplayValue: v.optional(v.string()),
    prospectType: v.optional(prospectTypeValidator),
    avatarUrl: v.optional(v.string()),
    profileUrl: v.optional(v.string()),
    twitterUsername: v.optional(v.string()),
    linkedInUsername: v.optional(v.string()),
    verified: v.boolean(),
    conversationPlaceholderLabel: v.string(),
  })
    .index("by_prospect", ["prospectId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_setup_session_revision", ["setupSessionId", "setupRevision"])
    .index("by_workspace_score", [
      "workspaceId",
      "sortQualificationScore",
      "prospectCreatedAt",
    ])
    .index("by_workspace_ready_score", [
      "workspaceId",
      "readyQualifiedEnriched",
      "sortQualificationScore",
      "prospectCreatedAt",
    ])
    .index("by_workspace_status_score", [
      "workspaceId",
      "status",
      "sortQualificationScore",
      "prospectCreatedAt",
    ])
    .index("by_workspace_status_ready_score", [
      "workspaceId",
      "status",
      "readyQualifiedEnriched",
      "sortQualificationScore",
      "prospectCreatedAt",
    ])
    .index("by_workspace_platform_score", [
      "workspaceId",
      "platform",
      "sortQualificationScore",
      "prospectCreatedAt",
    ])
    .index("by_workspace_platform_ready_score", [
      "workspaceId",
      "platform",
      "readyQualifiedEnriched",
      "sortQualificationScore",
      "prospectCreatedAt",
    ])
    .index("by_workspace_platform_status_score", [
      "workspaceId",
      "platform",
      "status",
      "sortQualificationScore",
      "prospectCreatedAt",
    ])
    .index("by_workspace_platform_status_ready_score", [
      "workspaceId",
      "platform",
      "status",
      "readyQualifiedEnriched",
      "sortQualificationScore",
      "prospectCreatedAt",
    ]),

  /**
   * Per-user stable feed anchor for prospect list tabs (prevents new rows from
   * reordering the visible list until the user merges pending items).
   */
  prospectListFeedAnchors: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    status: prospectStatusValidator,
    anchorSortScore: v.number(),
    anchorProspectCreatedAt: v.number(),
    anchorProspectId: v.optional(v.id("prospects")),
    updatedAt: v.number(),
  }).index("by_user_workspace_status", ["userId", "workspaceId", "status"]),

  /**
   * Per-user "opened profile" for prospect list unread styling.
   */
  prospectViews: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    prospectId: v.id("prospects"),
    openedAt: v.number(),
  })
    .index("by_user_prospect", ["userId", "prospectId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  /**
   * Per-workspace shell/onboarding/count snapshot read model.
   */
  workspaceStats: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    totalProspectsCount: v.number(),
    newProspectsCount: v.number(),
    contactedProspectsCount: v.number(),
    inProgressProspectsCount: v.number(),
    convertedProspectsCount: v.number(),
    archivedProspectsCount: v.number(),
    twitterProspectsCount: v.number(),
    linkedInProspectsCount: v.number(),
    qualifiedProspectsCount: v.number(),
    enrichedProspectsCount: v.number(),
    plansGeneratedCount: v.number(),
    readyQualifiedEnrichedCount: v.number(),
    qualificationScoreSum: v.number(),
    qualificationScoreCount: v.number(),
    avgQualificationScore: v.number(),
    pendingNotificationCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"]),

  /**
   * Per-workspace, per-UTC-day analytics rollups.
   * Hourly arrays preserve today/1d analytics without raw prospect/log scans.
   */
  workspaceAnalyticsDaily: defineTable({
    workspaceId: v.id("workspaces"),
    dayStartUtcMs: v.number(),
    dayKey: v.string(),
    newProspectsCount: v.number(),
    reachedContactedProspectsCount: v.number(),
    reachedInProgressProspectsCount: v.number(),
    reachedConvertedProspectsCount: v.number(),
    fitScore0To49Count: v.number(),
    fitScore50To69Count: v.number(),
    fitScore70To79Count: v.number(),
    fitScore80To100Count: v.number(),
    qualificationQualifiedCount: v.optional(v.number()),
    qualificationDisqualifiedCount: v.optional(v.number()),
    twitterProspectsCount: v.number(),
    linkedInProspectsCount: v.number(),
    contactedEventsCount: v.number(),
    respondedEventsCount: v.number(),
    draftPlansCount: v.number(),
    pendingApprovalTasksCount: v.number(),
    pausedPlansCount: v.number(),
    blockedAuthPlansCount: v.number(),
    failedTasksCount: v.number(),
    hourlyNewProspectsCounts: hourlyAnalyticsCountsValidator,
    hourlyContactedEventsCounts: hourlyAnalyticsCountsValidator,
    hourlyRespondedEventsCounts: hourlyAnalyticsCountsValidator,
    hourlyDraftPlansCounts: hourlyAnalyticsCountsValidator,
    hourlyPendingApprovalTasksCounts: hourlyAnalyticsCountsValidator,
    hourlyPausedPlansCounts: hourlyAnalyticsCountsValidator,
    hourlyBlockedAuthPlansCounts: hourlyAnalyticsCountsValidator,
    hourlyFailedTasksCounts: hourlyAnalyticsCountsValidator,
    updatedAt: v.number(),
  }).index("by_workspace_day", ["workspaceId", "dayStartUtcMs"]),

  /**
   * Durable read-model rollout tracking for explicit backfill/reconciliation runs.
   * This keeps workflow progress queryable without depending on raw workflow storage.
   */
  readModelRollouts: defineTable({
    userId: v.id("users"),
    scope: readModelRolloutScopeValidator,
    requestedWorkspaceId: v.optional(v.id("workspaces")),
    workflowId: v.optional(v.string()),
    status: readModelRolloutStatusValidator,
    totalWorkspaceCount: v.number(),
    processedWorkspaceCount: v.number(),
    currentWorkspaceId: v.optional(v.id("workspaces")),
    lastCompletedWorkspaceId: v.optional(v.id("workspaces")),
    rebuiltProspectSummariesCount: v.number(),
    rebuiltWorkspaceStatsCount: v.number(),
    rebuiltAnalyticsRowsCount: v.number(),
    processedActivityLogsCount: v.number(),
    processedPlansCount: v.number(),
    processedNotificationsCount: v.number(),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cleanupScheduledAt: v.optional(v.number()),
    cleanedUpAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_workflow", ["workflowId"]),

  /**
   * Candidate discovery terms before or after activation, with deterministic
   * canonical identity for novelty gates and future evaluator loops.
   */
  queryCandidates: defineTable({
    workspaceId: v.id("workspaces"),
    type: queryCandidateTypeValidator,
    rawValue: v.string(),
    canonicalValue: v.string(),
    canonicalHash: v.string(),
    canonicalKey: v.string(),
    sourceTheme: v.optional(v.string()),
    sourceRunId: v.optional(v.string()),
    noveltyScore: v.optional(v.number()),
    status: queryCandidateStatusValidator,
    duplicateReason: v.optional(queryCandidateDuplicateReasonValidator),
    performanceScore: v.optional(v.number()),
    activatedKeywordId: v.optional(v.id("keywords")),
    embeddingDocKey: v.string(),
    updatedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    lastEvaluatedAt: v.optional(v.number()),
    retiredAt: v.optional(v.number()),
  })
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_type_status", ["workspaceId", "type", "status"])
    .index("by_workspace_canonical_hash", ["workspaceId", "canonicalHash"])
    .index("by_workspace_canonical_key", ["workspaceId", "canonicalKey"])
    .index("by_workspace_updated_at", ["workspaceId", "updatedAt"]),

  /**
   * Longitudinal performance metrics for active queries.
   */
  queryPerformance: defineTable({
    workspaceId: v.id("workspaces"),
    queryId: v.id("keywords"),
    canonicalValue: v.string(),
    canonicalHash: v.string(),
    activatedQueryCandidateId: v.optional(v.id("queryCandidates")),
    impressions: v.number(),
    prospectsFound: v.number(),
    qualifiedCount: v.number(),
    convertedCount: v.number(),
    replyCount: v.number(),
    replyRate: v.number(),
    qualificationRate: v.number(),
    lastUsedAt: v.optional(v.number()),
    retiredAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_workspace_query_id", ["workspaceId", "queryId"])
    .index("by_workspace_canonical_hash", ["workspaceId", "canonicalHash"])
    .index("by_workspace_updated_at", ["workspaceId", "updatedAt"]),

  /**
   * Durable evaluator input queue and audit log for pipeline outcome events.
   */
  memoryWorkflowEvents: defineTable({
    workspaceId: v.id("workspaces"),
    eventType: memoryWorkflowEventTypeValidator,
    status: memoryWorkflowEventStatusValidator,
    sourceType: memorySourceTypeValidator,
    sourceId: v.string(),
    eventKey: v.string(),
    workflowName: v.optional(v.string()),
    prospectId: v.optional(v.id("prospects")),
    planId: v.optional(v.id("outreachPlans")),
    taskId: v.optional(v.id("outreachTasks")),
    queryCandidateId: v.optional(v.id("queryCandidates")),
    queryId: v.optional(v.id("keywords")),
    payload: v.optional(v.any()),
    occurredAt: v.number(),
    processedAt: v.optional(v.number()),
    evaluatorWorkflowId: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_event_key", ["eventKey"])
    .index("by_workspace_occurred_at", ["workspaceId", "occurredAt"])
    .index("by_workspace_status_occurred_at", [
      "workspaceId",
      "status",
      "occurredAt",
    ])
    .index("by_workspace_event_type_occurred_at", [
      "workspaceId",
      "eventType",
      "occurredAt",
    ])
    .index("by_prospect_occurred_at", ["prospectId", "occurredAt"])
    .index("by_plan_occurred_at", ["planId", "occurredAt"]),

  /**
   * Suggested memories awaiting promotion or rejection.
   * This stays intentionally minimal so promoted memories still live in the
   * built-in Agent component `memories` table.
   */
  memorySuggestions: defineTable({
    workspaceId: v.id("workspaces"),
    eventId: v.optional(v.id("memoryWorkflowEvents")),
    runId: v.optional(v.string()),
    source: workspaceMemorySourceValidator,
    category: workspaceMemoryCategoryValidator,
    identityHash: v.string(),
    title: v.string(),
    summary: v.string(),
    confidence: v.number(),
    impactScore: v.number(),
    prospectId: v.optional(v.id("prospects")),
    planId: v.optional(v.id("outreachPlans")),
    taskId: v.optional(v.id("outreachTasks")),
    signals: v.array(v.string()),
    evidence: v.array(v.string()),
    relatedQueries: v.array(v.string()),
    narrative: v.string(),
    status: memorySuggestionStatusValidator,
    promotedMemoryId: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_workspace_status_updated_at", [
      "workspaceId",
      "status",
      "updatedAt",
    ])
    .index("by_event", ["eventId"])
    .index("by_workspace_identity_hash", ["workspaceId", "identityHash"]),

  /**
   * Durable evaluator workflow tracking for memory distillation and
   * performance updates derived from pipeline outcomes.
   */
  memoryEvaluatorRuns: defineTable({
    workspaceId: v.id("workspaces"),
    eventId: v.id("memoryWorkflowEvents"),
    eventKey: v.string(),
    eventType: memoryWorkflowEventTypeValidator,
    sourceType: memorySourceTypeValidator,
    sourceId: v.string(),
    workflowId: v.optional(v.string()),
    status: memoryEvaluatorRunStatusValidator,
    promptVersion: v.optional(v.string()),
    model: v.optional(v.string()),
    summary: v.optional(v.string()),
    ignoredReason: v.optional(v.string()),
    error: v.optional(v.string()),
    promotedMemoryIds: v.optional(v.array(v.string())),
    suggestionIds: v.optional(v.array(v.string())),
    promotedMemoryCount: v.number(),
    suggestedMemoryCount: v.number(),
    queryPerformanceUpdateCount: v.number(),
    retrievalStats: v.optional(
      v.object({
        relevantMemories: v.number(),
        semanticMatches: v.number(),
        matchedQueries: v.number(),
      })
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_workspace_status_updated_at", [
      "workspaceId",
      "status",
      "updatedAt",
    ])
    .index("by_workspace_updated_at", ["workspaceId", "updatedAt"])
    .index("by_event", ["eventId"])
    .index("by_workflow", ["workflowId"]),

  /**
   * Usage snapshots emitted by agent usage handlers.
   * Flexible provider metadata is preserved for debugging and cost analysis.
   */
  agentUsageEvents: defineTable({
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    usage: v.object({
      inputTokens: v.optional(v.number()),
      outputTokens: v.optional(v.number()),
      totalTokens: v.optional(v.number()),
      reasoningTokens: v.optional(v.number()),
      cachedInputTokens: v.optional(v.number()),
    }),
    providerMetadata: v.optional(v.any()),
    recordedAt: v.number(),
  })
    .index("by_thread_recorded_at", ["threadId", "recordedAt"])
    .index("by_user_recorded_at", ["userId", "recordedAt"]),

  /**
   * Sanitized raw request/response payloads from agent model calls.
   * This is intended for debugging prompt/model behavior, not analytics reads.
   */
  agentRawResponses: defineTable({
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    request: v.optional(v.any()),
    response: v.optional(v.any()),
    providerMetadata: v.optional(v.any()),
    recordedAt: v.number(),
  })
    .index("by_thread_recorded_at", ["threadId", "recordedAt"])
    .index("by_user_recorded_at", ["userId", "recordedAt"]),

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
    // Set when plan is paused because the prospect was archived; cleared on unarchive restore
    archiveHold: v.optional(outreachPlanArchiveHoldValidator),
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
    // Event-driven approval state for idempotent resume signaling
    approvalEventId: v.optional(v.string()),
    approvalRequestedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    approvalNonce: v.optional(v.number()),
    // Tracks whether a deterministic workflow status message was already bridged
    statusBridgeState: v.optional(v.string()),
    statusBridgeSentAt: v.optional(v.number()),
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
    metadata: v.optional(prospectActivityMetadataValidator),
  })
    .index("by_prospect", ["prospectId"])
    .index("by_prospect_type", ["prospectId", "type"])
    .index("by_workspace", ["workspaceId"]),

  /**
   * Durable app-owned Twitter action requests for direct and risky actions.
   */
  agentActionRequests: defineTable({
    userId: v.id("users"),
    threadId: v.optional(v.string()),
    prospectId: v.optional(v.id("prospects")),
    workspaceId: v.optional(v.id("workspaces")),
    planId: v.optional(v.id("outreachPlans")),
    taskId: v.optional(v.id("outreachTasks")),
    provider: twitterActionProviderValidator,
    actionKey: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    toolSlug: v.string(),
    toolVersion: v.string(),
    riskLevel: twitterActionRiskLevelValidator,
    approvalMode: twitterActionApprovalModeValidator,
    uiArtifactType: twitterActionUiArtifactTypeValidator,
    entityType: twitterActionEntityTypeValidator,
    requiresConnectedAccount: v.boolean(),
    status: twitterActionRequestStatusValidator,
    argumentsSnapshot: twitterActionArgumentsSnapshotValidator,
    sourcePostRef: v.optional(twitterPostRefValidator),
    sourcePostSummary: v.optional(twitterPostSummaryValidator),
    draftContent: v.optional(v.string()),
    resultSummary: v.optional(twitterActionResultSummaryValidator),
    errorSummary: v.optional(twitterActionErrorSummaryValidator),
    // Legacy fields (pre-migration) - allow existing docs to validate
    errorData: v.optional(
      v.object({
        classification: v.string(),
        message: v.string(),
        retryable: v.boolean(),
      })
    ),
    sourcePostData: v.optional(v.any()),
    sourcePostId: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    executedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_thread_status", ["threadId", "status"])
    .index("by_prospect_status", ["prospectId", "status"]),

  twitterInteractions: defineTable({
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    sourcePostId: v.string(),
    replyPostId: v.string(),
    threadId: v.string(),
    sourcePostRef: twitterPostRefValidator,
    sourcePostSummary: v.optional(twitterPostSummaryValidator),
    replyPostRef: twitterPostRefValidator,
    replyPostSummary: v.optional(twitterPostSummaryValidator),
    origin: twitterInteractionOriginValidator,
    discoveredVia: twitterInteractionDiscoverySourceValidator,
    repliedAt: v.number(),
    participants: v.optional(v.array(twitterConversationParticipantValidator)),
    updatedAt: v.number(),
  })
    .index("by_user_prospect_reply", ["userId", "prospectId", "replyPostId"])
    .index("by_user_prospect_replied", ["userId", "prospectId", "repliedAt"])
    .index("by_user_source_post", ["userId", "sourcePostId"])
    .index("by_prospect_replied", ["prospectId", "repliedAt"]),

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
    actionRequestId: v.optional(v.id("agentActionRequests")),
    // Denormalized prospect data for efficient display
    prospectAvatarUrl: v.optional(v.string()),
    prospectDisplayName: v.optional(v.string()),
    prospectType: v.optional(prospectTypeValidator),
    prospectScreenName: v.optional(v.string()),
    replyCount: v.optional(v.number()),
    // For ask_human: tool call and thread context
    toolCallId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    approvalEventId: v.optional(v.string()),
    // Timestamps
    seenAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_workspace", ["workspaceId"]),
});
