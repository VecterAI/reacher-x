// convex/lib/ai.ts
// OpenRouter provider setup for Convex actions
// Docs: https://openrouter.ai/docs

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText } from "ai";
import type { z } from "zod";

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
      "HTTP-Referer": "https://reacherx.io",
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
  
  // Anthropic (correct OpenRouter model IDs)
  CLAUDE_SONNET: "anthropic/claude-3.5-sonnet",
  CLAUDE_HAIKU: "anthropic/claude-3-5-haiku",
  
  // OpenAI
  GPT_4O: "openai/gpt-4o",
  GPT_4O_MINI: "openai/gpt-4o-mini",
  
  // Google
  GEMINI_PRO: "google/gemini-2.0-flash-001",
  GEMINI_FLASH: "google/gemini-2.0-flash-lite-001",
  
  // xAI
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
 * Model for complex reasoning tasks (ICP generation, analysis).
 * Uses Claude Sonnet for high-quality structured outputs.
 */
export const REASONING_MODEL = MODELS.CLAUDE_SONNET;

/**
 * Model for simple/fast tasks (greetings, short responses).
 * Uses GPT-4o-mini for speed and cost efficiency.
 */
export const FAST_MODEL = MODELS.GPT_4O_MINI;

// ============================================================================
// Logging Helpers
// ============================================================================

/**
 * Context for AI operation logging.
 * 
 * WARNING: Never include prompts, user input, or PII in the logged context.
 * This interface is for operational metrics only.
 */
export interface AILogContext {
  operation: string;
  model?: string;
  modelSelected?: string; // Model selected by auto-router
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

/**
 * Logs AI operation details with comprehensive context.
 * 
 * Logs include:
 * - Operation name and model used
 * - Token counts (input/output/total)
 * - Cost (when available from OpenRouter)
 * - Duration in milliseconds
 * - Errors with full context
 */
export function logAI(
  level: "info" | "warn" | "error",
  message: string,
  context: Partial<AILogContext>
) {
  const timestamp = new Date().toISOString();
  const prefix = `[AI ${timestamp}]`;

  // Format for readability
  // Note: cost may be a string from OpenRouter, so only call toFixed on finite numbers
  const costDisplay = context.cost !== undefined && typeof context.cost === "number" && isFinite(context.cost)
    ? `cost=$${context.cost.toFixed(4)}`
    : null;
  
  const logParts = [
    `${context.operation || "unknown"}`,
    context.model && `model=${context.model}`,
    context.modelSelected && `selected=${context.modelSelected}`,
    context.inputTokens !== undefined && `in=${context.inputTokens}`,
    context.outputTokens !== undefined && `out=${context.outputTokens}`,
    costDisplay,
    context.durationMs !== undefined && `${context.durationMs}ms`,
    context.error && `error="${context.error}"`,
  ].filter(Boolean).join(" | ");

  const logMessage = `${prefix} ${message} | ${logParts}`;

  if (level === "error") {
    console.error(logMessage);
    // Also log full context for debugging
    console.error(`${prefix} Full context:`, JSON.stringify(context, null, 2));
  } else if (level === "warn") {
    console.warn(logMessage);
  } else {
    console.log(logMessage);
  }
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const parsedCost = rawCost !== undefined ? parseFloat(String(rawCost)) : undefined;
  const cost = parsedCost !== undefined && isFinite(parsedCost) ? parsedCost : undefined;

  return {
    inputTokens: usage.promptTokens || 0,
    outputTokens: usage.completionTokens || 0,
    totalTokens: usage.totalTokens || 0,
    cost,
    modelSelected: metadata?.model,
  };
}

/**
 * Helper to create a timed AI operation with automatic logging.
 */
export async function withAILogging<T>(
  operation: string,
  model: string,
  fn: () => Promise<T & { 
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    experimental_providerMetadata?: any;
  }>
): Promise<T> {
  const startTime = Date.now();
  
  logAI("info", "Starting", { operation, model });

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;
    const usageInfo = extractUsage(result);

    logAI("info", "Completed", {
      operation,
      model,
      ...usageInfo,
      durationMs,
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    logAI("error", "Failed", {
      operation,
      model,
      error: errorMessage,
      durationMs,
    });

    throw error;
  }
}

// ============================================================================
// Robust Structured Output Generation
// ============================================================================

/**
 * Models known to work well with structured outputs / JSON schema.
 * GPT-4o-mini is excellent for structured outputs and cost-effective.
 */
export const STRUCTURED_OUTPUT_MODEL = MODELS.GPT_4O_MINI;

/**
 * Fallback models for structured outputs if primary fails.
 */
const STRUCTURED_OUTPUT_FALLBACKS = [
  MODELS.GPT_4O,
  MODELS.GEMINI_FLASH,
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
 * - Model fallback (tries GPT-4o-mini → GPT-4o → Gemini)
 * - Comprehensive logging
 * 
 * This solves the "No object generated: could not parse response" errors
 * by using models better suited for structured outputs and retrying on failures.
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
      const startTime = Date.now();
      
      try {
        logAI("info", `Attempt ${attempt + 1}/${maxRetries}`, { 
          operation, 
          model: modelId,
        });

        const result = await generateObject({
          model: provider(modelId),
          schema,
          system,
          prompt,
          temperature,
        });

        const durationMs = Date.now() - startTime;
        const usageInfo = extractUsage(result);

        logAI("info", "Structured output generated", {
          operation,
          model: modelId,
          ...usageInfo,
          durationMs,
        });

        return { object: result.object, model: modelId };
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        lastError = error instanceof Error ? error : new Error(errorMessage);

        logAI("warn", `Attempt ${attempt + 1} failed`, {
          operation,
          model: modelId,
          error: errorMessage,
          durationMs,
        });

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = initialDelayMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logAI("warn", `Model ${modelId} exhausted retries, trying next model`, { operation });
  }

  // All models failed
  logAI("error", "All models failed for structured output", { 
    operation, 
    error: lastError?.message 
  });
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
  const startTime = Date.now();

  try {
    logAI("info", "Using text generation with JSON parsing fallback", { 
      operation, 
      model 
    });

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

    const durationMs = Date.now() - startTime;
    logAI("info", "JSON parsing fallback succeeded", {
      operation,
      model,
      durationMs,
    });

    return { object: validated, model };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    logAI("error", "JSON parsing fallback failed", {
      operation,
      model,
      error: errorMessage,
      durationMs,
    });

    throw error;
  }
}
