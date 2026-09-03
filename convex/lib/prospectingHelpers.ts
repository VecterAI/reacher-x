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
  resolveWorkspaceUseCaseKey,
  type WorkspaceUseCaseKey,
} from "../../shared/lib/workspaceUseCases";
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

type PreviewTwitterGraphSeedWorkspace = Pick<
  Doc<"workspaces">,
  "icps" | "useCaseKey"
>;

const PREVIEW_GRAPH_SEED_QUERY_MAX_LENGTH = 80;
const PREVIEW_RAW_GRAPH_SEED_QUERY_MAX_LENGTH = 220;

const PROFILE_INTENT_HINT_PATTERN =
  /\b(accelerator|advisor|angel|backer|buyer|candidate|ceo|cfo|coach|community|consultant|creator|cto|developer|director|engineer|executive|family office|founder|fund|general partner|gp|head|hiring|investor|lead|manager|micro[-\s]?vc|operator|owner|partner|participant|podcast|principal|recruiter|researcher|scout|speaker|vc|venture)\b/i;

const PREVIEW_TWITTER_GRAPH_SEED_QUERIES: Partial<
  Record<WorkspaceUseCaseKey, string[]>
> = {
  customer_prospecting: [
    "founder",
    "head of growth",
    "head of sales",
    "product leader",
    "operations leader",
  ],
  recruiting: [
    "software engineer",
    "product designer",
    "product manager",
    "data scientist",
    "engineering manager",
  ],
  partnership_outreach: [
    "partnerships leader",
    "business development",
    "strategic partnerships",
    "ecosystem partner",
    "channel partner",
  ],
  investor_outreach: [
    "pre-seed investor",
    "seed investor",
    "early-stage investor",
    "angel investor",
    "venture partner",
    "VC partner",
    "micro VC",
    "family office investor",
    "investing in founders",
    "backing founders",
    "writing seed checks",
    "looking for founders",
  ],
  user_research_recruitment: [
    "early adopter",
    "beta tester",
    "research participant",
    "product user",
    "power user",
  ],
  creator_outreach: [
    "content creator",
    "newsletter writer",
    "podcaster",
    "youtube creator",
    "indie creator",
  ],
  community_growth: [
    "community builder",
    "community manager",
    "founder community",
    "developer community",
    "startup community",
  ],
  podcast_speaker_sourcing: [
    "podcast guest",
    "conference speaker",
    "founder speaker",
    "industry expert",
    "author",
  ],
};

const PREVIEW_TWITTER_RAW_GRAPH_SEED_QUERIES: Partial<
  Record<WorkspaceUseCaseKey, string[]>
> = {
  customer_prospecting: [
    '(founder OR ceo OR "head of growth" OR "head of sales") -filter:replies',
    '("building" OR "launching") (startup OR saas OR product) -filter:replies',
    '("looking for" OR "need help with") (customers OR sales OR growth) -filter:replies',
    '(operator OR founder) ("go-to-market" OR gtm OR sales) -filter:replies',
    '("startup founder" OR "b2b founder" OR "saas founder") -filter:replies',
  ],
  recruiting: [
    '("software engineer" OR developer OR "product engineer") -filter:replies',
    '("product designer" OR "ux designer" OR "design engineer") -filter:replies',
    '("product manager" OR "data scientist" OR "engineering manager") -filter:replies',
    '("open to work" OR "looking for my next role") (engineer OR designer OR pm) -filter:replies',
    '(engineer OR designer OR pm) ("building" OR "shipped" OR "launched") -filter:replies',
  ],
  partnership_outreach: [
    '("strategic partnerships" OR "business development" OR "partner manager") -filter:replies',
    '("ecosystem partner" OR "channel partner" OR "partnerships lead") -filter:replies',
    '(partnerships OR "business development") (saas OR startup OR b2b) -filter:replies',
    '("looking for partners" OR "partner ecosystem") -filter:replies',
    '("co-selling" OR "channel sales" OR "integration partner") -filter:replies',
  ],
  investor_outreach: [
    '("pre-seed" OR preseed) (investor OR angel OR vc) -filter:replies',
    '("pre-seed investor" OR "seed investor" OR "angel investor") -filter:replies',
    '("lead pre-seed" OR "lead seed") (round OR rounds OR checks) -filter:replies',
    '("writing checks" OR "write checks" OR "seed checks") (founders OR startups) -filter:replies',
    '("backing founders" OR "investing in founders" OR "funding founders") -filter:replies',
    '("micro VC" OR "solo GP" OR "venture partner") -filter:replies',
  ],
  user_research_recruitment: [
    '("early adopter" OR "beta tester" OR "research participant") -filter:replies',
    '("power user" OR "product user") (workflow OR tool OR app) -filter:replies',
    '("user research" OR "customer interview" OR "product feedback") -filter:replies',
    '("looking for beta" OR "trying new tools" OR "testing products") -filter:replies',
    '(founder OR operator OR manager) ("pain point" OR workflow OR feedback) -filter:replies',
  ],
  creator_outreach: [
    '("content creator" OR "newsletter writer" OR podcaster) -filter:replies',
    '("youtube creator" OR "indie creator" OR "creator economy") -filter:replies',
    '(creator OR writer OR podcaster) ("sponsored" OR newsletter OR audience) -filter:replies',
    '("building an audience" OR "growing my audience") -filter:replies',
    '("new episode" OR "latest newsletter" OR "published today") -filter:replies',
  ],
  community_growth: [
    '("community builder" OR "community manager" OR "developer community") -filter:replies',
    '("startup community" OR "founder community" OR "member community") -filter:replies',
    '(community OR members) ("growing" OR "building" OR "launching") -filter:replies',
    '("community-led" OR "community growth" OR "community ops") -filter:replies',
    '("discord community" OR "slack community" OR "online community") -filter:replies',
  ],
  podcast_speaker_sourcing: [
    '("podcast guest" OR "conference speaker" OR "founder speaker") -filter:replies',
    '("industry expert" OR author OR "keynote speaker") -filter:replies',
    '("spoke at" OR "speaking at" OR "joined the podcast") -filter:replies',
    '("new episode" OR "podcast episode") (founder OR expert OR author) -filter:replies',
    '("call for speakers" OR "speaker lineup" OR "panel discussion") -filter:replies',
  ],
};

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

type PreviewTwitterRawGraphSeedOptions = {
  sinceTimestampSeconds?: number;
};

function normalizePreviewGraphSeedQuery(value: string): string | null {
  const normalized = value.replace(/["'`]/g, "").replace(/\s+/g, " ").trim();

  if (normalized.length < 3) {
    return null;
  }

  if (normalized.length <= PREVIEW_GRAPH_SEED_QUERY_MAX_LENGTH) {
    return normalized;
  }

  const clipped = normalized
    .slice(0, PREVIEW_GRAPH_SEED_QUERY_MAX_LENGTH)
    .trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const trimmed =
    lastSpace >= 16 ? clipped.slice(0, lastSpace).trimEnd() : clipped;

  return trimmed.length >= 3 ? trimmed : null;
}

function appendPreviewGraphSeedQuery(
  queries: string[],
  seen: Set<string>,
  value: string | undefined
) {
  if (!value) {
    return;
  }

  const normalized = normalizePreviewGraphSeedQuery(value);
  if (!normalized) {
    return;
  }

  const key = normalized.toLowerCase();
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  queries.push(normalized);
}

function normalizePreviewRawGraphSeedQuery(value: string): string | null {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length < 3) {
    return null;
  }

  if (normalized.length <= PREVIEW_RAW_GRAPH_SEED_QUERY_MAX_LENGTH) {
    return normalized;
  }

  return normalized.slice(0, PREVIEW_RAW_GRAPH_SEED_QUERY_MAX_LENGTH).trimEnd();
}

function appendPreviewRawGraphSeedQuery(
  queries: string[],
  seen: Set<string>,
  value: string | undefined,
  options: PreviewTwitterRawGraphSeedOptions
) {
  if (!value) {
    return;
  }

  const normalized = normalizePreviewRawGraphSeedQuery(value);
  if (!normalized) {
    return;
  }

  const withSinceTime =
    options.sinceTimestampSeconds !== undefined &&
    !/\bsince_time:\d+\b/.test(normalized)
      ? `${normalized} since_time:${options.sinceTimestampSeconds}`
      : normalized;
  const key = withSinceTime.toLowerCase();
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  queries.push(withSinceTime);
}

function hasProfileIntentHint(value: string) {
  return PROFILE_INTENT_HINT_PATTERN.test(value);
}

export function buildPreviewTwitterGraphSeedQueries(
  workspace: PreviewTwitterGraphSeedWorkspace
): string[] {
  const useCaseKey = resolveWorkspaceUseCaseKey(workspace.useCaseKey);
  const queries: string[] = [];
  const seen = new Set<string>();

  for (const query of PREVIEW_TWITTER_GRAPH_SEED_QUERIES[useCaseKey] ?? []) {
    appendPreviewGraphSeedQuery(queries, seen, query);
  }

  for (const icp of workspace.icps ?? []) {
    appendPreviewGraphSeedQuery(queries, seen, icp.title);

    for (const keyword of icp.qualificationKeywords ?? []) {
      if (hasProfileIntentHint(keyword)) {
        appendPreviewGraphSeedQuery(queries, seen, keyword);
      }
    }

    for (const painPoint of icp.painPoints) {
      if (hasProfileIntentHint(painPoint)) {
        appendPreviewGraphSeedQuery(queries, seen, painPoint);
      }
    }
  }

  return queries;
}

export function buildPreviewTwitterRawGraphSeedQueries(
  workspace: PreviewTwitterGraphSeedWorkspace,
  options: PreviewTwitterRawGraphSeedOptions = {}
): string[] {
  const useCaseKey = resolveWorkspaceUseCaseKey(workspace.useCaseKey);
  const queries: string[] = [];
  const seen = new Set<string>();

  for (const query of PREVIEW_TWITTER_RAW_GRAPH_SEED_QUERIES[useCaseKey] ??
    []) {
    appendPreviewRawGraphSeedQuery(queries, seen, query, options);
  }

  for (const query of PREVIEW_TWITTER_GRAPH_SEED_QUERIES[useCaseKey] ?? []) {
    appendPreviewRawGraphSeedQuery(
      queries,
      seen,
      `"${query}" -filter:replies`,
      options
    );
  }

  return queries;
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
