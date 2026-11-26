"use node";

import type { ActionCtx } from "../../_generated/server";
import {
  benchmarkHaltedWorkspace,
  benchmarkHaltMessage,
  type LinkdApiPurpose,
} from "../../lib/benchmarkLinkdApiCap";
import { acquireLinkdApiBudget } from "../../lib/linkdapiBudget";
import {
  assertProviderRequestAllowed,
  ProviderCircuitOpenError,
  recordProviderRequestOutcome,
  type ProviderUsageEstimate,
} from "../../lib/providerReliability";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";

const TREG_BASE_URL = "https://treg.to/call";
const DEFAULT_TREG_TIMEOUT_MS = 25_000;
const DEFAULT_ROUTED_MAX_COST_USD = "0.05";

export type TregQueryValue = string | number | boolean | undefined | null;

export class TregRequestError extends Error {
  status?: number;
  retryable: boolean;
  errorCode?: string;
  retryAfterMs?: number;
  toolId: string;
  detail?: string;

  constructor(args: {
    message: string;
    toolId: string;
    status?: number;
    retryable?: boolean;
    errorCode?: string;
    retryAfterMs?: number;
    detail?: string;
  }) {
    super(args.message);
    this.name = "TregRequestError";
    this.toolId = args.toolId;
    this.status = args.status;
    this.retryable = args.retryable ?? false;
    this.errorCode = args.errorCode;
    this.retryAfterMs = args.retryAfterMs;
    this.detail = args.detail;
  }
}

export interface TregCallAttempt<T> {
  toolId: string;
  method?: "GET" | "POST";
  query?: Record<string, TregQueryValue>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  parse: (raw: unknown) => T;
  /** Optional check to treat thin/empty responses as failover-eligible. */
  isEmpty?: (parsed: T) => boolean;
}

export interface TregCallResult<T> {
  data: T;
  toolId: string;
  servedBy: string;
  costUsd: number;
}

function getTregApiKey(): string {
  const token = process.env.TREG_API_KEY?.trim();
  if (!token) {
    throw new TregRequestError({
      message: "TREG_API_KEY environment variable not set",
      toolId: "config",
      retryable: false,
    });
  }
  return token;
}

function toQueryString(query?: Record<string, TregQueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      params.set(key, trimmed);
      continue;
    }
    params.set(key, String(value));
  }
  return params.toString();
}

function parseJsonSafe(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMeta(payload: unknown): {
  code?: string;
  message?: string;
  retryAfterMs?: number;
} {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const detail =
    record.detail && typeof record.detail === "object"
      ? (record.detail as Record<string, unknown>)
      : record;
  const code =
    typeof detail.error === "string"
      ? detail.error
      : typeof record.error === "string"
        ? record.error
        : undefined;
  const message =
    typeof detail.message === "string"
      ? detail.message
      : typeof record.message === "string"
        ? record.message
        : undefined;
  const retryAfterS =
    typeof detail.retry_after_s === "number"
      ? detail.retry_after_s
      : typeof record.retry_after_s === "number"
        ? record.retry_after_s
        : undefined;
  return {
    code,
    message,
    retryAfterMs: retryAfterS ? Math.round(retryAfterS * 1000) : undefined,
  };
}

/** Parse actual treg.to charge in USD from X-Treg-Cost-Micro header or _treg.charged_micro. */
export function parseTregCostUsd(
  costMicroHeader: string | null,
  payload: unknown
): number {
  if (costMicroHeader) {
    const micro = Number(costMicroHeader);
    if (Number.isFinite(micro) && micro >= 0) {
      return micro / 1_000_000;
    }
  }
  if (payload && typeof payload === "object") {
    const tregMeta = (payload as Record<string, unknown>)._treg;
    if (tregMeta && typeof tregMeta === "object") {
      const chargedMicro = (tregMeta as Record<string, unknown>).charged_micro;
      if (
        typeof chargedMicro === "number" &&
        Number.isFinite(chargedMicro) &&
        chargedMicro >= 0
      ) {
        return chargedMicro / 1_000_000;
      }
    }
  }
  return 0;
}

/**
 * Decide whether a treg.to error should fail over to the next provider.
 *
 * Fail over on rate limits (429 share_busy / provider_rate_limited), timeouts,
 * 5xx, and network errors. Never fail over on 4xx client/auth/billing errors.
 */
export function shouldFailoverTregError(error: unknown): boolean {
  if (error instanceof ProviderCircuitOpenError) {
    return false;
  }
  if (error instanceof TregRequestError) {
    if (
      error.status === 400 ||
      error.status === 401 ||
      error.status === 402 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 422
    ) {
      return false;
    }
    return error.retryable;
  }
  // Network/timeout errors from fetch
  return true;
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isTregHealthEvidenceError(
  error: unknown,
  httpStatus?: number
): boolean {
  if (typeof httpStatus === "number" && httpStatus >= 400 && httpStatus < 500) {
    return (
      httpStatus !== 401 &&
      httpStatus !== 402 &&
      httpStatus !== 403 &&
      httpStatus !== 429
    );
  }
  if (error instanceof TregRequestError && error.status === 404) {
    return true;
  }
  return false;
}

async function checkLinkedInProviderGuards(
  ctx: ActionCtx,
  consumer: string,
  purpose?: LinkdApiPurpose
) {
  if (purpose) {
    // Preserve benchmark keyword-post-search cap accounting when explicitly set.
    await acquireLinkdApiBudget(ctx, consumer, undefined, purpose);
    return;
  }

  const halted = benchmarkHaltedWorkspace();
  if (halted !== null) {
    const refusal = new ProviderCircuitOpenError({
      provider: "linkdapi",
      reason: "credits",
    });
    refusal.message = benchmarkHaltMessage(halted);
    throw refusal;
  }

  await assertProviderRequestAllowed(ctx, "linkdapi", {
    consumer,
    endpoint: consumer,
  });
}

async function executeSingleTregAttempt<T>(
  ctx: ActionCtx,
  attempt: TregCallAttempt<T>,
  consumer: string
): Promise<TregCallResult<T>> {
  const startedAt = getCurrentUTCTimestamp();
  const method = attempt.method ?? (attempt.body ? "POST" : "GET");
  const queryString = toQueryString(attempt.query);
  const url = queryString
    ? `${TREG_BASE_URL}/${attempt.toolId}?${queryString}`
    : `${TREG_BASE_URL}/${attempt.toolId}`;

  const headers: Record<string, string> = {
    "X-Treg-Token": getTregApiKey(),
    Accept: "application/json",
    ...(attempt.toolId.startsWith("treg.")
      ? { "X-Treg-Route-Max-Cost": DEFAULT_ROUTED_MAX_COST_USD }
      : {}),
    ...attempt.headers,
  };
  if (attempt.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let httpStatus: number | undefined;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body:
        attempt.body !== undefined ? JSON.stringify(attempt.body) : undefined,
      signal: AbortSignal.timeout(attempt.timeoutMs ?? DEFAULT_TREG_TIMEOUT_MS),
    });
    httpStatus = response.status;

    const payloadText = await response.text();
    const payload = parseJsonSafe(payloadText);

    if (!response.ok) {
      const meta = extractErrorMeta(payload);
      throw new TregRequestError({
        message:
          meta.message ||
          `treg.to ${attempt.toolId} failed with HTTP ${response.status}`,
        toolId: attempt.toolId,
        status: response.status,
        retryable: isRetryableHttpStatus(response.status),
        errorCode: meta.code,
        retryAfterMs: meta.retryAfterMs,
        detail: payloadText.slice(0, 500),
      });
    }

    if (payload === null) {
      throw new TregRequestError({
        message: `treg.to ${attempt.toolId} returned empty or invalid JSON`,
        toolId: attempt.toolId,
        status: response.status,
        retryable: true,
        detail: payloadText.slice(0, 500),
      });
    }

    const servedBy =
      response.headers.get("x-treg-served-by")?.trim() || attempt.toolId;
    const costUsd = parseTregCostUsd(
      response.headers.get("x-treg-cost-micro"),
      payload
    );
    const data = attempt.parse(payload);

    const usage: ProviderUsageEstimate = {
      billableUnits: 1,
      estimatedCostUsd: costUsd,
    };

    await recordProviderRequestOutcome({
      ctx,
      provider: "linkdapi",
      request: {
        consumer,
        endpoint: `treg:${servedBy}`,
      },
      startedAt,
      outcome: "success",
      httpStatus,
      usage,
      healthEvidence: true,
    });

    return {
      data,
      toolId: attempt.toolId,
      servedBy,
      costUsd,
    };
  } catch (error) {
    const recordedStatus =
      error instanceof TregRequestError
        ? (error.status ?? httpStatus)
        : httpStatus;
    await recordProviderRequestOutcome({
      ctx,
      provider: "linkdapi",
      request: {
        consumer,
        endpoint: `treg:${attempt.toolId}`,
      },
      startedAt,
      outcome: "error",
      httpStatus: recordedStatus,
      error,
      healthEvidence: isTregHealthEvidenceError(error, httpStatus),
    });
    throw error;
  }
}

/**
 * Call treg.to with an ordered provider fallback chain.
 *
 * Automatically fails over on 429 (`share_busy` / `provider_rate_limited`),
 * timeouts, and 5xx responses while preserving accurate cost telemetry.
 */
export async function requestTregWithFallback<T>(
  ctx: ActionCtx,
  args: {
    consumer: string;
    purpose?: LinkdApiPurpose;
    attempts: ReadonlyArray<TregCallAttempt<T>>;
  }
): Promise<TregCallResult<T>> {
  if (args.attempts.length === 0) {
    throw new TregRequestError({
      message: `No treg.to attempts configured for ${args.consumer}`,
      toolId: "none",
      retryable: false,
    });
  }

  await checkLinkedInProviderGuards(ctx, args.consumer, args.purpose);

  let lastError: unknown;
  let lastEmptyResult: TregCallResult<T> | null = null;

  for (let index = 0; index < args.attempts.length; index += 1) {
    const attempt = args.attempts[index];
    const hasMoreAttempts = index < args.attempts.length - 1;

    try {
      const result = await executeSingleTregAttempt(
        ctx,
        attempt,
        args.consumer
      );
      if (attempt.isEmpty?.(result.data) && hasMoreAttempts) {
        lastEmptyResult = result;
        continue;
      }
      return result;
    } catch (error) {
      lastError = error;
      if (!hasMoreAttempts || !shouldFailoverTregError(error)) {
        if (lastEmptyResult) {
          return lastEmptyResult;
        }
        throw error;
      }
    }
  }

  if (lastEmptyResult) {
    return lastEmptyResult;
  }
  throw lastError;
}
