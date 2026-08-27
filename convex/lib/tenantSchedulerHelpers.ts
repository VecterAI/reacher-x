import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { isTenantJobTerminal } from "./tenantSchedulerCore";

type TenantJobCompletionKind = "succeeded" | "failed" | "cancelled";

/**
 * Rebuild the lane's queue metadata from the durable queued jobs.
 *
 * Enqueue deliberately does not increment the lane document: same-workspace
 * bursts otherwise make every producer contend on one row. The job rows are
 * the source of truth and this small reconciliation mutation maintains the
 * fair-dispatch index without losing increments when activations race.
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
}> {
  const lane = await ctx.db.get("tenantJobLanes", args.laneId);
  if (!lane) {
    return { lane: null, pendingCount: 0 };
  }

  let pendingCount = 0;
  let minPriority = Number.MAX_SAFE_INTEGER;
  for await (const job of ctx.db
    .query("tenantJobs")
    .withIndex("by_lane_and_status_and_priority_and_queued_at", (q) =>
      q.eq("laneId", lane._id).eq("status", "queued")
    )) {
    pendingCount += 1;
    minPriority = Math.min(minPriority, job.priority);
  }

  const state =
    lane.state === "paused" && !args.resume
      ? ("paused" as const)
      : pendingCount > 0
        ? ("ready" as const)
        : ("idle" as const);
  const now = getCurrentUTCTimestamp();
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
