"use node";

// Thin HTTP client for TypeSafe Jev (System One decision model) via the
// OpenRouter Decisions API. Pure transport: no business logic, no Convex
// database access. Callers own state construction and answer interpretation.

import { getConfiguredModel } from "./modelConfigHelpers";

const JEV_DECISIONS_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
const DEFAULT_JEV_MODEL = "typesafe/jev-1.13";
const JEV_REQUEST_TIMEOUT_MS = 15_000;
const JEV_RETRY_ATTEMPTS = 3;
const JEV_RETRY_BACKOFF_BASE_MS = 300;

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 524, 529]);

/** Choice answers this unconfident carry no signal and are worth a retry. */
const DEGENERATE_CONFIDENCE_THRESHOLD = 0.02;

export function isDegenerateJevAnswers(
  answers: Record<string, JevAnswer>
): boolean {
  return Object.values(answers).some((answer) => {
    if (answer.type !== "choice") return false;
    const chosenProbability =
      typeof answer.confidence === "number"
        ? answer.confidence
        : answer.probabilities?.[answer.choice];
    return (
      chosenProbability === undefined ||
      chosenProbability <= DEGENERATE_CONFIDENCE_THRESHOLD
    );
  });
}

export type JevNoulQuestion = {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
};

export type JevChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type JevScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type JevQuestion =
  | JevNoulQuestion
  | JevChoiceQuestion
  | JevScoreQuestion;

export type JevRequest = {
  state: unknown;
  questions: Record<string, JevQuestion>;
  sessionId?: string;
};

export type JevNoulAnswer = {
  type: "noul";
  noul: number;
};

export type JevChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence?: number;
  probabilities?: Record<string, number>;
};

export type JevScoreAnswer = {
  type: "score";
  score: number;
  confidence?: number;
  probabilities?: Record<string, number>;
  legend?: Record<string, string>;
};

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer;

export type JevUsage = {
  cost: number;
  inputTokens: number;
  outputTokens: number;
};

export type JevResponse = {
  id: string;
  model: string;
  provider: string;
  answers: Record<string, JevAnswer>;
  usage: JevUsage;
};

export type JevCallResult = {
  response: JevResponse;
  latencyMs: number;
  attempts: number;
};

export class JevClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JevClientError";
  }
}

/** Transient failure (rate limit, provider hiccup, timeout) worth retrying. */
class JevRetryableError extends JevClientError {}

export function getJevModel(): string {
  return getConfiguredModel("AI_JEV_MODEL", DEFAULT_JEV_MODEL);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryBackoffMs(attempt: number): number {
  const jitter = Math.floor(Math.random() * 150);
  return JEV_RETRY_BACKOFF_BASE_MS * 2 ** attempt + jitter;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (isRecord(body) && isRecord(body.error)) {
    const message = body.error.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "number")
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function normalizeUsage(value: unknown): JevUsage {
  const source = isRecord(value) ? value : {};
  return {
    cost: typeof source.cost === "number" ? source.cost : 0,
    inputTokens:
      typeof source.input_tokens === "number" ? source.input_tokens : 0,
    outputTokens:
      typeof source.output_tokens === "number" ? source.output_tokens : 0,
  };
}

function normalizeAnswer(value: unknown): JevAnswer | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "noul" && typeof value.noul === "number") {
    return { type: "noul", noul: value.noul };
  }
  if (value.type === "choice" && typeof value.choice === "string") {
    return {
      type: "choice",
      choice: value.choice,
      confidence:
        typeof value.confidence === "number" ? value.confidence : undefined,
      probabilities: isNumberRecord(value.probabilities)
        ? value.probabilities
        : undefined,
    };
  }
  if (value.type === "score" && typeof value.score === "number") {
    return {
      type: "score",
      score: value.score,
      confidence:
        typeof value.confidence === "number" ? value.confidence : undefined,
      probabilities: isNumberRecord(value.probabilities)
        ? value.probabilities
        : undefined,
      legend: isStringRecord(value.legend) ? value.legend : undefined,
    };
  }
  return null;
}

export async function callJevDecisions(
  args: JevRequest
): Promise<JevCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new JevClientError(
      "Missing OPENROUTER_API_KEY environment variable. Jev decisions calls are routed through OpenRouter."
    );
  }

  if (Object.keys(args.questions).length === 0) {
    throw new JevClientError(
      "Jev decisions request requires at least one question."
    );
  }

  const body: Record<string, unknown> = {
    model: getJevModel(),
    state: args.state,
    questions: args.questions,
  };
  if (args.sessionId) {
    body.session_id = args.sessionId.slice(0, 256);
  }

  let lastError: Error = new JevClientError(
    "Jev decisions request failed for an unknown reason"
  );
  // Every attempt is billed by OpenRouter, so cost/latency totals must
  // accumulate across retries (including degenerate-answer retries).
  const accumulatedUsage: JevUsage = {
    cost: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  let accumulatedLatencyMs = 0;
  for (let attempt = 0; attempt < JEV_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      JEV_REQUEST_TIMEOUT_MS
    );
    const startedAt = Date.now();
    let isRetryable = false;
    try {
      const response = await fetch(JEV_DECISIONS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;
      accumulatedLatencyMs += latencyMs;
      let rawBody: unknown;
      try {
        rawBody = await response.json();
      } catch (parseError) {
        // A timeout firing mid-body read surfaces as AbortError and must stay
        // retryable; only malformed JSON bodies degrade to "no answers".
        if (parseError instanceof Error && parseError.name === "AbortError") {
          throw parseError;
        }
        rawBody = undefined;
      }

      if (!response.ok) {
        const message = getErrorMessage(
          rawBody,
          `HTTP ${response.status} from the Jev decisions API`
        );
        if (
          RETRYABLE_STATUS_CODES.has(response.status) &&
          attempt < JEV_RETRY_ATTEMPTS - 1
        ) {
          isRetryable = true;
          lastError = new JevRetryableError(
            `Jev decisions request failed (status ${response.status}): ${message}`
          );
        } else {
          throw new JevClientError(
            `Jev decisions request failed (status ${response.status}): ${message}`
          );
        }
      } else {
        const parsed = isRecord(rawBody) ? rawBody : null;
        const answersRecord = isRecord(parsed?.answers) ? parsed.answers : null;
        if (!parsed || !answersRecord) {
          throw new JevClientError(
            "Jev decisions response did not include a valid answers object."
          );
        }

        const answers: Record<string, JevAnswer> = {};
        for (const [questionId, value] of Object.entries(answersRecord)) {
          const answer = normalizeAnswer(value);
          if (answer) answers[questionId] = answer;
        }
        if (Object.keys(answers).length === 0) {
          throw new JevClientError(
            "Jev decisions response contained no parsable answers."
          );
        }

        const usage = normalizeUsage(parsed.usage);
        accumulatedUsage.cost += usage.cost;
        accumulatedUsage.inputTokens += usage.inputTokens;
        accumulatedUsage.outputTokens += usage.outputTokens;
        const degenerate =
          isDegenerateJevAnswers(answers) && attempt < JEV_RETRY_ATTEMPTS - 1;
        if (degenerate) {
          console.warn(
            `[JevClient] Degenerate Jev choice answers (confidence <= ${DEGENERATE_CONFIDENCE_THRESHOLD}); retrying (attempt ${
              attempt + 1
            }/${JEV_RETRY_ATTEMPTS})`
          );
        } else {
          return {
            response: {
              id: typeof parsed.id === "string" ? parsed.id : "",
              model:
                typeof parsed.model === "string" ? parsed.model : getJevModel(),
              provider:
                typeof parsed.provider === "string" ? parsed.provider : "",
              answers,
              usage: accumulatedUsage,
            },
            latencyMs: accumulatedLatencyMs,
            attempts: attempt + 1,
          };
        }
      }
    } catch (error) {
      if (
        error instanceof JevClientError &&
        !(error instanceof JevRetryableError)
      ) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new JevRetryableError(
          `Jev decisions request timed out after ${JEV_REQUEST_TIMEOUT_MS}ms`
        );
        isRetryable = true;
      } else if (!(error instanceof JevRetryableError)) {
        // Network-level fetch failures are transient.
        lastError = new JevRetryableError(
          `Jev decisions request failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        isRetryable = true;
      }
      if (!isRetryable || attempt >= JEV_RETRY_ATTEMPTS - 1) {
        throw lastError;
      }
      console.warn(
        `[JevClient] Retrying Jev decisions call (attempt ${attempt + 1}/${
          JEV_RETRY_ATTEMPTS
        }): ${lastError.message}`
      );
    } finally {
      clearTimeout(timeout);
    }

    await sleep(getRetryBackoffMs(attempt));
  }

  throw lastError;
}
