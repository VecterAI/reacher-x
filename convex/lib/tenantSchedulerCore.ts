import type { Id } from "../_generated/dataModel";

export const TENANT_EXECUTION_POOL_MAX_PARALLELISM = 36;
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

export function isTenantJobTerminal(status: string) {
  return ["shadow", "succeeded", "failed", "cancelled"].includes(status);
}
