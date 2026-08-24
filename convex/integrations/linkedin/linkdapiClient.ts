"use node";

import type { ActionCtx } from "../../_generated/server";
import { acquireLinkdApiBudget } from "../../lib/linkdapiBudget";
import {
  classifyProviderFailure,
  recordProviderRequestOutcome,
  type ProviderUsageEstimate,
} from "../../lib/providerReliability";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";

type LinkdApiQueryValue = string | number | boolean | undefined | null;

type LinkdApiEnvelope<T> = {
  success?: boolean;
  statusCode?: number;
  message?: string;
  errors?: unknown;
  data?: T;
};

export class LinkdApiRequestError extends Error {
  status?: number;
  retryable: boolean;
  detail?: string;

  constructor(args: {
    message: string;
    status?: number;
    retryable?: boolean;
    detail?: string;
  }) {
    super(args.message);
    this.name = "LinkdApiRequestError";
    this.status = args.status;
    this.retryable = args.retryable ?? false;
    this.detail = args.detail;
  }
}

function getApiKey() {
  const apiKey = process.env.LINKDAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new LinkdApiRequestError({
      message: "LINKDAPI_API_KEY environment variable not set",
      retryable: false,
    });
  }
  return apiKey;
}

function isRetryableStatus(status?: number) {
  return status === 429 || status === 408 || status === 503 || status === 504;
}

export function isLinkdApiNoDataError(
  error: unknown
): error is LinkdApiRequestError {
  if (!(error instanceof LinkdApiRequestError) || error.status !== 200) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("the data cannot be displayed or it doesn't exist") ||
    message.includes("the data cannot be displayed or it does not exist")
  );
}

export function isLinkdApiProviderHealthEvidence(
  error: unknown,
  httpStatus?: number
): boolean {
  if (
    !(error instanceof LinkdApiRequestError) ||
    typeof httpStatus !== "number" ||
    httpStatus < 200 ||
    httpStatus >= 300
  ) {
    return false;
  }

  const recordedStatus = error.status ?? httpStatus;
  return classifyProviderFailure(error, recordedStatus).reason === "unknown";
}

function toQueryString(query?: Record<string, LinkdApiQueryValue>) {
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

function parseJsonEnvelope<T>(payloadText: string): LinkdApiEnvelope<T> | null {
  if (!payloadText.trim()) {
    return null;
  }

  try {
    return JSON.parse(payloadText) as LinkdApiEnvelope<T>;
  } catch {
    return null;
  }
}

export async function requestLinkdApiData<T>(
  ctx: ActionCtx,
  args: {
    path: string;
    query?: Record<string, LinkdApiQueryValue>;
    consumer: string;
  }
): Promise<T> {
  await acquireLinkdApiBudget(ctx, args.consumer);

  const request = {
    consumer: args.consumer,
    endpoint: args.path,
  };
  const startedAt = getCurrentUTCTimestamp();
  let httpStatus: number | undefined;

  try {
    const queryString = toQueryString(args.query);
    const url = queryString
      ? `https://linkdapi.com${args.path}?${queryString}`
      : `https://linkdapi.com${args.path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-linkdapi-apikey": getApiKey(),
        Accept: "application/json",
      },
    });
    httpStatus = response.status;

    const payloadText = await response.text();
    const payload = parseJsonEnvelope<T>(payloadText);

    if (!response.ok) {
      throw new LinkdApiRequestError({
        message:
          payload?.message ||
          `LinkdAPI request failed with ${response.status} for ${args.path}`,
        status: response.status,
        retryable: isRetryableStatus(response.status),
        detail: payloadText.slice(0, 500),
      });
    }

    if (payload?.success === false) {
      const status = payload.statusCode;
      throw new LinkdApiRequestError({
        message: payload.message || `LinkdAPI request failed for ${args.path}`,
        status,
        retryable: isRetryableStatus(status),
        detail:
          typeof payload.errors === "string"
            ? payload.errors
            : payloadText.slice(0, 500),
      });
    }

    if (payload && "data" in payload) {
      const usage: ProviderUsageEstimate = {
        billableUnits: 1,
        estimatedCostUsd: 0,
      };
      await recordProviderRequestOutcome({
        ctx,
        provider: "linkdapi",
        request,
        startedAt,
        outcome: "success",
        httpStatus,
        usage,
        healthEvidence: true,
      });
      return payload.data as T;
    }

    throw new LinkdApiRequestError({
      message: `LinkdAPI returned no data for ${args.path}`,
      retryable: false,
      detail: payloadText.slice(0, 500),
    });
  } catch (error) {
    const recordedStatus =
      error instanceof LinkdApiRequestError
        ? (error.status ?? httpStatus)
        : httpStatus;
    await recordProviderRequestOutcome({
      ctx,
      provider: "linkdapi",
      request,
      startedAt,
      outcome: "error",
      httpStatus: recordedStatus,
      error,
      healthEvidence: isLinkdApiProviderHealthEvidence(error, httpStatus),
    });
    throw error;
  }
}
