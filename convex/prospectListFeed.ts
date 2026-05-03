import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import {
  type FeedAnchorKey,
  isBetterInFeedOrder,
  normalizeProspectListSort,
  summaryRowToAnchorKey,
} from "./lib/prospectListFeedUtils";
import { mutation, query } from "./lib/functionBuilders";
import { listWorkspaceProspectSummariesPage } from "./prospectSummaries";
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

function anchorFromDoc(
  doc: Doc<"prospectListFeedAnchors">
): FeedAnchorKey | null {
  if (doc.anchorProspectId === undefined) {
    return null;
  }
  return {
    sortBy: normalizeProspectListSort(doc.sortBy),
    anchorSortScore: doc.anchorSortScore,
    anchorProspectCreatedAt: doc.anchorProspectCreatedAt,
    anchorProspectType: doc.anchorProspectType ?? "unknown",
    anchorProspectId: doc.anchorProspectId,
  };
}

function matchesSummaryFilters(
  row: Doc<"prospectSummaries">,
  args: {
    platform?: Doc<"prospects">["platform"];
    prospectType?: Doc<"prospects">["prospectType"];
    createdAfterMs?: number;
    createdBeforeMs?: number;
  }
) {
  if (args.platform !== undefined && row.platform !== args.platform) {
    return false;
  }
  if (
    args.prospectType !== undefined &&
    row.prospectType !== args.prospectType
  ) {
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
  return true;
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

    const anchorDoc = await ctx.db
      .query("prospectListFeedAnchors")
      .withIndex("by_user_workspace_status_sort", (q) =>
        q
          .eq("userId", user._id)
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
          .eq("sortBy", sortBy)
      )
      .first();

    const numItems = args.paginationOpts.numItems;
    const start = decodeCursor(args.paginationOpts.cursor);

    const orderedResult = await listWorkspaceProspectSummariesPage(ctx.db, {
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
    });

    const anchor = anchorDoc ? anchorFromDoc(anchorDoc) : null;
    const stable = anchor
      ? orderedResult.page.filter(
          (row: Doc<"prospectSummaries">) => !isBetterInFeedOrder(row, anchor)
        )
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

    const anchorDoc = await ctx.db
      .query("prospectListFeedAnchors")
      .withIndex("by_user_workspace_status_sort", (q) =>
        q
          .eq("userId", user._id)
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
          .eq("sortBy", sortBy)
      )
      .first();

    if (!anchorDoc) {
      return {
        hasAnchor: false,
        pendingCount: 0,
        pendingCountCapped: false,
        pendingPreview: [] as Array<{
          prospectId: Id<"prospects">;
          displayName: string;
          avatarUrl?: string;
        }>,
      };
    }

    const anchor = anchorFromDoc(anchorDoc);
    if (!anchor) {
      return {
        hasAnchor: false,
        pendingCount: 0,
        pendingCountCapped: false,
        pendingPreview: [],
      };
    }

    const orderedResult = await listWorkspaceProspectSummariesPage(ctx.db, {
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
    });

    let pendingCount = 0;
    const pendingPreview: Array<{
      prospectId: Id<"prospects">;
      displayName: string;
      avatarUrl?: string;
    }> = [];

    for (const row of orderedResult.page) {
      if (isBetterInFeedOrder(row, anchor)) {
        pendingCount += 1;
        if (pendingPreview.length < 3) {
          pendingPreview.push({
            prospectId: row.prospectId,
            displayName: row.displayName,
            avatarUrl: row.avatarUrl,
          });
        }
      } else {
        break;
      }
    }

    const pendingCountCapped =
      pendingCount >= MAX_PENDING_SCAN && !orderedResult.isDone;

    return {
      hasAnchor: true,
      pendingCount,
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

export const ensureProspectListAnchor = mutation({
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
    firstProspectId: v.optional(v.id("prospects")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });
    const sortBy = normalizeProspectListSort(args.sortBy);

    const existing = await ctx.db
      .query("prospectListFeedAnchors")
      .withIndex("by_user_workspace_status_sort", (q) =>
        q
          .eq("userId", user._id)
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
          .eq("sortBy", sortBy)
      )
      .first();

    if (existing) {
      return;
    }

    let summary: Doc<"prospectSummaries"> | null = null;

    const firstProspectId = args.firstProspectId;
    if (firstProspectId) {
      summary = await ctx.db
        .query("prospectSummaries")
        .withIndex("by_prospect", (q) => q.eq("prospectId", firstProspectId))
        .first();
      if (
        !summary ||
        summary.workspaceId !== args.workspaceId ||
        summary.status !== args.status ||
        !matchesSummaryFilters(summary, args)
      ) {
        return;
      }
    } else {
      const orderedResult = await listWorkspaceProspectSummariesPage(ctx.db, {
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
        paginationOpts: { cursor: null, numItems: 1 },
      });
      summary = orderedResult.page[0] ?? null;
    }

    if (!summary) {
      return;
    }

    const key = summaryRowToAnchorKey(summary, sortBy);
    await ctx.db.insert("prospectListFeedAnchors", {
      userId: user._id,
      workspaceId: args.workspaceId,
      status: args.status,
      sortBy,
      anchorSortScore: key.anchorSortScore,
      anchorProspectCreatedAt: key.anchorProspectCreatedAt,
      anchorProspectType: key.anchorProspectType,
      anchorProspectId: key.anchorProspectId,
      updatedAt: Date.now(),
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

    const anchorDoc = await ctx.db
      .query("prospectListFeedAnchors")
      .withIndex("by_user_workspace_status_sort", (q) =>
        q
          .eq("userId", user._id)
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
          .eq("sortBy", sortBy)
      )
      .first();

    if (!anchorDoc) {
      return;
    }

    const orderedResult = await listWorkspaceProspectSummariesPage(ctx.db, {
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
      paginationOpts: { cursor: null, numItems: 1 },
    });
    const first = orderedResult.page[0] ?? null;

    if (!first) {
      return;
    }

    const key = summaryRowToAnchorKey(first, sortBy);
    await ctx.db.patch(anchorDoc._id, {
      anchorSortScore: key.anchorSortScore,
      anchorProspectCreatedAt: key.anchorProspectCreatedAt,
      anchorProspectType: key.anchorProspectType,
      anchorProspectId: key.anchorProspectId,
      updatedAt: Date.now(),
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
      openedAt: Date.now(),
    });
  },
});
