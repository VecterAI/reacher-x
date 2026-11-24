interface PendingTurnPhaseState {
  id: string;
  phase: string;
}

type PlanBatchTurnState =
  | {
      status: string;
      agentResponseCompleted: boolean;
    }
  | null
  | undefined;

const TERMINAL_PLAN_BATCH_STATUSES = new Set([
  "completed",
  "partial",
  "failed",
  "cancelled",
]);

/**
 * Returns true while an assistant message row is still being generated on the
 * backend, including the initial empty `"pending"` shell created before stream
 * deltas begin arriving.
 */
export function isAssistantMessageActive(status: string | undefined): boolean {
  return status === "pending" || status === "streaming";
}

export function isPlanBatchTurnWaiting(state: PlanBatchTurnState): boolean {
  return Boolean(
    state &&
    (!TERMINAL_PLAN_BATCH_STATUSES.has(state.status) ||
      !state.agentResponseCompleted)
  );
}

/**
 * Preserve object identity when a pending turn is already in the requested
 * phase so effects that depend on the object do not retrigger indefinitely.
 */
export function updatePendingTurnPhase<T extends PendingTurnPhaseState>(
  current: T | null,
  pendingTurnId: string,
  nextPhase: T["phase"]
): T | null {
  if (current === null || current.id !== pendingTurnId) {
    return current;
  }

  if (current.phase === nextPhase) {
    return current;
  }

  if (current.phase === "stopping" && nextPhase !== "stopping") {
    return current;
  }

  return {
    ...current,
    phase: nextPhase,
  };
}
