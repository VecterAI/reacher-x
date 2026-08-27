/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const WORKER_NAME = "tenant-fair-dispatcher-v1";
const WORKPOOL_NAMES = [
  "qualificationPool",
  "enrichmentPool",
  "previewQualificationPool",
  "previewEnrichmentPool",
  "outreachPlanPool",
  "memoryEvaluationPool",
  "tenantExecutionPool",
] as const;

async function registerSchedulerComponents(t: ReturnType<typeof convexTest>) {
  const workpoolPath = ["@convex-dev/workpool", "test"].join("/");
  const batchWorkerPath = ["@convex-dev/batch-worker", "test"].join("/");
  const rateLimiterPath = ["@convex-dev/rate-limiter", "test"].join("/");
  const [workpoolTest, batchWorkerTest, rateLimiterTest] = await Promise.all([
    import(workpoolPath),
    import(batchWorkerPath),
    import(rateLimiterPath),
  ]);

  for (const name of WORKPOOL_NAMES) {
    workpoolTest.default.register(t, name);
  }
  batchWorkerTest.default.register(t, "batchWorker");
  rateLimiterTest.default.register(t, "rateLimiter");
}

async function seedWorkspace(
  t: ReturnType<typeof convexTest>,
  suffix: string,
  status: "running" | "paused" = "running"
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `tenant-scheduler-${suffix}`,
      email: `${suffix}@tenant-scheduler.test`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Tenant ${suffix}`,
      description: "Tenant scheduler integration test",
      isDefault: true,
      prospectingWorkflowStatus: status,
      updatedAt: 1,
    });
    return { userId, workspaceId };
  });
}

describe("tenant scheduler integration", () => {
  test("keeps rollout additive in shadow mode and deduplicates enforced jobs", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const running = await seedWorkspace(t, "running");

    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "shadow",
    });
    const shadow = await t.mutation(
      internal.tenantScheduler.enqueueTenantJobInternal,
      {
        ...running,
        class: "background",
        priority: 30,
        idempotencyKey: "shadow-memory-running",
        payload: {
          kind: "memory_evaluation",
          workspaceId: running.workspaceId,
        },
      }
    );
    expect(shadow.route).toBe("shadow");

    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });
    const args = {
      ...running,
      class: "background" as const,
      priority: 30,
      idempotencyKey: "enforced-memory-running",
      payload: {
        kind: "memory_evaluation" as const,
        workspaceId: running.workspaceId,
      },
    };
    const first = await t.mutation(
      internal.tenantScheduler.enqueueTenantJobInternal,
      args
    );
    const duplicate = await t.mutation(
      internal.tenantScheduler.enqueueTenantJobInternal,
      args
    );

    expect(first.route).toBe("enforced");
    expect(duplicate).toEqual(first);
    const state = await t.run(async (ctx) => ({
      jobs: await ctx.db.query("tenantJobs").collect(),
      lane: await ctx.db
        .query("tenantJobLanes")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", running.workspaceId)
        )
        .unique(),
      slots: await ctx.db.query("tenantSchedulerSlots").collect(),
    }));
    expect(state.jobs).toHaveLength(2);
    expect(state.jobs.map((job) => job.status).sort()).toEqual([
      "queued",
      "shadow",
    ]);
    expect(state.lane?.pendingCount).toBe(1);
    expect(state.slots).toHaveLength(36);
    await expect(
      t.mutation(internal.tenantScheduler.setControlInternal, {
        mode: "shadow",
      })
    ).rejects.toThrow("queued or running tenant jobs");
  });

  test("pause is lane-local and resume does not affect another workspace", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const paused = await seedWorkspace(t, "paused", "paused");
    const running = await seedWorkspace(t, "independent");
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });

    for (const workspace of [paused, running]) {
      await t.mutation(internal.tenantScheduler.enqueueTenantJobInternal, {
        ...workspace,
        class: "background",
        priority: 30,
        idempotencyKey: `pause-${workspace.workspaceId}`,
        payload: {
          kind: "memory_evaluation",
          workspaceId: workspace.workspaceId,
        },
      });
    }

    const lanesBefore = await t.run(async (ctx) =>
      ctx.db.query("tenantJobLanes").collect()
    );
    expect(
      lanesBefore.find((lane) => lane.workspaceId === paused.workspaceId)?.state
    ).toBe("paused");
    expect(
      lanesBefore.find((lane) => lane.workspaceId === running.workspaceId)
        ?.state
    ).toBe("ready");

    await t.mutation(internal.tenantScheduler.resumeWorkspaceInternal, {
      workspaceId: paused.workspaceId,
    });
    const lanesAfter = await t.run(async (ctx) =>
      ctx.db.query("tenantJobLanes").collect()
    );
    expect(
      lanesAfter.find((lane) => lane.workspaceId === paused.workspaceId)?.state
    ).toBe("ready");
    expect(
      lanesAfter.find((lane) => lane.workspaceId === running.workspaceId)?.state
    ).toBe("ready");
  });

  test("rejects a payload that crosses workspace ownership boundaries", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedWorkspace(t, "scope-owner");
    const other = await seedWorkspace(t, "scope-other");

    await expect(
      t.mutation(internal.tenantScheduler.enqueueTenantJobInternal, {
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        class: "background",
        priority: 30,
        idempotencyKey: "cross-workspace-payload",
        payload: {
          kind: "memory_evaluation",
          workspaceId: other.workspaceId,
        },
      })
    ).rejects.toThrow("workspace scope mismatch");
  });

  test("a saturated tenant cannot consume the newcomer slots", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const tenants = await Promise.all([
      seedWorkspace(t, "noisy"),
      seedWorkspace(t, "newcomer-b"),
      seedWorkspace(t, "newcomer-c"),
    ]);
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });

    const seeded = await t.run(async (ctx) => {
      const jobIds: Id<"tenantJobs">[] = [];
      for (const [index, tenant] of tenants.entries()) {
        const tenantKey = `workspace:${tenant.workspaceId}`;
        const laneId = await ctx.db.insert("tenantJobLanes", {
          tenantKey,
          workspaceId: tenant.workspaceId,
          userId: tenant.userId,
          state: "ready",
          pendingCount: 1,
          runningCount: index === 0 ? 30 : 0,
          minPriority: 30,
          lastDispatchedAt: index,
          updatedAt: 1,
        });
        jobIds.push(
          await ctx.db.insert("tenantJobs", {
            tenantKey,
            laneId,
            workspaceId: tenant.workspaceId,
            userId: tenant.userId,
            class: "background",
            kind: "memory_evaluation",
            status: "queued",
            priority: 30,
            idempotencyKey: `fairness-${index}`,
            payload: {
              kind: "memory_evaluation",
              workspaceId: tenant.workspaceId,
            },
            queuedAt: 1,
            attemptCount: 0,
            updatedAt: 1,
          })
        );
      }
      return jobIds;
    });

    const queryResult = await t.query(
      internal.tenantScheduler.getDispatchBatchInternal,
      { name: WORKER_NAME }
    );
    expect(queryResult.kind).toBe("work");
    if (queryResult.kind !== "work") throw new Error("Expected dispatch work");
    await t.mutation(
      internal.tenantScheduler.dispatchBatchInternal,
      queryResult.batch
    );

    const statuses = await t.run(async (ctx) =>
      Promise.all(seeded.map((jobId) => ctx.db.get("tenantJobs", jobId)))
    );
    expect(statuses[0]?.status).toBe("queued");
    expect(statuses[1]?.status).toBe("running");
    expect(statuses[2]?.status).toBe("running");
  });

  test("deletes only terminal scheduler history older than seven days", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const { oldId, recentId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "tenant-cleanup",
        email: "cleanup@tenant-scheduler.test",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Tenant cleanup",
        description: "Tenant scheduler cleanup test",
        isDefault: true,
        updatedAt: now,
      });
      const laneId = await ctx.db.insert("tenantJobLanes", {
        tenantKey: `user:${userId}`,
        userId,
        state: "idle",
        pendingCount: 0,
        runningCount: 0,
        minPriority: Number.MAX_SAFE_INTEGER,
        lastDispatchedAt: 0,
        updatedAt: now,
      });
      const insert = (idempotencyKey: string, completedAt: number) =>
        ctx.db.insert("tenantJobs", {
          tenantKey: `user:${userId}`,
          laneId,
          userId,
          class: "background",
          kind: "memory_evaluation",
          status: "succeeded",
          priority: 30,
          idempotencyKey,
          payload: {
            kind: "memory_evaluation",
            workspaceId,
          },
          queuedAt: completedAt,
          completedAt,
          attemptCount: 1,
          updatedAt: completedAt,
        });
      return {
        oldId: await insert("cleanup-old", now - 8 * 24 * 60 * 60 * 1000),
        recentId: await insert("cleanup-recent", now),
      };
    });

    const result = await t.mutation(
      internal.tenantScheduler.cleanupCompletedJobsInternal,
      {}
    );
    expect(result.deleted).toBe(1);
    expect(
      await t.run(async (ctx) => ({
        old: await ctx.db.get("tenantJobs", oldId),
        recent: await ctx.db.get("tenantJobs", recentId),
      }))
    ).toMatchObject({ old: null, recent: expect.any(Object) });
  });
});
