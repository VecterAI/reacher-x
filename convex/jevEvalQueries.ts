// Read-only lookup helpers for the Jev replay evaluation. All queries are
// indexed and bounded; nothing here mutates state.

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
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
    // bounded cursor-based scan so pages full of deleted workspaces do not
    // hide a live one.
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
      const WORKSPACE_PAGE_SIZE = 50;
      let cursor: string | null = null;
      let scanned = 0;
      let exhausted = false;
      while (
        !selectedWorkspace &&
        scanned < WORKSPACE_SCAN_BUDGET &&
        !exhausted
      ) {
        const page = await ctx.db
          .query("workspaces")
          .withIndex("by_user_id", (q) => q.eq("userId", user._id))
          .order("asc")
          .paginate({
            numItems: Math.min(
              WORKSPACE_PAGE_SIZE,
              WORKSPACE_SCAN_BUDGET - scanned
            ),
            cursor,
          });
        selectedWorkspace =
          page.page.find((workspace) => !workspace.deletionWorkflowId) ?? null;
        scanned += page.page.length;
        cursor = page.continueCursor;
        exhausted = page.isDone;
      }
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

export const getJevEvalSampleIdsForStatusInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.union(v.literal("qualified"), v.literal("disqualified")),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, Math.floor(args.limit)));
    // One status per query invocation keeps each transaction's read volume
    // bounded (prospect documents carry large raw evidence payloads).
    const SCAN_BUDGET = 250;
    const PAGE_SIZE = 50;
    const isReplayable = (prospect: {
      qualificationCriterionResults?: unknown;
      evidencePosts?: unknown;
    }) =>
      Array.isArray(prospect.qualificationCriterionResults) &&
      prospect.qualificationCriterionResults.length > 0 &&
      Array.isArray(prospect.evidencePosts) &&
      prospect.evidencePosts.length > 0;

    const ids: Id<"prospects">[] = [];
    let cursor: string | null = null;
    let scanned = 0;
    let exhausted = false;
    while (ids.length < limit && scanned < SCAN_BUDGET && !exhausted) {
      const page = await ctx.db
        .query("prospects")
        .withIndex("by_workspace_qualification", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("qualificationStatus", args.status)
        )
        .order("desc")
        .paginate({
          numItems: Math.min(PAGE_SIZE, SCAN_BUDGET - scanned),
          cursor,
        });
      for (const prospect of page.page) {
        if (isReplayable(prospect)) {
          ids.push(prospect._id);
          if (ids.length >= limit) break;
        }
      }
      scanned += page.page.length;
      cursor = page.continueCursor;
      exhausted = page.isDone;
    }

    return {
      ids: ids.slice(0, limit),
      incomplete: ids.length < limit && !exhausted,
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
