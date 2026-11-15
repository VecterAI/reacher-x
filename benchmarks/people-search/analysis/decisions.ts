import type { AgreementReport } from "../../core/judging/labels";
import type { DecisionPoint } from "../../core/execution/runner";
import { peopleSearchPlan } from "../setup/plan";

/**
 * Proposal 6.4: the conditions checked at each decision point. Approvals are
 * never assumed; a condition that needs the project lead stays open until
 * they decide, and the run stops there either way.
 */
// "waiting": work the decision needs is not done yet, such as human labels.
// "unknown": the measurement it needs could not be read, such as final spend.
export type ConditionStatus =
  | "pass"
  | "fail"
  | "needs-approval"
  | "waiting"
  | "unknown";
export type DecisionRow = Readonly<{
  condition: string;
  status: ConditionStatus;
  detail: string;
}>;

const row = (condition: string, ok: boolean, detail: string): DecisionRow => ({
  condition,
  status: ok ? "pass" : "fail",
  detail,
});
const approval = (condition: string, detail: string): DecisionRow => ({
  condition,
  status: "needs-approval",
  detail,
});
const waiting = (condition: string, detail: string): DecisionRow => ({
  condition,
  status: "waiting",
  detail,
});
const usd = (value: number) => `$${value.toFixed(3)}`;
const estimate = (value: number | null) =>
  value === null
    ? "unknown, because a cost it needs has no measurement yet"
    : usd(value);

export type CycleMeasurement = Readonly<{
  taskId: string;
  cycle: number;
  // The deployment key's spend for the cycle; null when it could not be read.
  costUsd: number | null;
  // From cycle start to the last qualification and lesson write.
  activeMs: number | null;
  // From the cycle's start until the next cycle started, or for the last cycle was due to.
  gapMs: number | null;
}>;

export type DecisionInputs =
  | {
      point: "D1";
      cycles: readonly CycleMeasurement[];
      recordingProblems: readonly string[];
    }
  | {
      point: "D2";
      // Null until both people have labelled the sample.
      agreement: AgreementReport | null;
      labelSheet: string;
      cycles: readonly CycleMeasurement[];
      // Null when a cost it needs has no measurement yet.
      projectedRemainingUsd: number | null;
    }
  | {
      point: "D3";
      failedChecks: readonly string[];
      pilotMatches: readonly { taskId: string; verifiedMatches: number }[];
      // Null when no cycle cost was measured.
      stage2EstimateUsd: number | null;
      // Work D3 still needs, such as the quick check or the main run's labels.
      outstanding: readonly string[];
    }
  | {
      point: "D4";
      cycles: readonly CycleMeasurement[];
      approvedCycleCostUsd: number;
      failures: readonly string[];
    };

function cycleCost(
  cycles: readonly CycleMeasurement[],
  limit: number,
  label: string
) {
  const unknown = cycles.filter((cycle) => cycle.costUsd === null);
  const highest = Math.max(...cycles.map((cycle) => cycle.costUsd ?? 0));
  return row(
    `${label} (${usd(limit)} or less)`,
    cycles.length > 0 && unknown.length === 0 && highest <= limit,
    cycles.length === 0
      ? "No cycle was measured."
      : unknown.length
        ? `${unknown.length} cycle(s) have no readable cost.`
        : `Highest cycle cost ${usd(highest)} over ${cycles.length} cycle(s).`
  );
}

export function checkDecisionPoint(
  inputs: DecisionInputs,
  // Set when the step's final spend could not be read: cost conditions are
  // then unknown, and budget decisions say so.
  spendIncomplete: string | null = null
): {
  point: DecisionPoint;
  rows: DecisionRow[];
  canContinue: boolean;
} {
  const rows: DecisionRow[] = [];
  const costRow = (item: DecisionRow): DecisionRow =>
    !spendIncomplete
      ? item
      : item.status === "needs-approval"
        ? { ...item, detail: `${item.detail} ${spendIncomplete}` }
        : { ...item, status: "unknown", detail: spendIncomplete };
  switch (inputs.point) {
    case "D1": {
      rows.push(
        costRow(
          cycleCost(
            inputs.cycles,
            peopleSearchPlan.decisionPoints.D1.maxCycleCostUsd,
            "A cycle's cost"
          )
        )
      );
      const timed = inputs.cycles.filter((cycle) => cycle.activeMs !== null);
      rows.push(
        row(
          "Starter runtime measured",
          inputs.cycles.length > 0 && timed.length === inputs.cycles.length,
          `${timed.length} of ${inputs.cycles.length} cycle(s) timed.`
        )
      );
      rows.push(
        row(
          "Everything recorded correctly",
          inputs.recordingProblems.length === 0,
          inputs.recordingProblems.join("; ") || "No problems found."
        )
      );
      break;
    }
    case "D2": {
      const minimum = peopleSearchPlan.decisionPoints.D2.minHumanAgreementKappa;
      const agreementCondition = `Judges agree with people (kappa ${minimum} or more)`;
      rows.push(
        inputs.agreement
          ? row(
              agreementCondition,
              inputs.agreement.passes &&
                inputs.agreement.minimumKappa === minimum,
              `Kappa ${inputs.agreement.kappa?.toFixed(2) ?? "undefined"} over ${inputs.agreement.labels} label(s).`
            )
          : waiting(
              agreementCondition,
              `Both people label every row of ${inputs.labelSheet}; running the pilot again then reads it.`
            )
      );
      // Learning needs the last cycle's qualification and lessons done before the next starts.
      const tight = inputs.cycles.filter(
        (cycle) =>
          cycle.activeMs === null ||
          cycle.gapMs === null ||
          cycle.activeMs > cycle.gapMs
      );
      rows.push(
        row(
          "Learning has time to happen between cycles",
          inputs.cycles.length > 0 && tight.length === 0,
          tight.length
            ? `${tight.length} cycle(s) ran past their gap or were not timed.`
            : `All ${inputs.cycles.length} cycle(s) finished within their gap.`
        )
      );
      rows.push(
        costRow(
          approval(
            "Remaining stage 1 budget and timing approved",
            `Projected from the pilot: ${estimate(inputs.projectedRemainingUsd)}.`
          )
        )
      );
      break;
    }
    case "D3": {
      rows.push(
        row(
          "Every check passed",
          inputs.failedChecks.length === 0,
          inputs.failedChecks.join("; ") || "All checks passed."
        )
      );
      const empty = inputs.pilotMatches.filter(
        (prompt) => prompt.verifiedMatches === 0
      );
      rows.push(
        row(
          "Each pilot prompt found matches",
          inputs.pilotMatches.length > 0 && empty.length === 0,
          empty.length
            ? `No verified match for prompt(s) ${empty.map((prompt) => prompt.taskId).join(", ")}.`
            : `${inputs.pilotMatches.length} pilot prompt(s) found matches.`
        )
      );
      if (inputs.outstanding.length)
        rows.push(waiting("Outstanding work", inputs.outstanding.join("; ")));
      rows.push(
        costRow(
          approval(
            "Stage 2 budget approved",
            `Estimate from measured cost: ${estimate(inputs.stage2EstimateUsd)}.`
          )
        )
      );
      break;
    }
    case "D4": {
      rows.push(
        costRow(
          cycleCost(
            inputs.cycles,
            inputs.approvedCycleCostUsd,
            "Cost per cycle on plan"
          )
        )
      );
      rows.push(
        row(
          "Nothing has failed",
          inputs.failures.length === 0,
          inputs.failures.join("; ") || "No failures."
        )
      );
      break;
    }
  }
  return {
    point: inputs.point,
    rows,
    // Even when every row passes, the run pauses for the project lead's decision.
    canContinue: rows.every(
      (item) => item.status === "pass" || item.status === "needs-approval"
    ),
  };
}

/** The one-page checkpoint report sent to the project lead at a decision point. */
export function renderDecisionReport(
  result: ReturnType<typeof checkDecisionPoint>,
  // Null when the step's final spend could not be read.
  spend: {
    stepUsd: number | null;
    cumulativeUsd: number | null;
    unpriced: readonly string[];
  }
) {
  const mark = {
    pass: "pass",
    fail: "FAIL",
    "needs-approval": "your decision",
    waiting: "waiting",
    unknown: "unknown",
  } as const;
  const spent = (value: number | null) =>
    value === null ? "unknown (a spend reading failed)" : usd(value);
  const failed = result.rows.some((item) => item.status === "fail");
  return `${[
    `# ${result.point} checkpoint`,
    "",
    `Spend this step: ${spent(spend.stepUsd)}. Total so far: ${spent(spend.cumulativeUsd)}.`,
    ...(spend.unpriced.length
      ? [`Unpriced usage: ${spend.unpriced.join(", ")}.`]
      : []),
    "",
    "| Condition | Result | Detail |",
    "| --- | --- | --- |",
    ...result.rows.map(
      (item) =>
        `| ${item.condition} | ${mark[item.status]} | ${item.detail.replace(/\|/g, "\\|").replace(/\s+/g, " ")} |`
    ),
    "",
    result.canContinue
      ? "No condition failed. The run is paused until you decide to continue, adjust or stop."
      : failed
        ? "A condition failed. The run is paused; see section 6.4 for the options."
        : "Some work or a measurement is still outstanding (marked waiting or unknown). The run is paused until it is done and you decide.",
  ].join("\n")}\n`;
}
