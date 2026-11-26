import assert from "node:assert/strict";
import test from "node:test";
import { AUTOCOMPLETE_CANDIDATES } from "../../inline-autocomplete/candidates";
import { AUTOCOMPLETE_CASES } from "../../inline-autocomplete/cases";
import {
  evaluateDeterministicChecks,
  formatSummaryTable,
  percentile,
  summarizeCandidateResults,
} from "../../inline-autocomplete/evaluate";
import {
  buildContextAwarePrompt,
  buildLegacyPrompt,
  finalizeCandidateSuggestion,
} from "../../inline-autocomplete/prompts";
import { runDryAutocompleteBenchmark } from "../../inline-autocomplete/runner";

test("context-aware prompt includes conversation history, LinkedIn post context, and stable prefix ordering", () => {
  const threadCase1 = AUTOCOMPLETE_CASES.find(
    (c) => c.id === "agent-thread-cache-1"
  )!;
  const threadCase2 = AUTOCOMPLETE_CASES.find(
    (c) => c.id === "agent-thread-cache-2"
  )!;
  const linkedInCommentCase = AUTOCOMPLETE_CASES.find(
    (c) => c.id === "linkedin-comment-post-1"
  )!;

  const legacyThread = buildLegacyPrompt(threadCase1);
  const improvedThread1 = buildContextAwarePrompt(threadCase1);
  const improvedThread2 = buildContextAwarePrompt(threadCase2);

  // Legacy omits thread history and leaks Twitter voice into agent chat.
  assert.ok(!legacyThread.prompt.includes("@maya_builds"));
  assert.ok(legacyThread.prompt.includes("User writing voice:"));

  // Improved includes thread history and omits social voice in agent chat.
  assert.ok(improvedThread1.prompt.includes("@maya_builds"));
  assert.ok(!improvedThread1.prompt.includes("User writing voice:"));

  // Cache-group sibling cases share an identical prompt prefix before the draft block.
  const prefix1 = improvedThread1.prompt.split("\n\nDraft:\n")[0];
  const prefix2 = improvedThread2.prompt.split("\n\nDraft:\n")[0];
  assert.equal(prefix1, prefix2);

  // Legacy omits LinkedIn parent post text; improved includes it.
  const legacyLinkedIn = buildLegacyPrompt(linkedInCommentCase);
  const improvedLinkedIn = buildContextAwarePrompt(linkedInCommentCase);
  assert.ok(!legacyLinkedIn.prompt.includes("Warm context beats volume"));
  assert.ok(improvedLinkedIn.prompt.includes("Warm context beats volume"));
});

test("finalizeCandidateSuggestion parses legacy JSON and raw text while respecting X weighted limits", () => {
  const xBudgetCase = AUTOCOMPLETE_CASES.find(
    (c) => c.id === "x-reply-tight-budget"
  )!;

  const rawSuggestion = finalizeCandidateSuggestion({
    rawText:
      "building a simpler version myself over the weekend so I never have to sit through another sales call again",
    mode: "context_raw",
    testCase: xBudgetCase,
    maxSuggestionChars: 110,
    maxSuggestionWords: 16,
  });

  assert.ok(rawSuggestion.length > 0);
  assert.ok(
    `${xBudgetCase.beforeCursor}${rawSuggestion}`.length <=
      (xBudgetCase.maxLength ?? 280)
  );

  const legacySuggestion = finalizeCandidateSuggestion({
    rawText: '```json\n{"completion":"1,000 followers first"}\n```',
    mode: "legacy_json_no_history",
    testCase: AUTOCOMPLETE_CASES[0]!,
    maxSuggestionChars: 24,
    maxSuggestionWords: 4,
  });
  assert.equal(legacySuggestion, "1,000 followers first");
});

test("evaluateDeterministicChecks flags prefix/suffix overlap, meta commentary, and forced text on empty cases", () => {
  const emptyCase = AUTOCOMPLETE_CASES.find((c) => c.expectEmpty)!;
  const suffixCase = AUTOCOMPLETE_CASES.find(
    (c) => c.id === "edge-mid-sentence-suffix"
  )!;

  const emptyPass = evaluateDeterministicChecks({
    testCase: emptyCase,
    mode: "context_raw",
    rawText: "__NO_COMPLETION__",
    suggestion: "",
  });
  assert.equal(emptyPass.passedAll, true);

  const emptyFail = evaluateDeterministicChecks({
    testCase: emptyCase,
    mode: "context_raw",
    rawText: "Let me know if you need anything else.",
    suggestion: " Let me know if you need anything else.",
  });
  assert.equal(emptyFail.emptyBehaviorOk, false);
  assert.equal(emptyFail.passedAll, false);

  const suffixOverlapFail = evaluateDeterministicChecks({
    testCase: suffixCase,
    mode: "context_raw",
    rawText: "a CSV and start",
    suggestion: "a CSV",
  });
  assert.equal(suffixOverlapFail.noSuffixOverlap, false);

  const metaFail = evaluateDeterministicChecks({
    testCase: suffixCase,
    mode: "context_raw",
    rawText: "Here is the continuation: a CSV",
    suggestion: "Here is the continuation: a CSV",
  });
  assert.equal(metaFail.cleanFormat, false);
});

test("dry-run benchmark executes all cases at $0 and formats summary table cleanly", () => {
  assert.equal(percentile([10, 20, 30, 40, 50], 50), 30);
  assert.equal(percentile([10, 20, 30, 40, 50], 95), 50);

  const subset = AUTOCOMPLETE_CANDIDATES.slice(0, 2);
  const { results, summaries } = runDryAutocompleteBenchmark({
    candidates: subset,
  });

  assert.equal(results.length, subset.length * AUTOCOMPLETE_CASES.length);
  assert.equal(summaries.length, subset.length);
  for (const summary of summaries) {
    assert.equal(summary.errorCount, 0);
    assert.equal(summary.totalSpendUsd, 0);
    assert.ok(summary.cacheHitRate > 0);
  }

  const casesById = new Map(AUTOCOMPLETE_CASES.map((c) => [c.id, c]));
  const recomputed = summarizeCandidateResults({
    candidate: subset[0]!,
    results: results.filter((r) => r.candidateId === subset[0]!.id),
    casesById,
  });
  assert.equal(recomputed.totalCases, AUTOCOMPLETE_CASES.length);

  const table = formatSummaryTable(summaries);
  assert.ok(table.includes("baseline-legacy"));
  assert.ok(table.includes("TTFT p50"));
});
