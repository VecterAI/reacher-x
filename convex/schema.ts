// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  agentComponentThreadStatusValidator,
  icpValidator,
  planTierValidator,
  prospectListSortValidator,
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
  prospectingWorkflowPauseReasonValidator,
  workspaceWorkflowStatusValidator,
  workspaceOnboardingIssueSourceValidator,
  workspaceOnboardingIssueStatusCodeValidator,
  monitorStatusValidator,
  monitorHealthStatusValidator,
  pipelineStageValidator,
  prospectStageTimestampsValidator,
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
  entitlementSlotValidator,
  refineRollbackSnapshotValidator,
  queryCandidateDuplicateReasonValidator,
  queryCandidateStatusValidator,
  queryCandidateTypeValidator,
  setupInputModeValidator,
  setupSessionModeValidator,
  setupSessionStatusValidator,
  setupSessionPreferenceValidator,
  setupPreviewReviewModeValidator,
  setupProspectOriginValidator,
  workspaceMemoryCategoryValidator,
  workspaceMemorySourceValidator,
  twitterActionRiskLevelValidator,
  twitterActionProviderValidator,
  twitterActionApprovalModeValidator,
  twitterActionEntityTypeValidator,
  twitterMediaKindValidator,
  twitterActionUiArtifactTypeValidator,
  twitterActionRequestStatusValidator,
  twitterActionArgumentsSnapshotValidator,
  twitterActionErrorSummaryValidator,
  twitterActionResultSummaryValidator,
  twitterPostRefValidator,
  twitterPostSummaryValidator,
  twitterInteractionDirectionValidator,
  twitterInteractionDiscoverySourceValidator,
  twitterInteractionOriginValidator,
  twitterInteractionStatusValidator,
  twitterConversationParticipantValidator,
  platformConversationAttachmentValidator,
  platformConversationDirectionValidator,
  platformConversationEventTypeValidator,
  platformConversationMessageTypeValidator,
  platformConversationPlatformValidator,
  linkedinSearchSurfaceValidator,
  linkedinAccountStatusValidator,
  unipileAccountSourceStatusValidator,
  unipileWebhookEventValidator,
  unipileWebhookSourceValidator,
  xAccountStatusValidator,
  xActivityAuthModeValidator,
  xActivityEventTypeValidator,
  xActivitySubscriptionStatusValidator,
  xDmEligibilityReasonCodeValidator,
  xDmPanelWarningCodeValidator,
  xSubscriptionTypeValidator,
  socialQueryMonitorPurposeValidator,
  styleBackfillStatusValidator,
  styleContentTypeValidator,
  styleProfileStatusValidator,
  prospectDiscoveryContextValidator,
  prospectDiscoverySourceValidator,
  discoveryEdgeContextValidator,
  discoveryEdgeTypeValidator,
  discoveryGraphNodeValidator,
  twitterConversationSeedScoreBreakdownValidator,
  twitterConversationSeedStatusValidator,
  twitterReplyDiscoveryCandidateStatusValidator,
  twitterReplyDiscoveryScoreBreakdownValidator,
  socialQueryStyleValidator,
  agentUsageSnapshotValidator,
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
    styleSourceKey: v.optional(v.string()),
    styleSourceVersion: v.optional(v.number()),
    styleSourceSwitchedAt: v.optional(v.number()),
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
    /** From GET /2/users/me `subscription_type` (cached on connect/refresh). */
    xSubscriptionType: v.optional(xSubscriptionTypeValidator),
    xSubscriptionUpdatedAt: v.optional(v.number()),
    /** Legacy `verified` and/or `verified_type` from GET /2/users/me (blue/gov/business). */
    xVerified: v.optional(v.boolean()),
    activitySubscriptionStatus: v.optional(
      xActivitySubscriptionStatusValidator
    ),
    activitySubscriptionsEnsuredAt: v.optional(v.number()),
    activitySubscriptionsLastAttemptAt: v.optional(v.number()),
    activitySubscriptionsNextRetryAt: v.optional(v.number()),
    activitySubscriptionsLastError: v.optional(v.string()),
    activitySubscriptionsLastAuthMode: v.optional(xActivityAuthModeValidator),
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

  linkedinAccounts: defineTable({
    userId: v.id("users"),
    accountId: v.string(),
    styleSourceKey: v.optional(v.string()),
    styleSourceVersion: v.optional(v.number()),
    styleSourceSwitchedAt: v.optional(v.number()),
    status: linkedinAccountStatusValidator,
    publicIdentifier: v.optional(v.string()),
    username: v.optional(v.string()),
    providerId: v.optional(v.string()),
    entityUrn: v.optional(v.string()),
    objectUrn: v.optional(v.string()),
    displayName: v.optional(v.string()),
    headline: v.optional(v.string()),
    location: v.optional(v.string()),
    email: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    publicProfileUrl: v.optional(v.string()),
    premium: v.optional(v.boolean()),
    openProfile: v.optional(v.boolean()),
    sourceStatuses: v.optional(
      v.array(
        v.object({
          id: v.string(),
          status: unipileAccountSourceStatusValidator,
        })
      )
    ),
    organizationMailboxes: v.optional(
      v.array(
        v.object({
          id: v.optional(v.string()),
          name: v.string(),
          organizationId: v.optional(v.string()),
          mailboxId: v.optional(v.string()),
          messagingEnabled: v.optional(v.boolean()),
        })
      )
    ),
    premiumFeatures: v.optional(v.array(v.string())),
    recruiterState: v.optional(v.any()),
    salesNavigatorState: v.optional(v.any()),
    lastSyncedAt: v.optional(v.number()),
    lastSyncAttemptAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_account_id", ["accountId"])
    .index("by_provider_id", ["providerId"])
    .index("by_entity_urn", ["entityUrn"])
    .index("by_public_identifier", ["publicIdentifier"]),

  unipileWebhooks: defineTable({
    source: unipileWebhookSourceValidator,
    webhookId: v.string(),
    requestUrl: v.string(),
    enabled: v.boolean(),
    events: v.array(unipileWebhookEventValidator),
    updatedAt: v.number(),
    lastValidatedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_source", ["source"])
    .index("by_webhook_id", ["webhookId"])
    .index("by_request_url", ["requestUrl"]),

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
    reportingTimeZone: v.optional(v.string()),

    imageUrl: v.optional(v.string()),
    isDefault: v.boolean(),
    entitlementSlot: v.optional(entitlementSlotValidator),
    // Legacy fields kept optional for backward compatibility while canonical
    // style state now lives in workspaceStyleProfiles.
    styleProfileStatus: v.optional(styleProfileStatusValidator),
    styleProfileVersion: v.optional(v.number()),
    styleProfileSampleCount: v.optional(v.number()),
    styleProfileEditDiffCount: v.optional(v.number()),
    styleProfileLastAnalyzedAt: v.optional(v.number()),
    styleProfileSourceKey: v.optional(v.string()),
    styleProfileSourceVersion: v.optional(v.number()),
    styleProfileSourceExternalUserId: v.optional(v.string()),
    styleProfileLastError: v.optional(v.string()),
    updatedAt: v.number(),

    // Continuous prospecting workflow tracking
    prospectingWorkflowId: v.optional(v.string()), // Active workflow ID from Convex Workflow
    prospectingWorkflowStatus: v.optional(workspaceWorkflowStatusValidator),
    prospectingWorkflowStartedAt: v.optional(v.number()),
    prospectingWorkflowPauseReason: v.optional(
      prospectingWorkflowPauseReasonValidator
    ),
    prospectingWorkflowPausedAt: v.optional(v.number()),
    prospectingFailureStreak: v.optional(v.number()),
    prospectingRecoveryAttemptId: v.optional(v.number()),
    prospectingLastFailureAt: v.optional(v.number()),
    prospectingNextRunAt: v.optional(v.number()),
    prospectingNextRecoveryAt: v.optional(v.number()),
    lastMeaningfulActivityAt: v.optional(v.number()),

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
    .index("by_user_default", ["userId", "isDefault"])
    .index("by_prospecting_status_last_activity", [
      "prospectingWorkflowStatus",
      "lastMeaningfulActivityAt",
    ]),

  workspaceStyleProfiles: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    platform: prospectPlatformValidator,
    status: styleProfileStatusValidator,
    version: v.number(),
    sourceKey: v.optional(v.string()),
    sourceVersion: v.optional(v.number()),
    sourceExternalUserId: v.optional(v.string()),
    lastAnalyzedAt: v.optional(v.number()),
    sampleCount: v.number(),
    editDiffCount: v.number(),
    promotedMemoryId: v.optional(v.string()),
    lastError: v.optional(v.string()),
    lastErrorAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_platform", ["workspaceId", "platform"])
    .index("by_user_platform_status", ["userId", "platform", "status"]),

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
    inputMode: v.optional(setupInputModeValidator),
    sourceUrl: v.optional(v.string()),
    seedDescription: v.optional(v.string()),
    generationFeedback: v.optional(v.string()),
    improvedDescription: v.optional(v.string()),
    generatedProfiles: v.optional(v.array(icpValidator)),
    connectionsCompletedAt: v.optional(v.number()),
    planChoice: v.optional(planTierValidator),
    preferenceChoice: v.optional(setupSessionPreferenceValidator),
    existingWorkspaceId: v.optional(v.id("workspaces")),
    targetWorkspaceId: v.optional(v.id("workspaces")),
    entitlementSlot: v.optional(entitlementSlotValidator),
    /** True when session was created from /workspace Refine audience (skip post-preview onboarding). */
    refineFromWorkspace: v.optional(v.boolean()),
    previewRevision: v.optional(v.number()),
    previewWorkflowId: v.optional(v.string()),
    previewDiscoveryStartedAt: v.optional(v.number()),
    previewProspectIds: v.optional(v.array(v.id("prospects"))),
    previewReviewMode: v.optional(setupPreviewReviewModeValidator),
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
    platformTargets: v.optional(v.array(prospectPlatformValidator)),
    linkedinSurface: v.optional(linkedinSearchSurfaceValidator),
    linkedinSurfaceTargets: v.optional(v.array(linkedinSearchSurfaceValidator)),
    queryStyle: v.optional(socialQueryStyleValidator),

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
    // When the prospect most recently entered the disqualified state
    disqualifiedAt: v.optional(v.number()),
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
    stageTimestamps: v.optional(prospectStageTimestampsValidator),

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
    // Stable actor-level identifier for forward-only Twitter dedupe.
    twitterUserId: v.optional(v.string()),
    // Stable actor-level identifier for LinkedIn people/company dedupe.
    linkedinUserUrn: v.optional(v.string()),
    // Forward-only provenance for discovery path.
    discoverySource: v.optional(prospectDiscoverySourceValidator),
    discoveryContext: v.optional(prospectDiscoveryContextValidator),

    // Enrichment metadata
    enrichedAt: v.optional(v.number()),
    enrichmentStatus: v.optional(enrichmentStatusValidator),
    // When the prospect most recently became actionable-ready for outreach
    readyAt: v.optional(v.number()),

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
    .index("by_workspace_platform_twitter_user_id", [
      "workspaceId",
      "platform",
      "twitterUserId",
    ])
    .index("by_workspace_platform_linkedin_user_urn", [
      "workspaceId",
      "platform",
      "linkedinUserUrn",
    ])
    .index("by_user_platform_linkedin_user_urn", [
      "userId",
      "platform",
      "linkedinUserUrn",
    ])
    .index("by_user", ["userId"])
    .index("by_external_id", ["workspaceId", "platform", "externalId"])
    .index("by_setup_session", ["setupSessionId"])
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
    currentProspectsCycleStart: v.optional(v.number()),
    currentProspectsCycleEnd: v.optional(v.number()),
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

  /**
   * Per-workspace queue state for throttled memory evaluation.
   * Keeps memory learning work coalesced so bursts of events do not enqueue
   * duplicate workers for the same workspace.
   */
  memoryEvaluationWorkspaceQueues: defineTable({
    workspaceId: v.id("workspaces"),
    status: v.union(
      v.literal("idle"),
      v.literal("queued"),
      v.literal("running")
    ),
    workId: v.optional(v.string()),
    activeEventId: v.optional(v.id("memoryWorkflowEvents")),
    lastError: v.optional(v.string()),
    lastEnqueuedAt: v.optional(v.number()),
    lastStartedAt: v.optional(v.number()),
    lastFinishedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_status_updated_at", ["status", "updatedAt"]),

  // ============================================================================
  // Legacy/Utility Tables
  // ============================================================================

  waitlist: defineTable({
    email: v.string(),
    twitter: v.optional(v.string()),
  }).index("by_email", ["email"]),

  publicThreads: defineTable({
    threadId: v.string(),
    position: v.number(),
    isActive: v.boolean(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_position", ["position"])
    .index("by_isActive_position", ["isActive", "position"]),

  publicTestimonials: defineTable({
    tweetId: v.string(),
    position: v.number(),
    isActive: v.boolean(),
  })
    .index("by_tweetId", ["tweetId"])
    .index("by_position", ["position"])
    .index("by_isActive_position", ["isActive", "position"]),

  // Media uploads for temporary storage
  mediaUploads: defineTable({
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    uploadedAt: v.number(),
  }).index("by_uploaded_at", ["uploadedAt"]),

  platformConversations: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    prospectId: v.optional(v.id("prospects")),
    platform: platformConversationPlatformValidator,
    conversationId: v.string(),
    accountId: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    participantUserId: v.optional(v.string()),
    participantAttendeeId: v.optional(v.string()),
    participantProviderId: v.optional(v.string()),
    participantUsername: v.optional(v.string()),
    participantName: v.optional(v.string()),
    participantHeadline: v.optional(v.string()),
    participantAvatarUrl: v.optional(v.string()),
    participantProfileUrl: v.optional(v.string()),
    participantVerified: v.optional(v.boolean()),
    eligibilityEnabled: v.optional(v.boolean()),
    eligibilityReasonCode: v.optional(xDmEligibilityReasonCodeValidator),
    eligibilityReasonLabel: v.optional(v.string()),
    disabledFeatures: v.optional(v.array(v.string())),
    readOnly: v.optional(v.boolean()),
    contentType: v.optional(v.string()),
    latestMessageId: v.optional(v.string()),
    latestMessageAt: v.optional(v.number()),
    lastReadAt: v.optional(v.number()),
    lastSyncedAt: v.optional(v.number()),
    lastSyncAttemptAt: v.optional(v.number()),
    lastSyncSuccessAt: v.optional(v.number()),
    nextSyncAllowedAt: v.optional(v.number()),
    lastSyncErrorCode: v.optional(xDmPanelWarningCodeValidator),
    lastSyncErrorMessage: v.optional(v.string()),
    activitySubscribedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user_platform", ["userId", "platform"])
    .index("by_user_conversation", ["userId", "conversationId"])
    .index("by_prospect_platform", ["prospectId", "platform"]),

  platformConversationMessages: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    prospectId: v.optional(v.id("prospects")),
    platform: platformConversationPlatformValidator,
    conversationId: v.string(),
    messageId: v.string(),
    providerMessageId: v.optional(v.string()),
    direction: platformConversationDirectionValidator,
    senderUserId: v.optional(v.string()),
    senderAttendeeId: v.optional(v.string()),
    text: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    createdAtMs: v.number(),
    attachments: v.optional(v.array(platformConversationAttachmentValidator)),
    readAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    quotedMessageId: v.optional(v.string()),
    messageType: v.optional(platformConversationMessageTypeValidator),
    isEvent: v.optional(v.boolean()),
    sourceEventType: v.optional(platformConversationEventTypeValidator),
    updatedAt: v.number(),
  })
    .index("by_user_conversation_created_at", [
      "userId",
      "conversationId",
      "createdAtMs",
    ])
    .index("by_user_conversation_message", [
      "userId",
      "conversationId",
      "messageId",
    ])
    .index("by_prospect_created_at", ["prospectId", "createdAtMs"]),

  xWebhooks: defineTable({
    webhookId: v.string(),
    url: v.string(),
    valid: v.boolean(),
    updatedAt: v.number(),
    lastValidatedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_webhook_id", ["webhookId"])
    .index("by_url", ["url"]),

  xActivitySubscriptions: defineTable({
    userId: v.id("users"),
    xUserId: v.string(),
    eventType: xActivityEventTypeValidator,
    subscriptionId: v.string(),
    webhookId: v.optional(v.string()),
    tag: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user_event", ["userId", "eventType"])
    .index("by_x_user_event", ["xUserId", "eventType"])
    .index("by_subscription_id", ["subscriptionId"]),

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
    purpose: v.optional(socialQueryMonitorPurposeValidator),
    conversationSeedId: v.optional(v.id("twitterConversationSeeds")),
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
    .index("by_keyword", ["keywordId"])
    .index("by_workspace_purpose_status", ["workspaceId", "purpose", "status"])
    .index("by_conversation_seed", ["conversationSeedId"]),

  /**
   * Promoted root tweets whose reply threads are mined and monitored for
   * forward-only reply-driven prospect discovery.
   */
  twitterConversationSeeds: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    rootTweetId: v.string(),
    conversationId: v.string(),
    rootAuthorId: v.optional(v.string()),
    rootAuthorUsername: v.optional(v.string()),
    rootTweetData: v.any(),
    rootTweetSummary: v.optional(twitterPostSummaryValidator),
    sourceSearchQuery: v.optional(v.string()),
    sourceKeyword: v.optional(v.string()),
    seedScore: v.number(),
    seedScoreBreakdown: twitterConversationSeedScoreBreakdownValidator,
    status: twitterConversationSeedStatusValidator,
    promotionReason: v.optional(v.string()),
    initialBackfillCompletedAt: v.optional(v.number()),
    lastBackfillCursor: v.optional(v.string()),
    lastReplySeenAt: v.optional(v.number()),
    monitorId: v.optional(v.string()),
    lastWebhookAt: v.optional(v.number()),
    totalRepliesSeen: v.optional(v.number()),
    totalCandidatesAccepted: v.optional(v.number()),
    totalProspectsCreated: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_root_tweet_id", ["rootTweetId"])
    .index("by_monitor_id", ["monitorId"]),

  /**
   * Reply-level staging rows for candidates discovered under promoted seeds.
   * Deduped by seed + reply tweet.
   */
  twitterReplyDiscoveryCandidates: defineTable({
    seedId: v.id("twitterConversationSeeds"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    replyTweetId: v.string(),
    replyAuthorId: v.optional(v.string()),
    replyAuthorUsername: v.optional(v.string()),
    replyTweetData: v.any(),
    replyTweetSummary: v.optional(twitterPostSummaryValidator),
    matchedQueries: v.optional(v.array(v.string())),
    score: v.number(),
    scoreBreakdown: twitterReplyDiscoveryScoreBreakdownValidator,
    discardReason: v.optional(v.string()),
    acceptanceReason: v.optional(v.string()),
    status: twitterReplyDiscoveryCandidateStatusValidator,
    prospectId: v.optional(v.id("prospects")),
    discoveredAt: v.number(),
    processedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_seed_reply_tweet", ["seedId", "replyTweetId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_reply_author", ["workspaceId", "replyAuthorId"]),

  discoveryEdges: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    edgeType: discoveryEdgeTypeValidator,
    discoverySource: prospectDiscoverySourceValidator,
    sourceKey: v.string(),
    targetKey: v.string(),
    sourceNode: discoveryGraphNodeValidator,
    targetNode: discoveryGraphNodeValidator,
    context: v.optional(discoveryEdgeContextValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_edge_type", ["workspaceId", "edgeType"])
    .index("by_workspace_source_key", ["workspaceId", "sourceKey"])
    .index("by_workspace_target_key", ["workspaceId", "targetKey"])
    .index("by_workspace_edge_keys", [
      "workspaceId",
      "edgeType",
      "sourceKey",
      "targetKey",
    ]),

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
  // Style Monitors (Writing Style Learning - platform-agnostic)
  // ============================================================================

  /**
   * Tracks SocialAPI user-tweets monitors on the authenticated user's own account
   * to collect organic posts for writing style analysis.
   * Platform-agnostic table. Today it is used for X; LinkedIn can reuse the
   * same shape if/when app-owned LinkedIn style monitors are added.
   */
  styleMonitors: defineTable({
    userId: v.id("users"),
    platform: prospectPlatformValidator,
    sourceVersion: v.optional(v.number()),
    // Platform-specific account reference (polymorphic)
    xAccountId: v.optional(v.id("xAccounts")),
    // External monitor service ID (SocialAPI for X; reusable for other providers)
    monitorId: v.string(),
    // Platform user ID being monitored (user's own account)
    monitoredExternalUserId: v.string(),
    monitoredUsername: v.string(),
    status: monitorStatusValidator,
    // Backfill tracking
    backfillStatus: styleBackfillStatusValidator,
    backfillSampleCount: v.optional(v.number()),
    backfillCompletedAt: v.optional(v.number()),
    lastWebhookAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_platform", ["userId", "platform"])
    .index("by_user_platform_source_version", [
      "userId",
      "platform",
      "sourceVersion",
    ])
    .index("by_monitor_id", ["monitorId"]),

  /**
   * Platform-agnostic staging buffer for collected user content (tweets, LinkedIn
   * posts, etc.) before writing style analysis. Deduped by
   * userId+platform+externalContentId.
   */
  styleContentSamples: defineTable({
    userId: v.id("users"),
    platform: prospectPlatformValidator,
    sourceVersion: v.optional(v.number()),
    sourceExternalUserId: v.optional(v.string()),
    externalContentId: v.string(),
    fullText: v.string(),
    contentType: styleContentTypeValidator,
    postedAt: v.number(),
    source: v.union(v.literal("backfill"), v.literal("monitor_webhook")),
    processedForStyle: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unprocessed", ["userId", "processedForStyle"])
    .index("by_user_platform_source_version", [
      "userId",
      "platform",
      "sourceVersion",
    ])
    .index("by_user_platform_source_processed", [
      "userId",
      "platform",
      "sourceVersion",
      "processedForStyle",
    ])
    .index("by_user_platform_source_external_content_id", [
      "userId",
      "platform",
      "sourceVersion",
      "externalContentId",
    ])
    .index("by_user_platform", ["userId", "platform"]),

  socialApiBudgetState: defineTable({
    provider: v.string(),
    nextAvailableAt: v.number(),
    updatedAt: v.number(),
    lastConsumer: v.optional(v.string()),
  }).index("by_provider", ["provider"]),

  linkdapiBudgetState: defineTable({
    provider: v.string(),
    nextAvailableAt: v.number(),
    updatedAt: v.number(),
    lastConsumer: v.optional(v.string()),
  }).index("by_provider", ["provider"]),

  /**
   * Canonical relationship table between prospects and agent threads.
   * Stores the small history/search fields locally so hot read paths do not
   * need to fan out into the agent component for every row.
   */
  prospectThreads: defineTable({
    prospectId: v.id("prospects"),
    threadId: v.string(),
    userId: v.id("users"),
    threadStatus: v.optional(agentComponentThreadStatusValidator),
    threadSummary: v.optional(v.string()),
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
    pipelineStage: v.optional(pipelineStageValidator),
    stageTimestamps: v.optional(prospectStageTimestampsValidator),
    qualificationStatus: v.optional(qualificationStatusValidator),
    // Optional during rollout until older summary rows are backfilled.
    qualifiedAt: v.optional(v.number()),
    enrichmentStatus: v.optional(enrichmentStatusValidator),
    planGenerationStatus: v.optional(planGenerationStatusValidator),
    readyQualifiedEnriched: v.boolean(),
    actionableReady: v.optional(v.boolean()),
    readyAt: v.optional(v.number()),
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
    discoverySource: v.optional(prospectDiscoverySourceValidator),
    /** Denormalized full-text blob for Convex search index (see buildProspectSearchText). */
    searchText: v.string(),
  })
    .searchIndex("search_prospect_summaries", {
      searchField: "searchText",
      filterFields: ["workspaceId", "status"],
    })
    .index("by_prospect", ["prospectId"])
    .index("by_user_qualification", ["userId", "qualificationStatus"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "prospectCreatedAt"])
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
    .index("by_workspace_actionable_score", [
      "workspaceId",
      "actionableReady",
      "sortQualificationScore",
      "prospectCreatedAt",
    ])
    .index("by_workspace_status_score", [
      "workspaceId",
      "status",
      "sortQualificationScore",
      "prospectCreatedAt",
    ])
    .index("by_workspace_status_created", [
      "workspaceId",
      "status",
      "prospectCreatedAt",
      "sortQualificationScore",
    ])
    .index("by_workspace_status_type_score", [
      "workspaceId",
      "status",
      "prospectType",
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
    .index("by_workspace_status_actionable_score", [
      "workspaceId",
      "status",
      "actionableReady",
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
    .index("by_workspace_platform_actionable_score", [
      "workspaceId",
      "platform",
      "actionableReady",
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
    .index("by_workspace_platform_status_created", [
      "workspaceId",
      "platform",
      "status",
      "prospectCreatedAt",
      "sortQualificationScore",
    ])
    .index("by_workspace_platform_status_type_score", [
      "workspaceId",
      "platform",
      "status",
      "prospectType",
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
    ])
    .index("by_workspace_platform_status_actionable_score", [
      "workspaceId",
      "platform",
      "status",
      "actionableReady",
      "sortQualificationScore",
      "prospectCreatedAt",
    ]),

  /**
   * Per-user feed snapshot for prospect list tabs. The watermark keeps "new
   * ready" prospects out of the list until the user merges them, while staying
   * global across sort changes for the same filter scope.
   */
  prospectListFeedAnchors: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    status: prospectStatusValidator,
    sortBy: v.optional(prospectListSortValidator),
    scopeKey: v.optional(v.string()),
    readyAtWatermark: v.optional(v.number()),
    visibleProspectIds: v.optional(v.array(v.id("prospects"))),
    anchorSortScore: v.optional(v.number()),
    anchorProspectCreatedAt: v.optional(v.number()),
    anchorProspectType: v.optional(prospectTypeValidator),
    anchorProspectId: v.optional(v.id("prospects")),
    updatedAt: v.number(),
  }).index("by_user_workspace_status_sort", [
    "userId",
    "workspaceId",
    "status",
    "sortBy",
  ]),

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
    actionableReadyCount: v.optional(v.number()),
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
    actionableReadyCount: v.optional(v.number()),
    qualifiedEventsCount: v.optional(v.number()),
    disqualifiedEventsCount: v.optional(v.number()),
    readyEventsCount: v.optional(v.number()),
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
    hourlyReachedContactedProspectsCounts: v.optional(
      hourlyAnalyticsCountsValidator
    ),
    hourlyReachedInProgressProspectsCounts: v.optional(
      hourlyAnalyticsCountsValidator
    ),
    hourlyReachedConvertedProspectsCounts: v.optional(
      hourlyAnalyticsCountsValidator
    ),
    hourlyFitScore0To49Counts: v.optional(hourlyAnalyticsCountsValidator),
    hourlyFitScore50To69Counts: v.optional(hourlyAnalyticsCountsValidator),
    hourlyFitScore70To79Counts: v.optional(hourlyAnalyticsCountsValidator),
    hourlyFitScore80To100Counts: v.optional(hourlyAnalyticsCountsValidator),
    hourlyQualificationQualifiedCounts: v.optional(
      hourlyAnalyticsCountsValidator
    ),
    hourlyQualificationDisqualifiedCounts: v.optional(
      hourlyAnalyticsCountsValidator
    ),
    hourlyActionableReadyCounts: v.optional(hourlyAnalyticsCountsValidator),
    hourlyTwitterProspectsCounts: v.optional(hourlyAnalyticsCountsValidator),
    hourlyLinkedInProspectsCounts: v.optional(hourlyAnalyticsCountsValidator),
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
   * Per-workspace Agent Ops daily rollups.
   * Hourly arrays preserve exact range math across workspace time zones.
   */
  workspaceAgentOpsDaily: defineTable({
    workspaceId: v.id("workspaces"),
    dayStartUtcMs: v.number(),
    dayKey: v.string(),
    keywordsCreatedCount: v.number(),
    queriesGeneratedCount: v.number(),
    queriesReviewedCount: v.number(),
    queriesActivatedCount: v.number(),
    queriesRejectedExactDuplicateCount: v.number(),
    queriesRejectedSemanticDuplicateCount: v.number(),
    suggestionsCreatedCount: v.number(),
    suggestionsPendingReviewCount: v.number(),
    suggestionsPromotedCount: v.number(),
    suggestionsRejectedCount: v.number(),
    memoriesWrittenCount: v.number(),
    highImpactMemoriesCount: v.optional(v.number()),
    memoryImpactScoreSum: v.number(),
    memoryConfidenceSum: v.number(),
    eventsReceivedCount: v.number(),
    failedEventsCount: v.number(),
    runsStartedCount: v.number(),
    failedRunsCount: v.number(),
    qualificationCompletedCount: v.number(),
    qualificationQualifiedCount: v.number(),
    enrichmentCompletedCount: v.number(),
    enrichmentPainPointCountSum: v.number(),
    outreachTaskApprovedCount: v.number(),
    outreachTaskApprovedEditedCount: v.number(),
    hourlyKeywordsCreatedCounts: hourlyAnalyticsCountsValidator,
    hourlyQueriesGeneratedCounts: hourlyAnalyticsCountsValidator,
    hourlyQueriesReviewedCounts: hourlyAnalyticsCountsValidator,
    hourlyQueriesActivatedCounts: hourlyAnalyticsCountsValidator,
    hourlyQueriesRejectedExactDuplicateCounts: hourlyAnalyticsCountsValidator,
    hourlyQueriesRejectedSemanticDuplicateCounts:
      hourlyAnalyticsCountsValidator,
    hourlySuggestionsCreatedCounts: hourlyAnalyticsCountsValidator,
    hourlySuggestionsPendingReviewCounts: hourlyAnalyticsCountsValidator,
    hourlySuggestionsPromotedCounts: hourlyAnalyticsCountsValidator,
    hourlySuggestionsRejectedCounts: hourlyAnalyticsCountsValidator,
    hourlyMemoriesWrittenCounts: hourlyAnalyticsCountsValidator,
    hourlyHighImpactMemoriesCounts: v.optional(hourlyAnalyticsCountsValidator),
    hourlyMemoryImpactScoreSums: hourlyAnalyticsCountsValidator,
    hourlyMemoryConfidenceSums: hourlyAnalyticsCountsValidator,
    hourlyEventsReceivedCounts: hourlyAnalyticsCountsValidator,
    hourlyFailedEventsCounts: hourlyAnalyticsCountsValidator,
    hourlyRunsStartedCounts: hourlyAnalyticsCountsValidator,
    hourlyFailedRunsCounts: hourlyAnalyticsCountsValidator,
    hourlyQualificationCompletedCounts: hourlyAnalyticsCountsValidator,
    hourlyQualificationQualifiedCounts: hourlyAnalyticsCountsValidator,
    hourlyEnrichmentCompletedCounts: hourlyAnalyticsCountsValidator,
    hourlyEnrichmentPainPointCountSums: hourlyAnalyticsCountsValidator,
    hourlyOutreachTaskApprovedCounts: hourlyAnalyticsCountsValidator,
    hourlyOutreachTaskApprovedEditedCounts: hourlyAnalyticsCountsValidator,
    updatedAt: v.number(),
  }).index("by_workspace_day", ["workspaceId", "dayStartUtcMs"]),

  /**
   * Workspace-scoped built-in memory inventory used by Agent Ops.
   * This keeps dashboard reads off the large raw Agent component memory blobs.
   */
  workspaceAgentMemoryInventory: defineTable({
    workspaceId: v.id("workspaces"),
    memoryId: v.string(),
    createdAt: v.number(),
    title: v.string(),
    summary: v.string(),
    source: workspaceMemorySourceValidator,
    category: workspaceMemoryCategoryValidator,
    confidence: v.number(),
    impactScore: v.number(),
    relatedQueriesCount: v.number(),
    evidenceCount: v.number(),
  })
    .index("by_workspace_created_at", ["workspaceId", "createdAt"])
    .index("by_workspace_memory_id", ["workspaceId", "memoryId"])
    .index("by_memory_id", ["memoryId"]),

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
    platformTargets: v.optional(v.array(prospectPlatformValidator)),
    linkedinSurface: v.optional(linkedinSearchSurfaceValidator),
    linkedinSurfaceTargets: v.optional(v.array(linkedinSearchSurfaceValidator)),
    queryStyle: v.optional(socialQueryStyleValidator),
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
    platform: v.optional(prospectPlatformValidator),
    surface: v.optional(linkedinSearchSurfaceValidator),
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
   * Per-query daily performance deltas for exact range-based discovery views.
   */
  workspaceQueryPerformanceDaily: defineTable({
    workspaceId: v.id("workspaces"),
    queryId: v.id("keywords"),
    activatedQueryCandidateId: v.optional(v.id("queryCandidates")),
    dayStartUtcMs: v.number(),
    dayKey: v.string(),
    impressionsCount: v.number(),
    prospectsFoundCount: v.number(),
    qualifiedCount: v.number(),
    convertedCount: v.number(),
    replyCount: v.number(),
    hourlyImpressionsCounts: hourlyAnalyticsCountsValidator,
    hourlyProspectsFoundCounts: hourlyAnalyticsCountsValidator,
    hourlyQualifiedCounts: hourlyAnalyticsCountsValidator,
    hourlyConvertedCounts: hourlyAnalyticsCountsValidator,
    hourlyReplyCounts: hourlyAnalyticsCountsValidator,
    updatedAt: v.number(),
  })
    .index("by_workspace_day", ["workspaceId", "dayStartUtcMs"])
    .index("by_workspace_query_day", [
      "workspaceId",
      "queryId",
      "dayStartUtcMs",
    ]),

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
    usage: agentUsageSnapshotValidator,
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
    // Original agent-generated draft preserved for style learning edit diffs
    originalDraftContent: v.optional(v.string()),
    // Optional media edits attached during approval before posting
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
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
    // Original agent-generated draft preserved for style learning edit diffs
    originalDraftContent: v.optional(v.string()),
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

  prospectInteractions: defineTable({
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    platform: prospectPlatformValidator,
    interactionType: v.optional(v.string()),
    sourcePostId: v.string(),
    replyPostId: v.string(),
    threadId: v.string(),
    sourcePostRef: v.optional(twitterPostRefValidator),
    sourcePostSummary: v.optional(twitterPostSummaryValidator),
    replyPostRef: v.optional(twitterPostRefValidator),
    replyPostSummary: v.optional(twitterPostSummaryValidator),
    sourcePostData: v.optional(v.any()),
    sourceUrl: v.optional(v.string()),
    replyText: v.optional(v.string()),
    status: v.optional(twitterInteractionStatusValidator),
    direction: v.optional(twitterInteractionDirectionValidator),
    origin: twitterInteractionOriginValidator,
    discoveredVia: twitterInteractionDiscoverySourceValidator,
    repliedAt: v.number(),
    discoveredAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    lastHydratedAt: v.optional(v.number()),
    lastHydrationErrorMessage: v.optional(v.string()),
    participants: v.optional(v.array(twitterConversationParticipantValidator)),
    updatedAt: v.number(),
  })
    .index("by_user_prospect_reply", ["userId", "prospectId", "replyPostId"])
    .index("by_user_prospect_replied", ["userId", "prospectId", "repliedAt"])
    .index("by_user_source_post", ["userId", "sourcePostId"])
    .index("by_prospect_replied", ["prospectId", "repliedAt"]),

  prospectInteractionSyncStates: defineTable({
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    platform: v.literal("twitter"),
    trackingStartedAt: v.number(),
    lastAttemptAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastSeenPostId: v.optional(v.string()),
    lastSeenCreatedAt: v.optional(v.number()),
    nextAllowedSyncAt: v.optional(v.number()),
    failureCount: v.optional(v.number()),
    lastErrorMessage: v.optional(v.string()),
  })
    .index("by_user_prospect", ["userId", "prospectId"])
    .index("by_prospect", ["prospectId"]),

  /**
   * Per-user engagement on a post (likes, retweets, commented) after confirmed X writes.
   * Avoids feed-time X list-pagination for viewer state.
   */
  twitterUserPostEngagements: defineTable({
    userId: v.id("users"),
    postId: v.string(),
    /** Post author (for merging follow state with twitterUserFollowings). */
    authorId: v.optional(v.string()),
    liked: v.boolean(),
    retweeted: v.boolean(),
    commented: v.boolean(),
    likeCount: v.optional(v.number()),
    repeatCount: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user_post", ["userId", "postId"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  /**
   * Per-user engagement on a LinkedIn post after confirmed LinkedIn writes.
   * Stored by multiple stable post keys so LinkdAPI/Unipile ids can both rehydrate.
   */
  linkedinUserPostEngagements: defineTable({
    userId: v.id("users"),
    postKey: v.string(),
    prospectId: v.optional(v.id("prospects")),
    viewerReaction: v.union(v.string(), v.null()),
    reactionCount: v.optional(v.number()),
    commented: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_user_post", ["userId", "postKey"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  /** Follow relationship after confirmed follow/unfollow via X API. */
  twitterUserFollowings: defineTable({
    userId: v.id("users"),
    targetUserId: v.string(),
    following: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user_target", ["userId", "targetUserId"]),

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
    targetHref: v.optional(v.string()),
    notificationKey: v.optional(v.string()),
    contextPlatform: v.optional(prospectPlatformValidator),
    // Optional references
    prospectId: v.optional(v.id("prospects")),
    planId: v.optional(v.id("outreachPlans")),
    taskId: v.optional(v.id("outreachTasks")),
    actionRequestId: v.optional(v.id("agentActionRequests")),
    // Denormalized prospect data for efficient display
    prospectAvatarUrl: v.optional(v.string()),
    prospectDisplayName: v.optional(v.string()),
    prospectType: v.optional(prospectTypeValidator),
    prospectPlatform: v.optional(prospectPlatformValidator),
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
