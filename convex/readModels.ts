import { Infer, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { action, internalMutation, query } from "./lib/functionBuilders";
import {
  buildProspectSummaryRecord,
  createEmptyWorkspaceStatsRecord,
  getWorkspaceAnalyticsContributionFromActivityLog,
  getWorkspaceAnalyticsContributionFromProspect,
  getWorkspaceAnalyticsContributionsFromPlan,
  getWorkspaceAnalyticsContributionsFromTask,
  getWorkspaceStatsContributionFromNotification,
  getWorkspaceStatsContributionFromProspect,
  isWorkspaceAnalyticsRecordEmpty,
  mergeWorkspaceAnalyticsContributions,
  mergeWorkspaceStatsContributions,
  type TargetedWorkspaceAnalyticsContribution,
  type WorkspaceAnalyticsDailyRecord,
} from "./lib/readModelHelpers";
import {
  createEmptyReadModelRolloutTotals,
  mergeReadModelRolloutTotals,
} from "./lib/readModelRolloutHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  readModelRebuildResultValidator,
  readModelRolloutScopeValidator,
  readModelRolloutTerminalStatusValidator,
} from "./validators";
import { requireUser } from "./lib/accessHelpers";
import { workflow as workflowManager } from "./lib/workflow";

const OUTREACH_PLAN_STATUSES = [
  "draft",
  "approved",
  "executing",
  "paused",
  "blocked_auth",
  "completed",
  "abandoned",
] as const;

type ReadModelRolloutScope = Infer<typeof readModelRolloutScopeValidator>;

type StartReadModelRolloutActionResult = {
  rolloutId: Id<"readModelRollouts">;
  workflowId: string;
  totalWorkspaceCount: number;
};

function applyAnalyticsContributionToMap(
  analyticsByDay: Map<string, WorkspaceAnalyticsDailyRecord>,
  targeted: TargetedWorkspaceAnalyticsContribution
) {
  const key = `${targeted.workspaceId}:${targeted.dayStartUtcMs}`;
  const current = analyticsByDay.get(key) ?? null;
  const next = mergeWorkspaceAnalyticsContributions(current, {
    workspaceId: targeted.workspaceId,
    dayStartUtcMs: targeted.dayStartUtcMs,
    add: [targeted.contribution],
  });

  if (isWorkspaceAnalyticsRecordEmpty(next)) {
    analyticsByDay.delete(key);
    return;
  }

  analyticsByDay.set(key, next);
}

export const rebuildWorkspaceReadModelsInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const existingSummaries = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const summary of existingSummaries) {
      await ctx.db.delete(summary._id);
    }

    const existingStats = await ctx.db
      .query("workspaceStats")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const stats of existingStats) {
      await ctx.db.delete(stats._id);
    }

    const existingAnalyticsRows = await ctx.db
      .query("workspaceAnalyticsDaily")
      .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const row of existingAnalyticsRows) {
      await ctx.db.delete(row._id);
    }

    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const activityLogs = await ctx.db
      .query("prospectActivityLog")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const notifications = await ctx.db
      .query("outreachNotifications")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const planGroups = await Promise.all(
      OUTREACH_PLAN_STATUSES.map((status) =>
        ctx.db
          .query("outreachPlans")
          .withIndex("by_workspace_status", (q) =>
            q.eq("workspaceId", workspaceId).eq("status", status)
          )
          .collect()
      )
    );
    const plans = planGroups.flat();

    let statsRecord = createEmptyWorkspaceStatsRecord({
      workspaceId,
      userId: workspace.userId,
    });
    const analyticsByDay = new Map<string, WorkspaceAnalyticsDailyRecord>();

    for (const prospect of prospects) {
      await ctx.db.insert(
        "prospectSummaries",
        buildProspectSummaryRecord(prospect)
      );

      statsRecord = mergeWorkspaceStatsContributions(statsRecord, {
        workspaceId,
        userId: workspace.userId,
        add: [getWorkspaceStatsContributionFromProspect(prospect)],
      });

      applyAnalyticsContributionToMap(
        analyticsByDay,
        getWorkspaceAnalyticsContributionFromProspect(prospect)
      );
    }

    for (const activity of activityLogs) {
      const targeted =
        getWorkspaceAnalyticsContributionFromActivityLog(activity);
      if (!targeted) {
        continue;
      }
      applyAnalyticsContributionToMap(analyticsByDay, targeted);
    }

    for (const plan of plans) {
      for (const targeted of getWorkspaceAnalyticsContributionsFromPlan(plan)) {
        applyAnalyticsContributionToMap(analyticsByDay, targeted);
      }

      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
        .collect();

      for (const task of tasks) {
        for (const targeted of getWorkspaceAnalyticsContributionsFromTask({
          task,
          workspaceId,
        })) {
          applyAnalyticsContributionToMap(analyticsByDay, targeted);
        }
      }
    }

    for (const notification of notifications) {
      statsRecord = mergeWorkspaceStatsContributions(statsRecord, {
        workspaceId,
        userId: workspace.userId,
        add: [getWorkspaceStatsContributionFromNotification(notification)],
      });
    }

    await ctx.db.insert("workspaceStats", statsRecord);

    for (const row of analyticsByDay.values()) {
      await ctx.db.insert("workspaceAnalyticsDaily", row);
    }

    return {
      workspaceId,
      prospectSummariesRebuilt: prospects.length,
      workspaceStatsRebuilt: true,
      analyticsRowsRebuilt: analyticsByDay.size,
      activityLogsProcessed: activityLogs.length,
      plansProcessed: plans.length,
      notificationsProcessed: notifications.length,
    };
  },
});

export const createReadModelRolloutInternal = internalMutation({
  args: {
    userId: v.id("users"),
    scope: readModelRolloutScopeValidator,
    requestedWorkspaceId: v.optional(v.id("workspaces")),
    totalWorkspaceCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    return await ctx.db.insert("readModelRollouts", {
      userId: args.userId,
      scope: args.scope,
      requestedWorkspaceId: args.requestedWorkspaceId,
      status: "queued",
      totalWorkspaceCount: args.totalWorkspaceCount,
      processedWorkspaceCount: 0,
      ...createEmptyReadModelRolloutTotals(),
      updatedAt: now,
    });
  },
});

export const markReadModelRolloutRunningInternal = internalMutation({
  args: {
    rolloutId: v.id("readModelRollouts"),
    workflowId: v.string(),
  },
  handler: async (ctx, { rolloutId, workflowId }) => {
    const rollout = await ctx.db.get(rolloutId);
    if (!rollout) {
      throw new Error("Read-model rollout not found");
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(rolloutId, {
      status: "running",
      workflowId,
      startedAt: rollout.startedAt ?? now,
      error: undefined,
      updatedAt: now,
    });
  },
});

export const markReadModelRolloutWorkspaceStartedInternal = internalMutation({
  args: {
    rolloutId: v.id("readModelRollouts"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { rolloutId, workspaceId }) => {
    const rollout = await ctx.db.get(rolloutId);
    if (!rollout) {
      throw new Error("Read-model rollout not found");
    }

    await ctx.db.patch(rolloutId, {
      currentWorkspaceId: workspaceId,
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const recordReadModelRolloutWorkspaceCompletedInternal =
  internalMutation({
    args: {
      rolloutId: v.id("readModelRollouts"),
      workspaceId: v.id("workspaces"),
      result: readModelRebuildResultValidator,
    },
    handler: async (ctx, { rolloutId, workspaceId, result }) => {
      const rollout = await ctx.db.get(rolloutId);
      if (!rollout) {
        throw new Error("Read-model rollout not found");
      }

      const nextTotals = mergeReadModelRolloutTotals(rollout, result);
      await ctx.db.patch(rolloutId, {
        processedWorkspaceCount: rollout.processedWorkspaceCount + 1,
        currentWorkspaceId: undefined,
        lastCompletedWorkspaceId: workspaceId,
        ...nextTotals,
        updatedAt: getCurrentUTCTimestamp(),
      });
    },
  });

export const markReadModelRolloutTerminalInternal = internalMutation({
  args: {
    rolloutId: v.id("readModelRollouts"),
    status: readModelRolloutTerminalStatusValidator,
    error: v.optional(v.string()),
  },
  handler: async (ctx, { rolloutId, status, error }) => {
    const rollout = await ctx.db.get(rolloutId);
    if (!rollout) {
      throw new Error("Read-model rollout not found");
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(rolloutId, {
      status,
      error,
      currentWorkspaceId: undefined,
      completedAt: now,
      updatedAt: now,
    });
  },
});

export const markReadModelRolloutCleanupScheduledInternal = internalMutation({
  args: {
    rolloutId: v.id("readModelRollouts"),
    cleanupScheduledAt: v.number(),
  },
  handler: async (ctx, { rolloutId, cleanupScheduledAt }) => {
    const rollout = await ctx.db.get(rolloutId);
    if (!rollout) {
      throw new Error("Read-model rollout not found");
    }

    await ctx.db.patch(rolloutId, {
      cleanupScheduledAt,
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const markReadModelRolloutCleanedUpInternal = internalMutation({
  args: {
    rolloutId: v.id("readModelRollouts"),
  },
  handler: async (ctx, { rolloutId }) => {
    const rollout = await ctx.db.get(rolloutId);
    if (!rollout) {
      throw new Error("Read-model rollout not found");
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(rolloutId, {
      cleanedUpAt: now,
      updatedAt: now,
    });
  },
});

export const getReadModelRollout = query({
  args: {
    rolloutId: v.id("readModelRollouts"),
  },
  handler: async (ctx, { rolloutId }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const rollout = await ctx.db.get(rolloutId);
    if (!rollout || rollout.userId !== user._id) {
      return null;
    }
    return rollout;
  },
});

export const getLatestReadModelRollout = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    return await ctx.db
      .query("readModelRollouts")
      .withIndex("by_user_updated", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
  },
});

export const rebuildWorkspaceReadModels = action({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (
    ctx,
    { workspaceId }
  ): Promise<StartReadModelRolloutActionResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    let workspaceIds: Id<"workspaces">[] = [];
    let scope: ReadModelRolloutScope = "all_workspaces";

    if (workspaceId) {
      const workspace = await ctx.runQuery(internal.workspaces.getById, {
        workspaceId,
      });
      if (!workspace || workspace.userId !== user._id) {
        throw new Error("Workspace not found");
      }
      workspaceIds = [workspaceId];
      scope = "workspace";
    } else {
      const workspaces = await ctx.runQuery(
        api.workspaces.getUserWorkspaces,
        {}
      );
      workspaceIds = workspaces.map(
        (workspace: (typeof workspaces)[number]) => workspace._id
      );
    }

    if (workspaceIds.length === 0) {
      throw new Error("No workspaces found to rebuild");
    }

    const rolloutId = await ctx.runMutation(
      internal.readModels.createReadModelRolloutInternal,
      {
        userId: user._id,
        scope,
        requestedWorkspaceId: workspaceId,
        totalWorkspaceCount: workspaceIds.length,
      }
    );

    try {
      const workflowId = await workflowManager.start(
        ctx,
        internal.workflows.readModels.readModelRolloutWorkflow,
        {
          rolloutId,
          userId: user._id,
          workspaceIds,
        },
        {
          onComplete:
            internal.workflows.readModels.handleReadModelRolloutComplete,
          context: { rolloutId },
        }
      );

      return {
        rolloutId,
        workflowId: workflowId.toString(),
        totalWorkspaceCount: workspaceIds.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start workflow";
      await ctx.runMutation(
        internal.readModels.markReadModelRolloutTerminalInternal,
        {
          rolloutId,
          status: "failed",
          error: errorMessage,
        }
      );
      throw error;
    }
  },
});
