// convex/socialapiMonitors.ts
// SocialAPI Search Query Monitor management for Twitter 24/7 prospecting with automatic retry

import {
  query,
  mutation,
  action,
  internalAction,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getUserFromIdentity } from "./lib/userUtils";
import { retrier } from "./lib/retrier";

// ============================================================================
// Constants
// ============================================================================

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
const DEFAULT_REFRESH_FREQUENCY = 86400; // 24 hours in seconds

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
  },
  handler: async (ctx, args) => {
    // Check if monitor already exists
    const existing = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("socialQueryMonitors", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      monitorId: args.monitorId,
      query: args.query,
      refreshFrequency: args.refreshFrequency,
      status: "active",
      createdAt: Date.now(),
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
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("deleted")),
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
      totalProspectsFound: 0,
    };

    for (const m of monitors) {
      stats[m.status]++;
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
  },
  handler: async (_, args): Promise<CreateMonitorApiResult> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      // Don't retry configuration errors
      return { success: false, error: "SocialAPI not configured" };
    }

    const response = await fetch(`${SOCIALAPI_BASE_URL}/monitors/search-query`, {
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
    });

    const data = (await response.json()) as SocialAPICreateMonitorResponse;

    if (!response.ok || data.status !== "success" || !data.data) {
      // Throw to trigger retry for transient failures
      throw new Error(data.message ?? `HTTP ${response.status}`);
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
  handler: async (_, args): Promise<DeleteMonitorApiResult> => {
    const apiKey = process.env.SOCIALAPI_API_KEY;
    if (!apiKey) {
      // Don't retry configuration errors
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
 * Create a new SocialAPI Search Query Monitor with automatic retry
 */
export const createMonitor = action({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    refreshFrequency: v.optional(v.number()),
    webhookUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; monitorId?: string; error?: string }> => {
    // Get user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify workspace and get user ID
    const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      return { success: false, error: "Workspace not found" };
    }

    // Get webhook URL - use provided or construct from Convex deployment
    const webhookUrl =
      args.webhookUrl ??
      `${process.env.CONVEX_SITE_URL}/socialapi-webhook`;

    const refreshFrequency = args.refreshFrequency ?? DEFAULT_REFRESH_FREQUENCY;

    try {
      // Use retrier to run the API call with automatic retry
      const runId = await retrier.run(
        ctx,
        internal.socialapiMonitors.createMonitorApiCall,
        {
          query: args.query,
          refreshFrequency,
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
            console.error("[SocialAPI] Retrier exhausted all retries:", status.result.error);
            return { success: false, error: `Failed after retries: ${status.result.error}` };
          } else {
            return { success: false, error: "Request was canceled" };
          }
        }
        break;
      }

      if (!result || !result.success || !result.monitorId) {
        return { success: false, error: result?.error ?? "Unknown error" };
      }

      // Save monitor record in our database
      await ctx.runMutation(internal.socialapiMonitors.saveMonitor, {
        workspaceId: args.workspaceId,
        userId: workspace.userId,
        monitorId: result.monitorId,
        query: args.query,
        refreshFrequency,
      });

      // Link monitor ID to the social query keyword
      await ctx.runMutation(internal.keywords.updateKeywordMonitorId, {
        workspaceId: args.workspaceId,
        query: args.query,
        monitorId: result.monitorId,
      });

      console.log(
        `[SocialAPI] Created monitor ${result.monitorId} for query "${args.query}"`
      );

      return { success: true, monitorId: result.monitorId };
    } catch (error) {
      console.error("[SocialAPI] Error creating monitor:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

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
      const runId = await retrier.run(
        ctx,
        internal.socialapiMonitors.deleteMonitorApiCall,
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
        await ctx.runMutation(internal.socialapiMonitors.updateMonitorStatus, {
          monitorId: args.monitorId,
          status: "deleted",
        });

        if (status.type === "completed") {
          if (status.result.type === "success") {
            console.log(`[SocialAPI] Deleted monitor ${args.monitorId}`);
            return { success: true };
          } else if (status.result.type === "failed") {
            console.warn(`[SocialAPI] Delete failed after retries: ${status.result.error}`);
            return { success: true }; // Still return success since we marked it deleted locally
          }
        }
        break;
      }

      return { success: true };
    } catch (error) {
      console.error("[SocialAPI] Error deleting monitor:", error);

      // Still mark as deleted locally
      try {
        await ctx.runMutation(internal.socialapiMonitors.updateMonitorStatus, {
          monitorId: args.monitorId,
          status: "deleted",
        });
      } catch {
        // Ignore if already deleted
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Create monitors for all social queries in a workspace
 */
export const createMonitorsFromSocialQueries = action({
  args: {
    workspaceId: v.id("workspaces"),
    refreshFrequency: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; created: number; failed: number; errors: string[] }> => {
    // Get user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, created: 0, failed: 0, errors: ["Not authenticated"] };
    }

    // Get workspace keywords (contains socialQueries)
    const keywords = await ctx.runQuery(internal.keywords.getWorkspaceKeywordsInternal, {
      workspaceId: args.workspaceId,
    });

    if (!keywords || keywords.socialQueries.length === 0) {
      return { success: true, created: 0, failed: 0, errors: ["No social queries found"] };
    }

    // Get existing monitors to avoid duplicates
    const existingMonitors = await ctx.runQuery(
      internal.socialapiMonitors.getActiveMonitorsInternal,
      { workspaceId: args.workspaceId }
    );

    const existingQueries = new Set(existingMonitors.map((m: { query: string }) => m.query.toLowerCase()));

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const query of keywords.socialQueries) {
      // Skip if monitor already exists for this query
      if (existingQueries.has(query.toLowerCase())) {
        continue;
      }

      const result = await ctx.runAction(internal.socialapiMonitors.createMonitorInternal, {
        workspaceId: args.workspaceId,
        query,
        refreshFrequency: args.refreshFrequency,
      });

      if (result.success) {
        created++;
      } else {
        failed++;
        errors.push(`"${query}": ${result.error}`);
      }
    }

    return { success: failed === 0, created, failed, errors };
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
  },
  handler: async (ctx, args): Promise<{ success: boolean; monitorId?: string; error?: string }> => {
    const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      return { success: false, error: "Workspace not found" };
    }

    const webhookUrl = `${process.env.CONVEX_SITE_URL}/socialapi-webhook`;
    const refreshFrequency = args.refreshFrequency ?? DEFAULT_REFRESH_FREQUENCY;

    try {
      // Use retrier to run the API call with automatic retry
      const runId = await retrier.run(
        ctx,
        internal.socialapiMonitors.createMonitorApiCall,
        {
          query: args.query,
          refreshFrequency,
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
            return { success: false, error: `Failed after retries: ${status.result.error}` };
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
      });

      // Link monitor ID to the social query keyword
      await ctx.runMutation(internal.keywords.updateKeywordMonitorId, {
        workspaceId: args.workspaceId,
        query: args.query,
        monitorId: result.monitorId,
      });

      return { success: true, monitorId: result.monitorId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Get active monitors for a workspace (internal)
 */
export const getActiveMonitorsInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();
  },
});

/**
 * Create monitors for all social queries in a workspace (internal version)
 * Used by searchProspects tool to auto-create monitors after generating queries
 */
export const createMonitorsFromSocialQueriesInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    refreshFrequency: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; created: number; failed: number; errors: string[] }> => {
    // Get workspace keywords (contains socialQueries)
    const keywords = await ctx.runQuery(internal.keywords.getWorkspaceKeywordsInternal, {
      workspaceId: args.workspaceId,
    });

    if (!keywords || keywords.socialQueries.length === 0) {
      return { success: true, created: 0, failed: 0, errors: ["No social queries found"] };
    }

    // Get existing monitors to avoid duplicates
    const existingMonitors = await ctx.runQuery(
      internal.socialapiMonitors.getActiveMonitorsInternal,
      { workspaceId: args.workspaceId }
    );

    const existingQueries = new Set(existingMonitors.map((m: { query: string }) => m.query.toLowerCase()));

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const query of keywords.socialQueries) {
      // Skip if monitor already exists for this query
      if (existingQueries.has(query.toLowerCase())) {
        continue;
      }

      const result = await ctx.runAction(internal.socialapiMonitors.createMonitorInternal, {
        workspaceId: args.workspaceId,
        query,
        refreshFrequency: args.refreshFrequency,
      });

      if (result.success) {
        created++;
      } else {
        failed++;
        errors.push(`"${query}": ${result.error}`);
      }
    }

    return { success: failed === 0, created, failed, errors };
  },
});
