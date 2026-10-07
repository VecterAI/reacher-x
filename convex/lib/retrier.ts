// convex/lib/retrier.ts
// ActionRetrier instance for reliable external API calls with automatic retry

import {
  ActionRetrier,
  onCompleteValidator,
  runIdValidator,
  type RunId,
  type RunOptions,
} from "@convex-dev/action-retrier";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionVisibility,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { env } from "../_generated/server";
import { internalMutation, internalQuery } from "./functionBuilders";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

/**
 * Shared ActionRetrier instance for all external API calls.
 *
 * Configuration:
 * - initialBackoffMs: 1000ms (1 second initial delay after failure)
 * - base: 2 (exponential backoff: 1s → 2s → 4s)
 * - maxFailures: 3 (maximum retry attempts before giving up)
 *
 * Usage:
 * ```typescript
 * import { retrier } from "./lib/retrier";
 *
 * // In an action or mutation:
 * const runId = await retrier.run(ctx, internal.myModule.myInternalAction, { arg: "value" });
 * ```
 */
export const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1000,
  base: 2,
  maxFailures: 3,
});

/**
 * Retry budget for provider-backed actions (LinkedIn/Twitter searches,
 * enrichment, monitors), resolved from the deployment environment at call
 * time so operators can tighten it without a redeploy.
 *
 * Defaults match the retrier's own budget (1s backoff, base 2, 3 retries) —
 * this only adds a bound that can be lowered (or raised) via:
 *
 *   npx convex env set PROVIDER_ACTION_RETRY_MAX_FAILURES 1 --prod
 */
function getProviderActionRetryBudget(): {
  initialBackoffMs: number;
  base: number;
  maxFailures: number;
} {
  const parseNumber = (value: string | undefined, fallback: number) => {
    if (value === undefined) {
      return fallback;
    }
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    initialBackoffMs: parseNumber(
      env.PROVIDER_ACTION_RETRY_INITIAL_BACKOFF_MS,
      1000
    ),
    base: Math.max(1, parseNumber(env.PROVIDER_ACTION_RETRY_BASE, 2)),
    maxFailures: Math.max(
      0,
      Math.floor(parseNumber(env.PROVIDER_ACTION_RETRY_MAX_FAILURES, 3))
    ),
  };
}

/**
 * Upper bound on how long a single provider search action may paginate
 * before returning what it has. Slow providers previously let one action
 * run for minutes while the caller that started it had already given up
 * polling — spending GB-hours nobody consumed.
 */
export function getProviderSearchMaxRuntimeMs(): number {
  const value = env.PROVIDER_SEARCH_MAX_RUNTIME_MS;
  if (value === undefined) {
    return 75_000;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 75_000;
}

type CompatibleRetrierMutationCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runMutation" | "runQuery"
>;
type CompatibleRetrierQueryCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery"
>;
type CompatibleRetrierStatusCtx = CompatibleRetrierMutationCtx &
  CompatibleRetrierQueryCtx &
  Pick<GenericActionCtx<GenericDataModel>, "scheduler">;
type RetrierMutationRunner =
  GenericMutationCtx<GenericDataModel>["runMutation"];
type RetrierQueryRunner = GenericQueryCtx<GenericDataModel>["runQuery"];

function createRetrierMutationCtx(ctx: CompatibleRetrierMutationCtx): {
  runMutation: RetrierMutationRunner;
  runQuery: RetrierQueryRunner;
} {
  const runMutation: RetrierMutationRunner = ((mutation, ...argsAndOptions) => {
    const [args] = argsAndOptions;
    return args === undefined
      ? ctx.runMutation(mutation as never)
      : ctx.runMutation(mutation as never, args as never);
  }) as RetrierMutationRunner;

  return {
    runMutation,
    ...createRetrierQueryCtx(ctx),
  };
}

function createRetrierQueryCtx(ctx: CompatibleRetrierQueryCtx): {
  runQuery: RetrierQueryRunner;
} {
  const runQuery: RetrierQueryRunner = ((query, ...argsAndOptions) => {
    const [args] = argsAndOptions;
    return args === undefined
      ? ctx.runQuery(query as never)
      : ctx.runQuery(query as never, args as never);
  }) as RetrierQueryRunner;

  return { runQuery };
}

export async function runRetriedAction<
  F extends FunctionReference<"action", FunctionVisibility>,
>(
  ctx: CompatibleRetrierMutationCtx,
  reference: F,
  args?: FunctionArgs<F>,
  options?: RunOptions
): Promise<RunId> {
  return retrier.run(createRetrierMutationCtx(ctx), reference, args, options);
}

/**
 * Same as `runRetriedAction`, but applies the operator-configured provider
 * retry budget (`PROVIDER_ACTION_RETRY_*` env vars) on top of any explicit
 * options. Intended for provider-backed actions — external API calls whose
 * retries cost real money — so an operator can bound provider spend without
 * affecting unrelated retried actions. Explicit options always win.
 */
export async function runProviderActionRetried<
  F extends FunctionReference<"action", FunctionVisibility>,
>(
  ctx: CompatibleRetrierMutationCtx,
  reference: F,
  args?: FunctionArgs<F>,
  options?: RunOptions
): Promise<RunId> {
  const resolvedOptions: RunOptions = {
    ...getProviderActionRetryBudget(),
    ...options,
  };
  return retrier.run(
    createRetrierMutationCtx(ctx),
    reference,
    args,
    resolvedOptions
  );
}

export async function getRetriedActionStatus(
  ctx: CompatibleRetrierStatusCtx,
  runId: RunId
) {
  const status = await retrier.status(createRetrierQueryCtx(ctx), runId);
  if (status.type === "completed") {
    await ctx.scheduler.runAfter(
      60 * 60 * 1000,
      internal.lib.retrier.cleanupTerminalRetriedActionInternal,
      { runId }
    );
  }
  return status;
}

export const cleanupTerminalRetriedActionInternal = internalMutation({
  args: { runId: runIdValidator },
  returns: v.object({ cleaned: v.boolean() }),
  handler: async (ctx, { runId }) => {
    try {
      await retrier.cleanup(createRetrierMutationCtx(ctx), runId);
      return { cleaned: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("hasn't completed")) {
        // The retrier's onComplete hook runs before it persists the terminal
        // state; retry shortly so the component row is not held for its full
        // seven-day retention.
        await ctx.scheduler.runAfter(
          1000,
          internal.lib.retrier.cleanupTerminalRetriedActionInternal,
          { runId }
        );
        return { cleaned: false };
      }
      if (message.includes("not found")) {
        return { cleaned: false };
      }
      console.warn("[ActionRetrier] Failed to clean up terminal run", {
        runId,
        error: message,
      });
      return { cleaned: false };
    }
  },
});

// ============================================================================
// Result store for callers that must not stay alive polling
// ============================================================================

/**
 * Terminal result of a retried action, persisted by the retrier's
 * `onComplete` hook so durable workflows can pick it up with free sleep
 * steps instead of billing a live action while the underlying action runs.
 */
export type RetriedActionResult = {
  outcome: "success" | "failed" | "canceled";
  returnValue?: unknown;
  error?: string;
};

/**
 * `onComplete` target for retried actions whose result is consumed later.
 * The action-retrier invokes this mutation with `{ runId, result }` when the
 * run reaches a terminal state (success, exhausted retries, or canceled).
 */
export const recordRetriedActionCompletion = internalMutation({
  args: onCompleteValidator,
  returns: v.null(),
  handler: async (ctx, { runId, result }) => {
    const existing = await ctx.db
      .query("retriedActionResults")
      .withIndex("by_run_id", (q) => q.eq("runId", runId))
      .unique();
    const row = {
      runId,
      outcome: result.type,
      returnValue: result.type === "success" ? result.returnValue : undefined,
      error: result.type === "failed" ? result.error : undefined,
      completedAt: getCurrentUTCTimestamp(),
    };
    if (existing) {
      await ctx.db.replace(existing._id, row);
    } else {
      await ctx.db.insert("retriedActionResults", row);
    }
    // Callers that poll `getRetriedActionStatus` schedule the component run's
    // cleanup themselves; this hook serves callers that never do, so schedule
    // it here. The retrier invokes onComplete before persisting the terminal
    // state, so cleanup retries briefly when it arrives too early.
    await ctx.scheduler.runAfter(
      0,
      internal.lib.retrier.cleanupTerminalRetriedActionInternal,
      { runId }
    );
    return null;
  },
});

/** Read a terminal result recorded by `recordRetriedActionCompletion`. */
export const getRetriedActionResult = internalQuery({
  args: { runId: runIdValidator },
  returns: v.union(
    v.object({
      outcome: v.union(
        v.literal("success"),
        v.literal("failed"),
        v.literal("canceled")
      ),
      returnValue: v.optional(v.any()),
      error: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, { runId }) => {
    const row = await ctx.db
      .query("retriedActionResults")
      .withIndex("by_run_id", (q) => q.eq("runId", runId))
      .unique();
    if (!row) {
      return null;
    }
    return {
      outcome: row.outcome,
      returnValue: row.returnValue,
      error: row.error,
    };
  },
});

/** Delete one stored result (used by tests and the cleanup cron). */
export const deleteRetriedActionResult = internalMutation({
  args: { runId: runIdValidator },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, { runId }) => {
    const row = await ctx.db
      .query("retriedActionResults")
      .withIndex("by_run_id", (q) => q.eq("runId", runId))
      .unique();
    if (!row) {
      return { deleted: false };
    }
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

const RESULT_RETENTION_MS = 24 * 60 * 60 * 1000;
// Large return values are common here (search results); keep the batch well
// below the bytes-read transaction limit, mirroring the patched retrier
// cleanup (batch of 4).
const RESULT_CLEANUP_BATCH = 8;

/**
 * Bounded cleanup of stored results older than a day. Reschedules itself
 * when it hits the batch limit so backlog drains without breaching
 * transaction limits.
 */
export const cleanupExpiredRetriedActionResults = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const cutoff = getCurrentUTCTimestamp() - RESULT_RETENTION_MS;
    const expired = await ctx.db
      .query("retriedActionResults")
      .withIndex("by_completed_at", (q) => q.lt("completedAt", cutoff))
      .take(RESULT_CLEANUP_BATCH);
    for (const row of expired) {
      await ctx.db.delete(row._id);
    }
    if (expired.length === RESULT_CLEANUP_BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.lib.retrier.cleanupExpiredRetriedActionResults,
        {}
      );
    }
    return { deleted: expired.length };
  },
});
