// convex/prospects.ts
// v4: Prospect management queries and mutations

import { query, mutation, internalMutation, internalQuery, internalAction } from "./_generated/server";
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
import { internal } from "./_generated/api";

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
 * Get a single prospect by ID (internal, no auth check)
 * Used by qualifyProspectInternal and other internal actions that run without user context
 */
export const getProspectInternal = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.prospectId);
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
 * Check if workspace has any prospects (lightweight query for redirect logic)
 */
export const hasProspects = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return false;

    // Verify workspace belongs to user
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.userId !== user._id) return false;

    // Just check if at least one prospect exists (efficient single-row query)
    const prospect = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    return prospect !== null;
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
        const prospectId = await ctx.db.insert("prospects", {
          workspaceId: args.workspaceId,
          userId: args.userId,
          platform: p.platform,
          externalId: p.externalId,
          data: p.data,
          matchScore: p.matchScore,
          matchReason: p.matchReason,
          matchedKeywords: p.matchedKeywords,
          status: "new",
          qualificationStatus: "pending",
          updatedAt: now,
        });
        created++;

        // Immediately start qualification workflow for this prospect (streaming)
        await ctx.scheduler.runAfter(0, internal.workflows.qualification.startQualification, {
          prospectId,
          workspaceId: args.workspaceId,
        });
      }
    }

    // Note: Prospect counts are calculated on-demand from the prospects table
    // Qualification workflows are started immediately for each new prospect

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
      qualificationStatus: "pending",
      updatedAt: now,
    });

    // Note: Prospect counts are calculated on-demand
    // Monitor stats removed to avoid OCC race conditions

    // Immediately start qualification workflow for this prospect (streaming)
    await ctx.scheduler.runAfter(0, internal.workflows.qualification.startQualification, {
      prospectId,
      workspaceId: args.workspaceId,
    });

    return { created: true, prospectId };
  },
});

/**
 * Update prospect qualification status and data (internal, for qualifyProspect tool)
 */
export const updateProspectQualification = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    qualificationStatus: v.union(
      v.literal("pending"),
      v.literal("qualified"),
      v.literal("disqualified")
    ),
    qualificationScore: v.number(),
    qualifiedAt: v.optional(v.number()),
    evidencePosts: v.optional(v.array(v.any())),
    qualificationKeywords: v.optional(v.array(v.string())),
    authenticity: v.optional(
      v.object({
        isLikelyBot: v.boolean(),
        accountAge: v.optional(v.number()),
        followersCount: v.optional(v.number()),
        followingCount: v.optional(v.number()),
        engagementRate: v.optional(v.number()),
        flags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      throw new Error("Prospect not found");
    }

    await ctx.db.patch(args.prospectId, {
      qualificationStatus: args.qualificationStatus,
      qualificationScore: args.qualificationScore,
      qualifiedAt: args.qualifiedAt,
      evidencePosts: args.evidencePosts,
      qualificationKeywords: args.qualificationKeywords,
      authenticity: args.authenticity,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Note: getPendingQualificationProspects REMOVED
// Qualification now happens automatically per-prospect via streaming workflows
// triggered immediately when prospects are saved (see workflows/qualification.ts)

/**
 * Qualify a single prospect (internal action, for workflow use)
 * This is a lightweight version of the agent tool that can be called from workflows
 */
export const qualifyProspectInternal = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; qualified: boolean; score: number; error?: string }> => {
    try {
      // Import the qualification logic from the tool
      // We're reusing the same logic but calling it from an action context
      const { api, internal } = await import("./_generated/api");

      // Get prospect data (using internal query - no auth check required)
      const prospect = await ctx.runQuery(internal.prospects.getProspectInternal, {
        prospectId: args.prospectId,
      });

      if (!prospect) {
        return { success: false, qualified: false, score: 0, error: "Prospect not found" };
      }

      // Get workspace for qualificationKeywords
      const workspace = await ctx.runQuery(internal.workspaces.getById, {
        workspaceId: args.workspaceId,
      });

      if (!workspace || !workspace.icps || workspace.icps.length === 0) {
        return { success: false, qualified: false, score: 0, error: "Workspace has no ICPs" };
      }

      // Collect qualificationKeywords from ICPs
      const allQualificationKeywords: string[] = [];
      for (const icp of workspace.icps) {
        if (icp.qualificationKeywords) {
          allQualificationKeywords.push(...icp.qualificationKeywords);
        }
      }

      if (allQualificationKeywords.length === 0) {
        // No qualificationKeywords, skip qualification but mark as checked
        await ctx.runMutation(internal.prospects.updateProspectQualification, {
          prospectId: args.prospectId,
          qualificationStatus: "qualified", // Default to qualified if no keywords to check
          qualificationScore: 50,
        });
        return { success: true, qualified: true, score: 50 };
      }

      // Use top 10 keywords (deduplicated)
      const keywords = [...new Set(allQualificationKeywords)].slice(0, 10);

      // Fetch evidence posts based on platform
      const prospectData = prospect.data as Record<string, unknown>;
      let evidencePosts: Array<Record<string, unknown>> = [];
      let matchedKeywords: string[] = [];

      if (prospect.platform === "twitter") {
        // Twitter's from: operator requires screen_name (username), NOT numeric id
        const screenName =
          (prospectData.user as Record<string, string>)?.screen_name ||
          (prospectData.author as Record<string, string>)?.screen_name;

        if (screenName) {
          try {
            const result = await ctx.runAction(
              api.integrations.twitter.searchUserPosts.searchUserPosts,
              {
                screenName,
                keywords,
                maxPosts: 20,
              }
            );

            if (result.success) {
              evidencePosts = result.posts as unknown as Array<Record<string, unknown>>;
              matchedKeywords = result.matchedKeywords;
            }
          } catch (err) {
            console.error("Twitter search failed:", err);
          }
        }
      } else if (prospect.platform === "linkedin") {
        const urn =
          (prospectData.author as Record<string, string>)?.urn ||
          (prospectData as Record<string, string>).authorUrn;

        if (urn) {
          try {
            const result = await ctx.runAction(
              api.integrations.linkedin.searchUserPosts.searchUserPosts,
              {
                urn,
                keywords,
                maxPosts: 20,
              }
            );

            if (result.success) {
              evidencePosts = result.posts as unknown as Array<Record<string, unknown>>;
              matchedKeywords = result.matchedKeywords;
            }
          } catch (err) {
            console.error("LinkedIn search failed:", err);
          }
        }
      }

      // Calculate simple qualification score based on evidence
      // Pain point evidence: matched keywords (max 40 points)
      const painPointScore = Math.min((matchedKeywords.length / keywords.length) * 80, 40);

      // Recency: posts within last 30 days (max 20 points)
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      let recentCount = 0;
      for (const post of evidencePosts) {
        const timestamp =
          (post.postedAt as Record<string, number>)?.timestamp ||
          (post.tweet_created_at ? new Date(post.tweet_created_at as string).getTime() : 0);
        if (now - timestamp <= thirtyDaysMs) {
          recentCount++;
        }
      }
      const recencyScore =
        evidencePosts.length > 0
          ? Math.min((recentCount / evidencePosts.length) * 20, 20)
          : 0;

      // Engagement: having evidence posts = engagement (max 20 points)
      const engagementScore = evidencePosts.length > 0 ? 15 : 0;

      // Base authenticity score (we'll assume authentic without AI check for speed)
      const authenticityScore = 20;

      const totalScore = Math.round(painPointScore + recencyScore + engagementScore + authenticityScore);
      const qualified = totalScore >= 80;

      // Update prospect
      await ctx.runMutation(internal.prospects.updateProspectQualification, {
        prospectId: args.prospectId,
        qualificationStatus: qualified ? "qualified" : "disqualified",
        qualificationScore: totalScore,
        qualifiedAt: qualified ? Date.now() : undefined,
        evidencePosts: evidencePosts.slice(0, 5),
        qualificationKeywords: matchedKeywords,
      });

      return { success: true, qualified, score: totalScore };
    } catch (error) {
      console.error("Qualification error:", error);
      return {
        success: false,
        qualified: false,
        score: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
