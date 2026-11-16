import assert from "node:assert/strict";
import test from "node:test";
import { peopleSearchRates } from "../../../people-search/setup/rates";
import type { SegmentId } from "../../../people-search/setup/schedule";
import {
  aggregateReport,
  decide,
  learningPairs,
  keywordSearchCapLine,
  segmentOutcomeSchema,
  type ReportContext,
} from "../../../people-search/steps/reports";

// Synthetic outcomes only.
const judged = (
  taskId: string,
  learning: "on" | "off",
  verifiedMatch: boolean,
  unit = 1
) => ({
  unitId: `j-reacherx-${taskId}-${learning}-c1-q${unit}`,
  taskId,
  toolId: "reacherx",
  kind: "top" as const,
  learning,
  cycle: 1,
  record: { panel: { verifiedMatch } },
});

test("learning pairs need both conditions completed and fully judged; a genuine empty search counts as 0", () => {
  const ran = (taskId: string) =>
    (["on", "off"] as const).map((learning) => ({ taskId, learning }));
  const cases = [
    judged("p01", "on", true, 1),
    judged("p01", "on", true, 2),
    judged("p01", "on", true, 3),
    judged("p08", "on", true, 1),
    judged("p08", "off", true, 1),
    judged("p11", "on", true, 1),
    judged("p11", "off", true, 1),
    judged("p12", "on", true, 1),
  ];
  const targets = [
    // p01 off had nothing to judge: a genuine zero.
    ...[1, 2, 3].map((unit) => `j-reacherx-p01-on-c1-q${unit}`),
    // p08 off was interrupted after one of its two results.
    "j-reacherx-p08-on-c1-q1",
    "j-reacherx-p08-off-c1-q1",
    "j-reacherx-p08-off-c1-q2",
    "j-reacherx-p11-on-c1-q1",
    "j-reacherx-p11-off-c1-q1",
    // p12 off completed its workspace but judging never reached it.
    "j-reacherx-p12-on-c1-q1",
    "j-reacherx-p12-off-c1-q1",
  ];
  const { pairs, incomplete } = learningPairs(
    [
      ...ran("p01"),
      ...ran("p08"),
      { taskId: "p06", learning: "on" },
      { taskId: "p07", learning: "on" },
      ...ran("p11"),
      ...ran("p12"),
    ],
    cases,
    [{ unitId: "w-p06-off" }, { unitId: "j-reacherx-p11-on-c2-q1" }],
    targets
  );
  assert.deepEqual(pairs, [{ taskId: "p01", on: 3, off: 0 }]);
  assert.deepEqual(incomplete, [
    { taskId: "p06", learning: "off", reason: "held for review" },
    { taskId: "p07", learning: "off", reason: "not run" },
    { taskId: "p08", learning: "off", reason: "partly judged" },
    { taskId: "p11", learning: "on", reason: "held for review" },
    { taskId: "p12", learning: "off", reason: "not judged yet" },
  ]);
  // Before judging has started nothing is compared.
  const unjudged = learningPairs(ran("p01"), [], [], null);
  assert.deepEqual(unjudged.pairs, []);
  assert.deepEqual(
    unjudged.incomplete.map((item) => item.reason),
    ["not judged yet", "not judged yet"]
  );
});

const workspace = (taskId: string) => {
  const label = `synthetic_${taskId}_on`;
  return {
    taskId,
    learning: "on",
    label,
    record: {
      label,
      workspace: { workspaceId: `w-${taskId}`, createdAt: 0, label },
      learning: "on",
      plannedCycles: 1,
      submittedAt: 0,
      startedAt: 1_000,
      endedAt: 60_000,
      ending: "planned-cycles",
      detail: null,
      cycles: [
        {
          cycle: 1,
          workflowId: "wf1",
          startedAt: 1_000,
          discoveryEndedAt: 30_000,
          outcome: "completed",
          settledAt: 50_000,
          nextStartAt: 600_000,
          nextStartObserved: false,
          spendAtStartUsd: 0.1,
          spendAtEndUsd: 0.5,
        },
      ],
      spend: { atSubmitUsd: 0, beforeStartUsd: 0.1, afterUsd: 0.5 },
      recorded: {
        costs: {
          providers: {
            socialapi: { usd: 0.06, requests: 10, billableUnits: 300 },
          },
          llmUsdRecorded: 0.4,
          llmCallsRecorded: 10,
          capped: false,
        },
        linkdApi: {
          billableUnits: 11,
          successes: 11,
          events: 11,
          capped: false,
        },
      },
      stop: {
        cancelFailed: false,
        stopped: true,
        monitorsDeleted: 1,
        monitorFailures: [],
      },
      prospects: [],
    },
    accountsBefore: [],
    accountsAfter: [],
  };
};

const outcome = (segment: SegmentId, workspaces: unknown[] = []) =>
  segmentOutcomeSchema.parse({
    segment,
    runId: `synthetic-${segment}`,
    status: "complete",
    stopReason: null,
    settings: null,
    stage2: null,
    units: { executed: 0, reused: 0 },
    workspaces,
    translations: [],
    competitors: [],
    cases: [],
    review: [],
    notReached: 0,
    accounts: null,
    labels: null,
    decision: null,
    stepUsd: 0,
  });

const context = (earlier: ReportContext["earlier"]): ReportContext => ({
  planSha256: "0".repeat(64),
  seed: 7,
  rates: peopleSearchRates("2026-11-15T00:00:00.000Z"),
  earlier,
  plannedCycleCostUsd: null,
});

test("projections stay unknown when a cost they need was never measured", () => {
  // No judged result has a recorded cost, so the main-run projection is unknown, not $0.
  const d2 = decide(outcome("pilot"), context([outcome("smoke")]), "D2");
  const budget = d2?.rows.find((row) =>
    row.condition.startsWith("Remaining stage 1 budget")
  );
  assert.equal(budget?.status, "needs-approval");
  assert.match(
    budget?.detail ?? "",
    /unknown, because a cost it needs has no measurement yet/
  );
  assert.doesNotMatch(budget?.detail ?? "", /\$0\.000/);

  // No cycle cost was measured, so the stage 2 estimate is unknown, not $0.
  const d3 = decide(
    outcome("main"),
    context([outcome("smoke"), outcome("pilot")]),
    "D3"
  );
  const stage2 = d3?.rows.find(
    (row) => row.condition === "Stage 2 budget approved"
  );
  assert.equal(stage2?.status, "needs-approval");
  assert.match(stage2?.detail ?? "", /unknown/);
  assert.doesNotMatch(stage2?.detail ?? "", /\$0\.000/);
});

test("the rest of stage 2 aggregates its first third's workspaces, never stage 1's", () => {
  const report = aggregateReport(
    outcome("stage2-rest"),
    context([
      outcome("smoke", [workspace("p14")]),
      outcome("stage2-first", [workspace("p06")]),
    ])
  );
  assert.deepEqual(
    report.rows.map((row) => `${row.taskId} ${row.toolId}`),
    ["p06 reacherx"]
  );
  const [row] = report.rows;
  // AI spend of its first cycle (with setup) and the recorded X use.
  assert.equal(row.usage.pricedUsageUsd.toFixed(2), "0.56");
  assert.equal(row.speed.requestLatencyMs, 1_000);
});

test("the step report states whether the keyword post-search cap was in force", () => {
  const settings = (keywordPostSearchLimit?: number | null) => ({
    settings: {
      production: {},
      productionSource: "docs",
      runOnly: {},
      poolLimits: {},
      linkdApiCircuitReset: false,
      ...(keywordPostSearchLimit === undefined
        ? {}
        : { keywordPostSearchLimit }),
    },
  });
  assert.match(
    keywordSearchCapLine(settings(100)),
    /in force for this step, at most 100 LinkdAPI calls per workspace cycle for enrichment's search/
  );
  // Only the keyword post search was capped, and the line says so.
  assert.match(
    keywordSearchCapLine(settings(100)),
    /profile and company reads and qualification were not capped/
  );
  assert.match(
    keywordSearchCapLine(settings(null)),
    /none; no limit was in force/
  );
  // Outcomes recorded before the cap existed still parse and say so.
  assert.match(keywordSearchCapLine(settings()), /not recorded/);
  assert.match(keywordSearchCapLine({ settings: null }), /not recorded/);
});
