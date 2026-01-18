// convex/lib/ai.ts
// OpenRouter provider setup for Convex actions
// Docs: https://openrouter.ai/docs

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText } from "ai";
import type { z } from "zod";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Creates an OpenRouter provider instance.
 *
 * OpenRouter provides:
 * - Auto-routing: `openrouter/auto` selects the best model per request
 * - Model fallbacks: Automatic failover to backup models
 * - Usage tracking: Token counts and cost per request
 * - Structured outputs: For generateObject calls
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
 *   model: provider(MODELS.AUTO),
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

/**
 * Available models via OpenRouter.
 *
 * AUTO: Let OpenRouter choose the best model based on the task
 * @see https://openrouter.ai/docs/guides/features/routers/auto-router
 * @see https://openrouter.ai/models for valid model IDs
 */
export const MODELS = {
  // Auto-routing - OpenRouter selects the best model
  AUTO: "openrouter/auto",

  // ============================================================================
  // Primary Models (2025) - Use these for new code
  // ============================================================================

  // Gemini 3 Flash - Best for document analysis, data extraction, qualification
  // Excels at processing large amounts of data and structured outputs
  GEMINI_3_FLASH: "google/gemini-3-flash-preview",

  // Kimi K2 Thinking - Best for agentic conversations, multi-turn chat
  // Optimized for 200-300 tool calls, 256k context
  KIMI_K2: "moonshotai/kimi-k2-thinking",

  // Claude Haiku 4.5 - Excellent tool calling and coding
  CLAUDE_HAIKU_45: "anthropic/claude-haiku-4.5",

  // GPT OSS - Good for data analysis
  GPT_OSS: "openai/gpt-oss-120b",

  // Grok 4.1 Fast - Fast alternative
  GROK_41_FAST: "x-ai/grok-4.1-fast",

  // ============================================================================
  // Cost-Effective Models - For fallbacks and simple tasks
  // ============================================================================

  // Gemini 2.5 Flash-Lite - Cheapest option
  GEMINI_25_FLASH_LITE: "google/gemini-2.5-flash-lite",

  // DeepSeek R1 - Best value for reasoning
  DEEPSEEK_R1: "deepseek/deepseek-r1",

  // Mistral Medium 3 - Good balance
  MISTRAL_MEDIUM_3: "mistralai/mistral-medium-3",

  // ============================================================================
  // Legacy models - Kept for backward compatibility
  // ============================================================================
  CLAUDE_SONNET: "anthropic/claude-3.5-sonnet",
  CLAUDE_HAIKU: "anthropic/claude-3-5-haiku",
  GPT_4O: "openai/gpt-4o",
  GPT_4O_MINI: "openai/gpt-4o-mini",
  GEMINI_PRO: "google/gemini-2.0-flash-001",
  GEMINI_FLASH: "google/gemini-2.0-flash-lite-001",
  GROK: "x-ai/grok-3-mini-beta",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/**
 * Default model - uses AUTO routing for optimal selection.
 * OpenRouter will choose the best model based on:
 * - Task complexity
 * - Cost efficiency
 * - Speed requirements
 */
export const DEFAULT_MODEL = MODELS.AUTO;

/**
 * Model for complex reasoning tasks (ICP generation, analysis, agents).
 * Kimi K2 is optimized for agentic conversations with 200+ tool calls stability.
 */
export const REASONING_MODEL = MODELS.KIMI_K2;

/**
 * Model for simple/fast tasks (greetings, short responses).
 * Uses Gemini 2.5 Flash-Lite for maximum cost efficiency.
 */
export const FAST_MODEL = MODELS.GEMINI_25_FLASH_LITE;

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

  experimental_providerMetadata?: any;
}): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
  modelSelected?: string;
} {
  const usage = result.usage || {};
  const metadata = result.experimental_providerMetadata?.openrouter;

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
  };
}

// ============================================================================
// Robust Structured Output Generation
// ============================================================================

/**
 * Models known to work well with structured outputs / JSON schema.
 * Gemini 2.5 Flash-Lite is the cheapest option with excellent structured output support.
 * Cost: $0.10/$0.40 per 1M tokens (80% cheaper than GPT-4o-mini).
 */
// Gemini 3 Flash is excellent for document analysis and structured outputs
export const STRUCTURED_OUTPUT_MODEL = MODELS.GEMINI_3_FLASH;

/**
 * Fallback models for structured outputs if primary fails.
 * Claude Haiku 4.5 is best at tool calling, included as reliable fallback.
 */
const STRUCTURED_OUTPUT_FALLBACKS = [
  MODELS.GEMINI_25_FLASH_LITE, // Cheap fallback
  MODELS.CLAUDE_HAIKU_45, // Best tool calling
  MODELS.GPT_OSS, // Good for data analysis
  MODELS.MISTRAL_MEDIUM_3, // Strong performance
];

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
}

/**
 * Robustly generates a structured object using AI with:
 * - Automatic retries with exponential backoff
 * - Model fallback (tries Gemini 2.5 Flash-Lite → Mistral Medium 3 → DeepSeek R1 → Claude Haiku 4.5)
 * - Comprehensive logging
 *
 * This solves the "No object generated: could not parse response" errors
 * by using models better suited for structured outputs and retrying on failures.
 * Uses cost-optimized models to minimize expenses (80-90% cheaper than GPT-4o/Claude Sonnet).
 */
export async function robustGenerateObject<T>({
  operation,
  schema,
  system,
  prompt,
  temperature = 0.5,
  maxRetries = 2,
  initialDelayMs = 500,
}: RobustGenerateObjectOptions<T>): Promise<{ object: T; model: string }> {
  const provider = createAIProvider();
  const modelsToTry = [STRUCTURED_OUTPUT_MODEL, ...STRUCTURED_OUTPUT_FALLBACKS];

  let lastError: Error | null = null;

  for (const modelId of modelsToTry) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const startTime = getCurrentUTCTimestamp();

      try {
        console.info(
          `[AI] ${operation} attempt ${attempt + 1}/${maxRetries} using ${modelId}`
        );

        const result = await generateObject({
          model: provider(modelId),
          schema,
          system,
          prompt,
          temperature,
        });

        const durationMs = getCurrentUTCTimestamp() - startTime;
        const usageInfo = extractUsage(result);

        console.info(
          `[AI] ${operation} completed using ${modelId} in ${durationMs}ms`,
          usageInfo.totalTokens ? `(${usageInfo.totalTokens} tokens)` : ""
        );

        return { object: result.object, model: modelId };
      } catch (error) {
        const durationMs = getCurrentUTCTimestamp() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        lastError = error instanceof Error ? error : new Error(errorMessage);

        console.warn(
          `[AI] ${operation} attempt ${attempt + 1} failed on ${modelId}:`,
          errorMessage,
          `(${durationMs}ms)`
        );

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = initialDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.warn(
      `[AI] ${operation} exhausted retries on ${modelId}, trying next model`
    );
  }

  // All models failed
  console.error(`[AI] ${operation} failed on all models:`, lastError?.message);
  throw lastError || new Error("Failed to generate structured output");
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
}: RobustGenerateObjectOptions<T>): Promise<{ object: T; model: string }> {
  const provider = createAIProvider();
  const model = STRUCTURED_OUTPUT_MODEL;
  const startTime = getCurrentUTCTimestamp();

  try {
    console.info(
      `[AI] ${operation} using text generation with JSON parsing fallback`
    );

    const result = await generateText({
      model: provider(model),
      system: `${system}\n\nIMPORTANT: You MUST respond with ONLY valid JSON that matches the required schema. No markdown, no explanations, just the JSON object.`,
      prompt: `${prompt}\n\nRespond with ONLY a valid JSON object. No markdown code blocks, no explanations.`,
      temperature,
    });

    // Try to extract JSON from the response
    let jsonStr = result.text.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);
    const validated = schema.parse(parsed);

    const durationMs = getCurrentUTCTimestamp() - startTime;
    console.info(
      `[AI] ${operation} JSON parsing fallback succeeded in ${durationMs}ms`
    );

    return { object: validated, model };
  } catch (error) {
    const durationMs = getCurrentUTCTimestamp() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(
      `[AI] ${operation} JSON parsing fallback failed:`,
      errorMessage,
      `(${durationMs}ms)`
    );

    throw error;
  }
}
