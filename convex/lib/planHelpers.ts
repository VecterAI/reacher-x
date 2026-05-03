// convex/lib/planHelpers.ts
// Plan tier definitions and pure query helpers
// Per AGENT_CONTEXT.txt: *Helpers.ts = config, constants, utilities only

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Import from planCore using static import (not dynamic)
import { getOrCreateUserPlan } from "./planCore";
import {
  getReservedEntitlementSlots,
  getWorkspaceSlotLimitForTier,
} from "./workspaceEntitlements";
import { readStoredQualifiedProspectUsageSnapshot } from "./planUsageState";

// Re-export constants and types from planConstants for backward compatibility
export { PLAN_LIMITS, type PlanTier, type UserPlan } from "./planConstants";

// Re-export getOrCreateUserPlan for backward compatibility
export { getOrCreateUserPlan };

type PlanCtx = QueryCtx | MutationCtx;
type WorkspaceCreationEligibilityOptions = {
  consumeEntitlementSlot?: number;
  excludeSetupSessionId?: Id<"workspaceSetupSessions">;
};

export type WorkspaceCreationEligibility = {
  allowed: boolean;
  tier: "free" | "base" | "pro";
  used: number;
  limit: number;
  remaining: number;
  reason?: string;
};

export async function getWorkspaceCount(
  ctx: PlanCtx,
  userId: Id<"users">
): Promise<number> {
  const workspaces = await ctx.db
    .query("workspaces")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  return workspaces.length;
}

export async function getCurrentQualifiedProspectUsage(
  ctx: PlanCtx,
  userId: Id<"users">
) {
  const { plan, used, window } = await readStoredQualifiedProspectUsageSnapshot(
    ctx,
    userId
  );

  return {
    tier: plan.tier,
    limit: plan.prospectsLimit,
    used,
    window,
  };
}

/**
 * Check if user can add more prospects (pure query helper)
 */
export async function canAddProspects(
  ctx: QueryCtx,
  userId: Id<"users">,
  count: number = 1
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const usage = await getCurrentQualifiedProspectUsage(ctx, userId);

  // Unlimited
  if (usage.limit === -1) {
    return { allowed: true };
  }

  const remaining = Math.max(0, usage.limit - usage.used);

  if (remaining < count) {
    return {
      allowed: false,
      reason: `Qualified prospect limit reached for this cycle. You have ${remaining} spots remaining on your ${usage.tier} plan.`,
      remaining,
    };
  }

  return { allowed: true, remaining };
}

/**
 * Check if user can create more workspaces (pure query helper)
 */
export async function canCreateWorkspace(
  ctx: PlanCtx,
  userId: Id<"users">,
  options?: WorkspaceCreationEligibilityOptions
): Promise<WorkspaceCreationEligibility> {
  const plan = await getOrCreateUserPlan(ctx, userId);
  const limit = getWorkspaceSlotLimitForTier(plan.tier);
  const reservedSlots = await getReservedEntitlementSlots(ctx, userId, {
    consumeEntitlementSlot: options?.consumeEntitlementSlot,
    excludeSetupSessionId: options?.excludeSetupSessionId,
  });
  const used = [...reservedSlots].filter((slot) => slot <= limit).length;
  const remaining = Math.max(0, limit - used);

  if (remaining <= 0) {
    return {
      allowed: false,
      tier: plan.tier,
      used,
      limit,
      remaining: 0,
      reason: `Workspace limit reached. Your ${plan.tier} plan allows ${limit} workspace(s).`,
    };
  }

  return {
    allowed: true,
    tier: plan.tier,
    used,
    limit,
    remaining,
  };
}

/**
 * Get plan usage summary for display (pure query helper)
 */
export async function getPlanUsageSummary(ctx: QueryCtx, userId: Id<"users">) {
  const plan = await getOrCreateUserPlan(ctx, userId);
  const qualifiedUsage = await getCurrentQualifiedProspectUsage(ctx, userId);
  const reservedSlots = await getReservedEntitlementSlots(ctx, userId);
  const usedWorkspaces = [...reservedSlots].filter(
    (slot) => slot <= plan.workspacesLimit
  ).length;

  return {
    tier: plan.tier,
    prospects: {
      used: qualifiedUsage.used,
      limit: qualifiedUsage.limit,
      unlimited: qualifiedUsage.limit === -1,
      percentUsed:
        qualifiedUsage.limit === -1
          ? 0
          : Math.round((qualifiedUsage.used / qualifiedUsage.limit) * 100),
    },
    workspaces: {
      used: usedWorkspaces,
      limit: plan.workspacesLimit,
      percentUsed: Math.round((usedWorkspaces / plan.workspacesLimit) * 100),
    },
    expiresAt: plan.expiresAt,
    polarCustomerId: plan.polarCustomerId,
  };
}
