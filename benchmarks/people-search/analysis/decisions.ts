import type { AgreementReport } from "../../core/judging/labels";
import type { DecisionPoint } from "../../core/execution/runner";
import { peopleSearchPlan } from "../setup/plan";

/**
 * Proposal 6.4: the conditions checked at each decision point. Approvals are
 * never assumed; a condition that needs the project lead stays open until
 * they decide, and the run stops there either way.
 */
export type ConditionStatus = "pass" | "fail" | "needs-approval";
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
const usd = (value: number) => `$${value.toFixed(3)}`;

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
      agreement: AgreementReport;
      cycles: readonly CycleMeasurement[];
      projectedRemainingUsd: number;
    }
  | {
      point: "D3";
      failedChecks: readonly string[];
      pilotMatches: readonly { taskId: string; verifiedMatches: number }[];
      stage2EstimateUsd: number;
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

export function checkDecisionPoint(inputs: DecisionInputs): {
  point: DecisionPoint;
  rows: DecisionRow[];
  canContinue: boolean;
} {
  const rows: DecisionRow[] = [];
  switch (inputs.point) {
    case "D1": {
      rows.push(
        cycleCost(
          inputs.cycles,
          peopleSearchPlan.decisionPoints.D1.maxCycleCostUsd,
          "A cycle's cost"
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
      rows.push(
        row(
          `Judges agree with people (kappa ${minimum} or more)`,
          inputs.agreement.passes && inputs.agreement.minimumKappa === minimum,
          `Kappa ${inputs.agreement.kappa?.toFixed(2) ?? "undefined"} over ${inputs.agreement.labels} label(s).`
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
        approval(
          "Remaining stage 1 budget and timing approved",
          `Projected from the pilot: ${usd(inputs.projectedRemainingUsd)}.`
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
      rows.push(
        approval(
          "Stage 2 budget approved",
          `Estimate from measured cost: ${usd(inputs.stage2EstimateUsd)}.`
        )
      );
      break;
    }
    case "D4": {
      rows.push(
        cycleCost(
          inputs.cycles,
          inputs.approvedCycleCostUsd,
          "Cost per cycle on plan"
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
    canContinue: rows.every((item) => item.status !== "fail"),
  };
}

/** The one-page checkpoint report sent to the project lead at a decision point. */
export function renderDecisionReport(
  result: ReturnType<typeof checkDecisionPoint>,
  spend: { stepUsd: number; cumulativeUsd: number; unpriced: readonly string[] }
) {
  const mark = {
    pass: "pass",
    fail: "FAIL",
    "needs-approval": "your decision",
  } as const;
  return `${[
    `# ${result.point} checkpoint`,
    "",
    `Spend this step: ${usd(spend.stepUsd)}. Total so far: ${usd(spend.cumulativeUsd)}.`,
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
      : "A condition failed. The run is paused; see section 6.4 for the options.",
  ].join("\n")}\n`;
}
