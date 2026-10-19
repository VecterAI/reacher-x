import assert from "node:assert/strict";
import test from "node:test";
import {
  outreachPromptCacheMiddleware,
  sanitizeUsageSnapshotForConvex,
} from "../convex/lib/agentMetadata";
import { extractUsage } from "../convex/lib/ai";

test("outreach cache middleware marks the workspace context boundary", async () => {
  const transformParams = outreachPromptCacheMiddleware.transformParams;
  assert.ok(transformParams);

  const params = {
    prompt: [
      { role: "system" as const, content: "agent instructions" },
      { role: "system" as const, content: "workspace description" },
      { role: "system" as const, content: "dynamic prospect profile" },
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: "Help" }],
      },
    ],
  };
  const transformed = await transformParams({
    type: "generate",
    params,
    model: {} as never,
  });

  assert.equal(transformed.prompt[0].providerOptions, undefined);
  assert.deepEqual(transformed.prompt[1].providerOptions, {
    openrouter: { cacheControl: { type: "ephemeral" } },
  });
  assert.equal(transformed.prompt[2].providerOptions, undefined);
});

test("agent usage telemetry preserves AI SDK cache reads and writes", () => {
  const usage = sanitizeUsageSnapshotForConvex({
    inputTokens: 12_000,
    outputTokens: 800,
    totalTokens: 12_800,
    inputTokenDetails: {
      noCacheTokens: 2_000,
      cacheReadTokens: 9_000,
      cacheWriteTokens: 1_000,
    },
  });

  assert.deepEqual(usage, {
    inputTokens: 12_000,
    outputTokens: 800,
    totalTokens: 12_800,
    cachedInputTokens: 9_000,
    cacheReadTokens: 9_000,
    cacheWriteTokens: 1_000,
    noCacheTokens: 2_000,
  });
});

test("generic usage extraction exposes OpenRouter cache details", () => {
  const usage = extractUsage({
    usage: {
      inputTokens: 12_000,
      outputTokens: 800,
      totalTokens: 12_800,
      inputTokenDetails: {
        noCacheTokens: 2_000,
        cacheReadTokens: 9_000,
        cacheWriteTokens: 1_000,
      },
    },
    providerMetadata: {
      openrouter: {
        model: "openai/gpt-6-luna-pro",
        provider: "OpenAI",
        usage: { cost: "0.04" },
      },
    },
  });

  assert.deepEqual(usage, {
    inputTokens: 12_000,
    outputTokens: 800,
    totalTokens: 12_800,
    cost: 0.04,
    modelSelected: "openai/gpt-6-luna-pro",
    providerSelected: "OpenAI",
    cacheReadTokens: 9_000,
    cacheWriteTokens: 1_000,
    noCacheTokens: 2_000,
  });
});
