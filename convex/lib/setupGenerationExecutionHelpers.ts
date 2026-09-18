import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

export const SETUP_GENERATION_MAX_ATTEMPTS = 3;

// Account-scoped protection does not make new users share a start budget.
const setupGenerationRateLimiter = new RateLimiter(components.rateLimiter, {
  setupGenerationAttempts: {
    kind: "token bucket",
    rate: 20,
    period: HOUR,
    capacity: 20,
  },
});

/**
 * Schedule and record ownership in the same transaction. Replays and concurrent
 * resume requests reuse pending/running work instead of buying another AI call.
 */
export async function scheduleSetupGeneration(
  ctx: MutationCtx,
  session: Doc<"workspaceSetupSessions">,
  options?: { retryAfterFailure?: boolean; errorMessage?: string }
): Promise<boolean> {
  if (session.status !== "generating_profiles") return false;
  const revision = session.generationRevision ?? 0;
  const execution =
    session.generationExecution?.revision === revision
      ? session.generationExecution
      : undefined;
  if (execution && !options?.retryAfterFailure) {
    const scheduled = await ctx.db.system.get(execution.scheduledFunctionId);
    if (
      scheduled?.state.kind === "pending" ||
      scheduled?.state.kind === "inProgress"
    ) {
      return false;
    }
  }
  const attempt = (execution?.attempt ?? 0) + 1;
  const now = getCurrentUTCTimestamp();
  if (attempt > SETUP_GENERATION_MAX_ATTEMPTS) {
    await ctx.runMutation(internal.setupSessions.markGenerationFailedInternal, {
      sessionId: session._id,
      generationRevision: revision,
      errorMessage:
        options?.errorMessage ??
        "We couldn't finish generating your examples. Please try again.",
    });
    return false;
  }
  const allowance = await setupGenerationRateLimiter.limit(
    ctx,
    "setupGenerationAttempts",
    {
      key: String(session.userId),
    }
  );
  if (!allowance.ok) {
    await ctx.runMutation(internal.setupSessions.markGenerationFailedInternal, {
      sessionId: session._id,
      generationRevision: revision,
      errorMessage:
        "You've generated a lot of examples recently. Please try again in a few minutes.",
    });
    return false;
  }
  const scheduledFunctionId = await ctx.scheduler.runAfter(
    execution ? 1000 * 2 ** (attempt - 2) : 0,
    internal.setupSessions.runSetupGenerationInternal,
    { sessionId: session._id, generationRevision: revision, attempt }
  );
  await ctx.db.patch(session._id, {
    generationExecution: {
      revision,
      attempt,
      claimed: false,
      scheduledFunctionId,
    },
    lastAgentActionAt: now,
    statusUpdatedAt: now,
  });
  return true;
}

export function ownsSetupGenerationAttempt(
  session: Doc<"workspaceSetupSessions"> | null,
  revision: number,
  attempt: number
): session is Doc<"workspaceSetupSessions"> {
  return Boolean(
    session?.status === "generating_profiles" &&
    (session.generationRevision ?? 0) === revision &&
    session.generationExecution?.revision === revision &&
    session.generationExecution.attempt === attempt
  );
}
