import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { z } from "zod";
import { openRouterStructured } from "../core/calls/llm";
import { AUTOCOMPLETE_CANDIDATES } from "./candidates";
import { AUTOCOMPLETE_CASES } from "./cases";
import {
  evaluateDeterministicChecks,
  formatSampleCompletions,
  formatSummaryTable,
  runBlindJudge,
  summarizeCandidateResults,
} from "./evaluate";
import { buildPromptForMode, finalizeCandidateSuggestion } from "./prompts";
import type {
  AutocompleteCase,
  CandidateConfig,
  CandidateSummary,
  CaseRunResult,
} from "./types";

const DEFAULT_MAX_SPEND_USD = 0.5;
const DEFAULT_JUDGE_MODEL = "openai/gpt-6-luna";
const REQUEST_TIMEOUT_MS = 15_000;

const SAMPLE_CASE_IDS = [
  "agent-thread-cache-2",
  "x-dm-cache-1",
  "linkedin-dm-warm-reply",
  "x-reply-pain-point",
  "linkedin-comment-post-1",
  "edge-mid-sentence-suffix",
  "edge-complete-sentence-empty",
] as const;

const openRouterMetaSchema = z.object({
  openrouter: z
    .object({
      provider: z.string().optional(),
      model: z.string().optional(),
      usage: z
        .object({
          cost: z.union([z.number(), z.string()]).optional(),
          promptTokens: z.number().optional(),
          completionTokens: z.number().optional(),
          promptTokensDetails: z
            .object({
              cachedTokens: z.number().optional(),
            })
            .optional(),
          completionTokensDetails: z
            .object({
              reasoningTokens: z.number().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

async function loadOpenRouterApiKey(cwd: string): Promise<string | undefined> {
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }
  for (const envFile of [".env.local", ".env.benchmark.local", ".env"]) {
    try {
      const content = await readFile(path.join(cwd, envFile), "utf8");
      const match = /^OPENROUTER_API_KEY=(.+)$/m.exec(content);
      if (match?.[1]) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      // File missing; try next candidate.
    }
  }
  return undefined;
}

function buildOpenRouterSettings(candidate: CandidateConfig) {
  const settings: Record<string, unknown> = {
    usage: { include: true },
  };
  if (candidate.provider) {
    settings.provider = {
      ...(candidate.provider.only
        ? { only: [...candidate.provider.only] }
        : {}),
      ...(candidate.provider.order
        ? { order: [...candidate.provider.order] }
        : {}),
      ...(candidate.provider.allow_fallbacks !== undefined
        ? { allow_fallbacks: candidate.provider.allow_fallbacks }
        : {}),
      ...(candidate.provider.sort ? { sort: candidate.provider.sort } : {}),
    };
  }
  if (candidate.reasoning) {
    settings.reasoning = { ...candidate.reasoning };
  }
  return settings;
}

async function runSingleLiveCase(args: {
  openrouter: ReturnType<typeof createOpenRouter>;
  candidate: CandidateConfig;
  testCase: AutocompleteCase;
  isCacheFollowup: boolean;
}): Promise<CaseRunResult> {
  const { openrouter, candidate, testCase, isCacheFollowup } = args;
  const { system, prompt } = buildPromptForMode(testCase, candidate.promptMode);
  const startedAt = performance.now();

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(new Error("Request timeout")),
      REQUEST_TIMEOUT_MS
    );

    let ttftMs: number | null = null;
    let rawText = "";

    try {
      const stream = streamText({
        model: openrouter(
          candidate.model,
          buildOpenRouterSettings(candidate) as Parameters<typeof openrouter>[1]
        ),
        system,
        prompt,
        temperature: candidate.temperature,
        maxOutputTokens: candidate.maxOutputTokens,
        stopSequences: candidate.stopSequences
          ? [...candidate.stopSequences]
          : undefined,
        abortSignal: abortController.signal,
      });

      for await (const delta of stream.textStream) {
        if (ttftMs === null && delta.length > 0) {
          ttftMs = performance.now() - startedAt;
        }
        rawText += delta;
      }

      const totalLatencyMs = performance.now() - startedAt;
      const [usage, providerMetadata, responseMeta] = await Promise.all([
        stream.usage,
        stream.providerMetadata,
        stream.response,
      ]);

      const parsedMeta = openRouterMetaSchema.safeParse(providerMetadata);
      const orMeta = parsedMeta.success
        ? parsedMeta.data.openrouter
        : undefined;
      const rawCost = orMeta?.usage?.cost;
      const parsedCost = rawCost !== undefined ? Number(rawCost) : 0;
      const costUsd = Number.isFinite(parsedCost) ? parsedCost : 0;

      const inputTokens = usage.inputTokens ?? orMeta?.usage?.promptTokens ?? 0;
      const outputTokens =
        usage.outputTokens ?? orMeta?.usage?.completionTokens ?? 0;
      const cachedInputTokens =
        usage.inputTokenDetails?.cacheReadTokens ??
        orMeta?.usage?.promptTokensDetails?.cachedTokens ??
        0;
      const reasoningTokens =
        usage.outputTokenDetails?.reasoningTokens ??
        orMeta?.usage?.completionTokensDetails?.reasoningTokens ??
        0;

      const suggestion = finalizeCandidateSuggestion({
        rawText,
        mode: candidate.promptMode,
        testCase,
        maxSuggestionChars: candidate.maxSuggestionChars,
        maxSuggestionWords: candidate.maxSuggestionWords,
      });

      const checks = evaluateDeterministicChecks({
        testCase,
        mode: candidate.promptMode,
        rawText,
        suggestion,
      });

      return {
        caseId: testCase.id,
        surface: testCase.surface,
        cacheGroup: testCase.cacheGroup,
        isCacheFollowup,
        candidateId: candidate.id,
        rawText,
        suggestion,
        ttftMs,
        totalLatencyMs,
        inputTokens,
        outputTokens,
        cachedInputTokens,
        reasoningTokens,
        costUsd,
        modelObserved: orMeta?.model ?? responseMeta.modelId ?? candidate.model,
        providerObserved: orMeta?.provider ?? "unknown",
        checks,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const totalLatencyMs = performance.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return {
      caseId: testCase.id,
      surface: testCase.surface,
      cacheGroup: testCase.cacheGroup,
      isCacheFollowup,
      candidateId: candidate.id,
      rawText: "",
      suggestion: "",
      ttftMs: null,
      totalLatencyMs,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      costUsd: 0,
      modelObserved: candidate.model,
      providerObserved: "error",
      error: message.slice(0, 140),
      checks: evaluateDeterministicChecks({
        testCase,
        mode: candidate.promptMode,
        rawText: "",
        suggestion: "",
        error: message,
      }),
    };
  }
}

/** Runs the benchmark offline with synthetic outputs so CI and unit tests spend $0. */
export function runDryAutocompleteBenchmark(args?: {
  candidates?: readonly CandidateConfig[];
  cases?: readonly AutocompleteCase[];
}): {
  results: CaseRunResult[];
  summaries: CandidateSummary[];
} {
  const candidates = args?.candidates ?? AUTOCOMPLETE_CANDIDATES;
  const cases = args?.cases ?? AUTOCOMPLETE_CASES;
  const casesById = new Map(cases.map((c) => [c.id, c]));
  const results: CaseRunResult[] = [];

  for (const candidate of candidates) {
    const seenGroups = new Set<string>();
    for (const testCase of cases) {
      const isCacheFollowup = Boolean(
        testCase.cacheGroup && seenGroups.has(testCase.cacheGroup)
      );
      if (testCase.cacheGroup) {
        seenGroups.add(testCase.cacheGroup);
      }

      const rawText = testCase.expectEmpty
        ? candidate.promptMode === "legacy_json_no_history"
          ? '{"completion":"__NO_COMPLETION__"}'
          : "__NO_COMPLETION__"
        : candidate.promptMode === "legacy_json_no_history"
          ? '{"completion":"the next step"}'
          : "a quick follow-up based on the thread";

      const suggestion = finalizeCandidateSuggestion({
        rawText,
        mode: candidate.promptMode,
        testCase,
        maxSuggestionChars: candidate.maxSuggestionChars,
        maxSuggestionWords: candidate.maxSuggestionWords,
      });

      const checks = evaluateDeterministicChecks({
        testCase,
        mode: candidate.promptMode,
        rawText,
        suggestion,
      });

      results.push({
        caseId: testCase.id,
        surface: testCase.surface,
        cacheGroup: testCase.cacheGroup,
        isCacheFollowup,
        candidateId: candidate.id,
        rawText,
        suggestion,
        ttftMs: 120,
        totalLatencyMs: 180,
        inputTokens: 280,
        outputTokens: 10,
        cachedInputTokens: isCacheFollowup ? 200 : 0,
        reasoningTokens: 0,
        costUsd: 0,
        modelObserved: candidate.model,
        providerObserved: "dry-run",
        checks,
      });
    }
  }

  const summaries = candidates.map((candidate) =>
    summarizeCandidateResults({
      candidate,
      results: results.filter((r) => r.candidateId === candidate.id),
      casesById,
    })
  );

  return { results, summaries };
}

async function main() {
  const parsed = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      judge: { type: "boolean", default: false },
      samples: { type: "boolean", default: false },
      candidates: { type: "string" },
      "max-spend": { type: "string" },
      "judge-model": { type: "string" },
      help: { type: "boolean", default: false },
    },
  });

  if (parsed.values.help) {
    console.log(`Inline autocomplete benchmark

  pnpm benchmark:autocomplete                         Run all candidates on 20 cases
  pnpm benchmark:autocomplete --dry-run               Run synthetic check at $0
  pnpm benchmark:autocomplete --candidates id1,id2    Run a subset of candidates
  pnpm benchmark:autocomplete --judge                 Add blind LLM quality grading
  pnpm benchmark:autocomplete --samples               Print side-by-side completions
  pnpm benchmark:autocomplete --max-spend 0.50        Hard USD ceiling (default: 0.50)

Available candidates:
${AUTOCOMPLETE_CANDIDATES.map((c) => `  - ${c.id.padEnd(24)} ${c.label}`).join("\n")}`);
    return;
  }

  const selectedIds = parsed.values.candidates
    ? new Set(
        parsed.values.candidates
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    : null;

  const candidates = selectedIds
    ? AUTOCOMPLETE_CANDIDATES.filter((c) => selectedIds.has(c.id))
    : AUTOCOMPLETE_CANDIDATES;

  if (candidates.length === 0) {
    console.error("No matching candidates found. Run with --help to list IDs.");
    process.exitCode = 1;
    return;
  }

  if (parsed.values["dry-run"]) {
    const { results, summaries } = runDryAutocompleteBenchmark({ candidates });
    console.log(formatSummaryTable(summaries));
    if (parsed.values.samples) {
      console.log(
        formatSampleCompletions({
          cases: AUTOCOMPLETE_CASES,
          results,
          sampleCaseIds: SAMPLE_CASE_IDS,
        })
      );
    }
    console.log("\nDry run complete ($0 spent).");
    return;
  }

  const apiKey = await loadOpenRouterApiKey(process.cwd());
  if (!apiKey) {
    console.error(
      "Missing OPENROUTER_API_KEY in environment or .env.local/.env."
    );
    process.exitCode = 1;
    return;
  }

  const maxSpendUsd = parsed.values["max-spend"]
    ? Number(parsed.values["max-spend"])
    : DEFAULT_MAX_SPEND_USD;
  if (!Number.isFinite(maxSpendUsd) || maxSpendUsd <= 0) {
    console.error("Invalid --max-spend value.");
    process.exitCode = 1;
    return;
  }

  const openrouter = createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": "https://reacherx.com",
      "X-Title": "ReacherX-Autocomplete-Benchmark",
    },
  });

  const casesById = new Map(AUTOCOMPLETE_CASES.map((c) => [c.id, c]));
  const allResults: CaseRunResult[] = [];
  let totalSpendUsd = 0;
  let budgetExceeded = false;

  console.error(
    `Running ${candidates.length} candidates x ${AUTOCOMPLETE_CASES.length} cases (spend cap: $${maxSpendUsd.toFixed(2)})...`
  );

  for (const candidate of candidates) {
    if (budgetExceeded) break;

    // Single untimed warmup call so TLS/provider routing is warm before measuring.
    const warmup = await runSingleLiveCase({
      openrouter,
      candidate,
      testCase: AUTOCOMPLETE_CASES[0]!,
      isCacheFollowup: false,
    });
    totalSpendUsd += warmup.costUsd;

    const seenGroups = new Set<string>();
    const candidateResults: CaseRunResult[] = [];

    for (const testCase of AUTOCOMPLETE_CASES) {
      if (totalSpendUsd >= maxSpendUsd) {
        budgetExceeded = true;
        console.error(
          `Stopped early: spend reached $${totalSpendUsd.toFixed(4)} (cap $${maxSpendUsd.toFixed(2)}).`
        );
        break;
      }

      const isCacheFollowup = Boolean(
        testCase.cacheGroup && seenGroups.has(testCase.cacheGroup)
      );
      if (testCase.cacheGroup) {
        seenGroups.add(testCase.cacheGroup);
      }

      const result = await runSingleLiveCase({
        openrouter,
        candidate,
        testCase,
        isCacheFollowup,
      });
      totalSpendUsd += result.costUsd;
      candidateResults.push(result);
      allResults.push(result);
    }

    const doneSummary = summarizeCandidateResults({
      candidate,
      results: candidateResults,
      casesById,
    });
    console.error(
      `  done ${candidate.id.padEnd(24)} p50=${Math.round(doneSummary.latencyP50Ms)}ms ttft=${doneSummary.ttftP50Ms ? Math.round(doneSummary.ttftP50Ms) : "-"}ms $/1k=$${doneSummary.costPer1kUsd.toFixed(4)} pass=${Math.round(doneSummary.deterministicPassRate * 100)}% err=${doneSummary.errorCount}`
    );
  }

  let verdicts = undefined;
  let judgeCostUsd = 0;
  if (parsed.values.judge && !budgetExceeded) {
    const judgeModel = parsed.values["judge-model"] ?? DEFAULT_JUDGE_MODEL;
    console.error(`\nRunning blind quality judge (${judgeModel})...`);
    const judged = await runBlindJudge({
      cases: AUTOCOMPLETE_CASES,
      results: allResults,
      judgeModel,
      callJudge: openRouterStructured(apiKey),
    });
    verdicts = judged.verdicts;
    judgeCostUsd = judged.judgeCostUsd;
    totalSpendUsd += judgeCostUsd;
  }

  const summaries = candidates.map((candidate) =>
    summarizeCandidateResults({
      candidate,
      results: allResults.filter((r) => r.candidateId === candidate.id),
      casesById,
      verdicts,
    })
  );

  console.log("\n" + formatSummaryTable(summaries));
  if (parsed.values.samples) {
    console.log(
      formatSampleCompletions({
        cases: AUTOCOMPLETE_CASES,
        results: allResults,
        sampleCaseIds: SAMPLE_CASE_IDS,
      })
    );
  }
  console.log(
    `\nTotal benchmark spend: $${totalSpendUsd.toFixed(4)}${judgeCostUsd > 0 ? ` (includes $${judgeCostUsd.toFixed(4)} blind judge)` : ""}`
  );
}

const isEntrypoint =
  process.argv[1] &&
  path
    .resolve(process.argv[1])
    .endsWith(path.join("benchmarks", "inline-autocomplete", "runner.ts"));

if (isEntrypoint) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
