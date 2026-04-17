// convex/workflows/prospecting.ts
// Continuous 24/7 prospecting workflow using Convex Workflow component
//
// This workflow runs one complete prospecting cycle per workspace:
// 1. Check prospect limit vs tier → STOP if exceeded
// 2. Generate new seed keywords (AI)
// 3. Send to Bishopi (keyword discovery)
// 4. Convert to social queries (AI)
// 5. Search Twitter (NEW queries only - monitors handle ongoing)
// 6. Search LinkedIn (NEW queries + round-robin re-search of OLD queries)
// 7. Save prospects
// 8. Create Twitter monitors for new queries
// 9. Qualify new prospects
// 10. Complete and schedule next run via onComplete handler

import { v } from "convex/values";
import { workflow } from "../lib/workflow";
import { internal, api } from "../_generated/api";
import {
  internalQuery,
  internalMutation,
  internalAction,
} from "../lib/functionBuilders";
import { BATCH_LIMITS } from "../lib/prospectingHelpers";
import { getCurrentQualifiedProspectUsage } from "../lib/planHelpers";
import { hasRequiredWorkspaceAgentData } from "../lib/workspaceSetup";
import type { TwitterPost } from "../integrations/twitter/searchPosts";
import type { LinkedInPost } from "../integrations/linkedin/searchPosts";
import {
  prospectingCycleStatusValidator,
  prospectingWorkflowPauseReasonValidator,
  workspaceWorkflowStatusValidator,
} from "../validators";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { formatWorkspaceLogContext } from "../lib/logHelpers";
import { isWorkspaceInactive } from "../lib/workspaceSystem";

// Set to true to disable automatic 24h rescheduling (saves cost during development)
const DISABLE_PROSPECTING_RESCHEDULING = true;

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
    let workspaceLogContext = formatWorkspaceLogContext({
      workspaceId: String(args.workspaceId),
    });

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
      // Update workspace status and stop
      await step.runMutation(
        internal.workflows.prospecting.updateWorkflowStatus,
        {
          workspaceId: args.workspaceId,
          status: "limit_reached",
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
        reason: `Prospect limit reached (${limitCheck.currentCount}/${limitCheck.limit})`,
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

    workspaceLogContext = formatWorkspaceLogContext({
      workspaceId: String(args.workspaceId),
      workspaceName: workspace.name,
    });

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
          statusCode: "setup_incomplete",
          source: "setup",
        }
      );
      console.info(
        `[Prospecting] ${workspaceLogContext} No synthetic posts found in ICPs, skipping keyword generation`
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
        reason: "No synthetic posts in ICPs - workspace needs regeneration",
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

    // Limit to batch size for cost control
    const socialQueries = socialQueriesResult.socialQueries.slice(
      0,
      BATCH_LIMITS.socialQueriesPerCycle
    );
    const queryMetadata: Array<{ query: string; sourceKeyword?: string }> =
      socialQueriesResult.queryMetadata?.length
        ? socialQueriesResult.queryMetadata
        : socialQueries.map((query: string) => ({ query }));
    const candidateInputs: Array<{ rawValue: string; sourceTheme?: string }> =
      queryMetadata
        .filter((item) => socialQueries.includes(item.query))
        .slice(0, BATCH_LIMITS.socialQueriesPerCycle)
        .map((item) => ({
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

    // Step 6: Save keywords to database FIRST (so we can track them)
    await step.runMutation(
      internal.workflows.prospecting.saveKeywordsInternal,
      {
        workspaceId: args.workspaceId,
        seedKeywords: keywordsResult.prospectingKeywords,
        discoveredKeywords: [], // Bishopi disabled
        socialQueries: acceptedSocialQueries,
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
          await step.runMutation(
            internal.workspaces.setOnboardingIssueStateInternal,
            {
              workspaceId: args.workspaceId,
              statusCode: "search_failed",
              source: "search",
            }
          );
          console.error(
            `[Prospecting] ${workspaceLogContext} Twitter search failed:`,
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
          // Get unsearched LinkedIn queries
          const unsearchedLinkedIn = await step.runQuery(
            internal.keywords.getUnsearchedQueries,
            {
              workspaceId: args.workspaceId,
              platform: "linkedin",
              limit: BATCH_LIMITS.linkedinSearchBatch,
            }
          );

          // Get old queries for round-robin re-search
          const researchQueue = await step.runQuery(
            internal.keywords.getLinkedInResearchQueue,
            {
              workspaceId: args.workspaceId,
              limit: BATCH_LIMITS.linkedinResearchBatch,
            }
          );

          // Combine new + old queries
          const allLinkedInQueries = [
            ...unsearchedLinkedIn,
            ...researchQueue.map((q: any) => ({ id: q.id, value: q.value })),
          ];

          if (allLinkedInQueries.length > 0) {
            const result = await step.runAction(
              internal.workflows.prospecting.searchLinkedInInternal,
              {
                workspaceId: args.workspaceId,
                queries: allLinkedInQueries.map((q) => q.value),
              },
              { retry: { maxAttempts: 2, initialBackoffMs: 2000, base: 2 } }
            );

            // Mark queries as searched
            await step.runMutation(internal.keywords.markQueriesAsSearched, {
              queryIds: allLinkedInQueries.map((q) => q.id),
              platform: "linkedin",
              resultsCount: result.saved,
            });

            return result;
          }
          return { saved: 0 };
        } catch (err) {
          onboardingIssueRaised = true;
          await step.runMutation(
            internal.workspaces.setOnboardingIssueStateInternal,
            {
              workspaceId: args.workspaceId,
              statusCode: "search_failed",
              source: "search",
            }
          );
          console.error(
            `[Prospecting] ${workspaceLogContext} LinkedIn search failed:`,
            err
          );
          return { saved: 0 };
        }
      })(),
    ]);

    twitterSaved = twitterResult.saved;
    twitterSeedCandidates = twitterResult.posts;
    twitterMatchedQueriesByPostId = twitterResult.matchedQueriesByPostId;
    linkedinSaved = linkedinResult.saved;

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
        console.error(
          `[Prospecting] ${workspaceLogContext} Conversation seed discovery failed:`,
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
      console.error(
        `[Prospecting] ${workspaceLogContext} Monitor creation failed:`,
        err
      );
      // Continue even if monitor creation fails
    }

    // Note: Qualification now happens automatically per-prospect via streaming workflows
    // triggered immediately when prospects are saved (no batch step needed)

    const totalSaved = twitterSaved + linkedinSaved;
    console.info(
      `[Prospecting] ${workspaceLogContext} Prospecting cycle complete: ${totalSaved} prospects saved (qualification in progress)`
    );

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

    const usage = await getCurrentQualifiedProspectUsage(ctx, workspace.userId);
    const { tier, used: currentCount, limit } = usage;

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
      }),
      ...(args.status === "paused" && {
        prospectingWorkflowPauseReason: args.pauseReason,
        prospectingWorkflowPausedAt: args.pausedAt ?? now,
      }),
      ...(args.status !== "paused" && {
        prospectingWorkflowPauseReason: undefined,
        prospectingWorkflowPausedAt: undefined,
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
  },
  handler: async (ctx, args) => {
    const keywordsToSave: Array<{
      type: "seed" | "discovered" | "social_query";
      value: string;
      source: string;
    }> = [];

    for (const kw of args.seedKeywords) {
      keywordsToSave.push({ type: "seed", value: kw, source: "agent" });
    }

    for (const kw of args.discoveredKeywords) {
      keywordsToSave.push({ type: "discovered", value: kw, source: "bishopi" });
    }

    for (const query of args.socialQueries) {
      keywordsToSave.push({
        type: "social_query",
        value: query,
        source: "agent",
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
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    saved: number;
    queryStats: Array<{
      query: string;
      postsFound: number;
      success: boolean;
      error?: string;
    }>;
    posts: TwitterPost[];
    matchedQueriesByPostId: Record<string, string[]>;
  }> => {
    // Get workspace for userId
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const workspaceLogContext = formatWorkspaceLogContext({
      workspaceId: String(args.workspaceId),
      workspaceName: workspace.name,
    });

    // Search Twitter
    const result = await ctx.runAction(
      api.integrations.twitter.searchPosts.searchBatch,
      {
        queries: args.queries,
        type: "Latest",
        maxQueriesPerBatch: 10,
      }
    );

    if (!result.success || !result.posts?.length) {
      console.info(
        `[Prospecting] ${workspaceLogContext} Twitter search: no posts found`
      );
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
        prospects: prospectsToSave,
      }
    );

    console.info(
      `[Prospecting] ${workspaceLogContext} Twitter: saved ${saveResult.created + saveResult.updated} prospects`
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
    queries: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ saved: number }> => {
    // Get workspace for userId
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const workspaceLogContext = formatWorkspaceLogContext({
      workspaceId: String(args.workspaceId),
      workspaceName: workspace.name,
    });

    // Search LinkedIn
    const result = await ctx.runAction(
      api.integrations.linkedin.searchPosts.searchBatch,
      {
        queries: args.queries,
        sortBy: "relevance",
        datePosted: "past-week",
        maxQueriesPerBatch: 10,
      }
    );

    if (!result.success || !result.posts?.length) {
      console.info(
        `[Prospecting] ${workspaceLogContext} LinkedIn search: no posts found`
      );
      return { saved: 0 };
    }

    // Transform and save prospects
    const prospectsToSave = result.posts.map((post: LinkedInPost) => ({
      platform: "linkedin" as const,
      externalId: post.postID || "",
      data: post,
      matchedKeywords: args.queries.slice(0, 5),
    }));

    const saveResult = await ctx.runMutation(
      internal.prospects.createProspectsBatch,
      {
        userId: workspace.userId,
        workspaceId: args.workspaceId,
        prospects: prospectsToSave,
      }
    );

    console.info(
      `[Prospecting] ${workspaceLogContext} LinkedIn: saved ${saveResult.created + saveResult.updated} prospects`
    );
    return { saved: saveResult.created + saveResult.updated };
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
      console.info(
        `[Prospecting] ${formatWorkspaceLogContext({ workspaceId: String(args.workspaceId) })} Workspace not found, stopping workflow`
      );
      return;
    }

    const workspaceLogContext = formatWorkspaceLogContext({
      workspaceId: String(args.workspaceId),
      workspaceName: workspace.name,
    });

    // Only continue if status is still "running"
    if (workspace.prospectingWorkflowStatus !== "running") {
      console.info(
        `[Prospecting] ${workspaceLogContext} Workflow status is ${workspace.prospectingWorkflowStatus}, not starting next cycle`
      );
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
      console.info(
        `[Prospecting] ${workspaceLogContext} Workspace inactive, pausing before next cycle`
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
    const workspaceLogContext = formatWorkspaceLogContext({
      workspaceId: String(workspaceId),
      workspaceName: workspace?.name ?? null,
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
        if (DISABLE_PROSPECTING_RESCHEDULING) {
          console.info(
            `[Prospecting] ${workspaceLogContext} Rescheduling disabled (dev mode), not scheduling next cycle`
          );
        } else if (workspace && isWorkspaceInactive(workspace)) {
          await ctx.runMutation(
            internal.workflows.prospecting.updateWorkflowStatus,
            {
              workspaceId: workspaceId as any,
              status: "paused",
              pauseReason: "inactive",
            }
          );
          console.info(
            `[Prospecting] ${workspaceLogContext} Workspace inactive, pausing instead of scheduling next cycle`
          );
        } else {
          // Schedule next run
          await ctx.scheduler.runAfter(
            24 * 60 * 60 * 1000, // 24 hours
            internal.workflows.prospecting.startNextCycle,
            { workspaceId: workspaceId as any }
          );
          console.info(
            `[Prospecting] ${workspaceLogContext} Next cycle scheduled in 24 hours`
          );
        }
      } else {
        console.info(
          `[Prospecting] ${workspaceLogContext} Workflow completed, not continuing:`,
          returnValue.status
        );
      }
    } else if (args.result.kind === "failed") {
      console.error(
        `[Prospecting] ${workspaceLogContext} Workflow failed:`,
        args.result.error
      );
      // Update status to stopped on error
      await ctx.db.patch(workspaceId as any, {
        prospectingWorkflowStatus: "stopped",
      });
      await ctx.runMutation(
        internal.workspaces.setOnboardingIssueStateInternal,
        {
          workspaceId: workspaceId as any,
          statusCode: "workflow_failed",
          source: "workflow",
        }
      );
    } else if (args.result.kind === "canceled") {
      console.info(
        `[Prospecting] ${workspaceLogContext} Workflow was canceled`
      );
    }
  },
});
