// convex/lib/planHelpers.ts
// Plan tier definitions and enforcement helpers

import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Plan tier configuration
 * Free: 100 prospects, 1 workspace
 * Base: 1000 prospects, 2 workspaces
 * Pro: unlimited prospects (-1), 5 workspaces
 */
export const PLAN_LIMITS = {
  free: {
    prospectsLimit: 100,
    workspacesLimit: 1,
  },
  base: {
    prospectsLimit: 1000,
    workspacesLimit: 2,
  },
  pro: {
    prospectsLimit: -1, // unlimited
    workspacesLimit: 5,
  },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;

// Type for the plan object returned by helper functions
export type UserPlan = {
  _id: Id<"userPlans"> | null;
  _creationTime: number;
  userId: Id<"users">;
  tier: "free" | "base" | "pro";
  prospectsLimit: number;
  workspacesLimit: number;
  currentProspectsCount: number;
  currentWorkspacesCount: number;
  updatedAt: number;
  externalSubscriptionId?: string;
  expiresAt?: number;
};

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
    return existingPlan as UserPlan;
  }

  // Only create if we have mutation context
  if ("insert" in ctx.db) {
    const mutationCtx = ctx as MutationCtx;
    const now = Date.now();
    const planId = await mutationCtx.db.insert("userPlans", {
      userId,
      tier: "free",
      prospectsLimit: PLAN_LIMITS.free.prospectsLimit,
      workspacesLimit: PLAN_LIMITS.free.workspacesLimit,
      currentProspectsCount: 0,
      currentWorkspacesCount: 0,
      updatedAt: now,
    });
    const createdPlan = await mutationCtx.db.get(planId);
    // Plan was just created, so it must exist
    return createdPlan as UserPlan;
  }

  // Return a virtual free plan for query context
  return {
    _id: null,
    _creationTime: Date.now(),
    userId,
    tier: "free" as const,
    prospectsLimit: PLAN_LIMITS.free.prospectsLimit,
    workspacesLimit: PLAN_LIMITS.free.workspacesLimit,
    currentProspectsCount: 0,
    currentWorkspacesCount: 0,
    updatedAt: Date.now(),
  };
}

/**
 * Check if user can add more prospects
 */
export async function canAddProspects(
  ctx: QueryCtx,
  userId: Id<"users">,
  count: number = 1
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const plan = await getOrCreateUserPlan(ctx, userId);

  // Unlimited
  if (plan.prospectsLimit === -1) {
    return { allowed: true };
  }

  const remaining = plan.prospectsLimit - plan.currentProspectsCount;

  if (remaining < count) {
    return {
      allowed: false,
      reason: `Prospect limit reached. You have ${remaining} spots remaining on your ${plan.tier} plan.`,
      remaining,
    };
  }

  return { allowed: true, remaining };
}

/**
 * Check if user can create more workspaces
 */
export async function canCreateWorkspace(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const plan = await getOrCreateUserPlan(ctx, userId);
  const remaining = plan.workspacesLimit - plan.currentWorkspacesCount;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Workspace limit reached. Your ${plan.tier} plan allows ${plan.workspacesLimit} workspace(s).`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining };
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
    updatedAt: Date.now(),
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
    updatedAt: Date.now(),
  });
}

/**
 * Increment workspace count for a user
 */
export async function incrementWorkspaceCount(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const plan = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!plan) {
    await getOrCreateUserPlan(ctx, userId);
    return incrementWorkspaceCount(ctx, userId);
  }

  await ctx.db.patch(plan._id, {
    currentWorkspacesCount: plan.currentWorkspacesCount + 1,
    updatedAt: Date.now(),
  });
}

/**
 * Decrement workspace count for a user
 */
export async function decrementWorkspaceCount(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const plan = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!plan) return;

  await ctx.db.patch(plan._id, {
    currentWorkspacesCount: Math.max(0, plan.currentWorkspacesCount - 1),
    updatedAt: Date.now(),
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
  expiresAt?: number
) {
  const plan = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const limits = PLAN_LIMITS[newTier];

  if (!plan) {
    await ctx.db.insert("userPlans", {
      userId,
      tier: newTier,
      prospectsLimit: limits.prospectsLimit,
      workspacesLimit: limits.workspacesLimit,
      currentProspectsCount: 0,
      currentWorkspacesCount: 0,
      externalSubscriptionId,
      expiresAt,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.patch(plan._id, {
      tier: newTier,
      prospectsLimit: limits.prospectsLimit,
      workspacesLimit: limits.workspacesLimit,
      externalSubscriptionId,
      expiresAt,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Get plan usage summary for display
 */
export async function getPlanUsageSummary(ctx: QueryCtx, userId: Id<"users">) {
  const plan = await getOrCreateUserPlan(ctx, userId);

  return {
    tier: plan.tier,
    prospects: {
      used: plan.currentProspectsCount,
      limit: plan.prospectsLimit,
      unlimited: plan.prospectsLimit === -1,
      percentUsed:
        plan.prospectsLimit === -1
          ? 0
          : Math.round(
              (plan.currentProspectsCount / plan.prospectsLimit) * 100
            ),
    },
    workspaces: {
      used: plan.currentWorkspacesCount,
      limit: plan.workspacesLimit,
      percentUsed: Math.round(
        (plan.currentWorkspacesCount / plan.workspacesLimit) * 100
      ),
    },
    expiresAt: plan.expiresAt,
  };
}
