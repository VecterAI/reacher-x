import type { BlindInput, PanelResult } from "../judging/judges";
import type { UsageSummary } from "../execution/spend";
import {
  holm,
  pairedBootstrap,
  wilson,
  type PairedComparison,
  type ProportionEstimate,
} from "./stats";
import type { BenchmarkEntity, EntityType } from "../types";

/** Proposal section 4. Every function is pure; inputs come from judged checkpoints. */

export type JudgedResult = Readonly<{
  taskId: string;
  category: string;
  toolId: string;
  // 1-based position in the tool's own ordering.
  rank: number;
  verifiedMatch: boolean;
  // Milliseconds from submitting the prompt until this result was available,
  // including planning, required lookups and scheduled waits.
  availableAfterMs: number | null;
  newestCitedEvidenceAgeDays: number | null;
}>;

const DAY_MS = 86_400_000;

function median(values: readonly number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

const groupBy = <T>(items: readonly T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    groups.set(id, [...(groups.get(id) ?? []), item]);
  }
  return groups;
};

// --- Match quality ---------------------------------------------------------

export type PromptMatches = Readonly<{
  taskId: string;
  returned: number;
  verified: number;
}>;

/**
 * Verified matches in each tool's top K for each prompt. Results ranked
 * beyond K are ignored, so every tool is compared on the same number of slots.
 */
export function matchesAtK(results: readonly JudgedResult[], topK: number) {
  return [
    ...groupBy(results, (result) => `${result.toolId}\u0000${result.taskId}`),
  ]
    .map(([, group]) => {
      const top = group.filter((result) => result.rank <= topK);
      return {
        toolId: group[0].toolId,
        category: group[0].category,
        taskId: group[0].taskId,
        returned: top.length,
        verified: top.filter((result) => result.verifiedMatch).length,
      };
    })
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        a.toolId.localeCompare(b.toolId) ||
        a.taskId.localeCompare(b.taskId, undefined, { numeric: true })
    );
}

type ComparedRow = ReturnType<typeof matchesAtK>[number];

// Baseline minus other, descriptive only: a mean and interval, never a p-value.
export type DescribedComparison = Omit<PairedComparison, "pValue">;

export type ToolComparison = Readonly<{
  category: string;
  baseline: string;
  other: string;
  // Baseline minus other: mean difference in verified share of the top-K slots.
  comparison: DescribedComparison;
}>;

export type TestedComparison = Readonly<{
  baseline: string;
  other: string;
  // Baseline minus other; pValue is null when too few prompts to test.
  comparison: PairedComparison;
  holmAdjustedP: number | null;
}>;

/**
 * Below this many prompts the pooled comparison stays descriptive. The
 * bootstrap gives p = 0 to any clean sweep however few prompts it covers,
 * while an exact sign test of a sweep first reaches p < 0.05 at 6 prompts.
 */
export const MIN_TESTED_PROMPTS = 6;

/** Each other tool's prompts paired with the baseline's, on the share of top-K slots verified. */
function pairsByTool(
  rows: readonly ComparedRow[],
  baseline: string,
  topK: number
) {
  const base = new Map(
    rows
      .filter((row) => row.toolId === baseline)
      .map((row) => [row.taskId, row.verified / topK])
  );
  const others = [
    ...new Set(
      rows.map((row) => row.toolId).filter((tool) => tool !== baseline)
    ),
  ].sort();
  return others.map((other) => ({
    other,
    pairs: rows
      .filter((row) => row.toolId === other && base.has(row.taskId))
      .map((row) => ({
        taskId: row.taskId,
        left: base.get(row.taskId)!,
        right: row.verified / topK,
      })),
  }));
}

/**
 * Paired bootstrap over the prompts both tools support within each category,
 * on the share of top-K slots holding verified matches (empty slots count as
 * misses). Descriptive only (analysis amendment, 19 Nov 2026): a mean
 * difference and its 95% interval, with no p-value and no Holm correction.
 */
export function compareToBaseline(
  rows: readonly ComparedRow[],
  baseline: string,
  topK: number,
  seed: number
): ToolComparison[] {
  return [...groupBy(rows, (row) => row.category)].flatMap(
    ([category, categoryRows]) =>
      pairsByTool(categoryRows, baseline, topK).map(({ other, pairs }) => {
        const { prompts, meanDifference, interval } = pairedBootstrap(
          pairs,
          seed
        );
        return {
          category,
          baseline,
          other,
          comparison: { prompts, meanDifference, interval },
        };
      })
  );
}

/**
 * The one tested family (analysis amendment, 19 Nov 2026): the baseline
 * against each tool over every prompt given, pooled across categories, one
 * paired observation per prompt, with Holm correction across these
 * comparisons only. A comparison over fewer than `minPrompts` prompts keeps
 * its mean and interval but is not tested.
 */
export function pooledComparison(
  rows: readonly ComparedRow[],
  baseline: string,
  topK: number,
  seed: number,
  minPrompts = MIN_TESTED_PROMPTS
): TestedComparison[] {
  const comparisons = pairsByTool(rows, baseline, topK).map(
    ({ other, pairs }) => {
      const comparison = pairedBootstrap(pairs, seed);
      return {
        baseline,
        other,
        comparison:
          comparison.prompts >= minPrompts
            ? comparison
            : { ...comparison, pValue: null },
      };
    }
  );
  const adjusted = new Map(
    holm(
      comparisons.flatMap(({ other, comparison }) =>
        comparison.pValue === null
          ? []
          : [{ comparisonId: other, pValue: comparison.pValue }]
      )
    ).map((item) => [item.comparisonId, item.adjustedPValue])
  );
  return comparisons.map((item) => ({
    ...item,
    holmAdjustedP: adjusted.get(item.other) ?? null,
  }));
}

/**
 * ReacherX's comparisons as the amendment of 19 Nov 2026 sets them: people
 * prompts (by entity type) pooled into the only tested family, and every
 * category, people or company, described on its own without a test.
 * Company prompts are never pooled with people prompts.
 */
export function comparisonFamilies(
  rows: readonly (ComparedRow & { entityType: EntityType })[],
  baseline: string,
  topK: number,
  seed: number
) {
  return {
    people: pooledComparison(
      rows.filter((row) => row.entityType === "individual"),
      baseline,
      topK,
      seed
    ),
    byCategory: compareToBaseline(rows, baseline, topK, seed),
  };
}

/**
 * The last cycle that finished (it settled, or handed over to the next),
 * by cycle number: the last, never the best. Null when none finished.
 */
export function lastCompletedCycle(
  cycles: readonly Readonly<{
    cycle: number;
    settledAt: number | null;
    nextStartObserved: boolean;
  }>[]
) {
  const finished = cycles
    .filter((cycle) => cycle.settledAt !== null || cycle.nextStartObserved)
    .map((cycle) => cycle.cycle);
  return finished.length ? Math.max(...finished) : null;
}

// --- Search quality (ReacherX) ----------------------------------------------

export type CycleSearches = Readonly<{
  taskId: string;
  learning: "on" | "off" | null;
  cycle: number;
  searches: number;
  verifiedMatches: number;
}>;

/** Verified matches per search, cycle by cycle; a cycle with no searches is reported, not divided. */
export function searchQuality(cycles: readonly CycleSearches[]) {
  return [...cycles]
    .sort(
      (a, b) =>
        a.taskId.localeCompare(b.taskId, undefined, { numeric: true }) ||
        String(a.learning).localeCompare(String(b.learning)) ||
        a.cycle - b.cycle
    )
    .map((cycle) => ({
      ...cycle,
      matchesPerSearch: cycle.searches
        ? cycle.verifiedMatches / cycle.searches
        : null,
    }));
}

// --- Mistakes (ReacherX scoring step) ----------------------------------------

/**
 * Wrong acceptances among judged qualified results (score at or above the
 * threshold) and wrong rejections among the judged random rejected sample.
 */
export function scoringMistakes(
  qualified: readonly Pick<JudgedResult, "verifiedMatch">[],
  rejectedSample: readonly Pick<JudgedResult, "verifiedMatch">[]
): { acceptedWrong: ProportionEstimate; rejectedRight: ProportionEstimate } {
  return {
    acceptedWrong: wilson(
      qualified.filter((result) => !result.verifiedMatch).length,
      qualified.length
    ),
    rejectedRight: wilson(
      rejectedSample.filter((result) => result.verifiedMatch).length,
      rejectedSample.length
    ),
  };
}

// --- Freshness ---------------------------------------------------------------

/**
 * Age in days, at the reference date, of the newest dated evidence the panel
 * cited for a criterion it finally marked met. Null when nothing cited is dated.
 */
export function newestCitedEvidenceAgeDays(
  input: BlindInput,
  panel: PanelResult
) {
  const decidedBy = (criterionId: string) => {
    const [a, b] = panel.primary.map((judgment) =>
      judgment.criteria.find((item) => item.criterionId === criterionId)
    );
    if (a?.verdict === b?.verdict) return [a, b];
    return [
      panel.tieBreaker?.criteria.find(
        (item) => item.criterionId === criterionId
      ),
    ];
  };
  const cited = new Set(
    Object.entries(panel.verdicts)
      .filter(([, verdict]) => verdict === "met")
      .flatMap(([criterionId]) =>
        decidedBy(criterionId).flatMap((item) => item?.evidenceIds ?? [])
      )
  );
  const reference = Date.parse(input.referenceDate);
  const ages = input.entity.evidence
    .filter((item) => cited.has(item.id) && item.publishedAt)
    .map((item) => (reference - Date.parse(item.publishedAt!)) / DAY_MS);
  return ages.length ? Math.min(...ages) : null;
}

export function freshness(results: readonly JudgedResult[]) {
  const matches = results.filter((result) => result.verifiedMatch);
  const ages = matches.flatMap((result) =>
    result.newestCitedEvidenceAgeDays === null
      ? []
      : [result.newestCitedEvidenceAgeDays]
  );
  return {
    verifiedMatches: matches.length,
    withDatedEvidence: ages.length,
    medianAgeDays: median(ages),
  };
}

// --- Speed -------------------------------------------------------------------

/** Time until the k-th result later verified as a match became available, or null if never. */
export function timeToVerified(results: readonly JudgedResult[], k: number) {
  const times = results
    .filter(
      (result) => result.verifiedMatch && result.availableAfterMs !== null
    )
    .map((result) => result.availableAfterMs!)
    .sort((a, b) => a - b);
  return times[k - 1] ?? null;
}

/** Per-prompt times to the first and fifth verified match; unreached targets are counted, not dropped. */
export function speed(results: readonly JudgedResult[]) {
  const prompts = [...groupBy(results, (result) => result.taskId).values()];
  const summarize = (k: number) => {
    const times = prompts.map((group) => timeToVerified(group, k));
    const reached = times.filter((time): time is number => time !== null);
    return {
      medianMs: median(reached),
      reached: reached.length,
      unreached: times.length - reached.length,
    };
  };
  return { prompts: prompts.length, first: summarize(1), fifth: summarize(5) };
}

// --- Cost --------------------------------------------------------------------

/**
 * Usage cost at recorded non-sponsored rates per verified match. Unpriced
 * credit units are listed beside it, never valued at zero; cash after grants
 * is reported separately.
 */
export function costPerVerifiedMatch(
  usage: UsageSummary,
  verifiedMatches: number
) {
  return {
    pricedUsdPerMatch: verifiedMatches
      ? usage.pricedUsageUsd / verifiedMatches
      : null,
    complete: usage.unpricedUsage.length === 0,
    unpricedUsage: usage.unpricedUsage,
    knownCashUsd: usage.knownCashUsd,
    cashComplete: usage.cashComplete,
  };
}

// --- Profile data (ReacherX matches) -----------------------------------------

const PROFILE_FIELDS = {
  individual: ["profileUrl", "location", "description", "title", "employer"],
  organization: [
    "profileUrl",
    "location",
    "description",
    "domain",
    "industry",
    "employeeCount",
  ],
} as const;

/** Share of profile fields present across matches. Accuracy is graded by the judges, not here. */
export function profileCompleteness(entities: readonly BenchmarkEntity[]) {
  let present = 0;
  let total = 0;
  for (const entity of entities) {
    const fields: readonly string[] = PROFILE_FIELDS[entity.prospectType];
    total += fields.length;
    present += fields.filter(
      (field) => (entity as Record<string, unknown>)[field] != null
    ).length;
  }
  return {
    entities: entities.length,
    fieldShare: total ? present / total : null,
  };
}

// --- Self-improvement --------------------------------------------------------

/** Verified matches with learning on minus off, paired by prompt. */
export function selfImprovement(
  prompts: readonly { taskId: string; on: number; off: number }[],
  seed: number
) {
  return {
    perPrompt: prompts.map((prompt) => ({
      taskId: prompt.taskId,
      difference: prompt.on - prompt.off,
    })),
    overall: pairedBootstrap(
      prompts.map((prompt) => ({
        taskId: prompt.taskId,
        left: prompt.on,
        right: prompt.off,
      })),
      seed
    ),
  };
}
