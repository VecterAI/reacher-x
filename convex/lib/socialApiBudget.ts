import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

export const SOCIAL_API_PROVIDER = "socialapi";
export const SOCIAL_API_REQUESTS_PER_MINUTE = 500;
// We intentionally keep a meaningful buffer below the upstream ceiling so
// retries, pagination bursts, and cross-endpoint traffic don't run the shared
// provider budget right at its edge.
export const SOCIAL_API_TARGET_REQUESTS_PER_MINUTE = 300;
export const SOCIAL_API_REQUEST_SPACING_MS = Math.ceil(
  60_000 / SOCIAL_API_TARGET_REQUESTS_PER_MINUTE
);
export const SOCIAL_API_OCC_RETRY_BASE_MS = 25;
export const SOCIAL_API_OCC_RETRY_JITTER_MS = 40;

export async function acquireSocialApiBudget(ctx: ActionCtx, consumer: string) {
  return await ctx.runAction(
    internal.socialApiBudget.acquireSocialApiBudgetInternal,
    {
      consumer,
    }
  );
}
