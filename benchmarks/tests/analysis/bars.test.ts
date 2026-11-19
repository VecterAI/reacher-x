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
  assert.equal(wilsonText(wilson(5, 5).interval!), "95% CI 56.6-100.0");
  assert.equal(wilsonText(wilson(0, 5).interval!), "95% CI 0.0-43.4");
});

test("a block lists rows best first, ties in order, marks ReacherX and puts nothing measured last", () => {
  assert.deepEqual(
    chartBlock("Companies, static filters · verified in top 5 (1 prompt)", [
      { label: "apollo", value: 0, shown: "0.0%", details: ["(0/5)"] },
      {
        label: "reacherx",
        value: null,
        shown: "no results",
        details: [""],
        marked: true,
      },
      { label: "context", value: 1, shown: "100.0%", details: ["(5/5)"] },
      { label: "exa", value: 1, shown: "100.0%", details: ["(5/5)"] },
      { label: "crustdata", value: 0.8, shown: "80.0%", details: ["(4/5)"] },
    ]),
    [
      "```",
      "Companies, static filters · verified in top 5 (1 prompt)",
      "  context   ████████████████████  100.0%  (5/5)",
      "  exa       ████████████████████  100.0%  (5/5)",
      "  crustdata ████████████████░░░░   80.0%  (4/5)",
      "  apollo    ░░░░░░░░░░░░░░░░░░░░    0.0%  (0/5)",
      "→ reacherx  ░░░░░░░░░░░░░░░░░░░░  no results",
      "```",
    ]
  );
});

test("long labels pad every row, so bars and each column line up", () => {
  const rows = chartBlock("Title", [
    { label: "exa", value: 0.5, shown: "50.0%", details: ["(1/2)", "$0.01"] },
    {
      label: "reacherx_via_people",
      value: 0.25,
      shown: "25.0%",
      details: ["(10/40)", "$0.00 + unpriced units"],
      marked: true,
    },
    // Nothing measured: its wording runs on into the empty column after it.
    { label: "clay", value: null, shown: "no results", details: ["", "$0.00"] },
  ]).slice(2, -1);
  assert.deepEqual(rows, [
    "  exa                 ██████████░░░░░░░░░░  50.0%  (1/2)    $0.01",
    "→ reacherx_via_people █████░░░░░░░░░░░░░░░  25.0%  (10/40)  $0.00 + unpriced units",
    "  clay                ░░░░░░░░░░░░░░░░░░░░  no results      $0.00",
  ]);
  const column = (pattern: RegExp) =>
    new Set(rows.map((row) => row.search(pattern)));
  assert.deepEqual(column(/[█░]/), new Set(["→ reacherx_via_people ".length]));
  assert.equal(column(/\$/).size, 1);
});
