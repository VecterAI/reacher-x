// convex/lib/planCore.ts
// Plan tier mutation functions (business logic layer)
// Per AGENT_CONTEXT.txt: *Core.ts = business logic (mutations)

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { PLAN_LIMITS, type PlanTier, type UserPlan } from "./planConstants";

function normalizePlanLimits<T extends UserPlan>(plan: T): T {
  const limits = PLAN_LIMITS[plan.tier];
  return {
    ...plan,
    prospectsLimit: limits.prospectsLimit,
    workspacesLimit: limits.workspacesLimit,
  };
}

/**
 * Get or create a user's plan (defaults to free tier)
 * Always returns a valid plan object (never null)
 */
export async function getOrCreateUserPlan(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<UserPlan> {
  const existingPlan = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (existingPlan) {
    const normalizedPlan = normalizePlanLimits(existingPlan as UserPlan);
    const limitsChanged =
      existingPlan.prospectsLimit !== normalizedPlan.prospectsLimit ||
      existingPlan.workspacesLimit !== normalizedPlan.workspacesLimit;

    if (limitsChanged && "patch" in ctx.db) {
      await (ctx as MutationCtx).db.patch(existingPlan._id, {
        prospectsLimit: normalizedPlan.prospectsLimit,
        workspacesLimit: normalizedPlan.workspacesLimit,
        updatedAt: getCurrentUTCTimestamp(),
      });
    }

    return normalizedPlan;
  }

  // Only create if we have mutation context
  if ("insert" in ctx.db) {
    const mutationCtx = ctx as MutationCtx;
    const now = getCurrentUTCTimestamp();
    const planId = await mutationCtx.db.insert("userPlans", {
      userId,
      tier: "free",
      prospectsLimit: PLAN_LIMITS.free.prospectsLimit,
      workspacesLimit: PLAN_LIMITS.free.workspacesLimit,
      currentProspectsCount: 0,
      currentProspectsCycleStart: undefined,
      currentProspectsCycleEnd: undefined,
      updatedAt: now,
    });
    const createdPlan = await mutationCtx.db.get(planId);
    // Plan was just created, so it must exist
    return createdPlan as UserPlan;
  }

  // Return a virtual free plan for query context
  const now = getCurrentUTCTimestamp();
  return {
    _id: null,
    _creationTime: now,
    userId,
    tier: "free" as const,
    prospectsLimit: PLAN_LIMITS.free.prospectsLimit,
    workspacesLimit: PLAN_LIMITS.free.workspacesLimit,
    currentProspectsCount: 0,
    currentProspectsCycleStart: undefined,
    currentProspectsCycleEnd: undefined,
    updatedAt: now,
    polarCustomerId: undefined,
  };
}

/**
 * Increment prospect count for a user
 */
export async function incrementProspectCount(
  ctx: MutationCtx,
  userId: Id<"users">,
  count: number = 1
) {
  const plan = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!plan) {
    // Create plan first
    await getOrCreateUserPlan(ctx, userId);
    return incrementProspectCount(ctx, userId, count);
  }

  await ctx.db.patch(plan._id, {
    currentProspectsCount: plan.currentProspectsCount + count,
    updatedAt: getCurrentUTCTimestamp(),
  });
}

/**
 * Decrement prospect count for a user
 */
export async function decrementProspectCount(
  ctx: MutationCtx,
  userId: Id<"users">,
  count: number = 1
) {
  const plan = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!plan) return;

  await ctx.db.patch(plan._id, {
    currentProspectsCount: Math.max(0, plan.currentProspectsCount - count),
    updatedAt: getCurrentUTCTimestamp(),
  });
}

/**
 * Upgrade a user's plan tier
 */
export async function upgradePlan(
  ctx: MutationCtx,
  userId: Id<"users">,
  newTier: PlanTier,
  externalSubscriptionId?: string,
  expiresAt?: number,
  polarCustomerId?: string
) {
  const plan = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const limits = PLAN_LIMITS[newTier];
  const now = getCurrentUTCTimestamp();

  const polarPatch = polarCustomerId !== undefined ? { polarCustomerId } : {};

  if (!plan) {
    await ctx.db.insert("userPlans", {
      userId,
      tier: newTier,
      prospectsLimit: limits.prospectsLimit,
      workspacesLimit: limits.workspacesLimit,
      currentProspectsCount: 0,
      currentProspectsCycleStart: undefined,
      currentProspectsCycleEnd: undefined,
      externalSubscriptionId,
      expiresAt,
      updatedAt: now,
      ...polarPatch,
    });
  } else {
    await ctx.db.patch(plan._id, {
      tier: newTier,
      prospectsLimit: limits.prospectsLimit,
      workspacesLimit: limits.workspacesLimit,
      externalSubscriptionId,
      expiresAt,
      updatedAt: now,
      ...polarPatch,
    });
  }
}
