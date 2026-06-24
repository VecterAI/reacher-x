"use node";

// convex/styleMonitorActions.ts
// Node.js actions for style monitor lifecycle (create/delete SocialAPI monitors).
// Queries/mutations live in styleMonitors.ts (standard Convex runtime).

import { internalAction } from "./lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { acquireSocialApiBudget } from "./lib/socialApiBudget";
import { buildStyleSourceKey } from "./lib/styleSourceCore";
import { BATCH_ANALYSIS_THRESHOLD } from "./lib/workspaceStyleProfileCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { logger } from "../shared/lib/logger";

// ============================================================================
// Constants
// ============================================================================

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
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

function getTwitterStyleSourceVersion(xAccount: {
  _creationTime: number;
  styleSourceVersion?: number;
}) {
  return xAccount.styleSourceVersion ?? xAccount._creationTime;
}

async function getTwitterStyleSampleCount(
  ctx: any,
  args: { userId: string; sourceVersion: number }
) {
  return await ctx.runQuery(
    internal.styleAnalysis.getStyleSampleCountForSource,
    {
      userId: args.userId,
      platform: "twitter",
      sourceVersion: args.sourceVersion,
    }
  );
}

async function updateTwitterStyleStatus(
  ctx: any,
  args: {
    userId: string;
    xAccount: {
      _creationTime: number;
      styleSourceKey?: string;
      styleSourceVersion?: number;
      xUserId: string;
    };
    status: "collecting" | "failed";
    lastError?: string;
  }
) {
  const sourceVersion = getTwitterStyleSourceVersion(args.xAccount);
  await ctx.runMutation(internal.styleAnalysis.updateUserWorkspaceStyleStatus, {
    userId: args.userId,
    platform: "twitter",
    status: args.status,
    sourceKey: args.xAccount.styleSourceKey,
    sourceVersion,
    sourceExternalUserId: args.xAccount.xUserId,
    lastError:
      args.status === "failed"
        ? (args.lastError ?? "X style sync failed")
        : undefined,
  });

  if (args.status === "failed") {
    await ctx.runMutation(internal.styleMonitors.updateBackfillStatus, {
      userId: args.userId,
      platform: "twitter",
      sourceVersion,
      status: "failed",
    });
  }
}

async function scheduleTwitterBackfill(
  ctx: any,
  args: {
    userId: string;
    xAccount: {
      _creationTime: number;
      styleSourceKey?: string;
      styleSourceVersion?: number;
      xUserId: string;
    };
  }
) {
  const sourceVersion = getTwitterStyleSourceVersion(args.xAccount);
  await updateTwitterStyleStatus(ctx, {
    userId: args.userId,
    xAccount: args.xAccount,
    status: "collecting",
  });
  await ctx.runMutation(internal.styleMonitors.updateBackfillStatus, {
    userId: args.userId,
    platform: "twitter",
    sourceVersion,
    status: "pending",
  });
  await ctx.scheduler.runAfter(
    0,
    internal.styleAnalysisActions.backfillUserTimeline,
    { userId: args.userId }
  );
}

async function replayTwitterStyleFromExistingSamples(
  ctx: any,
  args: {
    userId: string;
    xAccount: {
      _creationTime: number;
      styleSourceKey?: string;
      styleSourceVersion?: number;
      xUserId: string;
    };
    sampleCount: number;
  }
) {
  if (args.sampleCount < BATCH_ANALYSIS_THRESHOLD) {
    return false;
  }

  const sourceVersion = getTwitterStyleSourceVersion(args.xAccount);
  await updateTwitterStyleStatus(ctx, {
    userId: args.userId,
    xAccount: args.xAccount,
    status: "collecting",
  });
  await ctx.runMutation(internal.styleMonitors.updateBackfillStatus, {
    userId: args.userId,
    platform: "twitter",
    sourceVersion,
    status: "completed",
    sampleCount: args.sampleCount,
  });

  const workspaces = await ctx.runQuery(
    internal.workspaces.getUserWorkspacesInternal,
    {
      userId: args.userId,
    }
  );

  for (const workspace of workspaces) {
    const existingProfile = await ctx.runQuery(
      internal.workspaceStyleProfiles.getWorkspaceStyleProfile,
      {
        workspaceId: workspace._id,
        platform: "twitter",
      }
    );
    const isAlreadyCurrent =
      existingProfile?.sourceVersion === sourceVersion &&
      existingProfile?.sourceExternalUserId === args.xAccount.xUserId &&
      (existingProfile.status === "ready" ||
        existingProfile.status === "analyzing");

    if (isAlreadyCurrent) {
      continue;
    }

    await ctx.runMutation(internal.styleAnalysis.recordStyleBackfillEvent, {
      workspaceId: workspace._id,
      userId: args.userId,
      platform: "twitter",
      sourceVersion,
      sourceExternalUserId: args.xAccount.xUserId,
      sampleCount: args.sampleCount,
    });
  }

  return true;
}

async function repairTwitterSourceVersionIfNeeded(
  ctx: any,
  args: {
    userId: string;
    xAccount: {
      _id: string;
      _creationTime: number;
      styleSourceKey?: string;
      styleSourceVersion?: number;
      styleSourceSwitchedAt?: number;
      xUserId: string;
    };
  }
) {
  const activeSourceVersion = getTwitterStyleSourceVersion(args.xAccount);
  const currentSampleCount = await getTwitterStyleSampleCount(ctx, {
    userId: args.userId,
    sourceVersion: activeSourceVersion,
  });
  if (currentSampleCount > 0) {
    return {
      xAccount: args.xAccount,
      activeSourceVersion,
      sampleCount: currentSampleCount,
    };
  }

  const historicalMonitor = await ctx.runQuery(
    internal.styleMonitors.getLatestMonitorForExternalUser,
    {
      userId: args.userId,
      platform: "twitter",
      monitoredExternalUserId: args.xAccount.xUserId,
    }
  );

  if (
    !historicalMonitor ||
    typeof historicalMonitor.sourceVersion !== "number" ||
    historicalMonitor.sourceVersion === activeSourceVersion
  ) {
    return {
      xAccount: args.xAccount,
      activeSourceVersion,
      sampleCount: currentSampleCount,
    };
  }

  const now = getCurrentUTCTimestamp();
  await ctx.runMutation(internal.xStore.patchXAccountInternal, {
    userId: args.userId,
    patch: {
      styleSourceKey: buildStyleSourceKey("twitter", args.xAccount.xUserId),
      styleSourceVersion: historicalMonitor.sourceVersion,
      styleSourceSwitchedAt:
        historicalMonitor._creationTime ??
        args.xAccount.styleSourceSwitchedAt ??
        now,
      updatedAt: now,
    },
  });

  const refreshedAccount = await ctx.runQuery(
    internal.xStore.getXAccountForUserInternal,
    {
      userId: args.userId,
    }
  );
  const nextAccount = refreshedAccount ?? args.xAccount;
  return {
    xAccount: nextAccount,
    activeSourceVersion: historicalMonitor.sourceVersion,
    sampleCount: await getTwitterStyleSampleCount(ctx, {
      userId: args.userId,
      sourceVersion: historicalMonitor.sourceVersion,
    }),
  };
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
    let xAccount = await ctx.runQuery(
      internal.xStore.getXAccountForUserInternal,
      { userId: args.userId }
    );

    if (!xAccount || xAccount.status !== "connected") {
      return;
    }

    const repaired = await repairTwitterSourceVersionIfNeeded(ctx, {
      userId: args.userId,
      xAccount,
    });
    xAccount = repaired.xAccount;
    if (!xAccount || xAccount.status !== "connected") {
      return;
    }
    const activeSourceVersion = repaired.activeSourceVersion;
    let sampleCount = repaired.sampleCount;

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
      } else {
        sampleCount = await getTwitterStyleSampleCount(ctx, {
          userId: args.userId,
          sourceVersion: activeSourceVersion,
        });
        const reusedExistingSamples =
          await replayTwitterStyleFromExistingSamples(ctx, {
            userId: args.userId,
            xAccount,
            sampleCount,
          });
        if (reusedExistingSamples) {
          return;
        }
        await scheduleTwitterBackfill(ctx, { userId: args.userId, xAccount });
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
      await updateTwitterStyleStatus(ctx, {
        userId: args.userId,
        xAccount,
        status: "failed",
        lastError:
          error instanceof Error ? error.message : "Failed to create monitor",
      });
      return;
    }

    if (result.duplicate) {
      const restoredMonitor = await ctx.runMutation(
        internal.styleMonitors.restoreMonitorForSource,
        {
          userId: args.userId,
          platform: "twitter",
          sourceVersion: activeSourceVersion,
          xAccountId: xAccount._id,
        }
      );
      if (!restoredMonitor) {
        await updateTwitterStyleStatus(ctx, {
          userId: args.userId,
          xAccount,
          status: "failed",
          lastError:
            result.error ??
            "A duplicate X style monitor exists, but the local state could not be restored.",
        });
        return;
      }
      sampleCount = await getTwitterStyleSampleCount(ctx, {
        userId: args.userId,
        sourceVersion: activeSourceVersion,
      });
      const reusedExistingSamples = await replayTwitterStyleFromExistingSamples(
        ctx,
        {
          userId: args.userId,
          xAccount,
          sampleCount,
        }
      );
      if (reusedExistingSamples) {
        return;
      }
      await scheduleTwitterBackfill(ctx, { userId: args.userId, xAccount });
      return;
    }

    if (!result.success || !result.monitorId) {
      styleMonitorLogger.error("Monitor creation failed", {
        userId: String(args.userId),
        username: xAccount.username,
        errorMessage: result.error ?? "Unknown error",
      });
      await updateTwitterStyleStatus(ctx, {
        userId: args.userId,
        xAccount,
        status: "failed",
        lastError: result.error ?? "Monitor creation failed",
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

    // 5. Reuse historical samples when possible; only backfill if we still need them.
    sampleCount = await getTwitterStyleSampleCount(ctx, {
      userId: args.userId,
      sourceVersion: activeSourceVersion,
    });
    const reusedExistingSamples = await replayTwitterStyleFromExistingSamples(
      ctx,
      {
        userId: args.userId,
        xAccount,
        sampleCount,
      }
    );
    if (reusedExistingSamples) {
      return;
    }

    await scheduleTwitterBackfill(ctx, { userId: args.userId, xAccount });
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
