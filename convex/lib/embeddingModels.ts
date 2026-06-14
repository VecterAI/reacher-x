import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const OPENAI_TEXT_EMBEDDING_MODEL = "text-embedding-3-small";
const OPENROUTER_TEXT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Shared embedding provider selection for agent/RAG vector search.
 *
 * Prefer the native OpenAI AI SDK provider when available. The OpenRouter
 * embedding shim currently emits compatibility warnings in Convex logs for
 * this model, so OpenRouter remains a fallback rather than the default.
 */
export function getTextEmbeddingModel() {
  if (process.env.OPENAI_API_KEY) {
    return openai.embedding(OPENAI_TEXT_EMBEDDING_MODEL);
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    return createOpenRouter({
      apiKey: openRouterApiKey,
      headers: {
        "HTTP-Referer": "https://reacherx.com",
        "X-Title": "ReacherX",
      },
    }).textEmbeddingModel(OPENROUTER_TEXT_EMBEDDING_MODEL);
  }

  throw new Error(
    "[Embeddings] Missing OPENAI_API_KEY and OPENROUTER_API_KEY environment variables."
  );
}
