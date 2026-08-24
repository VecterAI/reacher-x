import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { Infer } from "convex/values";
import { stringifyUnknownError } from "./errorHelpers";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { providerNameValidator } from "../validators";
import { getSystemRuntimeConfig } from "./runtimeConfigHelpers";

export type ProviderName = Infer<typeof providerNameValidator>;
export type ProviderCircuitReason =
  | "credits"
  | "authentication"
  | "rate_limit"
  | "transient"
  | "unknown";

export type ProviderRequestContext = {
  consumer: string;
  endpoint: string;
  workspaceId?: Id<"workspaces">;
  prospectId?: Id<"prospects">;
  autoPlanRunId?: Id<"autoPlanRuns">;
};

export type ProviderUsageEstimate = {
  billableUnits: number;
  estimatedCostUsd: number;
};

export type ProviderRequestOutcome = "success" | "error" | "blocked";

export const SOCIAL_API_COST_PER_ENTITY_USD = 0.2 / 1_000;
export const EXA_SEARCH_COST_PER_REQUEST_USD = 7 / 1_000;
export const EXA_CONTENT_COST_PER_PAGE_USD = 1 / 1_000;

const CIRCUIT_BREAKING_CLIENT_HTTP_STATUSES = new Set([
  401, 402, 403, 408, 429,
]);

export function isProviderHealthEvidenceHttpStatus(
  httpStatus?: number
): boolean {
  return (
    typeof httpStatus === "number" &&
    httpStatus >= 400 &&
    httpStatus < 500 &&
    !CIRCUIT_BREAKING_CLIENT_HTTP_STATUSES.has(httpStatus)
  );
}

export function hasProviderHealthEvidence(
  outcome: ProviderRequestOutcome,
  healthEvidence?: boolean
): boolean {
  return (
    (outcome === "success" && healthEvidence !== false) ||
    (outcome === "error" && healthEvidence === true)
  );
}

export function estimateSocialApiBillableUnits(payload: unknown): number {
  if (Array.isArray(payload)) {
    return payload.length;
  }
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["tweets", "posts", "users", "spaces", "lists"]) {
    if (Array.isArray(record[key])) {
      return record[key].length;
    }
  }
  if (Array.isArray(record.data)) {
    return record.data.length;
  }
  if (record.data && typeof record.data === "object") {
    return estimateSocialApiBillableUnits(record.data) || 1;
  }
  return 1;
}

export class ProviderCircuitOpenError extends Error {
  readonly provider: ProviderName;
  readonly reason: ProviderCircuitReason;
  readonly retryAfterAt?: number;

  constructor(args: {
    provider: ProviderName;
    reason: ProviderCircuitReason;
    retryAfterAt?: number;
  }) {
    super(
      `${args.provider} provider circuit is open (${args.reason})${
        args.retryAfterAt ? ` until ${args.retryAfterAt}` : ""
      }`
    );
    this.name = "ProviderCircuitOpenError";
    this.provider = args.provider;
    this.reason = args.reason;
    this.retryAfterAt = args.retryAfterAt;
  }
}

export function classifyProviderFailure(
  error: unknown,
  httpStatus?: number
): {
  reason: ProviderCircuitReason;
  retryAfterMs: number;
} {
  const circuitConfig = getSystemRuntimeConfig().providers.circuit;
  const message = stringifyUnknownError(error).toLowerCase();
  if (
    httpStatus === 402 ||
    message.includes("insufficient balance") ||
    message.includes("no_more_credits") ||
    message.includes("no more credits") ||
    message.includes("credits exhausted") ||
    message.includes("credit balance") ||
    message.includes("budget exceeded") ||
    message.includes("payment required") ||
    /\b402\b/.test(message)
  ) {
    return {
      reason: "credits",
      retryAfterMs: circuitConfig.probeIntervalMs,
    };
  }
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    message.includes("invalid api key") ||
    message.includes("api_key environment variable not set") ||
    message.includes("api key is not") ||
    message.includes("unauthorized") ||
    /\b(401|403)\b/.test(message)
  ) {
    return {
      reason: "authentication",
      retryAfterMs: circuitConfig.probeIntervalMs,
    };
  }
  if (
    httpStatus === 429 ||
    message.includes("rate limit") ||
    /\b429\b/.test(message)
  ) {
    return {
      reason: "rate_limit",
      retryAfterMs: circuitConfig.rateLimitRetryMs,
    };
  }
  if (
    httpStatus === 408 ||
    (typeof httpStatus === "number" && httpStatus >= 500) ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("temporarily unavailable") ||
    /\b5\d\d\b/.test(message)
  ) {
    return {
      reason: "transient",
      retryAfterMs: circuitConfig.transientRetryMs,
    };
  }
  return { reason: "unknown", retryAfterMs: circuitConfig.transientRetryMs };
}

export async function assertProviderRequestAllowed(
  ctx: ActionCtx,
  provider: ProviderName,
  request: ProviderRequestContext
) {
  const permission = await ctx.runMutation(
    internal.providerReliability.acquireProviderCircuitPermission,
    {
      provider,
      ...request,
    }
  );
  if (!permission.allowed) {
    throw new ProviderCircuitOpenError({
      provider,
      reason: permission.reason ?? "unknown",
      retryAfterAt: permission.retryAfterAt,
    });
  }
}

export async function trackProviderRequest<T>(args: {
  ctx: ActionCtx;
  provider: ProviderName;
  request: ProviderRequestContext;
  execute: () => Promise<T>;
  estimateUsage: (result: T) => ProviderUsageEstimate;
}): Promise<T> {
  await assertProviderRequestAllowed(args.ctx, args.provider, args.request);
  const startedAt = getCurrentUTCTimestamp();
  try {
    const result = await args.execute();
    const usage = args.estimateUsage(result);
    await args.ctx.runMutation(
      internal.providerReliability.recordProviderRequestResult,
      {
        provider: args.provider,
        outcome: "success",
        ...args.request,
        requestCount: 1,
        billableUnits: Math.max(0, usage.billableUnits),
        estimatedCostUsd: Math.max(0, usage.estimatedCostUsd),
        durationMs: Math.max(0, getCurrentUTCTimestamp() - startedAt),
        healthEvidence: true,
      }
    );
    return result;
  } catch (error) {
    const failure = classifyProviderFailure(error);
    await args.ctx.runMutation(
      internal.providerReliability.recordProviderRequestResult,
      {
        provider: args.provider,
        outcome: "error",
        ...args.request,
        requestCount: 1,
        billableUnits: 0,
        estimatedCostUsd: 0,
        errorCode: failure.reason,
        errorMessage: stringifyUnknownError(error),
        durationMs: Math.max(0, getCurrentUTCTimestamp() - startedAt),
        circuitReason: failure.reason,
        circuitRetryAfterMs: failure.retryAfterMs,
      }
    );
    throw error;
  }
}

export async function recordProviderRequestOutcome(args: {
  ctx: ActionCtx;
  provider: ProviderName;
  request: ProviderRequestContext;
  startedAt: number;
  outcome: "success" | "error";
  usage?: ProviderUsageEstimate;
  httpStatus?: number;
  error?: unknown;
  healthEvidence?: boolean;
}) {
  const failure =
    args.outcome === "error"
      ? classifyProviderFailure(args.error, args.httpStatus)
      : undefined;
  await args.ctx.runMutation(
    internal.providerReliability.recordProviderRequestResult,
    {
      provider: args.provider,
      outcome: args.outcome,
      ...args.request,
      requestCount: 1,
      billableUnits: Math.max(0, args.usage?.billableUnits ?? 0),
      estimatedCostUsd: Math.max(0, args.usage?.estimatedCostUsd ?? 0),
      httpStatus: args.httpStatus,
      errorCode: failure?.reason,
      errorMessage:
        args.outcome === "error"
          ? stringifyUnknownError(args.error)
          : undefined,
      durationMs: Math.max(0, getCurrentUTCTimestamp() - args.startedAt),
      circuitReason: failure?.reason,
      circuitRetryAfterMs: failure?.retryAfterMs,
      healthEvidence:
        args.outcome === "success"
          ? (args.healthEvidence ?? (args.usage?.billableUnits ?? 0) > 0)
          : (args.healthEvidence ??
            isProviderHealthEvidenceHttpStatus(args.httpStatus)),
    }
  );
}
