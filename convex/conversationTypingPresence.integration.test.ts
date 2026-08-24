/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Twitter conversation typing presence", () => {
  test("is reactive for the owner and clears when the message arrives", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "typing-owner",
        email: "typing-owner@example.com",
      });
      await ctx.db.insert("users", {
        workosUserId: "typing-outsider",
        email: "typing-outsider@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Typing test",
        description: "Typing test",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "typing-prospect",
        data: {},
        status: "new",
        updatedAt: 1,
      });
      await ctx.db.insert("platformConversations", {
        userId,
        workspaceId,
        prospectId,
        platform: "twitter",
        conversationId: "owner-participant",
        participantUserId: "participant",
        updatedAt: 1,
      });
      return { userId, prospectId };
    });

    const receivedAt = Date.now();

    await t.mutation(
      internal.conversationTypingPresence.upsertTwitterInternal,
      {
        userId: seeded.userId,
        conversationId: "owner-participant",
        senderUserId: "participant",
        receivedAt,
      }
    );

    await expect(
      t
        .withIdentity({ subject: "typing-owner" })
        .query(api.conversationTypingPresence.getTwitterForProspect, {
          prospectId: seeded.prospectId,
        })
    ).resolves.toEqual({
      senderUserId: "participant",
      expiresAt: receivedAt + 7_000,
    });

    await expect(
      t
        .withIdentity({ subject: "typing-outsider" })
        .query(api.conversationTypingPresence.getTwitterForProspect, {
          prospectId: seeded.prospectId,
        })
    ).resolves.toBeNull();

    await t.mutation(
      internal.conversationTypingPresence.upsertTwitterInternal,
      {
        userId: seeded.userId,
        conversationId: "owner-participant",
        senderUserId: "participant",
        receivedAt: 1,
      }
    );
    await expect(
      t
        .withIdentity({ subject: "typing-owner" })
        .query(api.conversationTypingPresence.getTwitterForProspect, {
          prospectId: seeded.prospectId,
        })
    ).resolves.toBeNull();

    await t.mutation(internal.conversationTypingPresence.clearTwitterInternal, {
      userId: seeded.userId,
      conversationId: "owner-participant",
    });

    await expect(
      t
        .withIdentity({ subject: "typing-owner" })
        .query(api.conversationTypingPresence.getTwitterForProspect, {
          prospectId: seeded.prospectId,
        })
    ).resolves.toBeNull();
  });

  test("routes the documented X webhook payload to the matching conversation", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "typing-webhook-owner",
        email: "typing-webhook-owner@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Typing webhook test",
        description: "Typing webhook test",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "typing-webhook-prospect",
        data: {},
        status: "new",
        updatedAt: 1,
      });
      await ctx.db.insert("xAccounts", {
        userId,
        xUserId: "recipient-x-user",
        username: "recipient",
        accessToken: "unused-for-typing-webhook",
        expiresAt: 9_999_999_999_999,
        grantedScopes: ["dm.read"],
        tokenType: "bearer",
        status: "connected",
        updatedAt: 1,
      });
      await ctx.db.insert("platformConversations", {
        userId,
        workspaceId,
        prospectId,
        platform: "twitter",
        conversationId: "recipient-sender",
        participantUserId: "sender-x-user",
        updatedAt: 1,
      });
      return { prospectId };
    });

    const result = await t.action(
      internal.xActivity.handleWebhookPayloadInternal,
      {
        payload: {
          data: {
            event_type: "dm.indicate_typing",
            filter: { user_id: "recipient-x-user" },
            payload: {
              created_timestamp: "1518127183443",
              sender_id: "sender-x-user",
              target: { recipient_id: "recipient-x-user" },
            },
          },
        },
      }
    );

    expect(result.processed).toBe(1);
    expect(result.results).toEqual([
      {
        ignored: false,
        eventType: "dm.indicate_typing",
        conversationId: "recipient-sender",
      },
    ]);

    const presence = await t
      .withIdentity({ subject: "typing-webhook-owner" })
      .query(api.conversationTypingPresence.getTwitterForProspect, {
        prospectId: seeded.prospectId,
      });
    expect(presence?.senderUserId).toBe("sender-x-user");
    expect(presence?.expiresAt).toBeGreaterThan(Date.now());
    const storedPresence = await t.run((ctx) =>
      ctx.db.query("platformConversationTypingPresence").first()
    );
    expect(storedPresence?.senderUserId).toBe("sender-x-user");
  });
});
