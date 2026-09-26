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
    // bounded scan of the user's workspaces.
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
      const workspaceCandidates = await ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .take(25);
      selectedWorkspace =
        workspaceCandidates.find(
          (workspace) => !workspace.deletionWorkflowId
        ) ?? null;
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

export const getJevEvalSampleIdsInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    limitPerStatus: v.number(),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, Math.floor(args.limitPerStatus)));
    // Bounded in two axes: total scanned documents and per-transaction page
    // size (each paginate call is its own transaction, so large prospect
    // documents never exceed the per-transaction read limit).
    const SCAN_BUDGET = 600;
    const PAGE_SIZE = 100;
    const isReplayable = (prospect: {
      qualificationCriterionResults?: unknown;
      evidencePosts?: unknown;
    }) =>
      Array.isArray(prospect.qualificationCriterionResults) &&
      prospect.qualificationCriterionResults.length > 0 &&
      Array.isArray(prospect.evidencePosts) &&
      prospect.evidencePosts.length > 0;

    const fetchIds = async (
      status: "qualified" | "disqualified"
    ): Promise<{ ids: Id<"prospects">[]; incomplete: boolean }> => {
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
              .eq("qualificationStatus", status)
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
        incomplete: ids.length < limit && exhausted === false,
      };
    };

    const [qualified, disqualified] = await Promise.all([
      fetchIds("qualified"),
      fetchIds("disqualified"),
    ]);

    return {
      qualifiedIds: qualified.ids,
      disqualifiedIds: disqualified.ids,
      incomplete: qualified.incomplete || disqualified.incomplete,
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
