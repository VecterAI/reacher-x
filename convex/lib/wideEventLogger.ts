import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import {
  compactLogContext,
  getLogDeploymentContext,
  getLogEnvironmentContext,
  getLogServiceName,
  redactLogData,
} from "../../shared/lib/logging/config";
import { isRecord } from "./typeGuards";

type JsonRecord = Record<string, unknown>;

export type ConvexFunctionKind =
  | "action"
  | "internalAction"
  | "mutation"
  | "internalMutation"
  | "httpAction";

export type ConvexWideEventKind =
  | ConvexFunctionKind
  | "agentTool"
  | "manual"
  | "workflow";

export interface ConvexFunctionLogMeta {
  includeArgs?: string[];
  operation?: string;
}

export interface ConvexWideEventLogger {
  emitError(error: unknown, context?: JsonRecord): void;
  emitSuccess(result?: unknown, context?: JsonRecord): void;
  error(error: unknown, context?: JsonRecord): void;
  getContext(): JsonRecord;
  info(message: string, context?: JsonRecord): void;
  set(context: JsonRecord): void;
  warn(message: string, context?: JsonRecord): void;
}

const SAFE_IDENTIFIER_KEYS = new Set([
  "action",
  "batchCount",
  "conversationId",
  "count",
  "cursor",
  "jobId",
  "keyword",
  "keywordCount",
  "limit",
  "messageId",
  "mode",
  "monitorId",
  "offset",
  "operation",
  "planId",
  "postId",
  "profileId",
  "projectId",
  "prospectId",
  "provider",
  "query",
  "requestId",
  "retryCount",
  "screenName",
  "sessionId",
  "source",
  "status",
  "threadId",
  "type",
  "urn",
  "url",
  "userId",
  "workflowId",
  "workspaceId",
]);

const SENSITIVE_KEYS = new Set([
  "accessToken",
  "apiKey",
  "authorization",
  "content",
  "cookie",
  "description",
  "email",
  "html",
  "password",
  "prompt",
  "raw",
  "rawBody",
  "refreshToken",
  "secret",
  "text",
  "token",
]);

function toIsoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function createInvocationId(): string {
  const webCrypto =
    typeof globalThis !== "undefined" &&
    "crypto" in globalThis &&
    globalThis.crypto
      ? globalThis.crypto
      : undefined;

  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  return `log_${getCurrentUTCTimestamp()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(
    typeof error === "string" ? error : "Unknown error during logged operation"
  );
}

function shouldIncludeArgKey(key: string, includeArgs?: string[]): boolean {
  if (SENSITIVE_KEYS.has(key)) {
    return false;
  }

  if (includeArgs?.includes(key)) {
    return true;
  }

  return SAFE_IDENTIFIER_KEYS.has(key) || key.endsWith("Id");
}

function summarizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return {
      count: value.length,
      sample: value
        .slice(0, 3)
        .map((item) =>
          typeof item === "string" || typeof item === "number"
            ? item
            : undefined
        )
        .filter((item) => item !== undefined),
    };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const summary = compactLogContext({
    id:
      typeof value.id === "string"
        ? value.id
        : typeof value._id === "string"
          ? value._id
          : undefined,
    keys: Object.keys(value).slice(0, 8),
  });

  return Object.keys(summary).length > 0 ? summary : undefined;
}

function summarizeArgs(
  args: unknown,
  includeArgs?: string[]
): JsonRecord | undefined {
  if (!isRecord(args)) {
    return undefined;
  }

  const summary: JsonRecord = {
    arg_keys: Object.keys(args).sort(),
  };

  for (const [key, value] of Object.entries(args)) {
    if (!shouldIncludeArgKey(key, includeArgs)) {
      continue;
    }

    const summarizedValue = summarizeValue(value);
    if (summarizedValue !== undefined) {
      summary[key] = summarizedValue;
    }
  }

  const compactedSummary = compactLogContext(summary);
  return Object.keys(compactedSummary).length > 0
    ? (compactedSummary as JsonRecord)
    : undefined;
}

function summarizeResult(result: unknown): JsonRecord | undefined {
  if (Array.isArray(result)) {
    return { result_count: result.length, result_type: "array" };
  }

  if (isRecord(result)) {
    return {
      result_keys: Object.keys(result).slice(0, 10),
      result_type: "object",
    };
  }

  if (result === null || result === undefined) {
    return undefined;
  }

  return { result_type: typeof result };
}

function createBaseContext(context: JsonRecord) {
  const environment = getLogEnvironmentContext();
  return compactLogContext({
    service: getLogServiceName(),
    environment: environment.environment,
    version: environment.version,
    commit_hash: environment.commitHash,
    region: environment.region,
    ...getLogDeploymentContext(),
    ...context,
  });
}

function buildOperationName(
  kind: ConvexFunctionKind,
  source: string | undefined,
  meta?: ConvexFunctionLogMeta
): string {
  if (meta?.operation) {
    return meta.operation;
  }

  if (source) {
    return `${kind}:${source}`;
  }

  return kind;
}

function getSourceModule(source: string | undefined): string | undefined {
  if (!source) {
    return undefined;
  }

  return source.split(":")[0];
}

function isObjectRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeContext(target: JsonRecord, source: JsonRecord) {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    const existingValue = target[key];
    if (isObjectRecord(existingValue) && isObjectRecord(value)) {
      mergeContext(existingValue, value);
      continue;
    }

    target[key] = value;
  }
}

type ConvexWideEventLevel = "info" | "warn" | "error";

interface ConvexWideEventState {
  context: JsonRecord;
  error?: JsonRecord;
  level: ConvexWideEventLevel;
  messages: Array<JsonRecord>;
}

function serializeError(error: Error): JsonRecord {
  return compactLogContext({
    message: error.message,
    name: error.name,
    stack: error.stack,
  }) as JsonRecord;
}

function updateLevel(
  currentLevel: ConvexWideEventLevel,
  nextLevel: ConvexWideEventLevel
): ConvexWideEventLevel {
  if (currentLevel === "error" || nextLevel === "error") {
    return "error";
  }

  if (currentLevel === "warn" || nextLevel === "warn") {
    return "warn";
  }

  return "info";
}

function emitWideEvent(level: ConvexWideEventLevel, payload: JsonRecord) {
  const serialized = JSON.stringify(redactLogData(payload));
  const consoleRef = globalThis["console"] as unknown as
    | Record<string, unknown>
    | undefined;
  const methodName =
    level === "error" ? "error" : level === "warn" ? "warn" : "info";
  const method =
    typeof consoleRef?.[methodName] === "function"
      ? (consoleRef[methodName] as (value: string) => void).bind(consoleRef)
      : typeof consoleRef?.log === "function"
        ? (consoleRef.log as (value: string) => void).bind(consoleRef)
        : undefined;

  method?.(serialized);
}

function createWideEventLoggerCore(
  state: ConvexWideEventState,
  startedAt: number
): ConvexWideEventLogger {
  return {
    set(context) {
      mergeContext(state.context, context);
    },
    info(message, context) {
      if (context) {
        mergeContext(state.context, context);
      }
      state.messages.push(
        compactLogContext({
          level: "info",
          message,
          ...context,
        }) as JsonRecord
      );
    },
    warn(message, context) {
      if (context) {
        mergeContext(state.context, context);
      }
      state.level = updateLevel(state.level, "warn");
      state.messages.push(
        compactLogContext({
          level: "warn",
          message,
          ...context,
        }) as JsonRecord
      );
    },
    error(error, context) {
      const normalizedError = normalizeError(error);
      if (context) {
        mergeContext(state.context, context);
      }
      state.level = "error";
      state.error = serializeError(normalizedError);
    },
    getContext() {
      return state.context;
    },
    emitSuccess(result, context) {
      if (context) {
        mergeContext(state.context, context);
      }
      const finishedAt = getCurrentUTCTimestamp();
      const outcome = state.level === "error" ? "error" : "success";
      const payload = compactLogContext({
        timestamp: toIsoTimestamp(finishedAt),
        level: state.level,
        outcome,
        duration_ms: finishedAt - startedAt,
        finished_at: toIsoTimestamp(finishedAt),
        ...summarizeResult(result),
        ...state.context,
        error: outcome === "error" ? state.error : undefined,
        messages: state.messages.length > 0 ? state.messages : undefined,
      }) as JsonRecord;

      emitWideEvent(state.level, payload);
    },
    emitError(error, context) {
      const normalizedError = normalizeError(error);
      if (context) {
        mergeContext(state.context, context);
      }
      state.level = "error";
      state.error = serializeError(normalizedError);
      const finishedAt = getCurrentUTCTimestamp();
      const payload = compactLogContext({
        timestamp: toIsoTimestamp(finishedAt),
        level: "error",
        outcome: "error",
        duration_ms: finishedAt - startedAt,
        finished_at: toIsoTimestamp(finishedAt),
        ...state.context,
        error: state.error,
        messages: state.messages.length > 0 ? state.messages : undefined,
      }) as JsonRecord;

      emitWideEvent("error", payload);
    },
  };
}

export function createConvexFunctionWideEventLogger(args: {
  functionArgs: unknown;
  kind: ConvexFunctionKind;
  meta?: ConvexFunctionLogMeta;
  source?: string;
}): ConvexWideEventLogger {
  const startedAt = getCurrentUTCTimestamp();
  const invocationId = createInvocationId();
  const operation = buildOperationName(args.kind, args.source, args.meta);

  const state: ConvexWideEventState = {
    context: createBaseContext({
      source: "convex",
      kind: args.kind,
      operation,
      invocation_id: invocationId,
      module: getSourceModule(args.source),
      registration_source: args.source,
      started_at: toIsoTimestamp(startedAt),
      args: summarizeArgs(args.functionArgs, args.meta?.includeArgs),
    }) as JsonRecord,
    level: "info",
    messages: [],
  };

  return createWideEventLoggerCore(state, startedAt);
}

export function createConvexHttpWideEventLogger(args: {
  operation: string;
  request: Request;
}): ConvexWideEventLogger {
  const startedAt = getCurrentUTCTimestamp();
  const url = new URL(args.request.url);
  const requestId =
    args.request.headers.get("x-request-id") ?? createInvocationId();
  const state: ConvexWideEventState = {
    context: createBaseContext({
      source: "convex",
      kind: "httpAction",
      operation: args.operation,
      method: args.request.method,
      path: url.pathname,
      request_id: requestId,
      query_keys: Array.from(url.searchParams.keys()).sort(),
      started_at: toIsoTimestamp(startedAt),
    }) as JsonRecord,
    level: "info",
    messages: [],
  };

  return createWideEventLoggerCore(state, startedAt);
}

export function createManualWideEventLogger(args: {
  context?: JsonRecord;
  kind: ConvexWideEventKind;
  operation: string;
  source?: string;
}): ConvexWideEventLogger {
  const startedAt = getCurrentUTCTimestamp();
  const state: ConvexWideEventState = {
    context: createBaseContext({
      source: args.source ?? "convex",
      kind: args.kind,
      operation: args.operation,
      invocation_id: createInvocationId(),
      started_at: toIsoTimestamp(startedAt),
      ...args.context,
    }) as JsonRecord,
    level: "info",
    messages: [],
  };

  return createWideEventLoggerCore(state, startedAt);
}

export function getWideEventLogger(ctx: unknown): ConvexWideEventLogger | null {
  if (!isRecord(ctx) || !("logEvent" in ctx)) {
    return null;
  }

  const candidate = ctx.logEvent;
  if (!isRecord(candidate)) {
    return null;
  }

  if (
    typeof candidate.set === "function" &&
    typeof candidate.emitSuccess === "function" &&
    typeof candidate.emitError === "function"
  ) {
    return candidate as unknown as ConvexWideEventLogger;
  }

  return null;
}
