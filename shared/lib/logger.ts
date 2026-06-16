import {
  compactLogContext,
  getLogEnvironmentContext,
  getLogServiceName,
  redactLogData,
} from "./logging/config";

export type LogLevel = "log" | "info" | "warn" | "error" | "debug" | "trace";

const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";
const env = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
const isProduction = env === "production";

// Policy:
// - Browser: no logs in production; log in development for DX.
// - Server (Next.js / Convex): always log; emit structured JSON for consistency.
const shouldLog = isBrowser ? !isProduction : true;

function serializeArg(arg: unknown): unknown {
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      stack: arg.stack,
    };
  }
  return arg;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}

function parseLogArguments(args: unknown[]) {
  const message = typeof args[0] === "string" ? (args[0] as string) : undefined;
  const values = message ? args.slice(1) : args;
  const context: Record<string, unknown> = {};
  const extras: unknown[] = [];
  let error: Record<string, unknown> | undefined;

  for (const value of values) {
    if (value instanceof Error) {
      error = serializeArg(value) as Record<string, unknown>;
      continue;
    }

    if (isPlainObject(value)) {
      Object.assign(context, value);
      continue;
    }

    extras.push(serializeArg(value));
  }

  if (extras.length > 0) {
    context.values = extras;
  }

  return {
    context: compactLogContext(context),
    error,
    message,
  };
}

function emit(level: LogLevel, scope: string | undefined, args: unknown[]) {
  if (!shouldLog) return;

  // Use a lazy timestamp to avoid new Date() during prerender (Next.js 16 cacheComponents)
  const ts = isBrowser ? new Date().toISOString() : "";
  const consoleRef = globalThis["console"] as unknown as
    | Record<string, unknown>
    | undefined;
  const levelMethod =
    typeof consoleRef?.[level] === "function"
      ? (consoleRef[level] as (...args: unknown[]) => void).bind(consoleRef)
      : undefined;
  const fallbackMethod =
    typeof consoleRef?.log === "function"
      ? (consoleRef.log as (...args: unknown[]) => void).bind(consoleRef)
      : undefined;
  const method = levelMethod ?? fallbackMethod;

  if (!method) {
    return;
  }

  if (isBrowser) {
    const prefix = `[${level.toUpperCase()}][${ts}]`;
    const scopePrefix = scope ? `[${scope}]` : undefined;
    if (scopePrefix) {
      method(prefix, scopePrefix, ...args);
    } else {
      method(prefix, ...args);
    }
    return;
  }

  // Server-side: Single-line JSON for easy ingestion in Vercel/Convex logs
  const { context, error, message } = parseLogArguments(args);
  const environment = getLogEnvironmentContext();
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    ts,
    service: getLogServiceName(),
    environment: environment.environment,
    version: environment.version,
    commitHash: environment.commitHash,
    region: environment.region,
    scope,
    message,
    context:
      Object.keys(context).length > 0 ? redactLogData(context) : undefined,
    error: error ? redactLogData(error) : undefined,
  };
  try {
    method(JSON.stringify(payload));
  } catch {
    // Fallback to plain logging if serialization fails
    method(
      `[${level.toUpperCase()}][${ts}]`,
      scope ? `[${scope}]` : "",
      ...args
    );
  }
}

function createMethod(level: LogLevel) {
  return (...args: unknown[]) => emit(level, undefined, args);
}

export const logger = {
  log: createMethod("log"),
  info: createMethod("info"),
  warn: createMethod("warn"),
  error: createMethod("error"),
  debug: createMethod("debug"),
  trace: createMethod("trace"),
  withScope(scope: string) {
    return {
      log: (...args: unknown[]) => emit("log", scope, args),
      info: (...args: unknown[]) => emit("info", scope, args),
      warn: (...args: unknown[]) => emit("warn", scope, args),
      error: (...args: unknown[]) => emit("error", scope, args),
      debug: (...args: unknown[]) => emit("debug", scope, args),
      trace: (...args: unknown[]) => emit("trace", scope, args),
    };
  },
};
