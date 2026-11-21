import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import {
  isTerminalStableFeedBuffer,
  normalizeProspectListSort,
} from "./lib/prospectListFeedUtils";
import { internalQuery, mutation, query } from "./lib/functionBuilders";
import {
  getProspectSummariesByProspectIds,
  listWorkspaceProspectSummariesPage,
} from "./prospectSummaries";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  prospectListSortValidator,
  prospectPlatformValidator,
  prospectStatusValidator,
  prospectTypeValidator,
  prospectVisibilityModeValidator,
} from "./validators";

const DEFAULT_STABLE_BATCH_SIZE = 160;
const MAX_STABLE_BATCH_SIZE = 160;
const MAX_PENDING_SCAN = 500;
const CURSOR_PREFIX = "ppfs3:";
const LEGACY_CURSOR_PREFIX = "ppfs2:";

type FeedAccessCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type FeedDb = QueryCtx["db"] | MutationCtx["db"];
type FeedScopeArgs = {
  platform?: Doc<"prospects">["platform"];
  prospectType?: Doc<"prospects">["prospectType"];
  fitScoreMin?: number;
  fitScoreMax?: number;
  createdAfterMs?: number;
  createdBeforeMs?: number;
  visibilityMode?: "all" | "ready_only" | "actionable_only";
};
type FeedSnapshotDoc = Doc<"prospectListFeedAnchors">;
type FeedSnapshotState = {
  readyAtWatermark: number;
};
type FeedCursorState = {
  sourceCursor: string | null;
  bufferedSummaryIds: Id<"prospectSummaries">[];
};
type FeedListArgs = {
  workspaceId: Id<"workspaces">;
  status: Doc<"prospectSummaries">["status"];
  sortBy: ReturnType<typeof normalizeProspectListSort>;
  platform?: Doc<"prospects">["platform"];
  prospectType?: Doc<"prospects">["prospectType"];
  fitScoreMin?: number;
  fitScoreMax?: number;
  createdAfterMs?: number;
  createdBeforeMs?: number;
  visibilityMode?: "all" | "ready_only" | "actionable_only";
};
type ProspectReadyTimestampSource = Pick<
  Doc<"prospectSummaries">,
  "prospectId" | "prospectCreatedAt" | "qualifiedAt"
> & {
  readyAt?: number;
};

function encodeCursor(state: FeedCursorState): string {
  if (state.sourceCursor === null && state.bufferedSummaryIds.length === 0) {
    return "";
  }

  return `${CURSOR_PREFIX}${encodeURIComponent(JSON.stringify(state))}`;
}

function decodeCursor(cursor: string | null): FeedCursorState {
  if (
    !cursor?.startsWith(CURSOR_PREFIX) &&
    !cursor?.startsWith(LEGACY_CURSOR_PREFIX)
  ) {
    return {
      sourceCursor: null,
      bufferedSummaryIds: [],
    };
  }

  try {
    const prefix = cursor.startsWith(CURSOR_PREFIX)
      ? CURSOR_PREFIX
      : LEGACY_CURSOR_PREFIX;
    const decoded = JSON.parse(
      decodeURIComponent(cursor.slice(prefix.length))
    ) as Partial<FeedCursorState>;
    const bufferedSummaryIds = Array.isArray(decoded.bufferedSummaryIds)
      ? decoded.bufferedSummaryIds.filter(
          (summaryId): summaryId is Id<"prospectSummaries"> =>
            typeof summaryId === "string"
        )
      : [];

    if (
      decoded.sourceCursor !== null &&
      decoded.sourceCursor !== undefined &&
      typeof decoded.sourceCursor !== "string"
    ) {
      return {
        sourceCursor: null,
        bufferedSummaryIds: [],
      };
    }

    return {
      sourceCursor: decoded.sourceCursor ?? null,
      bufferedSummaryIds,
    };
  } catch {
    return {
      sourceCursor: null,
      bufferedSummaryIds: [],
    };
  }
}

function buildFeedScopeKey(args: FeedScopeArgs): string {
  return JSON.stringify({
    visibilityMode: args.visibilityMode ?? "all",
    platform: args.platform ?? null,
    prospectType: args.prospectType ?? null,
    fitScoreMin: args.fitScoreMin ?? null,
    fitScoreMax: args.fitScoreMax ?? null,
    createdAfterMs:
      args.createdAfterMs !== undefined
        ? Math.round(args.createdAfterMs)
        : null,
    createdBeforeMs:
      args.createdBeforeMs !== undefined
        ? Math.round(args.createdBeforeMs)
        : null,
  });
}

async function listFeedSnapshotCandidates(
  ctx: FeedAccessCtx,
  args: {
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
    status: Doc<"prospectSummaries">["status"];
  }
): Promise<FeedSnapshotDoc[]> {
  return await ctx.db
    .query("prospectListFeedAnchors")
    .withIndex("by_user_workspace_status_sort", (q) =>
      q
        .eq("userId", args.userId)
        .eq("workspaceId", args.workspaceId)
        .eq("status", args.status)
    )
    .collect();
}

function selectLatestSnapshot(docs: FeedSnapshotDoc[]): FeedSnapshotDoc | null {
  const [latest] = [...docs].sort(
    (left, right) => right.updatedAt - left.updatedAt
  );
  return latest ?? null;
}

function listScopedFeedSnapshotsByRecency(
  docs: FeedSnapshotDoc[],
  scopeKey: string
) {
  return [...docs]
    .filter((doc) => doc.scopeKey === scopeKey)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function selectFeedSnapshotForWrite(
  docs: FeedSnapshotDoc[],
  scopeKey: string
): FeedSnapshotDoc | null {
  return (
    listScopedFeedSnapshotsByRecency(docs, scopeKey)[0] ??
    selectLatestSnapshot(docs.filter((doc) => doc.scopeKey === undefined))
  );
}

function getFeedSnapshotStateFromDoc(
  doc: FeedSnapshotDoc,
  rows: ProspectReadyTimestampSource[]
): FeedSnapshotState | null {
  if (typeof doc.readyAtWatermark === "number") {
    return {
      readyAtWatermark: doc.readyAtWatermark,
    };
  }

  // Repair legacy snapshots from the loaded prospect set so old
  // updatedAt-based watermarks do not keep recounting previously loaded rows.
  if (Array.isArray(doc.visibleProspectIds) && doc.visibleProspectIds.length) {
    const repairedReadyAtWatermark = getLatestReadyTimestampForProspectIds(
      rows,
      doc.visibleProspectIds
    );

    if (repairedReadyAtWatermark !== null) {
      return {
        readyAtWatermark: repairedReadyAtWatermark,
      };
    }
  }

  return null;
}

function resolveFeedSnapshotState(
  docs: FeedSnapshotDoc[],
  scopeKey: string,
  rows: ProspectReadyTimestampSource[]
): FeedSnapshotState | null {
  for (const doc of listScopedFeedSnapshotsByRecency(docs, scopeKey)) {
    const snapshot = getFeedSnapshotStateFromDoc(doc, rows);
    if (snapshot) {
      return snapshot;
    }
  }

  return null;
}

function getProspectSummaryReadyTimestamp(
  row: ProspectReadyTimestampSource
): number {
  const timestamps = [row.prospectCreatedAt];

  if (typeof row.qualifiedAt === "number") {
    timestamps.push(row.qualifiedAt);
  }
  if (typeof row.readyAt === "number") {
    timestamps.push(row.readyAt);
  }

  return Math.max(...timestamps);
}

function getLatestReadyTimestampForProspectIds(
  rows: ProspectReadyTimestampSource[],
  prospectIds: Id<"prospects">[]
): number | null {
  const visibleProspectIdSet = new Set(prospectIds);
  let latestReadyTimestamp: number | null = null;

  for (const row of rows) {
    if (!visibleProspectIdSet.has(row.prospectId)) {
      continue;
    }

    const readyTimestamp = getProspectSummaryReadyTimestamp(row);
    if (
      latestReadyTimestamp === null ||
      readyTimestamp > latestReadyTimestamp
    ) {
      latestReadyTimestamp = readyTimestamp;
    }
  }

  return latestReadyTimestamp;
}

function getStableBatchSize(numItems: number) {
  return Math.min(
    MAX_STABLE_BATCH_SIZE,
    Math.max(DEFAULT_STABLE_BATCH_SIZE, numItems * 4)
  );
}

function matchesBufferedStableRow(
  row: Doc<"prospectSummaries">,
  args: FeedListArgs
) {
  if (row.workspaceId !== args.workspaceId || row.status !== args.status) {
    return false;
  }

  if (
    args.visibilityMode === "ready_only" &&
    row.readyQualifiedEnriched !== true
  ) {
    return false;
  }

  if (
    args.visibilityMode === "actionable_only" &&
    row.actionableReady !== true
  ) {
    return false;
  }

  return true;
}

async function loadBufferedStableRows(
  db: FeedDb,
  args: FeedListArgs & {
    snapshot: FeedSnapshotState;
  },
  bufferedSummaryIds: Id<"prospectSummaries">[]
) {
  const bufferedRows = await Promise.all(
    bufferedSummaryIds.map((summaryId) => db.get(summaryId))
  );

  return bufferedRows.filter(
    (row): row is Doc<"prospectSummaries"> =>
      row !== null &&
      matchesBufferedStableRow(row, args) &&
      getProspectSummaryReadyTimestamp(row) <= args.snapshot.readyAtWatermark
  );
}

async function listStableFeedPage(
  db: FeedDb,
  args: FeedListArgs & {
    snapshot: FeedSnapshotState;
    paginationOpts: {
      cursor: string | null;
      numItems: number;
    };
  }
) {
  const targetCount = Math.max(1, args.paginationOpts.numItems);
  const batchSize = getStableBatchSize(targetCount);
  const cursorState = decodeCursor(args.paginationOpts.cursor);
  const bufferedRows = await loadBufferedStableRows(
    db,
    args,
    cursorState.bufferedSummaryIds
  );

  if (bufferedRows.length >= targetCount) {
    const remainingBufferedSummaryIds = bufferedRows
      .slice(targetCount)
      .map((row) => row._id);
    const continueCursor = encodeCursor({
      sourceCursor: cursorState.sourceCursor,
      bufferedSummaryIds: remainingBufferedSummaryIds,
    });

    return {
      page: bufferedRows.slice(0, targetCount),
      isDone: continueCursor.length === 0,
      continueCursor,
    };
  }

  if (
    isTerminalStableFeedBuffer({
      sourceCursor: cursorState.sourceCursor,
      bufferedSummaryCount: cursorState.bufferedSummaryIds.length,
    })
  ) {
    return {
      page: bufferedRows,
      isDone: true,
      continueCursor: "",
    };
  }

  const batch = await listWorkspaceProspectSummariesPage(db, {
    workspaceId: args.workspaceId,
    sortBy: args.sortBy,
    platform: args.platform,
    prospectType: args.prospectType,
    status: args.status,
    fitScoreMin: args.fitScoreMin,
    fitScoreMax: args.fitScoreMax,
    createdAfterMs: args.createdAfterMs,
    createdBeforeMs: args.createdBeforeMs,
    visibilityMode: args.visibilityMode,
    paginationOpts: {
      cursor: cursorState.sourceCursor,
      numItems: batchSize,
    },
  });
  const nextStableRows = batch.page.filter(
    (row) =>
      getProspectSummaryReadyTimestamp(row) <= args.snapshot.readyAtWatermark
  );
  const combinedRows = [...bufferedRows, ...nextStableRows];
  const remainingBufferedSummaryIds = combinedRows
    .slice(targetCount)
    .map((row) => row._id);
  const continueCursor = encodeCursor({
    sourceCursor: batch.isDone ? null : batch.continueCursor,
    bufferedSummaryIds: remainingBufferedSummaryIds,
  });

  return {
    page: combinedRows.slice(0, targetCount),
    isDone: continueCursor.length === 0,
    continueCursor,
  };
}

async function getPendingFeedState(
  db: FeedDb,
  args: FeedListArgs & {
    snapshot: FeedSnapshotState;
  }
) {
  const pendingPreview: Array<{
    prospectId: Id<"prospects">;
    displayName: string;
    avatarUrl?: string;
  }> = [];
  let pendingCount = 0;
  const batch = await listWorkspaceProspectSummariesPage(db, {
    workspaceId: args.workspaceId,
    sortBy: args.sortBy,
    platform: args.platform,
    prospectType: args.prospectType,
    status: args.status,
    fitScoreMin: args.fitScoreMin,
    fitScoreMax: args.fitScoreMax,
    createdAfterMs: args.createdAfterMs,
    createdBeforeMs: args.createdBeforeMs,
    visibilityMode: args.visibilityMode,
    paginationOpts: {
      cursor: null,
      numItems: MAX_PENDING_SCAN,
    },
  });

  for (const row of batch.page) {
    if (
      getProspectSummaryReadyTimestamp(row) <= args.snapshot.readyAtWatermark
    ) {
      continue;
    }

    pendingCount += 1;
    if (pendingPreview.length < 3) {
      pendingPreview.push({
        prospectId: row.prospectId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      });
    }
  }

  return {
    pendingCount,
    pendingCountCapped: !batch.isDone,
    pendingPreview,
  };
}

export type OpenedProspectSummary = Doc<"prospectSummaries"> & {
  opened: boolean;
};

/** Adds whether the user has opened each row's prospect. */
async function withOpenedState<T extends { page: Doc<"prospectSummaries">[] }>(
  db: QueryCtx["db"],
  userId: Id<"users">,
  result: T
): Promise<Omit<T, "page"> & { page: OpenedProspectSummary[] }> {
  const page = await Promise.all(
    result.page.map(async (row) => {
      const view = await db
        .query("prospectViews")
        .withIndex("by_user_prospect", (q) =>
          q.eq("userId", userId).eq("prospectId", row.prospectId)
        )
        .first();
      return { ...row, opened: view !== null };
    })
  );
  return { ...result, page };
}

export const listStableWorkspaceProspectSummaries = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: prospectStatusValidator,
    sortBy: v.optional(prospectListSortValidator),
    platform: v.optional(prospectPlatformValidator),
    prospectType: v.optional(prospectTypeValidator),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    createdAfterMs: v.optional(v.number()),
    createdBeforeMs: v.optional(v.number()),
    visibilityMode: v.optional(prospectVisibilityModeValidator),
    paginationOpts: paginationOptsValidator,
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    if (args.searchQuery?.trim()) {
      return await withOpenedState(
        ctx.db,
        user._id,
        await listWorkspaceProspectSummariesPage(ctx.db, {
          workspaceId: args.workspaceId,
          sortBy: args.sortBy,
          platform: args.platform,
          prospectType: args.prospectType,
          status: args.status,
          fitScoreMin: args.fitScoreMin,
          fitScoreMax: args.fitScoreMax,
          createdAfterMs: args.createdAfterMs,
          createdBeforeMs: args.createdBeforeMs,
          visibilityMode: args.visibilityMode,
          searchQuery: args.searchQuery.trim(),
          paginationOpts: args.paginationOpts,
        })
      );
    }
    const sortBy = normalizeProspectListSort(args.sortBy);
    const scopeKey = buildFeedScopeKey(args);
    const snapshotCandidates = await listFeedSnapshotCandidates(ctx, {
      userId: user._id,
      workspaceId: args.workspaceId,
      status: args.status,
    });
    const snapshot = resolveFeedSnapshotState(snapshotCandidates, scopeKey, []);

    if (!snapshot) {
      return await withOpenedState(
        ctx.db,
        user._id,
        await listWorkspaceProspectSummariesPage(ctx.db, {
          workspaceId: args.workspaceId,
          sortBy,
          platform: args.platform,
          prospectType: args.prospectType,
          status: args.status,
          fitScoreMin: args.fitScoreMin,
          fitScoreMax: args.fitScoreMax,
          createdAfterMs: args.createdAfterMs,
          createdBeforeMs: args.createdBeforeMs,
          visibilityMode: args.visibilityMode,
          paginationOpts: args.paginationOpts,
        })
      );
    }

    return await withOpenedState(
      ctx.db,
      user._id,
      await listStableFeedPage(ctx.db, {
        workspaceId: args.workspaceId,
        status: args.status,
        sortBy,
        platform: args.platform,
        prospectType: args.prospectType,
        fitScoreMin: args.fitScoreMin,
        fitScoreMax: args.fitScoreMax,
        createdAfterMs: args.createdAfterMs,
        createdBeforeMs: args.createdBeforeMs,
        visibilityMode: args.visibilityMode,
        snapshot,
        paginationOpts: args.paginationOpts,
      })
    );
  },
});

export const getProspectListFeedState = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: prospectStatusValidator,
    sortBy: v.optional(prospectListSortValidator),
    platform: v.optional(prospectPlatformValidator),
    prospectType: v.optional(prospectTypeValidator),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    createdAfterMs: v.optional(v.number()),
    createdBeforeMs: v.optional(v.number()),
    visibilityMode: v.optional(prospectVisibilityModeValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    const sortBy = normalizeProspectListSort(args.sortBy);
    const scopeKey = buildFeedScopeKey(args);
    const snapshotCandidates = await listFeedSnapshotCandidates(ctx, {
      userId: user._id,
      workspaceId: args.workspaceId,
      status: args.status,
    });
    const snapshot = resolveFeedSnapshotState(snapshotCandidates, scopeKey, []);

    if (!snapshot) {
      return {
        hasSnapshot: false,
        pendingCount: 0,
        pendingCountCapped: false,
        pendingPreview: [] as Array<{
          prospectId: Id<"prospects">;
          displayName: string;
          avatarUrl?: string;
        }>,
      };
    }
    const pendingState = await getPendingFeedState(ctx.db, {
      workspaceId: args.workspaceId,
      status: args.status,
      sortBy,
      platform: args.platform,
      prospectType: args.prospectType,
      fitScoreMin: args.fitScoreMin,
      fitScoreMax: args.fitScoreMax,
      createdAfterMs: args.createdAfterMs,
      createdBeforeMs: args.createdBeforeMs,
      visibilityMode: args.visibilityMode,
      snapshot,
    });

    return {
      hasSnapshot: true,
      pendingCount: pendingState.pendingCount,
      pendingCountCapped: pendingState.pendingCountCapped,
      pendingPreview: pendingState.pendingPreview,
    };
  },
});

/** Summary rows for search results, with the user's opened state. */
export const getOpenedProspectSummariesInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    prospectIds: v.array(v.id("prospects")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const rows = await getProspectSummariesByProspectIds(ctx.db, args);
    return (await withOpenedState(ctx.db, user._id, { page: rows })).page;
  },
});

export const syncProspectListFeedSnapshot = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    status: prospectStatusValidator,
    sortBy: v.optional(prospectListSortValidator),
    platform: v.optional(prospectPlatformValidator),
    prospectType: v.optional(prospectTypeValidator),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    createdAfterMs: v.optional(v.number()),
    createdBeforeMs: v.optional(v.number()),
    visibilityMode: v.optional(prospectVisibilityModeValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });
    const sortBy = normalizeProspectListSort(args.sortBy);
    const scopeKey = buildFeedScopeKey(args);
    const snapshotCandidates = await listFeedSnapshotCandidates(ctx, {
      userId: user._id,
      workspaceId: args.workspaceId,
      status: args.status,
    });
    const existing = selectFeedSnapshotForWrite(snapshotCandidates, scopeKey);
    const now = getCurrentUTCTimestamp();

    const patch = {
      scopeKey,
      readyAtWatermark: now,
      visibleProspectIds: [] as Id<"prospects">[],
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return;
    }

    await ctx.db.insert("prospectListFeedAnchors", {
      userId: user._id,
      workspaceId: args.workspaceId,
      status: args.status,
      sortBy,
      ...patch,
    });
  },
});

export const mergePendingProspects = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    status: prospectStatusValidator,
    sortBy: v.optional(prospectListSortValidator),
    platform: v.optional(prospectPlatformValidator),
    prospectType: v.optional(prospectTypeValidator),
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    createdAfterMs: v.optional(v.number()),
    createdBeforeMs: v.optional(v.number()),
    visibilityMode: v.optional(prospectVisibilityModeValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });
    const sortBy = normalizeProspectListSort(args.sortBy);
    const scopeKey = buildFeedScopeKey(args);
    const snapshotCandidates = await listFeedSnapshotCandidates(ctx, {
      userId: user._id,
      workspaceId: args.workspaceId,
      status: args.status,
    });
    const existing = selectFeedSnapshotForWrite(snapshotCandidates, scopeKey);
    const now = getCurrentUTCTimestamp();

    const patch = {
      scopeKey,
      readyAtWatermark: now,
      visibleProspectIds: [] as Id<"prospects">[],
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return;
    }

    await ctx.db.insert("prospectListFeedAnchors", {
      userId: user._id,
      workspaceId: args.workspaceId,
      status: args.status,
      sortBy,
      ...patch,
    });
  },
});

export const markProspectOpened = mutation({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const prospect = await requireOwnedProspect(ctx, prospectId, { user });

    const existing = await ctx.db
      .query("prospectViews")
      .withIndex("by_user_prospect", (q) =>
        q.eq("userId", user._id).eq("prospectId", prospectId)
      )
      .first();

    if (existing) {
      return;
    }

    await ctx.db.insert("prospectViews", {
      userId: user._id,
      workspaceId: prospect.workspaceId,
      prospectId,
      openedAt: getCurrentUTCTimestamp(),
    });
  },
});
