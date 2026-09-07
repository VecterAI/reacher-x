import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { PlanTier } from "./planConstants";
import type { PolarSubscriptionLike } from "./planCycleUtils";
import { upgradePlan } from "./planCore";
import { reconcilePlanUsageForUser } from "./planUsageCore";
import { scheduleWorkspaceCapacityReconciliationForUser } from "./workspaceCapacityCore";
import { getComplimentaryGrant, getHigherPlanTier } from "./planGrantCore";
import {
  getCurrentUTCTimestamp,
  parseIsoToTimestamp,
} from "../../shared/lib/utils/time/timeUtils";
import { getPolarPlanTier, hasPolarPlanAccess } from "./polarPlanHelpers";

/** Resolve billing from Polar's persisted subscription, never a saved old tier. */
export async function refreshUserPlanFromBilling(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const subscription = await ctx.runQuery(
    components.polar.lib.getCurrentSubscription,
    { userId }
  );
  const hasAccess = hasPolarPlanAccess(subscription?.status);
  await applyPlanTransition(ctx, {
    userId,
    tier: hasAccess ? getPolarPlanTier(subscription?.productId) : "free",
    subscription: hasAccess ? subscription : null,
    externalSubscriptionId: hasAccess ? subscription?.id : undefined,
    expiresAt:
      hasAccess && subscription?.currentPeriodEnd
        ? parseIsoToTimestamp(subscription.currentPeriodEnd)
        : undefined,
    polarCustomerId: hasAccess ? subscription?.customerId : undefined,
  });
}

/**
 * Canonical trusted plan transition. Callers must establish billing or admin
 * authorization before invoking this helper.
 */
export async function applyPlanTransition(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    tier: PlanTier;
    subscription: PolarSubscriptionLike;
    externalSubscriptionId?: string;
    expiresAt?: number;
    polarCustomerId?: string;
  }
) {
  const grant = await getComplimentaryGrant(ctx, args.userId);
  const grantActive =
    grant &&
    (grant.expiresAt === undefined ||
      grant.expiresAt > getCurrentUTCTimestamp());
  // A billing callback can arrive before a delayed expiration job. Keep the
  // displayed grant and effective access consistent within this transaction.
  if (grant && !grantActive) await ctx.db.delete(grant._id);
  const tier = grantActive
    ? getHigherPlanTier(args.tier, grant.tier)
    : args.tier;
  await upgradePlan(
    ctx,
    args.userId,
    tier,
    args.externalSubscriptionId,
    args.expiresAt,
    args.polarCustomerId,
    args.tier
  );

  await reconcilePlanUsageForUser(ctx, {
    userId: args.userId,
    subscription: args.subscription,
  });

  await ctx.runMutation(
    internal.workspaces.reconcileWorkspaceEntitlementsForUserInternal,
    { userId: args.userId }
  );

  await scheduleWorkspaceCapacityReconciliationForUser(ctx, args.userId);
}
