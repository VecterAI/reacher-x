/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "benchmark-linkdapi-cap",
      email: "benchmark-linkdapi-cap@example.test",
    });
    const workspace = (name: string, workflowId: string, startedAt: number) =>
      ctx.db.insert("workspaces", {
        userId,
        name,
        description: "Synthetic workspace",
        isDefault: false,
        updatedAt: Date.now(),
        prospectingWorkflowStatus: "running",
        prospectingWorkflowId: workflowId,
        prospectingWorkflowStartedAt: startedAt,
      });
    return {
      benchmark: await workspace("Benchmark run-1_14_on", "wf-1", 2_000),
      ordinary: await workspace("Sales team", "wf-sales", 3_000),
    };
  });
}

const reserve = (t: ReturnType<typeof convexTest>) =>
  t.mutation(internal.linkdapiBudget.reserveLinkdApiBudgetSlotInternal, {
    consumer: "linkedin.test",
  });

const status = (t: ReturnType<typeof convexTest>) =>
  t.query(internal.benchmarkPeopleSearch.linkdApiCycleLimitStatus, {});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("benchmark LinkedIn cycle cap", () => {
  test("unset, every call is reserved and nothing is counted", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    for (let call = 0; call < 3; call++)
      expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    const state = await t.run((ctx) =>
      ctx.db.query("linkdapiBudgetState").first()
    );
    expect(state?.benchmarkCycleKey).toBeUndefined();
    expect((await status(t)).limit).toBeNull();
  });

  test("refuses calls past the cap for the benchmark workspace's cycle", async () => {
    vi.stubEnv("BENCHMARK_LINKDAPI_CYCLE_LIMIT", "2");
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const results = [];
    for (let call = 0; call < 4; call++)
      results.push((await reserve(t)).benchmarkCapRefused);
    expect(results).toEqual([null, null, 2, 2]);
    expect(await status(t)).toEqual({
      limit: 2,
      source: "benchmark",
      error: null,
      cycle: {
        workspaceId: ids.benchmark,
        workflowId: "wf-1",
        calls: 2,
        refused: 2,
      },
    });
  });

  test("a new cycle starts a new count", async () => {
    vi.stubEnv("BENCHMARK_LINKDAPI_CYCLE_LIMIT", "1");
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    expect((await reserve(t)).benchmarkCapRefused).toBe(1);
    await t.run((ctx) =>
      ctx.db.patch(ids.benchmark, {
        prospectingWorkflowId: "wf-2",
        prospectingWorkflowStartedAt: 5_000,
      })
    );
    expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    expect((await status(t)).cycle).toMatchObject({
      workflowId: "wf-2",
      calls: 1,
      refused: 0,
    });
  });

  test("never counts or refuses without a benchmark workspace", async () => {
    vi.stubEnv("BENCHMARK_LINKDAPI_CYCLE_LIMIT", "1");
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run((ctx) => ctx.db.delete(ids.benchmark as Id<"workspaces">));
    for (let call = 0; call < 3; call++)
      expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    expect((await status(t)).cycle).toBeNull();
  });

  test("an invalid value reports an error and never refuses", async () => {
    vi.stubEnv("BENCHMARK_LINKDAPI_CYCLE_LIMIT", "lots");
    const t = convexTest(schema, modules);
    await seed(t);
    for (let call = 0; call < 3; call++)
      expect((await reserve(t)).benchmarkCapRefused).toBeNull();
    const reported = await status(t);
    expect(reported.limit).toBeNull();
    expect(reported.error).not.toBeNull();
  });
});
