const MODEL_FAILURE_PREFIX = "[QUALIFICATION_MODEL_EVALUATION_FAILED]";

export const QUALIFICATION_MODEL_FAILURE_CODE =
  "qualification_model_evaluation_failed";
export const QUALIFICATION_MODEL_RETRY_DELAY_MS = 5 * 60 * 1000;
export const QUALIFICATION_MODEL_MAX_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;
export const QUALIFICATION_WORKFLOW_STATUS_ERROR_HARD_STALE_MS = 60 * 60 * 1000;

/**
 * A missing or invalid component workflow cannot become healthy on its own.
 * Unknown status errors may be transient, so preserve the lease until it is
 * far older than the maximum expected qualification runtime.
 */
export function shouldRecoverQualificationWorkflowStatusError(args: {
  errorMessage: string;
  leaseUpdatedAt: number;
  now: number;
}): boolean {
  const normalizedMessage = args.errorMessage.toLowerCase();
  const permanentLookupFailure =
    normalizedMessage.includes("workflow not found") ||
    normalizedMessage.includes("invalid workflow id") ||
    normalizedMessage.includes("argumentvalidationerror");

  return (
    permanentLookupFailure ||
    args.leaseUpdatedAt <=
      args.now - QUALIFICATION_WORKFLOW_STATUS_ERROR_HARD_STALE_MS
  );
}

/**
 * Keep each workflow's model attempts bounded while ensuring a technical
 * failure cannot leave a prospect permanently pending. Durable retries back
 * off exponentially and eventually run at most once per day.
 */
export function getQualificationFailureRetryDelayMs(
  workflowAttemptCount: number
): number {
  const exponent = Math.max(0, Math.floor(workflowAttemptCount) - 1);
  return Math.min(
    QUALIFICATION_MODEL_MAX_RETRY_DELAY_MS,
    QUALIFICATION_MODEL_RETRY_DELAY_MS * 2 ** exponent
  );
}

export function getQualificationFailureRetryAt(failure: {
  failedAt: number;
  workflowAttemptCount?: number;
  nextRetryAt?: number;
}): number {
  return (
    failure.nextRetryAt ??
    failure.failedAt +
      getQualificationFailureRetryDelayMs(failure.workflowAttemptCount ?? 1)
  );
}

export function formatQualificationModelFailure(args: {
  provider: string;
  model: string;
  attemptCount: number;
  message: string;
}): string {
  return `${MODEL_FAILURE_PREFIX} provider=${JSON.stringify(args.provider)} model=${JSON.stringify(args.model)} attempts=${args.attemptCount} message=${JSON.stringify(args.message)}`;
}

export function parseQualificationModelFailure(message: string): {
  provider: string;
  model?: string;
  attemptCount?: number;
  message: string;
} | null {
  if (!message.includes(MODEL_FAILURE_PREFIX)) return null;

  const provider = message.match(/provider=("(?:[^"\\]|\\.)*")/)?.[1];
  const model = message.match(/model=("(?:[^"\\]|\\.)*")/)?.[1];
  const attemptCount = Number(message.match(/attempts=(\d+)/)?.[1]);
  const originalMessage = message.match(/message=("(?:[^"\\]|\\.)*")/)?.[1];
  const parseJsonString = (value: string | undefined) => {
    if (!value) return undefined;
    try {
      return JSON.parse(value) as string;
    } catch {
      return undefined;
    }
  };

  return {
    provider: parseJsonString(provider) ?? "configured_llm_route",
    model: parseJsonString(model),
    attemptCount: Number.isFinite(attemptCount) ? attemptCount : undefined,
    message: parseJsonString(originalMessage) ?? message,
  };
}
