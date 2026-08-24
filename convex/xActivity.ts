"use node";

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { internalAction } from "./lib/functionBuilders";
import {
  X_DM_ACTIVITY_EVENT_TYPES,
  X_DM_MESSAGE_ACTIVITY_EVENT_TYPES,
  X_POST_ACTIVITY_EVENT_TYPES,
  createXActivitySubscription,
  createXWebhook,
  getXWebhookCallbackUrl,
  listXActivitySubscriptions,
  listXWebhooks,
  normalizeXActivityEventType,
  updateXActivitySubscription,
  type XActivityEventType,
  type XDmMessageActivityEventType,
  validateXWebhook,
} from "./lib/xActivity";
import {
  findXWebhookForEnvironment,
  findMatchingXActivitySubscription,
  getXActivitySubscriptionHealth,
  isDuplicateXActivitySubscriptionError,
} from "./lib/xActivityReconciliationCore";
import {
  extractActivityCreatedPost,
  matchesTwitterManualReplyRecovery,
} from "./lib/outreachRecoveryCore";
import { normalizeDmMessages, resolveDmMessageUrls } from "./lib/xDm";
import { decryptXSecret } from "./lib/xdkCrypto";
import { getXProviderContextForUser } from "./lib/xdkAuth";
import { getDmEventsByConversationId } from "./lib/xdkTwitterProvider";
import { normalizeXChatConversationId } from "./lib/xChatMediaCore";
import { normalizeXTypingActivityPayload } from "./lib/xActivityTypingCore";
import {
  getCurrentUTCTimestamp,
  parseIsoToTimestamp,
} from "../shared/lib/utils/time/timeUtils";

const ACTIVITY_ENSURE_SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const ACTIVITY_ENSURE_RETRY_MS = 15 * 60 * 1000;
const ACTIVITY_ENSURE_RATE_LIMIT_RETRY_MS = 5 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractFilteredUserId(
  event: Record<string, unknown>
): string | undefined {
  const filter = asRecord(event.filter);
  return asString(filter?.user_id) ?? asString(filter?.userId);
}

function extractConversationId(
  payload: Record<string, unknown>
): string | undefined {
  const message = asRecord(payload.message);
  const event = asRecord(payload.event);
  const conversation = asRecord(payload.conversation);
  return (
    asString(payload.dm_conversation_id) ??
    asString(payload.dmConversationId) ??
    asString(message?.dm_conversation_id) ??
    asString(message?.dmConversationId) ??
    asString(payload.conversation_id) ??
    asString(payload.conversationId) ??
    asString(payload.chat_id) ??
    asString(payload.chatId) ??
    asString(message?.conversation_id) ??
    asString(message?.conversationId) ??
    asString(message?.chat_id) ??
    asString(message?.chatId) ??
    asString(event?.conversation_id) ??
    asString(event?.conversationId) ??
    asString(conversation?.id)
  );
}

function extractMessageId(
  payload: Record<string, unknown>
): string | undefined {
  const message = asRecord(payload.message);
  const event = asRecord(payload.event);
  return (
    asString(payload.id) ??
    asString(payload.message_id) ??
    asString(payload.messageId) ??
    asString(payload.event_id) ??
    asString(payload.eventId) ??
    asString(message?.id) ??
    asString(message?.message_id) ??
    asString(message?.messageId) ??
    asString(event?.id) ??
    asString(event?.message_id) ??
    asString(event?.messageId)
  );
}

function extractEncodedEvent(
  payload: Record<string, unknown>
): string | undefined {
  const message = asRecord(payload.message);
  const event = asRecord(payload.event);
  return (
    asString(payload.encoded_event) ??
    asString(payload.encodedEvent) ??
    asString(message?.encoded_event) ??
    asString(message?.encodedEvent) ??
    asString(event?.encoded_event) ??
    asString(event?.encodedEvent)
  );
}

function extractMessageText(
  payload: Record<string, unknown>
): string | undefined {
  const message = asRecord(payload.message);
  return asString(payload.text) ?? asString(message?.text);
}

function extractMessageCreatedAt(
  payload: Record<string, unknown>
): string | undefined {
  const message = asRecord(payload.message);
  return (
    asString(payload.created_at) ??
    asString(payload.createdAt) ??
    asString(payload.timestamp) ??
    asString(message?.created_at) ??
    asString(message?.createdAt) ??
    asString(message?.timestamp)
  );
}

function extractSenderUserId(
  payload: Record<string, unknown>
): string | undefined {
  const message = asRecord(payload.message);
  const sender = asRecord(payload.sender);
  return (
    asString(payload.sender_id) ??
    asString(payload.senderId) ??
    asString(message?.sender_id) ??
    asString(message?.senderId) ??
    asString(sender?.id) ??
    asString(sender?.user_id) ??
    asString(sender?.userId)
  );
}

type NormalizedDmActivityEvent = {
  kind: "dm";
  eventType: XDmMessageActivityEventType;
  filteredUserId?: string;
  subscriptionId?: string;
  conversationId?: string;
  messageId?: string;
  text?: string;
  createdAt?: string;
  senderUserId?: string;
  encodedEvent?: string;
  payload: Record<string, unknown>;
};

type NormalizedTypingActivityEvent = {
  kind: "typing";
  eventType: "dm.indicate_typing";
  filteredUserId?: string;
  subscriptionId?: string;
  conversationId?: string;
  senderUserId: string;
};

type NormalizedPostActivityEvent = {
  kind: "post";
  eventType: "post.create";
  filteredUserId?: string;
  subscriptionId?: string;
  envelope: Record<string, unknown>;
};

function normalizeWebhookEvents(
  payload: unknown
): Array<
  | NormalizedDmActivityEvent
  | NormalizedTypingActivityEvent
  | NormalizedPostActivityEvent
> {
  const root = asRecord(payload);
  const entries = Array.isArray(root?.data)
    ? root?.data
    : root?.data
      ? [root.data]
      : [payload];

  const normalized: Array<
    | NormalizedDmActivityEvent
    | NormalizedTypingActivityEvent
    | NormalizedPostActivityEvent
  > = [];

  for (const entry of entries) {
    const envelope = asRecord(entry);
    if (!envelope) {
      continue;
    }
    const rawEventType =
      asString(envelope.event_type) ?? asString(envelope.eventType);
    if (!rawEventType) {
      continue;
    }
    const eventType = normalizeXActivityEventType(rawEventType);
    if (!eventType) {
      continue;
    }

    if (eventType === "post.create") {
      normalized.push({
        kind: "post",
        eventType: "post.create",
        filteredUserId: extractFilteredUserId(envelope),
        subscriptionId:
          asString(envelope.subscription_id) ??
          asString(envelope.subscriptionId),
        envelope,
      });
      continue;
    }

    const normalizedPayload = asRecord(envelope.payload) ?? envelope;
    if (eventType === "dm.indicate_typing") {
      const typing = normalizeXTypingActivityPayload(normalizedPayload);
      if (!typing) {
        continue;
      }
      normalized.push({
        kind: "typing",
        eventType,
        filteredUserId:
          extractFilteredUserId(envelope) ?? typing.recipientUserId,
        subscriptionId:
          asString(envelope.subscription_id) ??
          asString(envelope.subscriptionId),
        conversationId: extractConversationId(normalizedPayload),
        senderUserId: typing.senderUserId,
      });
      continue;
    }

    if (
      !X_DM_MESSAGE_ACTIVITY_EVENT_TYPES.includes(
        eventType as XDmMessageActivityEventType
      )
    ) {
      continue;
    }
    const conversationId = extractConversationId(normalizedPayload);
    normalized.push({
      kind: "dm",
      eventType: eventType as XDmMessageActivityEventType,
      filteredUserId: extractFilteredUserId(envelope),
      subscriptionId:
        asString(envelope.subscription_id) ?? asString(envelope.subscriptionId),
      conversationId:
        conversationId && eventType.startsWith("chat.")
          ? normalizeXChatConversationId(conversationId)
          : conversationId,
      messageId: extractMessageId(normalizedPayload),
      text: extractMessageText(normalizedPayload),
      createdAt: extractMessageCreatedAt(normalizedPayload),
      senderUserId: extractSenderUserId(normalizedPayload),
      encodedEvent: extractEncodedEvent(normalizedPayload),
      payload: normalizedPayload,
    });
  }

  return normalized;
}

function normalizeActivityDmMessage(event: NormalizedDmActivityEvent) {
  const nestedMessage = asRecord(event.payload.message);
  const data = {
    ...event.payload,
    ...nestedMessage,
    id: event.messageId ?? nestedMessage?.id ?? event.payload.id,
    dm_conversation_id:
      event.conversationId ??
      nestedMessage?.dm_conversation_id ??
      event.payload.dm_conversation_id,
    sender_id:
      event.senderUserId ?? nestedMessage?.sender_id ?? event.payload.sender_id,
    created_at:
      event.createdAt ?? nestedMessage?.created_at ?? event.payload.created_at,
    text: event.text ?? nestedMessage?.text ?? event.payload.text,
  };
  return normalizeDmMessages(
    { ...event.payload, data: [data] },
    event.filteredUserId
  )[0];
}

function toStoredSeenBy(
  seenBy: ReturnType<typeof normalizeActivityDmMessage>["seenBy"]
) {
  return seenBy?.map((receipt) => ({
    userId: receipt.userId,
    attendeeId: receipt.attendeeId,
    senderName: receipt.senderName,
    seenAt: receipt.seenAt ? parseIsoToTimestamp(receipt.seenAt) : undefined,
  }));
}

async function resolveUserIdForEvent(
  ctx: ActionCtx,
  args: {
    filteredUserId?: string;
    subscriptionId?: string;
  }
): Promise<Id<"users"> | null> {
  if (args.subscriptionId) {
    const subscription = await ctx.runQuery(
      internal.platformConversations.getXActivitySubscriptionByIdInternal,
      {
        subscriptionId: args.subscriptionId,
      }
    );
    if (subscription) {
      return subscription.userId;
    }
  }

  if (!args.filteredUserId) {
    return null;
  }

  const account = await ctx.runQuery(
    internal.xStore.getXAccountByXUserIdInternal,
    {
      xUserId: args.filteredUserId,
    }
  );
  return account?.userId ?? null;
}

async function syncConversationSnapshot(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    conversationId: string;
    sourceEventType?: XDmMessageActivityEventType;
  }
) {
  const existingConversation = await ctx.runQuery(
    internal.platformConversations
      .getConversationByUserAndConversationIdInternal,
    {
      userId: args.userId,
      conversationId: args.conversationId,
    }
  );

  const provider = await getXProviderContextForUser(ctx, internal.xStore, {
    userId: args.userId,
    requiredScopes: ["tweet.read", "users.read", "dm.read"],
  });
  const response = await getDmEventsByConversationId(
    provider,
    args.conversationId,
    {
      maxResults: 25,
    }
  );
  const messages = await resolveDmMessageUrls(
    normalizeDmMessages(response, provider.xUserId)
  );
  const participant =
    messages
      .filter((message) => message.senderUserId !== provider.xUserId)
      .map((message) => message.sender)
      .find(Boolean) ?? null;

  await ctx.runMutation(
    internal.platformConversations.upsertConversationSnapshotInternal,
    {
      userId: args.userId,
      workspaceId: existingConversation?.workspaceId,
      prospectId: existingConversation?.prospectId,
      platform: "twitter",
      conversationId: args.conversationId,
      participantUserId:
        existingConversation?.participantUserId ?? participant?.userId,
      participantUsername:
        existingConversation?.participantUsername ?? participant?.username,
      participantName:
        existingConversation?.participantName ?? participant?.name,
      participantAvatarUrl:
        existingConversation?.participantAvatarUrl ?? participant?.avatarUrl,
      participantVerified:
        existingConversation?.participantVerified ?? participant?.verified,
      eligibilityEnabled: existingConversation?.eligibilityEnabled,
      eligibilityReasonCode: existingConversation?.eligibilityReasonCode,
      eligibilityReasonLabel: existingConversation?.eligibilityReasonLabel,
      lastSyncedAt: getCurrentUTCTimestamp(),
      messages: messages.map((message) => ({
        messageId: message.id,
        direction: message.direction,
        senderUserId: message.senderUserId,
        text: message.text,
        createdAt: message.createdAt,
        createdAtMs: message.createdAt
          ? (parseIsoToTimestamp(message.createdAt) ?? 0)
          : 0,
        attachments: message.attachments,
        readAt: message.readAt
          ? parseIsoToTimestamp(message.readAt)
          : undefined,
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
        seenBy: toStoredSeenBy(message.seenBy),
        sourceEventType: args.sourceEventType,
        eventMetadata: message.eventMetadata,
      })),
    }
  );

  return {
    conversation: await ctx.runQuery(
      internal.platformConversations
        .getConversationByUserAndConversationIdInternal,
      {
        userId: args.userId,
        conversationId: args.conversationId,
      }
    ),
    messages,
  };
}

/**
 * Chat Activity events are encrypted and cannot be backfilled through the
 * legacy DM lookup endpoint. Persist their normalized payload directly. The
 * same fallback protects a just-delivered dm.* event from a provider read race.
 */
async function persistNormalizedDmActivityEvent(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    event: NormalizedDmActivityEvent;
  }
) {
  if (!args.event.conversationId) {
    return null;
  }

  const existingConversation = await ctx.runQuery(
    internal.platformConversations
      .getConversationByUserAndConversationIdInternal,
    {
      userId: args.userId,
      conversationId: args.event.conversationId,
    }
  );
  const now = getCurrentUTCTimestamp();
  const direction = args.event.eventType.endsWith(".sent")
    ? ("sent" as const)
    : ("received" as const);
  // X does not guarantee a timestamp on every Activity event. Preserve that
  // absence instead of manufacturing an ISO value; the numeric ingestion time
  // keeps the event chronologically addressable in the local cache.
  const createdAt = args.event.createdAt;
  const createdAtMs =
    (createdAt ? parseIsoToTimestamp(createdAt) : undefined) ?? now;
  const richMessage = normalizeActivityDmMessage(args.event);
  const messages = args.event.messageId
    ? [
        {
          messageId: args.event.messageId,
          direction,
          senderUserId: args.event.senderUserId ?? richMessage?.senderUserId,
          text: args.event.text ?? richMessage?.text,
          createdAt: createdAt ?? richMessage?.createdAt,
          createdAtMs,
          attachments: richMessage?.attachments,
          readAt: richMessage?.readAt
            ? parseIsoToTimestamp(richMessage.readAt)
            : undefined,
          deliveredAt: richMessage?.deliveredAt
            ? parseIsoToTimestamp(richMessage.deliveredAt)
            : undefined,
          quotedMessageId: richMessage?.quotedMessageId,
          quotedMessage: richMessage?.quotedMessage,
          sharedPost: richMessage?.sharedPost,
          reactions: richMessage?.reactions,
          editedAt: richMessage?.editedAt
            ? parseIsoToTimestamp(richMessage.editedAt)
            : undefined,
          deletedAt: richMessage?.deletedAt
            ? parseIsoToTimestamp(richMessage.deletedAt)
            : undefined,
          seenBy: toStoredSeenBy(richMessage?.seenBy),
          sourceEventType: args.event.eventType,
          eventMetadata: {
            ...richMessage?.eventMetadata,
            providerEventType: args.event.eventType,
            targetMessageId:
              richMessage?.eventMetadata?.targetMessageId ??
              args.event.messageId,
          },
        },
      ]
    : [];

  await ctx.runMutation(
    internal.platformConversations.upsertConversationSnapshotInternal,
    {
      userId: args.userId,
      workspaceId: existingConversation?.workspaceId,
      prospectId: existingConversation?.prospectId,
      platform: "twitter",
      conversationId: args.event.conversationId,
      participantUserId:
        existingConversation?.participantUserId ??
        (direction === "received" ? args.event.senderUserId : undefined),
      participantUsername: existingConversation?.participantUsername,
      participantName: existingConversation?.participantName,
      participantAvatarUrl: existingConversation?.participantAvatarUrl,
      participantVerified: existingConversation?.participantVerified,
      eligibilityEnabled: existingConversation?.eligibilityEnabled,
      eligibilityReasonCode: existingConversation?.eligibilityReasonCode,
      eligibilityReasonLabel: existingConversation?.eligibilityReasonLabel,
      messages,
    }
  );

  return await ctx.runQuery(
    internal.platformConversations
      .getConversationByUserAndConversationIdInternal,
    {
      userId: args.userId,
      conversationId: args.event.conversationId,
    }
  );
}

async function ensureWebhookAndSubscriptions(args: {
  ctx: ActionCtx;
  userId: Id<"users">;
  xUserId: string;
  eventTypes: readonly XActivityEventType[];
  userOAuthAccessToken?: string;
}): Promise<{ webhookId: string; authMode: "app" | "user" }> {
  const webhookUrl = getXWebhookCallbackUrl();
  const remoteWebhooks = await listXWebhooks();
  let webhook = findXWebhookForEnvironment(remoteWebhooks, webhookUrl);

  if (!webhook) {
    webhook = await createXWebhook(webhookUrl);
  }

  if (!webhook) {
    throw new Error(
      "No X/Twitter webhook is available for Activity subscriptions."
    );
  }

  if (!webhook.valid) {
    webhook = await validateXWebhook(webhook.id);
  }

  const now = getCurrentUTCTimestamp();
  await args.ctx.runMutation(
    internal.platformConversations.upsertXWebhookInternal,
    {
      webhookId: webhook.id,
      url: webhook.url,
      valid: webhook.valid,
      lastValidatedAt: now,
      lastError: undefined,
    }
  );

  let remoteSubscriptions = await listXActivitySubscriptions();
  let authMode: "app" | "user" = "app";
  for (const eventType of args.eventTypes) {
    const expectedTag = `reacherx:${args.userId}:${eventType}`;
    let subscription = findMatchingXActivitySubscription(remoteSubscriptions, {
      eventType,
      xUserId: args.xUserId,
      webhookId: webhook.id,
      expectedTag,
    });

    if (!subscription) {
      try {
        const created = await createXActivitySubscription({
          eventType,
          xUserId: args.xUserId,
          webhookId: webhook.id,
          tag: expectedTag,
          userOAuthAccessToken: args.userOAuthAccessToken,
        });
        subscription = created.subscription;
        authMode = created.authMode;
        remoteSubscriptions = [...remoteSubscriptions, subscription];
      } catch (error) {
        if (!isDuplicateXActivitySubscriptionError(error)) {
          throw error;
        }

        remoteSubscriptions = await listXActivitySubscriptions();
        subscription = findMatchingXActivitySubscription(remoteSubscriptions, {
          eventType,
          xUserId: args.xUserId,
          webhookId: webhook.id,
          expectedTag,
        });

        if (!subscription) {
          throw error;
        }
      }
    }

    // The documented list response may omit webhook_id. Reconcile the
    // delivery target/tag with PUT instead of creating a duplicate.
    if (
      subscription.webhookId !== webhook.id ||
      subscription.tag !== expectedTag
    ) {
      const updated = await updateXActivitySubscription({
        subscriptionId: subscription.subscriptionId,
        webhookId: webhook.id,
        tag: expectedTag,
      });
      subscription = updated;
      remoteSubscriptions = remoteSubscriptions.map((candidate) =>
        candidate.subscriptionId === updated.subscriptionId
          ? updated
          : candidate
      );
    }

    await args.ctx.runMutation(
      internal.platformConversations.upsertXActivitySubscriptionInternal,
      {
        userId: args.userId,
        xUserId: args.xUserId,
        eventType,
        subscriptionId: subscription.subscriptionId,
        webhookId: subscription.webhookId ?? webhook.id,
        tag: subscription.tag,
      }
    );
  }

  return { webhookId: webhook.id, authMode };
}

export const ensureDmActivitySubscriptionsForUserInternal = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    ensured: boolean;
    webhookId?: string;
    reason?: "missing_connection" | "missing_scopes";
  }> => {
    const now = getCurrentUTCTimestamp();
    const account = await ctx.runQuery(
      internal.xStore.getXAccountForUserInternal,
      {
        userId: args.userId,
      }
    );
    if (!account || account.status !== "connected") {
      return { ensured: false, reason: "missing_connection" as const };
    }

    const requiredScopes = ["dm.read", "dm.write", "tweet.read", "users.read"];
    const granted = new Set(account.grantedScopes ?? []);
    if (requiredScopes.some((scope) => !granted.has(scope))) {
      return { ensured: false, reason: "missing_scopes" as const };
    }
    const localWebhooks = await ctx.runQuery(
      internal.platformConversations.listXWebhooksInternal,
      {}
    );
    const validLocalWebhookIds = new Set(
      localWebhooks.flatMap(
        (webhook: { valid: boolean; url: string; webhookId: string }) =>
          webhook.valid && webhook.url === getXWebhookCallbackUrl()
            ? [webhook.webhookId]
            : []
      )
    );
    const localSubscriptions = await ctx.runQuery(
      internal.platformConversations.listXActivitySubscriptionsForUserInternal,
      {
        userId: args.userId,
      }
    );
    const hasAllLocalSubscriptions = X_DM_ACTIVITY_EVENT_TYPES.every(
      (eventType) =>
        localSubscriptions.some(
          (subscription: any) =>
            subscription.eventType === eventType &&
            subscription.xUserId === account.xUserId &&
            typeof subscription.webhookId === "string" &&
            validLocalWebhookIds.has(subscription.webhookId)
        )
    );
    const localWebhookId = localSubscriptions.find(
      (subscription: any) =>
        subscription.xUserId === account.xUserId &&
        typeof subscription.webhookId === "string" &&
        validLocalWebhookIds.has(subscription.webhookId)
    )?.webhookId;
    const dmHealth = getXActivitySubscriptionHealth(account, "dm");
    const isRecentlyVerified =
      dmHealth.status === "healthy" &&
      typeof dmHealth.nextRetryAt === "number" &&
      dmHealth.nextRetryAt > now;
    if (localWebhookId && hasAllLocalSubscriptions && isRecentlyVerified) {
      return { ensured: true, webhookId: localWebhookId };
    }

    const isPendingRetryWindow =
      dmHealth.status === "pending_retry" &&
      typeof dmHealth.nextRetryAt === "number" &&
      dmHealth.nextRetryAt > now;
    const shouldAttemptDuplicateReconciliation =
      isPendingRetryWindow &&
      isDuplicateXActivitySubscriptionError(dmHealth.lastError);

    if (isPendingRetryWindow && !shouldAttemptDuplicateReconciliation) {
      return { ensured: false };
    }

    await ctx.runMutation(internal.xStore.patchXAccountInternal, {
      userId: args.userId,
      patch: {
        dmActivitySubscriptionsLastAttemptAt: now,
      },
    });

    try {
      await getXProviderContextForUser(ctx, internal.xStore, {
        userId: args.userId,
        requiredScopes,
      });
      const accountForActivity = await ctx.runQuery(
        internal.xStore.getXAccountForUserInternal,
        { userId: args.userId }
      );
      if (!accountForActivity || accountForActivity.status !== "connected") {
        return { ensured: false, reason: "missing_connection" as const };
      }
      const userOAuthAccessToken = decryptXSecret(
        accountForActivity.accessToken
      );

      const { webhookId, authMode } = await ensureWebhookAndSubscriptions({
        ctx,
        userId: args.userId,
        xUserId: accountForActivity.xUserId,
        eventTypes: X_DM_ACTIVITY_EVENT_TYPES,
        userOAuthAccessToken,
      });

      await ctx.runMutation(internal.xStore.patchXAccountInternal, {
        userId: args.userId,
        patch: {
          dmActivitySubscriptionStatus: "healthy",
          dmActivitySubscriptionsEnsuredAt: now,
          dmActivitySubscriptionsLastAttemptAt: now,
          dmActivitySubscriptionsNextRetryAt:
            now + ACTIVITY_ENSURE_SUCCESS_TTL_MS,
          dmActivitySubscriptionsLastError: undefined,
          dmActivitySubscriptionsLastAuthMode: authMode,
        },
      });

      return { ensured: true, webhookId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const normalized = message.toLowerCase();
      const nextRetryAt =
        normalized.includes("429") || normalized.includes("rate limit")
          ? now + ACTIVITY_ENSURE_RATE_LIMIT_RETRY_MS
          : now + ACTIVITY_ENSURE_RETRY_MS;

      await ctx.runMutation(internal.xStore.patchXAccountInternal, {
        userId: args.userId,
        patch: {
          dmActivitySubscriptionStatus: "pending_retry",
          dmActivitySubscriptionsLastAttemptAt: now,
          dmActivitySubscriptionsNextRetryAt: nextRetryAt,
          dmActivitySubscriptionsLastError: message,
        },
      });

      return { ensured: false };
    }
  },
});

/**
 * Ensures a public `post.create` Activity subscription for the connected X/Twitter
 * account. Used to detect manual replies after API policy blocks — without
 * SocialAPI polling.
 */
export const ensurePostCreateActivitySubscriptionForUserInternal =
  internalAction({
    args: {
      userId: v.id("users"),
    },
    handler: async (
      ctx,
      args
    ): Promise<{
      ensured: boolean;
      webhookId?: string;
      reason?: "missing_connection" | "missing_scopes";
    }> => {
      const account = await ctx.runQuery(
        internal.xStore.getXAccountForUserInternal,
        {
          userId: args.userId,
        }
      );
      if (!account || account.status !== "connected") {
        return { ensured: false, reason: "missing_connection" as const };
      }

      const requiredScopes = ["tweet.read", "users.read"];
      const granted = new Set(account.grantedScopes ?? []);
      if (requiredScopes.some((scope) => !granted.has(scope))) {
        return { ensured: false, reason: "missing_scopes" as const };
      }

      const now = getCurrentUTCTimestamp();
      const localWebhooks = await ctx.runQuery(
        internal.platformConversations.listXWebhooksInternal,
        {}
      );
      const validLocalWebhookIds = new Set(
        localWebhooks
          .filter((webhook: { valid: boolean }) => webhook.valid)
          .map((webhook: { webhookId: string }) => webhook.webhookId)
      );
      const localSubscriptions = await ctx.runQuery(
        internal.platformConversations
          .listXActivitySubscriptionsForUserInternal,
        { userId: args.userId }
      );
      const hasLocalPostCreate = X_POST_ACTIVITY_EVENT_TYPES.every(
        (eventType) =>
          localSubscriptions.some(
            (subscription: any) =>
              subscription.eventType === eventType &&
              subscription.xUserId === account.xUserId &&
              typeof subscription.webhookId === "string" &&
              validLocalWebhookIds.has(subscription.webhookId)
          )
      );
      const localWebhookId = localSubscriptions.find(
        (subscription: any) =>
          subscription.xUserId === account.xUserId &&
          typeof subscription.webhookId === "string" &&
          validLocalWebhookIds.has(subscription.webhookId)
      )?.webhookId;
      const postHealth = getXActivitySubscriptionHealth(account, "post");
      const isRecentlyVerified =
        postHealth.status === "healthy" &&
        typeof postHealth.nextRetryAt === "number" &&
        postHealth.nextRetryAt > now;
      if (localWebhookId && hasLocalPostCreate && isRecentlyVerified) {
        return { ensured: true, webhookId: localWebhookId };
      }

      const isPendingRetryWindow =
        postHealth.status === "pending_retry" &&
        typeof postHealth.nextRetryAt === "number" &&
        postHealth.nextRetryAt > now;
      if (isPendingRetryWindow) {
        return { ensured: false };
      }

      await ctx.runMutation(internal.xStore.patchXAccountInternal, {
        userId: args.userId,
        patch: {
          postActivitySubscriptionsLastAttemptAt: now,
        },
      });

      try {
        const accountForActivity = await ctx.runQuery(
          internal.xStore.getXAccountForUserInternal,
          { userId: args.userId }
        );
        if (!accountForActivity || accountForActivity.status !== "connected") {
          return { ensured: false, reason: "missing_connection" as const };
        }
        const userOAuthAccessToken = decryptXSecret(
          accountForActivity.accessToken
        );
        const { webhookId, authMode } = await ensureWebhookAndSubscriptions({
          ctx,
          userId: args.userId,
          xUserId: accountForActivity.xUserId,
          eventTypes: X_POST_ACTIVITY_EVENT_TYPES,
          userOAuthAccessToken,
        });
        await ctx.runMutation(internal.xStore.patchXAccountInternal, {
          userId: args.userId,
          patch: {
            postActivitySubscriptionStatus: "healthy",
            postActivitySubscriptionsEnsuredAt: now,
            postActivitySubscriptionsLastAttemptAt: now,
            postActivitySubscriptionsNextRetryAt:
              now + ACTIVITY_ENSURE_SUCCESS_TTL_MS,
            postActivitySubscriptionsLastError: undefined,
            postActivitySubscriptionsLastAuthMode: authMode,
          },
        });
        return { ensured: true, webhookId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const normalized = message.toLowerCase();
        const nextRetryAt =
          normalized.includes("429") || normalized.includes("rate limit")
            ? now + ACTIVITY_ENSURE_RATE_LIMIT_RETRY_MS
            : now + ACTIVITY_ENSURE_RETRY_MS;
        await ctx.runMutation(internal.xStore.patchXAccountInternal, {
          userId: args.userId,
          patch: {
            postActivitySubscriptionStatus: "pending_retry",
            postActivitySubscriptionsLastAttemptAt: now,
            postActivitySubscriptionsNextRetryAt: nextRetryAt,
            postActivitySubscriptionsLastError: message,
          },
        });
        console.warn("[XActivity] Failed to ensure post.create subscription", {
          userId: String(args.userId),
          error: message,
        });
        return { ensured: false };
      }
    },
  });

type ConnectedXAccountUserIdPage = {
  page: Id<"users">[];
  isDone: boolean;
  continueCursor: string;
};

/**
 * Reconcile every connected account in bounded pages. Each per-user ensure is
 * already idempotent and avoids provider calls while the complete local DM
 * subscription set is healthy.
 */
export const retryDmActivitySubscriptionsCron = internalAction({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accounts: ConnectedXAccountUserIdPage = await ctx.runQuery(
      internal.xStore.listConnectedXAccountUserIdsInternal,
      {
        paginationOpts: {
          numItems: 10,
          cursor: args.cursor ?? null,
        },
      }
    );
    let ensured = 0;
    for (const userId of accounts.page) {
      try {
        const result: { ensured: boolean } = await ctx.runAction(
          internal.xActivity.ensureDmActivitySubscriptionsForUserInternal,
          { userId }
        );
        if (result.ensured) {
          ensured += 1;
        }
      } catch (error) {
        console.warn(
          "[XActivity] Scheduled DM subscription reconciliation failed",
          {
            userId: String(userId),
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    }

    if (!accounts.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.xActivity.retryDmActivitySubscriptionsCron,
        { cursor: accounts.continueCursor }
      );
    }

    return {
      checked: accounts.page.length,
      ensured,
      hasMore: !accounts.isDone,
    };
  },
});

export const handleWebhookPayloadInternal = internalAction({
  args: {
    payload: v.any(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    processed: number;
    results: Array<Record<string, unknown>>;
  }> => {
    const events = normalizeWebhookEvents(args.payload);
    const results = [];

    for (const event of events) {
      try {
        if (event.kind === "post") {
          const userId = await resolveUserIdForEvent(ctx, {
            filteredUserId: event.filteredUserId,
            subscriptionId: event.subscriptionId,
          });
          if (!userId) {
            results.push({ ignored: true, eventType: event.eventType });
            continue;
          }

          const post = extractActivityCreatedPost(event.envelope);
          if (!post?.repliedToPostId) {
            results.push({
              ignored: true,
              eventType: event.eventType,
              reason: "not_a_reply",
            });
            continue;
          }
          const repliedToPostId = post.repliedToPostId;

          const account = await ctx.runQuery(
            internal.xStore.getXAccountForUserInternal,
            { userId }
          );
          if (!account?.xUserId) {
            results.push({
              ignored: true,
              eventType: event.eventType,
              reason: "missing_x_account",
            });
            continue;
          }
          if (
            event.filteredUserId &&
            event.filteredUserId !== account.xUserId
          ) {
            results.push({
              ignored: true,
              eventType: event.eventType,
              reason: "filtered_user_mismatch",
            });
            continue;
          }
          const matchedPost =
            post.authorId || !event.filteredUserId
              ? post
              : { ...post, authorId: event.filteredUserId };

          const monitor = (await ctx.runQuery(
            internal.outreachRecovery
              .getActiveTwitterManualReplyMonitorForSourcePostInternal,
            {
              userId,
              sourcePostId: repliedToPostId,
            }
          )) as Doc<"outreachRecoveryMonitors"> | null;

          if (
            !monitor ||
            !matchesTwitterManualReplyRecovery({
              post: matchedPost,
              sourcePostId: monitor.sourcePostId,
              connectedXUserId: account.xUserId,
              startedAt: monitor.startedAt,
            })
          ) {
            results.push({
              ignored: true,
              eventType: event.eventType,
              reason: "no_matching_recovery",
              repliedToPostId: matchedPost.repliedToPostId,
            });
            continue;
          }

          const confirmedTaskId = await ctx.runMutation(
            internal.outreachRecovery.confirmTwitterManualReply,
            {
              monitorId: monitor._id,
              replyPostId: matchedPost.postId,
              replyText: matchedPost.text,
              repliedAt: matchedPost.createdAtMs ?? getCurrentUTCTimestamp(),
            }
          );

          if (confirmedTaskId) {
            await ctx.runMutation(internal.outreach.upsertTwitterInteraction, {
              userId,
              prospectId: monitor.prospectId,
              sourcePostRef: {
                platform: "twitter",
                postId: monitor.sourcePostId,
                conversationId: monitor.sourcePostId,
              },
              replyPostRef: {
                platform: "twitter",
                postId: matchedPost.postId,
                conversationId:
                  matchedPost.conversationId ?? monitor.sourcePostId,
                url: `https://x.com/i/web/status/${matchedPost.postId}`,
              },
              threadId: monitor.sourcePostId,
              repliedAt: matchedPost.createdAtMs ?? getCurrentUTCTimestamp(),
              origin: "external_x",
              discoveredVia: "x_activity",
              status: "active",
              direction: "outgoing",
              discoveredAt: matchedPost.createdAtMs ?? getCurrentUTCTimestamp(),
              lastSeenAt: getCurrentUTCTimestamp(),
            });
          }

          results.push({
            ignored: false,
            eventType: event.eventType,
            monitorId: String(monitor._id),
            replyPostId: matchedPost.postId,
            confirmed: Boolean(confirmedTaskId),
          });
          continue;
        }

        if (event.kind === "typing") {
          const userId = await resolveUserIdForEvent(ctx, {
            filteredUserId: event.filteredUserId,
            subscriptionId: event.subscriptionId,
          });
          if (!userId) {
            results.push({
              ignored: true,
              eventType: event.eventType,
              reason: "missing_connected_account",
            });
            continue;
          }

          const conversation = event.conversationId
            ? await ctx.runQuery(
                internal.platformConversations
                  .getConversationByUserAndConversationIdInternal,
                {
                  userId,
                  conversationId: event.conversationId,
                }
              )
            : await ctx.runQuery(
                internal.platformConversations
                  .getTwitterConversationForTypingInternal,
                {
                  userId,
                  participantUserId: event.senderUserId,
                }
              );

          if (
            !conversation ||
            conversation.platform !== "twitter" ||
            (conversation.participantUserId &&
              conversation.participantUserId !== event.senderUserId)
          ) {
            results.push({
              ignored: true,
              eventType: event.eventType,
              reason: "conversation_not_resolved",
            });
            continue;
          }

          await ctx.runMutation(
            internal.conversationTypingPresence.upsertTwitterInternal,
            {
              userId,
              conversationId: conversation.conversationId,
              senderUserId: event.senderUserId,
              receivedAt: getCurrentUTCTimestamp(),
            }
          );
          results.push({
            ignored: false,
            eventType: event.eventType,
            conversationId: conversation.conversationId,
          });
          continue;
        }

        const userId = await resolveUserIdForEvent(ctx, {
          filteredUserId: event.filteredUserId,
          subscriptionId: event.subscriptionId,
        });
        if (!userId || !event.conversationId) {
          results.push({ ignored: true, eventType: event.eventType });
          continue;
        }

        if (event.eventType === "dm.read") {
          await ctx.runMutation(
            internal.platformConversations.markConversationMessagesReadInternal,
            {
              userId,
              conversationId: event.conversationId,
              readAt: getCurrentUTCTimestamp(),
            }
          );
          results.push({
            ignored: false,
            eventType: event.eventType,
            conversationId: event.conversationId,
          });
          continue;
        }

        const isIncomingMessage = event.eventType.endsWith("received");
        if (isIncomingMessage) {
          await ctx.runMutation(
            internal.conversationTypingPresence.clearTwitterInternal,
            {
              userId,
              conversationId: event.conversationId,
            }
          );
        }
        const existingMessage =
          event.messageId && isIncomingMessage
            ? await ctx.runQuery(
                internal.platformConversations.getConversationMessageInternal,
                {
                  userId,
                  conversationId: event.conversationId,
                  messageId: event.messageId,
                }
              )
            : null;
        const isEncryptedChatEvent = event.eventType.startsWith("chat.");

        const synced = isEncryptedChatEvent
          ? null
          : await syncConversationSnapshot(ctx, {
              userId,
              conversationId: event.conversationId,
              sourceEventType: event.eventType,
            });
        // Always consume the normalized webhook payload. For chat.* it is the
        // only readable message source; for dm.* it fills a race where lookup
        // has not yet indexed the just-delivered event.
        const conversation = await persistNormalizedDmActivityEvent(ctx, {
          userId,
          event,
        });

        if (
          isEncryptedChatEvent &&
          event.messageId &&
          event.encodedEvent &&
          conversation?.prospectId
        ) {
          await ctx.runMutation(internal.xChatRealtimeEvents.upsertInternal, {
            userId,
            workspaceId: conversation.workspaceId,
            prospectId: conversation.prospectId,
            conversationId: event.conversationId,
            eventId: event.messageId,
            senderId: event.senderUserId,
            createdAtMs: event.createdAt
              ? parseIsoToTimestamp(event.createdAt)
              : undefined,
            encodedEvent: event.encodedEvent,
            receivedAt: getCurrentUTCTimestamp(),
          });
        }

        if (isIncomingMessage && !existingMessage && conversation?.prospectId) {
          const inboundMessage = event.messageId
            ? await ctx.runQuery(
                internal.platformConversations.getConversationMessageInternal,
                {
                  userId,
                  conversationId: event.conversationId,
                  messageId: event.messageId,
                }
              )
            : [...(synced?.messages ?? [])]
                .reverse()
                .find((message) => message.direction === "received");
          if (inboundMessage) {
            await ctx.runMutation(internal.outreach.onProspectDmResponse, {
              prospectId: conversation.prospectId,
              responseMessageId:
                "messageId" in inboundMessage
                  ? inboundMessage.messageId
                  : inboundMessage.id,
              responseText: inboundMessage.text ?? "",
              conversationId: event.conversationId,
            });
          }
        }

        results.push({
          ignored: false,
          eventType: event.eventType,
          conversationId: event.conversationId,
        });
      } catch (error) {
        results.push({
          ignored: false,
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { processed: results.length, results };
  },
});
