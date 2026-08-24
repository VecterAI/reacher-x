import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./lib/functionBuilders";
import { requireUser } from "./lib/accessHelpers";
import { X_TYPING_PRESENCE_TTL_MS } from "./lib/xActivityTypingCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { twitterConversationTypingPresenceValidator } from "./validators";

export const upsertTwitterInternal = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.string(),
    senderUserId: v.string(),
    receivedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const expiresAt = args.receivedAt + X_TYPING_PRESENCE_TTL_MS;
    const existing = await ctx.db
      .query("platformConversationTypingPresence")
      .withIndex("by_user_id_and_conversation_id", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();

    const presenceId = existing
      ? existing._id
      : await ctx.db.insert("platformConversationTypingPresence", {
          userId: args.userId,
          platform: "twitter",
          conversationId: args.conversationId,
          senderUserId: args.senderUserId,
          receivedAt: args.receivedAt,
          expiresAt,
        });

    if (existing) {
      await ctx.db.patch(existing._id, {
        senderUserId: args.senderUserId,
        receivedAt: args.receivedAt,
        expiresAt,
      });
    }

    await ctx.scheduler.runAt(
      expiresAt,
      internal.conversationTypingPresence.cleanupInternal,
      { presenceId, expectedExpiresAt: expiresAt }
    );
    return null;
  },
});

export const clearTwitterInternal = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("platformConversationTypingPresence")
      .withIndex("by_user_id_and_conversation_id", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .first();
    if (presence) {
      await ctx.db.delete(presence._id);
    }
    return null;
  },
});

export const cleanupInternal = internalMutation({
  args: {
    presenceId: v.id("platformConversationTypingPresence"),
    expectedExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const presence = await ctx.db.get(args.presenceId);
    if (!presence || presence.expiresAt !== args.expectedExpiresAt) {
      return null;
    }

    const now = getCurrentUTCTimestamp();
    if (presence.expiresAt > now) {
      await ctx.scheduler.runAt(
        presence.expiresAt,
        internal.conversationTypingPresence.cleanupInternal,
        args
      );
      return null;
    }

    await ctx.db.delete(presence._id);
    return null;
  },
});

export const getTwitterForProspect = query({
  args: {
    prospectId: v.id("prospects"),
  },
  returns: twitterConversationTypingPresenceValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const prospect = await ctx.db.get(args.prospectId);
    if (
      !prospect ||
      prospect.userId !== user._id ||
      prospect.platform !== "twitter"
    ) {
      return null;
    }

    const conversation = await ctx.db
      .query("platformConversations")
      .withIndex("by_user_prospect_platform", (q) =>
        q
          .eq("userId", user._id)
          .eq("prospectId", args.prospectId)
          .eq("platform", "twitter")
      )
      .first();
    if (!conversation) {
      return null;
    }

    const presence = await ctx.db
      .query("platformConversationTypingPresence")
      .withIndex("by_user_id_and_conversation_id", (q) =>
        q
          .eq("userId", user._id)
          .eq("conversationId", conversation.conversationId)
      )
      .first();

    return presence && presence.expiresAt > getCurrentUTCTimestamp()
      ? {
          senderUserId: presence.senderUserId,
          expiresAt: presence.expiresAt,
        }
      : null;
  },
});
