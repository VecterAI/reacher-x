// convex/lib/planHelpers.ts
// Plan tier definitions and pure query helpers
// Per AGENT_CONTEXT.txt: *Helpers.ts = config, constants, utilities only

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Import from planCore using static import (not dynamic)
import { getOrCreateUserPlan } from "./planCore";
import {
  canProvisionUnpaidFirstWorkspacePreview,
  getReservedEntitlementSlots,
  getWorkspaceSlotLimitForTier,
} from "./workspaceEntitlements";
import {
  isPaidPlanTier,
  PLAN_TIER_LABELS,
  type PlanTier,
} from "./planConstants";
import { checkProspectLimit } from "./prospectingHelpers";
import { countCompletedWorkspaces } from "./workspaceSetup";

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
  tier: PlanTier;
  used: number;
  limit: number;
  remaining: number;
  reason?: string;
};

export type PaidFeatureEligibility = {
  allowed: boolean;
  tier: PlanTier;
  reason?: string;
};

export async function canUsePaidFeatures(
  ctx: PlanCtx,
  userId: Id<"users">
): Promise<PaidFeatureEligibility> {
  const plan = await getOrCreateUserPlan(ctx, userId);

  if (!isPaidPlanTier(plan.tier)) {
    return {
      allowed: false,
      tier: plan.tier,
      reason: "Upgrade plan to continue using Agent.",
    };
  }

  return { allowed: true, tier: plan.tier };
}

export async function getWorkspaceCount(
  ctx: PlanCtx,
  userId: Id<"users">
): Promise<number> {
  const workspaces = await ctx.db
    .query("workspaces")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  return countCompletedWorkspaces(workspaces);
}

export async function getCurrentQualifiedProspectUsageForWorkspace(
  ctx: PlanCtx,
  workspaceId: Id<"workspaces">
) {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    return {
      tier: "free" as const,
      limit: 0,
      used: 0,
      window: null,
    };
  }

  const usage = await checkProspectLimit(ctx, workspaceId, workspace.userId);

  return {
    tier: usage.tier,
    limit: usage.limit,
    used: usage.currentCount,
    window: {
      cycleStart: usage.cycleStart,
      cycleEnd: usage.cycleEnd,
    },
  };
}

/**
 * Check if user can add more prospects (pure query helper)
 */
export async function canAddProspects(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  count: number = 1
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const usage = await getCurrentQualifiedProspectUsageForWorkspace(
    ctx,
    workspaceId
  );

  if (!isPaidPlanTier(usage.tier)) {
    return {
      allowed: false,
      reason: "Upgrade plan to continue using Agent.",
      remaining: 0,
    };
  }

  // Unlimited
  if (usage.limit === -1) {
    return { allowed: true };
  }

  const remaining = Math.max(0, usage.limit - usage.used);

  if (remaining < count) {
    return {
      allowed: false,
      reason: `Qualified prospect limit reached for this workspace in the current cycle. You have ${remaining} spot${remaining === 1 ? "" : "s"} remaining on your ${usage.tier} plan.`,
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
  const unpaidPreviewSession =
    !isPaidPlanTier(plan.tier) && options?.excludeSetupSessionId
      ? await ctx.db.get(
          "workspaceSetupSessions",
          options.excludeSetupSessionId
        )
      : null;
  const canProvisionUnpaidPreview = canProvisionUnpaidFirstWorkspacePreview({
    session: unpaidPreviewSession,
    userId,
    setupSessionId: options?.excludeSetupSessionId,
    entitlementSlot: options?.consumeEntitlementSlot,
  });

  if (!isPaidPlanTier(plan.tier) && !canProvisionUnpaidPreview) {
    return {
      allowed: false,
      tier: plan.tier,
      used,
      limit,
      remaining: 0,
      reason: "Upgrade plan to create a workspace.",
    };
  }

  if (remaining <= 0) {
    const workspaceLabel = limit === 1 ? "workspace" : "workspaces";
    const slotState = limit === 1 ? "slot is" : "slots are";

    return {
      allowed: false,
      tier: plan.tier,
      used,
      limit,
      remaining: 0,
      reason: `Your ${PLAN_TIER_LABELS[plan.tier]} plan includes ${limit} ${workspaceLabel}, and all ${slotState} in use.`,
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
  const reservedSlots = await getReservedEntitlementSlots(ctx, userId);
  const usedWorkspaces = [...reservedSlots].filter(
    (slot) => slot <= plan.workspacesLimit
  ).length;

  return {
    tier: plan.tier,
    workspaces: {
      used: usedWorkspaces,
      limit: plan.workspacesLimit,
      percentUsed: Math.round((usedWorkspaces / plan.workspacesLimit) * 100),
    },
    expiresAt: plan.expiresAt,
    polarCustomerId: plan.polarCustomerId,
  };
}
