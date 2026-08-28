import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { isTenantJobTerminal } from "./tenantSchedulerCore";

type TenantJobCompletionKind = "succeeded" | "failed" | "cancelled";

/**
 * Refresh the lane's dispatch marker from the first durable queued job.
 *
 * Enqueue deliberately does not increment the lane document: same-workspace
 * bursts otherwise make every producer contend on one row. `tenantJobs` is
 * the source of truth; lane counts are only a 0/1 dispatch marker. Reading one
 * indexed job keeps activation O(1), and once a lane is ready the remaining
 * burst activations become read-only instead of rewriting the hot lane.
 */
export async function reconcileTenantLaneQueueState(
  ctx: MutationCtx,
  args: {
    laneId: Id<"tenantJobLanes">;
    resume?: boolean;
  }
): Promise<{
  lane: Doc<"tenantJobLanes"> | null;
  pendingCount: number;
  activated: boolean;
}> {
  const lane = await ctx.db.get("tenantJobLanes", args.laneId);
  if (!lane) {
    return { lane: null, pendingCount: 0, activated: false };
  }

  if (!args.resume && (lane.state === "ready" || lane.state === "paused")) {
    return {
      lane,
      pendingCount: lane.state === "ready" ? 1 : lane.pendingCount,
      activated: false,
    };
  }

  const firstQueuedJob = await ctx.db
    .query("tenantJobs")
    .withIndex("by_lane_and_status_and_priority_and_queued_at", (q) =>
      q.eq("laneId", lane._id).eq("status", "queued")
    )
    .first();
  const pendingCount = firstQueuedJob ? 1 : 0;
  const minPriority = firstQueuedJob?.priority ?? Number.MAX_SAFE_INTEGER;

  const state =
    lane.state === "paused" && !args.resume
      ? ("paused" as const)
      : firstQueuedJob
        ? ("ready" as const)
        : ("idle" as const);
  const now = getCurrentUTCTimestamp();
  const activated =
    state === "ready" &&
    (lane.state !== "ready" || lane.pendingCount !== pendingCount);
  if (
    lane.pendingCount !== pendingCount ||
    lane.minPriority !== minPriority ||
    lane.state !== state
  ) {
    await ctx.db.patch("tenantJobLanes", lane._id, {
      pendingCount,
      minPriority,
      state,
      updatedAt: now,
    });
  }

  return {
    lane: {
      ...lane,
      pendingCount,
      minPriority,
      state,
      updatedAt: now,
    },
    pendingCount,
    activated,
  };
}

export async function completeTenantJob(
  ctx: MutationCtx,
  args: {
    jobId: Id<"tenantJobs">;
    status: TenantJobCompletionKind;
    errorMessage?: string;
  }
) {
  const job = await ctx.db.get("tenantJobs", args.jobId);
  if (!job || isTenantJobTerminal(job.status)) {
    return { completed: false as const };
  }

  const now = getCurrentUTCTimestamp();
  const lane = await ctx.db.get("tenantJobLanes", job.laneId);
  const slot = job.slotId
    ? await ctx.db.get("tenantSchedulerSlots", job.slotId)
    : null;

  await ctx.db.patch("tenantJobs", job._id, {
    status: args.status,
    completedAt: now,
    leaseExpiresAt: undefined,
    slotId: undefined,
    errorMessage: args.errorMessage,
    updatedAt: now,
  });

  if (slot?.jobId === job._id) {
    await ctx.db.patch("tenantSchedulerSlots", slot._id, {
      status: "free",
      jobId: undefined,
      tenantKey: undefined,
      claimedAt: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
  }

  if (lane) {
    const runningCount = Math.max(0, lane.runningCount - 1);
    await ctx.db.patch("tenantJobLanes", lane._id, {
      runningCount,
      state:
        lane.state === "paused"
          ? "paused"
          : lane.pendingCount > 0
            ? "ready"
            : "idle",
      updatedAt: now,
    });
  }

  await ctx.scheduler.runAfter(
    0,
    internal.tenantScheduler.wakeDispatcherInternal,
    {}
  );
  return { completed: true as const };
}

export async function markTenantJobNestedWorkflow(
  ctx: MutationCtx,
  args: {
    jobId: Id<"tenantJobs">;
    workflowId: string;
    leaseExpiresAt: number;
  }
) {
  const job = await ctx.db.get("tenantJobs", args.jobId);
  if (!job || job.status !== "running") {
    return { updated: false as const };
  }
  await ctx.db.patch("tenantJobs", job._id, {
    nestedWorkflowId: args.workflowId,
    leaseExpiresAt: args.leaseExpiresAt,
    updatedAt: getCurrentUTCTimestamp(),
  });
  if (job.slotId) {
    const slot = await ctx.db.get("tenantSchedulerSlots", job.slotId);
    if (slot?.jobId === job._id) {
      await ctx.db.patch("tenantSchedulerSlots", slot._id, {
        leaseExpiresAt: args.leaseExpiresAt,
        updatedAt: getCurrentUTCTimestamp(),
      });
    }
  }
  return { updated: true as const };
}
