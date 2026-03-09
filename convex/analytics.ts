import { query } from "./lib/functionBuilders";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { analyticsDateRangeValidator } from "./validators";
import { getOwnedWorkspace, getUserByIdentity } from "./lib/accessHelpers";
import {
  buildMetric,
  buildPipelineFunnel,
  createEmptyAnalyticsData,
  createTrendBucketSet,
  isTimestampInWindow,
  normalizeAnalyticsWindow,
  calculateRate,
  type AnalyticsQueryResult,
  type TrendBucketSet,
  type TimeWindow,
} from "./lib/analyticsCore";
import { getUtcDayStartTimestamp } from "./lib/readModelHelpers";
import { listWorkspaceAnalyticsDailyRows } from "./workspaceAnalyticsDaily";
import {
  getWorkspaceStatsSnapshot,
  type WorkspaceStatsSnapshot,
} from "./workspaceStats";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type WorkspaceStatsRow = WorkspaceStatsSnapshot;
type AnalyticsDailyRow = Doc<"workspaceAnalyticsDaily">;
type HourlyAnalyticsField =
  | "hourlyNewProspectsCounts"
  | "hourlyContactedEventsCounts"
  | "hourlyRespondedEventsCounts"
  | "hourlyDraftPlansCounts"
  | "hourlyPendingApprovalTasksCounts"
  | "hourlyPausedPlansCounts"
  | "hourlyBlockedAuthPlansCounts"
  | "hourlyFailedTasksCounts";
type DailyAnalyticsField =
  | "fitScore0To49Count"
  | "fitScore50To69Count"
  | "fitScore70To79Count"
  | "fitScore80To100Count";

function createErrorResult(
  message: string,
  bucketSet: ReturnType<typeof createTrendBucketSet>
): AnalyticsQueryResult {
  return {
    status: "error",
    error: message,
    data: createEmptyAnalyticsData(bucketSet),
    generatedAt: getCurrentUTCTimestamp(),
  };
}

function rowIntersectsWindow(
  row: AnalyticsDailyRow,
  window: TimeWindow
): boolean {
  const rowStartMs = row.dayStartUtcMs;
  const rowEndMs = rowStartMs + DAY_MS;
  return rowStartMs < window.endMs && rowEndMs > window.startMs;
}

function getWindowDayRange(window: TimeWindow) {
  const clampedEndMs = Math.max(window.startMs, window.endMs - 1);
  return {
    startDayStartUtcMs: getUtcDayStartTimestamp(window.startMs),
    endDayStartUtcMs: getUtcDayStartTimestamp(clampedEndMs),
  };
}

function sumHourlyFieldInWindow(
  rows: AnalyticsDailyRow[],
  field: HourlyAnalyticsField,
  window: TimeWindow
): number {
  let total = 0;

  for (const row of rows) {
    if (!rowIntersectsWindow(row, window)) {
      continue;
    }

    row[field].forEach((count, hour) => {
      if (count <= 0) {
        return;
      }

      const hourStartMs = row.dayStartUtcMs + hour * HOUR_MS;
      if (isTimestampInWindow(hourStartMs, window)) {
        total += count;
      }
    });
  }

  return total;
}

function sumDailyFieldInWindow(
  rows: AnalyticsDailyRow[],
  field: DailyAnalyticsField,
  window: TimeWindow
): number {
  return rows.reduce((total, row) => {
    if (!rowIntersectsWindow(row, window)) {
      return total;
    }
    return total + row[field];
  }, 0);
}

function countHourlyFieldByBucket(
  rows: AnalyticsDailyRow[],
  field: HourlyAnalyticsField,
  bucketSet: TrendBucketSet
): number[] {
  const counts = Array.from({ length: bucketSet.buckets.length }, () => 0);

  for (const row of rows) {
    row[field].forEach((count, hour) => {
      if (count <= 0) {
        return;
      }

      const hourStartMs = row.dayStartUtcMs + hour * HOUR_MS;
      if (!isTimestampInWindow(hourStartMs, bucketSet.window)) {
        return;
      }

      const bucketIndex = Math.min(
        bucketSet.buckets.length - 1,
        Math.max(
          0,
          Math.floor(
            (hourStartMs - bucketSet.window.startMs) / bucketSet.stepMs
          )
        )
      );
      counts[bucketIndex] += count;
    });
  }

  return counts;
}

function buildPipelineSnapshot(stats: WorkspaceStatsRow | null) {
  const activeProspectsCount =
    (stats?.newProspectsCount ?? 0) +
    (stats?.contactedProspectsCount ?? 0) +
    (stats?.inProgressProspectsCount ?? 0) +
    (stats?.convertedProspectsCount ?? 0);
  const contactedCount =
    (stats?.contactedProspectsCount ?? 0) +
    (stats?.inProgressProspectsCount ?? 0) +
    (stats?.convertedProspectsCount ?? 0);
  const inProgressCount =
    (stats?.inProgressProspectsCount ?? 0) +
    (stats?.convertedProspectsCount ?? 0);

  return buildPipelineFunnel({
    newCount: activeProspectsCount,
    contactedCount,
    inProgressCount,
    convertedCount: stats?.convertedProspectsCount ?? 0,
  });
}

function buildFitDistribution(rows: AnalyticsDailyRow[], window: TimeWindow) {
  return [
    {
      range: "0-49",
      count: sumDailyFieldInWindow(rows, "fitScore0To49Count", window),
    },
    {
      range: "50-69",
      count: sumDailyFieldInWindow(rows, "fitScore50To69Count", window),
    },
    {
      range: "70-79",
      count: sumDailyFieldInWindow(rows, "fitScore70To79Count", window),
    },
    {
      range: "80-100",
      count: sumDailyFieldInWindow(rows, "fitScore80To100Count", window),
    },
  ];
}

function buildPlatformSnapshot(stats: WorkspaceStatsRow | null) {
  return [
    { platform: "Twitter/X", count: stats?.twitterProspectsCount ?? 0 },
    { platform: "LinkedIn", count: stats?.linkedInProspectsCount ?? 0 },
    { platform: "Reddit", count: 0 },
    { platform: "Threads", count: 0 },
    { platform: "Bluesky", count: 0 },
  ];
}

export const getDashboardAnalytics = query({
  args: {
    workspaceId: v.id("workspaces"),
    range: analyticsDateRangeValidator,
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    // Allows explicit retry from the UI by changing args.
    refreshKey: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AnalyticsQueryResult> => {
    let bucketSet = createTrendBucketSet(
      normalizeAnalyticsWindow({ range: "7d" })
    );

    try {
      const normalizedWindow = normalizeAnalyticsWindow({
        range: args.range,
        from: args.from,
        to: args.to,
      });
      bucketSet = createTrendBucketSet(normalizedWindow);

      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return createErrorResult("Not authenticated", bucketSet);
      }

      const user = await getUserByIdentity(ctx, identity);
      if (!user) {
        return createErrorResult("User not found", bucketSet);
      }

      const workspace = await getOwnedWorkspace(
        ctx,
        args.workspaceId,
        user._id
      );
      if (!workspace) {
        return createErrorResult(
          "Workspace not found or access denied",
          bucketSet
        );
      }

      const currentDayRange = getWindowDayRange(normalizedWindow.current);
      const previousDayRange = getWindowDayRange(normalizedWindow.previous);
      const startDayStartUtcMs = Math.min(
        currentDayRange.startDayStartUtcMs,
        previousDayRange.startDayStartUtcMs
      );
      const endDayStartUtcMs = Math.max(
        currentDayRange.endDayStartUtcMs,
        previousDayRange.endDayStartUtcMs
      );

      const [workspaceStats, analyticsRows] = await Promise.all([
        getWorkspaceStatsSnapshot({
          db: ctx.db,
          workspace,
        }),
        listWorkspaceAnalyticsDailyRows({
          db: ctx.db,
          workspaceId: args.workspaceId,
          startDayStartUtcMs,
          endDayStartUtcMs,
        }),
      ]);

      const currentProspectsCount = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyNewProspectsCounts",
        normalizedWindow.current
      );
      const previousProspectsCount = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyNewProspectsCounts",
        normalizedWindow.previous
      );
      const newProspects = buildMetric({
        currentValue: currentProspectsCount,
        previousValue: previousProspectsCount,
      });

      const contactedCurrent = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyContactedEventsCounts",
        normalizedWindow.current
      );
      const contactedPrevious = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyContactedEventsCounts",
        normalizedWindow.previous
      );
      const respondedCurrent = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyRespondedEventsCounts",
        normalizedWindow.current
      );
      const respondedPrevious = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyRespondedEventsCounts",
        normalizedWindow.previous
      );

      const responseRateCurrent = calculateRate(
        respondedCurrent,
        contactedCurrent
      );
      const responseRatePrevious = calculateRate(
        respondedPrevious,
        contactedPrevious
      );
      const responseRate = {
        ...buildMetric({
          currentValue: responseRateCurrent,
          previousValue: responseRatePrevious,
          valueDecimals: 1,
          changeDecimals: 2,
          changePercentDecimals: 2,
        }),
        contacted: contactedCurrent,
      };

      const pendingPlansCurrent = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyDraftPlansCounts",
        normalizedWindow.current
      );
      const pendingPlansPrevious = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyDraftPlansCounts",
        normalizedWindow.previous
      );
      const pendingTasksCurrent = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyPendingApprovalTasksCounts",
        normalizedWindow.current
      );
      const pendingTasksPrevious = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyPendingApprovalTasksCounts",
        normalizedWindow.previous
      );
      const pendingApprovals = {
        ...buildMetric({
          currentValue: pendingPlansCurrent + pendingTasksCurrent,
          previousValue: pendingPlansPrevious + pendingTasksPrevious,
        }),
        plans: pendingPlansCurrent,
        tasks: pendingTasksCurrent,
      };

      const pausedPlansCurrent =
        sumHourlyFieldInWindow(
          analyticsRows,
          "hourlyPausedPlansCounts",
          normalizedWindow.current
        ) +
        sumHourlyFieldInWindow(
          analyticsRows,
          "hourlyBlockedAuthPlansCounts",
          normalizedWindow.current
        );
      const pausedPlansPrevious =
        sumHourlyFieldInWindow(
          analyticsRows,
          "hourlyPausedPlansCounts",
          normalizedWindow.previous
        ) +
        sumHourlyFieldInWindow(
          analyticsRows,
          "hourlyBlockedAuthPlansCounts",
          normalizedWindow.previous
        );
      const failedTasksCurrent = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyFailedTasksCounts",
        normalizedWindow.current
      );
      const failedTasksPrevious = sumHourlyFieldInWindow(
        analyticsRows,
        "hourlyFailedTasksCounts",
        normalizedWindow.previous
      );

      const issuesMetricBase = buildMetric({
        currentValue: pausedPlansCurrent + failedTasksCurrent,
        previousValue: pausedPlansPrevious + failedTasksPrevious,
        trendWhenEqual: "down",
      });
      const issuesTrend: "up" | "down" =
        issuesMetricBase.change <= 0 ? "down" : "up";
      const issues = {
        ...issuesMetricBase,
        trend: issuesTrend,
        paused: pausedPlansCurrent,
        failed: failedTasksCurrent,
      };

      const pipelineFunnel = buildPipelineSnapshot(workspaceStats);

      const prospectCounts = countHourlyFieldByBucket(
        analyticsRows,
        "hourlyNewProspectsCounts",
        bucketSet
      );
      const contactedCounts = countHourlyFieldByBucket(
        analyticsRows,
        "hourlyContactedEventsCounts",
        bucketSet
      );
      const trendsOverTime = bucketSet.buckets.map((bucket, index) => ({
        date: bucket.label,
        prospects: prospectCounts[index] ?? 0,
        contacted: contactedCounts[index] ?? 0,
      }));

      const fitDistribution = buildFitDistribution(
        analyticsRows,
        normalizedWindow.current
      );
      const platformDistribution = buildPlatformSnapshot(workspaceStats);

      const data = {
        newProspects,
        responseRate,
        pendingApprovals,
        issues,
        pipelineFunnel,
        trendsOverTime,
        fitDistribution,
        platformDistribution,
      };

      return {
        status: "success",
        data,
        generatedAt: getCurrentUTCTimestamp(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load analytics data";

      return createErrorResult(errorMessage, bucketSet);
    }
  },
});
