// convex/lib/ai.ts
// OpenRouter provider setup for Convex actions
// Docs: https://openrouter.ai/docs

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type JSONValue,
} from "ai";
import { z } from "zod";
import { logger } from "../../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { env } from "../_generated/server";
import { getConfiguredModel } from "./modelConfigHelpers";
import {
  combineStructuredGenerationErrors,
  getStructuredAttemptProviderOptions,
  StructuredGenerationError,
  type OpenRouterProviderOptions,
  type OpenRouterProviderRouting,
  type StructuredGenerationAttempt,
} from "./structuredOutputCore";

export type { OpenRouterProviderOptions } from "./structuredOutputCore";
export { StructuredGenerationError } from "./structuredOutputCore";

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
 * import { createAIProvider, AGENT_PROVIDER_OPTIONS, REASONING_MODEL } from './lib/ai';
 *
 * const provider = createAIProvider();
 * const { text } = await generateText({
 *   model: provider(REASONING_MODEL),
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
  GPT_5_6_LUNA: "openai/gpt-5.6-luna",
  GPT_5_6_SOL: "openai/gpt-5.6-sol",
  GPT_5_6_TERRA: "openai/gpt-5.6-terra",
  KIMI_K2_6: "moonshotai/kimi-k2.6",
  GPT_OSS: "openai/gpt-oss-120b",
} as const;

export type ModelId = string;

export const OPENROUTER_PROVIDERS = {
  OPENAI: "openai",
  AZURE: "azure",
  BASETEN: "baseten",
  WANDB_FP4: "wandb/fp4",
  DECART: "decart",
  CEREBRAS: "cerebras",
  GROQ: "groq",
} as const;

export const OPENROUTER_ROUTING_PRESETS = {
  CURRENT: "current",
  COST_OPTIMIZED: "cost_optimized",
} as const;

type OpenRouterProviderSlug =
  (typeof OPENROUTER_PROVIDERS)[keyof typeof OPENROUTER_PROVIDERS];
type OpenRouterRoutingPreset =
  (typeof OPENROUTER_ROUTING_PRESETS)[keyof typeof OPENROUTER_ROUTING_PRESETS];

const FAST_MODEL_TIMEOUT_MS = 10_000;
const REASONING_MODEL_TIMEOUT_MS = 45_000;
const ONBOARDING_MODEL_TIMEOUT_MS = 45_000;

type RoutingPreset = "fast" | "reasoning";

/**
 * The app supports two local routing presets:
 * - "current" preserves today's production model/provider behavior
 * - "cost_optimized" standardizes both fast and reasoning paths on GPT-OSS
 *
 * Switch presets with OPENROUTER_ROUTING_PRESET=current|cost_optimized.
 */
const DEFAULT_OPENROUTER_ROUTING_PRESET: OpenRouterRoutingPreset =
  OPENROUTER_ROUTING_PRESETS.COST_OPTIMIZED;

function createOrderedProviderOptions(args: {
  order: OpenRouterProviderSlug[];
  allowFallbacks?: boolean;
  requireParameters?: boolean;
}): OpenRouterProviderOptions {
  const provider: OpenRouterProviderRouting = {
    order: args.order,
    require_parameters: args.requireParameters ?? true,
  };
  if (args.allowFallbacks !== undefined) {
    provider.allow_fallbacks = args.allowFallbacks;
  }

  return {
    openrouter: {
      provider,
    },
  };
}

function createOnlyProviderOptions(
  only: OpenRouterProviderSlug[]
): OpenRouterProviderOptions {
  return {
    openrouter: {
      provider: {
        only,
        require_parameters: true,
      },
    },
  };
}

function createLatencySortedProviderOptions(
  only: OpenRouterProviderSlug[]
): OpenRouterProviderOptions {
  return {
    openrouter: {
      provider: {
        only,
        sort: "latency",
        allow_fallbacks: true,
        require_parameters: true,
      },
    },
  };
}

/**
 * Keep GPT-5.6 traffic on standard OpenAI first with standard Azure fallback.
 * An explicit allow-list prevents OpenRouter from choosing Flex, Priority, or
 * region-specific endpoints whose price/latency behavior differs materially.
 */
function createGpt56ProviderOptions(args?: {
  requireParameters?: boolean;
}): OpenRouterProviderOptions {
  return {
    openrouter: {
      provider: {
        only: [OPENROUTER_PROVIDERS.OPENAI, OPENROUTER_PROVIDERS.AZURE],
        order: [OPENROUTER_PROVIDERS.OPENAI, OPENROUTER_PROVIDERS.AZURE],
        allow_fallbacks: true,
        require_parameters: args?.requireParameters ?? true,
      },
    },
  };
}

function createGenericProviderOptions(args?: {
  requireParameters?: boolean;
}): OpenRouterProviderOptions {
  return {
    openrouter: {
      provider: {
        allow_fallbacks: true,
        require_parameters: args?.requireParameters ?? true,
      },
    },
  };
}

function getConfiguredProviderOptions(args: {
  model: string;
  defaultModel: string;
  defaultOptions: OpenRouterProviderOptions;
  requireParameters?: boolean;
}): OpenRouterProviderOptions {
  if (args.model === args.defaultModel) {
    return args.defaultOptions;
  }

  if (args.model.startsWith("openai/gpt-5.6-")) {
    return createGpt56ProviderOptions({
      requireParameters: args.requireParameters,
    });
  }

  return createGenericProviderOptions({
    requireParameters: args.requireParameters,
  });
}

type RoutingModelConfig = {
  model: ModelId;
  providerOptions: OpenRouterProviderOptions;
  providerLabel: string;
  timeoutMs: number;
};

type RoutingPresetConfig = Record<RoutingPreset, RoutingModelConfig>;

const CURRENT_ROUTING_CONFIG: RoutingPresetConfig = {
  fast: {
    model: MODELS.GPT_OSS,
    providerOptions: createOnlyProviderOptions([OPENROUTER_PROVIDERS.CEREBRAS]),
    providerLabel: OPENROUTER_PROVIDERS.CEREBRAS,
    timeoutMs: FAST_MODEL_TIMEOUT_MS,
  },
  reasoning: {
    model: MODELS.KIMI_K2_6,
    providerOptions: createOrderedProviderOptions({
      order: [OPENROUTER_PROVIDERS.BASETEN, OPENROUTER_PROVIDERS.WANDB_FP4],
      allowFallbacks: false,
    }),
    providerLabel: `${OPENROUTER_PROVIDERS.BASETEN}/${OPENROUTER_PROVIDERS.WANDB_FP4}`,
    timeoutMs: REASONING_MODEL_TIMEOUT_MS,
  },
};

const COST_OPTIMIZED_ROUTING_CONFIG: RoutingPresetConfig = {
  fast: {
    model: MODELS.GPT_OSS,
    providerOptions: createOrderedProviderOptions({
      order: [OPENROUTER_PROVIDERS.CEREBRAS, OPENROUTER_PROVIDERS.GROQ],
      allowFallbacks: true,
    }),
    providerLabel: `${OPENROUTER_PROVIDERS.CEREBRAS}/${OPENROUTER_PROVIDERS.GROQ}`,
    timeoutMs: FAST_MODEL_TIMEOUT_MS,
  },
  reasoning: {
    model: MODELS.GPT_OSS,
    providerOptions: createOrderedProviderOptions({
      order: [OPENROUTER_PROVIDERS.CEREBRAS, OPENROUTER_PROVIDERS.GROQ],
      allowFallbacks: true,
    }),
    providerLabel: `${OPENROUTER_PROVIDERS.CEREBRAS}/${OPENROUTER_PROVIDERS.GROQ}`,
    timeoutMs: REASONING_MODEL_TIMEOUT_MS,
  },
};

function getConfiguredRoutingPreset(): OpenRouterRoutingPreset {
  const configuredPreset = env.OPENROUTER_ROUTING_PRESET;
  if (configuredPreset === OPENROUTER_ROUTING_PRESETS.CURRENT) {
    return OPENROUTER_ROUTING_PRESETS.CURRENT;
  }
  if (configuredPreset === OPENROUTER_ROUTING_PRESETS.COST_OPTIMIZED) {
    return OPENROUTER_ROUTING_PRESETS.COST_OPTIMIZED;
  }
  return DEFAULT_OPENROUTER_ROUTING_PRESET;
}

const ACTIVE_OPENROUTER_ROUTING_PRESET = getConfiguredRoutingPreset();

function getRoutingPresetConfig(): RoutingPresetConfig {
  if (ACTIVE_OPENROUTER_ROUTING_PRESET === OPENROUTER_ROUTING_PRESETS.CURRENT) {
    return CURRENT_ROUTING_CONFIG;
  }
  return COST_OPTIMIZED_ROUTING_CONFIG;
}

const activeRoutingConfig = getRoutingPresetConfig();

export const FAST_MODEL = getConfiguredModel(
  "AI_FAST_MODEL",
  activeRoutingConfig.fast.model
);
export const REASONING_MODEL = getConfiguredModel(
  "AI_REASONING_MODEL",
  activeRoutingConfig.reasoning.model
);
export const AUTOCOMPLETE_MODEL = getConfiguredModel(
  "AI_AUTOCOMPLETE_MODEL",
  MODELS.GPT_OSS
);
export const HELPER_MODEL = AUTOCOMPLETE_MODEL;

export const AGENT_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: REASONING_MODEL,
    defaultModel: activeRoutingConfig.reasoning.model,
    defaultOptions: activeRoutingConfig.reasoning.providerOptions,
  });

export const FAST_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: FAST_MODEL,
    defaultModel: activeRoutingConfig.fast.model,
    defaultOptions: activeRoutingConfig.fast.providerOptions,
  });

/**
 * Background helper AI runs on a separate Groq lane so autocomplete and other
 * non-critical helpers cannot consume the pinned main-agent provider capacity.
 */
export const HELPER_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: AUTOCOMPLETE_MODEL,
    defaultModel: MODELS.GPT_OSS,
    defaultOptions: createOnlyProviderOptions([OPENROUTER_PROVIDERS.GROQ]),
  });
export const AUTOCOMPLETE_PROVIDER_OPTIONS = HELPER_PROVIDER_OPTIONS;

/**
 * Onboarding determines the audience, targeting profile, and durable workspace
 * configuration. Keep it on the highest-judgment lane independently of the
 * cost-optimized fast/reasoning preset.
 */
export const ONBOARDING_MODEL = getConfiguredModel(
  "AI_ONBOARDING_MODEL",
  MODELS.GPT_5_6_SOL
);

export const ONBOARDING_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: ONBOARDING_MODEL,
    defaultModel: MODELS.GPT_5_6_SOL,
    defaultOptions: createGpt56ProviderOptions({ requireParameters: false }),
    requireParameters: false,
  });

const ONBOARDING_PROVIDER_LABEL = ONBOARDING_MODEL.startsWith("openai/gpt-5.6-")
  ? `${OPENROUTER_PROVIDERS.OPENAI}/${OPENROUTER_PROVIDERS.AZURE}`
  : "openrouter";

/**
 * Tool-calling agents use a latency-ranked Cerebras/Groq/BaseTen pool.
 * OpenRouter chooses from rolling provider latency and can fail over inside
 * the request, preventing simultaneous endpoint throttling from stopping the
 * whole agent turn.
 *
 * Keep this route separate from broader fast/reasoning routing so background
 * generation can still evolve independently.
 */
export const PINNED_AGENT_MODEL = getConfiguredModel(
  "AI_SETUP_AGENT_MODEL",
  ONBOARDING_MODEL
);

export const PINNED_AGENT_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: PINNED_AGENT_MODEL,
    defaultModel: ONBOARDING_MODEL,
    defaultOptions: ONBOARDING_PROVIDER_OPTIONS,
  });

/**
 * Prospect conversations and plan generation require stronger instruction
 * following and judgment than setup helpers and simple workspace operations.
 * Keep this route separate so those lower-judgment paths remain cost-efficient.
 */
export const OUTREACH_AGENT_MODEL = getConfiguredModel(
  "AI_MAIN_AGENT_MODEL",
  MODELS.GPT_5_6_SOL
);

export const OUTREACH_AGENT_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: OUTREACH_AGENT_MODEL,
    defaultModel: MODELS.GPT_5_6_SOL,
    defaultOptions: createGpt56ProviderOptions(),
  });

export const OUTREACH_ROUTER_MODEL = getConfiguredModel(
  "AI_OUTREACH_ROUTER_MODEL",
  MODELS.GPT_5_6_LUNA
);
export const OUTREACH_ROUTER_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: OUTREACH_ROUTER_MODEL,
    defaultModel: MODELS.GPT_5_6_LUNA,
    defaultOptions: createGpt56ProviderOptions({ requireParameters: false }),
    requireParameters: false,
  });

export const OUTREACH_FAST_MODEL = getConfiguredModel(
  "AI_OUTREACH_FAST_MODEL",
  MODELS.GPT_OSS
);
export const OUTREACH_FAST_PROVIDER_OPTIONS = getConfiguredProviderOptions({
  model: OUTREACH_FAST_MODEL,
  defaultModel: MODELS.GPT_OSS,
  defaultOptions: createLatencySortedProviderOptions([
    OPENROUTER_PROVIDERS.CEREBRAS,
    OPENROUTER_PROVIDERS.GROQ,
    OPENROUTER_PROVIDERS.BASETEN,
  ]),
});

export const OUTREACH_TERRA_MODEL = getConfiguredModel(
  "AI_OUTREACH_STANDARD_MODEL",
  MODELS.GPT_5_6_TERRA
);
export const OUTREACH_TERRA_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: OUTREACH_TERRA_MODEL,
    defaultModel: MODELS.GPT_5_6_TERRA,
    defaultOptions: createGpt56ProviderOptions(),
  });

export const OUTREACH_SOL_MODEL = getConfiguredModel(
  "AI_OUTREACH_RECOVERY_MODEL",
  MODELS.GPT_5_6_SOL
);
export const OUTREACH_SOL_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: OUTREACH_SOL_MODEL,
    defaultModel: MODELS.GPT_5_6_SOL,
    defaultOptions: createGpt56ProviderOptions(),
  });

/**
 * GPT-5.6 supports OpenRouter's explicit prompt-cache mode. The corresponding
 * cache breakpoint is added by outreachPromptCacheMiddleware after the stable
 * agent instructions and current workspace context.
 */
export const OUTREACH_AGENT_PROMPT_CACHE_OPTIONS = {
  prompt_cache_options: {
    mode: "explicit",
    ttl: "30m",
  },
} as const satisfies Record<string, JSONValue>;

/**
 * Vision-capable turns are pinned to Kimi and must stay on a true multimodal
 * route. We allow a provider fallback within Kimi's lane, but never a silent
 * downgrade to the default text-only agent model.
 */
export const PINNED_VISION_MODEL = getConfiguredModel(
  "AI_VISION_MODEL",
  MODELS.KIMI_K2_6
);

export const PINNED_VISION_PROVIDER_OPTIONS: OpenRouterProviderOptions =
  getConfiguredProviderOptions({
    model: PINNED_VISION_MODEL,
    defaultModel: MODELS.KIMI_K2_6,
    defaultOptions: createOrderedProviderOptions({
      order: [OPENROUTER_PROVIDERS.BASETEN, OPENROUTER_PROVIDERS.WANDB_FP4],
      allowFallbacks: true,
    }),
  });

export function supportsExplicitPromptCaching(model: string): boolean {
  return model.startsWith("openai/gpt-5.6-");
}

export type ModelRouting = RoutingPreset | "onboarding";
type JsonFailureLogLevel = "error" | "warn" | "info";
const aiLogger = logger.withScope("AI");

/**
 * Backward-compatible alias for older fast-route imports.
 * Prefer FAST_PROVIDER_OPTIONS for new code.
 */
export const CEREBRAS_PROVIDER_OPTIONS = FAST_PROVIDER_OPTIONS;

export function getActiveOpenRouterRoutingPreset(): OpenRouterRoutingPreset {
  return ACTIVE_OPENROUTER_ROUTING_PRESET;
}

export function getOpenRouterExtraBody(
  providerOptions: OpenRouterProviderOptions
): Record<string, JSONValue> {
  return providerOptions.openrouter;
}

function getModelForRouting(routing: ModelRouting): RoutingModelConfig {
  if (routing === "onboarding") {
    return {
      model: ONBOARDING_MODEL,
      providerOptions: ONBOARDING_PROVIDER_OPTIONS,
      providerLabel: ONBOARDING_PROVIDER_LABEL,
      timeoutMs: ONBOARDING_MODEL_TIMEOUT_MS,
    };
  }

  return getRoutingPresetConfig()[routing];
}

export function getRoutingTelemetry(routing: ModelRouting): {
  model: ModelId;
  providerLabel: string;
  timeoutMs: number;
} {
  const { model, providerLabel, timeoutMs } = getModelForRouting(routing);

  return {
    model,
    providerLabel,
    timeoutMs,
  };
}

function logJsonFailure(level: JsonFailureLogLevel, ...args: unknown[]) {
  if (level === "info") {
    aiLogger.info(...args);
    return;
  }

  if (level === "warn") {
    aiLogger.warn(...args);
    return;
  }

  aiLogger.error(...args);
}

function logJsonAttemptFailure(level: JsonFailureLogLevel, ...args: unknown[]) {
  logJsonFailure(level === "info" ? "info" : "warn", ...args);
}

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
    inputTokens?: number;
    outputTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cachedInputTokens?: number;
    inputTokenDetails?: {
      noCacheTokens?: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    };
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
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  noCacheTokens?: number;
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
  const cacheReadTokens =
    usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens;

  return {
    inputTokens: usage.inputTokens ?? usage.promptTokens ?? 0,
    outputTokens: usage.outputTokens ?? usage.completionTokens ?? 0,
    totalTokens: usage.totalTokens || 0,
    cost,
    modelSelected: metadata?.model,
    providerSelected: metadata?.provider,
    cacheReadTokens,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens,
    noCacheTokens: usage.inputTokenDetails?.noCacheTokens,
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
  /** Maximum completion tokens to request from the provider. */
  maxOutputTokens?: number;
  /** Maximum retry attempts per model (default: 2) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 500) */
  initialDelayMs?: number;
  /** fast/reasoning resolve through the active local routing preset */
  routing?: ModelRouting;
  /** Optional one-shot stronger route after the primary route is exhausted. */
  fallbackRouting?: ModelRouting;
  /** Ask the provider for schema-constrained output and validate it in SDK. */
  nativeStructuredOutput?: boolean;
  /** Optional repair step before Zod validation for known provider edge cases. */
  normalizeParsed?: (value: unknown) => unknown;
  /**
   * Defaults to error/warn. Use info for optional AI steps whose callers
   * intentionally recover with deterministic fallback data.
   */
  failureLogLevel?: JsonFailureLogLevel;
}

/**
 * Robustly generates a structured object with explicit model routing.
 * The active preset decides which model/providers back "fast" and "reasoning".
 * In the cost-optimized preset both routes use GPT-OSS with different timeouts.
 */
export async function robustGenerateObject<T>({
  operation,
  schema,
  system,
  prompt,
  temperature = 0.5,
  maxOutputTokens,
  maxRetries = 2,
  initialDelayMs = 500,
  routing = "reasoning",
  fallbackRouting,
  nativeStructuredOutput = false,
  normalizeParsed,
  failureLogLevel = "error",
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
        maxOutputTokens,
        maxRetries: 1,
        initialDelayMs,
        routing,
        nativeStructuredOutput,
        normalizeParsed,
        failureLogLevel,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logJsonAttemptFailure(
        failureLogLevel,
        `[AI] ${operation} fast JSON generation failed; falling back to reasoning route:`,
        errorMessage
      );

      try {
        return await robustGenerateObject({
          operation,
          schema,
          system,
          prompt,
          temperature,
          maxOutputTokens,
          maxRetries: 1,
          initialDelayMs,
          routing: "reasoning",
          fallbackRouting,
          nativeStructuredOutput,
          normalizeParsed,
          failureLogLevel,
        });
      } catch (fallbackError) {
        throw combineStructuredGenerationErrors({
          operation,
          errors: [error, fallbackError],
        });
      }
    }
  }

  try {
    return await generateTextWithJsonParse({
      operation,
      schema,
      system,
      prompt,
      temperature,
      maxOutputTokens,
      maxRetries,
      initialDelayMs,
      routing,
      nativeStructuredOutput,
      normalizeParsed,
      failureLogLevel,
    });
  } catch (error) {
    if (!fallbackRouting || fallbackRouting === routing) {
      throw error;
    }

    logJsonAttemptFailure(
      failureLogLevel,
      `[AI] ${operation} ${routing} structured generation failed; falling back to ${fallbackRouting} route`
    );
    try {
      return await generateTextWithJsonParse({
        operation,
        schema,
        system,
        prompt,
        temperature,
        maxOutputTokens,
        maxRetries: 1,
        initialDelayMs,
        routing: fallbackRouting,
        nativeStructuredOutput,
        normalizeParsed,
        failureLogLevel,
      });
    } catch (fallbackError) {
      throw combineStructuredGenerationErrors({
        operation,
        errors: [error, fallbackError],
      });
    }
  }
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
  maxOutputTokens,
  maxRetries = 2,
  initialDelayMs = 500,
  routing = "fast",
  nativeStructuredOutput = false,
  normalizeParsed,
  failureLogLevel = "error",
}: RobustGenerateObjectOptions<T>): Promise<{
  object: T;
  model: string;
  usage: ReturnType<typeof extractUsage>;
  providerMetadata?: unknown;
}> {
  const provider = createAIProvider();
  const modelConfig = getModelForRouting(routing);
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema), null, 2);
  const attempts: StructuredGenerationAttempt[] = [];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const startTime = getCurrentUTCTimestamp();
    const attemptRouting = getStructuredAttemptProviderOptions({
      providerOptions: modelConfig.providerOptions,
      attemptIndex: attempt,
      totalAttempts: maxRetries,
      requireStructuredOutput: nativeStructuredOutput,
    });
    let resultDiagnostics:
      | Omit<StructuredGenerationAttempt, "errorMessage" | "durationMs">
      | undefined;

    try {
      const result = await generateText({
        model: provider(
          modelConfig.model,
          nativeStructuredOutput
            ? { plugins: [{ id: "response-healing" }] }
            : undefined
        ) as any,
        system: `${system}\n\nIMPORTANT: You MUST respond with ONLY valid JSON. No markdown, no explanations, just one JSON object that validates against the provided JSON Schema.`,
        prompt: `${prompt}\n\nReturn exactly one JSON object matching this JSON Schema:\n${jsonSchema}\n\nDo not rename keys. Do not wrap the object in another property. Do not return an array unless the schema root is an array.`,
        temperature,
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
        ...(nativeStructuredOutput
          ? { output: Output.object({ schema }) }
          : {}),
        providerOptions: attemptRouting.providerOptions,
        ...(modelConfig.timeoutMs
          ? { abortSignal: AbortSignal.timeout(modelConfig.timeoutMs) }
          : {}),
      });

      const usage = extractUsage(result);
      resultDiagnostics = {
        attemptNumber: attempt + 1,
        routing,
        model: modelConfig.model,
        configuredProvider: attemptRouting.configuredProvider,
        providerSelected: usage.providerSelected,
        modelSelected: usage.modelSelected,
        finishReason: result.finishReason,
        responseLength: result.text.length,
        outputTokens: usage.outputTokens,
      };
      const parsed = nativeStructuredOutput
        ? result.output
        : JSON.parse(extractJsonPayload(result.text));
      const validated = schema.parse(
        normalizeParsed ? normalizeParsed(parsed) : parsed
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
      const errorMessage = getSafeStructuredGenerationErrorMessage(error);
      const noObjectDiagnostics = NoObjectGeneratedError.isInstance(error)
        ? {
            finishReason: error.finishReason,
            responseLength: error.text?.length,
            outputTokens: error.usage?.outputTokens,
            modelSelected: error.response?.modelId,
          }
        : undefined;
      const attemptFailure: StructuredGenerationAttempt = {
        attemptNumber: attempt + 1,
        routing,
        model: modelConfig.model,
        configuredProvider: attemptRouting.configuredProvider,
        durationMs,
        errorMessage,
        ...resultDiagnostics,
        ...noObjectDiagnostics,
      };
      attempts.push(attemptFailure);

      logJsonAttemptFailure(
        failureLogLevel,
        `[AI] ${operation} structured attempt failed`,
        attemptFailure
      );

      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logJsonFailure(
    failureLogLevel,
    `[AI] ${operation} structured generation failed`,
    { attempts }
  );
  throw new StructuredGenerationError({ operation, attempts });
}

function getSafeStructuredGenerationErrorMessage(error: unknown): string {
  if (NoObjectGeneratedError.isInstance(error)) {
    const causeName =
      error.cause instanceof Error ? error.cause.name : "unknown_parse_error";
    return `${error.name}: ${causeName}`;
  }
  if (error instanceof z.ZodError) {
    return "Structured output did not match the required schema";
  }
  if (error instanceof SyntaxError) {
    return error.message;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "Structured output request timed out";
  }
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return "Unknown structured output error";
}
