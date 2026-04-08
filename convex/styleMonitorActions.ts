"use node";

// convex/styleMonitorActions.ts
// Node.js actions for style monitor lifecycle (create/delete SocialAPI monitors).
// Queries/mutations live in styleMonitors.ts (standard Convex runtime).

import { internalAction } from "./lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { acquireSocialApiBudget } from "./lib/socialApiBudget";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

// ============================================================================
// Constants
// ============================================================================

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
/** Re-backfill if previous backfill is older than 7 days. */
const BACKFILL_STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

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
  duplicate?: boolean;
}

// ============================================================================
// API Helpers (called directly from actions, not registered)
// ============================================================================

async function createStyleMonitorApi(
  ctx: any,
  args: { xUserId: string; username: string }
): Promise<CreateMonitorApiResult> {
  const apiKey = process.env.SOCIALAPI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "SocialAPI not configured" };
  }

  await acquireSocialApiBudget(ctx, "styleMonitors.createMonitor");
  const response = await fetch(`${SOCIALAPI_BASE_URL}/monitors/user-tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      user_id: args.xUserId,
      user_screen_name: args.username,
    }),
  });

  const data = (await response.json()) as SocialAPICreateMonitorResponse;

  if (!response.ok || data.status !== "success" || !data.data) {
    const message = data.message ?? `HTTP ${response.status}`;
    if (/already exists/i.test(message)) {
      return { success: false, duplicate: true, error: message };
    }
    throw new Error(data.message ?? `HTTP ${response.status}`);
  }

  return { success: true, monitorId: data.data.id };
}

async function deleteStyleMonitorApi(
  ctx: any,
  args: { monitorId: string }
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.SOCIALAPI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "SocialAPI not configured" };
  }

  await acquireSocialApiBudget(ctx, "styleMonitors.deleteMonitor");
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

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to delete style monitor: ${body}`);
  }

  return { success: true };
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Idempotent: ensure a style monitor exists for the user's connected X account.
 * Called after X account authorization completes.
 */
export const ensureStyleMonitor = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // 1. Get active X account
    const xAccount = await ctx.runQuery(
      internal.xStore.getXAccountForUserInternal,
      { userId: args.userId }
    );

    if (!xAccount || xAccount.status !== "connected") {
      console.info(
        `[StyleMonitors] No connected X account for user ${args.userId}, skipping`
      );
      return;
    }

    // 2. Check for existing active monitor
    const existing = await ctx.runQuery(
      internal.styleMonitors.getActiveMonitorForUser,
      { userId: args.userId, platform: "twitter" }
    );

    if (existing) {
      if (
        existing.backfillCompletedAt &&
        getCurrentUTCTimestamp() - existing.backfillCompletedAt <
          BACKFILL_STALE_THRESHOLD_MS
      ) {
        console.info(
          `[StyleMonitors] Active monitor exists for user ${args.userId}, backfill still fresh`
        );
        return;
      }
      console.info(
        `[StyleMonitors] Backfill stale for user ${args.userId}, re-triggering`
      );
      await ctx.runMutation(
        internal.styleAnalysis.updateUserWorkspaceStyleStatus,
        {
          userId: args.userId,
          status: "collecting",
        }
      );
      await ctx.scheduler.runAfter(
        0,
        internal.styleAnalysisActions.backfillUserTimeline,
        { userId: args.userId }
      );
      return;
    }

    // 3. Create SocialAPI monitor
    let result: CreateMonitorApiResult;
    try {
      result = await createStyleMonitorApi(ctx, {
        xUserId: xAccount.xUserId,
        username: xAccount.username,
      });
    } catch (error) {
      console.error(
        `[StyleMonitors] Failed to create monitor for user ${args.userId}:`,
        error
      );
      return;
    }

    if (result.duplicate) {
      console.info(
        `[StyleMonitors] External monitor already exists for @${xAccount.username}; skipping duplicate creation`
      );
      return;
    }

    if (!result.success || !result.monitorId) {
      console.error(
        `[StyleMonitors] Monitor creation failed for user ${args.userId}: ${result.error}`
      );
      return;
    }

    // 4. Save the monitor record
    await ctx.runMutation(internal.styleMonitors.saveStyleMonitor, {
      userId: args.userId,
      platform: "twitter",
      xAccountId: xAccount._id,
      monitorId: result.monitorId,
      monitoredExternalUserId: xAccount.xUserId,
      monitoredUsername: xAccount.username,
    });

    console.info(
      `[StyleMonitors] Created style monitor ${result.monitorId} for @${xAccount.username}`
    );

    // 5. Schedule timeline backfill
    await ctx.runMutation(
      internal.styleAnalysis.updateUserWorkspaceStyleStatus,
      {
        userId: args.userId,
        status: "collecting",
      }
    );
    await ctx.scheduler.runAfter(
      0,
      internal.styleAnalysisActions.backfillUserTimeline,
      { userId: args.userId }
    );
  },
});

/**
 * Delete the style monitor when user disconnects their X account.
 */
export const deleteStyleMonitorForUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const monitor = await ctx.runQuery(
      internal.styleMonitors.getActiveMonitorForUser,
      { userId: args.userId, platform: "twitter" }
    );

    if (!monitor) return;

    try {
      await deleteStyleMonitorApi(ctx, { monitorId: monitor.monitorId });
    } catch (error) {
      console.warn(
        `[StyleMonitors] Failed to delete SocialAPI monitor ${monitor.monitorId}:`,
        error
      );
    }

    await ctx.runMutation(internal.styleMonitors.markMonitorDeleted, {
      userId: args.userId,
      platform: "twitter",
    });
    await ctx.runMutation(
      internal.styleAnalysis.recomputeUserWorkspaceStyleStatusAfterDisconnect,
      {
        userId: args.userId,
      }
    );

    console.info(
      `[StyleMonitors] Deleted style monitor for user ${args.userId}`
    );
  },
});
