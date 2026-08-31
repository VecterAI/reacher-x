import { v } from "convex/values";
import { WORKSPACE_NAME_CONSTRAINTS } from "../shared/lib/utils/validation/validation";
import { WORKSPACE_USE_CASE_KEYS } from "../shared/lib/workspaceUseCases";
import { SETUP_PREVIEW_REVIEW_MODES } from "./lib/setupPreviewCore";
import { LINKEDIN_MESSAGE_REACTIONS } from "../shared/lib/linkedin/messageReaction";

const [firstLinkedInMessageReaction, ...remainingLinkedInMessageReactions] =
  LINKEDIN_MESSAGE_REACTIONS;

export const linkedinMessageReactionValidator = v.union(
  v.literal(firstLinkedInMessageReaction),
  ...remainingLinkedInMessageReactions.map((reaction) => v.literal(reaction))
);

export const linkedinMessageReactionResultValidator = v.union(
  v.object({ success: v.literal(true) }),
  v.object({
    success: v.literal(false),
    code: v.union(
      v.literal("account_reconnect_required"),
      v.literal("conversation_unavailable"),
      v.literal("feature_unavailable"),
      v.literal("message_unavailable"),
      v.literal("provider_unavailable"),
      v.literal("rate_limited"),
      v.literal("unknown")
    ),
    message: v.string(),
    retryable: v.boolean(),
    recovery: v.union(
      v.literal("none"),
      v.literal("reconnect"),
      v.literal("refresh"),
      v.literal("retry")
    ),
  })
);

// ============================================================================
// ICP (Ideal Customer Profile) Validator - Shared
// ============================================================================

/**
 * Shared ICP validator used in:
 * - workspaces.ts (createWorkspaceInternal, updateWorkspaceInternal)
 * - agents/internal.ts (generateSeedKeywordsAction)
 * - schema.ts (workspaces table)
 */
export const workspaceProfileProvenanceValidator = v.union(
  v.literal("ai_generated"),
  v.literal("manual")
);

export const icpValidator = v.object({
  title: v.string(),
  description: v.string(),
  painPoints: v.array(v.string()),
  channels: v.array(v.string()),
  provenance: v.optional(workspaceProfileProvenanceValidator),
  syntheticPosts: v.optional(v.array(v.string())),
  qualificationKeywords: v.optional(v.array(v.string())),
});

export const workspaceProfileChangeStatusValidator = v.union(
  v.literal("pending_approval"),
  v.literal("applied"),
  v.literal("rejected"),
  v.literal("stale")
);

export const entitlementSlotValidator = v.number();

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

export const twitterUrlEntityValidator = v.object({
  url: v.string(),
  expanded_url: v.string(),
  display_url: v.string(),
  indices: v.array(v.number()),
});

export const prospectContactSourceTypeValidator = v.union(
  v.literal("linkedin_contact_info"),
  v.literal("profile_bio"),
  v.literal("profile_post"),
  v.literal("website"),
  v.literal("website_contact_page")
);

export const prospectContactSourceValidator = v.object({
  sourceType: prospectContactSourceTypeValidator,
  sourceLabel: v.string(),
  confidence: v.number(),
  sourceUrl: v.optional(v.string()),
  sourceSnippet: v.optional(v.string()),
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
  urls: v.optional(v.array(twitterUrlEntityValidator)),
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

export const socialQueryMonitorPurposeValidator = v.union(
  v.literal("workspace_query"),
  v.literal("conversation_seed")
);

export const twitterConversationSeedStatusValidator = v.union(
  v.literal("pending_backfill"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("archived"),
  v.literal("failed")
);

export const twitterConversationSeedScoreBreakdownValidator = v.object({
  topicalFit: v.number(),
  freshness: v.number(),
  engagement: v.number(),
  authorQuality: v.number(),
  replyLikelihood: v.number(),
  total: v.number(),
});

export const twitterReplyDiscoveryCandidateStatusValidator = v.union(
  v.literal("pending"),
  v.literal("discarded"),
  v.literal("prospect_created"),
  v.literal("merged_into_existing")
);

export const twitterReplyDiscoveryScoreBreakdownValidator = v.object({
  topicalFit: v.number(),
  painSignal: v.number(),
  intentSignal: v.number(),
  authorQuality: v.number(),
  penalties: v.number(),
  total: v.number(),
});

export const prospectDiscoverySourceValidator = v.union(
  v.literal("search_post"),
  v.literal("search_people"),
  v.literal("conversation_reply")
);

export const discoveryGraphNodeKindValidator = v.union(
  v.literal("search_query"),
  v.literal("conversation_seed"),
  v.literal("reply_post"),
  v.literal("prospect")
);

export const discoveryGraphNodeValidator = v.object({
  kind: discoveryGraphNodeKindValidator,
  platform: v.optional(v.union(v.literal("twitter"), v.literal("linkedin"))),
  internalId: v.optional(v.string()),
  externalId: v.optional(v.string()),
  label: v.optional(v.string()),
  summary: v.optional(v.string()),
});

export const discoveryEdgeTypeValidator = v.union(
  v.literal("search_query_to_prospect"),
  v.literal("matched_query_to_seed"),
  v.literal("seed_to_reply"),
  v.literal("reply_to_prospect")
);

export const discoveryEdgeContextValidator = v.object({
  matchedQueries: v.optional(v.array(v.string())),
  matchedReason: v.optional(v.string()),
  score: v.optional(v.number()),
  searchQuery: v.optional(v.string()),
  rootTweetId: v.optional(v.string()),
  replyTweetId: v.optional(v.string()),
  twitterUserId: v.optional(v.string()),
  acceptanceReason: v.optional(v.string()),
  discardReason: v.optional(v.string()),
});

export const prospectDiscoveryContextValidator = v.object({
  conversationSeedId: v.optional(v.id("twitterConversationSeeds")),
  replyCandidateId: v.optional(v.id("twitterReplyDiscoveryCandidates")),
  monitorId: v.optional(v.string()),
  seedPostRef: v.optional(twitterPostRefValidator),
  seedPostSummary: v.optional(twitterPostSummaryValidator),
  replyPostRef: v.optional(twitterPostRefValidator),
  replyPostSummary: v.optional(twitterPostSummaryValidator),
  matchedQueries: v.optional(v.array(v.string())),
  matchedReason: v.optional(v.string()),
  discoverySnippet: v.optional(v.string()),
  linkedinSurface: v.optional(v.union(v.literal("posts"), v.literal("people"))),
  linkedinHeadline: v.optional(v.string()),
  linkedinProfileUrl: v.optional(v.string()),
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
  v.literal("socialapi_incremental"),
  v.literal("socialapi_webhook"),
  v.literal("outreach_task"),
  v.literal("action_request"),
  v.literal("x_activity")
);

export const twitterInteractionStatusValidator = v.union(
  v.literal("active"),
  v.literal("missing"),
  v.literal("deleted"),
  v.literal("unavailable")
);

export const twitterInteractionDirectionValidator = v.union(
  v.literal("incoming"),
  v.literal("outgoing")
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
  /** How the action was delivered ("api" default, "browser" for Kernel fallback). */
  sentVia: v.optional(v.union(v.literal("api"), v.literal("browser"))),
  /** Proof screenshot URL captured when the action was sent via browser. */
  proofMediaUrl: v.optional(v.string()),
});

export const twitterActionErrorSummaryValidator = v.object({
  classification: v.string(),
  message: v.string(),
  retryable: v.boolean(),
  suggestion: v.optional(v.string()),
  code: v.optional(v.number()),
  completedAt: v.number(),
});

export const twitterMediaKindValidator = v.union(
  v.literal("image"),
  v.literal("gif"),
  v.literal("video"),
  v.literal("file")
);

export const twitterActionArgumentsSnapshotValidator = v.object({
  platform: v.optional(v.union(v.literal("twitter"), v.literal("linkedin"))),
  tweetId: v.optional(v.string()),
  postId: v.optional(v.string()),
  targetUserId: v.optional(v.string()),
  conversationId: v.optional(v.string()),
  chatId: v.optional(v.string()),
  accountId: v.optional(v.string()),
  providerId: v.optional(v.string()),
  publicIdentifier: v.optional(v.string()),
  entityUrn: v.optional(v.string()),
  objectUrn: v.optional(v.string()),
  attendeeId: v.optional(v.string()),
  profileUrl: v.optional(v.string()),
  text: v.optional(v.string()),
  mediaUrls: v.optional(v.array(v.string())),
  mediaUploadIds: v.optional(v.array(v.id("mediaUploads"))),
  mediaDescriptions: v.optional(v.array(v.string())),
  mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
  reactionType: v.optional(v.string()),
  quoteId: v.optional(v.string()),
  replyToCommentId: v.optional(v.string()),
  parentCommentId: v.optional(v.string()),
  parentAuthorName: v.optional(v.string()),
  threadRootCommentId: v.optional(v.string()),
  invitationMessage: v.optional(v.string()),
  inviteeEmail: v.optional(v.string()),
  targetOrganizationId: v.optional(v.string()),
  targetMailboxId: v.optional(v.string()),
  disabledReason: v.optional(v.string()),
  targetLabel: v.optional(v.string()),
  context: v.optional(v.string()),
});

export const platformConversationPlatformValidator = v.union(
  v.literal("twitter"),
  v.literal("linkedin")
);

export const platformConversationDirectionValidator = v.union(
  v.literal("sent"),
  v.literal("received")
);

export const outboundMessageStatusValidator = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed")
);

export const platformConversationMediaPurposeValidator = v.union(
  v.literal("provider_cache"),
  v.literal("outbound_voice_note")
);

export const outboundMessageMediaMetadataValidator = v.object({
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  mimeType: v.optional(v.string()),
  fileSize: v.optional(v.number()),
});

export const outboundMessageOperationValidator = v.object({
  operationId: v.id("outboundMessageOperations"),
  clientRequestId: v.string(),
  prospectId: v.id("prospects"),
  platform: platformConversationPlatformValidator,
  conversationId: v.optional(v.string()),
  text: v.string(),
  mediaUrls: v.optional(v.array(v.string())),
  mediaDescriptions: v.optional(v.array(v.string())),
  mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
  mediaFileNames: v.optional(v.array(v.string())),
  mediaMetadata: v.optional(v.array(outboundMessageMediaMetadataValidator)),
  voiceNoteCacheId: v.optional(v.id("platformConversationMediaCache")),
  quoteId: v.optional(v.string()),
  status: outboundMessageStatusValidator,
  attemptCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  sentAt: v.optional(v.number()),
  providerMessageId: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
});

export const prospectInteractionHistoryPlatformValidator = v.union(
  v.literal("all"),
  v.literal("twitter"),
  v.literal("linkedin")
);

export const prospectInteractionHistoryKindValidator = v.union(
  v.literal("dm"),
  v.literal("comment"),
  v.literal("reply")
);

export const prospectInteractionHistoryDirectionValidator = v.union(
  v.literal("all"),
  v.literal("sent"),
  v.literal("received")
);

export const xDmEligibilityReasonCodeValidator = v.union(
  v.literal("eligible"),
  v.literal("not_allowed"),
  v.literal("missing_connection"),
  v.literal("missing_account"),
  v.literal("missing_scopes"),
  v.literal("subscription_required"),
  v.literal("feature_unavailable"),
  v.literal("action_required"),
  v.literal("restricted"),
  v.literal("unknown")
);

export const xDmPanelWarningCodeValidator = v.union(
  v.literal("rate_limited"),
  v.literal("activity_degraded"),
  v.literal("provider_error"),
  v.literal("credentials_required"),
  v.literal("action_required"),
  v.literal("feature_not_subscribed")
);

export const conversationHistoryBoundaryValidator = v.union(
  v.literal("complete"),
  v.literal("x_30_day_limit")
);

/**
 * Metadata-only result for XChat history. XChat events are encrypted; this
 * contract deliberately contains counts and timestamps, never event payloads
 * or decrypted text.
 */
export const xChatConversationHistoryEvidenceValidator = v.object({
  conversationFound: v.boolean(),
  conversationLookupComplete: v.boolean(),
  encrypted: v.literal(true),
  contentState: v.literal("encrypted_locked"),
  conversationPagesFetched: v.number(),
  eventPagesFetched: v.number(),
  eventCount: v.number(),
  inboundEventCount: v.number(),
  outboundEventCount: v.number(),
  unattributedEventCount: v.number(),
  latestEventAt: v.optional(v.number()),
  oldestEventAt: v.optional(v.number()),
  hasMore: v.boolean(),
  pageLimitReached: v.boolean(),
  boundary: v.optional(v.union(v.literal("complete"), v.literal("page_limit"))),
});

export const xChatSigningKeyValidator = v.object({
  userId: v.string(),
  publicKeyVersion: v.string(),
  publicKey: v.string(),
  identityPublicKey: v.string(),
  identityPublicKeySignature: v.string(),
});

export const xChatEncryptedEventValidator = v.object({
  id: v.optional(v.string()),
  conversationId: v.optional(v.string()),
  senderId: v.optional(v.string()),
  createdAtMs: v.optional(v.number()),
  encodedEvent: v.string(),
});

export const xChatBrowserDecryptBundleValidator = v.union(
  v.object({
    availability: v.literal("unavailable"),
    reason: v.union(
      v.literal("viewer_not_configured"),
      v.literal("participant_not_configured")
    ),
  }),
  v.object({
    availability: v.literal("blocked"),
    reason: v.literal("xchat_access_denied"),
  }),
  v.object({
    availability: v.literal("available"),
    viewerUserId: v.string(),
    participantUserId: v.string(),
    conversationId: v.string(),
    signingKeyVersion: v.string(),
    juiceboxConfig: v.string(),
    signingKeys: v.array(xChatSigningKeyValidator),
    events: v.array(xChatEncryptedEventValidator),
    eventPagesFetched: v.number(),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
  })
);

/** A short-lived URL for opaque XChat ciphertext; plaintext never crosses Convex. */
export const xChatEncryptedMediaValidator = v.union(
  v.object({
    availability: v.literal("available"),
    url: v.string(),
    size: v.number(),
    expiresAt: v.number(),
  }),
  v.object({
    availability: v.literal("unavailable"),
    reason: v.literal("not_found"),
  })
);

export const xChatEncryptedMediaUploadResultValidator = v.object({
  mediaHashKey: v.string(),
});

export const platformConversationMediaUrlValidator = v.object({
  url: v.string(),
  contentType: v.string(),
  fileName: v.optional(v.string()),
  size: v.number(),
  encrypted: v.boolean(),
  expiresAt: v.number(),
});

export const xChatEventPageValidator = v.object({
  conversationId: v.string(),
  events: v.array(xChatEncryptedEventValidator),
  nextCursor: v.optional(v.string()),
  hasMore: v.boolean(),
});

/** Ciphertext-only realtime events delivered by X Activity webhooks. */
export const xChatRealtimeEventPageValidator = v.union(
  v.null(),
  v.object({
    conversationId: v.string(),
    events: v.array(xChatEncryptedEventValidator),
  })
);

export const xChatEncryptedSendResultValidator = v.object({
  success: v.literal(true),
  conversationId: v.string(),
  messageId: v.string(),
  deduplicated: v.boolean(),
});

export const xChatSendOperationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("sending"),
  v.literal("sent")
);

export const xChatSendStoredOperationValidator = v.object({
  operationId: v.id("xChatSendOperations"),
  userId: v.id("users"),
  prospectId: v.id("prospects"),
  taskId: v.optional(v.id("outreachTasks")),
  clientRequestId: v.string(),
  conversationId: v.string(),
  messageId: v.string(),
  encodedMessageCreateEvent: v.string(),
  encodedMessageEventSignature: v.string(),
  status: xChatSendOperationStatusValidator,
  leaseExpiresAt: v.optional(v.number()),
  attemptCount: v.number(),
  expiresAt: v.number(),
});

export const xChatSendLeaseResultValidator = v.union(
  v.object({
    kind: v.literal("sent"),
    operationId: v.id("xChatSendOperations"),
    messageId: v.string(),
  }),
  v.object({
    kind: v.literal("in_progress"),
    operationId: v.id("xChatSendOperations"),
    retryAt: v.number(),
  }),
  v.object({
    kind: v.literal("acquired"),
    operationId: v.id("xChatSendOperations"),
    messageId: v.string(),
    encodedMessageCreateEvent: v.string(),
    encodedMessageEventSignature: v.string(),
    existed: v.boolean(),
  })
);

export const unifiedPlatformIdValidator = v.union(
  v.literal("twitter"),
  v.literal("linkedin"),
  v.literal("reddit"),
  v.literal("threads"),
  v.literal("bluesky")
);

export const unifiedAuthorValidator = v.object({
  id: v.optional(v.string()),
  handle: v.optional(v.string()),
  name: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  profileUrl: v.optional(v.string()),
  headline: v.optional(v.string()),
  type: v.optional(v.string()),
});

export const unifiedMediaValidator = v.object({
  id: v.optional(v.string()),
  type: v.union(v.literal("image"), v.literal("video"), v.literal("link")),
  url: v.optional(v.string()),
  unavailable: v.optional(v.boolean()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  posterUrl: v.optional(v.string()),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  faviconUrl: v.optional(v.string()),
});

export const unifiedPostValidator = v.object({
  id: v.string(),
  platform: unifiedPlatformIdValidator,
  url: v.optional(v.string()),
  author: unifiedAuthorValidator,
  text: v.string(),
  createdAt: v.number(),
  metrics: v.optional(
    v.object({
      reactions: v.optional(v.number()),
      comments: v.optional(v.number()),
      reposts: v.optional(v.number()),
      quotes: v.optional(v.number()),
      views: v.optional(v.number()),
    })
  ),
  media: v.optional(v.array(unifiedMediaValidator)),
  activity: v.optional(
    v.object({
      type: v.union(v.literal("like"), v.literal("repost")),
      actor: unifiedAuthorValidator,
    })
  ),
  raw: v.optional(v.any()),
});

export const linkedinProfilePostsPageResultValidator = v.object({
  posts: v.array(unifiedPostValidator),
  nextCursor: v.union(v.string(), v.null()),
  error: v.optional(v.string()),
});

export const platformConversationAttachmentVariantValidator = v.object({
  url: v.string(),
  mimeType: v.optional(v.string()),
  bitrate: v.optional(v.number()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

export const platformConversationAttachmentValidator = v.object({
  id: v.optional(v.string()),
  mediaKey: v.optional(v.string()),
  type: v.string(),
  url: v.optional(v.string()),
  previewUrl: v.optional(v.string()),
  altText: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  fileName: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  fileSize: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  variants: v.optional(v.array(platformConversationAttachmentVariantValidator)),
  isGif: v.optional(v.boolean()),
  isVoiceNote: v.optional(v.boolean()),
  unavailable: v.optional(v.boolean()),
  urlExpiresAt: v.optional(v.string()),
  linkedinPostUrl: v.optional(v.string()),
});

export const platformConversationSharedPostValidator = v.object({
  id: v.string(),
  url: v.string(),
  text: v.optional(v.string()),
  authorId: v.optional(v.string()),
  authorHandle: v.optional(v.string()),
  authorName: v.optional(v.string()),
  authorAvatarUrl: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  media: v.optional(v.array(platformConversationAttachmentValidator)),
});

export const platformConversationQuotedMessageValidator = v.object({
  id: v.string(),
  text: v.optional(v.string()),
  senderName: v.optional(v.string()),
  direction: v.optional(v.union(v.literal("sent"), v.literal("received"))),
  attachmentType: v.optional(v.string()),
  attachments: v.optional(v.array(platformConversationAttachmentValidator)),
  sharedPost: v.optional(platformConversationSharedPostValidator),
});

export const platformConversationReactionValidator = v.object({
  emoji: v.string(),
  count: v.number(),
  reactedByViewer: v.optional(v.boolean()),
});

export const platformConversationSeenByValidator = v.object({
  userId: v.optional(v.string()),
  attendeeId: v.optional(v.string()),
  senderName: v.optional(v.string()),
  seenAt: v.optional(v.number()),
});

export const platformConversationEventMetadataValidator = v.object({
  providerEventType: v.optional(v.string()),
  eventLabel: v.optional(v.string()),
  actorUserId: v.optional(v.string()),
  actorName: v.optional(v.string()),
  targetMessageId: v.optional(v.string()),
});

export const platformConversationMessageLookupValidator = v.object({
  messageId: v.string(),
  providerMessageId: v.optional(v.string()),
  text: v.optional(v.string()),
  attachments: v.optional(v.array(platformConversationAttachmentValidator)),
});

export const xActivityEventTypeValidator = v.union(
  v.literal("dm.sent"),
  v.literal("dm.received"),
  v.literal("dm.indicate_typing"),
  v.literal("dm.read"),
  v.literal("chat.sent"),
  v.literal("chat.received"),
  v.literal("chat.conversation_join"),
  v.literal("post.create")
);

export const twitterConversationTypingPresenceValidator = v.union(
  v.null(),
  v.object({
    senderUserId: v.string(),
    expiresAt: v.number(),
  })
);

export const platformConversationEventTypeValidator = v.union(
  v.literal("dm.sent"),
  v.literal("dm.received"),
  v.literal("dm.read"),
  v.literal("chat.sent"),
  v.literal("chat.received"),
  v.literal("chat.conversation_join"),
  v.literal("message_received"),
  v.literal("message_sent"),
  v.literal("message_read"),
  v.literal("message_reaction"),
  v.literal("message_edited"),
  v.literal("message_deleted"),
  v.literal("message_delivered"),
  v.literal("new_relation")
);

export const platformConversationMessageTypeValidator = v.union(
  v.literal("MESSAGE"),
  v.literal("INVITATION"),
  v.literal("INMAIL"),
  v.literal("INMAIL_DECLINE"),
  v.literal("INMAIL_REPLY"),
  v.literal("INMAIL_ACCEPT")
);

export const platformConversationRevisionValidator = v.union(
  v.null(),
  v.object({
    updatedAt: v.number(),
    latestMessageId: v.optional(v.string()),
    latestMessageAt: v.optional(v.number()),
  })
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
  v.literal("preview_search_in_progress"),
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

export const setupInputModeValidator = v.union(
  v.literal("url"),
  v.literal("manual")
);

const setupPreviewReviewModeLiteralValidators = SETUP_PREVIEW_REVIEW_MODES.map(
  (mode) => v.literal(mode)
) as [ReturnType<typeof v.literal>, ...ReturnType<typeof v.literal>[]];
export const setupPreviewReviewModeValidator = v.union(
  ...setupPreviewReviewModeLiteralValidators
);

export const setupProspectOriginValidator = v.union(
  v.literal("setup_preview"),
  v.literal("workspace_discovery"),
  v.literal("manual")
);

export const updateWorkspaceArgsValidator = v.object({
  workspaceId: v.id("workspaces"),
  name: v.optional(workspaceNameValidator),
  description: v.optional(v.string()),
  descriptionSource: v.optional(v.union(v.literal("manual"), v.literal("url"))),
  sourceUrl: v.optional(v.string()),
  lastGeneratedAt: v.optional(v.number()),
});

/** Legacy stored data retained until old workspace rows have been migrated. */
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
  reportingTimeZone: v.optional(v.string()),
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

export const getDynamicThreadDataArgsValidator = v.object({
  threadId: v.string(),
  repliesCursor: v.optional(v.string()),
});

export const getConversationContextArgsValidator = v.object({
  rootTweetId: v.string(),
  repliesCursor: v.optional(v.string()),
  matchedReplyTweetId: v.optional(v.string()),
});

// Email validators
export const sendWelcomeEmailArgsValidator = v.object({
  email: v.string(),
});

// v4: Plan tier validator
export const planTierValidator = v.union(
  v.literal("free"),
  v.literal("hobby"),
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

export const agentComponentThreadStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived")
);

export const agentMessageRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("thought")
);

export const agentUsageSnapshotValidator = v.object({
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
  reasoningTokens: v.optional(v.number()),
  cachedInputTokens: v.optional(v.number()),
  cacheReadTokens: v.optional(v.number()),
  cacheWriteTokens: v.optional(v.number()),
  noCacheTokens: v.optional(v.number()),
  cost: v.optional(v.number()),
  modelSelected: v.optional(v.string()),
  providerSelected: v.optional(v.string()),
});

// v4: Prospect validators
export const prospectPlatformValidator = v.union(
  v.literal("twitter"),
  v.literal("linkedin")
);

export const qualificationSourceContentTypeValidator = v.union(
  v.literal("post"),
  v.literal("reply"),
  v.literal("quote_post")
);

/**
 * A prospect-authored social source that passed deterministic authorship and
 * quote validation after the semantic qualification check.
 */
export const qualificationSourceValidator = v.object({
  verificationVersion: v.literal(1),
  evidenceKind: v.union(
    v.literal("social_content"),
    v.literal("external_article")
  ),
  platform: prospectPlatformValidator,
  contentType: qualificationSourceContentTypeValidator,
  sourceId: v.string(),
  sourceUrl: v.string(),
  evidenceUrl: v.optional(v.string()),
  authorId: v.string(),
  text: v.string(),
  publishedAt: v.optional(v.string()),
  discoveryQueries: v.array(v.string()),
  supportingQuote: v.string(),
  verifiedAt: v.number(),
  // Raw provider-shaped post data is intentional so existing native post
  // renderers can display the original X or LinkedIn source.
  sourcePost: v.any(),
});

export const qualificationVerificationValidator = v.object({
  version: v.literal(1),
  status: v.union(v.literal("validated"), v.literal("failed")),
  validatedAt: v.number(),
  candidateSourceCount: v.number(),
  supportedSourceCount: v.number(),
  discoveryQueries: v.array(v.string()),
});

export const qualificationAuditRunStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed")
);

export const qualificationAuditOutcomeValidator = v.union(
  v.literal("kept_qualified"),
  v.literal("would_disqualify"),
  v.literal("error")
);

export const qualificationAuditEvidenceOriginValidator = v.union(
  v.literal("existing"),
  v.literal("refetched"),
  v.literal("mixed")
);

export const qualificationAuditApplicationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed")
);

export const qualificationAuditItemApplicationOutcomeValidator = v.union(
  v.literal("applied"),
  v.literal("skipped_stale"),
  v.literal("skipped_missing")
);

export const qualificationAuditApplicationItemResultValidator = v.object({
  prospectId: v.id("prospects"),
  outcome: qualificationAuditItemApplicationOutcomeValidator,
  proposedStatus: v.optional(
    v.union(v.literal("qualified"), v.literal("disqualified"))
  ),
  reason: v.optional(v.string()),
});

export const qualificationAuthenticityValidator = v.object({
  isLikelyBot: v.boolean(),
  accountAge: v.optional(v.number()),
  followersCount: v.optional(v.number()),
  followingCount: v.optional(v.number()),
  engagementRate: v.optional(v.number()),
  flags: v.array(v.string()),
});

export const qualificationScoreBreakdownValidator = v.object({
  profileFit: v.number(),
  signalQuality: v.number(),
  intentStrength: v.number(),
  recency: v.number(),
  total: v.number(),
});

export const qualificationFailureValidator = v.object({
  stage: v.union(
    v.literal("evidence_fetch"),
    v.literal("model_evaluation"),
    v.literal("workflow")
  ),
  provider: v.string(),
  model: v.optional(v.string()),
  code: v.string(),
  message: v.string(),
  attemptCount: v.optional(v.number()),
  /** Number of completed durable qualification runs for the same failure. */
  workflowAttemptCount: v.optional(v.number()),
  /** Earliest time the next rate-bounded automatic retry may start. */
  nextRetryAt: v.optional(v.number()),
  failedAt: v.number(),
});

export const qualificationAuditItemResultValidator = v.object({
  prospectId: v.id("prospects"),
  platform: prospectPlatformValidator,
  displayName: v.string(),
  previousScore: v.optional(v.number()),
  proposedScore: v.optional(v.number()),
  proposedStatus: v.optional(
    v.union(v.literal("qualified"), v.literal("disqualified"))
  ),
  outcome: qualificationAuditOutcomeValidator,
  evidenceOrigin: qualificationAuditEvidenceOriginValidator,
  existingEvidenceCount: v.number(),
  evaluatedEvidenceCount: v.number(),
  verifiedSourceCount: v.number(),
  reasoning: v.string(),
  error: v.optional(v.string()),
  failure: v.optional(qualificationFailureValidator),
  qualificationSources: v.array(qualificationSourceValidator),
  qualificationVerification: v.optional(qualificationVerificationValidator),
  authenticity: v.optional(qualificationAuthenticityValidator),
  scoreBreakdown: v.optional(qualificationScoreBreakdownValidator),
});

export const prospectStatusValidator = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("in_progress"),
  v.literal("converted"),
  v.literal("archived")
);

export const prospectListSortValidator = v.union(
  v.literal("best_fit_first"),
  v.literal("lowest_fit_first"),
  v.literal("newest_first"),
  v.literal("oldest_first"),
  v.literal("individuals_first"),
  v.literal("organizations_first")
);

export const prospectVisibilityModeValidator = v.union(
  v.literal("all"),
  v.literal("ready_only"),
  v.literal("actionable_only")
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

export const agentOpsTabValidator = v.union(
  v.literal("overview"),
  v.literal("discovery"),
  v.literal("quality"),
  v.literal("memory"),
  v.literal("activity")
);

export const agentOpsMemorySortValidator = v.union(
  v.literal("impact_desc"),
  v.literal("confidence_desc"),
  v.literal("recent_desc")
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

export const mentionEntityKindValidator = v.union(
  v.literal("prospect"),
  v.literal("plan"),
  v.literal("task"),
  v.literal("attachment"),
  v.literal("post")
);

export const mentionAttachmentMediaKindValidator = v.union(
  v.literal("image"),
  v.literal("gif"),
  v.literal("video"),
  v.literal("file")
);

export const workspaceAttachmentDestinationValidator = v.object({
  platform: v.union(v.literal("twitter"), v.literal("linkedin")),
  surface: v.union(v.literal("comment"), v.literal("dm")),
});

export const workspaceAttachmentKindValidator = v.union(
  v.literal("image"),
  v.literal("gif"),
  v.literal("video"),
  v.literal("file")
);

export const workspaceAttachmentCompatibilityValidator = v.object({
  compatible: v.boolean(),
  reason: v.union(v.string(), v.null()),
});

export const workspaceAttachmentCompatibilityMatrixValidator = v.object({
  twitterReply: workspaceAttachmentCompatibilityValidator,
  twitterDm: workspaceAttachmentCompatibilityValidator,
  linkedInComment: workspaceAttachmentCompatibilityValidator,
  linkedInDm: workspaceAttachmentCompatibilityValidator,
});

export const workspaceAttachmentRecordValidator = v.object({
  uploadId: v.id("mediaUploads"),
  fileName: v.string(),
  displayName: v.string(),
  mimeType: v.string(),
  mediaKind: workspaceAttachmentKindValidator,
  size: v.number(),
  tags: v.array(v.string()),
  uploadedAt: v.number(),
  mediaUrl: v.string(),
  compatibility: workspaceAttachmentCompatibilityMatrixValidator,
});

export const workspaceAttachmentCountBreakdownValidator = v.object({
  total: v.number(),
  images: v.number(),
  gifs: v.number(),
  videos: v.number(),
  files: v.number(),
});

export const resolvedOutreachMediaValidator = v.object({
  uploadId: v.id("mediaUploads"),
  url: v.string(),
  fileName: v.string(),
  mimeType: v.string(),
  size: v.number(),
  kind: workspaceAttachmentKindValidator,
});

export const mentionPostPlatformValidator = v.union(
  v.literal("twitter"),
  v.literal("linkedin")
);

export const agentMessagePromptTextSourceValidator = v.union(
  v.literal("user"),
  v.literal("synthetic")
);

export const agentMessageAttachmentReferenceValidator = v.object({
  uploadId: v.optional(v.union(v.string(), v.null())),
  fileName: v.string(),
  mediaUrl: v.optional(v.union(v.string(), v.null())),
});

export const agentAttachmentToolReferenceValidator = v.object({
  reference: v.string(),
  uploadId: v.id("mediaUploads"),
  url: v.string(),
  fileName: v.string(),
  mediaKind: mentionAttachmentMediaKindValidator,
  selectedInCurrentMessage: v.boolean(),
});

export const agentMessageTaggedEntityValidator = v.object({
  id: v.string(),
  entityId: v.string(),
  kind: mentionEntityKindValidator,
  label: v.string(),
  mentionText: v.string(),
  secondaryLabel: v.string(),
  avatarUrl: v.optional(v.union(v.string(), v.null())),
  verified: v.boolean(),
  referenceText: v.optional(v.string()),
  workspaceId: v.optional(v.string()),
  prospectId: v.optional(v.string()),
  handle: v.optional(v.string()),
  planId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  attachmentUrl: v.optional(v.union(v.string(), v.null())),
  attachmentMimeType: v.optional(v.union(v.string(), v.null())),
  attachmentSize: v.optional(v.union(v.number(), v.null())),
  attachmentMediaKind: v.optional(
    v.union(mentionAttachmentMediaKindValidator, v.null())
  ),
  attachmentDisabled: v.optional(v.boolean()),
  attachmentDisabledReason: v.optional(v.union(v.string(), v.null())),
  postId: v.optional(v.string()),
  postUrl: v.optional(v.union(v.string(), v.null())),
  postPlatform: v.optional(v.union(mentionPostPlatformValidator, v.null())),
});

export const agentMessageContextMetadataValidator = v.object({
  version: v.literal(1),
  promptTextSource: agentMessagePromptTextSourceValidator,
  taggedEntities: v.array(agentMessageTaggedEntityValidator),
  attachments: v.array(agentMessageAttachmentReferenceValidator),
});

/**
 * Browser-decrypted XChat context is accepted only for the active Agent turn.
 * The PIN and private key material are never part of this contract.
 */
export const xChatDecryptedMessageValidator = v.object({
  id: v.string(),
  senderId: v.string(),
  direction: v.union(v.literal("sent"), v.literal("received")),
  occurredAt: v.number(),
  text: v.string(),
});

export const xChatTransientContextValidator = v.object({
  prospectId: v.id("prospects"),
  conversationId: v.string(),
  decryptedAt: v.number(),
  coverageComplete: v.boolean(),
  excludedAttachmentCount: v.number(),
  messages: v.array(xChatDecryptedMessageValidator),
});

export const agentThreadTargetSelectionTargetValidator = v.object({
  prospectId: v.id("prospects"),
  label: v.string(),
  handle: v.optional(v.string()),
});

// ============================================================================
// Tenant-fair background scheduler
// ============================================================================

export const tenantSchedulerModeValidator = v.union(
  v.literal("legacy"),
  v.literal("shadow"),
  v.literal("enforced")
);

export const tenantJobClassValidator = v.union(
  v.literal("interactive"),
  v.literal("preview"),
  v.literal("background")
);

export const tenantJobKindValidator = v.union(
  v.literal("setup_generation"),
  v.literal("qualification"),
  v.literal("enrichment"),
  v.literal("auto_plan"),
  v.literal("plan_batch_item"),
  v.literal("memory_evaluation")
);

export const tenantJobStatusValidator = v.union(
  v.literal("shadow"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("cancelled")
);

export const tenantJobLaneStateValidator = v.union(
  v.literal("idle"),
  v.literal("ready"),
  v.literal("paused")
);

export const tenantSchedulerSlotStatusValidator = v.union(
  v.literal("free"),
  v.literal("claimed")
);

export const tenantJobEnqueueFailureStatusValidator = v.union(
  v.literal("unresolved"),
  v.literal("resolved")
);

export const tenantJobPayloadValidator = v.union(
  v.object({
    kind: v.literal("setup_generation"),
    sessionId: v.id("workspaceSetupSessions"),
  }),
  v.object({
    kind: v.literal("qualification"),
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    preview: v.boolean(),
  }),
  v.object({
    kind: v.literal("enrichment"),
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    claimToken: v.string(),
    force: v.optional(v.boolean()),
    preview: v.boolean(),
  }),
  v.object({
    kind: v.literal("auto_plan"),
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    runId: v.id("autoPlanRuns"),
  }),
  v.object({
    kind: v.literal("plan_batch_item"),
    workspaceId: v.id("workspaces"),
    runId: v.id("planBatchRuns"),
    itemId: v.id("planBatchItems"),
  }),
  v.object({
    kind: v.literal("memory_evaluation"),
    workspaceId: v.id("workspaces"),
    enqueueToken: v.optional(v.number()),
  })
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

export const linkedInRecoveryCandidateValidator = v.object({
  planId: v.id("outreachPlans"),
  taskId: v.id("outreachTasks"),
  prospectId: v.id("prospects"),
  userId: v.id("users"),
  taskType: v.union(v.literal("dm"), v.literal("comment")),
  targetTweetId: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  hasActiveRecoveryMonitor: v.boolean(),
  hasPostedArtifact: v.boolean(),
});

export const outreachInteractionChannelValidator = v.union(
  v.literal("twitter_reply"),
  v.literal("twitter_dm"),
  v.literal("linkedin_dm"),
  v.literal("linkedin_comment"),
  v.literal("linkedin_invite")
);

export const outreachInteractionEventStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("ignored"),
  v.literal("superseded")
);

export const adaptiveOutreachOutcomeValidator = v.union(
  v.literal("continue"),
  v.literal("completed"),
  v.literal("abandoned")
);

export const outreachPlanRevisionActorValidator = v.union(
  v.literal("agent"),
  v.literal("user"),
  v.literal("system"),
  v.literal("migration")
);

export const outreachPlanRevisionTriggerKindValidator = v.union(
  v.literal("generated"),
  v.literal("agent_refinement"),
  v.literal("interaction_replan"),
  v.literal("migration_snapshot")
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

export const disqualificationOutreachCleanupSummaryValidator = v.object({
  plans: v.number(),
  tasks: v.number(),
  workflows: v.number(),
  prospectMonitors: v.number(),
  recoveryMonitors: v.number(),
  actionRequests: v.number(),
  notifications: v.number(),
});

export const disqualificationOutreachCleanupPreviewValidator = v.object({
  planIds: v.array(v.id("outreachPlans")),
  summary: disqualificationOutreachCleanupSummaryValidator,
});

export const disqualificationOutreachPlanCleanupPreviewValidator = v.union(
  v.null(),
  v.object({
    planId: v.id("outreachPlans"),
    summary: disqualificationOutreachCleanupSummaryValidator,
  })
);

export const disqualificationOutreachCleanupWorkflowResultValidator = v.object({
  summary: disqualificationOutreachCleanupSummaryValidator,
  analyticsRowsRebuilt: v.number(),
});

export const disqualificationOutreachCleanupStartResultValidator = v.object({
  started: v.boolean(),
  workflowId: v.optional(v.string()),
  preview: disqualificationOutreachCleanupPreviewValidator,
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
  v.literal("dm"),
  v.literal("react"),
  v.literal("wait"),
  v.literal("ask_human")
);

export const outreachEditableTaskTypeValidator = v.union(
  v.literal("comment"),
  v.literal("dm")
);

export const outreachApprovableTaskTypeValidator = v.union(
  v.literal("comment"),
  v.literal("dm"),
  v.literal("react")
);

export const outreachReactionTypeValidator = v.union(
  v.literal("like"),
  v.literal("celebrate"),
  v.literal("support"),
  v.literal("love"),
  v.literal("insightful"),
  v.literal("funny")
);

// Task status
export const outreachTaskStatusValidator = v.union(
  v.literal("pending"),
  v.literal("scheduled"),
  v.literal("executing"),
  v.literal("waiting_manual"),
  v.literal("waiting_connection"),
  v.literal("waiting_response"),
  v.literal("completed"),
  v.literal("skipped"),
  v.literal("failed")
);

export const outreachRecoveryKindValidator = v.union(
  v.literal("twitter_manual_reply"),
  v.literal("linkedin_comment_reply"),
  v.literal("linkedin_connection_then_dm")
);

export const outreachRecoveryStageValidator = v.union(
  v.literal("detecting_outbound"),
  v.literal("awaiting_connection"),
  v.literal("awaiting_response")
);

export const outreachRecoveryStatusValidator = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("expired"),
  v.literal("failed")
);

/**
 * Compact, denormalized outreach state for prospect list cards.
 * Keep this intentionally small so paginated summary reads stay lightweight.
 */
export const outreachProgressSummaryValidator = v.object({
  planStatus: outreachPlanStatusValidator,
  finishedTaskCount: v.number(),
  totalTaskCount: v.number(),
  activeTask: v.optional(
    v.object({
      order: v.number(),
      type: outreachTaskTypeValidator,
      description: v.string(),
      status: outreachTaskStatusValidator,
      awaitingApproval: v.boolean(),
    })
  ),
});

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
  v.literal("social_action_request"),
  v.literal("social_action_completed"),
  v.literal("social_action_failed"),
  v.literal("setup_preview_ready"),
  v.literal("plan_completed"),
  v.literal("plan_batch_ready"),
  v.literal("plan_batch_started"),
  v.literal("plan_batch_completed"),
  v.literal("plan_batch_partial"),
  v.literal("plan_batch_failed"),
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
  v.literal("x_twitter_sdk"),
  v.literal("linkedin_unipile")
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

export const linkedinAccountStatusValidator = v.union(
  v.literal("connected"),
  v.literal("connecting"),
  v.literal("reconnect_required"),
  v.literal("action_required"),
  v.literal("restricted"),
  v.literal("disconnected")
);

export const linkedinProfileIdentityValidator = v.object({
  entityType: v.union(v.literal("person"), v.literal("company")),
  displayName: v.optional(v.string()),
  headline: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  profileUrl: v.optional(v.string()),
  providerId: v.optional(v.string()),
  username: v.optional(v.string()),
});

export const linkedinDmPostPreviewArgsValidator = v.object({
  prospectId: v.id("prospects"),
  postUrl: v.string(),
});

export const unipileAccountSourceStatusValidator = v.union(
  v.literal("OK"),
  v.literal("STOPPED"),
  v.literal("ERROR"),
  v.literal("CREDENTIALS"),
  v.literal("PERMISSIONS"),
  v.literal("CONNECTING")
);

export const unipileWebhookSourceValidator = v.union(
  v.literal("messaging"),
  v.literal("users"),
  v.literal("account_status")
);

export const unipileWebhookEventValidator = v.union(
  v.literal("message_received"),
  v.literal("message_read"),
  v.literal("message_reaction"),
  v.literal("message_edited"),
  v.literal("message_deleted"),
  v.literal("message_delivered"),
  v.literal("new_relation"),
  v.literal("creation_success"),
  v.literal("creation_fail"),
  v.literal("deleted"),
  v.literal("reconnected"),
  v.literal("sync_success"),
  v.literal("stopped"),
  v.literal("ok"),
  v.literal("connecting"),
  v.literal("error"),
  v.literal("credentials"),
  v.literal("permissions")
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

export const outreachTaskInputValidator = v.object({
  type: outreachTaskTypeValidator,
  description: v.string(),
  timing: outreachTaskTimingValidator,
  targetTweetId: v.optional(v.string()),
  targetCommentId: v.optional(v.string()),
  reactionType: v.optional(outreachReactionTypeValidator),
  content: v.optional(v.string()),
  mediaUrls: v.optional(v.array(v.string())),
  mediaUploadIds: v.optional(v.array(v.id("mediaUploads"))),
  mediaDescriptions: v.optional(v.array(v.string())),
  mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
  approvalContext: v.optional(outreachTaskApprovalContextValidator),
});

export const outreachPlanSnapshotTaskValidator = v.object({
  _id: v.id("outreachTasks"),
  order: v.number(),
  type: outreachTaskTypeValidator,
  description: v.string(),
  status: outreachTaskStatusValidator,
  content: v.optional(v.string()),
  targetTweetId: v.optional(v.string()),
  targetCommentId: v.optional(v.string()),
  reactionType: v.optional(outreachReactionTypeValidator),
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

export const outreachPlanRevisionTaskSnapshotValidator = v.object({
  taskId: v.id("outreachTasks"),
  order: v.number(),
  type: outreachTaskTypeValidator,
  description: v.string(),
  status: outreachTaskStatusValidator,
  timing: outreachTaskTimingValidator,
  targetTweetId: v.optional(v.string()),
  targetCommentId: v.optional(v.string()),
  reactionType: v.optional(outreachReactionTypeValidator),
  content: v.optional(v.string()),
  originalDraftContent: v.optional(v.string()),
  mediaUrls: v.optional(v.array(v.string())),
  mediaUploadIds: v.optional(v.array(v.id("mediaUploads"))),
  mediaDescriptions: v.optional(v.array(v.string())),
  mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
  approvalContext: v.optional(outreachTaskApprovalContextValidator),
  approvedAt: v.optional(v.number()),
  scheduledAt: v.optional(v.number()),
  executedAt: v.optional(v.number()),
  resultData: v.optional(v.any()),
  errorMessage: v.optional(v.string()),
});

export const outreachPlanRevisionTriggerValidator = v.object({
  kind: outreachPlanRevisionTriggerKindValidator,
  actor: outreachPlanRevisionActorValidator,
  reason: v.string(),
  sourceEventKey: v.optional(v.string()),
  interactionChannel: v.optional(outreachInteractionChannelValidator),
  responseMessageId: v.optional(v.string()),
});

export const adaptiveOutreachDecisionValidator = v.object({
  outcome: adaptiveOutreachOutcomeValidator,
  summary: v.string(),
  reasoning: v.string(),
  strategy: v.optional(outreachStrategyValidator),
  tasks: v.array(outreachTaskInputValidator),
});

export const prospectActivityMetadataValidator = v.object({
  planId: v.optional(v.id("outreachPlans")),
  taskId: v.optional(v.id("outreachTasks")),
  responseTweetId: v.optional(v.string()),
  responseDmMessageId: v.optional(v.string()),
  responseInviteId: v.optional(v.string()),
  responseCommentId: v.optional(v.string()),
  conversationId: v.optional(v.string()),
  planSnapshot: v.optional(storedOutreachPlanSnapshotValidator),
});

// Monitor status (shared between socialQueryMonitors, prospectMonitors, and styleMonitors)
export const monitorStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("deleted")
);

// Style monitor backfill status
export const styleBackfillStatusValidator = v.union(
  v.literal("pending"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("failed")
);

// Style content sample type (platform-agnostic)
export const styleContentTypeValidator = v.union(
  v.literal("original_post"),
  v.literal("comment"),
  v.literal("reply"),
  v.literal("repost")
);

// Writing style profile status
export const styleProfileStatusValidator = v.union(
  v.literal("none"),
  v.literal("collecting"),
  v.literal("analyzing"),
  v.literal("ready"),
  v.literal("failed")
);

export const workspaceWritingStyleContextValidator = v.union(
  v.object({
    status: v.literal("ready"),
    writingStyle: v.string(),
    profileVersion: v.number(),
    source: v.union(v.literal("canonical"), v.literal("legacy")),
  }),
  v.object({
    status: v.literal("not_ready"),
    reason: v.union(
      v.literal("profile_not_ready"),
      v.literal("memory_missing")
    ),
    profileVersion: v.optional(v.number()),
  })
);

export const workspaceStyleBootstrapResultValidator = v.object({
  platform: prospectPlatformValidator,
  status: v.union(v.literal("scheduled"), v.literal("skipped")),
  reason: v.union(
    v.literal("scheduled"),
    v.literal("already_initialized"),
    v.literal("already_queued"),
    v.literal("recovery_exhausted"),
    v.literal("insufficient_samples"),
    v.literal("no_active_source"),
    v.literal("no_workspace")
  ),
});

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

export const linkedinSearchSurfaceValidator = v.union(
  v.literal("posts"),
  v.literal("people")
);

export const socialQueryStyleValidator = v.union(
  v.literal("natural_phrase"),
  v.literal("professional_keyword"),
  v.literal("role_title")
);

export const twitterProspectingSearchModeValidator = v.union(
  v.literal("exact"),
  v.literal("raw")
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

export const workspaceAgentAutonomyModeValidator = v.union(
  v.literal("review_required"),
  v.literal("autonomous")
);

export const workspacePlanStartSourceValidator = v.union(
  v.literal("workspace_settings"),
  v.literal("agent_command")
);

export const workspacePlanStartStatusValidator = v.union(
  v.literal("awaiting_confirmation"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("cancelled")
);

export const prospectingWorkflowPauseReasonValidator = v.union(
  v.literal("manual"),
  v.literal("inactive")
);

export const prospectingBootstrapCompletionReasonValidator = v.union(
  v.literal("target_reached"),
  v.literal("cycle_limit_reached"),
  v.literal("no_progress_timeout_reached"),
  // Kept for compatibility with bootstrap records written before the
  // no-progress timeout replaced the absolute duration limit.
  v.literal("duration_limit_reached")
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
  v.literal("icp_refresh_required"),
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

export const prospectStageTimestampsValidator = v.object({
  new: v.optional(v.number()),
  contacted: v.optional(v.number()),
  in_progress: v.optional(v.number()),
  converted: v.optional(v.number()),
  archived: v.optional(v.number()),
});

// Plan generation status (used for auto outreach plan generation)
export const planGenerationStatusValidator = v.union(
  v.literal("idle"),
  v.literal("generating"),
  v.literal("completed"),
  v.literal("failed")
);

export const autoPlanRunStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed")
);

export const planBatchOperationValidator = v.union(
  v.literal("create"),
  v.literal("update"),
  v.literal("create_or_update")
);

export const planBatchItemOperationValidator = v.union(
  v.literal("create"),
  v.literal("update")
);

export const planBatchScopeKindValidator = v.union(
  v.literal("tagged"),
  v.literal("plan_group"),
  v.literal("named"),
  v.literal("all"),
  v.literal("fit_score")
);

export const planBatchRunStatusValidator = v.union(
  v.literal("selecting"),
  v.literal("awaiting_confirmation"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("cancelled")
);

export const planBatchDispatchResultValidator = v.union(
  v.object({
    done: v.boolean(),
    status: planBatchRunStatusValidator,
  }),
  v.null()
);

export const planBatchDispatchSelectionValidator = v.union(
  v.object({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    itemIds: v.array(v.id("planBatchItems")),
    status: planBatchRunStatusValidator,
  }),
  v.null()
);

export const planBatchDispatchItemResultValidator = v.union(
  v.object({
    dispatched: v.boolean(),
    status: planBatchRunStatusValidator,
  }),
  v.null()
);

export const planBatchItemStatusValidator = v.union(
  v.literal("pending"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("skipped"),
  v.literal("cancelled")
);

export const planBatchAttachmentValidator = v.object({
  url: v.string(),
  fileName: v.string(),
  mediaKind: mentionAttachmentMediaKindValidator,
});

export const planBatchWorkCompletionContextValidator = v.object({
  runId: v.id("planBatchRuns"),
  itemId: v.id("planBatchItems"),
  tenantJobId: v.optional(v.id("tenantJobs")),
});

export const autoPlanFailureCodeValidator = v.union(
  v.literal("reconnect_required"),
  v.literal("writing_style_unavailable"),
  v.literal("grounding_unavailable"),
  v.literal("provider_data_unavailable"),
  v.literal("provider_balance_unavailable"),
  v.literal("provider_schema_unsupported"),
  v.literal("context_too_large"),
  v.literal("provider_transient"),
  v.literal("generation_failed")
);

export const providerNameValidator = v.union(
  v.literal("socialapi"),
  v.literal("linkdapi"),
  v.literal("exa")
);

export const providerCircuitStatusValidator = v.union(
  v.literal("closed"),
  v.literal("open"),
  v.literal("half_open")
);

export const providerCircuitReasonValidator = v.union(
  v.literal("credits"),
  v.literal("authentication"),
  v.literal("rate_limit"),
  v.literal("transient"),
  v.literal("unknown")
);

export const providerRequestOutcomeValidator = v.union(
  v.literal("success"),
  v.literal("error"),
  v.literal("blocked")
);

export const autoPlanGenerationClaimResultValidator = v.object({
  claimed: v.boolean(),
  reason: v.union(
    v.literal("claimed"),
    v.literal("already_generating"),
    v.literal("existing_plan"),
    v.literal("ineligible")
  ),
  planId: v.optional(v.id("outreachPlans")),
  runId: v.optional(v.id("autoPlanRuns")),
});

export const autoPlanGenerationResultValidator = v.object({
  success: v.boolean(),
  planId: v.id("outreachPlans"),
  threadId: v.string(),
  existing: v.boolean(),
});

export const autoPlanWorkCompletionContextValidator = v.object({
  prospectId: v.id("prospects"),
  runId: v.id("autoPlanRuns"),
  tenantJobId: v.optional(v.id("tenantJobs")),
});

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

// Per-workspace Aggregate migration lifecycle.
export const aggregateRolloutStatusValidator = v.union(
  v.literal("preparing"),
  v.literal("backfilling"),
  v.literal("verifying"),
  v.literal("verified"),
  v.literal("failed")
);
export const fitScoreAggregateRolloutStatusValidator = v.union(
  v.literal("backfilling"),
  v.literal("verifying"),
  v.literal("verified"),
  v.literal("failed")
);

export const workspaceReportingMigrationStageValidator = v.union(
  v.literal("prospects"),
  v.literal("prospectActivityLog"),
  v.literal("outreachPlans"),
  v.literal("outreachTasks"),
  v.literal("keywords"),
  v.literal("queryCandidates"),
  v.literal("memorySuggestions"),
  v.literal("memoryWorkflowEvents"),
  v.literal("memoryEvaluatorRuns"),
  v.literal("workspaceAgentMemoryInventory"),
  v.literal("verifyAnalyticsDaily"),
  v.literal("verifyAnalyticsStripes"),
  v.literal("verifyAgentOpsDaily"),
  v.literal("verifyAgentOpsStripes")
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
  v.literal("operator_instruction"),
  v.literal("qualification_win_pattern"),
  v.literal("qualification_false_positive_pattern"),
  v.literal("enrichment_signal_pattern"),
  v.literal("enrichment_role_pattern"),
  v.literal("outreach_winning_pattern"),
  v.literal("outreach_objection_pattern"),
  v.literal("writing_style_profile_twitter"),
  v.literal("writing_style_profile_linkedin")
);

export const workspaceMemorySourceValidator = v.union(
  v.literal("qualification"),
  v.literal("enrichment"),
  v.literal("outreach"),
  v.literal("operator"),
  v.literal("style_analysis")
);

/**
 * Canonical workspace-memory authority. Operator-authored instructions are
 * always kept separate from inferred/learned observations so background
 * learning can never outrank an explicit user instruction.
 */
export const workspaceMemoryAuthorityValidator = v.union(
  v.literal("operator"),
  v.literal("learned")
);

export const workspaceMemoryStatusValidator = v.union(
  v.literal("active"),
  v.literal("superseded"),
  v.literal("disabled")
);

export const workspaceMemoryIndexStatusValidator = v.union(
  v.literal("pending"),
  v.literal("ready"),
  v.literal("failed")
);

export const workspaceMemoryProvenanceKindValidator = v.union(
  v.literal("user_instruction"),
  v.literal("agent_learning"),
  v.literal("style_analysis"),
  v.literal("legacy_backfill")
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
  v.literal("workflow_event"),
  v.literal("style_tweet"),
  v.literal("style_content"),
  v.literal("style_edit_diff")
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
  v.literal("prospect_converted"),
  v.literal("style_backfill_completed"),
  v.literal("style_content_backfill_completed"),
  v.literal("style_content_batch_ready"),
  v.literal("style_edit_diff_captured")
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
