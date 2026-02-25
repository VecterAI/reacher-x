import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { analyticsDateRangeValidator } from "./validators";
import { getUserFromIdentity } from "./lib/userUtils";
import {
  buildMetric,
  buildPipelineFunnel,
  countTimestampsByBucket,
  createEmptyAnalyticsData,
  createTrendBucketSet,
  isTimestampInWindow,
  normalizeAnalyticsWindow,
  calculateRate,
  type AnalyticsQueryResult,
  type TimeWindow,
} from "./lib/analyticsCore";

const PLAN_STATUSES: Array<Doc<"outreachPlans">["status"]> = [
  "draft",
  "approved",
  "executing",
  "paused",
  "completed",
  "abandoned",
];

type PipelineStage = "new" | "contacted" | "in_progress" | "converted";

const PIPELINE_STAGE_RANK: Record<PipelineStage, number> = {
  new: 0,
  contacted: 1,
  in_progress: 2,
  converted: 3,
};

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

function countActivityEvents(
  activityLogs: Doc<"prospectActivityLog">[],
  type: Doc<"prospectActivityLog">["type"],
  window: TimeWindow
): number {
  return activityLogs.reduce((total, log) => {
    if (log.type !== type) return total;
    return isTimestampInWindow(log._creationTime, window) ? total + 1 : total;
  }, 0);
}

function hasReachedStage(
  prospect: Doc<"prospects">,
  targetStage: Exclude<PipelineStage, "new">
): boolean {
  const timestamp = prospect.stageTimestamps?.[targetStage];
  if (typeof timestamp === "number") {
    return true;
  }

  const stage = prospect.pipelineStage ?? prospect.status;
  if (
    stage !== "new" &&
    stage !== "contacted" &&
    stage !== "in_progress" &&
    stage !== "converted"
  ) {
    return false;
  }

  return PIPELINE_STAGE_RANK[stage] >= PIPELINE_STAGE_RANK[targetStage];
}

function isPendingApprovalTask(
  status: Doc<"outreachTasks">["status"]
): boolean {
  return status === "pending";
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

      const user = await getUserFromIdentity(ctx, identity, false);
      if (!user) {
        return createErrorResult("User not found", bucketSet);
      }

      const workspace = await ctx.db.get(args.workspaceId);
      if (!workspace || workspace.userId !== user._id) {
        return createErrorResult(
          "Workspace not found or access denied",
          bucketSet
        );
      }

      const [prospects, activityLogs, planGroups] = await Promise.all([
        ctx.db
          .query("prospects")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", args.workspaceId)
          )
          .collect(),
        ctx.db
          .query("prospectActivityLog")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", args.workspaceId)
          )
          .collect(),
        Promise.all(
          PLAN_STATUSES.map((status) =>
            ctx.db
              .query("outreachPlans")
              .withIndex("by_workspace_status", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("status", status)
              )
              .collect()
          )
        ),
      ]);

      const plans = planGroups.flat();

      const tasks = (
        await Promise.all(
          plans.map((plan) =>
            ctx.db
              .query("outreachTasks")
              .withIndex("by_plan", (q) => q.eq("planId", plan._id))
              .collect()
          )
        )
      ).flat();

      const currentProspects = prospects.filter((prospect) =>
        isTimestampInWindow(prospect._creationTime, normalizedWindow.current)
      );
      const previousProspects = prospects.filter((prospect) =>
        isTimestampInWindow(prospect._creationTime, normalizedWindow.previous)
      );

      const newProspects = buildMetric({
        currentValue: currentProspects.length,
        previousValue: previousProspects.length,
      });

      const contactedCurrent = countActivityEvents(
        activityLogs,
        "contacted",
        normalizedWindow.current
      );
      const contactedPrevious = countActivityEvents(
        activityLogs,
        "contacted",
        normalizedWindow.previous
      );
      const respondedCurrent = countActivityEvents(
        activityLogs,
        "responded",
        normalizedWindow.current
      );
      const respondedPrevious = countActivityEvents(
        activityLogs,
        "responded",
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

      const pendingPlansCurrent = plans.filter(
        (plan) =>
          plan.status === "draft" &&
          isTimestampInWindow(plan._creationTime, normalizedWindow.current)
      ).length;
      const pendingPlansPrevious = plans.filter(
        (plan) =>
          plan.status === "draft" &&
          isTimestampInWindow(plan._creationTime, normalizedWindow.previous)
      ).length;
      const pendingTasksCurrent = tasks.filter(
        (task) =>
          isPendingApprovalTask(task.status) &&
          isTimestampInWindow(task._creationTime, normalizedWindow.current)
      ).length;
      const pendingTasksPrevious = tasks.filter(
        (task) =>
          isPendingApprovalTask(task.status) &&
          isTimestampInWindow(task._creationTime, normalizedWindow.previous)
      ).length;
      const pendingApprovals = {
        ...buildMetric({
          currentValue: pendingPlansCurrent + pendingTasksCurrent,
          previousValue: pendingPlansPrevious + pendingTasksPrevious,
        }),
        plans: pendingPlansCurrent,
        tasks: pendingTasksCurrent,
      };

      const pausedPlansCurrent = plans.filter(
        (plan) =>
          plan.status === "paused" &&
          isTimestampInWindow(
            plan.updatedAt ?? plan._creationTime,
            normalizedWindow.current
          )
      ).length;
      const pausedPlansPrevious = plans.filter(
        (plan) =>
          plan.status === "paused" &&
          isTimestampInWindow(
            plan.updatedAt ?? plan._creationTime,
            normalizedWindow.previous
          )
      ).length;
      const failedTasksCurrent = tasks.filter(
        (task) =>
          task.status === "failed" &&
          isTimestampInWindow(
            task.executedAt ?? task._creationTime,
            normalizedWindow.current
          )
      ).length;
      const failedTasksPrevious = tasks.filter(
        (task) =>
          task.status === "failed" &&
          isTimestampInWindow(
            task.executedAt ?? task._creationTime,
            normalizedWindow.previous
          )
      ).length;

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

      const contactedProspects = currentProspects.filter((prospect) =>
        hasReachedStage(prospect, "contacted")
      ).length;
      const inProgressProspects = currentProspects.filter((prospect) =>
        hasReachedStage(prospect, "in_progress")
      ).length;
      const convertedProspects = currentProspects.filter((prospect) =>
        hasReachedStage(prospect, "converted")
      ).length;

      const pipelineFunnel = buildPipelineFunnel({
        newCount: currentProspects.length,
        contactedCount: contactedProspects,
        inProgressCount: inProgressProspects,
        convertedCount: convertedProspects,
      });

      const prospectCounts = countTimestampsByBucket(
        currentProspects.map((prospect) => prospect._creationTime),
        bucketSet
      );
      const contactedCounts = countTimestampsByBucket(
        activityLogs
          .filter((log) => log.type === "contacted")
          .filter((log) =>
            isTimestampInWindow(log._creationTime, normalizedWindow.current)
          )
          .map((log) => log._creationTime),
        bucketSet
      );

      const trendsOverTime = bucketSet.buckets.map((bucket, index) => ({
        date: bucket.label,
        prospects: prospectCounts[index] ?? 0,
        contacted: contactedCounts[index] ?? 0,
      }));

      const fitDistribution = [
        { range: "0-49", count: 0 },
        { range: "50-69", count: 0 },
        { range: "70-79", count: 0 },
        { range: "80-100", count: 0 },
      ];

      for (const prospect of currentProspects) {
        const rawScore =
          typeof prospect.qualificationScore === "number"
            ? prospect.qualificationScore
            : 0;
        const score = Math.max(0, Math.min(100, rawScore));

        if (score < 50) {
          fitDistribution[0].count += 1;
        } else if (score < 70) {
          fitDistribution[1].count += 1;
        } else if (score < 80) {
          fitDistribution[2].count += 1;
        } else {
          fitDistribution[3].count += 1;
        }
      }

      const twitterCount = currentProspects.filter(
        (prospect) => prospect.platform === "twitter"
      ).length;
      const linkedInCount = currentProspects.filter(
        (prospect) => prospect.platform === "linkedin"
      ).length;

      // The current schema only persists Twitter/LinkedIn prospects.
      // Keep other platforms as explicit placeholders for the dashboard shape.
      const platformDistribution = [
        { platform: "Twitter/X", count: twitterCount },
        { platform: "LinkedIn", count: linkedInCount },
        { platform: "Reddit", count: 0 },
        { platform: "Threads", count: 0 },
        { platform: "Bluesky", count: 0 },
      ];

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
