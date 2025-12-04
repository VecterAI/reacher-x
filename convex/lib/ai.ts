// convex/lib/ai.ts
// Vercel AI Gateway provider setup for Convex actions
// Docs: https://vercel.com/docs/ai-gateway

import { createOpenAI } from "@ai-sdk/openai";

// ============================================================================
// Gateway Provider
// ============================================================================

/**
 * Vercel AI Gateway provider configured for use in Convex actions.
 *
 * Uses OpenAI-compatible API endpoint to access any model via the Gateway.
 * Supports: OpenAI, Anthropic, Google, xAI, Mistral, and more.
 *
 * @see https://vercel.com/docs/ai-gateway/models-and-providers
 *
 * @example
 * ```typescript
 * import { generateText } from 'ai';
 * import { gateway } from './lib/ai';
 *
 * const { text } = await generateText({
 *   model: gateway('openai/gpt-4o-mini'),
 *   prompt: 'Hello!',
 * });
 * ```
 */
export function createGatewayProvider() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "[AI] Missing AI_GATEWAY_API_KEY environment variable. " +
        "Get it from: Vercel Dashboard → Settings → AI Gateway"
    );
  }

  return createOpenAI({
    baseURL: "https://ai-gateway.vercel.sh/v1",
    apiKey,
  });
}

// ============================================================================
// Model Identifiers
// ============================================================================

/**
 * Available models via Vercel AI Gateway.
 * Format: provider/model-name
 *
 * @see https://vercel.com/docs/ai-gateway/models-and-providers
 */
export const MODELS = {
  // OpenAI
  GPT_4O: "openai/gpt-4o",
  GPT_4O_MINI: "openai/gpt-4o-mini",
  GPT_4_TURBO: "openai/gpt-4-turbo",

  // Anthropic
  CLAUDE_SONNET: "anthropic/claude-sonnet-4",
  CLAUDE_HAIKU: "anthropic/claude-3-5-haiku-latest",

  // Google
  GEMINI_PRO: "google/gemini-2.5-pro-preview-06-05",
  GEMINI_FLASH: "google/gemini-2.5-flash-preview-05-20",

  // xAI
  GROK: "xai/grok-3-mini",
} as const;

/**
 * Default model for general text generation tasks.
 * GPT-4o-mini offers good balance of quality and cost.
 */
export const DEFAULT_MODEL = MODELS.GPT_4O_MINI;

/**
 * Model for complex reasoning tasks (ICP generation, analysis).
 */
export const REASONING_MODEL = MODELS.GPT_4O;

// ============================================================================
// Logging Helpers
// ============================================================================

export interface AILogContext {
  operation: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  error?: string;
}

/**
 * Logs AI operation details for debugging.
 */
export function logAIOperation(
  level: "info" | "warn" | "error",
  message: string,
  context: AILogContext
) {
  const logData = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (level === "error") {
    console.error("[AI]", JSON.stringify(logData, null, 2));
  } else if (level === "warn") {
    console.warn("[AI]", JSON.stringify(logData, null, 2));
  } else {
    console.log("[AI]", JSON.stringify(logData, null, 2));
  }
}

