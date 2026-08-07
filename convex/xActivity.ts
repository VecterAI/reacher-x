"use node";

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { internalAction } from "./lib/functionBuilders";
import {
  X_DM_ACTIVITY_EVENT_TYPES,
  X_POST_ACTIVITY_EVENT_TYPES,
  createXActivitySubscription,
  createXWebhook,
  getXWebhookCallbackUrl,
  listXActivitySubscriptions,
  listXWebhooks,
  type XActivityEventType,
  type XDmActivityEventType,
  validateXWebhook,
} from "./lib/xActivity";
import {
  extractActivityCreatedPost,
  matchesTwitterManualReplyRecovery,
} from "./lib/outreachRecoveryCore";
import { normalizeDmMessages } from "./lib/xDm";
import { decryptXSecret } from "./lib/xdkCrypto";
import { getXProviderContextForUser } from "./lib/xdkAuth";
import { getDmEventsByConversationId } from "./lib/xdkTwitterProvider";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const ACTIVITY_ENSURE_SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const ACTIVITY_ENSURE_RETRY_MS = 15 * 60 * 1000;
const ACTIVITY_ENSURE_RATE_LIMIT_RETRY_MS = 5 * 60 * 1000;

function isDuplicateSubscriptionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("duplicatesubscription") &&
    normalized.includes("subscription already exists")
  );
}

function findMatchingRemoteSubscription(
  subscriptions: Array<{
    eventType: XActivityEventType;
    filterUserId?: string;
    webhookId?: string;
    subscriptionId: string;
    tag?: string;
  }>,
  args: {
    eventType: XActivityEventType;
    xUserId: string;
    webhookId: string;
  }
) {
  return subscriptions.find(
    (candidate) =>
      candidate.eventType === args.eventType &&
      candidate.filterUserId === args.xUserId &&
      candidate.webhookId === args.webhookId
  );
}

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

type NormalizedDmActivityEvent = {
  kind: "dm";
  eventType: XDmActivityEventType;
  filteredUserId?: string;
  subscriptionId?: string;
  conversationId?: string;
  messageId?: string;
  text?: string;
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
): Array<NormalizedDmActivityEvent | NormalizedPostActivityEvent> {
  const root = asRecord(payload);
  const entries = Array.isArray(root?.data)
    ? root?.data
    : root?.data
      ? [root.data]
      : [payload];

  const normalized: Array<
    NormalizedDmActivityEvent | NormalizedPostActivityEvent
  > = [];

  for (const entry of entries) {
    const envelope = asRecord(entry);
    if (!envelope) {
      continue;
    }
    const eventType =
      asString(envelope.event_type) ?? asString(envelope.eventType);
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

    if (
      !X_DM_ACTIVITY_EVENT_TYPES.includes(eventType as XDmActivityEventType)
    ) {
      continue;
    }
    const normalizedPayload = asRecord(envelope.payload) ?? envelope;
    normalized.push({
      kind: "dm",
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
      lastSyncedAt: getCurrentUTCTimestamp(),
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

async function ensureWebhookAndSubscriptions(args: {
  ctx: ActionCtx;
  userId: Id<"users">;
  xUserId: string;
  eventTypes: readonly XActivityEventType[];
  userOAuthAccessToken?: string;
}): Promise<{ webhookId: string; authMode: "app" | "user" }> {
  const webhookUrl = getXWebhookCallbackUrl();
  const remoteWebhooks = await listXWebhooks();
  let webhook = remoteWebhooks.find(
    (candidate) => candidate.url === webhookUrl
  );

  // Pay-per-use X/Twitter apps allow a single webhook. Reuse the existing one when the
  // exact URL is already registered, or when create would exceed the limit.
  if (!webhook && remoteWebhooks.length === 1) {
    webhook = remoteWebhooks[0];
  }

  if (!webhook) {
    try {
      webhook = await createXWebhook(webhookUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        !message.toLowerCase().includes("webhooklimitexceeded") ||
        remoteWebhooks.length === 0
      ) {
        throw error;
      }
      webhook = remoteWebhooks[0];
    }
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
    let subscription = findMatchingRemoteSubscription(remoteSubscriptions, {
      eventType,
      xUserId: args.xUserId,
      webhookId: webhook.id,
    });

    if (!subscription) {
      try {
        const created = await createXActivitySubscription({
          eventType,
          xUserId: args.xUserId,
          webhookId: webhook.id,
          tag: `reacherx:${args.userId}:${eventType}`,
          userOAuthAccessToken: args.userOAuthAccessToken,
        });
        subscription = created.subscription;
        authMode = created.authMode;
        remoteSubscriptions = [...remoteSubscriptions, subscription];
      } catch (error) {
        if (!isDuplicateSubscriptionError(error)) {
          throw error;
        }

        remoteSubscriptions = await listXActivitySubscriptions();
        subscription = findMatchingRemoteSubscription(remoteSubscriptions, {
          eventType,
          xUserId: args.xUserId,
          webhookId: webhook.id,
        });

        if (!subscription) {
          throw error;
        }
      }
    }

    await args.ctx.runMutation(
      internal.platformConversations.upsertXActivitySubscriptionInternal,
      {
        userId: args.userId,
        xUserId: args.xUserId,
        eventType,
        subscriptionId: subscription.subscriptionId,
        webhookId: subscription.webhookId,
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
      localWebhooks
        .filter((webhook: { valid: boolean }) => webhook.valid)
        .map((webhook: { webhookId: string }) => webhook.webhookId)
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
    if (localWebhookId && hasAllLocalSubscriptions) {
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
      return { ensured: true, webhookId: localWebhookId };
    }

    const isPendingRetryWindow =
      account.activitySubscriptionStatus === "pending_retry" &&
      typeof account.activitySubscriptionsNextRetryAt === "number" &&
      account.activitySubscriptionsNextRetryAt > now;
    const shouldAttemptDuplicateReconciliation =
      isPendingRetryWindow &&
      isDuplicateSubscriptionError(account.activitySubscriptionsLastError);

    if (isPendingRetryWindow && !shouldAttemptDuplicateReconciliation) {
      return { ensured: false };
    }

    await ctx.runMutation(internal.xStore.patchXAccountInternal, {
      userId: args.userId,
      patch: {
        activitySubscriptionsLastAttemptAt: now,
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
          activitySubscriptionStatus: "healthy",
          activitySubscriptionsEnsuredAt: now,
          activitySubscriptionsLastAttemptAt: now,
          activitySubscriptionsNextRetryAt:
            now + ACTIVITY_ENSURE_SUCCESS_TTL_MS,
          activitySubscriptionsLastError: undefined,
          activitySubscriptionsLastAuthMode: authMode,
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
      if (localWebhookId && hasLocalPostCreate) {
        await ctx.runMutation(internal.xStore.patchXAccountInternal, {
          userId: args.userId,
          patch: {
            activitySubscriptionStatus: "healthy",
            activitySubscriptionsEnsuredAt: now,
            activitySubscriptionsLastAttemptAt: now,
            activitySubscriptionsNextRetryAt:
              now + ACTIVITY_ENSURE_SUCCESS_TTL_MS,
            activitySubscriptionsLastError: undefined,
          },
        });
        return { ensured: true, webhookId: localWebhookId };
      }

      const isPendingRetryWindow =
        account.activitySubscriptionStatus === "pending_retry" &&
        typeof account.activitySubscriptionsNextRetryAt === "number" &&
        account.activitySubscriptionsNextRetryAt > now;
      if (isPendingRetryWindow) {
        return { ensured: false };
      }

      await ctx.runMutation(internal.xStore.patchXAccountInternal, {
        userId: args.userId,
        patch: {
          activitySubscriptionsLastAttemptAt: now,
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
            activitySubscriptionStatus: "healthy",
            activitySubscriptionsEnsuredAt: now,
            activitySubscriptionsLastAttemptAt: now,
            activitySubscriptionsNextRetryAt:
              now + ACTIVITY_ENSURE_SUCCESS_TTL_MS,
            activitySubscriptionsLastError: undefined,
            activitySubscriptionsLastAuthMode: authMode,
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
            activitySubscriptionStatus: "pending_retry",
            activitySubscriptionsLastAttemptAt: now,
            activitySubscriptionsNextRetryAt: nextRetryAt,
            activitySubscriptionsLastError: message,
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
