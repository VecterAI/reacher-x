import assert from "node:assert/strict";
import test from "node:test";
import { peopleSearchRates } from "../../../people-search/setup/rates";
import type { SegmentId } from "../../../people-search/setup/schedule";
import {
  decide,
  learningPairs,
  segmentOutcomeSchema,
  type ReportContext,
} from "../../../people-search/steps/reports";

// Synthetic outcomes only.
const judged = (
  taskId: string,
  learning: "on" | "off",
  verifiedMatch: boolean
) => ({
  taskId,
  toolId: "reacherx",
  kind: "top" as const,
  learning,
  cycle: 1,
  record: { panel: { verifiedMatch } },
});

test("learning pairs count a completed condition with no verified match as 0 and list incomplete ones apart", () => {
  const { pairs, incomplete } = learningPairs(
    [
      { taskId: "p01", learning: "on" },
      { taskId: "p01", learning: "off" },
      { taskId: "p06", learning: "on" },
      { taskId: "p07", learning: "on" },
      { taskId: "p11", learning: "on" },
      { taskId: "p11", learning: "off" },
    ],
    [
      judged("p01", "on", true),
      judged("p01", "on", true),
      judged("p01", "on", true),
      // The off workspace completed but returned nothing to judge.
      judged("p11", "on", true),
      judged("p11", "off", true),
    ],
    [{ unitId: "w-p06-off" }, { unitId: "j-reacherx-p11-on-c2-q1" }]
  );
  assert.deepEqual(pairs, [{ taskId: "p01", on: 3, off: 0 }]);
  assert.deepEqual(incomplete, [
    { taskId: "p06", learning: "off", reason: "held for review" },
    { taskId: "p07", learning: "off", reason: "not run" },
    { taskId: "p11", learning: "on", reason: "held for review" },
  ]);
});

const outcome = (segment: SegmentId) =>
  segmentOutcomeSchema.parse({
    segment,
    runId: `synthetic-${segment}`,
    status: "complete",
    stopReason: null,
    settings: null,
    stage2: null,
    units: { executed: 0, reused: 0 },
    workspaces: [],
    translations: [],
    competitors: [],
    cases: [],
    review: [],
    notReached: 0,
    accounts: null,
    labels: null,
    decision: null,
    stepUsd: 0,
  });

const context = (earlier: ReportContext["earlier"]): ReportContext => ({
  planSha256: "0".repeat(64),
  seed: 7,
  rates: peopleSearchRates("2026-11-15T00:00:00.000Z"),
  earlier,
  plannedCycleCostUsd: null,
});

test("projections stay unknown when a cost they need was never measured", () => {
  // No judged result has a recorded cost, so the main-run projection is unknown, not $0.
  const d2 = decide(outcome("pilot"), context([outcome("smoke")]), "D2");
  const budget = d2?.rows.find((row) =>
    row.condition.startsWith("Remaining stage 1 budget")
  );
  assert.equal(budget?.status, "needs-approval");
  assert.match(
    budget?.detail ?? "",
    /unknown, because a cost it needs has no measurement yet/
  );
  assert.doesNotMatch(budget?.detail ?? "", /\$0\.000/);

  // No cycle cost was measured, so the stage 2 estimate is unknown, not $0.
  const d3 = decide(
    outcome("main"),
    context([outcome("smoke"), outcome("pilot")]),
    "D3"
  );
  const stage2 = d3?.rows.find(
    (row) => row.condition === "Stage 2 budget approved"
  );
  assert.equal(stage2?.status, "needs-approval");
  assert.match(stage2?.detail ?? "", /unknown/);
  assert.doesNotMatch(stage2?.detail ?? "", /\$0\.000/);
});
