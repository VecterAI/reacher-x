import { v } from "convex/values";
import { WORKSPACE_NAME_CONSTRAINTS } from "../shared/lib/utils/validation/validation";
import { WORKSPACE_USE_CASE_KEYS } from "../shared/lib/workspaceUseCases";

// ============================================================================
// ICP (Ideal Customer Profile) Validator - Shared
// ============================================================================

/**
 * Shared ICP validator used in:
 * - workspaces.ts (createWorkspaceInternal, updateWorkspaceInternal)
 * - agents/internal.ts (generateSeedKeywordsAction)
 * - schema.ts (workspaces table)
 */
export const icpValidator = v.object({
  title: v.string(),
  description: v.string(),
  painPoints: v.array(v.string()),
  channels: v.array(v.string()),
  syntheticPosts: v.optional(v.array(v.string())),
  qualificationKeywords: v.optional(v.array(v.string())),
});

// ============================================================================
// Twitter Data Validators
// ============================================================================

// User validator
const userValidator = v.object({
  id: v.number(),
  id_str: v.string(),
  name: v.string(),
  screen_name: v.string(),
  location: v.optional(v.string()),
  url: v.optional(v.string()),
  description: v.optional(v.string()),
  protected: v.boolean(),
  verified: v.boolean(),
  followers_count: v.number(),
  friends_count: v.number(),
  listed_count: v.number(),
  favourites_count: v.number(),
  statuses_count: v.number(),
  created_at: v.string(),
  profile_banner_url: v.optional(v.string()),
  profile_image_url_https: v.string(),
  can_dm: v.boolean(),
});

// Media validator
const mediaValidator = v.object({
  display_url: v.optional(v.string()),
  expanded_url: v.optional(v.string()),
  id_str: v.optional(v.string()), // Changed to optional to handle missing id_str
  indices: v.optional(v.array(v.number())), // Made optional for flexibility
  media_key: v.optional(v.string()), // Made optional as it might not always be present
  media_url_https: v.string(), // Keep required as this is critical
  type: v.string(), // Keep required
  url: v.optional(v.string()), // Made optional
  ext_alt_text: v.optional(v.string()),
  ext_media_availability: v.optional(
    v.object({
      status: v.string(),
    })
  ),
  features: v.optional(
    v.object({
      large: v.optional(v.object({ faces: v.array(v.any()) })),
      medium: v.optional(v.object({ faces: v.array(v.any()) })),
      small: v.optional(v.object({ faces: v.array(v.any()) })),
      orig: v.optional(v.object({ faces: v.any() })),
    })
  ),
  sizes: v.optional(
    // Made sizes optional since it might not always be present
    v.object({
      large: v.optional(
        v.object({
          h: v.number(),
          w: v.number(),
          resize: v.optional(v.string()),
        })
      ),
      medium: v.optional(
        v.object({
          h: v.number(),
          w: v.number(),
          resize: v.optional(v.string()),
        })
      ),
      small: v.optional(
        v.object({
          h: v.number(),
          w: v.number(),
          resize: v.optional(v.string()),
        })
      ),
      thumb: v.optional(
        v.object({
          h: v.number(),
          w: v.number(),
          resize: v.optional(v.string()),
        })
      ),
    })
  ),
  original_info: v.optional(
    // Made optional to handle cases where it’s missing
    v.object({
      height: v.number(),
      width: v.number(),
      focus_rects: v.array(
        v.object({
          x: v.number(),
          y: v.number(),
          w: v.number(),
          h: v.number(),
        })
      ),
    })
  ),
  video_info: v.optional(
    v.object({
      aspect_ratio: v.array(v.number()),
      duration_millis: v.optional(v.number()),
      variants: v.array(
        v.object({
          content_type: v.string(),
          url: v.string(),
          bitrate: v.optional(v.number()),
        })
      ),
    })
  ),
  additional_media_info: v.optional(
    v.object({
      monetizable: v.optional(v.boolean()),
    })
  ),
});

// UserMention validator
const userMentionValidator = v.object({
  id: v.optional(v.number()),
  id_str: v.string(),
  name: v.string(),
  screen_name: v.string(),
  indices: v.array(v.number()),
});

// Hashtag validator
const hashtagValidator = v.object({
  text: v.string(),
  indices: v.array(v.number()),
});

// Symbol validator
const symbolValidator = v.object({
  text: v.string(),
  indices: v.array(v.number()),
});

// Entities validator
const entitiesValidator = v.object({
  media: v.optional(v.array(mediaValidator)),
  timestamps: v.optional(v.array(v.string())),
  user_mentions: v.optional(v.array(userMentionValidator)),
  urls: v.optional(
    v.array(
      v.object({
        url: v.string(),
        expanded_url: v.string(),
        display_url: v.string(),
        indices: v.array(v.number()),
      })
    )
  ),
  hashtags: v.optional(v.array(hashtagValidator)),
  symbols: v.optional(v.array(symbolValidator)),
});

// Tweet validator
export const tweetValidator = v.object({
  tweet_created_at: v.optional(v.string()),
  id: v.optional(v.number()),
  id_str: v.optional(v.string()),
  conversation_id_str: v.optional(v.string()),
  text: v.optional(v.union(v.string(), v.null())),
  full_text: v.optional(v.string()),
  source: v.optional(v.string()),
  truncated: v.optional(v.boolean()),
  display_text_range: v.optional(v.array(v.number())),
  in_reply_to_status_id: v.optional(v.number()),
  in_reply_to_status_id_str: v.optional(v.string()),
  in_reply_to_user_id: v.optional(v.number()),
  in_reply_to_user_id_str: v.optional(v.string()),
  in_reply_to_screen_name: v.optional(v.string()),
  user: v.optional(userValidator),
  quoted_status_id: v.optional(v.number()),
  quoted_status_id_str: v.optional(v.string()),
  is_quote_status: v.optional(v.boolean()),
  quoted_status: v.optional(v.any()),
  retweeted_status: v.optional(v.any()),
  quote_count: v.optional(v.number()),
  reply_count: v.optional(v.number()),
  retweet_count: v.optional(v.number()),
  favorite_count: v.optional(v.number()),
  views_count: v.optional(v.number()),
  bookmark_count: v.optional(v.number()),
  lang: v.optional(v.string()),
  entities: v.optional(entitiesValidator),
  is_pinned: v.optional(v.boolean()),
});

export const twitterPostRefValidator = v.object({
  platform: v.literal("twitter"),
  postId: v.string(),
  conversationId: v.optional(v.string()),
  authorId: v.optional(v.string()),
  authorHandle: v.optional(v.string()),
  url: v.optional(v.string()),
});

export const twitterAuthorSummaryValidator = v.object({
  id: v.optional(v.string()),
  handle: v.optional(v.string()),
  name: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  profileUrl: v.optional(v.string()),
});

export const twitterMetricsSummaryValidator = v.object({
  replies: v.optional(v.number()),
  reposts: v.optional(v.number()),
  likes: v.optional(v.number()),
  quotes: v.optional(v.number()),
  views: v.optional(v.number()),
  bookmarks: v.optional(v.number()),
});

export const twitterMediaSummaryValidator = v.object({
  type: v.union(
    v.literal("photo"),
    v.literal("video"),
    v.literal("animated_gif"),
    v.literal("link")
  ),
  url: v.string(),
  previewUrl: v.optional(v.string()),
  altText: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

export const twitterPostSummaryValidator = v.object({
  platform: v.literal("twitter"),
  ref: twitterPostRefValidator,
  url: v.string(),
  textPreview: v.string(),
  createdAt: v.optional(v.number()),
  author: v.optional(twitterAuthorSummaryValidator),
  metrics: v.optional(twitterMetricsSummaryValidator),
  media: v.optional(v.array(twitterMediaSummaryValidator)),
  inReplyToPostId: v.optional(v.string()),
  inReplyToHandle: v.optional(v.string()),
  quotePostId: v.optional(v.string()),
  lang: v.optional(v.string()),
  source: v.optional(v.string()),
});

export const twitterViewerStateSourceValidator = v.union(
  v.literal("provider"),
  v.literal("optimistic"),
  v.literal("none")
);

export const twitterViewerStateResolutionValidator = v.union(
  v.literal("verified"),
  v.literal("optimistic"),
  v.literal("unknown"),
  v.literal("requires_connection")
);

export const twitterViewerStateValidator = v.object({
  postId: v.string(),
  liked: v.boolean(),
  retweeted: v.boolean(),
  bookmarked: v.boolean(),
  followingAuthor: v.boolean(),
  commented: v.boolean(),
  pendingAction: v.optional(v.string()),
  source: twitterViewerStateSourceValidator,
  resolution: twitterViewerStateResolutionValidator,
  canAct: v.boolean(),
  requiresConnection: v.boolean(),
  connectedAccountId: v.optional(v.string()),
  lastSyncedAt: v.optional(v.number()),
});

export const twitterInteractionOriginValidator = v.union(
  v.literal("agent"),
  v.literal("manual_reacherx"),
  v.literal("external_x"),
  v.literal("unknown")
);

export const twitterInteractionDiscoverySourceValidator = v.union(
  v.literal("live_reconcile"),
  v.literal("outreach_task"),
  v.literal("action_request")
);

export const twitterConversationParticipantValidator = v.object({
  id: v.optional(v.string()),
  handle: v.optional(v.string()),
  name: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  isViewer: v.optional(v.boolean()),
});

export const twitterActionResultSummaryValidator = v.object({
  actionKey: v.string(),
  toolSlug: v.string(),
  toolVersion: v.string(),
  completedAt: v.number(),
  targetPostId: v.optional(v.string()),
  targetUserId: v.optional(v.string()),
  createdPostId: v.optional(v.string()),
  postedTextPreview: v.optional(v.string()),
});

export const twitterActionErrorSummaryValidator = v.object({
  classification: v.string(),
  message: v.string(),
  retryable: v.boolean(),
  suggestion: v.optional(v.string()),
  code: v.optional(v.number()),
  completedAt: v.number(),
});

export const twitterActionArgumentsSnapshotValidator = v.object({
  tweetId: v.optional(v.string()),
  targetUserId: v.optional(v.string()),
  conversationId: v.optional(v.string()),
  text: v.optional(v.string()),
  mediaUrls: v.optional(v.array(v.string())),
  mediaDescriptions: v.optional(v.array(v.string())),
  targetLabel: v.optional(v.string()),
  context: v.optional(v.string()),
});

export const platformConversationPlatformValidator = v.union(
  v.literal("twitter")
);

export const platformConversationDirectionValidator = v.union(
  v.literal("sent"),
  v.literal("received")
);

export const xDmEligibilityReasonCodeValidator = v.union(
  v.literal("eligible"),
  v.literal("not_allowed"),
  v.literal("missing_connection"),
  v.literal("missing_scopes"),
  v.literal("unknown")
);

export const xDmPanelWarningCodeValidator = v.union(
  v.literal("rate_limited"),
  v.literal("activity_degraded")
);

export const platformConversationAttachmentValidator = v.object({
  mediaKey: v.optional(v.string()),
  type: v.string(),
  url: v.optional(v.string()),
  previewUrl: v.optional(v.string()),
  altText: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

export const xActivityEventTypeValidator = v.union(
  v.literal("dm.sent"),
  v.literal("dm.received"),
  v.literal("dm.read"),
  v.literal("chat.sent"),
  v.literal("chat.received"),
  v.literal("chat.conversation_join")
);

export const xActivitySubscriptionStatusValidator = v.union(
  v.literal("unknown"),
  v.literal("healthy"),
  v.literal("degraded"),
  v.literal("pending_retry")
);

export const xActivityAuthModeValidator = v.union(
  v.literal("app"),
  v.literal("user")
);

// Waitlist validators
export const waitlistEntryValidator = v.object({
  email: v.string(),
  twitter: v.optional(v.string()),
});

// Workspace validators
export const WORKSPACE_NAME_MIN_LENGTH = WORKSPACE_NAME_CONSTRAINTS.MIN_LENGTH;
export const WORKSPACE_NAME_MAX_LENGTH = WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH;
export const workspaceNameValidator = v.string();
const workspaceUseCaseKeyLiteralValidators = WORKSPACE_USE_CASE_KEYS.map(
  (key) => v.literal(key)
) as [ReturnType<typeof v.literal>, ...ReturnType<typeof v.literal>[]];
export const workspaceUseCaseKeyValidator = v.union(
  ...workspaceUseCaseKeyLiteralValidators
);

export const setupSessionModeValidator = v.union(
  v.literal("first_workspace"),
  v.literal("new_workspace")
);

export const setupSessionStatusValidator = v.union(
  v.literal("draft"),
  v.literal("awaiting_input"),
  v.literal("generating_profiles"),
  v.literal("awaiting_icp_confirmation"),
  v.literal("provisioning_preview_workspace"),
  v.literal("discovering_preview_prospects"),
  v.literal("awaiting_preview_confirmation"),
  v.literal("awaiting_connections"),
  v.literal("awaiting_plan"),
  v.literal("awaiting_preferences"),
  v.literal("ready"),
  v.literal("failed"),
  v.literal("discarded")
);

export const setupSessionTerminalStatusValidator = v.union(
  v.literal("ready"),
  v.literal("failed"),
  v.literal("discarded")
);

export const setupSessionPreferenceValidator = v.union(
  v.literal("qualified_only"),
  v.literal("qualified_and_exploratory")
);

export const setupProspectOriginValidator = v.union(
  v.literal("setup_preview"),
  v.literal("workspace_discovery"),
  v.literal("manual")
);

export const createDefaultWorkspaceArgsValidator = v.object({
  description: v.string(),
  name: v.optional(workspaceNameValidator),
  descriptionSource: v.optional(v.union(v.literal("manual"), v.literal("url"))),
  sourceUrl: v.optional(v.string()),
  lastGeneratedAt: v.optional(v.number()),
});

export const updateWorkspaceArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  name: v.optional(workspaceNameValidator),
  description: v.optional(v.string()),
  descriptionSource: v.optional(v.union(v.literal("manual"), v.literal("url"))),
  sourceUrl: v.optional(v.string()),
  lastGeneratedAt: v.optional(v.number()),
});

/** Single snapshot for rollback after a successful workspace refine (Base/Pro). */
export const refineRollbackSnapshotValidator = v.object({
  description: v.string(),
  seedDescription: v.optional(v.string()),
  improvedDescription: v.optional(v.string()),
  icps: v.optional(v.array(icpValidator)),
  useCaseKey: v.optional(workspaceUseCaseKeyValidator),
  sourceUrl: v.optional(v.string()),
  descriptionSource: v.optional(
    v.union(v.literal("url"), v.literal("manual"), v.literal("agent"))
  ),
  capturedAt: v.number(),
});

/**
 * Full workspace settings update from the Workspace page (Details + Profiles combined save).
 */
export const updateWorkspaceSettingsArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  name: v.optional(workspaceNameValidator),
  description: v.optional(v.string()),
  seedDescription: v.optional(v.string()),
  improvedDescription: v.optional(v.string()),
  icps: v.optional(v.array(icpValidator)),
  useCaseKey: v.optional(workspaceUseCaseKeyValidator),
  sourceUrl: v.optional(v.string()),
  descriptionSource: v.optional(
    v.union(v.literal("url"), v.literal("manual"), v.literal("agent"))
  ),
  lastGeneratedAt: v.optional(v.number()),
});

/** Apply refine preview results: captures rollback snapshot then overwrites ICP-related config. */
export const commitWorkspaceRefineArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  description: v.string(),
  seedDescription: v.optional(v.string()),
  improvedDescription: v.string(),
  icps: v.array(icpValidator),
  sourceUrl: v.optional(v.string()),
  descriptionSource: v.optional(
    v.union(v.literal("url"), v.literal("manual"), v.literal("agent"))
  ),
  useCaseKey: v.optional(workspaceUseCaseKeyValidator),
});

export const getWorkspaceArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
});

export const setDefaultWorkspaceArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
});

// User validators
export const createOrUpdateUserArgsValidator = v.object({
  workosUserId: v.string(),
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  profileImageUrl: v.optional(v.string()),
});

export const getUserByWorkosIdArgsValidator = v.object({
  workosUserId: v.string(),
});

export const getUserByIdArgsValidator = v.object({
  userId: v.id("users"),
});

// Social Data validators
export const getTwitterProfileArgsValidator = v.object({
  twitter: v.string(),
});

export const getThreadsArgsValidator = v.object({
  threadIds: v.array(v.string()),
});

export const insertThreadMutationArgsValidator = v.object({
  threadId: v.string(),
  tweets: v.array(tweetValidator),
});

export const insertThreadArgsValidator = v.object({
  threadId: v.string(),
});

export const getDynamicThreadDataArgsValidator = v.object({
  threadId: v.string(),
});

export const getRecentThreadsArgsValidator = v.object({
  count: v.number(),
  excludeThreadId: v.optional(v.string()),
});

// Email validators
export const sendWelcomeEmailArgsValidator = v.object({
  email: v.string(),
});

// Additional Social Data validators
export const getThreadByIdArgsValidator = v.object({
  threadId: v.string(),
});

// v4: Plan tier validator
export const planTierValidator = v.union(
  v.literal("free"),
  v.literal("base"),
  v.literal("pro")
);

// v4: Agent thread validators
export const agentThreadTypeValidator = v.union(
  v.literal("setup"),
  v.literal("prospecting")
);

export const agentThreadStatusValidator = v.union(
  v.literal("active"),
  v.literal("awaiting_approval"),
  v.literal("complete"),
  v.literal("failed")
);

export const agentMessageRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("thought")
);

// v4: Prospect validators
export const prospectPlatformValidator = v.union(
  v.literal("twitter"),
  v.literal("linkedin")
);

export const prospectStatusValidator = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("in_progress"),
  v.literal("converted"),
  v.literal("archived")
);

// Analytics range presets (used in analytics.ts query args)
// "today" is calendar day (UTC midnight -> now), while "1d" is rolling 24h.
export const analyticsDateRangeValidator = v.union(
  v.literal("today"),
  v.literal("1d"),
  v.literal("7d"),
  v.literal("30d"),
  v.literal("custom")
);

// v4: Workspace validators (updated for agent-generated content)
export const createWorkspaceArgsValidator = v.object({
  name: workspaceNameValidator,
  description: v.string(),
  descriptionSource: v.optional(
    v.union(v.literal("manual"), v.literal("url"), v.literal("agent"))
  ),
  sourceUrl: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
});

export const setupThreadBootstrapModeValidator = v.union(
  v.literal("default"),
  v.literal("newWorkspace")
);

export const updateWorkspaceV4ArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  name: v.optional(workspaceNameValidator),
  description: v.optional(v.string()),
  descriptionSource: v.optional(
    v.union(v.literal("manual"), v.literal("url"), v.literal("agent"))
  ),
  sourceUrl: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
});

// v4: Agent thread validators
export const createAgentThreadArgsValidator = v.object({
  type: agentThreadTypeValidator,
  workspaceId: v.optional(v.id("workspaces")),
  metadata: v.optional(v.any()),
});

export const addAgentMessageArgsValidator = v.object({
  threadId: v.id("agentThreads"),
  role: agentMessageRoleValidator,
  content: v.string(),
  toolCalls: v.optional(v.array(v.any())),
  toolResults: v.optional(v.array(v.any())),
  thoughtType: v.optional(v.string()),
});

export const updateAgentThreadStatusArgsValidator = v.object({
  threadId: v.id("agentThreads"),
  status: agentThreadStatusValidator,
  metadata: v.optional(v.any()),
});

// v4: Prospect validators
export const createProspectArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  platform: prospectPlatformValidator,
  externalId: v.string(),
  data: v.any(),
  matchReason: v.optional(v.string()),
  matchedKeywords: v.optional(v.array(v.string())),
});

export const updateProspectStatusArgsValidator = v.object({
  prospectId: v.id("prospects"),
  status: prospectStatusValidator,
  notes: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
});

// v4: Plan validators
export const upgradePlanArgsValidator = v.object({
  tier: planTierValidator,
  externalSubscriptionId: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
});

// v4: Keyword validators
export const discoveredKeywordValidator = v.object({
  keyword: v.string(),
  searchVolume: v.number(),
  competition: v.optional(v.number()),
  competitionLevel: v.optional(v.string()),
  cpc: v.optional(v.number()),
  trend: v.optional(
    v.object({
      monthly: v.optional(v.number()),
      quarterly: v.optional(v.number()),
      yearly: v.optional(v.number()),
    })
  ),
  keywordDifficulty: v.optional(v.number()),
  searchIntent: v.optional(v.string()),
});

export const createWorkspaceKeywordsArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  seedKeywords: v.array(v.string()),
  discoveredKeywords: v.array(discoveredKeywordValidator),
  socialQueries: v.array(v.string()),
});

export const updateWorkspaceKeywordsArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  seedKeywords: v.optional(v.array(v.string())),
  discoveredKeywords: v.optional(v.array(discoveredKeywordValidator)),
  socialQueries: v.optional(v.array(v.string())),
});

// ============================================================================
// Outreach System Validators
// ============================================================================

// Plan status
export const outreachPlanStatusValidator = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("executing"),
  v.literal("paused"),
  v.literal("blocked_auth"),
  v.literal("completed"),
  v.literal("abandoned")
);

/** Status before prospect was archived; used to restore on unarchive (non-terminal only). */
export const outreachPlanArchiveHoldPreviousStatusValidator = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("executing"),
  v.literal("paused"),
  v.literal("blocked_auth")
);

export const outreachPlanArchiveHoldValidator = v.object({
  previousStatus: outreachPlanArchiveHoldPreviousStatusValidator,
});

export const outreachFailureClassValidator = v.union(
  v.literal("reauth_required"),
  v.literal("scope_missing"),
  v.literal("duplicate_content"),
  v.literal("rate_limited"),
  v.literal("transient_network"),
  v.literal("api_policy_forbidden"),
  v.literal("content_too_long"),
  v.literal("target_not_found"),
  v.literal("unknown_error")
);

// Task type (currently only comment supported)
export const outreachTaskTypeValidator = v.union(
  v.literal("comment"),
  v.literal("wait"),
  v.literal("ask_human")
);

// Task status
export const outreachTaskStatusValidator = v.union(
  v.literal("pending"),
  v.literal("scheduled"),
  v.literal("executing"),
  v.literal("waiting_response"),
  v.literal("completed"),
  v.literal("skipped"),
  v.literal("failed")
);

// Task timing type
export const outreachTaskTimingTypeValidator = v.union(
  v.literal("immediate"),
  v.literal("delay"),
  v.literal("event"),
  v.literal("best_time")
);

// Activity type
export const prospectActivityTypeValidator = v.union(
  v.literal("found"),
  v.literal("qualified"),
  v.literal("enriched"),
  v.literal("plan_created"),
  v.literal("contacted"),
  v.literal("posted"),
  v.literal("responded"),
  v.literal("converted"),
  v.literal("archived")
);

// Notification type
export const outreachNotificationTypeValidator = v.union(
  v.literal("prospects_found"),
  v.literal("outreach_sent"),
  v.literal("prospect_replied"),
  v.literal("ask_human"),
  v.literal("twitter_action_request"),
  v.literal("twitter_action_completed"),
  v.literal("twitter_action_failed"),
  v.literal("plan_completed"),
  v.literal("error")
);

// Notification status
export const outreachNotificationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("seen"),
  v.literal("dismissed")
);

export const twitterActionRiskLevelValidator = v.union(
  v.literal("read_safe"),
  v.literal("write_low_risk"),
  v.literal("write_medium_risk"),
  v.literal("write_high_risk")
);

export const twitterActionProviderValidator = v.union(
  v.literal("composio_twitter"),
  v.literal("x_twitter_sdk")
);

export const twitterActionApprovalModeValidator = v.union(
  v.literal("auto_execute"),
  v.literal("confirm_first"),
  v.literal("always_approval")
);

export const twitterActionEntityTypeValidator = v.union(
  v.literal("post"),
  v.literal("user"),
  v.literal("dm"),
  v.literal("list"),
  v.literal("space"),
  v.literal("account"),
  v.literal("other")
);

export const twitterActionUiArtifactTypeValidator = v.union(
  v.literal("post_action"),
  v.literal("profile_action"),
  v.literal("composer_action"),
  v.literal("message_action"),
  v.literal("generic_action")
);

export const twitterActionRequestStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_approval"),
  v.literal("approved"),
  v.literal("executing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled")
);

export const xAccountStatusValidator = v.union(
  v.literal("connected"),
  v.literal("expired"),
  v.literal("reconnect_required"),
  v.literal("disconnected")
);

/** X API `subscription_type` on User (GET /2/users/me). See https://docs.x.com/x-api/users/get-my-user */
export const xSubscriptionTypeValidator = v.union(
  v.literal("None"),
  v.literal("Basic"),
  v.literal("Premium"),
  v.literal("PremiumPlus")
);

// Strategy object validator
export const outreachStrategyValidator = v.object({
  rationale: v.string(),
  targetTweetId: v.optional(v.string()),
  valueProposition: v.string(),
  tone: v.string(),
});

// Timing object validator
export const outreachTaskTimingValidator = v.object({
  type: outreachTaskTimingTypeValidator,
  value: v.optional(v.string()),
});

// Panel mode hint used by agent UI
export const outreachPanelModeValidator = v.union(
  v.literal("approval"),
  v.literal("posted")
);

// Approval context snapshot used by panel hydration/reopen.
// sourcePostData intentionally stays flexible since upstream post payloads vary.
export const outreachTaskApprovalContextValidator = v.object({
  panelMode: v.optional(outreachPanelModeValidator),
  platform: v.optional(v.union(v.literal("twitter"), v.literal("linkedin"))),
  sourcePostRef: v.optional(twitterPostRefValidator),
  sourcePostSummary: v.optional(twitterPostSummaryValidator),
  sourceContext: v.optional(v.string()),
});

export const outreachPlanSnapshotTaskValidator = v.object({
  _id: v.id("outreachTasks"),
  order: v.number(),
  type: outreachTaskTypeValidator,
  description: v.string(),
  status: outreachTaskStatusValidator,
  content: v.optional(v.string()),
  targetTweetId: v.optional(v.string()),
});

export const outreachPlanSnapshotValidator = v.object({
  planId: v.id("outreachPlans"),
  version: v.number(),
  status: outreachPlanStatusValidator,
  strategy: outreachStrategyValidator,
  updatedAt: v.number(),
  tasks: v.array(outreachPlanSnapshotTaskValidator),
});

// Backward-compatible persisted snapshot shape for legacy activity-log rows.
// New writes should still use `outreachPlanSnapshotValidator`.
export const storedOutreachPlanSnapshotValidator = v.object({
  planId: v.optional(v.id("outreachPlans")),
  version: v.optional(v.number()),
  status: outreachPlanStatusValidator,
  strategy: v.optional(outreachStrategyValidator),
  updatedAt: v.optional(v.number()),
  tasks: v.array(outreachPlanSnapshotTaskValidator),
});

export const prospectActivityMetadataValidator = v.object({
  planId: v.optional(v.id("outreachPlans")),
  taskId: v.optional(v.id("outreachTasks")),
  responseTweetId: v.optional(v.string()),
  responseDmMessageId: v.optional(v.string()),
  conversationId: v.optional(v.string()),
  planSnapshot: v.optional(storedOutreachPlanSnapshotValidator),
});

// Monitor status (shared between socialQueryMonitors and prospectMonitors)
export const monitorStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("deleted")
);

export const monitorHealthStatusValidator = v.union(
  v.literal("healthy"),
  v.literal("degraded"),
  v.literal("failing")
);

// Keyword type validator (for keywords.ts)
export const keywordTypeValidator = v.union(
  v.literal("seed"),
  v.literal("discovered"),
  v.literal("social_query")
);

// ============================================================================
// Additional Validators (Consolidated from inline usage)
// ============================================================================

// Qualification status (used in prospects.ts)
export const qualificationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("qualified"),
  v.literal("disqualified")
);

// Prospect type (used in prospects.ts enrichment)
export const prospectTypeValidator = v.union(
  v.literal("individual"),
  v.literal("organization"),
  v.literal("unknown")
);

// Enrichment status (used in prospects.ts)
export const enrichmentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("enriched"),
  v.literal("partial"),
  v.literal("failed")
);

// Urgency level (used in chat.ts for askHuman)
export const urgencyLevelValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high")
);

// Description source (used in workspaces.ts)
export const descriptionSourceValidator = v.union(
  v.literal("url"),
  v.literal("manual"),
  v.literal("agent")
);

// Twitter search type (used in searchPosts and socialapi)
export const twitterSearchTypeValidator = v.union(
  v.literal("Latest"),
  v.literal("Top")
);

// LinkedIn sort order (used in searchPosts)
export const linkedinSortOrderValidator = v.union(
  v.literal("relevance"),
  v.literal("date_posted")
);

// LinkedIn time filter (used in searchPosts)
export const linkedinTimeFilterValidator = v.union(
  v.literal("past-24h"),
  v.literal("past-week"),
  v.literal("past-month"),
  v.literal("past-year")
);

// User timeline mode (used in socialapi.ts)
export const userTimelineModeValidator = v.union(
  v.literal("posts"),
  v.literal("replies"),
  v.literal("quotes")
);

// Workspace prospecting workflow status (used in schema.ts and workflows/prospecting.ts)
export const workspaceWorkflowStatusValidator = v.union(
  v.literal("running"),
  v.literal("paused"),
  v.literal("stopped"),
  v.literal("limit_reached")
);

// Persisted internal onboarding issue source (never shown directly to users)
export const workspaceOnboardingIssueSourceValidator = v.union(
  v.literal("workflow"),
  v.literal("monitor"),
  v.literal("search"),
  v.literal("setup"),
  v.literal("system")
);

// Persisted internal onboarding issue status (mapped to safe UI copy)
export const workspaceOnboardingIssueStatusCodeValidator = v.union(
  v.literal("workflow_failed"),
  v.literal("monitor_creation_failed"),
  v.literal("search_failed"),
  v.literal("setup_incomplete"),
  v.literal("unknown_error")
);

// User-visible issue state (safe, neutral, non-technical)
export const userVisibleOnboardingIssueStatusValidator = v.union(
  v.literal("none"),
  v.literal("delayed")
);

// Prospecting cycle status (used in workflows/prospecting.ts return type)
export const prospectingCycleStatusValidator = v.union(
  v.literal("completed"),
  v.literal("limit_reached"),
  v.literal("error")
);

// Keyword status (used in schema.ts keywords table)
export const keywordStatusValidator = v.union(
  v.literal("active"),
  v.literal("deprecated")
);

// Pipeline stage (used in schema.ts prospects table - same values as prospectStatusValidator)
export const pipelineStageValidator = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("in_progress"),
  v.literal("converted"),
  v.literal("archived")
);

// Plan generation status (used for auto outreach plan generation)
export const planGenerationStatusValidator = v.union(
  v.literal("idle"),
  v.literal("generating"),
  v.literal("completed"),
  v.literal("failed")
);

// Read-model rollout scope (single workspace vs all owned workspaces)
export const readModelRolloutScopeValidator = v.union(
  v.literal("workspace"),
  v.literal("all_workspaces")
);

// Read-model rollout lifecycle status
export const readModelRolloutStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("canceled")
);

// Terminal rollout states used by workflow completion handling
export const readModelRolloutTerminalStatusValidator = v.union(
  v.literal("completed"),
  v.literal("failed"),
  v.literal("canceled")
);

// Per-workspace rebuild counters emitted by the read-model rollout workflow.
export const readModelRebuildResultValidator = v.object({
  workspaceId: v.id("workspaces"),
  prospectSummariesRebuilt: v.number(),
  workspaceStatsRebuilt: v.boolean(),
  analyticsRowsRebuilt: v.number(),
  activityLogsProcessed: v.number(),
  plansProcessed: v.number(),
  notificationsProcessed: v.number(),
});

export const readModelRolloutWorkflowResultValidator = v.object({
  rebuiltWorkspaceCount: v.number(),
  results: v.array(readModelRebuildResultValidator),
});

// Shared 24-hour bucket validator for workspaceAnalyticsDaily read-model rows.
export const hourlyAnalyticsCountsValidator = v.array(v.number());

export const workspaceMemoryCategoryValidator = v.union(
  v.literal("qualification_win_pattern"),
  v.literal("qualification_false_positive_pattern"),
  v.literal("enrichment_signal_pattern"),
  v.literal("enrichment_role_pattern"),
  v.literal("outreach_winning_pattern"),
  v.literal("outreach_objection_pattern")
);

export const workspaceMemorySourceValidator = v.union(
  v.literal("qualification"),
  v.literal("enrichment"),
  v.literal("outreach"),
  v.literal("operator")
);

export const memorySourceTypeValidator = v.union(
  v.literal("workspace"),
  v.literal("prospect"),
  v.literal("keyword"),
  v.literal("query_candidate"),
  v.literal("outreach_plan"),
  v.literal("outreach_task"),
  v.literal("thread"),
  v.literal("message"),
  v.literal("activity_log"),
  v.literal("analytics_row"),
  v.literal("workflow_event")
);

export const queryCandidateTypeValidator = v.union(
  v.literal("seed_keyword"),
  v.literal("social_query")
);

export const queryCandidateStatusValidator = v.union(
  v.literal("generated"),
  v.literal("activated"),
  v.literal("rejected_exact_duplicate"),
  v.literal("rejected_semantic_duplicate"),
  v.literal("rejected_low_novelty"),
  v.literal("retired")
);

export const queryCandidateDuplicateReasonValidator = v.union(
  v.literal("canonical_match"),
  v.literal("semantic_match"),
  v.literal("low_novelty"),
  v.literal("exhausted_theme"),
  v.literal("already_monitored")
);

export const memoryWorkflowEventTypeValidator = v.union(
  v.literal("prospecting_cycle_completed"),
  v.literal("prospecting_cycle_limit_reached"),
  v.literal("prospecting_cycle_failed"),
  v.literal("query_candidate_activated"),
  v.literal("query_search_executed"),
  v.literal("qualification_completed"),
  v.literal("enrichment_completed"),
  v.literal("outreach_plan_approved"),
  v.literal("outreach_plan_abandoned"),
  v.literal("outreach_task_approved"),
  v.literal("outreach_task_completed"),
  v.literal("outreach_task_failed"),
  v.literal("prospect_responded"),
  v.literal("prospect_archived"),
  v.literal("prospect_converted")
);

export const memoryWorkflowEventStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("processed"),
  v.literal("ignored"),
  v.literal("failed")
);

export const memorySuggestionStatusValidator = v.union(
  v.literal("pending_review"),
  v.literal("promoted"),
  v.literal("rejected")
);

export const memoryEvaluatorRunStatusValidator = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("ignored"),
  v.literal("failed")
);
