/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedOperationOwner(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "xchat-idempotency-user",
      email: "xchat-idempotency@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "XChat idempotency",
      description: "Encrypted send retry test",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: "twitter-xchat-idempotency",
      data: {},
      status: "new",
      updatedAt: 1,
    });
    return { userId, prospectId };
  });
}

describe("XChat encrypted send idempotency", () => {
  test("leases one stable payload, rejects mismatches, and deduplicates terminal retries", async () => {
    const t = convexTest(schema, modules);
    const { userId, prospectId } = await seedOperationOwner(t);
    const operation = {
      userId,
      prospectId,
      clientRequestId: "client-request-1",
      conversationId: "1-2",
      messageId: "message-1",
      encodedMessageCreateEvent: "encrypted-event",
      encodedMessageEventSignature: "encrypted-signature",
    };

    const first = await t.mutation(
      internal.xChatSendOperations.acquireXChatSendLeaseInternal,
      { ...operation, leaseId: "lease-1", now: 1_000 }
    );
    expect(first).toMatchObject({ kind: "acquired", existed: false });
    if (first.kind !== "acquired") {
      throw new Error("Expected the first send lease to be acquired");
    }

    await expect(
      t.mutation(internal.xChatSendOperations.acquireXChatSendLeaseInternal, {
        ...operation,
        encodedMessageCreateEvent: "different-encrypted-event",
        leaseId: "lease-mismatch",
        now: 1_001,
      })
    ).rejects.toThrow("already bound");

    await expect(
      t.mutation(internal.xChatSendOperations.acquireXChatSendLeaseInternal, {
        ...operation,
        clientRequestId: "different-client-request",
        leaseId: "lease-message-reuse",
        now: 1_002,
      })
    ).rejects.toThrow("message ID is already bound");

    const concurrent = await t.mutation(
      internal.xChatSendOperations.acquireXChatSendLeaseInternal,
      { ...operation, leaseId: "lease-2", now: 1_003 }
    );
    expect(concurrent).toMatchObject({
      kind: "in_progress",
      operationId: first.operationId,
    });

    await t.mutation(
      internal.xChatSendOperations.releaseXChatSendLeaseInternal,
      { operationId: first.operationId, leaseId: "lease-1", now: 1_004 }
    );
    const retry = await t.mutation(
      internal.xChatSendOperations.acquireXChatSendLeaseInternal,
      { ...operation, leaseId: "lease-3", now: 1_005 }
    );
    expect(retry).toMatchObject({
      kind: "acquired",
      operationId: first.operationId,
      existed: true,
      encodedMessageCreateEvent: operation.encodedMessageCreateEvent,
    });

    await t.mutation(internal.xChatSendOperations.markXChatSendSentInternal, {
      operationId: first.operationId,
      expectedMessageId: operation.messageId,
      now: 1_006,
    });
    const terminalRetry = await t.mutation(
      internal.xChatSendOperations.acquireXChatSendLeaseInternal,
      { ...operation, leaseId: "lease-4", now: 1_007 }
    );
    expect(terminalRetry).toEqual({
      kind: "sent",
      operationId: first.operationId,
      messageId: operation.messageId,
    });

    const stored = await t.query(
      internal.xChatSendOperations.getXChatSendOperationInternal,
      {
        userId,
        clientRequestId: operation.clientRequestId,
      }
    );
    expect(stored).toMatchObject({
      status: "sent",
      attemptCount: 2,
      messageId: operation.messageId,
    });
    if (!stored) {
      throw new Error("Expected the persisted send operation");
    }

    await t.mutation(
      internal.xChatSendOperations.cleanupXChatSendOperationInternal,
      {
        operationId: first.operationId,
        expectedExpiresAt: stored.expiresAt,
      }
    );
    await expect(
      t.query(internal.xChatSendOperations.getXChatSendOperationInternal, {
        userId,
        clientRequestId: operation.clientRequestId,
      })
    ).resolves.toBeNull();
  });
});
