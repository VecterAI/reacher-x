import { format } from "date-fns";
import { v } from "convex/values";
import { query } from "./lib/functionBuilders";
import {
  getCalendarDaysUntil,
  getCurrentUTCTimestamp,
} from "../shared/lib/utils/time/timeUtils";
import { polar } from "./polar";
import { getOrCreateUserPlan } from "./lib/planCore";
import { readQualifiedProspectUsageForWorkspaceWindow } from "./lib/planQualifiedUsageCore";
import { computeUsageCycleWindow } from "./lib/planCycleUtils";
import {
  createUsageCycleKey,
  dedupeUsageCycleWindows,
  formatUsageCycleLabel,
  buildUsageTrendPoints,
  parseUsageCycleKey,
  sameUsageCycleWindow,
  sortUsageWorkspaceRows,
} from "./lib/usageDashboardCore";
import { getUserFromIdentity } from "./lib/userUtils";

function formatPlanTitle(tier: "free" | "hobby" | "base" | "pro") {
  if (tier === "free") return "Plan required";
  if (tier === "hobby") return "Hobby";
  if (tier === "base") return "Base";
  return "Pro";
}

export const getUsageDashboard = query({
  args: {
    selectedCycleKey: v.optional(v.string()),
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

    const now = getCurrentUTCTimestamp();
    const [plan, subscription, workspaces, cycleRows] = await Promise.all([
      getOrCreateUserPlan(ctx, user._id),
      polar.getCurrentSubscription(ctx, { userId: user._id }),
      ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("planUsageCycles")
        .withIndex("by_user_cycle_start", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect(),
    ]);

    const currentWindow = computeUsageCycleWindow({
      now,
      tier: plan.tier,
      subscription,
    });

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
    const selectedTier = selectedCycleRow?.tier ?? plan.tier;
    const selectedLimit =
      selectedCycleRow?.prospectsLimit ?? plan.prospectsLimit;
    const comparisonMode =
      selectedLimit === -1 ? ("count" as const) : ("percent" as const);
    const selectedWorkspacesUsed =
      selectedCycleRow?.workspacesUsed ?? workspaces.length;
    const selectedWorkspacesLimit =
      selectedCycleRow?.workspacesLimit ?? plan.workspacesLimit;
    const resetDaysLeft =
      getCalendarDaysUntil(now, selectedWindow.cycleEnd) ?? 0;

    const workspaceRows = sortUsageWorkspaceRows(
      await Promise.all(
        workspaces.map(async (workspace) => {
          const usage = await readQualifiedProspectUsageForWorkspaceWindow(
            ctx,
            workspace._id,
            selectedWindow
          );
          const percentUsed =
            selectedLimit === -1
              ? 0
              : Math.min(
                  100,
                  Math.round((usage.used / Math.max(1, selectedLimit)) * 100)
                );

          return {
            workspaceId: workspace._id,
            name: workspace.name,
            used: usage.used,
            limit: selectedLimit,
            unlimited: selectedLimit === -1,
            percentUsed,
            trend: buildUsageTrendPoints({
              window: selectedWindow,
              timestamps: usage.timestamps,
              now,
            }),
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
