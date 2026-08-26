// convex/lib/planConstants.ts
// Pure constants and types for plan tier system
// Per AGENT_CONTEXT.txt: *Helpers.ts = config, constants, utilities
// This file breaks the circular dependency between planCore.ts and planHelpers.ts

import type { Id } from "../_generated/dataModel";

/**
 * Plan tier configuration
 * Free: internal unpaid fallback, no prospecting
 * Hobby: 100 prospects, 1 workspace
 * Base: 1000 prospects, 2 workspaces
 * Pro: unlimited prospects (-1), 5 workspaces
 */
const HOBBY_LIMITS = {
  prospectsLimit: 100,
  workspacesLimit: 1,
} as const;

export const PLAN_LIMITS = {
  free: {
    prospectsLimit: 0,
    workspacesLimit: 1,
  },
  hobby: HOBBY_LIMITS,
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
export type PaidPlanTier = Exclude<PlanTier, "free">;

export const PAID_PLAN_TIERS = ["hobby", "base", "pro"] as const;

export const PLAN_TIER_LABELS = {
  free: "Plan required",
  hobby: "Hobby",
  base: "Base",
  pro: "Pro",
} as const satisfies Record<PlanTier, string>;

export function isPaidPlanTier(tier: PlanTier): tier is PaidPlanTier {
  return tier !== "free";
}

/**
 * Type for the plan object returned by helper functions.
 * Note: _id can be null for virtual plans in query context.
 */
export type UserPlan = {
  _id: Id<"userPlans"> | null;
  _creationTime: number;
  userId: Id<"users">;
  tier: PlanTier;
  prospectsLimit: number;
  workspacesLimit: number;
  currentProspectsCount: number;
  currentProspectsCycleStart?: number;
  currentProspectsCycleEnd?: number;
  updatedAt: number;
  externalSubscriptionId?: string;
  polarCustomerId?: string;
  expiresAt?: number;
};
