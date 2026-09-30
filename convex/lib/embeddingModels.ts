import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  wrapEmbeddingModel,
  type EmbeddingModel,
  type EmbeddingModelMiddleware,
} from "ai";
import { getConfiguredModel } from "./modelConfigHelpers";
import { logger } from "../../shared/lib/logger";

const DEFAULT_TEXT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

// OpenAI documents a hard cap of 2048 inputs per embeddings request. Apply the
// same cap to the OpenRouter-first path so large embed batches stay valid for
// either provider.
const MAX_EMBEDDINGS_PER_CALL = 2048;

const embeddingLogger = logger.withScope("Embeddings");

// Extracted from the AI SDK's own middleware contract: an embedding model
// object (not a dynamic model string).
type EmbeddingModelV3Like = Parameters<
  NonNullable<EmbeddingModelMiddleware["wrapEmbed"]>
>[0]["model"];

/**
 * Shared embedding provider selection for agent/RAG vector search.
 *
 * OpenRouter is the primary provider: it exposes a first-class embeddings
 * endpoint (https://openrouter.ai/docs/api_reference/embeddings) and bills
 * under the same credits as the chat models. The native OpenAI provider is
 * the automatic failover so a single-provider outage or credit exhaustion
 * cannot break agent turns.
 */
export function getTextEmbeddingModel(): EmbeddingModel {
  const configuredModel = getConfiguredModel(
    "AI_TEXT_EMBEDDING_MODEL",
    DEFAULT_TEXT_EMBEDDING_MODEL
  );

  const openRouterEmbedding = createOpenRouterEmbeddingModel(configuredModel);
  const openAIEmbedding = createOpenAIEmbeddingModel(configuredModel);

  const primary = openRouterEmbedding ?? openAIEmbedding;
  if (!primary) {
    throw new Error(
      "[Embeddings] Missing OPENAI_API_KEY and OPENROUTER_API_KEY environment variables."
    );
  }

  // The agent component labels stored vectors with `model.modelId`. Report the
  // canonical model id so vectors keep the same label no matter which provider
  // served the request.
  return wrapEmbeddingModel({
    model: primary,
    middleware: [
      createEmbeddingResilienceMiddleware(
        primary === openRouterEmbedding ? openAIEmbedding : null
      ),
    ],
    modelId: getCanonicalEmbeddingModelId(configuredModel),
  });
}

function createOpenRouterEmbeddingModel(
  configuredModel: string
): EmbeddingModelV3Like | null {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    return null;
  }

  return createOpenRouter({
    apiKey: openRouterApiKey,
    headers: {
      "HTTP-Referer": "https://reacherx.com",
      "X-Title": "ReacherX",
    },
  }).textEmbeddingModel(configuredModel);
}

function createOpenAIEmbeddingModel(
  configuredModel: string
): EmbeddingModelV3Like | null {
  if (!process.env.OPENAI_API_KEY || !configuredModel.startsWith("openai/")) {
    return null;
  }

  return openai.embedding(configuredModel.slice("openai/".length));
}

function createEmbeddingResilienceMiddleware(
  fallback: EmbeddingModelV3Like | null
): EmbeddingModelMiddleware {
  return {
    specificationVersion: "v3",
    overrideMaxEmbeddingsPerCall: () => MAX_EMBEDDINGS_PER_CALL,
    ...(fallback
      ? {
          wrapEmbed: async ({ doEmbed, params }) => {
            try {
              return await doEmbed();
            } catch (error) {
              // An aborted call is user-intentional; never reroute it.
              if (params.abortSignal?.aborted) {
                throw error;
              }
              embeddingLogger.warn(
                "Primary embedding provider failed; retrying with the fallback provider",
                error
              );
              return await fallback.doEmbed(params);
            }
          },
        }
      : {}),
  };
}

function getCanonicalEmbeddingModelId(configuredModel: string): string {
  return configuredModel.includes("/")
    ? configuredModel.slice(configuredModel.indexOf("/") + 1)
    : configuredModel;
}
