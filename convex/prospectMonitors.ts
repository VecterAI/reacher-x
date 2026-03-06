// convex/prospectMonitors.ts
// SocialAPI User Tweets Monitor management for outreach response detection
// Creates monitors to detect when prospects reply to our outreach tweets

import {
  internalAction,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { retrier } from "./lib/retrier";
import { monitorStatusValidator } from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

// ============================================================================
// Constants
// ============================================================================

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
// Default monitor expiration: 7 days
const DEFAULT_MONITOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

interface SocialAPICreateMonitorResponse {
  status: "success" | "error";
  message?: string;
  data?: {
    id: string;
    created_at: string;
    monitor_type: string;
    webhook_url: string | null;
    parameters: {
      user_screen_name: string;
      user_name: string;
      user_id_str: string;
    };
  };
}

interface CreateMonitorApiResult {
  success: boolean;
  monitorId?: string;
  error?: string;
}

// ============================================================================
// Internal Queries
// ============================================================================

/**
 * Get prospect monitor by SocialAPI monitor ID (for webhook handler)
 */
export const getMonitorByExternalId = internalQuery({
  args: { monitorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prospectMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();
  },
});

/**
 * Get active monitor for a prospect
 */
export const getActiveMonitorForProspect = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prospectMonitors")
      .withIndex("by_prospect", (q) => q.eq("prospectId", args.prospectId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Save prospect monitor record after creation
 */
export const saveProspectMonitor = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    monitorId: v.string(),
    monitoredUserId: v.string(),
    monitoredUsername: v.string(),
    planId: v.optional(v.id("outreachPlans")),
    ourTweetId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if monitor already exists
    const existing = await ctx.db
      .query("prospectMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("prospectMonitors", {
      ...args,
      status: "active",
      expiresAt:
        args.expiresAt ?? getCurrentUTCTimestamp() + DEFAULT_MONITOR_TTL_MS,
    });
  },
});

/**
 * Update prospect monitor status
 */
export const updateProspectMonitorStatus = internalMutation({
  args: {
    monitorId: v.string(),
    status: monitorStatusValidator,
  },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("prospectMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (!monitor) {
      throw new Error(`Prospect monitor not found: ${args.monitorId}`);
    }

    await ctx.db.patch(monitor._id, { status: args.status });
    return { success: true };
  },
});

/**
 * Record webhook received for a monitor
 */
export const recordWebhook = internalMutation({
  args: { monitorId: v.string() },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("prospectMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (monitor) {
      await ctx.db.patch(monitor._id, {
        lastWebhookAt: getCurrentUTCTimestamp(),
      });
    }
  },
});

// ============================================================================
// Internal Actions (for retrier)
// ============================================================================

/**
 * HTTP call to create a SocialAPI User Tweets Monitor
 */
export const createUserTweetsMonitorApiCall = internalAction({
  args: {
    userId: v.string(), // Twitter user ID
    username: v.string(), // Twitter username (for fallback)
    webhookUrl: v.string(),
  },
  handler: async (_, args): Promise<CreateMonitorApiResult> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "SocialAPI not configured" };
    }

    const response = await fetch(`${SOCIALAPI_BASE_URL}/monitors/user-tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        user_id: args.userId,
        user_screen_name: args.username,
      }),
    });

    const data = (await response.json()) as SocialAPICreateMonitorResponse;

    if (!response.ok || data.status !== "success" || !data.data) {
      throw new Error(data.message ?? `HTTP ${response.status}`);
    }

    return { success: true, monitorId: data.data.id };
  },
});

/**
 * HTTP call to delete a SocialAPI monitor
 */
export const deleteMonitorApiCall = internalAction({
  args: { monitorId: v.string() },
  handler: async (_, args): Promise<{ success: boolean; error?: string }> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "SocialAPI not configured" };
    }

    const response = await fetch(
      `${SOCIALAPI_BASE_URL}/monitors/${args.monitorId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );

    // 404 is acceptable (already deleted)
    if (!response.ok && response.status !== 404) {
      const data = await response.json();
      throw new Error(data.message ?? `HTTP ${response.status}`);
    }

    return { success: true };
  },
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Create a User Tweets Monitor for a prospect.
 * Used to detect when a prospect responds to our outreach.
 */
export const createProspectMonitor = internalAction({
  args: {
    prospectId: v.id("prospects"),
    planId: v.optional(v.id("outreachPlans")),
    ourTweetId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; monitorId?: string; error?: string }> => {
    // Get prospect data
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );

    if (!prospect) {
      return { success: false, error: "Prospect not found" };
    }

    // Extract Twitter user ID and username from prospect data
    const twitterUserId = prospect.data?.user?.id_str;
    const twitterUsername = prospect.data?.user?.screen_name;

    if (!twitterUserId && !twitterUsername) {
      return { success: false, error: "Prospect has no Twitter user ID" };
    }

    // Check if monitor already exists
    const existingMonitor = await ctx.runQuery(
      internal.prospectMonitors.getActiveMonitorForProspect,
      { prospectId: args.prospectId }
    );

    if (existingMonitor) {
      // Update with new tweet ID if provided
      if (args.ourTweetId) {
        await ctx.runMutation(
          internal.prospectMonitors.updateProspectMonitorOurTweetId,
          {
            monitorId: existingMonitor.monitorId,
            ourTweetId: args.ourTweetId,
          }
        );
      }
      return { success: true, monitorId: existingMonitor.monitorId };
    }

    const webhookUrl = `${process.env.CONVEX_SITE_URL}/socialapi-webhook`;

    try {
      // Use retrier for the API call
      const runId = await retrier.run(
        ctx,
        internal.prospectMonitors.createUserTweetsMonitorApiCall,
        {
          userId: twitterUserId || "",
          username: twitterUsername || "",
          webhookUrl,
        }
      );

      // Poll for completion
      let result: CreateMonitorApiResult | null = null;
      while (true) {
        const status = await retrier.status(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (status.type === "completed") {
          if (status.result.type === "success") {
            result = status.result.returnValue as CreateMonitorApiResult;
          } else if (status.result.type === "failed") {
            console.error(
              "[ProspectMonitor] Retrier exhausted:",
              status.result.error
            );
            return { success: false, error: status.result.error };
          }
        }
        break;
      }

      if (!result || !result.success || !result.monitorId) {
        return { success: false, error: result?.error ?? "Unknown error" };
      }

      // Save monitor record
      await ctx.runMutation(internal.prospectMonitors.saveProspectMonitor, {
        prospectId: args.prospectId,
        workspaceId: prospect.workspaceId,
        userId: prospect.userId,
        monitorId: result.monitorId,
        monitoredUserId: twitterUserId || "",
        monitoredUsername: twitterUsername || "",
        planId: args.planId,
        ourTweetId: args.ourTweetId,
      });

      console.info(
        `[ProspectMonitor] Created monitor ${result.monitorId} for @${twitterUsername}`
      );

      return { success: true, monitorId: result.monitorId };
    } catch (error) {
      console.error("[ProspectMonitor] Error creating monitor:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Update the tweet ID we're watching for replies to
 */
export const updateProspectMonitorOurTweetId = internalMutation({
  args: {
    monitorId: v.string(),
    ourTweetId: v.string(),
  },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("prospectMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (monitor) {
      await ctx.db.patch(monitor._id, { ourTweetId: args.ourTweetId });
    }
  },
});

/**
 * Delete a prospect monitor (cleanup after plan completes)
 */
export const deleteProspectMonitor = internalAction({
  args: { monitorId: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // Use retrier for the API call
      const runId = await retrier.run(
        ctx,
        internal.prospectMonitors.deleteMonitorApiCall,
        { monitorId: args.monitorId }
      );

      // Poll for completion
      while (true) {
        const status = await retrier.status(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        // Mark as deleted in our database regardless of API result
        await ctx.runMutation(
          internal.prospectMonitors.updateProspectMonitorStatus,
          {
            monitorId: args.monitorId,
            status: "deleted",
          }
        );

        break;
      }

      console.info(`[ProspectMonitor] Deleted monitor ${args.monitorId}`);
      return { success: true };
    } catch (error) {
      console.error("[ProspectMonitor] Error deleting monitor:", error);

      // Still mark as deleted locally
      try {
        await ctx.runMutation(
          internal.prospectMonitors.updateProspectMonitorStatus,
          {
            monitorId: args.monitorId,
            status: "deleted",
          }
        );
      } catch {
        // Ignore
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Cleanup expired monitors (run periodically)
 */
export const cleanupExpiredMonitors = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    // Get all active monitors that have expired
    const allMonitors = await ctx.runQuery(
      internal.prospectMonitors.getExpiredMonitors,
      {}
    );

    let deleted = 0;
    for (const monitor of allMonitors) {
      await ctx.runAction(internal.prospectMonitors.deleteProspectMonitor, {
        monitorId: monitor.monitorId,
      });
      deleted++;
    }

    if (deleted > 0) {
      console.info(`[ProspectMonitor] Cleaned up ${deleted} expired monitors`);
    }
    return { deleted };
  },
});

/**
 * Get expired monitors (internal query for cleanup)
 */
export const getExpiredMonitors = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = getCurrentUTCTimestamp();
    // Get all active monitors and filter by expiration
    const monitors = await ctx.db
      .query("prospectMonitors")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return monitors.filter(
      (m) => m.expiresAt !== undefined && m.expiresAt < now
    );
  },
});
