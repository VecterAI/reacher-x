import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  computePlatformScores,
  computeQueryMetrics,
  ndcg,
  pyRound,
  pySum,
  rescoreRound1,
} from "../../../people-search/analysis/round1";

// Synthetic round-one data only: real query IDs, made-up people and verdicts.
const MODEL = "test/judge";

const evaluation = (
  grade: number,
  utility: number,
  error: string | null = null
) => ({
  criteria_results: [
    {
      criterion_id: "c1",
      match: grade >= 0.5 ? "met" : "not_met",
      confidence: "high",
    },
  ],
  relevance_grade: grade,
  utility_score: utility,
  error,
});

async function writeJson(root: string, file: string, value: unknown) {
  await mkdir(dirname(join(root, file)), { recursive: true });
  await writeFile(join(root, file), JSON.stringify(value));
}

const person = (rank: number) => ({
  rank,
  name: `Person ${rank}`,
  linkedin_url: null,
  activity_date: "2026-10-20",
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "round1-"));
  await writeJson(root, "config.frozen.json", {
    top_k: 10,
    judge: { trial: MODEL, final: MODEL },
  });
  const raw = (persons: unknown[]) => ({
    at: "2026-11-06T12:00:00+00:00",
    status: persons.length ? "ok" : "empty",
    latency_s: 2,
    cost_usd: 0.01,
    credits: null,
    raw_sha256: "synthetic",
    persons,
  });
  await writeJson(root, "raw/exa/b2b_0014.json", raw([1, 2, 3].map(person)));
  // ReacherX answered nobody on b2b_0014 and was never run on rec_0020 (config not_run).
  await writeJson(root, "raw/reacherx/b2b_0014.json", raw([]));
  await writeJson(root, "raw/reacherx/rec_0020.json", raw([person(1)]));
  const verdict = (value: ReturnType<typeof evaluation>) => ({
    at: "2026-11-06T12:30:00+00:00",
    evaluation: value,
    searches: [{ query: "q", urls: [] }],
    tokens: { input: 100, output: 10 },
  });
  // Rank 3 has no verdict.
  await writeJson(
    root,
    "verdicts/test__judge/exa/b2b_0014/01.json",
    verdict(evaluation(1, 0.8))
  );
  await writeJson(
    root,
    "verdicts/test__judge/exa/b2b_0014/02.json",
    verdict(evaluation(0.4, 0.6))
  );
  return root;
}

test("Python rounding is half-to-even on the binary value", () => {
  assert.equal(pyRound(0.125, 2), 0.12); // exact tie, rounds to even
  assert.equal(pyRound(0.375, 2), 0.38);
  assert.equal(pyRound(2.5, 0), 2);
  assert.equal(pyRound(2.675, 2), 2.67); // stored just below 2.675
  assert.equal(pyRound(-1.005, 2), -1); // stored just below -1.005 in magnitude
  assert.equal(pySum([0.1, 0.2, 0.3]), 0.6); // naive left-to-right gives 0.6000000000000001
});

test("upstream metrics match hand-computed values", () => {
  // Ideal DCG@10 = sum of 1/log2(i + 1) for i = 1..10 ≈ 4.5435593.
  assert.ok(
    Math.abs(ndcg([1, 0.4], 10) - (1 + 0.4 / Math.log2(3)) / 4.5435593) < 1e-7
  );
  assert.equal(ndcg([], 10), 0);

  const query = computeQueryMetrics(
    "b2b",
    [
      evaluation(1, 0.8),
      evaluation(0.4, 0.6),
      evaluation(0.5, 0.9, "judge failed"),
    ],
    10
  );
  assert.equal(query.numQualified, 2);
  assert.equal(query.coverage, 0.2);
  assert.equal(query.utility, 0.7); // the judge error is left out of utility
  assert.equal(query.precision[5], 2 / 3);

  const empty = computeQueryMetrics("influencer", [], 10);
  const scores = computePlatformScores("tool", [query, empty], 2);
  assert.equal(scores.task_completion_rate, 50);
  assert.equal(scores.effective_coverage, 5); // 0.5 completion * 0.1 mean coverage
  assert.equal(scores.information_utility, 70); // zero utility is not averaged in
  assert.equal(scores.mean_qualified_results, 1);
  assert.equal(scores.by_category.influencer.relevance_precision, 0);
  assert.equal(scores.consistency_score, 0); // two categories, one at zero: cv = 1
});

test("re-score counts missing verdicts and leaves not-run questions out", async () => {
  const root = await fixture();
  try {
    const report = await rescoreRound1(root, "final", 10);
    assert.deepEqual(report.missing_verdicts, ["exa/b2b_0014#3"]);
    assert.deepEqual(
      report.rows.map((row) => `${row.tool}/${row.query_id}`),
      ["exa/b2b_0014", "reacherx/b2b_0014"]
    );

    const [exa, reacherx] = report.rows;
    assert.equal(exa.returned, 3);
    assert.equal(exa.unique, 3);
    assert.equal(exa.criteria_passing, 1);
    assert.equal(exa.verifiable, 2);
    assert.equal(exa.ndcg_10, 0.2756); // (1 + 0.4 / log2 3) / 4.5435593
    assert.equal(exa.utility, 0.7);
    // (27.5638 + 10 coverage + 70 utility) / 3
    assert.equal(exa.overall, 35.85);
    assert.equal(exa.cost_per_usable_usd, 0.01);
    assert.deepEqual(exa.judge_tokens, { input: 200, output: 20 });
    assert.equal(reacherx.returned, 0);
    assert.equal(reacherx.overall, 0);

    const exaSummary = report.summary.public.exa;
    assert.equal(exaSummary.queries_scored, 1);
    assert.deepEqual(exaSummary.pending, ["det_0010", "inf_0028", "rec_0020"]);
    const rxSummary = report.summary.public.reacherx;
    // The empty answer counts as zero; rec_0020 is not run, so it is not averaged.
    assert.equal(rxSummary.total_queries, 1);
    assert.equal(rxSummary.overall, 0);
    assert.deepEqual(rxSummary.not_run, ["det_0010", "inf_0028", "rec_0020"]);
    assert.deepEqual(rxSummary.pending, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pilot rules pad every question of the track and respect the snapshot time", async () => {
  const root = await fixture();
  try {
    const report = await rescoreRound1(root, "trial", 3, {
      asOf: "2026-11-06T12:15:00+00:00",
    });
    // Verdicts were written after the snapshot, so none count yet.
    assert.equal(report.missing_verdicts.length, 4);
    const exa = report.summary.public.exa;
    assert.equal(exa.total_queries, 4);
    assert.equal("queries_scored" in exa, false);
    assert.equal("overall" in report.rows[0], false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
