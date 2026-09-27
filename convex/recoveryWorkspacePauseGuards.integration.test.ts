/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import {
  claimFailedCanonicalWorkspaceMemoryIndexRetries,
  upsertCanonicalWorkspaceMemory,
} from "./lib/workspaceMemoryCore";
import schema from "./schema";
import { QUALIFICATION_STALE_PENDING_MS } from "./workflows/qualificationRecovery";

const modules = import.meta.glob("./**/*.ts");

type WorkspaceStatus = "running" | "paused" | "stopped" | "limit_reached";

async function seedEligibleWorkspace(
  t: ReturnType<typeof convexTest>,
  status: WorkspaceStatus | undefined,
  suffix: string
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `recovery-pause-${suffix}`,
      email: `recovery-pause-${suffix}@example.test`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Recovery pause ${suffix}`,
      description: "Recovery pause guard test workspace",
      isDefault: true,
      ...(status === undefined ? {} : { prospectingWorkflowStatus: status }),
      updatedAt: now,
    });
    const prospectUpdatedAt = now - QUALIFICATION_STALE_PENDING_MS - 60_000;
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: `recovery-pause-prospect-${suffix}`,
      twitterUserId: "987654321",
      data: { user: { id_str: "987654321", screen_name: `pause_${suffix}` } },
      status: "new",
      qualificationStatus: "pending",
      planGenerationStatus: "failed",
      updatedAt: prospectUpdatedAt,
    });
    return { userId, workspaceId, prospectId, prospectUpdatedAt };
  });
}

async function listScheduledFunctions(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect()
  );
}

async function insertFailedAutoPlanRun(
  t: ReturnType<typeof convexTest>,
  ids: { userId: Id<"users">; workspaceId: Id<"workspaces"> },
  suffix: string,
  updatedAt: number
) {
  return await t.run(async (ctx) => {
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId: ids.workspaceId,
      userId: ids.userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: `recovery-starve-prospect-${suffix}`,
      twitterUserId: "987654321",
      data: { user: { id_str: "987654321", screen_name: `starve_${suffix}` } },
      status: "new",
      qualificationStatus: "pending",
      planGenerationStatus: "failed",
      updatedAt,
    });
    const runId = await ctx.db.insert("autoPlanRuns", {
      prospectId,
      workspaceId: ids.workspaceId,
      userId: ids.userId,
      status: "failed",
      attemptCount: 1,
      errorCode: "generation_failed",
      errorMessage: "Provider returned no plan",
      retryable: true,
      completedAt: updatedAt,
      updatedAt,
    });
    return { prospectId, runId };
  });
}

function countScheduled(jobs: Array<{ name: string }>, needle: string): number {
  return jobs.filter((job) => job.name.includes(needle)).length;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("recovery work respects workspace pause status", () => {
  test("holds failed automatic plan recovery until the workspace runs again", async () => {
    vi.setSystemTime(new Date("2026-09-27T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    const seeded = await seedEligibleWorkspace(t, "paused", "auto-plan");
    const runId = await t.run((ctx) =>
      ctx.db.insert("autoPlanRuns", {
        prospectId: seeded.prospectId,
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        status: "failed",
        attemptCount: 1,
        errorCode: "generation_failed",
        errorMessage: "Provider returned no plan",
        retryable: true,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      })
    );

    expect(
      await t.mutation(
        internal.autoPlanRuns.claimFailedAutoPlanRecoveryBatchGlobal,
        { limit: 25 }
      )
    ).toEqual([]);
    expect(
      await t.query(internal.autoPlanRuns.getAutoPlanRecoveryProbeTarget, {})
    ).toBeNull();

    const untouchedRun = await t.run((ctx) =>
      ctx.db.get("autoPlanRuns", runId)
    );
    expect(untouchedRun?.recoveryRetriedAt).toBeUndefined();
    expect(untouchedRun?.recoveryExhaustedAt).toBeUndefined();

    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "running" })
    );

    expect(
      await t.query(internal.autoPlanRuns.getAutoPlanRecoveryProbeTarget, {})
    ).toMatchObject({
      prospectId: seeded.prospectId,
      workspaceId: seeded.workspaceId,
    });
    expect(
      await t.mutation(
        internal.autoPlanRuns.claimFailedAutoPlanRecoveryBatchGlobal,
        { limit: 25 }
      )
    ).toEqual([
      {
        sourceRunId: runId,
        prospectId: seeded.prospectId,
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
      },
    ]);
  });

  test("does not enqueue automatic plan generation for a paused workspace", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedEligibleWorkspace(t, "paused", "auto-plan-start");

    expect(
      await t.action(internal.outreachActions.startAutoPlanGeneration, {
        prospectId: seeded.prospectId,
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
      })
    ).toEqual({ workId: "" });
    expect(
      await t.run((ctx) => ctx.db.query("autoPlanRuns").collect())
    ).toEqual([]);
  });

  test("does not backfill eligible automatic plans for a paused workspace", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedEligibleWorkspace(
      t,
      "paused",
      "auto-plan-backfill"
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(seeded.workspaceId, {
        styleProfileStatus: "ready",
        styleProfileVersion: 1,
      });
      await ctx.db.patch(seeded.prospectId, {
        qualificationStatus: "qualified",
        qualificationScore: 92,
      });
      await ctx.db.insert(
        "prospectSummaries",
        buildProspectSummaryRecord((await ctx.db.get(seeded.prospectId))!)
      );
    });

    expect(
      await t.action(
        internal.outreachActions.enqueueEligibleAutoPlansForWorkspace,
        {
          workspaceId: seeded.workspaceId,
          userId: seeded.userId,
        }
      )
    ).toEqual({ enqueuedCount: 0 });
    expect(
      await t.run((ctx) => ctx.db.query("autoPlanRuns").collect())
    ).toEqual([]);
  });

  test("holds stale pending qualifications while the workspace is paused", async () => {
    vi.setSystemTime(new Date("2026-09-27T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    const seeded = await seedEligibleWorkspace(t, "paused", "qualification");

    expect(
      await t.mutation(
        internal.prospects.claimPendingQualificationRecoveryInternal,
        {
          prospectId: seeded.prospectId,
          expectedUpdatedAt: seeded.prospectUpdatedAt,
          now: Date.now(),
        }
      )
    ).toEqual({ claimed: false, scheduled: false, reason: "ineligible" });

    const pausedRecovery = await t.action(
      internal.workflows.qualificationRecovery
        .recoverStalePendingQualificationsCron,
      {}
    );
    expect(pausedRecovery.scheduled).toBe(0);
    expect(
      countScheduled(await listScheduledFunctions(t), "startQualification")
    ).toBe(0);

    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "running" })
    );

    const runningRecovery = await t.action(
      internal.workflows.qualificationRecovery
        .recoverStalePendingQualificationsCron,
      {}
    );
    expect(runningRecovery.scheduled).toBe(1);
    expect(
      countScheduled(await listScheduledFunctions(t), "startQualification")
    ).toBe(1);
  });

  test("does not start qualification for a paused workspace", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedEligibleWorkspace(
      t,
      "limit_reached",
      "start-qualification"
    );

    expect(
      await t.action(internal.workflows.qualification.startQualification, {
        prospectId: seeded.prospectId,
        workspaceId: seeded.workspaceId,
      })
    ).toEqual({ workId: "" });

    const prospect = await t.run((ctx) =>
      ctx.db.get("prospects", seeded.prospectId)
    );
    expect(prospect?.qualificationWorkflowId).toBeUndefined();
    expect(
      countScheduled(await listScheduledFunctions(t), "startQualification")
    ).toBe(0);
  });

  test("leaves failed workspace memory embeddings untouched while paused", async () => {
    vi.setSystemTime(new Date("2026-09-27T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    const seeded = await seedEligibleWorkspace(t, "stopped", "memory-index");
    const memoryId = await t.run(async (ctx) => {
      const result = await upsertCanonicalWorkspaceMemory(ctx.db, {
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        kind: "recovery_pause_guard",
        title: "Pause guard memory",
        summary: "Pause guard memory",
        canonicalContent: "Pause guard canonical memory content",
        confidence: 1,
        impactScore: 1,
      });
      const id = ctx.db.normalizeId(
        "workspaceMemories",
        result.memory.memoryId
      );
      if (!id) {
        throw new Error("Expected a canonical workspace memory ID");
      }
      await ctx.db.patch(id, {
        indexStatus: "failed",
        indexRetryable: true,
        indexRetryCount: 0,
        indexRetryAt: Date.now() - 1_000,
        indexError: "Embedding provider unavailable",
      });
      return id;
    });
    const dueRetryAt = (
      await t.run((ctx) => ctx.db.get("workspaceMemories", memoryId))
    )?.indexRetryAt;

    expect(
      await t.mutation(
        internal.memory.retryFailedCanonicalWorkspaceMemoryIndexesCron,
        {}
      )
    ).toEqual({ claimed: 0, scheduled: 0 });

    const pausedMemory = await t.run((ctx) =>
      ctx.db.get("workspaceMemories", memoryId)
    );
    expect(pausedMemory?.indexRetryAt).toBe(dueRetryAt);
    expect(pausedMemory?.indexRetryClaimToken).toBeUndefined();
    expect(
      countScheduled(
        await listScheduledFunctions(t),
        "indexCanonicalWorkspaceMemoryInternal"
      )
    ).toBe(0);

    await t.run((ctx) =>
      ctx.db.patch(seeded.workspaceId, { prospectingWorkflowStatus: "running" })
    );

    expect(
      await t.mutation(
        internal.memory.retryFailedCanonicalWorkspaceMemoryIndexesCron,
        {}
      )
    ).toEqual({ claimed: 1, scheduled: 1 });
    const runningMemory = await t.run((ctx) =>
      ctx.db.get("workspaceMemories", memoryId)
    );
    expect(runningMemory?.indexRetryClaimToken).toEqual(expect.any(String));
    expect(
      countScheduled(
        await listScheduledFunctions(t),
        "indexCanonicalWorkspaceMemoryInternal"
      )
    ).toBe(1);
  });

  test("keeps retries flowing for workspaces that never recorded a status", async () => {
    vi.setSystemTime(new Date("2026-09-27T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    await seedEligibleWorkspace(t, undefined, "legacy-status");

    const recovery = await t.action(
      internal.workflows.qualificationRecovery
        .recoverStalePendingQualificationsCron,
      {}
    );
    expect(recovery.scheduled).toBe(1);
  });

  test("does not let paused runs hide eligible runs behind them", async () => {
    vi.setSystemTime(new Date("2026-09-27T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    const running = await seedEligibleWorkspace(t, "running", "scan-running");
    const paused = await seedEligibleWorkspace(t, "paused", "scan-paused");
    await t.run(async (ctx) => {
      await ctx.db.patch(running.workspaceId, {
        prospectingWorkflowStatus: "running",
      });
      await ctx.db.patch(paused.workspaceId, {
        prospectingWorkflowStatus: "paused",
      });
    });

    const oldestRun = await insertFailedAutoPlanRun(
      t,
      running,
      "eligible",
      Date.now() - 60_000
    );
    for (let index = 0; index < 6; index += 1) {
      await insertFailedAutoPlanRun(
        t,
        paused,
        `paused-${index}`,
        Date.now() - index
      );
    }

    // The probe must reach the eligible run that sits behind the paused runs.
    expect(
      await t.query(internal.autoPlanRuns.getAutoPlanRecoveryProbeTarget, {})
    ).toMatchObject({
      prospectId: oldestRun.prospectId,
      workspaceId: running.workspaceId,
    });

    const claims = await t.mutation(
      internal.autoPlanRuns.claimFailedAutoPlanRecoveryBatchGlobal,
      { limit: 5 }
    );

    expect(claims).toEqual([
      {
        sourceRunId: oldestRun.runId,
        prospectId: oldestRun.prospectId,
        workspaceId: running.workspaceId,
        userId: running.userId,
      },
    ]);
  });

  test("does not let paused memory rows hide eligible rows behind them", async () => {
    vi.setSystemTime(new Date("2026-09-27T06:00:00.000Z"));
    const t = convexTest(schema, modules);
    const paused = await seedEligibleWorkspace(
      t,
      "paused",
      "memory-scan-paused"
    );
    const running = await seedEligibleWorkspace(
      t,
      "running",
      "memory-scan-running"
    );
    const now = Date.now();

    const insertFailedMemory = async (
      ids: { userId: Id<"users">; workspaceId: Id<"workspaces"> },
      suffix: string,
      retryAt: number
    ) =>
      await t.run(async (ctx) => {
        const result = await upsertCanonicalWorkspaceMemory(ctx.db, {
          userId: ids.userId,
          workspaceId: ids.workspaceId,
          source: "operator",
          category: "operator_instruction",
          namespace: "lessons",
          kind: "recovery_scan_window",
          title: `Scan window memory ${suffix}`,
          summary: `Scan window memory ${suffix}`,
          canonicalContent: `Scan window canonical memory ${suffix}`,
          confidence: 1,
          impactScore: 1,
        });
        const memoryId = ctx.db.normalizeId(
          "workspaceMemories",
          result.memory.memoryId
        );
        if (!memoryId) {
          throw new Error("Expected a canonical workspace memory ID");
        }
        await ctx.db.patch(memoryId, {
          indexStatus: "failed",
          indexRetryable: true,
          indexRetryCount: 0,
          indexRetryAt: retryAt,
          indexError: "Embedding provider unavailable",
        });
        return memoryId;
      });

    for (let index = 0; index < 8; index += 1) {
      await insertFailedMemory(paused, `paused-${index}`, now - 10_000 + index);
    }
    const eligibleMemoryId = await insertFailedMemory(
      running,
      "eligible",
      now - 1_000
    );

    const claims = await t.run((ctx) =>
      claimFailedCanonicalWorkspaceMemoryIndexRetries(ctx.db, {
        limit: 2,
        shouldClaim: (row) => row.workspaceId === running.workspaceId,
      })
    );

    expect(claims).toHaveLength(1);
    expect(claims[0].memoryId).toBe(eligibleMemoryId);
  });
});
