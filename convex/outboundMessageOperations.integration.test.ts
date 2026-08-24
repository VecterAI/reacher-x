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
  test("uses authoritative temporary voice metadata and enforces ownership", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "linkedin-voice-owner",
        email: "linkedin-voice-owner@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "LinkedIn voice queue",
        description: "LinkedIn voice queue tests",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "linkedin",
        origin: "workspace_discovery",
        externalId: "linkedin-voice",
        data: {},
        status: "new",
        updatedAt: 1,
      });
      const storageId = await ctx.storage.store(
        new Blob(["validated-audio"], { type: "audio/x-m4a" })
      );
      const cacheId = await ctx.db.insert("platformConversationMediaCache", {
        userId,
        prospectId,
        platform: "linkedin",
        conversationId: "linkedin-chat",
        cacheKey: "outbound-voice-test",
        attachmentId: String(storageId),
        storageId,
        contentType: "audio/x-m4a",
        fileName: "voice-note.m4a",
        size: 15,
        encrypted: false,
        purpose: "outbound_voice_note",
        durationMs: 5_000,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
      return { cacheId, prospectId, storageId, userId };
    });
    const owner = t.withIdentity({ subject: "linkedin-voice-owner" });
    const queued = await owner.mutation(
      api.outboundMessageOperations.queueMessage,
      {
        prospectId: seeded.prospectId,
        platform: "linkedin",
        clientRequestId: "voice-request",
        text: "",
        mediaUrls: ["https://forged.example/voice.mp3"],
        mediaMetadata: [
          { durationMs: 999_999, mimeType: "audio/mpeg", fileSize: 999 },
        ],
        voiceNoteCacheId: seeded.cacheId,
      }
    );
    expect(queued).toMatchObject({
      mediaKinds: ["file"],
      mediaFileNames: ["voice-note.m4a"],
      mediaMetadata: [
        { durationMs: 5_000, mimeType: "audio/x-m4a", fileSize: 15 },
      ],
      voiceNoteCacheId: seeded.cacheId,
    });
    expect(queued.mediaUrls?.[0]).not.toBe("https://forged.example/voice.mp3");
    await expect(
      owner.mutation(api.outboundMessageOperations.queueMessage, {
        prospectId: seeded.prospectId,
        platform: "linkedin",
        clientRequestId: "voice-with-text",
        text: "not allowed",
        voiceNoteCacheId: seeded.cacheId,
      })
    ).rejects.toThrow("by itself");

    const acquired = await t.mutation(
      internal.outboundMessageOperations.acquireNextInternal,
      {
        userId: seeded.userId,
        prospectId: seeded.prospectId,
        platform: "linkedin",
        leaseId: "voice-lease",
        now: 10_000,
      }
    );
    if (acquired.kind !== "acquired") {
      throw new Error("Expected voice-note queue lease");
    }
    await t.mutation(internal.outboundMessageOperations.markSentInternal, {
      operationId: acquired.operationId,
      leaseId: acquired.leaseId,
      conversationId: "linkedin-chat",
      providerMessageId: "linkedin-message",
      now: 10_001,
    });
    const retainedPreview = await t.run(async (ctx) =>
      ctx.db.get(seeded.cacheId)
    );
    expect(retainedPreview?.expiresAt).toBe(10_001 + 15 * 60 * 1000);

    await t.mutation(
      internal.platformConversationMedia.deleteCachedMediaNowInternal,
      { cacheId: seeded.cacheId }
    );
    await t.run(async (ctx) => {
      expect(await ctx.db.get(seeded.cacheId)).toBeNull();
      expect(await ctx.db.system.get("_storage", seeded.storageId)).toBeNull();
    });
  });

  test("records intent idempotently and enforces ownership", async () => {
    const t = convexTest(schema, modules);
    const { prospectId, userId } = await seedQueue(t);
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
      t.mutation(internal.outboundMessageOperations.acquireNextInternal, {
        userId,
        prospectId,
        platform: "twitter",
        leaseId: "metadata-lease",
        now: 1_000,
      })
    ).resolves.toMatchObject({
      kind: "acquired",
      mediaMetadata: args.mediaMetadata,
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
