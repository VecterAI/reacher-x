import { format } from "date-fns";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalQuery, query } from "./lib/functionBuilders";
import {
  getCalendarDaysUntil,
  getCurrentUTCTimestamp,
} from "../shared/lib/utils/time/timeUtils";
import { polar } from "./polar";
import { getOrCreateUserPlan } from "./lib/planCore";
import { computeUsageCycleWindow } from "./lib/planCycleUtils";
import {
  createUsageCycleKey,
  dedupeUsageCycleWindows,
  formatUsageCycleLabel,
  buildUsageTrendPoints,
  buildUsageTrendPointsFromCounts,
  createUsageTrendBucketSet,
  parseUsageCycleKey,
  resolveUsagePlanSnapshot,
  sameUsageCycleWindow,
  sortUsageWorkspaceRows,
} from "./lib/usageDashboardCore";
import { getUserFromIdentity } from "./lib/userUtils";
import { filterReportableWorkspaces } from "./lib/workspaceSetup";
import { shouldCountQualifiedProspectUsageInWindow } from "./lib/planQualifiedUsageCore";
import type { UserPlan } from "./lib/planConstants";
import { getWorkspaceReportingMetricSums } from "./lib/workspaceReportingAggregate";
import { isWorkspaceReportingAggregateReady } from "./lib/workspaceReportingRollout";

type UsageSnapshotContext = {
  plan: UserPlan;
  subscription: Parameters<typeof computeUsageCycleWindow>[0]["subscription"];
  workspaces: Doc<"workspaces">[];
  cycleRows: Doc<"planUsageCycles">[];
};

function formatPlanTitle(tier: "free" | "hobby" | "base" | "pro") {
  if (tier === "free") return "Plan required";
  if (tier === "hobby") return "Hobby";
  if (tier === "base") return "Base";
  return "Pro";
}

export const getUsageSnapshotContextInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<UsageSnapshotContext | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;
    const [plan, subscription, workspaces, cycleRows] = await Promise.all([
      getOrCreateUserPlan(ctx, user._id),
      polar.getCurrentSubscription(ctx, { userId: user._id }),
      ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .take(100),
      ctx.db
        .query("planUsageCycles")
        .withIndex("by_user_cycle_start", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(120),
    ]);
    return { plan, subscription, workspaces, cycleRows };
  },
});

export const listQualifiedUsageTimestampsPageInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cycleStart: v.number(),
    cycleEnd: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace_qualification", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("qualificationStatus", "qualified")
      )
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: 300,
        maximumBytesRead: 2_000_000,
      });
    const timestamps = (
      await Promise.all(
        result.page.map(async (summary) => {
          const qualifiedAt =
            summary.qualifiedAt ??
            (await ctx.db.get(summary.prospectId))?.qualifiedAt;
          return shouldCountQualifiedProspectUsageInWindow(
            { cycleStart: args.cycleStart, cycleEnd: args.cycleEnd },
            {
              origin: summary.origin,
              qualificationStatus: summary.qualificationStatus,
              qualifiedAt,
            }
          )
            ? qualifiedAt
            : undefined;
        })
      )
    ).filter((timestamp): timestamp is number => timestamp !== undefined);
    return {
      timestamps,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const getUsageDashboardSnapshot = action({
  args: { selectedCycleKey: v.optional(v.string()) },
  handler: async (ctx, args): Promise<unknown> => {
    const context: UsageSnapshotContext | null = await ctx.runQuery(
      internal.usage.getUsageSnapshotContextInternal,
      {}
    );
    if (!context) return null;
    const now = getCurrentUTCTimestamp();
    const currentWindow = computeUsageCycleWindow({
      now,
      tier: context.plan.tier,
      subscription: context.subscription,
    });
    const completedWorkspaces = filterReportableWorkspaces(context.workspaces);
    const cycleOptions = dedupeUsageCycleWindows([
      { ...currentWindow, isCurrent: true },
      ...context.cycleRows.map((row) => ({
        cycleStart: row.cycleStart,
        cycleEnd: row.cycleEnd,
        isCurrent: sameUsageCycleWindow(row, currentWindow),
      })),
    ]).map((window) => ({
      key: createUsageCycleKey(window),
      label: formatUsageCycleLabel(window),
      isCurrent: window.isCurrent === true,
    }));
    const requestedWindow = parseUsageCycleKey(args.selectedCycleKey);
    const selectedOption =
      cycleOptions.find((option) =>
        requestedWindow
          ? sameUsageCycleWindow(
              parseUsageCycleKey(option.key)!,
              requestedWindow
            )
          : option.isCurrent
      ) ?? cycleOptions[0];
    const selectedWindow =
      parseUsageCycleKey(selectedOption?.key) ?? currentWindow;
    const selectedCycleRow =
      context.cycleRows.find((row) =>
        sameUsageCycleWindow(row, selectedWindow)
      ) ?? null;
    const selectedIsCurrent = sameUsageCycleWindow(
      selectedWindow,
      currentWindow
    );
    const selectedPlan = resolveUsagePlanSnapshot({
      isCurrent: selectedIsCurrent,
      livePlan: context.plan,
      storedCycle: selectedCycleRow,
    });
    const workspaceRows = [];
    for (const workspace of completedWorkspaces) {
      const timestamps: number[] = [];
      let cursor: string | null = null;
      while (true) {
        const page: {
          timestamps: number[];
          continueCursor: string;
          isDone: boolean;
        } = await ctx.runQuery(
          internal.usage.listQualifiedUsageTimestampsPageInternal,
          {
            workspaceId: workspace._id,
            cycleStart: selectedWindow.cycleStart,
            cycleEnd: selectedWindow.cycleEnd,
            paginationOpts: { cursor, numItems: 250 },
          }
        );
        timestamps.push(...page.timestamps);
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      const limit = selectedPlan.prospectsLimit;
      workspaceRows.push({
        workspaceId: workspace._id,
        name: workspace.name,
        used: timestamps.length,
        limit,
        unlimited: limit === -1,
        percentUsed:
          limit === -1
            ? 0
            : Math.min(
                100,
                Math.round((timestamps.length / Math.max(1, limit)) * 100)
              ),
        trend: buildUsageTrendPoints({
          window: selectedWindow,
          timestamps,
          now,
        }),
      });
    }
    const sortedRows = sortUsageWorkspaceRows(workspaceRows);
    const comparisonMode =
      selectedPlan.prospectsLimit === -1
        ? ("count" as const)
        : ("percent" as const);
    return {
      cycleOptions,
      selectedCycleKey:
        selectedOption?.key ?? createUsageCycleKey(selectedWindow),
      summary: {
        plan: {
          tier: selectedPlan.tier,
          label: formatPlanTitle(selectedPlan.tier),
        },
        perWorkspaceLimit: selectedPlan.prospectsLimit,
        workspacesUsed: selectedIsCurrent
          ? completedWorkspaces.length
          : (selectedCycleRow?.workspacesUsed ?? completedWorkspaces.length),
        workspacesLimit: selectedPlan.workspacesLimit,
        resetDaysLeft: getCalendarDaysUntil(now, selectedWindow.cycleEnd) ?? 0,
        resetLabel: format(selectedWindow.cycleEnd, "d MMM yyyy"),
      },
      workspaces: sortedRows,
      comparison: {
        mode: comparisonMode,
        rows: sortedRows.map((workspace) => ({
          workspaceId: workspace.workspaceId,
          name: workspace.name,
          value:
            comparisonMode === "count" ? workspace.used : workspace.percentUsed,
          used: workspace.used,
          limit: workspace.unlimited ? null : workspace.limit,
        })),
      },
    };
  },
});

export const getUsageDashboard = query({
  args: {
    selectedCycleKey: v.optional(v.string()),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) {
      return null;
    }

    const now = args.nowMs;
    const [plan, subscription, workspaces, cycleRows] = await Promise.all([
      getOrCreateUserPlan(ctx, user._id),
      polar.getCurrentSubscription(ctx, { userId: user._id }),
      ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .take(100),
      ctx.db
        .query("planUsageCycles")
        .withIndex("by_user_cycle_start", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(120),
    ]);

    const currentWindow = computeUsageCycleWindow({
      now,
      tier: plan.tier,
      subscription,
    });
    const completedWorkspaces = filterReportableWorkspaces(workspaces);
    const reportingReady = await Promise.all(
      completedWorkspaces.map((workspace) =>
        isWorkspaceReportingAggregateReady(ctx.db, workspace._id)
      )
    );
    if (reportingReady.some((ready) => !ready)) {
      throw new Error(
        "Realtime reporting is still being prepared for one or more workspaces"
      );
    }

    const cycleOptions = dedupeUsageCycleWindows([
      { ...currentWindow, isCurrent: true },
      ...cycleRows.map((row) => ({
        cycleStart: row.cycleStart,
        cycleEnd: row.cycleEnd,
        isCurrent: sameUsageCycleWindow(row, currentWindow),
      })),
    ]).map((window) => ({
      key: createUsageCycleKey(window),
      label: formatUsageCycleLabel(window),
      isCurrent: window.isCurrent === true,
    }));

    const requestedWindow = parseUsageCycleKey(args.selectedCycleKey);
    const selectedOption =
      cycleOptions.find((option) =>
        requestedWindow
          ? sameUsageCycleWindow(
              parseUsageCycleKey(option.key)!,
              requestedWindow
            )
          : option.isCurrent
      ) ?? cycleOptions[0];

    const selectedWindow =
      parseUsageCycleKey(selectedOption?.key) ?? currentWindow;
    const selectedCycleRow =
      cycleRows.find((row) => sameUsageCycleWindow(row, selectedWindow)) ??
      null;
    const selectedIsCurrent = sameUsageCycleWindow(
      selectedWindow,
      currentWindow
    );
    const selectedPlan = resolveUsagePlanSnapshot({
      isCurrent: selectedIsCurrent,
      livePlan: plan,
      storedCycle: selectedCycleRow,
    });
    const selectedTier = selectedPlan.tier;
    const selectedLimit = selectedPlan.prospectsLimit;
    const comparisonMode =
      selectedLimit === -1 ? ("count" as const) : ("percent" as const);
    const selectedWorkspacesUsed = selectedIsCurrent
      ? completedWorkspaces.length
      : (selectedCycleRow?.workspacesUsed ?? completedWorkspaces.length);
    const selectedWorkspacesLimit = selectedPlan.workspacesLimit;
    const resetDaysLeft =
      getCalendarDaysUntil(now, selectedWindow.cycleEnd) ?? 0;

    const workspaceRows = sortUsageWorkspaceRows(
      await Promise.all(
        completedWorkspaces.map(async (workspace) => {
          const bucketSet = createUsageTrendBucketSet({
            window: selectedWindow,
            now,
          });
          const windows = bucketSet?.buckets ?? [];
          const [used = 0, ...trendCounts] =
            await getWorkspaceReportingMetricSums(ctx, {
              workspaceId: workspace._id,
              dataset: "usage",
              queries: [
                {
                  metric: "qualifiedProspectsCount",
                  startMs: selectedWindow.cycleStart,
                  endMs: selectedWindow.cycleEnd + 1,
                },
                ...windows.map((window) => ({
                  metric: "qualifiedProspectsCount" as const,
                  startMs: window.startMs,
                  endMs: window.endMs,
                })),
              ],
            });
          const percentUsed =
            selectedLimit === -1
              ? 0
              : Math.min(
                  100,
                  Math.round((used / Math.max(1, selectedLimit)) * 100)
                );

          return {
            workspaceId: workspace._id,
            name: workspace.name,
            used,
            limit: selectedLimit,
            unlimited: selectedLimit === -1,
            percentUsed,
            trend: bucketSet
              ? buildUsageTrendPointsFromCounts(bucketSet, trendCounts)
              : [],
          };
        })
      )
    );

    return {
      cycleOptions,
      selectedCycleKey:
        selectedOption?.key ?? createUsageCycleKey(selectedWindow),
      summary: {
        plan: {
          tier: selectedTier,
          label: formatPlanTitle(selectedTier),
        },
        perWorkspaceLimit: selectedLimit,
        workspacesUsed: selectedWorkspacesUsed,
        workspacesLimit: selectedWorkspacesLimit,
        resetDaysLeft,
        resetLabel: format(selectedWindow.cycleEnd, "d MMM yyyy"),
      },
      workspaces: workspaceRows,
      comparison: {
        mode: comparisonMode,
        rows: workspaceRows.map((workspace) => ({
          workspaceId: workspace.workspaceId,
          name: workspace.name,
          value:
            comparisonMode === "count" ? workspace.used : workspace.percentUsed,
          used: workspace.used,
          limit: workspace.unlimited ? null : workspace.limit,
        })),
      },
    };
  },
});
