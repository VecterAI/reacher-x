/**
 * Ctrl+C during a live step. The first SIGINT or SIGTERM aborts the step's
 * signal: no new unit starts, the running workspace is stopped and exported,
 * and the deployment reset runs. Later signals never cut that short: the
 * handlers stay installed until the caller disposes them after the reset, so
 * Node does not exit, and Convex CLI calls run in their own process group so
 * the terminal's Ctrl+C does not kill a reset command halfway. Only a hard
 * kill can skip the reset; `pnpm benchmark --reset` then finishes it.
 */

export class StepInterrupted extends Error {}

const SIGNALS = ["SIGINT", "SIGTERM"] as const;
type StopSignal = (typeof SIGNALS)[number];

/** The part of `process` used here, so tests can send signals without stopping the test runner. */
export type SignalSource = Readonly<{
  on(event: StopSignal, listener: (signal: StopSignal) => void): unknown;
  off(event: StopSignal, listener: (signal: StopSignal) => void): unknown;
}>;

export type StepInterrupt = Readonly<{
  signal: AbortSignal;
  /** Removes the handlers; call only once the reset has finished. */
  dispose(): void;
}>;

export function interruptOnSignals(
  source: SignalSource = process,
  log: (message: string) => void = console.error
): StepInterrupt {
  const controller = new AbortController();
  const handler = (signal: StopSignal) => {
    if (!controller.signal.aborted) {
      log(
        `${signal} received. No new work will start; the running workspace is stopped and the deployment reset runs before exit.`
      );
      controller.abort(new StepInterrupted("The step was interrupted."));
      return;
    }
    log(
      "Still stopping. The deployment reset is not skipped; wait for it. If the process is killed anyway, run pnpm benchmark --reset."
    );
  };
  for (const name of SIGNALS) source.on(name, handler);
  return {
    signal: controller.signal,
    dispose() {
      for (const name of SIGNALS) source.off(name, handler);
    },
  };
}
