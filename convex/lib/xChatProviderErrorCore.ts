import { isRecord } from "./typeGuards";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

export type XChatProviderErrorDetails = {
  status: number;
  code: "rate_limited" | "xchat_access_denied" | "provider_error";
  message: string;
  retryAt?: number;
  limit?: number;
  remaining?: number;
};

function parseNonNegativeInteger(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function getProviderProblemMessage(rawBody: string): string | undefined {
  try {
    const payload: unknown = JSON.parse(rawBody);
    if (!isRecord(payload)) return undefined;
    const direct = [payload.detail, payload.title].find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    );
    if (direct) return direct.trim().slice(0, 300);
    const firstError = Array.isArray(payload.errors)
      ? payload.errors.find(isRecord)
      : undefined;
    const nested =
      firstError &&
      [firstError.detail, firstError.title].find(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      );
    return nested?.trim().slice(0, 300);
  } catch {
    return undefined;
  }
}

export function parseXChatProviderError(args: {
  status: number;
  statusText: string;
  headers: Headers;
  rawBody: string;
  now?: number;
}): XChatProviderErrorDetails {
  const now = args.now ?? getCurrentUTCTimestamp();
  const resetSeconds = parseNonNegativeInteger(
    args.headers.get("x-rate-limit-reset")
  );
  const retryAfterSeconds = parseNonNegativeInteger(
    args.headers.get("retry-after")
  );
  const retryAt =
    typeof resetSeconds === "number"
      ? resetSeconds * 1000
      : typeof retryAfterSeconds === "number"
        ? now + retryAfterSeconds * 1000
        : undefined;
  const providerMessage = getProviderProblemMessage(args.rawBody);
  const limit = parseNonNegativeInteger(args.headers.get("x-rate-limit-limit"));
  const remaining = parseNonNegativeInteger(
    args.headers.get("x-rate-limit-remaining")
  );
  const rateLimited = args.status === 429;
  const xChatAccessDenied =
    args.status === 403 &&
    typeof providerMessage === "string" &&
    /developer\s+app.+attached to a project/iu.test(providerMessage);
  const retryLabel =
    rateLimited && typeof retryAt === "number"
      ? ` Retry after ${new Date(retryAt).toISOString()}.`
      : "";
  return {
    status: args.status,
    code: rateLimited
      ? "rate_limited"
      : xChatAccessDenied
        ? "xchat_access_denied"
        : "provider_error",
    message: rateLimited
      ? `XChat is temporarily rate limited.${retryLabel}`
      : (providerMessage ??
        `XChat request failed (${args.status} ${args.statusText}).`),
    ...(rateLimited && typeof retryAt === "number" ? { retryAt } : {}),
    ...(typeof limit === "number" ? { limit } : {}),
    ...(typeof remaining === "number" ? { remaining } : {}),
  };
}
