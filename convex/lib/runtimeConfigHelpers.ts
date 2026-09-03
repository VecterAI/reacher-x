import { env } from "../_generated/server";

const MINUTE_MS = 60 * 1000;
const SECOND_MS = 1000;

export type RuntimeEnvironment = Partial<typeof env>;

type RetryConfig = {
  maxAttempts: number;
  initialBackoffMs: number;
  base: number;
};

type WorkpoolConfig = RetryConfig & {
  maxParallelism: number;
};

function readClampedNumber(args: {
  value: string | undefined;
  fallback: number;
  min: number;
  max: number;
  integer?: boolean;
}) {
  const parsed =
    args.value === undefined || args.value.trim() === ""
      ? Number.NaN
      : Number(args.value);
  const finite = Number.isFinite(parsed) ? parsed : args.fallback;
  const normalized = args.integer ? Math.floor(finite) : finite;
  return Math.min(args.max, Math.max(args.min, normalized));
}

export function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

/**
 * Inline composer autocomplete kill-switch.
 * When unset: on in production, off in development (same pattern as
 * PROSPECTING_AUTO_RESCHEDULE). Set explicitly to `1`/`0` per deployment.
 */
export function isInlineAutocompleteEnabled(
  source: RuntimeEnvironment = env,
  isProduction = process.env.NODE_ENV === "production"
): boolean {
  return readBoolean(source.INLINE_AUTOCOMPLETE_ENABLED, isProduction);
}

function readRetryConfig(args: {
  source: RuntimeEnvironment;
  attemptsKey:
    | "PROSPECTING_AI_RETRY_MAX_ATTEMPTS"
    | "PROSPECTING_PROVIDER_RETRY_MAX_ATTEMPTS"
    | "PROSPECTING_AUXILIARY_RETRY_MAX_ATTEMPTS";
  backoffKey:
    | "PROSPECTING_AI_RETRY_INITIAL_BACKOFF_MS"
    | "PROSPECTING_PROVIDER_RETRY_INITIAL_BACKOFF_MS"
    | "PROSPECTING_AUXILIARY_RETRY_INITIAL_BACKOFF_MS";
  defaultAttempts: number;
  defaultBackoffMs: number;
}): RetryConfig {
  return {
    maxAttempts: readClampedNumber({
      value: args.source[args.attemptsKey],
      fallback: args.defaultAttempts,
      min: 1,
      max: 10,
      integer: true,
    }),
    initialBackoffMs: readClampedNumber({
      value: args.source[args.backoffKey],
      fallback: args.defaultBackoffMs,
      min: 100,
      max: 60_000,
      integer: true,
    }),
    base: readClampedNumber({
      value: args.source.PROSPECTING_RETRY_BACKOFF_BASE,
      fallback: 2,
      min: 1,
      max: 5,
    }),
  };
}

function readWorkpoolConfig(args: {
  source: RuntimeEnvironment;
  parallelismKey:
    | "QUALIFICATION_MAX_PARALLELISM"
    | "ENRICHMENT_MAX_PARALLELISM"
    | "OUTREACH_PLAN_MAX_PARALLELISM";
  attemptsKey:
    | "QUALIFICATION_RETRY_MAX_ATTEMPTS"
    | "ENRICHMENT_RETRY_MAX_ATTEMPTS"
    | "OUTREACH_PLAN_RETRY_MAX_ATTEMPTS";
  backoffKey:
    | "QUALIFICATION_RETRY_INITIAL_BACKOFF_MS"
    | "ENRICHMENT_RETRY_INITIAL_BACKOFF_MS"
    | "OUTREACH_PLAN_RETRY_INITIAL_BACKOFF_MS";
  defaultParallelism: number;
  defaultBackoffMs: number;
}): WorkpoolConfig {
  return {
    maxParallelism: readClampedNumber({
      value: args.source[args.parallelismKey],
      fallback: args.defaultParallelism,
      min: 1,
      max: 100,
      integer: true,
    }),
    maxAttempts: readClampedNumber({
      value: args.source[args.attemptsKey],
      fallback: 3,
      min: 1,
      max: 10,
      integer: true,
    }),
    initialBackoffMs: readClampedNumber({
      value: args.source[args.backoffKey],
      fallback: args.defaultBackoffMs,
      min: 100,
      max: 60_000,
      integer: true,
    }),
    base: readClampedNumber({
      value: args.source.WORKPOOL_RETRY_BACKOFF_BASE,
      fallback: 2,
      min: 1,
      max: 5,
    }),
  };
}

function readProviderBudgetConfig(args: {
  source: RuntimeEnvironment;
  requestsKey: "SOCIALAPI_REQUESTS_PER_MINUTE" | "LINKDAPI_REQUESTS_PER_MINUTE";
  targetKey:
    | "SOCIALAPI_TARGET_REQUESTS_PER_MINUTE"
    | "LINKDAPI_TARGET_REQUESTS_PER_MINUTE";
  reservationAttemptsKey:
    | "SOCIALAPI_BUDGET_RESERVATION_MAX_ATTEMPTS"
    | "LINKDAPI_BUDGET_RESERVATION_MAX_ATTEMPTS";
  retryBaseKey: "SOCIALAPI_OCC_RETRY_BASE_MS" | "LINKDAPI_OCC_RETRY_BASE_MS";
  retryJitterKey:
    | "SOCIALAPI_OCC_RETRY_JITTER_MS"
    | "LINKDAPI_OCC_RETRY_JITTER_MS";
  defaultRequestsPerMinute: number;
  defaultTargetRequestsPerMinute: number;
}) {
  const requestsPerMinute = readClampedNumber({
    value: args.source[args.requestsKey],
    fallback: args.defaultRequestsPerMinute,
    min: 1,
    max: 10_000,
    integer: true,
  });
  const configuredTarget = readClampedNumber({
    value: args.source[args.targetKey],
    fallback: args.defaultTargetRequestsPerMinute,
    min: 1,
    max: 10_000,
    integer: true,
  });
  const targetRequestsPerMinute = Math.min(requestsPerMinute, configuredTarget);

  return {
    requestsPerMinute,
    targetRequestsPerMinute,
    requestSpacingMs: Math.ceil(60_000 / targetRequestsPerMinute),
    reservationMaxAttempts: readClampedNumber({
      value: args.source[args.reservationAttemptsKey],
      fallback: 12,
      min: 1,
      max: 50,
      integer: true,
    }),
    occRetryBaseMs: readClampedNumber({
      value: args.source[args.retryBaseKey],
      fallback: 25,
      min: 1,
      max: 5_000,
      integer: true,
    }),
    occRetryJitterMs: readClampedNumber({
      value: args.source[args.retryJitterKey],
      fallback: 40,
      min: 0,
      max: 5_000,
      integer: true,
    }),
  };
}

export function getSystemRuntimeConfig(
  source: RuntimeEnvironment = env,
  isProduction = process.env.NODE_ENV === "production"
) {
  return {
    prospecting: {
      autoReschedule: readBoolean(
        source.PROSPECTING_AUTO_RESCHEDULE,
        isProduction
      ),
      steadyStateIntervalMs:
        readClampedNumber({
          value: source.PROSPECTING_RESCHEDULE_INTERVAL_MINUTES,
          fallback: 60,
          min: 1,
          max: 24 * 60,
        }) * MINUTE_MS,
      bootstrap: {
        readyTarget: readClampedNumber({
          value: source.PROSPECTING_BOOTSTRAP_READY_TARGET,
          fallback: 12,
          min: 1,
          max: 100,
          integer: true,
        }),
        intervalMs:
          readClampedNumber({
            value: source.PROSPECTING_BOOTSTRAP_INTERVAL_MINUTES,
            fallback: 2,
            min: 0.5,
            max: 60,
          }) * MINUTE_MS,
        maxCycles: readClampedNumber({
          value: source.PROSPECTING_BOOTSTRAP_MAX_CYCLES,
          fallback: 8,
          min: 1,
          max: 50,
          integer: true,
        }),
        noProgressTimeoutMs:
          readClampedNumber({
            value: source.PROSPECTING_BOOTSTRAP_NO_PROGRESS_TIMEOUT_MINUTES,
            fallback: 20,
            min: 1,
            max: 24 * 60,
          }) * MINUTE_MS,
        pendingQualificationYieldPercent: readClampedNumber({
          value:
            source.PROSPECTING_BOOTSTRAP_PENDING_QUALIFICATION_YIELD_PERCENT,
          fallback: 30,
          min: 0,
          max: 100,
        }),
      },
      batch: {
        seedKeywordsPerCycle: readClampedNumber({
          value: source.PROSPECTING_SEED_KEYWORDS_PER_CYCLE,
          fallback: 10,
          min: 1,
          max: 50,
          integer: true,
        }),
        socialQueriesPerCycle: readClampedNumber({
          value: source.PROSPECTING_SOCIAL_QUERIES_PER_CYCLE,
          fallback: 15,
          min: 1,
          max: 100,
          integer: true,
        }),
        twitterSearchBatch: readClampedNumber({
          value: source.PROSPECTING_TWITTER_SEARCH_BATCH,
          fallback: 9,
          min: 1,
          max: 50,
          integer: true,
        }),
        twitterSearchPagesPerQuery: readClampedNumber({
          value: source.PROSPECTING_TWITTER_SEARCH_PAGES_PER_QUERY,
          fallback: 3,
          min: 1,
          max: 3,
          integer: true,
        }),
        twitterSearchLookbackDays: readClampedNumber({
          value: source.PROSPECTING_TWITTER_SEARCH_LOOKBACK_DAYS,
          fallback: 90,
          min: 1,
          max: 365,
          integer: true,
        }),
        linkedinPostSearchBatch: readClampedNumber({
          value: source.PROSPECTING_LINKEDIN_POST_SEARCH_BATCH,
          fallback: 5,
          min: 1,
          max: 50,
          integer: true,
        }),
        linkedinPeopleSearchBatch: readClampedNumber({
          value: source.PROSPECTING_LINKEDIN_PEOPLE_SEARCH_BATCH,
          fallback: 4,
          min: 1,
          max: 50,
          integer: true,
        }),
      },
      recovery: {
        baseDelayMs:
          readClampedNumber({
            value: source.PROSPECTING_RECOVERY_BASE_DELAY_MINUTES,
            fallback: 60,
            min: 1,
            max: 24 * 60,
          }) * MINUTE_MS,
        maxDelayMs:
          readClampedNumber({
            value: source.PROSPECTING_RECOVERY_MAX_DELAY_MINUTES,
            fallback: 4 * 60,
            min: 1,
            max: 7 * 24 * 60,
          }) * MINUTE_MS,
        jitterWindowMs:
          readClampedNumber({
            value: source.PROSPECTING_RECOVERY_JITTER_MINUTES,
            fallback: 10,
            min: 0,
            max: 60,
          }) * MINUTE_MS,
      },
      retries: {
        ai: readRetryConfig({
          source,
          attemptsKey: "PROSPECTING_AI_RETRY_MAX_ATTEMPTS",
          backoffKey: "PROSPECTING_AI_RETRY_INITIAL_BACKOFF_MS",
          defaultAttempts: 3,
          defaultBackoffMs: 1_000,
        }),
        provider: readRetryConfig({
          source,
          attemptsKey: "PROSPECTING_PROVIDER_RETRY_MAX_ATTEMPTS",
          backoffKey: "PROSPECTING_PROVIDER_RETRY_INITIAL_BACKOFF_MS",
          defaultAttempts: 2,
          defaultBackoffMs: 2_000,
        }),
        auxiliary: readRetryConfig({
          source,
          attemptsKey: "PROSPECTING_AUXILIARY_RETRY_MAX_ATTEMPTS",
          backoffKey: "PROSPECTING_AUXILIARY_RETRY_INITIAL_BACKOFF_MS",
          defaultAttempts: 2,
          defaultBackoffMs: 1_000,
        }),
      },
    },
    providers: {
      socialApi: readProviderBudgetConfig({
        source,
        requestsKey: "SOCIALAPI_REQUESTS_PER_MINUTE",
        targetKey: "SOCIALAPI_TARGET_REQUESTS_PER_MINUTE",
        reservationAttemptsKey: "SOCIALAPI_BUDGET_RESERVATION_MAX_ATTEMPTS",
        retryBaseKey: "SOCIALAPI_OCC_RETRY_BASE_MS",
        retryJitterKey: "SOCIALAPI_OCC_RETRY_JITTER_MS",
        defaultRequestsPerMinute: 500,
        defaultTargetRequestsPerMinute: 300,
      }),
      linkdApi: readProviderBudgetConfig({
        source,
        requestsKey: "LINKDAPI_REQUESTS_PER_MINUTE",
        targetKey: "LINKDAPI_TARGET_REQUESTS_PER_MINUTE",
        reservationAttemptsKey: "LINKDAPI_BUDGET_RESERVATION_MAX_ATTEMPTS",
        retryBaseKey: "LINKDAPI_OCC_RETRY_BASE_MS",
        retryJitterKey: "LINKDAPI_OCC_RETRY_JITTER_MS",
        defaultRequestsPerMinute: 30,
        defaultTargetRequestsPerMinute: 24,
      }),
      circuit: {
        probeIntervalMs:
          readClampedNumber({
            value: source.PROVIDER_CIRCUIT_PROBE_INTERVAL_SECONDS,
            fallback: 120,
            min: 5,
            max: 24 * 60 * 60,
          }) * SECOND_MS,
        probeLeaseMs:
          readClampedNumber({
            value: source.PROVIDER_CIRCUIT_PROBE_LEASE_SECONDS,
            fallback: 30,
            min: 1,
            max: 60 * 60,
          }) * SECOND_MS,
        transientFailuresBeforeOpen: readClampedNumber({
          value: source.PROVIDER_TRANSIENT_FAILURES_BEFORE_OPEN,
          fallback: 3,
          min: 1,
          max: 20,
          integer: true,
        }),
        rateLimitRetryMs:
          readClampedNumber({
            value: source.PROVIDER_RATE_LIMIT_RETRY_SECONDS,
            fallback: 60,
            min: 1,
            max: 24 * 60 * 60,
          }) * SECOND_MS,
        transientRetryMs:
          readClampedNumber({
            value: source.PROVIDER_TRANSIENT_RETRY_SECONDS,
            fallback: 60,
            min: 1,
            max: 24 * 60 * 60,
          }) * SECOND_MS,
      },
    },
    workpools: {
      qualification: readWorkpoolConfig({
        source,
        parallelismKey: "QUALIFICATION_MAX_PARALLELISM",
        attemptsKey: "QUALIFICATION_RETRY_MAX_ATTEMPTS",
        backoffKey: "QUALIFICATION_RETRY_INITIAL_BACKOFF_MS",
        defaultParallelism: 10,
        defaultBackoffMs: 1_000,
      }),
      enrichment: readWorkpoolConfig({
        source,
        parallelismKey: "ENRICHMENT_MAX_PARALLELISM",
        attemptsKey: "ENRICHMENT_RETRY_MAX_ATTEMPTS",
        backoffKey: "ENRICHMENT_RETRY_INITIAL_BACKOFF_MS",
        defaultParallelism: 10,
        defaultBackoffMs: 1_000,
      }),
      outreachPlan: readWorkpoolConfig({
        source,
        parallelismKey: "OUTREACH_PLAN_MAX_PARALLELISM",
        attemptsKey: "OUTREACH_PLAN_RETRY_MAX_ATTEMPTS",
        backoffKey: "OUTREACH_PLAN_RETRY_INITIAL_BACKOFF_MS",
        defaultParallelism: 5,
        defaultBackoffMs: 2_000,
      }),
    },
  };
}

export type SystemRuntimeConfig = ReturnType<typeof getSystemRuntimeConfig>;
