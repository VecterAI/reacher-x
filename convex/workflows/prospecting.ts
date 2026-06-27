// convex/workflows/prospecting.ts
// Continuous 24/7 prospecting workflow using Convex Workflow component
//
// This workflow runs one complete prospecting cycle per workspace:
// 1. Check prospect limit vs tier → STOP if exceeded
// 2. Generate new seed keywords (AI)
// 3. Send to Bishopi (keyword discovery)
// 4. Convert to social queries (AI)
// 5. Search Twitter (NEW queries only - monitors handle ongoing)
// 6. Search LinkedIn posts + people with adaptive query reuse
// 7. Save prospects
// 8. Create Twitter monitors for new queries
// 9. Qualify new prospects
// 10. Complete and schedule next run via onComplete handler

import { v } from "convex/values";
import { workflow } from "../lib/workflow";
import { internal, api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  internalQuery,
  internalMutation,
  internalAction,
} from "../lib/functionBuilders";
import {
  BATCH_LIMITS,
  buildPreviewTwitterRawGraphSeedQueries,
  checkProspectLimit,
  formatQualifiedProspectLimitReachedMessage,
  getProspectingRecoveryDelayMs,
} from "../lib/prospectingHelpers";
import { PREVIEW_BATCH_LIMITS } from "../lib/previewBatchLimits";
import { hasRequiredWorkspaceAgentData } from "../lib/workspaceSetup";
import type {
  TwitterPost,
  TwitterUser,
} from "../integrations/twitter/searchPosts";
import type { LinkedInPost } from "../integrations/linkedin/searchPosts";
import type { LinkedInPerson } from "../integrations/linkedin/searchPeople";
import {
  prospectingCycleStatusValidator,
  prospectingWorkflowPauseReasonValidator,
  workspaceWorkflowStatusValidator,
} from "../validators";
import { logger } from "../../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { isWorkspaceInactive } from "../lib/workspaceSystem";
import { getTwitterPostId } from "../../shared/lib/twitter/contracts";

type QueryMetadataRecord = {
  query: string;
  sourceKeyword?: string;
  platformTargets: Array<"twitter" | "linkedin">;
  linkedinSurface?: "posts" | "people";
  linkedinSurfaceTargets?: Array<"posts" | "people">;
  queryStyle: "natural_phrase" | "professional_keyword" | "role_title";
  legacyCompatibilitySource: boolean;
};

type LinkedInQueueItem = {
  id: Id<"keywords">;
  value: string;
};

type TwitterQueryStat = {
  query: string;
  postsFound: number;
  success: boolean;
  error?: string;
};

type TwitterSearchResult = {
  saved: number;
  queryStats: TwitterQueryStat[];
  posts: TwitterPost[];
  matchedQueriesByPostId: Record<string, string[]>;
};

type TwitterSearchMode = "exact" | "raw";

const PREVIEW_GRAPH_SEED_LOOKBACK_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const prospectingWorkflowLogger = logger.withScope("ProspectingWorkflow");

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const query of queries) {
    if (seen.has(query)) {
      continue;
    }

    seen.add(query);
    deduped.push(query);
  }

  return deduped;
}

function createEmptyTwitterSearchResult(): TwitterSearchResult {
  return {
    saved: 0,
    queryStats: [],
    posts: [],
    matchedQueriesByPostId: {},
  };
}

function getPreviewGraphSeedSinceTimestampSeconds() {
  return Math.floor(
    (getCurrentUTCTimestamp() - PREVIEW_GRAPH_SEED_LOOKBACK_MS) / 1000
  );
}

function mergeTwitterSearchResults(
  results: TwitterSearchResult[]
): TwitterSearchResult {
  const postsById = new Map<string, TwitterPost>();
  const matchedQueriesByPostId: Record<string, string[]> = {};

  for (const result of results) {
    for (const post of result.posts) {
      const postId = getTwitterPostId(post);
      if (!postId) {
        continue;
      }

      if (!postsById.has(postId)) {
        postsById.set(postId, post);
      }

      matchedQueriesByPostId[postId] = dedupeQueries([
        ...(matchedQueriesByPostId[postId] ?? []),
        ...(result.matchedQueriesByPostId[postId] ?? []),
      ]);
    }
  }

  return {
    saved: results.reduce((total, result) => total + result.saved, 0),
    queryStats: results.flatMap((result) => result.queryStats),
    posts: Array.from(postsById.values()),
    matchedQueriesByPostId,
  };
}

function isTruthyEnv(value: string | undefined) {
  return (
    typeof value === "string" &&
    ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
  );
}

function shouldAutoRescheduleProspecting() {
  if (process.env.PROSPECTING_AUTO_RESCHEDULE !== undefined) {
    return isTruthyEnv(process.env.PROSPECTING_AUTO_RESCHEDULE);
  }

  return process.env.NODE_ENV === "production";
}

function getProspectingRescheduleDelayMs() {
  const configuredMinutes = Number(
    process.env.PROSPECTING_RESCHEDULE_INTERVAL_MINUTES ?? "60"
  );
  const minutes =
    Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : 60;

  return minutes * 60 * 1000;
}

// ============================================================================
// Workflow Definition
// ============================================================================

/**
 * One complete prospecting cycle.
 *
 * Behavior:
 * - Retries on failure (exponential backoff)
 * - NEVER skips steps - blocks until success
 * - Returns status indicating whether to schedule next run
 */
export const prospectingWorkflow = workflow.define({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({
    status: prospectingCycleStatusValidator,
    reason: v.optional(v.string()),
    prospectsFound: v.optional(v.number()),
    twitterSaved: v.optional(v.number()),
    linkedinSaved: v.optional(v.number()),
    shouldContinue: v.boolean(),
  }),
  handler: async (
    step,
    args
  ): Promise<{
    status: "completed" | "limit_reached" | "error";
    reason?: string;
    prospectsFound?: number;
    twitterSaved?: number;
    linkedinSaved?: number;
    shouldContinue: boolean;
  }> => {
    const workflowSourceId = String(step.workflowId);
    let onboardingIssueRaised = false;
    let searchIssueRaised = false;

    // Step 1: Check prospect limit
    const limitCheck = await step.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      { workspaceId: args.workspaceId }
    );

    if (limitCheck.limitReached) {
      await step.runMutation(
        internal.workspaces.clearOnboardingIssueStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      await step.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      await step.runMutation(
        internal.memory.recordMemoryWorkflowEventInternal,
        {
          workspaceId: args.workspaceId,
          eventType: "prospecting_cycle_limit_reached",
          sourceType: "workflow_event",
          sourceId: workflowSourceId,
          workflowName: "prospectingWorkflow",
          payload: {
            reason: "prospect_limit_reached",
            currentCount: limitCheck.currentCount,
            limit: limitCheck.limit,
          },
          eventKey: `prospecting:${workflowSourceId}:limit_reached`,
        }
      );
      return {
        status: "limit_reached",
        reason: formatQualifiedProspectLimitReachedMessage({
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
        }),
        shouldContinue: false,
      };
    }

    // Step 2: Get workspace data
    const workspace = await step.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    const hasRequiredSetupData = hasRequiredWorkspaceAgentData(workspace);
    if (!hasRequiredSetupData) {
      onboardingIssueRaised = true;
      await step.runMutation(
        internal.workspaces.setOnboardingIssueStateInternal,
        {
          workspaceId: args.workspaceId,
          statusCode: "setup_incomplete",
          source: "setup",
        }
      );
      await step.runMutation(
        internal.workflows.prospecting.updateWorkflowStatus,
        {
          workspaceId: args.workspaceId,
          status: "stopped",
        }
      );
      await step.runMutation(
        internal.memory.recordMemoryWorkflowEventInternal,
        {
          workspaceId: args.workspaceId,
          eventType: "prospecting_cycle_failed",
          sourceType: "workflow_event",
          sourceId: workflowSourceId,
          workflowName: "prospectingWorkflow",
          payload: {
            reason: "workspace_setup_incomplete",
          },
          eventKey: `prospecting:${workflowSourceId}:setup_incomplete`,
        }
      );
      return {
        status: "error",
        reason: "Workspace setup incomplete",
        shouldContinue: false,
      };
    }

    // Step 3: Collect syntheticPosts from all ICPs
    const allSyntheticPosts = workspace.icps.flatMap(
      (icp: any) => icp.syntheticPosts || []
    );

    if (allSyntheticPosts.length === 0) {
      onboardingIssueRaised = true;
      await step.runMutation(
        internal.workspaces.setOnboardingIssueStateInternal,
        {
          workspaceId: args.workspaceId,
          statusCode: "icp_refresh_required",
          source: "system",
        }
      );
      await step.runMutation(
        internal.workflows.prospecting.updateWorkflowStatus,
        {
          workspaceId: args.workspaceId,
          status: "stopped",
        }
      );
      await step.runAction(
        internal.workspaceIcpSignals.refreshWorkspaceIcpSignalsInternal,
        {
          workspaceId: args.workspaceId,
          restartWorkflow: true,
        }
      );
      await step.runMutation(
        internal.memory.recordMemoryWorkflowEventInternal,
        {
          workspaceId: args.workspaceId,
          eventType: "prospecting_cycle_failed",
          sourceType: "workflow_event",
          sourceId: workflowSourceId,
          workflowName: "prospectingWorkflow",
          payload: {
            reason: "missing_synthetic_posts",
          },
          eventKey: `prospecting:${workflowSourceId}:missing_synthetic_posts`,
        }
      );
      return {
        status: "error",
        reason: "No synthetic posts in ICPs - profile targeting refresh queued",
        shouldContinue: false,
      };
    }

    // Step 4: Generate prospecting keywords from synthetic posts
    const keywordsResult = await step.runAction(
      internal.agents.internal.generateProspectingKeywordsAction,
      {
        workspaceId: args.workspaceId,
        syntheticPosts: allSyntheticPosts,
        businessContext: workspace.improvedDescription,
        useCaseKey: workspace.useCaseKey,
      },
      { retry: { maxAttempts: 3, initialBackoffMs: 1000, base: 2 } }
    );

    if (!keywordsResult.success || !keywordsResult.prospectingKeywords) {
      throw new Error(keywordsResult.error || "Failed to generate keywords");
    }

    // Step 5: Convert to social queries
    const socialQueriesResult = await step.runAction(
      internal.agents.internal.convertToSocialQueriesAction,
      {
        workspaceId: args.workspaceId,
        keywords: keywordsResult.prospectingKeywords,
        platforms: ["twitter", "linkedin"],
        businessContext: workspace.improvedDescription,
        useCaseKey: workspace.useCaseKey,
      },
      { retry: { maxAttempts: 3, initialBackoffMs: 1000, base: 2 } }
    );

    if (!socialQueriesResult.success || !socialQueriesResult.socialQueries) {
      throw new Error(socialQueriesResult.error || "Failed to convert queries");
    }

    // LEGACY COMPAT: retain the flattened socialQueries bridge while the
    // workflow and stored keywords migrate to queriesByPlatform/queryMetadata.
    // Remove after all consumers read the structured fields and legacy rows
    // without platform metadata have been backfilled or aged out.
    const socialQueries = socialQueriesResult.socialQueries.slice(
      0,
      PREVIEW_BATCH_LIMITS.socialQueriesPerCycle
    );
    const queryMetadata: QueryMetadataRecord[] =
      socialQueriesResult.queryMetadata?.filter((item: QueryMetadataRecord) =>
        socialQueries.includes(item.query)
      ) ?? [];
    const candidateInputs: Array<{ rawValue: string; sourceTheme?: string }> =
      queryMetadata
        .slice(0, BATCH_LIMITS.socialQueriesPerCycle)
        .map((item: QueryMetadataRecord) => ({
          rawValue: item.query,
          sourceTheme: item.sourceKeyword,
        }));
    const noveltyScreening = await step.runAction(
      internal.memory.screenDiscoveryQueryCandidatesInternal,
      {
        workspaceId: args.workspaceId,
        candidates: candidateInputs,
      }
    );
    const acceptedSocialQueries = noveltyScreening.accepted.map(
      (candidate: { rawValue: string }) => candidate.rawValue
    );
    const acceptedQuerySet = new Set(acceptedSocialQueries);

    // Step 6: Save keywords to database FIRST (so we can track them)
    await step.runMutation(
      internal.workflows.prospecting.saveKeywordsInternal,
      {
        workspaceId: args.workspaceId,
        seedKeywords: keywordsResult.prospectingKeywords,
        discoveredKeywords: [], // Bishopi disabled
        socialQueries: acceptedSocialQueries,
        queryMetadata: queryMetadata.filter((item: QueryMetadataRecord) =>
          acceptedQuerySet.has(item.query)
        ),
      }
    );

    // Step 7 & 8: Search Twitter AND LinkedIn in PARALLEL
    // (Qualification now happens automatically per-prospect on save via streaming workflows)
    let twitterSaved = 0;
    let linkedinSaved = 0;
    let twitterSeedCandidates: TwitterPost[] = [];
    let twitterMatchedQueriesByPostId: Record<string, string[]> = {};

    const [twitterResult, linkedinResult] = await Promise.all([
      // Twitter search
      (async () => {
        try {
          const unsearchedTwitter = await step.runQuery(
            internal.keywords.getUnsearchedQueries,
            {
              workspaceId: args.workspaceId,
              platform: "twitter",
              limit: BATCH_LIMITS.twitterSearchBatch,
            }
          );

          if (unsearchedTwitter.length > 0) {
            const result = await step.runAction(
              internal.workflows.prospecting.searchTwitterInternal,
              {
                workspaceId: args.workspaceId,
                queries: unsearchedTwitter.map((q: any) => q.value),
              },
              { retry: { maxAttempts: 2, initialBackoffMs: 2000, base: 2 } }
            );

            // Mark queries as searched
            await step.runMutation(internal.keywords.markQueriesAsSearched, {
              queryIds: unsearchedTwitter.map((q: any) => q.id),
              platform: "twitter",
              resultsCount: result.saved,
              queryStats: result.queryStats,
            });

            return result;
          }
          return {
            saved: 0,
            queryStats: [] as Array<{
              query: string;
              postsFound: number;
              success: boolean;
              error?: string;
            }>,
            posts: [] as TwitterPost[],
            matchedQueriesByPostId: {} as Record<string, string[]>,
          };
        } catch (err) {
          onboardingIssueRaised = true;
          searchIssueRaised = true;
          await step.runMutation(
            internal.workspaces.setOnboardingIssueStateInternal,
            {
              workspaceId: args.workspaceId,
              statusCode: "search_failed",
              source: "search",
            }
          );
          prospectingWorkflowLogger.error(
            "Twitter search failed",
            {
              workspaceId: String(args.workspaceId),
              workspaceName: workspace.name,
            },
            err
          );
          return {
            saved: 0,
            queryStats: [] as Array<{
              query: string;
              postsFound: number;
              success: boolean;
              error?: string;
            }>,
            posts: [] as TwitterPost[],
            matchedQueriesByPostId: {} as Record<string, string[]>,
          };
        }
      })(),

      // LinkedIn search
      (async () => {
        try {
          const [linkedInPostQueue, linkedInPeopleQueue] = await Promise.all([
            step.runQuery(internal.keywords.getPrioritizedLinkedInQueries, {
              workspaceId: args.workspaceId,
              surface: "posts",
              limit: BATCH_LIMITS.linkedinPostSearchBatch,
            }),
            step.runQuery(internal.keywords.getPrioritizedLinkedInQueries, {
              workspaceId: args.workspaceId,
              surface: "people",
              limit: BATCH_LIMITS.linkedinPeopleSearchBatch,
            }),
          ]);

          if (linkedInPostQueue.length > 0 || linkedInPeopleQueue.length > 0) {
            const result = await step.runAction(
              internal.workflows.prospecting.searchLinkedInInternal,
              {
                workspaceId: args.workspaceId,
                postQueries: linkedInPostQueue.map(
                  (q: LinkedInQueueItem) => q.value
                ),
                peopleQueries: linkedInPeopleQueue.map(
                  (q: LinkedInQueueItem) => q.value
                ),
              },
              { retry: { maxAttempts: 2, initialBackoffMs: 2000, base: 2 } }
            );

            if (linkedInPostQueue.length > 0) {
              await step.runMutation(internal.keywords.markQueriesAsSearched, {
                queryIds: linkedInPostQueue.map(
                  (q: LinkedInQueueItem) => q.id as Id<"keywords">
                ),
                platform: "linkedin",
                surface: "posts",
                queryStats: result.postQueryStats,
              });
            }

            if (linkedInPeopleQueue.length > 0) {
              await step.runMutation(internal.keywords.markQueriesAsSearched, {
                queryIds: linkedInPeopleQueue.map(
                  (q: LinkedInQueueItem) => q.id as Id<"keywords">
                ),
                platform: "linkedin",
                surface: "people",
                queryStats: result.peopleQueryStats.map(
                  (item: {
                    query: string;
                    postsFound: number;
                    success: boolean;
                    error?: string;
                  }) => ({
                    query: item.query,
                    postsFound: item.postsFound,
                    success: item.success,
                    error: item.error,
                  })
                ),
              });
            }

            return result;
          }
          return {
            saved: 0,
            postQueryStats: [] as Array<{
              query: string;
              postsFound: number;
              success: boolean;
              error?: string;
            }>,
            peopleQueryStats: [] as Array<{
              query: string;
              postsFound: number;
              success: boolean;
              error?: string;
            }>,
          };
        } catch (err) {
          onboardingIssueRaised = true;
          searchIssueRaised = true;
          await step.runMutation(
            internal.workspaces.setOnboardingIssueStateInternal,
            {
              workspaceId: args.workspaceId,
              statusCode: "search_failed",
              source: "search",
            }
          );
          prospectingWorkflowLogger.error(
            "LinkedIn search failed",
            {
              workspaceId: String(args.workspaceId),
              workspaceName: workspace.name,
            },
            err
          );
          return {
            saved: 0,
            postQueryStats: [] as Array<{
              query: string;
              postsFound: number;
              success: boolean;
              error?: string;
            }>,
            peopleQueryStats: [] as Array<{
              query: string;
              postsFound: number;
              success: boolean;
              error?: string;
            }>,
          };
        }
      })(),
    ]);

    twitterSaved = twitterResult.saved;
    twitterSeedCandidates = twitterResult.posts;
    twitterMatchedQueriesByPostId = twitterResult.matchedQueriesByPostId;
    linkedinSaved = linkedinResult.saved;

    if (!searchIssueRaised) {
      await step.runMutation(
        internal.workspaces.clearOnboardingIssueStateForSourceInternal,
        {
          workspaceId: args.workspaceId,
          source: "search",
        }
      );
    }

    let promotedSeedCount = 0;
    if (twitterSeedCandidates.length > 0) {
      try {
        const promotionResult = await step.runAction(
          internal.xConversationDiscovery.promoteConversationSeedsInternal,
          {
            workspaceId: args.workspaceId,
            posts: twitterSeedCandidates,
            matchedQueriesByPostId: twitterMatchedQueriesByPostId,
            maxSeeds: 3,
          },
          { retry: { maxAttempts: 2, initialBackoffMs: 1000, base: 2 } }
        );
        promotedSeedCount = promotionResult.createdOrUpdated;

        if (promotionResult.seedIds.length > 0) {
          await step.runAction(
            internal.xConversationDiscovery
              .initialBackfillConversationSeedsInternal,
            {
              seedIds: promotionResult.seedIds,
            },
            { retry: { maxAttempts: 2, initialBackoffMs: 1000, base: 2 } }
          );

          await step.runAction(
            internal.xConversationDiscovery
              .createConversationSeedMonitorsInternal,
            {
              workspaceId: args.workspaceId,
              seedIds: promotionResult.seedIds,
            },
            { retry: { maxAttempts: 2, initialBackoffMs: 1000, base: 2 } }
          );
        }
      } catch (err) {
        prospectingWorkflowLogger.error(
          "Conversation seed discovery failed",
          {
            workspaceId: String(args.workspaceId),
            workspaceName: workspace.name,
          },
          err
        );
      }
    }

    // Step 9: Create Twitter monitors for new queries
    try {
      await step.runAction(
        internal.socialapiMonitors.createMonitorsFromSocialQueriesInternal,
        { workspaceId: args.workspaceId },
        { retry: { maxAttempts: 2, initialBackoffMs: 1000, base: 2 } }
      );
      await step.runMutation(
        internal.workspaces.clearOnboardingIssueStateForSourceInternal,
        {
          workspaceId: args.workspaceId,
          source: "monitor",
        }
      );
    } catch (err) {
      onboardingIssueRaised = true;
      await step.runMutation(
        internal.workspaces.setOnboardingIssueStateInternal,
        {
          workspaceId: args.workspaceId,
          statusCode: "monitor_creation_failed",
          source: "monitor",
        }
      );
      prospectingWorkflowLogger.error(
        "Monitor creation failed",
        {
          workspaceId: String(args.workspaceId),
          workspaceName: workspace.name,
        },
        err
      );
      // Continue even if monitor creation fails
    }

    // Note: Qualification now happens automatically per-prospect via streaming workflows
    // triggered immediately when prospects are saved (no batch step needed)

    const totalSaved = twitterSaved + linkedinSaved;

    if (!onboardingIssueRaised) {
      await step.runMutation(
        internal.workspaces.clearOnboardingIssueStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
    }

    await step.runMutation(internal.memory.recordMemoryWorkflowEventInternal, {
      workspaceId: args.workspaceId,
      eventType: "prospecting_cycle_completed",
      sourceType: "workflow_event",
      sourceId: workflowSourceId,
      workflowName: "prospectingWorkflow",
      payload: {
        prospectsFound: totalSaved,
        twitterSaved,
        linkedinSaved,
        promotedSeedCount,
        generatedQueryCount: socialQueries.length,
        acceptedQueryCount: acceptedSocialQueries.length,
        exactDuplicateCount: noveltyScreening.counts.exactDuplicates,
        semanticDuplicateCount: noveltyScreening.counts.semanticDuplicates,
      },
      eventKey: `prospecting:${workflowSourceId}:completed`,
    });

    return {
      status: "completed",
      prospectsFound: totalSaved,
      twitterSaved,
      linkedinSaved,
      shouldContinue: true, // Schedule next run
    };
  },
});

// ============================================================================
// Internal Helpers (Queries and Mutations for Workflow Steps)
// ============================================================================

/**
 * Check prospect limit for a workspace
 */
export const checkProspectLimitInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    // Get workspace to find userId
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return {
        limitReached: true,
        currentCount: 0,
        limit: 0,
        tier: "free" as const,
      };
    }

    const usage = await checkProspectLimit(
      ctx,
      args.workspaceId,
      workspace.userId
    );
    const { tier, currentCount, limit } = usage;

    // If unlimited, never reached
    if (limit === -1) {
      return { limitReached: false, currentCount, limit: -1, tier };
    }

    return {
      limitReached: currentCount >= limit,
      currentCount,
      limit,
      tier,
    };
  },
});

/**
 * Update workflow status on workspace
 */
export const updateWorkflowStatus = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    status: workspaceWorkflowStatusValidator,
    workflowId: v.optional(v.string()),
    pauseReason: v.optional(prospectingWorkflowPauseReasonValidator),
    pausedAt: v.optional(v.number()),
    lastMeaningfulActivityAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(args.workspaceId, {
      prospectingWorkflowStatus: args.status,
      ...(args.workflowId !== undefined && {
        prospectingWorkflowId: args.workflowId,
      }),
      ...(args.status === "running" && {
        prospectingWorkflowStartedAt: now,
        prospectingNextRunAt: undefined,
        prospectingNextRecoveryAt: undefined,
      }),
      ...(args.status === "paused" && {
        prospectingWorkflowPauseReason: args.pauseReason,
        prospectingWorkflowPausedAt: args.pausedAt ?? now,
        prospectingNextRunAt: undefined,
      }),
      ...(args.status !== "paused" && {
        prospectingWorkflowPauseReason: undefined,
        prospectingWorkflowPausedAt: undefined,
      }),
      ...(args.status === "stopped" && {
        prospectingNextRunAt: undefined,
      }),
      ...(args.lastMeaningfulActivityAt !== undefined && {
        lastMeaningfulActivityAt: args.lastMeaningfulActivityAt,
      }),
    });
  },
});

/**
 * Save keywords to the database
 */
export const saveKeywordsInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    seedKeywords: v.array(v.string()),
    discoveredKeywords: v.array(v.string()),
    socialQueries: v.array(v.string()),
    queryMetadata: v.optional(
      v.array(
        v.object({
          query: v.string(),
          sourceKeyword: v.optional(v.string()),
          platformTargets: v.array(
            v.union(v.literal("twitter"), v.literal("linkedin"))
          ),
          linkedinSurface: v.optional(
            v.union(v.literal("posts"), v.literal("people"))
          ),
          linkedinSurfaceTargets: v.optional(
            v.array(v.union(v.literal("posts"), v.literal("people")))
          ),
          queryStyle: v.union(
            v.literal("natural_phrase"),
            v.literal("professional_keyword"),
            v.literal("role_title")
          ),
          legacyCompatibilitySource: v.boolean(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const keywordsToSave: Array<{
      type: "seed" | "discovered" | "social_query";
      value: string;
      source: string;
      platformTargets?: Array<"twitter" | "linkedin">;
      linkedinSurface?: "posts" | "people";
      linkedinSurfaceTargets?: Array<"posts" | "people">;
      queryStyle?: "natural_phrase" | "professional_keyword" | "role_title";
    }> = [];
    const metadataByQuery = new Map(
      (args.queryMetadata ?? []).map((item) => [item.query, item])
    );

    for (const kw of args.seedKeywords) {
      keywordsToSave.push({ type: "seed", value: kw, source: "agent" });
    }

    for (const kw of args.discoveredKeywords) {
      keywordsToSave.push({ type: "discovered", value: kw, source: "bishopi" });
    }

    for (const query of args.socialQueries) {
      const metadata = metadataByQuery.get(query);
      keywordsToSave.push({
        type: "social_query",
        value: query,
        source: "agent",
        platformTargets: metadata?.platformTargets,
        linkedinSurface: metadata?.linkedinSurface,
        linkedinSurfaceTargets: metadata?.linkedinSurfaceTargets,
        queryStyle: metadata?.queryStyle,
      });
    }

    // Use the existing batch save function
    await ctx.runMutation(internal.keywords.saveKeywordsBatch, {
      workspaceId: args.workspaceId,
      keywords: keywordsToSave,
    });
  },
});

// ============================================================================
// Search Internal Actions
// ============================================================================

/**
 * Search Twitter and save prospects
 */
export const searchTwitterInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    queries: v.array(v.string()),
    processingMode: v.optional(
      v.union(v.literal("normal"), v.literal("preview"))
    ),
    prospectOrigin: v.optional(
      v.union(
        v.literal("setup_preview"),
        v.literal("workspace_discovery"),
        v.literal("manual")
      )
    ),
    setupSessionId: v.optional(v.id("workspaceSetupSessions")),
    setupRevision: v.optional(v.number()),
    searchMode: v.optional(v.union(v.literal("exact"), v.literal("raw"))),
  },
  handler: async (ctx, args): Promise<TwitterSearchResult> => {
    // Get workspace for userId
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const searchMode: TwitterSearchMode = args.searchMode ?? "exact";
    const result =
      searchMode === "raw"
        ? await ctx.runAction(
            api.integrations.twitter.searchPosts.searchRawBatch,
            {
              queries: args.queries,
              type: "Latest",
              maxQueriesPerBatch: 10,
            }
          )
        : await ctx.runAction(
            api.integrations.twitter.searchPosts.searchBatch,
            {
              queries: args.queries,
              type: "Latest",
              maxQueriesPerBatch: 10,
            }
          );

    if (!result.success || !result.posts?.length) {
      return {
        saved: 0,
        queryStats: result.queryStats ?? [],
        posts: [],
        matchedQueriesByPostId: {},
      };
    }

    // Transform and save prospects
    const prospectsToSave = result.posts.map((post: TwitterPost) => ({
      platform: "twitter" as const,
      externalId: post.id_str,
      data: post,
      matchedKeywords:
        result.matchedQueriesByPostId[post.id_str]?.slice(0, 5) ??
        args.queries.slice(0, 5),
    }));

    const saveResult = await ctx.runMutation(
      internal.prospects.createProspectsBatch,
      {
        userId: workspace.userId,
        workspaceId: args.workspaceId,
        processingMode: args.processingMode,
        prospects: prospectsToSave.map(
          (prospect: (typeof prospectsToSave)[number]) => ({
            ...prospect,
            origin: args.prospectOrigin,
            setupSessionId: args.setupSessionId,
            setupRevision: args.setupRevision,
          })
        ),
      }
    );

    return {
      saved: saveResult.created + saveResult.updated,
      queryStats: result.queryStats,
      posts: result.posts,
      matchedQueriesByPostId: result.matchedQueriesByPostId,
    };
  },
});

/**
 * Search LinkedIn and save prospects
 */
export const searchLinkedInInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    postQueries: v.array(v.string()),
    peopleQueries: v.array(v.string()),
    processingMode: v.optional(
      v.union(v.literal("normal"), v.literal("preview"))
    ),
    prospectOrigin: v.optional(
      v.union(
        v.literal("setup_preview"),
        v.literal("workspace_discovery"),
        v.literal("manual")
      )
    ),
    setupSessionId: v.optional(v.id("workspaceSetupSessions")),
    setupRevision: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    saved: number;
    postQueryStats: Array<{
      query: string;
      postsFound: number;
      success: boolean;
      error?: string;
    }>;
    peopleQueryStats: Array<{
      query: string;
      postsFound: number;
      success: boolean;
      error?: string;
    }>;
  }> => {
    // Get workspace for userId
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const [postResult, peopleResult] = await Promise.all([
      args.postQueries.length > 0
        ? ctx.runAction(api.integrations.linkedin.searchPosts.searchBatch, {
            queries: args.postQueries,
            sortBy: "relevance",
            maxQueriesPerBatch: 10,
          })
        : Promise.resolve({
            success: false,
            posts: [] as LinkedInPost[],
            matchedQueriesByPostId: {} as Record<string, string[]>,
            errors: [] as Array<{ query: string; error: string }>,
            queryStats: [] as Array<{
              query: string;
              postsFound: number;
              success: boolean;
              error?: string;
            }>,
            queryResults: [] as Array<{
              query: string;
              postsFound: number;
              searchMode: "plain_relevance" | "plain_date" | "exact_phrase";
            }>,
            stats: {
              queriesExecuted: 0,
              queriesSucceeded: 0,
              queriesFailed: 0,
              totalPostsFound: 0,
              uniquePosts: 0,
              durationMs: 0,
            },
          }),
      args.peopleQueries.length > 0
        ? ctx.runAction(api.integrations.linkedin.searchPeople.searchBatch, {
            queries: args.peopleQueries,
            maxQueriesPerBatch: 10,
          })
        : Promise.resolve({
            success: false,
            people: [] as LinkedInPerson[],
            matchedQueriesByPersonUrn: {} as Record<string, string[]>,
            errors: [] as Array<{ query: string; error: string }>,
            queryStats: [] as Array<{
              query: string;
              peopleFound: number;
              success: boolean;
              searchMode: "title" | "keyword";
              error?: string;
            }>,
            queryResults: [] as Array<{
              query: string;
              searchMode: "title" | "keyword";
              peopleFound: number;
            }>,
            stats: {
              queriesExecuted: 0,
              queriesSucceeded: 0,
              queriesFailed: 0,
              totalPeopleFound: 0,
              uniquePeople: 0,
              durationMs: 0,
            },
          }),
    ]);
    const postProspectsToSave = postResult.posts.map((post: LinkedInPost) => ({
      platform: "linkedin" as const,
      externalId: post.postID || "",
      data: post,
      matchedKeywords:
        postResult.matchedQueriesByPostId[post.postID]?.slice(0, 5) ?? [],
      matchReason: "Matched on LinkedIn post",
      discoverySource: "search_post" as const,
      discoveryContext: {
        matchedQueries:
          postResult.matchedQueriesByPostId[post.postID]?.slice(0, 5) ?? [],
        matchedReason: "Matched on LinkedIn post",
        discoverySnippet: post.text?.slice(0, 240),
        linkedinSurface: "posts" as const,
        linkedinHeadline: post.author?.headline,
        linkedinProfileUrl: post.author?.url,
      },
    }));

    const peopleProspectsToSave = peopleResult.people.map(
      (person: LinkedInPerson) => ({
        platform: "linkedin" as const,
        externalId: person.profileID || person.urn || person.url,
        data: person,
        matchedKeywords:
          peopleResult.matchedQueriesByPersonUrn[
            person.urn || person.profileID || person.url
          ]?.slice(0, 5) ?? [],
        matchReason: "Matched on LinkedIn title/headline",
        discoverySource: "search_people" as const,
        discoveryContext: {
          matchedQueries:
            peopleResult.matchedQueriesByPersonUrn[
              person.urn || person.profileID || person.url
            ]?.slice(0, 5) ?? [],
          matchedReason: "Matched on LinkedIn title/headline",
          discoverySnippet: person.headline,
          linkedinSurface: "people" as const,
          linkedinHeadline: person.headline,
          linkedinProfileUrl: person.url,
        },
      })
    );

    let totalSaved = 0;

    if (postProspectsToSave.length > 0) {
      const savePostResult = await ctx.runMutation(
        internal.prospects.createProspectsBatch,
        {
          userId: workspace.userId,
          workspaceId: args.workspaceId,
          processingMode: args.processingMode,
          prospects: postProspectsToSave.map(
            (prospect: (typeof postProspectsToSave)[number]) => ({
              ...prospect,
              origin: args.prospectOrigin,
              setupSessionId: args.setupSessionId,
              setupRevision: args.setupRevision,
            })
          ),
        }
      );
      totalSaved += savePostResult.created + savePostResult.updated;
    }

    if (peopleProspectsToSave.length > 0) {
      const savePeopleResult = await ctx.runMutation(
        internal.prospects.createProspectsBatch,
        {
          userId: workspace.userId,
          workspaceId: args.workspaceId,
          processingMode: args.processingMode,
          prospects: peopleProspectsToSave.map(
            (prospect: (typeof peopleProspectsToSave)[number]) => ({
              ...prospect,
              origin: args.prospectOrigin,
              setupSessionId: args.setupSessionId,
              setupRevision: args.setupRevision,
            })
          ),
        }
      );
      totalSaved += savePeopleResult.created + savePeopleResult.updated;

      if (args.processingMode !== "preview") {
        await Promise.all(
          savePeopleResult.prospectIds.map((prospectId: Id<"prospects">) =>
            ctx
              .runAction(internal.workflows.enrichment.startEnrichment, {
                prospectId: prospectId as Id<"prospects">,
                workspaceId: args.workspaceId,
              })
              .catch((error) => {
                prospectingWorkflowLogger.warn(
                  "Failed to eagerly enrich LinkedIn profile",
                  {
                    workspaceId: String(args.workspaceId),
                    workspaceName: workspace.name,
                    prospectId: String(prospectId),
                  },
                  error instanceof Error ? error : new Error(String(error))
                );
              })
          )
        );
      }
    }
    return {
      saved: totalSaved,
      postQueryStats: postResult.queryStats ?? [],
      peopleQueryStats: (peopleResult.queryStats ?? []).map(
        (item: {
          query: string;
          peopleFound: number;
          success: boolean;
          error?: string;
        }) => ({
          query: item.query,
          postsFound: item.peopleFound,
          success: item.success,
          error: item.error,
        })
      ),
    };
  },
});

type PreviewSimilarProfileStats = {
  seedUserId: string;
  seedScreenName?: string;
  success: boolean;
  usersFound: number;
  saved: number;
  error?: string;
};

type PreviewSimilarEvidenceStats = {
  screenName: string;
  success: boolean;
  postsFound: number;
  matchedKeywords: string[];
  error?: string;
};

function getTwitterUserId(user: TwitterUser | undefined): string | null {
  if (!user) {
    return null;
  }

  if (typeof user.id_str === "string" && user.id_str.trim().length > 0) {
    return user.id_str.trim();
  }

  if (typeof user.id === "number") {
    return String(user.id);
  }

  return null;
}

function getTwitterSeedUsers(posts: TwitterPost[]): TwitterUser[] {
  const seen = new Set<string>();
  const users: TwitterUser[] = [];

  for (const post of posts) {
    const userId = getTwitterUserId(post.user);
    if (!userId || seen.has(userId)) {
      continue;
    }

    seen.add(userId);
    users.push({
      ...post.user,
      id_str: userId,
    });
  }

  return users.slice(0, PREVIEW_BATCH_LIMITS.similarProfileSeedLimit);
}

function getPreviewEvidenceKeywords(workspace: Doc<"workspaces">): string[] {
  return dedupeQueries(
    (workspace.icps ?? []).flatMap((icp) => [
      icp.title,
      ...(icp.qualificationKeywords ?? []),
      ...icp.painPoints,
    ])
  ).slice(0, 12);
}

function findKeywordMatches(text: string, keywords: string[]): string[] {
  const normalizedText = text.toLowerCase();
  return keywords.filter((keyword) =>
    normalizedText.includes(keyword.toLowerCase())
  );
}

function getTwitterPostText(post: TwitterPost): string {
  return post.full_text ?? post.text ?? "";
}

async function expandPreviewSimilarProfiles(args: {
  ctx: ActionCtx;
  workspace: Doc<"workspaces">;
  sessionId: Id<"workspaceSetupSessions">;
  previewRevision: number;
  seedPosts: TwitterPost[];
  matchedQueriesByPostId: Record<string, string[]>;
}): Promise<{
  saved: number;
  similarStats: PreviewSimilarProfileStats[];
  evidenceStats: PreviewSimilarEvidenceStats[];
}> {
  const seedUsers = getTwitterSeedUsers(args.seedPosts);
  const evidenceKeywords = getPreviewEvidenceKeywords(args.workspace);
  const seenUserIds = new Set(
    seedUsers
      .map((user) => getTwitterUserId(user))
      .filter((userId): userId is string => Boolean(userId))
  );
  const seedQueriesByUserId = new Map<string, string[]>();

  for (const post of args.seedPosts) {
    const seedUserId = getTwitterUserId(post.user);
    if (!seedUserId) {
      continue;
    }

    seedQueriesByUserId.set(
      seedUserId,
      dedupeQueries([
        ...(seedQueriesByUserId.get(seedUserId) ?? []),
        ...(args.matchedQueriesByPostId[post.id_str] ?? []),
      ])
    );
  }

  const similarStats: PreviewSimilarProfileStats[] = [];
  const evidenceStats: PreviewSimilarEvidenceStats[] = [];
  const prospectsToSave: Array<{
    platform: "twitter";
    externalId: string;
    data: Record<string, unknown>;
    evidencePosts?: TwitterPost[];
    matchedKeywords?: string[];
    matchReason: string;
    discoverySource: "search_people";
    discoveryContext: {
      matchedQueries?: string[];
      matchedReason?: string;
      discoverySnippet?: string;
    };
    origin: "setup_preview";
    setupSessionId: Id<"workspaceSetupSessions">;
    setupRevision: number;
  }> = [];
  let evidenceProfilesSearched = 0;

  for (const seedUser of seedUsers) {
    const seedUserId = getTwitterUserId(seedUser);
    if (!seedUserId) {
      continue;
    }

    const similarResult = await args.ctx.runAction(
      api.integrations.twitter.similarProfiles.getSimilarProfiles,
      {
        userId: seedUserId,
      }
    );
    const similarUsers = similarResult.users.slice(
      0,
      PREVIEW_BATCH_LIMITS.similarProfilesPerSeed
    );
    let savedForSeed = 0;

    for (const similarUser of similarUsers) {
      const similarUserId = getTwitterUserId(similarUser);
      if (
        !similarUserId ||
        seenUserIds.has(similarUserId) ||
        similarUser.protected
      ) {
        continue;
      }

      seenUserIds.add(similarUserId);
      const screenName = similarUser.screen_name;
      let evidencePosts: TwitterPost[] = [];
      let evidenceMatchedKeywords: string[] = [];

      if (
        screenName &&
        evidenceKeywords.length > 0 &&
        evidenceProfilesSearched <
          PREVIEW_BATCH_LIMITS.similarProfileEvidenceProfiles
      ) {
        evidenceProfilesSearched += 1;
        const evidenceResult = await args.ctx.runAction(
          api.integrations.twitter.searchUserPosts.searchUserPosts,
          {
            screenName,
            keywords: evidenceKeywords,
            maxPosts:
              PREVIEW_BATCH_LIMITS.similarProfileEvidencePostsPerProfile,
          }
        );
        evidencePosts = evidenceResult.posts;
        evidenceMatchedKeywords = evidenceResult.matchedKeywords;
        evidenceStats.push({
          screenName,
          success: evidenceResult.success,
          postsFound: evidenceResult.posts.length,
          matchedKeywords: evidenceResult.matchedKeywords,
          error: evidenceResult.error,
        });
      }

      const profileMatches = findKeywordMatches(
        `${similarUser.name} ${similarUser.description ?? ""}`,
        evidenceKeywords
      );
      if (evidencePosts.length === 0 && profileMatches.length === 0) {
        continue;
      }

      const seedQueries = seedQueriesByUserId.get(seedUserId) ?? [];
      const matchedKeywords = dedupeQueries([
        ...evidenceMatchedKeywords,
        ...profileMatches,
        ...seedQueries,
      ]).slice(0, 8);
      const discoverySnippet =
        evidencePosts[0] != null
          ? getTwitterPostText(evidencePosts[0])
          : similarUser.description;
      const matchedReason = `Similar to @${seedUser.screen_name} from preview search`;

      prospectsToSave.push({
        platform: "twitter",
        externalId: similarUserId,
        data: {
          user: similarUser,
          similarProfile: {
            source: "socialapi_similar_profiles",
            seedUserId,
            seedScreenName: seedUser.screen_name,
          },
        },
        evidencePosts: evidencePosts.length > 0 ? evidencePosts : undefined,
        matchedKeywords,
        matchReason: matchedReason,
        discoverySource: "search_people",
        discoveryContext: {
          matchedQueries: matchedKeywords,
          matchedReason,
          discoverySnippet,
        },
        origin: "setup_preview",
        setupSessionId: args.sessionId,
        setupRevision: args.previewRevision,
      });
      savedForSeed += 1;
    }

    similarStats.push({
      seedUserId,
      seedScreenName: seedUser.screen_name,
      success: similarResult.success,
      usersFound: similarResult.users.length,
      saved: savedForSeed,
      error: similarResult.error,
    });
  }

  if (prospectsToSave.length === 0) {
    return {
      saved: 0,
      similarStats,
      evidenceStats,
    };
  }

  const saveResult = await args.ctx.runMutation(
    internal.prospects.createProspectsBatch,
    {
      userId: args.workspace.userId,
      workspaceId: args.workspace._id,
      processingMode: "preview",
      prospects: prospectsToSave,
    }
  );

  return {
    saved: saveResult.created + saveResult.updated,
    similarStats,
    evidenceStats,
  };
}

export const runPreviewDiscoveryBurstInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    sessionId: v.id("workspaceSetupSessions"),
    previewRevision: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    prospectsFound: number;
    twitterSaved: number;
    linkedinSaved: number;
    twitterQueryCount: number;
    linkedinPostQueryCount: number;
    linkedinPeopleQueryCount: number;
  }> => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace || !hasRequiredWorkspaceAgentData(workspace)) {
      return {
        prospectsFound: 0,
        twitterSaved: 0,
        linkedinSaved: 0,
        twitterQueryCount: 0,
        linkedinPostQueryCount: 0,
        linkedinPeopleQueryCount: 0,
      };
    }

    const allSyntheticPosts = workspace.icps.flatMap(
      (icp: { syntheticPosts?: string[] }) => icp.syntheticPosts || []
    );
    if (allSyntheticPosts.length === 0) {
      return {
        prospectsFound: 0,
        twitterSaved: 0,
        linkedinSaved: 0,
        twitterQueryCount: 0,
        linkedinPostQueryCount: 0,
        linkedinPeopleQueryCount: 0,
      };
    }

    const keywordsResult = await ctx.runAction(
      internal.agents.internal.generateProspectingKeywordsAction,
      {
        workspaceId: args.workspaceId,
        syntheticPosts: allSyntheticPosts,
        businessContext: workspace.improvedDescription,
        useCaseKey: workspace.useCaseKey,
        routing: "fast",
      }
    );
    if (!keywordsResult.success || !keywordsResult.prospectingKeywords) {
      throw new Error(
        keywordsResult.error || "Failed to generate preview keywords"
      );
    }

    const socialQueriesResult = await ctx.runAction(
      internal.agents.internal.convertToSocialQueriesAction,
      {
        workspaceId: args.workspaceId,
        keywords: keywordsResult.prospectingKeywords,
        platforms: ["twitter"],
        businessContext: workspace.improvedDescription,
        useCaseKey: workspace.useCaseKey,
      }
    );
    if (!socialQueriesResult.success || !socialQueriesResult.socialQueries) {
      throw new Error(
        socialQueriesResult.error || "Failed to generate preview queries"
      );
    }

    const socialQueries = socialQueriesResult.socialQueries.slice(
      0,
      BATCH_LIMITS.socialQueriesPerCycle
    );
    const queryMetadata =
      socialQueriesResult.queryMetadata?.filter((item: QueryMetadataRecord) =>
        socialQueries.includes(item.query)
      ) ??
      socialQueries.map((query: string) => ({
        query,
        platformTargets: ["twitter"] as Array<"twitter" | "linkedin">,
        queryStyle: "natural_phrase" as const,
        legacyCompatibilitySource: true,
      }));

    const noveltyScreening =
      queryMetadata.length > 0
        ? await ctx.runAction(
            internal.memory.screenDiscoveryQueryCandidatesInternal,
            {
              workspaceId: args.workspaceId,
              candidates: queryMetadata.map((item: QueryMetadataRecord) => ({
                rawValue: item.query,
                sourceTheme: item.sourceKeyword,
              })),
            }
          )
        : { accepted: [] as Array<{ rawValue: string }> };

    const acceptedQueries = noveltyScreening.accepted.map(
      (candidate: { rawValue: string }) => candidate.rawValue
    );
    const acceptedQuerySet = new Set(
      acceptedQueries.length > 0 ? acceptedQueries : socialQueries
    );

    const fallbackMetadata = queryMetadata.filter((item: QueryMetadataRecord) =>
      acceptedQuerySet.has(item.query)
    );
    const twitterQueries = dedupeQueries([
      ...(socialQueriesResult.queriesByPlatform?.twitter ?? []).filter(
        (query: string) => acceptedQuerySet.has(query)
      ),
      ...fallbackMetadata
        .filter((item: QueryMetadataRecord) =>
          item.platformTargets.includes("twitter")
        )
        .map((item: QueryMetadataRecord) => item.query),
    ]).slice(0, PREVIEW_BATCH_LIMITS.twitterSearchBatch);
    const twitterQueryKeys = new Set(
      twitterQueries.map((query) => query.toLowerCase())
    );
    const twitterGraphSeedQueries = buildPreviewTwitterRawGraphSeedQueries(
      workspace,
      {
        sinceTimestampSeconds: getPreviewGraphSeedSinceTimestampSeconds(),
      }
    )
      .filter((query) => !twitterQueryKeys.has(query.toLowerCase()))
      .slice(0, PREVIEW_BATCH_LIMITS.twitterGraphSeedSearchBatch);

    const runPreviewTwitterSearch = async (
      queries: string[],
      label: string,
      searchMode: TwitterSearchMode = "exact"
    ): Promise<TwitterSearchResult> => {
      if (queries.length === 0) {
        return createEmptyTwitterSearchResult();
      }

      return await ctx
        .runAction(internal.workflows.prospecting.searchTwitterInternal, {
          workspaceId: args.workspaceId,
          queries,
          processingMode: "preview",
          prospectOrigin: "setup_preview",
          setupSessionId: args.sessionId,
          setupRevision: args.previewRevision,
          searchMode,
        })
        .catch((error) => {
          prospectingWorkflowLogger.error(
            "Preview Twitter search failed",
            {
              workspaceId: String(args.workspaceId),
              workspaceName: workspace.name,
              previewRevision: args.previewRevision,
              label,
              searchMode,
            },
            error
          );
          return createEmptyTwitterSearchResult();
        });
    };

    const [primaryTwitterResult, graphSeedTwitterResult] = await Promise.all([
      runPreviewTwitterSearch(twitterQueries, "Twitter search"),
      runPreviewTwitterSearch(
        twitterGraphSeedQueries,
        "Twitter graph seed search",
        "raw"
      ),
    ]);
    const twitterResult = mergeTwitterSearchResults([
      primaryTwitterResult,
      graphSeedTwitterResult,
    ]);

    const similarExpansion =
      twitterResult.posts.length > 0
        ? await expandPreviewSimilarProfiles({
            ctx,
            workspace,
            sessionId: args.sessionId,
            previewRevision: args.previewRevision,
            seedPosts: twitterResult.posts,
            matchedQueriesByPostId: twitterResult.matchedQueriesByPostId,
          }).catch((error) => {
            prospectingWorkflowLogger.error(
              "Preview similar-profile expansion failed",
              {
                workspaceId: String(args.workspaceId),
                workspaceName: workspace.name,
                previewRevision: args.previewRevision,
              },
              error
            );
            return {
              saved: 0,
              similarStats: [] as PreviewSimilarProfileStats[],
              evidenceStats: [] as PreviewSimilarEvidenceStats[],
            };
          })
        : {
            saved: 0,
            similarStats: [] as PreviewSimilarProfileStats[],
            evidenceStats: [] as PreviewSimilarEvidenceStats[],
          };

    const prospectsFound = twitterResult.saved + similarExpansion.saved;
    const recordedAt = getCurrentUTCTimestamp();
    await ctx
      .runMutation(internal.memory.recordMemoryWorkflowEventInternal, {
        workspaceId: args.workspaceId,
        eventType: "query_search_executed",
        sourceType: "workflow_event",
        sourceId: `setup-preview:${args.sessionId}:${args.previewRevision}:${recordedAt}`,
        workflowName: "previewWorkflow",
        payload: {
          mode: "setup_preview",
          sessionId: String(args.sessionId),
          previewRevision: args.previewRevision,
          generatedSocialQueries: socialQueries.length,
          acceptedQueries: acceptedQueries.length,
          twitterQueries,
          twitterGraphSeedQueries,
          twitterPrimarySearchMode: "exact",
          twitterGraphSeedSearchMode: "raw",
          twitterQueryStats: twitterResult.queryStats,
          twitterPrimaryQueryStats: primaryTwitterResult.queryStats,
          twitterGraphSeedQueryStats: graphSeedTwitterResult.queryStats,
          twitterPrimaryPostsFound: primaryTwitterResult.posts.length,
          twitterGraphSeedPostsFound: graphSeedTwitterResult.posts.length,
          twitterPostsFound: twitterResult.posts.length,
          twitterSaved: twitterResult.saved,
          twitterPrimarySaved: primaryTwitterResult.saved,
          twitterGraphSeedSaved: graphSeedTwitterResult.saved,
          similarProfilesSaved: similarExpansion.saved,
          similarProfileStats: similarExpansion.similarStats,
          similarProfileEvidenceStats: similarExpansion.evidenceStats,
          prospectsFound,
        },
        eventKey: `setup-preview-search:${args.sessionId}:${args.previewRevision}:${recordedAt}`,
      })
      .catch((error) => {
        prospectingWorkflowLogger.warn(
          "Failed to record preview search debug event",
          {
            workspaceId: String(args.workspaceId),
            workspaceName: workspace.name,
            sessionId: String(args.sessionId),
            previewRevision: args.previewRevision,
          },
          error
        );
      });

    return {
      prospectsFound,
      twitterSaved: prospectsFound,
      linkedinSaved: 0,
      twitterQueryCount: twitterQueries.length + twitterGraphSeedQueries.length,
      linkedinPostQueryCount: 0,
      linkedinPeopleQueryCount: 0,
    };
  },
});

// Note: qualifyProspectsInternal REMOVED
// Qualification now happens automatically per-prospect via streaming workflows
// triggered immediately when prospects are saved (see workflows/qualification.ts)

// ============================================================================
// Workflow Scheduling (for continuous 24/7 operation)
// ============================================================================

/**
 * Schedule the next prospecting workflow run.
 * Called by onComplete handler or manually.
 */
export const startNextCycle = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<void> => {
    // Check if workflow should continue
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      return;
    }

    // Only continue if status is still "running"
    if (workspace.prospectingWorkflowStatus !== "running") {
      return;
    }

    if (isWorkspaceInactive(workspace)) {
      await ctx.runMutation(
        internal.workflows.prospecting.updateWorkflowStatus,
        {
          workspaceId: args.workspaceId,
          status: "paused",
          pauseReason: "inactive",
        }
      );
      return;
    }

    // Start the workflow
    const workflowId = await workflow.start(
      ctx,
      internal.workflows.prospecting.prospectingWorkflow,
      { workspaceId: args.workspaceId },
      {
        onComplete: internal.workflows.prospecting.handleWorkflowComplete,
        context: { workspaceId: args.workspaceId },
      }
    );

    // Update workflow ID
    await ctx.runMutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId: args.workspaceId,
      status: "running",
      workflowId: workflowId.toString(),
    });
  },
});

/**
 * Handle workflow completion - schedule next run if shouldContinue
 */
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";

export const handleWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(),
  },
  handler: async (ctx, args) => {
    const workspaceId = (args.context as { workspaceId: string }).workspaceId;
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: workspaceId as any,
    });

    if (args.result.kind === "success") {
      const returnValue = args.result.returnValue as {
        status: string;
        shouldContinue: boolean;
        prospectsFound?: number;
        twitterSaved?: number;
        linkedinSaved?: number;
      };

      if ((returnValue.prospectsFound ?? 0) > 0 && workspace) {
        await ctx.runMutation(
          internal.outreach.createProspectsFoundNotification,
          {
            workspaceId: workspace._id,
            workflowId: String(args.workflowId),
            prospectsFound: returnValue.prospectsFound ?? 0,
            twitterSaved: returnValue.twitterSaved ?? 0,
            linkedinSaved: returnValue.linkedinSaved ?? 0,
          }
        );
      }

      if (returnValue.shouldContinue) {
        if (!shouldAutoRescheduleProspecting()) {
        } else if (workspace && isWorkspaceInactive(workspace)) {
          await ctx.runMutation(
            internal.workflows.prospecting.updateWorkflowStatus,
            {
              workspaceId: workspaceId as any,
              status: "paused",
              pauseReason: "inactive",
            }
          );
        } else if (workspace) {
          const delayMs = getProspectingRescheduleDelayMs();
          const nextRunAt = getCurrentUTCTimestamp() + delayMs;
          await ctx.db.patch(workspace._id, {
            prospectingNextRunAt: nextRunAt,
            prospectingNextRecoveryAt: undefined,
          });
          // Schedule next run
          await ctx.scheduler.runAfter(
            delayMs,
            internal.workflows.prospecting.startNextCycle,
            { workspaceId: workspaceId as any }
          );
        }
      }
    } else if (args.result.kind === "failed") {
      const workspaceDoc = await ctx.db.get(workspaceId as Id<"workspaces">);
      prospectingWorkflowLogger.error(
        "Workflow failed",
        {
          workspaceId: String(workspaceId),
          workspaceName: workspaceDoc?.name ?? workspace?.name,
          workflowId: String(args.workflowId),
        },
        args.result.error
      );

      if (!workspaceDoc) {
        return;
      }

      const now = getCurrentUTCTimestamp();
      const failureStreak = Math.max(
        1,
        (workspaceDoc.prospectingFailureStreak ?? 0) + 1
      );
      const recoveryAttemptId =
        Math.max(0, workspaceDoc.prospectingRecoveryAttemptId ?? 0) + 1;
      const delayMs = getProspectingRecoveryDelayMs({
        workspaceId: String(workspaceDoc._id),
        failureStreak,
      });
      const nextRecoveryAt = now + delayMs;

      await ctx.db.patch(workspaceDoc._id, {
        prospectingWorkflowStatus: "stopped",
        onboardingIssueStatusCode: "workflow_failed",
        onboardingIssueSource: "workflow",
        onboardingIssueUpdatedAt: now,
        prospectingFailureStreak: failureStreak,
        prospectingRecoveryAttemptId: recoveryAttemptId,
        prospectingLastFailureAt: now,
        prospectingNextRunAt: undefined,
        prospectingNextRecoveryAt: nextRecoveryAt,
      });

      await ctx.scheduler.runAfter(
        delayMs,
        internal.workspaces.attemptProspectingWorkflowRecoveryInternal,
        {
          workspaceId: workspaceId as any,
          recoveryAttemptId,
        }
      );
    }
  },
});
