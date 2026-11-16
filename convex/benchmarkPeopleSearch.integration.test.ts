/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "benchmark-hooks",
      email: "benchmark-hooks@example.test",
    });
    const workspace = (
      name: string,
      fields: {
        prospectingWorkflowStatus?: "running" | "stopped" | "paused";
        prospectingNextRunAt?: number;
        prospectingNextRecoveryAt?: number;
      }
    ) =>
      ctx.db.insert("workspaces", {
        userId,
        name,
        description: "Synthetic workspace",
        isDefault: false,
        updatedAt: Date.now(),
        ...fields,
      });
    return {
      benchmark: await workspace("Benchmark run-1_6_on", {
        prospectingWorkflowStatus: "running",
        prospectingNextRunAt: Date.now() + 600_000,
      }),
      ordinary: await workspace("Sales team", {
        prospectingWorkflowStatus: "running",
      }),
      recovering: await workspace("Recovering", {
        prospectingWorkflowStatus: "stopped",
        prospectingNextRecoveryAt: Date.now() + 3_600_000,
      }),
      stopped: await workspace("Stopped", {
        prospectingWorkflowStatus: "stopped",
      }),
    };
  });
}

const pendingNextCycles = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect())
      .filter(
        (job) =>
          job.name.includes("startNextCycle") && job.state.kind === "pending"
      )
      .map(
        (job) => (job.args[0] as { workspaceId: Id<"workspaces"> }).workspaceId
      )
  );

describe("benchmark people-search hooks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("cancelScheduledCycles cancels only the benchmark workspace's next cycle", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run(async (ctx) => {
      for (const workspaceId of [ids.benchmark, ids.ordinary])
        await ctx.scheduler.runAfter(
          600_000,
          internal.workflows.prospecting.startNextCycle,
          { workspaceId }
        );
    });

    const result = await t.mutation(
      internal.benchmarkPeopleSearch.cancelScheduledCycles,
      { workspaceId: ids.benchmark }
    );

    expect(result).toEqual({ canceled: 1, truncated: false });
    expect(await pendingNextCycles(t)).toEqual([ids.ordinary]);
    const workspace = await t.run((ctx) => ctx.db.get(ids.benchmark));
    expect(workspace?.prospectingNextRunAt).toBeUndefined();
    expect(workspace?.prospectingWorkflowStatus).toBe("running");
  });

  test("cancelScheduledCycles refuses a workspace the benchmark did not create", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await expect(
      t.mutation(internal.benchmarkPeopleSearch.cancelScheduledCycles, {
        workspaceId: ids.ordinary,
      })
    ).rejects.toThrow(/Only benchmark workspaces/);
  });

  test("deploymentActivity lists running workspaces and pending restarts, except the named one", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const activity = await t.query(
      internal.benchmarkPeopleSearch.deploymentActivity,
      { exceptWorkspaceId: ids.benchmark }
    );
    expect([...activity.workspaceIds].sort()).toEqual(
      [ids.ordinary, ids.recovering].sort()
    );
    expect(activity.truncated).toBe(false);
  });
});
