"use node";

// convex/styleMonitorActions.ts
// Node.js actions for style monitor lifecycle (create/delete SocialAPI monitors).
// Queries/mutations live in styleMonitors.ts (standard Convex runtime).

import { internalAction } from "./lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { acquireSocialApiBudget } from "./lib/socialApiBudget";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { logger } from "../shared/lib/logger";

// ============================================================================
// Constants
// ============================================================================

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
/** Re-backfill if previous backfill is older than 7 days. */
const BACKFILL_STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const styleMonitorLogger = logger.withScope("StyleMonitorActions");

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
      return;
    }

    const activeSourceVersion =
      xAccount.styleSourceVersion ?? xAccount._creationTime;

    // 2. Check for existing active monitor
    const existing = await ctx.runQuery(
      internal.styleMonitors.getActiveMonitorForUser,
      { userId: args.userId, platform: "twitter" }
    );

    if (existing) {
      const pointsAtCurrentSource =
        existing.monitoredExternalUserId === xAccount.xUserId &&
        existing.sourceVersion === activeSourceVersion;

      if (!pointsAtCurrentSource) {
        try {
          await deleteStyleMonitorApi(ctx, { monitorId: existing.monitorId });
        } catch (error) {
          styleMonitorLogger.warn(
            "Failed to delete stale SocialAPI monitor",
            { userId: String(args.userId), monitorId: existing.monitorId },
            error
          );
        }
        await ctx.runMutation(internal.styleMonitors.markMonitorDeleted, {
          userId: args.userId,
          platform: "twitter",
          sourceVersion: existing.sourceVersion,
        });
      } else if (
        existing.backfillCompletedAt &&
        getCurrentUTCTimestamp() - existing.backfillCompletedAt <
          BACKFILL_STALE_THRESHOLD_MS
      ) {
        return;
      } else {
        await ctx.runMutation(
          internal.styleAnalysis.updateUserWorkspaceStyleStatus,
          {
            userId: args.userId,
            platform: "twitter",
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
    }

    // 3. Create SocialAPI monitor
    let result: CreateMonitorApiResult;
    try {
      result = await createStyleMonitorApi(ctx, {
        xUserId: xAccount.xUserId,
        username: xAccount.username,
      });
    } catch (error) {
      styleMonitorLogger.error(
        "Failed to create monitor",
        { userId: String(args.userId), username: xAccount.username },
        error
      );
      return;
    }

    if (result.duplicate) {
      return;
    }

    if (!result.success || !result.monitorId) {
      styleMonitorLogger.error("Monitor creation failed", {
        userId: String(args.userId),
        username: xAccount.username,
        errorMessage: result.error ?? "Unknown error",
      });
      return;
    }

    // 4. Save the monitor record
    await ctx.runMutation(internal.styleMonitors.saveStyleMonitor, {
      userId: args.userId,
      platform: "twitter",
      sourceVersion: activeSourceVersion,
      xAccountId: xAccount._id,
      monitorId: result.monitorId,
      monitoredExternalUserId: xAccount.xUserId,
      monitoredUsername: xAccount.username,
    });

    // 5. Schedule timeline backfill
    await ctx.runMutation(
      internal.styleAnalysis.updateUserWorkspaceStyleStatus,
      {
        userId: args.userId,
        platform: "twitter",
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
  args: { userId: v.id("users"), sourceVersion: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const monitor =
      typeof args.sourceVersion === "number"
        ? await ctx.runQuery(internal.styleMonitors.getActiveMonitorForSource, {
            userId: args.userId,
            platform: "twitter",
            sourceVersion: args.sourceVersion,
          })
        : await ctx.runQuery(internal.styleMonitors.getActiveMonitorForUser, {
            userId: args.userId,
            platform: "twitter",
          });

    if (!monitor) return;

    try {
      await deleteStyleMonitorApi(ctx, { monitorId: monitor.monitorId });
    } catch (error) {
      styleMonitorLogger.warn(
        "Failed to delete SocialAPI monitor",
        { userId: String(args.userId), monitorId: monitor.monitorId },
        error
      );
    }

    await ctx.runMutation(internal.styleMonitors.markMonitorDeleted, {
      userId: args.userId,
      platform: "twitter",
      sourceVersion: monitor.sourceVersion,
    });
    await ctx.runMutation(
      internal.styleAnalysis.recomputeUserWorkspaceStyleStatusAfterDisconnect,
      {
        userId: args.userId,
        platform: "twitter",
      }
    );
  },
});
