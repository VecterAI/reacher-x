// convex/socialapiMonitors.ts
// SocialAPI Search Query Monitor management for Twitter 24/7 prospecting with automatic retry

import {
  query,
  action,
  internalAction,
  internalQuery,
  internalMutation,
} from "./lib/functionBuilders";
import { areAutonomousJobsPaused } from "./lib/autonomousJobHelpers";
import { isWorkspaceAutomationActive } from "./lib/workspaceSystem";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getUserFromIdentity } from "./lib/userUtils";
import { formatWorkspaceLogContext } from "./lib/logHelpers";
import {
  getRetriedActionStatus,
  runProviderActionRetried,
} from "./lib/retrier";
import { fetchSocialApi } from "./lib/socialApiFetch";
import {
  monitorStatusValidator,
  socialQueryMonitorPurposeValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { logger } from "../shared/lib/logger";
import { normalizeMemoryText } from "./lib/memoryHelpers";
import { buildChangedPatch } from "./lib/patchHelpers";
import { formatQualifiedProspectLimitReachedMessage } from "./lib/prospectingHelpers";

// ============================================================================
// Constants
// ============================================================================

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
const DEFAULT_REFRESH_FREQUENCY = 3600; // 1 hour in seconds (SocialAPI max)
const DISCOVERY_MONITOR_RETIREMENT_BATCH_SIZE = 25;
const DISCOVERY_MONITOR_RETIREMENT_DELAY_MS = 60_000;
// SocialAPI lists monitors 50 per page. The orphan sweep reads up to this many
// pages per run; drift marking only happens when the listing was complete.
const REMOTE_MONITOR_LIST_MAX_PAGES = 10;
// Per-workspace scan window for live monitor rows. Far above any realistic
// live count per workspace (seeds are promoted a few per cycle), and rows
// beyond it resurface in later runs once earlier rows drain.
const DISCOVERY_MONITOR_SCAN_PAGE = 500;
// Rows whose remote deletion failed sit out this long before the drain
// retries them, so a permanently failing row cannot block its siblings.
const MONITOR_DELETE_RETRY_BACKOFF_MS = 60 * 60 * 1000;
// Rows younger than this are skipped by drift marking: a monitor row created
// moments ago may not appear in a remote listing fetched just before it.
const MONITOR_DRIFT_GRACE_MS = 10 * 60 * 1000;
const socialApiMonitorsLogger = logger.withScope("SocialApiMonitors");

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
      query: string;
    };
    refresh_frequency: string;
  };
}

interface SocialAPIDeleteMonitorResponse {
  status: "success" | "error";
  message?: string;
}

/** Result from internal API call actions */
interface CreateMonitorApiResult {
  success: boolean;
  monitorId?: string;
  error?: string;
}

interface DeleteMonitorApiResult {
  success: boolean;
  error?: string;
}

async function getWorkspaceCapacityGate(
  ctx: any,
  workspaceId: any
): Promise<{
  blocked: boolean;
  reason?: string;
  workspace: any | null;
}> {
  const workspace = await ctx.runQuery(
    internal.workspaces.getWorkspaceInternal,
    {
      workspaceId,
    }
  );

  if (!workspace) {
    return {
      blocked: true,
      reason: "Workspace not found",
      workspace: null,
    };
  }

  const limitState = await ctx.runQuery(
    internal.workflows.prospecting.checkProspectLimitInternal,
    { workspaceId }
  );
  const blocked =
    workspace.prospectingWorkflowStatus === "limit_reached" ||
    limitState.limitReached;

  return {
    blocked,
    reason: blocked
      ? formatQualifiedProspectLimitReachedMessage({
          currentCount: limitState.currentCount,
          limit: limitState.limit,
        })
      : undefined,
    workspace,
  };
}

// ============================================================================
// Internal Queries (used by HTTP handler)
// ============================================================================

/**
 * Get monitor by SocialAPI monitor ID (internal, for webhook handler)
 */
export const getMonitorByExternalId = internalQuery({
  args: { monitorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Save monitor record after successful SocialAPI creation
 */
export const saveMonitor = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    monitorId: v.string(),
    query: v.string(),
    refreshFrequency: v.number(),
    purpose: socialQueryMonitorPurposeValidator,
    conversationSeedId: v.optional(v.id("twitterConversationSeeds")),
  },
  handler: async (ctx, args) => {
    // Check if monitor already exists
    const existing = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (existing) {
      const keyword = await ctx.db
        .query("keywords")
        .withIndex("by_workspace_type_and_value", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("type", "social_query")
            .eq("value", normalizeMemoryText(args.query))
        )
        .first();
      const patch = buildChangedPatch(
        existing as unknown as Record<string, unknown>,
        {
          keywordId: keyword?._id,
          queryCandidateId: keyword?.activatedQueryCandidateId,
          healthStatus: existing.healthStatus ?? "healthy",
          purpose: args.purpose,
          conversationSeedId:
            args.conversationSeedId ?? existing.conversationSeedId,
        }
      );
      if (patch) {
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    const keyword = await ctx.db
      .query("keywords")
      .withIndex("by_workspace_type_and_value", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("type", "social_query")
          .eq("value", normalizeMemoryText(args.query))
      )
      .first();

    return await ctx.db.insert("socialQueryMonitors", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      keywordId: keyword?._id,
      queryCandidateId: keyword?.activatedQueryCandidateId,
      purpose: args.purpose,
      conversationSeedId: args.conversationSeedId,
      monitorId: args.monitorId,
      query: args.query,
      refreshFrequency: args.refreshFrequency,
      status: "active",
      healthStatus: "healthy",
      failureCount: 0,
      totalProspectsFound: 0,
    });
  },
});

/**
 * Update monitor status
 */
export const updateMonitorStatus = internalMutation({
  args: {
    monitorId: v.string(),
    status: monitorStatusValidator,
  },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (!monitor) {
      throw new Error(`Monitor not found: ${args.monitorId}`);
    }

    await ctx.db.patch(monitor._id, { status: args.status });
    return { success: true };
  },
});

export const pauseWorkspaceMonitorsInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const monitors = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    let pausedCount = 0;
    for (const monitor of monitors) {
      if (monitor.status !== "active") {
        continue;
      }
      await ctx.db.patch(monitor._id, { status: "paused" });
      pausedCount += 1;
    }

    return { pausedCount };
  },
});

export const resumeWorkspaceMonitorsInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const monitors = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    let resumedCount = 0;
    for (const monitor of monitors) {
      if (monitor.status !== "paused") {
        continue;
      }
      await ctx.db.patch(monitor._id, { status: "active" });
      resumedCount += 1;
    }

    return { resumedCount };
  },
});

export const recordSearchMonitorWebhook = internalMutation({
  args: {
    monitorId: v.string(),
    prospectsFoundDelta: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (!monitor) {
      throw new Error(`Monitor not found: ${args.monitorId}`);
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(monitor._id, {
      lastWebhookAt: now,
      lastSuccessAt: now,
      healthStatus: "healthy",
      totalProspectsFound:
        (monitor.totalProspectsFound ?? 0) + (args.prospectsFoundDelta ?? 0),
    });

    return { success: true };
  },
});

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all monitors for a workspace
 */
export const getWorkspaceMonitors = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("deleted"))
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return [];

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) return [];

    if (args.status) {
      return await ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .collect();
    }

    return await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

/**
 * Get monitor stats for a workspace
 */
export const getMonitorStats = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) return null;

    const monitors = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const stats = {
      total: monitors.length,
      active: 0,
      paused: 0,
      deleted: 0,
      healthy: 0,
      degraded: 0,
      failing: 0,
      totalProspectsFound: 0,
    };

    for (const m of monitors) {
      stats[m.status]++;
      if (m.healthStatus) {
        stats[m.healthStatus]++;
      }
      stats.totalProspectsFound += m.totalProspectsFound ?? 0;
    }

    return stats;
  },
});

// ============================================================================
// Internal Actions (for retrier)
// ============================================================================

/**
 * Internal action that performs the actual HTTP call to create a SocialAPI monitor.
 * Throws on failure so the retrier can catch and retry.
 */
export const createMonitorApiCall = internalAction({
  args: {
    query: v.string(),
    refreshFrequency: v.number(),
    webhookUrl: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    workspaceName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CreateMonitorApiResult> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      // Don't retry configuration errors
      return { success: false, error: "SocialAPI not configured" };
    }

    const requestContext = {
      consumer: "socialapiMonitors.createMonitor",
      endpoint: "/monitors/search-query",
      workspaceId: args.workspaceId,
    };
    const response = await fetchSocialApi(
      ctx,
      requestContext.consumer,
      `${SOCIALAPI_BASE_URL}/monitors/search-query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: args.query,
          refresh_frequency: args.refreshFrequency,
          webhook_url: args.webhookUrl,
        }),
      },
      {
        workspaceId: args.workspaceId,
        estimateUsage: () => ({ billableUnits: 0, estimatedCostUsd: 0 }),
      }
    );

    const data = (await response.json()) as SocialAPICreateMonitorResponse;

    if (!response.ok || data.status !== "success" || !data.data) {
      // Throw to trigger retry for transient failures
      const workspaceContext = formatWorkspaceLogContext({
        workspaceId: args.workspaceId ? String(args.workspaceId) : undefined,
        workspaceName: args.workspaceName,
      });
      throw new Error(
        `[SocialAPI] ${workspaceContext} ${data.message ?? `HTTP ${response.status}`}`
      );
    }

    return { success: true, monitorId: data.data.id };
  },
});

/**
 * Internal action that performs the actual HTTP call to delete a SocialAPI monitor.
 * Throws on failure so the retrier can catch and retry.
 */
export const deleteMonitorApiCall = internalAction({
  args: {
    monitorId: v.string(),
  },
  handler: async (ctx, args): Promise<DeleteMonitorApiResult> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      // Don't retry configuration errors
      return { success: false, error: "SocialAPI not configured" };
    }

    const requestContext = {
      consumer: "socialapiMonitors.deleteMonitor",
      endpoint: "/monitors/:id",
    };
    const response = await fetchSocialApi(
      ctx,
      requestContext.consumer,
      `${SOCIALAPI_BASE_URL}/monitors/${args.monitorId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
      {
        estimateUsage: () => ({ billableUnits: 0, estimatedCostUsd: 0 }),
      }
    );

    // 404 is acceptable (already deleted)
    if (!response.ok && response.status !== 404) {
      const data = (await response.json()) as SocialAPIDeleteMonitorResponse;
      throw new Error(data.message ?? `HTTP ${response.status}`);
    }

    return { success: true };
  },
});

// ============================================================================
// Actions (HTTP calls to SocialAPI)
// ============================================================================

/**
 * Delete a SocialAPI monitor with automatic retry
 */
export const deleteMonitor = action({
  args: { monitorId: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Get user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      // Use retrier to run the API call with automatic retry
      const runId = await runProviderActionRetried(
        ctx,
        internal.socialapiMonitors.deleteMonitorApiCall,
        { monitorId: args.monitorId }
      );

      // Poll for completion
      while (true) {
        const status = await getRetriedActionStatus(ctx, runId);
        if (status.type === "inProgress") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (status.type === "completed") {
          if (status.result.type === "success") {
            await ctx.runMutation(
              internal.socialapiMonitors.updateMonitorStatus,
              {
                monitorId: args.monitorId,
                status: "deleted",
              }
            );
            return { success: true };
          } else if (status.result.type === "failed") {
            socialApiMonitorsLogger.warn(
              "Delete failed after retries",
              { monitorId: args.monitorId },
              new Error(status.result.error)
            );
            return {
              success: false,
              error: `Failed after retries: ${status.result.error}`,
            };
          } else {
            return { success: false, error: "Request was canceled" };
          }
        }
        break;
      }

      return { success: false, error: "Monitor deletion did not complete" };
    } catch (error) {
      socialApiMonitorsLogger.error(
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
 * Internal version of createMonitor (for batch operations) with automatic retry
 */
export const createMonitorInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    refreshFrequency: v.optional(v.number()),
    purpose: socialQueryMonitorPurposeValidator,
    conversationSeedId: v.optional(v.id("twitterConversationSeeds")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; monitorId?: string; error?: string }> => {
    if (args.purpose !== "conversation_seed" || !args.conversationSeedId) {
      return {
        success: false,
        error:
          "Always-on workspace query monitors are disabled; use bounded pull search.",
      };
    }

    const capacityGate = await getWorkspaceCapacityGate(ctx, args.workspaceId);
    if (capacityGate.blocked || !capacityGate.workspace) {
      return {
        success: false,
        error: capacityGate.reason ?? "Workspace not found",
      };
    }
    const workspace = capacityGate.workspace;

    const webhookUrl = `${process.env.CONVEX_SITE_URL}/socialapi-webhook`;
    const refreshFrequency = args.refreshFrequency ?? DEFAULT_REFRESH_FREQUENCY;
    const workspaceContext = formatWorkspaceLogContext({
      workspaceId: String(args.workspaceId),
      workspaceName: workspace.name,
    });

    try {
      // Use retrier to run the API call with automatic retry
      const runId = await runProviderActionRetried(
        ctx,
        internal.socialapiMonitors.createMonitorApiCall,
        {
          query: args.query,
          refreshFrequency,
          webhookUrl,
          workspaceId: args.workspaceId,
          workspaceName: workspace.name,
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
            return {
              success: false,
              error: `[SocialAPI] ${workspaceContext} Failed after retries: ${status.result.error}`,
            };
          } else {
            return { success: false, error: "Request was canceled" };
          }
        }
        break;
      }

      if (!result || !result.success || !result.monitorId) {
        return { success: false, error: result?.error ?? "Unknown error" };
      }

      // A retrier retry or racing caller may have already registered this
      // seed's monitor (slow create that actually succeeded on the retry).
      // Keep the tracked row, delete the freshly created duplicate remotely,
      // and re-point the seed at the tracked monitor. A failed duplicate
      // deletion leaves an orphan the cost reconciliation cron sweeps later.
      if (args.purpose === "conversation_seed") {
        const duplicate = await ctx.runQuery(
          internal.socialapiMonitors.findDuplicateSeedMonitorInternal,
          {
            workspaceId: args.workspaceId,
            query: args.query,
            excludeMonitorId: result.monitorId,
          }
        );
        if (duplicate && duplicate.conversationSeedId) {
          try {
            await ctx.runAction(
              internal.socialapiMonitors.deleteMonitorApiCall,
              { monitorId: result.monitorId }
            );
          } catch (error) {
            socialApiMonitorsLogger.warn(
              "Failed to delete duplicate monitor; the cost reconciliation cron will sweep it",
              {
                monitorId: result.monitorId,
                trackedMonitorId: duplicate.monitorId,
              },
              error
            );
          }
          if (args.conversationSeedId) {
            await ctx.runMutation(
              internal.xConversationDiscovery
                .recordConversationSeedProgressInternal,
              {
                seedId: args.conversationSeedId,
                status: "active",
                monitorId: duplicate.monitorId,
              }
            );
          }
          return { success: true, monitorId: duplicate.monitorId };
        }
      }

      await ctx.runMutation(internal.socialapiMonitors.saveMonitor, {
        workspaceId: args.workspaceId,
        userId: workspace.userId,
        monitorId: result.monitorId,
        query: args.query,
        refreshFrequency,
        purpose: args.purpose,
        conversationSeedId: args.conversationSeedId,
      });

      return { success: true, monitorId: result.monitorId };
    } catch (error) {
      socialApiMonitorsLogger.error(
        "Error creating monitor (internal)",
        {
          workspaceId: String(args.workspaceId),
          query: args.query,
          purpose: args.purpose,
        },
        error
      );
      try {
        await ctx.runMutation(
          internal.workspaces.setOnboardingIssueStateInternal,
          {
            workspaceId: args.workspaceId,
            statusCode: "monitor_creation_failed",
            source: "monitor",
          }
        );
      } catch {
        // Best effort; avoid masking the original monitor error.
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Finds an existing active seed monitor for the same workspace and query.
 * Retrier retries (a slow create that actually succeeded) and racing callers
 * can register the same seed monitor twice; SocialAPI bills each copy.
 */
export const findDuplicateSeedMonitorInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    excludeMonitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_workspace_purpose_status", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("purpose", "conversation_seed")
          .eq("status", "active")
      )
      .take(200);
    return (
      rows.find(
        (row) =>
          row.query === args.query && row.monitorId !== args.excludeMonitorId
      ) ?? null
    );
  },
});

export const listWorkspaceMonitorsInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

/**
 * Returns only paid discovery monitors. Conversation-seed monitors are kept
 * because they support bounded, real-time reply discovery.
 */
export const listDiscoveryMonitorsForRetirementInternal = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(
      1,
      Math.min(
        args.limit ?? DISCOVERY_MONITOR_RETIREMENT_BATCH_SIZE,
        DISCOVERY_MONITOR_RETIREMENT_BATCH_SIZE
      )
    );
    const [activeDiscovery, pausedDiscovery, activeLegacy, pausedLegacy] =
      await Promise.all([
        ctx.db
          .query("socialQueryMonitors")
          .withIndex("by_purpose_status", (q) =>
            q.eq("purpose", "workspace_query").eq("status", "active")
          )
          .take(limit),
        ctx.db
          .query("socialQueryMonitors")
          .withIndex("by_purpose_status", (q) =>
            q.eq("purpose", "workspace_query").eq("status", "paused")
          )
          .take(limit),
        ctx.db
          .query("socialQueryMonitors")
          .withIndex("by_purpose_status", (q) =>
            q.eq("purpose", undefined).eq("status", "active")
          )
          .take(limit),
        ctx.db
          .query("socialQueryMonitors")
          .withIndex("by_purpose_status", (q) =>
            q.eq("purpose", undefined).eq("status", "paused")
          )
          .take(limit),
      ]);

    const byMonitorId = new Map(
      [...activeDiscovery, ...pausedDiscovery, ...activeLegacy, ...pausedLegacy]
        .filter((monitor) => !monitor.conversationSeedId)
        .map((monitor) => [monitor.monitorId, monitor])
    );

    return [...byMonitorId.values()]
      .sort((left, right) => left._creationTime - right._creationTime)
      .slice(0, limit);
  },
});

export const markDiscoveryMonitorsRetiredInternal = internalMutation({
  args: {
    monitorIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let retired = 0;

    for (const monitorId of args.monitorIds) {
      const monitor = await ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_monitor_id", (q) => q.eq("monitorId", monitorId))
        .first();
      if (
        !monitor ||
        monitor.status === "deleted" ||
        monitor.purpose === "conversation_seed" ||
        monitor.conversationSeedId
      ) {
        continue;
      }

      await ctx.db.patch(monitor._id, {
        status: "deleted",
        healthStatus: "healthy",
        lastErrorMessage: undefined,
      });
      if (monitor.keywordId) {
        const keyword = await ctx.db.get(monitor.keywordId);
        if (keyword?.monitorId === monitorId) {
          await ctx.db.patch(keyword._id, { monitorId: undefined });
        }
      }
      retired += 1;
    }

    return { retired };
  },
});

export const recordDiscoveryMonitorRetirementFailureInternal = internalMutation(
  {
    args: {
      monitorId: v.string(),
      error: v.string(),
    },
    handler: async (ctx, args) => {
      const monitor = await ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
        .first();
      if (!monitor || monitor.status === "deleted") {
        return { updated: false };
      }

      await ctx.db.patch(monitor._id, {
        healthStatus: "failing",
        failureCount: (monitor.failureCount ?? 0) + 1,
        lastErrorAt: getCurrentUTCTimestamp(),
        lastErrorMessage: args.error.slice(0, 500),
      });
      return { updated: true };
    },
  }
);

/**
 * Removes a tracked row entirely and detaches its seed/keyword pointers.
 * Used when remote deletion failed with a permanent provider error: the row
 * must stop blocking progress, and once it is gone the cost reconciliation
 * cron classifies the still-billing remote monitor as an orphan and deletes
 * it when the provider works again.
 */
export const deleteMonitorRowAndDetachInternal = internalMutation({
  args: { monitorId: v.string() },
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();
    if (!monitor) {
      return { removed: false };
    }

    await ctx.db.delete(monitor._id);

    if (monitor.conversationSeedId) {
      const seed = await ctx.db.get(monitor.conversationSeedId);
      if (seed && seed.monitorId === args.monitorId) {
        await ctx.db.patch(seed._id, { monitorId: undefined });
      }
    }
    if (monitor.keywordId) {
      const keyword = await ctx.db.get(monitor.keywordId);
      if (keyword && keyword.monitorId === args.monitorId) {
        await ctx.db.patch(keyword._id, { monitorId: undefined });
      }
    }
    return { removed: true };
  },
});

// ============================================================================
// Monitor cost reconciliation
// ============================================================================

/**
 * Workspace scan for the cost reconciliation cron. Workspaces are the scan
 * unit for every reconciliation phase: per-workspace queries are fully
 * indexed and complete within their take bound, so no phase can be starved
 * by rows it filters out. The cap bounds the hourly read; deployments with
 * more live workspaces than the cap should raise it.
 */
export const listWorkspaceAutomationStatesInternal = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 500, 500));
    const workspaces = await ctx.db.query("workspaces").take(limit);
    return workspaces.map((workspace) => ({
      workspaceId: workspace._id,
      automationActive: isWorkspaceAutomationActive(workspace),
    }));
  },
});

/**
 * Live seed monitors of one workspace (conversation-seed purpose or any row
 * carrying a seed pointer). Walks the workspace's live rows, so
 * workspace_query rows or rows that keep failing deletion cannot starve seed
 * monitors behind them. Returns [] when the workspace became active again
 * mid-run: the drain must never delete monitors a fresh resume just
 * re-created.
 */
export const listWorkspaceMonitorDrainCandidatesInternal = internalQuery({
  args: { workspaceId: v.id("workspaces"), limit: v.number() },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (workspace && isWorkspaceAutomationActive(workspace)) {
      return { rows: [], isDone: true };
    }
    const now = getCurrentUTCTimestamp();
    const limit = Math.max(
      1,
      Math.min(Math.floor(args.limit), DISCOVERY_MONITOR_RETIREMENT_BATCH_SIZE)
    );
    const [active, paused] = await Promise.all([
      ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", "active")
        )
        .take(DISCOVERY_MONITOR_SCAN_PAGE),
      ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", "paused")
        )
        .take(DISCOVERY_MONITOR_SCAN_PAGE),
    ]);
    const rows = [...active, ...paused]
      .filter(
        (monitor) =>
          (monitor.purpose === "conversation_seed" ||
            monitor.conversationSeedId !== undefined) &&
          // Rows whose deletion failed recently sit out one cron interval so
          // they cannot occupy the front of every scan and starve the rows
          // behind them.
          !(
            typeof monitor.lastErrorAt === "number" &&
            monitor.lastErrorAt > now - MONITOR_DELETE_RETRY_BACKOFF_MS
          )
      )
      .sort((left, right) => left._creationTime - right._creationTime);
    return {
      rows: rows.slice(0, limit),
      isDone: rows.length <= limit,
    };
  },
});

/**
 * Live rows of one workspace that were absent from a complete remote
 * listing. Remote state is the billing truth, so these rows are marked
 * deleted (and their seed pointers cleared) by the drain action. Rows
 * younger than the grace window are skipped: their remote monitor may have
 * been created after the listing was fetched.
 */
export const listWorkspaceDriftCandidatesInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    remoteMonitorIds: v.array(v.string()),
    graceCutoff: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(
      1,
      Math.min(Math.floor(args.limit), DISCOVERY_MONITOR_RETIREMENT_BATCH_SIZE)
    );
    const remoteIds = new Set(args.remoteMonitorIds);
    const [active, paused] = await Promise.all([
      ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", "active")
        )
        .take(DISCOVERY_MONITOR_SCAN_PAGE),
      ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", "paused")
        )
        .take(DISCOVERY_MONITOR_SCAN_PAGE),
    ]);
    const rows = [...active, ...paused]
      .filter(
        (monitor) =>
          !remoteIds.has(monitor.monitorId) &&
          monitor._creationTime <= args.graceCutoff
      )
      .sort((left, right) => left._creationTime - right._creationTime);
    return {
      rows: rows.slice(0, limit).map((monitor) => ({
        monitorId: monitor.monitorId,
        conversationSeedId: monitor.conversationSeedId,
      })),
      isDone: rows.length <= limit,
    };
  },
});

/**
 * Remote monitor IDs that match no live tracked row, found with one indexed
 * point lookup per remote ID. Both monitor kinds (discovery seed monitors
 * and outreach response monitors) live on the same SocialAPI key, so an ID
 * tracked live in either table is not an orphan. A remote monitor whose row
 * is already marked deleted should not exist: older paths marked rows
 * deleted without a confirmed remote deletion, so those IDs are returned
 * and re-deleted (404 counts as success) instead of billing forever.
 */
export const listUnknownRemoteMonitorIdsInternal = internalQuery({
  args: { remoteMonitorIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const unknown: string[] = [];
    for (const monitorId of args.remoteMonitorIds) {
      const row = await ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_monitor_id", (q) => q.eq("monitorId", monitorId))
        .first();
      if (row && row.status !== "deleted") {
        continue;
      }
      const prospectRow = await ctx.db
        .query("prospectMonitors")
        .withIndex("by_monitor_id", (q) => q.eq("monitorId", monitorId))
        .first();
      if (!prospectRow || prospectRow.status === "deleted") {
        unknown.push(monitorId);
      }
    }
    return unknown;
  },
});

/**
 * Marks tracked rows deleted and detaches conversation seeds so the resume
 * path can re-create fresh monitors. Only rows still claiming to be live are
 * touched; seeds keep their pointer unless it matches the deleted monitor.
 */
export const markMonitorsDeletedWithSeedCleanupInternal = internalMutation({
  args: { monitorIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    let marked = 0;
    for (const monitorId of args.monitorIds) {
      const monitor = await ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_monitor_id", (q) => q.eq("monitorId", monitorId))
        .first();
      if (!monitor || monitor.status === "deleted") {
        continue;
      }

      await ctx.db.patch(monitor._id, {
        status: "deleted",
        healthStatus: "healthy",
        lastErrorMessage: undefined,
      });
      marked += 1;

      if (monitor.conversationSeedId) {
        const seed = await ctx.db.get(monitor.conversationSeedId);
        if (seed && seed.monitorId === monitorId) {
          await ctx.db.patch(seed._id, { monitorId: undefined });
        }
      }
      if (monitor.keywordId) {
        const keyword = await ctx.db.get(monitor.keywordId);
        if (keyword?.monitorId === monitorId) {
          await ctx.db.patch(keyword._id, { monitorId: undefined });
        }
      }
    }
    return { marked };
  },
});

/**
 * Lists remote monitors owned by the SocialAPI key, page by page. Only
 * monitors pointing at this deployment's webhook are returned: if a second
 * deployment ever shares the same key, its monitors must not be deleted as
 * orphans by this deployment's cron. `complete` reports whether every page
 * was read (the meta last_page was present and within the per-run cap);
 * drift marking depends on a complete listing so it never marks rows whose
 * monitor was merely unlisted this run. Creation timestamps let the orphan
 * sweep skip monitors that may still be mid-save.
 */
export const listRemoteMonitorsApiCall = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    monitors: Array<{ id: string; createdAtMs?: number }>;
    complete: boolean;
  }> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      return { monitors: [], complete: false };
    }
    const ownWebhookUrl = `${process.env.CONVEX_SITE_URL}/socialapi-webhook`;

    const monitors: Array<{ id: string; createdAtMs?: number }> = [];
    let complete = false;
    for (let page = 1; page <= REMOTE_MONITOR_LIST_MAX_PAGES; page += 1) {
      const response = await fetchSocialApi(
        ctx,
        "socialapiMonitors.listRemoteMonitors",
        `${SOCIALAPI_BASE_URL}/monitors?page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        },
        { estimateUsage: () => ({ billableUnits: 0, estimatedCostUsd: 0 }) }
      );
      if (!response.ok) {
        throw new Error(
          `SocialAPI monitor listing failed with status ${response.status}`
        );
      }
      const payload = (await response.json()) as {
        data?: Array<{
          id?: string;
          created_at?: string;
          webhook_url?: string | null;
        }>;
        meta?: { last_page?: number };
      };
      for (const monitor of payload.data ?? []) {
        if (!monitor.id || monitor.webhook_url !== ownWebhookUrl) {
          continue;
        }
        const createdAtMs =
          typeof monitor.created_at === "string"
            ? Date.parse(monitor.created_at)
            : undefined;
        monitors.push({
          id: monitor.id,
          createdAtMs: Number.isNaN(createdAtMs) ? undefined : createdAtMs,
        });
      }
      const lastPage = payload.meta?.last_page;
      if (typeof lastPage !== "number" || Number.isNaN(lastPage)) {
        // Without pagination metadata the listing is unverifiable; skip
        // phases that depend on completeness this run.
        return { monitors, complete: false };
      }
      if (page >= lastPage) {
        complete = true;
        break;
      }
    }
    return { monitors, complete };
  },
});

/**
 * Hourly cost reconciliation for SocialAPI monitors. Monitors bill on
 * SocialAPI's side for as long as they exist, so anything unreachable
 * through our database is pure spend:
 *
 * - Dormant workspaces: seed monitors of paused, stopped, plan-limited, or
 *   deleting workspaces are deleted remotely and marked deleted locally;
 *   resuming the workspace recreates them.
 * - Orphans: remote monitors with no live tracked row (leaked by older
 *   deletion paths) are deleted remotely. Only monitors pointing at this
 *   deployment's webhook are considered, so a shared key can never make one
 *   deployment delete another deployment's monitors.
 * - Drift: live rows of running workspaces missing remotely are marked
 *   deleted so resume does not rely on ghosts.
 *
 * Every phase is bounded and the run self-continues when a phase reached its
 * cap, mirroring the retirement drain below.
 */
export const reconcileMonitorCostsCron = internalAction({
  args: {},
  handler: async (ctx): Promise<{ continuationScheduled: boolean }> => {
    if (areAutonomousJobsPaused()) {
      console.warn(
        "[SocialApiMonitors] Autonomous jobs paused, skipping cost reconciliation"
      );
      return { continuationScheduled: false };
    }

    const now = getCurrentUTCTimestamp();
    const budget = DISCOVERY_MONITOR_RETIREMENT_BATCH_SIZE;
    let continuationScheduled = false;
    let dormantDrained = 0;
    let dormantAttempts = 0;
    let orphansDeleted = 0;
    let orphanAttempts = 0;
    let driftMarked = 0;
    let remoteListed = 0;

    const workspaces = await ctx.runQuery(
      internal.socialapiMonitors.listWorkspaceAutomationStatesInternal,
      {}
    );

    // Phase A: delete remote seed monitors of dormant workspaces and mark
    // their rows deleted. A failed deletion leaves the row live so the next
    // run retries (with a one-interval backoff); the row is never marked
    // deleted without a confirmed remote deletion. Attempts, not successes,
    // count against the budget so a provider outage cannot stretch the run.
    for (const workspace of workspaces) {
      if (dormantAttempts >= budget) {
        continuationScheduled = true;
        break;
      }
      if (workspace.automationActive) {
        continue;
      }
      const scan = await ctx.runQuery(
        internal.socialapiMonitors.listWorkspaceMonitorDrainCandidatesInternal,
        { workspaceId: workspace.workspaceId, limit: budget - dormantAttempts }
      );
      for (const monitor of scan.rows) {
        dormantAttempts += 1;
        try {
          const result = await ctx.runAction(
            internal.socialapiMonitors.deleteMonitorApiCall,
            { monitorId: monitor.monitorId }
          );
          if (!result.success) {
            throw new Error(result.error ?? "Unknown deletion failure");
          }
        } catch (error) {
          socialApiMonitorsLogger.warn(
            "Dormant monitor remote deletion failed; backing off one interval",
            { monitorId: monitor.monitorId },
            error
          );
          await ctx.runMutation(
            internal.socialapiMonitors
              .recordDiscoveryMonitorRetirementFailureInternal,
            {
              monitorId: monitor.monitorId,
              error: error instanceof Error ? error.message : String(error),
            }
          );
          continue;
        }
        await ctx.runMutation(
          internal.socialapiMonitors.markMonitorsDeletedWithSeedCleanupInternal,
          { monitorIds: [monitor.monitorId] }
        );
        dormantDrained += 1;
      }
      if (!scan.isDone) {
        continuationScheduled = true;
      }
    }

    // Phase B: delete remote monitors that match no live tracked row.
    // Monitors created moments ago are skipped: their local row may still be
    // mid-save. Attempts count against the remaining budget. A listing
    // failure skips phases B and C for this run while preserving any
    // continuation phase A already requested.
    let remote: {
      monitors: Array<{ id: string; createdAtMs?: number }>;
      complete: boolean;
    };
    try {
      remote = await ctx.runAction(
        internal.socialapiMonitors.listRemoteMonitorsApiCall,
        {}
      );
    } catch (error) {
      socialApiMonitorsLogger.warn(
        "Remote monitor listing failed; skipping orphan and drift phases",
        {},
        error
      );
      remote = { monitors: [], complete: false };
    }
    remoteListed = remote.monitors.length;
    const remoteIds = remote.monitors.map((monitor) => monitor.id);
    const unknown = await ctx.runQuery(
      internal.socialapiMonitors.listUnknownRemoteMonitorIdsInternal,
      { remoteMonitorIds: remoteIds }
    );
    const orphanBudget = Math.max(0, budget - dormantAttempts);
    let orphansSkippedFresh = 0;
    for (const monitorId of unknown) {
      if (orphanAttempts >= orphanBudget) {
        // Only continue when this run made progress; otherwise the hourly
        // cron retries the remaining orphans.
        if (orphansDeleted > 0) {
          continuationScheduled = true;
        }
        break;
      }
      orphanAttempts += 1;
      const createdAtMs = remote.monitors.find(
        (monitor) => monitor.id === monitorId
      )?.createdAtMs;
      if (
        typeof createdAtMs !== "number" ||
        createdAtMs > now - MONITOR_DRIFT_GRACE_MS
      ) {
        // Missing or fresh creation timestamp: the monitor may still be
        // mid-save (remote created, local row pending). Skip it this run.
        orphansSkippedFresh += 1;
        continue;
      }
      try {
        const result = await ctx.runAction(
          internal.socialapiMonitors.deleteMonitorApiCall,
          { monitorId }
        );
        if (!result.success) {
          throw new Error(result.error ?? "Unknown deletion failure");
        }
        orphansDeleted += 1;
      } catch (error) {
        socialApiMonitorsLogger.warn(
          "Orphan monitor deletion failed; retrying next run",
          { monitorId },
          error
        );
      }
    }

    // Phase C: mark live rows of running workspaces whose remote monitor is
    // gone. Only runs against a complete listing, and dormant workspaces are
    // excluded because phase A owns their deletion.
    if (remote.complete) {
      for (const workspace of workspaces) {
        if (driftMarked >= budget) {
          continuationScheduled = true;
          break;
        }
        if (!workspace.automationActive) {
          continue;
        }
        const scan = await ctx.runQuery(
          internal.socialapiMonitors.listWorkspaceDriftCandidatesInternal,
          {
            workspaceId: workspace.workspaceId,
            remoteMonitorIds: remoteIds,
            graceCutoff: now - MONITOR_DRIFT_GRACE_MS,
            limit: budget - driftMarked,
          }
        );
        if (scan.rows.length === 0) {
          continue;
        }
        const result = await ctx.runMutation(
          internal.socialapiMonitors.markMonitorsDeletedWithSeedCleanupInternal,
          { monitorIds: scan.rows.map((candidate) => candidate.monitorId) }
        );
        driftMarked += result.marked;
        if (!scan.isDone) {
          continuationScheduled = true;
        }
      }
    }

    if (continuationScheduled) {
      await ctx.scheduler.runAfter(
        DISCOVERY_MONITOR_RETIREMENT_DELAY_MS,
        internal.socialapiMonitors.reconcileMonitorCostsCron,
        {}
      );
    }

    socialApiMonitorsLogger.info("Monitor cost reconciliation run", {
      dormantDrained,
      remoteListed,
      orphansDeleted,
      orphansSkippedFresh,
      driftMarked,
      continuationScheduled,
    });

    return { continuationScheduled };
  },
});

/**
 * Post-deploy safety valve: drains obsolete discovery monitors from SocialAPI
 * in bounded batches. A local row is marked deleted only after SocialAPI
 * confirms deletion (404 already-deleted is also treated as success).
 */
export const retireDiscoveryMonitorsCron = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    attempted: number;
    retired: number;
    failed: number;
    continuationScheduled: boolean;
  }> => {
    if (areAutonomousJobsPaused()) {
      console.warn(
        "[SocialApiMonitors] Autonomous jobs paused, skipping monitor retirement"
      );
      return {
        attempted: 0,
        retired: 0,
        failed: 0,
        continuationScheduled: false,
      };
    }
    const monitors = await ctx.runQuery(
      internal.socialapiMonitors.listDiscoveryMonitorsForRetirementInternal,
      { limit: DISCOVERY_MONITOR_RETIREMENT_BATCH_SIZE }
    );
    const retiredMonitorIds: string[] = [];
    let failed = 0;

    for (const monitor of monitors) {
      try {
        const result = await ctx.runAction(
          internal.socialapiMonitors.deleteMonitorApiCall,
          { monitorId: monitor.monitorId }
        );
        if (result.success) {
          retiredMonitorIds.push(monitor.monitorId);
          continue;
        }

        failed += 1;
        await ctx.runMutation(
          internal.socialapiMonitors
            .recordDiscoveryMonitorRetirementFailureInternal,
          {
            monitorId: monitor.monitorId,
            error: result.error ?? "SocialAPI monitor deletion failed",
          }
        );
      } catch (error) {
        failed += 1;
        await ctx.runMutation(
          internal.socialapiMonitors
            .recordDiscoveryMonitorRetirementFailureInternal,
          {
            monitorId: monitor.monitorId,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    }

    if (retiredMonitorIds.length > 0) {
      await ctx.runMutation(
        internal.socialapiMonitors.markDiscoveryMonitorsRetiredInternal,
        { monitorIds: retiredMonitorIds }
      );
    }

    const continuationScheduled =
      monitors.length === DISCOVERY_MONITOR_RETIREMENT_BATCH_SIZE &&
      retiredMonitorIds.length > 0;
    if (continuationScheduled) {
      await ctx.scheduler.runAfter(
        DISCOVERY_MONITOR_RETIREMENT_DELAY_MS,
        internal.socialapiMonitors.retireDiscoveryMonitorsCron,
        {}
      );
    }

    return {
      attempted: monitors.length,
      retired: retiredMonitorIds.length,
      failed,
      continuationScheduled,
    };
  },
});
