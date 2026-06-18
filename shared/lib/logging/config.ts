import packageJson from "../../../package.json";

const LOG_SERVICE_NAME = "reacher-x";

const DEFAULT_LOG_REDACT_PATHS = [
  "**.accessToken",
  "**.apiKey",
  "**.authorization",
  "**.content",
  "**.cookie",
  "**.email",
  "**.html",
  "**.password",
  "**.prompt",
  "**.raw",
  "**.rawBody",
  "**.refreshToken",
  "**.secret",
  "**.token",
] as const;

const REDACTED_LOG_VALUE = "[REDACTED]";
const CIRCULAR_LOG_VALUE = "[Circular]";
const NORMALIZED_SENSITIVE_LOG_KEYS = new Set(
  [
    "accessToken",
    "apiKey",
    "authorization",
    "content",
    "cookie",
    "email",
    "html",
    "password",
    "prompt",
    "raw",
    "rawBody",
    "refreshToken",
    "secret",
    "token",
  ].map((key) => normalizeLogFieldName(key))
);

interface LogEnvironmentContext {
  appEnvironment: string;
  commitHash?: string;
  deploymentEnvironment: string;
  environmentSource: string;
  environment: string;
  region?: string;
  service: string;
  version: string;
}

interface LogDeploymentContext {
  convexDeployment?: string;
  convexDeploymentType?: string;
  deploymentSource: string;
  deployment_id?: string;
  hostname?: string;
  runtime: string;
  runtimeFamily: string;
}

export function getLogServiceName(): string {
  return LOG_SERVICE_NAME;
}

function getProcessEnv() {
  return typeof process !== "undefined" ? process.env : undefined;
}

function normalizeEnvironmentName(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized === "prod") {
    return "production";
  }

  if (normalized === "dev") {
    return "development";
  }

  return normalized;
}

function getConvexDeploymentType(
  deployment: string | undefined
): string | undefined {
  const normalized = deployment?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const separatorIndex = normalized.indexOf(":");
  const prefix =
    separatorIndex === -1 ? normalized : normalized.slice(0, separatorIndex);

  return normalizeEnvironmentName(prefix);
}

export function getLogEnvironmentContext(): LogEnvironmentContext {
  const env = getProcessEnv();
  const appEnvironment =
    normalizeEnvironmentName(env?.VERCEL_ENV) ??
    normalizeEnvironmentName(env?.NODE_ENV) ??
    "development";
  const convexDeploymentType = getConvexDeploymentType(env?.CONVEX_DEPLOYMENT);
  const deploymentEnvironment =
    normalizeEnvironmentName(env?.LOG_DEPLOYMENT_ENVIRONMENT) ??
    convexDeploymentType ??
    appEnvironment;
  const environmentSource = env?.LOG_ENVIRONMENT
    ? "LOG_ENVIRONMENT"
    : env?.LOG_DEPLOYMENT_ENVIRONMENT
      ? "LOG_DEPLOYMENT_ENVIRONMENT"
      : convexDeploymentType
        ? "CONVEX_DEPLOYMENT"
        : env?.VERCEL_ENV
          ? "VERCEL_ENV"
          : env?.NODE_ENV
            ? "NODE_ENV"
            : "default";

  return {
    service: LOG_SERVICE_NAME,
    environment:
      normalizeEnvironmentName(env?.LOG_ENVIRONMENT) ?? deploymentEnvironment,
    appEnvironment,
    deploymentEnvironment,
    environmentSource,
    version: env?.SERVICE_VERSION ?? packageJson.version,
    commitHash: env?.VERCEL_GIT_COMMIT_SHA ?? env?.COMMIT_SHA ?? undefined,
    region: env?.VERCEL_REGION ?? env?.AWS_REGION ?? undefined,
  };
}

export function getLogDeploymentContext(): LogDeploymentContext {
  const env = getProcessEnv();
  const runtime =
    typeof window !== "undefined"
      ? "browser"
      : env?.NEXT_RUNTIME
        ? env.NEXT_RUNTIME
        : env?.CONVEX_DEPLOYMENT || env?.CONVEX_SITE_URL
          ? "convex"
          : "node";
  const runtimeFamily =
    typeof window !== "undefined"
      ? "browser"
      : env?.NEXT_RUNTIME
        ? "nextjs"
        : env?.CONVEX_DEPLOYMENT || env?.CONVEX_SITE_URL
          ? "convex"
          : "node";

  return {
    convexDeployment: env?.CONVEX_DEPLOYMENT ?? undefined,
    convexDeploymentType: getConvexDeploymentType(env?.CONVEX_DEPLOYMENT),
    deploymentSource:
      env?.CONVEX_DEPLOYMENT || env?.CONVEX_SITE_URL
        ? "convex"
        : env?.VERCEL_DEPLOYMENT_ID
          ? "vercel"
          : env?.HOSTNAME
            ? "hostname"
            : "unknown",
    deployment_id: env?.VERCEL_DEPLOYMENT_ID ?? undefined,
    hostname: env?.HOSTNAME ?? undefined,
    runtime,
    runtimeFamily,
  };
}

export function getDefaultLogRedactPaths(): string[] {
  return [...DEFAULT_LOG_REDACT_PATHS];
}

function normalizeLogFieldName(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function shouldRedactLogField(key: string): boolean {
  return NORMALIZED_SENSITIVE_LOG_KEYS.has(normalizeLogFieldName(key));
}

function redactLogValue(value: unknown, seen: WeakSet<object>): unknown {
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
    return value.map((item) => redactLogValue(item, seen));
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return CIRCULAR_LOG_VALUE;
  }

  seen.add(value);

  const redactedEntries = Object.entries(value as Record<string, unknown>).map(
    ([key, entryValue]) => [
      key,
      shouldRedactLogField(key)
        ? REDACTED_LOG_VALUE
        : redactLogValue(entryValue, seen),
    ]
  );

  return Object.fromEntries(redactedEntries);
}

export function redactLogData<T>(value: T): T {
  return redactLogValue(value, new WeakSet<object>()) as T;
}

export function compactLogContext<T extends Record<string, unknown>>(
  context: T
): Partial<T> {
  const entries = Object.entries(context).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return true;
  });

  return Object.fromEntries(entries) as Partial<T>;
}
