import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./lib/functionBuilders";
import { requireOwnedProspect, requireUser } from "./lib/accessHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { inspectLinkedInM4aContainer } from "../shared/lib/utils/media/linkedinVoiceNote";

const MAXIMUM_VOICE_NOTE_BYTES = 15 * 1024 * 1024;
const STAGED_VOICE_NOTE_TTL_MS = 60 * 60 * 1000;

type FinalizedVoiceNote = {
  cacheId: Id<"platformConversationMediaCache">;
  mediaUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  durationMs: number;
  expiresAt: number;
};

/** Mint a one-use upload URL. Recording and review remain browser-local. */
export const generateUploadUrl = mutation({
  args: { prospectId: v.id("prospects") },
  returns: v.object({
    uploadUrl: v.string(),
    uploadIntentId: v.id("outboundVoiceNoteUploadIntents"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const prospect = await requireOwnedProspect(ctx, args.prospectId, { user });
    if (prospect.platform !== "linkedin") {
      throw new Error("LinkedIn prospect not found or not authorized.");
    }
    const now = getCurrentUTCTimestamp();
    const expiresAt = now + STAGED_VOICE_NOTE_TTL_MS;
    const uploadIntentId = await ctx.db.insert(
      "outboundVoiceNoteUploadIntents",
      {
        userId: user._id,
        workspaceId: prospect.workspaceId,
        prospectId: prospect._id,
        createdAt: now,
        expiresAt,
      }
    );
    await ctx.scheduler.runAt(
      expiresAt,
      internal.outboundVoiceNotes.cleanupUploadIntentInternal,
      { uploadIntentId, expectedExpiresAt: expiresAt }
    );
    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
      uploadIntentId,
    };
  },
});

export const requireAuthorizedProspectInternal = internalQuery({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const prospect = await ctx.db.get(args.prospectId);
    return Boolean(
      prospect &&
      prospect.userId === args.userId &&
      prospect.platform === "linkedin"
    );
  },
});

export const claimUploadIntentInternal = internalMutation({
  args: {
    uploadIntentId: v.id("outboundVoiceNoteUploadIntents"),
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    storageId: v.id("_storage"),
    now: v.number(),
  },
  returns: v.union(
    v.object({ kind: v.literal("claimed"), expiresAt: v.number() }),
    v.object({
      kind: v.literal("completed"),
      cacheId: v.id("platformConversationMediaCache"),
      expiresAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.uploadIntentId);
    if (
      !intent ||
      intent.userId !== args.userId ||
      intent.prospectId !== args.prospectId ||
      intent.expiresAt <= args.now
    ) {
      throw new Error("Voice note upload authorization expired or is invalid.");
    }
    if (intent.storageId && intent.storageId !== args.storageId) {
      throw new Error("Voice note upload authorization was already used.");
    }
    if (intent.cacheId) {
      return {
        kind: "completed" as const,
        cacheId: intent.cacheId,
        expiresAt: intent.expiresAt,
      };
    }
    if (intent.storageId) {
      throw new Error("Voice note upload is already being finalized.");
    }
    await ctx.db.patch(intent._id, { storageId: args.storageId });
    return { kind: "claimed" as const, expiresAt: intent.expiresAt };
  },
});

export const completeUploadIntentInternal = internalMutation({
  args: {
    uploadIntentId: v.id("outboundVoiceNoteUploadIntents"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    cacheId: v.id("platformConversationMediaCache"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.uploadIntentId);
    if (
      !intent ||
      intent.userId !== args.userId ||
      intent.storageId !== args.storageId
    ) {
      throw new Error("Voice note upload authorization changed.");
    }
    await ctx.db.patch(intent._id, { cacheId: args.cacheId });
    return null;
  },
});

export const discardClaimedUploadIntentInternal = internalMutation({
  args: {
    uploadIntentId: v.id("outboundVoiceNoteUploadIntents"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.uploadIntentId);
    if (
      !intent ||
      intent.userId !== args.userId ||
      intent.storageId !== args.storageId
    ) {
      return null;
    }
    if (await ctx.db.system.get("_storage", args.storageId)) {
      await ctx.storage.delete(args.storageId);
    }
    await ctx.db.delete(intent._id);
    return null;
  },
});

export const cleanupUploadIntentInternal = internalMutation({
  args: {
    uploadIntentId: v.id("outboundVoiceNoteUploadIntents"),
    expectedExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.uploadIntentId);
    if (!intent || intent.expiresAt !== args.expectedExpiresAt) return null;
    const now = getCurrentUTCTimestamp();
    if (intent.expiresAt > now) {
      await ctx.scheduler.runAt(
        intent.expiresAt,
        internal.outboundVoiceNotes.cleanupUploadIntentInternal,
        args
      );
      return null;
    }
    if (
      !intent.cacheId &&
      intent.storageId &&
      (await ctx.db.system.get("_storage", intent.storageId))
    ) {
      await ctx.storage.delete(intent.storageId);
    }
    await ctx.db.delete(intent._id);
    return null;
  },
});

/**
 * Validate the actual uploaded bytes, then register a private temporary cache
 * row. No client-provided duration, URL, MIME type, or size is trusted.
 */
export const finalizeUpload = action({
  args: {
    prospectId: v.id("prospects"),
    storageId: v.id("_storage"),
    uploadIntentId: v.id("outboundVoiceNoteUploadIntents"),
  },
  returns: v.object({
    cacheId: v.id("platformConversationMediaCache"),
    mediaUrl: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    durationMs: v.number(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args): Promise<FinalizedVoiceNote> => {
    let storedCacheId: Id<"platformConversationMediaCache"> | undefined;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.users.getUserByWorkosIdInternal,
      { workosUserId: identity.subject }
    );
    if (!user) throw new Error("User not found");
    const authorized = await ctx.runQuery(
      internal.outboundVoiceNotes.requireAuthorizedProspectInternal,
      { userId: user._id, prospectId: args.prospectId }
    );
    if (!authorized) {
      throw new Error("LinkedIn prospect not found or not authorized.");
    }

    const now = getCurrentUTCTimestamp();
    const claim = await ctx.runMutation(
      internal.outboundVoiceNotes.claimUploadIntentInternal,
      {
        uploadIntentId: args.uploadIntentId,
        userId: user._id,
        prospectId: args.prospectId,
        storageId: args.storageId,
        now,
      }
    );
    if (claim.kind === "completed") {
      const cached = await ctx.runQuery(
        internal.platformConversationMedia.getCachedMediaByIdInternal,
        {
          cacheId: claim.cacheId,
          userId: user._id,
          prospectId: args.prospectId,
          now,
        }
      );
      if (!cached || cached.durationMs === undefined) {
        throw new Error("Finalized voice note is no longer available.");
      }
      const mediaUrl = await ctx.storage.getUrl(cached.storageId);
      if (!mediaUrl) {
        throw new Error("Finalized voice note is no longer available.");
      }
      return {
        cacheId: cached.cacheId,
        mediaUrl,
        fileName: cached.fileName ?? "voice-note.m4a",
        mimeType: cached.contentType,
        fileSize: cached.size,
        durationMs: cached.durationMs,
        expiresAt: cached.expiresAt,
      };
    }

    try {
      const blob = await ctx.storage.get(args.storageId);
      if (!blob || blob.size <= 0 || blob.size > MAXIMUM_VOICE_NOTE_BYTES) {
        throw new Error("LinkedIn voice notes must be 15 MB or smaller.");
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const { durationMs } = inspectLinkedInM4aContainer(bytes);
      const snapshot: {
        conversation?: { conversationId?: string } | null;
      } | null = await ctx.runQuery(
        internal.platformConversations.getConversationSnapshotInternal,
        {
          userId: user._id,
          platform: "linkedin",
          prospectId: args.prospectId,
          messageLimit: 1,
        }
      );
      const conversationId =
        typeof snapshot?.conversation?.conversationId === "string" &&
        snapshot.conversation.conversationId.trim()
          ? snapshot.conversation.conversationId.trim()
          : `pending:${args.prospectId}`;
      const expiresAt = Math.min(
        claim.expiresAt,
        now + STAGED_VOICE_NOTE_TTL_MS
      );
      const fileName = "voice-note.m4a";
      const mimeType = "audio/x-m4a";
      const stored: {
        cacheId: Id<"platformConversationMediaCache">;
        storageId: Id<"_storage">;
        size: number;
      } = await ctx.runMutation(
        internal.platformConversationMedia.storeCachedMediaInternal,
        {
          userId: user._id,
          prospectId: args.prospectId,
          platform: "linkedin",
          conversationId,
          cacheKey: `outbound-voice:${args.uploadIntentId}`,
          attachmentId: String(args.storageId),
          storageId: args.storageId,
          contentType: mimeType,
          fileName,
          size: blob.size,
          encrypted: false,
          purpose: "outbound_voice_note",
          durationMs,
          expiresAt,
        }
      );
      storedCacheId = stored.cacheId;
      const mediaUrl = await ctx.storage.getUrl(stored.storageId);
      if (!mediaUrl) throw new Error("Voice note upload is unavailable.");
      await ctx.runMutation(
        internal.outboundVoiceNotes.completeUploadIntentInternal,
        {
          uploadIntentId: args.uploadIntentId,
          userId: user._id,
          storageId: args.storageId,
          cacheId: stored.cacheId,
        }
      );
      return {
        cacheId: stored.cacheId,
        mediaUrl,
        fileName,
        mimeType,
        fileSize: stored.size,
        durationMs,
        expiresAt,
      };
    } catch (error) {
      if (storedCacheId) {
        await ctx.runMutation(
          internal.platformConversationMedia.deleteCachedMediaNowInternal,
          { cacheId: storedCacheId }
        );
      }
      await ctx.runMutation(
        internal.outboundVoiceNotes.discardClaimedUploadIntentInternal,
        {
          uploadIntentId: args.uploadIntentId,
          userId: user._id,
          storageId: args.storageId,
        }
      );
      throw error;
    }
  },
});
