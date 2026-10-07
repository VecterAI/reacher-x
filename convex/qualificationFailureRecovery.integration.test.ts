/// <reference types="vite/client" />

import type { WorkflowId } from "@convex-dev/workflow";
import polarTest from "@convex-dev/polar/test";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import {
  formatQualificationModelFailure,
  getQualificationFailureRetryDelayMs,
} from "./lib/qualificationFailureCore";
import { PLAN_LIMITS } from "./lib/planConstants";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("qualification model failure recovery", () => {
  test("keeps one delayed durable retry scheduled with capped backoff", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T12:46:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-recovery-user",
        email: "qualification-recovery@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification recovery",
        description: "Qualification recovery test workspace",
        isDefault: true,
        prospectingWorkflowStatus: "running",
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qualification-recovery-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        qualificationWorkflowId: "qualification-workflow-1",
        updatedAt: 1,
      });
      return { prospectId, workspaceId };
    });
    const modelError = formatQualificationModelFailure({
      provider: "cerebras -> groq -> openai/azure",
      model: "openai/gpt-oss-120b -> openai/gpt-5.6-sol",
      attemptCount: 3,
      message: "AI_NoObjectGeneratedError: JSONParseError",
    });

    await t.mutation(
      internal.workflows.qualification.handleQualificationComplete,
      {
        workflowId: "qualification-workflow-1" as WorkflowId,
        result: { kind: "failed", error: modelError },
        context: { prospectId: seeded.prospectId },
      }
    );

    const firstFailure = await t.run(async (ctx) => ({
      prospect: await ctx.db.get("prospects", seeded.prospectId),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(firstFailure.prospect?.qualificationLastFailure).toMatchObject({
      attemptCount: 3,
      workflowAttemptCount: 1,
    });
    expect(
      firstFailure.prospect?.qualificationLastFailure?.nextRetryAt
    ).toBeGreaterThan(Date.now());
    expect(
      firstFailure.scheduled.filter((job) =>
        job.name.includes("startQualification")
      )
    ).toHaveLength(1);

    vi.advanceTimersByTime(1_000);
    await t.run((ctx) =>
      ctx.db.patch("prospects", seeded.prospectId, {
        qualificationWorkflowId: "qualification-workflow-2",
      })
    );
    await t.mutation(
      internal.workflows.qualification.handleQualificationComplete,
      {
        workflowId: "qualification-workflow-2" as WorkflowId,
        result: { kind: "failed", error: modelError },
        context: { prospectId: seeded.prospectId },
      }
    );

    const secondFailure = await t.run(async (ctx) => ({
      prospect: await ctx.db.get("prospects", seeded.prospectId),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(secondFailure.prospect?.qualificationLastFailure).toMatchObject({
      attemptCount: 3,
      workflowAttemptCount: 2,
    });
    expect(secondFailure.prospect?.qualificationLastFailure?.nextRetryAt).toBe(
      Date.now() + getQualificationFailureRetryDelayMs(2)
    );
    expect(
      secondFailure.scheduled.filter((job) =>
        job.name.includes("startQualification")
      )
    ).toHaveLength(2);
  });

  test("retries non-model workflow failures instead of orphaning pending state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-workflow-failure-user",
        email: "qualification-workflow-failure@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification workflow failure",
        description: "Qualification workflow failure test workspace",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "linkedin",
        origin: "workspace_discovery",
        externalId: "qualification-workflow-failure-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        qualificationWorkflowId: "qualification-workflow-failure",
        updatedAt: 1,
      });
      return { prospectId };
    });

    await t.mutation(
      internal.workflows.qualification.handleQualificationComplete,
      {
        workflowId: "qualification-workflow-failure" as WorkflowId,
        result: {
          kind: "failed",
          error: "ArgumentValidationError: legacy memory id mismatch",
        },
        context: { prospectId: seeded.prospectId },
      }
    );

    const state = await t.run(async (ctx) => ({
      prospect: await ctx.db.get("prospects", seeded.prospectId),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(state.prospect?.qualificationLastFailure).toMatchObject({
      stage: "workflow",
      code: "qualification_workflow_failed",
      workflowAttemptCount: 1,
    });
    expect(state.prospect?.qualificationLastFailure?.nextRetryAt).toBe(
      Date.now() + getQualificationFailureRetryDelayMs(1)
    );
    expect(
      state.scheduled.filter((job) => job.name.includes("startQualification"))
    ).toHaveLength(1);
  });

  test("claims an orphaned pending prospect once and preserves future retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T13:00:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-orphan-user",
        email: "qualification-orphan@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification orphan",
        description: "Qualification orphan test workspace",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qualification-orphan-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        updatedAt: 1,
      });
      return { prospectId };
    });

    const firstClaim = await t.mutation(
      internal.prospects.claimPendingQualificationRecoveryInternal,
      {
        prospectId: seeded.prospectId,
        expectedUpdatedAt: 1,
        now: Date.now(),
      }
    );
    const duplicateClaim = await t.mutation(
      internal.prospects.claimPendingQualificationRecoveryInternal,
      {
        prospectId: seeded.prospectId,
        expectedUpdatedAt: 1,
        now: Date.now(),
      }
    );
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    const staleCandidates = await t.query(
      internal.prospects.listStalePendingQualificationCandidatesInternal,
      { cutoff: Date.now() - 1, limit: 25 }
    );

    expect(firstClaim).toEqual({
      claimed: true,
      scheduled: true,
      reason: "scheduled",
    });
    expect(duplicateClaim).toEqual({
      claimed: false,
      scheduled: false,
      reason: "stale_snapshot",
    });
    expect(
      scheduled.filter((job) => job.name.includes("startQualification"))
    ).toHaveLength(1);
    expect(staleCandidates).toHaveLength(0);
  });

  test("reconciler finds and schedules an orphaned pending prospect end to end", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T14:00:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const prospectId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-reconciler-user",
        email: "qualification-reconciler@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification reconciler",
        description: "Qualification reconciler test workspace",
        isDefault: true,
        updatedAt: 1,
      });
      return await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qualification-reconciler-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        updatedAt: 1,
      });
    });

    const result = await t.action(
      internal.workflows.qualificationRecovery
        .recoverStalePendingQualificationsInternal,
      { limit: 25 }
    );
    const state = await t.run(async (ctx) => ({
      prospect: await ctx.db.get("prospects", prospectId),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));

    expect(result).toEqual({
      checked: 1,
      active: 0,
      scheduled: 1,
      leasesCleared: 0,
      notDue: 0,
      skipped: 0,
      statusErrors: 0,
    });
    expect(state.prospect?.updatedAt).toBe(Date.now());
    expect(
      state.scheduled.filter((job) => job.name.includes("startQualification"))
    ).toHaveLength(1);
  });

  test("reconciler replaces an invalid workflow lease exactly once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T14:30:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const prospectId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-invalid-lease-user",
        email: "qualification-invalid-lease@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification invalid lease",
        description: "Invalid workflow lease recovery test workspace",
        isDefault: true,
        updatedAt: 1,
      });
      return await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qualification-invalid-lease-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        qualificationWorkflowId: "missing-qualification-workflow",
        updatedAt: 1,
      });
    });

    const firstResult = await t.action(
      internal.workflows.qualificationRecovery
        .recoverStalePendingQualificationsInternal,
      { limit: 25 }
    );
    const secondResult = await t.action(
      internal.workflows.qualificationRecovery
        .recoverStalePendingQualificationsInternal,
      { limit: 25 }
    );
    const state = await t.run(async (ctx) => ({
      prospect: await ctx.db.get("prospects", prospectId),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));

    expect(firstResult).toEqual({
      checked: 1,
      active: 0,
      scheduled: 1,
      leasesCleared: 0,
      notDue: 0,
      skipped: 0,
      statusErrors: 0,
    });
    expect(secondResult).toEqual({
      checked: 0,
      active: 0,
      scheduled: 0,
      leasesCleared: 0,
      notDue: 0,
      skipped: 0,
      statusErrors: 0,
    });
    expect(state.prospect?.qualificationWorkflowId).toBeUndefined();
    expect(state.prospect?.updatedAt).toBe(Date.now());
    expect(
      state.scheduled.filter((job) => job.name.includes("startQualification"))
    ).toHaveLength(1);
  });

  test("only one caller can claim a due qualification failure retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T15:00:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const failedAt = Date.now() - getQualificationFailureRetryDelayMs(1);
    const prospectId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-retry-claim-user",
        email: "qualification-retry-claim@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification retry claim",
        description: "Qualification retry claim test workspace",
        isDefault: true,
        updatedAt: 1,
      });
      return await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qualification-retry-claim-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        qualificationLastFailure: {
          stage: "workflow",
          provider: "convex_workflow",
          code: "qualification_workflow_failed",
          message: "temporary failure",
          workflowAttemptCount: 1,
          nextRetryAt: Date.now(),
          failedAt,
        },
        updatedAt: 1,
      });
    });

    const firstClaim = await t.mutation(
      internal.prospects.claimQualificationFailureRetryInternal,
      { prospectId, expectedFailureAt: failedAt, now: Date.now() }
    );
    const duplicateClaim = await t.mutation(
      internal.prospects.claimQualificationFailureRetryInternal,
      { prospectId, expectedFailureAt: failedAt, now: Date.now() }
    );
    const claimedProspect = await t.run((ctx) =>
      ctx.db.get("prospects", prospectId)
    );

    expect(firstClaim).toBe(true);
    expect(duplicateClaim).toBe(false);
    expect(
      claimedProspect?.qualificationLastFailure?.workflowAttemptCount
    ).toBe(1);
    expect(claimedProspect?.qualificationLastFailure?.nextRetryAt).toBe(
      Date.now() + getQualificationFailureRetryDelayMs(1)
    );
  });

  test("legacy failure backoff and archived rows cannot consume recovery slots", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T16:00:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-recovery-capacity-user",
        email: "qualification-recovery-capacity@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification recovery capacity",
        description: "Qualification recovery capacity test workspace",
        isDefault: true,
        updatedAt: 1,
      });
      for (let index = 0; index < 30; index += 1) {
        await ctx.db.insert("prospects", {
          workspaceId,
          userId,
          platform: "twitter",
          origin: "workspace_discovery",
          externalId: `archived-qualification-prospect-${index}`,
          data: {},
          status: "archived",
          qualificationStatus: "pending",
          updatedAt: index + 1,
        });
      }
      const activeProspectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "active-qualification-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        updatedAt: 100,
      });
      const failedAt = Date.now();
      const legacyFailureProspectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "linkedin",
        origin: "manual",
        externalId: "legacy-failure-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        qualificationLastFailure: {
          stage: "workflow",
          provider: "convex_workflow",
          code: "qualification_workflow_failed",
          message: "legacy failure",
          workflowAttemptCount: 2,
          failedAt,
        },
        updatedAt: 101,
      });
      return { activeProspectId, legacyFailureProspectId, failedAt };
    });

    const candidates = await t.query(
      internal.prospects.listStalePendingQualificationCandidatesInternal,
      { cutoff: 200, limit: 1 }
    );
    const legacyClaim = await t.mutation(
      internal.prospects.claimPendingQualificationRecoveryInternal,
      {
        prospectId: seeded.legacyFailureProspectId,
        expectedUpdatedAt: 101,
        expectedFailureAt: seeded.failedAt,
        now: Date.now() + 60_000,
      }
    );

    expect(candidates.map((candidate) => candidate.prospectId)).toEqual([
      seeded.activeProspectId,
    ]);
    expect(legacyClaim).toEqual({
      claimed: false,
      scheduled: false,
      reason: "not_due",
    });
  });

  test("stops automatic retries once the qualification retry cap is reached", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-retry-cap-user",
        email: "qualification-retry-cap@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification retry cap",
        description: "Qualification retry cap test workspace",
        isDefault: true,
        prospectingWorkflowStatus: "running",
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qualification-retry-cap-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        updatedAt: 1,
      });
      return { prospectId };
    });
    const modelError = formatQualificationModelFailure({
      provider: "openai/azure",
      model: "openai/gpt-5.6-sol",
      attemptCount: 2,
      message: "AI_NoObjectGeneratedError: JSONParseError",
    });

    let scheduledRetries = 0;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await t.mutation(
        internal.workflows.qualification.handleQualificationComplete,
        {
          workflowId: `qualification-cap-workflow-${attempt}` as WorkflowId,
          result: { kind: "failed", error: modelError },
          context: { prospectId: seeded.prospectId },
        }
      );
      const state = await t.run(async (ctx) => ({
        prospect: await ctx.db.get("prospects", seeded.prospectId),
        scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
      }));
      scheduledRetries = state.scheduled.filter((job) =>
        job.name.includes("startQualification")
      ).length;
      // Attempts 1-4 schedule one retry each; attempt 5 hits the cap, so
      // attempts 5 and 6 must not add more scheduled retries.
      const expectedScheduled = Math.min(attempt, 4);
      expect(scheduledRetries).toBe(expectedScheduled);
      expect(state.prospect?.qualificationStatus).toBe("pending");
    }

    const finalState = await t.run(async (ctx) => ({
      prospect: await ctx.db.get("prospects", seeded.prospectId),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(
      finalState.prospect?.qualificationLastFailure?.workflowAttemptCount
    ).toBe(6);
    expect(finalState.scheduled).toHaveLength(4);
  });

  test("pauses workspace automation instead of retrying when AI credits are exhausted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-credit-exhaustion-user",
        email: "qualification-credit-exhaustion@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification credit exhaustion",
        description: "Qualification credit exhaustion test workspace",
        isDefault: true,
        prospectingWorkflowStatus: "running",
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qualification-credit-exhaustion-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        updatedAt: 1,
      });
      return { prospectId, workspaceId };
    });
    const creditError =
      'Error: Uncaught QualificationEvaluationError: [QUALIFICATION_MODEL_EVALUATION_FAILED] provider="openai/azure" model="openai/gpt-5.6-sol" attempts=2 message="This request requires more credits, or fewer max_tokens. You requested up to 16384 tokens, but can only afford 1056."';

    await t.mutation(
      internal.workflows.qualification.handleQualificationComplete,
      {
        workflowId: "qualification-credit-workflow-1" as WorkflowId,
        result: { kind: "failed", error: creditError },
        context: { prospectId: seeded.prospectId },
      }
    );

    // The pause runs as a scheduled action; advancing simulated time runs it.
    vi.advanceTimersByTime(60_000);
    await t.finishInProgressScheduledFunctions();
    const state = await t.run(async (ctx) => {
      const workspace = await ctx.db.get("workspaces", seeded.workspaceId);
      const prospect = await ctx.db.get("prospects", seeded.prospectId);
      const scheduled = await ctx.db.system
        .query("_scheduled_functions")
        .collect();
      return { workspace, prospect, scheduled };
    });

    expect(state.workspace?.prospectingWorkflowStatus).toBe("paused");
    expect(state.workspace?.prospectingWorkflowPauseReason).toBe(
      "ai_credits_exhausted"
    );
    expect(state.prospect?.qualificationStatus).toBe("pending");
    expect(state.prospect?.qualificationLastFailure?.workflowAttemptCount).toBe(
      1
    );
    // No qualification retry may be scheduled for an out-of-credits failure.
    expect(
      state.scheduled.filter((job) => job.name.includes("startQualification"))
    ).toHaveLength(0);
  });

  test("manual resume resets the retry cap and recovery can claim again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    polarTest.register(t);
    const failedAt = Date.now() - 60 * 60 * 1000;
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-manual-reset-user",
        email: "qualification-manual-reset@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        ...PLAN_LIMITS.hobby,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification manual reset",
        description: "Qualification manual reset test workspace",
        isDefault: true,
        prospectingWorkflowStatus: "running",
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qualification-manual-reset-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        qualificationLastFailure: {
          stage: "model_evaluation",
          provider: "openai/azure",
          model: "openai/gpt-5.6-sol",
          code: "qualification_model_evaluation_failed",
          message: "model evaluation failed",
          attemptCount: 2,
          workflowAttemptCount: 5,
          failedAt,
        },
        updatedAt: 1,
      });
      return { prospectId, workspaceId, failedAt };
    });

    // The recovery cron must not resurrect a capped prospect.
    const cappedClaim = await t.mutation(
      internal.prospects.claimPendingQualificationRecoveryInternal,
      {
        prospectId: seeded.prospectId,
        expectedUpdatedAt: 1,
        expectedWorkflowId: undefined,
        expectedFailureAt: seeded.failedAt,
        now: Date.now(),
      }
    );
    expect(cappedClaim).toEqual({
      claimed: false,
      scheduled: false,
      reason: "ineligible",
    });

    const reset = await t.mutation(
      internal.prospects.resetQualificationFailureForWorkspaceInternal,
      { workspaceId: seeded.workspaceId }
    );
    expect(reset).toMatchObject({ cleared: 1, scanned: 1, hasMore: false });

    // The reset patches the prospect, so claim against the fresh snapshot.
    const resetState = await t.run(async (ctx) => ({
      prospect: await ctx.db.get("prospects", seeded.prospectId),
    }));
    const resumedClaim = await t.mutation(
      internal.prospects.claimPendingQualificationRecoveryInternal,
      {
        prospectId: seeded.prospectId,
        expectedUpdatedAt: resetState.prospect?.updatedAt ?? 1,
        expectedWorkflowId: undefined,
        now: Date.now(),
      }
    );
    expect(resumedClaim).toMatchObject({ claimed: true, scheduled: true });
  });
});
