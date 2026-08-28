/// <reference types="vite/client" />

import actionRetrierTest from "@convex-dev/action-retrier/test";
import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { describe, expect, test, vi } from "vitest";
import { components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const actionRetrierInternal = components.actionRetrier as unknown as {
  run: {
    cleanupExpiredRuns: FunctionReference<
      "mutation",
      "internal",
      Record<string, never>,
      null
    >;
  };
};

async function runExists(
  t: ReturnType<typeof convexTest>,
  runId: string
): Promise<boolean> {
  try {
    await t.query(components.actionRetrier.public.status, { runId });
    return true;
  } catch (error) {
    expect(String(error)).toContain("not found");
    return false;
  }
}

describe("Action Retrier cleanup", () => {
  test("drains large historical runs in bytes-safe continuation pages", async () => {
    vi.useFakeTimers();
    const startedAt = Date.UTC(2026, 7, 29, 8);
    vi.setSystemTime(startedAt);
    const t = convexTest({
      schema,
      modules,
      transactionLimits: { bytesRead: 6_000_000 },
    });
    actionRetrierTest.register(t);

    const runIds: string[] = [];
    const largeHistoricalArgs = { payload: "x".repeat(700_000) };
    for (let index = 0; index < 10; index += 1) {
      const runId = await t.mutation(components.actionRetrier.public.start, {
        functionHandle: `historical-action-${index}`,
        functionArgs: largeHistoricalArgs,
        options: {
          initialBackoffMs: 1_000,
          base: 2,
          maxFailures: 3,
          logLevel: "ERROR",
          runAt: startedAt + 30 * 24 * 60 * 60 * 1_000,
        },
      });
      expect(
        await t.mutation(components.actionRetrier.public.cancel, { runId })
      ).toBe(true);
      runIds.push(runId);
    }

    vi.setSystemTime(startedAt + 8 * 24 * 60 * 60 * 1_000);
    await t.mutation(actionRetrierInternal.run.cleanupExpiredRuns, {});

    const afterFirstPage = await Promise.all(
      runIds.map((runId) => runExists(t, runId))
    );
    expect(afterFirstPage.filter(Boolean)).toHaveLength(6);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const afterContinuation = await Promise.all(
      runIds.map((runId) => runExists(t, runId))
    );
    expect(afterContinuation.filter(Boolean)).toHaveLength(0);
  });
});
