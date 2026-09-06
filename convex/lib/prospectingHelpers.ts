// convex/lib/prospectingHelpers.ts
// Helper functions for prospecting workflow limit checks

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, type Doc } from "../_generated/dataModel";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { PLAN_LIMITS, type PlanTier } from "./planConstants";
import { polar } from "../polar";
import { computeUsageCycleWindow } from "./planCycleUtils";
import { getOrCreateUserPlan } from "./planCore";
import { computeQualifiedProspectUsageForWorkspaceWindow } from "./planQualifiedUsageCore";
import { createStableHash } from "./memoryHelpers";
import {
  getSystemRuntimeConfig,
  type SystemRuntimeConfig,
} from "./runtimeConfigHelpers";

/**
 * Tier limit configurations
 */
export const TIER_LIMITS = {
  free: {
    prospectsPerWorkspace: PLAN_LIMITS.free.prospectsLimit,
    maxWorkspaces: PLAN_LIMITS.free.workspacesLimit,
  },
  hobby: {
    prospectsPerWorkspace: PLAN_LIMITS.hobby.prospectsLimit,
    maxWorkspaces: PLAN_LIMITS.hobby.workspacesLimit,
  },
  base: {
    prospectsPerWorkspace: PLAN_LIMITS.base.prospectsLimit,
    maxWorkspaces: PLAN_LIMITS.base.workspacesLimit,
  },
  pro: {
    prospectsPerWorkspace: PLAN_LIMITS.pro.prospectsLimit,
    maxWorkspaces: PLAN_LIMITS.pro.workspacesLimit,
  },
} as const;

export type Tier = PlanTier;

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
  twitterSearchBatch: 9,
  /** Number of LinkedIn post queries to search per cycle */
  linkedinPostSearchBatch: 5,
  /** Number of LinkedIn people queries to search per cycle */
  linkedinPeopleSearchBatch: 4,
} as const;

export type Platform = "twitter" | "linkedin";

type DiscoveryWorkspaceContext = Pick<
  Doc<"workspaces">,
  "description" | "improvedDescription" | "rawUserDescription"
>;

export function buildDiscoveryBusinessContext(
  workspace: DiscoveryWorkspaceContext
): string {
  const originalRequest = workspace.rawUserDescription?.trim();
  const currentDescription =
    workspace.improvedDescription?.trim() || workspace.description.trim();

  if (!originalRequest || originalRequest === currentDescription) {
    return currentDescription;
  }

  return `Original audience request (source of truth):\n${originalRequest}\n\nCurrent workspace description:\n${currentDescription}`;
}

function getDeterministicProspectingRecoveryJitterMs(
  workspaceId: string,
  failureStreak: number,
  jitterWindowMs: number
): number {
  if (jitterWindowMs <= 0) {
    return 0;
  }

  const hash = createStableHash(
    `${workspaceId}:prospecting-recovery:${failureStreak}`
  );
  const numericHash = Number.parseInt(hash.slice(0, 6), 16);

  if (!Number.isFinite(numericHash)) {
    return 0;
  }

  return numericHash % jitterWindowMs;
}

export function getProspectingRecoveryDelayMs(args: {
  workspaceId: string;
  failureStreak: number;
  recoveryConfig?: SystemRuntimeConfig["prospecting"]["recovery"];
}): number {
  const recoveryConfig =
    args.recoveryConfig ?? getSystemRuntimeConfig().prospecting.recovery;
  const normalizedFailureStreak = Math.max(1, Math.floor(args.failureStreak));
  const baseDelayMs = Math.min(
    recoveryConfig.maxDelayMs,
    recoveryConfig.baseDelayMs * 2 ** Math.max(0, normalizedFailureStreak - 1)
  );

  return (
    baseDelayMs +
    getDeterministicProspectingRecoveryJitterMs(
      args.workspaceId,
      normalizedFailureStreak,
      recoveryConfig.jitterWindowMs
    )
  );
}

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

export function formatQualifiedProspectLimitReachedMessage(args: {
  currentCount: number;
  limit: number;
}) {
  return `Qualified prospect limit reached for this workspace in the current cycle (${args.currentCount}/${args.limit}).`;
}

/**
 * Check if the prospect limit has been reached for a workspace
 * Returns { limitReached, currentCount, limit }
 */
export async function checkProspectLimit(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">
): Promise<{
  limitReached: boolean;
  currentCount: number;
  limit: number;
  tier: Tier;
  cycleStart: number;
  cycleEnd: number;
}> {
  const now = getCurrentUTCTimestamp();
  const userPlan = await getOrCreateUserPlan(ctx, userId);
  const tier: Tier = userPlan.tier;
  const limit = getProspectLimit(tier);
  const subscription = await polar.getCurrentSubscription(ctx, { userId });
  const window = computeUsageCycleWindow({
    now,
    tier,
    subscription,
  });
  const currentCount = await computeQualifiedProspectUsageForWorkspaceWindow(
    ctx,
    workspaceId,
    window
  );

  // If unlimited, never reached
  if (limit === -1) {
    return {
      limitReached: false,
      currentCount,
      limit: -1,
      tier,
      cycleStart: window.cycleStart,
      cycleEnd: window.cycleEnd,
    };
  }

  return {
    limitReached: currentCount >= limit,
    currentCount,
    limit,
    tier,
    cycleStart: window.cycleStart,
    cycleEnd: window.cycleEnd,
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
