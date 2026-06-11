import { v } from "convex/values";
import { internalMutation, query } from "./lib/functionBuilders";
import { requireUser } from "./lib/accessHelpers";
import { buildChangedPatchWithUpdatedAt } from "./lib/patchHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

export const upsertPostEngagementInternal = internalMutation({
  args: {
    userId: v.id("users"),
    postId: v.string(),
    authorId: v.optional(v.string()),
    patch: v.object({
      liked: v.optional(v.boolean()),
      retweeted: v.optional(v.boolean()),
      commented: v.optional(v.boolean()),
      likeCount: v.optional(v.number()),
      repeatCount: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const postId = args.postId.trim();
    if (!postId) {
      return null;
    }

    const existing = await ctx.db
      .query("twitterUserPostEngagements")
      .withIndex("by_user_post", (q) =>
        q.eq("userId", args.userId).eq("postId", postId)
      )
      .first();

    const now = getCurrentUTCTimestamp();
    const likeCount =
      typeof args.patch.likeCount === "number" &&
      Number.isFinite(args.patch.likeCount)
        ? Math.max(0, args.patch.likeCount)
        : existing?.likeCount;
    const repeatCount =
      typeof args.patch.repeatCount === "number" &&
      Number.isFinite(args.patch.repeatCount)
        ? Math.max(0, args.patch.repeatCount)
        : existing?.repeatCount;
    const next = {
      userId: args.userId,
      postId,
      authorId: args.authorId ?? existing?.authorId,
      liked: args.patch.liked ?? existing?.liked ?? false,
      retweeted: args.patch.retweeted ?? existing?.retweeted ?? false,
      commented: args.patch.commented ?? existing?.commented ?? false,
      ...(args.patch.likeCount !== undefined || existing?.likeCount !== undefined
        ? { likeCount }
        : {}),
      ...(args.patch.repeatCount !== undefined ||
      existing?.repeatCount !== undefined
        ? { repeatCount }
        : {}),
      updatedAt: now,
    };

    if (existing) {
      const patch = buildChangedPatchWithUpdatedAt(
        existing as unknown as Record<string, unknown>,
        next,
        now
      );
      if (patch) {
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    return await ctx.db.insert("twitterUserPostEngagements", next);
  },
});

export const upsertFollowingInternal = internalMutation({
  args: {
    userId: v.id("users"),
    targetUserId: v.string(),
    following: v.boolean(),
  },
  handler: async (ctx, args) => {
    const targetUserId = args.targetUserId.trim();
    if (!targetUserId) {
      return null;
    }

    const existing = await ctx.db
      .query("twitterUserFollowings")
      .withIndex("by_user_target", (q) =>
        q.eq("userId", args.userId).eq("targetUserId", targetUserId)
      )
      .first();

    const now = getCurrentUTCTimestamp();
    const payload = {
      userId: args.userId,
      targetUserId,
      following: args.following,
      updatedAt: now,
    };

    if (existing) {
      const patch = buildChangedPatchWithUpdatedAt(
        existing as unknown as Record<string, unknown>,
        payload,
        now
      );
      if (patch) {
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    return await ctx.db.insert("twitterUserFollowings", payload);
  },
});

export const getEngagementsForPosts = query({
  args: {
    postIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const postIds = args.postIds.map((id) => id.trim()).filter(Boolean);
    if (postIds.length === 0) {
      return {};
    }

    const out: Record<
      string,
      {
        liked: boolean;
        retweeted: boolean;
        commented: boolean;
        likeCount?: number;
        repeatCount?: number;
        authorId?: string;
        updatedAt: number;
      }
    > = {};

    for (const postId of postIds) {
      const row = await ctx.db
        .query("twitterUserPostEngagements")
        .withIndex("by_user_post", (q) =>
          q.eq("userId", user._id).eq("postId", postId)
        )
        .first();
      if (row) {
        out[postId] = {
          liked: row.liked,
          retweeted: row.retweeted,
          commented: row.commented,
          likeCount: row.likeCount,
          repeatCount: row.repeatCount,
          authorId: row.authorId,
          updatedAt: row.updatedAt,
        };
      }
    }

    return out;
  },
});

export const getFollowingsForTargets = query({
  args: {
    targetUserIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const targetUserIds = args.targetUserIds
      .map((id) => id.trim())
      .filter(Boolean);
    if (targetUserIds.length === 0) {
      return {};
    }

    const out: Record<string, { following: boolean; updatedAt: number }> = {};

    for (const targetUserId of targetUserIds) {
      const row = await ctx.db
        .query("twitterUserFollowings")
        .withIndex("by_user_target", (q) =>
          q.eq("userId", user._id).eq("targetUserId", targetUserId)
        )
        .first();
      if (row) {
        out[targetUserId] = {
          following: row.following,
          updatedAt: row.updatedAt,
        };
      }
    }

    return out;
  },
});
