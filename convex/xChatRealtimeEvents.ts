import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./lib/functionBuilders";
import { requireUser } from "./lib/accessHelpers";
import { xChatRealtimeEventPageValidator } from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const XCHAT_REALTIME_EVENT_TTL_MS = 24 * 60 * 60 * 1000;
const XCHAT_REALTIME_EVENT_QUERY_LIMIT = 50;

export const upsertInternal = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    prospectId: v.id("prospects"),
    conversationId: v.string(),
    eventId: v.string(),
    senderId: v.optional(v.string()),
    createdAtMs: v.optional(v.number()),
    encodedEvent: v.string(),
    receivedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("xChatRealtimeEvents")
      .withIndex("by_user_conversation_event", (q) =>
        q
          .eq("userId", args.userId)
          .eq("conversationId", args.conversationId)
          .eq("eventId", args.eventId)
      )
      .unique();
    if (existing) {
      return null;
    }

    const expiresAt = args.receivedAt + XCHAT_REALTIME_EVENT_TTL_MS;
    const eventId = await ctx.db.insert("xChatRealtimeEvents", {
      ...args,
      expiresAt,
    });
    await ctx.scheduler.runAt(
      expiresAt,
      internal.xChatRealtimeEvents.cleanupInternal,
      { eventId, expectedExpiresAt: expiresAt }
    );
    return null;
  },
});

export const cleanupInternal = internalMutation({
  args: {
    eventId: v.id("xChatRealtimeEvents"),
    expectedExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.expiresAt !== args.expectedExpiresAt) {
      return null;
    }
    const now = getCurrentUTCTimestamp();
    if (event.expiresAt > now) {
      await ctx.scheduler.runAt(
        event.expiresAt,
        internal.xChatRealtimeEvents.cleanupInternal,
        args
      );
      return null;
    }
    await ctx.db.delete(event._id);
    return null;
  },
});

export const getForProspect = query({
  args: { prospectId: v.id("prospects") },
  returns: xChatRealtimeEventPageValidator,
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

    const events = await ctx.db
      .query("xChatRealtimeEvents")
      .withIndex("by_user_prospect_received_at", (q) =>
        q.eq("userId", user._id).eq("prospectId", args.prospectId)
      )
      .order("desc")
      .take(XCHAT_REALTIME_EVENT_QUERY_LIMIT);
    if (events.length === 0) {
      return null;
    }

    const orderedEvents = [...events].reverse();
    return {
      conversationId: orderedEvents[0]!.conversationId,
      events: orderedEvents.map((event) => ({
        id: event.eventId,
        conversationId: event.conversationId,
        senderId: event.senderId,
        createdAtMs: event.createdAtMs,
        encodedEvent: event.encodedEvent,
      })),
    };
  },
});
