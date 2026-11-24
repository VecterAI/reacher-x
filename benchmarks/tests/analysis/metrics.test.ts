import assert from "node:assert/strict";
import test from "node:test";
import type { BlindInput, PanelResult } from "../../core/judging/judges";
import {
  compareToBaseline,
  comparisonFamilies,
  costPerVerifiedMatch,
  lastCompletedCycle,
  MIN_TESTED_PROMPTS,
  pooledComparison,
  freshness,
  matchesAtK,
  newestCitedEvidenceAgeDays,
  profileCompleteness,
  scoringMistakes,
  searchQuality,
  selfImprovement,
  speed,
  type JudgedResult,
} from "../../core/analysis/metrics";
import { holm, pairedBootstrap } from "../../core/analysis/stats";
import { summarizeUsage } from "../../core/execution/spend";

// Synthetic judged results only.
const result = (
  toolId: string,
  taskId: string,
  rank: number,
  verifiedMatch: boolean,
  extra: Partial<JudgedResult> = {}
): JudgedResult => ({
  toolId,
  taskId,
  rank,
  verifiedMatch,
  category: "people-static",
  availableAfterMs: null,
  newestCitedEvidenceAgeDays: null,
  ...extra,
});

test("tools are compared on the same top-K slots, and empty slots count as misses", () => {
  const rows = matchesAtK(
    [
      result("reacherx", "1", 1, true),
      result("reacherx", "1", 2, true),
      result("reacherx", "2", 1, true),
      result("other", "1", 1, true),
      // Beyond K, never counted.
      result("other", "1", 3, true),
      result("other", "2", 1, false),
      // A prompt the baseline never ran is not paired.
      result("other", "3", 1, true),
    ],
    2
  );
  assert.deepEqual(
    rows.map(({ toolId, taskId, returned, verified }) => [
      toolId,
      taskId,
      returned,
      verified,
    ]),
    [
      ["other", "1", 1, 1],
      ["other", "2", 1, 0],
      ["other", "3", 1, 1],
      ["reacherx", "1", 2, 2],
      ["reacherx", "2", 1, 1],
    ]
  );
  const [comparison] = compareToBaseline(rows, "reacherx", 2, 7);
  assert.equal(comparison.other, "other");
  assert.equal(comparison.comparison.prompts, 2);
  // (1 - 0.5) and (0.5 - 0) average to 0.5.
  assert.equal(comparison.comparison.meanDifference, 0.5);
  // Descriptive: no p-value, no Holm.
  assert.deepEqual(Object.keys(comparison.comparison).sort(), [
    "interval",
    "meanDifference",
    "prompts",
  ]);
  assert.equal("holmAdjustedP" in comparison, false);
});

// One compared row: a tool's verified count in the top 5 on one prompt.
const compared = (
  toolId: string,
  taskId: string,
  verified: number,
  category: string,
  entityType: "individual" | "organization"
) => ({ toolId, taskId, verified, returned: 5, category, entityType });

test("the pooled family takes only people prompts, across both people categories, with Holm within it", () => {
  const people = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => {
    const category = n <= 4 ? "People, static filters" : "People, signals";
    return [
      compared(
        "reacherx",
        `p${n}`,
        n % 3 === 0 ? 1 : 4,
        category,
        "individual"
      ),
      compared("a", `p${n}`, 2, category, "individual"),
      compared("b", `p${n}`, n % 2 ? 5 : 1, category, "individual"),
    ];
  });
  // A clean sweep on three company prompts, and a tool only on companies.
  const companies = [11, 12, 13].flatMap((n) => [
    compared("reacherx", `p${n}`, 5, "Companies, signals", "organization"),
    compared("a", `p${n}`, 0, "Companies, signals", "organization"),
    compared("c", `p${n}`, 0, "Companies, signals", "organization"),
  ]);
  const families = comparisonFamilies(
    [...people, ...companies],
    "reacherx",
    5,
    7
  );
  assert.deepEqual(
    families.people.map((item) => [item.other, item.comparison.prompts]),
    [
      ["a", 8],
      ["b", 8],
    ]
  );
  // The same as pooling the people rows alone: companies never enter.
  assert.deepEqual(families.people, pooledComparison(people, "reacherx", 5, 7));
  // Holm over these two comparisons only.
  const expected = holm(
    families.people.map((item) => ({
      comparisonId: item.other,
      pValue: item.comparison.pValue!,
    }))
  );
  assert.deepEqual(
    families.people.map((item) => item.holmAdjustedP),
    expected.map((item) => item.adjustedPValue)
  );
  // Each category is described, never tested.
  assert.deepEqual(
    [...new Set(families.byCategory.map((item) => item.category))],
    ["People, static filters", "People, signals", "Companies, signals"]
  );
  for (const item of families.byCategory) {
    assert.equal("pValue" in item.comparison, false);
    assert.equal("holmAdjustedP" in item, false);
  }
});

test("a clean sweep on three prompts is not reported as significant anywhere", () => {
  const sweep = (prompts: number, entityType: "individual" | "organization") =>
    Array.from({ length: prompts }, (_, index) => [
      compared("reacherx", `p${index + 1}`, 5, "Group", entityType),
      compared("other", `p${index + 1}`, 0, "Group", entityType),
    ]).flat();
  // The bootstrap alone would give it p = 0.
  assert.equal(
    pairedBootstrap(
      [1, 2, 3].map((n) => ({ taskId: `p${n}`, left: 1, right: 0 })),
      7
    ).pValue,
    0
  );
  for (const entityType of ["individual", "organization"] as const) {
    const families = comparisonFamilies(sweep(3, entityType), "reacherx", 5, 7);
    for (const item of families.people) {
      assert.equal(item.comparison.pValue, null);
      assert.equal(item.holmAdjustedP, null);
      // Still described.
      assert.equal(item.comparison.meanDifference, 1);
    }
    for (const item of families.byCategory)
      assert.equal("pValue" in item.comparison, false);
  }
  // From six people prompts the pooled comparison is tested.
  const [six] = pooledComparison(sweep(6, "individual"), "reacherx", 5, 7);
  assert.equal(MIN_TESTED_PROMPTS, 6);
  assert.equal(six.holmAdjustedP, 0);
});

test("the last finished cycle is the last by number, never the best", () => {
  const cycle = (n: number, finished = true) => ({
    cycle: n,
    settledAt: finished && n === 4 ? 1 : null,
    nextStartObserved: finished && n < 4,
  });
  assert.equal(lastCompletedCycle([1, 2, 3, 4].map((n) => cycle(n))), 4);
  // A last cycle that never settled is not finished; the one before it is.
  assert.equal(
    lastCompletedCycle([cycle(1), cycle(2), cycle(3), cycle(4, false)]),
    3
  );
  assert.equal(lastCompletedCycle([cycle(1, false)]), null);
  assert.equal(lastCompletedCycle([]), null);
});

test("scoring mistakes count wrong acceptances and wrongly rejected matches", () => {
  const mistakes = scoringMistakes(
    [{ verifiedMatch: true }, { verifiedMatch: false }],
    [
      { verifiedMatch: true },
      { verifiedMatch: false },
      { verifiedMatch: false },
    ]
  );
  assert.equal(mistakes.acceptedWrong.successes, 1);
  assert.equal(mistakes.acceptedWrong.trials, 2);
  assert.equal(mistakes.rejectedRight.successes, 1);
  assert.equal(mistakes.rejectedRight.trials, 3);
});

test("freshness uses only dated evidence cited for criteria finally met", () => {
  const input = {
    referenceDate: "2026-11-14T00:00:00Z",
    entity: {
      evidence: [
        { id: "old", publishedAt: "2026-08-16T00:00:00Z" },
        { id: "new", publishedAt: "2026-11-04T00:00:00Z" },
        { id: "uncited", publishedAt: "2026-11-13T00:00:00Z" },
      ],
    },
  } as unknown as BlindInput;
  const grade = (verdict: string, evidenceIds: string[]) => ({
    caseId: "x",
    criteria: [{ criterionId: "role", verdict, evidenceIds, explanation: "" }],
  });
  const agreed = {
    primary: [grade("met", ["old"]), grade("met", ["old"])],
    tieBreaker: null,
    verdicts: { role: "met" },
  } as unknown as PanelResult;
  assert.equal(newestCitedEvidenceAgeDays(input, agreed), 90);
  // On a disagreement only the tie-breaker's citations decide.
  const disputed = {
    primary: [grade("met", ["old"]), grade("not_met", [])],
    tieBreaker: grade("met", ["new"]),
    verdicts: { role: "met" },
  } as unknown as PanelResult;
  assert.equal(newestCitedEvidenceAgeDays(input, disputed), 10);
  assert.deepEqual(
    freshness([
      result("t", "1", 1, true, { newestCitedEvidenceAgeDays: 10 }),
      result("t", "1", 2, true, { newestCitedEvidenceAgeDays: 30 }),
      result("t", "1", 3, true),
      result("t", "1", 4, false, { newestCitedEvidenceAgeDays: 1 }),
    ]),
    { verifiedMatches: 3, withDatedEvidence: 2, medianAgeDays: 20 }
  );
});

test("speed reports first and fifth verified matches and counts prompts that never reached them", () => {
  const timed = (taskId: string, times: number[]) =>
    times.map((ms, index) =>
      result("reacherx", taskId, index + 1, true, { availableAfterMs: ms })
    );
  const summary = speed([
    ...timed("1", [500, 100, 300, 400, 200]),
    ...timed("2", [900]),
    result("reacherx", "2", 2, false, { availableAfterMs: 50 }),
  ]);
  assert.deepEqual(summary, {
    prompts: 2,
    first: { medianMs: 500, reached: 2, unreached: 0 },
    fifth: { medianMs: 500, reached: 1, unreached: 1 },
  });
});

test("cost per match never values unpriced units at zero", () => {
  const usage = summarizeUsage([
    {
      provider: "priced",
      quantity: 1,
      unit: "request",
      valuation: { status: "priced", normalUsd: 3, rateReference: "r" },
      funding: { grantUnitsUsed: 0, cashUsd: 3 },
    },
    {
      provider: "credits",
      quantity: 5,
      unit: "credit",
      valuation: { status: "unpriced", reason: "No verified rate" },
      funding: { grantUnitsUsed: 5, cashUsd: null },
    },
  ]);
  const cost = costPerVerifiedMatch(usage, 2);
  assert.equal(cost.pricedUsdPerMatch, 1.5);
  assert.equal(cost.complete, false);
  assert.equal(costPerVerifiedMatch(usage, 0).pricedUsdPerMatch, null);
});

test("search quality, profile completeness and self-improvement stay descriptive per unit", () => {
  assert.deepEqual(
    searchQuality([
      {
        taskId: "6",
        learning: "on",
        cycle: 2,
        searches: 0,
        verifiedMatches: 0,
      },
      {
        taskId: "6",
        learning: "on",
        cycle: 1,
        searches: 4,
        verifiedMatches: 2,
      },
    ]).map((cycle) => [cycle.cycle, cycle.matchesPerSearch]),
    [
      [1, 0.5],
      [2, null],
    ]
  );
  assert.deepEqual(
    profileCompleteness([
      {
        prospectType: "individual",
        name: "Synthetic",
        profileUrl: "https://example.com/p",
        location: null,
        description: null,
        evidence: [],
        title: "Engineer",
        employer: null,
      },
    ]),
    { entities: 1, fieldShare: 0.4 }
  );
  const learning = selfImprovement([{ taskId: "6", on: 4, off: 1 }], 7);
  assert.deepEqual(learning.perPrompt, [{ taskId: "6", difference: 3 }]);
  // One prompt is a single observation, so no interval is claimed.
  assert.equal(learning.overall.interval, null);
});
