/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
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

async function seedWorkspace(t: ReturnType<typeof convexTest>, suffix: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `memory-queue-${suffix}`,
      email: `${suffix}@memory-queue.test`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Memory queue ${suffix}`,
      description: "Memory queue integration test",
      isDefault: true,
      prospectingWorkflowStatus: "running",
      updatedAt: 1,
    });
    return { userId, workspaceId };
  });
}

async function insertEvent(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    suffix: string;
    occurredAt: number;
    eventType?: "qualification_completed" | "style_content_backfill_completed";
    sourceId?: string;
    status?: "pending" | "processing";
    evaluatorWorkflowId?: string;
  }
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("memoryWorkflowEvents", {
      workspaceId: args.workspaceId,
      eventType: args.eventType ?? "qualification_completed",
      status: args.status ?? "pending",
      sourceType:
        args.eventType === "style_content_backfill_completed"
          ? "style_content"
          : "workflow_event",
      sourceId: args.sourceId ?? args.suffix,
      eventKey: `memory-queue-${args.suffix}`,
      evaluatorWorkflowId: args.evaluatorWorkflowId,
      occurredAt: args.occurredAt,
    })
  );
}

async function insertTenantJob(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    status: "queued" | "running" | "succeeded" | "cancelled";
    suffix: string;
    idempotencyKey?: string;
  }
) {
  return await t.run(async (ctx) => {
    const laneId = await ctx.db.insert("tenantJobLanes", {
      tenantKey: `workspace:${String(args.workspaceId)}`,
      workspaceId: args.workspaceId,
      userId: args.userId,
      state: args.status === "queued" ? "ready" : "idle",
      pendingCount: args.status === "queued" ? 1 : 0,
      runningCount: args.status === "running" ? 1 : 0,
      minPriority: 50,
      lastDispatchedAt: 1,
      updatedAt: 1,
    });
    return await ctx.db.insert("tenantJobs", {
      tenantKey: `workspace:${String(args.workspaceId)}`,
      laneId,
      workspaceId: args.workspaceId,
      userId: args.userId,
      class: "background",
      kind: "memory_evaluation",
      status: args.status,
      priority: 50,
      idempotencyKey: args.idempotencyKey ?? `memory-queue-job-${args.suffix}`,
      payload: {
        kind: "memory_evaluation",
        workspaceId: args.workspaceId,
      },
      queuedAt: 1,
      startedAt: args.status === "running" ? 2 : undefined,
      completedAt:
        args.status === "succeeded" || args.status === "cancelled"
          ? 3
          : undefined,
      attemptCount: args.status === "queued" ? 0 : 1,
      updatedAt: 3,
    });
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("memory evaluation workspace queue", () => {
  test("prioritizes a repair event over an old ordinary backlog", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t, "priority");
    await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "old-normal",
      occurredAt: 1,
    });
    const repairEventId = await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "repair",
      occurredAt: 100,
      eventType: "style_content_backfill_completed",
      sourceId: `style-repair:${String(workspace.userId)}:twitter:1`,
    });
    await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "new-normal",
      occurredAt: 200,
    });

    const prepared = await t.mutation(
      internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(prepared.eventId).toBe(repairEventId);

    await t.mutation(
      internal.workflows.memory.setMemoryEvaluationQueueWorkIdInternal,
      { workspaceId: workspace.workspaceId, workId: "priority-work" }
    );
    const begun = await t.mutation(
      internal.workflows.memory.beginMemoryEvaluationQueueWorkInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(begun).toEqual({
      eventId: repairEventId,
      workId: "priority-work",
    });
  });

  test("keeps normal events FIFO and isolated by workspace", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t, "fifo");
    const otherWorkspace = await seedWorkspace(t, "fifo-other");
    const oldestEventId = await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "fifo-oldest",
      occurredAt: 1,
    });
    await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "fifo-newest",
      occurredAt: 2,
    });
    await insertEvent(t, {
      workspaceId: otherWorkspace.workspaceId,
      suffix: "other-repair",
      occurredAt: 3,
      eventType: "style_content_backfill_completed",
      sourceId: `style-repair:${String(otherWorkspace.userId)}:twitter:1`,
    });

    const prepared = await t.mutation(
      internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(prepared.eventId).toBe(oldestEventId);
  });

  test("reclaims a terminal tenant job pointer immediately", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t, "terminal");
    const eventId = await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "terminal-event",
      occurredAt: 1,
    });
    const terminalJobId = await insertTenantJob(t, {
      ...workspace,
      status: "succeeded",
      suffix: "terminal",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("memoryEvaluationWorkspaceQueues", {
        workspaceId: workspace.workspaceId,
        status: "queued",
        workId: String(terminalJobId),
        updatedAt: Date.now(),
      });
    });

    const prepared = await t.mutation(
      internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(prepared).toEqual({
      shouldEnqueue: true,
      reason: "queued",
      eventId,
      enqueueToken: expect.any(Number),
    });
    expect(
      await t.mutation(
        internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
        { workspaceId: workspace.workspaceId }
      )
    ).toEqual(prepared);
    const queue = await t.run(async (ctx) =>
      ctx.db
        .query("memoryEvaluationWorkspaceQueues")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", workspace.workspaceId)
        )
        .unique()
    );
    expect(queue).toMatchObject({
      status: "queued",
      lastError: "Recovered stale memory evaluation queue work",
    });
    expect(queue?.workId).toBeUndefined();
  });

  test("does not reclaim an active tenant job or clobber its processing event", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t, "active");
    const activeJobId = await insertTenantJob(t, {
      ...workspace,
      status: "running",
      suffix: "active",
    });
    const eventId = await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "active-event",
      occurredAt: 1,
      status: "processing",
      evaluatorWorkflowId: String(activeJobId),
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("memoryEvaluationWorkspaceQueues", {
        workspaceId: workspace.workspaceId,
        status: "running",
        workId: String(activeJobId),
        activeEventId: eventId,
        updatedAt: 1,
      });
    });

    const prepared = await t.mutation(
      internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(prepared).toEqual({
      shouldEnqueue: false,
      reason: "running",
      eventId,
      enqueueToken: null,
    });
    const state = await t.run(async (ctx) => ({
      queue: await ctx.db
        .query("memoryEvaluationWorkspaceQueues")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", workspace.workspaceId)
        )
        .unique(),
      event: await ctx.db.get("memoryWorkflowEvents", eventId),
    }));
    expect(state.queue?.status).toBe("running");
    expect(state.event?.status).toBe("processing");
  });

  test("requeues a processing event owned by stale legacy work", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T00:00:00.000Z"));
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t, "legacy-stale");
    const staleWorkId = "legacy-memory-work";
    const eventId = await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "legacy-stale-event",
      occurredAt: 1,
      status: "processing",
      evaluatorWorkflowId: staleWorkId,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("memoryEvaluatorRuns", {
        workspaceId: workspace.workspaceId,
        eventId,
        eventKey: "memory-queue-legacy-stale-event",
        eventType: "qualification_completed",
        sourceType: "workflow_event",
        sourceId: "legacy-stale-event",
        workflowId: staleWorkId,
        status: "running",
        promotedMemoryCount: 0,
        suggestedMemoryCount: 0,
        queryPerformanceUpdateCount: 0,
        startedAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("memoryEvaluationWorkspaceQueues", {
        workspaceId: workspace.workspaceId,
        status: "running",
        workId: staleWorkId,
        activeEventId: eventId,
        updatedAt: 1,
      });
    });

    const prepared = await t.mutation(
      internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(prepared).toEqual({
      shouldEnqueue: true,
      reason: "queued",
      eventId,
      enqueueToken: expect.any(Number),
    });
    const state = await t.run(async (ctx) => ({
      event: await ctx.db.get("memoryWorkflowEvents", eventId),
      run: await ctx.db
        .query("memoryEvaluatorRuns")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .unique(),
    }));
    expect(state.event).toMatchObject({
      status: "pending",
      error: "Recovered after stale memory evaluation queue work",
    });
    expect(state.event?.evaluatorWorkflowId).toBeUndefined();
    expect(state.run).toMatchObject({
      status: "failed",
      error: "Recovered after stale memory evaluation queue work",
    });
  });

  test("creates a new scheduler job after a cancelled pointer and converges retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T00:00:00.000Z"));
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const workspace = await seedWorkspace(t, "cancelled-reenqueue");
    const eventId = await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "cancelled-reenqueue-event",
      occurredAt: 1,
    });
    const legacyIdempotencyKey = `memory-evaluation:${String(workspace.workspaceId)}:${String(eventId)}`;
    const cancelledJobId = await insertTenantJob(t, {
      ...workspace,
      status: "cancelled",
      suffix: "cancelled-reenqueue",
      idempotencyKey: legacyIdempotencyKey,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("memoryEvaluationWorkspaceQueues", {
        workspaceId: workspace.workspaceId,
        status: "queued",
        workId: String(cancelledJobId),
        lastEnqueuedAt: 1,
        updatedAt: 1,
      });
    });
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });

    const first = await t.action(
      internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(first).toMatchObject({ enqueued: true });
    expect(first.enqueued && first.workId).not.toBe(String(cancelledJobId));

    const retry = await t.action(
      internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
      { workspaceId: workspace.workspaceId }
    );
    expect(retry).toEqual({ enqueued: false, reason: "queued" });

    const state = await t.run(async (ctx) => ({
      jobs: await ctx.db.query("tenantJobs").collect(),
      queue: await ctx.db
        .query("memoryEvaluationWorkspaceQueues")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", workspace.workspaceId)
        )
        .unique(),
    }));
    expect(state.jobs).toHaveLength(2);
    const replacement = state.jobs.find((job) => job._id !== cancelledJobId);
    expect(replacement?.idempotencyKey).toBe(
      `${legacyIdempotencyKey}:${Date.parse("2026-08-29T00:00:00.000Z")}`
    );
    expect(state.queue?.workId).toBe(String(replacement?._id));
  });

  test("rejects delayed attachment and execution from an older enqueue generation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T00:00:00.000Z"));
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t, "generation-guard");
    const eventId = await insertEvent(t, {
      workspaceId: workspace.workspaceId,
      suffix: "generation-guard-event",
      occurredAt: 1,
    });
    const prepared = await t.mutation(
      internal.workflows.memory.prepareMemoryEvaluationQueueEnqueueInternal,
      { workspaceId: workspace.workspaceId }
    );
    if (prepared.enqueueToken === null) {
      throw new Error("Expected an enqueue token");
    }
    const newerToken = prepared.enqueueToken + 1;
    await t.run(async (ctx) => {
      const queue = await ctx.db
        .query("memoryEvaluationWorkspaceQueues")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", workspace.workspaceId)
        )
        .unique();
      if (!queue) throw new Error("Expected queue row");
      await ctx.db.patch(queue._id, { lastEnqueuedAt: newerToken });
    });

    expect(
      await t.mutation(
        internal.workflows.memory.setMemoryEvaluationQueueWorkIdInternal,
        {
          workspaceId: workspace.workspaceId,
          workId: "old-work",
          enqueueToken: prepared.enqueueToken,
        }
      )
    ).toEqual({ attached: false });
    expect(
      await t.mutation(
        internal.workflows.memory.beginMemoryEvaluationQueueWorkInternal,
        {
          workspaceId: workspace.workspaceId,
          enqueueToken: prepared.enqueueToken,
        }
      )
    ).toEqual({ eventId: null, workId: null });

    expect(
      await t.mutation(
        internal.workflows.memory.setMemoryEvaluationQueueWorkIdInternal,
        {
          workspaceId: workspace.workspaceId,
          workId: "new-work",
          enqueueToken: newerToken,
        }
      )
    ).toEqual({ attached: true });
    expect(
      await t.mutation(
        internal.workflows.memory.beginMemoryEvaluationQueueWorkInternal,
        {
          workspaceId: workspace.workspaceId,
          enqueueToken: newerToken,
        }
      )
    ).toEqual({ eventId, workId: "new-work" });
  });
});
