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
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  assertPostTextWithinLimit,
  getDmTextLimitError,
  hasDmBody,
} from "../shared/lib/twitter/xPostTextLimit";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";

const xLogger = logger.withScope("X");

async function getAccessibleDefaultWorkspaceForUserAction(
  ctx: any,
  userId: Id<"users">
) {
  return await ctx.runQuery(
    internal.workspaces.getAccessibleDefaultWorkspaceInternal,
    {
      userId,
    }
  );
}

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

async function syncXAccountHealthNotification(
  ctx: any,
  args: { userId: Id<"users">; status: XConnectionStatus }
) {
  const defaultWorkspace = await getAccessibleDefaultWorkspaceForUserAction(
    ctx,
    args.userId
  );
  const missingScopes = args.status.missingScopes ?? [];
  const shouldNotify =
    args.status.status === "expired" ||
    args.status.status === "reconnect_required" ||
    missingScopes.length > 0;

  await ctx.runMutation(internal.outreach.syncAccountHealthNotification, {
    userId: args.userId,
    workspaceId: defaultWorkspace?._id,
    platform: "twitter",
    shouldNotify,
    title: "Reconnect X account",
    message:
      missingScopes.length > 0
        ? "Reconnect X and approve the required permissions, including DM or write scopes."
        : args.status.status === "expired"
          ? "Your X session expired. Reconnect to continue sending outreach."
          : "Reconnect your X account to restore full access.",
  });
}

async function attachXStyleSyncIssue(
  ctx: any,
  args: { userId: Id<"users">; status: XConnectionStatus }
): Promise<XConnectionStatus> {
  if (args.status.status !== "connected") {
    return args.status;
  }

  const xAccount = await ctx.runQuery(
    internal.xStore.getXAccountForUserInternal,
    {
      userId: args.userId,
    }
  );
  const sourceVersion =
    typeof xAccount?.styleSourceVersion === "number"
      ? xAccount.styleSourceVersion
      : undefined;
  const sourceExternalUserId =
    typeof xAccount?.xUserId === "string" ? xAccount.xUserId : undefined;
  const issue = await ctx.runQuery(
    internal.workspaceStyleProfiles.getLatestUserStyleSyncIssue,
    {
      userId: args.userId,
      platform: "twitter",
      sourceVersion,
      sourceExternalUserId,
    }
  );

  if (!issue) {
    return args.status;
  }

  return {
    ...args.status,
    styleSyncIssue: {
      key: issue.key,
      lastError: issue.lastError,
    },
  };
}

async function createDirectXOutreachSentNotification(
  ctx: any,
  args: {
    userId: Id<"users">;
    twitterUserId?: string;
    title: string;
    message: string;
    actionId: string;
  }
) {
  if (!args.twitterUserId) {
    return;
  }

  const defaultWorkspace = await getAccessibleDefaultWorkspaceForUserAction(
    ctx,
    args.userId
  );
  if (!defaultWorkspace) {
    return;
  }

  const prospect = await ctx.runQuery(
    internal.prospects.getProspectByTwitterUserIdInternal,
    {
      workspaceId: defaultWorkspace._id,
      twitterUserId: args.twitterUserId,
    }
  );
  if (!prospect) {
    return;
  }

  await ctx.runMutation(internal.outreach.createOutreachSentNotification, {
    userId: args.userId,
    workspaceId: defaultWorkspace._id,
    prospectId: prospect._id,
    title: args.title,
    message: args.message,
    notificationKey: `outreach-sent:twitter:${prospect._id}:${args.actionId}`,
    targetHref: `/agent?prospectId=${encodeURIComponent(String(prospect._id))}`,
    contextPlatform: "twitter",
  });
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
      reasonLabel:
        "Connect X/Twitter in Settings → Connected accounts to message this prospect.",
    };
  }

  const missingScopes = new Set(args.missingScopes ?? []);
  if (missingScopes.has("dm.read") || missingScopes.has("dm.write")) {
    return {
      enabled: false,
      reasonCode: "missing_scopes",
      reasonLabel:
        "Reconnect X/Twitter in Settings → Connected accounts to message this prospect.",
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
  connectionStatus: XConnectionStatus;
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
    args.connectionStatus.status === "connected" &&
    args.connectionStatus.isConnected &&
    account?.activitySubscriptionStatus &&
    account.activitySubscriptionStatus !== "healthy" &&
    (typeof conversation?.lastSyncSuccessAt !== "number" ||
      Date.now() - conversation.lastSyncSuccessAt > DM_PANEL_FRESH_MS)
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
    participantUsername: args.cachedSnapshot?.conversation?.participantUsername,
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
            receivesYourDm: args.prospectIdentity.canDm,
            conversationId: args.cachedSnapshot?.conversation?.conversationId,
          }),
    messages: toCachedDmMessages(args.cachedSnapshot),
    draftText: args.draftText,
    draftAttachments: args.draftAttachments,
    actionRequestId: args.actionRequestId,
    warning: buildCachedDmWarning({
      conversation: args.cachedSnapshot?.conversation,
      account: args.account,
      connectionStatus: args.connectionStatus,
    }),
  };
}

function normalizeCachedXDmEligibilityReason(
  reasonCode: string | undefined
): XDmEligibility["reasonCode"] {
  switch (reasonCode) {
    case "eligible":
    case "not_allowed":
    case "missing_connection":
    case "missing_scopes":
    case "unknown":
      return reasonCode;
    default:
      return "unknown";
  }
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

async function resolveLiveProspectDmEligibility(args: {
  ctx: any;
  userId: Id<"users">;
  prospect: any;
  prospectIdentity: ReturnType<typeof resolveProspectTwitterIdentity>;
  connectionStatus: XConnectionStatus;
  cachedSnapshot: any;
}): Promise<{
  eligibility: XDmEligibility;
  conversationId?: string;
  participantUserId?: string;
  participantUsername?: string;
  participantName?: string;
  participantAvatarUrl?: string;
  participantVerified?: boolean;
}> {
  const fallbackEligibility = buildDmEligibility({
    isConnected: args.connectionStatus.isConnected,
    missingScopes: args.connectionStatus.missingScopes,
    receivesYourDm: args.prospectIdentity.canDm,
    conversationId: args.cachedSnapshot?.conversation?.conversationId,
  });

  if (
    !args.connectionStatus.isConnected ||
    (args.connectionStatus.missingScopes ?? []).some(
      (scope) => scope === "dm.read" || scope === "dm.write"
    ) ||
    !args.prospectIdentity.username ||
    !args.connectionStatus.xUserId
  ) {
    return {
      eligibility: fallbackEligibility,
      conversationId: fallbackEligibility.conversationId,
      participantUserId: args.cachedSnapshot?.conversation?.participantUserId,
      participantUsername:
        args.cachedSnapshot?.conversation?.participantUsername,
      participantName: args.cachedSnapshot?.conversation?.participantName,
      participantAvatarUrl:
        args.cachedSnapshot?.conversation?.participantAvatarUrl,
      participantVerified:
        args.cachedSnapshot?.conversation?.participantVerified,
    };
  }

  try {
    const provider = await getReadProviderForUser(args.ctx, args.userId);
    const { profileUserId, profile } = await getHydratedProfileByUsername(
      provider,
      args.prospectIdentity.username
    );
    const conversationId = computeOneToOneDmConversationId(
      args.connectionStatus.xUserId,
      profileUserId
    );
    const eligibility = buildDmEligibility({
      isConnected: args.connectionStatus.isConnected,
      missingScopes: args.connectionStatus.missingScopes,
      receivesYourDm: profile.can_dm,
      conversationId,
    });
    const messages = toCachedDmMessages(args.cachedSnapshot);

    await persistDmConversationSnapshot(args.ctx, {
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
    });

    return {
      eligibility,
      conversationId,
      participantUserId: profileUserId,
      participantUsername: profile.username ?? profile.screen_name,
      participantName: profile.name,
      participantAvatarUrl: profile.profile_image_url_https,
      participantVerified: profile.verified,
    };
  } catch (error) {
    logger.warn("Unable to resolve live X DM eligibility", {
      error: error instanceof Error ? error.message : String(error),
      userId: args.userId,
      prospectId: args.prospect._id,
      username: args.prospectIdentity.username,
    });

    return {
      eligibility: fallbackEligibility,
      conversationId: fallbackEligibility.conversationId,
      participantUserId: args.cachedSnapshot?.conversation?.participantUserId,
      participantUsername:
        args.cachedSnapshot?.conversation?.participantUsername,
      participantName: args.cachedSnapshot?.conversation?.participantName,
      participantAvatarUrl:
        args.cachedSnapshot?.conversation?.participantAvatarUrl,
      participantVerified:
        args.cachedSnapshot?.conversation?.participantVerified,
    };
  }
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
          participantUsername:
            profile.username ??
            profile.screen_name ??
            args.baseContext.participantUsername,
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
    participantUsername:
      profile.username ??
      profile.screen_name ??
      args.baseContext.participantUsername,
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

function normalizeMediaUrls(mediaUrls?: string[]) {
  return (mediaUrls ?? []).filter(
    (mediaUrl): mediaUrl is string =>
      typeof mediaUrl === "string" && mediaUrl.trim().length > 0
  );
}

function assertValidMediaDescriptions(
  mediaUrls: string[],
  mediaDescriptions?: string[]
) {
  if (mediaDescriptions && mediaDescriptions.length > mediaUrls.length) {
    throw new Error("mediaDescriptions cannot exceed mediaUrls length");
  }
}

function isUnreadableXdkBodyMessage(message: string | undefined): boolean {
  if (!message) {
    return false;
  }
  const normalized = message.toLowerCase();
  return (
    normalized.includes("body is unusable") ||
    normalized.includes("body has already been read")
  );
}

function formatDirectXWriteActionError(error: unknown): Error {
  const failure = getXExecutionFailure(error);
  const normalizedMessage = failure.message.toLowerCase();
  const detail =
    failure.message &&
    !/^http \d+:/i.test(failure.message) &&
    failure.message.toLowerCase() !== "forbidden" &&
    !isUnreadableXdkBodyMessage(failure.message)
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
          "Reconnect your X account and approve the required X write permissions, including media access."
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

async function handleDirectXWriteActionError(
  ctx: any,
  userId: Id<"users">,
  error: unknown
): Promise<Error> {
  const failure = getXExecutionFailure(error);
  if (
    failure.classification === "reauth_required" ||
    failure.classification === "scope_missing"
  ) {
    await syncXAccountHealthNotification(ctx, {
      userId,
      status: {
        isConnected: true,
        status:
          failure.classification === "scope_missing"
            ? "connected"
            : "reconnect_required",
        missingScopes:
          failure.classification === "scope_missing"
            ? ["tweet.write"]
            : undefined,
      },
    });
  }

  return formatDirectXWriteActionError(error);
}

export const getTwitterConnectionStatus = action({
  args: {},
  handler: async (ctx): Promise<XConnectionStatus> => {
    const userId = await getCurrentUserId(ctx);
    const status = await getXConnectionStatusForUser(
      ctx,
      getXStoreRefs(),
      userId
    );
    const statusWithIssue = await attachXStyleSyncIssue(ctx, {
      userId,
      status,
    });
    await syncXAccountHealthNotification(ctx, {
      userId,
      status: statusWithIssue,
    });
    return statusWithIssue;
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
    const result = await completeXAuthorizationForUser(ctx, getXStoreRefs(), {
      userId,
      code: args.code,
      state: args.state,
    });

    // Schedule writing style monitor creation (non-blocking)
    if (result.status === "connected") {
      await ctx.scheduler.runAfter(
        0,
        internal.styleMonitorActions.ensureStyleMonitor,
        { userId }
      );
    }

    const resultWithIssue = await attachXStyleSyncIssue(ctx, {
      userId,
      status: result,
    });
    await syncXAccountHealthNotification(ctx, {
      userId,
      status: resultWithIssue,
    });

    return resultWithIssue;
  },
});

export const disconnectTwitter = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const xAccount = await ctx.runQuery(
      internal.xStore.getXAccountForUserInternal,
      { userId }
    );
    if (xAccount) {
      const sourceVersion =
        xAccount.styleSourceVersion ?? xAccount._creationTime;
      await ctx.runAction(
        internal.styleMonitorActions.deleteStyleMonitorForUser,
        {
          userId,
          sourceVersion,
        }
      );
      await ctx.runMutation(internal.styleAnalysis.resetStyleSourceData, {
        userId,
        platform: "twitter",
        sourceVersion,
        sourceExternalUserId: xAccount.xUserId,
      });
    }
    await disconnectXForUser(ctx, getXStoreRefs(), userId);
    return { success: true as const };
  },
});

export const likeTweet = action({
  args: {
    tweetId: v.string(),
    authorId: v.optional(v.string()),
    likeCount: v.optional(v.number()),
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
    await ctx.runMutation(
      internal.twitterEngagement.upsertPostEngagementInternal,
      {
        userId,
        postId: args.tweetId,
        authorId: args.authorId,
        patch: { liked: true, likeCount: args.likeCount },
      }
    );
    return { success: true as const };
  },
});

export const unlikeTweet = action({
  args: {
    tweetId: v.string(),
    authorId: v.optional(v.string()),
    likeCount: v.optional(v.number()),
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
    await ctx.runMutation(
      internal.twitterEngagement.upsertPostEngagementInternal,
      {
        userId,
        postId: args.tweetId,
        authorId: args.authorId,
        patch: { liked: false, likeCount: args.likeCount },
      }
    );
    return { success: true as const };
  },
});

export const retweet = action({
  args: {
    tweetId: v.string(),
    authorId: v.optional(v.string()),
    repeatCount: v.optional(v.number()),
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
    await ctx.runMutation(
      internal.twitterEngagement.upsertPostEngagementInternal,
      {
        userId,
        postId: args.tweetId,
        authorId: args.authorId,
        patch: { retweeted: true, repeatCount: args.repeatCount },
      }
    );
    return { success: true as const };
  },
});

export const unretweet = action({
  args: {
    tweetId: v.string(),
    authorId: v.optional(v.string()),
    repeatCount: v.optional(v.number()),
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
    await ctx.runMutation(
      internal.twitterEngagement.upsertPostEngagementInternal,
      {
        userId,
        postId: args.tweetId,
        authorId: args.authorId,
        patch: { retweeted: false, repeatCount: args.repeatCount },
      }
    );
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
    await ctx.runMutation(internal.twitterEngagement.upsertFollowingInternal, {
      userId,
      targetUserId: args.targetUserId,
      following: true,
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
    await ctx.runMutation(internal.twitterEngagement.upsertFollowingInternal, {
      userId,
      targetUserId: args.targetUserId,
      following: false,
    });
    return { success: true as const };
  },
});

export const createPost = action({
  args: {
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const mediaUrls = normalizeMediaUrls(args.mediaUrls);
    assertValidMediaDescriptions(mediaUrls, args.mediaDescriptions);
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
        mediaUrls,
        mediaDescriptions: args.mediaDescriptions,
      });
    } catch (error) {
      throw await handleDirectXWriteActionError(ctx, userId, error);
    }
  },
});

export const replyToPost = action({
  args: {
    tweetId: v.string(),
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    parentAuthorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mediaUrls = normalizeMediaUrls(args.mediaUrls);
    assertValidMediaDescriptions(mediaUrls, args.mediaDescriptions);
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
      const result = await executeCuratedTwitterAction(provider, {
        actionKey: "reply_to_post",
        toolSlug: entry.toolSlug,
        toolVersion: entry.toolVersion,
        tweetId: args.tweetId,
        text: args.text.trim(),
        mediaUrls,
        mediaDescriptions: args.mediaDescriptions,
      });
      await ctx.runMutation(
        internal.twitterEngagement.upsertPostEngagementInternal,
        {
          userId,
          postId: args.tweetId,
          authorId: args.parentAuthorId,
          patch: { commented: true },
        }
      );
      await createDirectXOutreachSentNotification(ctx, {
        userId,
        twitterUserId: args.parentAuthorId,
        title: "Reply sent on X",
        message: args.text.trim(),
        actionId: result.createdTweetId ?? args.tweetId,
      });
      return result;
    } catch (error) {
      throw await handleDirectXWriteActionError(ctx, userId, error);
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
      const result = await executeCuratedTwitterAction(provider, {
        actionKey: "send_dm",
        toolSlug: entry.toolSlug,
        toolVersion: entry.toolVersion,
        targetUserId: args.targetUserId,
        text: args.text.trim(),
      });
      await createDirectXOutreachSentNotification(ctx, {
        userId,
        twitterUserId: args.targetUserId,
        title: "DM sent on X",
        message: args.text.trim(),
        actionId: String(Date.now()),
      });
      return result;
    } catch (error) {
      throw await handleDirectXWriteActionError(ctx, userId, error);
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
      throw await handleDirectXWriteActionError(ctx, userId, error);
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
  const prospectIdentity = resolveProspectTwitterIdentity(
    prospect as Record<string, unknown>
  );
  const panelContext = buildBaseDmPanelContext({
    prospect,
    prospectIdentity,
    connectionStatus,
    cachedSnapshot,
    account,
  });
  const liveEligibility = await resolveLiveProspectDmEligibility({
    ctx,
    userId,
    prospect,
    prospectIdentity,
    connectionStatus,
    cachedSnapshot,
  });

  return {
    prospect: panelContext.prospect,
    participantUserId:
      liveEligibility.participantUserId ?? panelContext.participantUserId,
    conversationId:
      liveEligibility.conversationId ?? panelContext.conversationId,
    eligibility: liveEligibility.eligibility,
    messageCount: panelContext.messages.length,
    latestMessageAt:
      panelContext.messages.length > 0
        ? panelContext.messages[panelContext.messages.length - 1]?.createdAt
        : undefined,
  };
}

async function syncDmConversationForUser(
  ctx: any,
  userId: Id<"users">,
  conversationId: string
) {
  const existingConversation = await ctx.runQuery(
    internal.platformConversations
      .getConversationByUserAndConversationIdInternal,
    {
      userId,
      conversationId,
    }
  );
  const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
    userId,
    requiredScopes: ["tweet.read", "users.read", "dm.read"],
  });
  const response = await getDmEventsByConversationId(provider, conversationId, {
    maxResults: 100,
  });
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
        conversationId,
        participantUserId: existingConversation.participantUserId,
        participantUsername: existingConversation.participantUsername,
        participantName: existingConversation.participantName,
        participantAvatarUrl: existingConversation.participantAvatarUrl,
        participantVerified: existingConversation.participantVerified,
        eligibility: {
          enabled: existingConversation.eligibilityEnabled ?? false,
          reasonCode: normalizeCachedXDmEligibilityReason(
            existingConversation.eligibilityReasonCode
          ),
          reasonLabel:
            existingConversation.eligibilityReasonLabel ??
            "DM eligibility unavailable right now.",
          conversationId,
        },
        messages,
      });
    }
  }
  return {
    conversationId,
    messages,
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
        internal.socialActions.getActionRequestInternal,
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

async function sendDmMessageForUser(
  ctx: any,
  args: {
    userId: Id<"users">;
    prospectId: Id<"prospects">;
    conversationId?: string;
    text: string;
    mediaUrls?: string[];
    mediaDescriptions?: string[];
    actionRequestId?: Id<"agentActionRequests">;
  }
) {
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

  const prospect = await getOwnedTwitterProspectForUser(
    ctx,
    args.userId,
    args.prospectId
  );
  if (!prospect) {
    throw new Error("Prospect not found.");
  }
  const panelContext = await resolveProspectDmPanelContext(
    ctx,
    args.userId,
    args.prospectId
  );
  if (!panelContext) {
    throw new Error("Prospect not found.");
  }
  if (!panelContext.eligibility.enabled) {
    throw new Error(panelContext.eligibility.reasonLabel);
  }
  const conversationId = args.conversationId ?? panelContext.conversationId;
  const hasExistingConversation =
    typeof conversationId === "string" && conversationId.trim().length > 0;
  const actionKey = hasExistingConversation
    ? "send_dm_in_existing_conversation"
    : "send_dm";
  const targetUserId = panelContext.participantUserId;
  if (!hasExistingConversation && !targetUserId) {
    throw new Error(
      "DM target is unavailable right now. Refresh the profile and try again."
    );
  }

  const entry = getTwitterActionCatalogEntry(actionKey);
  const requiredScopes =
    mediaUrlsFiltered.length > 0
      ? [...new Set([...entry.requiredScopes, "media.write"])]
      : entry.requiredScopes;
  const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
    userId: args.userId,
    requiredScopes,
  });

  try {
    const result = await executeCuratedTwitterAction(provider, {
      actionKey,
      toolSlug: entry.toolSlug,
      toolVersion: entry.toolVersion,
      conversationId:
        actionKey === "send_dm_in_existing_conversation"
          ? conversationId
          : undefined,
      targetUserId: actionKey === "send_dm" ? targetUserId : undefined,
      text: trimmedText.length > 0 ? trimmedText : undefined,
      mediaUrls: mediaUrlsFiltered,
    });

    if (args.actionRequestId) {
      await ctx.runMutation(
        internal.socialActions.completeActionRequestInternal,
        {
          actionRequestId: args.actionRequestId,
          resultSummary: {
            actionKey,
            toolSlug: entry.toolSlug,
            toolVersion: entry.toolVersion,
            completedAt: Date.now(),
            targetUserId,
            postedTextPreview: trimmedText || undefined,
          },
        }
      );

      await ctx.runMutation(
        internal.socialActions.createActionRequestNotificationInternal,
        {
          actionRequestId: args.actionRequestId,
          type: "social_action_completed",
          message: trimmedText || "X DM sent.",
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
        userId: args.userId,
        prospect,
        conversationId: effectiveConversationId,
        participantUserId: targetUserId,
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

    await ctx.runMutation(
      internal.outreach.markProspectContactedFromSuccessfulOutreach,
      {
        prospectId: args.prospectId,
        workspaceId: prospect.workspaceId,
        description: "Sent a DM on X.",
      }
    );

    return {
      result,
      conversationId: effectiveConversationId || undefined,
      messageId:
        typeof createdMessageId === "string" ? createdMessageId : undefined,
      messages,
    };
  } catch (error) {
    throw await handleDirectXWriteActionError(ctx, args.userId, error);
  }
}

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
    const userId = await getCurrentUserId(ctx);
    return await sendDmMessageForUser(ctx, {
      userId,
      ...args,
    });
  },
});

export const sendDmMessageInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    conversationId: v.optional(v.string()),
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    actionRequestId: v.optional(v.id("agentActionRequests")),
  },
  handler: async (ctx, args) => {
    return await sendDmMessageForUser(ctx, args);
  },
});

export const syncDmConversation = action({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    return await syncDmConversationForUser(ctx, userId, args.conversationId);
  },
});

export const syncDmConversationInternal = internalAction({
  args: {
    userId: v.id("users"),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await syncDmConversationForUser(
      ctx,
      args.userId,
      args.conversationId
    );
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
    /** When true, runs expensive X list-pagination for like/bookmark/follow state. Default false. */
    includeViewerState: v.optional(v.boolean()),
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
    const includeViewerState = args.includeViewerState === true;
    const tweets = includeViewerState
      ? await attachViewerStateToTweets(ctx, userId, timeline.tweets)
      : timeline.tweets;

    return {
      username: profile.username ?? args.username,
      profileUserId,
      profile,
      timeline: {
        mode,
        tweets,
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
    includeViewerState: v.optional(v.boolean()),
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
    const includeViewerState = args.includeViewerState === true;
    const tweets = includeViewerState
      ? await attachViewerStateToTweets(ctx, viewerUserId, timeline.tweets)
      : timeline.tweets;

    return {
      mode: args.mode,
      tweets,
      nextCursor: timeline.nextCursor,
      fetchedAt: Date.now(),
    };
  },
});

export const getHydratedTwitterPost = action({
  args: {
    tweetId: v.string(),
    includeViewerState: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<HydratedTwitterPostPayload> => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getReadProviderForUser(ctx, userId);
    const tweet = await getHydratedPostById(provider, args.tweetId);
    const includeViewerState = args.includeViewerState === true;

    if (!tweet) {
      return { tweet: null, fetchedAt: Date.now() };
    }

    const hydrated = includeViewerState
      ? ((await attachViewerStateToTweets(ctx, userId, [tweet]))[0] ?? tweet)
      : tweet;

    return {
      tweet: hydrated,
      fetchedAt: Date.now(),
    };
  },
});

export const getHydratedTwitterPostInternal = internalAction({
  args: {
    userId: v.id("users"),
    tweetId: v.string(),
  },
  handler: async (ctx, args): Promise<HydratedTwitterPostPayload> => {
    try {
      const provider = await getReadProviderForUser(ctx, args.userId);
      const tweet = await getHydratedPostById(provider, args.tweetId);

      return {
        tweet,
        fetchedAt: getCurrentUTCTimestamp(),
      };
    } catch (error) {
      xLogger.warn("Failed to hydrate post for internal action context", {
        tweetId: args.tweetId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        tweet: null,
        fetchedAt: getCurrentUTCTimestamp(),
      };
    }
  },
});

export const getHydratedTwitterPostsByIds = action({
  args: {
    tweetIds: v.array(v.string()),
    /** When true, runs expensive X list-pagination for viewer state. Default false. */
    includeViewerState: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<HydratedTwitterPostsPayload> => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getReadProviderForUser(ctx, userId);
    const tweets = await getHydratedPostsByIds(provider, args.tweetIds);
    const includeViewerState = args.includeViewerState === true;

    return {
      tweets: includeViewerState
        ? await attachViewerStateToTweets(ctx, userId, tweets)
        : tweets,
      fetchedAt: Date.now(),
    };
  },
});

export const getHydratedTwitterConversation = action({
  args: {
    threadId: v.string(),
    includeViewerState: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<HydratedTwitterConversationPayload> => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getReadProviderForUser(ctx, userId);
    const payload = await getHydratedConversationByThreadId(
      provider,
      args.threadId
    );
    const includeViewerState = args.includeViewerState === true;

    return {
      ...payload,
      tweets: includeViewerState
        ? await attachViewerStateToTweets(ctx, userId, payload.tweets)
        : payload.tweets,
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
