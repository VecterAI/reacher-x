import { ConvexError } from "convex/values";
import { logger } from "./logger";

const CONVEX_ERROR_SYMBOL = Symbol.for("ConvexError");

export const DEFAULT_CLIENT_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "ACCOUNT_NOT_CONNECTED"
  | "PLAN_UNAVAILABLE"
  | "PLAN_LIMIT_REACHED"
  | "RATE_LIMITED"
  | "ACTION_IN_PROGRESS"
  | "PROVIDER_UNAVAILABLE"
  | "BAD_REQUEST";

export type AppErrorData = {
  code?: string;
  message: string;
};

const INTERNAL_ERROR_PATTERNS = [
  /\[CONVEX\s+[A-Z]\(/i,
  /\[Request ID:/i,
  /\bCalled by client\b/i,
  /\bServer Error\b/i,
  /\bUncaught (?:Convex)?Error:/i,
  /\bat\s+\S+\s+\([^)]+:\d+:\d+\)/,
  /^\s*[[{][\s\S]*[\]}]\s*$/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConvexErrorLike(error: unknown): error is { data: unknown } {
  if (error instanceof ConvexError) {
    return true;
  }

  if (typeof error !== "object" || error === null || !("data" in error)) {
    return false;
  }

  const record = error as Record<PropertyKey, unknown>;
  return record[CONVEX_ERROR_SYMBOL] === true || record.name === "ConvexError";
}

/**
 * Guards against accidentally surfacing Convex runtime wrappers, stack frames,
 * or raw JSON payloads even if passed through a structured error.
 */
export function looksLikeInternalErrorMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) {
    return true;
  }

  return INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Extracts structured `{ code, message }` data from a ConvexError when it
 * contains a clean, user-safe message.
 */
export function extractConvexErrorData(error: unknown): AppErrorData | null {
  if (!isConvexErrorLike(error)) {
    return null;
  }

  const { data } = error;
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed || looksLikeInternalErrorMessage(trimmed)) {
      return null;
    }
    return { message: trimmed };
  }

  if (isRecord(data) && typeof data.message === "string") {
    const trimmed = data.message.trim();
    if (!trimmed || looksLikeInternalErrorMessage(trimmed)) {
      return null;
    }
    return {
      code: typeof data.code === "string" ? data.code : undefined,
      message: trimmed,
    };
  }

  return null;
}

/** Returns the user-safe message from a ConvexError, or undefined otherwise. */
export function getConvexErrorMessage(error: unknown): string | undefined {
  return extractConvexErrorData(error)?.message;
}

/** Returns the structured code from a ConvexError, or undefined otherwise. */
export function getConvexErrorCode(error: unknown): string | undefined {
  return extractConvexErrorData(error)?.code;
}

/**
 * Pure helper for converting any unknown error into a safe end-user message.
 * Only unwraps explicit ConvexError payloads; all other errors fall back to
 * `fallback` so raw server, stack, and provider errors never reach the UI.
 */
export function getClientErrorMessage(
  error: unknown,
  fallback = DEFAULT_CLIENT_ERROR_MESSAGE
): string {
  return getConvexErrorMessage(error) ?? fallback;
}

/**
 * Imperative variant for `catch` blocks: logs the full raw error in dev
 * (via `logger.error`) when it is not an expected ConvexError, and returns
 * a safe end-user message.
 */
export function captureClientErrorMessage(
  error: unknown,
  fallback = DEFAULT_CLIENT_ERROR_MESSAGE,
  scope = "ClientError"
): string {
  const convexMessage = getConvexErrorMessage(error);
  if (convexMessage) {
    return convexMessage;
  }

  logger.withScope(scope).error(fallback, error);
  return fallback;
}
