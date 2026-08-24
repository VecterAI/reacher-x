/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  getCurrentUTCTimestamp,
  parseIsoToTimestamp,
} from "../shared/lib/utils/time/timeUtils";
import { buildPlatformConversationMediaCacheKey } from "./lib/platformConversationMediaCore";

const modules = import.meta.glob("./**/*.ts");

async function seedTwitterConversation(
  t: ReturnType<typeof convexTest>,
  suffix: string
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `workos-${suffix}`,
      email: `${suffix}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Workspace ${suffix}`,
      description: "Conversation revision test",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: `twitter-${suffix}`,
      data: {},
      status: "new",
      updatedAt: 1,
    });
    await ctx.db.insert("platformConversations", {
      userId,
      workspaceId,
      prospectId,
      platform: "twitter",
      conversationId: `conversation-${suffix}`,
      latestMessageId: `message-${suffix}`,
      latestMessageAt: 2,
      updatedAt: 3,
    });

    return { userId, prospectId, workosUserId: `workos-${suffix}` };
  });
}

describe("platform conversation realtime revision", () => {
  test("resolves a prospect conversation without loading its messages", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedTwitterConversation(t, "media-fast-path");

    await expect(
      t.query(
        internal.platformConversations
          .getConversationIdentityForProspectInternal,
        {
          userId: owner.userId,
          prospectId: owner.prospectId,
          platform: "twitter",
        }
      )
    ).resolves.toEqual({
      conversationId: "conversation-media-fast-path",
      participantUserId: undefined,
    });
  });

  test("serves cached XChat ciphertext without initializing the X provider", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedTwitterConversation(t, "cached-xchat-media");
    const mediaHashKey = "encrypted-media-hash";
    const conversationId = "conversation-cached-xchat-media";
    const expiresAt = getCurrentUTCTimestamp() + 60_000;
    await t.run(async (ctx) => {
      const blob = new Blob([new Uint8Array([1, 2, 3, 4])], {
        type: "application/octet-stream",
      });
      const storageId = await ctx.storage.store(blob);
      await ctx.db.insert("platformConversationMediaCache", {
        userId: owner.userId,
        prospectId: owner.prospectId,
        platform: "twitter",
        conversationId,
        cacheKey: buildPlatformConversationMediaCacheKey({
          platform: "twitter",
          conversationId,
          attachmentId: mediaHashKey,
        }),
        attachmentId: mediaHashKey,
        storageId,
        contentType: "application/octet-stream",
        size: blob.size,
        encrypted: true,
        createdAt: getCurrentUTCTimestamp(),
        expiresAt,
      });
    });

    await expect(
      t
        .withIdentity({ subject: owner.workosUserId })
        .action(api.x.getXChatEncryptedMedia, {
          prospectId: owner.prospectId,
          mediaHashKey,
        })
    ).resolves.toMatchObject({
      availability: "available",
      size: 4,
      expiresAt,
    });
  });

  test("returns only the authenticated user's X conversation revision", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedTwitterConversation(t, "owner");
    const outsider = await seedTwitterConversation(t, "outsider");

    await expect(
      t
        .withIdentity({ subject: owner.workosUserId })
        .query(api.platformConversations.getTwitterConversationRevision, {
          prospectId: owner.prospectId,
        })
    ).resolves.toEqual({
      updatedAt: 3,
      latestMessageId: "message-owner",
      latestMessageAt: 2,
    });

    await expect(
      t
        .withIdentity({ subject: outsider.workosUserId })
        .query(api.platformConversations.getTwitterConversationRevision, {
          prospectId: owner.prospectId,
        })
    ).resolves.toBeNull();
  });

  test("LinkedIn sync metadata does not create a new content revision", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "workos-linkedin-revision",
        email: "linkedin-revision@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "LinkedIn revision workspace",
        description: "Conversation revision test",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        userId,
        workspaceId,
        platform: "linkedin",
        origin: "workspace_discovery",
        externalId: "linkedin-revision",
        data: {},
        status: "new",
        updatedAt: 1,
      });
      return { userId, prospectId };
    });

    const upsertArgs = {
      userId: seeded.userId,
      prospectId: seeded.prospectId,
      platform: "linkedin" as const,
      conversationId: "linkedin-revision-conversation",
      lastSyncedAt: 10,
      lastSyncAttemptAt: 10,
      messages: [
        {
          messageId: "message-1",
          direction: "received" as const,
          text: "hello",
          createdAtMs: 2,
        },
      ],
    };
    await t.mutation(
      internal.platformConversations.upsertConversationSnapshotInternal,
      upsertArgs
    );
    const before = await t.run(async (ctx) =>
      ctx.db
        .query("platformConversations")
        .withIndex("by_user_conversation", (q) =>
          q
            .eq("userId", seeded.userId)
            .eq("conversationId", upsertArgs.conversationId)
        )
        .unique()
    );

    await t.mutation(
      internal.platformConversations.upsertConversationSnapshotInternal,
      { ...upsertArgs, lastSyncedAt: 20, lastSyncAttemptAt: 20 }
    );
    const after = await t.run(async (ctx) =>
      ctx.db
        .query("platformConversations")
        .withIndex("by_user_conversation", (q) =>
          q
            .eq("userId", seeded.userId)
            .eq("conversationId", upsertArgs.conversationId)
        )
        .unique()
    );

    expect(after?.lastSyncedAt).toBe(20);
    expect(after?.contentUpdatedAt).toBe(before?.contentUpdatedAt);
  });

  test("marks only sent messages read and advances the conversation receipt", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "workos-linkedin-read",
        email: "linkedin-read@example.com",
      });
      const conversationId = "linkedin-read-conversation";
      const conversationDocId = await ctx.db.insert("platformConversations", {
        userId,
        platform: "linkedin",
        conversationId,
        updatedAt: 1,
      });
      const sentMessageId = await ctx.db.insert(
        "platformConversationMessages",
        {
          userId,
          platform: "linkedin",
          conversationId,
          messageId: "sent",
          direction: "sent",
          createdAtMs: 2,
          updatedAt: 2,
        }
      );
      const receivedMessageId = await ctx.db.insert(
        "platformConversationMessages",
        {
          userId,
          platform: "linkedin",
          conversationId,
          messageId: "received",
          direction: "received",
          createdAtMs: 3,
          updatedAt: 3,
        }
      );
      return {
        userId,
        conversationId,
        conversationDocId,
        sentMessageId,
        receivedMessageId,
      };
    });

    await t.mutation(
      internal.platformConversations.markConversationMessagesReadInternal,
      {
        userId: seeded.userId,
        conversationId: seeded.conversationId,
        readAt: 100,
        seenBy: [{ senderName: "Recipient", seenAt: 100 }],
      }
    );

    const result = await t.run(async (ctx) => ({
      conversation: await ctx.db.get(seeded.conversationDocId),
      sent: await ctx.db.get(seeded.sentMessageId),
      received: await ctx.db.get(seeded.receivedMessageId),
    }));
    expect(result.conversation?.lastReadAt).toBe(100);
    expect(result.sent?.readAt).toBe(100);
    expect(result.sent?.seenBy).toEqual([
      { senderName: "Recipient", seenAt: 100 },
    ]);
    expect(result.received?.readAt).toBeUndefined();
  });

  test("applies a Unipile v1 message_read webhook to the outbound receipt", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "workos-linkedin-webhook-read",
        email: "linkedin-webhook-read@example.com",
      });
      const conversationId = "linkedin-webhook-read-conversation";
      await ctx.db.insert("linkedinAccounts", {
        userId,
        accountId: "linkedin-account",
        status: "connected",
        updatedAt: 1,
      });
      const conversationDocId = await ctx.db.insert("platformConversations", {
        userId,
        platform: "linkedin",
        conversationId,
        accountId: "linkedin-account",
        updatedAt: 1,
      });
      const sentMessageId = await ctx.db.insert(
        "platformConversationMessages",
        {
          userId,
          platform: "linkedin",
          conversationId,
          messageId: "webhook-sent",
          direction: "sent",
          createdAtMs: 2,
          updatedAt: 2,
        }
      );
      const receivedMessageId = await ctx.db.insert(
        "platformConversationMessages",
        {
          userId,
          platform: "linkedin",
          conversationId,
          messageId: "webhook-received",
          direction: "received",
          createdAtMs: 3,
          updatedAt: 3,
        }
      );
      return {
        conversationDocId,
        sentMessageId,
        receivedMessageId,
      };
    });
    const readAt = "2026-08-23T12:00:00.000Z";

    await expect(
      t.action(internal.linkedin.handleUnipileWebhookPayloadInternal, {
        payload: {
          event: "message_read",
          account_id: "linkedin-account",
          chat_id: "linkedin-webhook-read-conversation",
          timestamp: readAt,
          sender: {
            attendee_provider_id: "recipient-provider-id",
            attendee_name: "Recipient",
          },
        },
      })
    ).resolves.toEqual({ processed: true });

    const result = await t.run(async (ctx) => ({
      conversation: await ctx.db.get(seeded.conversationDocId),
      sent: await ctx.db.get(seeded.sentMessageId),
      received: await ctx.db.get(seeded.receivedMessageId),
    }));
    const expectedReadAt = parseIsoToTimestamp(readAt);
    expect(result.conversation?.lastReadAt).toBe(expectedReadAt);
    expect(result.sent?.readAt).toBe(expectedReadAt);
    expect(result.received?.readAt).toBeUndefined();
  });
});
