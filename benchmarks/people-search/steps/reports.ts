import { z } from "zod";
import {
  compareToBaseline,
  freshness,
  scoringMistakes,
  selfImprovement,
  timeToVerified,
  type JudgedResult,
} from "../../core/analysis/metrics";
import {
  renderMarkdown,
  type AggregateReport,
} from "../../core/analysis/report";
import { wilson } from "../../core/analysis/stats";
import {
  priceUsage,
  type RateSnapshot,
  type UsageUnits,
} from "../../core/calls/rates";
import { summarizeUsage } from "../../core/execution/spend";
import { cycleMeasurements } from "../../core/execution/workspaceRun";
import { flagRepeats } from "../../core/judging/identity";
import type { AgreementReport } from "../../core/judging/labels";
import {
  checkDecisionPoint,
  renderDecisionReport,
  type CycleMeasurement,
  type DecisionInputs,
} from "../analysis/decisions";
import { peopleSearchPlan } from "../setup/plan";
import { SEGMENTS } from "../setup/schedule";
import { toolCatalog } from "../tools/catalog";
import {
  competitorOutcomeSchema,
  translationOutcomeSchema,
} from "./competitors";
import { judgedCaseSchema, type JudgedCase } from "./judging";
import {
  accountReadingSchema,
  workspaceOutcomeSchema,
  type WorkspaceOutcome,
} from "./workspaces";

/**
 * Proposal 5.3 step 5: what a segment produced, its report and, at a
 * decision point, the one-page checkpoint report. Everything here is private
 * (it names results); public output takes aggregates only.
 */

const agreementSchema: z.ZodType<AgreementReport> = z.object({
  labels: z.number(),
  kappa: z.number().nullable(),
  perLabeller: z.array(
    z.object({
      labeller: z.string(),
      labels: z.number(),
      kappa: z.number().nullable(),
    })
  ),
  betweenLabellers: z
    .object({ cases: z.number(), kappa: z.number().nullable() })
    .nullable(),
  minimumKappa: z.number(),
  passes: z.boolean(),
});

const decisionSchema = z.object({
  point: z.enum(["D1", "D2", "D3", "D4"]),
  rows: z.array(
    z.object({
      condition: z.string(),
      status: z.enum(["pass", "fail", "needs-approval", "waiting", "unknown"]),
      detail: z.string(),
    })
  ),
  canContinue: z.boolean(),
});
export type Decision = z.infer<typeof decisionSchema>;

/** A segment's results, kept in its private run folder for later segments and reruns. */
export const segmentOutcomeSchema = z.object({
  segment: z.enum(SEGMENTS),
  runId: z.string(),
  // "complete" once every scheduled unit has finished or is held for review.
  status: z.enum(["complete", "interrupted", "budget-stop", "halted"]),
  stopReason: z.string().nullable(),
  // Production parity and pool limits the live session confirmed, last time it opened.
  settings: z
    .object({
      production: z.record(z.string(), z.string()),
      productionSource: z.string(),
      runOnly: z.record(z.string(), z.string()),
      poolLimits: z.record(z.string(), z.number()),
      linkdApiCircuitReset: z.boolean(),
      // Keyword post-search LinkdAPI calls allowed per workspace cycle; null
      // for none. Absent in outcomes recorded before the cap existed.
      keywordPostSearchLimit: z.number().nullable().optional(),
    })
    .nullable(),
  stage2: z
    .object({ staticPrompts: z.number(), cyclesPerWorkspace: z.number() })
    .nullable(),
  units: z.object({ executed: z.number(), reused: z.number() }),
  workspaces: z.array(workspaceOutcomeSchema),
  translations: z.array(
    translationOutcomeSchema.omit({ modelExchanges: true })
  ),
  competitors: z.array(
    competitorOutcomeSchema.omit({ exchanges: true, modelExchanges: true })
  ),
  cases: z.array(judgedCaseSchema),
  review: z.array(z.object({ unitId: z.string(), reason: z.string() })),
  notReached: z.number().int(),
  accounts: z
    .object({
      start: z.array(accountReadingSchema),
      // Null while the closing read has failed: the step's costs are incomplete.
      end: z.array(accountReadingSchema).nullable(),
      // Spend of accounts only the benchmark uses, since the step first started.
      spent: z.record(z.string(), z.number()).nullable(),
      // Every account's balance change; for a shared key it includes production's use.
      balanceChange: z.record(z.string(), z.number()).nullable(),
      // Keys shared with production (X and LinkedIn).
      shared: z.array(z.string()),
    })
    .nullable(),
  labels: z
    .object({
      sheetPath: z.string(),
      bookletPath: z.string(),
      cases: z.number(),
      agreement: agreementSchema.nullable(),
    })
    .nullable(),
  decision: decisionSchema.nullable(),
  // Judged-result units the segment scheduled; null when judging never started.
  judgeTargets: z.array(z.string()).nullable().default(null),
  // Dollars this segment spent: unshared accounts' own spend, X data by the
  // deployment's records, and Exa's reported cost; null while incomplete.
  stepUsd: z.number().nullable(),
});
export type SegmentOutcome = z.infer<typeof segmentOutcomeSchema>;
type CompetitorSummary = SegmentOutcome["competitors"][number];

export type ReportContext = Readonly<{
  planSha256: string;
  seed: number;
  rates: RateSnapshot;
  // Earlier segments' outcomes, in run order.
  earlier: readonly SegmentOutcome[];
  // From the stage 2 approvals: the cycle cost stage 2's budget assumed.
  plannedCycleCostUsd: number | null;
}>;

const promptOf = (taskId: string) =>
  peopleSearchPlan.prompts.find(
    (prompt) => `p${String(prompt.id).padStart(2, "0")}` === taskId
  )!;
const categoryOf = (taskId: string) =>
  peopleSearchPlan.categories[promptOf(taskId).category];
const money = (value: number | null) =>
  value === null ? "unknown" : `$${value.toFixed(3)}`;
const minutes = (ms: number | null) =>
  ms === null ? "unknown" : `${(ms / 60_000).toFixed(1)} min`;
const mean = (values: readonly number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
const cell = (text: string) => text.replace(/\s+/g, " ").replace(/\|/g, "\\|");

export function cyclesOf(
  workspaces: readonly WorkspaceOutcome[]
): CycleMeasurement[] {
  return workspaces.flatMap((item) =>
    cycleMeasurements(item.taskId, item.record)
  );
}

function accountUsed(
  outcome: WorkspaceOutcome,
  prefix: "socialapi:" | "renidly:"
) {
  const find = (readings: WorkspaceOutcome["accountsBefore"]) =>
    readings.find((reading) => reading.accountId.startsWith(prefix));
  const before = find(outcome.accountsBefore);
  const after = find(outcome.accountsAfter);
  return before && after ? before.available - after.available : null;
}

/** X and LinkedIn use the deployment recorded for a workspace, in provider units. */
function dataUsage(outcome: WorkspaceOutcome, share = 1): UsageUnits[] {
  const { costs, linkdApi } = outcome.record.recorded;
  return [
    ...(costs
      ? [
          {
            provider: "socialapi",
            unit: "tweet-or-user",
            quantity: (costs.providers.socialapi?.billableUnits ?? 0) / share,
            reportedUsd: null,
          },
        ]
      : []),
    ...(linkdApi
      ? [
          {
            provider: "renidly",
            unit: "credit",
            quantity: linkdApi.billableUnits / share,
            reportedUsd: null,
          },
        ]
      : []),
  ];
}

/**
 * ReacherX's cost for one workspace: AI spend from the deployment key, which
 * is not shared with production, and X and LinkedIn use from the
 * deployment's own records, priced at the frozen rates (LinkedIn credits stay
 * units). The X and LinkedIn balance changes are kept apart: those keys are
 * production's too, so a change is not this workspace's cost.
 */
export function workspaceCosts(outcome: WorkspaceOutcome, rates: RateSnapshot) {
  const { atSubmitUsd, afterUsd } = outcome.record.spend;
  const { costs, linkdApi } = outcome.record.recorded;
  const x = priceUsage(
    dataUsage(outcome).filter((item) => item.provider === "socialapi"),
    rates
  )[0];
  return {
    openRouterUsd:
      atSubmitUsd !== null && afterUsd !== null ? afterUsd - atSubmitUsd : null,
    xItems: costs ? (costs.providers.socialapi?.billableUnits ?? 0) : null,
    xUsd: x?.valuation.status === "priced" ? x.valuation.normalUsd : null,
    linkedInCredits: linkdApi?.billableUnits ?? null,
    // The app's records stop at a read limit; a capped record undercounts.
    recordsCapped: Boolean(costs?.capped || linkdApi?.capped),
    xBalanceChange: accountUsed(outcome, "socialapi:"),
    linkedInBalanceChange: accountUsed(outcome, "renidly:"),
  };
}

/**
 * Usage for ReacherX's first cycle on a prompt, the stage 1 comparison unit:
 * the cycle's AI spend (including setup), and the X and LinkedIn use the
 * deployment recorded for the workspace, split evenly over its cycles when it
 * ran several.
 */
function reacherxUsage(outcome: WorkspaceOutcome): UsageUnits[] {
  const [first] = cycleMeasurements(outcome.taskId, outcome.record);
  const share = Math.max(outcome.record.cycles.length, 1);
  return [
    ...(first?.costUsd != null
      ? [
          {
            provider: "openrouter",
            unit: "usd",
            quantity: first.costUsd,
            reportedUsd: first.costUsd,
          },
        ]
      : []),
    ...dataUsage(outcome, share),
  ];
}

const judgedRow = (item: JudgedCase): JudgedResult => ({
  taskId: item.taskId,
  category: categoryOf(item.taskId).label,
  toolId: item.toolId,
  rank: item.record.rank,
  verifiedMatch: item.record.panel.verifiedMatch,
  availableAfterMs: item.availableAfterMs,
  newestCitedEvidenceAgeDays: item.record.newestCitedEvidenceAgeDays,
});

/**
 * The stage 1 comparison set: every competitor result, and ReacherX's first
 * cycle with learning on (a single cycle for most prompts; for the pilot
 * prompts, the first cycle of their learning-on workspace).
 */
function comparisonCases(outcomes: readonly SegmentOutcome[]) {
  return outcomes
    .flatMap((outcome) => outcome.cases)
    .filter(
      (item) =>
        item.kind === "top" &&
        (item.toolId !== "reacherx" ||
          (item.cycle === 1 && item.learning !== "off"))
    );
}

function aggregate(
  runId: string,
  context: ReportContext,
  outcomes: readonly SegmentOutcome[]
): AggregateReport {
  const cases = comparisonCases(outcomes);
  const workspaces = outcomes.flatMap((outcome) => outcome.workspaces);
  const competitors = outcomes.flatMap((outcome) => outcome.competitors);
  // Every completed search is a row, so a tool that found nothing reports 0.
  const keys = [
    ...new Set([
      ...competitors.map((item) => `${item.taskId}\u0000${item.toolId}`),
      ...workspaces
        .filter((item) => item.learning === "on")
        .map((item) => `${item.taskId}\u0000reacherx`),
      ...cases.map((item) => `${item.taskId}\u0000${item.toolId}`),
    ]),
  ].sort();
  return {
    runId,
    planSha256: context.planSha256,
    rows: keys.map((key) => {
      const [taskId, toolId] = key.split("\u0000");
      const results = cases
        .filter((item) => item.taskId === taskId && item.toolId === toolId)
        .map(judgedRow);
      const top = results.filter(
        (result) => result.rank <= peopleSearchPlan.headlineTopK
      );
      const verified = top.filter((result) => result.verifiedMatch).length;
      const workspace = workspaces.find(
        (item) => item.taskId === taskId && item.learning === "on"
      );
      const competitor = competitors.find(
        (item) => item.taskId === taskId && item.toolId === toolId
      );
      const firstCycle = workspace
        ? cycleMeasurements(taskId, workspace.record)[0]
        : null;
      const usage =
        toolId === "reacherx"
          ? workspace
            ? reacherxUsage(workspace)
            : []
          : (competitor?.usage ?? []);
      return {
        taskId,
        category: categoryOf(taskId).label,
        entityType: categoryOf(taskId).entityType,
        toolId,
        returned: top.length,
        verifiedMatches: verified,
        precision: wilson(verified, top.length),
        speed: {
          requestLatencyMs:
            toolId === "reacherx"
              ? workspace
                ? workspace.record.startedAt - workspace.record.submittedAt
                : 0
              : (competitor?.requestLatencyMs ?? 0),
          firstVerifiedMatchMs: timeToVerified(results, 1),
          fifthVerifiedMatchMs: timeToVerified(results, 5),
          activeProcessingMs:
            toolId === "reacherx"
              ? (firstCycle?.activeMs ??
                (workspace
                  ? workspace.record.endedAt - workspace.record.startedAt
                  : 0))
              : (competitor?.completedAfterMs ?? 0),
          scheduledWaitMs: 0,
        },
        usage: summarizeUsage(priceUsage(usage, context.rates)),
      };
    }),
  };
}

function comparisonTable(
  context: ReportContext,
  outcomes: readonly SegmentOutcome[],
  report: AggregateReport
) {
  if (!report.rows.some((row) => row.toolId === "reacherx")) return [];
  // From the report's rows, so a search with no results counts as 0 verified.
  const comparisons = compareToBaseline(
    report.rows.map((row) => ({
      toolId: row.toolId,
      category: row.category,
      taskId: row.taskId,
      returned: row.returned,
      verified: row.verifiedMatches,
    })),
    "reacherx",
    peopleSearchPlan.headlineTopK,
    context.seed
  );
  const tenTools = toolCatalog
    .filter((tool) => tool.judgedTopK === 10)
    .map((tool): string => tool.id);
  const cases = comparisonCases(outcomes).map(judgedRow);
  const atTen = outcomes
    .flatMap((outcome) => outcome.competitors)
    .filter((item) => tenTools.includes(item.toolId))
    .map((item) => {
      const judged = cases.filter(
        (result) =>
          result.taskId === item.taskId &&
          result.toolId === item.toolId &&
          result.rank <= 10
      );
      return {
        category: categoryOf(item.taskId).label,
        toolId: item.toolId,
        returned: judged.length,
        verified: judged.filter((result) => result.verifiedMatch).length,
      };
    });
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  return [
    "",
    "## ReacherX against each tool (top 5, paired by prompt)",
    "",
    "| Group | Tool | Prompts | ReacherX minus tool | 95% interval | Holm p |",
    "| --- | --- | ---: | ---: | --- | ---: |",
    ...comparisons.map(
      (item) =>
        `| ${cell(item.category)} | ${item.other} | ${item.comparison.prompts} | ${pct(item.comparison.meanDifference)} | ${
          item.comparison.interval
            ? `${pct(item.comparison.interval.lower)} to ${pct(item.comparison.interval.upper)}`
            : "single observation"
        } | ${item.holmAdjustedP?.toFixed(3) ?? "-"} |`
    ),
    ...(atTen.length
      ? [
          "",
          "Top 10, where judged:",
          "",
          "| Group | Tool | Prompts | Verified of returned |",
          "| --- | --- | ---: | ---: |",
          ...[
            ...new Set(
              atTen.map((row) => `${row.category}\u0000${row.toolId}`)
            ),
          ].map((key) => {
            const [category, toolId] = key.split("\u0000");
            const rows = atTen.filter(
              (row) => row.category === category && row.toolId === toolId
            );
            const returned = rows.reduce((sum, row) => sum + row.returned, 0);
            const verified = rows.reduce((sum, row) => sum + row.verified, 0);
            return `| ${cell(category)} | ${toolId} | ${rows.length} | ${verified} of ${returned} |`;
          }),
        ]
      : []),
  ];
}

function qualityTable(outcomes: readonly SegmentOutcome[]) {
  const cases = comparisonCases(outcomes);
  const tools = [...new Set(cases.map((item) => item.toolId))].sort();
  const repeats = new Map<string, number>();
  for (const taskId of new Set(cases.map((item) => item.taskId)))
    for (const flag of flagRepeats(
      cases
        .filter((item) => item.taskId === taskId)
        .map((item) => ({
          toolId: item.toolId,
          resultId: item.unitId,
          entity: item.record.input.entity,
        }))
    )) {
      const owner = cases.find((item) => item.unitId === flag.resultId)!;
      repeats.set(owner.toolId, (repeats.get(owner.toolId) ?? 0) + 1);
    }
  if (!tools.length) return [];
  return [
    "",
    "## Freshness and repeats",
    "",
    "| Tool | Verified matches | With dated evidence | Median evidence age | Also returned by another tool |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...tools.map((toolId) => {
      const fresh = freshness(
        cases.filter((item) => item.toolId === toolId).map(judgedRow)
      );
      return `| ${toolId} | ${fresh.verifiedMatches} | ${fresh.withDatedEvidence} | ${
        fresh.medianAgeDays === null
          ? "-"
          : `${fresh.medianAgeDays.toFixed(0)} days`
      } | ${repeats.get(toolId) ?? 0} |`;
    }),
  ];
}

type LearningCase = Pick<
  JudgedCase,
  "unitId" | "taskId" | "toolId" | "kind" | "learning" | "cycle"
> & { record: { panel: { verifiedMatch: boolean } } };

const LEARNING_UNIT = /^(?:w|j-reacherx)-(p\d+)-(on|off)(?:-|$)/;

/**
 * Learning on against off, prompt by prompt (proposal section 4). A condition
 * counts once its workspace completed, every result it had to judge was
 * judged, and none of its units is held for review; its verified matches are
 * then summed over cycles, 0 when there are none (a genuine empty search).
 * A condition held for review, never run, or not yet fully judged is left out
 * of the pairs and listed instead. `judgeTargets` is every judged-result unit
 * the segment scheduled, or null when judging never started.
 */
export function learningPairs(
  workspaces: readonly Pick<WorkspaceOutcome, "taskId" | "learning">[],
  cases: readonly LearningCase[],
  review: readonly Pick<SegmentOutcome["review"][number], "unitId">[],
  judgeTargets: readonly string[] | null
) {
  const judged = new Set(cases.map((item) => item.unitId));
  const conditions = ["on", "off"] as const;
  const held = (taskId: string, learning: string) =>
    review.some((item) => {
      const unit = LEARNING_UNIT.exec(item.unitId);
      return unit?.[1] === taskId && unit[2] === learning;
    });
  const ran = (taskId: string, learning: string) =>
    workspaces.some(
      (item) => item.taskId === taskId && item.learning === learning
    );
  const prompts = [
    ...new Set([
      ...workspaces.map((item) => item.taskId),
      ...review.flatMap((item) => LEARNING_UNIT.exec(item.unitId)?.[1] ?? []),
    ]),
  ].sort();
  const verified = (taskId: string, learning: string) =>
    cases.filter(
      (item) =>
        item.toolId === "reacherx" &&
        item.kind === "top" &&
        item.taskId === taskId &&
        item.learning === learning &&
        item.record.panel.verifiedMatch
    ).length;
  const pairs: { taskId: string; on: number; off: number }[] = [];
  const incomplete: { taskId: string; learning: string; reason: string }[] = [];
  const missing = (taskId: string, learning: string) => {
    if (held(taskId, learning)) return "held for review";
    if (!ran(taskId, learning)) return "not run";
    if (judgeTargets === null) return "not judged yet";
    const targets = judgeTargets.filter((id) =>
      id.startsWith(`j-reacherx-${taskId}-${learning}-`)
    );
    const done = targets.filter((id) => judged.has(id)).length;
    if (done < targets.length)
      return done === 0 ? "not judged yet" : "partly judged";
    return null;
  };
  for (const taskId of prompts) {
    const reasons = conditions.map((learning) => ({
      learning,
      reason: missing(taskId, learning),
    }));
    if (reasons.every((item) => item.reason === null))
      pairs.push({
        taskId,
        on: verified(taskId, "on"),
        off: verified(taskId, "off"),
      });
    for (const { learning, reason } of reasons)
      if (reason) incomplete.push({ taskId, learning, reason });
  }
  return { pairs, incomplete };
}

/** Proposal section 4 for ReacherX's multi-cycle workspaces: cycle by cycle, learning on against off, and scoring mistakes. */
function learningSection(outcome: SegmentOutcome, context: ReportContext) {
  // The rest of stage 2 judges its first third's workspaces too.
  const first =
    outcome.segment === "stage2-rest"
      ? context.earlier.filter((item) => item.segment === "stage2-first")
      : [];
  const workspaces = [
    ...first.flatMap((item) => item.workspaces),
    ...outcome.workspaces,
  ];
  const review = [...first.flatMap((item) => item.review), ...outcome.review];
  const cases = outcome.cases.filter((item) => item.toolId === "reacherx");
  const top = cases.filter((item) => item.kind === "top");
  const rejected = cases.filter((item) => item.kind === "rejected");
  if (!workspaces.length) return [];
  const { pairs, incomplete } = learningPairs(
    workspaces,
    cases,
    review,
    outcome.judgeTargets
  );
  const lines = [
    "",
    "## ReacherX cycle by cycle (its top 5 per cycle)",
    "",
    "| Prompt | Learning | Cycle | Judged | Verified |",
    "| --- | --- | ---: | ---: | ---: |",
    // Every completed cycle is a row, so one that found nothing shows 0.
    ...workspaces.flatMap((workspace) =>
      workspace.record.cycles.map((cycle) => {
        const rows = top.filter(
          (item) =>
            item.taskId === workspace.taskId &&
            item.learning === workspace.learning &&
            item.cycle === cycle.cycle
        );
        return `| ${workspace.taskId} | ${workspace.learning} | ${cycle.cycle} | ${rows.length} | ${rows.filter((item) => item.record.panel.verifiedMatch).length} |`;
      })
    ),
  ];
  if (pairs.length) {
    const improvement = selfImprovement(pairs, context.seed);
    lines.push(
      "",
      "Learning on minus off, verified matches summed over cycles:",
      "",
      ...improvement.perPrompt.map(
        (item) =>
          `- ${item.taskId}: ${item.difference >= 0 ? "+" : ""}${item.difference}`
      ),
      `- Overall mean: ${improvement.overall.meanDifference.toFixed(2)}${
        improvement.overall.interval
          ? ` (95% interval ${improvement.overall.interval.lower.toFixed(2)} to ${improvement.overall.interval.upper.toFixed(2)})`
          : " (single observation, descriptive)"
      }`
    );
  }
  if (incomplete.length)
    lines.push(
      "",
      "Left out of the comparison (incomplete):",
      ...incomplete.map(
        (item) => `- ${item.taskId} learning ${item.learning}: ${item.reason}`
      )
    );
  const mistakes = scoringMistakes(
    top.map((item) => item.record.panel),
    rejected.map((item) => item.record.panel)
  );
  const share = (estimate: typeof mistakes.acceptedWrong) =>
    `${estimate.successes} of ${estimate.trials}${
      estimate.interval
        ? ` (95% interval ${(estimate.interval.lower * 100).toFixed(0)}-${(estimate.interval.upper * 100).toFixed(0)}%)`
        : ""
    }`;
  lines.push(
    "",
    `Scoring mistakes: accepted but not a verified match ${share(mistakes.acceptedWrong)}; rejected but a verified match ${share(mistakes.rejectedRight)}.`
  );
  return lines;
}

/** Problems a decision point must see: units held for review and workspaces that did not end as planned. */
function problemsOf(outcome: SegmentOutcome) {
  return [
    ...outcome.review.map((item) => `${item.unitId}: ${item.reason}`),
    ...outcome.workspaces
      .filter((item) => item.record.ending !== "planned-cycles")
      .map(
        (item) =>
          `${item.label} ended ${item.record.ending}${item.record.detail ? ` (${item.record.detail})` : ""}`
      ),
    // A continued cycle is measured across two attempts, so a decision must see it.
    ...outcome.workspaces
      .filter((item) => item.record.resumed?.length)
      .map(
        (item) =>
          `${item.label} was ${resumedLabel(item.record.resumed!)}; its cycle cost and active time combine the attempts (see the report)`
      ),
  ];
}

const stopName = (ending: string) =>
  ending === "budget-stop" ? "a budget stop" : `an ending of ${ending}`;

/** "resumed after a budget stop", for tables and decision notes. */
function resumedLabel(
  resumed: NonNullable<WorkspaceOutcome["record"]["resumed"]>
) {
  const first = resumed[0];
  return `resumed after ${first.after === "interrupted" ? "an interruption" : stopName(first.after)}${
    resumed.length > 1 ? ` (${resumed.length} continuations)` : ""
  }`;
}

const difference = (to: number | null, from: number | null) =>
  to !== null && from !== null ? to - from : null;
const sumKnown = (values: readonly (number | null)[]) =>
  values.some((value) => value === null)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);

/**
 * How a continued workspace's spend splits between its attempts: AI on the
 * deployment key before the stop (with setup), between the stop and the
 * resume, and in each continuation, and the LinkedIn credits and X items the
 * deployment recorded before the stop and since. All on the same cycle; no
 * discovery cycle starts in a continuation.
 */
function resumedLines(outcome: SegmentOutcome) {
  return outcome.workspaces.flatMap((item) => {
    const resumed = item.record.resumed;
    if (!resumed?.length) return [];
    const { spend, recorded } = item.record;
    const first = resumed[0];
    const beforeStop = difference(first.spend.atStopUsd, spend.atSubmitUsd);
    const between = sumKnown(
      resumed.map((entry) =>
        difference(entry.spend.atResumeUsd, entry.spend.atStopUsd)
      )
    );
    const continued = sumKnown(
      resumed.map((entry) =>
        difference(entry.spend.afterUsd, entry.spend.atResumeUsd)
      )
    );
    const combined = difference(spend.afterUsd, spend.atSubmitUsd);
    const credits = (value: number | null) =>
      value === null ? "unknown" : String(value);
    const creditsAtStop = first.recordedAtStop.linkdApi?.billableUnits ?? null;
    const creditsTotal = recorded.linkdApi?.billableUnits ?? null;
    const xAtStop =
      first.recordedAtStop.costs?.providers.socialapi?.billableUnits ?? null;
    const xTotal = recorded.costs
      ? (recorded.costs.providers.socialapi?.billableUnits ?? 0)
      : null;
    const pausedMs = resumed.reduce(
      (sum, entry) => sum + (entry.resumedAt - entry.stoppedAt),
      0
    );
    return [
      `- ${item.label}: ${resumedLabel(resumed)} (${(first.afterDetail ?? "no detail").replace(/\.$/, "")}). The same workspace continued the same cycle: pending prospects were qualified, qualified ones enriched and lessons written. No new discovery cycle started${
        first.discoveryCompleted
          ? "."
          : "; discovery had been cut off by the stop and was not repeated."
      } ${
        resumed.at(-1)!.ending === "planned-cycles"
          ? "The continuation settled."
          : `The continuation ended ${resumed.at(-1)!.ending}.`
      }`,
      `  - AI on the deployment key: ${money(beforeStop)} before the stop (with setup), ${money(between)} between the stop and the resume, ${money(continued)} in the continuation; combined for the workspace ${money(combined)} (the resumed cycle's own cost is in the cycle table).`,
      `  - LinkedIn credits (recorded): ${credits(creditsAtStop)} before the stop, ${credits(difference(creditsTotal, creditsAtStop))} since, ${credits(creditsTotal)} combined. X items (recorded): ${credits(xAtStop)} before the stop, ${credits(difference(xTotal, xAtStop))} since, ${credits(xTotal)} combined.`,
      `  - Time: ${minutes(first.stoppedAt - item.record.startedAt)} from the start to the stop, ${minutes(resumed.reduce((sum, entry) => sum + (entry.endedAt - entry.resumedAt), 0))} in the continuation; active time leaves out the ${minutes(pausedMs)} the workspace stood stopped.`,
    ];
  });
}

const knownCosts = (outcomes: readonly SegmentOutcome[]) =>
  cyclesOf(outcomes.flatMap((outcome) => outcome.workspaces)).flatMap(
    (cycle) => (cycle.costUsd === null ? [] : [cycle.costUsd])
  );

function competitorUsd(
  competitors: readonly CompetitorSummary[],
  rates: RateSnapshot
) {
  return summarizeUsage(
    priceUsage(
      competitors.flatMap((item) => item.usage),
      rates
    )
  ).pricedUsageUsd;
}

/** D2's projection of the rest of stage 1 from what the smoke test and pilot measured. */
function projectMainRun(outcome: SegmentOutcome, context: ReportContext) {
  const outcomes = [...context.earlier, outcome];
  const perCycle = mean(knownCosts(outcomes));
  const smoke = context.earlier.find((item) => item.segment === "smoke");
  const smokePrompts = new Set(smoke?.competitors.map((item) => item.taskId))
    .size;
  const perPrompt =
    smoke && smokePrompts
      ? competitorUsd(smoke.competitors, context.rates) / smokePrompts
      : null;
  const judged = outcomes.flatMap((item) => item.cases);
  const perCase = mean(
    judged.flatMap((item) =>
      item.record.panel.costUsd === null ? [] : [item.record.panel.costUsd]
    )
  );
  const mainPrompts = peopleSearchPlan.prompts.length - 1 - 2;
  const competitorPrompts = peopleSearchPlan.prompts.length - 1;
  const competitorResults = toolCatalog
    .filter((tool) => tool.id !== "reacherx")
    .reduce((sum, tool) => sum + tool.judgedTopK, 0);
  const mainCases =
    mainPrompts *
      (peopleSearchPlan.headlineTopK +
        peopleSearchPlan.judging.rejectedSamplePerPromptCycle) +
    competitorPrompts * competitorResults;
  const parts = [
    {
      label: `${mainPrompts} first cycles`,
      usd: perCycle === null ? null : perCycle * mainPrompts,
    },
    {
      label: `${competitorPrompts} competitor prompts`,
      usd: perPrompt === null ? null : perPrompt * competitorPrompts,
    },
    {
      label: `about ${mainCases} judged results`,
      usd: perCase === null ? null : perCase * mainCases,
    },
  ];
  // Unknown when any part has no measurement yet; a missing part is never $0.
  return {
    usd: parts.some((part) => part.usd === null)
      ? null
      : parts.reduce((sum, part) => sum + (part.usd ?? 0), 0),
    detail: parts.map((part) => `${part.label}: ${money(part.usd)}`).join("; "),
  };
}

/** The decision point a segment ends at, from its results and the earlier segments'. */
export function decide(
  outcome: SegmentOutcome,
  context: ReportContext,
  point: DecisionInputs["point"] | null
) {
  if (!point || outcome.status !== "complete") return null;
  const ownCycles = cyclesOf(outcome.workspaces);
  let inputs: DecisionInputs;
  switch (point) {
    case "D1": {
      const problems = problemsOf(outcome);
      for (const workspace of outcome.workspaces) {
        const task = promptOf(workspace.taskId);
        if (
          peopleSearchPlan.categories[task.category].entityType !==
          "organization"
        )
          continue;
        const organizations = outcome.cases.filter(
          (item) =>
            item.toolId === "reacherx" &&
            item.taskId === workspace.taskId &&
            item.kind === "top" &&
            item.record.input.entity.prospectType === "organization"
        );
        if (!organizations.length)
          problems.push(
            `ReacherX returned no qualified organization for ${workspace.taskId}; check its organization result path.`
          );
        const costs = workspaceCosts(workspace, context.rates);
        for (const [label, value] of [
          ["AI spend", costs.openRouterUsd],
          ["X data use", costs.xItems],
          ["LinkedIn credit use", costs.linkedInCredits],
        ] as const)
          if (value === null)
            problems.push(
              `${workspace.label}: ${label} could not be measured.`
            );
        if (costs.recordsCapped)
          problems.push(
            `${workspace.label}: the deployment's usage records hit their read limit, so X or LinkedIn use is undercounted.`
          );
      }
      inputs = { point, cycles: ownCycles, recordingProblems: problems };
      break;
    }
    case "D2":
      inputs = {
        point,
        agreement: outcome.labels?.agreement ?? null,
        labelSheet: outcome.labels?.sheetPath ?? "the pilot's label sheet",
        cycles: ownCycles,
        projectedRemainingUsd: projectMainRun(outcome, context).usd,
      };
      break;
    case "D3": {
      const earlierFails = context.earlier.flatMap((item) =>
        (item.decision?.rows ?? [])
          .filter((row) => row.status === "fail")
          .map((row) => `${item.decision!.point}: ${row.condition}`)
      );
      const pilot = context.earlier.find((item) => item.segment === "pilot");
      const pilotTasks = [
        ...new Set(pilot?.workspaces.map((item) => item.taskId)),
      ];
      const perCycle = mean(knownCosts([...context.earlier, outcome]));
      const { stage2 } = peopleSearchPlan;
      const maxCycles =
        stage2.peoplePrompts.max *
        stage2.cyclesPerWorkspace.max *
        stage2.learningConditions.length;
      const agreement = outcome.labels?.agreement;
      inputs = {
        point,
        failedChecks: [
          ...earlierFails,
          ...problemsOf(outcome),
          ...(agreement && !agreement.passes
            ? [
                `Judges agree with the main run's labels (kappa ${agreement.kappa?.toFixed(2) ?? "undefined"})`,
              ]
            : []),
        ],
        pilotMatches: pilotTasks.map((taskId) => ({
          taskId,
          verifiedMatches: (pilot?.cases ?? []).filter(
            (item) =>
              item.toolId === "reacherx" &&
              item.taskId === taskId &&
              item.kind === "top" &&
              item.record.panel.verifiedMatch
          ).length,
        })),
        stage2EstimateUsd: perCycle === null ? null : perCycle * maxCycles,
        outstanding: [
          "The quick check of the current model against a cheaper one (pnpm benchmark --model <id>)",
          ...(agreement
            ? []
            : [
                `Both people label ${outcome.labels?.sheetPath ?? "the main run's label sheet"}`,
              ]),
        ],
      };
      break;
    }
    case "D4":
      inputs = {
        point,
        cycles: ownCycles,
        approvedCycleCostUsd:
          context.plannedCycleCostUsd ??
          peopleSearchPlan.decisionPoints.D1.maxCycleCostUsd,
        failures: problemsOf(outcome),
      };
      break;
  }
  return checkDecisionPoint(
    inputs,
    outcome.accounts?.end === null
      ? "The step's closing spend could not be read; run the step again to read it before deciding."
      : null
  );
}

function unpricedOf(outcome: SegmentOutcome, rates: RateSnapshot) {
  const items = new Map<string, number>();
  const add = (label: string, quantity: number) =>
    items.set(label, (items.get(label) ?? 0) + quantity);
  for (const item of summarizeUsage(
    priceUsage(
      [
        ...outcome.competitors.flatMap((competitor) => competitor.usage),
        ...outcome.workspaces.flatMap((workspace) => dataUsage(workspace)),
      ],
      rates
    )
  ).unpricedUsage)
    add(`${item.provider} ${item.unit}`, item.quantity);
  const searches = outcome.cases.reduce(
    (sum, item) => sum + (item.record.webEvidence?.searchesUsed ?? 0),
    0
  );
  if (searches) add("tavily search", searches);
  return [...items].map(
    ([label, quantity]) => `${Number(quantity.toFixed(2))} ${label}`
  );
}

/** The decision page, with this segment's spend and the total so far. */
export function renderDecision(
  outcome: SegmentOutcome,
  context: ReportContext
) {
  if (!outcome.decision) return null;
  const steps = [...context.earlier, outcome].map((item) => item.stepUsd);
  return renderDecisionReport(outcome.decision, {
    stepUsd: outcome.stepUsd,
    cumulativeUsd: steps.some((value) => value === null)
      ? null
      : steps.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    unpriced: unpricedOf(outcome, context.rates),
  });
}

/** Whether the development-only keyword post-search cap was in force for the step. */
export function keywordSearchCapLine(
  outcome: Pick<SegmentOutcome, "settings">
) {
  const limit = outcome.settings?.keywordPostSearchLimit;
  if (limit === undefined)
    return "Keyword post-search cap: not recorded for this step.";
  if (limit === null)
    return "Keyword post-search cap: none; no limit was in force for this step.";
  return `Keyword post-search cap: in force for this step, at most ${limit} LinkdAPI calls per workspace cycle for enrichment's search of each LinkedIn prospect's own posts for finance keywords (development-only BENCHMARK_KEYWORD_POST_SEARCH_LIMIT). Searches past it stopped early, so some enriched prospects show fewer finance posts than production would; discovery, profile and company reads and qualification were not capped.`;
}

// The decision behind the development-only match limit.
const MATCH_LIMIT_AGREEMENT = "agreed by the project lead, 17 Nov 2026";
const MATCH_LIMIT_HOW = `applied through the plan-limit gate (${MATCH_LIMIT_AGREEMENT}; development-only BENCHMARK_MATCH_LIMIT_PER_CYCLE)`;

const describeMatchLimit = (limit: number | null) =>
  limit === null ? "no match limit" : `match limit ${limit} per cycle`;
const dayOf = (time: number) =>
  new Date(time).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * The match limit in force from a workspace's start, then in each
 * continuation. Records made before the limit existed carry none, because
 * none could apply.
 */
function matchLimitPhases(record: WorkspaceOutcome["record"]) {
  return {
    start: record.matchLimitPerCycle ?? null,
    continuations: (record.resumed ?? []).map((entry) => ({
      limit: entry.matchLimitPerCycle ?? null,
      resumedAt: entry.resumedAt,
    })),
  };
}

/** One workspace's match limit, naming each continuation that changed it. */
function workspaceMatchLimit(record: WorkspaceOutcome["record"]) {
  const { start, continuations } = matchLimitPhases(record);
  const changes = continuations.filter(
    (phase, index) =>
      phase.limit !== (index ? continuations[index - 1].limit : start)
  );
  if (!changes.length) return `${describeMatchLimit(start)} throughout`;
  const cycles =
    record.cycles.length === 1
      ? "its cycle"
      : `its ${record.cycles.length} cycles`;
  return [
    `${describeMatchLimit(start)} during ${cycles}`,
    ...changes.map(
      (phase) =>
        `${describeMatchLimit(phase.limit)} from the ${dayOf(phase.resumedAt)} resume`
    ),
  ].join("; ");
}

/**
 * The match limit per cycle the step's workspaces ran with. One line when
 * every workspace ran with the same value throughout; otherwise per
 * workspace, so no line claims a limit for a cycle that ran without it.
 */
export function matchLimitLines(outcome: Pick<SegmentOutcome, "workspaces">) {
  const limits = new Set(
    outcome.workspaces.flatMap((item) => {
      const { start, continuations } = matchLimitPhases(item.record);
      return [start, ...continuations.map((phase) => phase.limit)];
    })
  );
  if (limits.size <= 1) {
    const [limit = null] = limits;
    if (limit === null)
      return [
        "Match limit: none; only the plan's own limit applied in this step.",
      ];
    return [
      `Match limit: ${limit} per cycle, ${MATCH_LIMIT_HOW}. Once a workspace's cycle had ${limit} matches, qualifying its other prospects was parked as at a plan limit; qualifications already running finished, so a cycle can hold a few more. Only the cycle's first ${limit} matches were enriched. Cycles still started and were scheduled as usual, each counting from zero.`,
    ];
  }
  return [
    `Match limit: not the same for every workspace run, so stated per workspace. Where in force it was ${MATCH_LIMIT_HOW}: once a cycle had that many matches, qualifying its other prospects was parked as at a plan limit, qualifications already running finished, and only the cycle's first matches up to the limit were enriched.`,
    ...outcome.workspaces.map(
      (item) => `- ${item.label}: ${workspaceMatchLimit(item.record)}.`
    ),
  ];
}

/** Markdown for the console and the private run folder. */
export function renderSegmentReport(
  outcome: SegmentOutcome,
  context: ReportContext
) {
  const lines = [
    `# Step ${outcome.segment}: ${outcome.status}`,
    "",
    `Run ${outcome.runId}, frozen plan \`${context.planSha256}\`.`,
    `Units: ${outcome.units.executed} run now, ${outcome.units.reused} reused, ${outcome.review.length} held for review, ${outcome.notReached} not reached.`,
  ];
  if (outcome.stopReason) lines.push(`Stopped: ${outcome.stopReason}`);
  if (outcome.review.length)
    lines.push(
      "",
      "Held for review (never repeated automatically):",
      ...outcome.review.map((item) => `- ${item.unitId}: ${item.reason}`)
    );
  if (outcome.accounts) {
    const { start, end, spent, balanceChange, shared } = outcome.accounts;
    const show = (accountId: string, value: number | undefined) =>
      value === undefined
        ? "-"
        : accountId.startsWith("renidly:")
          ? `${value.toFixed(0)} credits`
          : `$${value.toFixed(3)}`;
    lines.push(
      "",
      "## Spend",
      "",
      "| Account | Available at start | Available now | Spent this step | Balance change |",
      "| --- | ---: | ---: | ---: | ---: |",
      ...start.map((first) => {
        const id = first.accountId;
        const now = end?.find((item) => item.accountId === id);
        return `| ${id} | ${show(id, first.available)} | ${end ? show(id, now?.available) : "unreadable"} | ${
          shared.includes(id)
            ? "from the deployment's records"
            : spent
              ? show(id, spent[id])
              : "unknown"
        } | ${balanceChange ? show(id, balanceChange[id]) : "unknown"}${shared.includes(id) ? " (shared with production)" : ""} |`;
      }),
      ...(end === null
        ? [
            "",
            "The closing balance read failed, so this step's costs are incomplete. Run the step again to read them; cost-based decisions wait until then.",
          ]
        : []),
      ...[...start, ...(end ?? [])].flatMap((reading) =>
        reading.note ? [`- ${reading.accountId}: ${reading.note}`] : []
      ),
      "",
      "X and LinkedIn keys are shared with production, so their balance change is not ReacherX's cost; ReacherX's X and LinkedIn use below comes from the deployment's own records."
    );
  }
  const harnessUsd = outcome.translations.reduce(
    (sum, item) => sum + (item.costUsd ?? 0),
    0
  );
  const judgeUsd = outcome.cases.reduce(
    (sum, item) => sum + (item.record.panel.costUsd ?? 0),
    0
  );
  if (outcome.translations.length || outcome.cases.length)
    lines.push(
      "",
      `Harness filter step: ${money(harnessUsd)} over ${outcome.translations.length} prompt(s). Judges: ${money(judgeUsd)} over ${outcome.cases.length} result(s). Competitor priced usage: ${money(competitorUsd(outcome.competitors, context.rates))}.`
    );
  if (outcome.workspaces.length) {
    lines.push(
      "",
      "## ReacherX workspaces",
      "",
      keywordSearchCapLine(outcome),
      "",
      ...matchLimitLines(outcome),
      "",
      "| Workspace | Ending | Cycles | AI spend (key) | X data (recorded) | LinkedIn credits (recorded) | X / LinkedIn balance change (shared keys) | Qualified of prospects |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
      ...outcome.workspaces.map((item) => {
        const costs = workspaceCosts(item, context.rates);
        const qualified = item.record.prospects.filter(
          (prospect) => prospect.qualificationStatus === "qualified"
        ).length;
        const x =
          costs.xItems === null
            ? "unknown"
            : `${costs.xItems} items, ${costs.xUsd === null ? "unpriced" : money(costs.xUsd)}`;
        const ending = item.record.resumed?.length
          ? `${item.record.ending} (${resumedLabel(item.record.resumed)})`
          : item.record.ending;
        return `| ${item.label} | ${ending} | ${item.record.cycles.length}/${item.record.plannedCycles} | ${money(costs.openRouterUsd)} | ${x}${costs.recordsCapped ? " (capped)" : ""} | ${costs.linkedInCredits ?? "unknown"} | ${money(costs.xBalanceChange)} / ${costs.linkedInBalanceChange ?? "unknown"} | ${qualified} of ${item.record.prospects.length} |`;
      }),
      "",
      "| Prompt | Learning | Cycle | Cost | Active | Start to next start |",
      "| --- | --- | ---: | ---: | ---: | ---: |",
      ...outcome.workspaces.flatMap((item) =>
        cycleMeasurements(item.taskId, item.record).map(
          (cycle) =>
            `| ${cycle.taskId} | ${item.learning} | ${cycle.cycle}${
              item.record.resumed?.length &&
              cycle.cycle === item.record.cycles.length
                ? " (resumed)"
                : ""
            } | ${money(cycle.costUsd)} | ${minutes(cycle.activeMs)} | ${minutes(cycle.gapMs)} |`
        )
      )
    );
    const resumed = resumedLines(outcome);
    if (resumed.length)
      lines.push(
        "",
        "Resumed workspaces (spend before and after the stop, combined):",
        "",
        ...resumed
      );
  }
  const compared = comparedOutcomes(outcome, context);
  if (outcome.segment === "smoke" || outcome.segment === "main") {
    const report = aggregate(outcome.runId, context, compared);
    if (report.rows.length)
      lines.push(
        "",
        renderMarkdown(report)
          .trimEnd()
          .replace(
            /^# .*\n\nFrozen plan: .*$/m,
            "## Verified matches in each tool's top 5"
          ),
        ...comparisonTable(context, compared, report),
        ...qualityTable(compared)
      );
  }
  if (outcome.workspaces.some((item) => item.record.plannedCycles > 1))
    lines.push(...learningSection(outcome, context));
  if (outcome.decision && outcome.segment === "pilot")
    lines.push(
      "",
      `Projection for the rest of stage 1: ${projectMainRun(outcome, context).detail}.`
    );
  if (outcome.labels)
    lines.push(
      "",
      `Human labels: ${outcome.labels.cases} case(s) in ${outcome.labels.bookletPath}; record yes or no in ${outcome.labels.sheetPath}.`
    );
  return `${lines.join("\n")}\n`;
}

/** Aggregates only, for the private results folder; public output is built from these. */
export function aggregateReport(
  outcome: SegmentOutcome,
  context: ReportContext
) {
  return aggregate(outcome.runId, context, comparedOutcomes(outcome, context));
}

/**
 * The outcomes a segment's aggregate covers: the main run brings in stage 1's
 * smoke test and pilot; the rest of stage 2 its first third (whose workspaces
 * it judged), and never stage 1.
 */
function comparedOutcomes(outcome: SegmentOutcome, context: ReportContext) {
  if (outcome.segment === "main") return [...context.earlier, outcome];
  if (outcome.segment === "stage2-rest")
    return [
      ...context.earlier.filter((item) => item.segment === "stage2-first"),
      outcome,
    ];
  return [outcome];
}
