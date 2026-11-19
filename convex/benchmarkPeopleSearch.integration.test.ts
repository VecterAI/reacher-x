import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
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
        prospectingWorkflowId?: string;
        prospectingWorkflowStartedAt?: number;
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
      // Stopped by the benchmark mid-cycle, as stopRun leaves it.
      held: await workspace("Benchmark run-1_14_on", {
        prospectingWorkflowStatus: "paused",
        prospectingWorkflowId: "wf-held",
        prospectingWorkflowStartedAt: 2_000,
      }),
    };
  });
}

const pendingJobs = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect())
      .filter((job) => job.state.kind === "pending")
      .map((job) => ({
        name: job.name,
        args: job.args[0] as Record<string, unknown>,
      }))
  );

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

  test("a held benchmark workspace resumes at its own cycle with every scheduled cycle start canceled", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run(async (ctx) => {
      for (const workspaceId of [ids.held, ids.ordinary])
        await ctx.scheduler.runAfter(
          600_000,
          internal.workflows.prospecting.startNextCycle,
          { workspaceId }
        );
      await ctx.scheduler.runAfter(
        900_000,
        internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
        { workspaceId: ids.held, recoveryAttemptId: 1 }
      );
    });

    // Refused for a running, renamed or moved-on workspace; nothing changes.
    for (const [workspaceId, workflowId, message] of [
      [ids.benchmark, "wf-held", /Only a paused/],
      [ids.ordinary, "wf-held", /Only benchmark workspaces/],
      [ids.held, "wf-other", /no longer at the cycle/],
    ] as const)
      await expect(
        t.mutation(internal.benchmarkPeopleSearch.markResumedInternal, {
          workspaceId,
          workflowId,
        })
      ).rejects.toThrow(message);

    const result = await t.mutation(
      internal.benchmarkPeopleSearch.markResumedInternal,
      { workspaceId: ids.held, workflowId: "wf-held" }
    );
    expect(result).toEqual({ cycleStartsCanceled: 2 });
    const jobs = await pendingJobs(t);
    expect(jobs.filter((job) => job.args.workspaceId === ids.held)).toEqual([]);
    expect(await pendingNextCycles(t)).toEqual([ids.ordinary]);
    const workspace = await t.run((ctx) => ctx.db.get(ids.held));
    expect(workspace).toMatchObject({
      prospectingWorkflowStatus: "running",
      prospectingWorkflowId: "wf-held",
      prospectingWorkflowStartedAt: 2_000,
    });
    expect(workspace?.prospectingWorkflowPauseReason).toBeUndefined();
  });

  test("requeue starts qualification and enrichment only for the resumed workspace's unfinished prospects", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const prospects = await t.run(async (ctx) => {
      const workspace = await ctx.db.get(ids.benchmark);
      const prospect = async (
        externalId: string,
        fields: Record<string, unknown>
      ) => {
        const id = await ctx.db.insert("prospects", {
          userId: workspace!.userId,
          workspaceId: ids.benchmark,
          platform: "linkedin",
          origin: "workspace_discovery",
          externalId,
          data: {},
          status: "new",
          updatedAt: 1_000,
          ...fields,
        });
        // Seeded writes skip the trigger that keeps summaries in sync.
        await ctx.db.insert(
          "prospectSummaries",
          buildProspectSummaryRecord((await ctx.db.get(id))!)
        );
        return id;
      };
      return {
        pending: await prospect("pending", {
          qualificationStatus: "pending",
          qualificationLastFailure: {
            stage: "workflow",
            provider: "convex_workflow",
            code: "qualification_workflow_failed",
            message: "Benchmark stop in force",
            workflowAttemptCount: 1,
            nextRetryAt: 9_999_999_999_999,
            failedAt: 1_500,
          },
        }),
        archived: await prospect("archived", {
          qualificationStatus: "pending",
          status: "archived",
        }),
        qualified: await prospect("qualified", {
          qualificationStatus: "qualified",
        }),
        claimed: await prospect("claimed", {
          qualificationStatus: "qualified",
          enrichmentWorkflowId: "pending:claimed:1:abc",
        }),
        moved: await prospect("moved", {
          qualificationStatus: "qualified",
          enrichmentWorkflowId: "wf-enrich-new",
        }),
        enriched: await prospect("enriched", {
          qualificationStatus: "qualified",
          enrichmentStatus: "enriched",
        }),
      };
    });
    const requeue = () =>
      t.mutation(internal.benchmarkPeopleSearch.requeueForResumeInternal, {
        workspaceId: ids.benchmark,
        qualify: [prospects.pending, prospects.archived, prospects.qualified],
        enrich: [
          { prospectId: prospects.qualified },
          { prospectId: prospects.claimed, lease: "pending:claimed:1:abc" },
          // Its lease changed since it was read, so it is left alone.
          { prospectId: prospects.moved, lease: "wf-enrich-old" },
          { prospectId: prospects.enriched },
          { prospectId: prospects.pending },
        ],
      });
    expect(await requeue()).toEqual({
      qualificationQueued: 1,
      failuresCleared: 1,
      enrichmentQueued: 2,
      leasesReleased: 1,
    });
    const started = (await pendingJobs(t)).filter(
      (job) =>
        job.name.includes("startQualification") ||
        job.name.includes("startEnrichment")
    );
    expect(
      started
        .map(
          (job) => `${job.name.split(":")[1]} ${String(job.args.prospectId)}`
        )
        .sort()
    ).toEqual(
      [
        `startQualification ${prospects.pending}`,
        `startEnrichment ${prospects.qualified}`,
        `startEnrichment ${prospects.claimed}`,
      ].sort()
    );
    const after = await t.run(async (ctx) => ({
      pending: await ctx.db.get(prospects.pending),
      claimed: await ctx.db.get(prospects.claimed),
      moved: await ctx.db.get(prospects.moved),
    }));
    expect(after.pending?.qualificationLastFailure).toBeUndefined();
    expect(after.claimed?.enrichmentWorkflowId).toBeUndefined();
    expect(after.moved?.enrichmentWorkflowId).toBe("wf-enrich-new");

    // The status counts qualified prospects still waiting for enrichment.
    const status = await t.query(internal.benchmarkPeopleSearch.runStatus, {
      workspaceId: ids.benchmark,
    });
    expect(status?.counts.enrichmentWaiting).toBe(3);

    // Only a running benchmark workspace is requeued.
    await t.run((ctx) =>
      ctx.db.patch(ids.benchmark, { prospectingWorkflowStatus: "paused" })
    );
    await expect(requeue()).rejects.toThrow(/Only a resumed benchmark/);
  });

  test("a resume is refused while automatic cycles are on or jobs are paused, before anything changes", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const resume = () =>
      t.action(internal.benchmarkPeopleSearch.resumeHeldWorkspace, {
        workspaceId: ids.held,
        workflowId: "wf-held",
      });
    vi.stubEnv("PROSPECTING_AUTO_RESCHEDULE", "1");
    await expect(resume()).rejects.toThrow(/Turn automatic cycles off/);
    vi.stubEnv("PROSPECTING_AUTO_RESCHEDULE", "0");
    vi.stubEnv("PAUSE_AUTONOMOUS_JOBS", "true");
    await expect(resume()).rejects.toThrow(/Unpause autonomous jobs/);
    vi.stubEnv("PAUSE_AUTONOMOUS_JOBS", "false");
    // Its discovery workflow cannot be confirmed ended, so it is not resumed.
    await expect(resume()).rejects.toThrow(/has not ended/);
    vi.unstubAllEnvs();
    const workspace = await t.run((ctx) => ctx.db.get(ids.held));
    expect(workspace?.prospectingWorkflowStatus).toBe("paused");
  });
  test("releaseStuckBenchmarkWorkspace frees only a benchmark workspace whose deletion started", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const created = async (id: typeof ids.benchmark) =>
      (await t.run((ctx) => ctx.db.get(id)))!._creationTime;
    const args = async (id: typeof ids.benchmark, label: string) => ({
      workspaceId: id,
      label,
      createdAt: await created(id),
    });
    await t.run((ctx) => ctx.db.patch(ids.benchmark, { setupCompletedAt: 1 }));
    await expect(
      t.mutation(
        internal.benchmarkPeopleSearch.releaseStuckBenchmarkWorkspace,
        await args(ids.benchmark, "run-1_6_on")
      )
    ).rejects.toThrow(/deletion already started/);
    await expect(
      t.mutation(
        internal.benchmarkPeopleSearch.releaseStuckBenchmarkWorkspace,
        await args(ids.ordinary, "run-1_6_on")
      )
    ).rejects.toThrow(/did not create/);
    await t.run((ctx) => ctx.db.patch(ids.benchmark, { deletionStartedAt: 2 }));
    expect(
      await t.mutation(
        internal.benchmarkPeopleSearch.releaseStuckBenchmarkWorkspace,
        await args(ids.benchmark, "run-1_6_on")
      )
    ).toEqual({ released: true });
    const workspace = await t.run((ctx) => ctx.db.get(ids.benchmark));
    expect(workspace?.setupCompletedAt).toBeUndefined();
    expect(workspace?.deletionStartedAt).toBe(2);
  });
});
