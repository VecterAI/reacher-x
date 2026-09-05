import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { EmbeddingModel } from "ai";
import { getConfiguredModel } from "./modelConfigHelpers";

const DEFAULT_TEXT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Shared embedding provider selection for agent/RAG vector search.
 *
 * Prefer the native OpenAI AI SDK provider when available. The OpenRouter
 * embedding shim currently emits compatibility warnings in Convex logs for
 * this model, so OpenRouter remains a fallback rather than the default.
 */
export function getTextEmbeddingModel(): EmbeddingModel {
  const configuredModel = getConfiguredModel(
    "AI_TEXT_EMBEDDING_MODEL",
    DEFAULT_TEXT_EMBEDDING_MODEL
  );

  if (process.env.OPENAI_API_KEY && configuredModel.startsWith("openai/")) {
    return openai.embedding(configuredModel.slice("openai/".length));
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    return createOpenRouter({
      apiKey: openRouterApiKey,
      headers: {
        "HTTP-Referer": "https://reacherx.com",
        "X-Title": "ReacherX",
      },
    }).textEmbeddingModel(configuredModel);
  }

  throw new Error(
    "[Embeddings] Missing OPENAI_API_KEY and OPENROUTER_API_KEY environment variables."
  );
}
