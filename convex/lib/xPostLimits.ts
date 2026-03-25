import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  inferPostLimitFromSubscriptionType,
  type EffectivePostTextLimit,
} from "../../shared/lib/twitter/xPostTextLimit";

/**
 * Resolve X post/reply validation limits from the user's stored `xAccounts` row.
 * Missing or unknown subscription defaults to short (280 weighted) — safe until getMe refreshes.
 */
export async function getEffectivePostTextLimitForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<EffectivePostTextLimit> {
  const account = await ctx.db
    .query("xAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return inferPostLimitFromSubscriptionType(account?.xSubscriptionType);
}
