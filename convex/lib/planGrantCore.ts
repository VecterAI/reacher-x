import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import {
  isPaidPlanTier,
  PAID_PLAN_TIERS,
  type PlanTier,
  type PaidPlanTier,
} from "./planConstants";

export const LEGACY_TESTER_SUBSCRIPTION_ID = "tester_free_access";

export function resolveGrantExpiry(
  now: number,
  args: { durationDays?: number; expiresAt?: number }
): number {
  if ((args.durationDays === undefined) === (args.expiresAt === undefined)) {
    throw new Error("Provide exactly one of durationDays or expiresAt.");
  }
  if (
    args.durationDays !== undefined &&
    (!Number.isFinite(args.durationDays) || args.durationDays <= 0)
  ) {
    throw new Error("durationDays must be a finite number greater than 0.");
  }
  const expiresAt =
    args.expiresAt ?? now + args.durationDays! * 24 * 60 * 60 * 1000;
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > 8.64e15
  ) {
    throw new Error("Expiry must be a valid future timestamp in milliseconds.");
  }
  return expiresAt;
}

export function getHigherPlanTier(
  paidTier: PlanTier,
  grantTier: PlanTier
): PlanTier {
  const tiers: readonly PlanTier[] = ["free", ...PAID_PLAN_TIERS];
  return tiers.indexOf(grantTier) > tiers.indexOf(paidTier)
    ? grantTier
    : paidTier;
}

export async function getComplimentaryGrant(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) {
  return ctx.db
    .query("complimentaryPlanGrants")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/** Replacing the document gives every grant a distinct expiration-job identity. */
export async function replaceComplimentaryGrant(
  ctx: MutationCtx,
  grant: {
    userId: Id<"users">;
    tier: PaidPlanTier;
    expiresAt?: number;
    label?: string;
  }
) {
  const existing = await getComplimentaryGrant(ctx, grant.userId);
  if (existing) await ctx.db.delete(existing._id);
  const grantId = await ctx.db.insert("complimentaryPlanGrants", {
    ...grant,
    createdAt: getCurrentUTCTimestamp(),
  });
  if (grant.expiresAt !== undefined) {
    await ctx.scheduler.runAt(
      grant.expiresAt,
      internal.testerPlans.expireGrantInternal,
      { grantId }
    );
  }
  return grantId;
}

/** Preserve known legacy gifts before a webhook replaces their old plan row. */
export async function migrateLegacyTesterGrant(
  ctx: MutationCtx,
  plan: Doc<"userPlans">
) {
  if (
    plan.externalSubscriptionId !== LEGACY_TESTER_SUBSCRIPTION_ID ||
    !isPaidPlanTier(plan.tier) ||
    (await getComplimentaryGrant(ctx, plan.userId))
  )
    return;
  if (
    plan.expiresAt !== undefined &&
    plan.expiresAt <= getCurrentUTCTimestamp()
  )
    return;
  await replaceComplimentaryGrant(ctx, {
    userId: plan.userId,
    tier: plan.tier,
    expiresAt: plan.expiresAt,
    label: LEGACY_TESTER_SUBSCRIPTION_ID,
  });
}
