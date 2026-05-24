"use node";

// convex/socialdata.ts
import { action } from "./lib/functionBuilders";
import { logger } from "../shared/lib/logger";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { acquireSocialApiBudget } from "./lib/socialApiBudget";
import {
  getXConnectionStatusForUser,
  getXProviderContextForUser,
} from "./lib/xdkAuth";
import { getHydratedPostsByIds } from "./lib/xdkTwitterProvider";
import {
  buildRelationshipDisplay,
  mapSocialApiProfile,
  mapSocialApiTweet,
} from "./lib/socialApiTwitterMap";
import type {
  HydratedTwitterPostsFromSocialApiPayload,
  HydratedTwitterProfileDisplayPayload,
  HydratedTwitterTimelinePage,
} from "../shared/lib/twitter/hydration";

import {
  getConversationContextArgsValidator,
  getTwitterProfileArgsValidator,
  getThreadsArgsValidator,
  insertThreadArgsValidator,
  getDynamicThreadDataArgsValidator,
  userTimelineModeValidator,
  twitterSearchTypeValidator,
} from "./validators";

const MAX_SOCIALAPI_HYDRATE_IDS = 10;
const SOCIALAPI_BASE_URL = "https://api.socialapi.me";

class SocialApiRequestError extends Error {
  status: number;

  body: string;

  constructor(status: number, body: string, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function parseSocialApiErrorMessage(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { message?: string };
    return typeof parsed.message === "string" ? parsed.message : undefined;
  } catch {
    return undefined;
  }
}

function isSocialApiNotFoundError(error: unknown): boolean {
  if (!(error instanceof SocialApiRequestError)) {
    return false;
  }
  if (error.status === 404) {
    return true;
  }
  const message = parseSocialApiErrorMessage(error.body)?.toLowerCase() ?? "";
  return message.includes("not found");
}

async function fetchSocialApiJson(
  ctx: any,
  consumer: string,
  path: string,
  params?: URLSearchParams
) {
  const apiKey = process.env.SOCIALAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SOCIALAPI_API_KEY is not set");
  }

  await acquireSocialApiBudget(ctx, consumer);
  const url = `${SOCIALAPI_BASE_URL}${path}${params ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const detail =
      parseSocialApiErrorMessage(body) ??
      `${response.status} ${response.statusText}`.trim();
    throw new SocialApiRequestError(
      response.status,
      body,
      `SocialAPI request failed: ${detail}`
    );
  }

  return await response.json();
}

function getXStoreRefs() {
  return internal.xStore;
}

function getTweetTimestamp(tweet: {
  tweet_created_at?: string;
  id_str?: string;
}) {
  const timestamp = tweet.tweet_created_at
    ? Date.parse(tweet.tweet_created_at)
    : Number.NaN;
  if (Number.isFinite(timestamp)) {
    return timestamp;
  }
  const numericId = Number(tweet.id_str);
  return Number.isFinite(numericId) ? numericId : 0;
}

function dedupeAndSortTweets<
  T extends { id_str?: string; tweet_created_at?: string },
>(tweets: T[]) {
  const byId = new Map<string, T>();
  for (const tweet of tweets) {
    if (!tweet.id_str || byId.has(tweet.id_str)) {
      continue;
    }
    byId.set(tweet.id_str, tweet);
  }

  return Array.from(byId.values()).sort((left, right) => {
    return getTweetTimestamp(left) - getTweetTimestamp(right);
  });
}

async function requireAuthenticatedUserId(ctx: any): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.runQuery(api.users.getUserByWorkosId, {
    workosUserId: identity.subject,
  });
  if (!user) {
    throw new Error("User not found");
  }
  return user._id as Id<"users">;
}

async function requireViewerXUserId(
  ctx: any
): Promise<{ userId: Id<"users">; xUserId: string }> {
  const userId = await requireAuthenticatedUserId(ctx);
  const status = await getXConnectionStatusForUser(
    ctx,
    getXStoreRefs(),
    userId
  );
  if (!status.isConnected || !status.xUserId) {
    throw new Error("Connect your X account to verify social actions.");
  }
  return { userId, xUserId: status.xUserId };
}

async function getViewerReadProviderOrNull(ctx: any, userId: Id<"users">) {
  try {
    return await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: ["tweet.read", "users.read"],
    });
  } catch {
    return null;
  }
}

async function hydratePostByIdWithXFallback(
  ctx: any,
  userId: Id<"users">,
  tweetId: string
) {
  const provider = await getViewerReadProviderOrNull(ctx, userId);
  if (!provider) {
    return null;
  }

  try {
    const tweets = await getHydratedPostsByIds(provider, [tweetId]);
    return (
      tweets.find((tweet) => tweet.id_str === tweetId) ?? tweets[0] ?? null
    );
  } catch {
    return null;
  }
}

async function verifyFollowingDirection(args: {
  ctx: any;
  sourceUserId: string;
  targetUserId: string;
  consumer: string;
}) {
  const payload = (await fetchSocialApiJson(
    args.ctx,
    args.consumer,
    `/twitter/user/${args.sourceUserId}/following/${args.targetUserId}`
  )) as {
    is_following?: boolean;
  };
  return payload.is_following === true;
}

// Action to fetch Twitter profile data from an external API
export const getTwitterProfile = action({
  args: getTwitterProfileArgsValidator,
  handler: async (ctx, { twitter }) => {
    try {
      return await fetchSocialApiJson(
        ctx,
        "socialapi.getTwitterProfile",
        `/twitter/user/${twitter}`
      );
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

export const getTwitterPostsByIdsFromSocialApi = action({
  args: {
    tweetIds: v.array(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<HydratedTwitterPostsFromSocialApiPayload> => {
    const userId = await requireAuthenticatedUserId(ctx);
    const normalizedIds = Array.from(
      new Set(args.tweetIds.map((tweetId) => tweetId.trim()).filter(Boolean))
    ).slice(0, MAX_SOCIALAPI_HYDRATE_IDS);

    if (normalizedIds.length === 0) {
      return {
        tweets: [],
        fetchedAt: Date.now(),
        resultsById: {},
      };
    }

    const settled = await Promise.all(
      normalizedIds.map(async (tweetId) => {
        try {
          const threadData = (await fetchSocialApiJson(
            ctx,
            "socialapi.hydratePostByThread",
            `/twitter/thread/${tweetId}`
          )) as {
            tweets?: unknown[];
          };

          const mappedTweets = Array.isArray(threadData.tweets)
            ? threadData.tweets
                .map((tweet) => mapSocialApiTweet(tweet))
                .filter(
                  (tweet): tweet is NonNullable<typeof tweet> => tweet !== null
                )
            : [];

          const firstTweet = mappedTweets[0];
          const resolvedTweet =
            mappedTweets.find((tweet) => tweet.id_str === tweetId) ??
            (firstTweet &&
            (firstTweet.id_str === tweetId ||
              firstTweet.conversation_id_str === tweetId)
              ? firstTweet
              : undefined);

          if (resolvedTweet) {
            return {
              tweetId,
              tweet: resolvedTweet,
              result: {
                status: "ok" as const,
                provider: "socialapi" as const,
              },
            };
          }

          const fallbackTweet = await hydratePostByIdWithXFallback(
            ctx,
            userId,
            tweetId
          );

          if (fallbackTweet) {
            return {
              tweetId,
              tweet: fallbackTweet,
              result: {
                status: "ok" as const,
                provider: "x_fallback" as const,
              },
            };
          }

          return {
            tweetId,
            result: {
              status: "error" as const,
              provider: "socialapi" as const,
              message: "SocialAPI returned no matching tweet for this id.",
            },
          };
        } catch (error) {
          if (isSocialApiNotFoundError(error)) {
            return {
              tweetId,
              result: {
                status: "not_found" as const,
                provider: "socialapi" as const,
                message: "This post is no longer available.",
              },
            };
          }

          const fallbackTweet = await hydratePostByIdWithXFallback(
            ctx,
            userId,
            tweetId
          );

          if (fallbackTweet) {
            return {
              tweetId,
              tweet: fallbackTweet,
              result: {
                status: "ok" as const,
                provider: "x_fallback" as const,
              },
            };
          }

          return {
            tweetId,
            result: {
              status: "error" as const,
              provider: "socialapi" as const,
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to load this post from SocialAPI.",
            },
          };
        }
      })
    );

    const tweets = settled
      .map((entry) => entry.tweet)
      .filter(
        (tweet): tweet is NonNullable<(typeof settled)[number]["tweet"]> =>
          Boolean(tweet?.id_str)
      );

    return {
      tweets,
      fetchedAt: Date.now(),
      resultsById: Object.fromEntries(
        settled.map((entry) => [entry.tweetId, entry.result])
      ),
    };
  },
});

export const getTwitterProfileDisplay = action({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args): Promise<HydratedTwitterProfileDisplayPayload> => {
    const userId = await requireAuthenticatedUserId(ctx);
    const rawProfile = await fetchSocialApiJson(
      ctx,
      "socialapi.getTwitterProfileDisplay",
      `/twitter/user/${args.username}`
    );
    const profile = mapSocialApiProfile(rawProfile);
    if (!profile?.id_str) {
      throw new Error("Failed to map SocialAPI profile response.");
    }

    const connectionStatus = await getXConnectionStatusForUser(
      ctx,
      getXStoreRefs(),
      userId
    );

    let relationship = buildRelationshipDisplay({
      resolution: "requires_connection",
      viewerFollowsTarget: false,
      targetFollowsViewer: false,
    });

    if (connectionStatus.isConnected && connectionStatus.xUserId) {
      try {
        const [viewerFollowsTarget, targetFollowsViewer] = await Promise.all([
          verifyFollowingDirection({
            ctx,
            sourceUserId: connectionStatus.xUserId,
            targetUserId: profile.id_str,
            consumer: "socialapi.verifyUserFollowing.viewerToTarget",
          }),
          verifyFollowingDirection({
            ctx,
            sourceUserId: profile.id_str,
            targetUserId: connectionStatus.xUserId,
            consumer: "socialapi.verifyUserFollowing.targetToViewer",
          }),
        ]);

        relationship = buildRelationshipDisplay({
          resolution: "verified",
          viewerFollowsTarget,
          targetFollowsViewer,
        });
      } catch (error) {
        relationship = buildRelationshipDisplay({
          resolution: "error",
          viewerFollowsTarget: false,
          targetFollowsViewer: false,
          message:
            error instanceof Error
              ? error.message
              : "Unable to verify follow relationship right now.",
        });
      }
    }

    return {
      username: profile.username ?? args.username,
      profileUserId: profile.id_str,
      profile,
      relationship,
      fetchedAt: Date.now(),
    };
  },
});

export const getHydratedTwitterTimelineFromSocialApi = action({
  args: {
    username: v.string(),
    mode: userTimelineModeValidator,
    cursor: v.optional(v.string()),
    type: v.optional(twitterSearchTypeValidator),
  },
  handler: async (
    ctx,
    { username, mode, cursor, type }
  ): Promise<HydratedTwitterTimelinePage> => {
    const params = new URLSearchParams();
    params.set("query", buildUserQuery(username, mode));
    params.set("type", type ?? "Latest");
    if (cursor) {
      params.set("cursor", cursor);
    }

    const payload = (await fetchSocialApiJson(
      ctx,
      "socialapi.getHydratedTwitterTimelineFromSocialApi",
      "/twitter/search",
      params
    )) as {
      tweets?: unknown[];
      next_cursor?: string;
    };

    return {
      mode,
      tweets: Array.isArray(payload.tweets)
        ? payload.tweets
            .map((tweet) => mapSocialApiTweet(tweet))
            .filter(
              (tweet): tweet is NonNullable<typeof tweet> => tweet !== null
            )
        : [],
      nextCursor:
        typeof payload.next_cursor === "string"
          ? payload.next_cursor
          : undefined,
      fetchedAt: Date.now(),
    };
  },
});

// Unified SocialAPI search for user timelines (Latest by default)
export const searchUserTimeline = action({
  args: {
    username: v.string(),
    mode: userTimelineModeValidator,
    cursor: v.optional(v.string()),
    type: v.optional(twitterSearchTypeValidator),
  },
  handler: async (ctx, { username, mode, cursor, type }) => {
    const q = buildUserQuery(username, mode);
    const params = new URLSearchParams();
    params.set("query", q);
    if (cursor) params.set("cursor", cursor);
    params.set("type", type || "Latest");
    return await fetchSocialApiJson(
      ctx,
      "socialapi.searchUserTimeline",
      "/twitter/search",
      params
    );
  },
});

export const getThreads = action({
  args: getThreadsArgsValidator,
  handler: async (ctx, { threadIds }) => {
    const results = await Promise.allSettled(
      threadIds.map(async (threadId) => {
        return await fetchSocialApiJson(
          ctx,
          "socialapi.getThreads",
          `/twitter/thread/${threadId}`
        );
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
    const threadData = (await fetchSocialApiJson(
      ctx,
      "socialapi.insertThread",
      `/twitter/thread/${threadId}`
    )) as {
      tweets?: unknown[];
    };

    const tweets = Array.isArray(threadData.tweets)
      ? threadData.tweets
          .map((tweet) => mapSocialApiTweet(tweet))
          .filter((tweet): tweet is NonNullable<typeof tweet> => tweet !== null)
      : [];

    const firstTweet = tweets[0];
    if (!firstTweet?.tweet_created_at) {
      throw new Error("Thread data is incomplete or missing created_at");
    }

    const postedAt = firstTweet.tweet_created_at
      ? new Date(firstTweet.tweet_created_at).getTime()
      : getCurrentUTCTimestamp();

    await ctx.runMutation(api.socialapiMutations.insertThreadMutation, {
      threadId,
      tweets,
      postedAt,
    });
  },
});

// convex/socialdata.ts
export const getDynamicThreadData = action({
  args: getDynamicThreadDataArgsValidator,
  handler: async (
    ctx,
    { threadId }
  ): Promise<{
    rootTweetId: string;
    matchedReplyTweetId?: string;
    repliesCursor?: string;
    hasMoreReplies: boolean;
    tweets: ReturnType<typeof dedupeAndSortTweets>;
  }> => {
    return await ctx.runAction(api.socialapi.getConversationContext, {
      rootTweetId: threadId,
    });
  },
});

export const getConversationContext = action({
  args: getConversationContextArgsValidator,
  handler: async (
    ctx,
    args
  ): Promise<{
    rootTweetId: string;
    matchedReplyTweetId?: string;
    repliesCursor?: string;
    hasMoreReplies: boolean;
    tweets: ReturnType<typeof dedupeAndSortTweets>;
  }> => {
    const threadTweets: NonNullable<ReturnType<typeof mapSocialApiTweet>>[] =
      [];
    let threadCursor: string | undefined;
    let rootAuthorUsername: string | undefined;

    for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
      const threadPage = await ctx.runAction(
        internal.integrations.twitter.getThread.getThread,
        {
          threadId: args.rootTweetId,
          cursor: threadCursor,
        }
      );

      if (!threadPage.success || !Array.isArray(threadPage.tweets)) {
        break;
      }

      const mapped = threadPage.tweets
        .map((tweet: unknown) => mapSocialApiTweet(tweet))
        .filter(
          (
            tweet: ReturnType<typeof mapSocialApiTweet>
          ): tweet is NonNullable<ReturnType<typeof mapSocialApiTweet>> =>
            tweet !== null
        );
      if (mapped.length > 0 && !rootAuthorUsername) {
        rootAuthorUsername = mapped[0].user?.screen_name;
      }
      threadTweets.push(...mapped);

      if (!threadPage.nextCursor) {
        break;
      }
      threadCursor = threadPage.nextCursor;
    }

    const repliesQuery = rootAuthorUsername
      ? `conversation_id:${args.rootTweetId} -from:${rootAuthorUsername}`
      : `conversation_id:${args.rootTweetId}`;
    const repliesPage: {
      success: boolean;
      posts: unknown[];
      nextCursor?: string;
      hasMore: boolean;
    } = await ctx.runAction(api.integrations.twitter.searchPosts.searchRaw, {
      query: repliesQuery,
      type: "Latest",
      cursor: args.repliesCursor,
    });

    const replyTweets = repliesPage.success
      ? repliesPage.posts
          .map((tweet: unknown) => mapSocialApiTweet(tweet))
          .filter(
            (
              tweet: ReturnType<typeof mapSocialApiTweet>
            ): tweet is NonNullable<ReturnType<typeof mapSocialApiTweet>> =>
              tweet !== null
          )
      : [];

    return {
      rootTweetId: args.rootTweetId,
      matchedReplyTweetId: args.matchedReplyTweetId,
      repliesCursor: repliesPage.nextCursor,
      hasMoreReplies: repliesPage.hasMore,
      tweets: dedupeAndSortTweets([...threadTweets, ...replyTweets]),
    };
  },
});

/** Social Actions API — docs/socialapi/verify-user-retweeted.md */
export const verifyUserRetweetedPost = action({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    const { xUserId } = await requireViewerXUserId(ctx);
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      throw new Error("SOCIALAPI_API_KEY is not set");
    }
    await acquireSocialApiBudget(ctx, "socialapi.verifyUserRetweeted");
    const tweetId = args.tweetId.trim();
    const response = await fetch(
      `https://api.socialapi.me/twitter/tweets/${tweetId}/retweeted_by/${xUserId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `SocialAPI verify retweet failed: ${response.status} ${text}`
      );
    }
    return (await response.json()) as {
      is_retweeted?: boolean;
      status?: string;
    };
  },
});

/** Social Actions API — docs/socialapi/verify-user-commented.md */
export const verifyUserCommentedOnPost = action({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    const { xUserId } = await requireViewerXUserId(ctx);
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      throw new Error("SOCIALAPI_API_KEY is not set");
    }
    await acquireSocialApiBudget(ctx, "socialapi.verifyUserCommented");
    const tweetId = args.tweetId.trim();
    const response = await fetch(
      `https://api.socialapi.me/twitter/tweets/${tweetId}/commented_by/${xUserId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `SocialAPI verify commented failed: ${response.status} ${text}`
      );
    }
    return (await response.json()) as {
      comment_ids?: string[];
      status?: string;
    };
  },
});

/** Social Actions API — docs/socialapi/verify-user-is-following.md */
export const verifyUserIsFollowing = action({
  args: {
    targetUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { xUserId } = await requireViewerXUserId(ctx);
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      throw new Error("SOCIALAPI_API_KEY is not set");
    }
    await acquireSocialApiBudget(ctx, "socialapi.verifyUserFollowing");
    const targetUserId = args.targetUserId.trim();
    const response = await fetch(
      `https://api.socialapi.me/twitter/user/${xUserId}/following/${targetUserId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `SocialAPI verify following failed: ${response.status} ${text}`
      );
    }
    return (await response.json()) as {
      is_following?: boolean;
      status?: string;
    };
  },
});
