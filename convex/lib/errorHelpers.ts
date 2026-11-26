import { getClientErrorMessage } from "../../shared/lib/errors";

const MAX_ERROR_DEPTH = 8;
const MAX_ERROR_MESSAGE_LENGTH = 4_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncateErrorMessage(value: string): string {
  if (value.length <= MAX_ERROR_MESSAGE_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_ERROR_MESSAGE_LENGTH - 14)}...[truncated]`;
}

function sanitizeUnknownErrorValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (value === null) {
    return null;
  }

  if (depth >= MAX_ERROR_DEPTH) {
    return "[Truncated nested error]";
  }

  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "undefined":
      return undefined;
    case "function":
    case "symbol":
      return String(value);
    case "object": {
      if (value instanceof Date) {
        return value.toISOString();
      }

      if (value instanceof Error) {
        return serializeErrorInstance(value, depth + 1, seen);
      }

      if (Array.isArray(value)) {
        return value
          .map((item) => sanitizeUnknownErrorValue(item, depth + 1, seen))
          .filter((item) => item !== undefined);
      }

      if (!isRecord(value)) {
        return String(value);
      }

      if (seen.has(value)) {
        return "[Circular]";
      }

      seen.add(value);

      const sanitizedEntries = Object.entries(value)
        .map(
          ([key, entryValue]) =>
            [
              key,
              sanitizeUnknownErrorValue(entryValue, depth + 1, seen),
            ] as const
        )
        .filter(([, entryValue]) => entryValue !== undefined);

      return Object.fromEntries(sanitizedEntries);
    }
    default:
      return String(value);
  }
}

function serializeErrorInstance(
  error: Error,
  depth: number,
  seen: WeakSet<object>
): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message || error.name || "Unknown error",
  };

  if (error.stack) {
    serialized.stack = error.stack;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    serialized.cause = sanitizeUnknownErrorValue(cause, depth + 1, seen);
  }

  for (const [key, value] of Object.entries(error)) {
    if (serialized[key] !== undefined) {
      continue;
    }

    serialized[key] = sanitizeUnknownErrorValue(value, depth + 1, seen);
  }

  return serialized;
}

export function serializeUnknownError(error: unknown): unknown {
  return (
    sanitizeUnknownErrorValue(error, 0, new WeakSet<object>()) ?? {
      message: "Unknown error",
    }
  );
}

export function stringifyUnknownError(error: unknown): string {
  if (error instanceof Error) {
    const serialized = serializeUnknownError(error);
    if (isRecord(serialized)) {
      const message =
        typeof serialized.message === "string"
          ? serialized.message.trim()
          : undefined;
      const hasExtraFields = Object.keys(serialized).some(
        (key) => key !== "name" && key !== "message"
      );

      if (message && !hasExtraFields) {
        return truncateErrorMessage(message);
      }
    }

    return truncateErrorMessage(JSON.stringify(serialized));
  }

  if (typeof error === "string") {
    return truncateErrorMessage(error.trim() || "Unknown error");
  }

  const serialized = serializeUnknownError(error);
  if (typeof serialized === "string") {
    return truncateErrorMessage(serialized);
  }

  return truncateErrorMessage(JSON.stringify(serialized));
}

export function normalizeUnknownError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(stringifyUnknownError(error));
}

export function getUserSafeErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  return getClientErrorMessage(error, fallback);
}
