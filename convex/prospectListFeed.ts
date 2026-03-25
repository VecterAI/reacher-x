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
  isInFitScoreRange,
  summaryRowToAnchorKey,
} from "./lib/prospectListFeedUtils";
import { mutation, query } from "./lib/functionBuilders";
import {
  listWorkspaceProspectSummariesPage,
  resolveWorkspaceFitRange,
} from "./prospectSummaries";
import { prospectStatusValidator } from "./validators";

const MAX_SCAN_FIRST_PAGE = 3000;
const MAX_PENDING_SCAN = 500;
const CURSOR_PREFIX = "ppfs1:";

function encodeCursor(prospectId: Id<"prospects">): string {
  return `${CURSOR_PREFIX}${prospectId}`;
}

function decodeCursor(cursor: string | null): Id<"prospects"> | null {
  if (!cursor?.startsWith(CURSOR_PREFIX)) {
    return null;
  }
  return cursor.slice(CURSOR_PREFIX.length) as Id<"prospects">;
}

function anchorFromDoc(
  doc: Doc<"prospectListFeedAnchors">
): FeedAnchorKey | null {
  if (doc.anchorProspectId === undefined) {
    return null;
  }
  return {
    anchorSortScore: doc.anchorSortScore,
    anchorProspectCreatedAt: doc.anchorProspectCreatedAt,
    anchorProspectId: doc.anchorProspectId,
  };
}

export const listStableWorkspaceProspectSummaries = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: prospectStatusValidator,
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
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
        status: args.status,
        fitScoreMin: args.fitScoreMin,
        fitScoreMax: args.fitScoreMax,
        searchQuery: args.searchQuery.trim(),
        paginationOpts: args.paginationOpts,
      });
    }

    const { fitScoreMin, fitScoreMax } = await resolveWorkspaceFitRange({
      db: ctx.db,
      workspaceId: args.workspaceId,
      fitScoreMin: args.fitScoreMin,
      fitScoreMax: args.fitScoreMax,
    });

    const anchorDoc = await ctx.db
      .query("prospectListFeedAnchors")
      .withIndex("by_user_workspace_status", (q) =>
        q
          .eq("userId", user._id)
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
      )
      .first();

    const numItems = args.paginationOpts.numItems;

    if (!anchorDoc) {
      return await listWorkspaceProspectSummariesPage(ctx.db, {
        workspaceId: args.workspaceId,
        status: args.status,
        fitScoreMin: args.fitScoreMin,
        fitScoreMax: args.fitScoreMax,
        paginationOpts: args.paginationOpts,
      });
    }

    const anchor = anchorFromDoc(anchorDoc);
    if (!anchor) {
      return await listWorkspaceProspectSummariesPage(ctx.db, {
        workspaceId: args.workspaceId,
        status: args.status,
        fitScoreMin: args.fitScoreMin,
        fitScoreMax: args.fitScoreMax,
        paginationOpts: args.paginationOpts,
      });
    }

    const lastProspectId = decodeCursor(args.paginationOpts.cursor);

    if (lastProspectId) {
      const last = await ctx.db
        .query("prospectSummaries")
        .withIndex("by_prospect", (q) => q.eq("prospectId", lastProspectId))
        .first();

      if (
        !last ||
        last.workspaceId !== args.workspaceId ||
        last.status !== args.status
      ) {
        return { page: [], isDone: true, continueCursor: "" };
      }

      const nextPage = await ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_status_score", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("status", args.status)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        )
        .filter((q) =>
          q.or(
            q.lt(
              q.field("sortQualificationScore"),
              last.sortQualificationScore
            ),
            q.and(
              q.eq(
                q.field("sortQualificationScore"),
                last.sortQualificationScore
              ),
              q.lt(q.field("prospectCreatedAt"), last.prospectCreatedAt)
            )
          )
        )
        .order("desc")
        .take(numItems);

      const isDone = nextPage.length < numItems;
      const continueCursor =
        !isDone && nextPage.length > 0
          ? encodeCursor(nextPage[nextPage.length - 1]!.prospectId)
          : "";

      return {
        page: nextPage,
        isDone,
        continueCursor,
      };
    }

    const scan = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace_status_score", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .take(MAX_SCAN_FIRST_PAGE);

    const stable: Doc<"prospectSummaries">[] = [];
    for (const row of scan) {
      if (isBetterInFeedOrder(row, anchor)) {
        continue;
      }
      stable.push(row);
    }

    const page = stable.slice(0, numItems);
    const hasMoreInSlice = stable.length > numItems;
    const scanHitCap = scan.length === MAX_SCAN_FIRST_PAGE;
    const isDone = !hasMoreInSlice && !scanHitCap;
    const continueCursor =
      !isDone && page.length > 0
        ? encodeCursor(page[page.length - 1]!.prospectId)
        : "";

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
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    const { fitScoreMin, fitScoreMax } = await resolveWorkspaceFitRange({
      db: ctx.db,
      workspaceId: args.workspaceId,
      fitScoreMin: args.fitScoreMin,
      fitScoreMax: args.fitScoreMax,
    });

    const anchorDoc = await ctx.db
      .query("prospectListFeedAnchors")
      .withIndex("by_user_workspace_status", (q) =>
        q
          .eq("userId", user._id)
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
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

    const scan = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace_status_score", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .take(MAX_PENDING_SCAN);

    let pendingCount = 0;
    const pendingPreview: Array<{
      prospectId: Id<"prospects">;
      displayName: string;
      avatarUrl?: string;
    }> = [];

    for (const row of scan) {
      if (
        !isInFitScoreRange(row.sortQualificationScore, fitScoreMin, fitScoreMax)
      ) {
        continue;
      }
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
      pendingCount >= MAX_PENDING_SCAN && scan.length === MAX_PENDING_SCAN;

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
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    firstProspectId: v.optional(v.id("prospects")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    const existing = await ctx.db
      .query("prospectListFeedAnchors")
      .withIndex("by_user_workspace_status", (q) =>
        q
          .eq("userId", user._id)
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
      )
      .first();

    if (existing) {
      return;
    }

    const { fitScoreMin, fitScoreMax } = await resolveWorkspaceFitRange({
      db: ctx.db,
      workspaceId: args.workspaceId,
      fitScoreMin: args.fitScoreMin,
      fitScoreMax: args.fitScoreMax,
    });

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
        summary.status !== args.status
      ) {
        return;
      }
    } else {
      summary = await ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_status_score", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("status", args.status)
            .gte("sortQualificationScore", fitScoreMin)
            .lte("sortQualificationScore", fitScoreMax)
        )
        .order("desc")
        .first();
    }

    if (!summary) {
      return;
    }

    const key = summaryRowToAnchorKey(summary);
    await ctx.db.insert("prospectListFeedAnchors", {
      userId: user._id,
      workspaceId: args.workspaceId,
      status: args.status,
      anchorSortScore: key.anchorSortScore,
      anchorProspectCreatedAt: key.anchorProspectCreatedAt,
      anchorProspectId: key.anchorProspectId,
      updatedAt: Date.now(),
    });
  },
});

export const mergePendingProspects = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    status: prospectStatusValidator,
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to update this workspace",
    });

    const anchorDoc = await ctx.db
      .query("prospectListFeedAnchors")
      .withIndex("by_user_workspace_status", (q) =>
        q
          .eq("userId", user._id)
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
      )
      .first();

    if (!anchorDoc) {
      return;
    }

    const { fitScoreMin, fitScoreMax } = await resolveWorkspaceFitRange({
      db: ctx.db,
      workspaceId: args.workspaceId,
      fitScoreMin: args.fitScoreMin,
      fitScoreMax: args.fitScoreMax,
    });

    const first = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace_status_score", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("status", args.status)
          .gte("sortQualificationScore", fitScoreMin)
          .lte("sortQualificationScore", fitScoreMax)
      )
      .order("desc")
      .first();

    if (!first) {
      return;
    }

    const key = summaryRowToAnchorKey(first);
    await ctx.db.patch(anchorDoc._id, {
      anchorSortScore: key.anchorSortScore,
      anchorProspectCreatedAt: key.anchorProspectCreatedAt,
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
