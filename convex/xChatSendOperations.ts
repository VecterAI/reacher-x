import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  internalMutation,
  internalQuery,
  mutation,
} from "./lib/functionBuilders";
import { requireUser } from "./lib/accessHelpers";
import {
  assertMatchingEncryptedXChatSendOperation,
  XCHAT_SEND_LEASE_MS,
  XCHAT_SEND_OPERATION_TTL_MS,
} from "./lib/xChatSendCore";
import {
  xChatSendLeaseResultValidator,
  xChatSendStoredOperationValidator,
} from "./validators";

type StoredOperation = {
  operationId: Id<"xChatSendOperations">;
  userId: Id<"users">;
  prospectId: Id<"prospects">;
  clientRequestId: string;
  conversationId: string;
  messageId: string;
  encodedMessageCreateEvent: string;
  encodedMessageEventSignature: string;
  status: "pending" | "sending" | "sent";
  leaseExpiresAt?: number;
  attemptCount: number;
  expiresAt: number;
};

type LeaseResult =
  | {
      kind: "sent";
      operationId: Id<"xChatSendOperations">;
      messageId: string;
    }
  | {
      kind: "in_progress";
      operationId: Id<"xChatSendOperations">;
      retryAt: number;
    }
  | {
      kind: "acquired";
      operationId: Id<"xChatSendOperations">;
      messageId: string;
      encodedMessageCreateEvent: string;
      encodedMessageEventSignature: string;
      existed: boolean;
    };

/** One-use upload URL for browser-encrypted XChat media ciphertext. */
export const generateEncryptedMediaUploadUrl = mutation({
  args: { prospectId: v.id("prospects") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const prospect = await ctx.db.get(args.prospectId);
    if (
      !prospect ||
      prospect.userId !== user._id ||
      prospect.platform !== "twitter"
    ) {
      throw new Error("X prospect not found or not authorized.");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const deleteTemporaryEncryptedMediaInternal = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stored = await ctx.db.system.get("_storage", args.storageId);
    if (stored) {
      await ctx.storage.delete(args.storageId);
    }
    return null;
  },
});

function toStoredOperation(row: {
  _id: Id<"xChatSendOperations">;
  userId: Id<"users">;
  prospectId: Id<"prospects">;
  clientRequestId: string;
  conversationId: string;
  messageId: string;
  encodedMessageCreateEvent: string;
  encodedMessageEventSignature: string;
  status: "pending" | "sending" | "sent";
  leaseExpiresAt?: number;
  attemptCount: number;
  expiresAt: number;
}): StoredOperation {
  return {
    operationId: row._id,
    userId: row.userId,
    prospectId: row.prospectId,
    clientRequestId: row.clientRequestId,
    conversationId: row.conversationId,
    messageId: row.messageId,
    encodedMessageCreateEvent: row.encodedMessageCreateEvent,
    encodedMessageEventSignature: row.encodedMessageEventSignature,
    status: row.status,
    leaseExpiresAt: row.leaseExpiresAt,
    attemptCount: row.attemptCount,
    expiresAt: row.expiresAt,
  };
}

export const getXChatSendOperationInternal = internalQuery({
  args: {
    userId: v.id("users"),
    clientRequestId: v.string(),
  },
  returns: v.union(v.null(), xChatSendStoredOperationValidator),
  handler: async (ctx, args): Promise<StoredOperation | null> => {
    const row = await ctx.db
      .query("xChatSendOperations")
      .withIndex("by_user_id_and_client_request_id", (q) =>
        q.eq("userId", args.userId).eq("clientRequestId", args.clientRequestId)
      )
      .unique();
    return row ? toStoredOperation(row) : null;
  },
});

export const acquireXChatSendLeaseInternal = internalMutation({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    clientRequestId: v.string(),
    conversationId: v.string(),
    messageId: v.string(),
    encodedMessageCreateEvent: v.string(),
    encodedMessageEventSignature: v.string(),
    leaseId: v.string(),
    now: v.number(),
  },
  returns: xChatSendLeaseResultValidator,
  handler: async (ctx, args): Promise<LeaseResult> => {
    const existing = await ctx.db
      .query("xChatSendOperations")
      .withIndex("by_user_id_and_client_request_id", (q) =>
        q.eq("userId", args.userId).eq("clientRequestId", args.clientRequestId)
      )
      .unique();

    if (existing) {
      assertMatchingEncryptedXChatSendOperation(existing, {
        prospectId: args.prospectId,
        conversationId: args.conversationId,
        clientRequestId: args.clientRequestId,
        messageId: args.messageId,
        encodedMessageCreateEvent: args.encodedMessageCreateEvent,
        encodedMessageEventSignature: args.encodedMessageEventSignature,
      });
      if (existing.status === "sent") {
        return {
          kind: "sent",
          operationId: existing._id,
          messageId: existing.messageId,
        };
      }
      if (
        existing.status === "sending" &&
        typeof existing.leaseExpiresAt === "number" &&
        existing.leaseExpiresAt > args.now
      ) {
        return {
          kind: "in_progress",
          operationId: existing._id,
          retryAt: existing.leaseExpiresAt,
        };
      }

      await ctx.db.patch(existing._id, {
        status: "sending",
        leaseId: args.leaseId,
        leaseExpiresAt: args.now + XCHAT_SEND_LEASE_MS,
        attemptCount: existing.attemptCount + 1,
        updatedAt: args.now,
      });
      return {
        kind: "acquired",
        operationId: existing._id,
        messageId: existing.messageId,
        encodedMessageCreateEvent: existing.encodedMessageCreateEvent,
        encodedMessageEventSignature: existing.encodedMessageEventSignature,
        existed: true,
      };
    }

    const messageOperation = await ctx.db
      .query("xChatSendOperations")
      .withIndex("by_user_id_and_message_id", (q) =>
        q.eq("userId", args.userId).eq("messageId", args.messageId)
      )
      .unique();
    if (messageOperation) {
      throw new Error(
        "This encrypted XChat message ID is already bound to another client request."
      );
    }

    const expiresAt = args.now + XCHAT_SEND_OPERATION_TTL_MS;
    const operationId = await ctx.db.insert("xChatSendOperations", {
      userId: args.userId,
      prospectId: args.prospectId,
      clientRequestId: args.clientRequestId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      encodedMessageCreateEvent: args.encodedMessageCreateEvent,
      encodedMessageEventSignature: args.encodedMessageEventSignature,
      status: "sending",
      leaseId: args.leaseId,
      leaseExpiresAt: args.now + XCHAT_SEND_LEASE_MS,
      attemptCount: 1,
      createdAt: args.now,
      updatedAt: args.now,
      expiresAt,
    });
    await ctx.scheduler.runAt(
      expiresAt,
      internal.xChatSendOperations.cleanupXChatSendOperationInternal,
      { operationId, expectedExpiresAt: expiresAt }
    );
    return {
      kind: "acquired",
      operationId,
      messageId: args.messageId,
      encodedMessageCreateEvent: args.encodedMessageCreateEvent,
      encodedMessageEventSignature: args.encodedMessageEventSignature,
      existed: false,
    };
  },
});

export const markXChatSendSentInternal = internalMutation({
  args: {
    operationId: v.id("xChatSendOperations"),
    expectedMessageId: v.string(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.operationId);
    if (!row || row.messageId !== args.expectedMessageId) {
      throw new Error("XChat send operation is no longer available.");
    }
    if (row.status !== "sent") {
      await ctx.db.patch(row._id, {
        status: "sent",
        sentAt: args.now,
        updatedAt: args.now,
      });
    }
    return null;
  },
});

export const releaseXChatSendLeaseInternal = internalMutation({
  args: {
    operationId: v.id("xChatSendOperations"),
    leaseId: v.string(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.operationId);
    if (row?.status === "sending" && row.leaseId === args.leaseId) {
      await ctx.db.patch(row._id, {
        status: "pending",
        updatedAt: args.now,
      });
    }
    return null;
  },
});

export const cleanupXChatSendOperationInternal = internalMutation({
  args: {
    operationId: v.id("xChatSendOperations"),
    expectedExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.operationId);
    if (!row || row.expiresAt !== args.expectedExpiresAt) {
      return null;
    }
    const now = getCurrentUTCTimestamp();
    if (row.expiresAt > now) {
      await ctx.scheduler.runAt(
        row.expiresAt,
        internal.xChatSendOperations.cleanupXChatSendOperationInternal,
        args
      );
      return null;
    }
    await ctx.db.delete(row._id);
    return null;
  },
});
