// convex/prospects.ts
// v4: Prospect management queries and mutations

import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
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
  qualificationStatusValidator,
  prospectTypeValidator,
  enrichmentStatusValidator,
  planGenerationStatusValidator,
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
      if ((b.qualificationScore ?? 0) !== (a.qualificationScore ?? 0)) {
        return (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0);
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
      contacted: 0,
      in_progress: 0,
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
          matchReason: p.matchReason,
          matchedKeywords: p.matchedKeywords,
          status: "new",
          qualificationStatus: "pending",
          updatedAt: now,
        });
        created++;

        // Immediately start qualification workflow for this prospect (streaming)
        await ctx.scheduler.runAfter(
          0,
          internal.workflows.qualification.startQualification,
          {
            prospectId,
            workspaceId: args.workspaceId,
          }
        );
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

    const now = Date.now();

    // Update stageTimestamps with the new status timestamp
    const newStageTimestamps = {
      ...(prospect.stageTimestamps || {}),
      [args.status]: now,
    };

    const updateData: {
      status: typeof args.status;
      pipelineStage: typeof args.status;
      stageTimestamps: typeof newStageTimestamps;
      updatedAt: number;
      notes?: string;
      tags?: string[];
    } = {
      status: args.status,
      pipelineStage: args.status,
      stageTimestamps: newStageTimestamps,
      updatedAt: now,
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
 * Extract evidence post from webhook tweet data.
 * Preserves the FULL tweet object so UI components have access to user data.
 * This is critical for rendering Tweet headers and footers correctly.
 */
function extractEvidencePostFromWebhook(
  data: unknown,
  platform: "twitter" | "linkedin"
): unknown[] {
  const tweetData = data as Record<string, unknown>;
  const id = String(tweetData.id_str || tweetData.id || "");
  const text = ((tweetData.full_text || tweetData.text || "") as string).trim();

  if (!id || !text) {
    console.warn("[saveProspectFromWebhook] No tweet text found in data");
    return [];
  }

  // Return the FULL tweet data with platform tag for UI rendering
  return [{ ...tweetData, platform }];
}

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

    // Create new prospect with evidence posts extracted from webhook data
    const evidencePosts = extractEvidencePostFromWebhook(
      args.data,
      args.platform
    );
    console.info(
      "[saveProspectFromWebhook] Evidence posts extracted:",
      evidencePosts.length
    );

    const prospectId = await ctx.db.insert("prospects", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      platform: args.platform,
      externalId: args.externalId,
      data: args.data,
      evidencePosts: evidencePosts.length > 0 ? evidencePosts : undefined,
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
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.qualification.startQualification,
      {
        prospectId,
        workspaceId: args.workspaceId,
      }
    );

    return { created: true, prospectId };
  },
});

/**
 * Update prospect qualification status and data (internal, for qualifyProspect tool)
 */
export const updateProspectQualification = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    qualificationStatus: qualificationStatusValidator,
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

/**
 * Update prospect enrichment data (internal, for enrichment workflow)
 */
export const updateProspectEnrichment = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    prospectType: v.optional(prospectTypeValidator),
    displayName: v.optional(v.string()),
    title: v.optional(v.string()),
    briefIntro: v.optional(v.string()),
    company: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    location: v.optional(v.string()),
    pipelineStage: v.optional(prospectStatusValidator),
    finance: v.optional(
      v.object({
        displayValue: v.string(),
        type: v.optional(v.string()),
        amount: v.optional(v.number()),
        currency: v.optional(v.string()),
        evidencePosts: v.array(v.any()),
      })
    ),
    painPoints: v.optional(
      v.array(
        v.object({
          pain: v.string(),
          solution: v.optional(v.string()),
          evidencePosts: v.array(v.any()),
        })
      )
    ),
    socialProfiles: v.optional(
      v.object({
        twitter: v.optional(
          v.object({
            username: v.string(),
            url: v.string(),
            profileId: v.optional(v.string()),
          })
        ),
        linkedin: v.optional(
          v.object({
            username: v.string(),
            url: v.string(),
            urn: v.optional(v.string()),
          })
        ),
      })
    ),
    enrichedAt: v.optional(v.number()),
    enrichmentStatus: v.optional(enrichmentStatusValidator),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      throw new Error("Prospect not found");
    }

    // Build update object, only including defined fields
    const updateData: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.prospectType !== undefined)
      updateData.prospectType = args.prospectType;
    if (args.displayName !== undefined)
      updateData.displayName = args.displayName;
    if (args.title !== undefined) updateData.title = args.title;
    if (args.briefIntro !== undefined) updateData.briefIntro = args.briefIntro;
    if (args.company !== undefined) updateData.company = args.company;
    if (args.websiteUrl !== undefined) updateData.websiteUrl = args.websiteUrl;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.location !== undefined) updateData.location = args.location;
    if (args.pipelineStage !== undefined)
      updateData.pipelineStage = args.pipelineStage;
    if (args.finance !== undefined) updateData.finance = args.finance;
    if (args.painPoints !== undefined) updateData.painPoints = args.painPoints;
    if (args.socialProfiles !== undefined)
      updateData.socialProfiles = args.socialProfiles;
    if (args.enrichedAt !== undefined) updateData.enrichedAt = args.enrichedAt;
    if (args.enrichmentStatus !== undefined)
      updateData.enrichmentStatus = args.enrichmentStatus;

    await ctx.db.patch(args.prospectId, updateData);

    return { success: true };
  },
});

/**
 * Update prospect plan generation status (internal, for auto outreach plan generation)
 * Called by enrichment workflow and outreach plan generation actions.
 */
export const updatePlanGenerationStatus = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    status: planGenerationStatusValidator,
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      throw new Error("Prospect not found");
    }

    await ctx.db.patch(args.prospectId, {
      planGenerationStatus: args.status,
      updatedAt: Date.now(),
    });

    console.info(
      `[Prospects] Updated planGenerationStatus for ${args.prospectId}: ${args.status}`
    );

    return { success: true };
  },
});

// Note: getPendingQualificationProspects REMOVED
// Qualification now happens automatically per-prospect via streaming workflows
// triggered immediately when prospects are saved (see workflows/qualification.ts)

// Note: qualifyProspectInternal REMOVED (dead code)
// All qualification logic is now in lib/qualificationCore.ts
// Used by: workflows/qualification.ts, agents/tools/qualifyProspect.ts
