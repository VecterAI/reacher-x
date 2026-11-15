import assert from "node:assert/strict";
import test from "node:test";
import type { AgreementReport } from "../../../core/judging/labels";
import {
  checkDecisionPoint,
  renderDecisionReport,
} from "../../../people-search/analysis/decisions";

// Synthetic measurements only.
const cycle = (
  costUsd: number | null,
  activeMs: number | null,
  gapMs: number | null = 600_000
) => ({
  taskId: "6",
  cycle: 1,
  costUsd,
  activeMs,
  gapMs,
});

test("D1 fails on an expensive or unreadable cycle and passes a measured cheap one", () => {
  assert.equal(
    checkDecisionPoint({
      point: "D1",
      cycles: [cycle(0.7, 1)],
      recordingProblems: [],
    }).canContinue,
    false
  );
  assert.equal(
    checkDecisionPoint({
      point: "D1",
      cycles: [cycle(null, 1)],
      recordingProblems: [],
    }).canContinue,
    false
  );
  assert.equal(
    checkDecisionPoint({ point: "D1", cycles: [], recordingProblems: [] })
      .canContinue,
    false
  );
  const ok = checkDecisionPoint({
    point: "D1",
    cycles: [cycle(0.4, 500_000)],
    recordingProblems: [],
  });
  assert.equal(ok.canContinue, true);
  assert.ok(ok.rows.every((row) => row.status === "pass"));
});

test("D2 needs the kappa threshold, time to learn and an explicit budget decision", () => {
  const agreement = {
    passes: true,
    minimumKappa: 0.7,
    kappa: 0.82,
    labels: 40,
  } as AgreementReport;
  const result = checkDecisionPoint({
    point: "D2",
    agreement,
    labelSheet: "labels/pilot/sheet.csv",
    cycles: [cycle(0.4, 700_000)],
    projectedRemainingUsd: 20,
  });
  assert.deepEqual(
    result.rows.map((row) => row.status),
    ["pass", "fail", "needs-approval"]
  );
  const report = renderDecisionReport(result, {
    stepUsd: 8.2,
    cumulativeUsd: 9.1,
    unpriced: ["clay results"],
  });
  assert.match(report, /# D2 checkpoint/);
  assert.match(report, /your decision/);
  assert.match(report, /Unpriced usage: clay results/);
});

test("D3 names the pilot prompts that found nothing", () => {
  const result = checkDecisionPoint({
    point: "D3",
    failedChecks: [],
    pilotMatches: [
      { taskId: "6", verifiedMatches: 3 },
      { taskId: "11", verifiedMatches: 0 },
    ],
    stage2EstimateUsd: 60,
    outstanding: [],
  });
  assert.match(result.rows[1].detail, /prompt\(s\) 11/);
  assert.equal(result.canContinue, false);
});

test("missing labels and outstanding work wait rather than fail", () => {
  const d2 = checkDecisionPoint({
    point: "D2",
    agreement: null,
    labelSheet: "labels/pilot/sheet.csv",
    cycles: [cycle(0.4, 300_000)],
    projectedRemainingUsd: 20,
  });
  assert.deepEqual(
    d2.rows.map((row) => row.status),
    ["waiting", "pass", "needs-approval"]
  );
  assert.equal(d2.canContinue, false);
  assert.match(
    renderDecisionReport(d2, { stepUsd: 1, cumulativeUsd: 2, unpriced: [] }),
    /still outstanding/
  );
  const d3 = checkDecisionPoint({
    point: "D3",
    failedChecks: [],
    pilotMatches: [{ taskId: "6", verifiedMatches: 3 }],
    stage2EstimateUsd: 60,
    outstanding: ["The quick check"],
  });
  assert.deepEqual(
    d3.rows.map((row) => row.status),
    ["pass", "pass", "waiting", "needs-approval"]
  );
});
