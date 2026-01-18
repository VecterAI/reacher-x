// convex/lib/planHelpers.ts
// Plan tier definitions and pure query helpers
// Per AGENT_CONTEXT.txt: *Helpers.ts = config, constants, utilities only

import { QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Import from planCore using static import (not dynamic)
import { getOrCreateUserPlan } from "./planCore";

// Re-export constants and types from planConstants for backward compatibility
export { PLAN_LIMITS, type PlanTier, type UserPlan } from "./planConstants";

// Re-export getOrCreateUserPlan for backward compatibility
export { getOrCreateUserPlan };

/**
 * Check if user can add more prospects (pure query helper)
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
 * Check if user can create more workspaces (pure query helper)
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
 * Get plan usage summary for display (pure query helper)
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
