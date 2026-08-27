import type { Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type {
  tenantJobClassValidator,
  tenantJobKindValidator,
  tenantJobPayloadValidator,
} from "../validators";
import { stringifyUnknownError } from "./errorHelpers";
import {
  TENANT_ENQUEUE_RECOVERY_MAX_ATTEMPTS,
  getTenantEnqueueRetryDelayMs,
} from "./tenantSchedulerCore";

export type TenantJobEnqueueArgs = {
  workspaceId?: Id<"workspaces">;
  userId: Id<"users">;
  class: Infer<typeof tenantJobClassValidator>;
  priority: number;
  idempotencyKey: string;
  payload: Infer<typeof tenantJobPayloadValidator>;
};

export type TenantJobEnqueueRoute =
  | { route: "legacy"; jobId: null }
  | { route: "shadow"; jobId: Id<"tenantJobs"> }
  | { route: "enforced"; jobId: Id<"tenantJobs"> };

type TenantJobEnqueueFailureArgs = {
  workspaceId?: Id<"workspaces">;
  userId: Id<"users">;
  class: Infer<typeof tenantJobClassValidator>;
  kind: Infer<typeof tenantJobKindValidator>;
  priority: number;
  idempotencyKey: string;
};

export async function recordTenantJobEnqueueFailure(
  ctx: Pick<ActionCtx, "runMutation">,
  args: TenantJobEnqueueFailureArgs,
  error: unknown,
  attempt: number
) {
  const errorMessage = stringifyUnknownError(error);
  console.warn("[TenantScheduler] Enqueue attempt failed", {
    idempotencyKey: args.idempotencyKey,
    kind: args.kind,
    attempt,
    maxAttempts: TENANT_ENQUEUE_RECOVERY_MAX_ATTEMPTS,
    errorMessage,
  });
  try {
    await ctx.runMutation(
      internal.tenantScheduler.recordEnqueueFailureInternal,
      {
        ...args,
        errorMessage,
      }
    );
  } catch (recordError) {
    // The canonical action event still exposes the enqueue failure if the
    // independent diagnostic write is temporarily unavailable.
    console.error("[TenantScheduler] Failed to record enqueue failure", {
      idempotencyKey: args.idempotencyKey,
      attempt,
      errorMessage: stringifyUnknownError(recordError),
    });
  }
}

/**
 * Recover a mutation after Convex has exhausted its built-in OCC retries.
 * Every caller must provide a stable idempotency key so an uncertain response
 * and a committed response converge on the same tenantJobs document.
 */
export async function enqueueTenantJobWithRetry(
  ctx: Pick<ActionCtx, "runMutation">,
  args: TenantJobEnqueueArgs
): Promise<TenantJobEnqueueRoute> {
  let lastError: unknown;
  for (
    let attempt = 1;
    attempt <= TENANT_ENQUEUE_RECOVERY_MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      const route: TenantJobEnqueueRoute = await ctx.runMutation(
        internal.tenantScheduler.enqueueTenantJobInternal,
        args
      );
      return route;
    } catch (error) {
      lastError = error;
      await recordTenantJobEnqueueFailure(
        ctx,
        {
          workspaceId: args.workspaceId,
          userId: args.userId,
          class: args.class,
          kind: args.payload.kind,
          priority: args.priority,
          idempotencyKey: args.idempotencyKey,
        },
        error,
        attempt
      );
      if (attempt < TENANT_ENQUEUE_RECOVERY_MAX_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, getTenantEnqueueRetryDelayMs(attempt))
        );
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(stringifyUnknownError(lastError));
}
