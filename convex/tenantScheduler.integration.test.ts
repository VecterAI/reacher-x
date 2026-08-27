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

async function activateWorkspaceLane(
  t: ReturnType<typeof convexTest>,
  workspaceId: Id<"workspaces">
) {
  const laneId = await t.run(async (ctx) => {
    const lanes = await ctx.db.query("tenantJobLanes").collect();
    const lane = lanes.find(
      (candidate) => candidate.workspaceId === workspaceId
    );
    if (!lane) throw new Error("Expected tenant lane");
    return lane._id;
  });
  return await t.mutation(internal.tenantScheduler.activateLaneInternal, {
    laneId,
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
    await activateWorkspaceLane(t, running.workspaceId);

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
      await activateWorkspaceLane(t, workspace.workspaceId);
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

  test("records pre-row enqueue failures and resolves them after an idempotent retry", async () => {
    vi.useRealTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const owner = await seedWorkspace(t, "recovery-owner");
    const other = await seedWorkspace(t, "recovery-other");
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });

    const idempotencyKey = "enqueue-recovery-memory";
    await expect(
      t.action(internal.tenantScheduler.enqueueTenantJobWithRetryInternal, {
        ...owner,
        class: "background",
        priority: 30,
        idempotencyKey,
        payload: {
          kind: "memory_evaluation",
          workspaceId: other.workspaceId,
        },
      })
    ).rejects.toThrow("workspace scope mismatch");

    const failedState = await t.run(async (ctx) => ({
      jobs: await ctx.db.query("tenantJobs").collect(),
      failures: await ctx.db.query("tenantJobEnqueueFailures").collect(),
    }));
    expect(failedState.jobs).toHaveLength(0);
    expect(failedState.failures).toEqual([
      expect.objectContaining({
        idempotencyKey,
        status: "unresolved",
        attemptCount: 3,
        kind: "memory_evaluation",
      }),
    ]);

    const diagnosticStatus = await t.query(
      internal.tenantScheduler.getControlStatusInternal,
      {}
    );
    expect(diagnosticStatus.enqueueFailures).toMatchObject({
      unresolved: 1,
      sampleTruncated: false,
    });
    expect(diagnosticStatus.enqueueFailures.newestFailureAt).not.toBeNull();

    const recovered = await t.action(
      internal.tenantScheduler.enqueueTenantJobWithRetryInternal,
      {
        ...owner,
        class: "background",
        priority: 30,
        idempotencyKey,
        payload: {
          kind: "memory_evaluation",
          workspaceId: owner.workspaceId,
        },
      }
    );
    expect(recovered.route).toBe("enforced");

    const recoveredState = await t.run(async (ctx) => ({
      jobs: await ctx.db.query("tenantJobs").collect(),
      failure: await ctx.db
        .query("tenantJobEnqueueFailures")
        .withIndex("by_idempotency_key", (q) =>
          q.eq("idempotencyKey", idempotencyKey)
        )
        .unique(),
    }));
    expect(recoveredState.jobs).toHaveLength(1);
    expect(recoveredState.failure).toMatchObject({
      status: "resolved",
      resolvedJobId: recovered.jobId,
      resolvedRoute: "enforced",
    });
  });

  test("reuses a queued memory intent when enqueue failed before work ID attachment", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t, "memory-intent-recovery");
    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("memoryWorkflowEvents", {
        workspaceId: workspace.workspaceId,
        eventType: "qualification_completed",
        status: "pending",
        sourceType: "workflow_event",
        sourceId: "memory-intent-recovery",
        eventKey: "memory-intent-recovery",
        occurredAt: 1,
      })
    );

    const first = await t.mutation(
      internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
      { workspaceId: workspace.workspaceId }
    );
    const retry = await t.mutation(
      internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(first).toEqual({
      shouldEnqueue: true,
      reason: "queued",
      eventId,
    });
    expect(retry).toEqual(first);

    await t.mutation(
      internal.workflows.memory.setMemoryEvaluationQueueWorkIdInternal,
      { workspaceId: workspace.workspaceId, workId: "attached-work" }
    );
    const attached = await t.mutation(
      internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(attached).toEqual({
      shouldEnqueue: false,
      reason: "queued",
      eventId,
    });
  });

  test("reconciles a same-workspace burst without enqueue writes to the lane", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const workspace = await seedWorkspace(t, "burst");
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });

    const enqueueResults = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        t.mutation(internal.tenantScheduler.enqueueTenantJobInternal, {
          ...workspace,
          class: "background",
          priority: 30 + (index % 3),
          idempotencyKey: `burst-${index}`,
          payload: {
            kind: "memory_evaluation",
            workspaceId: workspace.workspaceId,
          },
        })
      )
    );
    expect(enqueueResults.every((result) => result.route === "enforced")).toBe(
      true
    );

    const beforeActivation = await t.run(async (ctx) => {
      const lane = await ctx.db
        .query("tenantJobLanes")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", workspace.workspaceId)
        )
        .unique();
      return {
        lane,
        bindings: await ctx.db.query("tenantJobLaneBindings").collect(),
        queuedJobs: await ctx.db
          .query("tenantJobs")
          .withIndex("by_workspace_and_status", (q) =>
            q.eq("workspaceId", workspace.workspaceId).eq("status", "queued")
          )
          .collect(),
      };
    });
    expect(beforeActivation.queuedJobs).toHaveLength(100);
    expect(beforeActivation.bindings).toHaveLength(1);
    expect(beforeActivation.bindings[0]?.laneId).toBe(
      beforeActivation.lane?._id
    );
    expect(beforeActivation.lane?.pendingCount).toBe(0);

    const activation = await activateWorkspaceLane(t, workspace.workspaceId);
    expect(activation.pendingCount).toBe(100);
    const laneAfter = await t.run(async (ctx) =>
      ctx.db
        .query("tenantJobLanes")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", workspace.workspaceId)
        )
        .unique()
    );
    expect(laneAfter).toMatchObject({
      pendingCount: 100,
      minPriority: 30,
      state: "ready",
    });
  });

  test("backfills immutable lane bindings in bounded pages", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t, "lane-binding-backfill");
    const laneId = await t.run((ctx) =>
      ctx.db.insert("tenantJobLanes", {
        tenantKey: `workspace:${workspace.workspaceId}`,
        workspaceId: workspace.workspaceId,
        userId: workspace.userId,
        state: "idle",
        pendingCount: 0,
        runningCount: 0,
        minPriority: Number.MAX_SAFE_INTEGER,
        lastDispatchedAt: 0,
        updatedAt: 1,
      })
    );

    const result = await t.mutation(
      internal.tenantScheduler.backfillLaneBindingsInternal,
      { paginationOpts: { cursor: null, numItems: 10 } }
    );
    expect(result).toMatchObject({ inserted: 1, isDone: true });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("tenantJobLaneBindings")
          .withIndex("by_tenant_key", (q) =>
            q.eq("tenantKey", `workspace:${workspace.workspaceId}`)
          )
          .unique()
      )
    ).toMatchObject({ laneId });
  });

  test("reasserts the workpool split from authoritative scheduler mode", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });
    expect(
      await t.mutation(
        internal.tenantScheduler.reconcilePoolConfigurationInternal,
        {}
      )
    ).toEqual({ enforced: true });
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

  test("serves one-job tenants alongside a 100-job tenant", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const [noisy, newcomerB, newcomerC] = await Promise.all([
      seedWorkspace(t, "hundred-jobs"),
      seedWorkspace(t, "one-job-b"),
      seedWorkspace(t, "one-job-c"),
    ]);
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });

    const jobsByWorkspace = await t.run(async (ctx) => {
      const result = new Map<string, Id<"tenantJobs">[]>();
      for (const [tenant, count] of [
        [noisy, 100],
        [newcomerB, 1],
        [newcomerC, 1],
      ] as const) {
        const tenantKey = `workspace:${tenant.workspaceId}`;
        const laneId = await ctx.db.insert("tenantJobLanes", {
          tenantKey,
          workspaceId: tenant.workspaceId,
          userId: tenant.userId,
          state: "ready",
          pendingCount: count,
          runningCount: 0,
          minPriority: 30,
          lastDispatchedAt: 0,
          updatedAt: 1,
        });
        const jobIds: Id<"tenantJobs">[] = [];
        for (let index = 0; index < count; index += 1) {
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
              idempotencyKey: `load-${tenant.workspaceId}-${index}`,
              payload: {
                kind: "memory_evaluation",
                workspaceId: tenant.workspaceId,
              },
              queuedAt: index + 1,
              attemptCount: 0,
              updatedAt: 1,
            })
          );
        }
        result.set(String(tenant.workspaceId), jobIds);
      }
      return Object.fromEntries(result);
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

    const runningByWorkspace = await t.run(async (ctx) => {
      const entries = await Promise.all(
        Object.entries(jobsByWorkspace).map(async ([workspaceId, jobIds]) => [
          workspaceId,
          (
            await Promise.all(
              jobIds.map((jobId) => ctx.db.get("tenantJobs", jobId))
            )
          ).filter((job) => job?.status === "running").length,
        ])
      );
      return Object.fromEntries(entries);
    });
    expect(runningByWorkspace).toEqual({
      [String(noisy.workspaceId)]: 1,
      [String(newcomerB.workspaceId)]: 1,
      [String(newcomerC.workspaceId)]: 1,
    });
  });

  test.each([10, 50, 100])(
    "keeps every lane visible across bounded scans with %i active lanes",
    async (laneCount) => {
      vi.useFakeTimers();
      const t = convexTest(schema, modules);
      await registerSchedulerComponents(t);
      await t.mutation(internal.tenantScheduler.setControlInternal, {
        mode: "enforced",
      });

      await t.run(async (ctx) => {
        for (let index = 0; index < laneCount; index += 1) {
          const userId = await ctx.db.insert("users", {
            workosUserId: `lane-load-${laneCount}-${index}`,
            email: `lane-${laneCount}-${index}@tenant-scheduler.test`,
          });
          const workspaceId = await ctx.db.insert("workspaces", {
            userId,
            name: `Lane ${index}`,
            description: "Scheduler lane load test",
            isDefault: true,
            updatedAt: 1,
          });
          const tenantKey = `workspace:${workspaceId}`;
          const laneId = await ctx.db.insert("tenantJobLanes", {
            tenantKey,
            workspaceId,
            userId,
            state: "ready",
            pendingCount: 1,
            runningCount: 0,
            minPriority: 30,
            lastDispatchedAt: 0,
            updatedAt: 1,
          });
          await ctx.db.insert("tenantJobs", {
            tenantKey,
            laneId,
            workspaceId,
            userId,
            class: "background",
            kind: "memory_evaluation",
            status: "queued",
            priority: 30,
            idempotencyKey: `lane-load-${laneCount}-${index}`,
            payload: { kind: "memory_evaluation", workspaceId },
            queuedAt: 1,
            attemptCount: 0,
            updatedAt: 1,
          });
        }
      });

      const visibleTenantKeys = new Set<string>();
      while (visibleTenantKeys.size < laneCount) {
        const result = await t.query(
          internal.tenantScheduler.getDispatchBatchInternal,
          { name: WORKER_NAME }
        );
        expect(result.kind).toBe("work");
        if (result.kind !== "work") throw new Error("Expected dispatch work");
        for (const candidate of result.batch.candidates) {
          visibleTenantKeys.add(candidate.tenantKey);
        }
        await t.run(async (ctx) => {
          for (const candidate of result.batch.candidates) {
            await ctx.db.patch("tenantJobLanes", candidate.laneId, {
              state: "idle",
            });
          }
        });
      }
      expect(visibleTenantKeys.size).toBe(laneCount);
    }
  );

  test("accepts and deduplicates every tenant job kind with isolated ownership", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const owner = await seedWorkspace(t, "kind-owner");
    const other = await seedWorkspace(t, "kind-other");
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });

    const fixtures = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("workspaceSetupSessions", {
        userId: owner.userId,
        mode: "new_workspace",
        status: "generating_profiles",
        setupThreadId: "tenant-kind-setup",
        useCaseKey: "customer_prospecting",
        draftOrdinal: 1,
        statusUpdatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "tenant-kind-owner-prospect",
        data: {},
        status: "new",
        updatedAt: 1,
      });
      const otherProspectId = await ctx.db.insert("prospects", {
        workspaceId: other.workspaceId,
        userId: other.userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "tenant-kind-other-prospect",
        data: {},
        status: "new",
        updatedAt: 1,
      });
      const autoPlanRunId = await ctx.db.insert("autoPlanRuns", {
        prospectId,
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        status: "queued",
        attemptCount: 0,
        updatedAt: 1,
      });
      const otherAutoPlanRunId = await ctx.db.insert("autoPlanRuns", {
        prospectId: otherProspectId,
        workspaceId: other.workspaceId,
        userId: other.userId,
        status: "queued",
        attemptCount: 0,
        updatedAt: 1,
      });
      const planBatchRunId = await ctx.db.insert("planBatchRuns", {
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        sourceThreadId: "tenant-kind-plan-batch",
        operation: "create",
        scopeKind: "all",
        instruction: "Create a plan",
        attachments: [],
        confirmationRequired: false,
        status: "queued",
        targetCount: 1,
        eligibleCount: 1,
        queuedCount: 1,
        runningCount: 0,
        succeededCount: 0,
        failedCount: 0,
        skippedCount: 0,
        selectionSkippedCount: 0,
        finishedCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const planBatchItemId = await ctx.db.insert("planBatchItems", {
        runId: planBatchRunId,
        prospectId,
        operation: "create",
        status: "queued",
        attemptCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const otherPlanBatchRunId = await ctx.db.insert("planBatchRuns", {
        workspaceId: other.workspaceId,
        userId: other.userId,
        sourceThreadId: "tenant-kind-other-plan-batch",
        operation: "create",
        scopeKind: "all",
        instruction: "Create a plan",
        attachments: [],
        confirmationRequired: false,
        status: "queued",
        targetCount: 1,
        eligibleCount: 1,
        queuedCount: 1,
        runningCount: 0,
        succeededCount: 0,
        failedCount: 0,
        skippedCount: 0,
        selectionSkippedCount: 0,
        finishedCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const otherPlanBatchItemId = await ctx.db.insert("planBatchItems", {
        runId: otherPlanBatchRunId,
        prospectId: otherProspectId,
        operation: "create",
        status: "queued",
        attemptCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      return {
        sessionId,
        prospectId,
        otherProspectId,
        autoPlanRunId,
        otherAutoPlanRunId,
        planBatchRunId,
        planBatchItemId,
        otherPlanBatchRunId,
        otherPlanBatchItemId,
      };
    });

    const cases = [
      {
        key: "setup_generation",
        workspaceId: undefined,
        payload: {
          kind: "setup_generation" as const,
          sessionId: fixtures.sessionId,
        },
      },
      {
        key: "qualification",
        workspaceId: owner.workspaceId,
        payload: {
          kind: "qualification" as const,
          prospectId: fixtures.prospectId,
          workspaceId: owner.workspaceId,
          preview: false,
        },
      },
      {
        key: "enrichment",
        workspaceId: owner.workspaceId,
        payload: {
          kind: "enrichment" as const,
          prospectId: fixtures.prospectId,
          workspaceId: owner.workspaceId,
          claimToken: "tenant-kind-claim",
          preview: false,
        },
      },
      {
        key: "auto_plan",
        workspaceId: owner.workspaceId,
        payload: {
          kind: "auto_plan" as const,
          prospectId: fixtures.prospectId,
          workspaceId: owner.workspaceId,
          userId: owner.userId,
          runId: fixtures.autoPlanRunId,
        },
      },
      {
        key: "plan_batch_item",
        workspaceId: owner.workspaceId,
        payload: {
          kind: "plan_batch_item" as const,
          workspaceId: owner.workspaceId,
          runId: fixtures.planBatchRunId,
          itemId: fixtures.planBatchItemId,
        },
      },
      {
        key: "memory_evaluation",
        workspaceId: owner.workspaceId,
        payload: {
          kind: "memory_evaluation" as const,
          workspaceId: owner.workspaceId,
        },
      },
    ];

    for (const jobCase of cases) {
      const args = {
        workspaceId: jobCase.workspaceId,
        userId: owner.userId,
        class: "background" as const,
        priority: 30,
        idempotencyKey: `kind-${jobCase.key}`,
        payload: jobCase.payload,
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
    }

    const crossScopeCases = [
      {
        workspaceId: undefined,
        userId: other.userId,
        payload: {
          kind: "setup_generation" as const,
          sessionId: fixtures.sessionId,
        },
      },
      {
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        payload: {
          kind: "qualification" as const,
          prospectId: fixtures.otherProspectId,
          workspaceId: owner.workspaceId,
          preview: false,
        },
      },
      {
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        payload: {
          kind: "enrichment" as const,
          prospectId: fixtures.otherProspectId,
          workspaceId: owner.workspaceId,
          claimToken: "tenant-kind-cross-claim",
          preview: false,
        },
      },
      {
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        payload: {
          kind: "auto_plan" as const,
          prospectId: fixtures.otherProspectId,
          workspaceId: owner.workspaceId,
          userId: owner.userId,
          runId: fixtures.otherAutoPlanRunId,
        },
      },
      {
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        payload: {
          kind: "plan_batch_item" as const,
          workspaceId: owner.workspaceId,
          runId: fixtures.otherPlanBatchRunId,
          itemId: fixtures.otherPlanBatchItemId,
        },
      },
      {
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        payload: {
          kind: "memory_evaluation" as const,
          workspaceId: other.workspaceId,
        },
      },
    ];
    for (const [index, jobCase] of crossScopeCases.entries()) {
      await expect(
        t.mutation(internal.tenantScheduler.enqueueTenantJobInternal, {
          ...jobCase,
          class: "background",
          priority: 30,
          idempotencyKey: `kind-cross-${index}`,
        })
      ).rejects.toThrow(/ownership mismatch|scope mismatch/);
    }

    const jobs = await t.run(async (ctx) =>
      ctx.db.query("tenantJobs").collect()
    );
    expect(jobs).toHaveLength(cases.length);
    expect(new Set(jobs.map((job) => job.kind))).toEqual(
      new Set(cases.map((jobCase) => jobCase.key))
    );

    await activateWorkspaceLane(t, owner.workspaceId);
    await t.mutation(internal.tenantScheduler.pauseWorkspaceInternal, {
      workspaceId: owner.workspaceId,
    });
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("tenantJobLanes")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", owner.workspaceId)
          )
          .unique()
      )
    ).toMatchObject({ state: "paused", pendingCount: 5 });
    await t.mutation(internal.tenantScheduler.resumeWorkspaceInternal, {
      workspaceId: owner.workspaceId,
    });
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("tenantJobLanes")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", owner.workspaceId)
          )
          .unique()
      )
    ).toMatchObject({ state: "ready", pendingCount: 5 });

    await t.run(async (ctx) => {
      const countsByLane = new Map<string, number>();
      for (const job of jobs) {
        await ctx.db.patch("tenantJobs", job._id, {
          status: "running",
          attemptCount: 3,
          startedAt: 2,
          leaseExpiresAt: 20_000,
          updatedAt: 2,
        });
        countsByLane.set(
          String(job.laneId),
          (countsByLane.get(String(job.laneId)) ?? 0) + 1
        );
      }
      for (const [laneId, runningCount] of countsByLane) {
        const normalizedLaneId = ctx.db.normalizeId("tenantJobLanes", laneId);
        if (!normalizedLaneId) throw new Error("Expected valid lane id");
        await ctx.db.patch("tenantJobLanes", normalizedLaneId, {
          pendingCount: 0,
          runningCount,
          minPriority: Number.MAX_SAFE_INTEGER,
          state: "idle",
          updatedAt: 2,
        });
      }
    });

    for (const [index, job] of jobs.entries()) {
      const terminalStatus = index % 2 === 0 ? "succeeded" : "failed";
      const result = await t.mutation(
        internal.tenantScheduler.completeJobInternal,
        {
          jobId: job._id,
          status: terminalStatus,
          errorMessage:
            terminalStatus === "failed" ? "Retries exhausted" : undefined,
        }
      );
      expect(result.completed).toBe(true);
      expect(
        await t.mutation(internal.tenantScheduler.completeJobInternal, {
          jobId: job._id,
          status: terminalStatus,
        })
      ).toEqual({ completed: false });
    }
    const completedJobs = await t.run(async (ctx) =>
      Promise.all(jobs.map((job) => ctx.db.get("tenantJobs", job._id)))
    );
    expect(completedJobs.every((job) => job?.attemptCount === 3)).toBe(true);
    expect(
      completedJobs.filter((job) => job?.status === "succeeded")
    ).toHaveLength(3);
    expect(
      completedJobs.filter((job) => job?.status === "failed")
    ).toHaveLength(3);
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

  test("reports queue age, expired leases, and slot drift without scanning history", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const workspace = await seedWorkspace(t, "diagnostics");
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });
    const now = 10_000;

    await t.run(async (ctx) => {
      const tenantKey = `workspace:${workspace.workspaceId}`;
      const laneId = await ctx.db.insert("tenantJobLanes", {
        tenantKey,
        workspaceId: workspace.workspaceId,
        userId: workspace.userId,
        state: "ready",
        pendingCount: 1,
        runningCount: 1,
        minPriority: 30,
        lastDispatchedAt: 0,
        updatedAt: 1,
      });
      await ctx.db.insert("tenantJobs", {
        tenantKey,
        laneId,
        workspaceId: workspace.workspaceId,
        userId: workspace.userId,
        class: "background",
        kind: "memory_evaluation",
        status: "queued",
        priority: 30,
        idempotencyKey: "diagnostics-queued",
        payload: {
          kind: "memory_evaluation",
          workspaceId: workspace.workspaceId,
        },
        queuedAt: 4_000,
        attemptCount: 0,
        updatedAt: 4_000,
      });
      await ctx.db.insert("tenantJobs", {
        tenantKey,
        laneId,
        workspaceId: workspace.workspaceId,
        userId: workspace.userId,
        class: "background",
        kind: "memory_evaluation",
        status: "running",
        priority: 30,
        idempotencyKey: "diagnostics-running",
        payload: {
          kind: "memory_evaluation",
          workspaceId: workspace.workspaceId,
        },
        queuedAt: 3_000,
        startedAt: 5_000,
        leaseExpiresAt: 9_000,
        attemptCount: 1,
        updatedAt: 5_000,
      });
    });

    const status = await t.query(
      internal.tenantScheduler.getControlStatusInternal,
      { now }
    );
    expect(status.jobs).toMatchObject({
      queued: 1,
      running: 1,
      oldestQueuedAt: 4_000,
      oldestQueueAgeMs: 6_000,
      earliestLeaseExpiresAt: 9_000,
      expiredLeaseCount: 1,
      expiredLeaseSampleTruncated: false,
    });
    expect(status.drift).toMatchObject({
      slotCountMismatch: false,
      claimedSlotCountMismatch: true,
      expectedTenantExecutionPoolParallelism: 36,
      legacyPoolsExpectedPaused: true,
    });
  });
});
