import type { JSONValue } from "ai";

export type OpenRouterProviderRouting = Record<string, JSONValue> & {
  ignore?: string[];
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
    const lastAttempt = args.attempts[args.attempts.length - 1];
    super(lastAttempt?.errorMessage ?? "Failed to generate structured output");
    this.name = "StructuredGenerationError";
    this.operation = args.operation;
    this.attempts = args.attempts;
  }
}

/**
 * OpenRouter response metadata uses display names (for example "Cerebras"),
 * while provider routing requires slugs. Resolve only against the configured
 * route so an unknown display name can never become an invalid ignore value.
 */
export function resolveOpenRouterProviderSlug(args: {
  providerName: string;
  configuredProviderSlugs: readonly string[];
}): string | undefined {
  const normalizedProviderName = args.providerName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!normalizedProviderName) {
    return undefined;
  }

  for (const configuredSlug of args.configuredProviderSlugs) {
    const baseSlug = configuredSlug.split("/")[0];
    const normalizedBaseSlug = baseSlug.replace(/[^a-z0-9]/g, "");
    if (normalizedBaseSlug === normalizedProviderName) {
      return baseSlug;
    }
  }

  return undefined;
}

/**
 * Keep OpenRouter's request-level failover available for every structured
 * attempt. After an application-level parse/schema failure, a caller can add
 * the provider that served the failed response to `ignoredProviders` so the
 * next attempt gets provider diversity without narrowing the request to one
 * endpoint.
 */
export function getStructuredAttemptProviderOptions(args: {
  providerOptions: OpenRouterProviderOptions;
  ignoredProviders?: readonly string[];
  requireStructuredOutput: boolean;
}): {
  providerOptions: OpenRouterProviderOptions;
  configuredProvider: string;
} {
  const routing = args.providerOptions.openrouter.provider;
  const ignoredProviders = [
    ...new Set([...(routing.ignore ?? []), ...(args.ignoredProviders ?? [])]),
  ];
  const normalizedIgnoredProviders = new Set(
    ignoredProviders.map((provider) => provider.toLowerCase())
  );
  const remainingOnly = routing.only?.filter(
    (provider) => !normalizedIgnoredProviders.has(provider.toLowerCase())
  );
  const remainingOrder = routing.order?.filter(
    (provider) => !normalizedIgnoredProviders.has(provider.toLowerCase())
  );
  const nextRouting: OpenRouterProviderRouting = {
    ...routing,
    allow_fallbacks: true,
    ...(args.requireStructuredOutput ? { require_parameters: true } : {}),
    ...(ignoredProviders.length > 0 ? { ignore: ignoredProviders } : {}),
  };
  if (routing.only) {
    if (remainingOnly && remainingOnly.length > 0) {
      nextRouting.only = remainingOnly;
    } else {
      delete nextRouting.only;
    }
  }
  if (routing.order) {
    if (remainingOrder && remainingOrder.length > 0) {
      nextRouting.order = remainingOrder;
    } else {
      delete nextRouting.order;
    }
  }
  const configuredProviders = routing.only ?? routing.order ?? [];
  const configuredProvider = configuredProviders.join("/") || "openrouter";

  return {
    providerOptions: {
      openrouter: {
        ...args.providerOptions.openrouter,
        provider: nextRouting,
      },
    },
    configuredProvider:
      ignoredProviders.length > 0
        ? `${configuredProvider} excluding ${ignoredProviders.join("/")}`
        : configuredProvider,
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
