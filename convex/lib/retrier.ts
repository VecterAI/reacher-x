// convex/lib/retrier.ts
// ActionRetrier instance for reliable external API calls with automatic retry

import {
  ActionRetrier,
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
import { internalMutation } from "./functionBuilders";

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
