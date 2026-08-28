import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery, query } from "./lib/functionBuilders";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { analyticsDateRangeValidator } from "./validators";
import { getOwnedWorkspace, getUserByIdentity } from "./lib/accessHelpers";
import {
  buildMetric,
  buildPipelineFunnel,
  calculateRate,
  countHourlyFieldByBucket,
  createEmptyAnalyticsData,
  createTrendBucketSet,
  normalizeAnalyticsWindow,
  sumHourlyFieldInWindow,
  type AnalyticsQueryResult,
  type NormalizedAnalyticsWindow,
  type TimeWindow,
} from "./lib/analyticsCore";
import { getUtcDayStartTimestamp } from "./lib/readModelHelpers";
import { listWorkspaceAnalyticsDailyRows } from "./workspaceAnalyticsDaily";
import {
  mapDashboardChunksSequentially,
  splitDashboardDayRange,
} from "./lib/dashboardReadCore";

type AnalyticsDailyRow = Awaited<
  ReturnType<typeof listWorkspaceAnalyticsDailyRows>
>[number];

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

function getWindowDayRange(window: TimeWindow) {
  const clampedEndMs = Math.max(window.startMs, window.endMs - 1);
  return {
    startDayStartUtcMs: getUtcDayStartTimestamp(window.startMs),
    endDayStartUtcMs: getUtcDayStartTimestamp(clampedEndMs),
  };
}

function buildPipelineSnapshot(rows: AnalyticsDailyRow[], window: TimeWindow) {
  return buildPipelineFunnel({
    newCount: sumHourlyFieldInWindow(rows, "hourlyNewProspectsCounts", window),
    contactedCount: sumHourlyFieldInWindow(
      rows,
      "hourlyReachedContactedProspectsCounts",
      window
    ),
    inProgressCount: sumHourlyFieldInWindow(
      rows,
      "hourlyReachedInProgressProspectsCounts",
      window
    ),
    convertedCount: sumHourlyFieldInWindow(
      rows,
      "hourlyReachedConvertedProspectsCounts",
      window
    ),
  });
}

function buildQualificationDistribution(
  rows: AnalyticsDailyRow[],
  window: TimeWindow
) {
  const qualifiedCount = sumHourlyFieldInWindow(
    rows,
    "hourlyQualificationQualifiedCounts",
    window
  );
  const disqualifiedCount = sumHourlyFieldInWindow(
    rows,
    "hourlyQualificationDisqualifiedCounts",
    window
  );
  const pendingCount = Math.max(
    0,
    sumHourlyFieldInWindow(rows, "hourlyNewProspectsCounts", window) -
      qualifiedCount -
      disqualifiedCount
  );

  return [
    { segment: "qualified" as const, count: qualifiedCount },
    { segment: "disqualified" as const, count: disqualifiedCount },
    { segment: "pending" as const, count: pendingCount },
  ];
}

function buildFitDistribution(rows: AnalyticsDailyRow[], window: TimeWindow) {
  return [
    {
      range: "0-49",
      count: sumHourlyFieldInWindow(rows, "hourlyFitScore0To49Counts", window),
    },
    {
      range: "50-69",
      count: sumHourlyFieldInWindow(rows, "hourlyFitScore50To69Counts", window),
    },
    {
      range: "70-79",
      count: sumHourlyFieldInWindow(rows, "hourlyFitScore70To79Counts", window),
    },
    {
      range: "80-100",
      count: sumHourlyFieldInWindow(
        rows,
        "hourlyFitScore80To100Counts",
        window
      ),
    },
  ];
}

function buildPlatformDistribution(
  rows: AnalyticsDailyRow[],
  window: TimeWindow
) {
  return [
    {
      platform: "Twitter/X",
      count: sumHourlyFieldInWindow(
        rows,
        "hourlyTwitterProspectsCounts",
        window
      ),
    },
    {
      platform: "LinkedIn",
      count: sumHourlyFieldInWindow(
        rows,
        "hourlyLinkedInProspectsCounts",
        window
      ),
    },
    { platform: "Reddit", count: 0 },
    { platform: "Threads", count: 0 },
    { platform: "Bluesky", count: 0 },
  ];
}

function buildDashboardAnalyticsResult(args: {
  analyticsRows: AnalyticsDailyRow[];
  normalizedWindow: NormalizedAnalyticsWindow;
  bucketSet: ReturnType<typeof createTrendBucketSet>;
}): AnalyticsQueryResult {
  const { analyticsRows, normalizedWindow, bucketSet } = args;
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
  const responseRate = {
    ...buildMetric({
      currentValue: calculateRate(respondedCurrent, contactedCurrent),
      previousValue: calculateRate(respondedPrevious, contactedPrevious),
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
  const issues = {
    ...issuesMetricBase,
    trend: (issuesMetricBase.change <= 0 ? "down" : "up") as "up" | "down",
    paused: pausedPlansCurrent,
    failed: failedTasksCurrent,
  };

  const currentQualifiedCount = sumHourlyFieldInWindow(
    analyticsRows,
    "hourlyQualificationQualifiedCounts",
    normalizedWindow.current
  );
  const previousQualifiedCount = sumHourlyFieldInWindow(
    analyticsRows,
    "hourlyQualificationQualifiedCounts",
    normalizedWindow.previous
  );
  const currentDisqualifiedCount = sumHourlyFieldInWindow(
    analyticsRows,
    "hourlyQualificationDisqualifiedCounts",
    normalizedWindow.current
  );
  const previousDisqualifiedCount = sumHourlyFieldInWindow(
    analyticsRows,
    "hourlyQualificationDisqualifiedCounts",
    normalizedWindow.previous
  );
  const currentReadyCount = sumHourlyFieldInWindow(
    analyticsRows,
    "hourlyActionableReadyCounts",
    normalizedWindow.current
  );
  const previousReadyCount = sumHourlyFieldInWindow(
    analyticsRows,
    "hourlyActionableReadyCounts",
    normalizedWindow.previous
  );
  const currentPendingCount = Math.max(
    0,
    currentProspectsCount - currentQualifiedCount - currentDisqualifiedCount
  );
  const previousPendingCount = Math.max(
    0,
    previousProspectsCount - previousQualifiedCount - previousDisqualifiedCount
  );
  const processingSummary = {
    pending: buildMetric({
      currentValue: currentPendingCount,
      previousValue: previousPendingCount,
    }),
    qualified: buildMetric({
      currentValue: currentQualifiedCount,
      previousValue: previousQualifiedCount,
    }),
    ready: buildMetric({
      currentValue: currentReadyCount,
      previousValue: previousReadyCount,
    }),
    disqualified: buildMetric({
      currentValue: currentDisqualifiedCount,
      previousValue: previousDisqualifiedCount,
      trendWhenEqual: "down",
    }),
  };

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

  return {
    status: "success",
    data: {
      newProspects,
      responseRate,
      pendingApprovals,
      issues,
      processingSummary,
      pipelineFunnel: buildPipelineSnapshot(
        analyticsRows,
        normalizedWindow.current
      ),
      trendsOverTime: bucketSet.buckets.map((bucket, index) => ({
        date: bucket.label,
        prospects: prospectCounts[index] ?? 0,
        contacted: contactedCounts[index] ?? 0,
      })),
      qualificationDistribution: buildQualificationDistribution(
        analyticsRows,
        normalizedWindow.current
      ),
      fitDistribution: buildFitDistribution(
        analyticsRows,
        normalizedWindow.current
      ),
      platformDistribution: buildPlatformDistribution(
        analyticsRows,
        normalizedWindow.current
      ),
    },
    generatedAt: getCurrentUTCTimestamp(),
  };
}

export const getAnalyticsSnapshotContextInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return null;
    }
    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    return workspace
      ? { reportingTimeZone: workspace.reportingTimeZone ?? null }
      : null;
  },
});

export const getDashboardAnalyticsSnapshot = action({
  args: {
    workspaceId: v.id("workspaces"),
    range: analyticsDateRangeValidator,
    timeZone: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AnalyticsQueryResult> => {
    const nowMs = getCurrentUTCTimestamp();
    let normalizedWindow = normalizeAnalyticsWindow({
      ...args,
      nowMs,
    });
    let bucketSet = createTrendBucketSet(normalizedWindow);

    try {
      const context = await ctx.runQuery(
        internal.analytics.getAnalyticsSnapshotContextInternal,
        { workspaceId: args.workspaceId }
      );
      if (!context) {
        return createErrorResult(
          "Workspace not found or access denied",
          bucketSet
        );
      }

      normalizedWindow = normalizeAnalyticsWindow({
        ...args,
        timeZone: context.reportingTimeZone ?? args.timeZone,
        nowMs,
      });
      bucketSet = createTrendBucketSet(normalizedWindow);
      const currentDayRange = getWindowDayRange(normalizedWindow.current);
      const previousDayRange = getWindowDayRange(normalizedWindow.previous);
      const chunks = splitDashboardDayRange({
        startDayStartUtcMs: Math.min(
          currentDayRange.startDayStartUtcMs,
          previousDayRange.startDayStartUtcMs
        ),
        endDayStartUtcMs: Math.max(
          currentDayRange.endDayStartUtcMs,
          previousDayRange.endDayStartUtcMs
        ),
      });
      const analyticsRows = (
        await mapDashboardChunksSequentially({
          chunks,
          load: async (chunk) =>
            await ctx.runQuery(
              internal.workspaceAnalyticsDaily
                .listWorkspaceAnalyticsDailyInternal,
              { workspaceId: args.workspaceId, ...chunk }
            ),
        })
      ).flat();

      return buildDashboardAnalyticsResult({
        analyticsRows,
        normalizedWindow,
        bucketSet,
      });
    } catch (error) {
      return createErrorResult(
        error instanceof Error
          ? error.message
          : "Failed to load analytics data",
        bucketSet
      );
    }
  },
});

export const getDashboardAnalytics = query({
  args: {
    workspaceId: v.id("workspaces"),
    range: analyticsDateRangeValidator,
    timeZone: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    refreshKey: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AnalyticsQueryResult> => {
    let bucketSet = createTrendBucketSet(
      normalizeAnalyticsWindow({ range: "7d", timeZone: args.timeZone })
    );

    try {
      let normalizedWindow = normalizeAnalyticsWindow({
        range: args.range,
        timeZone: args.timeZone,
        from: args.from,
        to: args.to,
        fromDate: args.fromDate,
        toDate: args.toDate,
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

      normalizedWindow = normalizeAnalyticsWindow({
        range: args.range,
        timeZone: workspace.reportingTimeZone ?? args.timeZone,
        from: args.from,
        to: args.to,
        fromDate: args.fromDate,
        toDate: args.toDate,
      });
      bucketSet = createTrendBucketSet(normalizedWindow);

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
      const analyticsRows = await listWorkspaceAnalyticsDailyRows({
        db: ctx.db,
        workspaceId: args.workspaceId,
        startDayStartUtcMs,
        endDayStartUtcMs,
      });

      return buildDashboardAnalyticsResult({
        analyticsRows,
        normalizedWindow,
        bucketSet,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load analytics data";

      return createErrorResult(errorMessage, bucketSet);
    }
  },
});
