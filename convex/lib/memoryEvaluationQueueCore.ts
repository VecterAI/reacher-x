import type { Doc } from "../_generated/dataModel";
import { DEFAULT_TENANT_JOB_LEASE_MS } from "./tenantSchedulerCore";

export const MEMORY_EVALUATION_PRIORITY_SCAN_LIMIT = 25;
export const MEMORY_EVALUATION_LEGACY_WORK_STALE_MS =
  DEFAULT_TENANT_JOB_LEASE_MS;

type MemoryWorkflowEventQueueFields = Pick<
  Doc<"memoryWorkflowEvents">,
  "eventType" | "sourceId" | "status"
>;

/**
 * Explicit repair events restore a missing product prerequisite and must not
 * wait behind ordinary learning history. Normal events retain FIFO ordering.
 */
export function isPriorityMemoryEvaluationEvent(
  event: MemoryWorkflowEventQueueFields
) {
  return (
    event.status === "pending" &&
    event.eventType === "style_content_backfill_completed" &&
    event.sourceId.startsWith("style-repair:")
  );
}

export function isMemoryEvaluationLegacyWorkStale(args: {
  queueUpdatedAt: number;
  now: number;
}) {
  return (
    args.now - args.queueUpdatedAt >= MEMORY_EVALUATION_LEGACY_WORK_STALE_MS
  );
}
