import assert from "node:assert/strict";
import test from "node:test";
import {
  BAR_WIDTH,
  bar,
  chartBlock,
  signedBar,
  wilsonText,
} from "../../core/analysis/bars";
import { wilson } from "../../core/analysis/stats";

test("a bar fills round(share × 20) of its 20 characters", () => {
  assert.equal(bar(0), "░".repeat(20));
  assert.equal(bar(1), "█".repeat(20));
  assert.equal(bar(0.4), `${"█".repeat(8)}${"░".repeat(12)}`);
  // 6.6 rounds up, 0.4 down and 0.6 up.
  assert.equal(bar(0.33), `${"█".repeat(7)}${"░".repeat(13)}`);
  assert.equal(bar(0.02), "░".repeat(20));
  assert.equal(bar(0.03), `█${"░".repeat(19)}`);
  for (const share of [0, 0.02, 0.33, 0.4, 1])
    assert.equal(bar(share).length, BAR_WIDTH);
});

test("a signed bar fills away from the centre line, half the width each side", () => {
  assert.equal(signedBar(0), "░░░░░░░░░░│░░░░░░░░░░");
  assert.equal(signedBar(-0.56), "░░░░██████│░░░░░░░░░░");
  assert.equal(signedBar(0.4), "░░░░░░░░░░│████░░░░░░");
  assert.equal(signedBar(-1), "██████████│░░░░░░░░░░");
  // Under half a cell shows as no difference.
  assert.equal(signedBar(-0.029), signedBar(0));
});

test("a Wilson interval shows both of its bounds, never ±", () => {
  assert.equal(wilsonText(wilson(5, 5).interval!), "56.6% - 100.0%");
  assert.equal(wilsonText(wilson(0, 5).interval!), "0.0% - 43.4%");
});

const SHARE = ["Tool", "Match rate", "Score", "Hits", "95% CI"];

test("a block lists rows best first, ties in order, marks ReacherX and puts nothing measured last", () => {
  assert.deepEqual(
    chartBlock(
      "Companies, static filters · verified in top 5 (1 prompt)",
      SHARE,
      [
        {
          label: "apollo",
          value: 0,
          shown: "0.0%",
          details: ["0/5", "0.0% - 43.4%"],
        },
        {
          label: "reacherx",
          value: null,
          shown: "no results",
          details: ["0/0", ""],
          marked: true,
        },
        {
          label: "context",
          value: 1,
          shown: "100.0%",
          details: ["5/5", "56.6% - 100.0%"],
        },
        {
          label: "exa",
          value: 1,
          shown: "100.0%",
          details: ["5/5", "56.6% - 100.0%"],
        },
        {
          label: "crustdata",
          value: 0.8,
          shown: "80.0%",
          details: ["4/5", "37.6% - 96.4%"],
        },
      ]
    ),
    [
      "```",
      "Companies, static filters · verified in top 5 (1 prompt)",
      "",
      "  Tool       Match rate             Score  Hits  95% CI",
      "  ─────────  ────────────────────  ──────  ────  ──────────────",
      "  context    ████████████████████  100.0%  5/5   56.6% - 100.0%",
      "  exa        ████████████████████  100.0%  5/5   56.6% - 100.0%",
      "  crustdata  ████████████████░░░░   80.0%  4/5   37.6% - 96.4%",
      "  apollo     ░░░░░░░░░░░░░░░░░░░░    0.0%  0/5    0.0% - 43.4%",
      "→ reacherx   ░░░░░░░░░░░░░░░░░░░░     n/a  0/0   no results",
      "```",
    ]
  );
});

test("nothing measured shows n/a and its wording in the last column; an empty column is left out", () => {
  const rows = chartBlock(
    "Title",
    [
      "Tool",
      "Match rate",
      "Score",
      "Hits",
      "Prompts",
      "Priced usage",
      "95% CI",
    ],
    [
      {
        label: "exa",
        value: 0.5,
        shown: "50.0%",
        details: ["1/2", "", "$0.01", ""],
      },
      {
        label: "reacherx_via_people",
        value: 0.25,
        shown: "25.0%",
        details: ["10/40", "", "$0.00 + unpriced units", ""],
        marked: true,
      },
      {
        label: "clay",
        value: null,
        shown: "no results",
        details: ["0/0", "", "$0.00", ""],
      },
    ]
  ).slice(3, -1);
  assert.deepEqual(rows, [
    "  Tool                 Match rate            Score  Hits   Priced usage            95% CI",
    "  ───────────────────  ────────────────────  ─────  ─────  ──────────────────────  ──────────",
    "  exa                  ██████████░░░░░░░░░░  50.0%  1/2    $0.01",
    "→ reacherx_via_people  █████░░░░░░░░░░░░░░░  25.0%  10/40  $0.00 + unpriced units",
    "  clay                 ░░░░░░░░░░░░░░░░░░░░    n/a  0/0    $0.00                   no results",
  ]);
});

test("the header and its underline line up with every column under a long label", () => {
  const label = "reacherx_via_people (company prompts)";
  const lines = chartBlock("Title", SHARE, [
    {
      label: "exa",
      value: 1,
      shown: "100.0%",
      details: ["5/5", "56.6% - 100.0%"],
    },
    {
      label,
      value: 0,
      shown: "0.0%",
      details: ["0/5", "0.0% - 43.4%"],
      marked: true,
    },
  ]);
  assert.deepEqual(lines.slice(0, 3), ["```", "Title", ""]);
  const [header, underline, ...rows] = lines.slice(3, -1);
  // Each underline is exactly its column's width, two spaces from the next.
  const columns = [...underline.matchAll(/─+/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  assert.deepEqual(
    columns.map(({ start, end }) => end - start),
    [label.length, 20, "100.0%".length, "Hits".length, "56.6% - 100.0%".length]
  );
  assert.equal(columns[0].start, 2);
  columns
    .slice(1)
    .forEach(({ start }, index) => assert.equal(start, columns[index].end + 2));
  // Every header and cell sits within its column's underline: text to the
  // left, the score to the right, the intervals lined up on their dash.
  const cells = (line: string) =>
    columns.map(({ start, end }) => line.slice(start, end));
  assert.deepEqual(cells(header), [
    "Tool".padEnd(label.length),
    "Match rate          ",
    " Score",
    "Hits",
    "95% CI",
  ]);
  assert.deepEqual(rows.map(cells), [
    [
      "exa".padEnd(label.length),
      "████████████████████",
      "100.0%",
      "5/5 ",
      "56.6% - 100.0%",
    ],
    [label, "░░░░░░░░░░░░░░░░░░░░", "  0.0%", "0/5 ", " 0.0% - 43.4%"],
  ]);
  assert.ok(rows[1].startsWith(`→ ${label}`));
});

test("every column needs a header", () => {
  assert.throws(
    () =>
      chartBlock(
        "Title",
        ["Tool", "Match rate", "Score"],
        [{ label: "exa", value: 1, shown: "100.0%", details: ["5/5"] }]
      ),
    /needs a header for every column/
  );
});
