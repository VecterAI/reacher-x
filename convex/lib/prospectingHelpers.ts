// convex/lib/prospectingHelpers.ts
// Helper functions for prospecting workflow limit checks

import { QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Tier limit configurations
 */
export const TIER_LIMITS = {
  free: {
    prospectsPerWorkspace: 100,
    maxWorkspaces: 1,
  },
  base: {
    prospectsPerWorkspace: 1000,
    maxWorkspaces: 2,
  },
  pro: {
    prospectsPerWorkspace: -1, // -1 = unlimited
    maxWorkspaces: 5,
  },
} as const;

export type Tier = keyof typeof TIER_LIMITS;

/**
 * Batch size limits for cost and rate limit control.
 * These are intentionally conservative to prevent API abuse.
 */
export const BATCH_LIMITS = {
  /** Number of seed keywords to generate per workflow cycle */
  seedKeywordsPerCycle: 10,
  /** Number of seed keywords to send to Bishopi for discovery */
  keywordsToBishopi: 5,
  /** Number of social queries to generate per cycle */
  socialQueriesPerCycle: 15,
  /** Number of queries to search on Twitter per cycle */
  twitterSearchBatch: 5,
  /** Number of LinkedIn post queries to search per cycle */
  linkedinPostSearchBatch: 4,
  /** Number of LinkedIn people queries to search per cycle */
  linkedinPeopleSearchBatch: 2,
} as const;

export type Platform = "twitter" | "linkedin";

/**
 * Get the prospect limit for a given tier
 */
export function getProspectLimit(tier: Tier): number {
  return TIER_LIMITS[tier].prospectsPerWorkspace;
}

/**
 * Get the workspace limit for a given tier
 */
export function getWorkspaceLimit(tier: Tier): number {
  return TIER_LIMITS[tier].maxWorkspaces;
}

/**
 * Check if the prospect limit has been reached for a workspace
 * Returns { limitReached, currentCount, limit }
 */
export async function checkProspectLimit(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">
): Promise<{
  limitReached: boolean;
  currentCount: number;
  limit: number;
  tier: Tier;
}> {
  // Get user's plan
  const userPlan = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  // Default to free tier if no plan exists
  const tier: Tier = (userPlan?.tier as Tier) || "free";
  const limit = getProspectLimit(tier);

  // If unlimited, never reached
  if (limit === -1) {
    return {
      limitReached: false,
      currentCount: 0,
      limit: -1,
      tier,
    };
  }

  // Count prospects for this workspace
  const prospects = await ctx.db
    .query("prospects")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  const currentCount = prospects.length;

  return {
    limitReached: currentCount >= limit,
    currentCount,
    limit,
    tier,
  };
}

/**
 * Get the current prospect count for a workspace
 */
export async function getWorkspaceProspectCount(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
): Promise<number> {
  const prospects = await ctx.db
    .query("prospects")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  return prospects.length;
}

/**
 * Check if user can create more workspaces
 */
export async function checkWorkspaceLimit(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<{
  limitReached: boolean;
  currentCount: number;
  limit: number;
  tier: Tier;
}> {
  // Get user's plan
  const userPlan = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  // Default to free tier if no plan exists
  const tier: Tier = (userPlan?.tier as Tier) || "free";
  const limit = getWorkspaceLimit(tier);

  // Count workspaces for this user
  const workspaces = await ctx.db
    .query("workspaces")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();

  const currentCount = workspaces.length;

  return {
    limitReached: currentCount >= limit,
    currentCount,
    limit,
    tier,
  };
}
