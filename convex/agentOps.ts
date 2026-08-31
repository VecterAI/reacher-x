import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { action, internalQuery, query } from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import {
  requireOwnedWorkspace,
  requireUser,
  getOwnedWorkspace,
  getUserByIdentity,
} from "./lib/accessHelpers";
import {
  agentOpsMemorySortValidator,
  agentOpsTabValidator,
  analyticsDateRangeValidator,
  queryCandidateStatusValidator,
} from "./validators";
import {
  createTrendBucketSet,
  normalizeAnalyticsWindow,
  sumHourlyFieldInWindow,
  type TimeWindow,
} from "./lib/analyticsCore";
import { listWorkspaceAnalyticsDailyRows } from "./workspaceAnalyticsDaily";
import { listWorkspaceAgentOpsDailyRows } from "./workspaceAgentOpsDaily";
import {
  buildAgentOpsQueryInventory,
  buildAgentOpsDashboardData,
  buildAgentOpsMemoryInventoryPage,
  matchesAgentOpsMemoryInventoryFilters,
} from "./lib/agentOpsCore";
import {
  decodeAgentOpsMemoryInventoryCursor,
  encodeAgentOpsMemoryInventoryCursor,
} from "./lib/agentOpsInventoryCursor";
import {
  type WorkspaceAgentMemoryInventoryRecord,
  WORKSPACE_MEMORY_CATEGORIES,
  getWorkspaceAgentMemoryById,
  listWorkspaceAgentMemoryInventoryInWindow,
} from "./lib/agentMemoryCore";
import { getUtcDayStartTimestamp } from "./lib/readModelHelpers";
import {
  mapDashboardChunksSequentially,
  splitDashboardDayRange,
} from "./lib/dashboardReadCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { buildQueryCandidateCanonicalRecord } from "./lib/memoryHelpers";
import {
  getWorkspaceAgentOpsAggregateRows,
  getWorkspaceAnalyticsAggregateRows,
} from "./lib/workspaceReportingAggregate";
import { isWorkspaceReportingAggregateReady } from "./lib/workspaceReportingRollout";

const AGENT_OPS_ACTIVITY_MEMORY_LIMIT = 80;
const AGENT_OPS_MEMORY_PAGE_SIZE_MAX = 100;
const AGENT_OPS_MEMORY_SCAN_BATCH_SIZE = 250;
const AGENT_OPS_MEMORY_CURSOR_SCAN_LIMIT = 5_000;
const AGENT_OPS_MEMORY_EXPORT_PAGE_SIZE_MAX = 500;
const UTC_DAY_MS = 24 * 60 * 60 * 1000;

async function requireOwnedWorkspaceContext(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
) {
  const user = await requireUser(ctx, { notFoundMessage: "User not found" });
  const workspace = await requireOwnedWorkspace(ctx, workspaceId, {
    user,
    notFoundMessage: "Workspace not found",
    notAuthorizedMessage: "Workspace not found",
  });
  return { user, workspace };
}

function getWindowDayRange(window: TimeWindow) {
  const clampedEndMs = Math.max(window.startMs, window.endMs - 1);
  return {
    startDayStartUtcMs: getUtcDayStartTimestamp(window.startMs),
    endDayStartUtcMs: getUtcDayStartTimestamp(clampedEndMs),
  };
}

function listWindowDayStarts(window: TimeWindow) {
  const { startDayStartUtcMs, endDayStartUtcMs } = getWindowDayRange(window);
  const dayStarts: number[] = [];

  for (
    let dayStartUtcMs = startDayStartUtcMs;
    dayStartUtcMs <= endDayStartUtcMs;
    dayStartUtcMs += UTC_DAY_MS
  ) {
    dayStarts.push(dayStartUtcMs);
  }

  return dayStarts;
}

type MemoryInventoryChunkResult = {
  page: WorkspaceAgentMemoryInventoryRecord[];
  continueCursor: string;
  isDone: boolean;
};

function compareMemoryInventoryRows(
  left: WorkspaceAgentMemoryInventoryRecord,
  right: WorkspaceAgentMemoryInventoryRecord,
  sort: "impact_desc" | "confidence_desc" | "recent_desc"
) {
  if (sort === "impact_desc") {
    if (right.impactScore !== left.impactScore) {
      return right.impactScore - left.impactScore;
    }
    return right.createdAt - left.createdAt;
  }

  if (sort === "confidence_desc") {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return right.createdAt - left.createdAt;
  }

  return right.createdAt - left.createdAt;
}

type DiscoveryInventoryRow = ReturnType<
  typeof buildAgentOpsQueryInventory
>[number];

function compareDiscoveryInventoryRows(
  left: DiscoveryInventoryRow,
  right: DiscoveryInventoryRow,
  sort: "updated_desc" | "novelty_desc" | "performance_desc"
) {
  if (sort === "novelty_desc") {
    return (
      (right.noveltyScore ?? -1) - (left.noveltyScore ?? -1) ||
      right.updatedAt - left.updatedAt
    );
  }
  if (sort === "performance_desc") {
    return (
      (right.performanceScore ?? -1) - (left.performanceScore ?? -1) ||
      right.updatedAt - left.updatedAt
    );
  }
  return right.updatedAt - left.updatedAt;
}

async function loadMemoryInventoryChunk(
  ctx: Pick<ActionCtx, "runQuery">,
  args: {
    workspaceId: Id<"workspaces">;
    window: TimeWindow;
    sort: "impact_desc" | "confidence_desc" | "recent_desc";
    cursor: string | null;
    limit: number;
  }
): Promise<MemoryInventoryChunkResult> {
  const paginationOpts = {
    cursor: args.cursor,
    numItems: args.limit,
  };
  const result: MemoryInventoryChunkResult =
    args.sort === "impact_desc"
      ? await ctx.runQuery(
          internal.agentOpsReadModels
            .listWorkspaceAgentMemoryInventoryImpactPageInternal,
          { workspaceId: args.workspaceId, paginationOpts }
        )
      : args.sort === "confidence_desc"
        ? await ctx.runQuery(
            internal.agentOpsReadModels
              .listWorkspaceAgentMemoryInventoryConfidencePageInternal,
            { workspaceId: args.workspaceId, paginationOpts }
          )
        : await ctx.runQuery(
            internal.agentOpsReadModels
              .listWorkspaceAgentMemoryInventoryRecentPageInternal,
            {
              workspaceId: args.workspaceId,
              startMs: args.window.startMs,
              endMs: args.window.endMs,
              paginationOpts,
            }
          );
  return result;
}

function buildMemoryInventoryCursorScopeKey(args: {
  workspaceId: Id<"workspaces">;
  range: string;
  from?: number;
  to?: number;
  fromDate?: string;
  toDate?: string;
  sort: "impact_desc" | "confidence_desc" | "recent_desc";
  search?: string;
  category?: string;
}) {
  return JSON.stringify([
    String(args.workspaceId),
    args.range,
    args.from ?? null,
    args.to ?? null,
    args.fromDate ?? null,
    args.toDate ?? null,
    args.sort,
    args.search?.trim().toLowerCase() ?? "",
    args.category ?? "all",
  ]);
}

async function loadCursorMemoryInventoryPage(
  ctx: Pick<ActionCtx, "runQuery">,
  args: {
    workspaceId: Id<"workspaces">;
    window: TimeWindow;
    sort: "impact_desc" | "confidence_desc" | "recent_desc";
    search?: string;
    category?: string;
    cursor?: string;
    pageSize: number;
    scopeKey: string;
  }
) {
  const state = decodeAgentOpsMemoryInventoryCursor(
    args.cursor,
    args.scopeKey,
    args.window
  );
  const snapshotWindow = {
    startMs: state.windowStartMs,
    endMs: state.windowEndMs,
  };
  const matches: WorkspaceAgentMemoryInventoryRecord[] = [];
  let scanned = 0;

  if (state.bufferedMemoryIds.length > 0) {
    const bufferedRows: WorkspaceAgentMemoryInventoryRecord[] =
      await ctx.runQuery(
        internal.agentOpsReadModels
          .getWorkspaceAgentMemoryInventoryRowsInternal,
        {
          workspaceId: args.workspaceId,
          memoryIds: state.bufferedMemoryIds,
        }
      );
    matches.push(
      ...bufferedRows.filter(
        (row) =>
          row.createdAt >= snapshotWindow.startMs &&
          row.createdAt < snapshotWindow.endMs &&
          matchesAgentOpsMemoryInventoryFilters(row, {
            search: args.search,
            category: args.category,
          })
      )
    );
    state.bufferedMemoryIds = [];
  }

  while (
    matches.length < args.pageSize &&
    !state.sourceDone &&
    scanned < AGENT_OPS_MEMORY_CURSOR_SCAN_LIMIT
  ) {
    const chunk = await loadMemoryInventoryChunk(ctx, {
      workspaceId: args.workspaceId,
      window: snapshotWindow,
      sort: args.sort,
      cursor: state.sourceCursor,
      limit: Math.min(
        AGENT_OPS_MEMORY_SCAN_BATCH_SIZE,
        Math.max(50, args.pageSize - matches.length)
      ),
    });
    state.sourceCursor = chunk.continueCursor;
    state.sourceDone = chunk.isDone;
    scanned += chunk.page.length;
    matches.push(
      ...chunk.page.filter(
        (row) =>
          row.createdAt >= snapshotWindow.startMs &&
          row.createdAt < snapshotWindow.endMs &&
          matchesAgentOpsMemoryInventoryFilters(row, {
            search: args.search,
            category: args.category,
          })
      )
    );
  }

  const pageRows = matches.slice(0, args.pageSize);
  state.bufferedMemoryIds = matches
    .slice(args.pageSize)
    .map((row) => row.memoryId);
  const continueCursor = encodeAgentOpsMemoryInventoryCursor(state);

  return {
    rows: pageRows,
    continueCursor,
    isDone: continueCursor === null,
    scanned,
    window: snapshotWindow,
  };
}

async function scanWindowMemoryInventoryMatches(
  ctx: Pick<ActionCtx, "runQuery">,
  args: {
    workspaceId: Id<"workspaces">;
    window: TimeWindow;
    sort: "impact_desc" | "confidence_desc" | "recent_desc";
    search?: string;
    category?: string;
    matchLimit: number | null;
  }
) {
  const rows: WorkspaceAgentMemoryInventoryRecord[] = [];
  let totalMatchedCount = 0;
  let cursor: string | null = null;

  while (true) {
    const chunk = await loadMemoryInventoryChunk(ctx, {
      workspaceId: args.workspaceId,
      window: args.window,
      sort: "recent_desc",
      cursor,
      limit: AGENT_OPS_MEMORY_SCAN_BATCH_SIZE,
    });

    for (const row of chunk.page) {
      if (
        !matchesAgentOpsMemoryInventoryFilters(row, {
          search: args.search,
          category: args.category,
        })
      ) {
        continue;
      }

      totalMatchedCount += 1;
      rows.push(row);
      if (
        args.matchLimit !== null &&
        rows.length >= Math.max(args.matchLimit * 2, args.matchLimit + 100)
      ) {
        rows.sort((left, right) =>
          compareMemoryInventoryRows(left, right, args.sort)
        );
        rows.length = args.matchLimit;
      }
    }

    if (chunk.isDone) {
      break;
    }

    cursor = chunk.continueCursor;
  }

  rows.sort((left, right) =>
    compareMemoryInventoryRows(left, right, args.sort)
  );

  const matches =
    args.matchLimit === null ? rows : rows.slice(0, args.matchLimit);

  return {
    matches,
    totalMatchedCount,
    reachedEnd: true,
  };
}

async function loadTopWindowMemoryInventoryMatches(
  ctx: Pick<ActionCtx, "runQuery">,
  args: {
    workspaceId: Id<"workspaces">;
    window: TimeWindow;
    sort: "impact_desc" | "confidence_desc";
    matchLimit: number;
  }
) {
  const dayStarts = listWindowDayStarts(args.window);
  let perDayLimit = Math.min(
    AGENT_OPS_MEMORY_SCAN_BATCH_SIZE,
    Math.max(25, args.matchLimit * 4)
  );

  while (true) {
    const dayResults: MemoryInventoryChunkResult[] = await Promise.all(
      dayStarts.map((dayStartUtcMs) =>
        ctx.runQuery(
          args.sort === "impact_desc"
            ? internal.agentOpsReadModels
                .listWorkspaceAgentMemoryInventoryDayImpactPageInternal
            : internal.agentOpsReadModels
                .listWorkspaceAgentMemoryInventoryDayConfidencePageInternal,
          {
            workspaceId: args.workspaceId,
            dayStartUtcMs,
            paginationOpts: {
              cursor: null,
              numItems: perDayLimit,
            },
          }
        )
      )
    );

    const rows = dayResults
      .flatMap((result) => result.page)
      .filter(
        (row) =>
          row.createdAt >= args.window.startMs &&
          row.createdAt < args.window.endMs
      )
      .sort((left, right) =>
        compareMemoryInventoryRows(left, right, args.sort)
      );
    const isExhausted = dayResults.every(
      (result) => result.isDone || result.page.length < perDayLimit
    );

    if (rows.length >= args.matchLimit || isExhausted) {
      return {
        matches: rows.slice(0, args.matchLimit),
        totalMatchedCount: rows.length,
        reachedEnd: isExhausted,
      };
    }

    if (perDayLimit >= AGENT_OPS_MEMORY_SCAN_BATCH_SIZE) {
      return {
        matches: rows.slice(0, args.matchLimit),
        totalMatchedCount: rows.length,
        reachedEnd: false,
      };
    }

    perDayLimit = Math.min(AGENT_OPS_MEMORY_SCAN_BATCH_SIZE, perDayLimit * 2);
  }
}

async function scanMemoryInventoryMatches(
  ctx: Pick<ActionCtx, "runQuery">,
  args: {
    workspaceId: Id<"workspaces">;
    window: TimeWindow;
    sort: "impact_desc" | "confidence_desc" | "recent_desc";
    search?: string;
    category?: string;
    matchLimit: number | null;
  }
): Promise<{
  matches: WorkspaceAgentMemoryInventoryRecord[];
  totalMatchedCount: number;
  reachedEnd: boolean;
}> {
  if (args.sort !== "recent_desc") {
    return await scanWindowMemoryInventoryMatches(ctx, args);
  }

  const matches: WorkspaceAgentMemoryInventoryRecord[] = [];
  let totalMatchedCount = 0;
  let cursor: string | null = null;

  while (true) {
    const chunk = await loadMemoryInventoryChunk(ctx, {
      workspaceId: args.workspaceId,
      window: args.window,
      sort: args.sort,
      cursor,
      limit: AGENT_OPS_MEMORY_SCAN_BATCH_SIZE,
    });

    for (const row of chunk.page) {
      if (
        !matchesAgentOpsMemoryInventoryFilters(row, {
          search: args.search,
          category: args.category,
        })
      ) {
        continue;
      }

      totalMatchedCount += 1;

      if (args.matchLimit === null || matches.length < args.matchLimit) {
        matches.push(row);
      }
    }

    if (chunk.isDone) {
      return {
        matches,
        totalMatchedCount,
        reachedEnd: true,
      };
    }

    if (args.matchLimit !== null && totalMatchedCount >= args.matchLimit) {
      return {
        matches,
        totalMatchedCount,
        reachedEnd: false,
      };
    }

    cursor = chunk.continueCursor;
  }
}

async function getUnfilteredMemoryInventoryCount(
  db: QueryCtx["db"],
  args: {
    workspaceId: Id<"workspaces">;
    window: TimeWindow;
  }
) {
  const dayRange = getWindowDayRange(args.window);
  const agentOpsRows = await listWorkspaceAgentOpsDailyRows({
    db,
    workspaceId: args.workspaceId,
    startDayStartUtcMs: dayRange.startDayStartUtcMs,
    endDayStartUtcMs: dayRange.endDayStartUtcMs,
  });

  return sumHourlyFieldInWindow(
    agentOpsRows,
    "hourlyMemoriesWrittenCounts",
    args.window
  );
}

export const getAgentOpsSnapshotContextInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnedWorkspaceContext(
      ctx,
      args.workspaceId
    );
    return { reportingTimeZone: workspace.reportingTimeZone ?? null };
  },
});

export const getAgentOpsActivitySnapshotInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    const workflowEventsPromise = ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_workspace_occurred_at", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .gte("occurredAt", args.startMs)
          .lt("occurredAt", args.endMs)
      )
      .order("desc")
      .take(80);
    const evaluatorRunsPromise = ctx.db
      .query("memoryEvaluatorRuns")
      .withIndex("by_workspace_updated_at", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .gte("updatedAt", args.startMs)
          .lt("updatedAt", args.endMs)
      )
      .order("desc")
      .take(80);
    const suggestionPromises = (
      ["pending_review", "promoted", "rejected"] as const
    ).map((status) =>
      ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("status", status)
            .gte("updatedAt", args.startMs)
            .lt("updatedAt", args.endMs)
        )
        .order("desc")
        .take(20)
    );
    const memoryInventoryRowsPromise =
      listWorkspaceAgentMemoryInventoryInWindow(ctx.db, {
        workspaceId: args.workspaceId,
        startMs: args.startMs,
        endMs: args.endMs,
        limit: AGENT_OPS_ACTIVITY_MEMORY_LIMIT,
      });
    const [
      workflowEvents,
      evaluatorRuns,
      suggestionResults,
      memoryInventoryRows,
    ] = await Promise.all([
      workflowEventsPromise,
      evaluatorRunsPromise,
      Promise.all(suggestionPromises),
      memoryInventoryRowsPromise,
    ]);
    const [suggestionPending, suggestionPromoted, suggestionRejected] =
      suggestionResults;

    return {
      workflowEvents,
      evaluatorRuns,
      memorySuggestions: [
        ...suggestionPending,
        ...suggestionPromoted,
        ...suggestionRejected,
      ].sort((left, right) => right.updatedAt - left.updatedAt),
      memoryInventoryRows,
    };
  },
});

export const getAgentOpsDashboardSnapshot = action({
  args: {
    workspaceId: v.id("workspaces"),
    range: analyticsDateRangeValidator,
    tab: v.optional(agentOpsTabValidator),
    timeZone: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<ReturnType<typeof buildAgentOpsDashboardData>> => {
    const context = await ctx.runQuery(
      internal.agentOps.getAgentOpsSnapshotContextInternal,
      { workspaceId: args.workspaceId }
    );
    const normalizedWindow = normalizeAnalyticsWindow({
      ...args,
      timeZone: context.reportingTimeZone ?? args.timeZone,
      nowMs: getCurrentUTCTimestamp(),
    });
    const currentDayRange = getWindowDayRange(normalizedWindow.current);
    const previousDayRange = getWindowDayRange(normalizedWindow.previous);
    const chunks = splitDashboardDayRange({
      startDayStartUtcMs: Math.min(
        currentDayRange.startDayStartUtcMs,
        previousDayRange.startDayStartUtcMs
      ),
      endDayStartUtcMs: Math.max(
        currentDayRange.endDayStartUtcMs,
        previousDayRange.endDayStartUtcMs
      ),
    });
    const analyticsRows: Awaited<
      ReturnType<typeof listWorkspaceAnalyticsDailyRows>
    > = [];
    const agentOpsRows: Awaited<
      ReturnType<typeof listWorkspaceAgentOpsDailyRows>
    > = [];

    const rowChunks = await mapDashboardChunksSequentially({
      chunks,
      load: async (chunk) =>
        await Promise.all([
          ctx.runQuery(
            internal.workspaceAnalyticsDaily
              .listWorkspaceAnalyticsDailyInternal,
            { workspaceId: args.workspaceId, ...chunk }
          ),
          ctx.runQuery(
            internal.workspaceAgentOpsDaily.listWorkspaceAgentOpsDailyInternal,
            { workspaceId: args.workspaceId, ...chunk }
          ),
        ]),
    });
    for (const [analyticsChunk, agentOpsChunk] of rowChunks) {
      analyticsRows.push(...analyticsChunk);
      agentOpsRows.push(...agentOpsChunk);
    }

    const activity: {
      workflowEvents: Doc<"memoryWorkflowEvents">[];
      evaluatorRuns: Doc<"memoryEvaluatorRuns">[];
      memorySuggestions: Doc<"memorySuggestions">[];
      memoryInventoryRows: WorkspaceAgentMemoryInventoryRecord[];
    } | null =
      (args.tab ?? "overview") === "activity"
        ? await ctx.runQuery(
            internal.agentOps.getAgentOpsActivitySnapshotInternal,
            {
              workspaceId: args.workspaceId,
              startMs: normalizedWindow.current.startMs,
              endMs: normalizedWindow.current.endMs,
            }
          )
        : null;

    return buildAgentOpsDashboardData({
      bucketSet: createTrendBucketSet(normalizedWindow),
      currentWindow: normalizedWindow.current,
      previousWindow: normalizedWindow.previous,
      analyticsRows,
      agentOpsRows,
      workflowEvents: activity?.workflowEvents,
      evaluatorRuns: activity?.evaluatorRuns,
      memorySuggestions: activity?.memorySuggestions,
      memoryInventoryRows: activity?.memoryInventoryRows,
    });
  },
});

export const listWorkspaceQueryCandidatesWindowPageInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    startMs: v.number(),
    endMs: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("queryCandidates")
      .withIndex("by_workspace_updated_at", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .gte("updatedAt", args.startMs)
          .lt("updatedAt", args.endMs)
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: 300,
        maximumBytesRead: 2_000_000,
      });
  },
});

export const getAgentOpsDiscoveryInventoryPageSnapshot = action({
  args: {
    workspaceId: v.id("workspaces"),
    range: analyticsDateRangeValidator,
    timeZone: v.optional(v.string()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    search: v.optional(v.string()),
    status: v.optional(queryCandidateStatusValidator),
    sort: v.optional(
      v.union(
        v.literal("updated_desc"),
        v.literal("novelty_desc"),
        v.literal("performance_desc")
      )
    ),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    rows: ReturnType<typeof buildAgentOpsQueryInventory>;
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }> => {
    const context = await ctx.runQuery(
      internal.agentOps.getAgentOpsSnapshotContextInternal,
      { workspaceId: args.workspaceId }
    );
    const window = normalizeAnalyticsWindow({
      ...args,
      timeZone: context.reportingTimeZone ?? args.timeZone,
      nowMs: getCurrentUTCTimestamp(),
    }).current;
    const dayRange = getWindowDayRange(window);
    const performanceRows: Doc<"workspaceQueryPerformanceDaily">[] = [];
    performanceRows.push(
      ...(
        await mapDashboardChunksSequentially({
          chunks: splitDashboardDayRange(dayRange),
          load: async (chunk) =>
            await ctx.runQuery(
              internal.workspaceQueryPerformanceDaily
                .listWorkspaceQueryPerformanceDailyInternal,
              { workspaceId: args.workspaceId, ...chunk }
            ),
        })
      ).flat()
    );
    const needle = args.search?.trim().toLowerCase() ?? "";
    const status = args.status ?? null;
    const sort = args.sort ?? "updated_desc";
    const pageSize = Math.min(
      500,
      Math.max(1, Math.floor(args.pageSize ?? 10))
    );
    const requestedPage = Math.min(
      10_000,
      Math.max(0, Math.floor(args.page ?? 0))
    );
    const matchLimit = (requestedPage + 1) * pageSize;
    const rows: DiscoveryInventoryRow[] = [];
    let totalCount = 0;
    let cursor: string | null = null;
    while (true) {
      const result: {
        page: Doc<"queryCandidates">[];
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.agentOps.listWorkspaceQueryCandidatesWindowPageInternal,
        {
          workspaceId: args.workspaceId,
          startMs: window.startMs,
          endMs: window.endMs,
          paginationOpts: { cursor, numItems: 250 },
        }
      );
      const pageMatches = buildAgentOpsQueryInventory({
        queryCandidates: result.page,
        queryPerformanceDailyRows: performanceRows,
        window,
      }).filter(
        (row) =>
          (!status || row.status === status) &&
          (!needle ||
            row.rawValue.toLowerCase().includes(needle) ||
            row.canonicalValue.toLowerCase().includes(needle) ||
            (row.sourceTheme ?? "").toLowerCase().includes(needle))
      );
      totalCount += pageMatches.length;
      rows.push(...pageMatches);
      if (rows.length >= Math.max(matchLimit * 2, matchLimit + 250)) {
        rows.sort((left, right) =>
          compareDiscoveryInventoryRows(left, right, sort)
        );
        rows.length = matchLimit;
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    rows.sort((left, right) =>
      compareDiscoveryInventoryRows(left, right, sort)
    );
    rows.length = Math.min(rows.length, matchLimit);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(totalPages - 1, requestedPage);
    return {
      rows: rows.slice(page * pageSize, (page + 1) * pageSize),
      page,
      pageSize,
      totalCount,
      totalPages,
    };
  },
});

export const getAgentOpsMemoryInventoryPageSnapshot = action({
  args: {
    workspaceId: v.id("workspaces"),
    range: analyticsDateRangeValidator,
    timeZone: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    sort: v.optional(agentOpsMemorySortValidator),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
    exportMode: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    rows: ReturnType<typeof buildAgentOpsMemoryInventoryPage>["rows"];
    page: number;
    totalCount: number | null;
    totalPages: number;
    availableCategories: string[];
    continueCursor: string | null;
    isDone: boolean;
    scanned: number;
  }> => {
    const context: { reportingTimeZone: string | null } = await ctx.runQuery(
      internal.agentOps.getAgentOpsSnapshotContextInternal,
      { workspaceId: args.workspaceId }
    );
    const window: TimeWindow = normalizeAnalyticsWindow({
      ...args,
      timeZone: context.reportingTimeZone ?? args.timeZone,
      nowMs: getCurrentUTCTimestamp(),
    }).current;
    const requestedPage = Math.max(0, Math.floor(args.page ?? 0));
    const pageSizeMax = args.exportMode
      ? AGENT_OPS_MEMORY_EXPORT_PAGE_SIZE_MAX
      : AGENT_OPS_MEMORY_PAGE_SIZE_MAX;
    const pageSize = Math.min(
      pageSizeMax,
      Math.max(1, Math.floor(args.pageSize ?? 10))
    );
    const pageResult = await loadCursorMemoryInventoryPage(ctx, {
      workspaceId: args.workspaceId,
      window,
      sort: args.sort ?? "impact_desc",
      search: args.search,
      category: args.category,
      cursor: args.cursor,
      pageSize,
      scopeKey: buildMemoryInventoryCursorScopeKey({
        workspaceId: args.workspaceId,
        range: args.range,
        from: args.from,
        to: args.to,
        fromDate: args.fromDate,
        toDate: args.toDate,
        sort: args.sort ?? "impact_desc",
        search: args.search,
        category: args.category,
      }),
    });
    const hasDynamicFilters =
      (args.search?.trim().length ?? 0) > 0 ||
      (args.category !== undefined && args.category !== "all");
    const totalCount: number | null =
      args.exportMode || hasDynamicFilters
        ? null
        : await ctx.runQuery(
            internal.agentOps.getAgentOpsMemoryInventoryCountInternal,
            {
              workspaceId: args.workspaceId,
              startMs: pageResult.window.startMs,
              endMs: pageResult.window.endMs,
            }
          );
    const pageData = buildAgentOpsMemoryInventoryPage({
      rows: pageResult.rows,
      page: requestedPage,
      totalCount: totalCount ?? 0,
      totalPages:
        totalCount === null
          ? requestedPage + (pageResult.isDone ? 1 : 2)
          : Math.max(1, Math.ceil(totalCount / pageSize)),
      availableCategories: [...WORKSPACE_MEMORY_CATEGORIES].sort(
        (left, right) => left.localeCompare(right)
      ),
    });
    return {
      ...pageData,
      totalCount,
      continueCursor: pageResult.continueCursor,
      isDone: pageResult.isDone,
      scanned: pageResult.scanned,
    };
  },
});

export const getAgentOpsMemoryInventoryCountInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) =>
    await getUnfilteredMemoryInventoryCount(ctx.db, {
      workspaceId: args.workspaceId,
      window: { startMs: args.startMs, endMs: args.endMs },
    }),
});

export const getAgentOpsDashboard = query({
  args: {
    workspaceId: v.id("workspaces"),
    range: analyticsDateRangeValidator,
    tab: v.optional(agentOpsTabValidator),
    timeZone: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnedWorkspaceContext(
      ctx,
      args.workspaceId
    );
    const selectedTab = args.tab ?? "overview";

    if (!(await isWorkspaceReportingAggregateReady(ctx.db, args.workspaceId))) {
      throw new Error(
        "Realtime reporting is still being prepared for this workspace"
      );
    }

    const normalizedWindow = normalizeAnalyticsWindow({
      range: args.range,
      timeZone: workspace.reportingTimeZone ?? args.timeZone,
      from: args.from,
      to: args.to,
      fromDate: args.fromDate,
      toDate: args.toDate,
      nowMs: args.nowMs,
    });

    const bucketSet = createTrendBucketSet(normalizedWindow);
    const shouldLoadActivity = selectedTab === "activity";
    const [
      analyticsRows,
      agentOpsRows,
      workflowEvents,
      evaluatorRuns,
      suggestionPending,
      suggestionPromoted,
      suggestionRejected,
      memoryInventoryRows,
    ] = await Promise.all([
      getWorkspaceAnalyticsAggregateRows({
        ctx,
        workspaceId: args.workspaceId,
        bucketSet,
        previousWindow: normalizedWindow.previous,
      }),
      getWorkspaceAgentOpsAggregateRows({
        ctx,
        workspaceId: args.workspaceId,
        bucketSet,
        previousWindow: normalizedWindow.previous,
      }),
      shouldLoadActivity
        ? ctx.db
            .query("memoryWorkflowEvents")
            .withIndex("by_workspace_occurred_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .gte("occurredAt", normalizedWindow.current.startMs)
                .lte("occurredAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(80)
        : Promise.resolve([]),
      shouldLoadActivity
        ? ctx.db
            .query("memoryEvaluatorRuns")
            .withIndex("by_workspace_updated_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .gte("updatedAt", normalizedWindow.current.startMs)
                .lte("updatedAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(80)
        : Promise.resolve([]),
      shouldLoadActivity
        ? ctx.db
            .query("memorySuggestions")
            .withIndex("by_workspace_status_updated_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("status", "pending_review")
                .gte("updatedAt", normalizedWindow.current.startMs)
                .lte("updatedAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(20)
        : Promise.resolve([]),
      shouldLoadActivity
        ? ctx.db
            .query("memorySuggestions")
            .withIndex("by_workspace_status_updated_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("status", "promoted")
                .gte("updatedAt", normalizedWindow.current.startMs)
                .lte("updatedAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(20)
        : Promise.resolve([]),
      shouldLoadActivity
        ? ctx.db
            .query("memorySuggestions")
            .withIndex("by_workspace_status_updated_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("status", "rejected")
                .gte("updatedAt", normalizedWindow.current.startMs)
                .lte("updatedAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(20)
        : Promise.resolve([]),
      shouldLoadActivity
        ? listWorkspaceAgentMemoryInventoryInWindow(ctx.db, {
            workspaceId: args.workspaceId,
            startMs: normalizedWindow.current.startMs,
            endMs: normalizedWindow.current.endMs,
            limit: AGENT_OPS_ACTIVITY_MEMORY_LIMIT,
          })
        : Promise.resolve([]),
    ]);

    return buildAgentOpsDashboardData({
      bucketSet,
      currentWindow: normalizedWindow.current,
      previousWindow: normalizedWindow.previous,
      analyticsRows,
      agentOpsRows,
      // Detailed discovery rows and rankings stay in the bounded, paginated
      // inventory action rather than this stats subscription.
      workflowEvents,
      evaluatorRuns,
      memorySuggestions: [
        ...suggestionPending,
        ...suggestionPromoted,
        ...suggestionRejected,
      ].sort((left, right) => right.updatedAt - left.updatedAt),
      memoryInventoryRows,
    });
  },
});

export const getAgentOpsMemoryInventoryPage = query({
  args: {
    workspaceId: v.id("workspaces"),
    range: analyticsDateRangeValidator,
    timeZone: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    sort: v.optional(agentOpsMemorySortValidator),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnedWorkspaceContext(
      ctx,
      args.workspaceId
    );
    const requestedPage = Math.max(0, args.page ?? 0);
    const pageSize = Math.min(
      AGENT_OPS_MEMORY_PAGE_SIZE_MAX,
      Math.max(1, args.pageSize ?? 10)
    );
    const sort = args.sort ?? "impact_desc";
    const hasDynamicFilters =
      (args.search?.trim().length ?? 0) > 0 ||
      (args.category !== undefined && args.category !== "all");

    const normalizedWindow = normalizeAnalyticsWindow({
      range: args.range,
      timeZone: workspace.reportingTimeZone ?? args.timeZone,
      from: args.from,
      to: args.to,
      fromDate: args.fromDate,
      toDate: args.toDate,
    });

    const availableCategories = [...WORKSPACE_MEMORY_CATEGORIES].sort(
      (left, right) => left.localeCompare(right)
    );

    if (!hasDynamicFilters && sort !== "recent_desc") {
      const estimatedTotalCount = await getUnfilteredMemoryInventoryCount(
        ctx.db,
        {
          workspaceId: args.workspaceId,
          window: normalizedWindow.current,
        }
      );
      const estimatedTotalPages = Math.max(
        1,
        Math.ceil(estimatedTotalCount / pageSize)
      );
      const safeEstimatedPage = Math.min(
        requestedPage,
        estimatedTotalPages - 1
      );
      const startIndex = safeEstimatedPage * pageSize;
      const topRowsResult = await loadTopWindowMemoryInventoryMatches(ctx, {
        workspaceId: args.workspaceId,
        window: normalizedWindow.current,
        sort,
        matchLimit: startIndex + pageSize,
      });
      const totalCount = topRowsResult.reachedEnd
        ? topRowsResult.totalMatchedCount
        : estimatedTotalCount;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const safePage = Math.min(requestedPage, totalPages - 1);
      const safeStartIndex = safePage * pageSize;

      return buildAgentOpsMemoryInventoryPage({
        rows: topRowsResult.matches.slice(
          safeStartIndex,
          safeStartIndex + pageSize
        ),
        page: safePage,
        totalCount,
        totalPages,
        availableCategories,
      });
    }

    if (hasDynamicFilters) {
      const scanResult = await scanMemoryInventoryMatches(ctx, {
        workspaceId: args.workspaceId,
        window: normalizedWindow.current,
        sort,
        search: args.search,
        category: args.category,
        matchLimit: null,
      });
      const totalCount = scanResult.totalMatchedCount;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const safePage = Math.min(requestedPage, totalPages - 1);
      const startIndex = safePage * pageSize;

      return buildAgentOpsMemoryInventoryPage({
        rows: scanResult.matches.slice(startIndex, startIndex + pageSize),
        page: safePage,
        totalCount,
        totalPages,
        availableCategories,
      });
    }

    const estimatedTotalCount = await getUnfilteredMemoryInventoryCount(
      ctx.db,
      {
        workspaceId: args.workspaceId,
        window: normalizedWindow.current,
      }
    );
    const estimatedTotalPages = Math.max(
      1,
      Math.ceil(estimatedTotalCount / pageSize)
    );
    const safeEstimatedPage = Math.min(requestedPage, estimatedTotalPages - 1);
    const startIndex = safeEstimatedPage * pageSize;
    const scanResult = await scanMemoryInventoryMatches(ctx, {
      workspaceId: args.workspaceId,
      window: normalizedWindow.current,
      sort,
      matchLimit: startIndex + pageSize,
    });

    const totalCount = scanResult.reachedEnd
      ? scanResult.totalMatchedCount
      : Math.max(estimatedTotalCount, scanResult.totalMatchedCount);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(requestedPage, totalPages - 1);
    const safeStartIndex = safePage * pageSize;

    return buildAgentOpsMemoryInventoryPage({
      rows: scanResult.matches.slice(safeStartIndex, safeStartIndex + pageSize),
      page: safePage,
      totalCount,
      totalPages,
      availableCategories,
    });
  },
});

export const getAgentOpsQueryDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    queryCandidateId: v.id("queryCandidates"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const candidate = await ctx.db.get(args.queryCandidateId);
    if (!candidate || candidate.workspaceId !== args.workspaceId) {
      return null;
    }

    const [performance, keyword, monitor, relatedEvents] = await Promise.all([
      ctx.db
        .query("queryPerformance")
        .withIndex("by_workspace_activated_candidate", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("activatedQueryCandidateId", args.queryCandidateId)
        )
        .first(),
      candidate.activatedKeywordId
        ? ctx.db.get(candidate.activatedKeywordId)
        : Promise.resolve(null),
      candidate.activatedKeywordId
        ? ctx.db
            .query("socialQueryMonitors")
            .withIndex("by_keyword", (q) =>
              q.eq("keywordId", candidate.activatedKeywordId!)
            )
            .first()
        : Promise.resolve(null),
      Promise.all([
        ctx.db
          .query("memoryWorkflowEvents")
          .withIndex("by_workspace_query_candidate_occurred_at", (q) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("queryCandidateId", args.queryCandidateId)
          )
          .order("desc")
          .take(10),
        candidate.activatedKeywordId
          ? ctx.db
              .query("memoryWorkflowEvents")
              .withIndex("by_workspace_query_occurred_at", (q) =>
                q
                  .eq("workspaceId", args.workspaceId)
                  .eq("queryId", candidate.activatedKeywordId)
              )
              .order("desc")
              .take(10)
          : Promise.resolve([]),
      ]).then((groups) =>
        Array.from(
          new Map(
            groups.flat().map((event) => [String(event._id), event])
          ).values()
        )
          .sort((left, right) => right.occurredAt - left.occurredAt)
          .slice(0, 10)
      ),
    ]);

    return {
      queryCandidateId: String(candidate._id),
      rawValue: candidate.rawValue,
      canonicalValue: candidate.canonicalValue,
      type: candidate.type,
      status: candidate.status,
      sourceTheme: candidate.sourceTheme ?? null,
      noveltyScore: candidate.noveltyScore ?? null,
      duplicateReason: candidate.duplicateReason ?? null,
      performanceScore: candidate.performanceScore ?? null,
      updatedAt: candidate.updatedAt,
      reviewedAt: candidate.reviewedAt ?? null,
      retiredAt: candidate.retiredAt ?? null,
      activatedKeywordId: candidate.activatedKeywordId
        ? String(candidate.activatedKeywordId)
        : null,
      performance: performance
        ? {
            impressions: performance.impressions,
            prospectsFound: performance.prospectsFound,
            qualifiedCount: performance.qualifiedCount,
            convertedCount: performance.convertedCount,
            replyCount: performance.replyCount,
            replyRate: performance.replyRate,
            qualificationRate: performance.qualificationRate,
            lastUsedAt: performance.lastUsedAt ?? null,
          }
        : null,
      monitor: monitor
        ? {
            monitorId: String(monitor._id),
            status: monitor.status,
            healthStatus: monitor.healthStatus ?? null,
            totalProspectsFound: monitor.totalProspectsFound ?? 0,
            lastWebhookAt: monitor.lastWebhookAt ?? null,
            lastError: monitor.lastErrorMessage ?? null,
          }
        : null,
      keyword: keyword
        ? {
            keywordId: String(keyword._id),
            type: keyword.type,
            value: keyword.originalValue ?? keyword.value,
          }
        : null,
      relatedEvents: relatedEvents.map((event) => ({
        eventId: String(event._id),
        eventType: event.eventType,
        status: event.status,
        occurredAt: event.occurredAt,
      })),
    };
  },
});

export const getAgentOpsMonitorDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    monitorId: v.id("socialQueryMonitors"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor || monitor.workspaceId !== args.workspaceId) {
      return null;
    }

    const [keyword, performance] = await Promise.all([
      monitor.keywordId
        ? ctx.db
            .get(monitor.keywordId)
            .then((row) => row as Doc<"keywords"> | null)
        : Promise.resolve(null),
      monitor.keywordId
        ? ctx.db
            .query("queryPerformance")
            .withIndex("by_workspace_query_id", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("queryId", monitor.keywordId!)
            )
            .first()
        : Promise.resolve(null),
    ]);

    return {
      monitorId: String(monitor._id),
      status: monitor.status,
      healthStatus: monitor.healthStatus ?? null,
      monitorExternalId: monitor.monitorId,
      query:
        keyword?.originalValue ??
        keyword?.value ??
        monitor.query ??
        "Unknown query",
      refreshFrequency: monitor.refreshFrequency,
      totalProspectsFound: monitor.totalProspectsFound ?? 0,
      lastWebhookAt: monitor.lastWebhookAt ?? null,
      lastError: monitor.lastErrorMessage ?? null,
      createdAt: monitor._creationTime,
      performance: performance
        ? {
            prospectsFound: performance.prospectsFound,
            qualifiedCount: performance.qualifiedCount,
            convertedCount: performance.convertedCount,
            replyRate: performance.replyRate,
            qualificationRate: performance.qualificationRate,
          }
        : null,
    };
  },
});

export const getAgentOpsMemoryDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const memory = await getWorkspaceAgentMemoryById(ctx.db, {
      userId: String(user._id),
      workspaceId: String(args.workspaceId),
      memoryId: args.memoryId,
    });
    if (!memory) {
      return null;
    }

    const [prospect, suggestions, queryCandidates, canonicalMemory] =
      await Promise.all([
        memory.parsed.prospectId
          ? ctx.db.get(memory.parsed.prospectId as Id<"prospects">)
          : Promise.resolve(null),
        ctx.db
          .query("memorySuggestions")
          .withIndex("by_workspace_promoted_memory_updated_at", (q) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("promotedMemoryId", memory.memoryId)
          )
          .order("desc")
          .take(5),
        Promise.all(
          memory.parsed.relatedQueries.flatMap((related) =>
            (["seed_keyword", "social_query"] as const).map((type) => {
              const canonical = buildQueryCandidateCanonicalRecord({
                type,
                value: related,
              });
              return ctx.db
                .query("queryCandidates")
                .withIndex("by_workspace_canonical_key", (q) =>
                  q
                    .eq("workspaceId", args.workspaceId)
                    .eq("canonicalKey", canonical.canonicalKey)
                )
                .first();
            })
          )
        ).then((rows) =>
          rows.filter((row): row is NonNullable<typeof row> => row !== null)
        ),
        ctx.db
          .query("workspaceMemories")
          .withIndex("by_workspace_and_legacy_memory_id", (q) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("legacyMemoryId", memory.memoryId)
          )
          .take(10)
          .then(
            (rows) =>
              rows
                .filter((row) => row.status === "active")
                .sort((left, right) => right.updatedAt - left.updatedAt)[0] ??
              rows.sort((left, right) => right.updatedAt - left.updatedAt)[0] ??
              null
          ),
      ]);

    return {
      memoryId: memory.memoryId,
      createdAt: memory.createdAt,
      title: memory.parsed.title,
      summary: memory.parsed.summary,
      source: memory.parsed.source,
      category: memory.parsed.category,
      namespace: memory.parsed.namespace,
      confidence: memory.parsed.confidence,
      impactScore: memory.parsed.impactScore,
      prospect: prospect
        ? {
            prospectId: String(prospect._id),
            displayName: prospect.displayName || prospect.title || "Unknown",
            title: prospect.title ?? null,
          }
        : null,
      signals: memory.parsed.signals,
      evidence: memory.parsed.evidence,
      relatedQueries: queryCandidates.map((row) => ({
        queryCandidateId: String(row._id),
        rawValue: row.rawValue,
        status: row.status,
      })),
      promotions: suggestions.map((row) => ({
        suggestionId: String(row._id),
        updatedAt: row.updatedAt,
        status: row.status,
      })),
      narrative: memory.parsed.narrative,
      memoryText: memory.memoryText,
      canonicalMemory: canonicalMemory
        ? {
            memoryId: String(canonicalMemory._id),
            authority: canonicalMemory.authority,
            kind: canonicalMemory.kind,
            status: canonicalMemory.status,
            indexStatus: canonicalMemory.indexStatus,
            instruction: canonicalMemory.instruction ?? null,
            canonicalContent: canonicalMemory.canonicalContent,
            surfaces: canonicalMemory.surfaces ?? [],
            channels: canonicalMemory.channels ?? [],
            indexError: canonicalMemory.indexError ?? null,
            updatedAt: canonicalMemory.updatedAt,
          }
        : null,
    };
  },
});

export const getAgentOpsEventDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    eventId: v.id("memoryWorkflowEvents"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.workspaceId !== args.workspaceId) {
      return null;
    }

    const [prospect, plan, task] = await Promise.all([
      event.prospectId ? ctx.db.get(event.prospectId) : Promise.resolve(null),
      event.planId ? ctx.db.get(event.planId) : Promise.resolve(null),
      event.taskId ? ctx.db.get(event.taskId) : Promise.resolve(null),
    ]);

    return {
      eventId: String(event._id),
      eventType: event.eventType,
      status: event.status,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      workflowName: event.workflowName ?? null,
      occurredAt: event.occurredAt,
      processedAt: event.processedAt ?? null,
      evaluatorWorkflowId: event.evaluatorWorkflowId ?? null,
      error: event.error ?? null,
      payload: event.payload ?? null,
      prospect: prospect
        ? {
            prospectId: String(prospect._id),
            displayName: prospect.displayName || prospect.title || "Unknown",
          }
        : null,
      plan: plan ? { planId: String(plan._id), status: plan.status } : null,
      task: task ? { taskId: String(task._id), status: task.status } : null,
    };
  },
});

export const getAgentOpsRunDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    runId: v.id("memoryEvaluatorRuns"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const run = await ctx.db.get(args.runId);
    if (!run || run.workspaceId !== args.workspaceId) {
      return null;
    }

    const [event, suggestions] = await Promise.all([
      ctx.db.get(run.eventId),
      ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_run_updated_at", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("runId", String(run._id))
        )
        .order("desc")
        .take(10),
    ]);

    return {
      runId: String(run._id),
      status: run.status,
      eventType: run.eventType,
      sourceType: run.sourceType,
      sourceId: run.sourceId,
      promptVersion: run.promptVersion ?? null,
      model: run.model ?? null,
      summary: run.summary ?? null,
      ignoredReason: run.ignoredReason ?? null,
      error: run.error ?? null,
      promotedMemoryCount: run.promotedMemoryCount,
      suggestedMemoryCount: run.suggestedMemoryCount,
      queryPerformanceUpdateCount: run.queryPerformanceUpdateCount,
      retrievalStats: run.retrievalStats ?? null,
      startedAt: run.startedAt ?? null,
      completedAt: run.completedAt ?? null,
      relatedEvent: event
        ? {
            eventId: String(event._id),
            eventType: event.eventType,
            status: event.status,
          }
        : null,
      suggestions: suggestions.map((row) => ({
        suggestionId: String(row._id),
        title: row.title,
        status: row.status,
        promotedMemoryId: row.promotedMemoryId ?? null,
      })),
    };
  },
});

export const getAgentOpsSuggestionDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    suggestionId: v.id("memorySuggestions"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion || suggestion.workspaceId !== args.workspaceId) {
      return null;
    }

    const [prospect, memory] = await Promise.all([
      suggestion.prospectId
        ? ctx.db.get(suggestion.prospectId)
        : Promise.resolve(null),
      suggestion.promotedMemoryId
        ? getAgentOpsMemoryDetailFromSuggestion(
            ctx,
            args.workspaceId,
            suggestion.promotedMemoryId
          )
        : Promise.resolve(null),
    ]);

    return {
      suggestionId: String(suggestion._id),
      status: suggestion.status,
      title: suggestion.title,
      summary: suggestion.summary,
      source: suggestion.source,
      category: suggestion.category,
      confidence: suggestion.confidence,
      impactScore: suggestion.impactScore,
      signals: suggestion.signals,
      evidence: suggestion.evidence,
      relatedQueries: suggestion.relatedQueries,
      narrative: suggestion.narrative,
      updatedAt: suggestion.updatedAt,
      reviewedAt: suggestion.reviewedAt ?? null,
      promotedMemoryId: suggestion.promotedMemoryId ?? null,
      prospect: prospect
        ? {
            prospectId: String(prospect._id),
            displayName: prospect.displayName || prospect.title || "Unknown",
          }
        : null,
      promotedMemory: memory,
    };
  },
});

async function getAgentOpsMemoryDetailFromSuggestion(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  memoryId: string
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await getUserByIdentity(ctx, identity);
  if (!user) {
    return null;
  }

  const workspace = await getOwnedWorkspace(ctx, workspaceId, user._id);
  if (!workspace) {
    return null;
  }

  const memory = await getWorkspaceAgentMemoryById(ctx.db, {
    userId: String(user._id),
    workspaceId: String(workspace._id),
    memoryId,
  });

  if (!memory) {
    return null;
  }

  return {
    memoryId: memory.memoryId,
    title: memory.parsed.title,
    summary: memory.parsed.summary,
    createdAt: memory.createdAt,
  };
}
