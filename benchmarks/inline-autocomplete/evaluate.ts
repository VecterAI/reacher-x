import { z } from "zod";
import { getXPostWeightedLength } from "../../shared/lib/twitter/xPostTextLimit";
import type { StructuredCall } from "../core/calls/llm";
import { extractCompletionText } from "./prompts";
import type {
  AutocompleteCase,
  BlindJudgeVerdict,
  CandidateConfig,
  CandidateSummary,
  CaseRunResult,
  DeterministicChecks,
  PromptMode,
} from "./types";

const META_PREFIX_REGEX =
  /^(?:here(?:'s| is)\b|sure[,!:]|continuation:|completion:|suggestion:|output:)/i;

/** Computes an inclusive nearest-rank percentile on a non-empty numeric array. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[index] ?? 0;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

/**
 * Evaluates objective formatting, overlap, silence, and budget rules on a
 * candidate's raw output and finalized suggestion.
 */
export function evaluateDeterministicChecks(args: {
  testCase: AutocompleteCase;
  mode: PromptMode;
  rawText: string;
  suggestion: string;
  error?: string;
}): DeterministicChecks {
  const { testCase, mode, rawText, suggestion, error } = args;
  const noError = !error;
  if (!noError) {
    return {
      noError: false,
      cleanFormat: false,
      noPrefixOverlap: false,
      noSuffixOverlap: false,
      emptyBehaviorOk: false,
      withinBudget: false,
      passedAll: false,
    };
  }

  const trimmedRaw = rawText.trim();
  const extracted = extractCompletionText(rawText, mode).trim();

  // Check raw output discipline: single line, no markdown fences, no chatty meta-prefix.
  const hasFence = trimmedRaw.includes("```");
  const hasMultipleLines = mode === "context_raw" && trimmedRaw.includes("\n");
  const hasMetaPrefix = META_PREFIX_REGEX.test(trimmedRaw);
  const leakedJsonInRaw =
    mode === "context_raw" && /^\s*\{\s*"completion"\s*:/.test(trimmedRaw);
  const cleanFormat =
    !hasFence && !hasMultipleLines && !hasMetaPrefix && !leakedJsonInRaw;

  // Check if the model repeated the tail of beforeCursor or start of afterCursor before trimming.
  const beforeTailWords = testCase.beforeCursor.trim().split(/\s+/).slice(-3);
  const beforeTail = beforeTailWords.slice(-2).join(" ").toLowerCase();
  const noPrefixOverlap =
    !extracted ||
    beforeTail.length < 5 ||
    !extracted.toLowerCase().startsWith(beforeTail);

  const afterHead = (testCase.afterCursor ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .toLowerCase();
  const noSuffixOverlap =
    !extracted ||
    afterHead.length < 4 ||
    !extracted.toLowerCase().endsWith(afterHead);

  const isEmpty = suggestion.trim().length === 0;
  const emptyBehaviorOk = testCase.expectEmpty ? isEmpty : !isEmpty;

  let withinBudget = true;
  if (testCase.maxLength && testCase.maxLength > 0 && suggestion) {
    const combined = `${testCase.beforeCursor}${suggestion}${testCase.afterCursor ?? ""}`;
    withinBudget =
      testCase.characterCountMode === "x_post"
        ? getXPostWeightedLength(combined) <= testCase.maxLength
        : combined.length <= testCase.maxLength;
  }

  const passedAll =
    noError &&
    cleanFormat &&
    noPrefixOverlap &&
    noSuffixOverlap &&
    emptyBehaviorOk &&
    withinBudget;

  return {
    noError,
    cleanFormat,
    noPrefixOverlap,
    noSuffixOverlap,
    emptyBehaviorOk,
    withinBudget,
    passedAll,
  };
}

/** Aggregates per-case results and optional judge verdicts into one summary per candidate. */
export function summarizeCandidateResults(args: {
  candidate: CandidateConfig;
  results: readonly CaseRunResult[];
  casesById: ReadonlyMap<string, AutocompleteCase>;
  verdicts?: readonly BlindJudgeVerdict[];
}): CandidateSummary {
  const { candidate, results, casesById, verdicts } = args;
  const okResults = results.filter((r) => !r.error);
  const ttfts = okResults
    .map((r) => r.ttftMs)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const latencies = okResults.map((r) => r.totalLatencyMs);

  const emptyCases = results.filter(
    (r) => casesById.get(r.caseId)?.expectEmpty === true
  );
  const emptyCorrect = emptyCases.filter(
    (r) => r.checks.emptyBehaviorOk
  ).length;

  const totalSpendUsd = results.reduce((sum, r) => sum + r.costUsd, 0);
  const costPer1kUsd =
    okResults.length > 0
      ? (okResults.reduce((sum, r) => sum + r.costUsd, 0) / okResults.length) *
        1000
      : 0;

  const cacheFollowups = okResults.filter((r) => r.isCacheFollowup);
  const cachedFollowupCostPer1kUsd =
    cacheFollowups.length > 0
      ? (cacheFollowups.reduce((sum, r) => sum + r.costUsd, 0) /
          cacheFollowups.length) *
        1000
      : null;

  const cacheHitRate =
    cacheFollowups.length > 0
      ? cacheFollowups.filter((r) => r.cachedInputTokens > 0).length /
        cacheFollowups.length
      : 0;

  const providers = new Set(
    okResults.map((r) => r.providerObserved).filter((p) => p && p !== "unknown")
  );

  const candidateVerdicts = (verdicts ?? []).filter(
    (v) => v.candidateId === candidate.id
  );
  const judgeAvgScore =
    candidateVerdicts.length > 0
      ? mean(
          candidateVerdicts.map(
            (v) => (v.contextScore + v.naturalnessScore) / 2
          )
        )
      : null;
  const judgeTabAcceptRate =
    candidateVerdicts.length > 0
      ? candidateVerdicts.filter((v) => v.wouldTabAccept).length /
        candidateVerdicts.length
      : null;

  return {
    candidateId: candidate.id,
    label: candidate.label,
    model: candidate.model,
    providerObserved: [...providers].join("/") || "unknown",
    totalCases: results.length,
    errorCount: results.length - okResults.length,
    deterministicPassRate:
      results.length > 0
        ? results.filter((r) => r.checks.passedAll).length / results.length
        : 0,
    emptyAccuracyRate:
      emptyCases.length > 0 ? emptyCorrect / emptyCases.length : 1,
    ttftP50Ms: ttfts.length > 0 ? percentile(ttfts, 50) : null,
    ttftP95Ms: ttfts.length > 0 ? percentile(ttfts, 95) : null,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    avgInputTokens: mean(okResults.map((r) => r.inputTokens)),
    avgOutputTokens: mean(okResults.map((r) => r.outputTokens)),
    avgReasoningTokens: mean(okResults.map((r) => r.reasoningTokens)),
    cacheHitRate,
    costPer1kUsd,
    cachedFollowupCostPer1kUsd,
    totalSpendUsd,
    judgeAvgScore,
    judgeTabAcceptRate,
  };
}

const judgeCaseSchema = z.object({
  ratings: z.array(
    z.object({
      slot: z.string(),
      contextScore: z.number().int().min(1).max(5),
      naturalnessScore: z.number().int().min(1).max(5),
      wouldTabAccept: z.boolean(),
      reason: z.string(),
    })
  ),
});

/**
 * Blindly grades all candidate completions for each case in a single
 * structured call per case, hiding model identities behind anonymous slots.
 */
export async function runBlindJudge(args: {
  cases: readonly AutocompleteCase[];
  results: readonly CaseRunResult[];
  judgeModel: string;
  callJudge: StructuredCall;
}): Promise<{ verdicts: BlindJudgeVerdict[]; judgeCostUsd: number }> {
  const { cases, results, judgeModel, callJudge } = args;
  const verdicts: BlindJudgeVerdict[] = [];
  let judgeCostUsd = 0;

  const system = `You are grading inline ghost-text autocomplete suggestions for ReacherX (a networking, outreach, and AI agent app).
Score each anonymous candidate independently on:
- contextScore (1-5): Does it accurately reflect the thread history, DM history, parent post, and prospect details? (1 = random/generic/wrong, 3 = plausible but generic, 5 = spot-on Cursor-level awareness)
- naturalnessScore (1-5): Does it flow seamlessly after beforeCursor (and before afterCursor), match the surface tone, and avoid AI fluff or repetition?
- wouldTabAccept (boolean): Would a real founder press Tab to accept this continuation?
If the case expects an empty suggestion (expectEmpty = true), an empty completion gets 5/5 and wouldTabAccept=true; any forced text gets 1/5 and wouldTabAccept=false.`;

  for (const testCase of cases) {
    const caseResults = results.filter((r) => r.caseId === testCase.id);
    if (caseResults.length === 0) continue;

    // Deterministic rotation by case id so candidate order varies blindly across cases.
    const offset =
      testCase.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
      caseResults.length;
    const rotated = [
      ...caseResults.slice(offset),
      ...caseResults.slice(0, offset),
    ];
    const slotToCandidate = new Map<string, string>();
    const candidateLines = rotated.map((result, idx) => {
      const slot = `C${idx + 1}`;
      slotToCandidate.set(slot, result.candidateId);
      const rendered = result.error
        ? `<ERROR: ${result.error}>`
        : result.suggestion
          ? JSON.stringify(result.suggestion)
          : "<EMPTY>";
      return `${slot}: ${rendered}`;
    });

    const historyText = testCase.conversationHistory?.length
      ? testCase.conversationHistory
          .map((t) => `${t.author ?? t.role}: ${t.text}`)
          .join("\n")
      : "<none>";

    const prompt = [
      `Surface: ${testCase.surface} (${testCase.platform})`,
      `Expect empty: ${testCase.expectEmpty ? "yes" : "no"}`,
      `Expected intent: ${testCase.expectedIntent}`,
      testCase.prospect
        ? `Prospect: ${testCase.prospect.displayName}${testCase.prospect.company ? ` (${testCase.prospect.company})` : ""}`
        : null,
      testCase.replyToText ? `Parent post:\n${testCase.replyToText}` : null,
      `Conversation history:\n${historyText}`,
      `User draft: ${JSON.stringify(testCase.beforeCursor)}<CURSOR>${JSON.stringify(testCase.afterCursor ?? "")}`,
      `Anonymous candidate completions:\n${candidateLines.join("\n")}`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n\n");

    const response = await callJudge(judgeModel, {
      system,
      prompt,
      schema: judgeCaseSchema,
    });
    judgeCostUsd += response.costUsd ?? 0;

    for (const rating of response.output.ratings) {
      const candidateId = slotToCandidate.get(rating.slot);
      if (!candidateId) continue;
      verdicts.push({
        caseId: testCase.id,
        candidateId,
        contextScore: rating.contextScore,
        naturalnessScore: rating.naturalnessScore,
        wouldTabAccept: rating.wouldTabAccept,
        reason: rating.reason,
      });
    }
  }

  return { verdicts, judgeCostUsd };
}

function fmtMs(value: number | null): string {
  return value === null ? "-" : `${Math.round(value)}ms`;
}

function fmtPct(value: number | null): string {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

function fmtCost1k(value: number | null): string {
  return value === null ? "-" : `$${value.toFixed(4)}`;
}

/** Formats a clean stdout comparison table sorted by judge score or pass rate + latency. */
export function formatSummaryTable(
  summaries: readonly CandidateSummary[]
): string {
  const headers = [
    "Candidate",
    "Provider",
    "TTFT p50",
    "Lat p50",
    "Lat p95",
    "$/1k",
    "Cache $/1k",
    "Cache%",
    "Pass%",
    "Judge",
    "Tab%",
    "ReasTok",
    "Err",
  ];

  const rows = summaries.map((s) => [
    s.candidateId,
    s.providerObserved.slice(0, 16),
    fmtMs(s.ttftP50Ms),
    fmtMs(s.latencyP50Ms),
    fmtMs(s.latencyP95Ms),
    fmtCost1k(s.costPer1kUsd),
    fmtCost1k(s.cachedFollowupCostPer1kUsd),
    fmtPct(s.cacheHitRate),
    fmtPct(s.deterministicPassRate),
    s.judgeAvgScore === null ? "-" : `${s.judgeAvgScore.toFixed(2)}/5`,
    fmtPct(s.judgeTabAcceptRate),
    Math.round(s.avgReasoningTokens).toString(),
    String(s.errorCount),
  ]);

  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => (row[i] ?? "").length))
  );

  const renderRow = (cols: readonly string[]) =>
    cols.map((col, i) => col.padEnd(widths[i] ?? col.length)).join(" | ");

  const divider = widths.map((w) => "-".repeat(w)).join("-+-");
  return [renderRow(headers), divider, ...rows.map(renderRow)].join("\n");
}

/** Renders side-by-side sample completions for visual inspection. */
export function formatSampleCompletions(args: {
  cases: readonly AutocompleteCase[];
  results: readonly CaseRunResult[];
  sampleCaseIds: readonly string[];
}): string {
  const lines: string[] = [];
  for (const caseId of args.sampleCaseIds) {
    const testCase = args.cases.find((c) => c.id === caseId);
    if (!testCase) continue;
    lines.push(
      `\n[${testCase.surface}] ${testCase.id}\n  Draft: "${testCase.beforeCursor}<CURSOR>${testCase.afterCursor ?? ""}"`
    );
    const caseResults = args.results.filter((r) => r.caseId === caseId);
    for (const r of caseResults) {
      const text = r.error
        ? `ERROR: ${r.error}`
        : r.suggestion
          ? `"${r.suggestion}"`
          : "<empty>";
      const meta = `${Math.round(r.totalLatencyMs)}ms, $${(r.costUsd * 1000).toFixed(4)}/1k`;
      lines.push(`  - ${r.candidateId.padEnd(23)} => ${text} (${meta})`);
    }
  }
  return lines.join("\n");
}
