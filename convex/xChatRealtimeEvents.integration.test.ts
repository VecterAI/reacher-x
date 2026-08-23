/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("XChat realtime ciphertext delivery", () => {
  test("deduplicates webhook retries and exposes events only to the owner", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "workos-owner",
        email: "owner@example.com",
      });
      const outsiderId = await ctx.db.insert("users", {
        workosUserId: "workos-outsider",
        email: "outsider@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Realtime workspace",
        description: "XChat test",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "twitter-prospect",
        data: {},
        status: "new",
        updatedAt: 1,
      });
      return { outsiderId, prospectId, userId, workspaceId };
    });

    const event = {
      userId: seeded.userId,
      workspaceId: seeded.workspaceId,
      prospectId: seeded.prospectId,
      conversationId: "123-456",
      eventId: "event-1",
      senderId: "456",
      createdAtMs: 2,
      encodedEvent: "ciphertext",
      receivedAt: 3,
    };
    await t.mutation(internal.xChatRealtimeEvents.upsertInternal, event);
    await t.mutation(internal.xChatRealtimeEvents.upsertInternal, event);

    await expect(
      t
        .withIdentity({ subject: "workos-owner" })
        .query(api.xChatRealtimeEvents.getForProspect, {
          prospectId: seeded.prospectId,
        })
    ).resolves.toEqual({
      conversationId: "123-456",
      events: [
        {
          id: "event-1",
          conversationId: "123-456",
          senderId: "456",
          createdAtMs: 2,
          encodedEvent: "ciphertext",
        },
      ],
    });

    await expect(
      t
        .withIdentity({ subject: "workos-outsider" })
        .query(api.xChatRealtimeEvents.getForProspect, {
          prospectId: seeded.prospectId,
        })
    ).resolves.toBeNull();
  });
});
