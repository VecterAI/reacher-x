// Read-only lookup helpers for the Jev replay evaluation. All queries are
// indexed and bounded; nothing here mutates state.

import { v } from "convex/values";
import { internalQuery } from "./lib/functionBuilders";

export const resolveJevEvalWorkspaceInternal = internalQuery({
  args: {
    email: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    if (args.workspaceId) {
      const workspace = await ctx.db.get(args.workspaceId);
      if (!workspace) return null;
      return {
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        targetingSpec: workspace.targetingSpec ?? null,
        description: workspace.description,
        icps: workspace.icps ?? [],
      };
    }

    if (!args.email) return null;
    const email = args.email;
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) return null;

    // Prefer the default workspace via its dedicated index; fall back to a
    // bounded indexed scan filtered in memory so workspaces mid-deletion
    // cannot hide a live one.
    const defaultWorkspace = await ctx.db
      .query("workspaces")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", user._id).eq("isDefault", true)
      )
      .first();
    let selectedWorkspace =
      defaultWorkspace && !defaultWorkspace.deletionWorkflowId
        ? defaultWorkspace
        : null;
    if (!selectedWorkspace) {
      const WORKSPACE_SCAN_BUDGET = 100;
      const workspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .order("asc")
        .take(WORKSPACE_SCAN_BUDGET);
      selectedWorkspace =
        workspaces.find((workspace) => !workspace.deletionWorkflowId) ?? null;
    }
    if (!selectedWorkspace) return null;

    return {
      workspaceId: selectedWorkspace._id,
      workspaceName: selectedWorkspace.name,
      targetingSpec: selectedWorkspace.targetingSpec ?? null,
      description: selectedWorkspace.description,
      icps: selectedWorkspace.icps ?? [],
    };
  },
});

export const getJevEvalReplayableProspectIdsPageInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.union(v.literal("qualified"), v.literal("disqualified")),
    numItems: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Convex allows a single `.paginate()` per function execution, so one call
    // returns exactly one page; the replay action drives page iteration with
    // the returned cursor. Page size stays small because prospect documents
    // carry large raw evidence payloads.
    const numItems = Math.min(50, Math.max(1, Math.floor(args.numItems)));
    const page = await ctx.db
      .query("prospects")
      .withIndex("by_workspace_qualification", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("qualificationStatus", args.status)
      )
      .order("desc")
      .paginate({ numItems, cursor: args.cursor ?? null });
    const isReplayable = (prospect: {
      qualificationCriterionResults?: unknown;
      evidencePosts?: unknown;
    }) =>
      Array.isArray(prospect.qualificationCriterionResults) &&
      prospect.qualificationCriterionResults.length > 0 &&
      Array.isArray(prospect.evidencePosts) &&
      prospect.evidencePosts.length > 0;
    return {
      ids: page.page.filter(isReplayable).map((prospect) => prospect._id),
      scanned: page.page.length,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const getJevEvalProspectInternal = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) return null;

    return {
      prospectId: prospect._id,
      platform: prospect.platform,
      qualificationStatus: prospect.qualificationStatus ?? null,
      qualificationScore: prospect.qualificationScore,
      qualificationScoreBreakdown: prospect.qualificationScoreBreakdown ?? null,
      qualificationCriterionResults:
        prospect.qualificationCriterionResults ?? [],
      storedSourceIds: (prospect.qualificationSources ?? []).map(
        (source) => source.sourceId
      ),
      isLikelyBot: prospect.authenticity?.isLikelyBot ?? null,
      qualificationKeywords: prospect.qualificationKeywords ?? [],
      evidencePosts: prospect.evidencePosts ?? [],
      data: prospect.data,
    };
  },
});
