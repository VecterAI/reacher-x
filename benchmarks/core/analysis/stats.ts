/**
 * Statistics from proposal section 5.7. Wilson intervals are for binary
 * proportions only. Comparisons resample prompts (one paired value per prompt,
 * within a category or a pooled family), never individual candidates. Fewer than two prompts is a
 * single observation and stays descriptive.
 */

import { seededRandom } from "../random";

export type Interval = Readonly<{
  lower: number;
  upper: number;
  confidence: 0.95;
}>;

export type ProportionEstimate = Readonly<{
  successes: number;
  trials: number;
  interval: (Interval & { method: "wilson" }) | null;
}>;

// One paired observation per prompt, not per candidate.
export type PromptComparison = Readonly<{
  taskId: string;
  left: number;
  right: number;
}>;

export type PairedComparison = Readonly<{
  prompts: number;
  meanDifference: number;
  interval: (Interval & { method: "paired-bootstrap" }) | null;
  pValue: number | null;
}>;

const Z_95 = 1.959963984540054;
export const DEFAULT_BOOTSTRAP_RESAMPLES = 10_000;

function assertCount(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${label} must be a nonnegative integer.`);
}

export function wilson(successes: number, trials: number): ProportionEstimate {
  assertCount(successes, "Successes");
  assertCount(trials, "Trials");
  if (successes > trials) throw new Error("Successes cannot exceed trials.");
  if (trials === 0) return { successes, trials, interval: null };
  const p = successes / trials;
  const z2 = Z_95 * Z_95;
  const denominator = 1 + z2 / trials;
  const centre = (p + z2 / (2 * trials)) / denominator;
  const margin =
    (Z_95 * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) /
    denominator;
  return {
    successes,
    trials,
    interval: {
      method: "wilson",
      confidence: 0.95,
      lower: Math.max(0, centre - margin),
      upper: Math.min(1, centre + margin),
    },
  };
}

function quantile(sorted: readonly number[], q: number) {
  const position = (sorted.length - 1) * q;
  const below = Math.floor(position);
  const above = Math.ceil(position);
  return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
}

/** Mean left-minus-right difference over prompts, with a percentile interval and two-sided p-value. */
export function pairedBootstrap(
  pairs: readonly PromptComparison[],
  seed: number,
  resamples = DEFAULT_BOOTSTRAP_RESAMPLES
): PairedComparison {
  if (!Number.isSafeInteger(resamples) || resamples < 1)
    throw new Error("Bootstrap resamples must be a positive integer.");
  if (new Set(pairs.map((pair) => pair.taskId)).size !== pairs.length)
    throw new Error("Each prompt contributes one paired observation.");
  const differences = pairs.map((pair) => pair.left - pair.right);
  if (differences.some((value) => !Number.isFinite(value)))
    throw new Error("Paired values must be finite.");
  const mean = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  if (differences.length < 2)
    return {
      prompts: differences.length,
      meanDifference: differences.length ? differences[0] : 0,
      interval: null,
      pValue: null,
    };
  const random = seededRandom(seed);
  const means: number[] = [];
  for (let i = 0; i < resamples; i++) {
    let sum = 0;
    for (let j = 0; j < differences.length; j++)
      sum += differences[Math.floor(random() * differences.length)];
    means.push(sum / differences.length);
  }
  means.sort((a, b) => a - b);
  const atOrBelowZero = means.filter((value) => value <= 0).length;
  const atOrAboveZero = means.filter((value) => value >= 0).length;
  return {
    prompts: differences.length,
    meanDifference: mean(differences),
    interval: {
      method: "paired-bootstrap",
      confidence: 0.95,
      lower: quantile(means, 0.025),
      upper: quantile(means, 0.975),
    },
    pValue: Math.min(
      1,
      (2 * Math.min(atOrBelowZero, atOrAboveZero)) / resamples
    ),
  };
}

/** Holm step-down adjustment across a family of comparisons. */
export function holm(
  pValues: readonly { comparisonId: string; pValue: number }[]
): readonly { comparisonId: string; adjustedPValue: number }[] {
  if (pValues.some(({ pValue }) => !(pValue >= 0 && pValue <= 1)))
    throw new Error("P-values must lie between 0 and 1.");
  if (
    new Set(pValues.map(({ comparisonId }) => comparisonId)).size !==
    pValues.length
  )
    throw new Error("Each comparison needs a unique ID.");
  const ordered = [...pValues].sort((a, b) => a.pValue - b.pValue);
  let running = 0;
  const adjusted = new Map<string, number>();
  ordered.forEach(({ comparisonId, pValue }, index) => {
    running = Math.max(running, Math.min(1, (ordered.length - index) * pValue));
    adjusted.set(comparisonId, running);
  });
  return pValues.map(({ comparisonId }) => ({
    comparisonId,
    adjustedPValue: adjusted.get(comparisonId) ?? 1,
  }));
}

/** Agreement between human and judge labels beyond chance. Null when undefined. */
export function cohenKappa(
  labels: readonly { human: string; model: string }[]
): number | null {
  if (labels.length === 0) return null;
  const categories = new Set(
    labels.flatMap(({ human, model }) => [human, model])
  );
  const observed =
    labels.filter(({ human, model }) => human === model).length / labels.length;
  let expected = 0;
  for (const category of categories) {
    const human =
      labels.filter((label) => label.human === category).length / labels.length;
    const model =
      labels.filter((label) => label.model === category).length / labels.length;
    expected += human * model;
  }
  return expected === 1 ? null : (observed - expected) / (1 - expected);
}
