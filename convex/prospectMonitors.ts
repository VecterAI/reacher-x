// convex/prospectMonitors.ts
// SocialAPI User Tweets Monitor management for outreach response detection
// Creates monitors to detect when prospects reply to our outreach tweets

import {
  internalAction,
  internalQuery,
  internalMutation,
} from "./lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  getRetriedActionStatus,
  runProviderActionRetried,
} from "./lib/retrier";
import { fetchSocialApi } from "./lib/socialApiFetch";
import { areAutonomousJobsPaused } from "./lib/autonomousJobHelpers";
import { monitorStatusValidator } from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { logger } from "../shared/lib/logger";

// ============================================================================
// Constants
// ============================================================================

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
// Default monitor expiration: 7 days
const DEFAULT_MONITOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Bounded cleanup batch: one hourly run deletes at most this many expired
// monitors and continues itself when the batch was full.
const EXPIRED_MONITOR_CLEANUP_BATCH = 25;
const EXPIRED_MONITOR_CLEANUP_DELAY_MS = 60_000;
// Monitors whose remote deletion failed sit out this long before the cleanup
// retries them, so a permanently failing row cannot occupy every batch.
const EXPIRED_MONITOR_DELETE_BACKOFF_MS = 2 * 60 * 60 * 1000;
// Async-iteration scan budget for one cleanup run (tiny index rows).
const EXPIRED_MONITOR_SCAN_BUDGET = 400;
const prospectMonitorLogger = logger.withScope("ProspectMonitors");

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
 * Removes a tracked row entirely. Used when remote deletion failed with a
 * permanent provider error during workspace deletion: the remote monitor
 * becomes an orphan that the monitor cost reconciliation cron deletes once
 * the provider works again.
 */
export const deleteProspectMonitorRowInternal = internalMutation({
  args: { monitorId: v.string() },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("prospectMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();
    if (!monitor) {
      return { removed: false };
    }
    await ctx.db.delete(monitor._id);
    return { removed: true };
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
  handler: async (ctx, args): Promise<CreateMonitorApiResult> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "SocialAPI not configured" };
    }

    const response = await fetchSocialApi(
      ctx,
      "prospectMonitors.createMonitor",
      `${SOCIALAPI_BASE_URL}/monitors/user-tweets`,
      {
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
      },
      { estimateUsage: () => ({ billableUnits: 0, estimatedCostUsd: 0 }) }
    );

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
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "SocialAPI not configured" };
    }

    const response = await fetchSocialApi(
      ctx,
      "prospectMonitors.deleteMonitor",
      `${SOCIALAPI_BASE_URL}/monitors/${args.monitorId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
      { estimateUsage: () => ({ billableUnits: 0, estimatedCostUsd: 0 }) }
    );

    // 404 is acceptable (already deleted). The status code must survive into
    // the error text so transient (5xx/429) failures can be classified by
    // the deletion workflows; the body message is appended defensively (the
    // body can be a JSON null, so read it with optional chaining).
    if (!response.ok && response.status !== 404) {
      const data = await response.json().catch(() => null);
      const message =
        typeof data?.message === "string" ? data.message : undefined;
      throw new Error(
        `HTTP ${response.status}${message ? `: ${message}` : ""}`
      );
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
      return { success: false, error: "Profile not found" };
    }

    // Extract Twitter user ID and username from prospect data
    const twitterUserId = prospect.data?.user?.id_str;
    const twitterUsername = prospect.data?.user?.screen_name;

    if (!twitterUserId && !twitterUsername) {
      return { success: false, error: "Profile has no Twitter user ID" };
    }

    // Check if monitor already exists
    const existingMonitor = await ctx.runQuery(
      internal.prospectMonitors.getActiveMonitorForProspect,
      { prospectId: args.prospectId }
    );

    if (existingMonitor) {
      // Update with fresh plan/tweet context when reusing an existing monitor.
      if (args.ourTweetId || args.planId) {
        await ctx.runMutation(
          internal.prospectMonitors.updateProspectMonitorOurTweetId,
          {
            monitorId: existingMonitor.monitorId,
            ourTweetId: args.ourTweetId,
            planId: args.planId,
          }
        );
      }
      return { success: true, monitorId: existingMonitor.monitorId };
    }

    const webhookUrl = `${process.env.CONVEX_SITE_URL}/socialapi-webhook`;

    try {
      // Use retrier for the API call
      const runId = await runProviderActionRetried(
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
        const status = await getRetriedActionStatus(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (status.type === "completed") {
          if (status.result.type === "success") {
            result = status.result.returnValue as CreateMonitorApiResult;
          } else if (status.result.type === "failed") {
            prospectMonitorLogger.error(
              "Monitor creation retrier exhausted",
              {
                prospectId: String(args.prospectId),
                username: twitterUsername ?? undefined,
              },
              new Error(status.result.error)
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

      return { success: true, monitorId: result.monitorId };
    } catch (error) {
      prospectMonitorLogger.error(
        "Error creating monitor",
        {
          prospectId: String(args.prospectId),
          username: twitterUsername ?? undefined,
        },
        error
      );
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
    ourTweetId: v.optional(v.string()),
    planId: v.optional(v.id("outreachPlans")),
  },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("prospectMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (monitor) {
      await ctx.db.patch(monitor._id, {
        ...(args.ourTweetId ? { ourTweetId: args.ourTweetId } : {}),
        ...(args.planId ? { planId: args.planId } : {}),
      });
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
      const runId = await runProviderActionRetried(
        ctx,
        internal.prospectMonitors.deleteMonitorApiCall,
        { monitorId: args.monitorId }
      );

      // Poll for completion
      while (true) {
        const status = await getRetriedActionStatus(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (status.type === "completed" && status.result.type === "success") {
          const apiResult = status.result.returnValue as {
            success: boolean;
            error?: string;
          };
          if (!apiResult.success) {
            // The action completed without throwing but reported failure
            // (for example a missing API key). Only mark deleted once
            // SocialAPI confirmed the deletion; a row marked deleted while
            // the remote monitor survives would bill forever as an
            // invisible orphan.
            prospectMonitorLogger.warn(
              "Delete returned failure; leaving monitor tracked for the next cleanup run",
              { monitorId: args.monitorId, error: apiResult.error }
            );
            return {
              success: false,
              error: apiResult.error ?? "Unknown error",
            };
          }
          await ctx.runMutation(
            internal.prospectMonitors.updateProspectMonitorStatus,
            {
              monitorId: args.monitorId,
              status: "deleted",
            }
          );
          break;
        }

        if (status.type === "completed" && status.result.type === "failed") {
          prospectMonitorLogger.warn(
            "Delete failed after retries; leaving monitor tracked for the next cleanup run",
            { monitorId: args.monitorId, error: status.result.error }
          );
          return {
            success: false,
            error: `Failed after retries: ${status.result.error}`,
          };
        }
        if (status.type === "completed") {
          // Canceled retrier run.
          prospectMonitorLogger.warn(
            "Delete request was canceled; leaving monitor tracked for the next cleanup run",
            { monitorId: args.monitorId }
          );
          return { success: false, error: "Request was canceled" };
        }
        break;
      }

      return { success: true };
    } catch (error) {
      prospectMonitorLogger.error(
        "Error deleting monitor",
        { monitorId: args.monitorId },
        error
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Cleanup expired monitors (run periodically). Deleting an expired monitor
 * stops its per-run billing on SocialAPI's side; the 7-day TTL on each
 * outreach response monitor bounds how long a paused workspace keeps paying.
 * Bounded to a small batch per run with self-continuation so a backlog or a
 * provider outage cannot stretch one action past its time limit.
 */
export const cleanupExpiredMonitors = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deleted: number; continuation: boolean }> => {
    if (areAutonomousJobsPaused()) {
      console.warn(
        "[ProspectMonitors] Autonomous jobs paused, skipping expired monitor cleanup"
      );
      return { deleted: 0, continuation: false };
    }

    // Get a bounded batch of active monitors that have expired
    const allMonitors = await ctx.runQuery(
      internal.prospectMonitors.getExpiredMonitors,
      {}
    );

    const now = getCurrentUTCTimestamp();
    let deleted = 0;
    let backoffUpdated = 0;
    for (const monitor of allMonitors) {
      const result = await ctx.runAction(
        internal.prospectMonitors.deleteProspectMonitor,
        {
          monitorId: monitor.monitorId,
        }
      );
      if (result.success) {
        deleted += 1;
      } else {
        // Failed deletion: record the failure so the row sits out one
        // interval and cannot occupy every batch ahead of newer expired
        // rows. Transient outages retry after the backoff; the row only
        // leaves the active set through a later successful deletion.
        await ctx.runMutation(
          internal.prospectMonitors.recordMonitorDeleteFailureInternal,
          { monitorId: monitor.monitorId, now }
        );
        backoffUpdated += 1;
      }
    }

    // Only continue when the run made progress: a full batch of failures
    // must not stack 60-second continuations on top of the hourly cron.
    const continuation =
      allMonitors.length >= EXPIRED_MONITOR_CLEANUP_BATCH &&
      deleted > 0 &&
      // Progress in the backoff sense also counts: rows moved into their
      // backoff window frees the next batch for newer expired rows.
      !(deleted === 0 && backoffUpdated === allMonitors.length);
    if (continuation) {
      await ctx.scheduler.runAfter(
        EXPIRED_MONITOR_CLEANUP_DELAY_MS,
        internal.prospectMonitors.cleanupExpiredMonitors,
        {}
      );
    }

    return { deleted, continuation };
  },
});

/**
 * Marks one monitor's remote-deletion failure time so the expired-monitor
 * cleanup can back off from rows that keep failing.
 */
export const recordMonitorDeleteFailureInternal = internalMutation({
  args: { monitorId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("prospectMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();
    if (!monitor) {
      return { updated: false };
    }
    await ctx.db.patch(monitor._id, { lastDeleteAttemptAt: args.now });
    return { updated: true };
  },
});

/**
 * Get expired monitors (bounded batch for cleanup). Paginates the
 * by_status_expires_at index past rows that are sitting out their
 * deletion-failure backoff until the batch is full or the index is
 * exhausted, so a prefix of ineligible rows can never hide newer expired
 * ones behind a fixed take window. The explicit lower bound matters because
 * Convex index ordering places rows with an undefined field first, and an
 * active row without an expiry must never be treated as expired.
 */
export const getExpiredMonitors = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = getCurrentUTCTimestamp();
    const backoffCutoff = now - EXPIRED_MONITOR_DELETE_BACKOFF_MS;
    const eligible: Array<Doc<"prospectMonitors">> = [];
    // Async iteration streams the index past rows sitting out their
    // deletion-failure backoff until the batch is full, so an ineligible
    // prefix can never hide newer expired rows behind a fixed take window.
    // Convex allows only one paginated query per function, so pagination
    // cursors would throw here; streaming has no such restriction. Scan
    // budget: 400 tiny index rows per run; remaining rows resurface on the
    // next hourly run.
    let scanned = 0;
    const expired = ctx.db
      .query("prospectMonitors")
      .withIndex("by_status_expires_at", (q) =>
        q.eq("status", "active").gt("expiresAt", 0).lt("expiresAt", now)
      );
    for await (const monitor of expired) {
      scanned += 1;
      if (
        monitor.lastDeleteAttemptAt === undefined ||
        monitor.lastDeleteAttemptAt <= backoffCutoff
      ) {
        eligible.push(monitor);
      }
      if (
        eligible.length >= EXPIRED_MONITOR_CLEANUP_BATCH ||
        scanned >= EXPIRED_MONITOR_SCAN_BUDGET
      ) {
        break;
      }
    }

    return eligible;
  },
});
