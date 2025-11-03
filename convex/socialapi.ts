"use node";

// convex/socialdata.ts
import { action } from "./_generated/server";
import { logger } from "../shared/lib/logger";
import { v } from "convex/values";
import { api } from "./_generated/api";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getTwitterProfileArgsValidator,
  getThreadsArgsValidator,
  insertThreadArgsValidator,
  getDynamicThreadDataArgsValidator,
} from "./validators";

// Utility function to convert null to undefined for optional strings
const optionalString = (value: unknown) =>
  value === null ? undefined : (value as string | undefined);

// Action to fetch Twitter profile data from an external API
export const getTwitterProfile = action({
  args: getTwitterProfileArgsValidator,
  handler: async (ctx, { twitter }) => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) throw new Error("SOCIALAPI_API_KEY is not set");
    try {
      const response = await fetch(
        `https://api.socialapi.me/twitter/user/${twitter}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch profile for ${twitter}: ${response.status} ${response.statusText} - ${errorText}`
        );
      }
      // Return the full SocialAPI user payload for maximum flexibility on the client
      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Network error: ${error.message}`);
      } else {
        throw new Error(`Network error: An unknown error occurred`);
      }
    }
  },
});

// Helper to build SocialAPI search queries for user timelines
function buildUserQuery(
  username: string,
  mode: "posts" | "replies" | "quotes"
): string {
  const base = `from:${username}`;
  switch (mode) {
    case "posts":
      // Exclude replies, quotes, and nativeretweets/legacy retweets
      return `${base} -filter:replies -filter:quote -filter:nativeretweets -filter:retweets`;
    case "replies":
      return `${base} filter:replies`;
    case "quotes":
      return `${base} filter:quote`;
    default:
      return base;
  }
}

// Unified SocialAPI search for user timelines (Latest by default)
export const searchUserTimeline = action({
  args: {
    username: v.string(),
    mode: v.union(
      v.literal("posts"),
      v.literal("replies"),
      v.literal("quotes")
    ),
    cursor: v.optional(v.string()),
    type: v.optional(v.union(v.literal("Latest"), v.literal("Top"))),
  },
  handler: async (ctx, { username, mode, cursor, type }) => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) throw new Error("SOCIALAPI_API_KEY is not set");
    const q = buildUserQuery(username, mode);
    const params = new URLSearchParams();
    params.set("query", q);
    if (cursor) params.set("cursor", cursor);
    params.set("type", type || "Latest");
    const url = `https://api.socialapi.me/twitter/search?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `SocialAPI search failed: ${response.status} ${response.statusText} - ${text}`
      );
    }
    const data = await response.json();
    // Return as-is: { next_cursor, tweets: [...] }
    return data;
  },
});

export const getThreads = action({
  args: getThreadsArgsValidator,
  handler: async (ctx, { threadIds }) => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) throw new Error("SOCIALAPI_API_KEY is not set");

    // Use Promise.allSettled instead of Promise.all
    const results = await Promise.allSettled(
      threadIds.map(async (threadId) => {
        const response = await fetch(
          `https://api.socialapi.me/twitter/thread/${threadId}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        if (!response.ok) throw new Error(`Failed to fetch thread ${threadId}`);
        return response.json();
      })
    );

    // Extract successful thread data
    const threads = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    // Optionally, collect and log errors for failed fetches
    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (errors.length > 0) {
      logger.error("Some threads failed to fetch:", errors);
    }

    return threads;
  },
});

// convex/socialdata.ts
export const insertThread = action({
  args: insertThreadArgsValidator,
  handler: async (ctx, { threadId }) => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) throw new Error("SOCIALAPI_API_KEY is not set");

    // Fetch thread data from the API
    const response = await fetch(
      `https://api.socialapi.me/twitter/thread/${threadId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    if (!response.ok) throw new Error(`Failed to fetch thread ${threadId}`);

    const threadData = await response.json();
    const firstTweet = threadData.tweets[0];
    if (!firstTweet || !firstTweet.tweet_created_at) {
      throw new Error("Thread data is incomplete or missing created_at");
    }

    // Convert the creation date to a timestamp (no longer stored explicitly)
    // Note: We rely on Convex `_creationTime` for thread ordering
    // const threadCreationMs = new Date(firstTweet.tweet_created_at).getTime();

    // Map API tweet data to tweetValidator structure
    // Updated tweet mapping with all fields
    const tweets = threadData.tweets.map((tweet: any) => ({
      tweet_created_at: optionalString(tweet.tweet_created_at),
      id: tweet.id ? Number(tweet.id) : undefined,
      id_str: optionalString(tweet.id_str),
      conversation_id_str: optionalString(tweet.conversation_id_str),
      text: tweet.text, // Allows null per validator
      full_text: optionalString(tweet.full_text),
      source: optionalString(tweet.source),
      truncated: tweet.truncated ?? undefined,
      in_reply_to_status_id: tweet.in_reply_to_status_id
        ? Number(tweet.in_reply_to_status_id)
        : undefined,
      in_reply_to_status_id_str: optionalString(
        tweet.in_reply_to_status_id_str
      ),
      in_reply_to_user_id: tweet.in_reply_to_user_id
        ? Number(tweet.in_reply_to_user_id)
        : undefined,
      in_reply_to_user_id_str: optionalString(tweet.in_reply_to_user_id_str),
      in_reply_to_screen_name: optionalString(tweet.in_reply_to_screen_name),
      user: tweet.user
        ? {
            id: Number(tweet.user.id),
            id_str: tweet.user.id_str,
            name: tweet.user.name,
            screen_name: tweet.user.screen_name,
            location: optionalString(tweet.user.location),
            url: optionalString(tweet.user.url),
            description: optionalString(tweet.user.description),
            protected: tweet.user.protected,
            verified: tweet.user.verified,
            followers_count: tweet.user.followers_count,
            friends_count: tweet.user.friends_count,
            listed_count: tweet.user.listed_count,
            favourites_count: tweet.user.favourites_count,
            statuses_count: tweet.user.statuses_count,
            created_at: tweet.user.created_at,
            profile_banner_url: optionalString(tweet.user.profile_banner_url),
            profile_image_url_https: tweet.user.profile_image_url_https,
            can_dm: tweet.user.can_dm ?? false, // Default to false if missing
          }
        : undefined,
      quoted_status_id: tweet.quoted_status_id
        ? Number(tweet.quoted_status_id)
        : undefined,
      quoted_status_id_str: optionalString(tweet.quoted_status_id_str),
      is_quote_status: tweet.is_quote_status ?? undefined,
      quoted_status: tweet.quoted_status,
      retweeted_status: tweet.retweeted_status,
      quote_count: tweet.quote_count ?? undefined,
      reply_count: tweet.reply_count ?? undefined,
      retweet_count: tweet.retweet_count ?? undefined,
      favorite_count: tweet.favorite_count ?? undefined,
      views_count: tweet.views_count ?? undefined,
      bookmark_count: tweet.bookmark_count ?? undefined,
      lang: optionalString(tweet.lang),
      entities: tweet.entities
        ? {
            media: tweet.entities.media
              ? tweet.entities.media.map((media: any) => ({
                  display_url: optionalString(media.display_url),
                  expanded_url: optionalString(media.expanded_url),
                  id_str: optionalString(media.id_str),
                  indices: media.indices,
                  media_key: optionalString(media.media_key),
                  media_url_https: media.media_url_https,
                  type: media.type,
                  url: optionalString(media.url),
                  ext_alt_text: optionalString(media.ext_alt_text),
                  ext_media_availability: media.ext_media_availability,
                  features: media.features,
                  sizes: media.sizes
                    ? {
                        large: media.sizes.large
                          ? {
                              h: media.sizes.large.h,
                              w: media.sizes.large.w,
                              resize: optionalString(media.sizes.large.resize),
                            }
                          : undefined,
                        medium: media.sizes.medium
                          ? {
                              h: media.sizes.medium.h,
                              w: media.sizes.medium.w,
                              resize: optionalString(media.sizes.medium.resize),
                            }
                          : undefined,
                        small: media.sizes.small
                          ? {
                              h: media.sizes.small.h,
                              w: media.sizes.small.w,
                              resize: optionalString(media.sizes.small.resize),
                            }
                          : undefined,
                        thumb: media.sizes.thumb
                          ? {
                              h: media.sizes.thumb.h,
                              w: media.sizes.thumb.w,
                              resize: optionalString(media.sizes.thumb.resize),
                            }
                          : undefined,
                      }
                    : undefined,
                  original_info: media.original_info
                    ? {
                        height: media.original_info.height,
                        width: media.original_info.width,
                        focus_rects: media.original_info.focus_rects || [],
                      }
                    : undefined,
                  video_info: media.video_info
                    ? {
                        aspect_ratio: media.video_info.aspect_ratio,
                        duration_millis: media.video_info.duration_millis,
                        variants: media.video_info.variants || [],
                      }
                    : undefined,
                  additional_media_info:
                    typeof media.additional_media_info?.monetizable ===
                    "boolean"
                      ? {
                          monetizable: media.additional_media_info.monetizable,
                        }
                      : undefined,
                }))
              : [],
            timestamps: tweet.entities.timestamps,
            user_mentions: tweet.entities.user_mentions
              ? tweet.entities.user_mentions.map((mention: any) => ({
                  id: mention.id ? Number(mention.id) : undefined,
                  id_str: mention.id_str,
                  name: mention.name,
                  screen_name: mention.screen_name,
                  indices: mention.indices,
                }))
              : undefined,
            urls: tweet.entities.urls,
            hashtags: tweet.entities.hashtags,
            symbols: tweet.entities.symbols,
          }
        : undefined,
      is_pinned: tweet.is_pinned ?? undefined,
    }));

    // Insert the mapped data into Convex
    const firstWithTime = tweets.find((t: any) => t.tweet_created_at);
    const postedAt = firstWithTime
      ? new Date(firstWithTime.tweet_created_at as string).getTime()
      : Date.now();

    await ctx.runMutation(api.socialdataMutations.insertThreadMutation, {
      threadId,
      tweets,
      postedAt,
    });
  },
});

// convex/socialdata.ts
export const getDynamicThreadData = action({
  args: getDynamicThreadDataArgsValidator,
  handler: async (ctx, { threadId }) => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) throw new Error("SOCIALAPI_API_KEY is not set");

    const response = await fetch(
      `https://api.socialapi.me/twitter/thread/${threadId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    if (!response.ok) throw new Error(`Failed to fetch thread ${threadId}`);

    const threadData = await response.json();
    const dynamicTweets = threadData.tweets.map((tweet: any) => ({
      tweet_created_at: tweet.created_at,
      id: Number(tweet.id_str),
      id_str: tweet.id_str,
      conversation_id_str: tweet.conversation_id_str || tweet.id_str,
      text: tweet.text || null,
      full_text: tweet.full_text || tweet.text,
      source: tweet.source || "",
      truncated: tweet.truncated || false,
      in_reply_to_status_id: tweet.in_reply_to_status_id
        ? Number(tweet.in_reply_to_status_id)
        : null,
      in_reply_to_status_id_str: tweet.in_reply_to_status_id_str || null,
      in_reply_to_user_id: tweet.in_reply_to_user_id
        ? Number(tweet.in_reply_to_user_id)
        : null,
      in_reply_to_user_id_str: tweet.in_reply_to_user_id_str || null,
      in_reply_to_screen_name: tweet.in_reply_to_screen_name || null,
      user: tweet.user,
      quoted_status_id: tweet.quoted_status_id
        ? Number(tweet.quoted_status_id)
        : null,
      quoted_status_id_str: tweet.quoted_status_id_str || null,
      is_quote_status: tweet.is_quote_status || false,
      quoted_status: tweet.quoted_status || null,
      retweeted_status: tweet.retweeted_status || null,
      quote_count: tweet.quote_count || 0,
      reply_count: tweet.reply_count || 0,
      retweet_count: tweet.retweet_count || 0,
      favorite_count: tweet.favorite_count || 0,
      views_count: tweet.views_count || 0,
      bookmark_count: tweet.bookmark_count || 0,
      lang: tweet.lang || "und",
      entities: tweet.entities || {
        media: [],
        user_mentions: [],
        urls: [],
        hashtags: [],
        symbols: [],
      },
      is_pinned: tweet.is_pinned || false,
    }));

    return { threadId, tweets: dynamicTweets };
  },
});
