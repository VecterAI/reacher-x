/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

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

    return { prospectId, workosUserId: `workos-${suffix}` };
  });
}

describe("platform conversation realtime revision", () => {
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
});
