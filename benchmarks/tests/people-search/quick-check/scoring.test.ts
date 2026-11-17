import assert from "node:assert/strict";
import test from "node:test";
import type {
  ReplayCase,
  ReplayOutcome,
} from "../../../people-search/run/replay";
import {
  compareReplays,
  renderQuickCheckReport,
  scoreReplay,
} from "../../../people-search/quick-check/scoring";

// Synthetic labels and decisions only.
const replayCase = (
  caseId: string,
  expectedMatch: boolean,
  originallyQualified: boolean,
  entityType: ReplayCase["entityType"] = "individual"
): ReplayCase => ({
  caseId,
  taskId: "t1",
  referenceDate: "2026-11-14T00:00:00Z",
  entityType,
  expectedMatch,
  originalDecision: { qualified: originallyQualified, score: null },
  input: {} as ReplayCase["input"],
});

const outcome = (caseId: string, qualified: boolean | null): ReplayOutcome =>
  qualified === null
    ? {
        caseId,
        modelObserved: "m",
        latencyMs: 1,
        status: "error",
        error: "failed",
      }
    : {
        caseId,
        modelObserved: "m",
        latencyMs: 1,
        status: "ok",
        result: {
          qualified,
          score: qualified ? 80 : 20,
          reasoning: "Synthetic.",
        },
      };

const cases = [
  replayCase("a", true, true),
  replayCase("b", true, false),
  replayCase("c", false, true),
  replayCase("d", false, false, "organization"),
  replayCase("e", true, true, "organization"),
];

test("replay decisions are scored against labels: agreement, wrong acceptances and wrong rejections", () => {
  const score = scoreReplay(
    cases,
    [
      outcome("a", true),
      outcome("b", false),
      outcome("c", true),
      outcome("d", false),
      outcome("e", null),
    ],
    { model: "m", learning: "on", recordedUsd: 0.02, keySpendUsd: null }
  );
  assert.deepEqual(score.confusion, {
    trueAccept: 1,
    falseAccept: 1,
    trueReject: 1,
    falseReject: 1,
  });
  assert.equal(score.errors, 1);
  assert.equal(score.agreement.successes, 2);
  assert.equal(score.agreement.trials, 4);
  assert.deepEqual(
    [score.falseAcceptShare.successes, score.falseAcceptShare.trials],
    [1, 2]
  );
  assert.deepEqual(
    [score.falseRejectShare.successes, score.falseRejectShare.trials],
    [1, 2]
  );
  assert.deepEqual([score.recall.successes, score.recall.trials], [1, 2]);
  // Every scored decision repeats the original run's.
  assert.equal(score.sameAsOriginal.successes, 4);
  assert.equal(score.byEntityType.organization?.cases, 1);
  assert.throws(
    () =>
      scoreReplay(cases, [outcome("a", true)], {
        model: "m",
        learning: "on",
        recordedUsd: 0,
        keySpendUsd: null,
      }),
    /exactly one replay outcome/
  );
});

test("two replays are compared case by case and reported as aggregates only", () => {
  const first = cases.map((item) => outcome(item.caseId, item.expectedMatch));
  const second = cases.map((item) => outcome(item.caseId, true));
  const comparison = compareReplays(first, second);
  assert.deepEqual(comparison, { compared: 5, changedDecisions: 2 });
  const meta = {
    model: "openai/x|y",
    learning: "on" as const,
    recordedUsd: 0.01,
    keySpendUsd: 0.012,
  };
  const markdown = renderQuickCheckReport(
    "set-1",
    [
      scoreReplay(cases, first, meta),
      scoreReplay(cases, second, { ...meta, learning: "off" }),
    ],
    comparison
  );
  assert.match(markdown, /\| Agreement with labels \| 100\.0% \(/);
  assert.match(markdown, /Decisions changed between the two replays: 2 of 5\./);
  assert.match(markdown, /openai\/xy, learning off/);
  assert.doesNotMatch(markdown, /Synthetic\./);
});
