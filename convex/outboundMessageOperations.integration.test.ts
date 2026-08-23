/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedQueue(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "outbound-owner",
      email: "outbound-owner@example.com",
    });
    const outsiderId = await ctx.db.insert("users", {
      workosUserId: "outbound-outsider",
      email: "outbound-outsider@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Outbound queue",
      description: "Outbound queue tests",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: "outbound-twitter",
      data: {},
      status: "new",
      updatedAt: 1,
    });
    return { outsiderId, prospectId, userId };
  });
}

describe("durable outbound message queue", () => {
  test("records intent idempotently and enforces ownership", async () => {
    const t = convexTest(schema, modules);
    const { prospectId } = await seedQueue(t);
    const owner = t.withIdentity({ subject: "outbound-owner" });
    const args = {
      prospectId,
      platform: "twitter" as const,
      clientRequestId: "request-1",
      conversationId: "conversation-1",
      text: "Hello",
      mediaUrls: ["https://storage.example/demo.mp4"],
      mediaDescriptions: ["Product demo"],
      mediaKinds: ["video" as const],
      mediaFileNames: ["demo.mp4"],
      mediaMetadata: [
        {
          width: 1080,
          height: 1920,
          durationMs: 6_400,
          mimeType: "video/mp4",
          fileSize: 12_345,
        },
      ],
    };

    const first = await owner.mutation(
      api.outboundMessageOperations.queueMessage,
      args
    );
    const duplicate = await owner.mutation(
      api.outboundMessageOperations.queueMessage,
      args
    );
    expect(duplicate.operationId).toBe(first.operationId);
    expect(first).toMatchObject({
      mediaKinds: ["video"],
      mediaFileNames: ["demo.mp4"],
      mediaMetadata: [
        {
          width: 1080,
          height: 1920,
          durationMs: 6_400,
          mimeType: "video/mp4",
          fileSize: 12_345,
        },
      ],
    });
    await expect(
      t
        .withIdentity({ subject: "outbound-outsider" })
        .query(api.outboundMessageOperations.listForProspect, {
          prospectId,
          platform: "twitter",
        })
    ).rejects.toThrow("Not authorized");
    await expect(
      owner.mutation(api.outboundMessageOperations.queueMessage, {
        ...args,
        clientRequestId: "request-wrong-platform",
        platform: "linkedin",
      })
    ).rejects.toThrow("platform");
  });

  test("serializes sends, records failure, and supports explicit retry", async () => {
    const t = convexTest(schema, modules);
    const { prospectId, userId } = await seedQueue(t);
    const owner = t.withIdentity({ subject: "outbound-owner" });
    const first = await owner.mutation(
      api.outboundMessageOperations.queueMessage,
      {
        prospectId,
        platform: "twitter",
        clientRequestId: "request-1",
        text: "First",
      }
    );
    await owner.mutation(api.outboundMessageOperations.queueMessage, {
      prospectId,
      platform: "twitter",
      clientRequestId: "request-2",
      text: "Second",
    });

    const acquired = await t.mutation(
      internal.outboundMessageOperations.acquireNextInternal,
      {
        userId,
        prospectId,
        platform: "twitter",
        leaseId: "lease-1",
        now: 1_000,
      }
    );
    expect(acquired).toMatchObject({
      kind: "acquired",
      operationId: first.operationId,
      text: "First",
    });
    const busy = await t.mutation(
      internal.outboundMessageOperations.acquireNextInternal,
      {
        userId,
        prospectId,
        platform: "twitter",
        leaseId: "lease-2",
        now: 1_001,
      }
    );
    expect(busy.kind).toBe("busy");
    if (acquired.kind !== "acquired") {
      throw new Error("Expected queue lease");
    }
    await t.mutation(internal.outboundMessageOperations.markFailedInternal, {
      operationId: acquired.operationId,
      leaseId: acquired.leaseId,
      errorMessage: "Provider unavailable",
      now: 1_002,
    });
    await owner.mutation(api.outboundMessageOperations.retryMessage, {
      operationId: first.operationId,
    });
    const retried = await t.mutation(
      internal.outboundMessageOperations.acquireNextInternal,
      {
        userId,
        prospectId,
        platform: "twitter",
        leaseId: "lease-3",
        now: 1_003,
      }
    );
    expect(retried).toMatchObject({
      kind: "acquired",
      operationId: first.operationId,
      text: "First",
    });
    if (retried.kind !== "acquired") {
      throw new Error("Expected retry lease");
    }
    await t.mutation(internal.outboundMessageOperations.markSentInternal, {
      operationId: retried.operationId,
      leaseId: retried.leaseId,
      conversationId: "conversation-1",
      providerMessageId: "provider-message-1",
      now: 1_004,
    });
    const second = await t.mutation(
      internal.outboundMessageOperations.acquireNextInternal,
      {
        userId,
        prospectId,
        platform: "twitter",
        leaseId: "lease-4",
        now: 1_005,
      }
    );
    expect(second).toMatchObject({ kind: "acquired", text: "Second" });

    const visible = await owner.query(
      api.outboundMessageOperations.listForProspect,
      { prospectId, platform: "twitter" }
    );
    expect(visible.map((operation) => operation.status)).toEqual([
      "sent",
      "sending",
    ]);
  });
});
