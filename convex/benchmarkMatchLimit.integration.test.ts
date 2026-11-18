/// <reference types="vite/client" />

import { DirectAggregate } from "@convex-dev/aggregate";
import polarTest from "@convex-dev/polar/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { firstMatchIds } from "./lib/benchmarkMatchLimit";
import { PLAN_LIMITS } from "./lib/planConstants";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import { WORKSPACE_REPORTING_AGGREGATE_VERSION } from "./lib/workspaceReportingAggregate";

const modules = import.meta.glob("./**/*.ts");

/** The parked work, read page by page as the runner reads it. */
async function parkedWork(
  t: ReturnType<typeof convexTest>,
  workspaceId: Id<"workspaces">
) {
  const parked = { pending: 0, enrichmentWaiting: 0 };
  let cursor: string | null = null;
  do {
    const page: {
      pending: number;
      enrichmentWaiting: number;
      cursor: string | null;
    } = await t.query(internal.benchmarkPeopleSearch.matchLimitParked, {
      workspaceId,
      cursor,
    });
    parked.pending += page.pending;
    parked.enrichmentWaiting += page.enrichmentWaiting;
    cursor = page.cursor;
  } while (cursor);
  return parked;
}
const now = Date.UTC(2026, 10, 17, 12);
// The current cycle started an hour ago.
const cycleStart = now - 3_600_000;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

type ProspectSeed = Readonly<{
  qualifiedAt?: number;
  pending?: boolean;
  enrichmentStatus?: "pending" | "enriched";
  qualificationWorkflowId?: string;
  enrichmentWorkflowId?: string;
}>;

/**
 * A Pro (unlimited) user's workspace in its current cycle. With `aggregate`,
 * qualified usage is read from the reporting aggregate, as for workspaces
 * created since it exists; otherwise from the prospects themselves.
 */
async function fixture(
  prospects: readonly ProspectSeed[],
  options: { name?: string; aggregate?: boolean } = {}
) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  polarTest.register(t);
  const data = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "benchmark-match-limit",
      email: "benchmark-match-limit@example.test",
    });
    await ctx.db.insert("userPlans", {
      userId,
      tier: "pro",
      ...PLAN_LIMITS.pro,
      currentProspectsCount: 0,
      updatedAt: now,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: options.name ?? "Benchmark run-1_14_on",
      description: "Synthetic workspace",
      isDefault: false,
      setupCompletedAt: cycleStart - 60_000,
      prospectingWorkflowStatus: "running",
      prospectingWorkflowStartedAt: cycleStart,
      updatedAt: now,
    });
    const aggregate = new DirectAggregate(
      components.workspaceReportingAggregate
    );
    if (options.aggregate)
      await ctx.db.insert("workspaceReportingRollouts", {
        workspaceId,
        userId,
        aggregateVersion: WORKSPACE_REPORTING_AGGREGATE_VERSION,
        status: "verified",
        revision: 1,
        stage: "verifyAgentOpsStripes",
        batchSize: 10,
        backfilledCount: 0,
        verifiedSourceCount: 0,
        expectedAnalyticsSums: [],
        expectedAgentOpsSums: [],
        expectedQualifiedUsageCount: 0,
        startedAt: now,
        updatedAt: now,
      });
    const ids: Id<"prospects">[] = [];
    for (const [index, seed] of prospects.entries()) {
      const id = await ctx.db.insert("prospects", {
        userId,
        workspaceId,
        platform: "linkedin",
        origin: "workspace_discovery",
        externalId: `match-limit-${index}`,
        data: {},
        status: "new",
        qualificationStatus: seed.pending ? "pending" : "qualified",
        ...(seed.pending ? {} : { qualifiedAt: seed.qualifiedAt }),
        enrichmentStatus: seed.enrichmentStatus,
        qualificationWorkflowId: seed.qualificationWorkflowId,
        enrichmentWorkflowId: seed.enrichmentWorkflowId,
        updatedAt: now - 3_600_000,
      });
      // Seeded writes skip the trigger that keeps summaries in sync.
      await ctx.db.insert(
        "prospectSummaries",
        buildProspectSummaryRecord((await ctx.db.get(id))!)
      );
      ids.push(id);
      if (options.aggregate && !seed.pending && seed.qualifiedAt)
        await aggregate.insert(ctx, {
          namespace: [
            WORKSPACE_REPORTING_AGGREGATE_VERSION,
            workspaceId,
            "usage",
          ],
          key: ["qualifiedProspectsCount", seed.qualifiedAt],
          id: `prospects:${id}`,
          sumValue: 1,
        });
    }
    return { workspaceId, ids };
  });
  return { t, ...data };
}

// Matches qualified a minute apart from the cycle's start.
const matched = (index: number, fields: ProspectSeed = {}): ProspectSeed => ({
  qualifiedAt: cycleStart + (index + 1) * 60_000,
  enrichmentStatus: "pending",
  ...fields,
});
// Qualified in the previous cycle.
const earlier: ProspectSeed = {
  qualifiedAt: cycleStart - 60_000,
  enrichmentStatus: "pending",
};
const pending: ProspectSeed = { pending: true };

const gate = (
  t: ReturnType<typeof convexTest>,
  workspaceId: Id<"workspaces">,
  prospectId: Id<"prospects">
) =>
  t.query(
    internal.lib.backgroundWorkGuards.checkBackgroundWorkAllowedInternal,
    {
      workspaceId,
      prospectId,
    }
  );

const PARKED = {
  allowed: false,
  reasons: ["benchmark_match_limit_reached"],
};
const ALLOWED = { allowed: true, reasons: [] };

describe.each([
  ["prospect records", false],
  ["the reporting aggregate", true],
])("benchmark match limit, usage from %s", (_, aggregate) => {
  test("parks qualification once the cycle has N matches; earlier cycles do not count", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "3");
    const under = await fixture(
      [earlier, earlier, matched(0), matched(1), pending],
      { aggregate }
    );
    expect(await gate(under.t, under.workspaceId, under.ids[4])).toEqual(
      ALLOWED
    );

    const at = await fixture(
      [earlier, matched(0), matched(1), matched(2), pending],
      { aggregate }
    );
    expect(await gate(at.t, at.workspaceId, at.ids[4])).toEqual(PARKED);
  });

  test("the cycle's first N matches stay open for enrichment; later ones and earlier cycles are parked", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "3");
    const { t, workspaceId, ids } = await fixture(
      // Inserted out of order: rank comes from qualifiedAt.
      [matched(4), matched(0), matched(2), matched(1), matched(3), earlier],
      { aggregate }
    );
    const [fifth, first, third, second, fourth, previous] = ids;
    for (const open of [first, second, third])
      expect(await gate(t, workspaceId, open)).toEqual(ALLOWED);
    for (const parked of [fourth, fifth, previous])
      expect(await gate(t, workspaceId, parked)).toEqual(PARKED);
  });

  test("matches from the same millisecond are ordered by ID, so exactly N stay open", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "1");
    const { t, workspaceId, ids } = await fixture([matched(0), matched(0)], {
      aggregate,
    });
    const [first, second] = [...ids].sort();
    expect(await gate(t, workspaceId, first)).toEqual(ALLOWED);
    expect(await gate(t, workspaceId, second)).toEqual(PARKED);
    // runStatus orders them the same way, so it parks the same one.
    const docs = await t.run((ctx) =>
      Promise.all(ids.map((id) => ctx.db.get("prospects", id)))
    );
    expect([
      ...firstMatchIds(
        { limit: 1, startedAt: cycleStart },
        docs.flatMap((doc) => (doc ? [doc] : []))
      ),
    ]).toEqual([first]);
    expect(await parkedWork(t, workspaceId)).toEqual({
      pending: 0,
      enrichmentWaiting: 1,
    });
  });

  test("a new cycle starts its count at zero", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "2");
    const { t, workspaceId, ids } = await fixture(
      [matched(0), matched(1), pending],
      { aggregate }
    );
    expect(await gate(t, workspaceId, ids[2])).toEqual(PARKED);
    await t.run((ctx) =>
      ctx.db.patch(workspaceId, { prospectingWorkflowStartedAt: now })
    );
    expect(await gate(t, workspaceId, ids[2])).toEqual(ALLOWED);
    const status = await t.query(internal.benchmarkPeopleSearch.runStatus, {
      workspaceId,
    });
    expect(status?.matchLimit).toEqual({
      limit: 2,
      qualifiedThisCycle: 0,
      reached: false,
      queryLimit: null,
      queryMatches: null,
      queryReached: false,
    });
    expect(await parkedWork(t, workspaceId)).toEqual({
      pending: 0,
      enrichmentWaiting: 0,
    });
  });
  test("a limit per query leaves each cycle what earlier cycles left; the lower limit applies", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "3");
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_QUERY", "5");
    // Three matches earlier leave this cycle 2, under its own 3.
    const { t, workspaceId, ids } = await fixture(
      [earlier, earlier, earlier, matched(1), matched(0), pending],
      { aggregate }
    );
    const [previous, , , second, first, undecided] = ids;
    expect(await gate(t, workspaceId, undecided)).toEqual(PARKED);
    for (const open of [first, second])
      expect(await gate(t, workspaceId, open)).toEqual(ALLOWED);
    expect(await gate(t, workspaceId, previous)).toEqual(PARKED);
    const status = await t.query(internal.benchmarkPeopleSearch.runStatus, {
      workspaceId,
    });
    expect(status?.matchLimit).toEqual({
      limit: 2,
      qualifiedThisCycle: 2,
      reached: true,
      queryLimit: 5,
      queryMatches: 5,
      queryReached: true,
    });
    expect(await parkedWork(t, workspaceId)).toEqual({
      pending: 1,
      enrichmentWaiting: 3,
    });

    // With room for more, the limit per cycle is the lower one.
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_QUERY", "10");
    expect(await gate(t, workspaceId, undecided)).toEqual(ALLOWED);
    expect(
      (await t.query(internal.benchmarkPeopleSearch.runStatus, { workspaceId }))
        ?.matchLimit
    ).toMatchObject({ limit: 3, reached: false, queryReached: false });
  });

  test("with nothing left for the cycle, everything is parked", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_QUERY", "2");
    const { t, workspaceId, ids } = await fixture(
      [earlier, earlier, matched(0), pending],
      { aggregate }
    );
    for (const id of ids)
      expect(await gate(t, workspaceId, id)).toEqual(PARKED);
    expect(
      (await t.query(internal.benchmarkPeopleSearch.runStatus, { workspaceId }))
        ?.matchLimit
    ).toEqual({
      limit: 0,
      qualifiedThisCycle: 1,
      reached: true,
      queryLimit: 2,
      queryMatches: 3,
      queryReached: true,
    });
    expect(await parkedWork(t, workspaceId)).toEqual({
      pending: 1,
      enrichmentWaiting: 3,
    });
  });
});

describe("benchmark match limit", () => {
  test("unset, invalid, or on a workspace the benchmark did not create, nothing is limited", async () => {
    const seeds = [matched(0), matched(1), matched(2), pending];
    const benchmark = await fixture(seeds);
    expect(
      await gate(benchmark.t, benchmark.workspaceId, benchmark.ids[3])
    ).toEqual(ALLOWED);
    expect(
      (
        await benchmark.t.query(internal.benchmarkPeopleSearch.runStatus, {
          workspaceId: benchmark.workspaceId,
        })
      )?.matchLimit
    ).toBeNull();

    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "lots");
    expect(
      await gate(benchmark.t, benchmark.workspaceId, benchmark.ids[3])
    ).toEqual(ALLOWED);
    const reported = await benchmark.t.query(
      internal.benchmarkPeopleSearch.matchLimitStatus,
      {}
    );
    expect(reported.limit).toBeNull();
    expect(reported.error).not.toBeNull();

    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "1");
    const ordinary = await fixture(seeds, { name: "Sales team" });
    expect(
      await gate(ordinary.t, ordinary.workspaceId, ordinary.ids[3])
    ).toEqual(ALLOWED);
    expect(
      await ordinary.t.query(
        internal.benchmarkPeopleSearch.matchLimitStatus,
        {}
      )
    ).toEqual({ limit: 1, source: "benchmark", error: null });
  });

  test("parks work like a plan limit without limit_reached, a notification, or a stopped cycle", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "2");
    const { t, workspaceId, ids } = await fixture([
      matched(0),
      matched(1),
      pending,
      matched(2, { enrichmentWorkflowId: "pending:claim" }),
    ]);
    const [, , undecided, overshoot] = ids;

    expect(
      await t.action(internal.workflows.qualification.startQualification, {
        prospectId: undecided,
        workspaceId,
      })
    ).toEqual({ workId: "" });
    expect(
      await t.action(
        internal.workflows.qualification.runQualificationWorkflow,
        { prospectId: undecided, workspaceId }
      )
    ).toEqual({ workflowId: "" });
    // Queued enrichment past the first N is parked and its claim released.
    expect(
      await t.action(internal.workflows.enrichment.runEnrichmentWorkflow, {
        prospectId: overshoot,
        workspaceId,
        claimToken: "pending:claim",
      })
    ).toEqual({ workflowId: "" });

    const state = await t.run(async (ctx) => ({
      workspace: await ctx.db.get(workspaceId),
      undecided: await ctx.db.get(undecided),
      overshoot: await ctx.db.get(overshoot),
      notifications: await ctx.db.query("outreachNotifications").collect(),
    }));
    expect(state.workspace?.prospectingWorkflowStatus).toBe("running");
    expect(state.workspace?.prospectingLimitCycleStart).toBeUndefined();
    expect(state.notifications).toEqual([]);
    expect(state.undecided?.qualificationWorkflowId).toBeUndefined();
    expect(state.overshoot?.enrichmentWorkflowId).toBeUndefined();
    // The cycle-start check never sees the benchmark limit, so the next
    // cycle starts and is scheduled as usual.
    expect(
      await t.query(internal.workflows.prospecting.checkProspectLimitInternal, {
        workspaceId,
      })
    ).toMatchObject({ limitReached: false, limit: -1 });
  });

  test("recovery holds pending qualification at the limit and re-arms it below", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "2");
    const { t, ids } = await fixture([matched(0), matched(1), pending]);
    const claim = async () => {
      const prospect = await t.run((ctx) => ctx.db.get(ids[2]));
      return await t.mutation(
        internal.prospects.claimPendingQualificationRecoveryInternal,
        {
          prospectId: ids[2],
          expectedUpdatedAt: prospect!.updatedAt,
          expectedWorkflowId: undefined,
          expectedFailureAt: undefined,
          now,
        }
      );
    };
    expect(await claim()).toMatchObject({
      claimed: false,
      reason: "ineligible",
    });
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "3");
    expect(await claim()).toMatchObject({ claimed: true, scheduled: true });
  });

  test("runStatus reports the limit and tells parked work from work still running", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_CYCLE", "3");
    const { t, workspaceId } = await fixture([
      matched(0, { enrichmentStatus: "enriched" }),
      // First N, not enriched yet: still to do, not parked.
      matched(1),
      matched(2, { enrichmentWorkflowId: "pending:claim" }),
      // Past the first N: parked, unless a workflow still holds it.
      matched(3),
      matched(4, { enrichmentWorkflowId: "wf-enrich" }),
      earlier,
      pending,
      { pending: true, qualificationWorkflowId: "wf-qualify" },
    ]);
    const status = await t.query(internal.benchmarkPeopleSearch.runStatus, {
      workspaceId,
    });
    expect(status?.counts).toMatchObject({
      pending: 2,
      qualified: 6,
      enrichmentWaiting: 5,
    });
    expect(status?.matchLimit).toEqual({
      limit: 3,
      qualifiedThisCycle: 5,
      reached: true,
      queryLimit: null,
      queryMatches: null,
      queryReached: false,
    });
    expect(await parkedWork(t, workspaceId)).toEqual({
      pending: 1,
      enrichmentWaiting: 2,
    });
  });
  test("a limit per query alone limits the cycle to what earlier cycles left", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_QUERY", "4");
    const under = await fixture([earlier, earlier, matched(0), pending]);
    expect(await gate(under.t, under.workspaceId, under.ids[3])).toEqual(
      ALLOWED
    );
    expect(
      (
        await under.t.query(internal.benchmarkPeopleSearch.runStatus, {
          workspaceId: under.workspaceId,
        })
      )?.matchLimit
    ).toEqual({
      limit: 2,
      qualifiedThisCycle: 1,
      reached: false,
      queryLimit: 4,
      queryMatches: 3,
      queryReached: false,
    });
    const at = await fixture([
      earlier,
      earlier,
      matched(0),
      matched(1),
      pending,
    ]);
    expect(await gate(at.t, at.workspaceId, at.ids[4])).toEqual(PARKED);
  });

  test("a limit per query that is invalid or on another workspace limits nothing", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_QUERY", "0");
    const seeds = [earlier, matched(0), pending];
    const benchmark = await fixture(seeds);
    expect(
      await gate(benchmark.t, benchmark.workspaceId, benchmark.ids[2])
    ).toEqual(ALLOWED);
    const reported = await benchmark.t.query(
      internal.benchmarkPeopleSearch.matchLimitPerQueryStatus,
      {}
    );
    expect(reported).toEqual({
      limit: null,
      source: "default",
      error: "BENCHMARK_MATCH_LIMIT_PER_QUERY is not valid; no limit applies",
    });
    expect(
      await benchmark.t.query(
        internal.workflows.prospecting.checkProspectLimitInternal,
        { workspaceId: benchmark.workspaceId }
      )
    ).toMatchObject({ benchmarkQueryLimit: null });

    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_QUERY", "1");
    const ordinary = await fixture(seeds, { name: "Sales team" });
    expect(
      await gate(ordinary.t, ordinary.workspaceId, ordinary.ids[2])
    ).toEqual(ALLOWED);
    expect(
      await ordinary.t.query(
        internal.workflows.prospecting.checkProspectLimitInternal,
        { workspaceId: ordinary.workspaceId }
      )
    ).toMatchObject({ limitReached: false, benchmarkQueryLimit: null });
  });

  test("the cycle-start check sees the limit per query over every cycle, not the plan", async () => {
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_QUERY", "3");
    const { t, workspaceId } = await fixture([earlier, earlier, matched(0)]);
    const check = () =>
      t.query(internal.workflows.prospecting.checkProspectLimitInternal, {
        workspaceId,
      });
    expect(await check()).toMatchObject({
      limitReached: false,
      limit: -1,
      benchmarkQueryLimit: { limit: 3, matches: 3, reached: true },
    });
    vi.stubEnv("BENCHMARK_MATCH_LIMIT_PER_QUERY", "4");
    expect(await check()).toMatchObject({
      benchmarkQueryLimit: { limit: 4, matches: 3, reached: false },
    });
  });
});
