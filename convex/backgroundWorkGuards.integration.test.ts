/// <reference types="vite/client" />

import { DirectAggregate } from "@convex-dev/aggregate";
import polarTest from "@convex-dev/polar/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { components, internal } from "./_generated/api";
import schema from "./schema";
import { PLAN_LIMITS } from "./lib/planConstants";
import { awaitRetriedActionResult } from "./lib/retrierWorkflow";
import type { RunId } from "@convex-dev/action-retrier";

const modules = import.meta.glob("./**/*.ts");
const now = Date.UTC(2026, 10, 1, 12);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

interface FixtureOptions {
  tier?: "free" | "hobby" | "base" | "pro";
  qualifiedUsed?: number;
  workflowStatus?: "running" | "paused" | "stopped";
}

async function fixture(options: FixtureOptions = {}) {
  const {
    tier = "hobby",
    qualifiedUsed = 2,
    workflowStatus = "running",
  } = options;
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  polarTest.register(t);
  const data = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "guard-owner",
      email: "guard-owner@example.test",
    });
    await ctx.db.insert("userPlans", {
      userId,
      tier,
      ...PLAN_LIMITS[tier],
      currentProspectsCount: qualifiedUsed,
      updatedAt: now,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Guard workspace",
      description: "Guard workspace",
      isDefault: true,
      setupCompletedAt: now - 1,
      prospectingWorkflowStatus: workflowStatus,
      updatedAt: now,
    });
    await ctx.db.insert("workspaceReportingRollouts", {
      workspaceId,
      userId,
      aggregateVersion: 1,
      status: "verified",
      revision: 1,
      stage: "verifyAgentOpsStripes",
      batchSize: 10,
      backfilledCount: 0,
      verifiedSourceCount: 0,
      expectedAnalyticsSums: [],
      expectedAgentOpsSums: [],
      expectedQualifiedUsageCount: qualifiedUsed,
      startedAt: now,
      updatedAt: now,
    });
    const aggregate = new DirectAggregate(
      components.workspaceReportingAggregate
    );
    await aggregate.insert(ctx, {
      namespace: [1, workspaceId, "usage"],
      key: ["qualifiedProspectsCount", now],
      id: "usage",
      sumValue: qualifiedUsed,
    });
    for (let i = 0; i < qualifiedUsed; i++) {
      await ctx.db.insert("prospects", {
        userId,
        workspaceId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: `guard-used-${i}`,
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        qualifiedAt: now,
        updatedAt: now,
      });
    }
    const prospectId = await ctx.db.insert("prospects", {
      userId,
      workspaceId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: "guard-pending-prospect",
      data: {},
      status: "new",
      qualificationStatus: "pending",
      updatedAt: now,
    });
    return { userId, workspaceId, prospectId };
  });
  return { t, ...data };
}

describe("background work gate", () => {
  test("allows an active workspace under its match limit with closed circuits", async () => {
    const { t, workspaceId, prospectId } = await fixture();
    const gate = await t.query(
      internal.lib.backgroundWorkGuards.checkBackgroundWorkAllowedInternal,
      { workspaceId, prospectId }
    );
    expect(gate).toEqual({ allowed: true, reasons: [] });
  });

  test("blocks a paused workspace", async () => {
    const { t, workspaceId, prospectId } = await fixture({
      workflowStatus: "paused",
    });
    const gate = await t.query(
      internal.lib.backgroundWorkGuards.checkBackgroundWorkAllowedInternal,
      { workspaceId, prospectId }
    );
    expect(gate).toEqual({
      allowed: false,
      reasons: ["workspace_inactive"],
    });
  });

  test("blocks a workspace whose match limit is reached", async () => {
    const { t, workspaceId, prospectId } = await fixture({
      qualifiedUsed: 100,
    });
    const gate = await t.query(
      internal.lib.backgroundWorkGuards.checkBackgroundWorkAllowedInternal,
      { workspaceId, prospectId }
    );
    expect(gate).toEqual({
      allowed: false,
      reasons: ["prospect_limit_reached"],
    });
  });

  test("blocks while the platform provider circuit is open", async () => {
    const { t, workspaceId, prospectId } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("providerCircuitStates", {
        provider: "socialapi",
        status: "open",
        consecutiveFailures: 5,
        openedAt: now - 60_000,
        retryAfterAt: now + 10 * 60_000,
        updatedAt: now,
      });
    });
    const gate = await t.query(
      internal.lib.backgroundWorkGuards.checkBackgroundWorkAllowedInternal,
      { workspaceId, prospectId }
    );
    expect(gate).toEqual({
      allowed: false,
      reasons: ["provider_circuit_open"],
    });
  });

  test("allows work when the open circuit's probe window has arrived", async () => {
    const { t, workspaceId, prospectId } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("providerCircuitStates", {
        provider: "socialapi",
        status: "open",
        consecutiveFailures: 5,
        openedAt: now - 10 * 60_000,
        retryAfterAt: now - 1,
        updatedAt: now,
      });
    });
    const gate = await t.query(
      internal.lib.backgroundWorkGuards.checkBackgroundWorkAllowedInternal,
      { workspaceId, prospectId }
    );
    expect(gate).toEqual({ allowed: true, reasons: [] });
  });

  test("pool entry parks queued qualifications for a paused workspace", async () => {
    const { t, workspaceId, prospectId } = await fixture({
      workflowStatus: "paused",
    });
    const result = await t.action(
      internal.workflows.qualification.runQualificationWorkflow,
      { prospectId, workspaceId }
    );
    expect(result).toEqual({ workflowId: "" });
  });

  test("pool entry reconciles capacity state when the match limit is reached", async () => {
    const { t, workspaceId, prospectId } = await fixture({
      qualifiedUsed: 100,
    });
    const result = await t.action(
      internal.workflows.qualification.runQualificationWorkflow,
      { prospectId, workspaceId }
    );
    expect(result).toEqual({ workflowId: "" });
    const workspace = await t.run(async (ctx) =>
      ctx.db.get("workspaces", workspaceId)
    );
    expect(workspace?.prospectingWorkflowStatus).toBe("limit_reached");
  });

  test("atomic claim start refuses paused workspaces", async () => {
    const { t, workspaceId, prospectId } = await fixture({
      workflowStatus: "paused",
    });
    const result = await t.mutation(
      internal.workflows.qualification.startQualificationWorkflowAtomically,
      { prospectId, workspaceId }
    );
    expect(result).toEqual({ workflowId: "" });
  });

  test("recovery claim refuses a paused workspace", async () => {
    const { t, prospectId } = await fixture({
      workflowStatus: "paused",
    });
    const prospect = await t.run(async (ctx) =>
      ctx.db.get("prospects", prospectId)
    );
    const claim = await t.mutation(
      internal.prospects.claimPendingQualificationRecoveryInternal,
      {
        prospectId,
        expectedUpdatedAt: prospect!.updatedAt,
        expectedWorkflowId: undefined,
        expectedFailureAt: undefined,
        now,
      }
    );
    expect(claim).toMatchObject({ claimed: false, reason: "ineligible" });
  });

  test("recovery claim refuses a workspace whose match limit is reached", async () => {
    const { t, prospectId } = await fixture({ qualifiedUsed: 100 });
    const prospect = await t.run(async (ctx) =>
      ctx.db.get("prospects", prospectId)
    );
    const claim = await t.mutation(
      internal.prospects.claimPendingQualificationRecoveryInternal,
      {
        prospectId,
        expectedUpdatedAt: prospect!.updatedAt,
        expectedWorkflowId: undefined,
        expectedFailureAt: undefined,
        now,
      }
    );
    expect(claim).toMatchObject({ claimed: false, reason: "ineligible" });
  });
});

describe("retried action result store", () => {
  test("records, reads, and replaces terminal results", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);

    const runId = "retrier-run-success-1" as RunId;
    await t.mutation(internal.lib.retrier.recordRetriedActionCompletion, {
      runId,
      result: { type: "success", returnValue: { posts: [1, 2, 3] } },
    });
    let stored = await t.query(internal.lib.retrier.getRetriedActionResult, {
      runId,
    });
    expect(stored).toMatchObject({
      outcome: "success",
      returnValue: { posts: [1, 2, 3] },
    });

    await t.mutation(internal.lib.retrier.recordRetriedActionCompletion, {
      runId,
      result: { type: "failed", error: "provider down" },
    });
    stored = await t.query(internal.lib.retrier.getRetriedActionResult, {
      runId,
    });
    expect(stored).toMatchObject({ outcome: "failed", error: "provider down" });

    const count = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("retriedActionResults")
        .filter((q) => q.eq(q.field("runId"), runId))
        .collect();
      return rows.length;
    });
    expect(count).toBe(1);

    await t.mutation(internal.lib.retrier.deleteRetriedActionResult, {
      runId,
    });
    stored = await t.query(internal.lib.retrier.getRetriedActionResult, {
      runId,
    });
    expect(stored).toBeNull();
  });

  test("cleanup deletes only results older than the retention window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("retriedActionResults", {
        runId: "expired-1",
        outcome: "success",
        returnValue: null,
        completedAt: now - 25 * 60 * 60 * 1000,
      });
      await ctx.db.insert("retriedActionResults", {
        runId: "fresh-1",
        outcome: "failed",
        error: "nope",
        completedAt: now - 60 * 1000,
      });
    });

    const { deleted } = await t.mutation(
      internal.lib.retrier.cleanupExpiredRetriedActionResults,
      {}
    );
    expect(deleted).toBe(1);

    const expiredGone = await t.query(
      internal.lib.retrier.getRetriedActionResult,
      { runId: "expired-1" as RunId }
    );
    const freshAlive = await t.query(
      internal.lib.retrier.getRetriedActionResult,
      { runId: "fresh-1" as RunId }
    );
    expect(expiredGone).toBeNull();
    expect(freshAlive).not.toBeNull();
  });
});

describe("awaitRetriedActionResult", () => {
  type FakeStepShape = {
    runMutation: (ref: unknown, args: unknown) => Promise<{ runId: string }>;
    runQuery: (ref: unknown, args: unknown) => Promise<unknown>;
    sleep: (ms: number, opts?: { name?: string }) => Promise<void>;
  };

  function makeFakeStep(t: ReturnType<typeof convexTest>): FakeStepShape {
    return {
      runMutation: async () => ({ runId: "helper-test-run" as RunId }),
      runQuery: async (ref, args) =>
        await t.query(
          ref as Parameters<typeof t.query>[0],
          args as Record<string, never>
        ),
      sleep: async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      },
    };
  }

  test("returns the stored return value once the run completes", async () => {
    const t = convexTest(schema, modules);
    const step = makeFakeStep(t);
    await t.mutation(internal.lib.retrier.recordRetriedActionCompletion, {
      runId: "helper-test-run" as RunId,
      result: { type: "success", returnValue: { posts: ["a"] } },
    });

    const result = await awaitRetriedActionResult(step as never, {
      start: internal.lib.retrier.deleteRetriedActionResult,
      startArgs: { runId: "unused" as RunId },
      label: "test:success",
      pollMs: 5,
      maxWaitMs: 5_000,
    });
    expect(result).toMatchObject({
      outcome: "success",
      returnValue: { posts: ["a"] },
    });
  });

  test("throws when the retried run fails", async () => {
    const t = convexTest(schema, modules);
    const step = makeFakeStep(t);
    await t.mutation(internal.lib.retrier.recordRetriedActionCompletion, {
      runId: "helper-test-run" as RunId,
      result: { type: "failed", error: "boom" },
    });

    await expect(
      awaitRetriedActionResult(step as never, {
        start: internal.lib.retrier.deleteRetriedActionResult,
        startArgs: { runId: "unused" as RunId },
        label: "test:failure",
        pollMs: 5,
        maxWaitMs: 5_000,
      })
    ).rejects.toThrow("boom");
  });

  test("throws a timeout when the result never arrives", async () => {
    const t = convexTest(schema, modules);
    const step = makeFakeStep(t);

    await expect(
      awaitRetriedActionResult(step as never, {
        start: internal.lib.retrier.deleteRetriedActionResult,
        startArgs: { runId: "unused" as RunId },
        label: "test:timeout",
        pollMs: 5,
        maxWaitMs: 15,
      })
    ).rejects.toThrow("Timed out");
  });
});
