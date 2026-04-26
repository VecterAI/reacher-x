import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

const internalLinkdApiBudget = (internal as any).linkdapiBudget;

export const LINKDAPI_PROVIDER = "linkdapi";
export const LINKDAPI_REQUESTS_PER_MINUTE = Math.max(
  1,
  Number(process.env.LINKDAPI_REQUESTS_PER_MINUTE ?? "30") || 30
);
export const LINKDAPI_TARGET_REQUESTS_PER_MINUTE = Math.max(
  1,
  Number(process.env.LINKDAPI_TARGET_REQUESTS_PER_MINUTE ?? "24") || 24
);
export const LINKDAPI_REQUEST_SPACING_MS = Math.ceil(
  60_000 / LINKDAPI_TARGET_REQUESTS_PER_MINUTE
);
export const LINKDAPI_OCC_RETRY_BASE_MS = 25;
export const LINKDAPI_OCC_RETRY_JITTER_MS = 40;

export async function acquireLinkdApiBudget(
  ctx: ActionCtx,
  consumer: string
) {
  return await ctx.runAction(
    internalLinkdApiBudget.acquireLinkdApiBudgetInternal,
    {
      consumer,
    }
  );
}
