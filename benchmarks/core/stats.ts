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

// One paired observation per prompt, within a category, not per candidate.
export type PromptComparison = Readonly<{
  taskId: string;
  left: number;
  right: number;
}>;

/** Contracts only; implementations must preserve the proposal's sampling units. */
export interface StatisticsEngine {
  proportion(successes: number, trials: number): ProportionEstimate;
  pairedBootstrap(
    pairs: readonly PromptComparison[],
    seed: number
  ): (Interval & { method: "paired-bootstrap" }) | null;
  holm(
    pValues: readonly { comparisonId: string; pValue: number }[]
  ): readonly { comparisonId: string; adjustedPValue: number }[];
  cohenKappa(
    labels: readonly { human: string; model: string }[]
  ): number | null;
}
