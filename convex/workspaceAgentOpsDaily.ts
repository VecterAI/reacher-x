import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalQuery, query } from "./lib/functionBuilders";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import {
  combineWorkspaceAgentOpsRecords,
  normalizeWorkspaceAgentOpsDailyRecord,
  type WorkspaceAgentOpsDailyRecord,
} from "./lib/agentOpsReadModelHelpers";

type WorkspaceAgentOpsDailyDb = QueryCtx["db"] | MutationCtx["db"];

export async function listWorkspaceAgentOpsDailyRows(args: {
  db: WorkspaceAgentOpsDailyDb;
  workspaceId: Id<"workspaces">;
  startDayStartUtcMs?: number;
  endDayStartUtcMs?: number;
}) {
  const listBaselineRows = async () => {
    if (
      args.startDayStartUtcMs !== undefined &&
      args.endDayStartUtcMs !== undefined
    ) {
      return await args.db
        .query("workspaceAgentOpsDaily")
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
        .query("workspaceAgentOpsDaily")
        .withIndex("by_workspace_day", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .gte("dayStartUtcMs", args.startDayStartUtcMs!)
        )
        .collect();
    }
    if (args.endDayStartUtcMs !== undefined) {
      return await args.db
        .query("workspaceAgentOpsDaily")
        .withIndex("by_workspace_day", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .lte("dayStartUtcMs", args.endDayStartUtcMs!)
        )
        .collect();
    }
    return await args.db
      .query("workspaceAgentOpsDaily")
      .withIndex("by_workspace_day", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect();
  };

  const listStripeRows = async () => {
    if (
      args.startDayStartUtcMs !== undefined &&
      args.endDayStartUtcMs !== undefined
    ) {
      return await args.db
        .query("workspaceAgentOpsDailyStripes")
        .withIndex("by_workspace_day_and_stripe", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .gte("dayStartUtcMs", args.startDayStartUtcMs!)
            .lte("dayStartUtcMs", args.endDayStartUtcMs!)
        )
        .collect();
    }
    if (args.startDayStartUtcMs !== undefined) {
      return await args.db
        .query("workspaceAgentOpsDailyStripes")
        .withIndex("by_workspace_day_and_stripe", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .gte("dayStartUtcMs", args.startDayStartUtcMs!)
        )
        .collect();
    }
    if (args.endDayStartUtcMs !== undefined) {
      return await args.db
        .query("workspaceAgentOpsDailyStripes")
        .withIndex("by_workspace_day_and_stripe", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .lte("dayStartUtcMs", args.endDayStartUtcMs!)
        )
        .collect();
    }
    return await args.db
      .query("workspaceAgentOpsDailyStripes")
      .withIndex("by_workspace_day_and_stripe", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect();
  };

  const [baselineRows, stripeRows] = await Promise.all([
    listBaselineRows(),
    listStripeRows(),
  ]);
  const baselines = new Map(
    baselineRows.map((row) => [
      row.dayStartUtcMs,
      normalizeWorkspaceAgentOpsDailyRecord(row),
    ])
  );
  const stripesByDay = new Map<number, WorkspaceAgentOpsDailyRecord[]>();
  for (const stripe of stripeRows) {
    const rows = stripesByDay.get(stripe.dayStartUtcMs) ?? [];
    rows.push(stripe);
    stripesByDay.set(stripe.dayStartUtcMs, rows);
  }
  const days = new Set([...baselines.keys(), ...stripesByDay.keys()]);

  return Array.from(days)
    .sort((left, right) => left - right)
    .map((dayStartUtcMs) =>
      combineWorkspaceAgentOpsRecords({
        workspaceId: args.workspaceId,
        dayStartUtcMs,
        baseline: baselines.get(dayStartUtcMs) ?? null,
        stripes: stripesByDay.get(dayStartUtcMs) ?? [],
      })
    );
}

export const listWorkspaceAgentOpsDailyInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    startDayStartUtcMs: v.optional(v.number()),
    endDayStartUtcMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await listWorkspaceAgentOpsDailyRows({
      db: ctx.db,
      workspaceId: args.workspaceId,
      startDayStartUtcMs: args.startDayStartUtcMs,
      endDayStartUtcMs: args.endDayStartUtcMs,
    });
  },
});

export const listWorkspaceAgentOpsDaily = query({
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

    return await listWorkspaceAgentOpsDailyRows({
      db: ctx.db,
      workspaceId: args.workspaceId,
      startDayStartUtcMs: args.startDayStartUtcMs,
      endDayStartUtcMs: args.endDayStartUtcMs,
    });
  },
});
