// convex/lib/ai.ts
// OpenRouter provider setup for Convex actions
// Docs: https://openrouter.ai/docs

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type JSONValue } from "ai";
import { z } from "zod";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

type OpenRouterProviderRouting = Record<string, JSONValue> & {
  only?: string[];
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
};

export type OpenRouterProviderOptions = {
  openrouter: Record<string, JSONValue> & {
    provider: OpenRouterProviderRouting;
  };
};

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Creates an OpenRouter provider instance.
 *
 * OpenRouter provides:
 * - Provider routing for speed-focused inference
 * - Model/provider fallbacks
 * - Usage tracking and selected provider metadata
 * - Structured outputs
 *
 * @see https://openrouter.ai/docs/guides/overview/principles
 *
 * @example
 * ```typescript
 * import { generateText } from 'ai';
 * import { createAIProvider, MODELS } from './lib/ai';
 *
 * const provider = createAIProvider();
 * const { text } = await generateText({
 *   model: provider(MODELS.KIMI_K2_6),
 *   providerOptions: AGENT_PROVIDER_OPTIONS,
 *   prompt: 'Hello!',
 * });
 * ```
 */
export function createAIProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "[AI] Missing OPENROUTER_API_KEY environment variable. " +
        "Get it from: https://openrouter.ai/settings/keys"
    );
  }

  return createOpenRouter({
    apiKey,
    // App attribution for OpenRouter analytics
    // https://openrouter.ai/docs/app-attribution
    headers: {
      "HTTP-Referer": "https://reacherx.com",
      "X-Title": "ReacherX",
    },
  });
}

// ============================================================================
// Model Identifiers
// ============================================================================

/** Available models via OpenRouter. */
export const MODELS = {
  KIMI_K2_6: "moonshotai/kimi-k2.6",
  GPT_OSS: "openai/gpt-oss-120b",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export const OPENROUTER_PROVIDERS = {
  BASETEN: "baseten",
  DECART: "decart",
  CEREBRAS: "cerebras",
} as const;

const FAST_MODEL_TIMEOUT_MS = 10_000;
const REASONING_MODEL_TIMEOUT_MS = 45_000;

/**
 * Kimi K2.6 is the primary high-intelligence model for agent/chat and
 * non-onboarding generation, with provider fallback on the same model.
 */
export const REASONING_MODEL = MODELS.KIMI_K2_6;

/**
 * GPT-OSS 120B on Cerebras is used where raw throughput is the main UX lever:
 * onboarding structured tasks, autocomplete, and fast draft repair.
 */
export const FAST_MODEL = MODELS.GPT_OSS;

export const AUTOCOMPLETE_MODEL = MODELS.GPT_OSS;

export const AGENT_PROVIDER_OPTIONS: OpenRouterProviderOptions = {
  openrouter: {
    provider: {
      order: [OPENROUTER_PROVIDERS.BASETEN, OPENROUTER_PROVIDERS.DECART],
      allow_fallbacks: true,
    },
  },
};

export type ModelRouting = "fast" | "reasoning";

export function getOpenRouterExtraBody(
  providerOptions: OpenRouterProviderOptions
): Record<string, JSONValue> {
  return providerOptions.openrouter;
}

function getModelForRouting(routing: ModelRouting) {
  if (routing === "fast") {
    return {
      model: MODELS.GPT_OSS,
      providerOptions: CEREBRAS_PROVIDER_OPTIONS,
      providerLabel: OPENROUTER_PROVIDERS.CEREBRAS,
      timeoutMs: FAST_MODEL_TIMEOUT_MS,
    };
  }

  return {
    model: MODELS.KIMI_K2_6,
    providerOptions: AGENT_PROVIDER_OPTIONS,
    providerLabel: `${OPENROUTER_PROVIDERS.BASETEN}/${OPENROUTER_PROVIDERS.DECART}`,
    timeoutMs: REASONING_MODEL_TIMEOUT_MS,
  };
}

export const CEREBRAS_PROVIDER_OPTIONS: OpenRouterProviderOptions = {
  openrouter: {
    provider: {
      only: [OPENROUTER_PROVIDERS.CEREBRAS],
      require_parameters: true,
    },
  },
};

// ============================================================================
// Usage Extraction
// ============================================================================

/**
 * Extracts usage information from AI SDK response.
 * Works with OpenRouter's usage tracking.
 *
 * @see https://openrouter.ai/docs/guides/community/vercel-ai-sdk
 */
export function extractUsage(result: {
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  providerMetadata?: any;
  experimental_providerMetadata?: any;
}): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
  modelSelected?: string;
  providerSelected?: string;
} {
  const usage = result.usage || {};
  const metadata =
    result.providerMetadata?.openrouter ??
    result.experimental_providerMetadata?.openrouter;

  // OpenRouter returns cost as a decimal string, so parse it
  const rawCost = metadata?.usage?.cost;
  const parsedCost =
    rawCost !== undefined ? parseFloat(String(rawCost)) : undefined;
  const cost =
    parsedCost !== undefined && isFinite(parsedCost) ? parsedCost : undefined;

  return {
    inputTokens: usage.promptTokens || 0,
    outputTokens: usage.completionTokens || 0,
    totalTokens: usage.totalTokens || 0,
    cost,
    modelSelected: metadata?.model,
    providerSelected: metadata?.provider,
  };
}

export function extractJsonPayload(text: string) {
  let jsonStr = text.trim();

  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  const objectStart = jsonStr.indexOf("{");
  const arrayStart = jsonStr.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) {
    return jsonStr;
  }

  const start = Math.min(...starts);
  const objectEnd = jsonStr.lastIndexOf("}");
  const arrayEnd = jsonStr.lastIndexOf("]");
  const end = Math.max(objectEnd, arrayEnd);

  if (end > start) {
    return jsonStr.slice(start, end + 1).trim();
  }

  return jsonStr;
}

// ============================================================================
// Robust Structured Output Generation
// ============================================================================

interface RobustGenerateObjectOptions<T> {
  /** Operation name for logging */
  operation: string;
  /** Zod schema for the output */
  schema: z.ZodType<T>;
  /** System prompt */
  system: string;
  /** User prompt */
  prompt: string;
  /** Temperature (default: 0.5) */
  temperature?: number;
  /** Maximum retry attempts per model (default: 2) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 500) */
  initialDelayMs?: number;
  /** fast = Cerebras GPT-OSS, reasoning = Kimi K2.6 with provider fallback */
  routing?: ModelRouting;
}

/**
 * Robustly generates a structured object with explicit model routing.
 * Onboarding paths use fast Cerebras inference; normal/background reasoning
 * paths use Kimi K2.6 with same-model provider fallback.
 */
export async function robustGenerateObject<T>({
  operation,
  schema,
  system,
  prompt,
  temperature = 0.5,
  maxRetries = 2,
  initialDelayMs = 500,
  routing = "reasoning",
}: RobustGenerateObjectOptions<T>): Promise<{
  object: T;
  model: string;
  usage: ReturnType<typeof extractUsage>;
  providerMetadata?: unknown;
}> {
  if (routing === "fast") {
    try {
      return await generateTextWithJsonParse({
        operation,
        schema,
        system,
        prompt,
        temperature,
        maxRetries: 1,
        initialDelayMs,
        routing,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.warn(
        `[AI] ${operation} fast JSON generation failed; falling back to reasoning route:`,
        errorMessage
      );

      return robustGenerateObject({
        operation,
        schema,
        system,
        prompt,
        temperature,
        maxRetries: 1,
        initialDelayMs,
        routing: "reasoning",
      });
    }
  }

  return generateTextWithJsonParse({
    operation,
    schema,
    system,
    prompt,
    temperature,
    maxRetries,
    initialDelayMs,
    routing,
  });
}

/**
 * Fallback: Generate text and manually parse JSON.
 * Use this when generateObject fails repeatedly.
 */
export async function generateTextWithJsonParse<T>({
  operation,
  schema,
  system,
  prompt,
  temperature = 0.5,
  maxRetries = 2,
  initialDelayMs = 500,
  routing = "fast",
}: RobustGenerateObjectOptions<T>): Promise<{
  object: T;
  model: string;
  usage: ReturnType<typeof extractUsage>;
  providerMetadata?: unknown;
}> {
  const provider = createAIProvider();
  const modelConfig = getModelForRouting(routing);
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema), null, 2);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const startTime = getCurrentUTCTimestamp();

    try {
      console.info(
        `[AI] ${operation} JSON attempt ${attempt + 1}/${maxRetries} using ${modelConfig.model} via ${modelConfig.providerLabel}`
      );

      const result = await generateText({
        model: provider(modelConfig.model) as any,
        system: `${system}\n\nIMPORTANT: You MUST respond with ONLY valid JSON. No markdown, no explanations, just one JSON object that validates against the provided JSON Schema.`,
        prompt: `${prompt}\n\nReturn exactly one JSON object matching this JSON Schema:\n${jsonSchema}\n\nDo not rename keys. Do not wrap the object in another property. Do not return an array unless the schema root is an array.`,
        temperature,
        providerOptions: modelConfig.providerOptions,
        ...(modelConfig.timeoutMs
          ? { abortSignal: AbortSignal.timeout(modelConfig.timeoutMs) }
          : {}),
      });

      const parsed = JSON.parse(extractJsonPayload(result.text));
      const validated = schema.parse(parsed);

      const durationMs = getCurrentUTCTimestamp() - startTime;
      const usage = extractUsage(result);

      console.info(
        `[AI] ${operation} JSON generation succeeded using ${usage.modelSelected ?? modelConfig.model} via ${usage.providerSelected ?? modelConfig.providerLabel} in ${durationMs}ms`,
        usage.totalTokens ? `(${usage.totalTokens} tokens)` : ""
      );

      return {
        object: validated,
        model: usage.modelSelected ?? modelConfig.model,
        usage,
        providerMetadata: (result as { providerMetadata?: unknown })
          .providerMetadata,
      };
    } catch (error) {
      const durationMs = getCurrentUTCTimestamp() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      lastError = error instanceof Error ? error : new Error(errorMessage);

      console.warn(
        `[AI] ${operation} JSON attempt ${attempt + 1} failed on ${modelConfig.model}:`,
        errorMessage,
        `(${durationMs}ms)`
      );

      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(
    `[AI] ${operation} JSON generation failed:`,
    lastError?.message
  );
  throw lastError || new Error("Failed to generate structured JSON");
}
