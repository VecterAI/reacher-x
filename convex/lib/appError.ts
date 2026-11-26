import { ConvexError } from "convex/values";
import type { AppErrorCode } from "../../shared/lib/errors";

export type AppErrorPayload = {
  code: AppErrorCode;
  message: string;
};

/**
 * Builds a typed ConvexError for expected, user-actionable failures.
 * Keep unexpected bugs and third-party provider failures as plain Error so
 * they stay raw in backend logs and never leak internals to the client UI.
 */
export function createAppError(
  code: AppErrorCode,
  message: string
): ConvexError<AppErrorPayload> {
  return new ConvexError({ code, message });
}

/** Throws a typed ConvexError for an expected, user-actionable failure. */
export function throwAppError(code: AppErrorCode, message: string): never {
  throw createAppError(code, message);
}
