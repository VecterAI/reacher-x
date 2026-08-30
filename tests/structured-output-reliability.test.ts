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

test("structured retries preserve fallback and exclude a failed provider", () => {
  const first = getStructuredAttemptProviderOptions({
    providerOptions: orderedProviders,
    requireStructuredOutput: true,
  });
  const second = getStructuredAttemptProviderOptions({
    providerOptions: orderedProviders,
    ignoredProviders: ["cerebras"],
    requireStructuredOutput: true,
  });

  assert.equal(first.configuredProvider, "cerebras/groq");
  assert.equal(first.providerOptions.openrouter.provider.only, undefined);
  assert.equal(first.providerOptions.openrouter.provider.allow_fallbacks, true);
  assert.equal(
    first.providerOptions.openrouter.provider.require_parameters,
    true
  );
  assert.equal(second.configuredProvider, "cerebras/groq excluding cerebras");
  assert.deepEqual(second.providerOptions.openrouter.provider.order, ["groq"]);
  assert.deepEqual(second.providerOptions.openrouter.provider.ignore, [
    "cerebras",
  ]);
  assert.equal(second.providerOptions.openrouter.provider.only, undefined);
  assert.equal(
    second.providerOptions.openrouter.provider.allow_fallbacks,
    true
  );
});

test("structured retries escape an exhausted provider-only allowlist", () => {
  const retry = getStructuredAttemptProviderOptions({
    providerOptions: {
      openrouter: {
        provider: {
          only: ["cerebras"],
          require_parameters: true,
        },
      },
    },
    ignoredProviders: ["Cerebras"],
    requireStructuredOutput: true,
  });

  assert.equal(retry.providerOptions.openrouter.provider.only, undefined);
  assert.deepEqual(retry.providerOptions.openrouter.provider.ignore, [
    "Cerebras",
  ]);
  assert.equal(retry.providerOptions.openrouter.provider.allow_fallbacks, true);
});

test("one-shot recovery retains request-level provider fallback", () => {
  const recovery = getStructuredAttemptProviderOptions({
    providerOptions: orderedProviders,
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

test("structured output overrides a disabled provider fallback", () => {
  const result = getStructuredAttemptProviderOptions({
    providerOptions: {
      openrouter: {
        provider: {
          order: ["baseten", "wandb"],
          allow_fallbacks: false,
        },
      },
    },
    requireStructuredOutput: true,
  });

  assert.equal(
    result.providerOptions.openrouter.provider.allow_fallbacks,
    true
  );
  assert.equal(
    result.providerOptions.openrouter.provider.require_parameters,
    true
  );
  assert.equal(result.providerOptions.openrouter.provider.only, undefined);
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
