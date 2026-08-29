const MODEL_FAILURE_PREFIX = "[QUALIFICATION_MODEL_EVALUATION_FAILED]";

export const QUALIFICATION_MODEL_FAILURE_CODE =
  "qualification_model_evaluation_failed";
export const QUALIFICATION_MODEL_RETRY_DELAY_MS = 5 * 60 * 1000;
export const QUALIFICATION_MAX_WORKFLOW_ATTEMPTS = 2;

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
