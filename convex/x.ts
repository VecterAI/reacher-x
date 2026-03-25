"use node";

import { v } from "convex/values";
import { action, internalAction } from "./lib/functionBuilders";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  beginXAuthorizationForUser,
  completeXAuthorizationForUser,
  disconnectXForUser,
  type XConnectionStatus,
  getXConnectionStatusForUser,
  getXProviderContextForUser,
} from "./lib/xdkAuth";
import {
  executeCuratedTwitterAction,
  getDmEvents,
  getDmEventsByConversationId,
  getHydratedConversationByThreadId,
  getHydratedPostById,
  getHydratedPostsByIds,
  getHydratedProfileByUsername,
  getHydratedTimelinePage,
  getXExecutionFailure,
} from "./lib/xdkTwitterProvider";
import { getTwitterActionCatalogEntry } from "./lib/twitterActionCatalog";
import { getTwitterViewerStatesForUser } from "./lib/twitterViewerStateService";
import { userTimelineModeValidator } from "./validators";
import { getTwitterPostRef } from "../shared/lib/twitter/contracts";
import {
  type HydratedTwitterConversationPayload,
  type HydratedTwitterPostPayload,
  type HydratedTwitterPostsPayload,
  type HydratedTwitterProfilePayload,
  type HydratedTwitterTimelinePage,
} from "../shared/lib/twitter/hydration";
import { applyViewerStateToTweet } from "../shared/lib/twitter/ui";
import { logger } from "../shared/lib/logger";
import { assertPostTextWithinLimit } from "../shared/lib/twitter/xPostTextLimit";

async function getCurrentUserId(ctx: any): Promise<Id<"users">> {
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

function getXStoreRefs(): any {
  return internal.xStore;
}

async function getReadProviderForUser(ctx: any, userId: Id<"users">) {
  return await getXProviderContextForUser(ctx, getXStoreRefs(), {
    userId,
    requiredScopes: ["tweet.read", "users.read"],
  });
}

async function hydrateViewerStatesForPosts(
  ctx: any,
  userId: Id<"users">,
  posts: Array<{
    postId: string;
    conversationId?: string;
    authorId?: string;
    authorHandle?: string;
    url?: string;
    platform: "twitter";
  }>,
  options?: {
    includeCommentedState?: boolean;
  }
) {
  const postRefs = Array.from(
    new Map(posts.map((post) => [post.postId, post] as const)).values()
  ).slice(0, 24);
  if (postRefs.length === 0) {
    return [];
  }

  const states = await getTwitterViewerStatesForUser(ctx, getXStoreRefs(), {
    userId,
    postRefs,
  });

  if (states.every((state) => state.requiresConnection)) {
    return states;
  }

  if (!options?.includeCommentedState) {
    return states;
  }

  const connectionStatus = await getXConnectionStatusForUser(
    ctx,
    getXStoreRefs(),
    userId
  );
  const viewerHandle = connectionStatus.screenName?.trim().replace(/^@/, "");
  if (!viewerHandle) {
    return states;
  }

  const conversationMap = new Map<string, string[]>();
  for (const postRef of postRefs) {
    const conversationId = postRef.conversationId ?? postRef.postId;
    const bucket = conversationMap.get(conversationId) ?? [];
    bucket.push(postRef.postId);
    conversationMap.set(conversationId, bucket);
  }

  try {
    const provider = await getReadProviderForUser(ctx, userId);
    const conversationQuery = Array.from(conversationMap.keys())
      .map((conversationId) => `conversation_id:${conversationId}`)
      .join(" OR ");
    const repliedPostIds = new Set<string>();
    let nextToken: string | undefined;

    for (let page = 0; page < 3; page += 1) {
      const searchResult = await provider.client.posts.searchRecent(
        `from:${viewerHandle} (${conversationQuery})`,
        {
          maxResults: 100,
          nextToken,
          tweetFields: ["conversation_id"],
        }
      );

      for (const tweet of searchResult.data ?? []) {
        const conversationId =
          typeof tweet?.conversationId === "string"
            ? tweet.conversationId
            : typeof tweet?.id === "string"
              ? tweet.id
              : undefined;
        const tweetId = typeof tweet?.id === "string" ? tweet.id : undefined;
        if (!conversationId || !tweetId) {
          continue;
        }

        for (const sourcePostId of conversationMap.get(conversationId) ?? []) {
          if (sourcePostId !== tweetId) {
            repliedPostIds.add(sourcePostId);
          }
        }
      }

      nextToken =
        searchResult.meta?.nextToken ??
        searchResult.meta?.next_token ??
        undefined;
      if (!nextToken) {
        break;
      }
    }

    return states.map((state) =>
      repliedPostIds.has(state.postId)
        ? {
            ...state,
            commented: true,
          }
        : state
    );
  } catch (error) {
    const failure = getXExecutionFailure(error);
    if (failure.classification !== "rate_limited") {
      logger.warn("[X] Failed to hydrate commented viewer state.", error);
    }
    return states;
  }
}

async function attachViewerStateToTweets<T extends { id_str?: string }>(
  ctx: any,
  userId: Id<"users">,
  tweets: T[],
  options?: {
    includeCommentedState?: boolean;
  }
): Promise<T[]> {
  const postRefs = tweets
    .map((tweet) => getTwitterPostRef(tweet))
    .filter((postRef): postRef is NonNullable<typeof postRef> =>
      Boolean(postRef)
    );
  if (postRefs.length === 0) {
    return tweets;
  }

  const states = await hydrateViewerStatesForPosts(
    ctx,
    userId,
    postRefs,
    options
  );
  const stateMap = new Map(
    states.map((state) => [state.postId, state] as const)
  );

  return tweets.map(
    (tweet) =>
      applyViewerStateToTweet(
        tweet as any,
        stateMap.get(getTwitterPostRef(tweet)?.postId ?? "")
      ) as T
  );
}

function ensureTextOnlyAction(mediaUrls?: string[]) {
  if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
    throw new Error(
      "Media uploads are not yet enabled in the X SDK path. Remove attachments and try again."
    );
  }
}

function formatDirectXWriteActionError(error: unknown): Error {
  const failure = getXExecutionFailure(error);
  const normalizedMessage = failure.message.toLowerCase();
  const detail =
    failure.message &&
    !/^http \d+:/i.test(failure.message) &&
    failure.message.toLowerCase() !== "forbidden"
      ? failure.message
      : undefined;

  switch (failure.classification) {
    case "reauth_required":
      return new Error(
        "Your X session has expired. Reconnect your account in Settings -> Connected accounts."
      );
    case "scope_missing":
      return new Error(
        detail ??
          "Reconnect your X account and approve the required write permissions."
      );
    case "duplicate_content":
      return new Error(
        detail ??
          "X rejected this as duplicate content. Edit the message and try again."
      );
    case "content_too_long":
      return new Error(
        detail ??
          "X rejected this because it is too long. Shorten it and try again."
      );
    case "target_not_found":
      return new Error(
        detail ?? "The target post is no longer available on X."
      );
    case "rate_limited":
      return new Error(
        detail ?? "X rate limited this action. Wait a moment and try again."
      );
    case "api_policy_forbidden":
      if (
        normalizedMessage.includes(
          "reply to this conversation is not allowed because you have not been mentioned or otherwise engaged"
        )
      ) {
        return new Error(
          "X's public API blocked this reply for this conversation, even though the same reply may still work on x.com. This is an X API policy mismatch, not a fake app error."
        );
      }
      return new Error(
        detail ??
          "X blocked this action. The author may have limited replies, or your account/app is not permitted to perform this write action."
      );
    default:
      return new Error(detail ?? "X could not complete this action right now.");
  }
}

export const getTwitterConnectionStatus = action({
  args: {},
  handler: async (ctx): Promise<XConnectionStatus> => {
    const userId = await getCurrentUserId(ctx);
    return await getXConnectionStatusForUser(ctx, getXStoreRefs(), userId);
  },
});

export const getTwitterConnectLink = action({
  args: {
    callbackUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    redirectUrl: string;
  }> => {
    const userId = await getCurrentUserId(ctx);
    return await beginXAuthorizationForUser(ctx, getXStoreRefs(), {
      userId,
      redirectUri: args.callbackUrl,
    });
  },
});

export const completeTwitterConnection = action({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args): Promise<XConnectionStatus> => {
    const userId = await getCurrentUserId(ctx);
    return await completeXAuthorizationForUser(ctx, getXStoreRefs(), {
      userId,
      code: args.code,
      state: args.state,
    });
  },
});

export const disconnectTwitter = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    await disconnectXForUser(ctx, getXStoreRefs(), userId);
    return { success: true as const };
  },
});

export const likeTweet = action({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("like_post");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    await executeCuratedTwitterAction(provider, {
      actionKey: "like_post",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      tweetId: args.tweetId,
    });
    return { success: true as const };
  },
});

export const unlikeTweet = action({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("unlike_post");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    await executeCuratedTwitterAction(provider, {
      actionKey: "unlike_post",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      tweetId: args.tweetId,
    });
    return { success: true as const };
  },
});

export const retweet = action({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("retweet_post");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    await executeCuratedTwitterAction(provider, {
      actionKey: "retweet_post",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      tweetId: args.tweetId,
    });
    return { success: true as const };
  },
});

export const unretweet = action({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("unretweet_post");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    await executeCuratedTwitterAction(provider, {
      actionKey: "unretweet_post",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      tweetId: args.tweetId,
    });
    return { success: true as const };
  },
});

export const bookmarkTweet = action({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("bookmark_post");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    await executeCuratedTwitterAction(provider, {
      actionKey: "bookmark_post",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      tweetId: args.tweetId,
    });
    return { success: true as const };
  },
});

export const removeBookmark = action({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("unbookmark_post");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    await executeCuratedTwitterAction(provider, {
      actionKey: "unbookmark_post",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      tweetId: args.tweetId,
    });
    return { success: true as const };
  },
});

export const followUser = action({
  args: {
    targetUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("follow_user");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    await executeCuratedTwitterAction(provider, {
      actionKey: "follow_user",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      targetUserId: args.targetUserId,
    });
    return { success: true as const };
  },
});

export const unfollowUser = action({
  args: {
    targetUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("unfollow_user");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    await executeCuratedTwitterAction(provider, {
      actionKey: "unfollow_user",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      targetUserId: args.targetUserId,
    });
    return { success: true as const };
  },
});

export const createPost = action({
  args: {
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    ensureTextOnlyAction(args.mediaUrls);
    const userId = await getCurrentUserId(ctx);
    const postLimit = await ctx.runQuery(
      internal.xPostLimits.getEffectivePostLimitInternal,
      { userId }
    );
    assertPostTextWithinLimit(args.text.trim(), postLimit);
    const entry = getTwitterActionCatalogEntry("create_post");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    try {
      return await executeCuratedTwitterAction(provider, {
        actionKey: "create_post",
        toolSlug: entry.toolSlug,
        toolVersion: entry.toolVersion,
        text: args.text.trim(),
      });
    } catch (error) {
      throw formatDirectXWriteActionError(error);
    }
  },
});

export const replyToPost = action({
  args: {
    tweetId: v.string(),
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    ensureTextOnlyAction(args.mediaUrls);
    const userId = await getCurrentUserId(ctx);
    const postLimit = await ctx.runQuery(
      internal.xPostLimits.getEffectivePostLimitInternal,
      { userId }
    );
    assertPostTextWithinLimit(args.text.trim(), postLimit);
    const entry = getTwitterActionCatalogEntry("reply_to_post");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    try {
      return await executeCuratedTwitterAction(provider, {
        actionKey: "reply_to_post",
        toolSlug: entry.toolSlug,
        toolVersion: entry.toolVersion,
        tweetId: args.tweetId,
        text: args.text.trim(),
      });
    } catch (error) {
      throw formatDirectXWriteActionError(error);
    }
  },
});

export const sendDm = action({
  args: {
    targetUserId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("send_dm");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    return await executeCuratedTwitterAction(provider, {
      actionKey: "send_dm",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      targetUserId: args.targetUserId,
      text: args.text.trim(),
    });
  },
});

export const sendDmInExistingConversation = action({
  args: {
    conversationId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry(
      "send_dm_in_existing_conversation"
    );
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    return await executeCuratedTwitterAction(provider, {
      actionKey: "send_dm_in_existing_conversation",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      conversationId: args.conversationId,
      text: args.text.trim(),
    });
  },
});

export const getRecentDmEvents = action({
  args: {
    maxResults: v.optional(v.number()),
    paginationToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: ["tweet.read", "users.read", "dm.read"],
    });
    return await getDmEvents(provider, {
      maxResults: args.maxResults,
      paginationToken: args.paginationToken,
    });
  },
});

export const getDmConversationEvents = action({
  args: {
    conversationId: v.string(),
    maxResults: v.optional(v.number()),
    paginationToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: ["tweet.read", "users.read", "dm.read"],
    });
    return await getDmEventsByConversationId(provider, args.conversationId, {
      maxResults: args.maxResults,
      paginationToken: args.paginationToken,
    });
  },
});

export const getHydratedTwitterProfile = action({
  args: {
    username: v.string(),
    mode: v.optional(userTimelineModeValidator),
  },
  handler: async (ctx, args): Promise<HydratedTwitterProfilePayload> => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getReadProviderForUser(ctx, userId);
    const mode = args.mode ?? "posts";
    const { profileUserId, profile } = await getHydratedProfileByUsername(
      provider,
      args.username
    );
    const timeline = await getHydratedTimelinePage(provider, {
      userId: profileUserId,
      mode,
    });

    return {
      username: profile.username ?? args.username,
      profileUserId,
      profile,
      timeline: {
        mode,
        tweets: await attachViewerStateToTweets(ctx, userId, timeline.tweets),
        nextCursor: timeline.nextCursor,
        fetchedAt: Date.now(),
      },
    };
  },
});

export const getHydratedTwitterTimeline = action({
  args: {
    username: v.string(),
    userId: v.optional(v.string()),
    mode: userTimelineModeValidator,
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<HydratedTwitterTimelinePage> => {
    const viewerUserId = await getCurrentUserId(ctx);
    const provider = await getReadProviderForUser(ctx, viewerUserId);
    const profileUserId =
      args.userId ??
      (await getHydratedProfileByUsername(provider, args.username))
        .profileUserId;
    const timeline = await getHydratedTimelinePage(provider, {
      userId: profileUserId,
      mode: args.mode,
      cursor: args.cursor,
    });

    return {
      mode: args.mode,
      tweets: await attachViewerStateToTweets(
        ctx,
        viewerUserId,
        timeline.tweets
      ),
      nextCursor: timeline.nextCursor,
      fetchedAt: Date.now(),
    };
  },
});

export const getHydratedTwitterPost = action({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args): Promise<HydratedTwitterPostPayload> => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getReadProviderForUser(ctx, userId);
    const tweet = await getHydratedPostById(provider, args.tweetId);

    return {
      tweet: tweet
        ? ((await attachViewerStateToTweets(ctx, userId, [tweet]))[0] ?? tweet)
        : null,
      fetchedAt: Date.now(),
    };
  },
});

export const getHydratedTwitterPostsByIds = action({
  args: {
    tweetIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<HydratedTwitterPostsPayload> => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getReadProviderForUser(ctx, userId);
    const tweets = await getHydratedPostsByIds(provider, args.tweetIds);

    return {
      tweets: await attachViewerStateToTweets(ctx, userId, tweets),
      fetchedAt: Date.now(),
    };
  },
});

export const getHydratedTwitterConversation = action({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args): Promise<HydratedTwitterConversationPayload> => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getReadProviderForUser(ctx, userId);
    const payload = await getHydratedConversationByThreadId(
      provider,
      args.threadId
    );

    return {
      ...payload,
      tweets: await attachViewerStateToTweets(ctx, userId, payload.tweets),
    };
  },
});

export const likeTweetForThreadUser = internalAction({
  args: {
    threadId: v.string(),
    tweetId: v.string(),
  },
  handler: async (ctx, { threadId, tweetId }) => {
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });

    const userId = thread?.userId as Id<"users"> | undefined;
    if (!userId) {
      throw new Error("User not found for thread");
    }

    const entry = getTwitterActionCatalogEntry("like_post");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    await executeCuratedTwitterAction(provider, {
      actionKey: "like_post",
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      tweetId,
    });
    return { success: true as const };
  },
});

export const getXActionFailureSummary = internalAction({
  args: {
    message: v.string(),
  },
  handler: async (_ctx, { message }) => {
    return getXExecutionFailure(new Error(message));
  },
});
