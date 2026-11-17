import type { UsageSummary } from "../execution/spend";
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

const BAR_WIDTH = 20;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
// Keeps a label inside one table cell or heading line.
const cell = (text: string) => text.replace(/\s+/g, " ").replace(/\|/g, "\\|");

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

/**
 * Plain Markdown for people and coding agents: one table per prompt group,
 * with an ASCII bar for the share of verified matches. Contains aggregates
 * only, never candidate identities or evidence.
 */
export function renderMarkdown(report: AggregateReport) {
  const lines = [
    `# Benchmark results: ${report.runId}`,
    "",
    `Frozen plan: \`${report.planSha256}\``,
  ];
  for (const category of new Set(report.rows.map((row) => row.category))) {
    lines.push(
      "",
      `## ${cell(category)}`,
      "",
      "| Tool | Prompts | Returned | Verified | Verified share | | Priced usage |",
      "| --- | ---: | ---: | ---: | --- | --- | ---: |"
    );
    const rows = report.rows.filter((row) => row.category === category);
    for (const toolId of new Set(rows.map((row) => row.toolId))) {
      const toolRows = rows.filter((row) => row.toolId === toolId);
      const total = pool(toolRows);
      const share = total.returned ? total.verified / total.returned : 0;
      const filled = Math.round(share * BAR_WIDTH);
      const shareCell = total.returned
        ? `${percent(share)}${total.interval ? ` (95% CI ${percent(total.interval.lower)}-${percent(total.interval.upper)})` : ""}`
        : "no results";
      const usage = `$${total.pricedUsd.toFixed(2)}${total.hasUnpriced ? " + unpriced units" : ""}`;
      lines.push(
        `| ${cell(toolId)} | ${toolRows.length} | ${total.returned} | ${total.verified} | ${shareCell} | \`${"#".repeat(filled)}${".".repeat(BAR_WIDTH - filled)}\` | ${usage} |`
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderJson(report: AggregateReport) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
