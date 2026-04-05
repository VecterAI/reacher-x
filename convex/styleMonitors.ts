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
        q.eq("userId", args.userId).eq("platform", args.platform as "twitter" | "linkedin")
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
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
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    sampleCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
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
  args: { userId: v.id("users"), platform: v.union(v.literal("twitter"), v.literal("linkedin")) },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
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

// Actions (ensureStyleMonitor, deleteStyleMonitorForUser) are in
// styleMonitorActions.ts ("use node") since they need fetch for SocialAPI calls.
