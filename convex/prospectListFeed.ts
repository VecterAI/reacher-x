import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import { normalizeProspectListSort } from "./lib/prospectListFeedUtils";
import { mutation, query } from "./lib/functionBuilders";
import { listWorkspaceProspectSummariesPage } from "./prospectSummaries";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  prospectListSortValidator,
  prospectPlatformValidator,
  prospectStatusValidator,
  prospectTypeValidator,
  prospectVisibilityModeValidator,
} from "./validators";

const MAX_SCAN_FIRST_PAGE = 3000;
const MAX_PENDING_SCAN = 500;
const CURSOR_PREFIX = "ppfs1:";

type FeedAccessCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
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
type ProspectReadyTimestampSource = Pick<
  Doc<"prospectSummaries">,
  "prospectId" | "prospectCreatedAt" | "qualifiedAt"
> & {
  readyAt?: number;
};

function encodeCursor(offset: number): string {
  return `${CURSOR_PREFIX}${offset}`;
}

function decodeCursor(cursor: string | null): number {
  if (!cursor?.startsWith(CURSOR_PREFIX)) {
    return 0;
  }

  const value = Number(cursor.slice(CURSOR_PREFIX.length));
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
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

  if (typeof doc.readyAtWatermark !== "number") {
    return null;
  }

  return {
    readyAtWatermark: doc.readyAtWatermark,
  };
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

function getLatestReadyTimestamp(
  rows: ProspectReadyTimestampSource[]
): number | null {
  let latestReadyTimestamp: number | null = null;

  for (const row of rows) {
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

function buildStableFeedRows(
  rows: Doc<"prospectSummaries">[],
  snapshot: FeedSnapshotState
) {
  const stableRows: Doc<"prospectSummaries">[] = [];
  const pendingRows: Doc<"prospectSummaries">[] = [];

  for (const row of rows) {
    if (getProspectSummaryReadyTimestamp(row) > snapshot.readyAtWatermark) {
      pendingRows.push(row);
      continue;
    }
    stableRows.push(row);
  }

  return {
    stableRows,
    pendingRows,
  };
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
      return await listWorkspaceProspectSummariesPage(ctx.db, {
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
      });
    }
    const sortBy = normalizeProspectListSort(args.sortBy);
    const scopeKey = buildFeedScopeKey(args);
    const numItems = args.paginationOpts.numItems;
    const start = decodeCursor(args.paginationOpts.cursor);

    const [snapshotCandidates, orderedResult] = await Promise.all([
      listFeedSnapshotCandidates(ctx, {
        userId: user._id,
        workspaceId: args.workspaceId,
        status: args.status,
      }),
      listWorkspaceProspectSummariesPage(ctx.db, {
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
        paginationOpts: { cursor: null, numItems: MAX_SCAN_FIRST_PAGE },
      }),
    ]);
    const snapshot = resolveFeedSnapshotState(
      snapshotCandidates,
      scopeKey,
      orderedResult.page
    );
    const stable = snapshot
      ? buildStableFeedRows(orderedResult.page, snapshot).stableRows
      : orderedResult.page;

    const page = stable.slice(start, start + numItems);
    const hasMoreInSlice = stable.length > start + numItems;
    const isDone = !hasMoreInSlice && orderedResult.isDone;
    const continueCursor =
      !isDone && page.length > 0 ? encodeCursor(start + page.length) : "";

    return {
      page,
      isDone,
      continueCursor,
    };
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
    const [snapshotCandidates, orderedResult] = await Promise.all([
      listFeedSnapshotCandidates(ctx, {
        userId: user._id,
        workspaceId: args.workspaceId,
        status: args.status,
      }),
      listWorkspaceProspectSummariesPage(ctx.db, {
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
        paginationOpts: { cursor: null, numItems: MAX_PENDING_SCAN },
      }),
    ]);
    const snapshot = resolveFeedSnapshotState(
      snapshotCandidates,
      scopeKey,
      orderedResult.page
    );

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

    const { pendingRows } = buildStableFeedRows(orderedResult.page, snapshot);
    const pendingPreview: Array<{
      prospectId: Id<"prospects">;
      displayName: string;
      avatarUrl?: string;
    }> = [];

    for (const row of pendingRows) {
      if (pendingPreview.length >= 3) {
        break;
      }
      pendingPreview.push({
        prospectId: row.prospectId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      });
    }

    const pendingCountCapped =
      pendingRows.length >= MAX_PENDING_SCAN && !orderedResult.isDone;

    return {
      hasSnapshot: true,
      pendingCount: pendingRows.length,
      pendingCountCapped,
      pendingPreview,
    };
  },
});

export const getProspectOpenedMap = query({
  args: {
    workspaceId: v.id("workspaces"),
    prospectIds: v.array(v.id("prospects")),
  },
  handler: async (ctx, { workspaceId, prospectIds }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    const capped = prospectIds.slice(0, 50);
    const opened: Record<string, boolean> = {};
    for (const prospectId of capped) {
      const row = await ctx.db
        .query("prospectViews")
        .withIndex("by_user_prospect", (q) =>
          q.eq("userId", user._id).eq("prospectId", prospectId)
        )
        .first();
      opened[prospectId] = !!row;
    }
    return opened;
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
    const [snapshotCandidates, orderedResult] = await Promise.all([
      listFeedSnapshotCandidates(ctx, {
        userId: user._id,
        workspaceId: args.workspaceId,
        status: args.status,
      }),
      listWorkspaceProspectSummariesPage(ctx.db, {
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
        paginationOpts: { cursor: null, numItems: MAX_SCAN_FIRST_PAGE },
      }),
    ]);
    const existing = selectFeedSnapshotForWrite(snapshotCandidates, scopeKey);
    const latestReadyTimestamp = getLatestReadyTimestamp(orderedResult.page);
    if (latestReadyTimestamp === null) {
      return;
    }

    const patch = {
      scopeKey,
      readyAtWatermark: latestReadyTimestamp,
      visibleProspectIds: [] as Id<"prospects">[],
      updatedAt: getCurrentUTCTimestamp(),
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
    const [snapshotCandidates, orderedResult] = await Promise.all([
      listFeedSnapshotCandidates(ctx, {
        userId: user._id,
        workspaceId: args.workspaceId,
        status: args.status,
      }),
      listWorkspaceProspectSummariesPage(ctx.db, {
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
        paginationOpts: { cursor: null, numItems: MAX_SCAN_FIRST_PAGE },
      }),
    ]);
    const existing = selectFeedSnapshotForWrite(snapshotCandidates, scopeKey);
    const latestReadyTimestamp = getLatestReadyTimestamp(orderedResult.page);
    if (latestReadyTimestamp === null) {
      return;
    }

    const patch = {
      scopeKey,
      readyAtWatermark: latestReadyTimestamp,
      visibleProspectIds: [] as Id<"prospects">[],
      updatedAt: getCurrentUTCTimestamp(),
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
