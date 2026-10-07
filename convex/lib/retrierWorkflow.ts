// convex/lib/retrierWorkflow.ts
// Helpers for consuming retried actions from durable workflows without
// billing a live action while the underlying action runs.
//
// The pattern this replaces: a workflow step called a wrapper action that
// started a retried run and then slept in a polling loop. Actions bill
// wall-clock time, so every polling sleep was billed compute. Here the
// step starts the run via a mutation, then polls the result store between
// `step.sleep` steps — durable, crash-safe, and free while waiting.
//
// Flow:
//   1. Integration registers a start mutation that calls
//      `runRetriedAction` with `onComplete:
//      internal.lib.retrier.recordRetriedActionCompletion`.
//   2. The workflow step calls `awaitRetriedActionResult(step, {...})`.
//   3. The completion mutation persists the terminal result; the step
//      reads it via `getRetriedActionResult` after each sleep.

import type { WorkflowCtx } from "@convex-dev/workflow";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { RunId } from "@convex-dev/action-retrier";
import { internal } from "../_generated/api";

type RetriedActionResult = NonNullable<
  FunctionReturnType<typeof internal.lib.retrier.getRetriedActionResult>
>;

export const DEFAULT_RESULT_POLL_MS = 3_000;
export const DEFAULT_RESULT_MAX_WAIT_MS = 8 * 60 * 1000;

/**
 * Wait for a retried action started via a start mutation to reach a terminal
 * state, polling the result store between free durable sleeps.
 *
 * Throws on failure/cancellation of the run, and on timeout — a timeout
 * means the underlying action is still running, so the caller should fail
 * the step and let its recovery path re-arm rather than keep waiting.
 */
export async function awaitRetriedActionResult<
  Start extends FunctionReference<"mutation", "internal">,
>(
  step: WorkflowCtx,
  args: {
    start: Start;
    startArgs: FunctionArgs<Start>;
    label: string;
    pollMs?: number;
    maxWaitMs?: number;
  }
): Promise<RetriedActionResult> {
  const pollMs = args.pollMs ?? DEFAULT_RESULT_POLL_MS;
  const maxWaitMs = args.maxWaitMs ?? DEFAULT_RESULT_MAX_WAIT_MS;

  const started = (await step.runMutation(args.start, args.startArgs)) as {
    runId: RunId;
  };
  const { runId } = started;

  let waitedMs = 0;
  for (;;) {
    await step.sleep(pollMs, { name: `${args.label}:poll` });
    waitedMs += pollMs;
    const result = (await step.runQuery(
      internal.lib.retrier.getRetriedActionResult,
      { runId }
    )) as RetriedActionResult | null;
    if (result) {
      if (result.outcome === "failed") {
        throw new Error(
          `[${args.label}] Retried action failed: ${result.error ?? "unknown error"}`
        );
      }
      if (result.outcome === "canceled") {
        throw new Error(`[${args.label}] Retried action was canceled`);
      }
      return result;
    }
    if (waitedMs >= maxWaitMs) {
      throw new Error(
        `[${args.label}] Timed out after ${Math.round(waitedMs / 1000)}s waiting for retried action ${runId}`
      );
    }
  }
}
