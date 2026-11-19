import type { UsageSummary } from "../execution/spend";
import {
  chartBlock,
  percent,
  promptCount,
  wilsonText,
  type ChartRow,
} from "./bars";
import type { ProportionEstimate } from "./stats";
import type { EntityType } from "../types";

export type SpeedObservation = Readonly<{
  requestLatencyMs: number;
  firstVerifiedMatchMs: number | null;
  fifthVerifiedMatchMs: number | null;
  activeProcessingMs: number;
  scheduledWaitMs: number;
}>;

/** Public output contains aggregates, never candidate identities or evidence text. */
export type AggregateReport = Readonly<{
  runId: string;
  planSha256: string;
  rows: readonly {
    taskId: string;
    category: string;
    entityType: EntityType;
    toolId: string;
    returned: number;
    verifiedMatches: number;
    precision: ProportionEstimate;
    speed: SpeedObservation;
    usage: UsageSummary;
  }[];
}>;

// Keeps a label on its chart's title line.
const oneLine = (text: string) => text.replace(/\s+/g, " ");

function pool(rows: AggregateReport["rows"]) {
  const returned = rows.reduce((sum, row) => sum + row.returned, 0);
  const verified = rows.reduce((sum, row) => sum + row.verifiedMatches, 0);
  return {
    returned,
    verified,
    // A pooled interval over several prompts would treat candidates as
    // independent; comparisons come from the paired bootstrap instead.
    interval: rows.length === 1 ? rows[0].precision.interval : null,
    pricedUsd: rows.reduce((sum, row) => sum + row.usage.pricedUsageUsd, 0),
    hasUnpriced: rows.some((row) => row.usage.unpricedUsage.length > 0),
  };
}

export type MarkdownOptions = Readonly<{
  // The rank cut-off the verified share counts within, named in each title.
  topK?: number;
  // Rows to mark with an arrow: the benchmarked product's own.
  marked?: (toolId: string) => boolean;
}>;

/**
 * Plain Markdown for people and coding agents: one bar chart per prompt
 * group (see bars.ts), tools best first by their share of verified matches.
 * Contains aggregates only, never candidate identities or evidence.
 */
export function renderMarkdown(
  report: AggregateReport,
  options: MarkdownOptions = {}
) {
  const lines = [
    `# Benchmark results: ${report.runId}`,
    "",
    `Frozen plan: \`${report.planSha256}\``,
  ];
  const measure = options.topK ? `in top ${options.topK}` : "share";
  const chart = (label: string, rows: AggregateReport["rows"]) => {
    const prompts = new Set(rows.map((row) => row.taskId)).size;
    const tools = [...new Set(rows.map((row) => row.toolId))].map(
      (toolId): ChartRow => {
        const toolRows = rows.filter((row) => row.toolId === toolId);
        const total = pool(toolRows);
        const share = total.returned ? total.verified / total.returned : null;
        return {
          label: toolId,
          value: share,
          shown: share === null ? "no results" : percent(share),
          details: [
            share === null ? "" : `(${total.verified}/${total.returned})`,
            toolRows.length === prompts
              ? ""
              : `${toolRows.length} of ${promptCount(prompts)}`,
            total.interval ? wilsonText(total.interval) : "",
            `$${total.pricedUsd.toFixed(2)}${total.hasUnpriced ? " + unpriced units" : ""}`,
          ],
          marked: options.marked?.(toolId),
        };
      }
    );
    lines.push(
      "",
      ...chartBlock(
        `${oneLine(label)} · verified ${measure} (${promptCount(prompts)})`,
        tools
      )
    );
  };
  // Every people prompt together, as the one tested comparison pools them
  // (analysis amendment, 19 Nov 2026); company prompts are never pooled.
  const people = report.rows.filter((row) => row.entityType === "individual");
  if (new Set(people.map((row) => row.category)).size > 1)
    chart("People, all prompts", people);
  for (const category of new Set(report.rows.map((row) => row.category)))
    chart(
      category,
      report.rows.filter((row) => row.category === category)
    );
  if (report.rows.length)
    lines.push(
      "",
      "Each row: verified share, verified of returned, the 95% CI for a tool on a single prompt, and priced usage."
    );
  return `${lines.join("\n")}\n`;
}

export function renderJson(report: AggregateReport) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
