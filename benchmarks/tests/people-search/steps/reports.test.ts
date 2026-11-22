import assert from "node:assert/strict";
import test from "node:test";
import { peopleSearchRates } from "../../../people-search/setup/rates";
import type { SegmentId } from "../../../people-search/setup/schedule";
import {
  aggregateReport,
  decide,
  learningPairs,
  keywordSearchCapLine,
  matchLimitLines,
  renderSegmentReport,
  segmentOutcomeSchema,
  viaPeopleShare,
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

const block = (...lines: string[]) => ["```", ...lines, "```"].join("\n");

test("the step report charts each group, marks ReacherX, and draws comparisons either side of a line", () => {
  // A competitor that completed its search; nothing is judged yet.
  const competitor = (toolId: string) => ({
    taskId: "p14",
    toolId,
    submittedAt: "2026-11-18T00:00:00.000Z",
    candidates: [],
    usage: [],
    requestLatencyMs: 1_000,
    completedAfterMs: 1_000,
    receipt: {
      toolId,
      taskId: "p14",
      endpoints: [],
      nativeFilters: null,
      unexpressed: [],
      servedBy: {},
      notes: [],
    },
  });
  const smoke = segmentOutcomeSchema.parse({
    ...outcome("smoke", [workspace("p14")]),
    competitors: ["apollo", "exa"].map(competitor),
  });
  const report = renderSegmentReport(smoke, context([]));
  for (const expected of [
    block(
      "Companies, static filters · verified in top 5 (1 prompt)",
      "",
      "  Tool                 Match rate            Score  Hits  Priced usage            95% CI",
      "  ───────────────────  ────────────────────  ─────  ────  ──────────────────────  ──────────",
      "  apollo               ░░░░░░░░░░░░░░░░░░░░    n/a  0/0   $0.00                   no results",
      "  exa                  ░░░░░░░░░░░░░░░░░░░░    n/a  0/0   $0.00                   no results",
      "→ reacherx             ░░░░░░░░░░░░░░░░░░░░    n/a  0/0   $0.56 + unpriced units  no results",
      "→ reacherx_via_people  ░░░░░░░░░░░░░░░░░░░░    n/a  0/0   $0.00                   no results"
    ),
    block(
      "Companies, static filters · ReacherX minus tool (1 prompt)",
      "",
      "  Tool    Difference             Mean  95% interval",
      "  ──────  ─────────────────────  ────  ──────────────────",
      "  apollo  ░░░░░░░░░░│░░░░░░░░░░  0.0%  single observation",
      "  exa     ░░░░░░░░░░│░░░░░░░░░░  0.0%  single observation"
    ),
    block(
      "Companies, static filters · ReacherX via people minus tool (1 prompt)",
      "",
      "  Tool    Difference             Mean  95% interval",
      "  ──────  ─────────────────────  ────  ──────────────────",
      "  apollo  ░░░░░░░░░░│░░░░░░░░░░  0.0%  single observation",
      "  exa     ░░░░░░░░░░│░░░░░░░░░░  0.0%  single observation"
    ),
    block(
      "Companies, static filters · verified in top 10 (1 prompt)",
      "",
      "  Tool  Match rate            Score  Hits  Note",
      "  ────  ────────────────────  ─────  ────  ──────────",
      "  exa   ░░░░░░░░░░░░░░░░░░░░    n/a  0/0   no results"
    ),
  ])
    assert.ok(report.includes(expected), expected);
  // Tool results are charts; only spend and workspace tables stay tables.
  const results = report.indexOf("## Verified matches in each tool's top 5");
  assert.ok(results >= 0);
  assert.doesNotMatch(report.slice(results), /^\|/m);
  // Company prompts only: described, never tested, and no pooled people family.
  assert.ok(report.includes("By category, descriptive only"));
  assert.doesNotMatch(report, /Holm p|People, all prompts|last cycle/);
});

test("the share of all companies behind ReacherX's people is charted per prompt, best first", () => {
  const judged = (taskId: string, verifiedMatch: boolean) => ({
    taskId,
    toolId: "reacherx_via_people",
    record: { panel: { verifiedMatch } },
  });
  // p14 as in the D1 smoke report: 7 of 111 companies verified.
  const cases = [
    ...Array.from({ length: 111 }, (_, index) => judged("p14", index < 7)),
    ...Array.from({ length: 4 }, (_, index) => judged("p16", index < 2)),
    judged("p16", true),
  ];
  assert.ok(
    viaPeopleShare(cases)
      .join("\n")
      .endsWith(
        block(
          "reacherx_via_people · verified of all companies judged (2 prompts)",
          "",
          "  Prompt  Match rate            Score  Hits   95% CI",
          "  ──────  ────────────────────  ─────  ─────  ─────────────",
          "  p16     ████████████░░░░░░░░  60.0%  3/5    23.1% - 88.2%",
          "  p14     █░░░░░░░░░░░░░░░░░░░   6.3%  7/111   3.1% - 12.4%"
        )
      )
  );
  assert.deepEqual(
    viaPeopleShare([{ ...judged("p14", true), toolId: "exa" }]),
    []
  );
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

test("the step report states the match limit each workspace ran with, never one it lacked", () => {
  // A continuation after a budget stop; `matchLimitPerCycle` absent as in
  // records made before the limit existed.
  const continuation = (resumedAt: number, matchLimitPerCycle?: number) => ({
    after: "budget-stop",
    afterDetail: null,
    discoveryCompleted: true,
    stoppedAt: resumedAt - 3_600_000,
    resumedAt,
    endedAt: resumedAt + 600_000,
    ending: "planned-cycles",
    spend: { atStopUsd: 0.5, atResumeUsd: 0.5, afterUsd: 0.7 },
    recordedAtStop: { costs: null, linkdApi: null },
    requeued: null,
    ...(matchLimitPerCycle === undefined ? {} : { matchLimitPerCycle }),
  });
  const run = (
    taskId: string,
    fields: { matchLimitPerCycle?: number; resumed?: unknown[] }
  ) => {
    const item = workspace(taskId);
    return { ...item, record: { ...item.record, ...fields } };
  };

  // Every run with the same limit: one step-level line.
  const [same] = matchLimitLines(
    outcome("smoke", [
      run("p14", { matchLimitPerCycle: 20 }),
      run("p06", {
        matchLimitPerCycle: 20,
        resumed: [continuation(Date.UTC(2026, 10, 17), 20)],
      }),
    ])
  );
  assert.match(
    same,
    /^Match limit: 20 per cycle, applied through the plan-limit gate \(agreed by the project lead, 17 Nov 2026/
  );
  assert.match(same, /Only the cycle's first 20 matches at most were enriched/);
  // Neither line rules out the other limit.
  assert.doesNotMatch(same, /scheduled as usual|only the plan/);
  // Records from before the limits existed ran without them.
  assert.deepEqual(matchLimitLines(outcome("smoke", [workspace("p14")])), [
    "Match limit per cycle: none.",
    "Match limit per query: none.",
  ]);

  // The smoke workspace: its cycle and first continuation ran without a
  // limit, its second continuation with 20.
  const lines = matchLimitLines(
    outcome("smoke", [
      run("p14", {
        resumed: [
          continuation(Date.UTC(2026, 10, 16, 19)),
          continuation(Date.UTC(2026, 10, 17, 9), 20),
        ],
      }),
      run("p06", { matchLimitPerCycle: 20 }),
    ])
  );
  assert.match(lines[0], /^Match limit: not the same for every workspace run/);
  assert.deepEqual(lines.slice(1, 3), [
    "- synthetic_p14_on: no match limit during its cycle; match limit 20 per cycle from the 17 Nov resume.",
    "- synthetic_p06_on: match limit 20 per cycle throughout.",
  ]);
  assert.ok(lines.every((line) => !line.startsWith("Match limit: 20")));
});

test("the step report states the match limit per query, and ending at it is not a failure", () => {
  const limited = (
    taskId: string,
    ending: string,
    matchLimitPerQuery = 100
  ) => {
    const item = workspace(taskId);
    return {
      ...item,
      record: {
        ...item.record,
        plannedCycles: 3,
        ending,
        matchLimitPerCycle: 20,
        matchLimitPerQuery,
      },
    };
  };
  const [cycle, query] = matchLimitLines(
    outcome("smoke", [
      limited("p14", "match-limit-per-query"),
      limited("p06", "planned-cycles"),
    ])
  );
  assert.match(cycle, /^Match limit: 20 per cycle/);
  assert.match(
    query,
    /^Match limit per query: 100 matches per workspace over all its cycles, applied through the plan-limit gate and the cycle-start limit check \(agreed by the project lead, 17 Nov 2026; development-only BENCHMARK_MATCH_LIMIT_PER_QUERY\)/
  );
  assert.match(query, /ended match-limit-per-query, with fewer cycles/);
  // A limit per query alone: the per-cycle line claims nothing about it.
  const [noCycle, onlyQuery] = matchLimitLines(
    outcome("smoke", [
      {
        ...limited("p14", "match-limit-per-query"),
        record: {
          ...limited("p14", "match-limit-per-query").record,
          matchLimitPerCycle: null,
        },
      },
    ])
  );
  assert.equal(noCycle, "Match limit per cycle: none.");
  assert.match(onlyQuery, /^Match limit per query: 100 matches/);
  const differing = matchLimitLines(
    outcome("smoke", [
      limited("p14", "planned-cycles", 50),
      limited("p06", "planned-cycles"),
    ])
  );
  assert.deepEqual(differing.slice(-3), [
    differing.at(-3)!,
    "- synthetic_p14_on: match limit 50 per query throughout.",
    "- synthetic_p06_on: match limit 100 per query throughout.",
  ]);
  assert.match(differing.at(-3)!, /^Match limit per query: not the same/);

  const failures = (ending: string) =>
    decide(
      outcome("stage2-rest", [limited("p14", ending)]),
      context([]),
      "D4"
    )?.rows.find((row) => row.condition === "Nothing has failed");
  assert.equal(failures("match-limit-per-query")?.status, "pass");
  assert.equal(failures("timed-out")?.status, "fail");
});
