import assert from "node:assert/strict";
import test from "node:test";
import { cohenKappa, holm, pairedBootstrap, wilson } from "./stats";

const close = (actual: number, expected: number, tolerance = 1e-4) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`
  );

test("Wilson interval matches the reference value and handles edges", () => {
  const estimate = wilson(8, 10);
  close(estimate.interval!.lower, 0.4902);
  close(estimate.interval!.upper, 0.9433);
  assert.equal(wilson(0, 0).interval, null);
  close(wilson(0, 5).interval!.lower, 0);
  assert.throws(() => wilson(3, 2));
});

test("paired bootstrap is reproducible and stays descriptive for one prompt", () => {
  const pairs = ["1", "2", "3", "4", "5", "6"].map((taskId, index) => ({
    taskId,
    left: 0.6 + index * 0.02,
    right: 0.4,
  }));
  const first = pairedBootstrap(pairs, 7, 2000);
  assert.deepEqual(first, pairedBootstrap(pairs, 7, 2000));
  close(first.meanDifference, 0.25);
  assert.ok(first.interval!.lower > 0 && first.pValue === 0);
  const single = pairedBootstrap([pairs[0]], 7);
  assert.equal(single.interval, null);
  assert.equal(single.pValue, null);
  assert.throws(() => pairedBootstrap([pairs[0], pairs[0]], 7));
  for (const resamples of [0, -1, 1.5, Number.POSITIVE_INFINITY])
    assert.throws(() => pairedBootstrap(pairs, 7, resamples));
});

test("Holm adjustment is monotone and capped at one", () => {
  const adjusted = holm([
    { comparisonId: "a", pValue: 0.01 },
    { comparisonId: "b", pValue: 0.04 },
    { comparisonId: "c", pValue: 0.03 },
  ]);
  assert.deepEqual(
    adjusted.map(({ adjustedPValue }) => Number(adjustedPValue.toFixed(4))),
    [0.03, 0.06, 0.06]
  );
  assert.throws(() =>
    holm([
      { comparisonId: "x", pValue: 0.01 },
      { comparisonId: "x", pValue: 0.04 },
    ])
  );
});

test("Cohen's kappa matches a hand-computed table", () => {
  // 20 met/met, 5 met/not, 10 not/met, 15 not/not: po 0.70, pe 0.50, kappa 0.40.
  const labels = [
    ...Array(20).fill({ human: "met", model: "met" }),
    ...Array(5).fill({ human: "met", model: "not_met" }),
    ...Array(10).fill({ human: "not_met", model: "met" }),
    ...Array(15).fill({ human: "not_met", model: "not_met" }),
  ];
  close(cohenKappa(labels)!, 0.4);
  assert.equal(cohenKappa([]), null);
  assert.equal(cohenKappa([{ human: "met", model: "met" }]), null);
});
