import aggregateTest from "@convex-dev/aggregate/test";
import { vi } from "vitest";

vi.mock("convex-test", async (importOriginal) => {
  const original = await importOriginal<typeof import("convex-test")>();

  return {
    ...original,
    convexTest: (...args: Parameters<typeof original.convexTest>) => {
      const test = original.convexTest(...args);
      aggregateTest.register(test, "workspaceReportingAggregate");
      return test;
    },
  };
});
