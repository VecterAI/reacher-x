/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_PROSPECTING_RECOVERY_ATTEMPTS } from "./lib/prospectingHelpers";
import { TENANT_JOB_PRIORITY } from "./lib/tenantSchedulerCore";
import type { WorkflowId } from "@convex-dev/workflow";
import { workflow } from "./lib/workflow";
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
  const polarTestPath = ["@convex-dev/polar", "test"].join("/");
  const workflowTestPath = ["@convex-dev/workflow", "test"].join("/");
  const [
    workpoolTest,
    batchWorkerTest,
    rateLimiterTest,
    polarTest,
    workflowTest,
  ] = await Promise.all([
    import(workpoolPath),
    import(batchWorkerPath),
    import(rateLimiterPath),
    import(polarTestPath),
    import(workflowTestPath),
  ]);

  for (const name of WORKPOOL_NAMES) {
    workpoolTest.default.register(t, name);
  }
  batchWorkerTest.default.register(t, "batchWorker");
  rateLimiterTest.default.register(t, "rateLimiter");
  type Registerable = { default: { register: (instance: unknown) => void } };
  (polarTest as unknown as Registerable).default.register(t);
  (workflowTest as unknown as Registerable).default.register(t);
}

type WorkspaceStatus = "running" | "paused" | "stopped" | "limit_reached";

const READY_ICPS = [
  {
    title: "Series A SaaS founders",
    description: "Founders scaling B2B SaaS teams",
    painPoints: ["manual outreach"],
    channels: ["twitter"],
    syntheticExamples: [
      {
        platform: "twitter" as const,
        displayName: "Ava Founder",
        title: "SaaS founder",
        bio: "Building in public",
      },
      {
        platform: "linkedin" as const,
        displayName: "Ben Ops",
        title: "Head of Operations",
        bio: "Operations leader scaling teams",
      },
    ],
    syntheticPosts: ["Just shipped our onboarding revamp."],
    qualificationKeywords: ["founder", "b2b saas"],
  },
];

async function seedWorkspace(
  t: ReturnType<typeof convexTest>,
  args: {
    suffix: string;
    status?: WorkspaceStatus;
    withAgentData?: boolean;
    planTier?: "hobby" | "base";
  }
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `leak-guard-${args.suffix}`,
      email: `leak-guard-${args.suffix}@example.test`,
    });
    if (args.planTier) {
      // Free tier workspaces are plan limited by design (0 qualified matches
      // per cycle), so restart tests seed a paid plan.
      await ctx.db.insert("userPlans", {
        userId,
        tier: args.planTier,
        prospectsLimit: args.planTier === "hobby" ? 100 : 1000,
        workspacesLimit: args.planTier === "hobby" ? 1 : 2,
        currentProspectsCount: 0,
        updatedAt: Date.now(),
      });
    }
    const now = Date.now();
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Leak guard ${args.suffix}`,
      description: "Leak guard test workspace",
      isDefault: true,
      ...(args.status === undefined
        ? {}
        : { prospectingWorkflowStatus: args.status }),
      updatedAt: now,
    });
    if (args.withAgentData) {
      await ctx.db.patch(workspaceId, {
        improvedDescription: "Automated prospecting for B2B SaaS founders",
        icps: READY_ICPS,
      });
    }
    return { userId, workspaceId };
  });
}

async function seedFailedRecoveryState(
  t: ReturnType<typeof convexTest>,
  ids: { userId: Id<"users">; workspaceId: Id<"workspaces"> },
  args: { recoveryAttemptId: number; failureStreak?: number }
) {
  return await t.run(async (ctx) => {
    await ctx.db.patch(ids.workspaceId, {
      prospectingWorkflowStatus: "stopped",
      onboardingIssueStatusCode: "workflow_failed",
      onboardingIssueSource: "workflow",
      onboardingIssueUpdatedAt: Date.now(),
      prospectingRecoveryAttemptId: args.recoveryAttemptId,
      prospectingFailureStreak: args.failureStreak ?? 1,
      prospectingLastFailureAt: Date.now(),
      prospectingNextRecoveryAt: Date.now() - 1_000,
    });
  });
}

async function listScheduledFunctions(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect()
  );
}

function countScheduled(jobs: Array<{ name: string }>, needle: string): number {
  return jobs.filter((job) => job.name.includes(needle)).length;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("prospecting failure recovery is credit-bounded", () => {
  test("restarts a failed workspace within the attempt cap and keeps the counter", async () => {
    vi.setSystemTime(new Date("2026-09-28T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const seeded = await seedWorkspace(t, {
      suffix: "recover-in-cap",
      withAgentData: true,
      planTier: "base",
    });
    await seedFailedRecoveryState(t, seeded, { recoveryAttemptId: 1 });

    const result = await t.action(
      internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
      { workspaceId: seeded.workspaceId, recoveryAttemptId: 1 }
    );

    expect(result.success).toBe(true);
    expect(result.outcome).toBe("restarted");
    expect(result.workflowId).toEqual(expect.any(String));

    const workspace = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
    expect(workspace?.prospectingWorkflowStatus).toBe("running");
    // Automatic restarts keep the attempt counter and streak so the cap and
    // backoff hold across the fail-recover loop.
    expect(workspace?.prospectingRecoveryAttemptId).toBe(1);
    expect(workspace?.prospectingFailureStreak).toBe(1);
    expect(workspace?.prospectingNextRecoveryAt).toBeUndefined();
    expect(workspace?.onboardingIssueStatusCode).toBeUndefined();

    const scheduled = await listScheduledFunctions(t);
    expect(
      countScheduled(scheduled, "attemptProspectingWorkflowRecoveryInternal")
    ).toBe(0);
  });

  test("restarts at the exact attempt cap boundary", async () => {
    vi.setSystemTime(new Date("2026-09-28T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const seeded = await seedWorkspace(t, {
      suffix: "recover-boundary",
      withAgentData: true,
      planTier: "base",
    });
    await seedFailedRecoveryState(t, seeded, {
      recoveryAttemptId: MAX_PROSPECTING_RECOVERY_ATTEMPTS,
    });

    const result = await t.action(
      internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
      {
        workspaceId: seeded.workspaceId,
        recoveryAttemptId: MAX_PROSPECTING_RECOVERY_ATTEMPTS,
      }
    );
    expect(result.success).toBe(true);
    expect(result.outcome).toBe("restarted");
  });

  test("stops auto-restarting after the attempt cap and waits for the user", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, {
      suffix: "recover-exhausted",
      withAgentData: true,
      planTier: "base",
    });
    await seedFailedRecoveryState(t, seeded, {
      recoveryAttemptId: MAX_PROSPECTING_RECOVERY_ATTEMPTS + 1,
      failureStreak: 43,
    });

    const result = await t.action(
      internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
      {
        workspaceId: seeded.workspaceId,
        recoveryAttemptId: MAX_PROSPECTING_RECOVERY_ATTEMPTS + 1,
      }
    );

    expect(result).toEqual({ success: false, outcome: "recovery_exhausted" });

    const workspace = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
    expect(workspace?.prospectingWorkflowStatus).toBe("stopped");
    expect(workspace?.onboardingIssueStatusCode).toBe("workflow_failed");
    // The attempt ID is a monotonic token (never reset) so outstanding
    // timers from earlier episodes always read as stale.
    expect(workspace?.prospectingRecoveryAttemptId).toBe(
      MAX_PROSPECTING_RECOVERY_ATTEMPTS + 1
    );
    expect(workspace?.prospectingFailureStreak).toBeUndefined();
    expect(workspace?.prospectingNextRecoveryAt).toBeUndefined();
    expect(workspace?.prospectingWorkflowId).toBeUndefined();
    expect(await listScheduledFunctions(t)).toHaveLength(0);
  });

  test("lets a user retry restart the workspace after the cap was hit", async () => {
    vi.setSystemTime(new Date("2026-09-28T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const seeded = await seedWorkspace(t, {
      suffix: "recover-retry-after-cap",
      withAgentData: true,
      planTier: "base",
    });
    await seedFailedRecoveryState(t, seeded, {
      recoveryAttemptId: MAX_PROSPECTING_RECOVERY_ATTEMPTS + 1,
    });
    await t.action(
      internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
      {
        workspaceId: seeded.workspaceId,
        recoveryAttemptId: MAX_PROSPECTING_RECOVERY_ATTEMPTS + 1,
      }
    );

    // The user retry path (startProspectingWorkflow) clears recovery state.
    // Simulate the retry running and failing again: a fresh failure episode
    // must be able to recover again.
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, {
        prospectingWorkflowStatus: "running",
      })
    );
    await t.mutation(internal.workflows.prospecting.handleWorkflowComplete, {
      workflowId: "wf-retry-after-cap" as WorkflowId,
      result: { kind: "failed", error: "Twitter search failed" },
      context: { workspaceId: String(seeded.workspaceId) },
    });
    const freshFailure = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
    const freshAttemptId = freshFailure?.prospectingRecoveryAttemptId ?? 0;
    expect(freshAttemptId).toBeGreaterThan(MAX_PROSPECTING_RECOVERY_ATTEMPTS);

    const result = await t.action(
      internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
      {
        workspaceId: seeded.workspaceId,
        recoveryAttemptId: freshAttemptId,
      }
    );
    expect(result.success).toBe(true);
    expect(result.outcome).toBe("restarted");

    if (result.workflowId) {
      await t.run(async (ctx) => {
        // The workflow may have already terminated in the test runtime.
        try {
          await workflow.cancel(ctx, result.workflowId as WorkflowId);
        } catch {
          // Nothing to cancel.
        }
      });
    }
  });

  test("holds prospecting auto-recovery while the emergency brake is on", async () => {
    const previousFlag = process.env.PAUSE_AUTONOMOUS_JOBS;
    process.env.PAUSE_AUTONOMOUS_JOBS = "true";
    try {
      const t = convexTest(schema, modules);
      await registerSchedulerComponents(t);
      const seeded = await seedWorkspace(t, {
        suffix: "recover-brake",
        withAgentData: true,
        planTier: "base",
      });
      await seedFailedRecoveryState(t, seeded, { recoveryAttemptId: 1 });

      const result = await t.action(
        internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
        { workspaceId: seeded.workspaceId, recoveryAttemptId: 1 }
      );

      expect(result).toEqual({
        success: false,
        outcome: "autonomous_jobs_paused",
      });
      const workspace = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
      expect(workspace?.prospectingWorkflowStatus).toBe("stopped");
      expect(workspace?.onboardingIssueStatusCode).toBe("workflow_failed");
      expect(workspace?.prospectingRecoveryAttemptId).toBe(1);
      // The recovery re-arms itself on a poll so lifting the brake resumes it.
      const scheduled = await listScheduledFunctions(t);
      expect(
        countScheduled(scheduled, "attemptProspectingWorkflowRecoveryInternal")
      ).toBe(1);
    } finally {
      if (previousFlag === undefined) {
        delete process.env.PAUSE_AUTONOMOUS_JOBS;
      } else {
        process.env.PAUSE_AUTONOMOUS_JOBS = previousFlag;
      }
    }
  });

  test("caps automatic restarts across a full fail-recover loop", async () => {
    vi.setSystemTime(new Date("2026-09-28T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const seeded = await seedWorkspace(t, {
      suffix: "recover-loop",
      status: "running",
      withAgentData: true,
      planTier: "base",
    });

    // Drive the real loop: failure -> recovery restart -> failure -> ...,
    // with the started durable workflows idle under fake timers.
    for (
      let attempt = 1;
      attempt <= MAX_PROSPECTING_RECOVERY_ATTEMPTS;
      attempt += 1
    ) {
      await t.mutation(internal.workflows.prospecting.handleWorkflowComplete, {
        workflowId: `wf-loop-${attempt}` as WorkflowId,
        result: { kind: "failed", error: "Twitter search failed" },
        context: { workspaceId: String(seeded.workspaceId) },
      });

      const afterFailure = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
      expect(afterFailure?.prospectingWorkflowStatus).toBe("stopped");
      expect(afterFailure?.prospectingRecoveryAttemptId).toBe(attempt);

      const result = await t.action(
        internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
        { workspaceId: seeded.workspaceId, recoveryAttemptId: attempt }
      );
      expect(result.success).toBe(true);
      expect(result.outcome).toBe("restarted");

      const afterRestart = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
      expect(afterRestart?.prospectingWorkflowStatus).toBe("running");
      expect(afterRestart?.prospectingRecoveryAttemptId).toBe(attempt);
    }

    // One more failure pushes the counter past the cap: recovery must now
    // refuse to restart and hand the workspace back to the user.
    await t.mutation(internal.workflows.prospecting.handleWorkflowComplete, {
      workflowId:
        `wf-loop-${MAX_PROSPECTING_RECOVERY_ATTEMPTS + 1}` as WorkflowId,
      result: { kind: "failed", error: "Twitter search failed" },
      context: { workspaceId: String(seeded.workspaceId) },
    });
    const finalResult = await t.action(
      internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
      {
        workspaceId: seeded.workspaceId,
        recoveryAttemptId: MAX_PROSPECTING_RECOVERY_ATTEMPTS + 1,
      }
    );
    expect(finalResult).toEqual({
      success: false,
      outcome: "recovery_exhausted",
    });
    const exhausted = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
    expect(exhausted?.prospectingWorkflowStatus).toBe("stopped");
    expect(exhausted?.onboardingIssueStatusCode).toBe("workflow_failed");
    expect(exhausted?.prospectingRecoveryAttemptId).toBe(
      MAX_PROSPECTING_RECOVERY_ATTEMPTS + 1
    );
    expect(exhausted?.prospectingFailureStreak).toBeUndefined();
  });
});

describe("failure completion respects workspace ownership", () => {
  async function seedRunningWorkspaceWithLane(
    t: ReturnType<typeof convexTest>,
    suffix: string
  ) {
    const seeded = await seedWorkspace(t, { suffix, status: "running" });
    return await t.run(async (ctx) => {
      const laneId = await ctx.db.insert("tenantJobLanes", {
        tenantKey: `workspace:${String(seeded.workspaceId)}`,
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        state: "ready",
        pendingCount: 1,
        runningCount: 0,
        minPriority: TENANT_JOB_PRIORITY.background,
        lastDispatchedAt: 1,
        updatedAt: 1,
      });
      const jobId = await ctx.db.insert("tenantJobs", {
        tenantKey: `workspace:${String(seeded.workspaceId)}`,
        laneId,
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        class: "background",
        kind: "memory_evaluation",
        status: "queued",
        priority: TENANT_JOB_PRIORITY.background,
        idempotencyKey: `failure-lane-${suffix}`,
        payload: {
          kind: "memory_evaluation",
          workspaceId: seeded.workspaceId,
          enqueueToken: 1,
        },
        attemptCount: 0,
        queuedAt: 1,
        updatedAt: 1,
      });
      return { ...seeded, laneId, jobId };
    });
  }

  test("records the failure and pauses queued tenant jobs for a running workspace", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedRunningWorkspaceWithLane(t, "failure-running");

    await t.mutation(internal.workflows.prospecting.handleWorkflowComplete, {
      workflowId: "wf-failure-running" as WorkflowId,
      result: { kind: "failed", error: "Twitter search failed" },
      context: { workspaceId: String(seeded.workspaceId) },
    });

    const workspace = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
    expect(workspace?.prospectingWorkflowStatus).toBe("stopped");
    expect(workspace?.onboardingIssueStatusCode).toBe("workflow_failed");
    expect(workspace?.prospectingFailureStreak).toBe(1);
    expect(workspace?.prospectingRecoveryAttemptId).toBe(1);
    expect(workspace?.prospectingNextRecoveryAt).toEqual(expect.any(Number));

    const lane = await t.run((ctx) =>
      ctx.db
        .query("tenantJobLanes")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique()
    );
    expect(lane?.state).toBe("paused");
    const job = await t.run((ctx) => ctx.db.get("tenantJobs", seeded.jobId));
    expect(job?.status).toBe("queued");

    const scheduled = await listScheduledFunctions(t);
    expect(
      countScheduled(scheduled, "attemptProspectingWorkflowRecoveryInternal")
    ).toBe(1);
  });

  test("never overwrites a manual pause with a failure stop", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, { suffix: "failure-manual" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, {
        prospectingWorkflowStatus: "paused",
        prospectingWorkflowPauseReason: "manual",
      })
    );

    await t.mutation(internal.workflows.prospecting.handleWorkflowComplete, {
      workflowId: "wf-failure-manual" as WorkflowId,
      result: { kind: "failed", error: "Twitter search failed" },
      context: { workspaceId: String(seeded.workspaceId) },
    });

    const workspace = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
    expect(workspace?.prospectingWorkflowStatus).toBe("paused");
    expect(workspace?.prospectingWorkflowPauseReason).toBe("manual");
    expect(workspace?.onboardingIssueStatusCode).toBeUndefined();
    expect(workspace?.prospectingFailureStreak).toBeUndefined();
    expect(await listScheduledFunctions(t)).toHaveLength(0);
  });

  test("never overwrites a plan limit stop with a failure stop", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, { suffix: "failure-limit" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, {
        prospectingWorkflowStatus: "limit_reached",
      })
    );

    await t.mutation(internal.workflows.prospecting.handleWorkflowComplete, {
      workflowId: "wf-failure-limit" as WorkflowId,
      result: { kind: "failed", error: "Twitter search failed" },
      context: { workspaceId: String(seeded.workspaceId) },
    });

    const workspace = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
    expect(workspace?.prospectingWorkflowStatus).toBe("limit_reached");
    expect(workspace?.onboardingIssueStatusCode).toBeUndefined();
    expect(await listScheduledFunctions(t)).toHaveLength(0);
  });
});

describe("tenant lanes pause with the workspace", () => {
  test("queues background work on a paused lane for a stopped workspace", async () => {
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });
    const seeded = await seedWorkspace(t, { suffix: "lane-stopped" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, {
        prospectingWorkflowStatus: "stopped",
      })
    );

    await t.mutation(internal.tenantScheduler.enqueueTenantJobInternal, {
      workspaceId: seeded.workspaceId,
      userId: seeded.userId,
      class: "background",
      priority: TENANT_JOB_PRIORITY.background,
      idempotencyKey: "lane-stopped-memory-evaluation",
      payload: {
        kind: "memory_evaluation",
        workspaceId: seeded.workspaceId,
        enqueueToken: 1,
      },
    });

    const lane = await t.run((ctx) =>
      ctx.db
        .query("tenantJobLanes")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique()
    );
    expect(lane?.state).toBe("paused");
    const job = await t.run(async (ctx) => {
      const jobs = await ctx.db.query("tenantJobs").collect();
      return jobs.find(
        (candidate) =>
          candidate.idempotencyKey === "lane-stopped-memory-evaluation"
      );
    });
    expect(job?.status).toBe("queued");
  });

  test("keeps lanes running for workspaces without a status", async () => {
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });
    const seeded = await seedWorkspace(t, { suffix: "lane-legacy" });

    await t.mutation(internal.tenantScheduler.enqueueTenantJobInternal, {
      workspaceId: seeded.workspaceId,
      userId: seeded.userId,
      class: "background",
      priority: TENANT_JOB_PRIORITY.background,
      idempotencyKey: "lane-legacy-memory-evaluation",
      payload: {
        kind: "memory_evaluation",
        workspaceId: seeded.workspaceId,
        enqueueToken: 1,
      },
    });

    const lane = await t.run((ctx) =>
      ctx.db
        .query("tenantJobLanes")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique()
    );
    // The lane is created without a pause, but its activation is scheduled
    // for after the enqueue mutation, so an unexecuted test shows it idle.
    // What matters here is that it is not paused.
    expect(lane?.state).not.toBe("paused");
  });

  test("pauses the lane when the inactivity cron pauses a workspace", async () => {
    vi.setSystemTime(new Date("2026-09-28T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, { suffix: "lane-inactive-cron" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, {
        prospectingWorkflowStatus: "running",
        prospectingWorkflowId: "wf-inactive-cron",
        lastMeaningfulActivityAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      })
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("tenantJobLanes", {
        tenantKey: `workspace:${String(seeded.workspaceId)}`,
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        state: "ready",
        pendingCount: 1,
        runningCount: 0,
        minPriority: TENANT_JOB_PRIORITY.background,
        lastDispatchedAt: 1,
        updatedAt: 1,
      });
    });

    expect(
      await t.action(internal.workspaces.pauseInactiveWorkspaces, {})
    ).toEqual({ pausedCount: 1 });

    const lane = await t.run((ctx) =>
      ctx.db
        .query("tenantJobLanes")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique()
    );
    expect(lane?.state).toBe("paused");
    const workspace = await t.run((ctx) => ctx.db.get(seeded.workspaceId));
    expect(workspace?.prospectingWorkflowStatus).toBe("paused");
    expect(workspace?.prospectingWorkflowPauseReason).toBe("inactive");
  });

  test("unpauses the lane when the workspace resumes", async () => {
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });
    const seeded = await seedWorkspace(t, { suffix: "lane-resume" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "stopped" })
    );

    await t.mutation(internal.tenantScheduler.enqueueTenantJobInternal, {
      workspaceId: seeded.workspaceId,
      userId: seeded.userId,
      class: "background",
      priority: TENANT_JOB_PRIORITY.background,
      idempotencyKey: "lane-resume-memory-evaluation",
      payload: {
        kind: "memory_evaluation",
        workspaceId: seeded.workspaceId,
        enqueueToken: 1,
      },
    });
    expect(
      (
        await t.run((ctx) =>
          ctx.db
            .query("tenantJobLanes")
            .withIndex("by_workspace", (q) =>
              q.eq("workspaceId", seeded.workspaceId)
            )
            .unique()
        )
      )?.state
    ).toBe("paused");

    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "running" })
    );
    await t.mutation(internal.tenantScheduler.resumeWorkspaceLaneInternal, {
      workspaceId: seeded.workspaceId,
    });

    expect(
      (
        await t.run((ctx) =>
          ctx.db
            .query("tenantJobLanes")
            .withIndex("by_workspace", (q) =>
              q.eq("workspaceId", seeded.workspaceId)
            )
            .unique()
        )
      )?.state
    ).toBe("ready");
  });
});

describe("memory evaluation waits for the workspace", () => {
  async function seedPendingEvent(
    t: ReturnType<typeof convexTest>,
    ids: { workspaceId: Id<"workspaces"> },
    suffix: string
  ) {
    return await t.run((ctx) =>
      ctx.db.insert("memoryWorkflowEvents", {
        workspaceId: ids.workspaceId,
        eventType: "qualification_completed",
        status: "pending",
        sourceType: "workflow_event",
        sourceId: suffix,
        eventKey: `leak-guard-${suffix}`,
        occurredAt: 1,
      })
    );
  }

  test("skips evaluation for a stopped workspace and releases the queue", async () => {
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const seeded = await seedWorkspace(t, { suffix: "memory-stopped" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "stopped" })
    );
    const eventId = await seedPendingEvent(t, seeded, "memory-stopped-event");

    const result = await t.action(
      internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
      { workspaceId: seeded.workspaceId }
    );

    expect(result).toEqual({
      enqueued: false,
      reason: "workspace_paused",
    });
    const event = await t.run((ctx) =>
      ctx.db.get("memoryWorkflowEvents", eventId)
    );
    expect(event?.status).toBe("pending");
    // No queue row existed before, so the guard leaves nothing behind: no
    // row at all means nothing is queued or running.
    const queue = await t.run((ctx) =>
      ctx.db
        .query("memoryEvaluationWorkspaceQueues")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique()
    );
    expect(queue === null || queue.status === "idle").toBe(true);
    expect(await t.run((ctx) => ctx.db.query("tenantJobs").collect())).toEqual(
      []
    );
  });

  test("cancels the dispatched job before releasing a waiting queue row", async () => {
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });
    const seeded = await seedWorkspace(t, { suffix: "memory-release" });
    await seedPendingEvent(t, seeded, "memory-release-event");

    const first = await t.action(
      internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
      { workspaceId: seeded.workspaceId }
    );
    expect(first.enqueued).toBe(true);

    // Workspace stops after the work was dispatched; the next enqueue must
    // cancel the waiting tenant job before releasing the row.
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "stopped" })
    );

    expect(
      await t.action(
        internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
        { workspaceId: seeded.workspaceId }
      )
    ).toEqual({ enqueued: false, reason: "workspace_paused" });

    const state = await t.run(async (ctx) => ({
      job: (await ctx.db.query("tenantJobs").collect())[0],
      queue: await ctx.db
        .query("memoryEvaluationWorkspaceQueues")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique(),
    }));
    expect(state.job?.status).toBe("cancelled");
    expect(state.queue?.status).toBe("idle");
    expect(state.queue?.workId).toBeUndefined();
  });

  test("does not evaluate a dispatched job for a stopped workspace", async () => {
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });
    const seeded = await seedWorkspace(t, { suffix: "memory-dispatched" });
    const eventId = await seedPendingEvent(
      t,
      seeded,
      "memory-dispatched-event"
    );
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "stopped" })
    );

    // Simulate the dispatched run reaching the queue work action after the
    // workspace stopped (race with the release path).
    const result = await t.action(
      internal.workflows.memory.runQueuedWorkspaceMemoryEvaluationInternal,
      { workspaceId: seeded.workspaceId, enqueueToken: 1 }
    );
    expect(result).toEqual({ status: "idle" });
    const event = await t.run((ctx) =>
      ctx.db.get("memoryWorkflowEvents", eventId)
    );
    expect(event?.status).toBe("pending");
  });

  test("leaves an in-flight evaluation queue row untouched while stopped", async () => {
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    const seeded = await seedWorkspace(t, { suffix: "memory-running-row" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "stopped" })
    );
    await seedPendingEvent(t, seeded, "memory-running-row-event");
    await t.run((ctx) =>
      ctx.db.insert("memoryEvaluationWorkspaceQueues", {
        workspaceId: seeded.workspaceId,
        status: "running",
        workId: "memory-eval:in-flight",
        lastEnqueuedAt: 1,
        updatedAt: 1,
      })
    );

    expect(
      await t.action(
        internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
        { workspaceId: seeded.workspaceId }
      )
    ).toEqual({ enqueued: false, reason: "workspace_paused" });

    // The in-flight row is owned by its dispatched work; releasing it here
    // could let a second evaluation run concurrently with the first.
    const queue = await t.run((ctx) =>
      ctx.db
        .query("memoryEvaluationWorkspaceQueues")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique()
    );
    expect(queue?.status).toBe("running");
    expect(queue?.workId).toBe("memory-eval:in-flight");
  });

  test("drains the pending backlog once the workspace resumes", async () => {
    const t = convexTest(schema, modules);
    await registerSchedulerComponents(t);
    await t.mutation(internal.tenantScheduler.setControlInternal, {
      mode: "enforced",
    });
    const seeded = await seedWorkspace(t, { suffix: "memory-resume" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "stopped" })
    );
    await seedPendingEvent(t, seeded, "memory-resume-event");

    expect(
      await t.action(
        internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
        { workspaceId: seeded.workspaceId }
      )
    ).toEqual({ enqueued: false, reason: "workspace_paused" });

    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "running" })
    );
    const result = await t.action(
      internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
      { workspaceId: seeded.workspaceId }
    );
    expect(result.enqueued).toBe(true);
    const job = await t.run(async (ctx) => {
      const jobs = await ctx.db.query("tenantJobs").collect();
      return jobs[0];
    });
    expect(job?.kind).toBe("memory_evaluation");
  });
});

describe("enrichment waits for the workspace", () => {
  async function seedQualifiedProspect(
    t: ReturnType<typeof convexTest>,
    ids: { userId: Id<"users">; workspaceId: Id<"workspaces"> },
    suffix: string
  ) {
    return await t.run((ctx) =>
      ctx.db.insert("prospects", {
        workspaceId: ids.workspaceId,
        userId: ids.userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: `leak-guard-prospect-${suffix}`,
        twitterUserId: "987654321",
        data: { user: { id_str: "987654321", screen_name: `leak_${suffix}` } },
        status: "new",
        qualificationStatus: "qualified",
        qualificationScore: 90,
        updatedAt: Date.now(),
      })
    );
  }

  test("does not start enrichment for a stopped workspace", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, { suffix: "enrich-stopped" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "stopped" })
    );
    const prospectId = await seedQualifiedProspect(t, seeded, "enrich-stopped");

    expect(
      await t.action(internal.workflows.enrichment.startEnrichment, {
        prospectId,
        workspaceId: seeded.workspaceId,
      })
    ).toEqual({ workId: "" });
    const prospect = await t.run((ctx) => ctx.db.get("prospects", prospectId));
    expect(prospect?.enrichmentWorkflowId).toBeUndefined();
  });

  test("does not start enrichment for a workspace being deleted", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, { suffix: "enrich-deleting" });
    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, {
        deletionStartedAt: Date.now(),
      })
    );
    const prospectId = await seedQualifiedProspect(
      t,
      seeded,
      "enrich-deleting"
    );

    expect(
      await t.action(internal.workflows.enrichment.startEnrichment, {
        prospectId,
        workspaceId: seeded.workspaceId,
      })
    ).toEqual({ workId: "" });
  });
});
