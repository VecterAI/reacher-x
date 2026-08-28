import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./lib/functionBuilders";
import {
  addFitScoreToHistogram,
  backfillFitScoreAggregateItem,
  FIT_SCORE_AGGREGATE_VERSION,
  FIT_SCORE_BIN_COUNT,
  getFitScoreHistogramFromAggregate,
} from "./lib/prospectFitScoreAggregate";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { fitScoreAggregateRolloutStatusValidator } from "./validators";

const DEFAULT_BACKFILL_BATCH_SIZE = 25;
const MAX_BACKFILL_BATCH_SIZE = 25;
const DEFAULT_VERIFY_BATCH_SIZE = 100;
const MAX_VERIFY_BATCH_SIZE = 100;

const migrationPageArgs = {
  rolloutId: v.id("fitScoreAggregateRollouts"),
  revision: v.number(),
  cursor: v.union(v.string(), v.null()),
};

const migrationPageResultValidator = v.object({
  status: fitScoreAggregateRolloutStatusValidator,
  processed: v.number(),
});
type MigrationStatus = Infer<typeof fitScoreAggregateRolloutStatusValidator>;
type MigrationPageResult = Infer<typeof migrationPageResultValidator>;
type StartMigrationResult = {
  rolloutId: Id<"fitScoreAggregateRollouts">;
  status: MigrationStatus;
  revision: number;
  alreadyActive: boolean;
};

function createEmptyHistogram() {
  return Array.from({ length: FIT_SCORE_BIN_COUNT }, () => 0);
}

function clampBatchSize(
  requested: number | undefined,
  fallback: number,
  maximum: number
) {
  return Math.max(1, Math.min(maximum, Math.floor(requested ?? fallback)));
}

function isWorkspaceSafeForMigration(
  workspace: Pick<
    Doc<"workspaces">,
    "deletionWorkflowId" | "prospectingWorkflowStatus"
  >
) {
  return (
    workspace.deletionWorkflowId === undefined &&
    workspace.prospectingWorkflowStatus !== undefined &&
    workspace.prospectingWorkflowStatus !== "running"
  );
}

export const startWorkspaceMigrationInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    backfillBatchSize: v.optional(v.number()),
    verifyBatchSize: v.optional(v.number()),
    restart: v.optional(v.boolean()),
  },
  returns: v.object({
    rolloutId: v.id("fitScoreAggregateRollouts"),
    status: fitScoreAggregateRolloutStatusValidator,
    revision: v.number(),
    alreadyActive: v.boolean(),
  }),
  handler: async (ctx, args): Promise<StartMigrationResult> => {
    const workspace = await ctx.db.get("workspaces", args.workspaceId);
    if (!workspace || !isWorkspaceSafeForMigration(workspace)) {
      throw new Error(
        "Fit-score Aggregate migration requires an existing, non-deleting workspace with prospecting paused or stopped"
      );
    }

    const existing = await ctx.db
      .query("fitScoreAggregateRollouts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (
      existing &&
      existing.aggregateVersion === FIT_SCORE_AGGREGATE_VERSION &&
      (existing.status === "backfilling" ||
        existing.status === "verifying" ||
        existing.status === "verified") &&
      !args.restart
    ) {
      return {
        rolloutId: existing._id,
        status: existing.status,
        revision: existing.revision,
        alreadyActive: true,
      };
    }
    if (existing && !args.restart) {
      throw new Error(
        "Fit-score Aggregate migration previously failed or uses an older version; retry with restart=true after reviewing the failure"
      );
    }

    const now = getCurrentUTCTimestamp();
    const revision = (existing?.revision ?? 0) + 1;
    const backfillBatchSize = clampBatchSize(
      args.backfillBatchSize,
      DEFAULT_BACKFILL_BATCH_SIZE,
      MAX_BACKFILL_BATCH_SIZE
    );
    const verifyBatchSize = clampBatchSize(
      args.verifyBatchSize,
      DEFAULT_VERIFY_BATCH_SIZE,
      MAX_VERIFY_BATCH_SIZE
    );
    const reset = {
      workspaceId: args.workspaceId,
      userId: workspace.userId,
      status: "backfilling" as const,
      aggregateVersion: FIT_SCORE_AGGREGATE_VERSION,
      revision,
      backfillCursor: undefined,
      verifyCursor: undefined,
      backfillBatchSize,
      verifyBatchSize,
      backfilledCount: 0,
      verifiedSourceCount: 0,
      expectedBinCounts: createEmptyHistogram(),
      aggregateBinCounts: undefined,
      error: undefined,
      startedAt: now,
      verifiedAt: undefined,
      updatedAt: now,
    };
    const rolloutId = existing
      ? existing._id
      : await ctx.db.insert("fitScoreAggregateRollouts", reset);
    if (existing) {
      await ctx.db.replace("fitScoreAggregateRollouts", existing._id, reset);
    }

    await ctx.scheduler.runAfter(
      0,
      internal.prospectFitScoreAggregateMigration.backfillWorkspacePageInternal,
      { rolloutId, revision, cursor: null }
    );
    return {
      rolloutId,
      status: "backfilling",
      revision,
      alreadyActive: false,
    };
  },
});

export const backfillWorkspacePageInternal = internalMutation({
  args: migrationPageArgs,
  returns: migrationPageResultValidator,
  handler: async (ctx, args): Promise<MigrationPageResult> => {
    const rollout = await ctx.db.get(
      "fitScoreAggregateRollouts",
      args.rolloutId
    );
    if (
      !rollout ||
      rollout.revision !== args.revision ||
      rollout.status !== "backfilling" ||
      (rollout.backfillCursor ?? null) !== args.cursor
    ) {
      return { status: rollout?.status ?? "failed", processed: 0 };
    }

    const workspace = await ctx.db.get("workspaces", rollout.workspaceId);
    if (!workspace || !isWorkspaceSafeForMigration(workspace)) {
      await ctx.db.patch(args.rolloutId, {
        status: "failed",
        error: "Workspace started running or deletion began during backfill",
        updatedAt: getCurrentUTCTimestamp(),
      });
      return { status: "failed", processed: 0 };
    }

    const page = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", rollout.workspaceId)
      )
      .paginate({
        cursor: args.cursor,
        numItems: rollout.backfillBatchSize,
      });
    let backfilledCount = rollout.backfilledCount;
    for (const summary of page.page) {
      if (await backfillFitScoreAggregateItem(ctx, summary)) {
        backfilledCount += 1;
      }
    }

    const now = getCurrentUTCTimestamp();
    if (page.isDone) {
      await ctx.db.patch(args.rolloutId, {
        status: "verifying",
        backfillCursor: page.continueCursor,
        verifyCursor: undefined,
        backfilledCount,
        verifiedSourceCount: 0,
        expectedBinCounts: createEmptyHistogram(),
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.prospectFitScoreAggregateMigration.verifyWorkspacePageInternal,
        {
          rolloutId: args.rolloutId,
          revision: args.revision,
          cursor: null,
        }
      );
      return { status: "verifying", processed: page.page.length };
    }

    await ctx.db.patch(args.rolloutId, {
      backfillCursor: page.continueCursor,
      backfilledCount,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.prospectFitScoreAggregateMigration.backfillWorkspacePageInternal,
      {
        rolloutId: args.rolloutId,
        revision: args.revision,
        cursor: page.continueCursor,
      }
    );
    return { status: "backfilling", processed: page.page.length };
  },
});

export const verifyWorkspacePageInternal = internalMutation({
  args: migrationPageArgs,
  returns: migrationPageResultValidator,
  handler: async (ctx, args): Promise<MigrationPageResult> => {
    const rollout = await ctx.db.get(
      "fitScoreAggregateRollouts",
      args.rolloutId
    );
    if (
      !rollout ||
      rollout.revision !== args.revision ||
      rollout.status !== "verifying" ||
      (rollout.verifyCursor ?? null) !== args.cursor
    ) {
      return { status: rollout?.status ?? "failed", processed: 0 };
    }

    const workspace = await ctx.db.get("workspaces", rollout.workspaceId);
    if (!workspace || !isWorkspaceSafeForMigration(workspace)) {
      await ctx.db.patch(args.rolloutId, {
        status: "failed",
        error:
          "Workspace started running or deletion began during verification",
        updatedAt: getCurrentUTCTimestamp(),
      });
      return { status: "failed", processed: 0 };
    }

    const page = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", rollout.workspaceId)
      )
      .paginate({
        cursor: args.cursor,
        numItems: rollout.verifyBatchSize,
      });
    const expectedBinCounts = [...rollout.expectedBinCounts];
    let verifiedSourceCount = rollout.verifiedSourceCount;
    for (const summary of page.page) {
      if (summary.origin === "setup_preview") {
        continue;
      }
      addFitScoreToHistogram(expectedBinCounts, summary.qualificationScore);
      if (typeof summary.qualificationScore === "number") {
        verifiedSourceCount += 1;
      }
    }

    const now = getCurrentUTCTimestamp();
    if (!page.isDone) {
      await ctx.db.patch(args.rolloutId, {
        verifyCursor: page.continueCursor,
        verifiedSourceCount,
        expectedBinCounts,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.prospectFitScoreAggregateMigration.verifyWorkspacePageInternal,
        {
          rolloutId: args.rolloutId,
          revision: args.revision,
          cursor: page.continueCursor,
        }
      );
      return { status: "verifying", processed: page.page.length };
    }

    const aggregateBinCounts = await getFitScoreHistogramFromAggregate(ctx, {
      workspaceId: rollout.workspaceId,
    });
    const verified =
      expectedBinCounts.length === aggregateBinCounts.length &&
      expectedBinCounts.every(
        (count, index) => count === aggregateBinCounts[index]
      );
    await ctx.db.patch(args.rolloutId, {
      status: verified ? "verified" : "failed",
      verifyCursor: page.continueCursor,
      verifiedSourceCount,
      expectedBinCounts,
      aggregateBinCounts,
      error: verified
        ? undefined
        : `Fit-score histogram mismatch: expected ${expectedBinCounts.join(
            ","
          )}; Aggregate returned ${aggregateBinCounts.join(",")}`,
      verifiedAt: verified ? now : undefined,
      updatedAt: now,
    });
    return {
      status: verified ? "verified" : "failed",
      processed: page.page.length,
    };
  },
});

export const getWorkspaceMigrationStatusInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.union(
    v.object({
      status: fitScoreAggregateRolloutStatusValidator,
      aggregateVersion: v.number(),
      revision: v.number(),
      backfilledCount: v.number(),
      verifiedSourceCount: v.number(),
      expectedBinCounts: v.array(v.number()),
      aggregateBinCounts: v.optional(v.array(v.number())),
      error: v.optional(v.string()),
      startedAt: v.number(),
      verifiedAt: v.optional(v.number()),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const rollout = await ctx.db
      .query("fitScoreAggregateRollouts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (!rollout) {
      return null;
    }
    return {
      status: rollout.status,
      aggregateVersion: rollout.aggregateVersion,
      revision: rollout.revision,
      backfilledCount: rollout.backfilledCount,
      verifiedSourceCount: rollout.verifiedSourceCount,
      expectedBinCounts: rollout.expectedBinCounts,
      aggregateBinCounts: rollout.aggregateBinCounts,
      error: rollout.error,
      startedAt: rollout.startedAt,
      verifiedAt: rollout.verifiedAt,
      updatedAt: rollout.updatedAt,
    };
  },
});
