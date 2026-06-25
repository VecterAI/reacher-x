import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalQuery } from "./lib/functionBuilders";

type WorkspaceQueryPerformanceDailyDb = QueryCtx["db"] | MutationCtx["db"];

export async function listWorkspaceQueryPerformanceDailyRows(args: {
  db: WorkspaceQueryPerformanceDailyDb;
  workspaceId: Id<"workspaces">;
  startDayStartUtcMs?: number;
  endDayStartUtcMs?: number;
}) {
  if (
    args.startDayStartUtcMs !== undefined &&
    args.endDayStartUtcMs !== undefined
  ) {
    return await args.db
      .query("workspaceQueryPerformanceDaily")
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
      .query("workspaceQueryPerformanceDaily")
      .withIndex("by_workspace_day", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .gte("dayStartUtcMs", args.startDayStartUtcMs!)
      )
      .collect();
  }

  if (args.endDayStartUtcMs !== undefined) {
    return await args.db
      .query("workspaceQueryPerformanceDaily")
      .withIndex("by_workspace_day", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .lte("dayStartUtcMs", args.endDayStartUtcMs!)
      )
      .collect();
  }

  return await args.db
    .query("workspaceQueryPerformanceDaily")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", args.workspaceId))
    .collect();
}

export const listWorkspaceQueryPerformanceDailyInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    startDayStartUtcMs: v.optional(v.number()),
    endDayStartUtcMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await listWorkspaceQueryPerformanceDailyRows({
      db: ctx.db,
      workspaceId: args.workspaceId,
      startDayStartUtcMs: args.startDayStartUtcMs,
      endDayStartUtcMs: args.endDayStartUtcMs,
    });
  },
});
