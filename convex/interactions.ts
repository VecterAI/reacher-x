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
import {
  twitterConversationParticipantValidator,
  twitterInteractionDirectionValidator,
  twitterInteractionDiscoverySourceValidator,
  twitterInteractionOriginValidator,
  twitterInteractionStatusValidator,
} from "./validators";

export const getProspectInteractionSyncStateInternal = internalQuery({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prospectInteractionSyncStates")
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
      .query("prospectInteractionSyncStates")
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

    return await ctx.db.insert("prospectInteractionSyncStates", payload);
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
      .query("prospectInteractionSyncStates")
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
      .query("prospectInteractions")
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
          platform: interaction.platform,
          interactionType: interaction.interactionType,
          threadId: interaction.threadId,
          repliedAt: interaction.repliedAt,
          originalPost: originalSummary
            ? toFallbackTweetFromSummary(originalSummary)
            : null,
          sourcePostData: interaction.sourcePostData ?? null,
          sourceUrl: interaction.sourceUrl ?? undefined,
          replyText:
            interaction.replyText ?? replySummary?.textPreview ?? undefined,
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

export const upsertLinkedInCommentInteractionInternal = internalMutation({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    sourcePostId: v.string(),
    replyPostId: v.string(),
    threadId: v.string(),
    sourcePostData: v.optional(v.any()),
    sourceUrl: v.optional(v.string()),
    replyText: v.string(),
    interactionType: v.union(
      v.literal("comment_posted"),
      v.literal("comment_reply_posted")
    ),
    origin: twitterInteractionOriginValidator,
    discoveredVia: twitterInteractionDiscoverySourceValidator,
    status: v.optional(twitterInteractionStatusValidator),
    direction: v.optional(twitterInteractionDirectionValidator),
    discoveredAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    participants: v.optional(v.array(twitterConversationParticipantValidator)),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("prospectInteractions")
      .withIndex("by_user_prospect_reply", (q) =>
        q
          .eq("userId", args.userId)
          .eq("prospectId", args.prospectId)
          .eq("replyPostId", args.replyPostId)
      )
      .first();

    const payload = {
      userId: args.userId,
      prospectId: args.prospectId,
      platform: "linkedin" as const,
      interactionType: args.interactionType,
      sourcePostId: args.sourcePostId,
      replyPostId: args.replyPostId,
      threadId: args.threadId,
      sourcePostRef: undefined,
      sourcePostSummary: undefined,
      replyPostRef: undefined,
      replyPostSummary: undefined,
      sourcePostData: args.sourcePostData,
      sourceUrl: args.sourceUrl,
      replyText: args.replyText,
      origin:
        existing && existing.origin !== "unknown" && args.origin === "unknown"
          ? existing.origin
          : args.origin,
      discoveredVia:
        existing &&
        existing.discoveredVia !== "live_reconcile" &&
        args.discoveredVia === "live_reconcile"
          ? existing.discoveredVia
          : args.discoveredVia,
      status: args.status ?? existing?.status ?? "active",
      direction: args.direction ?? existing?.direction ?? "outgoing",
      repliedAt: args.discoveredAt ?? existing?.repliedAt ?? getCurrentUTCTimestamp(),
      discoveredAt: args.discoveredAt ?? existing?.discoveredAt,
      lastSeenAt: args.lastSeenAt ?? getCurrentUTCTimestamp(),
      lastHydratedAt: existing?.lastHydratedAt,
      lastHydrationErrorMessage: existing?.lastHydrationErrorMessage,
      participants: args.participants ?? existing?.participants,
      updatedAt: getCurrentUTCTimestamp(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("prospectInteractions", payload);
  },
});

export const markInteractionUnavailable = mutation({
  args: {
    interactionId: v.id("prospectInteractions"),
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
