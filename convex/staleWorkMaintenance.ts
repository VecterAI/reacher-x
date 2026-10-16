// convex/staleWorkMaintenance.ts
// One-shot operator maintenance for stuck background work left behind by the
// October billing incident: qualification prospects whose durable workflows
// are long gone but still sit in "pending", and failed automatic-plan runs
// that recovery would re-queue once their workspace unblocks.
//
// Nothing here changes user-visible product state: capped prospects keep
// their pending status with a full retry budget (identical to the existing
// retry-exhausted state, and manual resume still works), and failed plan runs
// keep their history rows. The only effect is that automatic recovery can no
// longer resurrect the backlog when a usage cycle rolls over or a workspace
// resumes.
//
// Each batch paginates one workspace's queue with a cursor, so rows the batch
// skips (already capped, not stale, active workspace) can never block rows
// behind them. Only dormant workspaces are processed; the recovery flow of
// running workspaces stays untouched.
//
// Driver: `npx convex run staleWorkMaintenance:runStaleWorkCleanupInternal '{}' --prod`

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import { isWorkspaceAutomationActive } from "./lib/workspaceSystem";
import {
  QUALIFICATION_MAX_WORKFLOW_ATTEMPTS,
  hasReachedQualificationRetryCap,
} from "./lib/qualificationFailureCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const STALE_QUALIFICATION_CLEANUP_CODE = "stale_reconcile_cleanup";
const STALE_QUALIFICATION_CLEANUP_MESSAGE =
  "Qualification was interrupted during an earlier incident and will not retry automatically. Retry from this profile whenever you are ready.";

const STALE_WORK_BATCH_SIZE = 50;
const STALE_WORK_MAX_BYTES_PER_PAGE = 2_000_000;
const STALE_WORKSPACE_SCAN_LIMIT = 500;
/** Per-queue page cap per workspace; the driver warns when a cap is hit. */
const STALE_WORK_MAX_PAGES = 100;

/**
 * One page of live workspaces with their automation state. The driver
 * paginates through every page, so workspaces beyond any single page are
 * still processed.
 */
export const listWorkspaceAutomationStatesForMaintenanceInternal =
  internalQuery({
    args: {
      cursor: v.optional(v.union(v.string(), v.null())),
      limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
      const limit = Math.max(
        1,
        Math.min(
          args.limit ?? STALE_WORKSPACE_SCAN_LIMIT,
          STALE_WORKSPACE_SCAN_LIMIT
        )
      );
      const page = await ctx.db.query("workspaces").paginate({
        numItems: limit,
        cursor: args.cursor ?? null,
      });
      return {
        workspaces: page.page.map((workspace) => ({
          workspaceId: workspace._id,
          automationActive: isWorkspaceAutomationActive(workspace),
        })),
        continueCursor: page.continueCursor,
        isDone: page.isDone,
      };
    },
  });

/**
 * Caps the automatic retry budget of one workspace's stale pending
 * qualifications so the recovery cron can never re-qualify them in a future
 * cycle. Cursor-paginated: every page advances past prospects it skips
 * (already capped, not stale, active workspace), so nothing blocks progress
 * and the driver terminates when the workspace's queue is exhausted.
 */
export const capStalePendingQualificationBatchInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    cutoff: v.number(),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    newlyCapped: v.number(),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.max(
      1,
      Math.min(args.batchSize ?? STALE_WORK_BATCH_SIZE, 200)
    );
    const page = await ctx.db
      .query("prospects")
      .withIndex("by_workspace_qualification", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("qualificationStatus", "pending")
      )
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
        maximumBytesRead: STALE_WORK_MAX_BYTES_PER_PAGE,
      });
    const now = getCurrentUTCTimestamp();
    let newlyCapped = 0;

    for (const prospect of page.page) {
      if (
        prospect.status === "archived" ||
        prospect.origin === "setup_preview" ||
        prospect.updatedAt > args.cutoff
      ) {
        continue;
      }

      const workspace = await ctx.db.get(prospect.workspaceId);
      if (workspace && isWorkspaceAutomationActive(workspace)) {
        continue;
      }

      const existingFailure = prospect.qualificationLastFailure;
      if (
        existingFailure &&
        hasReachedQualificationRetryCap(
          existingFailure.workflowAttemptCount ?? 0
        )
      ) {
        // Already at the retry cap; keep the original failure record.
        continue;
      }

      await ctx.db.patch(prospect._id, {
        qualificationLastFailure: existingFailure
          ? {
              ...existingFailure,
              workflowAttemptCount: QUALIFICATION_MAX_WORKFLOW_ATTEMPTS,
            }
          : {
              stage: "workflow" as const,
              provider: "system",
              code: STALE_QUALIFICATION_CLEANUP_CODE,
              message: STALE_QUALIFICATION_CLEANUP_MESSAGE,
              workflowAttemptCount: QUALIFICATION_MAX_WORKFLOW_ATTEMPTS,
              failedAt: now,
            },
        qualificationWorkflowId: undefined,
        updatedAt: now,
      });
      newlyCapped += 1;
    }

    return {
      newlyCapped,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Marks one workspace's failed automatic-plan runs as recovery-exhausted so
 * recovery claims stop scanning them and can never re-queue them.
 * Cursor-paginated past runs it skips (already exhausted, active workspace).
 */
export const exhaustStaleAutoPlanRecoveryBatchInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    exhausted: v.number(),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.max(
      1,
      Math.min(args.batchSize ?? STALE_WORK_BATCH_SIZE, 200)
    );
    const page = await ctx.db
      .query("autoPlanRuns")
      .withIndex("by_workspace_and_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "failed")
      )
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
        maximumBytesRead: STALE_WORK_MAX_BYTES_PER_PAGE,
      });
    const now = getCurrentUTCTimestamp();
    let exhausted = 0;

    for (const run of page.page) {
      if (run.recoveryRetriedAt !== undefined) {
        continue;
      }
      const workspace = await ctx.db.get(run.workspaceId);
      if (workspace && isWorkspaceAutomationActive(workspace)) {
        continue;
      }
      await ctx.db.patch(run._id, {
        recoveryRetriedAt: now,
        recoveryExhaustedAt: now,
        updatedAt: now,
      });
      exhausted += 1;
    }

    return {
      exhausted,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

type WorkspaceState = {
  workspaceId: Id<"workspaces">;
  automationActive: boolean;
};

/** Processes one workspace's queues with a per-queue page cap. */
async function drainWorkspaceQueues(
  ctx: ActionCtx,
  args: { workspaceId: Id<"workspaces">; cutoff: number }
): Promise<{ newlyCapped: number; exhausted: number; hitPageCap: boolean }> {
  let newlyCapped = 0;
  let exhausted = 0;
  let hitPageCap = false;

  let cursor: string | null = null;
  for (let page = 0; page < STALE_WORK_MAX_PAGES; page += 1) {
    const capResult: {
      newlyCapped: number;
      continueCursor: string | null;
      isDone: boolean;
    } = await ctx.runMutation(
      internal.staleWorkMaintenance.capStalePendingQualificationBatchInternal,
      { workspaceId: args.workspaceId, cutoff: args.cutoff, cursor }
    );
    newlyCapped += capResult.newlyCapped;
    if (capResult.isDone) {
      break;
    }
    cursor = capResult.continueCursor;
    if (page === STALE_WORK_MAX_PAGES - 1) {
      hitPageCap = true;
    }
  }

  cursor = null;
  for (let page = 0; page < STALE_WORK_MAX_PAGES; page += 1) {
    const exhaustResult: {
      exhausted: number;
      continueCursor: string | null;
      isDone: boolean;
    } = await ctx.runMutation(
      internal.staleWorkMaintenance.exhaustStaleAutoPlanRecoveryBatchInternal,
      { workspaceId: args.workspaceId, cursor }
    );
    exhausted += exhaustResult.exhausted;
    if (exhaustResult.isDone) {
      break;
    }
    cursor = exhaustResult.continueCursor;
    if (page === STALE_WORK_MAX_PAGES - 1) {
      hitPageCap = true;
    }
  }

  return { newlyCapped, exhausted, hitPageCap };
}

/**
 * Operator entry point: walks every workspace and drains its stale pending
 * qualifications and failed auto-plan runs. Reads and writes are mutations
 * only; no provider calls, no actions, no AI spend.
 */
export const runStaleWorkCleanupInternal = internalAction({
  args: {},
  returns: v.object({
    workspacesScanned: v.number(),
    newlyCappedProspects: v.number(),
    exhaustedAutoPlanRuns: v.number(),
    workspacesHitPageCap: v.number(),
  }),
  handler: async (ctx) => {
    const cutoff = getCurrentUTCTimestamp() - 15 * 60 * 1000;

    let workspacesScanned = 0;
    let newlyCappedProspects = 0;
    let exhaustedAutoPlanRuns = 0;
    let workspacesHitPageCap = 0;

    let scanCursor: string | null = null;
    let scanDone = false;
    while (!scanDone) {
      const page: {
        workspaces: WorkspaceState[];
        continueCursor: string | null;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.staleWorkMaintenance
          .listWorkspaceAutomationStatesForMaintenanceInternal,
        { cursor: scanCursor }
      );

      for (const workspace of page.workspaces) {
        if (workspace.automationActive) {
          continue;
        }
        workspacesScanned += 1;
        const drained = await drainWorkspaceQueues(ctx, {
          workspaceId: workspace.workspaceId,
          cutoff,
        });
        newlyCappedProspects += drained.newlyCapped;
        exhaustedAutoPlanRuns += drained.exhausted;
        if (drained.hitPageCap) {
          workspacesHitPageCap += 1;
        }
      }

      scanDone = page.isDone;
      scanCursor = page.continueCursor;
    }

    if (workspacesHitPageCap > 0) {
      console.warn(
        `[StaleWorkMaintenance] ${workspacesHitPageCap} workspace(s) hit the ${STALE_WORK_MAX_PAGES}-page cap; re-run to finish them.`
      );
    }

    return {
      workspacesScanned,
      newlyCappedProspects,
      exhaustedAutoPlanRuns,
      workspacesHitPageCap,
    };
  },
});
