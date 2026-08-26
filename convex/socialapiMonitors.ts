// convex/socialapiMonitors.ts
// SocialAPI Search Query Monitor management for Twitter 24/7 prospecting with automatic retry

import {
  query,
  action,
  internalAction,
  internalQuery,
  internalMutation,
} from "./lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getUserFromIdentity } from "./lib/userUtils";
import { formatWorkspaceLogContext } from "./lib/logHelpers";
import { getRetriedActionStatus, runRetriedAction } from "./lib/retrier";
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
      const runId = await runRetriedAction(
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
      const runId = await runRetriedAction(
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
