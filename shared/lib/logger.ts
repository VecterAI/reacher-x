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

function emit(level: LogLevel, scope: string | undefined, args: unknown[]) {
  if (!shouldLog) return;

  const ts = new Date().toISOString();
  const consoleAny = console as unknown as Record<
    LogLevel,
    (...args: unknown[]) => void
  >;
  const method: (...args: unknown[]) => void = consoleAny[level] || console.log;

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
  const payload = {
    level,
    ts,
    scope,
    message: typeof args[0] === "string" ? (args[0] as string) : undefined,
    args: args.map(serializeArg),
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
