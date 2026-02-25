import { v } from "convex/values";

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

// Social Account validators
export const socialAccountProfileValidator = v.object({
  screenName: v.optional(v.string()),
});

export const socialAccountTokensValidator = v.object({
  accessToken: v.string(), // This will be the encrypted token
  refreshToken: v.optional(v.string()), // This will be the encrypted token
  expiresAt: v.optional(v.number()),
  tokenType: v.optional(v.string()),
  scope: v.optional(v.string()),
});

export const linkXAccountArgsValidator = v.object({
  provider: v.literal("X"),
  providerAccountId: v.string(),
  profile: socialAccountProfileValidator,
  tokens: socialAccountTokensValidator,
});

export const postReplyArgsValidator = v.object({
  inReplyToTweetId: v.string(),
  text: v.string(),
  mediaUrls: v.optional(v.array(v.string())),
  mediaDescriptions: v.optional(v.array(v.string())),
  originalTweetAuthor: v.optional(v.string()),
  replyPreview: v.optional(v.string()),
});

// Use .partial() to make all token fields optional, then .extend() with profile fields
// Using type assertion since methods exist at runtime (Convex 1.29.0+)
export const updateXTokensArgsValidator = (socialAccountTokensValidator as any)
  .partial()
  .extend({
    // Optional profile fields to upsert
    name: v.optional(v.string()),
    screenName: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
  });

// Waitlist validators
export const waitlistEntryValidator = v.object({
  email: v.string(),
  twitter: v.optional(v.string()),
});

// Workspace validators
export const createDefaultWorkspaceArgsValidator = v.object({
  description: v.string(),
  name: v.optional(v.string()),
  descriptionSource: v.optional(v.union(v.literal("manual"), v.literal("url"))),
  sourceUrl: v.optional(v.string()),
  lastGeneratedAt: v.optional(v.number()),
});

export const updateWorkspaceArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  descriptionSource: v.optional(v.union(v.literal("manual"), v.literal("url"))),
  sourceUrl: v.optional(v.string()),
  lastGeneratedAt: v.optional(v.number()),
});

export const getWorkspaceArgsValidator = v.object({
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
  name: v.string(),
  description: v.string(),
  descriptionSource: v.optional(
    v.union(v.literal("manual"), v.literal("url"), v.literal("agent"))
  ),
  sourceUrl: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
});

export const updateWorkspaceV4ArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  name: v.optional(v.string()),
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
  v.literal("completed"),
  v.literal("abandoned")
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
  v.literal("enriched"),
  v.literal("plan_created"),
  v.literal("contacted"),
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
  v.literal("plan_completed"),
  v.literal("error")
);

// Notification status
export const outreachNotificationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("seen"),
  v.literal("dismissed")
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

// Monitor status (shared between socialQueryMonitors and prospectMonitors)
export const monitorStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("deleted")
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

// Log level (used in replyQueueMutations and schema)
export const logLevelValidator = v.union(
  v.literal("info"),
  v.literal("warn"),
  v.literal("error")
);

// Reply queue status (used in replyQueueMutations - includes retrying)
export const replyQueueStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("retrying")
);

// Reply notification status (subset used in notifications.ts - no retrying)
export const replyNotificationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed")
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
