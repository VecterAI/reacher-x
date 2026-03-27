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
  buildDraftDmAttachments,
  mergeDmMessages,
  normalizeDmMessages,
} from "./lib/xDm";
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
  computeOneToOneDmConversationId,
  type XDmAttachmentSummary,
  type XDmEligibility,
  type XDmMessage,
  type XDmPanelContext,
} from "../shared/lib/twitter/dm";
import {
  type HydratedTwitterConversationPayload,
  type HydratedTwitterPostPayload,
  type HydratedTwitterPostsPayload,
  type HydratedTwitterProfilePayload,
  type HydratedTwitterTimelinePage,
} from "../shared/lib/twitter/hydration";
import { applyViewerStateToTweet } from "../shared/lib/twitter/ui";
import { logger } from "../shared/lib/logger";
import {
  assertPostTextWithinLimit,
  getDmTextLimitError,
  hasDmBody,
} from "../shared/lib/twitter/xPostTextLimit";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";

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

async function getOwnedTwitterProspectForUser(
  ctx: any,
  userId: Id<"users">,
  prospectId: Id<"prospects">
) {
  const prospect = await ctx.runQuery(internal.prospects.getProspectInternal, {
    prospectId,
  });
  if (
    !prospect ||
    prospect.userId !== userId ||
    prospect.platform !== "twitter"
  ) {
    return null;
  }
  return prospect;
}

function buildDmEligibility(args: {
  isConnected: boolean;
  missingScopes?: string[];
  receivesYourDm?: boolean;
  conversationId?: string;
}): XDmEligibility {
  if (!args.isConnected) {
    return {
      enabled: false,
      reasonCode: "missing_connection",
      reasonLabel: "Connect X with DM access to message this prospect.",
    };
  }

  const missingScopes = new Set(args.missingScopes ?? []);
  if (missingScopes.has("dm.read") || missingScopes.has("dm.write")) {
    return {
      enabled: false,
      reasonCode: "missing_scopes",
      reasonLabel: "Reconnect X and approve DM permissions.",
    };
  }

  if (args.receivesYourDm === true) {
    return {
      enabled: true,
      reasonCode: "eligible",
      reasonLabel: "DM available on X.",
      receivesYourDm: true,
      conversationId: args.conversationId,
    };
  }

  if (args.receivesYourDm === false) {
    return {
      enabled: false,
      reasonCode: "not_allowed",
      reasonLabel: "This user doesn’t currently accept your DMs on X.",
      receivesYourDm: false,
      conversationId: args.conversationId,
    };
  }

  return {
    enabled: false,
    reasonCode: "unknown",
    reasonLabel: "DM eligibility unavailable right now.",
    conversationId: args.conversationId,
  };
}

function isMissingConversationError(error: unknown): boolean {
  const failure = getXExecutionFailure(error);
  return (
    failure.classification === "target_not_found" ||
    /^http 404:/i.test(failure.message)
  );
}

function toCreatedAtMs(createdAt?: string): number {
  if (!createdAt) {
    return 0;
  }
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStoredConversationMessages(messages: XDmMessage[]) {
  return messages.map((message) => ({
    messageId: message.id,
    direction: message.direction,
    senderUserId: message.senderUserId,
    text: message.text,
    createdAt: message.createdAt,
    createdAtMs: toCreatedAtMs(message.createdAt),
    attachments: message.attachments,
    readAt: message.readAt ? Date.parse(message.readAt) : undefined,
  }));
}

function toCachedDmMessages(snapshot: any): XDmMessage[] {
  const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
  return messages.map((message: any) => ({
    id: message.messageId,
    conversationId: message.conversationId,
    senderUserId: message.senderUserId,
    text: message.text ?? "",
    createdAt: message.createdAt,
    direction: message.direction,
    attachments: message.attachments,
    readAt:
      typeof message.readAt === "number"
        ? new Date(message.readAt).toISOString()
        : undefined,
  }));
}

const DM_PANEL_FRESH_MS = 60_000;
const DM_PANEL_RATE_LIMIT_RETRY_MS = 2 * 60_000;

async function persistDmConversationSnapshot(
  ctx: any,
  args: {
    userId: Id<"users">;
    prospect: any;
    conversationId: string;
    participantUserId?: string;
    participantUsername?: string;
    participantName?: string;
    participantAvatarUrl?: string;
    participantVerified?: boolean;
    eligibility: XDmEligibility;
    messages: XDmMessage[];
    lastSyncAttemptAt?: number;
    lastSyncSuccessAt?: number;
    nextSyncAllowedAt?: number;
    lastSyncErrorCode?: "rate_limited" | "activity_degraded";
    lastSyncErrorMessage?: string;
  }
) {
  await ctx.runMutation(
    internal.platformConversations.upsertConversationSnapshotInternal,
    {
      userId: args.userId,
      workspaceId: args.prospect.workspaceId,
      prospectId: args.prospect._id,
      platform: "twitter",
      conversationId: args.conversationId,
      participantUserId: args.participantUserId,
      participantUsername: args.participantUsername,
      participantName: args.participantName,
      participantAvatarUrl: args.participantAvatarUrl,
      participantVerified: args.participantVerified,
      eligibilityEnabled: args.eligibility.enabled,
      eligibilityReasonCode: args.eligibility.reasonCode,
      eligibilityReasonLabel: args.eligibility.reasonLabel,
      lastSyncedAt: args.lastSyncSuccessAt,
      lastSyncAttemptAt: args.lastSyncAttemptAt,
      lastSyncSuccessAt: args.lastSyncSuccessAt,
      nextSyncAllowedAt: args.nextSyncAllowedAt,
      lastSyncErrorCode: args.lastSyncErrorCode,
      lastSyncErrorMessage: args.lastSyncErrorMessage,
      messages: toStoredConversationMessages(args.messages),
    }
  );
}

function buildCachedDmWarning(args: {
  conversation?: Record<string, any> | null;
  account?: Record<string, any> | null;
}): XDmPanelContext["warning"] {
  const conversation = args.conversation;
  if (conversation?.lastSyncErrorCode === "rate_limited") {
    return {
      code: "rate_limited",
      message:
        "Live refresh is temporarily limited on X. Showing last synced messages.",
      retryAfterMs:
        typeof conversation.nextSyncAllowedAt === "number"
          ? Math.max(0, conversation.nextSyncAllowedAt - Date.now())
          : undefined,
    };
  }

  const account = args.account;
  if (
    account?.activitySubscriptionStatus &&
    account.activitySubscriptionStatus !== "healthy"
  ) {
    return {
      code: "activity_degraded",
      message:
        "Realtime DM activity is temporarily degraded. Messaging still works, but live updates may lag.",
      retryAfterMs:
        typeof account.activitySubscriptionsNextRetryAt === "number"
          ? Math.max(0, account.activitySubscriptionsNextRetryAt - Date.now())
          : undefined,
    };
  }

  return undefined;
}

function buildBaseDmPanelContext(args: {
  prospect: any;
  prospectIdentity: ReturnType<typeof resolveProspectTwitterIdentity>;
  connectionStatus: XConnectionStatus;
  cachedSnapshot: any;
  account?: any;
  draftText?: string;
  draftAttachments?: XDmAttachmentSummary[];
  actionRequestId?: string;
}): XDmPanelContext {
  return {
    platform: "twitter",
    conversationId: args.cachedSnapshot?.conversation?.conversationId,
    participantUserId: args.cachedSnapshot?.conversation?.participantUserId,
    prospect: {
      prospectId: String(args.prospect._id),
      displayName: args.prospectIdentity.displayName,
      title: args.prospectIdentity.title,
      avatarUrl: args.prospectIdentity.avatarUrl,
      profileUrl: args.prospectIdentity.profileUrl,
      username: args.prospectIdentity.username,
      verified: args.prospectIdentity.verified,
    },
    eligibility:
      args.cachedSnapshot?.conversation?.eligibilityReasonCode &&
      typeof args.cachedSnapshot?.conversation?.eligibilityEnabled === "boolean"
        ? {
            enabled: args.cachedSnapshot.conversation.eligibilityEnabled,
            reasonCode: args.cachedSnapshot.conversation.eligibilityReasonCode,
            reasonLabel:
              args.cachedSnapshot.conversation.eligibilityReasonLabel ??
              "DM eligibility unavailable right now.",
            conversationId: args.cachedSnapshot.conversation.conversationId,
          }
        : buildDmEligibility({
            isConnected: args.connectionStatus.isConnected,
            missingScopes: args.connectionStatus.missingScopes,
            conversationId: args.cachedSnapshot?.conversation?.conversationId,
          }),
    messages: toCachedDmMessages(args.cachedSnapshot),
    draftText: args.draftText,
    draftAttachments: args.draftAttachments,
    actionRequestId: args.actionRequestId,
    warning: buildCachedDmWarning({
      conversation: args.cachedSnapshot?.conversation,
      account: args.account,
    }),
  };
}

function shouldPerformLiveDmSync(snapshot: any): boolean {
  const conversation = snapshot?.conversation;
  if (!conversation) {
    return true;
  }
  if (
    typeof conversation.nextSyncAllowedAt === "number" &&
    conversation.nextSyncAllowedAt > Date.now()
  ) {
    return false;
  }
  if (typeof conversation.lastSyncSuccessAt !== "number") {
    return true;
  }
  return Date.now() - conversation.lastSyncSuccessAt > DM_PANEL_FRESH_MS;
}

async function syncProspectDmConversationForUser(
  ctx: any,
  args: {
    userId: Id<"users">;
    prospect: any;
    prospectIdentity: ReturnType<typeof resolveProspectTwitterIdentity>;
    connectionStatus: XConnectionStatus;
    baseContext: XDmPanelContext;
  }
): Promise<XDmPanelContext> {
  const syncAttemptAt = Date.now();
  const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
    userId: args.userId,
    requiredScopes: ["tweet.read", "users.read", "dm.read"],
  });

  const { profileUserId, profile } = await getHydratedProfileByUsername(
    provider,
    args.prospectIdentity.username!
  );
  const conversationId = computeOneToOneDmConversationId(
    args.connectionStatus.xUserId!,
    profileUserId
  );
  const eligibility = buildDmEligibility({
    isConnected: args.connectionStatus.isConnected,
    missingScopes: args.connectionStatus.missingScopes,
    receivesYourDm: profile.can_dm,
    conversationId,
  });

  let messages = args.baseContext.messages;

  try {
    const threadResponse = await getDmEventsByConversationId(
      provider,
      conversationId,
      { maxResults: 100 }
    );
    messages = mergeDmMessages(
      normalizeDmMessages(threadResponse, args.connectionStatus.xUserId),
      args.baseContext.messages
    );
    await persistDmConversationSnapshot(ctx, {
      userId: args.userId,
      prospect: args.prospect,
      conversationId,
      participantUserId: profileUserId,
      participantUsername: profile.username ?? profile.screen_name,
      participantName: profile.name,
      participantAvatarUrl: profile.profile_image_url_https,
      participantVerified: profile.verified,
      eligibility,
      messages,
      lastSyncAttemptAt: syncAttemptAt,
      lastSyncSuccessAt: Date.now(),
      nextSyncAllowedAt: undefined,
      lastSyncErrorCode: undefined,
      lastSyncErrorMessage: undefined,
    });
  } catch (error) {
    if (isMissingConversationError(error)) {
      await persistDmConversationSnapshot(ctx, {
        userId: args.userId,
        prospect: args.prospect,
        conversationId,
        participantUserId: profileUserId,
        participantUsername: profile.username ?? profile.screen_name,
        participantName: profile.name,
        participantAvatarUrl: profile.profile_image_url_https,
        participantVerified: profile.verified,
        eligibility,
        messages,
        lastSyncAttemptAt: syncAttemptAt,
        lastSyncSuccessAt: Date.now(),
        nextSyncAllowedAt: undefined,
        lastSyncErrorCode: undefined,
        lastSyncErrorMessage: undefined,
      });
    } else {
      const failure = getXExecutionFailure(error);
      if (failure.classification === "rate_limited") {
        const nextSyncAllowedAt = Date.now() + DM_PANEL_RATE_LIMIT_RETRY_MS;
        await persistDmConversationSnapshot(ctx, {
          userId: args.userId,
          prospect: args.prospect,
          conversationId,
          participantUserId: profileUserId,
          participantUsername: profile.username ?? profile.screen_name,
          participantName: profile.name,
          participantAvatarUrl: profile.profile_image_url_https,
          participantVerified: profile.verified,
          eligibility,
          messages,
          lastSyncAttemptAt: syncAttemptAt,
          nextSyncAllowedAt,
          lastSyncErrorCode: "rate_limited",
          lastSyncErrorMessage: failure.message,
        });
        return {
          ...args.baseContext,
          conversationId,
          participantUserId: profileUserId,
          eligibility,
          warning: {
            code: "rate_limited",
            message:
              "Live refresh is temporarily limited on X. Showing last synced messages.",
            retryAfterMs: DM_PANEL_RATE_LIMIT_RETRY_MS,
          },
        };
      }
      throw error;
    }
  }

  const ensured = await ctx.runAction(
    internal.xActivity.ensureDmActivitySubscriptionsForUserInternal,
    {
      userId: args.userId,
    }
  );

  return {
    ...args.baseContext,
    conversationId,
    participantUserId: profileUserId,
    eligibility,
    messages,
    warning: ensured.ensured ? undefined : args.baseContext.warning,
  };
}

async function resolveProspectDmPanelContext(
  ctx: any,
  userId: Id<"users">,
  prospectId: Id<"prospects">,
  options?: {
    draftText?: string;
    draftAttachments?: XDmAttachmentSummary[];
    actionRequestId?: string;
  }
): Promise<XDmPanelContext | null> {
  const prospect = await getOwnedTwitterProspectForUser(
    ctx,
    userId,
    prospectId
  );
  if (!prospect) {
    return null;
  }

  const prospectIdentity = resolveProspectTwitterIdentity(
    prospect as Record<string, unknown>
  );
  const connectionStatus = await getXConnectionStatusForUser(
    ctx,
    getXStoreRefs(),
    userId
  );
  const account = await ctx.runQuery(
    internal.xStore.getXAccountForUserInternal,
    {
      userId,
    }
  );
  const cachedSnapshot = await ctx.runQuery(
    internal.platformConversations.getConversationSnapshotInternal,
    {
      userId,
      platform: "twitter",
      prospectId,
    }
  );

  const baseContext = buildBaseDmPanelContext({
    prospect,
    prospectIdentity,
    connectionStatus,
    cachedSnapshot,
    account,
    draftText: options?.draftText,
    draftAttachments: options?.draftAttachments,
    actionRequestId: options?.actionRequestId,
  });

  if (!prospectIdentity.username || !connectionStatus.xUserId) {
    return baseContext;
  }
  if (
    !connectionStatus.isConnected ||
    (connectionStatus.missingScopes ?? []).some(
      (scope) => scope === "dm.read" || scope === "dm.write"
    )
  ) {
    return baseContext;
  }
  if (!shouldPerformLiveDmSync(cachedSnapshot)) {
    return baseContext;
  }

  try {
    return await syncProspectDmConversationForUser(ctx, {
      userId,
      prospect,
      prospectIdentity,
      connectionStatus,
      baseContext,
    });
  } catch (error) {
    logger.warn("Unable to refresh X DM panel context", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      prospectId,
    });
    return baseContext;
  }
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
    const limitError = getDmTextLimitError(args.text.trim());
    if (limitError) {
      throw new Error(limitError);
    }
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry("send_dm");
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    try {
      return await executeCuratedTwitterAction(provider, {
        actionKey: "send_dm",
        toolSlug: entry.toolSlug,
        toolVersion: entry.toolVersion,
        targetUserId: args.targetUserId,
        text: args.text.trim(),
      });
    } catch (error) {
      throw formatDirectXWriteActionError(error);
    }
  },
});

export const sendDmInExistingConversation = action({
  args: {
    conversationId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const limitError = getDmTextLimitError(args.text.trim());
    if (limitError) {
      throw new Error(limitError);
    }
    const userId = await getCurrentUserId(ctx);
    const entry = getTwitterActionCatalogEntry(
      "send_dm_in_existing_conversation"
    );
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    try {
      return await executeCuratedTwitterAction(provider, {
        actionKey: "send_dm_in_existing_conversation",
        toolSlug: entry.toolSlug,
        toolVersion: entry.toolVersion,
        conversationId: args.conversationId,
        text: args.text.trim(),
      });
    } catch (error) {
      throw formatDirectXWriteActionError(error);
    }
  },
});

export const getProspectDmState = action({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    return await getProspectDmStateForUser(ctx, userId, args.prospectId);
  },
});

/** Same data as getProspectDmState but for trusted internal callers (no ctx.auth). */
export const getProspectDmStateInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    return await getProspectDmStateForUser(ctx, args.userId, args.prospectId);
  },
});

async function getProspectDmStateForUser(
  ctx: any,
  userId: Id<"users">,
  prospectId: Id<"prospects">
) {
  const prospect = await getOwnedTwitterProspectForUser(
    ctx,
    userId,
    prospectId
  );
  if (!prospect) {
    return null;
  }
  const connectionStatus = await getXConnectionStatusForUser(
    ctx,
    getXStoreRefs(),
    userId
  );
  const account = await ctx.runQuery(
    internal.xStore.getXAccountForUserInternal,
    {
      userId,
    }
  );
  const cachedSnapshot = await ctx.runQuery(
    internal.platformConversations.getConversationSnapshotInternal,
    {
      userId,
      platform: "twitter",
      prospectId,
    }
  );
  const panelContext = buildBaseDmPanelContext({
    prospect,
    prospectIdentity: resolveProspectTwitterIdentity(
      prospect as Record<string, unknown>
    ),
    connectionStatus,
    cachedSnapshot,
    account,
  });

  return {
    prospect: panelContext.prospect,
    participantUserId: panelContext.participantUserId,
    conversationId: panelContext.conversationId,
    eligibility: panelContext.eligibility,
    messageCount: panelContext.messages.length,
    latestMessageAt:
      panelContext.messages.length > 0
        ? panelContext.messages[panelContext.messages.length - 1]?.createdAt
        : undefined,
  };
}

export const getDmPanelContext = action({
  args: {
    prospectId: v.id("prospects"),
    actionRequestId: v.optional(v.id("agentActionRequests")),
  },
  handler: async (ctx, args): Promise<XDmPanelContext | null> => {
    const userId = await getCurrentUserId(ctx);
    let draftText: string | undefined;
    let draftAttachments: XDmAttachmentSummary[] | undefined;
    let actionRequestId: string | undefined;

    if (args.actionRequestId) {
      const request = await ctx.runQuery(
        internal.twitterActions.getActionRequestInternal,
        { actionRequestId: args.actionRequestId }
      );
      if (!request || request.userId !== userId) {
        return null;
      }
      draftText = request.draftContent;
      draftAttachments = buildDraftDmAttachments(
        Array.isArray((request.argumentsSnapshot as any)?.mediaUrls)
          ? ((request.argumentsSnapshot as any).mediaUrls as string[])
          : undefined,
        Array.isArray((request.argumentsSnapshot as any)?.mediaDescriptions)
          ? ((request.argumentsSnapshot as any).mediaDescriptions as string[])
          : undefined
      );
      actionRequestId = String(request._id);
    }

    return await resolveProspectDmPanelContext(ctx, userId, args.prospectId, {
      draftText,
      draftAttachments,
      actionRequestId,
    });
  },
});

export const sendDmMessage = action({
  args: {
    prospectId: v.id("prospects"),
    conversationId: v.optional(v.string()),
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    actionRequestId: v.optional(v.id("agentActionRequests")),
  },
  handler: async (ctx, args) => {
    const mediaUrlsFiltered = (args.mediaUrls ?? []).filter(
      (mediaUrl): mediaUrl is string =>
        typeof mediaUrl === "string" && mediaUrl.trim().length > 0
    );
    const trimmedText = args.text.trim();
    if (!hasDmBody(args.text, mediaUrlsFiltered)) {
      throw new Error(
        "DM requires message text or at least one media attachment."
      );
    }
    if (mediaUrlsFiltered.length > 1) {
      throw new Error("X DMs support exactly one media attachment.");
    }
    if (trimmedText) {
      const limitError = getDmTextLimitError(trimmedText);
      if (limitError) {
        throw new Error(limitError);
      }
    }

    const userId = await getCurrentUserId(ctx);
    const prospect = await getOwnedTwitterProspectForUser(
      ctx,
      userId,
      args.prospectId
    );
    if (!prospect) {
      throw new Error("Prospect not found.");
    }
    const panelContext = await resolveProspectDmPanelContext(
      ctx,
      userId,
      args.prospectId
    );
    if (!panelContext) {
      throw new Error("Prospect not found.");
    }
    if (!panelContext.eligibility.enabled) {
      throw new Error(panelContext.eligibility.reasonLabel);
    }
    const actionKey =
      (args.conversationId ?? panelContext.conversationId) &&
      panelContext.messages.length > 0
        ? "send_dm_in_existing_conversation"
        : "send_dm";
    const entry = getTwitterActionCatalogEntry(actionKey);
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: entry.requiredScopes,
    });
    const conversationId = args.conversationId ?? panelContext.conversationId;
    const result = await executeCuratedTwitterAction(provider, {
      actionKey,
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      conversationId:
        actionKey === "send_dm_in_existing_conversation"
          ? conversationId
          : undefined,
      targetUserId:
        actionKey === "send_dm" ? panelContext.participantUserId : undefined,
      text: trimmedText.length > 0 ? trimmedText : undefined,
      mediaUrls: mediaUrlsFiltered,
    });

    if (args.actionRequestId) {
      await ctx.runMutation(
        internal.twitterActions.completeActionRequestInternal,
        {
          actionRequestId: args.actionRequestId,
          resultSummary: {
            actionKey,
            toolSlug: entry.toolSlug,
            toolVersion: entry.toolVersion,
            completedAt: Date.now(),
            targetUserId: panelContext.participantUserId,
            postedTextPreview: trimmedText || undefined,
          },
        }
      );
    }

    const effectiveConversationId =
      (result.result as any)?.data?.dmConversationId ??
      (result.result as any)?.data?.dm_conversation_id ??
      conversationId ??
      panelContext.conversationId ??
      "";
    const createdMessageId =
      (result.result as any)?.data?.dmEventId ??
      (result.result as any)?.data?.dm_event_id;
    const optimisticMessage =
      effectiveConversationId && createdMessageId
        ? {
            id: createdMessageId,
            conversationId: effectiveConversationId,
            senderUserId: provider.xUserId,
            text: trimmedText,
            createdAt: new Date().toISOString(),
            direction: "sent" as const,
            attachments: buildDraftDmAttachments(
              mediaUrlsFiltered,
              args.mediaDescriptions
            ),
          }
        : null;
    const messages = optimisticMessage
      ? mergeDmMessages([optimisticMessage], panelContext.messages)
      : panelContext.messages;

    if (effectiveConversationId) {
      await persistDmConversationSnapshot(ctx, {
        userId,
        prospect,
        conversationId: effectiveConversationId,
        participantUserId: panelContext.participantUserId,
        participantUsername: panelContext.prospect.username,
        participantName: panelContext.prospect.displayName,
        participantAvatarUrl: panelContext.prospect.avatarUrl,
        participantVerified: panelContext.prospect.verified,
        eligibility: {
          ...panelContext.eligibility,
          conversationId: effectiveConversationId,
        },
        messages,
      });
    }

    return {
      result,
      messages,
    };
  },
});

export const syncDmConversation = action({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const existingConversation = await ctx.runQuery(
      internal.platformConversations
        .getConversationByUserAndConversationIdInternal,
      {
        userId,
        conversationId: args.conversationId,
      }
    );
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: ["tweet.read", "users.read", "dm.read"],
    });
    const response = await getDmEventsByConversationId(
      provider,
      args.conversationId,
      {
        maxResults: 100,
      }
    );
    const messages = normalizeDmMessages(response, provider.xUserId);
    if (existingConversation?.prospectId) {
      const prospect = await getOwnedTwitterProspectForUser(
        ctx,
        userId,
        existingConversation.prospectId
      );
      if (prospect) {
        await persistDmConversationSnapshot(ctx, {
          userId,
          prospect,
          conversationId: args.conversationId,
          participantUserId: existingConversation.participantUserId,
          participantUsername: existingConversation.participantUsername,
          participantName: existingConversation.participantName,
          participantAvatarUrl: existingConversation.participantAvatarUrl,
          participantVerified: existingConversation.participantVerified,
          eligibility: {
            enabled: existingConversation.eligibilityEnabled ?? false,
            reasonCode: existingConversation.eligibilityReasonCode ?? "unknown",
            reasonLabel:
              existingConversation.eligibilityReasonLabel ??
              "DM eligibility unavailable right now.",
            conversationId: args.conversationId,
          },
          messages,
        });
      }
    }
    return {
      conversationId: args.conversationId,
      messages,
    };
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
