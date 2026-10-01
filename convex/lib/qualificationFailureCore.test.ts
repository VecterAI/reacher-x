import { describe, expect, test } from "vitest";
import {
  getQualificationFailureRetryDelayMs,
  hasReachedQualificationRetryCap,
  isAiCreditExhaustionError,
  QUALIFICATION_MAX_WORKFLOW_ATTEMPTS,
} from "./qualificationFailureCore";

describe("hasReachedQualificationRetryCap", () => {
  test("allows retries below the cap", () => {
    expect(hasReachedQualificationRetryCap(0)).toBe(false);
    expect(hasReachedQualificationRetryCap(1)).toBe(false);
    expect(
      hasReachedQualificationRetryCap(QUALIFICATION_MAX_WORKFLOW_ATTEMPTS - 1)
    ).toBe(false);
  });

  test("blocks retries at and beyond the cap", () => {
    expect(
      hasReachedQualificationRetryCap(QUALIFICATION_MAX_WORKFLOW_ATTEMPTS)
    ).toBe(true);
    expect(
      hasReachedQualificationRetryCap(QUALIFICATION_MAX_WORKFLOW_ATTEMPTS + 3)
    ).toBe(true);
  });
});

describe("isAiCreditExhaustionError", () => {
  test("matches OpenRouter out-of-credit phrasing", () => {
    expect(
      isAiCreditExhaustionError(
        "Failed to generate keywords: Insufficient credits. Add more using https://openrouter.ai/settings/credits"
      )
    ).toBe(true);
    expect(
      isAiCreditExhaustionError(
        "This request requires more credits, or fewer max_tokens. You requested up to 16384 tokens, but can only afford 1056."
      )
    ).toBe(true);
    expect(isAiCreditExhaustionError("HTTP 402 Payment Required")).toBe(true);
  });

  test("does not match transient or unrelated failures", () => {
    expect(isAiCreditExhaustionError("HTTP 429 rate limit exceeded")).toBe(
      false
    );
    expect(isAiCreditExhaustionError("Structured output did not match")).toBe(
      false
    );
    expect(isAiCreditExhaustionError("request timed out after 15000ms")).toBe(
      false
    );
    expect(isAiCreditExhaustionError("workspace not found")).toBe(false);
  });
});

describe("getQualificationFailureRetryDelayMs", () => {
  test("backoff grows exponentially and caps at 24h", () => {
    expect(getQualificationFailureRetryDelayMs(1)).toBe(5 * 60 * 1000);
    expect(getQualificationFailureRetryDelayMs(2)).toBe(10 * 60 * 1000);
    expect(getQualificationFailureRetryDelayMs(10)).toBe(24 * 60 * 60 * 1000);
  });
});
