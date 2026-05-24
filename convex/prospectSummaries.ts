import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, query } from "./lib/functionBuilders";
import {
  buildProspectSummaryRecord,
  isProspectActionableReady,
  isProspectSummaryActionableReady,
} from "./lib/readModelHelpers";
import {
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import {
  compareProspectRowsForSort,
  normalizeProspectListSort,
  type ProspectListSortOption,
} from "./lib/prospectListFeedUtils";
import {
  prospectListSortValidator,
  prospectPlatformValidator,
  prospectStatusValidator,
  prospectTypeValidator,
  prospectVisibilityModeValidator,
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
  sortBy?: ProspectListSortOption;
  qualifiedOnly?: boolean;
  visibilityMode?: "all" | "ready_only" | "actionable_only";
  fitScoreMin?: number;
  fitScoreMax?: number;
  createdAfterMs?: number;
  createdBeforeMs?: number;
  /** Non-empty enables Convex full-text search on `searchText` (requires `status`). */
  searchQuery?: string;
  paginationOpts: PaginationOpts;
};

const TYPE_SORT_CURSOR_PREFIX = "ptsp1:";
const CREATED_SORT_CURSOR_PREFIX = "pcsp1:";
const TYPE_SORT_SCAN_LIMIT = 3000;
const CREATED_SORT_SCAN_LIMIT = 3000;
const ACTIONABLE_FALLBACK_SCAN_LIMIT = 500;

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

function applyDateFilters<T extends { filter: (...args: any[]) => any }>(
  query: T,
  args: Pick<
    ListWorkspaceProspectSummariesArgs,
    "createdAfterMs" | "createdBeforeMs"
  >
) {
  if (args.createdAfterMs === undefined && args.createdBeforeMs === undefined) {
    return query;
  }

  return query.filter((q: any) => {
    const clauses = [];

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

function encodeTypeSortCursor(offset: number): string {
  return `${TYPE_SORT_CURSOR_PREFIX}${offset}`;
}

function decodeTypeSortCursor(cursor: string | null): number {
  if (!cursor?.startsWith(TYPE_SORT_CURSOR_PREFIX)) {
    return 0;
  }

  const value = Number(cursor.slice(TYPE_SORT_CURSOR_PREFIX.length));
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function encodeCreatedSortCursor(offset: number): string {
  return `${CREATED_SORT_CURSOR_PREFIX}${offset}`;
}

function decodeCreatedSortCursor(cursor: string | null): number {
  if (!cursor?.startsWith(CREATED_SORT_CURSOR_PREFIX)) {
    return 0;
  }

  const value = Number(cursor.slice(CREATED_SORT_CURSOR_PREFIX.length));
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function buildTypeSortedRows(
  rows: Doc<"prospectSummaries">[],
  sortBy: ProspectListSortOption
) {
  return [...rows].sort(
    (left: Doc<"prospectSummaries">, right: Doc<"prospectSummaries">) =>
      compareProspectRowsForSort(left, right, sortBy)
  );
}

function resolveVisibilityMode(
  args: Pick<
    ListWorkspaceProspectSummariesArgs,
    "qualifiedOnly" | "visibilityMode"
  >
): "all" | "ready_only" | "actionable_only" {
  if (args.visibilityMode) {
    return args.visibilityMode;
  }

  return args.qualifiedOnly ? "ready_only" : "all";
}

function matchesProspectSummaryRowFilters(
  row: Doc<"prospectSummaries">,
  args: Pick<
    ListWorkspaceProspectSummariesArgs,
    | "workspaceId"
    | "platform"
    | "prospectType"
    | "status"
    | "createdAfterMs"
    | "createdBeforeMs"
    | "qualifiedOnly"
    | "visibilityMode"
  > & {
    fitScoreMin: number;
    fitScoreMax: number;
  }
): boolean {
  if (row.workspaceId !== args.workspaceId) {
    return false;
  }
  if (args.status !== undefined && row.status !== args.status) {
    return false;
  }
  if (args.platform !== undefined && row.platform !== args.platform) {
    return false;
  }
  if (
    args.prospectType !== undefined &&
    row.prospectType !== args.prospectType
  ) {
    return false;
  }
  if (row.sortQualificationScore < args.fitScoreMin) {
    return false;
  }
  if (row.sortQualificationScore > args.fitScoreMax) {
    return false;
  }
  if (
    args.createdAfterMs !== undefined &&
    row.prospectCreatedAt < Math.round(args.createdAfterMs)
  ) {
    return false;
  }
  if (
    args.createdBeforeMs !== undefined &&
    row.prospectCreatedAt >= Math.round(args.createdBeforeMs)
  ) {
    return false;
  }
  const visibilityMode = resolveVisibilityMode(args);
  if (visibilityMode === "actionable_only") {
    return isProspectSummaryActionableReady(row);
  }
  if (visibilityMode === "ready_only") {
    return row.readyQualifiedEnriched;
  }

  return true;
}

async function resolveProspectSummaryActionableReady(
  db: SummaryDb,
  row: Doc<"prospectSummaries">
): Promise<boolean> {
  if (typeof row.actionableReady === "boolean") {
    return row.actionableReady;
  }

  if (!row.readyQualifiedEnriched) {
    return false;
  }

  const prospect = await db.get(row.prospectId);
  if (!prospect) {
    return isProspectSummaryActionableReady(row);
  }

  return isProspectActionableReady(prospect);
}

async function listWorkspaceProspectSummariesActionableFallbackPage(
  db: SummaryDb,
  args: ListWorkspaceProspectSummariesArgs
): Promise<{
  page: Doc<"prospectSummaries">[];
  isDone: boolean;
  continueCursor: string;
}> {
  const { workspaceId } = args;
  const limit = Math.max(
    args.paginationOpts.numItems * 8,
    ACTIONABLE_FALLBACK_SCAN_LIMIT
  );
  const trimmedSearch = args.searchQuery?.trim();
  const sortBy = normalizeProspectListSort(args.sortBy);
  const scoreOrder = sortBy === "lowest_fit_first" ? "asc" : "desc";
  const { fitScoreMin, fitScoreMax } = await resolveWorkspaceFitRange({
    db,
    workspaceId,
    fitScoreMin: args.fitScoreMin,
    fitScoreMax: args.fitScoreMax,
  });
  let fallbackRows: Doc<"prospectSummaries">[];

  if (trimmedSearch) {
    fallbackRows = await db
      .query("prospectSummaries")
      .withSearchIndex("search_prospect_summaries", (q) =>
        q
          .search("searchText", trimmedSearch)
          .eq("workspaceId", workspaceId)
          .eq("status", args.status!)
      )
      .filter((q) => {
        const inFit = q.and(
          q.gte(q.field("sortQualificationScore"), fitScoreMin),
          q.lte(q.field("sortQualificationScore"), fitScoreMax)
        );
        const extraClauses = [];
        if (args.prospectType !== undefined) {
          extraClauses.push(q.eq(q.field("prospectType"), args.prospectType));
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

        if (args.platform !== undefined) {
          return q.and(combinedFit, q.eq(q.field("platform"), args.platform));
        }
        return combinedFit;
      })
      .take(limit);
  } else if (args.platform && args.status) {
    fallbackRows = await applyAdditionalFilters(
      db
        .query("prospectSummaries")
        .withIndex("by_workspace_platform_status_score", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("platform", args.platform!)
            .eq("status", args.status!)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        ),
      args
    )
      .order(scoreOrder)
      .take(limit);
  } else if (args.platform) {
    fallbackRows = await applyAdditionalFilters(
      db
        .query("prospectSummaries")
        .withIndex("by_workspace_platform_score", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("platform", args.platform!)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        ),
      args
    )
      .order(scoreOrder)
      .take(limit);
  } else if (args.status) {
    fallbackRows = await applyAdditionalFilters(
      db
        .query("prospectSummaries")
        .withIndex("by_workspace_status_score", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("status", args.status!)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        ),
      args
    )
      .order(scoreOrder)
      .take(limit);
  } else {
    fallbackRows = await applyAdditionalFilters(
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
      .order(scoreOrder)
      .take(limit);
  }

  const actionablePage: Doc<"prospectSummaries">[] = [];
  for (const row of fallbackRows) {
    if (
      !matchesProspectSummaryRowFilters(row, {
        ...args,
        fitScoreMin,
        fitScoreMax,
      })
    ) {
      continue;
    }
    if (await resolveProspectSummaryActionableReady(db, row)) {
      actionablePage.push(row);
      if (actionablePage.length >= args.paginationOpts.numItems) {
        break;
      }
    }
  }

  return {
    page: actionablePage,
    isDone: true,
    continueCursor: "",
  };
}

async function listWorkspaceProspectSummariesCreatedSortVisibilityPage(
  db: SummaryDb,
  args: ListWorkspaceProspectSummariesArgs & {
    status: Doc<"prospects">["status"];
    sortBy: "newest_first" | "oldest_first";
    fitScoreMin: number;
    fitScoreMax: number;
  }
): Promise<{
  page: Doc<"prospectSummaries">[];
  isDone: boolean;
  continueCursor: string;
}> {
  const visibilityMode = resolveVisibilityMode(args);
  const createdOrder = args.sortBy === "newest_first" ? "desc" : "asc";
  const baseQuery =
    args.platform !== undefined
      ? db
          .query("prospectSummaries")
          .withIndex("by_workspace_platform_status_created", (q) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("platform", args.platform!)
              .eq("status", args.status)
          )
      : db
          .query("prospectSummaries")
          .withIndex("by_workspace_status_created", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("status", args.status)
          );

  const scan = await applyAdditionalFilters(baseQuery, args)
    .filter((q: any) =>
      q.and(
        q.gte(q.field("sortQualificationScore"), args.fitScoreMin),
        q.lte(q.field("sortQualificationScore"), args.fitScoreMax)
      )
    )
    .order(createdOrder)
    .take(CREATED_SORT_SCAN_LIMIT);

  const visibleRows: Doc<"prospectSummaries">[] = [];
  for (const row of scan) {
    if (visibilityMode === "actionable_only") {
      if (await resolveProspectSummaryActionableReady(db, row)) {
        visibleRows.push(row);
      }
      continue;
    }

    if (row.readyQualifiedEnriched) {
      visibleRows.push(row);
    }
  }

  const start = decodeCreatedSortCursor(args.paginationOpts.cursor);
  const end = start + args.paginationOpts.numItems;
  const page = visibleRows.slice(start, end);
  const scanHitCap = scan.length === CREATED_SORT_SCAN_LIMIT;
  const isDone = end >= visibleRows.length && !scanHitCap;

  return {
    page,
    isDone,
    continueCursor:
      !isDone && page.length > 0 ? encodeCreatedSortCursor(end) : "",
  };
}

async function listWorkspaceProspectSummariesTypeSortPage(
  db: SummaryDb,
  args: ListWorkspaceProspectSummariesArgs & {
    status: Doc<"prospects">["status"];
    sortBy: ProspectListSortOption;
    fitScoreMin: number;
    fitScoreMax: number;
  }
): Promise<{
  page: Doc<"prospectSummaries">[];
  isDone: boolean;
  continueCursor: string;
}> {
  const visibilityMode = resolveVisibilityMode(args);

  if (args.prospectType !== undefined || visibilityMode === "actionable_only") {
    return await listWorkspaceProspectSummariesPage(db, {
      ...args,
      sortBy: "best_fit_first",
    });
  }

  const baseQuery =
    args.platform !== undefined
      ? visibilityMode === "ready_only"
        ? db
            .query("prospectSummaries")
            .withIndex("by_workspace_platform_status_ready_score", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("platform", args.platform!)
                .eq("status", args.status)
                .eq("readyQualifiedEnriched", true)
                .gte("sortQualificationScore", args.fitScoreMin)
                .lte("sortQualificationScore", args.fitScoreMax)
            )
        : db
            .query("prospectSummaries")
            .withIndex("by_workspace_platform_status_score", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("platform", args.platform!)
                .eq("status", args.status)
                .gte("sortQualificationScore", args.fitScoreMin)
                .lte("sortQualificationScore", args.fitScoreMax)
            )
      : visibilityMode === "ready_only"
        ? db
            .query("prospectSummaries")
            .withIndex("by_workspace_status_ready_score", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("status", args.status)
                .eq("readyQualifiedEnriched", true)
                .gte("sortQualificationScore", args.fitScoreMin)
                .lte("sortQualificationScore", args.fitScoreMax)
            )
        : db
            .query("prospectSummaries")
            .withIndex("by_workspace_status_score", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("status", args.status)
                .gte("sortQualificationScore", args.fitScoreMin)
                .lte("sortQualificationScore", args.fitScoreMax)
            );

  const scan = await applyDateFilters(baseQuery, args)
    .order("desc")
    .take(TYPE_SORT_SCAN_LIMIT);
  const orderedRows = buildTypeSortedRows(scan, args.sortBy);
  const start = decodeTypeSortCursor(args.paginationOpts.cursor);
  const end = start + args.paginationOpts.numItems;
  const page = orderedRows.slice(start, end);
  const scanHitCap = scan.length === TYPE_SORT_SCAN_LIMIT;
  const isDone = end >= orderedRows.length && !scanHitCap;

  return {
    page,
    isDone,
    continueCursor: !isDone && page.length > 0 ? encodeTypeSortCursor(end) : "",
  };
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

async function getProspectSummariesByProspectIds(
  db: SummaryDb,
  args: {
    workspaceId: Id<"workspaces">;
    prospectIds: Id<"prospects">[];
  }
) {
  const rows: Doc<"prospectSummaries">[] = [];
  for (const prospectId of args.prospectIds) {
    const row = await db
      .query("prospectSummaries")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .first();
    if (row && row.workspaceId === args.workspaceId) {
      rows.push(row);
    }
  }

  const byId = new Map(rows.map((row) => [String(row.prospectId), row]));
  return args.prospectIds
    .map((prospectId) => byId.get(String(prospectId)))
    .filter((row): row is Doc<"prospectSummaries"> => row !== undefined);
}

/**
 * Full-text search path: relevance order, then filters for fit / platform / visibility.
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
  const visibilityMode = resolveVisibilityMode(args);
  const readyOnly = visibilityMode === "ready_only";
  const actionableOnly = visibilityMode === "actionable_only";

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

      if (actionableOnly && platform !== undefined) {
        return q.and(
          combinedFit,
          q.eq(q.field("actionableReady"), true),
          q.eq(q.field("platform"), platform)
        );
      }
      if (actionableOnly) {
        return q.and(combinedFit, q.eq(q.field("actionableReady"), true));
      }
      if (readyOnly && platform !== undefined) {
        return q.and(
          combinedFit,
          q.eq(q.field("readyQualifiedEnriched"), true),
          q.eq(q.field("platform"), platform)
        );
      }
      if (readyOnly) {
        return q.and(
          combinedFit,
          q.eq(q.field("readyQualifiedEnriched"), true)
        );
      }
      if (platform !== undefined) {
        return q.and(combinedFit, q.eq(q.field("platform"), platform));
      }
      return combinedFit;
    });

  const result = await query.paginate(paginationOpts);
  if (
    actionableOnly &&
    paginationOpts.cursor === null &&
    result.page.length === 0
  ) {
    return await listWorkspaceProspectSummariesActionableFallbackPage(db, args);
  }

  return result;
}

export async function listWorkspaceProspectSummariesPage(
  db: SummaryDb,
  args: ListWorkspaceProspectSummariesArgs
): Promise<{
  page: Doc<"prospectSummaries">[];
  isDone: boolean;
  continueCursor: string;
}> {
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
  const sortBy = normalizeProspectListSort(args.sortBy);
  const visibilityMode = resolveVisibilityMode(args);
  const readyOnly = visibilityMode === "ready_only";
  const actionableOnly = visibilityMode === "actionable_only";
  const { fitScoreMin, fitScoreMax } = await resolveWorkspaceFitRange({
    db,
    workspaceId,
    fitScoreMin: args.fitScoreMin,
    fitScoreMax: args.fitScoreMax,
  });
  const scoreOrder = sortBy === "lowest_fit_first" ? "asc" : "desc";

  if (
    (sortBy === "individuals_first" || sortBy === "organizations_first") &&
    status
  ) {
    return await listWorkspaceProspectSummariesTypeSortPage(db, {
      ...args,
      status,
      sortBy,
      fitScoreMin,
      fitScoreMax,
    });
  }

  if ((sortBy === "newest_first" || sortBy === "oldest_first") && status) {
    if (visibilityMode !== "all") {
      return await listWorkspaceProspectSummariesCreatedSortVisibilityPage(db, {
        ...args,
        status,
        sortBy,
        fitScoreMin,
        fitScoreMax,
      });
    }

    const createdOrder = sortBy === "newest_first" ? "desc" : "asc";

    if (platform) {
      return await applyAdditionalFilters(
        db
          .query("prospectSummaries")
          .withIndex("by_workspace_platform_status_created", (q) =>
            q
              .eq("workspaceId", workspaceId)
              .eq("platform", platform)
              .eq("status", status)
          ),
        args
      )
        .filter((q: any) =>
          q.and(
            q.gte(q.field("sortQualificationScore"), fitScoreMin),
            q.lte(q.field("sortQualificationScore"), fitScoreMax)
          )
        )
        .order(createdOrder)
        .paginate(paginationOpts);
    }

    return await applyAdditionalFilters(
      db
        .query("prospectSummaries")
        .withIndex("by_workspace_status_created", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", status)
        ),
      args
    )
      .filter((q: any) =>
        q.and(
          q.gte(q.field("sortQualificationScore"), fitScoreMin),
          q.lte(q.field("sortQualificationScore"), fitScoreMax)
        )
      )
      .order(createdOrder)
      .paginate(paginationOpts);
  }

  if (platform && status && actionableOnly) {
    const result = await applyAdditionalFilters(
      db
        .query("prospectSummaries")
        .withIndex("by_workspace_platform_status_actionable_score", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("platform", platform)
            .eq("status", status)
            .eq("actionableReady", true)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        ),
      args
    )
      .order(scoreOrder)
      .paginate(paginationOpts);
    if (paginationOpts.cursor === null && result.page.length === 0) {
      return await listWorkspaceProspectSummariesActionableFallbackPage(
        db,
        args
      );
    }
    return result;
  }

  if (platform && status && readyOnly) {
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
        ),
      args
    )
      .order(scoreOrder)
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
        ),
      args
    )
      .order(scoreOrder)
      .paginate(paginationOpts);
  }

  if (platform && actionableOnly) {
    const result = await applyAdditionalFilters(
      db
        .query("prospectSummaries")
        .withIndex("by_workspace_platform_actionable_score", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("platform", platform)
            .eq("actionableReady", true)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        ),
      args
    )
      .order(scoreOrder)
      .paginate(paginationOpts);
    if (paginationOpts.cursor === null && result.page.length === 0) {
      return await listWorkspaceProspectSummariesActionableFallbackPage(
        db,
        args
      );
    }
    return result;
  }

  if (platform && readyOnly) {
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
        ),
      args
    )
      .order(scoreOrder)
      .paginate(paginationOpts);
  }

  if (status && actionableOnly) {
    const result = await applyAdditionalFilters(
      db
        .query("prospectSummaries")
        .withIndex("by_workspace_status_actionable_score", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("status", status)
            .eq("actionableReady", true)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        ),
      args
    )
      .order(scoreOrder)
      .paginate(paginationOpts);
    if (paginationOpts.cursor === null && result.page.length === 0) {
      return await listWorkspaceProspectSummariesActionableFallbackPage(
        db,
        args
      );
    }
    return result;
  }

  if (status && readyOnly) {
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
        ),
      args
    )
      .order(scoreOrder)
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
        ),
      args
    )
      .order(scoreOrder)
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
        ),
      args
    )
      .order(scoreOrder)
      .paginate(paginationOpts);
  }

  if (actionableOnly) {
    const result = await applyAdditionalFilters(
      db
        .query("prospectSummaries")
        .withIndex("by_workspace_actionable_score", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("actionableReady", true)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        ),
      args
    )
      .order("desc")
      .paginate(paginationOpts);
    if (paginationOpts.cursor === null && result.page.length === 0) {
      return await listWorkspaceProspectSummariesActionableFallbackPage(
        db,
        args
      );
    }
    return result;
  }

  if (readyOnly) {
    return await applyAdditionalFilters(
      db
        .query("prospectSummaries")
        .withIndex("by_workspace_ready_score", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("readyQualifiedEnriched", true)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        ),
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
    .order(scoreOrder)
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
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", args.workspaceId)
        );
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
  handler: async (ctx, args) =>
    await getProspectSummariesByProspectIds(ctx.db, args),
});

export const getFilteredProspectSummariesByProspectIdsInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    prospectIds: v.array(v.id("prospects")),
    platform: v.optional(prospectPlatformValidator),
    prospectType: v.optional(prospectTypeValidator),
    status: v.optional(prospectStatusValidator),
    qualifiedOnly: v.optional(v.boolean()),
    visibilityMode: v.optional(prospectVisibilityModeValidator),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    createdAfterMs: v.optional(v.number()),
    createdBeforeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await getProspectSummariesByProspectIds(ctx.db, {
      workspaceId: args.workspaceId,
      prospectIds: args.prospectIds,
    });
    const { fitScoreMin, fitScoreMax } = await resolveWorkspaceFitRange({
      db: ctx.db,
      workspaceId: args.workspaceId,
      fitScoreMin: args.fitScoreMin,
      fitScoreMax: args.fitScoreMax,
    });
    const filteredRows: Doc<"prospectSummaries">[] = [];
    for (const row of rows) {
      if (
        !matchesProspectSummaryRowFilters(row, {
          ...args,
          fitScoreMin,
          fitScoreMax,
        })
      ) {
        continue;
      }
      if (
        resolveVisibilityMode(args) === "actionable_only" &&
        !(await resolveProspectSummaryActionableReady(ctx.db, row))
      ) {
        continue;
      }
      filteredRows.push(row);
    }

    return filteredRows;
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
    sortBy: v.optional(prospectListSortValidator),
    qualifiedOnly: v.optional(v.boolean()),
    visibilityMode: v.optional(prospectVisibilityModeValidator),
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
    sortBy: v.optional(prospectListSortValidator),
    qualifiedOnly: v.optional(v.boolean()),
    visibilityMode: v.optional(prospectVisibilityModeValidator),
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
