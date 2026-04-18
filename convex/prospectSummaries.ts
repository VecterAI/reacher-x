import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, query } from "./lib/functionBuilders";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import {
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import {
  prospectPlatformValidator,
  prospectStatusValidator,
  prospectTypeValidator,
} from "./validators";

export type SummaryDb = QueryCtx["db"] | MutationCtx["db"];
export type PaginationOpts = {
  cursor: string | null;
  numItems: number;
};

export type ListWorkspaceProspectSummariesArgs = {
  workspaceId: Id<"workspaces">;
  platform?: Doc<"prospects">["platform"];
  prospectType?: Doc<"prospects">["prospectType"];
  status?: Doc<"prospects">["status"];
  qualifiedOnly?: boolean;
  fitScoreMin?: number;
  fitScoreMax?: number;
  createdAfterMs?: number;
  createdBeforeMs?: number;
  /** Non-empty enables Convex full-text search on `searchText` (requires `status`). */
  searchQuery?: string;
  paginationOpts: PaginationOpts;
};

function applyAdditionalFilters<T extends { filter: (...args: any[]) => any }>(
  query: T,
  args: Pick<
    ListWorkspaceProspectSummariesArgs,
    "prospectType" | "createdAfterMs" | "createdBeforeMs"
  >
) {
  if (
    args.prospectType === undefined &&
    args.createdAfterMs === undefined &&
    args.createdBeforeMs === undefined
  ) {
    return query;
  }

  return query.filter((q: any) => {
    const clauses = [];

    if (args.prospectType !== undefined) {
      clauses.push(q.eq(q.field("prospectType"), args.prospectType));
    }
    if (args.createdAfterMs !== undefined) {
      clauses.push(
        q.gte(q.field("prospectCreatedAt"), Math.round(args.createdAfterMs))
      );
    }
    if (args.createdBeforeMs !== undefined) {
      clauses.push(
        q.lt(q.field("prospectCreatedAt"), Math.round(args.createdBeforeMs))
      );
    }

    if (clauses.length === 1) {
      return clauses[0];
    }
    return q.and(...clauses);
  });
}

export async function resolveWorkspaceFitRange(args: {
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

/**
 * Full-text search path: relevance order, then filters for fit / platform / qualified.
 */
export async function listWorkspaceProspectSummariesSearchPage(
  db: SummaryDb,
  args: ListWorkspaceProspectSummariesArgs & { searchQuery: string }
) {
  const { workspaceId, paginationOpts } = args;
  const searchQuery = args.searchQuery.trim();
  const platform = args.platform;
  const prospectType = args.prospectType;
  const status = args.status;
  const qualifiedOnly = args.qualifiedOnly === true;

  if (!status) {
    throw new Error("listWorkspaceProspectSummariesSearchPage requires status");
  }

  const { fitScoreMin, fitScoreMax } = await resolveWorkspaceFitRange({
    db,
    workspaceId,
    fitScoreMin: args.fitScoreMin,
    fitScoreMax: args.fitScoreMax,
  });

  const query = db
    .query("prospectSummaries")
    .withSearchIndex("search_prospect_summaries", (q) =>
      q
        .search("searchText", searchQuery)
        .eq("workspaceId", workspaceId)
        .eq("status", status)
    )
    .filter((q) => {
      const inFit = q.and(
        q.gte(q.field("sortQualificationScore"), fitScoreMin),
        q.lte(q.field("sortQualificationScore"), fitScoreMax)
      );
      const extraClauses = [];
      if (prospectType !== undefined) {
        extraClauses.push(q.eq(q.field("prospectType"), prospectType));
      }
      if (args.createdAfterMs !== undefined) {
        extraClauses.push(
          q.gte(q.field("prospectCreatedAt"), Math.round(args.createdAfterMs))
        );
      }
      if (args.createdBeforeMs !== undefined) {
        extraClauses.push(
          q.lt(q.field("prospectCreatedAt"), Math.round(args.createdBeforeMs))
        );
      }

      let combinedFit = inFit;
      if (extraClauses.length === 1) {
        combinedFit = q.and(inFit, extraClauses[0]);
      } else if (extraClauses.length > 1) {
        combinedFit = q.and(inFit, q.and(...extraClauses));
      }

      if (qualifiedOnly && platform !== undefined) {
        return q.and(
          combinedFit,
          q.eq(q.field("readyQualifiedEnriched"), true),
          q.eq(q.field("platform"), platform)
        );
      }
      if (qualifiedOnly) {
        return q.and(
          combinedFit,
          q.eq(q.field("readyQualifiedEnriched"), true)
        );
      }
      if (platform !== undefined) {
        return q.and(combinedFit, q.eq(q.field("platform"), platform));
      }
      return combinedFit;
    })
    ;

  return await query.paginate(paginationOpts);
}

export async function listWorkspaceProspectSummariesPage(
  db: SummaryDb,
  args: ListWorkspaceProspectSummariesArgs
) {
  const trimmedSearch = args.searchQuery?.trim();
  if (trimmedSearch) {
    return listWorkspaceProspectSummariesSearchPage(db, {
      ...args,
      searchQuery: trimmedSearch,
    });
  }

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
    return await applyAdditionalFilters(
      db
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
      ,
      args
    )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (platform && status) {
    return await applyAdditionalFilters(
      db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_status_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .eq("status", status)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      ,
      args
    )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (platform && qualifiedOnly) {
    return await applyAdditionalFilters(
      db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .eq("readyQualifiedEnriched", true)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      ,
      args
    )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (status && qualifiedOnly) {
    return await applyAdditionalFilters(
      db
      .query("prospectSummaries")
      .withIndex("by_workspace_status_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("status", status)
          .eq("readyQualifiedEnriched", true)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      ,
      args
    )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (platform) {
    return await applyAdditionalFilters(
      db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      ,
      args
    )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (status) {
    return await applyAdditionalFilters(
      db
      .query("prospectSummaries")
      .withIndex("by_workspace_status_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("status", status)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      ,
      args
    )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (qualifiedOnly) {
    return await applyAdditionalFilters(
      db
      .query("prospectSummaries")
      .withIndex("by_workspace_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("readyQualifiedEnriched", true)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      ,
      args
    )
      .order("desc")
      .paginate(paginationOpts);
  }

  return await applyAdditionalFilters(
    db
      .query("prospectSummaries")
      .withIndex("by_workspace_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      ),
    args
  )
    .order("desc")
    .paginate(paginationOpts);
}

export const getWorkspaceFitScoreHistogram = query({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.optional(prospectPlatformValidator),
    prospectType: v.optional(prospectTypeValidator),
    status: v.optional(prospectStatusValidator),
    createdAfterMs: v.optional(v.number()),
    createdBeforeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    let query;
    if (args.platform && args.status) {
      const platform = args.platform;
      const status = args.status;
      query = ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_platform_status_score", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("platform", platform)
            .eq("status", status)
        );
    } else if (args.platform) {
      const platform = args.platform;
      query = ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_platform_score", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("platform", platform)
        );
    } else if (args.status) {
      const status = args.status;
      query = ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_status_score", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", status)
        );
    } else {
      query = ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId));
    }

    const summaries = await applyAdditionalFilters(query, args).collect();
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

export const getProspectSummariesByProspectIdsInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    prospectIds: v.array(v.id("prospects")),
  },
  handler: async (ctx, { workspaceId, prospectIds }) => {
    const rows: Doc<"prospectSummaries">[] = [];
    for (const prospectId of prospectIds) {
      const row = await ctx.db
        .query("prospectSummaries")
        .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
        .first();
      if (row && row.workspaceId === workspaceId) {
        rows.push(row);
      }
    }
    const byId = new Map(rows.map((r) => [String(r.prospectId), r]));
    return prospectIds
      .map((id) => byId.get(String(id)))
      .filter((x): x is Doc<"prospectSummaries"> => x !== undefined);
  },
});

export const backfillProspectSummariesSearchTextPageInternal = internalMutation(
  {
    args: {
      cursor: v.optional(v.string()),
      batchSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
      const batchSize = args.batchSize ?? 100;
      const result = await ctx.db
        .query("prospects")
        .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

      let patched = 0;
      for (const prospect of result.page) {
        const summary = await ctx.db
          .query("prospectSummaries")
          .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))
          .first();
        if (summary) {
          const next = buildProspectSummaryRecord(prospect);
          await ctx.db.patch(summary._id, { searchText: next.searchText });
          patched += 1;
        }
      }

      return {
        patched,
        continueCursor: result.continueCursor,
        isDone: result.isDone,
      };
    },
  }
);

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
    prospectType: v.optional(prospectTypeValidator),
    status: v.optional(prospectStatusValidator),
    qualifiedOnly: v.optional(v.boolean()),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    createdAfterMs: v.optional(v.number()),
    createdBeforeMs: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
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
    prospectType: v.optional(prospectTypeValidator),
    status: v.optional(prospectStatusValidator),
    qualifiedOnly: v.optional(v.boolean()),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    createdAfterMs: v.optional(v.number()),
    createdBeforeMs: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
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
