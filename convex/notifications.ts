import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserIdFromIdentity } from "./lib/userUtils";
import * as NotificationHelpers from "./lib/notificationHelpers";
import { replyNotificationStatusValidator } from "./validators";

export const getUserNotifications = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = await getUserIdFromIdentity(ctx, identity);
    return await NotificationHelpers.getAllUserNotifications(ctx, {
      userId,
    });
  },
});

export const markNotificationSeen = mutation({
  args: { replyId: v.id("replyQueue") },
  handler: async (ctx, { replyId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = await getUserIdFromIdentity(ctx, identity);
    await NotificationHelpers.markNotificationAsSeen(ctx, { userId, replyId });
  },
});

export const dismissNotification = mutation({
  args: { replyId: v.id("replyQueue") },
  handler: async (ctx, { replyId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = await getUserIdFromIdentity(ctx, identity);
    await NotificationHelpers.markNotificationAsDismissed(ctx, {
      userId,
      replyId,
    });
  },
});

export const createNotificationState = mutation({
  args: {
    replyId: v.id("replyQueue"),
    userId: v.id("users"),
    status: replyNotificationStatusValidator,
    originalTweetAuthor: v.optional(v.string()),
    replyPreview: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { replyId, userId, status, originalTweetAuthor, replyPreview }
  ) => {
    await NotificationHelpers.createNotificationState(ctx, {
      userId,
      replyId,
      status,
      originalTweetAuthor,
      replyPreview,
    });
  },
});
