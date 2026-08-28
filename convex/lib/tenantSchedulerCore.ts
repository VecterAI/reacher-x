import type { Id } from "../_generated/dataModel";

export const TENANT_EXECUTION_POOL_MAX_PARALLELISM = 36;
export const TENANT_JOB_START_RATE_PER_MINUTE = 240;
export const DEFAULT_TENANT_SCHEDULER_SLOT_COUNT = 36;
export const DEFAULT_TENANT_BASE_SLOTS = 1;
export const DEFAULT_TENANT_BURST_SLOTS = 30;
export const DEFAULT_TENANT_JOB_LEASE_MS = 2 * 60 * 60 * 1000;
export const NESTED_WORKFLOW_LEASE_MS = 6 * 60 * 60 * 1000;
export const TENANT_JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const TENANT_ENQUEUE_RECOVERY_MAX_ATTEMPTS = 3;
const TENANT_ENQUEUE_RECOVERY_BASE_DELAY_MS = 250;

export const TENANT_JOB_PRIORITY = {
  interactive: 0,
  preview: 10,
  background: 50,
} as const;

export function buildTenantKey(args: {
  workspaceId?: Id<"workspaces">;
  userId: Id<"users">;
}) {
  return args.workspaceId
    ? `workspace:${String(args.workspaceId)}`
    : `user:${String(args.userId)}`;
}

export function getTenantEnqueueRetryDelayMs(
  failedAttempt: number,
  jitterFraction = Math.random()
) {
  const normalizedAttempt = Math.max(1, Math.floor(failedAttempt));
  const normalizedJitter = Math.max(0, Math.min(1, jitterFraction));
  return (
    TENANT_ENQUEUE_RECOVERY_BASE_DELAY_MS * 2 ** (normalizedAttempt - 1) +
    Math.floor(normalizedJitter * TENANT_ENQUEUE_RECOVERY_BASE_DELAY_MS)
  );
}

export function clampTenantSchedulerSlotCount(slotCount: number) {
  return Math.max(
    1,
    Math.min(TENANT_EXECUTION_POOL_MAX_PARALLELISM, Math.floor(slotCount))
  );
}

export function clampTenantBaseSlots(baseSlots: number, slotCount: number) {
  return Math.max(1, Math.min(Math.floor(baseSlots), slotCount));
}

export function clampTenantBurstSlots(args: {
  burstSlots: number;
  baseSlots: number;
  slotCount: number;
}) {
  return Math.max(
    args.baseSlots,
    Math.min(Math.floor(args.burstSlots), args.slotCount)
  );
}

/**
 * Work-conserving fair share for the lanes currently asking for more work.
 * A single tenant may borrow most slots, while a newly active tenant causes
 * the share to rebalance immediately without preempting already-running work.
 */
export function getTenantDispatchCap(args: {
  slotCount: number;
  activeTenantCount: number;
  baseSlotsPerTenant: number;
  burstSlotsPerTenant: number;
}) {
  const activeTenantCount = Math.max(1, Math.floor(args.activeTenantCount));
  const fairShare = Math.max(
    args.baseSlotsPerTenant,
    Math.floor(args.slotCount / activeTenantCount)
  );
  return Math.min(args.burstSlotsPerTenant, fairShare);
}

export type TenantDispatchDemand = {
  tenantKey: string;
  runningCount: number;
  queuedCount: number;
};

/**
 * Fill one dispatcher batch without letting a busy tenant skip a newcomer.
 * Each active tenant receives one assignment per round until the batch, its
 * queued demand, or its current fair-share cap is exhausted.
 */
export function allocateTenantDispatchSlots(args: {
  demands: readonly TenantDispatchDemand[];
  availableSlotCount: number;
  maxAssignments: number;
  totalSlotCount: number;
  baseSlotsPerTenant: number;
  burstSlotsPerTenant: number;
}) {
  const activeDemands = args.demands.filter((demand) => demand.queuedCount > 0);
  const activeTenantCount = activeDemands.length;
  if (activeTenantCount === 0) {
    return { activeTenantCount, tenantCap: 0, allocations: [] };
  }

  const tenantCap = getTenantDispatchCap({
    slotCount: args.totalSlotCount,
    activeTenantCount,
    baseSlotsPerTenant: args.baseSlotsPerTenant,
    burstSlotsPerTenant: args.burstSlotsPerTenant,
  });
  const assignmentLimit = Math.max(
    0,
    Math.min(
      Math.floor(args.availableSlotCount),
      Math.floor(args.maxAssignments)
    )
  );
  const allocations = activeDemands.map((demand) => ({
    tenantKey: demand.tenantKey,
    dispatchCount: 0,
  }));

  let assigned = 0;
  while (assigned < assignmentLimit) {
    let assignedThisRound = false;
    for (let index = 0; index < activeDemands.length; index += 1) {
      if (assigned >= assignmentLimit) break;
      const demand = activeDemands[index];
      const allocation = allocations[index];
      if (
        allocation.dispatchCount >= demand.queuedCount ||
        demand.runningCount + allocation.dispatchCount >= tenantCap
      ) {
        continue;
      }
      allocation.dispatchCount += 1;
      assigned += 1;
      assignedThisRound = true;
    }
    if (!assignedThisRound) break;
  }

  return { activeTenantCount, tenantCap, allocations };
}

export function getTenantStartRateDrainTimeMs(jobCount: number) {
  const normalizedJobCount = Math.max(0, Math.floor(jobCount));
  const jobsAfterInitialCapacity = Math.max(
    0,
    normalizedJobCount - TENANT_EXECUTION_POOL_MAX_PARALLELISM
  );
  return Math.ceil(
    (jobsAfterInitialCapacity / TENANT_JOB_START_RATE_PER_MINUTE) * 60_000
  );
}

export function isTenantJobTerminal(status: string) {
  return ["shadow", "succeeded", "failed", "cancelled"].includes(status);
}
