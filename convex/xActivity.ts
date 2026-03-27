"use node";

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalAction } from "./lib/functionBuilders";
import {
  X_DM_ACTIVITY_EVENT_TYPES,
  createXActivitySubscription,
  createXWebhook,
  getXWebhookCallbackUrl,
  listXActivitySubscriptions,
  listXWebhooks,
  type XDmActivityEventType,
  validateXWebhook,
} from "./lib/xActivity";
import { normalizeDmMessages } from "./lib/xDm";
import { decryptXSecret } from "./lib/xdkCrypto";
import { getXProviderContextForUser } from "./lib/xdkAuth";
import { getDmEventsByConversationId } from "./lib/xdkTwitterProvider";

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
  return (
    asString(payload.dm_conversation_id) ??
    asString(payload.dmConversationId) ??
    asString(message?.dm_conversation_id) ??
    asString(message?.dmConversationId) ??
    asString(payload.conversation_id) ??
    asString(payload.conversationId)
  );
}

function extractMessageId(
  payload: Record<string, unknown>
): string | undefined {
  const message = asRecord(payload.message);
  return (
    asString(payload.id) ??
    asString(payload.event_id) ??
    asString(payload.eventId) ??
    asString(message?.id)
  );
}

function extractMessageText(
  payload: Record<string, unknown>
): string | undefined {
  const message = asRecord(payload.message);
  return asString(payload.text) ?? asString(message?.text);
}

function normalizeWebhookEvents(payload: unknown): Array<{
  eventType: XDmActivityEventType;
  filteredUserId?: string;
  subscriptionId?: string;
  conversationId?: string;
  messageId?: string;
  text?: string;
}> {
  const root = asRecord(payload);
  const entries = Array.isArray(root?.data)
    ? root?.data
    : root?.data
      ? [root.data]
      : [payload];

  const normalized: Array<{
    eventType: XDmActivityEventType;
    filteredUserId?: string;
    subscriptionId?: string;
    conversationId?: string;
    messageId?: string;
    text?: string;
  }> = [];

  for (const entry of entries) {
    const envelope = asRecord(entry);
    if (!envelope) {
      continue;
    }
    const eventType =
      asString(envelope.event_type) ?? asString(envelope.eventType);
    if (
      !eventType ||
      !X_DM_ACTIVITY_EVENT_TYPES.includes(eventType as XDmActivityEventType)
    ) {
      continue;
    }
    const normalizedPayload = asRecord(envelope.payload) ?? envelope;
    normalized.push({
      eventType: eventType as XDmActivityEventType,
      filteredUserId: extractFilteredUserId(envelope),
      subscriptionId:
        asString(envelope.subscription_id) ?? asString(envelope.subscriptionId),
      conversationId: extractConversationId(normalizedPayload),
      messageId: extractMessageId(normalizedPayload),
      text: extractMessageText(normalizedPayload),
    });
  }

  return normalized;
}

async function resolveUserIdForEvent(
  ctx: any,
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
  ctx: any,
  args: {
    userId: Id<"users">;
    conversationId: string;
    sourceEventType?: XDmActivityEventType;
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
      maxResults: 100,
    }
  );
  const messages = normalizeDmMessages(response, provider.xUserId);
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
      lastSyncedAt: Date.now(),
      messages: messages.map((message) => ({
        messageId: message.id,
        direction: message.direction,
        senderUserId: message.senderUserId,
        text: message.text,
        createdAt: message.createdAt,
        createdAtMs: message.createdAt ? Date.parse(message.createdAt) : 0,
        attachments: message.attachments,
        readAt: message.readAt ? Date.parse(message.readAt) : undefined,
        sourceEventType: args.sourceEventType,
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
    const now = Date.now();
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
    if (
      account.activitySubscriptionStatus === "pending_retry" &&
      typeof account.activitySubscriptionsNextRetryAt === "number" &&
      account.activitySubscriptionsNextRetryAt > now
    ) {
      return { ensured: false };
    }

    const webhookUrl = getXWebhookCallbackUrl();
    const localWebhook: any = await ctx.runQuery(
      internal.platformConversations.getXWebhookByUrlInternal,
      {
        url: webhookUrl,
      }
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
            subscription.webhookId === localWebhook?.webhookId
        )
    );
    if (localWebhook?.valid && hasAllLocalSubscriptions) {
      await ctx.runMutation(internal.xStore.patchXAccountInternal, {
        userId: args.userId,
        patch: {
          activitySubscriptionStatus: "healthy",
          activitySubscriptionsEnsuredAt: now,
          activitySubscriptionsLastAttemptAt: now,
          activitySubscriptionsNextRetryAt: undefined,
          activitySubscriptionsLastError: undefined,
        },
      });
      return { ensured: true, webhookId: localWebhook.webhookId };
    }
    await ctx.runMutation(internal.xStore.patchXAccountInternal, {
      userId: args.userId,
      patch: {
        activitySubscriptionsLastAttemptAt: now,
      },
    });

    try {
      const remoteWebhooks = await listXWebhooks();
      let webhook = remoteWebhooks.find(
        (candidate) => candidate.url === webhookUrl
      );
      if (!webhook) {
        webhook = await createXWebhook(webhookUrl);
      } else if (!webhook.valid) {
        webhook = await validateXWebhook(webhook.id);
      }

      await ctx.runMutation(
        internal.platformConversations.upsertXWebhookInternal,
        {
          webhookId: webhook.id,
          url: webhook.url,
          valid: webhook.valid,
          lastValidatedAt: now,
          lastError: undefined,
        }
      );

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

      const remoteSubscriptions = await listXActivitySubscriptions();
      let lastAuthMode = accountForActivity.activitySubscriptionsLastAuthMode;
      for (const eventType of X_DM_ACTIVITY_EVENT_TYPES) {
        let subscription = remoteSubscriptions.find(
          (candidate) =>
            candidate.eventType === eventType &&
            candidate.filterUserId === accountForActivity.xUserId &&
            candidate.webhookId === webhook.id
        );

        if (!subscription) {
          const created = await createXActivitySubscription({
            eventType,
            xUserId: accountForActivity.xUserId,
            webhookId: webhook.id,
            tag: `reacherx:${args.userId}:${eventType}`,
            userOAuthAccessToken,
          });
          subscription = created.subscription;
          lastAuthMode = created.authMode;
        }

        await ctx.runMutation(
          internal.platformConversations.upsertXActivitySubscriptionInternal,
          {
            userId: args.userId,
            xUserId: accountForActivity.xUserId,
            eventType,
            subscriptionId: subscription.subscriptionId,
            webhookId: subscription.webhookId,
            tag: subscription.tag,
          }
        );
      }

      await ctx.runMutation(internal.xStore.patchXAccountInternal, {
        userId: args.userId,
        patch: {
          activitySubscriptionStatus: "healthy",
          activitySubscriptionsEnsuredAt: now,
          activitySubscriptionsLastAttemptAt: now,
          activitySubscriptionsNextRetryAt:
            now + ACTIVITY_ENSURE_SUCCESS_TTL_MS,
          activitySubscriptionsLastError: undefined,
          activitySubscriptionsLastAuthMode: lastAuthMode,
        },
      });

      return { ensured: true, webhookId: webhook.id };
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
          activitySubscriptionStatus: "pending_retry",
          activitySubscriptionsLastAttemptAt: now,
          activitySubscriptionsNextRetryAt: nextRetryAt,
          activitySubscriptionsLastError: message,
        },
      });

      return { ensured: false };
    }
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
              readAt: Date.now(),
            }
          );
          results.push({
            ignored: false,
            eventType: event.eventType,
            conversationId: event.conversationId,
          });
          continue;
        }

        const existingMessage =
          event.messageId && event.eventType.endsWith("received")
            ? await ctx.runQuery(
                internal.platformConversations.getConversationMessageInternal,
                {
                  userId,
                  conversationId: event.conversationId,
                  messageId: event.messageId,
                }
              )
            : null;

        const synced = await syncConversationSnapshot(ctx, {
          userId,
          conversationId: event.conversationId,
          sourceEventType: event.eventType,
        });

        if (event.eventType.endsWith("received") && !existingMessage) {
          const conversation = synced.conversation;
          if (conversation?.prospectId) {
            const latestInbound = [...synced.messages]
              .reverse()
              .find((message) => message.direction === "received");
            if (latestInbound) {
              await ctx.runMutation(internal.outreach.onProspectDmResponse, {
                prospectId: conversation.prospectId,
                responseMessageId: latestInbound.id,
                responseText: latestInbound.text,
                conversationId: event.conversationId,
              });
            }
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
