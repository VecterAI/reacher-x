import { Id } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";

export async function getUserUnseenNotifications(
  ctx: QueryCtx,
  { userId }: { userId: Id<"users"> }
) {
  return await ctx.db
    .query("userNotificationState")
    .withIndex("by_user_unseen", (q) =>
      q.eq("userId", userId).eq("userSeenAt", undefined)
    )
    .collect();
}

export async function getAllUserNotifications(
  ctx: QueryCtx,
  { userId }: { userId: Id<"users"> }
) {
  return await ctx.db
    .query("userNotificationState")
    .withIndex("by_user_status", (q) => q.eq("userId", userId))
    .collect();
}

export async function markNotificationAsSeen(
  ctx: MutationCtx,
  { userId, replyId }: { userId: Id<"users">; replyId: Id<"replyQueue"> }
) {
  const existing = await ctx.db
    .query("userNotificationState")
    .withIndex("by_user_reply", (q) =>
      q.eq("userId", userId).eq("replyId", replyId)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      userSeenAt: Date.now(),
    });
  }
}

export async function markNotificationAsDismissed(
  ctx: MutationCtx,
  { userId, replyId }: { userId: Id<"users">; replyId: Id<"replyQueue"> }
) {
  const existing = await ctx.db
    .query("userNotificationState")
    .withIndex("by_user_reply", (q) =>
      q.eq("userId", userId).eq("replyId", replyId)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      userDismissedAt: Date.now(),
    });
  }
}

export async function createNotificationState(
  ctx: MutationCtx,
  {
    userId,
    replyId,
    status,
    originalTweetAuthor,
    replyPreview,
  }: {
    userId: Id<"users">;
    replyId: Id<"replyQueue">;
    status: "pending" | "processing" | "completed" | "failed";
    originalTweetAuthor?: string;
    replyPreview?: string;
  }
) {
  // Check if notification state already exists
  const existing = await ctx.db
    .query("userNotificationState")
    .withIndex("by_user_reply", (q) =>
      q.eq("userId", userId).eq("replyId", replyId)
    )
    .unique();

  if (existing) {
    // Update existing notification state
    await ctx.db.patch(existing._id, {
      status,
      originalTweetAuthor,
      replyPreview,
    });
  } else {
    // Create new notification state
    await ctx.db.insert("userNotificationState", {
      userId,
      replyId,
      status,
      originalTweetAuthor,
      replyPreview,
    });
  }
}
