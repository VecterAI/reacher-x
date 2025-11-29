import { openai, createOpenAI } from "@ai-sdk/openai";
import { logger } from "../../shared/lib/logger";
import type { LanguageModel } from "ai";

// =============================================================================
// CENTRALIZED LLM CONFIGURATION SYSTEM
// =============================================================================
/**
 * Centralized LLM configuration system for all Convex actions.
 *
 * USAGE:
 *
 * 1. Configure models via environment variables:
 *    - LLM_MODEL: Default model for general use (default: gpt-4o)
 *    - KEYWORD_GENERATION_MODEL: Model for keyword generation (default: grok-4-fast with GPT-4o fallback)
 *    - LLM_FILTER_MODEL: Model for tweet filtering (default: uses LLM_MODEL)
 *
 * 2. Use in actions:
 *    ```typescript
 *    import { createLLMModel } from "./lib/llm-config";
 *
 *    // For keyword generation (will use Grok if available, fallback to GPT-4o)
 *    const model = createLLMModel("keyword_generation");
 *
 *    // For workspace description generation (prefers Grok-4 Fast reasoning)
 *    const model = createLLMModel("workspace_description");
 *
 *    // For filtering (will use configured filter model or default)
 *    const model = createLLMModel("filtering");
 *
 *    // For general use (will use LLM_MODEL env var or default)
 *    const model = createLLMModel();
 *    ```
 *
 * 3. All model references are centralized - no more duplicated configuration!
 */

export interface LLMConfig {
  modelName: string;
  temperature: number;
  maxOutputTokens?: number;
  description: string;
  baseURL?: string;
  apiKeyEnvVar?: string;
}

export interface LLMModelResult {
  model: LanguageModel; // The actual model instance from AI SDK
  modelName: string;
  temperature: number;
  description: string;
  usedFallback: boolean;
  configSource: string;
}

/**
 * Centralized LLM model configurations
 * Add new models here and they'll be available throughout the system
 */
export const LLM_CONFIGS = {
  "gpt-4o-mini": {
    modelName: "gpt-4o-mini",
    temperature: 0.3,
    description: "OpenAI GPT-4o Mini - Fast and cost-effective",
  },
  "gpt-4o": {
    modelName: "gpt-4o",
    temperature: 0.3,
    description: "OpenAI GPT-4o - Most capable model",
  },
  "gpt-4-turbo": {
    modelName: "gpt-4-turbo",
    temperature: 0.3,
    description: "OpenAI GPT-4 Turbo - Balanced performance",
  },
  "gpt-3.5-turbo": {
    modelName: "gpt-3.5-turbo",
    temperature: 0.3,
    description: "OpenAI GPT-3.5 Turbo - Fast and economical",
  },
  "grok-3-latest": {
    modelName: "grok-3-latest",
    temperature: 0.7,
    description: "xAI Grok3 - Optimized for Twitter/X understanding",
    baseURL: "https://api.x.ai/v1",
    apiKeyEnvVar: "XAI_API_KEY",
  },
  "grok-4-fast": {
    modelName: "grok-4-fast",
    temperature: 0.4,
    description:
      "xAI Grok-4 Fast (non-reasoning) - Fast, large context, high quality",
    baseURL: "https://api.x.ai/v1",
    apiKeyEnvVar: "XAI_API_KEY",
  },
  "grok-4-fast-reasoning": {
    modelName: "grok-4-fast-reasoning",
    temperature: 0.4,
    description:
      "xAI Grok-4 Fast (reasoning) - Agentic search with web/X browsing",
    baseURL: "https://api.x.ai/v1",
    apiKeyEnvVar: "XAI_API_KEY",
  },
} as const;

export type LLMModelType = keyof typeof LLM_CONFIGS;

/**
 * Use case specific model preferences and fallbacks
 */
const USE_CASE_PREFERENCES = {
  keyword_generation: {
    envVar: "KEYWORD_GENERATION_MODEL",
    preferred: "grok-4-fast-reasoning" as LLMModelType,
    fallback: "grok-4-fast" as LLMModelType,
    description:
      "Keyword generation prefers Grok-4 Fast (reasoning), falls back to Grok-4 Fast",
  },
  workspace_description: {
    envVar: "WORKSPACE_DESCRIPTION_MODEL",
    preferred: "grok-4-fast-reasoning" as LLMModelType,
    fallback: "grok-4-fast" as LLMModelType,
    description:
      "Workspace description generation prefers Grok-4 Fast (reasoning), falls back to Grok-4 Fast",
  },
  seed_generation: {
    envVar: "SEED_GENERATION_MODEL",
    preferred: "gpt-4o-mini" as LLMModelType,
    fallback: "grok-4-fast" as LLMModelType,
    description:
      "Seed keyword generation prefers GPT-4o Mini for speed; falls back to Grok-4 Fast",
  },
  filtering: {
    envVar: "LLM_FILTER_MODEL",
    preferred: "grok-4-fast" as LLMModelType,
    fallback: "gpt-4o" as LLMModelType,
    description:
      "Tweet filtering prefers Grok-4 Fast (non-reasoning), falls back to GPT-4o",
  },
  general: {
    envVar: "LLM_MODEL",
    preferred: "gpt-4o" as LLMModelType,
    fallback: "gpt-4o-mini" as LLMModelType,
    description: "General purpose LLM usage",
  },
} as const;

export type UseCase = keyof typeof USE_CASE_PREFERENCES;

/**
 * Get LLM configuration for a specific model
 */
function getLLMConfig(modelType: LLMModelType): LLMConfig {
  return LLM_CONFIGS[modelType];
}

/**
 * Check if a model is available (has required API keys)
 */
function isModelAvailable(modelType: LLMModelType): boolean {
  const config = getLLMConfig(modelType);

  if (config.apiKeyEnvVar) {
    const apiKey = process.env[config.apiKeyEnvVar];
    return !!apiKey;
  }

  // OpenAI models require OPENAI_API_KEY (standard AI SDK requirement)
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Create a model instance from configuration
 */
function createModelInstance(modelType: LLMModelType): LanguageModel {
  const config = getLLMConfig(modelType);

  if (config.baseURL && config.apiKeyEnvVar) {
    // Custom provider (like xAI). These providers are OpenAI-compatible, not the
    // new Responses API. We must enable compatibility mode so the AI SDK uses
    // the chat.completions endpoints and streaming format they implement.
    const apiKey = process.env[config.apiKeyEnvVar];
    if (!apiKey) {
      throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
    }

    const customClient = createOpenAI({
      baseURL: config.baseURL,
      apiKey: apiKey
    });
    return customClient(config.modelName);
  }

  // OpenAI models
  return openai(config.modelName);
}

/**
 * Resolve the best available model for a use case
 */
function resolveModelForUseCase(useCase: UseCase): {
  modelType: LLMModelType;
  usedFallback: boolean;
  configSource: string;
} {
  const preference = USE_CASE_PREFERENCES[useCase];

  // Check if a specific model is set via environment variable
  const envModel = process.env[preference.envVar] as LLMModelType;
  if (envModel && envModel in LLM_CONFIGS) {
    if (isModelAvailable(envModel)) {
      return {
        modelType: envModel,
        usedFallback: false,
        configSource: `env:${preference.envVar}`,
      };
    } else {
      logger.warn(
        `[LLM_CONFIG] Model "${envModel}" from ${preference.envVar} is not available, checking fallbacks`
      );
    }
  }

  // Try preferred model
  if (isModelAvailable(preference.preferred)) {
    return {
      modelType: preference.preferred,
      usedFallback: envModel ? true : false, // It's a fallback if env var was set but not available
      configSource: "preferred",
    };
  }

  // Try fallback model
  if (isModelAvailable(preference.fallback)) {
    return {
      modelType: preference.fallback,
      usedFallback: true,
      configSource: "fallback",
    };
  }

  // Last resort - use any available OpenAI model
  const availableModels: LLMModelType[] = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
  ];

  for (const modelType of availableModels) {
    if (isModelAvailable(modelType)) {
      logger.warn(
        `[LLM_CONFIG] Using emergency fallback model: ${modelType} for use case: ${useCase}`
      );
      return {
        modelType,
        usedFallback: true,
        configSource: "emergency_fallback",
      };
    }
  }

  throw new Error(
    `No available LLM models found for use case: ${useCase}. Please check your API key configuration.`
  );
}

/**
 * Create an LLM model instance for a specific use case
 *
 * @param useCase - The use case for the model (keyword_generation, filtering, general)
 * @returns LLMModelResult with model instance and metadata
 */
export function createLLMModel(useCase: UseCase = "general"): LLMModelResult {
  const resolution = resolveModelForUseCase(useCase);
  const config = getLLMConfig(resolution.modelType);

  try {
    const model = createModelInstance(resolution.modelType);

    logger.info(`[LLM_CONFIG] Created model for ${useCase}:`, {
      modelName: config.modelName,
      description: config.description,
      usedFallback: resolution.usedFallback,
      configSource: resolution.configSource,
    });

    const temperatureToUse = useCase === "filtering" ? 0.0 : config.temperature;

    return {
      model,
      modelName: config.modelName,
      temperature: temperatureToUse,
      description: config.description,
      usedFallback: resolution.usedFallback,
      configSource: resolution.configSource,
    };
  } catch (error) {
    logger.error(
      `[LLM_CONFIG] Failed to create model ${config.modelName}:`,
      error
    );
    throw new Error(
      `Failed to create LLM model for ${useCase}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get available models and their status
 */
export function getLLMStatus(): Record<
  LLMModelType,
  { available: boolean; config: LLMConfig }
> {
  const status = {} as Record<
    LLMModelType,
    { available: boolean; config: LLMConfig }
  >;

  for (const [modelType, config] of Object.entries(LLM_CONFIGS)) {
    status[modelType as LLMModelType] = {
      available: isModelAvailable(modelType as LLMModelType),
      config,
    };
  }

  return status;
}

/**
 * Validate environment configuration
 */
export function validateLLMConfig(): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check for required API keys
  if (!process.env.OPENAI_API_KEY) {
    issues.push("Missing OPENAI_API_KEY - OpenAI models will not work");
    recommendations.push("Add OPENAI_API_KEY to your environment variables");
  }

  if (!process.env.XAI_API_KEY) {
    recommendations.push(
      "Add XAI_API_KEY to enable Grok models for better Twitter understanding"
    );
  }

  // Check use case configurations
  for (const [, preference] of Object.entries(USE_CASE_PREFERENCES)) {
    const envModel = process.env[preference.envVar] as LLMModelType;
    if (envModel && !(envModel in LLM_CONFIGS)) {
      issues.push(
        `Invalid model "${envModel}" specified in ${preference.envVar}`
      );
      recommendations.push(
        `Set ${preference.envVar} to one of: ${Object.keys(LLM_CONFIGS).join(", ")}`
      );
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  };
}
