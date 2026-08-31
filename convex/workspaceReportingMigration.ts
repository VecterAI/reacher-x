import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import {
  aggregateRolloutStatusValidator,
  workspaceReportingMigrationStageValidator,
} from "./validators";
import {
  AGENT_OPS_HOURLY_FIELDS,
  getWorkspaceAgentOpsContributionsFromEvaluatorRun,
  getWorkspaceAgentOpsContributionsFromKeyword,
  getWorkspaceAgentOpsContributionsFromMemoryInventory,
  getWorkspaceAgentOpsContributionsFromMemorySuggestion,
  getWorkspaceAgentOpsContributionsFromQueryCandidate,
  getWorkspaceAgentOpsContributionsFromWorkflowEvent,
  normalizeWorkspaceAgentOpsDailyRecord,
} from "./lib/agentOpsReadModelHelpers";
import {
  WORKSPACE_ANALYTICS_HOURLY_FIELDS,
  coerceWorkspaceAnalyticsDailyForMerge,
  getWorkspaceAnalyticsContributionFromActivityLog,
  getWorkspaceAnalyticsContributionsFromPlan,
  getWorkspaceAnalyticsContributionsFromProspect,
  getWorkspaceAnalyticsContributionsFromTask,
} from "./lib/readModelHelpers";
import {
  clearWorkspaceReportingAggregate,
  getWorkspaceReportingMetricSums,
  syncWorkspaceAgentOpsReportingAggregate,
  syncWorkspaceAnalyticsReportingAggregate,
  syncWorkspaceQualifiedUsageAggregate,
  WORKSPACE_REPORTING_AGGREGATE_VERSION,
} from "./lib/workspaceReportingAggregate";
import { isWorkspaceSafeForAggregateMigration } from "./lib/aggregateMigrationHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { shouldCountQualifiedProspectUsageInWindow } from "./lib/planQualifiedUsageCore";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;
const VERIFY_BATCH_SIZE = 50;
const MAX_PREPARATION_FAILURES = 3;
const PREPARATION_RETRY_MS = 5 * 1000;
const PREPARATION_WATCHDOG_MS = 9 * 60 * 1000;
const MIN_TIMESTAMP = Number.MIN_SAFE_INTEGER;
const MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER;

type MigrationStage = Infer<typeof workspaceReportingMigrationStageValidator>;
type MigrationStatus = Infer<typeof aggregateRolloutStatusValidator>;

type PreparationReadModelResults = {
  analytics: {
    workspaceId: Id<"workspaces">;
    analyticsRowsRebuilt: number;
    prospectsProcessed: number;
    activityLogsProcessed: number;
    plansProcessed: number;
    tasksProcessed: number;
  };
  agentOps: {
    workspaceId: Id<"workspaces">;
    agentOpsRowsRebuilt: number;
    queryPerformanceRowsRebuilt: number;
  };
};

const BACKFILL_STAGES = [
  "prospects",
  "prospectActivityLog",
  "outreachPlans",
  "outreachTasks",
  "keywords",
  "queryCandidates",
  "memorySuggestions",
  "memoryWorkflowEvents",
  "memoryEvaluatorRuns",
  "workspaceAgentMemoryInventory",
] as const satisfies readonly MigrationStage[];

const VERIFY_STAGES = [
  "verifyAnalyticsDaily",
  "verifyAnalyticsStripes",
  "verifyAgentOpsDaily",
  "verifyAgentOpsStripes",
] as const satisfies readonly MigrationStage[];

function zeroes(length: number) {
  return Array.from({ length }, () => 0);
}

function nextStage(stage: MigrationStage): MigrationStage | null {
  const stages = [...BACKFILL_STAGES, ...VERIFY_STAGES];
  const index = stages.indexOf(stage);
  if (index < 0) {
    throw new Error(`Unknown reporting migration stage: ${stage}`);
  }
  return stages[index + 1] ?? null;
}

function clampBatchSize(value: number | undefined) {
  return Math.max(
    1,
    Math.min(MAX_BATCH_SIZE, Math.floor(value ?? DEFAULT_BATCH_SIZE))
  );
}

function valuesEqual(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => Math.abs(value - (right[index] ?? 0)) < 1e-6)
  );
}

async function scheduleNextPage(
  ctx: Parameters<typeof clearWorkspaceReportingAggregate>[0],
  args: {
    rolloutId: Id<"workspaceReportingRollouts">;
    revision: number;
    cursor: string | null;
  }
) {
  await ctx.scheduler.runAfter(
    0,
    internal.workspaceReportingMigration.runWorkspaceMigrationPageInternal,
    args
  );
}

async function rebuildPreparationReadModels(
  ctx: ActionCtx,
  workspaceId: Id<"workspaces">
): Promise<PreparationReadModelResults> {
  const analytics = await ctx.runAction(
    internal.workspaceAnalyticsDaily.rebuildWorkspaceAnalyticsDailyInternal,
    { workspaceId }
  );
  const agentOps = await ctx.runAction(
    internal.agentOpsReadModels.rebuildWorkspaceAgentOpsReadModelsInternal,
    { workspaceId }
  );
  return { analytics, agentOps };
}

async function resetWorkspaceMigration(
  ctx: Parameters<typeof clearWorkspaceReportingAggregate>[0],
  args: {
    workspace: Doc<"workspaces">;
    existing: Doc<"workspaceReportingRollouts"> | null;
    batchSize?: number;
    status: "preparing" | "backfilling";
  }
) {
  await clearWorkspaceReportingAggregate(ctx, args.workspace._id);
  const now = getCurrentUTCTimestamp();
  const revision = (args.existing?.revision ?? 0) + 1;
  const record = {
    workspaceId: args.workspace._id,
    userId: args.workspace.userId,
    status: args.status,
    aggregateVersion: WORKSPACE_REPORTING_AGGREGATE_VERSION,
    revision,
    preparationVersion: args.status === "preparing" ? 0 : undefined,
    preparationFailureCount: args.status === "preparing" ? 0 : undefined,
    stage: "prospects" as const,
    cursor: undefined,
    batchSize: clampBatchSize(args.batchSize),
    backfilledCount: 0,
    verifiedSourceCount: 0,
    expectedAnalyticsSums: zeroes(WORKSPACE_ANALYTICS_HOURLY_FIELDS.length),
    expectedAgentOpsSums: zeroes(AGENT_OPS_HOURLY_FIELDS.length),
    expectedQualifiedUsageCount: 0,
    aggregateAnalyticsSums: undefined,
    aggregateAgentOpsSums: undefined,
    aggregateQualifiedUsageCount: undefined,
    error: undefined,
    startedAt: now,
    verifiedAt: undefined,
    updatedAt: now,
  };
  const rolloutId = args.existing
    ? args.existing._id
    : await ctx.db.insert("workspaceReportingRollouts", record);
  if (args.existing) {
    await ctx.db.replace(
      "workspaceReportingRollouts",
      args.existing._id,
      record
    );
  }
  return { rolloutId, revision };
}

export const startWorkspaceMigrationInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    batchSize: v.optional(v.number()),
    restart: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get("workspaces", args.workspaceId);
    if (!workspace || !isWorkspaceSafeForAggregateMigration(workspace)) {
      throw new Error(
        "Reporting Aggregate migration requires an existing, non-deleting workspace that is inactive or has never started prospecting"
      );
    }
    const existing = await ctx.db
      .query("workspaceReportingRollouts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (
      existing?.status === "verified" &&
      existing.aggregateVersion === WORKSPACE_REPORTING_AGGREGATE_VERSION &&
      !args.restart
    ) {
      return {
        rolloutId: existing._id,
        status: existing.status,
        revision: existing.revision,
        alreadyActive: true,
      };
    }
    if (
      existing &&
      existing.status !== "failed" &&
      existing.aggregateVersion === WORKSPACE_REPORTING_AGGREGATE_VERSION &&
      !args.restart
    ) {
      return {
        rolloutId: existing._id,
        status: existing.status,
        revision: existing.revision,
        alreadyActive: true,
      };
    }

    const { rolloutId, revision } = await resetWorkspaceMigration(ctx, {
      workspace,
      existing,
      batchSize: args.batchSize,
      status: "backfilling",
    });
    await scheduleNextPage(ctx, { rolloutId, revision, cursor: null });
    return {
      rolloutId,
      status: "backfilling" as const,
      revision,
      alreadyActive: false,
    };
  },
});

export const beginWorkspaceMigrationPreparationInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    batchSize: v.optional(v.number()),
    restart: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get("workspaces", args.workspaceId);
    if (!workspace || !isWorkspaceSafeForAggregateMigration(workspace)) {
      throw new Error(
        "Reporting Aggregate migration requires an existing, non-deleting workspace that is inactive or has never started prospecting"
      );
    }
    const existing = await ctx.db
      .query("workspaceReportingRollouts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (
      existing &&
      existing.status !== "failed" &&
      existing.aggregateVersion === WORKSPACE_REPORTING_AGGREGATE_VERSION &&
      !args.restart
    ) {
      return {
        rolloutId: existing._id,
        status: existing.status,
        revision: existing.revision,
        preparationVersion: existing.preparationVersion ?? 0,
        alreadyActive: true,
      };
    }

    const { rolloutId, revision } = await resetWorkspaceMigration(ctx, {
      workspace,
      existing,
      batchSize: args.batchSize,
      status: "preparing",
    });
    await ctx.scheduler.runAfter(
      PREPARATION_WATCHDOG_MS,
      internal.workspaceReportingMigration
        .continueWorkspaceMigrationPreparationInternal,
      { rolloutId, revision }
    );
    return {
      rolloutId,
      status: "preparing" as const,
      revision,
      preparationVersion: 0,
      alreadyActive: false,
    };
  },
});

export const completeWorkspaceMigrationPreparationInternal = internalMutation({
  args: {
    rolloutId: v.id("workspaceReportingRollouts"),
    revision: v.number(),
    expectedPreparationVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const rollout = await ctx.db.get(
      "workspaceReportingRollouts",
      args.rolloutId
    );
    if (
      !rollout ||
      rollout.revision !== args.revision ||
      rollout.status !== "preparing"
    ) {
      return {
        status: rollout?.status ?? ("failed" as const),
        started: false,
        preparationVersion: rollout?.preparationVersion ?? 0,
      };
    }

    const preparationVersion = rollout.preparationVersion ?? 0;
    if (preparationVersion !== args.expectedPreparationVersion) {
      await ctx.db.patch("workspaceReportingRollouts", rollout._id, {
        preparationFailureCount: 0,
        error: undefined,
        updatedAt: getCurrentUTCTimestamp(),
      });
      await ctx.scheduler.runAfter(
        0,
        internal.workspaceReportingMigration
          .continueWorkspaceMigrationPreparationInternal,
        { rolloutId: rollout._id, revision: rollout.revision }
      );
      return {
        status: "preparing" as const,
        started: false,
        preparationVersion,
      };
    }

    await ctx.db.patch("workspaceReportingRollouts", rollout._id, {
      status: "backfilling",
      preparationFailureCount: 0,
      error: undefined,
      updatedAt: getCurrentUTCTimestamp(),
    });
    await scheduleNextPage(ctx, {
      rolloutId: rollout._id,
      revision: rollout.revision,
      cursor: null,
    });
    return {
      status: "backfilling" as const,
      started: true,
      preparationVersion,
    };
  },
});

export const recordWorkspaceMigrationPreparationFailureInternal =
  internalMutation({
    args: {
      rolloutId: v.id("workspaceReportingRollouts"),
      revision: v.number(),
      error: v.string(),
    },
    handler: async (ctx, args) => {
      const rollout = await ctx.db.get(
        "workspaceReportingRollouts",
        args.rolloutId
      );
      if (
        !rollout ||
        rollout.revision !== args.revision ||
        rollout.status !== "preparing"
      ) {
        return { status: rollout?.status ?? ("failed" as const) };
      }

      const preparationFailureCount =
        (rollout.preparationFailureCount ?? 0) + 1;
      if (preparationFailureCount >= MAX_PREPARATION_FAILURES) {
        await ctx.db.patch("workspaceReportingRollouts", rollout._id, {
          status: "failed",
          preparationFailureCount,
          error: args.error,
          updatedAt: getCurrentUTCTimestamp(),
        });
        return { status: "failed" as const };
      }

      await ctx.db.patch("workspaceReportingRollouts", rollout._id, {
        preparationFailureCount,
        error: args.error,
        updatedAt: getCurrentUTCTimestamp(),
      });
      await ctx.scheduler.runAfter(
        PREPARATION_RETRY_MS * preparationFailureCount,
        internal.workspaceReportingMigration
          .continueWorkspaceMigrationPreparationInternal,
        { rolloutId: rollout._id, revision: rollout.revision }
      );
      return { status: "preparing" as const };
    },
  });

export const continueWorkspaceMigrationPreparationInternal = internalAction({
  args: {
    rolloutId: v.id("workspaceReportingRollouts"),
    revision: v.number(),
  },
  handler: async (ctx, args): Promise<{ status: MigrationStatus }> => {
    const rollout = await ctx.runQuery(
      internal.workspaceReportingMigration
        .getWorkspaceMigrationStatusByIdInternal,
      { rolloutId: args.rolloutId }
    );
    if (
      !rollout ||
      rollout.revision !== args.revision ||
      rollout.status !== "preparing"
    ) {
      return { status: rollout?.status ?? "failed" };
    }

    const expectedPreparationVersion = rollout.preparationVersion ?? 0;
    try {
      await rebuildPreparationReadModels(ctx, rollout.workspaceId);
    } catch (error) {
      const failure: { status: MigrationStatus } = await ctx.runMutation(
        internal.workspaceReportingMigration
          .recordWorkspaceMigrationPreparationFailureInternal,
        {
          rolloutId: rollout._id,
          revision: rollout.revision,
          error:
            error instanceof Error
              ? error.message
              : "Reporting preparation rebuild failed",
        }
      );
      return failure;
    }
    const completion: {
      status: MigrationStatus;
      started: boolean;
      preparationVersion: number;
    } = await ctx.runMutation(
      internal.workspaceReportingMigration
        .completeWorkspaceMigrationPreparationInternal,
      {
        rolloutId: rollout._id,
        revision: rollout.revision,
        expectedPreparationVersion,
      }
    );
    return { status: completion.status };
  },
});

/**
 * Repairs the memory inventory mirror and rebuilds the current Analytics and
 * Agent Ops read models behind a write fence before starting the exact
 * Aggregate migration. If a relevant source write lands during rebuilding, a
 * durable continuation repeats the preparation pass before backfill begins.
 * Operators should use this entry point; the mutation above remains the
 * resumable/testable core.
 */
export const prepareAndStartWorkspaceMigrationInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    batchSize: v.optional(v.number()),
    restart: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    rolloutId: Id<"workspaceReportingRollouts">;
    status: MigrationStatus;
    revision: number;
    alreadyActive: boolean;
    prepared: boolean;
    inventoryBackfill: {
      scanned: number;
      inserted: number;
      existing: number;
    } | null;
    analyticsReadModelRebuild: {
      analyticsRowsRebuilt: number;
      prospectsProcessed: number;
      activityLogsProcessed: number;
      plansProcessed: number;
      tasksProcessed: number;
    } | null;
    agentOpsReadModelRebuild: {
      agentOpsRowsRebuilt: number;
      queryPerformanceRowsRebuilt: number;
    } | null;
  }> => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });
    if (!workspace || !isWorkspaceSafeForAggregateMigration(workspace)) {
      throw new Error(
        "Reporting Aggregate migration requires an existing, non-deleting workspace that is inactive or has never started prospecting"
      );
    }
    const existing = await ctx.runQuery(
      internal.workspaceReportingMigration.getWorkspaceMigrationStatusInternal,
      { workspaceId: args.workspaceId }
    );
    if (
      existing &&
      existing.status !== "failed" &&
      existing.aggregateVersion === WORKSPACE_REPORTING_AGGREGATE_VERSION &&
      !args.restart
    ) {
      return {
        rolloutId: existing._id,
        status: existing.status,
        revision: existing.revision,
        alreadyActive: true,
        prepared: false,
        inventoryBackfill: null,
        analyticsReadModelRebuild: null,
        agentOpsReadModelRebuild: null,
      };
    }

    const inventoryBackfill = await ctx.runAction(
      internal.memory.backfillWorkspaceAgentMemoryInventoryInternal,
      { workspaceId: args.workspaceId, userId: workspace.userId }
    );
    const preparation: {
      rolloutId: Id<"workspaceReportingRollouts">;
      status: MigrationStatus;
      revision: number;
      preparationVersion: number;
      alreadyActive: boolean;
    } = await ctx.runMutation(
      internal.workspaceReportingMigration
        .beginWorkspaceMigrationPreparationInternal,
      args
    );
    if (preparation.alreadyActive) {
      return {
        rolloutId: preparation.rolloutId,
        status: preparation.status,
        revision: preparation.revision,
        alreadyActive: true,
        prepared: false,
        inventoryBackfill: null,
        analyticsReadModelRebuild: null,
        agentOpsReadModelRebuild: null,
      };
    }

    const rebuilt = await rebuildPreparationReadModels(ctx, args.workspaceId);
    const completion: {
      status: MigrationStatus;
      started: boolean;
      preparationVersion: number;
    } = await ctx.runMutation(
      internal.workspaceReportingMigration
        .completeWorkspaceMigrationPreparationInternal,
      {
        rolloutId: preparation.rolloutId,
        revision: preparation.revision,
        expectedPreparationVersion: preparation.preparationVersion,
      }
    );

    return {
      rolloutId: preparation.rolloutId,
      status: completion.status,
      revision: preparation.revision,
      alreadyActive: false,
      prepared: true,
      inventoryBackfill,
      analyticsReadModelRebuild: {
        analyticsRowsRebuilt: rebuilt.analytics.analyticsRowsRebuilt,
        prospectsProcessed: rebuilt.analytics.prospectsProcessed,
        activityLogsProcessed: rebuilt.analytics.activityLogsProcessed,
        plansProcessed: rebuilt.analytics.plansProcessed,
        tasksProcessed: rebuilt.analytics.tasksProcessed,
      },
      agentOpsReadModelRebuild: {
        agentOpsRowsRebuilt: rebuilt.agentOps.agentOpsRowsRebuilt,
        queryPerformanceRowsRebuilt:
          rebuilt.agentOps.queryPerformanceRowsRebuilt,
      },
    };
  },
});

async function backfillStagePage(
  ctx: Parameters<typeof clearWorkspaceReportingAggregate>[0],
  rollout: Doc<"workspaceReportingRollouts">,
  cursor: string | null
) {
  const paginationOpts = {
    cursor,
    numItems:
      rollout.stage === "outreachTasks"
        ? 1
        : rollout.stage === "prospects"
          ? Math.min(10, rollout.batchSize)
          : rollout.batchSize,
  };
  let expectedQualifiedUsageCount = rollout.expectedQualifiedUsageCount;

  if (rollout.stage === "prospects") {
    const page = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", rollout.workspaceId)
      )
      .paginate(paginationOpts);
    for (const prospect of page.page) {
      await syncWorkspaceAnalyticsReportingAggregate(ctx, {
        sourceKey: `prospects:${String(prospect._id)}`,
        add: getWorkspaceAnalyticsContributionsFromProspect(prospect),
      });
      await syncWorkspaceQualifiedUsageAggregate(ctx, {
        sourceKey: `prospects:${String(prospect._id)}`,
        oldProspect: null,
        newProspect: prospect,
      });
      if (
        shouldCountQualifiedProspectUsageInWindow(
          { cycleStart: MIN_TIMESTAMP, cycleEnd: MAX_TIMESTAMP },
          prospect
        )
      ) {
        expectedQualifiedUsageCount += 1;
      }
    }
    return { page, expectedQualifiedUsageCount, processed: page.page.length };
  }

  if (rollout.stage === "prospectActivityLog") {
    const page = await ctx.db
      .query("prospectActivityLog")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", rollout.workspaceId)
      )
      .paginate(paginationOpts);
    for (const activity of page.page) {
      const contribution =
        getWorkspaceAnalyticsContributionFromActivityLog(activity);
      await syncWorkspaceAnalyticsReportingAggregate(ctx, {
        sourceKey: `prospectActivityLog:${String(activity._id)}`,
        add: contribution ? [contribution] : [],
      });
    }
    return { page, expectedQualifiedUsageCount, processed: page.page.length };
  }

  if (rollout.stage === "outreachPlans") {
    const page = await ctx.db
      .query("outreachPlans")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", rollout.workspaceId)
      )
      .paginate(paginationOpts);
    for (const plan of page.page) {
      await syncWorkspaceAnalyticsReportingAggregate(ctx, {
        sourceKey: `outreachPlans:${String(plan._id)}`,
        add: getWorkspaceAnalyticsContributionsFromPlan(plan),
      });
    }
    return { page, expectedQualifiedUsageCount, processed: page.page.length };
  }

  if (rollout.stage === "outreachTasks") {
    const page = await ctx.db
      .query("outreachPlans")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", rollout.workspaceId)
      )
      .paginate(paginationOpts);
    let processed = 0;
    for (const plan of page.page) {
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
        .take(101);
      if (tasks.length > 100) {
        throw new Error(
          `Outreach plan ${String(plan._id)} exceeds the 100-task migration safety bound`
        );
      }
      for (const task of tasks) {
        await syncWorkspaceAnalyticsReportingAggregate(ctx, {
          sourceKey: `outreachTasks:${String(task._id)}`,
          add: getWorkspaceAnalyticsContributionsFromTask({
            task,
            workspaceId: rollout.workspaceId,
          }),
        });
        processed += 1;
      }
    }
    return { page, expectedQualifiedUsageCount, processed };
  }

  const agentOpsPage =
    rollout.stage === "keywords"
      ? await ctx.db
          .query("keywords")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", rollout.workspaceId)
          )
          .paginate(paginationOpts)
      : rollout.stage === "queryCandidates"
        ? await ctx.db
            .query("queryCandidates")
            .withIndex("by_workspace_updated_at", (q) =>
              q.eq("workspaceId", rollout.workspaceId)
            )
            .paginate(paginationOpts)
        : rollout.stage === "memorySuggestions"
          ? await ctx.db
              .query("memorySuggestions")
              .withIndex("by_workspace_updated_at", (q) =>
                q.eq("workspaceId", rollout.workspaceId)
              )
              .paginate(paginationOpts)
          : rollout.stage === "memoryWorkflowEvents"
            ? await ctx.db
                .query("memoryWorkflowEvents")
                .withIndex("by_workspace_occurred_at", (q) =>
                  q.eq("workspaceId", rollout.workspaceId)
                )
                .paginate(paginationOpts)
            : rollout.stage === "memoryEvaluatorRuns"
              ? await ctx.db
                  .query("memoryEvaluatorRuns")
                  .withIndex("by_workspace_updated_at", (q) =>
                    q.eq("workspaceId", rollout.workspaceId)
                  )
                  .paginate(paginationOpts)
              : await ctx.db
                  .query("workspaceAgentMemoryInventory")
                  .withIndex("by_workspace_created_at", (q) =>
                    q.eq("workspaceId", rollout.workspaceId)
                  )
                  .paginate(paginationOpts);

  for (const row of agentOpsPage.page) {
    const contributions =
      rollout.stage === "keywords"
        ? getWorkspaceAgentOpsContributionsFromKeyword(row as Doc<"keywords">)
        : rollout.stage === "queryCandidates"
          ? getWorkspaceAgentOpsContributionsFromQueryCandidate(
              row as Doc<"queryCandidates">
            )
          : rollout.stage === "memorySuggestions"
            ? getWorkspaceAgentOpsContributionsFromMemorySuggestion(
                row as Doc<"memorySuggestions">
              )
            : rollout.stage === "memoryWorkflowEvents"
              ? getWorkspaceAgentOpsContributionsFromWorkflowEvent(
                  row as Doc<"memoryWorkflowEvents">
                )
              : rollout.stage === "memoryEvaluatorRuns"
                ? getWorkspaceAgentOpsContributionsFromEvaluatorRun(
                    row as Doc<"memoryEvaluatorRuns">
                  )
                : getWorkspaceAgentOpsContributionsFromMemoryInventory(
                    row as Doc<"workspaceAgentMemoryInventory">
                  );
    await syncWorkspaceAgentOpsReportingAggregate(ctx, {
      sourceKey: `${rollout.stage}:${String(row._id)}`,
      add: contributions,
    });
  }
  return {
    page: agentOpsPage,
    expectedQualifiedUsageCount,
    processed: agentOpsPage.page.length,
  };
}

function addHourlySums(
  totals: number[],
  row: Record<string, unknown>,
  fields: readonly string[]
) {
  fields.forEach((field, fieldIndex) => {
    const values = Array.isArray(row[field]) ? (row[field] as number[]) : [];
    totals[fieldIndex] =
      (totals[fieldIndex] ?? 0) + values.reduce((sum, value) => sum + value, 0);
  });
}

async function verifyStagePage(
  ctx: Parameters<typeof clearWorkspaceReportingAggregate>[0],
  rollout: Doc<"workspaceReportingRollouts">,
  cursor: string | null
) {
  const paginationOpts = { cursor, numItems: VERIFY_BATCH_SIZE };
  const analytics = [...rollout.expectedAnalyticsSums];
  const agentOps = [...rollout.expectedAgentOpsSums];

  const page =
    rollout.stage === "verifyAnalyticsDaily"
      ? await ctx.db
          .query("workspaceAnalyticsDaily")
          .withIndex("by_workspace_day", (q) =>
            q.eq("workspaceId", rollout.workspaceId)
          )
          .paginate(paginationOpts)
      : rollout.stage === "verifyAnalyticsStripes"
        ? await ctx.db
            .query("workspaceAnalyticsDailyStripes")
            .withIndex("by_workspace_day_and_stripe", (q) =>
              q.eq("workspaceId", rollout.workspaceId)
            )
            .paginate(paginationOpts)
        : rollout.stage === "verifyAgentOpsDaily"
          ? await ctx.db
              .query("workspaceAgentOpsDaily")
              .withIndex("by_workspace_day", (q) =>
                q.eq("workspaceId", rollout.workspaceId)
              )
              .paginate(paginationOpts)
          : await ctx.db
              .query("workspaceAgentOpsDailyStripes")
              .withIndex("by_workspace_day_and_stripe", (q) =>
                q.eq("workspaceId", rollout.workspaceId)
              )
              .paginate(paginationOpts);

  for (const row of page.page) {
    if (
      rollout.stage === "verifyAnalyticsDaily" ||
      rollout.stage === "verifyAnalyticsStripes"
    ) {
      const normalized =
        rollout.stage === "verifyAnalyticsDaily"
          ? coerceWorkspaceAnalyticsDailyForMerge(
              row as Doc<"workspaceAnalyticsDaily">
            )
          : row;
      addHourlySums(
        analytics,
        normalized as unknown as Record<string, unknown>,
        WORKSPACE_ANALYTICS_HOURLY_FIELDS
      );
    } else {
      const normalized = normalizeWorkspaceAgentOpsDailyRecord(
        row as Doc<"workspaceAgentOpsDaily">
      );
      addHourlySums(
        agentOps,
        normalized as unknown as Record<string, unknown>,
        AGENT_OPS_HOURLY_FIELDS
      );
    }
  }

  return { page, analytics, agentOps };
}

export const runWorkspaceMigrationPageInternal = internalMutation({
  args: {
    rolloutId: v.id("workspaceReportingRollouts"),
    revision: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args): Promise<{ status: MigrationStatus }> => {
    const rollout = await ctx.db.get(
      "workspaceReportingRollouts",
      args.rolloutId
    );
    if (
      !rollout ||
      rollout.revision !== args.revision ||
      (rollout.cursor ?? null) !== args.cursor ||
      (rollout.status !== "backfilling" && rollout.status !== "verifying")
    ) {
      return { status: rollout?.status ?? "failed" };
    }
    const workspace = await ctx.db.get("workspaces", rollout.workspaceId);
    if (!workspace || !isWorkspaceSafeForAggregateMigration(workspace)) {
      await ctx.db.patch(args.rolloutId, {
        status: "failed",
        error: "Workspace became active or deletion began during migration",
        updatedAt: getCurrentUTCTimestamp(),
      });
      return { status: "failed" };
    }

    try {
      if (rollout.status === "backfilling") {
        const result = await backfillStagePage(ctx, rollout, args.cursor);
        const stage = result.page.isDone
          ? (nextStage(rollout.stage) ?? rollout.stage)
          : rollout.stage;
        const status = VERIFY_STAGES.includes(
          stage as (typeof VERIFY_STAGES)[number]
        )
          ? "verifying"
          : "backfilling";
        const cursor = result.page.isDone
          ? undefined
          : result.page.continueCursor;
        await ctx.db.patch(args.rolloutId, {
          status,
          stage,
          cursor,
          backfilledCount: rollout.backfilledCount + result.processed,
          expectedQualifiedUsageCount: result.expectedQualifiedUsageCount,
          updatedAt: getCurrentUTCTimestamp(),
        });
        await scheduleNextPage(ctx, {
          rolloutId: args.rolloutId,
          revision: args.revision,
          cursor: cursor ?? null,
        });
        return { status };
      }

      const result = await verifyStagePage(ctx, rollout, args.cursor);
      if (!result.page.isDone) {
        await ctx.db.patch(args.rolloutId, {
          cursor: result.page.continueCursor,
          expectedAnalyticsSums: result.analytics,
          expectedAgentOpsSums: result.agentOps,
          verifiedSourceCount:
            rollout.verifiedSourceCount + result.page.page.length,
          updatedAt: getCurrentUTCTimestamp(),
        });
        await scheduleNextPage(ctx, {
          rolloutId: args.rolloutId,
          revision: args.revision,
          cursor: result.page.continueCursor,
        });
        return { status: "verifying" };
      }

      const followingStage = nextStage(rollout.stage);
      if (followingStage) {
        await ctx.db.patch(args.rolloutId, {
          stage: followingStage,
          cursor: undefined,
          expectedAnalyticsSums: result.analytics,
          expectedAgentOpsSums: result.agentOps,
          verifiedSourceCount:
            rollout.verifiedSourceCount + result.page.page.length,
          updatedAt: getCurrentUTCTimestamp(),
        });
        await scheduleNextPage(ctx, {
          rolloutId: args.rolloutId,
          revision: args.revision,
          cursor: null,
        });
        return { status: "verifying" };
      }

      const aggregateAnalyticsSums = await getWorkspaceReportingMetricSums(
        ctx,
        {
          workspaceId: rollout.workspaceId,
          dataset: "analytics",
          queries: WORKSPACE_ANALYTICS_HOURLY_FIELDS.map((metric) => ({
            metric,
            startMs: MIN_TIMESTAMP,
            endMs: MAX_TIMESTAMP,
          })),
        }
      );
      const aggregateAgentOpsSums = await getWorkspaceReportingMetricSums(ctx, {
        workspaceId: rollout.workspaceId,
        dataset: "agentOps",
        queries: AGENT_OPS_HOURLY_FIELDS.map((metric) => ({
          metric,
          startMs: MIN_TIMESTAMP,
          endMs: MAX_TIMESTAMP,
        })),
      });
      const [aggregateQualifiedUsageCount = 0] =
        await getWorkspaceReportingMetricSums(ctx, {
          workspaceId: rollout.workspaceId,
          dataset: "usage",
          queries: [
            {
              metric: "qualifiedProspectsCount",
              startMs: MIN_TIMESTAMP,
              endMs: MAX_TIMESTAMP,
            },
          ],
        });
      const verified =
        valuesEqual(result.analytics, aggregateAnalyticsSums) &&
        valuesEqual(result.agentOps, aggregateAgentOpsSums) &&
        aggregateQualifiedUsageCount === rollout.expectedQualifiedUsageCount;
      const now = getCurrentUTCTimestamp();
      await ctx.db.patch(args.rolloutId, {
        status: verified ? "verified" : "failed",
        cursor: result.page.continueCursor,
        expectedAnalyticsSums: result.analytics,
        expectedAgentOpsSums: result.agentOps,
        aggregateAnalyticsSums,
        aggregateAgentOpsSums,
        aggregateQualifiedUsageCount,
        error: verified
          ? undefined
          : "Reporting Aggregate verification did not match the existing read models",
        verifiedAt: verified ? now : undefined,
        updatedAt: now,
      });
      return { status: verified ? "verified" : "failed" };
    } catch (error) {
      await ctx.db.patch(args.rolloutId, {
        status: "failed",
        error:
          error instanceof Error ? error.message : "Reporting migration failed",
        updatedAt: getCurrentUTCTimestamp(),
      });
      return { status: "failed" };
    }
  },
});

export const getWorkspaceMigrationStatusInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceReportingRollouts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
  },
});

export const getWorkspaceMigrationStatusByIdInternal = internalQuery({
  args: { rolloutId: v.id("workspaceReportingRollouts") },
  handler: async (ctx, args) => {
    return await ctx.db.get("workspaceReportingRollouts", args.rolloutId);
  },
});
