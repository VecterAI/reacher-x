import { afterEach, expect, test, vi } from "vitest";
import { getTextEmbeddingModel } from "./embeddingModels";

afterEach(() => vi.unstubAllEnvs());

test("constructs the installed OpenRouter embedding provider when OpenAI is unavailable", () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("OPENROUTER_API_KEY", "test-only-key");
  vi.stubEnv("AI_TEXT_EMBEDDING_MODEL", "openai/text-embedding-3-small");
  const model = getTextEmbeddingModel();
  if (typeof model === "string")
    throw new Error("Expected a provider instance");
  expect(model.modelId).toBe("openai/text-embedding-3-small");
  expect(typeof model.doEmbed).toBe("function");
});
