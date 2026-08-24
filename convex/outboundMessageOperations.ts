import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { requireOwnedProspect, requireUser } from "./lib/accessHelpers";
import {
  outboundMessageOperationValidator,
  outboundMessageMediaMetadataValidator,
  platformConversationPlatformValidator,
  twitterMediaKindValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  getDmTextLimitError,
  hasDmBody,
} from "../shared/lib/twitter/xPostTextLimit";
import { LINKEDIN_DM_TEXT_MAX } from "../shared/lib/linkedin/conversation";
import { getOutboundMessageFailure } from "../shared/lib/platforms/outboundMessageFailure";

const OUTBOUND_OPERATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SENT_OPERATION_TTL_MS = 24 * 60 * 60 * 1000;
const SENT_VOICE_NOTE_CACHE_TTL_MS = 15 * 60 * 1000;
const SEND_LEASE_MS = 2 * 60 * 1000;
const BUSY_RETRY_MS = 1_000;
const MAX_VISIBLE_OPERATIONS = 50;

type Platform = "twitter" | "linkedin";

type OutboundMediaMetadata = {
  width?: number;
  height?: number;
  durationMs?: number;
  mimeType?: string;
  fileSize?: number;
};

type ProviderSendResult = {
  conversationId?: string;
  messageId?: string;
};

async function extendVoiceNoteCacheExpiry(
  ctx: MutationCtx,
  cacheId: Id<"platformConversationMediaCache"> | undefined,
  expiresAt: number
) {
  if (!cacheId) return;
  const cached = await ctx.db.get(cacheId);
  if (!cached) return;
  await ctx.db.patch(cached._id, { expiresAt });
  await ctx.scheduler.runAt(
    expiresAt,
    internal.platformConversationMedia.deleteCachedMediaInternal,
    {
      cacheId: cached._id,
      expectedStorageId: cached.storageId,
      expectedExpiresAt: expiresAt,
    }
  );
}

function normalizeOptionalStrings(values?: string[]): string[] | undefined {
  const normalized = (values ?? []).filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0
  );
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMediaDescriptions(
  values: string[] | undefined,
  mediaCount: number
): string[] | undefined {
  if (!values || mediaCount === 0) return undefined;
  return values.slice(0, mediaCount).map((value) => value.trim());
}

function normalizeMediaMetadata(
  values: string[] | undefined,
  mediaCount: number
): string[] | undefined {
  if (!values || mediaCount === 0) return undefined;
  return values.slice(0, mediaCount).map((value) => value.trim());
}

function normalizePositiveNumber(
  value: number | undefined
): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function normalizeOutboundMediaMetadata(
  values: OutboundMediaMetadata[] | undefined,
  mediaCount: number
): OutboundMediaMetadata[] | undefined {
  if (!values || mediaCount === 0) return undefined;
  return values.slice(0, mediaCount).map((value) => {
    const width = normalizePositiveNumber(value.width);
    const height = normalizePositiveNumber(value.height);
    const durationMs = normalizePositiveNumber(value.durationMs);
    const fileSize = normalizePositiveNumber(value.fileSize);
    const mimeType = value.mimeType?.trim() || undefined;
    return {
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(durationMs ? { durationMs } : {}),
      ...(mimeType ? { mimeType } : {}),
      ...(fileSize ? { fileSize } : {}),
    };
  });
}

function areOutboundMediaMetadataEqual(
  left: OutboundMediaMetadata[] | undefined,
  right: OutboundMediaMetadata[] | undefined
): boolean {
  const leftValues = left ?? [];
  const rightValues = right ?? [];
  return (
    leftValues.length === rightValues.length &&
    leftValues.every((value, index) => {
      const other = rightValues[index];
      return (
        value.width === other?.width &&
        value.height === other?.height &&
        value.durationMs === other?.durationMs &&
        value.mimeType === other?.mimeType &&
        value.fileSize === other?.fileSize
      );
    })
  );
}

function assertValidMessage(args: {
  platform: Platform;
  text: string;
  mediaUrls?: string[];
  clientRequestId: string;
}) {
  if (!args.clientRequestId.trim() || args.clientRequestId.length > 128) {
    throw new Error("Message request identifier is invalid.");
  }
  if (!hasDmBody(args.text, args.mediaUrls)) {
    throw new Error("Message text or an attachment is required.");
  }
  if (args.platform === "twitter") {
    if ((args.mediaUrls?.length ?? 0) > 1) {
      throw new Error("X/Twitter DMs support one attachment per message.");
    }
    const limitError = getDmTextLimitError(args.text.trim());
    if (limitError) throw new Error(limitError);
    return;
  }
  if ((args.mediaUrls?.length ?? 0) > 4) {
    throw new Error("LinkedIn messages support up to four attachments.");
  }
  if (args.text.trim().length > LINKEDIN_DM_TEXT_MAX) {
    throw new Error(
      `LinkedIn DM text exceeds limit (${args.text.trim().length} characters, max ${LINKEDIN_DM_TEXT_MAX}).`
    );
  }
}

function toPublicOperation(row: {
  _id: Id<"outboundMessageOperations">;
  clientRequestId: string;
  prospectId: Id<"prospects">;
  platform: Platform;
  conversationId?: string;
  text: string;
  mediaUrls?: string[];
  mediaDescriptions?: string[];
  mediaKinds?: Array<"image" | "video" | "gif" | "file">;
  mediaFileNames?: string[];
  mediaMetadata?: OutboundMediaMetadata[];
  voiceNoteCacheId?: Id<"platformConversationMediaCache">;
  quoteId?: string;
  status: "queued" | "sending" | "sent" | "failed";
  attemptCount: number;
  createdAt: number;
  updatedAt: number;
  sentAt?: number;
  providerMessageId?: string;
  errorMessage?: string;
}) {
  return {
    operationId: row._id,
    clientRequestId: row.clientRequestId,
    prospectId: row.prospectId,
    platform: row.platform,
    conversationId: row.conversationId,
    text: row.text,
    mediaUrls: row.mediaUrls,
    mediaDescriptions: row.mediaDescriptions,
    mediaKinds: row.mediaKinds,
    mediaFileNames: row.mediaFileNames,
    mediaMetadata: row.mediaMetadata,
    voiceNoteCacheId: row.voiceNoteCacheId,
    quoteId: row.quoteId,
    status: row.status,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sentAt: row.sentAt,
    providerMessageId: row.providerMessageId,
    errorMessage: row.errorMessage,
  };
}

export const listForProspect = query({
  args: {
    prospectId: v.id("prospects"),
    platform: platformConversationPlatformValidator,
  },
  returns: v.array(outboundMessageOperationValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnedProspect(ctx, args.prospectId, { user });
    const rows = await ctx.db
      .query("outboundMessageOperations")
      .withIndex("by_user_and_prospect_and_platform_and_created_at", (q) =>
        q
          .eq("userId", user._id)
          .eq("prospectId", args.prospectId)
          .eq("platform", args.platform)
      )
      .order("desc")
      .take(MAX_VISIBLE_OPERATIONS);
    return rows.reverse().map(toPublicOperation);
  },
});

export const listSentMetadataInternal = internalQuery({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    platform: platformConversationPlatformValidator,
  },
  returns: v.array(
    v.object({
      providerMessageId: v.string(),
      mediaDescriptions: v.optional(v.array(v.string())),
      mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
      mediaFileNames: v.optional(v.array(v.string())),
      mediaMetadata: v.optional(v.array(outboundMessageMediaMetadataValidator)),
    })
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("outboundMessageOperations")
      .withIndex("by_user_and_prospect_and_platform_and_created_at", (q) =>
        q
          .eq("userId", args.userId)
          .eq("prospectId", args.prospectId)
          .eq("platform", args.platform)
      )
      .order("desc")
      .take(MAX_VISIBLE_OPERATIONS);
    return rows.flatMap((row) =>
      row.status === "sent" && row.providerMessageId
        ? [
            {
              providerMessageId: row.providerMessageId,
              mediaDescriptions: row.mediaDescriptions,
              mediaKinds: row.mediaKinds,
              mediaFileNames: row.mediaFileNames,
              mediaMetadata: row.mediaMetadata,
            },
          ]
        : []
    );
  },
});

export const queueMessage = mutation({
  args: {
    prospectId: v.id("prospects"),
    platform: platformConversationPlatformValidator,
    clientRequestId: v.string(),
    conversationId: v.optional(v.string()),
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
    mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
    mediaFileNames: v.optional(v.array(v.string())),
    mediaMetadata: v.optional(v.array(outboundMessageMediaMetadataValidator)),
    voiceNoteCacheId: v.optional(v.id("platformConversationMediaCache")),
    quoteId: v.optional(v.string()),
    actionRequestId: v.optional(v.id("agentActionRequests")),
  },
  returns: outboundMessageOperationValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const prospect = await requireOwnedProspect(ctx, args.prospectId, { user });
    if (prospect.platform !== args.platform) {
      throw new Error("Prospect platform does not match this conversation.");
    }
    const now = getCurrentUTCTimestamp();
    let mediaUrls = normalizeOptionalStrings(args.mediaUrls);
    let voiceNoteCache:
      | {
          _id: Id<"platformConversationMediaCache">;
          storageId: Id<"_storage">;
          durationMs?: number;
          size: number;
          contentType: string;
          fileName?: string;
          expiresAt: number;
        }
      | undefined;
    if (args.voiceNoteCacheId) {
      const cached = await ctx.db.get(args.voiceNoteCacheId);
      if (
        !cached ||
        cached.userId !== user._id ||
        cached.prospectId !== args.prospectId ||
        cached.platform !== "linkedin" ||
        cached.purpose !== "outbound_voice_note" ||
        cached.encrypted ||
        cached.expiresAt <= now
      ) {
        throw new Error("This voice note expired. Record it again.");
      }
      const mediaUrl = await ctx.storage.getUrl(cached.storageId);
      if (!mediaUrl) {
        throw new Error("This voice note is no longer available.");
      }
      voiceNoteCache = cached;
      mediaUrls = [mediaUrl];
    }
    const mediaDescriptions = normalizeMediaDescriptions(
      args.mediaDescriptions,
      mediaUrls?.length ?? 0
    );
    const mediaKinds = voiceNoteCache
      ? (["file"] as Array<"image" | "video" | "gif" | "file">)
      : args.mediaKinds?.slice(0, mediaUrls?.length ?? 0);
    const mediaFileNames = voiceNoteCache
      ? [voiceNoteCache.fileName ?? "voice-note.m4a"]
      : normalizeMediaMetadata(args.mediaFileNames, mediaUrls?.length ?? 0);
    const mediaMetadata = voiceNoteCache
      ? [
          {
            durationMs: voiceNoteCache.durationMs,
            mimeType: voiceNoteCache.contentType,
            fileSize: voiceNoteCache.size,
          },
        ]
      : normalizeOutboundMediaMetadata(
          args.mediaMetadata,
          mediaUrls?.length ?? 0
        );
    const text = args.text.trim();
    const conversationId = args.conversationId?.trim() || undefined;
    const quoteId = args.quoteId?.trim() || undefined;
    if (voiceNoteCache && text) {
      throw new Error("Send a LinkedIn voice note by itself.");
    }
    assertValidMessage({
      platform: args.platform,
      text,
      mediaUrls,
      clientRequestId: args.clientRequestId,
    });

    if (args.actionRequestId) {
      const request = await ctx.db.get(args.actionRequestId);
      if (
        !request ||
        request.userId !== user._id ||
        request.prospectId !== args.prospectId
      ) {
        throw new Error("Message approval request is not available.");
      }
    }

    const existing = await ctx.db
      .query("outboundMessageOperations")
      .withIndex("by_user_and_client_request_id", (q) =>
        q.eq("userId", user._id).eq("clientRequestId", args.clientRequestId)
      )
      .unique();
    if (existing) {
      if (
        existing.prospectId !== args.prospectId ||
        existing.platform !== args.platform ||
        existing.text !== text ||
        JSON.stringify(existing.mediaUrls ?? []) !==
          JSON.stringify(mediaUrls ?? []) ||
        JSON.stringify(existing.mediaDescriptions ?? []) !==
          JSON.stringify(mediaDescriptions ?? []) ||
        JSON.stringify(existing.mediaKinds ?? []) !==
          JSON.stringify(mediaKinds ?? []) ||
        JSON.stringify(existing.mediaFileNames ?? []) !==
          JSON.stringify(mediaFileNames ?? []) ||
        !areOutboundMediaMetadataEqual(existing.mediaMetadata, mediaMetadata) ||
        existing.voiceNoteCacheId !== args.voiceNoteCacheId ||
        existing.conversationId !== conversationId ||
        existing.quoteId !== quoteId ||
        existing.actionRequestId !== args.actionRequestId
      ) {
        throw new Error("Message request identifier is already in use.");
      }
      return toPublicOperation(existing);
    }

    const operationExpiresAt = now + OUTBOUND_OPERATION_TTL_MS;
    await extendVoiceNoteCacheExpiry(
      ctx,
      voiceNoteCache?._id,
      operationExpiresAt
    );
    const operationId = await ctx.db.insert("outboundMessageOperations", {
      userId: user._id,
      workspaceId: prospect.workspaceId,
      prospectId: args.prospectId,
      platform: args.platform,
      clientRequestId: args.clientRequestId,
      conversationId,
      text,
      mediaUrls,
      mediaDescriptions,
      mediaKinds,
      mediaFileNames,
      mediaMetadata,
      voiceNoteCacheId: args.voiceNoteCacheId,
      quoteId,
      actionRequestId: args.actionRequestId,
      status: "queued",
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: operationExpiresAt,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.outboundMessageOperations.processQueueInternal,
      { userId: user._id, prospectId: args.prospectId, platform: args.platform }
    );
    await ctx.scheduler.runAt(
      operationExpiresAt,
      internal.outboundMessageOperations.cleanupInternal,
      {
        operationId,
        expectedExpiresAt: operationExpiresAt,
      }
    );
    const row = await ctx.db.get(operationId);
    if (!row) throw new Error("Unable to queue message.");
    return toPublicOperation(row);
  },
});

export const retryMessage = mutation({
  args: { operationId: v.id("outboundMessageOperations") },
  returns: outboundMessageOperationValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.operationId);
    if (!row || row.userId !== user._id) {
      throw new Error("Message is not available.");
    }
    if (row.status === "sent") return toPublicOperation(row);
    if (row.status !== "failed") {
      throw new Error("Message is already queued.");
    }
    if (row.voiceNoteCacheId && !(await ctx.db.get(row.voiceNoteCacheId))) {
      throw new Error("This voice note expired. Record it again.");
    }
    const now = getCurrentUTCTimestamp();
    const expiresAt = now + OUTBOUND_OPERATION_TTL_MS;
    await extendVoiceNoteCacheExpiry(ctx, row.voiceNoteCacheId, expiresAt);
    await ctx.db.patch(row._id, {
      status: "queued",
      leaseId: undefined,
      leaseExpiresAt: undefined,
      errorMessage: undefined,
      updatedAt: now,
      expiresAt,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.outboundMessageOperations.processQueueInternal,
      { userId: row.userId, prospectId: row.prospectId, platform: row.platform }
    );
    await ctx.scheduler.runAt(
      expiresAt,
      internal.outboundMessageOperations.cleanupInternal,
      { operationId: row._id, expectedExpiresAt: expiresAt }
    );
    return toPublicOperation({
      ...row,
      status: "queued",
      errorMessage: undefined,
      updatedAt: now,
    });
  },
});

export const acquireNextInternal = internalMutation({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    platform: platformConversationPlatformValidator,
    leaseId: v.string(),
    now: v.number(),
  },
  returns: v.union(
    v.object({ kind: v.literal("empty") }),
    v.object({ kind: v.literal("busy"), retryAt: v.number() }),
    v.object({
      kind: v.literal("acquired"),
      operationId: v.id("outboundMessageOperations"),
      userId: v.id("users"),
      prospectId: v.id("prospects"),
      platform: platformConversationPlatformValidator,
      conversationId: v.optional(v.string()),
      text: v.string(),
      mediaUrls: v.optional(v.array(v.string())),
      mediaDescriptions: v.optional(v.array(v.string())),
      mediaKinds: v.optional(v.array(twitterMediaKindValidator)),
      mediaFileNames: v.optional(v.array(v.string())),
      mediaMetadata: v.optional(v.array(outboundMessageMediaMetadataValidator)),
      voiceNoteCacheId: v.optional(v.id("platformConversationMediaCache")),
      quoteId: v.optional(v.string()),
      actionRequestId: v.optional(v.id("agentActionRequests")),
      leaseId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const sending = await ctx.db
      .query("outboundMessageOperations")
      .withIndex(
        "by_user_and_prospect_and_platform_and_status_and_created_at",
        (q) =>
          q
            .eq("userId", args.userId)
            .eq("prospectId", args.prospectId)
            .eq("platform", args.platform)
            .eq("status", "sending")
      )
      .first();
    if (
      sending &&
      typeof sending.leaseExpiresAt === "number" &&
      sending.leaseExpiresAt > args.now
    ) {
      return {
        kind: "busy" as const,
        retryAt: Math.max(args.now + BUSY_RETRY_MS, sending.leaseExpiresAt),
      };
    }
    if (sending) {
      const expiresAt = args.now + OUTBOUND_OPERATION_TTL_MS;
      await extendVoiceNoteCacheExpiry(
        ctx,
        sending.voiceNoteCacheId,
        expiresAt
      );
      await ctx.db.patch(sending._id, {
        status: "failed",
        leaseId: undefined,
        leaseExpiresAt: undefined,
        errorMessage:
          "Delivery could not be confirmed. Check the conversation before retrying.",
        updatedAt: args.now,
        expiresAt,
      });
      await ctx.scheduler.runAt(
        expiresAt,
        internal.outboundMessageOperations.cleanupInternal,
        { operationId: sending._id, expectedExpiresAt: expiresAt }
      );
    }

    const next = await ctx.db
      .query("outboundMessageOperations")
      .withIndex(
        "by_user_and_prospect_and_platform_and_status_and_created_at",
        (q) =>
          q
            .eq("userId", args.userId)
            .eq("prospectId", args.prospectId)
            .eq("platform", args.platform)
            .eq("status", "queued")
      )
      .first();
    if (!next) return { kind: "empty" as const };

    const leaseExpiresAt = args.now + SEND_LEASE_MS;
    await ctx.db.patch(next._id, {
      status: "sending",
      leaseId: args.leaseId,
      leaseExpiresAt,
      attemptCount: next.attemptCount + 1,
      updatedAt: args.now,
    });
    await ctx.scheduler.runAt(
      leaseExpiresAt,
      internal.outboundMessageOperations.expireLeaseInternal,
      {
        operationId: next._id,
        leaseId: args.leaseId,
        queue: {
          userId: args.userId,
          prospectId: args.prospectId,
          platform: args.platform,
        },
      }
    );
    return {
      kind: "acquired" as const,
      operationId: next._id,
      userId: next.userId,
      prospectId: next.prospectId,
      platform: next.platform,
      conversationId: next.conversationId,
      text: next.text,
      mediaUrls: next.mediaUrls,
      mediaDescriptions: next.mediaDescriptions,
      mediaKinds: next.mediaKinds,
      mediaFileNames: next.mediaFileNames,
      mediaMetadata: next.mediaMetadata,
      voiceNoteCacheId: next.voiceNoteCacheId,
      quoteId: next.quoteId,
      actionRequestId: next.actionRequestId,
      leaseId: args.leaseId,
    };
  },
});

export const markSentInternal = internalMutation({
  args: {
    operationId: v.id("outboundMessageOperations"),
    leaseId: v.string(),
    conversationId: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.operationId);
    if (!row || row.status !== "sending" || row.leaseId !== args.leaseId) {
      return null;
    }
    const expiresAt = args.now + SENT_OPERATION_TTL_MS;
    await ctx.db.patch(row._id, {
      status: "sent",
      conversationId: args.conversationId ?? row.conversationId,
      providerMessageId: args.providerMessageId,
      leaseId: undefined,
      leaseExpiresAt: undefined,
      errorMessage: undefined,
      sentAt: args.now,
      updatedAt: args.now,
      expiresAt,
    });
    // Keep the temporary preview alive briefly while the provider webhook or
    // history refresh replaces it with LinkedIn's canonical attachment.
    await extendVoiceNoteCacheExpiry(
      ctx,
      row.voiceNoteCacheId,
      args.now + SENT_VOICE_NOTE_CACHE_TTL_MS
    );
    await ctx.scheduler.runAt(
      expiresAt,
      internal.outboundMessageOperations.cleanupInternal,
      { operationId: row._id, expectedExpiresAt: expiresAt }
    );
    return null;
  },
});

export const markFailedInternal = internalMutation({
  args: {
    operationId: v.id("outboundMessageOperations"),
    leaseId: v.string(),
    errorMessage: v.string(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.operationId);
    if (!row || row.status !== "sending" || row.leaseId !== args.leaseId) {
      return null;
    }
    const expiresAt = args.now + OUTBOUND_OPERATION_TTL_MS;
    await extendVoiceNoteCacheExpiry(ctx, row.voiceNoteCacheId, expiresAt);
    await ctx.db.patch(row._id, {
      status: "failed",
      leaseId: undefined,
      leaseExpiresAt: undefined,
      errorMessage: args.errorMessage.slice(0, 500),
      updatedAt: args.now,
      expiresAt,
    });
    await ctx.scheduler.runAt(
      expiresAt,
      internal.outboundMessageOperations.cleanupInternal,
      { operationId: row._id, expectedExpiresAt: expiresAt }
    );
    return null;
  },
});

export const expireLeaseInternal = internalMutation({
  args: {
    operationId: v.id("outboundMessageOperations"),
    leaseId: v.string(),
    queue: v.object({
      userId: v.id("users"),
      prospectId: v.id("prospects"),
      platform: platformConversationPlatformValidator,
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.operationId);
    if (row?.status === "sending" && row.leaseId === args.leaseId) {
      const now = getCurrentUTCTimestamp();
      const expiresAt = now + OUTBOUND_OPERATION_TTL_MS;
      await extendVoiceNoteCacheExpiry(ctx, row.voiceNoteCacheId, expiresAt);
      await ctx.db.patch(row._id, {
        status: "failed",
        leaseId: undefined,
        leaseExpiresAt: undefined,
        errorMessage:
          "Delivery could not be confirmed. Check the conversation before retrying.",
        updatedAt: now,
        expiresAt,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.outboundMessageOperations.processQueueInternal,
        args.queue
      );
      await ctx.scheduler.runAt(
        expiresAt,
        internal.outboundMessageOperations.cleanupInternal,
        { operationId: row._id, expectedExpiresAt: expiresAt }
      );
    }
    return null;
  },
});

export const cleanupInternal = internalMutation({
  args: {
    operationId: v.id("outboundMessageOperations"),
    expectedExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.operationId);
    if (!row || row.expiresAt !== args.expectedExpiresAt) return null;
    const now = getCurrentUTCTimestamp();
    if (row.expiresAt > now) {
      await ctx.scheduler.runAt(
        row.expiresAt,
        internal.outboundMessageOperations.cleanupInternal,
        args
      );
      return null;
    }
    if (row.voiceNoteCacheId) {
      const cached = await ctx.db.get(row.voiceNoteCacheId);
      if (cached) {
        await ctx.storage.delete(cached.storageId);
        await ctx.db.delete(cached._id);
      }
    }
    await ctx.db.delete(row._id);
    return null;
  },
});

async function sendThroughProvider(
  ctx: ActionCtx,
  operation: {
    userId: Id<"users">;
    prospectId: Id<"prospects">;
    platform: Platform;
    conversationId?: string;
    text: string;
    mediaUrls?: string[];
    mediaDescriptions?: string[];
    mediaKinds?: Array<"image" | "video" | "gif" | "file">;
    mediaFileNames?: string[];
    mediaMetadata?: OutboundMediaMetadata[];
    voiceNoteCacheId?: Id<"platformConversationMediaCache">;
    quoteId?: string;
    actionRequestId?: Id<"agentActionRequests">;
  }
): Promise<ProviderSendResult> {
  if (operation.platform === "twitter") {
    return (await ctx.runAction(internal.x.sendDmMessageInternal, {
      userId: operation.userId,
      prospectId: operation.prospectId,
      conversationId: operation.conversationId,
      text: operation.text,
      mediaUrls: operation.mediaUrls,
      mediaDescriptions: operation.mediaDescriptions,
      actionRequestId: operation.actionRequestId,
    })) as ProviderSendResult;
  }
  let mediaUrls = operation.mediaUrls;
  let mediaMetadata = operation.mediaMetadata;
  let mediaFileNames = operation.mediaFileNames;
  let mediaKinds = operation.mediaKinds;
  if (operation.voiceNoteCacheId) {
    const cached = await ctx.runQuery(
      internal.platformConversationMedia.getCachedMediaByIdInternal,
      {
        cacheId: operation.voiceNoteCacheId,
        userId: operation.userId,
        prospectId: operation.prospectId,
        now: getCurrentUTCTimestamp(),
      }
    );
    if (!cached || cached.purpose !== "outbound_voice_note") {
      throw new Error("This voice note expired. Record it again.");
    }
    const mediaUrl = await ctx.storage.getUrl(cached.storageId);
    if (!mediaUrl) throw new Error("This voice note is no longer available.");
    mediaUrls = [mediaUrl];
    mediaKinds = ["file"];
    mediaFileNames = [cached.fileName ?? "voice-note.m4a"];
    mediaMetadata = [
      {
        durationMs: cached.durationMs,
        mimeType: cached.contentType,
        fileSize: cached.size,
      },
    ];
  }
  return (await ctx.runAction(internal.linkedin.sendLinkedInMessageInternal, {
    userId: operation.userId,
    prospectId: operation.prospectId,
    conversationId: operation.conversationId,
    text: operation.text,
    mediaUrls,
    mediaKinds,
    mediaFileNames,
    mediaMetadata,
    quoteId: operation.quoteId,
    actionRequestId: operation.actionRequestId,
  })) as ProviderSendResult;
}

export const processQueueInternal = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    platform: platformConversationPlatformValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const leaseId = globalThis.crypto.randomUUID();
    const acquired = await ctx.runMutation(
      internal.outboundMessageOperations.acquireNextInternal,
      { ...args, leaseId, now: getCurrentUTCTimestamp() }
    );
    if (acquired.kind === "empty") return null;
    if (acquired.kind === "busy") {
      await ctx.scheduler.runAt(
        acquired.retryAt,
        internal.outboundMessageOperations.processQueueInternal,
        args
      );
      return null;
    }

    try {
      const result = await sendThroughProvider(ctx, acquired);
      await ctx.runMutation(
        internal.outboundMessageOperations.markSentInternal,
        {
          operationId: acquired.operationId,
          leaseId: acquired.leaseId,
          conversationId: result.conversationId,
          providerMessageId: result.messageId,
          now: getCurrentUTCTimestamp(),
        }
      );
    } catch (error) {
      const failure = getOutboundMessageFailure({
        error,
        platform: acquired.platform,
      });
      console.error("[OutboundMessageOperations] Provider send failed", {
        platform: acquired.platform,
        prospectId: acquired.prospectId,
        operationId: acquired.operationId,
        failureCode: failure.code,
        error,
      });
      await ctx.runMutation(
        internal.outboundMessageOperations.markFailedInternal,
        {
          operationId: acquired.operationId,
          leaseId: acquired.leaseId,
          errorMessage: failure.message,
          now: getCurrentUTCTimestamp(),
        }
      );
    } finally {
      await ctx.scheduler.runAfter(
        0,
        internal.outboundMessageOperations.processQueueInternal,
        args
      );
    }
    return null;
  },
});
