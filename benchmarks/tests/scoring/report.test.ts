import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdown, type AggregateReport } from "../../core/report";
import { summarizeUsage } from "../../core/spend";
import { wilson } from "../../core/stats";

const speed = {
  requestLatencyMs: 1000,
  firstVerifiedMatchMs: null,
  fifthVerifiedMatchMs: null,
  activeProcessingMs: 1000,
  scheduledWaitMs: 0,
};

// Synthetic aggregates only; not benchmark findings.
const report: AggregateReport = {
  runId: "synthetic",
  planSha256: "0".repeat(64),
  rows: [
    {
      taskId: "1",
      category: "people-static",
      entityType: "individual",
      toolId: "exa",
      returned: 10,
      verifiedMatches: 8,
      precision: wilson(8, 10),
      speed,
      usage: summarizeUsage([
        {
          provider: "exa",
          quantity: 1,
          unit: "search",
          valuation: { status: "priced", normalUsd: 0.007, rateReference: "r" },
          funding: { grantUnitsUsed: null, cashUsd: 0.007 },
        },
      ]),
    },
    {
      taskId: "14",
      category: "company-static",
      entityType: "organization",
      toolId: "clay",
      returned: 0,
      verifiedMatches: 0,
      precision: wilson(0, 0),
      speed,
      usage: summarizeUsage([
        {
          provider: "clay",
          quantity: 5,
          unit: "result",
          valuation: { status: "unpriced", reason: "quota" },
          funding: { grantUnitsUsed: 5, cashUsd: null },
        },
      ]),
    },
  ],
};

test("Markdown groups by prompt category and never prices quota usage as zero", () => {
  const markdown = renderMarkdown(report);
  assert.match(
    markdown,
    /## people-static[\s\S]*\| exa \| 1 \| 10 \| 8 \| 80\.0% \(95% CI 49\.0%-94\.3%\)/
  );
  assert.match(markdown, /`################\.\.\.\.`/);
  assert.match(
    markdown,
    /## company-static[\s\S]*\| clay \| 1 \| 0 \| 0 \| no results/
  );
  assert.match(markdown, /\$0\.00 \+ unpriced units/);
});
