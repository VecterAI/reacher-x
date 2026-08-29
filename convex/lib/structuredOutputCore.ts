import type { JSONValue } from "ai";

export type OpenRouterProviderRouting = Record<string, JSONValue> & {
  only?: string[];
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
  sort?: "price" | "throughput" | "latency";
};

export type OpenRouterProviderOptions = {
  openrouter: Record<string, JSONValue> & {
    provider: OpenRouterProviderRouting;
  };
};

export type StructuredGenerationAttempt = {
  attemptNumber: number;
  routing: string;
  model: string;
  configuredProvider: string;
  providerSelected?: string;
  modelSelected?: string;
  finishReason?: string;
  responseLength?: number;
  outputTokens?: number;
  durationMs: number;
  errorMessage: string;
};

export class StructuredGenerationError extends Error {
  readonly operation: string;
  readonly attempts: readonly StructuredGenerationAttempt[];

  constructor(args: {
    operation: string;
    attempts: readonly StructuredGenerationAttempt[];
  }) {
    const lastAttempt = args.attempts.at(-1);
    super(lastAttempt?.errorMessage ?? "Failed to generate structured output");
    this.name = "StructuredGenerationError";
    this.operation = args.operation;
    this.attempts = args.attempts;
  }
}

/**
 * OpenRouter provider fallback handles request failures, but a provider can
 * return HTTP success with malformed JSON. Pin each application-level retry to
 * a different configured provider so a parse/schema failure gets real provider
 * diversity instead of returning to the first provider in the order.
 */
export function getStructuredAttemptProviderOptions(args: {
  providerOptions: OpenRouterProviderOptions;
  attemptIndex: number;
  totalAttempts: number;
  requireStructuredOutput: boolean;
}): {
  providerOptions: OpenRouterProviderOptions;
  configuredProvider: string;
} {
  const routing = args.providerOptions.openrouter.provider;
  const order = routing.order ?? [];
  const shouldPinProvider = args.totalAttempts > 1 && order.length > 1;
  const selectedProvider = shouldPinProvider
    ? order[args.attemptIndex % order.length]
    : undefined;
  const nextRouting: OpenRouterProviderRouting = {
    ...routing,
    ...(args.requireStructuredOutput ? { require_parameters: true } : {}),
    ...(selectedProvider
      ? {
          only: [selectedProvider],
          order: [selectedProvider],
          allow_fallbacks: false,
        }
      : {}),
  };

  return {
    providerOptions: {
      openrouter: {
        ...args.providerOptions.openrouter,
        provider: nextRouting,
      },
    },
    configuredProvider:
      selectedProvider ??
      routing.only?.join("/") ??
      routing.order?.join("/") ??
      "openrouter",
  };
}

export function combineStructuredGenerationErrors(args: {
  operation: string;
  errors: readonly unknown[];
}): StructuredGenerationError {
  const attempts = args.errors.flatMap((error) =>
    error instanceof StructuredGenerationError ? [...error.attempts] : []
  );

  return new StructuredGenerationError({
    operation: args.operation,
    attempts,
  });
}
