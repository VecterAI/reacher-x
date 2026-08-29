import assert from "node:assert/strict";
import test from "node:test";
import {
  combineStructuredGenerationErrors,
  getStructuredAttemptProviderOptions,
  StructuredGenerationError,
  type OpenRouterProviderOptions,
} from "../convex/lib/structuredOutputCore";

const orderedProviders: OpenRouterProviderOptions = {
  openrouter: {
    provider: {
      order: ["cerebras", "groq"],
      allow_fallbacks: true,
      require_parameters: false,
    },
  },
};

test("structured retries pin different providers after malformed success", () => {
  const first = getStructuredAttemptProviderOptions({
    providerOptions: orderedProviders,
    attemptIndex: 0,
    totalAttempts: 2,
    requireStructuredOutput: true,
  });
  const second = getStructuredAttemptProviderOptions({
    providerOptions: orderedProviders,
    attemptIndex: 1,
    totalAttempts: 2,
    requireStructuredOutput: true,
  });

  assert.equal(first.configuredProvider, "cerebras");
  assert.deepEqual(first.providerOptions.openrouter.provider.only, [
    "cerebras",
  ]);
  assert.equal(
    first.providerOptions.openrouter.provider.allow_fallbacks,
    false
  );
  assert.equal(
    first.providerOptions.openrouter.provider.require_parameters,
    true
  );
  assert.equal(second.configuredProvider, "groq");
  assert.deepEqual(second.providerOptions.openrouter.provider.only, ["groq"]);
});

test("one-shot recovery retains request-level provider fallback", () => {
  const recovery = getStructuredAttemptProviderOptions({
    providerOptions: orderedProviders,
    attemptIndex: 0,
    totalAttempts: 1,
    requireStructuredOutput: true,
  });

  assert.equal(recovery.configuredProvider, "cerebras/groq");
  assert.equal(
    recovery.providerOptions.openrouter.provider.allow_fallbacks,
    true
  );
  assert.deepEqual(recovery.providerOptions.openrouter.provider.order, [
    "cerebras",
    "groq",
  ]);
});

test("fallback errors preserve every provider attempt", () => {
  const primary = new StructuredGenerationError({
    operation: "qualifyProspect",
    attempts: [
      {
        attemptNumber: 1,
        routing: "reasoning",
        model: "openai/gpt-oss-120b",
        configuredProvider: "cerebras",
        durationMs: 100,
        errorMessage: "Unexpected end of JSON input",
      },
      {
        attemptNumber: 2,
        routing: "reasoning",
        model: "openai/gpt-oss-120b",
        configuredProvider: "groq",
        durationMs: 110,
        errorMessage: "Unexpected end of JSON input",
      },
    ],
  });
  const recovery = new StructuredGenerationError({
    operation: "qualifyProspect",
    attempts: [
      {
        attemptNumber: 1,
        routing: "onboarding",
        model: "openai/gpt-5.6-sol",
        configuredProvider: "openai/azure",
        durationMs: 120,
        errorMessage: "Structured output did not match the required schema",
      },
    ],
  });

  const combined = combineStructuredGenerationErrors({
    operation: "qualifyProspect",
    errors: [primary, recovery],
  });

  assert.equal(combined.attempts.length, 3);
  assert.deepEqual(
    combined.attempts.map((attempt) => attempt.configuredProvider),
    ["cerebras", "groq", "openai/azure"]
  );
});
