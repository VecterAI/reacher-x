import { chartBlock, percent, promptCount } from "../../core/analysis/bars";
import {
  lastCompletedCycle,
  MIN_TESTED_PROMPTS,
  type DescribedComparison,
} from "../../core/analysis/metrics";
import type { AggregateReport } from "../../core/analysis/report";

/**
 * ReacherX against each tool as the analysis amendment of 19 Nov 2026 sets
 * it out: every people prompt pooled into the one tested family, each
 * category described without a test, and, where ReacherX ran several cycles,
 * its last finished cycle beside its first. Pure: lines of Markdown only.
 */

const signed = (value: number) => `${value > 0 ? "+" : ""}${percent(value)}`;
const fewer = (count: number, prompts: number) =>
  count === prompts ? "" : `${count} of ${promptCount(prompts)}`;

export type Difference = Readonly<{
  other: string;
  comparison: DescribedComparison;
  // Only the tested family has this: null when it had too few prompts to test.
  holmAdjustedP?: number | null;
}>;

/** Baseline minus each tool either side of a line; a Holm column only for the tested family. */
export function differenceChart(
  title: string,
  prompts: number,
  items: readonly Difference[],
  marked: (toolId: string) => boolean = () => false
) {
  return chartBlock(
    `${title} (${promptCount(prompts)})`,
    items.map(({ other, comparison, holmAdjustedP }) => ({
      label: other,
      value: comparison.meanDifference,
      shown: signed(comparison.meanDifference),
      details: [
        fewer(comparison.prompts, prompts),
        comparison.interval
          ? `95% interval ${signed(comparison.interval.lower)} to ${signed(comparison.interval.upper)}`
          : "single observation",
        holmAdjustedP === undefined
          ? ""
          : holmAdjustedP === null
            ? `not tested (under ${MIN_TESTED_PROMPTS} prompts)`
            : `Holm p ${holmAdjustedP.toFixed(3)}`,
      ],
      marked: marked(other),
    })),
    { signed: true }
  );
}

export const TESTED_NOTE =
  "The one tested family: every people prompt together, one paired observation per prompt, Holm-corrected across the tools below only.";

export const DESCRIPTIVE_NOTE =
  "By category, descriptive only: mean difference and 95% bootstrap interval, with no p-value and no Holm correction, so no category names a winner.";

type CycleWorkspace = Readonly<{
  taskId: string;
  learning: "on" | "off" | null;
  record: Readonly<{
    cycles: readonly Readonly<{
      cycle: number;
      settledAt: number | null;
      nextStartObserved: boolean;
    }>[];
  }>;
}>;

type CycleCase = Readonly<{
  taskId: string;
  toolId: string;
  kind: "top" | "rejected";
  learning: "on" | "off" | null;
  cycle: number | null;
  record: Readonly<{ rank: number; panel: { verifiedMatch: boolean } }>;
}>;

/**
 * Each prompt whose learning-on workspace finished more than one cycle, with
 * its last finished cycle (by number, never the best). The first workspace
 * per prompt counts, as in the aggregate.
 */
export function lastCycles(workspaces: readonly CycleWorkspace[]) {
  const seen = new Set<string>();
  return workspaces.flatMap((workspace) => {
    if (workspace.learning !== "on" || seen.has(workspace.taskId)) return [];
    seen.add(workspace.taskId);
    const cycle = lastCompletedCycle(workspace.record.cycles);
    return cycle !== null && cycle > 1
      ? [{ taskId: workspace.taskId, cycle }]
      : [];
  });
}

const shareRow = (
  label: string,
  parts: readonly { returned: number; verified: number }[],
  extra: string,
  marked: boolean
) => {
  const returned = parts.reduce((sum, part) => sum + part.returned, 0);
  const verified = parts.reduce((sum, part) => sum + part.verified, 0);
  const share = returned ? verified / returned : null;
  return {
    label,
    value: share,
    shown: share === null ? "no results" : percent(share),
    details: [share === null ? "" : `(${verified}/${returned})`, extra],
    marked,
  };
};

/**
 * Descriptive only: on prompts where ReacherX ran several cycles with
 * learning on, its last finished cycle's top K next to its first cycle's
 * (the report's own ReacherX row) and the same tools on the same prompts,
 * one chart per entity type. It enters no test and changes no other figure;
 * empty when no prompt has more than one finished cycle.
 */
export function lastCycleSection(
  workspaces: readonly CycleWorkspace[],
  cases: readonly CycleCase[],
  rows: AggregateReport["rows"],
  options: Readonly<{
    topK: number;
    baseline: string;
    // ReacherX's own rows: marked, and left out of the tools compared.
    isOwn: (toolId: string) => boolean;
  }>
) {
  const last = lastCycles(workspaces);
  const entityOf = (taskId: string) =>
    rows.find((row) => row.taskId === taskId)?.entityType;
  const blocks = (["individual", "organization"] as const).flatMap(
    (entityType) => {
      const group = last
        .filter((item) => entityOf(item.taskId) === entityType)
        .sort((a, b) => a.taskId.localeCompare(b.taskId));
      if (!group.length) return [];
      const taskIds = group.map((item) => item.taskId);
      const prompts = taskIds.length;
      const onPrompts = rows.filter((row) => taskIds.includes(row.taskId));
      const cycles = group.map((item) => item.cycle);
      const [low, high] = [Math.min(...cycles), Math.max(...cycles)];
      const lastRow = shareRow(
        `${options.baseline} last cycle`,
        group.map(({ taskId, cycle }) => {
          const top = cases.filter(
            (item) =>
              item.toolId === options.baseline &&
              item.kind === "top" &&
              item.learning === "on" &&
              item.taskId === taskId &&
              item.cycle === cycle &&
              item.record.rank <= options.topK
          );
          return {
            returned: top.length,
            verified: top.filter((item) => item.record.panel.verifiedMatch)
              .length,
          };
        }),
        low === high ? `cycle ${low}` : `cycles ${low}-${high}`,
        true
      );
      const firstRow = shareRow(
        `${options.baseline} cycle 1`,
        onPrompts
          .filter((row) => row.toolId === options.baseline)
          .map((row) => ({
            returned: row.returned,
            verified: row.verifiedMatches,
          })),
        "",
        true
      );
      const tools = [...new Set(onPrompts.map((row) => row.toolId))]
        .filter((toolId) => !options.isOwn(toolId))
        .map((toolId) => {
          const toolRows = onPrompts
            .filter((row) => row.toolId === toolId)
            .map((row) => ({
              returned: row.returned,
              verified: row.verifiedMatches,
            }));
          return shareRow(
            toolId,
            toolRows,
            fewer(toolRows.length, prompts),
            false
          );
        });
      return [
        "",
        ...chartBlock(
          `${entityType === "individual" ? "People" : "Companies"} with several cycles · verified in top ${options.topK} (${promptCount(prompts)}: ${taskIds.join(", ")})`,
          [lastRow, firstRow, ...tools]
        ),
      ];
    }
  );
  return blocks.length
    ? [
        "",
        "## ReacherX's last cycle, beside its first (descriptive)",
        "",
        `Where ReacherX ran several cycles with learning on: its last finished cycle's top ${options.topK} (the last, not the best), next to its first cycle's and the same tools on the same prompts. Not tested; the comparison above stays on cycle 1 for every prompt.`,
        ...blocks,
      ]
    : [];
}
