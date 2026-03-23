import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalQuery, query } from "./lib/functionBuilders";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import {
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import {
  prospectPlatformValidator,
  prospectStatusValidator,
} from "./validators";

export type SummaryDb = QueryCtx["db"] | MutationCtx["db"];
export type PaginationOpts = {
  cursor: string | null;
  numItems: number;
};

export type ListWorkspaceProspectSummariesArgs = {
  workspaceId: Id<"workspaces">;
  platform?: Doc<"prospects">["platform"];
  status?: Doc<"prospects">["status"];
  qualifiedOnly?: boolean;
  fitScoreMin?: number;
  fitScoreMax?: number;
  paginationOpts: PaginationOpts;
};

async function resolveWorkspaceFitRange(args: {
  db: SummaryDb;
  workspaceId: Id<"workspaces">;
  fitScoreMin?: number;
  fitScoreMax?: number;
}) {
  const workspace = await args.db.get(args.workspaceId);
  const min = Math.max(
    0,
    Math.min(100, Math.round(args.fitScoreMin ?? workspace?.fitScoreMin ?? 70))
  );
  const max = Math.max(
    min,
    Math.min(100, Math.round(args.fitScoreMax ?? workspace?.fitScoreMax ?? 100))
  );

  return { fitScoreMin: min, fitScoreMax: max };
}

async function getProspectSummaryOrFallback(
  db: SummaryDb,
  prospectId: Id<"prospects">
) {
  const summary = await db
    .query("prospectSummaries")
    .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
    .first();

  if (summary) {
    return summary;
  }

  const prospect = await db.get(prospectId);
  return prospect ? buildProspectSummaryRecord(prospect) : null;
}

export async function listWorkspaceProspectSummariesPage(
  db: SummaryDb,
  args: ListWorkspaceProspectSummariesArgs
) {
  const { workspaceId, paginationOpts } = args;
  const platform = args.platform;
  const status = args.status;
  const qualifiedOnly = args.qualifiedOnly === true;
  const { fitScoreMin, fitScoreMax } = await resolveWorkspaceFitRange({
    db,
    workspaceId,
    fitScoreMin: args.fitScoreMin,
    fitScoreMax: args.fitScoreMax,
  });

  if (platform && status && qualifiedOnly) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_status_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .eq("status", status)
          .eq("readyQualifiedEnriched", true)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (platform && status) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_status_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .eq("status", status)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (platform && qualifiedOnly) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .eq("readyQualifiedEnriched", true)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (status && qualifiedOnly) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_status_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("status", status)
          .eq("readyQualifiedEnriched", true)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (platform) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (status) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_status_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("status", status)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (qualifiedOnly) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("readyQualifiedEnriched", true)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  return await db
    .query("prospectSummaries")
    .withIndex("by_workspace_score", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .gte("sortQualificationScore", fitScoreMin)
        .lte("sortQualificationScore", fitScoreMax)
    )
    .order("desc")
    .paginate(paginationOpts);
}

export const getWorkspaceFitScoreHistogram = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    const summaries = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const binCounts = Array.from({ length: 10 }, () => 0);

    for (const summary of summaries) {
      const score =
        typeof summary.qualificationScore === "number"
          ? Math.max(0, Math.min(100, Math.round(summary.qualificationScore)))
          : null;
      if (score === null) {
        continue;
      }
      const binIndex = Math.min(9, Math.floor(score / 10));
      binCounts[binIndex] += 1;
    }

    return { binCounts };
  },
});

export const getProspectSummaryInternal = internalQuery({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    return await getProspectSummaryOrFallback(ctx.db, prospectId);
  },
});

export const getProspectSummary = query({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized to view this prospect",
    });

    return await getProspectSummaryOrFallback(ctx.db, prospectId);
  },
});

export const listWorkspaceProspectSummariesInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.optional(prospectPlatformValidator),
    status: v.optional(prospectStatusValidator),
    qualifiedOnly: v.optional(v.boolean()),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await listWorkspaceProspectSummariesPage(ctx.db, args);
  },
});

export const listWorkspaceProspectSummaries = query({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.optional(prospectPlatformValidator),
    status: v.optional(prospectStatusValidator),
    qualifiedOnly: v.optional(v.boolean()),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    return await listWorkspaceProspectSummariesPage(ctx.db, args);
  },
});
