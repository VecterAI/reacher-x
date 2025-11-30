import { v } from "convex/values";

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

export const migrateLocalStorageDataArgsValidator = v.object({
  workspaceDescription: v.optional(v.string()),
  workspaceName: v.optional(v.string()),
  workspaceDescriptionSource: v.optional(
    v.union(v.literal("manual"), v.literal("url"))
  ),
  workspaceSourceUrl: v.optional(v.string()),
  workspaceLastGeneratedAt: v.optional(v.number()),
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
