import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalQuery, query } from "./lib/functionBuilders";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";

export type AnalyticsDb = QueryCtx["db"] | MutationCtx["db"];

export async function listWorkspaceAnalyticsDailyRows(args: {
  db: AnalyticsDb;
  workspaceId: Id<"workspaces">;
  startDayStartUtcMs?: number;
  endDayStartUtcMs?: number;
}) {
  if (
    args.startDayStartUtcMs !== undefined &&
    args.endDayStartUtcMs !== undefined
  ) {
    return await args.db
      .query("workspaceAnalyticsDaily")
      .withIndex("by_workspace_day", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .gte("dayStartUtcMs", args.startDayStartUtcMs!)
          .lte("dayStartUtcMs", args.endDayStartUtcMs!)
      )
      .collect();
  }

  if (args.startDayStartUtcMs !== undefined) {
    return await args.db
      .query("workspaceAnalyticsDaily")
      .withIndex("by_workspace_day", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .gte("dayStartUtcMs", args.startDayStartUtcMs!)
      )
      .collect();
  }

  if (args.endDayStartUtcMs !== undefined) {
    return await args.db
      .query("workspaceAnalyticsDaily")
      .withIndex("by_workspace_day", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .lte("dayStartUtcMs", args.endDayStartUtcMs!)
      )
      .collect();
  }

  return await args.db
    .query("workspaceAnalyticsDaily")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", args.workspaceId))
    .collect();
}

export const listWorkspaceAnalyticsDailyInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    startDayStartUtcMs: v.optional(v.number()),
    endDayStartUtcMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await listWorkspaceAnalyticsDailyRows({
      db: ctx.db,
      workspaceId: args.workspaceId,
      startDayStartUtcMs: args.startDayStartUtcMs,
      endDayStartUtcMs: args.endDayStartUtcMs,
    });
  },
});

export const listWorkspaceAnalyticsDaily = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDayStartUtcMs: v.optional(v.number()),
    endDayStartUtcMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    return await listWorkspaceAnalyticsDailyRows({
      db: ctx.db,
      workspaceId: args.workspaceId,
      startDayStartUtcMs: args.startDayStartUtcMs,
      endDayStartUtcMs: args.endDayStartUtcMs,
    });
  },
});
