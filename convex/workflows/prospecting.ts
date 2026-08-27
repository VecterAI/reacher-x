// convex/workflows/prospecting.ts
// Continuous 24/7 prospecting workflow using Convex Workflow component
//
// This workflow runs one complete prospecting cycle per workspace:
// 1. Check prospect limit vs tier → STOP if exceeded
// 2. Generate new seed keywords (AI)
// 3. Send to Bishopi (keyword discovery)
// 4. Convert to social queries (AI)
// 5. Search Twitter with bounded performance-based query reuse
// 6. Search LinkedIn posts + people with the same adaptive policy
// 7. Save prospects
// 8. Qualify new prospects
// 9. Complete and schedule next run via onComplete handler

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
  buildDiscoveryBusinessContext,
  buildPreviewTwitterRawGraphSeedQueries,
  checkProspectLimit,
  formatQualifiedProspectLimitReachedMessage,
  getProspectingRecoveryDelayMs,
} from "../lib/prospectingHelpers";
import { decideProspectingSchedule } from "../lib/prospectingSchedulingCore";
import {
  chunkLinkedInItems,
  chunkLinkedInProspectsForSave,
  LINKEDIN_PEOPLE_DEFAULT_COUNT,
  normalizeLinkedInPostQueryStats,
} from "../lib/linkedinSearchHelpers";
import { PREVIEW_BATCH_LIMITS } from "../lib/previewBatchLimits";
import { chunkProspectsForPersistence } from "../lib/prospectPersistenceHelpers";
import { hasRequiredWorkspaceAgentData } from "../lib/workspaceSetup";
import type {
  TwitterPost,
  TwitterUser,
} from "../integrations/twitter/searchPosts";
import type { LinkedInPost } from "../integrations/linkedin/searchPosts";
import type { LinkedInPerson } from "../integrations/linkedin/searchPeople";
import {
  prospectingBootstrapCompletionReasonValidator,
  prospectingCycleStatusValidator,
  prospectPlatformValidator,
  prospectingWorkflowPauseReasonValidator,
  twitterProspectingSearchModeValidator,
  workspaceWorkflowStatusValidator,
} from "../validators";
import { logger } from "../../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { isWorkspaceInactive } from "../lib/workspaceSystem";
import { getSystemRuntimeConfig } from "../lib/runtimeConfigHelpers";
import {
  getTwitterExactFallbackQueries,
  mergeTwitterProspectingSearchResults,
  partitionTwitterProspectingQueries,
  stripTwitterExactPhraseQuotes,
  type TwitterQueryStat,
  type TwitterProspectingSearchMode,
} from "../lib/twitterProspectingSearchCore";
import {
  getWorkflowEvidencePostId,
  getWorkflowEvidencePostText,
  sanitizeProspectDataForWorkflow,
  sanitizeProspectEvidencePostsForWorkflow,
  sanitizeWorkflowString,
  sanitizeWorkflowValue,
} from "../lib/workflowSafeProspect";
import {
  buildProspectingCycleOutcome,
  type ProspectingPlatform,
} from "../lib/prospectingCycleCore";
import { stringifyUnknownError } from "../lib/errorHelpers";

type QueryMetadataRecord = {
  query: string;
  sourceKeyword?: string;
  platformTargets: Array<"twitter" | "linkedin">;
  linkedinSurface?: "posts" | "people";
  linkedinSurfaceTargets?: Array<"posts" | "people">;
  queryStyle: "natural_phrase" | "professional_keyword" | "role_title";
  twitterSearchMode?: TwitterProspectingSearchMode;
  legacyCompatibilitySource: boolean;
};

type LinkedInQueueItem = {
  id: Id<"keywords">;
  value: string;
};

type TwitterQueueItem = {
  id: Id<"keywords">;
  value: string;
  searchMode: TwitterProspectingSearchMode;
};

type TwitterSearchResult = {
  saved: number;
  queryStats: TwitterQueryStat[];
  posts: TwitterPost[];
  matchedQueriesByPostId: Record<string, string[]>;
  exactFallbackQueries: string[];
  primaryQueryStats: TwitterQueryStat[];
  graphSeedQueryStats: TwitterQueryStat[];
  primaryPostsFound: number;
  graphSeedPostsFound: number;
};

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
    exactFallbackQueries: [],
    primaryQueryStats: [],
    graphSeedQueryStats: [],
    primaryPostsFound: 0,
    graphSeedPostsFound: 0,
  };
}

function getPreviewGraphSeedSinceTimestampSeconds() {
  return Math.floor(
    (getCurrentUTCTimestamp() - PREVIEW_GRAPH_SEED_LOOKBACK_MS) / 1000
  );
}

function normalizeTwitterSearchResultQueries(
  result: TwitterSearchResult,
  searchMode: TwitterProspectingSearchMode
): TwitterSearchResult {
  if (searchMode !== "exact") {
    return result;
  }

  return {
    ...result,
    queryStats: result.queryStats.map((stat) => ({
      ...stat,
      query: stripTwitterExactPhraseQuotes(stat.query),
    })),
    matchedQueriesByPostId: Object.fromEntries(
      Object.entries(result.matchedQueriesByPostId).map(([postId, queries]) => [
        postId,
        dedupeQueries(queries.map(stripTwitterExactPhraseQuotes)),
      ])
    ),
  };
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
    failedPlatforms: v.optional(v.array(prospectPlatformValidator)),
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
    failedPlatforms?: ProspectingPlatform[];
    shouldContinue: boolean;
  }> => {
    const workflowSourceId = String(step.workflowId);
    const runtimeConfig = getSystemRuntimeConfig().prospecting;
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
        businessContext: buildDiscoveryBusinessContext(workspace),
        useCaseKey: workspace.useCaseKey,
      },
      { retry: runtimeConfig.retries.ai }
    );

    if (!keywordsResult.success || !keywordsResult.prospectingKeywords) {
      throw new Error(keywordsResult.error || "Failed to generate keywords");
    }

    const prospectingKeywords = keywordsResult.prospectingKeywords.slice(
      0,
      runtimeConfig.batch.seedKeywordsPerCycle
    );

    // Step 5: Convert to social queries
    const socialQueriesResult = await step.runAction(
      internal.agents.internal.convertToSocialQueriesAction,
      {
        workspaceId: args.workspaceId,
        keywords: prospectingKeywords,
        platforms: ["twitter", "linkedin"],
        businessContext: buildDiscoveryBusinessContext(workspace),
        useCaseKey: workspace.useCaseKey,
      },
      { retry: runtimeConfig.retries.ai }
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
      runtimeConfig.batch.socialQueriesPerCycle
    );
    const queryMetadata: QueryMetadataRecord[] =
      socialQueriesResult.queryMetadata?.filter((item: QueryMetadataRecord) =>
        socialQueries.includes(item.query)
      ) ?? [];
    const candidateInputs: Array<{ rawValue: string; sourceTheme?: string }> =
      queryMetadata
        .slice(0, runtimeConfig.batch.socialQueriesPerCycle)
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
        seedKeywords: prospectingKeywords,
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
          const twitterQueue = await step.runQuery(
            internal.keywords.getPrioritizedTwitterQueries,
            {
              workspaceId: args.workspaceId,
              limit: runtimeConfig.batch.twitterSearchBatch,
            }
          );

          if (twitterQueue.length > 0) {
            const typedTwitterQueue: TwitterQueueItem[] = twitterQueue.map(
              (query) => ({
                id: query.id,
                value: query.value,
                searchMode: query.searchMode ?? "raw",
              })
            );
            const partitionedQueries = partitionTwitterProspectingQueries(
              typedTwitterQueue.map((query) => ({
                query: query.value,
                searchMode: query.searchMode,
              }))
            );
            const result = await step.runAction(
              internal.workflows.prospecting.searchTwitterInternal,
              {
                workspaceId: args.workspaceId,
                exactQueries: partitionedQueries.exact,
                rawQueries: partitionedQueries.raw,
              },
              { retry: runtimeConfig.retries.provider }
            );

            // Mark queries as searched
            await step.runMutation(internal.keywords.markQueriesAsSearched, {
              queryIds: typedTwitterQueue.map((query) => query.id),
              platform: "twitter",
              resultsCount: result.saved,
              queryStats: result.queryStats,
            });

            return { ...result, platformFailed: false };
          }
          return {
            platformFailed: false,
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
            platformFailed: true,
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
              limit: runtimeConfig.batch.linkedinPostSearchBatch,
            }),
            step.runQuery(internal.keywords.getPrioritizedLinkedInQueries, {
              workspaceId: args.workspaceId,
              surface: "people",
              limit: runtimeConfig.batch.linkedinPeopleSearchBatch,
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
              { retry: runtimeConfig.retries.provider }
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

            if (!result.success) {
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
                "LinkedIn search completed with persistence errors",
                {
                  workspaceId: String(args.workspaceId),
                  workspaceName: workspace.name,
                  linkedinSaved: result.saved,
                  error: result.error,
                }
              );
            }

            return result;
          }
          return {
            success: true,
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
            success: false,
            error: stringifyUnknownError(err),
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
    const failedPlatforms: ProspectingPlatform[] = [];

    if (twitterResult.platformFailed) {
      failedPlatforms.push("twitter");
    }
    if (!linkedinResult.success) {
      failedPlatforms.push("linkedin");
    }

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
          { retry: runtimeConfig.retries.auxiliary }
        );
        promotedSeedCount = promotionResult.createdOrUpdated;

        if (promotionResult.seedIds.length > 0) {
          await step.runAction(
            internal.xConversationDiscovery
              .initialBackfillConversationSeedsInternal,
            {
              seedIds: promotionResult.seedIds,
            },
            { retry: runtimeConfig.retries.auxiliary }
          );

          await step.runAction(
            internal.xConversationDiscovery
              .createConversationSeedMonitorsInternal,
            {
              workspaceId: args.workspaceId,
              seedIds: promotionResult.seedIds,
            },
            { retry: runtimeConfig.retries.auxiliary }
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

    // Note: Qualification now happens automatically per-prospect via streaming workflows
    // triggered immediately when prospects are saved (no batch step needed)

    const outcome = buildProspectingCycleOutcome({
      twitterSaved,
      linkedinSaved,
      failedPlatforms,
    });

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
      eventType:
        outcome.status === "error"
          ? "prospecting_cycle_failed"
          : "prospecting_cycle_completed",
      sourceType: "workflow_event",
      sourceId: workflowSourceId,
      workflowName: "prospectingWorkflow",
      payload: {
        prospectsFound: outcome.prospectsFound,
        twitterSaved,
        linkedinSaved,
        failedPlatforms,
        promotedSeedCount,
        generatedQueryCount: socialQueries.length,
        acceptedQueryCount: acceptedSocialQueries.length,
        exactDuplicateCount: noveltyScreening.counts.exactDuplicates,
        semanticDuplicateCount: noveltyScreening.counts.semanticDuplicates,
      },
      eventKey: `prospecting:${workflowSourceId}:${
        outcome.status === "error" ? "failed" : "completed"
      }`,
    });

    return outcome;
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
          twitterSearchMode: v.optional(twitterProspectingSearchModeValidator),
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
      twitterSearchMode?: TwitterProspectingSearchMode;
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
        twitterSearchMode: metadata?.twitterSearchMode,
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
 * Search Twitter, deduplicate all search paths, and save prospects.
 */
export const searchTwitterInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    exactQueries: v.array(v.string()),
    rawQueries: v.array(v.string()),
    graphSeedQueries: v.optional(v.array(v.string())),
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
  handler: async (ctx, args): Promise<TwitterSearchResult> => {
    // Get workspace for userId
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const runProviderSearch = async (
      queries: string[],
      searchMode: TwitterProspectingSearchMode
    ): Promise<TwitterSearchResult> => {
      if (queries.length === 0) {
        return createEmptyTwitterSearchResult();
      }

      const providerResult =
        searchMode === "raw"
          ? await ctx.runAction(
              api.integrations.twitter.searchPosts.searchRawBatch,
              {
                queries,
                type: "Latest",
                maxQueriesPerBatch: 10,
              }
            )
          : await ctx.runAction(
              api.integrations.twitter.searchPosts.searchBatch,
              {
                queries,
                type: "Latest",
                maxQueriesPerBatch: 10,
              }
            );
      const result = normalizeTwitterSearchResultQueries(
        {
          ...createEmptyTwitterSearchResult(),
          queryStats: providerResult.queryStats ?? [],
          posts: providerResult.posts ?? [],
          matchedQueriesByPostId: providerResult.matchedQueriesByPostId ?? {},
        },
        searchMode
      );

      if (!providerResult.success) {
        return {
          ...result,
          posts: [],
          matchedQueriesByPostId: {},
        };
      }

      return result;
    };

    const [exactResult, rawResult, graphSeedResult] = await Promise.all([
      runProviderSearch(args.exactQueries, "exact"),
      runProviderSearch(args.rawQueries, "raw"),
      runProviderSearch(args.graphSeedQueries ?? [], "raw"),
    ]);
    const exactFallbackQueries = getTwitterExactFallbackQueries(
      exactResult.queryStats
    );
    const exactFallbackResult = await runProviderSearch(
      exactFallbackQueries,
      "raw"
    );
    const primaryResult = mergeTwitterProspectingSearchResults([
      exactResult,
      rawResult,
      exactFallbackResult,
    ]);
    const mergedResult = mergeTwitterProspectingSearchResults([
      primaryResult,
      graphSeedResult,
    ]);
    const result: TwitterSearchResult = {
      ...mergedResult,
      saved: 0,
      exactFallbackQueries,
      primaryQueryStats: primaryResult.queryStats,
      graphSeedQueryStats: graphSeedResult.queryStats,
      primaryPostsFound: primaryResult.posts.length,
      graphSeedPostsFound: graphSeedResult.posts.length,
    };

    if (result.posts.length === 0) {
      return result;
    }

    // Transform and save prospects
    const fallbackQueries = dedupeQueries([
      ...args.exactQueries.map(stripTwitterExactPhraseQuotes),
      ...args.rawQueries,
      ...(args.graphSeedQueries ?? []),
    ]).slice(0, 5);
    const prospectsToSave = result.posts.map((post: TwitterPost) => ({
      platform: "twitter" as const,
      externalId: post.id_str,
      data: post,
      matchedKeywords:
        result.matchedQueriesByPostId[post.id_str]?.slice(0, 5) ??
        fallbackQueries,
      discoverySource: "search_post" as const,
      discoveryContext: {
        matchedQueries:
          result.matchedQueriesByPostId[post.id_str]?.slice(0, 5) ??
          fallbackQueries,
        matchedReason: "Matched on X post",
        discoverySnippet: getTwitterPostText(post).slice(0, 240),
      },
    }));

    let saved = 0;
    for (const batch of chunkProspectsForPersistence(prospectsToSave)) {
      const saveResult = await ctx.runMutation(
        internal.prospects.createProspectsBatch,
        {
          userId: workspace.userId,
          workspaceId: args.workspaceId,
          processingMode: args.processingMode,
          prospects: batch.map(
            (prospect: (typeof prospectsToSave)[number]) => ({
              ...prospect,
              origin: args.prospectOrigin,
              setupSessionId: args.setupSessionId,
              setupRevision: args.setupRevision,
            })
          ),
        }
      );
      saved += saveResult.created + saveResult.updated;
    }

    return {
      ...result,
      saved,
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
    success: boolean;
    error?: string;
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

    const [postSettlement, peopleSettlement] = await Promise.allSettled([
      args.postQueries.length > 0
        ? ctx.runAction(api.integrations.linkedin.searchPosts.searchBatch, {
            queries: args.postQueries,
            sortBy: "relevance",
            maxQueriesPerBatch: 10,
          })
        : Promise.resolve(null),
      args.peopleQueries.length > 0
        ? ctx.runAction(api.integrations.linkedin.searchPeople.searchBatch, {
            queries: args.peopleQueries,
            count: LINKEDIN_PEOPLE_DEFAULT_COUNT,
            maxQueriesPerBatch: 10,
          })
        : Promise.resolve(null),
    ]);
    const postResult =
      postSettlement.status === "fulfilled" ? postSettlement.value : null;
    const peopleResult =
      peopleSettlement.status === "fulfilled" ? peopleSettlement.value : null;
    const postProviderError =
      postSettlement.status === "rejected"
        ? sanitizeWorkflowString(stringifyUnknownError(postSettlement.reason))
        : undefined;
    const peopleProviderError =
      peopleSettlement.status === "rejected"
        ? sanitizeWorkflowString(stringifyUnknownError(peopleSettlement.reason))
        : undefined;

    type LinkedInProspectToSave = {
      platform: "linkedin";
      externalId: string;
      data: Record<string, unknown>;
      evidencePosts?: Array<Record<string, unknown>>;
      matchedKeywords: string[];
      matchReason: string;
      discoverySource: "search_post" | "search_people";
      discoveryContext: {
        matchedQueries: string[];
        matchedReason: string;
        discoverySnippet?: string;
        linkedinSurface: "posts" | "people";
        linkedinHeadline?: string;
        linkedinProfileUrl?: string;
      };
    };

    const postProspectsToSave: LinkedInProspectToSave[] = (
      postResult?.posts ?? []
    ).flatMap((post: LinkedInPost) => {
      const evidencePosts = sanitizeProspectEvidencePostsForWorkflow(
        [post],
        "linkedin"
      );
      const evidencePost = evidencePosts[0];
      const externalId = evidencePost
        ? getWorkflowEvidencePostId(evidencePost)
        : undefined;
      if (!evidencePost || !externalId) {
        return [];
      }

      const matchedQueries = (
        postResult?.matchedQueriesByPostId[post.postID] ?? []
      )
        .slice(0, 5)
        .map(sanitizeWorkflowString);
      const data = sanitizeProspectDataForWorkflow(
        { author: post.author },
        "linkedin"
      );
      const author =
        data.author && typeof data.author === "object"
          ? (data.author as Record<string, unknown>)
          : undefined;

      return [
        {
          platform: "linkedin" as const,
          externalId,
          data,
          evidencePosts,
          matchedKeywords: matchedQueries,
          matchReason: "Matched on LinkedIn post",
          discoverySource: "search_post" as const,
          discoveryContext: {
            matchedQueries,
            matchedReason: "Matched on LinkedIn post",
            discoverySnippet: getWorkflowEvidencePostText(evidencePost).slice(
              0,
              240
            ),
            linkedinSurface: "posts" as const,
            linkedinHeadline:
              typeof author?.headline === "string"
                ? author.headline
                : undefined,
            linkedinProfileUrl:
              typeof author?.url === "string" ? author.url : undefined,
          },
        },
      ];
    });

    const peopleProspectsToSave: LinkedInProspectToSave[] = (
      peopleResult?.people ?? []
    ).flatMap((person: LinkedInPerson) => {
      const data = sanitizeProspectDataForWorkflow(person, "linkedin");
      const externalId = [data.id, data.urn, data.url, data.linkedinUrl].find(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      );
      if (!externalId) {
        return [];
      }

      const providerKey = person.urn || person.profileID || person.url;
      const matchedQueries = (
        peopleResult?.matchedQueriesByPersonUrn[providerKey] ?? []
      )
        .slice(0, 5)
        .map(sanitizeWorkflowString);
      const headline =
        typeof data.headline === "string" ? data.headline : undefined;
      const profileUrl =
        typeof data.url === "string"
          ? data.url
          : typeof data.linkedinUrl === "string"
            ? data.linkedinUrl
            : undefined;

      return [
        {
          platform: "linkedin" as const,
          externalId,
          data,
          matchedKeywords: matchedQueries,
          matchReason: "Matched on LinkedIn title/headline",
          discoverySource: "search_people" as const,
          discoveryContext: {
            matchedQueries,
            matchedReason: "Matched on LinkedIn title/headline",
            discoverySnippet: headline,
            linkedinSurface: "people" as const,
            linkedinHeadline: headline,
            linkedinProfileUrl: profileUrl,
          },
        },
      ];
    });

    let totalSaved = 0;
    const savedPeopleProspectIds: Id<"prospects">[] = [];
    const persistenceErrors: string[] = [];
    const failedPersistenceSurfaces = new Set<"posts" | "people">();

    const saveProspectBatches = async (
      surface: "posts" | "people",
      prospects: LinkedInProspectToSave[]
    ) => {
      for (const batch of chunkLinkedInProspectsForSave(prospects)) {
        try {
          const saveResult = await ctx.runMutation(
            internal.prospects.createProspectsBatch,
            {
              userId: workspace.userId,
              workspaceId: args.workspaceId,
              processingMode: args.processingMode,
              prospects: batch.map((prospect) =>
                sanitizeWorkflowValue({
                  ...prospect,
                  origin: args.prospectOrigin,
                  setupSessionId: args.setupSessionId,
                  setupRevision: args.setupRevision,
                })
              ),
            }
          );
          totalSaved += saveResult.created + saveResult.updated;
          if (surface === "people") {
            savedPeopleProspectIds.push(...saveResult.prospectIds);
          }
        } catch (error) {
          failedPersistenceSurfaces.add(surface);
          persistenceErrors.push(
            sanitizeWorkflowString(
              `LinkedIn ${surface} save failed: ${stringifyUnknownError(error)}`
            )
          );
          break;
        }
      }
    };

    await saveProspectBatches("posts", postProspectsToSave);
    await saveProspectBatches("people", peopleProspectsToSave);

    if (
      args.processingMode !== "preview" &&
      savedPeopleProspectIds.length > 0
    ) {
      const enrichmentEnqueueBatchSize =
        getSystemRuntimeConfig().workpools.enrichment.maxParallelism;
      for (const prospectIds of chunkLinkedInItems(
        savedPeopleProspectIds,
        enrichmentEnqueueBatchSize
      )) {
        await Promise.all(
          prospectIds.map((prospectId: Id<"prospects">) =>
            ctx
              .runAction(internal.workflows.enrichment.startEnrichment, {
                prospectId,
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

    const postSearchSucceeded =
      args.postQueries.length === 0 ||
      (postSettlement.status === "fulfilled" && postResult?.success === true);
    const peopleSearchSucceeded =
      args.peopleQueries.length === 0 ||
      (peopleSettlement.status === "fulfilled" &&
        peopleResult?.success === true);
    const postPersistenceError = failedPersistenceSurfaces.has("posts")
      ? "LinkedIn post results could not be saved"
      : undefined;
    const peoplePersistenceError = failedPersistenceSurfaces.has("people")
      ? "LinkedIn people results could not be saved"
      : undefined;
    const postQueryStats = normalizeLinkedInPostQueryStats(
      (
        postResult?.queryStats ??
        args.postQueries.map((query) => ({
          query,
          postsFound: 0,
          success: false,
          error: postProviderError ?? "LinkedIn post search failed",
        }))
      ).map((stat) => ({
        query: sanitizeWorkflowString(stat.query),
        postsFound: stat.postsFound,
        success: stat.success,
        error: stat.error ? sanitizeWorkflowString(stat.error) : undefined,
      })),
      postPersistenceError
    );
    const peopleQueryStats = (
      peopleResult?.queryStats ??
      args.peopleQueries.map((query) => ({
        query,
        peopleFound: 0,
        success: false,
        error: peopleProviderError ?? "LinkedIn people search failed",
      }))
    ).map((item) => ({
      query: sanitizeWorkflowString(item.query),
      postsFound: item.peopleFound,
      success: peoplePersistenceError ? false : item.success,
      error:
        peoplePersistenceError ??
        (item.error ? sanitizeWorkflowString(item.error) : undefined),
    }));
    const errors = [
      postProviderError,
      peopleProviderError,
      ...(postResult?.success === false
        ? postResult.errors.map(({ error }) => sanitizeWorkflowString(error))
        : []),
      ...(peopleResult?.success === false
        ? peopleResult.errors.map(({ error }) => sanitizeWorkflowString(error))
        : []),
      ...persistenceErrors,
    ].filter((error): error is string => Boolean(error));
    const success =
      postSearchSucceeded &&
      peopleSearchSucceeded &&
      persistenceErrors.length === 0;

    return {
      success,
      error: errors.length > 0 ? errors.join("; ") : undefined,
      saved: totalSaved,
      postQueryStats,
      peopleQueryStats,
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

  let saved = 0;
  for (const batch of chunkProspectsForPersistence(prospectsToSave)) {
    const saveResult = await args.ctx.runMutation(
      internal.prospects.createProspectsBatch,
      {
        userId: args.workspace.userId,
        workspaceId: args.workspace._id,
        processingMode: "preview",
        prospects: batch,
      }
    );
    saved += saveResult.created + saveResult.updated;
  }

  return {
    saved,
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
        businessContext: buildDiscoveryBusinessContext(workspace),
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
        businessContext: buildDiscoveryBusinessContext(workspace),
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
    const queryMetadata: QueryMetadataRecord[] =
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
    const twitterSearchModeByQuery = new Map(
      fallbackMetadata.map((item) => [
        item.query.toLowerCase(),
        item.twitterSearchMode ?? ("raw" as const),
      ])
    );
    const partitionedTwitterQueries = partitionTwitterProspectingQueries(
      twitterQueries.map((query) => ({
        query,
        searchMode: twitterSearchModeByQuery.get(query.toLowerCase()) ?? "raw",
      }))
    );
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

    const twitterResult = await ctx
      .runAction(internal.workflows.prospecting.searchTwitterInternal, {
        workspaceId: args.workspaceId,
        exactQueries: partitionedTwitterQueries.exact,
        rawQueries: partitionedTwitterQueries.raw,
        graphSeedQueries: twitterGraphSeedQueries,
        processingMode: "preview",
        prospectOrigin: "setup_preview",
        setupSessionId: args.sessionId,
        setupRevision: args.previewRevision,
      })
      .catch((error) => {
        prospectingWorkflowLogger.error(
          "Preview Twitter search failed",
          {
            workspaceId: args.workspaceId,
            workspaceName: workspace.name,
            previewRevision: args.previewRevision,
          },
          error
        );
        return createEmptyTwitterSearchResult();
      });

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
          twitterPrimarySearchMode:
            partitionedTwitterQueries.exact.length > 0 &&
            partitionedTwitterQueries.raw.length > 0
              ? "mixed"
              : partitionedTwitterQueries.exact.length > 0
                ? "exact"
                : "raw",
          twitterExactFallbackQueries: twitterResult.exactFallbackQueries,
          twitterGraphSeedSearchMode: "raw",
          twitterQueryStats: twitterResult.queryStats,
          twitterPrimaryQueryStats: twitterResult.primaryQueryStats,
          twitterGraphSeedQueryStats: twitterResult.graphSeedQueryStats,
          twitterPrimaryPostsFound: twitterResult.primaryPostsFound,
          twitterGraphSeedPostsFound: twitterResult.graphSeedPostsFound,
          twitterPostsFound: twitterResult.posts.length,
          twitterSaved: twitterResult.saved,
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

function isRealProspectingCandidate(
  summary: Pick<Doc<"prospectSummaries">, "origin" | "status">
) {
  return summary.origin !== "setup_preview" && summary.status !== "archived";
}

export const initializeProspectingBootstrapInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (
      !workspace ||
      workspace.prospectingWorkflowStartedAt !== undefined ||
      workspace.prospectingBootstrapStartedAt !== undefined ||
      workspace.prospectingBootstrapCompletedAt !== undefined
    ) {
      return false;
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(args.workspaceId, {
      prospectingBootstrapStartedAt: now,
      prospectingBootstrapCycleCount: 0,
      prospectingBootstrapLastProgressAt: now,
      prospectingBootstrapLastReadyCount: 0,
      prospectingBootstrapLastQualifiedCount: 0,
      prospectingBootstrapLastEnrichedCount: 0,
      prospectingBootstrapLastPendingQualificationCount: 0,
      prospectingBootstrapLastPendingEnrichmentCount: 0,
      prospectingBootstrapCompletedAt: undefined,
      prospectingBootstrapCompletionReason: undefined,
    });
    return true;
  },
});

export const getProspectingSchedulingStateInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.union(
    v.null(),
    v.object({
      bootstrapStartedAt: v.optional(v.number()),
      bootstrapCycleCount: v.number(),
      bootstrapLastProgressAt: v.optional(v.number()),
      bootstrapLastReadyCount: v.optional(v.number()),
      bootstrapLastQualifiedCount: v.optional(v.number()),
      bootstrapLastEnrichedCount: v.optional(v.number()),
      bootstrapLastPendingQualificationCount: v.optional(v.number()),
      bootstrapLastPendingEnrichmentCount: v.optional(v.number()),
      bootstrapCompletedAt: v.optional(v.number()),
      readyCount: v.number(),
      qualifiedCount: v.number(),
      enrichedCount: v.number(),
      pendingQualificationCount: v.number(),
      qualifiedPendingEnrichmentCount: v.number(),
      providerRetryAfterAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return null;
    }

    const readyTarget =
      getSystemRuntimeConfig().prospecting.bootstrap.readyTarget;
    const scanLimit = Math.max(readyTarget * 5, readyTarget);
    const [
      readyRows,
      pendingQualificationRows,
      pendingEnrichmentRows,
      workspaceStats,
      socialApiCircuit,
      linkdApiCircuit,
    ] = await Promise.all([
      ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_actionable_score", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("actionableReady", true)
        )
        .filter((q) =>
          q.and(
            q.neq(q.field("origin"), "setup_preview"),
            q.neq(q.field("status"), "archived")
          )
        )
        .take(readyTarget),
      ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_qualification", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("qualificationStatus", "pending")
        )
        .take(scanLimit),
      ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_qualification_and_enrichment", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("qualificationStatus", "qualified")
            .eq("enrichmentStatus", "pending")
        )
        .take(scanLimit),
      ctx.db
        .query("workspaceStats")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .first(),
      ctx.db
        .query("providerCircuitStates")
        .withIndex("by_provider", (q) => q.eq("provider", "socialapi"))
        .first(),
      ctx.db
        .query("providerCircuitStates")
        .withIndex("by_provider", (q) => q.eq("provider", "linkdapi"))
        .first(),
    ]);

    const pendingQualificationCount = pendingQualificationRows.filter(
      isRealProspectingCandidate
    ).length;
    const qualifiedPendingEnrichmentCount = pendingEnrichmentRows.filter(
      (summary) =>
        isRealProspectingCandidate(summary) &&
        !(summary.actionableReady ?? summary.readyQualifiedEnriched)
    ).length;
    const blockedProviderCircuits = [socialApiCircuit, linkdApiCircuit].filter(
      (state) => state?.status === "open" || state?.status === "half_open"
    );
    const providerRetryAfterAt =
      blockedProviderCircuits.length === 2
        ? blockedProviderCircuits
            .flatMap((state) => [state?.retryAfterAt, state?.probeLeaseUntil])
            .filter((value): value is number => typeof value === "number")
            .reduce<number | undefined>(
              (latest, value) =>
                latest === undefined ? value : Math.max(latest, value),
              undefined
            )
        : undefined;

    return {
      bootstrapStartedAt: workspace.prospectingBootstrapStartedAt,
      bootstrapCycleCount: workspace.prospectingBootstrapCycleCount ?? 0,
      bootstrapLastProgressAt: workspace.prospectingBootstrapLastProgressAt,
      bootstrapLastReadyCount: workspace.prospectingBootstrapLastReadyCount,
      bootstrapLastQualifiedCount:
        workspace.prospectingBootstrapLastQualifiedCount,
      bootstrapLastEnrichedCount:
        workspace.prospectingBootstrapLastEnrichedCount,
      bootstrapLastPendingQualificationCount:
        workspace.prospectingBootstrapLastPendingQualificationCount,
      bootstrapLastPendingEnrichmentCount:
        workspace.prospectingBootstrapLastPendingEnrichmentCount,
      bootstrapCompletedAt: workspace.prospectingBootstrapCompletedAt,
      readyCount: readyRows.length,
      qualifiedCount: workspaceStats?.qualifiedProspectsCount ?? 0,
      enrichedCount: workspaceStats?.enrichedProspectsCount ?? 0,
      pendingQualificationCount,
      qualifiedPendingEnrichmentCount,
      providerRetryAfterAt,
    };
  },
});

export const scheduleNextProspectingCycleInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    delayMs: v.number(),
    bootstrapCycleCount: v.optional(v.number()),
    bootstrapLastProgressAt: v.optional(v.number()),
    bootstrapLastReadyCount: v.optional(v.number()),
    bootstrapLastQualifiedCount: v.optional(v.number()),
    bootstrapLastEnrichedCount: v.optional(v.number()),
    bootstrapLastPendingQualificationCount: v.optional(v.number()),
    bootstrapLastPendingEnrichmentCount: v.optional(v.number()),
    bootstrapCompletionReason: v.optional(
      prospectingBootstrapCompletionReasonValidator
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.prospectingWorkflowStatus !== "running") {
      return null;
    }

    const now = getCurrentUTCTimestamp();
    const delayMs = Math.max(0, args.delayMs);
    await ctx.db.patch(args.workspaceId, {
      prospectingNextRunAt: now + delayMs,
      prospectingNextRecoveryAt: undefined,
      ...(args.bootstrapCycleCount !== undefined && {
        prospectingBootstrapCycleCount: args.bootstrapCycleCount,
      }),
      ...(args.bootstrapLastProgressAt !== undefined && {
        prospectingBootstrapLastProgressAt: args.bootstrapLastProgressAt,
      }),
      ...(args.bootstrapLastReadyCount !== undefined && {
        prospectingBootstrapLastReadyCount: args.bootstrapLastReadyCount,
      }),
      ...(args.bootstrapLastQualifiedCount !== undefined && {
        prospectingBootstrapLastQualifiedCount:
          args.bootstrapLastQualifiedCount,
      }),
      ...(args.bootstrapLastEnrichedCount !== undefined && {
        prospectingBootstrapLastEnrichedCount: args.bootstrapLastEnrichedCount,
      }),
      ...(args.bootstrapLastPendingQualificationCount !== undefined && {
        prospectingBootstrapLastPendingQualificationCount:
          args.bootstrapLastPendingQualificationCount,
      }),
      ...(args.bootstrapLastPendingEnrichmentCount !== undefined && {
        prospectingBootstrapLastPendingEnrichmentCount:
          args.bootstrapLastPendingEnrichmentCount,
      }),
      ...(args.bootstrapCompletionReason !== undefined &&
        workspace.prospectingBootstrapCompletedAt === undefined && {
          prospectingBootstrapCompletedAt: now,
          prospectingBootstrapCompletionReason: args.bootstrapCompletionReason,
        }),
    });
    await ctx.scheduler.runAfter(
      delayMs,
      internal.workflows.prospecting.startNextCycle,
      { workspaceId: args.workspaceId }
    );
    return null;
  },
});

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

    const runtimeConfig = getSystemRuntimeConfig().prospecting;
    const schedulingState = await ctx.runQuery(
      internal.workflows.prospecting.getProspectingSchedulingStateInternal,
      { workspaceId: args.workspaceId }
    );
    if (
      schedulingState?.bootstrapStartedAt !== undefined &&
      schedulingState.bootstrapCompletedAt === undefined
    ) {
      const scheduleDecision = decideProspectingSchedule({
        now: getCurrentUTCTimestamp(),
        ...schedulingState,
        config: runtimeConfig,
      });
      if (scheduleDecision.mode !== "accelerated_discovery") {
        await ctx.runMutation(
          internal.workflows.prospecting.scheduleNextProspectingCycleInternal,
          {
            workspaceId: args.workspaceId,
            delayMs: scheduleDecision.delayMs,
            ...scheduleDecision.bootstrapProgress,
            bootstrapCompletionReason:
              scheduleDecision.bootstrapCompletionReason,
          }
        );
        return;
      }
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
        failedPlatforms?: ProspectingPlatform[];
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
            failedPlatforms: returnValue.failedPlatforms,
          }
        );
      }

      if (returnValue.shouldContinue) {
        const runtimeConfig = getSystemRuntimeConfig().prospecting;
        if (
          runtimeConfig.autoReschedule &&
          workspace &&
          isWorkspaceInactive(workspace)
        ) {
          await ctx.runMutation(
            internal.workflows.prospecting.updateWorkflowStatus,
            {
              workspaceId: workspaceId as any,
              status: "paused",
              pauseReason: "inactive",
            }
          );
        } else if (runtimeConfig.autoReschedule && workspace) {
          const schedulingState = await ctx.runQuery(
            internal.workflows.prospecting
              .getProspectingSchedulingStateInternal,
            { workspaceId: workspace._id }
          );
          const bootstrapCycleCount =
            schedulingState?.bootstrapStartedAt !== undefined &&
            schedulingState.bootstrapCompletedAt === undefined
              ? schedulingState.bootstrapCycleCount + 1
              : undefined;
          const scheduleDecision = decideProspectingSchedule({
            now: getCurrentUTCTimestamp(),
            bootstrapStartedAt: schedulingState?.bootstrapStartedAt,
            bootstrapCompletedAt: schedulingState?.bootstrapCompletedAt,
            bootstrapCycleCount: bootstrapCycleCount ?? 0,
            bootstrapLastProgressAt: schedulingState?.bootstrapLastProgressAt,
            bootstrapLastReadyCount: schedulingState?.bootstrapLastReadyCount,
            bootstrapLastQualifiedCount:
              schedulingState?.bootstrapLastQualifiedCount,
            bootstrapLastEnrichedCount:
              schedulingState?.bootstrapLastEnrichedCount,
            bootstrapLastPendingQualificationCount:
              schedulingState?.bootstrapLastPendingQualificationCount,
            bootstrapLastPendingEnrichmentCount:
              schedulingState?.bootstrapLastPendingEnrichmentCount,
            readyCount: schedulingState?.readyCount ?? 0,
            qualifiedCount: schedulingState?.qualifiedCount ?? 0,
            enrichedCount: schedulingState?.enrichedCount ?? 0,
            pendingQualificationCount:
              schedulingState?.pendingQualificationCount ?? 0,
            qualifiedPendingEnrichmentCount:
              schedulingState?.qualifiedPendingEnrichmentCount ?? 0,
            providerRetryAfterAt: schedulingState?.providerRetryAfterAt,
            cycleCompleted: bootstrapCycleCount !== undefined,
            config: runtimeConfig,
          });
          await ctx.runMutation(
            internal.workflows.prospecting.scheduleNextProspectingCycleInternal,
            {
              workspaceId: workspace._id,
              delayMs: scheduleDecision.delayMs,
              bootstrapCycleCount,
              ...scheduleDecision.bootstrapProgress,
              bootstrapCompletionReason:
                scheduleDecision.bootstrapCompletionReason,
            }
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
