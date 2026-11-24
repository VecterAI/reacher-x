import { wilson, type ProportionEstimate } from "../../core/analysis/stats";
import type { EntityType, LearningCondition } from "../../core/types";
import type { ReplayCase, ReplayOutcome } from "../run/replay";

/**
 * Replay decisions scored against the judges' labels (proposal 4, Mistakes,
 * and 5.6). Aggregates only: no names, profiles or evidence.
 */

export type Confusion = Readonly<{
  // Accepted and a verified match, accepted but not, and so on.
  trueAccept: number;
  falseAccept: number;
  trueReject: number;
  falseReject: number;
}>;

export type ReplayScore = Readonly<{
  model: string;
  learning: LearningCondition;
  cases: number;
  errors: number;
  confusion: Confusion;
  agreement: ProportionEstimate;
  precision: ProportionEstimate;
  recall: ProportionEstimate;
  // Share of accepted candidates that are not matches, and of rejected ones that are.
  falseAcceptShare: ProportionEstimate;
  falseRejectShare: ProportionEstimate;
  // Share of decisions equal to ReacherX's decision in the original run.
  sameAsOriginal: ProportionEstimate;
  byEntityType: Readonly<
    Partial<
      Record<EntityType, { cases: number; agreement: ProportionEstimate }>
    >
  >;
  // Cost the app recorded for the replay's calls, and the key's own spend when read.
  recordedUsd: number;
  keySpendUsd: number | null;
}>;

function confusion(
  pairs: readonly { accepted: boolean; expected: boolean }[]
): Confusion {
  const count = (accepted: boolean, expected: boolean) =>
    pairs.filter(
      (pair) => pair.accepted === accepted && pair.expected === expected
    ).length;
  return {
    trueAccept: count(true, true),
    falseAccept: count(true, false),
    trueReject: count(false, false),
    falseReject: count(false, true),
  };
}

export function scoreReplay(
  cases: readonly ReplayCase[],
  outcomes: readonly ReplayOutcome[],
  meta: Readonly<{
    model: string;
    learning: LearningCondition;
    recordedUsd: number;
    keySpendUsd: number | null;
  }>
): ReplayScore {
  const byId = new Map(outcomes.map((outcome) => [outcome.caseId, outcome]));
  if (
    byId.size !== cases.length ||
    cases.some((item) => !byId.has(item.caseId))
  )
    throw new Error("Every frozen case needs exactly one replay outcome.");
  const scored = cases.flatMap((item) => {
    const outcome = byId.get(item.caseId)!;
    return outcome.status === "ok"
      ? [
          {
            item,
            accepted: outcome.result.qualified,
            expected: item.expectedMatch,
          },
        ]
      : [];
  });
  const matrix = confusion(scored);
  const accepted = matrix.trueAccept + matrix.falseAccept;
  const rejected = matrix.trueReject + matrix.falseReject;
  const agree = (rows: typeof scored) =>
    wilson(
      rows.filter((row) => row.accepted === row.expected).length,
      rows.length
    );
  const byEntityType: Partial<
    Record<EntityType, { cases: number; agreement: ProportionEstimate }>
  > = {};
  for (const type of ["individual", "organization"] as const) {
    const rows = scored.filter((row) => row.item.entityType === type);
    if (rows.length)
      byEntityType[type] = { cases: rows.length, agreement: agree(rows) };
  }
  return {
    ...meta,
    cases: cases.length,
    errors: cases.length - scored.length,
    confusion: matrix,
    agreement: agree(scored),
    precision: wilson(matrix.trueAccept, accepted),
    recall: wilson(matrix.trueAccept, matrix.trueAccept + matrix.falseReject),
    falseAcceptShare: wilson(matrix.falseAccept, accepted),
    falseRejectShare: wilson(matrix.falseReject, rejected),
    sameAsOriginal: wilson(
      scored.filter(
        (row) => row.accepted === row.item.originalDecision.qualified
      ).length,
      scored.length
    ),
    byEntityType,
  };
}

/** Decisions that changed between two replays of the same set, case by case. */
export function compareReplays(
  baseline: readonly ReplayOutcome[],
  other: readonly ReplayOutcome[]
) {
  const decided = (outcomes: readonly ReplayOutcome[]) =>
    new Map(
      outcomes.flatMap((outcome) =>
        outcome.status === "ok"
          ? [[outcome.caseId, outcome.result.qualified] as const]
          : []
      )
    );
  const left = decided(baseline);
  const right = decided(other);
  const shared = [...left.keys()].filter((caseId) => right.has(caseId));
  const changed = shared.filter(
    (caseId) => left.get(caseId) !== right.get(caseId)
  ).length;
  return { compared: shared.length, changedDecisions: changed };
}

const percent = (estimate: ProportionEstimate) =>
  estimate.trials
    ? `${((estimate.successes / estimate.trials) * 100).toFixed(1)}%${
        estimate.interval
          ? ` (${(estimate.interval.lower * 100).toFixed(1)}-${(estimate.interval.upper * 100).toFixed(1)})`
          : ""
      }`
    : "n/a";
const usd = (value: number | null) =>
  value === null ? "not read" : `$${value.toFixed(4)}`;

/** Plain Markdown for the console and private results: one column per replay. */
export function renderQuickCheckReport(
  setId: string,
  scores: readonly ReplayScore[],
  comparison?: ReturnType<typeof compareReplays>
) {
  const row = (label: string, value: (score: ReplayScore) => string) =>
    `| ${label} | ${scores.map(value).join(" | ")} |`;
  const lines = [
    `# Quick check: ${setId}`,
    "",
    "Replay decisions on frozen inputs against the judges' labels. Intervals are 95% Wilson.",
    "",
    `| Measure | ${scores.map((score) => `${score.model.replace(/\|/g, "")}, learning ${score.learning}`).join(" | ")} |`,
    `| --- |${scores.map(() => " ---: |").join("")}`,
    row("Cases", (score) => String(score.cases)),
    row("Errors", (score) => String(score.errors)),
    row("Agreement with labels", (score) => percent(score.agreement)),
    row("Precision", (score) => percent(score.precision)),
    row("Recall", (score) => percent(score.recall)),
    row("Accepted but not a match", (score) => percent(score.falseAcceptShare)),
    row("Rejected but a match", (score) => percent(score.falseRejectShare)),
    row("Same decision as the original run", (score) =>
      percent(score.sameAsOriginal)
    ),
    row("People agreement", (score) =>
      score.byEntityType.individual
        ? percent(score.byEntityType.individual.agreement)
        : "n/a"
    ),
    row("Company agreement", (score) =>
      score.byEntityType.organization
        ? percent(score.byEntityType.organization.agreement)
        : "n/a"
    ),
    row("Recorded model cost", (score) => usd(score.recordedUsd)),
    row("Key spend", (score) => usd(score.keySpendUsd)),
    row("Cost per case", (score) =>
      usd((score.keySpendUsd ?? score.recordedUsd) / Math.max(1, score.cases))
    ),
  ];
  if (comparison)
    lines.push(
      "",
      `Decisions changed between the two replays: ${comparison.changedDecisions} of ${comparison.compared}.`
    );
  return `${lines.join("\n")}\n`;
}
