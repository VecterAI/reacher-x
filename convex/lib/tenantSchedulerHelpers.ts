import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { isTenantJobTerminal } from "./tenantSchedulerCore";

type TenantJobCompletionKind = "succeeded" | "failed" | "cancelled";

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
