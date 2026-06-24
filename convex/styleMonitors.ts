// convex/styleMonitors.ts
// Style monitor queries and mutations (standard Convex runtime).
// Actions (ensureStyleMonitor, deleteStyleMonitorForUser) live in
// styleMonitorActions.ts ("use node") since they need fetch.

import { internalQuery, internalMutation } from "./lib/functionBuilders";
import { v } from "convex/values";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

// ============================================================================
// Internal Queries
// ============================================================================

/**
 * Get style monitor by SocialAPI monitor ID (for webhook handler routing).
 */
export const getMonitorByExternalId = internalQuery({
  args: { monitorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("styleMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();
  },
});

/**
 * Get active style monitor for a user on a specific platform.
 */
export const getActiveMonitorForUser = internalQuery({
  args: {
    userId: v.id("users"),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("styleMonitors")
      .withIndex("by_user_platform", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", args.platform as "twitter" | "linkedin")
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

export const getActiveMonitorForSource = internalQuery({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("styleMonitors")
      .withIndex("by_user_platform_source_version", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", args.platform)
          .eq("sourceVersion", args.sourceVersion)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

export const getLatestMonitorForExternalUser = internalQuery({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    monitoredExternalUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const monitors = await ctx.db
      .query("styleMonitors")
      .withIndex("by_user_platform", (q) =>
        q.eq("userId", args.userId).eq("platform", args.platform)
      )
      .collect();

    return (
      monitors
        .filter(
          (monitor) =>
            monitor.monitoredExternalUserId === args.monitoredExternalUserId &&
            typeof monitor.sourceVersion === "number"
        )
        .sort((left, right) => {
          const sourceDelta =
            (right.sourceVersion ?? 0) - (left.sourceVersion ?? 0);
          if (sourceDelta !== 0) {
            return sourceDelta;
          }
          return right._creationTime - left._creationTime;
        })[0] ?? null
    );
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Save a new style monitor record after SocialAPI creation.
 */
export const saveStyleMonitor = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
    xAccountId: v.optional(v.id("xAccounts")),
    monitorId: v.string(),
    monitoredExternalUserId: v.string(),
    monitoredUsername: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if monitor already exists by monitorId
    const existing = await ctx.db
      .query("styleMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("styleMonitors", {
      ...args,
      status: "active",
      backfillStatus: "pending",
    });
  },
});

/**
 * Record that a webhook was received for this monitor.
 */
export const recordWebhook = internalMutation({
  args: { monitorId: v.string() },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("styleMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (monitor) {
      await ctx.db.patch(monitor._id, {
        lastWebhookAt: getCurrentUTCTimestamp(),
      });
    }
  },
});

/**
 * Update backfill progress for a style monitor.
 */
export const updateBackfillStatus = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    sampleCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const monitor =
      typeof args.sourceVersion === "number"
        ? await ctx.db
            .query("styleMonitors")
            .withIndex("by_user_platform_source_version", (q) =>
              q
                .eq("userId", args.userId)
                .eq("platform", args.platform)
                .eq("sourceVersion", args.sourceVersion!)
            )
            .filter((q) => q.eq(q.field("status"), "active"))
            .first()
        : await ctx.db
            .query("styleMonitors")
            .withIndex("by_user_platform", (q) =>
              q.eq("userId", args.userId).eq("platform", args.platform)
            )
            .filter((q) => q.eq(q.field("status"), "active"))
            .first();

    if (!monitor) return;

    const patch: Record<string, unknown> = {
      backfillStatus: args.status,
    };
    if (args.status === "completed") {
      patch.backfillCompletedAt = getCurrentUTCTimestamp();
      if (args.sampleCount !== undefined) {
        patch.backfillSampleCount = args.sampleCount;
      }
    }

    await ctx.db.patch(monitor._id, patch);
  },
});

/**
 * Mark a style monitor as deleted (soft delete).
 */
export const markMonitorDeleted = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const monitor =
      typeof args.sourceVersion === "number"
        ? await ctx.db
            .query("styleMonitors")
            .withIndex("by_user_platform_source_version", (q) =>
              q
                .eq("userId", args.userId)
                .eq("platform", args.platform)
                .eq("sourceVersion", args.sourceVersion!)
            )
            .filter((q) => q.eq(q.field("status"), "active"))
            .first()
        : await ctx.db
            .query("styleMonitors")
            .withIndex("by_user_platform", (q) =>
              q.eq("userId", args.userId).eq("platform", args.platform)
            )
            .filter((q) => q.eq(q.field("status"), "active"))
            .first();

    if (monitor) {
      await ctx.db.patch(monitor._id, { status: "deleted" });
    }
  },
});

export const restoreMonitorForSource = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("twitter"), v.literal("linkedin")),
    sourceVersion: v.number(),
    xAccountId: v.optional(v.id("xAccounts")),
  },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("styleMonitors")
      .withIndex("by_user_platform_source_version", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", args.platform)
          .eq("sourceVersion", args.sourceVersion)
      )
      .first();

    if (!monitor) {
      return null;
    }

    const patch: Record<string, unknown> = {};
    if (monitor.status !== "active") {
      patch.status = "active";
    }
    if (args.platform === "twitter" && args.xAccountId !== undefined) {
      patch.xAccountId = args.xAccountId;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(monitor._id, patch);
    }

    return {
      _id: monitor._id,
      backfillCompletedAt: monitor.backfillCompletedAt,
      backfillSampleCount: monitor.backfillSampleCount,
      backfillStatus: monitor.backfillStatus,
      monitorId: monitor.monitorId,
      monitoredExternalUserId: monitor.monitoredExternalUserId,
      monitoredUsername: monitor.monitoredUsername,
      platform: monitor.platform,
      sourceVersion: monitor.sourceVersion,
      status: "active" as const,
      userId: monitor.userId,
      xAccountId:
        args.platform === "twitter" && args.xAccountId !== undefined
          ? args.xAccountId
          : monitor.xAccountId,
    };
  },
});

// Actions (ensureStyleMonitor, deleteStyleMonitorForUser) are in
// styleMonitorActions.ts ("use node") since they need fetch for SocialAPI calls.
