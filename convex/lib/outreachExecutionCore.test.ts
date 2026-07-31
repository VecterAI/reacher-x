import { describe, expect, test } from "vitest";
import { isOutreachExecutionLeaseCurrent } from "./outreachExecutionCore";

describe("outreach execution lease", () => {
  test("allows only the current executing plan and task", () => {
    expect(
      isOutreachExecutionLeaseCurrent({
        plan: { status: "executing", executionGeneration: 3 },
        task: { status: "executing" },
        expectedExecutionGeneration: 3,
      })
    ).toBe(true);
  });

  test.each([
    {
      name: "stale generation",
      plan: { status: "executing" as const, executionGeneration: 4 },
      task: { status: "executing" as const },
      expectedExecutionGeneration: 3,
    },
    {
      name: "paused plan",
      plan: { status: "paused" as const, executionGeneration: 3 },
      task: { status: "executing" as const },
      expectedExecutionGeneration: 3,
    },
    {
      name: "superseded task",
      plan: { status: "executing" as const, executionGeneration: 3 },
      task: { status: "skipped" as const, supersededAt: 10 },
      expectedExecutionGeneration: 3,
    },
  ])("blocks $name before any provider action", (testCase) => {
    expect(isOutreachExecutionLeaseCurrent(testCase)).toBe(false);
  });
});
