/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex query and mutation functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import {
  ActionBuilder,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import type { DataModel } from "./dataModel.js";

/**
 * Typesafe environment variables.
 *
 * This includes platform-provided env vars and any variables declared in
 * `convex.config.ts`.
 */
type Env = {
  readonly CONVEX_CLOUD_URL: string;
  readonly CONVEX_SITE_URL: string;
  readonly AI_AUTOCOMPLETE_MODEL: string | undefined;
  readonly AI_FAST_MODEL: string | undefined;
  readonly AI_MAIN_AGENT_MODEL: string | undefined;
  readonly AI_ONBOARDING_MODEL: string | undefined;
  readonly AI_OUTREACH_FAST_MODEL: string | undefined;
  readonly AI_OUTREACH_RECOVERY_MODEL: string | undefined;
  readonly AI_OUTREACH_ROUTER_MODEL: string | undefined;
  readonly AI_OUTREACH_STANDARD_MODEL: string | undefined;
  readonly AI_REASONING_MODEL: string | undefined;
  readonly AI_SETUP_AGENT_MODEL: string | undefined;
  readonly AI_TEXT_EMBEDDING_MODEL: string | undefined;
  readonly AI_VISION_MODEL: string | undefined;
  readonly ENRICHMENT_MAX_PARALLELISM: string | undefined;
  readonly ENRICHMENT_RETRY_INITIAL_BACKOFF_MS: string | undefined;
  readonly ENRICHMENT_RETRY_MAX_ATTEMPTS: string | undefined;
  readonly INLINE_AUTOCOMPLETE_ENABLED: string | undefined;
  readonly LINKDAPI_BUDGET_RESERVATION_MAX_ATTEMPTS: string | undefined;
  readonly LINKDAPI_OCC_RETRY_BASE_MS: string | undefined;
  readonly LINKDAPI_OCC_RETRY_JITTER_MS: string | undefined;
  readonly LINKDAPI_REQUESTS_PER_MINUTE: string | undefined;
  readonly LINKDAPI_TARGET_REQUESTS_PER_MINUTE: string | undefined;
  readonly OPENROUTER_ROUTING_PRESET: "current" | "cost_optimized" | undefined;
  readonly OUTREACH_PLAN_MAX_PARALLELISM: string | undefined;
  readonly OUTREACH_PLAN_RETRY_INITIAL_BACKOFF_MS: string | undefined;
  readonly OUTREACH_PLAN_RETRY_MAX_ATTEMPTS: string | undefined;
  readonly PROSPECTING_AI_RETRY_INITIAL_BACKOFF_MS: string | undefined;
  readonly PROSPECTING_AI_RETRY_MAX_ATTEMPTS: string | undefined;
  readonly PROSPECTING_AUTO_RESCHEDULE: string | undefined;
  readonly PROSPECTING_AUXILIARY_RETRY_INITIAL_BACKOFF_MS: string | undefined;
  readonly PROSPECTING_AUXILIARY_RETRY_MAX_ATTEMPTS: string | undefined;
  readonly PROSPECTING_BOOTSTRAP_INTERVAL_MINUTES: string | undefined;
  readonly PROSPECTING_BOOTSTRAP_MAX_CYCLES: string | undefined;
  readonly PROSPECTING_BOOTSTRAP_NO_PROGRESS_TIMEOUT_MINUTES:
    | string
    | undefined;
  readonly PROSPECTING_BOOTSTRAP_PENDING_QUALIFICATION_YIELD_PERCENT:
    | string
    | undefined;
  readonly PROSPECTING_BOOTSTRAP_READY_TARGET: string | undefined;
  readonly PROSPECTING_LINKEDIN_PEOPLE_SEARCH_BATCH: string | undefined;
  readonly PROSPECTING_LINKEDIN_POST_SEARCH_BATCH: string | undefined;
  readonly PROSPECTING_PROVIDER_RETRY_INITIAL_BACKOFF_MS: string | undefined;
  readonly PROSPECTING_PROVIDER_RETRY_MAX_ATTEMPTS: string | undefined;
  readonly PROSPECTING_RECOVERY_BASE_DELAY_MINUTES: string | undefined;
  readonly PROSPECTING_RECOVERY_JITTER_MINUTES: string | undefined;
  readonly PROSPECTING_RECOVERY_MAX_DELAY_MINUTES: string | undefined;
  readonly PROSPECTING_RESCHEDULE_INTERVAL_MINUTES: string | undefined;
  readonly PROSPECTING_RETRY_BACKOFF_BASE: string | undefined;
  readonly PROSPECTING_SEED_KEYWORDS_PER_CYCLE: string | undefined;
  readonly PROSPECTING_SOCIAL_QUERIES_PER_CYCLE: string | undefined;
  readonly PROSPECTING_TWITTER_SEARCH_BATCH: string | undefined;
  readonly PROVIDER_CIRCUIT_PROBE_INTERVAL_SECONDS: string | undefined;
  readonly PROVIDER_CIRCUIT_PROBE_LEASE_SECONDS: string | undefined;
  readonly PROVIDER_RATE_LIMIT_RETRY_SECONDS: string | undefined;
  readonly PROVIDER_TRANSIENT_FAILURES_BEFORE_OPEN: string | undefined;
  readonly PROVIDER_TRANSIENT_RETRY_SECONDS: string | undefined;
  readonly QUALIFICATION_MAX_PARALLELISM: string | undefined;
  readonly QUALIFICATION_RETRY_INITIAL_BACKOFF_MS: string | undefined;
  readonly QUALIFICATION_RETRY_MAX_ATTEMPTS: string | undefined;
  readonly SOCIALAPI_BUDGET_RESERVATION_MAX_ATTEMPTS: string | undefined;
  readonly SOCIALAPI_OCC_RETRY_BASE_MS: string | undefined;
  readonly SOCIALAPI_OCC_RETRY_JITTER_MS: string | undefined;
  readonly SOCIALAPI_REQUESTS_PER_MINUTE: string | undefined;
  readonly SOCIALAPI_TARGET_REQUESTS_PER_MINUTE: string | undefined;
  readonly WORKPOOL_RETRY_BACKOFF_BASE: string | undefined;
};

/**
 * Define a query in this Convex app's public API.
 *
 * This function will be allowed to read your Convex database and will be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 */
export declare const query: QueryBuilder<DataModel, "public">;

/**
 * Define a query that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to read from your Convex database. It will not be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 */
export declare const internalQuery: QueryBuilder<DataModel, "internal">;

/**
 * Define a mutation in this Convex app's public API.
 *
 * This function will be allowed to modify your Convex database and will be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 */
export declare const mutation: MutationBuilder<DataModel, "public">;

/**
 * Define a mutation that is only accessible from other Convex functions (but not from the client).
 *
 * This function will be allowed to modify your Convex database. It will not be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 */
export declare const internalMutation: MutationBuilder<DataModel, "internal">;

/**
 * Define an action in this Convex app's public API.
 *
 * An action is a function which can execute any JavaScript code, including non-deterministic
 * code and code with side-effects, like calling third-party services.
 * They can be run in Convex's JavaScript environment or in Node.js using the "use node" directive.
 * They can interact with the database indirectly by calling queries and mutations using the {@link ActionCtx}.
 *
 * @param func - The action. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped action. Include this as an `export` to name it and make it accessible.
 */
export declare const action: ActionBuilder<DataModel, "public">;

/**
 * Define an action that is only accessible from other Convex functions (but not from the client).
 *
 * @param func - The function. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped function. Include this as an `export` to name it and make it accessible.
 */
export declare const internalAction: ActionBuilder<DataModel, "internal">;

/**
 * Define an HTTP action.
 *
 * The wrapped function will be used to respond to HTTP requests received
 * by a Convex deployment if the requests matches the path and method where
 * this action is routed. Be sure to route your httpAction in `convex/http.js`.
 *
 * @param func - The function. It receives an {@link ActionCtx} as its first argument
 * and a Fetch API `Request` object as its second.
 * @returns The wrapped function. Import this function from `convex/http.js` and route it to hook it up.
 */
export declare const httpAction: HttpActionBuilder;

/**
 * Typesafe environment variables.
 *
 * This includes platform-provided env vars and any variables declared in
 * `convex.config.ts`.
 */
export declare const env: Env;

/**
 * A set of services for use within Convex query functions.
 *
 * The query context is passed as the first argument to any Convex query
 * function run on the server.
 *
 * This differs from the {@link MutationCtx} because all of the services are
 * read-only.
 */
export type QueryCtx = GenericQueryCtx<DataModel>;

/**
 * A set of services for use within Convex mutation functions.
 *
 * The mutation context is passed as the first argument to any Convex mutation
 * function run on the server.
 */
export type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * A set of services for use within Convex action functions.
 *
 * The action context is passed as the first argument to any Convex action
 * function run on the server.
 */
export type ActionCtx = GenericActionCtx<DataModel>;

/**
 * An interface to read from the database within Convex query functions.
 *
 * The two entry points are {@link DatabaseReader.get}, which fetches a single
 * document by its {@link Id}, or {@link DatabaseReader.query}, which starts
 * building a query.
 */
export type DatabaseReader = GenericDatabaseReader<DataModel>;

/**
 * An interface to read from and write to the database within Convex mutation
 * functions.
 *
 * Convex guarantees that all writes within a single mutation are
 * executed atomically, so you never have to worry about partial writes leaving
 * your data in an inconsistent state. See [the Convex Guide](https://docs.convex.dev/understanding/convex-fundamentals/functions#atomicity-and-optimistic-concurrency-control)
 * for the guarantees Convex provides your functions.
 */
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;
