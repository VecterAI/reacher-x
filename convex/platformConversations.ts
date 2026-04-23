import { v } from "convex/values";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import { buildChangedPatchWithUpdatedAt } from "./lib/patchHelpers";
import {
  platformConversationAttachmentValidator,
  platformConversationDirectionValidator,
  platformConversationEventTypeValidator,
  platformConversationMessageTypeValidator,
  platformConversationPlatformValidator,
  xActivityEventTypeValidator,
  xDmEligibilityReasonCodeValidator,
  xDmPanelWarningCodeValidator,
} from "./validators";

function sortMessagesByTime<T extends { createdAtMs: number }>(
  messages: T[]
): T[] {
  return [...messages].sort(
    (left, right) => left.createdAtMs - right.createdAtMs
  );
}

function pickOptionalPatchValue<T extends object, K extends keyof T>(
  args: T,
  key: K,
  fallback: T[K]
): T[K] {
  return Object.prototype.hasOwnProperty.call(args, key) ? args[key] : fallback;
}

export const getConversationSnapshotInternal = internalQuery({
  args: {
    userId: v.id("users"),
    platform: platformConversationPlatformValidator,
    conversationId: v.optional(v.string()),
    prospectId: v.optional(v.id("prospects")),
  },
  handler: async (ctx, args) => {
    const conversation = args.conversationId
      ? await ctx.db
          .query("platformConversations")
          .withIndex("by_user_conversation", (q) =>
            q
              .eq("userId", args.userId)
              .eq("conversationId", args.conversationId!)
          )
          .first()
      : await ctx.db
          .query("platformConversations")
          .withIndex("by_prospect_platform", (q) =>
            q.eq("prospectId", args.prospectId!).eq("platform", args.platform)
          )
          .filter((q) => q.eq(q.field("userId"), args.userId))
          .first();

    if (!conversation) {
      return null;
    }

    const messages = await ctx.db
      .query("platformConversationMessages")
      .withIndex("by_user_conversation_created_at", (q) =>
        q
          .eq("userId", args.userId)
          .eq("conversationId", conversation.conversationId)
      )
      .collect();

    return {
      conversation,
      messages: sortMessagesByTime(messages),
    };
  },
});

export const getConversationByUserAndConversationIdInternal = internalQuery({
  args: {
    userId: v.id("users"),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("platformConversations")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();
  },
});

export const getConversationMessageInternal = internalQuery({
  args: {
    userId: v.id("users"),
    conversationId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("platformConversationMessages")
      .withIndex("by_user_conversation_message", (q) =>
        q
          .eq("userId", args.userId)
          .eq("conversationId", args.conversationId)
          .eq("messageId", args.messageId)
      )
      .first();
  },
});

export const upsertConversationSnapshotInternal = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    prospectId: v.optional(v.id("prospects")),
    platform: platformConversationPlatformValidator,
    conversationId: v.string(),
    accountId: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    participantUserId: v.optional(v.string()),
    participantAttendeeId: v.optional(v.string()),
    participantProviderId: v.optional(v.string()),
    participantUsername: v.optional(v.string()),
    participantName: v.optional(v.string()),
    participantHeadline: v.optional(v.string()),
    participantAvatarUrl: v.optional(v.string()),
    participantProfileUrl: v.optional(v.string()),
    participantVerified: v.optional(v.boolean()),
    eligibilityEnabled: v.optional(v.boolean()),
    eligibilityReasonCode: v.optional(xDmEligibilityReasonCodeValidator),
    eligibilityReasonLabel: v.optional(v.string()),
    disabledFeatures: v.optional(v.array(v.string())),
    readOnly: v.optional(v.boolean()),
    contentType: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    lastSyncAttemptAt: v.optional(v.number()),
    lastSyncSuccessAt: v.optional(v.number()),
    nextSyncAllowedAt: v.optional(v.number()),
    lastSyncErrorCode: v.optional(xDmPanelWarningCodeValidator),
    lastSyncErrorMessage: v.optional(v.string()),
    activitySubscribedAt: v.optional(v.number()),
    messages: v.array(
      v.object({
        messageId: v.string(),
        providerMessageId: v.optional(v.string()),
        direction: platformConversationDirectionValidator,
        senderUserId: v.optional(v.string()),
        senderAttendeeId: v.optional(v.string()),
        text: v.optional(v.string()),
        createdAt: v.optional(v.string()),
        createdAtMs: v.number(),
        attachments: v.optional(
          v.array(platformConversationAttachmentValidator)
        ),
        readAt: v.optional(v.number()),
        deliveredAt: v.optional(v.number()),
        quotedMessageId: v.optional(v.string()),
        messageType: v.optional(platformConversationMessageTypeValidator),
        isEvent: v.optional(v.boolean()),
        sourceEventType: v.optional(platformConversationEventTypeValidator),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingConversation = await ctx.db
      .query("platformConversations")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();

    const sortedMessages = sortMessagesByTime(args.messages);
    const latestMessage = sortedMessages.at(-1);

    const conversationPatch = {
      workspaceId: args.workspaceId,
      prospectId: args.prospectId,
      platform: args.platform,
      conversationId: args.conversationId,
      accountId: args.accountId,
      sourceId: args.sourceId,
      participantUserId: args.participantUserId,
      participantAttendeeId: args.participantAttendeeId,
      participantProviderId: args.participantProviderId,
      participantUsername: args.participantUsername,
      participantName: args.participantName,
      participantHeadline: args.participantHeadline,
      participantAvatarUrl: args.participantAvatarUrl,
      participantProfileUrl: args.participantProfileUrl,
      participantVerified: args.participantVerified,
      eligibilityEnabled: args.eligibilityEnabled,
      eligibilityReasonCode: args.eligibilityReasonCode,
      eligibilityReasonLabel: args.eligibilityReasonLabel,
      disabledFeatures: args.disabledFeatures,
      readOnly: args.readOnly,
      contentType: args.contentType,
      latestMessageId:
        latestMessage?.messageId ?? existingConversation?.latestMessageId,
      latestMessageAt:
        latestMessage?.createdAtMs ?? existingConversation?.latestMessageAt,
      lastSyncedAt: args.lastSyncedAt ?? existingConversation?.lastSyncedAt,
      lastSyncAttemptAt: pickOptionalPatchValue(
        args,
        "lastSyncAttemptAt",
        existingConversation?.lastSyncAttemptAt
      ),
      lastSyncSuccessAt: pickOptionalPatchValue(
        args,
        "lastSyncSuccessAt",
        existingConversation?.lastSyncSuccessAt
      ),
      nextSyncAllowedAt: pickOptionalPatchValue(
        args,
        "nextSyncAllowedAt",
        existingConversation?.nextSyncAllowedAt
      ),
      lastSyncErrorCode: pickOptionalPatchValue(
        args,
        "lastSyncErrorCode",
        existingConversation?.lastSyncErrorCode
      ),
      lastSyncErrorMessage: pickOptionalPatchValue(
        args,
        "lastSyncErrorMessage",
        existingConversation?.lastSyncErrorMessage
      ),
      activitySubscribedAt:
        args.activitySubscribedAt ?? existingConversation?.activitySubscribedAt,
      updatedAt: now,
    };

    const conversationId = existingConversation
      ? existingConversation._id
      : await ctx.db.insert("platformConversations", {
          userId: args.userId,
          ...conversationPatch,
        });

    if (existingConversation) {
      const patch = buildChangedPatchWithUpdatedAt(
        existingConversation as unknown as Record<string, unknown>,
        conversationPatch,
        now
      );
      if (patch) {
        await ctx.db.patch(existingConversation._id, patch);
      }
    }

    for (const message of sortedMessages) {
      const existingMessage = await ctx.db
        .query("platformConversationMessages")
        .withIndex("by_user_conversation_message", (q) =>
          q
            .eq("userId", args.userId)
            .eq("conversationId", args.conversationId)
            .eq("messageId", message.messageId)
        )
        .first();

      const payload = {
        workspaceId: args.workspaceId,
        prospectId: args.prospectId,
        platform: args.platform,
        conversationId: args.conversationId,
        messageId: message.messageId,
        providerMessageId: message.providerMessageId,
        direction: message.direction,
        senderUserId: message.senderUserId,
        senderAttendeeId: message.senderAttendeeId,
        text: message.text,
        createdAt: message.createdAt,
        createdAtMs: message.createdAtMs,
        attachments: message.attachments,
        readAt: message.readAt ?? existingMessage?.readAt,
        deliveredAt: message.deliveredAt ?? existingMessage?.deliveredAt,
        quotedMessageId: message.quotedMessageId,
        messageType: message.messageType,
        isEvent: message.isEvent,
        sourceEventType: message.sourceEventType,
        updatedAt: now,
      };

      if (existingMessage) {
        const patch = buildChangedPatchWithUpdatedAt(
          existingMessage as unknown as Record<string, unknown>,
          payload,
          now
        );
        if (patch) {
          await ctx.db.patch(existingMessage._id, patch);
        }
      } else {
        await ctx.db.insert("platformConversationMessages", {
          userId: args.userId,
          ...payload,
        });
      }
    }

    return {
      conversationId,
      latestMessageAt: latestMessage?.createdAtMs,
      messageCount: sortedMessages.length,
    };
  },
});

export const markConversationMessagesReadInternal = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.string(),
    readAt: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("platformConversationMessages")
      .withIndex("by_user_conversation_created_at", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .collect();

    for (const message of messages) {
      if (message.direction !== "sent") {
        continue;
      }
      if (typeof message.readAt === "number" && message.readAt >= args.readAt) {
        continue;
      }
      await ctx.db.patch(message._id, {
        readAt: args.readAt,
        updatedAt: Date.now(),
      });
    }

    const conversation = await ctx.db
      .query("platformConversations")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        lastReadAt: args.readAt,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const upsertXActivitySubscriptionInternal = internalMutation({
  args: {
    userId: v.id("users"),
    xUserId: v.string(),
    eventType: xActivityEventTypeValidator,
    subscriptionId: v.string(),
    webhookId: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("xActivitySubscriptions")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", args.userId).eq("eventType", args.eventType)
      )
      .first();

    const payload = {
      xUserId: args.xUserId,
      eventType: args.eventType,
      subscriptionId: args.subscriptionId,
      webhookId: args.webhookId,
      tag: args.tag,
      updatedAt: now,
    };

    if (existing) {
      const patch = buildChangedPatchWithUpdatedAt(
        existing as unknown as Record<string, unknown>,
        payload,
        now
      );
      if (patch) {
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    return await ctx.db.insert("xActivitySubscriptions", {
      userId: args.userId,
      ...payload,
    });
  },
});

export const getXActivitySubscriptionByIdInternal = internalQuery({
  args: {
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("xActivitySubscriptions")
      .withIndex("by_subscription_id", (q) =>
        q.eq("subscriptionId", args.subscriptionId)
      )
      .first();
  },
});

export const listXActivitySubscriptionsForUserInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("xActivitySubscriptions")
      .withIndex("by_user_event", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const upsertXWebhookInternal = internalMutation({
  args: {
    webhookId: v.string(),
    url: v.string(),
    valid: v.boolean(),
    lastValidatedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("xWebhooks")
      .withIndex("by_webhook_id", (q) => q.eq("webhookId", args.webhookId))
      .first();

    const payload = {
      url: args.url,
      valid: args.valid,
      updatedAt: now,
      lastValidatedAt: args.lastValidatedAt,
      lastError: args.lastError,
    };

    if (existing) {
      const patch = buildChangedPatchWithUpdatedAt(
        existing as unknown as Record<string, unknown>,
        payload,
        now
      );
      if (patch) {
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    return await ctx.db.insert("xWebhooks", {
      webhookId: args.webhookId,
      ...payload,
    });
  },
});

export const getXWebhookByUrlInternal = internalQuery({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("xWebhooks")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();
  },
});
