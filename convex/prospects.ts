// convex/prospects.ts
// v4: Prospect management queries and mutations

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserFromIdentity } from "./lib/userUtils";
import {
  canAddProspects,
  incrementProspectCount,
  decrementProspectCount,
} from "./lib/planHelpers";
import {
  createProspectArgsValidator,
  updateProspectStatusArgsValidator,
  prospectPlatformValidator,
  prospectStatusValidator,
} from "./validators";

/**
 * Get prospects for a workspace
 */
export const getWorkspaceProspects = query({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.optional(prospectPlatformValidator),
    status: v.optional(prospectStatusValidator),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { prospects: [], total: 0 };

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return { prospects: [], total: 0 };

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      return { prospects: [], total: 0 };
    }

    // Build query based on filters
    let prospects;

    if (args.platform && args.status) {
      prospects = await ctx.db
        .query("prospects")
        .withIndex("by_workspace_platform", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("platform", args.platform!)
        )
        .filter((q) => q.eq(q.field("status"), args.status))
        .collect();
    } else if (args.status) {
      prospects = await ctx.db
        .query("prospects")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .collect();
    } else if (args.platform) {
      prospects = await ctx.db
        .query("prospects")
        .withIndex("by_workspace_platform", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("platform", args.platform!)
        )
        .collect();
    } else {
      prospects = await ctx.db
        .query("prospects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
    }

    // Sort by match score (highest first) then by creation time
    const sorted = prospects.sort((a, b) => {
      if ((b.matchScore ?? 0) !== (a.matchScore ?? 0)) {
        return (b.matchScore ?? 0) - (a.matchScore ?? 0);
      }
      return b._creationTime - a._creationTime;
    });

    const total = sorted.length;
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 50;

    return {
      prospects: sorted.slice(offset, offset + limit),
      total,
      hasMore: offset + limit < total,
    };
  },
});

/**
 * Get a single prospect by ID
 */
export const getProspect = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect || prospect.userId !== user._id) return null;

    return prospect;
  },
});

/**
 * Get prospect counts by status for a workspace
 */
export const getProspectCounts = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) return null;

    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const counts = {
      total: prospects.length,
      new: 0,
      reviewed: 0,
      contacted: 0,
      converted: 0,
      archived: 0,
      twitter: 0,
      linkedin: 0,
    };

    for (const p of prospects) {
      counts[p.status]++;
      counts[p.platform]++;
    }

    return counts;
  },
});

/**
 * Create a new prospect (with plan limit check)
 */
export const createProspect = mutation({
  args: createProspectArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    // Check plan limits
    const canAdd = await canAddProspects(ctx, user._id, 1);
    if (!canAdd.allowed) {
      throw new Error(canAdd.reason ?? "Prospect limit reached");
    }

    // Check for duplicate
    const existing = await ctx.db
      .query("prospects")
      .withIndex("by_external_id", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("platform", args.platform)
          .eq("externalId", args.externalId)
      )
      .first();

    if (existing) {
      // Update existing prospect with new data
      await ctx.db.patch(existing._id, {
        data: args.data,
        matchScore: args.matchScore ?? existing.matchScore,
        matchReason: args.matchReason ?? existing.matchReason,
        matchedKeywords: args.matchedKeywords ?? existing.matchedKeywords,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    const prospectId = await ctx.db.insert("prospects", {
      workspaceId: args.workspaceId,
      userId: user._id,
      platform: args.platform,
      externalId: args.externalId,
      data: args.data,
      matchScore: args.matchScore,
      matchReason: args.matchReason,
      matchedKeywords: args.matchedKeywords,
      status: "new",
      updatedAt: Date.now(),
    });

    // Increment prospect count
    await incrementProspectCount(ctx, user._id, 1);

    return prospectId;
  },
});

/**
 * Create multiple prospects in batch (internal, for agent use)
 */
export const createProspectsBatch = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    prospects: v.array(
      v.object({
        platform: prospectPlatformValidator,
        externalId: v.string(),
        data: v.any(),
        matchScore: v.optional(v.number()),
        matchReason: v.optional(v.string()),
        matchedKeywords: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const p of args.prospects) {
      // Check for duplicate
      const existing = await ctx.db
        .query("prospects")
        .withIndex("by_external_id", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("platform", p.platform)
            .eq("externalId", p.externalId)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          data: p.data,
          matchScore: p.matchScore ?? existing.matchScore,
          matchReason: p.matchReason ?? existing.matchReason,
          matchedKeywords: p.matchedKeywords ?? existing.matchedKeywords,
          updatedAt: now,
        });
        updated++;
      } else {
        await ctx.db.insert("prospects", {
          workspaceId: args.workspaceId,
          userId: args.userId,
          platform: p.platform,
          externalId: p.externalId,
          data: p.data,
          matchScore: p.matchScore,
          matchReason: p.matchReason,
          matchedKeywords: p.matchedKeywords,
          status: "new",
          updatedAt: now,
        });
        created++;
      }
    }

    // Increment prospect count for newly created
    if (created > 0) {
      await incrementProspectCount(ctx, args.userId, created);
    }

    return { created, updated };
  },
});

/**
 * Update prospect status
 */
export const updateProspectStatus = mutation({
  args: updateProspectStatusArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect || prospect.userId !== user._id) {
      throw new Error("Prospect not found");
    }

    const updateData: {
      status: typeof args.status;
      updatedAt: number;
      notes?: string;
      tags?: string[];
    } = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.notes !== undefined) {
      updateData.notes = args.notes;
    }
    if (args.tags !== undefined) {
      updateData.tags = args.tags;
    }

    await ctx.db.patch(args.prospectId, updateData);

    return { success: true };
  },
});

/**
 * Delete a prospect
 */
export const deleteProspect = mutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect || prospect.userId !== user._id) {
      throw new Error("Prospect not found");
    }

    await ctx.db.delete(args.prospectId);

    // Decrement prospect count
    await decrementProspectCount(ctx, user._id, 1);

    return { success: true };
  },
});

/**
 * Archive multiple prospects
 */
export const archiveProspects = mutation({
  args: { prospectIds: v.array(v.id("prospects")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);
    const now = Date.now();
    let archived = 0;

    for (const id of args.prospectIds) {
      const prospect = await ctx.db.get(id);
      if (prospect && prospect.userId === user._id) {
        await ctx.db.patch(id, { status: "archived", updatedAt: now });
        archived++;
      }
    }

    return { archived };
  },
});

/**
 * Save a prospect from SocialAPI webhook (internal, no auth context)
 * Called by HTTP handler when webhook receives a new tweet
 */
export const saveProspectFromWebhook = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    monitorId: v.string(),
    platform: prospectPlatformValidator,
    externalId: v.string(),
    data: v.any(),
    matchedQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for duplicate using the by_external_id index
    const existing = await ctx.db
      .query("prospects")
      .withIndex("by_external_id", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("platform", args.platform)
          .eq("externalId", args.externalId)
      )
      .first();

    if (existing) {
      // Update existing prospect with new data
      await ctx.db.patch(existing._id, {
        data: args.data,
        matchedKeywords: args.matchedQuery
          ? [
              ...(existing.matchedKeywords ?? []),
              ...(existing.matchedKeywords?.includes(args.matchedQuery)
                ? []
                : [args.matchedQuery]),
            ]
          : existing.matchedKeywords,
        updatedAt: now,
      });
      return { created: false, prospectId: existing._id };
    }

    // Create new prospect
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      platform: args.platform,
      externalId: args.externalId,
      data: args.data,
      matchedKeywords: args.matchedQuery ? [args.matchedQuery] : undefined,
      matchReason: args.matchedQuery
        ? `Matched search query: "${args.matchedQuery}"`
        : undefined,
      status: "new",
      updatedAt: now,
    });

    // Increment prospect count
    await incrementProspectCount(ctx, args.userId, 1);

    // Update monitor stats
    const monitor = await ctx.db
      .query("socialQueryMonitors")
      .withIndex("by_monitor_id", (q) => q.eq("monitorId", args.monitorId))
      .first();

    if (monitor) {
      await ctx.db.patch(monitor._id, {
        lastWebhookAt: now,
        totalProspectsFound: (monitor.totalProspectsFound ?? 0) + 1,
      });
    }

    return { created: true, prospectId };
  },
});

