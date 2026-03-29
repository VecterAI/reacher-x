import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { requireOwnedProspect, requireUser } from "./lib/accessHelpers";
import { summarizeTwitterPost } from "../shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "../shared/lib/twitter/ui";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { twitterInteractionStatusValidator } from "./validators";

export const getProspectInteractionSyncStateInternal = internalQuery({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("twitterInteractionSyncStates")
      .withIndex("by_user_prospect", (q) =>
        q.eq("userId", args.userId).eq("prospectId", args.prospectId)
      )
      .first();
  },
});

export const upsertProspectInteractionSyncStateInternal = internalMutation({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    trackingStartedAt: v.number(),
    lastAttemptAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastSeenPostId: v.optional(v.string()),
    lastSeenCreatedAt: v.optional(v.number()),
    nextAllowedSyncAt: v.optional(v.number()),
    failureCount: v.optional(v.number()),
    lastErrorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("twitterInteractionSyncStates")
      .withIndex("by_user_prospect", (q) =>
        q.eq("userId", args.userId).eq("prospectId", args.prospectId)
      )
      .first();

    const payload = {
      userId: args.userId,
      prospectId: args.prospectId,
      platform: "twitter" as const,
      trackingStartedAt: existing?.trackingStartedAt ?? args.trackingStartedAt,
      lastAttemptAt: args.lastAttemptAt ?? existing?.lastAttemptAt,
      lastSuccessAt: args.lastSuccessAt ?? existing?.lastSuccessAt,
      lastSeenPostId: args.lastSeenPostId ?? existing?.lastSeenPostId,
      lastSeenCreatedAt: args.lastSeenCreatedAt ?? existing?.lastSeenCreatedAt,
      nextAllowedSyncAt: args.nextAllowedSyncAt ?? existing?.nextAllowedSyncAt,
      failureCount: args.failureCount ?? existing?.failureCount ?? 0,
      lastErrorMessage:
        args.lastErrorMessage !== undefined
          ? args.lastErrorMessage
          : existing?.lastErrorMessage,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("twitterInteractionSyncStates", payload);
  },
});

export const getProspectInteractionSyncState = query({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const user = await requireUser(ctx);
    await requireOwnedProspect(ctx, prospectId, { user });
    const state = await ctx.db
      .query("twitterInteractionSyncStates")
      .withIndex("by_user_prospect", (q) =>
        q.eq("userId", user._id).eq("prospectId", prospectId)
      )
      .first();

    return state
      ? {
          trackingStartedAt: state.trackingStartedAt,
          lastAttemptAt: state.lastAttemptAt,
          lastSuccessAt: state.lastSuccessAt,
          nextAllowedSyncAt: state.nextAllowedSyncAt,
          failureCount: state.failureCount ?? 0,
          lastErrorMessage: state.lastErrorMessage,
          isRefreshing:
            typeof state.lastAttemptAt === "number" &&
            (state.lastSuccessAt ?? 0) < state.lastAttemptAt &&
            Date.now() - state.lastAttemptAt < 30_000,
        }
      : null;
  },
});

export const getProspectInteractionsPage = query({
  args: {
    prospectId: v.id("prospects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { prospectId, paginationOpts }) => {
    const user = await requireUser(ctx);
    await requireOwnedProspect(ctx, prospectId, { user });

    const page = await ctx.db
      .query("twitterInteractions")
      .withIndex("by_user_prospect_replied", (q) =>
        q.eq("userId", user._id).eq("prospectId", prospectId)
      )
      .order("desc")
      .paginate(paginationOpts);

    return {
      page: page.page.map((interaction) => {
        const originalSummary =
          interaction.sourcePostSummary ??
          summarizeTwitterPost(interaction.sourcePostRef);
        const replySummary =
          interaction.replyPostSummary ??
          summarizeTwitterPost(interaction.replyPostRef);
        const participants =
          interaction.participants?.map((participant) => ({
            name: participant.name || participant.handle || "Unknown",
            username: participant.handle || "",
            avatarUrl: participant.avatarUrl,
          })) ?? [];

        return {
          id: interaction._id,
          threadId: interaction.threadId,
          repliedAt: interaction.repliedAt,
          originalPost: originalSummary
            ? toFallbackTweetFromSummary(originalSummary)
            : null,
          sourcePostRef: interaction.sourcePostRef,
          sourcePostSummary: originalSummary ?? null,
          replyPostRef: interaction.replyPostRef,
          replyPostSummary: replySummary ?? null,
          lastReplyPreview: replySummary?.textPreview,
          origin: interaction.origin,
          discoveredVia: interaction.discoveredVia,
          status: interaction.status ?? "active",
          direction: interaction.direction,
          discoveredAt: interaction.discoveredAt,
          lastSeenAt: interaction.lastSeenAt,
          lastHydratedAt: interaction.lastHydratedAt,
          lastHydrationErrorMessage: interaction.lastHydrationErrorMessage,
          participants,
        };
      }),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const markInteractionUnavailable = mutation({
  args: {
    interactionId: v.id("twitterInteractions"),
    status: twitterInteractionStatusValidator,
    lastHydrationErrorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const interaction = await ctx.db.get(args.interactionId);
    if (!interaction || interaction.userId !== user._id) {
      throw new Error("Interaction not found");
    }

    await ctx.db.patch(args.interactionId, {
      status: args.status,
      lastHydratedAt: getCurrentUTCTimestamp(),
      lastHydrationErrorMessage: args.lastHydrationErrorMessage,
      updatedAt: getCurrentUTCTimestamp(),
    });

    return { success: true };
  },
});
