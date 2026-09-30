/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getTextEmbeddingModel } from "./embeddingModels";

const { openRouterEmbeddingModel, openAIEmbeddingModel } = vi.hoisted(() => {
  const createStubModel = () => ({
    specificationVersion: "v3" as const,
    provider: "stub",
    modelId: "stub-model",
    maxEmbeddingsPerCall: undefined,
    supportsParallelCalls: true,
    doEmbed: vi.fn(),
  });
  return {
    openRouterEmbeddingModel: createStubModel(),
    openAIEmbeddingModel: createStubModel(),
  };
});

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => ({
    textEmbeddingModel: () => openRouterEmbeddingModel,
  }),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: {
    embedding: () => openAIEmbeddingModel,
  },
}));

beforeEach(() => {
  openRouterEmbeddingModel.doEmbed.mockReset();
  openAIEmbeddingModel.doEmbed.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

function stubOpenRouterOnly() {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("OPENROUTER_API_KEY", "test-only-key");
}

function stubBothProviders() {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  vi.stubEnv("OPENROUTER_API_KEY", "test-only-key");
}

function stubOpenAIOnly() {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  vi.stubEnv("OPENROUTER_API_KEY", "");
}

function expectModelInstance(model: ReturnType<typeof getTextEmbeddingModel>) {
  if (typeof model === "string")
    throw new Error("Expected a provider instance");
  return model;
}

function makeEmbedResult(values: string[]) {
  return {
    embeddings: values.map(() => Array.from({ length: 1536 }, () => 0.1)),
    usage: { tokens: 8 },
    warnings: [],
  };
}

test("reports the canonical model id with OpenRouter as primary", () => {
  stubOpenRouterOnly();
  const model = expectModelInstance(getTextEmbeddingModel());
  expect(model.modelId).toBe("text-embedding-3-small");
  expect(model.maxEmbeddingsPerCall).toBe(2048);
  expect(typeof model.doEmbed).toBe("function");
});

test("reports the canonical model id with OpenAI as the only provider", () => {
  stubOpenAIOnly();
  const model = expectModelInstance(getTextEmbeddingModel());
  expect(model.modelId).toBe("text-embedding-3-small");
});

test("throws when no embedding provider key is configured", () => {
  stubOpenRouterOnly();
  vi.stubEnv("OPENROUTER_API_KEY", "");
  expect(() => getTextEmbeddingModel()).toThrow(
    "[Embeddings] Missing OPENAI_API_KEY and OPENROUTER_API_KEY environment variables."
  );
});

test("delegates to OpenAI when the primary OpenRouter call fails", async () => {
  stubBothProviders();
  const model = expectModelInstance(getTextEmbeddingModel());
  const values = ["Who is @Jarl Nylund"];
  const primaryError = Object.assign(
    new Error("You have no credits remaining."),
    { name: "AI_APICallError", url: "https://openrouter.ai/api/v1/embeddings" }
  );
  openRouterEmbeddingModel.doEmbed.mockRejectedValue(primaryError);
  openAIEmbeddingModel.doEmbed.mockResolvedValue(makeEmbedResult(values));

  const result = await model.doEmbed({
    values,
    abortSignal: undefined,
    headers: undefined,
    providerOptions: undefined,
  });

  expect(openAIEmbeddingModel.doEmbed).toHaveBeenCalledTimes(1);
  expect(result.embeddings).toHaveLength(1);
  expect(result.embeddings[0]).toHaveLength(1536);
});

test("does not touch the fallback provider when the primary call succeeds", async () => {
  stubBothProviders();
  const model = expectModelInstance(getTextEmbeddingModel());
  const values = ["Who is @Jarl Nylund"];
  openRouterEmbeddingModel.doEmbed.mockResolvedValue(makeEmbedResult(values));

  const result = await model.doEmbed({
    values,
    abortSignal: undefined,
    headers: undefined,
    providerOptions: undefined,
  });

  expect(openRouterEmbeddingModel.doEmbed).toHaveBeenCalledTimes(1);
  expect(openAIEmbeddingModel.doEmbed).not.toHaveBeenCalled();
  expect(result.embeddings).toHaveLength(1);
});

test("does not reroute an aborted call to the fallback provider", async () => {
  stubBothProviders();
  const model = expectModelInstance(getTextEmbeddingModel());
  const values = ["Who is @Jarl Nylund"];
  const abortController = new AbortController();
  abortController.abort();
  openRouterEmbeddingModel.doEmbed.mockRejectedValue(
    new Error("This operation was aborted")
  );

  await expect(
    model.doEmbed({
      values,
      abortSignal: abortController.signal,
      headers: undefined,
      providerOptions: undefined,
    })
  ).rejects.toThrow("This operation was aborted");
  expect(openAIEmbeddingModel.doEmbed).not.toHaveBeenCalled();
});

test("propagates the fallback error when both providers fail", async () => {
  stubBothProviders();
  const model = expectModelInstance(getTextEmbeddingModel());
  openRouterEmbeddingModel.doEmbed.mockRejectedValue(
    new Error("OpenRouter is down")
  );
  openAIEmbeddingModel.doEmbed.mockRejectedValue(
    Object.assign(new Error("Insufficient quota"), {
      name: "AI_APICallError",
      url: "https://api.openai.com/v1/embeddings",
    })
  );

  await expect(
    model.doEmbed({
      values: ["Who is @Jarl Nylund"],
      abortSignal: undefined,
      headers: undefined,
      providerOptions: undefined,
    })
  ).rejects.toThrow("Insufficient quota");
});
