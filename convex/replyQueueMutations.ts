import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromIdentity } from "./lib/userUtils";

/**
 * Add reply to queue for immediate processing
 */
export const addReplyToQueue = mutation({
  args: {
    tweetId: v.string(),
    text: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    mediaDescriptions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = await getUserIdFromIdentity(ctx, identity);

    const queueId = await ctx.db.insert("replyQueue", {
      userId,
      tweetId: args.tweetId,
      text: args.text,
      mediaUrls: args.mediaUrls,
      mediaDescriptions: args.mediaDescriptions,
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      scheduledAt: Date.now(),
    });

    return queueId;
  },
});

/**
 * Update reply status
 */
export const updateReplyStatus = mutation({
  args: {
    id: v.id("replyQueue"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("retrying")
    ),
    twitterReplyId: v.optional(v.string()),
    processedAt: v.optional(v.number()),
    retryCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

/**
 * Add log entry
 */
export const addLog = mutation({
  args: {
    queueId: v.id("replyQueue"),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("replyQueueLogs", args);
  },
});

/**
 * Get reply by ID
 */
export const getReplyById = query({
  args: { id: v.id("replyQueue") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get user's recent replies (completed/failed) for status notifications
 */
export const getUserRecentReplies = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = await getUserIdFromIdentity(ctx, identity);
    return await ctx.db
      .query("replyQueue")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "completed")
      )
      .order("desc")
      .take(args.limit || 5);
  },
});

/**
 * Get user's pending replies
 */
export const getUserPendingReplies = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = await getUserIdFromIdentity(ctx, identity);
    return await ctx.db
      .query("replyQueue")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "pending")
      )
      .collect();
  },
});

/**
 * Get user's processing replies
 */
export const getUserProcessingReplies = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = await getUserIdFromIdentity(ctx, identity);
    return await ctx.db
      .query("replyQueue")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "processing")
      )
      .collect();
  },
});

/**
 * Get stuck replies
 */
export const getStuckReplies = query({
  args: { beforeTime: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("replyQueue")
      .filter((q) => q.eq(q.field("status"), "processing"))
      .filter((q) => q.lt(q.field("scheduledAt"), args.beforeTime))
      .collect();
  },
});

/**
 * Get old completed replies
 */
export const getOldCompletedReplies = query({
  args: { beforeTime: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("replyQueue")
      .filter((q) => q.eq(q.field("status"), "completed"))
      .filter((q) => q.lt(q.field("processedAt"), args.beforeTime))
      .collect();
  },
});

/**
 * Get logs by queue ID
 */
export const getLogsByQueueId = query({
  args: { queueId: v.id("replyQueue") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("replyQueueLogs")
      .withIndex("by_queue_id", (q) => q.eq("queueId", args.queueId))
      .collect();
  },
});

/**
 * Delete log entry
 */
export const deleteLog = mutation({
  args: { id: v.id("replyQueueLogs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * Delete reply
 */
export const deleteReply = mutation({
  args: { id: v.id("replyQueue") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
