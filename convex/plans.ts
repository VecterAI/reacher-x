// convex/plans.ts
// v4: Plan management queries and mutations

import {
  query,
  mutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { getUserFromIdentity } from "./lib/userUtils";
import {
  getOrCreateUserPlan,
  canAddProspects,
  canCreateWorkspace,
  getPlanUsageSummary,
  PLAN_LIMITS,
  type PlanTier,
} from "./lib/planHelpers";
import { upgradePlan } from "./lib/planCore";
import { upgradePlanArgsValidator } from "./validators";

async function getWorkspaceCreationEligibilityForCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return {
      allowed: false,
      tier: "free" as const,
      used: 0,
      limit: PLAN_LIMITS.free.workspacesLimit,
      remaining: 0,
      reason: "Not authenticated",
    };
  }

  const user = await getUserFromIdentity(ctx, identity, false);
  if (!user) {
    return {
      allowed: false,
      tier: "free" as const,
      used: 0,
      limit: PLAN_LIMITS.free.workspacesLimit,
      remaining: 0,
      reason: "User not found",
    };
  }

  return canCreateWorkspace(ctx, user._id);
}

/**
 * Get the current user's plan and usage
 */
export const getCurrentPlan = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    return getPlanUsageSummary(ctx, user._id);
  },
});

/**
 * Get plan limits configuration (public info)
 */
export const getPlanLimits = query({
  args: {},
  handler: async () => {
    return PLAN_LIMITS;
  },
});

/**
 * Check if user can add prospects
 */
export const checkCanAddProspects = query({
  args: { count: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { allowed: false, reason: "Not authenticated" };
    }

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) {
      return { allowed: false, reason: "User not found" };
    }

    return canAddProspects(ctx, user._id, args.count ?? 1);
  },
});

/**
 * Check if user can create a workspace
 */
export const checkCanCreateWorkspace = query({
  args: {},
  handler: async (ctx) => {
    return getWorkspaceCreationEligibilityForCurrentUser(ctx);
  },
});

/**
 * Canonical workspace creation eligibility for UI consumers.
 */
export const getWorkspaceCreationEligibility = query({
  args: {},
  handler: async (ctx) => {
    return getWorkspaceCreationEligibilityForCurrentUser(ctx);
  },
});

/**
 * Canonical workspace creation eligibility for internal/backend consumers.
 */
export const getWorkspaceCreationEligibilityByUserId = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return canCreateWorkspace(ctx, args.userId);
  },
});

/**
 * Initialize user plan (called during onboarding or first login)
 */
export const initializeUserPlan = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);
    const plan = await getOrCreateUserPlan(ctx, user._id);

    if (!plan) {
      throw new Error("Failed to create user plan");
    }

    return {
      tier: plan.tier,
      prospectsLimit: plan.prospectsLimit,
      workspacesLimit: plan.workspacesLimit,
    };
  },
});

/**
 * Upgrade user's plan (for future billing integration)
 */
export const upgradeUserPlan = mutation({
  args: upgradePlanArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await getUserFromIdentity(ctx, identity);

    await upgradePlan(
      ctx,
      user._id,
      args.tier as PlanTier,
      args.externalSubscriptionId,
      args.expiresAt
    );

    return { success: true, tier: args.tier };
  },
});
