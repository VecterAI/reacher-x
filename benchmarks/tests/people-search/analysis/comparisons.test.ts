import assert from "node:assert/strict";
import test from "node:test";
import type { AggregateReport } from "../../../core/analysis/report";
import { wilson } from "../../../core/analysis/stats";
import { summarizeUsage } from "../../../core/execution/spend";
import {
  differenceChart,
  lastCycleSection,
  lastCycles,
} from "../../../people-search/analysis/comparisons";

// Synthetic figures only; not benchmark findings.
const block = (...lines: string[]) => ["```", ...lines, "```"].join("\n");

test("the tested family shows Holm p, or says it was not tested; categories show none", () => {
  const interval = {
    method: "paired-bootstrap" as const,
    confidence: 0.95 as const,
    lower: 0.1,
    upper: 0.4,
  };
  const tested = differenceChart(
    "People, all prompts · ReacherX minus tool",
    12,
    [
      {
        other: "exa",
        comparison: { prompts: 12, meanDifference: 0.25, interval },
        holmAdjustedP: 0.0123,
      },
      {
        other: "clay",
        comparison: {
          prompts: 4,
          meanDifference: -0.1,
          interval: { ...interval, lower: -0.3, upper: 0.1 },
        },
        holmAdjustedP: null,
      },
    ]
  );
  assert.equal(
    tested.join("\n"),
    block(
      "People, all prompts · ReacherX minus tool (12 prompts)",
      "  exa  ░░░░░░░░░░│███░░░░░░░  +25.0%                   95% interval +10.0% to +40.0%  Holm p 0.012",
      "  clay ░░░░░░░░░█│░░░░░░░░░░  -10.0%  4 of 12 prompts  95% interval -30.0% to +10.0%  not tested (under 6 prompts)"
    )
  );
  const described = differenceChart(
    "Companies, signals · ReacherX minus tool",
    3,
    [
      {
        other: "exa",
        comparison: { prompts: 3, meanDifference: 1, interval },
      },
    ]
  );
  assert.equal(
    described.join("\n"),
    block(
      "Companies, signals · ReacherX minus tool (3 prompts)",
      "  exa ░░░░░░░░░░│██████████  +100.0%  95% interval +10.0% to +40.0%"
    )
  );
  assert.doesNotMatch(described.join("\n"), /Holm|p /);
});

const cycleRecord = (cycle: number) => ({
  cycle,
  settledAt: 1,
  nextStartObserved: false,
});
const workspace = (
  taskId: string,
  cycles: number,
  learning: "on" | "off" = "on"
) => ({
  taskId,
  learning,
  record: {
    cycles: Array.from({ length: cycles }, (_, index) =>
      cycleRecord(index + 1)
    ),
  },
});
// ReacherX's judged top 5 for one cycle: `verified` of `judged` match.
const topFive = (
  taskId: string,
  cycle: number,
  verified: number,
  judged = 5,
  learning: "on" | "off" = "on"
) =>
  Array.from({ length: judged }, (_, index) => ({
    taskId,
    toolId: "reacherx",
    kind: "top" as const,
    learning,
    cycle,
    record: { rank: index + 1, panel: { verifiedMatch: index < verified } },
  }));
const row = (
  taskId: string,
  toolId: string,
  verified: number,
  entityType: "individual" | "organization" = "individual"
): AggregateReport["rows"][number] => ({
  taskId,
  category: "People, static filters",
  entityType,
  toolId,
  returned: 5,
  verifiedMatches: verified,
  precision: wilson(verified, 5),
  speed: {
    requestLatencyMs: 0,
    firstVerifiedMatchMs: null,
    fifthVerifiedMatchMs: null,
    activeProcessingMs: 0,
    scheduledWaitMs: 0,
  },
  usage: summarizeUsage([]),
});
const options = {
  topK: 5,
  baseline: "reacherx",
  isOwn: (toolId: string) => toolId.startsWith("reacherx"),
};

test("ReacherX's last cycle is shown beside its first, the last and never the best", () => {
  const workspaces = [
    workspace("p01", 4),
    workspace("p01", 4, "off"),
    workspace("p08", 4),
    // One cycle: no last-cycle row for it.
    workspace("p03", 1),
  ];
  const cases = [
    // p01: cycle 3 is the best, cycle 4 the last.
    ...topFive("p01", 1, 3),
    ...topFive("p01", 3, 5),
    ...topFive("p01", 4, 2),
    // Learning off never counts.
    ...topFive("p01", 4, 5, 5, "off"),
    ...topFive("p08", 1, 1),
    ...topFive("p08", 4, 3, 4),
  ];
  const rows = [
    row("p01", "reacherx", 3),
    row("p01", "exa", 4),
    row("p08", "reacherx", 1),
    row("p08", "exa", 2),
    row("p03", "reacherx", 5),
    row("p03", "exa", 0),
  ];
  assert.deepEqual(lastCycles(workspaces), [
    { taskId: "p01", cycle: 4 },
    { taskId: "p08", cycle: 4 },
  ]);
  const section = lastCycleSection(workspaces, cases, rows, options).join("\n");
  assert.ok(
    section.includes(
      block(
        "People with several cycles · verified in top 5 (2 prompts: p01, p08)",
        "  exa                 ████████████░░░░░░░░  60.0%  (6/10)",
        "→ reacherx last cycle ███████████░░░░░░░░░  55.6%  (5/9)   cycle 4",
        "→ reacherx cycle 1    ████████░░░░░░░░░░░░  40.0%  (4/10)"
      )
    ),
    section
  );
  assert.match(section, /the last, not the best/);
});

test("the last-cycle section is left out when no prompt has more than one cycle", () => {
  const unfinished = {
    ...workspace("p01", 2),
    record: {
      cycles: [
        cycleRecord(1),
        { cycle: 2, settledAt: null, nextStartObserved: false },
      ],
    },
  };
  assert.deepEqual(
    lastCycleSection(
      [workspace("p03", 1), unfinished, workspace("p08", 4, "off")],
      [...topFive("p01", 1, 1), ...topFive("p01", 2, 5)],
      [row("p01", "reacherx", 1), row("p03", "reacherx", 5)],
      options
    ),
    []
  );
});
