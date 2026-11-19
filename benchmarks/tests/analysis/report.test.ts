import assert from "node:assert/strict";
import test from "node:test";
import {
  renderMarkdown,
  type AggregateReport,
} from "../../core/analysis/report";
import { summarizeUsage } from "../../core/execution/spend";
import { wilson } from "../../core/analysis/stats";

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

test("Markdown charts each prompt category and never prices quota usage as zero", () => {
  const markdown = renderMarkdown(report);
  assert.ok(
    markdown.includes(
      [
        "```",
        "people-static · verified share (1 prompt)",
        "",
        "  Tool  Match rate            Score  Hits  Priced usage  95% CI",
        "  ────  ────────────────────  ─────  ────  ────────────  ─────────────",
        "  exa   ████████████████░░░░  80.0%  8/10  $0.01         49.0% - 94.3%",
        "```",
        "",
        "```",
        "company-static · verified share (1 prompt)",
        "",
        "  Tool  Match rate            Score  Hits  Priced usage            95% CI",
        "  ────  ────────────────────  ─────  ────  ──────────────────────  ──────────",
        "  clay  ░░░░░░░░░░░░░░░░░░░░    n/a  0/0   $0.00 + unpriced units  no results",
        "```",
      ].join("\n")
    )
  );
});

// Top-5 counts as in the D1 smoke report (p14, one prompt); usage left out.
const smoke: AggregateReport = {
  runId: "smoke",
  planSha256: "0".repeat(64),
  rows: (
    [
      ["apollo", 5, 0],
      ["clay", 5, 0],
      ["context", 5, 5],
      ["crustdata", 5, 4],
      ["exa", 5, 5],
      ["firecrawl", 1, 0],
      ["lusha", 5, 0],
      ["reacherx", 0, 0],
      ["reacherx_via_people", 5, 2],
      ["treg", 5, 2],
    ] as const
  ).map(([toolId, returned, verified]) => ({
    taskId: "p14",
    category: "Companies, static filters",
    entityType: "organization",
    toolId,
    returned,
    verifiedMatches: verified,
    precision: wilson(verified, returned),
    speed,
    usage: summarizeUsage([]),
  })),
};

test("each group is one block, best first, with ReacherX's rows marked", () => {
  const markdown = renderMarkdown(smoke, {
    topK: 5,
    marked: (toolId) => toolId.startsWith("reacherx"),
  });
  assert.ok(
    markdown.includes(
      [
        "```",
        "Companies, static filters · verified in top 5 (1 prompt)",
        "",
        "  Tool                 Match rate             Score  Hits  Priced usage  95% CI",
        "  ───────────────────  ────────────────────  ──────  ────  ────────────  ──────────────",
        "  context              ████████████████████  100.0%  5/5   $0.00         56.6% - 100.0%",
        "  exa                  ████████████████████  100.0%  5/5   $0.00         56.6% - 100.0%",
        "  crustdata            ████████████████░░░░   80.0%  4/5   $0.00         37.6% - 96.4%",
        "→ reacherx_via_people  ████████░░░░░░░░░░░░   40.0%  2/5   $0.00         11.8% - 76.9%",
        "  treg                 ████████░░░░░░░░░░░░   40.0%  2/5   $0.00         11.8% - 76.9%",
        "  apollo               ░░░░░░░░░░░░░░░░░░░░    0.0%  0/5   $0.00          0.0% - 43.4%",
        "  clay                 ░░░░░░░░░░░░░░░░░░░░    0.0%  0/5   $0.00          0.0% - 43.4%",
        "  firecrawl            ░░░░░░░░░░░░░░░░░░░░    0.0%  0/1   $0.00          0.0% - 79.3%",
        "  lusha                ░░░░░░░░░░░░░░░░░░░░    0.0%  0/5   $0.00          0.0% - 43.4%",
        "→ reacherx             ░░░░░░░░░░░░░░░░░░░░     n/a  0/0   $0.00         no results",
        "```",
      ].join("\n")
    )
  );
});

test("a tool on fewer of the group's prompts says so, and a pooled row claims no interval", () => {
  const row = (taskId: string, toolId: string, verified: number) => ({
    ...smoke.rows[0],
    taskId,
    toolId,
    returned: 5,
    verifiedMatches: verified,
    precision: wilson(verified, 5),
  });
  const markdown = renderMarkdown({
    ...smoke,
    rows: [row("p14", "exa", 5), row("p15", "exa", 3), row("p15", "clay", 1)],
  });
  assert.ok(
    markdown.includes(
      [
        "  Tool  Match rate            Score  Hits  Prompts         Priced usage  95% CI",
        "  ────  ────────────────────  ─────  ────  ──────────────  ────────────  ────────────",
        "  exa   ████████████████░░░░  80.0%  8/10                  $0.00",
        "  clay  ████░░░░░░░░░░░░░░░░  20.0%  1/5   1 of 2 prompts  $0.00         3.6% - 62.4%",
      ].join("\n")
    ),
    markdown
  );
});

test("people prompts are also charted together, and company prompts never join them", () => {
  const row = (
    taskId: string,
    category: string,
    entityType: "individual" | "organization",
    toolId: string,
    verified: number
  ) => ({
    ...smoke.rows[0],
    taskId,
    category,
    entityType,
    toolId,
    returned: 5,
    verifiedMatches: verified,
    precision: wilson(verified, 5),
  });
  const rows = [
    row("p01", "People, static filters", "individual", "reacherx", 4),
    row("p01", "People, static filters", "individual", "exa", 2),
    row("p08", "People, signals", "individual", "reacherx", 3),
    row("p08", "People, signals", "individual", "exa", 1),
    row("p14", "Companies, static filters", "organization", "reacherx", 5),
    row("p14", "Companies, static filters", "organization", "exa", 0),
  ];
  const markdown = renderMarkdown(
    { ...smoke, rows },
    { topK: 5, marked: (toolId) => toolId === "reacherx" }
  );
  assert.ok(
    markdown.includes(
      [
        "```",
        "People, all prompts · verified in top 5 (2 prompts)",
        "",
        "  Tool      Match rate            Score  Hits  Priced usage",
        "  ────────  ────────────────────  ─────  ────  ────────────",
        "→ reacherx  ██████████████░░░░░░  70.0%  7/10  $0.00",
        "  exa       ██████░░░░░░░░░░░░░░  30.0%  3/10  $0.00",
        "```",
      ].join("\n")
    ),
    markdown
  );
  // Before the groups it pools; each group keeps its own chart.
  assert.ok(
    markdown.indexOf("People, all prompts") <
      markdown.indexOf("People, static filters")
  );
  assert.match(markdown, /Companies, static filters · verified in top 5/);
  // One people group alone needs no pooled chart.
  assert.doesNotMatch(
    renderMarkdown({ ...smoke, rows: rows.slice(0, 2) }),
    /People, all prompts/
  );
});
