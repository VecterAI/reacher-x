import type { StructuredCall, StepCall } from "../calls/llm";
import type { BenchmarkWorkspace } from "../execution/convex";
import type { JudgeCaller } from "../judging/judges";

/**
 * One OpenRouter key may pay for ReacherX, the judges and the harness's own
 * model calls (filter translation, Clay query writing, Firecrawl extraction).
 * A workspace's cost is that key's spend before and after it, so no judge or
 * harness call may run while a workspace is running. The gate closes when a
 * workspace is tracked (before it can spend) and opens only once it is
 * cleared, which happens after it is confirmed stopped.
 */
export class SharedKeyConflict extends Error {}

export class WorkspaceGate {
  private running: string | null = null;
  private calls = 0;

  /** Wraps the live session's workspace tracking so the gate follows it. */
  tracking(
    track: (workspace: BenchmarkWorkspace | null) => Promise<void>
  ): (workspace: BenchmarkWorkspace | null) => Promise<void> {
    return async (workspace) => {
      if (workspace) {
        if (this.calls > 0)
          throw new SharedKeyConflict(
            "A model call is still running; a workspace cannot start until it ends."
          );
        this.running = workspace.label;
      }
      await track(workspace);
      if (!workspace) this.running = null;
    };
  }

  /** The label of the workspace running now, or null. */
  get active() {
    return this.running;
  }

  /** Throws while a workspace is running. */
  assertIdle(purpose: string) {
    if (this.running !== null)
      throw new SharedKeyConflict(
        `${purpose} cannot run while workspace ${this.running} is running.`
      );
  }

  private async guarded<T>(purpose: string, call: () => Promise<T>) {
    this.assertIdle(purpose);
    this.calls += 1;
    try {
      return await call();
    } finally {
      this.calls -= 1;
    }
  }

  structured(call: StructuredCall, purpose: string): StructuredCall {
    return (model, request) =>
      this.guarded(purpose, () => call(model, request));
  }

  step(call: StepCall, purpose: string): StepCall {
    return (step, model, request) =>
      this.guarded(purpose, () => call(step, model, request));
  }

  judge(call: JudgeCaller): JudgeCaller {
    return (model, input) =>
      this.guarded("A judge call", () => call(model, input));
  }
}
