"use node";

import { ConvexError, v, type Infer } from "convex/values";
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
  resolveDmMessageUrls,
} from "./lib/xDm";
import {
  executeCuratedTwitterAction,
  formatXWriteActionError,
  getDmEvents,
  getDmEventsByConversationId,
  getXChatBrowserDecryptBundle,
  getXChatEncryptedEventPage,
  getXChatEncryptedMedia as fetchXChatEncryptedMedia,
  getXChatConversationHistoryEvidence,
  getXChatRealmAuthTokenForUser,
  getHydratedConversationByThreadId,
  getHydratedPostById,
  getHydratedPostsByIds,
  getHydratedProfileByUsername,
  getHydratedTimelinePage,
  hasXChatEncryptedMessage,
  getXExecutionFailure,
  submitEncryptedXChatMessage,
  uploadEncryptedXChatMedia,
  XChatConfigurationError,
  XChatProviderRequestError,
} from "./lib/xdkTwitterProvider";
import {
  assertMatchingEncryptedXChatSendOperation,
  normalizeEncryptedXChatSendPayload,
} from "./lib/xChatSendCore";
import {
  assertCacheableProviderMedia,
  buildPlatformConversationMediaCacheKey,
  PLATFORM_CONVERSATION_MEDIA_CACHE_TTL_MS,
} from "./lib/platformConversationMediaCore";
import {
  applyConversationHistorySince,
  buildConversationHistoryPageMetadata,
  getProviderPageCursor,
  normalizeConversationHistoryPageLimit,
  shouldPersistRecentConversationHistoryPage,
  type ConversationHistoryPageMetadata,
} from "./lib/conversationHistoryPaginationCore";
import {
  AGENT_PROVIDER_HISTORY_PAGE_SIZE,
  getAgentProviderHistoryPageBudget,
} from "./lib/prospectInteractionHistoryCore";
import { getXActivitySubscriptionHealth } from "./lib/xActivityReconciliationCore";
import { getTwitterActionCatalogEntry } from "./lib/twitterActionCatalog";
import { getTwitterViewerStatesForUser } from "./lib/twitterViewerStateService";
import {
  userTimelineModeValidator,
  xChatBrowserDecryptBundleValidator,
  xChatEncryptedMediaValidator,
  xChatEncryptedMediaUploadResultValidator,
  xChatEncryptedSendResultValidator,
  xChatSendLeaseResultValidator,
  xChatSendStoredOperationValidator,
  xChatEventPageValidator,
  xChatConversationHistoryEvidenceValidator,
} from "./validators";
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
  getCurrentUTCTimestamp,
  parseIsoToTimestamp,
} from "../shared/lib/utils/time/timeUtils";
import {
  assertPostTextWithinLimit,
  getDmTextLimitError,
  hasDmBody,
} from "../shared/lib/twitter/xPostTextLimit";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";

const xLogger = logger.withScope("X/Twitter");

type XChatEncryptedMediaResult = Infer<typeof xChatEncryptedMediaValidator>;

type XChatEncryptedSendResult = Infer<typeof xChatEncryptedSendResultValidator>;
type XChatSendLeaseResult = Infer<typeof xChatSendLeaseResultValidator>;
type XChatSendStoredOperation = Infer<typeof xChatSendStoredOperationValidator>;

async function runXChatClientRequest<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throwXChatClientRequestError(error);
  }
}

function throwXChatClientRequestError(error: unknown): never {
  if (error instanceof XChatConfigurationError) {
    throw new ConvexError({
      code:
        error.code === "keys_unavailable"
          ? "XCHAT_KEYS_UNAVAILABLE"
          : "XCHAT_BACKUP_UNAVAILABLE",
      message: error.message,
    });
  }
  if (error instanceof XChatProviderRequestError) {
    throw new ConvexError({
      code:
        error.details.code === "rate_limited"
          ? "XCHAT_RATE_LIMITED"
          : error.details.code === "xchat_access_denied"
            ? "XCHAT_ACCESS_DENIED"
            : "XCHAT_PROVIDER_ERROR",
      message: error.details.message,
      status: error.details.status,
      retryAt: error.details.retryAt ?? null,
      limit: error.details.limit ?? null,
      remaining: error.details.remaining ?? null,
    });
  }
  throw error;
}

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
    title: "Reconnect X/Twitter account",
    message:
      missingScopes.length > 0
        ? "Reconnect X/Twitter and approve the required permissions so messaging can continue."
        : args.status.status === "expired"
          ? "Your X/Twitter session expired. Reconnect to continue sending outreach."
          : "Reconnect your X/Twitter account to restore full access.",
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
      reasonLabel: "DM available on X/Twitter.",
      receivesYourDm: true,
      conversationId: args.conversationId,
    };
  }

  if (args.receivesYourDm === false) {
    return {
      enabled: false,
      reasonCode: "not_allowed",
      reasonLabel: "This user doesn’t currently accept your DMs on X/Twitter.",
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
  return createdAt ? (parseIsoToTimestamp(createdAt) ?? 0) : 0;
}

type XDmConversationHistoryPage = {
  messages: XDmMessage[];
  history: ConversationHistoryPageMetadata;
  oldestLoadedAt?: number;
};

async function loadXDmConversationHistoryPage(args: {
  provider: Awaited<ReturnType<typeof getXProviderContextForUser>>;
  conversationId: string;
  cursor?: string;
  limit?: number;
  sinceMs?: number;
}): Promise<XDmConversationHistoryPage> {
  const response = await getDmEventsByConversationId(
    args.provider,
    args.conversationId,
    {
      maxResults: normalizeConversationHistoryPageLimit(args.limit),
      paginationToken: args.cursor,
    }
  );
  const normalized = await resolveDmMessageUrls(
    normalizeDmMessages(response, args.provider.xUserId)
  );
  const { items: messages, reachedSince } = applyConversationHistorySince(
    normalized,
    args.sinceMs
  );
  const history = buildConversationHistoryPageMetadata({
    providerCursor: getProviderPageCursor(response),
    reachedSince,
    platform: "twitter",
  });
  const oldestLoadedAt = messages.reduce<number | undefined>(
    (oldest, message) => {
      const createdAtMs = toCreatedAtMs(message.createdAt);
      if (createdAtMs <= 0) {
        return oldest;
      }
      return typeof oldest === "number"
        ? Math.min(oldest, createdAtMs)
        : createdAtMs;
    },
    undefined
  );

  return { messages, history, oldestLoadedAt };
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
    readAt: message.readAt ? parseIsoToTimestamp(message.readAt) : undefined,
    deliveredAt: message.deliveredAt
      ? parseIsoToTimestamp(message.deliveredAt)
      : undefined,
    quotedMessageId: message.quotedMessageId,
    quotedMessage: message.quotedMessage,
    sharedPost: message.sharedPost,
    reactions: message.reactions,
    editedAt: message.editedAt
      ? parseIsoToTimestamp(message.editedAt)
      : undefined,
    deletedAt: message.deletedAt
      ? parseIsoToTimestamp(message.deletedAt)
      : undefined,
    seenBy: message.seenBy?.map((receipt) => ({
      userId: receipt.userId,
      attendeeId: receipt.attendeeId,
      senderName: receipt.senderName,
      seenAt: receipt.seenAt ? parseIsoToTimestamp(receipt.seenAt) : undefined,
    })),
    sourceEventType: message.sourceEventType as
      | "dm.sent"
      | "dm.received"
      | "dm.read"
      | "chat.sent"
      | "chat.received"
      | "chat.conversation_join"
      | "message_received"
      | "message_sent"
      | "message_read"
      | "message_reaction"
      | "message_edited"
      | "message_deleted"
      | "message_delivered"
      | "new_relation"
      | undefined,
    eventMetadata: message.eventMetadata,
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
    deliveredAt:
      typeof message.deliveredAt === "number"
        ? new Date(message.deliveredAt).toISOString()
        : undefined,
    quotedMessageId: message.quotedMessageId,
    quotedMessage: message.quotedMessage,
    sharedPost: message.sharedPost,
    reactions: message.reactions,
    editedAt:
      typeof message.editedAt === "number"
        ? new Date(message.editedAt).toISOString()
        : undefined,
    deletedAt:
      typeof message.deletedAt === "number"
        ? new Date(message.deletedAt).toISOString()
        : undefined,
    seenBy: Array.isArray(message.seenBy)
      ? message.seenBy.map((receipt: any) => ({
          userId: receipt.userId,
          attendeeId: receipt.attendeeId,
          senderName: receipt.senderName,
          seenAt:
            typeof receipt.seenAt === "number"
              ? new Date(receipt.seenAt).toISOString()
              : undefined,
        }))
      : undefined,
    sourceEventType: message.sourceEventType,
    eventMetadata: message.eventMetadata,
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
    lastSyncErrorCode?: "rate_limited" | "activity_degraded" | "provider_error";
    lastSyncErrorMessage?: string;
    history?: ConversationHistoryPageMetadata;
    historyOldestLoadedAt?: number;
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
      historyNextCursor: args.history?.nextCursor,
      historyHasMore: args.history?.hasMore,
      historyBoundary: args.history?.boundary,
      historyOldestLoadedAt: args.historyOldestLoadedAt,
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
        "Live refresh is temporarily limited on X/Twitter. Showing last synced messages.",
      retryAfterMs:
        typeof conversation.nextSyncAllowedAt === "number"
          ? Math.max(
              0,
              conversation.nextSyncAllowedAt - getCurrentUTCTimestamp()
            )
          : undefined,
    };
  }

  const account = args.account;
  const dmHealth = getXActivitySubscriptionHealth(account ?? {}, "dm");
  if (
    args.connectionStatus.status === "connected" &&
    args.connectionStatus.isConnected &&
    dmHealth.status !== "healthy" &&
    (typeof conversation?.lastSyncSuccessAt !== "number" ||
      getCurrentUTCTimestamp() - conversation.lastSyncSuccessAt >
        DM_PANEL_FRESH_MS)
  ) {
    return {
      code: "activity_degraded",
      message:
        "Realtime DM activity is temporarily degraded. Messaging still works, but live updates may lag.",
      retryAfterMs:
        typeof dmHealth.nextRetryAt === "number"
          ? Math.max(0, dmHealth.nextRetryAt - getCurrentUTCTimestamp())
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
  const currentConnectionEligibility = buildDmEligibility({
    isConnected: args.connectionStatus.isConnected,
    missingScopes: args.connectionStatus.missingScopes,
    receivesYourDm: args.prospectIdentity.canDm,
    conversationId: args.cachedSnapshot?.conversation?.conversationId,
  });
  const canUseCachedEligibility =
    args.connectionStatus.isConnected &&
    !(args.connectionStatus.missingScopes ?? []).some(
      (scope) => scope === "dm.read" || scope === "dm.write"
    );
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
      canUseCachedEligibility &&
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
        : currentConnectionEligibility,
    messages: toCachedDmMessages(args.cachedSnapshot),
    history: {
      nextCursor:
        args.cachedSnapshot?.conversation?.historyHasMore === true
          ? args.cachedSnapshot?.conversation?.historyNextCursor
          : undefined,
      hasMore: args.cachedSnapshot?.conversation?.historyHasMore === true,
      boundary: args.cachedSnapshot?.conversation?.historyBoundary,
    },
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
    conversation.nextSyncAllowedAt > getCurrentUTCTimestamp()
  ) {
    return false;
  }
  if (typeof conversation.lastSyncSuccessAt !== "number") {
    return true;
  }
  // Snapshots created before bounded provider pagination must be refreshed once
  // so the panel receives an honest continuation contract.
  if (typeof conversation.historyHasMore !== "boolean") {
    return true;
  }
  return (
    getCurrentUTCTimestamp() - conversation.lastSyncSuccessAt >
    DM_PANEL_FRESH_MS
  );
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
    logger.warn("Unable to resolve live X/Twitter DM eligibility", {
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
    historyCursor?: string;
    historySinceMs?: number;
    historyLimit?: number;
    activitySubscriptionsEnsured: boolean;
  }
): Promise<XDmPanelContext> {
  const syncAttemptAt = getCurrentUTCTimestamp();
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

  let persistedMessages = args.baseContext.messages;
  let panelMessages = args.baseContext.messages;
  let history: ConversationHistoryPageMetadata = args.baseContext.history ?? {
    hasMore: false,
  };

  try {
    const page = await loadXDmConversationHistoryPage({
      provider,
      conversationId,
      cursor: args.historyCursor,
      limit: args.historyLimit,
      sinceMs: args.historySinceMs,
    });
    persistedMessages = mergeDmMessages(
      page.messages,
      args.baseContext.messages
    );
    panelMessages = page.messages;
    history = page.history;
    if (
      shouldPersistRecentConversationHistoryPage({
        cursor: args.historyCursor,
        sinceMs: args.historySinceMs,
      })
    ) {
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
        messages: persistedMessages,
        lastSyncAttemptAt: syncAttemptAt,
        lastSyncSuccessAt: getCurrentUTCTimestamp(),
        nextSyncAllowedAt: undefined,
        lastSyncErrorCode: undefined,
        lastSyncErrorMessage: undefined,
        history: page.history,
        historyOldestLoadedAt: page.oldestLoadedAt,
      });
    }
  } catch (error) {
    if (isMissingConversationError(error)) {
      history = { hasMore: false, boundary: "x_30_day_limit" };
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
        messages: persistedMessages,
        lastSyncAttemptAt: syncAttemptAt,
        // A 404 means the provider has no legacy DM history for this
        // conversation. Do not advance the successful-sync timestamp.
        history,
      });
    } else {
      const failure = getXExecutionFailure(error);
      if (failure.classification === "rate_limited") {
        const nextSyncAllowedAt =
          getCurrentUTCTimestamp() + DM_PANEL_RATE_LIMIT_RETRY_MS;
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
          messages: persistedMessages,
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
              "Live refresh is temporarily limited on X/Twitter. Showing last synced messages.",
            retryAfterMs: DM_PANEL_RATE_LIMIT_RETRY_MS,
          },
        };
      }
      throw error;
    }
  }

  return {
    ...args.baseContext,
    conversationId,
    participantUserId: profileUserId,
    participantUsername:
      profile.username ??
      profile.screen_name ??
      args.baseContext.participantUsername,
    eligibility,
    messages: panelMessages,
    history,
    warning: args.activitySubscriptionsEnsured
      ? undefined
      : (args.baseContext.warning ?? {
          code: "activity_degraded",
          message:
            "Realtime X/Twitter DM updates are temporarily degraded. Live history reads still work, but new messages may arrive late.",
        }),
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
    historyCursor?: string;
    historySinceMs?: number;
    historyLimit?: number;
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
  const resolvedCachedMessages = await resolveDmMessageUrls(
    baseContext.messages
  );
  const resolvedCachedBaseContext =
    resolvedCachedMessages === baseContext.messages
      ? baseContext
      : {
          ...baseContext,
          messages: resolvedCachedMessages,
        };

  // Older cached events can no longer be re-fetched from X after its legacy
  // history window expires. Persist a successful bounded URL expansion once so
  // reopening a fresh panel never regresses to a t.co-only message body.
  if (
    resolvedCachedMessages !== baseContext.messages &&
    resolvedCachedBaseContext.conversationId
  ) {
    try {
      await persistDmConversationSnapshot(ctx, {
        userId,
        prospect,
        conversationId: resolvedCachedBaseContext.conversationId,
        participantUserId:
          resolvedCachedBaseContext.participantUserId ??
          cachedSnapshot?.conversation?.participantUserId,
        participantUsername:
          resolvedCachedBaseContext.participantUsername ??
          cachedSnapshot?.conversation?.participantUsername,
        participantName: cachedSnapshot?.conversation?.participantName,
        participantAvatarUrl:
          cachedSnapshot?.conversation?.participantAvatarUrl,
        participantVerified: cachedSnapshot?.conversation?.participantVerified,
        eligibility: resolvedCachedBaseContext.eligibility,
        messages: resolvedCachedMessages,
      });
    } catch (error) {
      logger.warn("Unable to persist resolved cached X/Twitter DM URLs", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        prospectId,
      });
    }
  }

  if (!prospectIdentity.username || !connectionStatus.xUserId) {
    return resolvedCachedBaseContext;
  }
  if (
    !connectionStatus.isConnected ||
    (connectionStatus.missingScopes ?? []).some(
      (scope) => scope === "dm.read" || scope === "dm.write"
    )
  ) {
    return resolvedCachedBaseContext;
  }
  const dmSubscriptions = await ctx.runAction(
    internal.xActivity.ensureDmActivitySubscriptionsForUserInternal,
    { userId }
  );
  const resolvedBaseContext = dmSubscriptions.ensured
    ? resolvedCachedBaseContext.warning?.code === "activity_degraded"
      ? { ...resolvedCachedBaseContext, warning: undefined }
      : resolvedCachedBaseContext
    : {
        ...resolvedCachedBaseContext,
        warning: resolvedCachedBaseContext.warning ?? {
          code: "activity_degraded" as const,
          message:
            "Realtime X/Twitter DM updates are temporarily degraded. Live history reads still work, but new messages may arrive late.",
        },
      };
  const isExplicitHistoryPage =
    typeof options?.historyCursor === "string" ||
    typeof options?.historySinceMs === "number";
  if (!isExplicitHistoryPage && !shouldPerformLiveDmSync(cachedSnapshot)) {
    return resolvedBaseContext;
  }

  try {
    return await syncProspectDmConversationForUser(ctx, {
      userId,
      prospect,
      prospectIdentity,
      connectionStatus,
      baseContext: resolvedBaseContext,
      historyCursor: options?.historyCursor,
      historySinceMs: options?.historySinceMs,
      historyLimit: options?.historyLimit,
      activitySubscriptionsEnsured: dmSubscriptions.ensured,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Unable to refresh X/Twitter DM panel context", {
      error: message,
      userId,
      prospectId,
    });
    if (resolvedBaseContext.conversationId) {
      try {
        await persistDmConversationSnapshot(ctx, {
          userId,
          prospect,
          conversationId: resolvedBaseContext.conversationId,
          participantUserId: resolvedBaseContext.participantUserId,
          participantUsername: resolvedBaseContext.participantUsername,
          eligibility: resolvedBaseContext.eligibility,
          messages: resolvedBaseContext.messages,
          lastSyncAttemptAt: getCurrentUTCTimestamp(),
          lastSyncErrorCode: "provider_error",
          lastSyncErrorMessage: message,
        });
      } catch (persistError) {
        logger.warn("Unable to persist X/Twitter DM refresh failure", {
          error:
            persistError instanceof Error
              ? persistError.message
              : String(persistError),
          userId,
          prospectId,
        });
      }
    }
    return {
      ...resolvedBaseContext,
      warning: {
        code: "provider_error",
        message:
          "Live X/Twitter DM history could not be refreshed. Showing last synced messages.",
      },
    };
  }
}

/**
 * Fetch exactly one bounded X/Twitter provider page for an owned prospect.
 * The opaque cursor is scoped to the resolved one-to-one conversation; callers
 * never supply a conversation id directly.
 */
async function getProspectXDmHistoryPageForUser(
  ctx: any,
  userId: Id<"users">,
  prospectId: Id<"prospects">,
  args: {
    cursor?: string;
    limit?: number;
    sinceMs?: number;
  }
) {
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
  if (
    !prospectIdentity.username ||
    !connectionStatus.xUserId ||
    !connectionStatus.isConnected ||
    (connectionStatus.missingScopes ?? []).some((scope) => scope === "dm.read")
  ) {
    return null;
  }

  // Every DM read is also a recovery opportunity. The ensure action is
  // idempotent and only performs a remote reconciliation after its bounded
  // verification window expires.
  await ctx.runAction(
    internal.xActivity.ensureDmActivitySubscriptionsForUserInternal,
    { userId }
  );

  const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
    userId,
    requiredScopes: ["tweet.read", "users.read", "dm.read"],
  });
  const { profileUserId, profile } = await getHydratedProfileByUsername(
    provider,
    prospectIdentity.username
  );
  const conversationId = computeOneToOneDmConversationId(
    connectionStatus.xUserId,
    profileUserId
  );
  const page = await loadXDmConversationHistoryPage({
    provider,
    conversationId,
    cursor: args.cursor,
    limit: args.limit,
    sinceMs: args.sinceMs,
  });
  const eligibility = buildDmEligibility({
    isConnected: connectionStatus.isConnected,
    missingScopes: connectionStatus.missingScopes,
    receivesYourDm: profile.can_dm,
    conversationId,
  });
  if (shouldPersistRecentConversationHistoryPage(args)) {
    await persistDmConversationSnapshot(ctx, {
      userId,
      prospect,
      conversationId,
      participantUserId: profileUserId,
      participantUsername: profile.username ?? profile.screen_name,
      participantName: profile.name,
      participantAvatarUrl: profile.profile_image_url_https,
      participantVerified: profile.verified,
      eligibility,
      messages: page.messages,
      lastSyncAttemptAt: getCurrentUTCTimestamp(),
      lastSyncSuccessAt: getCurrentUTCTimestamp(),
      history: page.history,
      historyOldestLoadedAt: page.oldestLoadedAt,
    });
  }

  return {
    conversationId,
    messages: page.messages,
    history: page.history,
  };
}

/**
 * XChat is separate from legacy DMs. It returns only encrypted-envelope
 * metadata so callers can reason about live coverage without treating
 * ciphertext as readable conversation text.
 */
async function getProspectXChatHistoryEvidenceForUser(
  ctx: any,
  userId: Id<"users">,
  prospectId: Id<"prospects">,
  args: {
    limit?: number;
    sinceMs?: number;
  }
) {
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
  if (
    !prospectIdentity.username ||
    !connectionStatus.xUserId ||
    !connectionStatus.isConnected ||
    (connectionStatus.missingScopes ?? []).some((scope) => scope === "dm.read")
  ) {
    return null;
  }

  await ctx.runAction(
    internal.xActivity.ensureDmActivitySubscriptionsForUserInternal,
    { userId }
  );

  const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
    userId,
    requiredScopes: ["tweet.read", "users.read", "dm.read"],
  });
  const { profileUserId } = await getHydratedProfileByUsername(
    provider,
    prospectIdentity.username
  );

  return await getXChatConversationHistoryEvidence(provider, profileUserId, {
    limit: args.limit ?? AGENT_PROVIDER_HISTORY_PAGE_SIZE,
    maxPages: getAgentProviderHistoryPageBudget(args.sinceMs),
    sinceMs: args.sinceMs,
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
      logger.warn(
        "[X/Twitter] Failed to hydrate commented viewer state.",
        error
      );
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

  return formatXWriteActionError(error);
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
    await ctx.scheduler.runAfter(
      0,
      internal.outreachRecovery.ensureTwitterManualReplyRecoveryForUserInternal,
      { userId }
    );
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
      await ctx.scheduler.runAfter(
        0,
        internal.xActivity.ensureDmActivitySubscriptionsForUserInternal,
        { userId }
      );
    }
    await ctx.scheduler.runAfter(
      0,
      internal.outreachRecovery.ensureTwitterManualReplyRecoveryForUserInternal,
      { userId }
    );

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
    await ctx.scheduler.runAfter(
      0,
      internal.outreachRecovery.ensureTwitterManualReplyRecoveryForUserInternal,
      { userId }
    );
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
        title: "Reply sent on X/Twitter",
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
        title: "DM sent on X/Twitter",
        message: args.text.trim(),
        actionId: String(getCurrentUTCTimestamp()),
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

/** Refresh and persist the real X/Twitter DM conversation for an agent read. */
export const refreshProspectDmConversationInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    const panelContext = await resolveProspectDmPanelContext(
      ctx,
      args.userId,
      args.prospectId
    );
    if (!panelContext) {
      return null;
    }

    return {
      conversationId: panelContext.conversationId,
      messageCount: panelContext.messages.length,
      latestMessageAt:
        panelContext.messages.length > 0
          ? panelContext.messages[panelContext.messages.length - 1]?.createdAt
          : undefined,
      warning: panelContext.warning?.message,
    };
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
  const page = await loadXDmConversationHistoryPage({
    provider,
    conversationId,
  });
  const messages = page.messages;
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
        history: page.history,
        historyOldestLoadedAt: page.oldestLoadedAt,
      });
    }
  }
  return {
    conversationId,
    messages,
    history: page.history,
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

/**
 * Return one bounded X/Twitter provider page. `cursor` is the opaque value
 * returned by the prior panel/page response; messages are chronological.
 */
export const getDmConversationHistoryPage = action({
  args: {
    prospectId: v.id("prospects"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    sinceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    return await getProspectXDmHistoryPageForUser(
      ctx,
      userId,
      args.prospectId,
      {
        cursor: args.cursor,
        limit: args.limit,
        sinceMs: args.sinceMs,
      }
    );
  },
});

/** Same page contract for trusted agent/workflow callers. */
export const getDmConversationHistoryPageInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    sinceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await getProspectXDmHistoryPageForUser(
      ctx,
      args.userId,
      args.prospectId,
      {
        cursor: args.cursor,
        limit: args.limit,
        sinceMs: args.sinceMs,
      }
    );
  },
});

/**
 * Trusted Agent/workflow read for XChat encrypted-envelope metadata. This is
 * intentionally not public and never returns ciphertext or plaintext.
 */
export const getXChatConversationHistoryEvidenceInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    limit: v.optional(v.number()),
    sinceMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), xChatConversationHistoryEvidenceValidator),
  handler: async (ctx, args) => {
    return await getProspectXChatHistoryEvidenceForUser(
      ctx,
      args.userId,
      args.prospectId,
      {
        limit: args.limit,
        sinceMs: args.sinceMs,
      }
    );
  },
});

/**
 * Browser-only XChat decrypt input for an authenticated, owned prospect. The
 * response contains ciphertext and public verification material, never a PIN,
 * realm auth token, private key, or plaintext.
 */
export const getXChatDecryptBundle = action({
  args: {
    prospectId: v.id("prospects"),
  },
  returns: xChatBrowserDecryptBundleValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const prospect = await getOwnedTwitterProspectForUser(
      ctx,
      userId,
      args.prospectId
    );
    if (!prospect) {
      throw new Error("X prospect not found or not authorized.");
    }
    const identity = resolveProspectTwitterIdentity(
      prospect as Record<string, unknown>
    );
    if (!identity.username) {
      throw new Error("This prospect does not have a usable X username.");
    }
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: ["tweet.read", "users.read", "dm.read"],
    });
    const { profileUserId } = await getHydratedProfileByUsername(
      provider,
      identity.username
    );
    try {
      return await getXChatBrowserDecryptBundle(provider, profileUserId);
    } catch (error) {
      if (
        error instanceof XChatProviderRequestError &&
        error.details.code === "xchat_access_denied"
      ) {
        return {
          availability: "blocked" as const,
          reason: "xchat_access_denied" as const,
        };
      }
      throwXChatClientRequestError(error);
    }
  },
});

/**
 * Fetch exactly one encrypted page. An empty cursor rechecks the newest page;
 * a provider cursor walks backward one page. Public keys are not re-fetched.
 */
export const getXChatEventPage = action({
  args: {
    prospectId: v.id("prospects"),
    cursor: v.optional(v.string()),
  },
  returns: xChatEventPageValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const prospect = await getOwnedTwitterProspectForUser(
      ctx,
      userId,
      args.prospectId
    );
    if (!prospect) {
      throw new Error("X prospect not found or not authorized.");
    }
    const identity = resolveProspectTwitterIdentity(
      prospect as Record<string, unknown>
    );
    if (!identity.username) {
      throw new Error("This prospect does not have a usable X username.");
    }
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: ["tweet.read", "users.read", "dm.read"],
    });
    const { profileUserId } = await getHydratedProfileByUsername(
      provider,
      identity.username
    );
    return await runXChatClientRequest(() =>
      getXChatEncryptedEventPage(
        provider,
        profileUserId,
        args.cursor?.trim() || undefined
      )
    );
  },
});

/**
 * Move browser-encrypted XChat media ciphertext from temporary Convex storage
 * into X's encrypted media store. Plain media bytes never cross this boundary.
 */
export const uploadXChatEncryptedMedia = action({
  args: {
    prospectId: v.id("prospects"),
    conversationId: v.string(),
    storageId: v.id("_storage"),
  },
  returns: xChatEncryptedMediaUploadResultValidator,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    try {
      const prospect = await getOwnedTwitterProspectForUser(
        ctx,
        userId,
        args.prospectId
      );
      if (!prospect) {
        throw new Error("X prospect not found or not authorized.");
      }
      const identity = resolveProspectTwitterIdentity(
        prospect as Record<string, unknown>
      );
      if (!identity.username) {
        throw new Error("This prospect does not have a usable X username.");
      }
      const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
        userId,
        requiredScopes: [
          "tweet.read",
          "users.read",
          "dm.read",
          "dm.write",
          "media.write",
        ],
      });
      const { profileUserId } = await getHydratedProfileByUsername(
        provider,
        identity.username
      );
      const expectedConversationId = computeOneToOneDmConversationId(
        provider.xUserId,
        profileUserId
      );
      const suppliedConversationId = args.conversationId
        .trim()
        .replaceAll(":", "-");
      if (suppliedConversationId !== expectedConversationId) {
        throw new Error("XChat conversation does not match this prospect.");
      }

      const blob = await ctx.storage.get(args.storageId);
      if (!blob || blob.size <= 0 || blob.size > 100 * 1024 * 1024) {
        throw new Error("Encrypted XChat media must be between 1 byte and 100 MB.");
      }
      const ciphertext = new Uint8Array(await blob.arrayBuffer());
      try {
        const mediaHashKey = await runXChatClientRequest(() =>
          uploadEncryptedXChatMedia(
            provider,
            expectedConversationId,
            ciphertext
          )
        );
        return { mediaHashKey };
      } finally {
        ciphertext.fill(0);
      }
    } finally {
      await ctx.runMutation(
        internal.xChatSendOperations.deleteTemporaryEncryptedMediaInternal,
        { storageId: args.storageId }
      );
    }
  },
});

/**
 * Submit the opaque, signed payload produced by chat-xdk in the unlocked
 * browser. Plaintext, PINs, conversation keys, and private keys are forbidden
 * from this server boundary.
 */
export const submitXChatEncryptedMessage = action({
  args: {
    prospectId: v.id("prospects"),
    clientRequestId: v.string(),
    conversationId: v.string(),
    messageId: v.string(),
    encodedMessageCreateEvent: v.string(),
    encodedMessageEventSignature: v.string(),
  },
  returns: xChatEncryptedSendResultValidator,
  handler: async (ctx, args): Promise<XChatEncryptedSendResult> => {
    const userId = await getCurrentUserId(ctx);
    const prospect = await getOwnedTwitterProspectForUser(
      ctx,
      userId,
      args.prospectId
    );
    if (!prospect) {
      throw new Error("X prospect not found or not authorized.");
    }
    const identity = resolveProspectTwitterIdentity(
      prospect as Record<string, unknown>
    );
    if (!identity.username) {
      throw new Error("This prospect does not have a usable X username.");
    }
    const suppliedConversationId = args.conversationId
      .trim()
      .replaceAll(":", "-");
    const payload = normalizeEncryptedXChatSendPayload(args);
    const existingOperation: XChatSendStoredOperation | null =
      await ctx.runQuery(
        internal.xChatSendOperations.getXChatSendOperationInternal,
        { userId, clientRequestId: payload.clientRequestId }
      );
    if (existingOperation?.status === "sent") {
      assertMatchingEncryptedXChatSendOperation(existingOperation, {
        ...payload,
        prospectId: args.prospectId,
        conversationId: suppliedConversationId,
      });
      return {
        success: true as const,
        conversationId: existingOperation.conversationId,
        messageId: existingOperation.messageId,
        deduplicated: true,
      };
    }

    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: ["tweet.read", "users.read", "dm.write"],
    });
    const { profileUserId } = await getHydratedProfileByUsername(
      provider,
      identity.username
    );
    const expectedConversationId = computeOneToOneDmConversationId(
      provider.xUserId,
      profileUserId
    );
    if (suppliedConversationId !== expectedConversationId) {
      throw new Error("XChat conversation does not match this prospect.");
    }

    const leaseId = globalThis.crypto.randomUUID();
    const now = getCurrentUTCTimestamp();
    const lease: XChatSendLeaseResult = await ctx.runMutation(
      internal.xChatSendOperations.acquireXChatSendLeaseInternal,
      {
        userId,
        prospectId: args.prospectId,
        clientRequestId: payload.clientRequestId,
        conversationId: expectedConversationId,
        messageId: payload.messageId,
        encodedMessageCreateEvent: payload.encodedMessageCreateEvent,
        encodedMessageEventSignature: payload.encodedMessageEventSignature,
        leaseId,
        now,
      }
    );
    if (lease.kind === "sent") {
      return {
        success: true as const,
        conversationId: expectedConversationId,
        messageId: lease.messageId,
        deduplicated: true,
      };
    }
    if (lease.kind === "in_progress") {
      throw new ConvexError({
        code: "XCHAT_SEND_IN_PROGRESS",
        message: "This encrypted XChat message is already being sent.",
        retryAt: lease.retryAt,
      });
    }

    if (
      lease.existed &&
      (await runXChatClientRequest(() =>
        hasXChatEncryptedMessage(provider, profileUserId, lease.messageId)
      ))
    ) {
      await ctx.runMutation(
        internal.xChatSendOperations.markXChatSendSentInternal,
        {
          operationId: lease.operationId,
          expectedMessageId: lease.messageId,
          now: getCurrentUTCTimestamp(),
        }
      );
      return {
        success: true as const,
        conversationId: expectedConversationId,
        messageId: lease.messageId,
        deduplicated: true,
      };
    }

    try {
      await submitEncryptedXChatMessage(provider, expectedConversationId, {
        messageId: lease.messageId,
        encodedMessageCreateEvent: lease.encodedMessageCreateEvent,
        encodedMessageEventSignature: lease.encodedMessageEventSignature,
      });
    } catch (sendError) {
      let providerHasMessage = false;
      try {
        providerHasMessage = await hasXChatEncryptedMessage(
          provider,
          profileUserId,
          lease.messageId
        );
      } catch {
        // The exact same SDK message ID and encrypted payload remain persisted;
        // a later retry can safely re-confirm or replay them.
      }
      if (providerHasMessage) {
        await ctx.runMutation(
          internal.xChatSendOperations.markXChatSendSentInternal,
          {
            operationId: lease.operationId,
            expectedMessageId: lease.messageId,
            now: getCurrentUTCTimestamp(),
          }
        );
        return {
          success: true as const,
          conversationId: expectedConversationId,
          messageId: lease.messageId,
          deduplicated: true,
        };
      }
      await ctx.runMutation(
        internal.xChatSendOperations.releaseXChatSendLeaseInternal,
        {
          operationId: lease.operationId,
          leaseId,
          now: getCurrentUTCTimestamp(),
        }
      );
      return await runXChatClientRequest(async () => {
        throw sendError;
      });
    }

    await ctx.runMutation(
      internal.xChatSendOperations.markXChatSendSentInternal,
      {
        operationId: lease.operationId,
        expectedMessageId: lease.messageId,
        now: getCurrentUTCTimestamp(),
      }
    );
    return {
      success: true as const,
      conversationId: expectedConversationId,
      messageId: lease.messageId,
      deduplicated: lease.existed,
    };
  },
});

/**
 * Return one encrypted XChat attachment for an authenticated prospect through
 * a short-lived storage URL. The browser pairs it with the already-unlocked
 * conversation key and keeps the resulting plaintext in a revocable object URL.
 */
export const getXChatEncryptedMedia = action({
  args: {
    prospectId: v.id("prospects"),
    mediaHashKey: v.string(),
  },
  returns: xChatEncryptedMediaValidator,
  handler: async (ctx, args): Promise<XChatEncryptedMediaResult> => {
    const userId = await getCurrentUserId(ctx);
    const prospect = await getOwnedTwitterProspectForUser(
      ctx,
      userId,
      args.prospectId
    );
    if (!prospect) {
      throw new Error("X prospect not found or not authorized.");
    }
    const identity = resolveProspectTwitterIdentity(
      prospect as Record<string, unknown>
    );
    if (!identity.username) {
      throw new Error("This prospect does not have a usable X username.");
    }
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: ["tweet.read", "users.read", "dm.read"],
    });
    const { profileUserId } = await getHydratedProfileByUsername(
      provider,
      identity.username
    );
    const conversationId = computeOneToOneDmConversationId(
      provider.xUserId,
      profileUserId
    );
    const cacheKey = buildPlatformConversationMediaCacheKey({
      platform: "twitter",
      conversationId,
      attachmentId: args.mediaHashKey,
    });
    const now = getCurrentUTCTimestamp();
    const cached: {
      storageId: Id<"_storage">;
      size: number;
      expiresAt: number;
    } | null = await ctx.runQuery(
      internal.platformConversationMedia.getCachedMediaInternal,
      { userId, cacheKey, now }
    );
    if (cached) {
      const url: string | null = await ctx.storage.getUrl(cached.storageId);
      if (url) {
        return {
          availability: "available",
          url,
          size: cached.size,
          expiresAt: cached.expiresAt,
        };
      }
    }

    let ciphertext: Blob;
    try {
      ciphertext = await fetchXChatEncryptedMedia(
        provider,
        conversationId,
        args.mediaHashKey
      );
    } catch (error) {
      if (
        error instanceof XChatProviderRequestError &&
        error.details.status === 404
      ) {
        return { availability: "unavailable", reason: "not_found" };
      }
      throwXChatClientRequestError(error);
    }
    assertCacheableProviderMedia({ size: ciphertext.size });
    const storageId = await ctx.storage.store(ciphertext);
    const expiresAt = now + PLATFORM_CONVERSATION_MEDIA_CACHE_TTL_MS;
    let stored: {
      storageId: Id<"_storage">;
      size: number;
      expiresAt: number;
    };
    try {
      stored = await ctx.runMutation(
        internal.platformConversationMedia.storeCachedMediaInternal,
        {
          userId,
          prospectId: args.prospectId,
          platform: "twitter",
          conversationId,
          cacheKey,
          attachmentId: args.mediaHashKey.trim(),
          storageId,
          contentType: "application/octet-stream",
          size: ciphertext.size,
          encrypted: true,
          expiresAt,
        }
      );
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    const url: string | null = await ctx.storage.getUrl(stored.storageId);
    if (!url) {
      throw new Error("XChat encrypted media cache URL is unavailable.");
    }
    return {
      availability: "available",
      url,
      size: stored.size,
      expiresAt: stored.expiresAt,
    };
  },
});

/** Mint/fetch one Juicebox realm token only when browser WASM requests it. */
export const getXChatRealmAuthToken = action({
  args: {
    realmId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const provider = await getXProviderContextForUser(ctx, getXStoreRefs(), {
      userId,
      requiredScopes: ["tweet.read", "users.read", "dm.read"],
    });
    return await runXChatClientRequest(() =>
      getXChatRealmAuthTokenForUser(provider, args.realmId)
    );
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
    throw new Error("X/Twitter DMs support exactly one media attachment.");
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
            completedAt: getCurrentUTCTimestamp(),
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
          message: trimmedText || "X/Twitter DM sent.",
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
        description: "Sent a DM on X/Twitter.",
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
    /** When true, runs expensive X/Twitter list-pagination for like/bookmark/follow state. Default false. */
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
        fetchedAt: getCurrentUTCTimestamp(),
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
      fetchedAt: getCurrentUTCTimestamp(),
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
      return { tweet: null, fetchedAt: getCurrentUTCTimestamp() };
    }

    const hydrated = includeViewerState
      ? ((await attachViewerStateToTweets(ctx, userId, [tweet]))[0] ?? tweet)
      : tweet;

    return {
      tweet: hydrated,
      fetchedAt: getCurrentUTCTimestamp(),
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

export const getTwitterConnectionIdentityInternal = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const status = await getXConnectionStatusForUser(
      ctx,
      internal.xStore,
      args.userId
    );
    return {
      isConnected: status.isConnected,
      xUserId: status.xUserId,
      screenName: status.screenName,
      name: status.name,
    };
  },
});

export const getHydratedTwitterPostsByIds = action({
  args: {
    tweetIds: v.array(v.string()),
    /** When true, runs expensive X/Twitter list-pagination for viewer state. Default false. */
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
      fetchedAt: getCurrentUTCTimestamp(),
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
