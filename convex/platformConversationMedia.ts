import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import { platformConversationPlatformValidator } from "./validators";

const cachedMediaValidator = v.object({
  cacheId: v.id("platformConversationMediaCache"),
  storageId: v.id("_storage"),
  contentType: v.string(),
  fileName: v.optional(v.string()),
  size: v.number(),
  encrypted: v.boolean(),
  expiresAt: v.number(),
});

export const getCachedMediaInternal = internalQuery({
  args: {
    userId: v.id("users"),
    cacheKey: v.string(),
    now: v.number(),
  },
  returns: v.union(v.null(), cachedMediaValidator),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("platformConversationMediaCache")
      .withIndex("by_user_and_cache_key", (q) =>
        q.eq("userId", args.userId).eq("cacheKey", args.cacheKey)
      )
      .unique();
    if (!row || row.expiresAt <= args.now) {
      return null;
    }
    return {
      cacheId: row._id,
      storageId: row.storageId,
      contentType: row.contentType,
      fileName: row.fileName,
      size: row.size,
      encrypted: row.encrypted,
      expiresAt: row.expiresAt,
    };
  },
});

export const storeCachedMediaInternal = internalMutation({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    platform: platformConversationPlatformValidator,
    conversationId: v.string(),
    cacheKey: v.string(),
    providerMessageId: v.optional(v.string()),
    attachmentId: v.string(),
    storageId: v.id("_storage"),
    contentType: v.string(),
    fileName: v.optional(v.string()),
    size: v.number(),
    encrypted: v.boolean(),
    expiresAt: v.number(),
  },
  returns: v.object({
    cacheId: v.id("platformConversationMediaCache"),
    storageId: v.id("_storage"),
    contentType: v.string(),
    fileName: v.optional(v.string()),
    size: v.number(),
    encrypted: v.boolean(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    const existing = await ctx.db
      .query("platformConversationMediaCache")
      .withIndex("by_user_and_cache_key", (q) =>
        q.eq("userId", args.userId).eq("cacheKey", args.cacheKey)
      )
      .unique();

    // Two panel surfaces can request the same missing media concurrently.
    // Keep the first valid cache row and discard the duplicate storage object
    // so neither caller receives a URL that the other request just deleted.
    if (existing && existing.expiresAt > now) {
      if (existing.storageId !== args.storageId) {
        await ctx.storage.delete(args.storageId);
      }
      return {
        cacheId: existing._id,
        storageId: existing.storageId,
        contentType: existing.contentType,
        fileName: existing.fileName,
        size: existing.size,
        encrypted: existing.encrypted,
        expiresAt: existing.expiresAt,
      };
    }

    if (existing && existing.storageId !== args.storageId) {
      await ctx.storage.delete(existing.storageId);
    }

    const payload = {
      prospectId: args.prospectId,
      platform: args.platform,
      conversationId: args.conversationId,
      providerMessageId: args.providerMessageId,
      attachmentId: args.attachmentId,
      storageId: args.storageId,
      contentType: args.contentType,
      fileName: args.fileName,
      size: args.size,
      encrypted: args.encrypted,
      createdAt: now,
      expiresAt: args.expiresAt,
    };
    let cacheId;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      cacheId = existing._id;
    } else {
      cacheId = await ctx.db.insert("platformConversationMediaCache", {
        userId: args.userId,
        cacheKey: args.cacheKey,
        ...payload,
      });
    }

    await ctx.scheduler.runAt(
      args.expiresAt,
      internal.platformConversationMedia.deleteCachedMediaInternal,
      {
        cacheId,
        expectedStorageId: args.storageId,
        expectedExpiresAt: args.expiresAt,
      }
    );
    return {
      cacheId,
      storageId: args.storageId,
      contentType: args.contentType,
      fileName: args.fileName,
      size: args.size,
      encrypted: args.encrypted,
      expiresAt: args.expiresAt,
    };
  },
});

export const deleteCachedMediaInternal = internalMutation({
  args: {
    cacheId: v.id("platformConversationMediaCache"),
    expectedStorageId: v.id("_storage"),
    expectedExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.cacheId);
    if (
      !row ||
      row.storageId !== args.expectedStorageId ||
      row.expiresAt !== args.expectedExpiresAt
    ) {
      return null;
    }
    const now = getCurrentUTCTimestamp();
    if (row.expiresAt > now) {
      await ctx.scheduler.runAt(
        row.expiresAt,
        internal.platformConversationMedia.deleteCachedMediaInternal,
        args
      );
      return null;
    }
    await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
    return null;
  },
});
