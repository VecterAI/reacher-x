import assert from "node:assert/strict";
import test from "node:test";
import { assertAggregateOnly } from "../../../core/analysis/publish";
import { wilson } from "../../../core/analysis/stats";
import { summarizeUsage } from "../../../core/execution/spend";
import { peopleSearchPublicVocabulary } from "../../../people-search/analysis/publicVocabulary";

// Synthetic aggregates only; not benchmark findings.
const row = {
  taskId: "p14",
  category: "Companies, static filters",
  entityType: "organization" as const,
  toolId: "context",
  returned: 1,
  verifiedMatches: 1,
  precision: wilson(1, 1),
  speed: {
    requestLatencyMs: 1,
    firstVerifiedMatchMs: 1,
    fifthVerifiedMatchMs: null,
    activeProcessingMs: 1,
    scheduledWaitMs: 0,
  },
  usage: summarizeUsage([]),
};

test("the people-search vocabulary approves plan values only", () => {
  const vocabulary = peopleSearchPublicVocabulary();
  assert.equal(vocabulary.taskIds.length, 20);
  assert.ok(vocabulary.categories.includes("people-signals"));
  assert.ok(vocabulary.toolIds.includes("reacherx"));
  const report = {
    runId: `ps-${"a".repeat(12)}-stage2-first`,
    planSha256: "0".repeat(64),
    rows: [row],
  };
  assert.equal(assertAggregateOnly(report, vocabulary).rows.length, 1);
  for (const runId of [`ps-${"a".repeat(12)}-jane`, "jane-example"])
    assert.throws(
      () => assertAggregateOnly({ ...report, runId }, vocabulary),
      /runId is not an approved/
    );
  assert.throws(
    () =>
      assertAggregateOnly(
        { ...report, rows: [{ ...row, category: "Jane Example" }] },
        vocabulary
      ),
    /category is not an approved/
  );
});
