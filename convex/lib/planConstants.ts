// convex/lib/planConstants.ts
// Pure constants and types for plan tier system
// Per AGENT_CONTEXT.txt: *Helpers.ts = config, constants, utilities
// This file breaks the circular dependency between planCore.ts and planHelpers.ts

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

/**
 * Type for the plan object returned by helper functions.
 * Note: _id can be null for virtual plans in query context.
 */
export type UserPlan = {
  _id: Id<"userPlans"> | null;
  _creationTime: number;
  userId: Id<"users">;
  tier: "free" | "base" | "pro";
  prospectsLimit: number;
  workspacesLimit: number;
  currentProspectsCount: number;
  currentProspectsCycleStart?: number;
  currentProspectsCycleEnd?: number;
  currentWorkspacesCount: number;
  updatedAt: number;
  externalSubscriptionId?: string;
  polarCustomerId?: string;
  expiresAt?: number;
};
