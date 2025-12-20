// convex/workflows/qualification.ts
// Per-prospect qualification workflow
// Triggered via Workpool to prevent OCC errors

import { v } from "convex/values";
import { workflow } from "../lib/workflow";
import { internal, api } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { qualificationPool } from "../lib/qualificationPool";

// ============================================================================
// Qualification Workflow
// ============================================================================

/**
 * Qualifies a single prospect by fetching evidence and calculating score.
 * This workflow is triggered immediately when a prospect is saved.
 *
 * Flow:
 * 1. Get prospect and workspace data
 * 2. Wait for rate limit capacity (if needed)
 * 3. Fetch evidence posts from user's timeline
 * 4. Calculate qualification score
 * 5. Update prospect with qualification status
 */
export const qualificationWorkflow = workflow.define({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({
    success: v.boolean(),
    qualified: v.boolean(),
    score: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (step, args): Promise<{
    success: boolean;
    qualified: boolean;
    score: number;
    error?: string;
  }> => {
    // Step 1: Get prospect data
    const prospect = await step.runQuery(internal.prospects.getProspectInternal, {
      prospectId: args.prospectId,
    });

    if (!prospect) {
      return { success: false, qualified: false, score: 0, error: "Prospect not found" };
    }

    // Skip if already qualified/disqualified
    if (prospect.qualificationStatus === "qualified" || prospect.qualificationStatus === "disqualified") {
      return {
        success: true,
        qualified: prospect.qualificationStatus === "qualified",
        score: prospect.qualificationScore || 0,
      };
    }

    // Step 2: Get workspace for qualificationKeywords
    const workspace = await step.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace || !workspace.icps || workspace.icps.length === 0) {
      return { success: false, qualified: false, score: 0, error: "Workspace has no ICPs" };
    }

    // Collect qualificationKeywords from ICPs
    const allQualificationKeywords: string[] = [];
    for (const icp of workspace.icps) {
      if (icp.qualificationKeywords) {
        allQualificationKeywords.push(...icp.qualificationKeywords);
      }
    }

    if (allQualificationKeywords.length === 0) {
      // No qualificationKeywords, default to qualified with base score
      await step.runMutation(internal.prospects.updateProspectQualification, {
        prospectId: args.prospectId,
        qualificationStatus: "qualified",
        qualificationScore: 50,
      });
      return { success: true, qualified: true, score: 50 };
    }

    // Use top 10 keywords (deduplicated)
    const keywords = [...new Set(allQualificationKeywords)].slice(0, 10);

    // Note: Rate limiting is now handled by Workpool (see startQualification)
    // No explicit rate limit check needed here - concurrent executions are limited

    // Step 3: Fetch evidence posts
    const platform = prospect.platform as "twitter" | "linkedin";
    const prospectData = prospect.data as Record<string, unknown>;
    let evidencePosts: Array<Record<string, unknown>> = [];
    let matchedKeywords: string[] = [];

    if (platform === "twitter") {
      // Twitter's from: operator requires screen_name (username), NOT numeric id
      const screenName =
        (prospectData.user as Record<string, string>)?.screen_name ||
        (prospectData.author as Record<string, string>)?.screen_name;

      if (screenName) {
        try {
          const result = await step.runAction(
            api.integrations.twitter.searchUserPosts.searchUserPosts,
            { screenName, keywords, maxPosts: 20 }
          );

          if (result.success) {
            evidencePosts = result.posts as unknown as Array<Record<string, unknown>>;
            matchedKeywords = result.matchedKeywords;
          }
        } catch (err) {
          console.error("Twitter evidence fetch failed:", err);
        }
      }
    } else if (platform === "linkedin") {
      // TODO: LinkedIn temporarily disabled due to API rate limits (Hobby tier 30 req/min)
      // Re-enable when upgrading SocialAPI tier or implementing proper rate limiting
      console.log(`[Qualification] LinkedIn evidence search disabled for prospect ${args.prospectId}`);
      // No evidence from LinkedIn, qualification will proceed with lower score
    }

    // Step 5: Calculate qualification score
    // Pain point evidence: matched keywords (max 40 points)
    const painPointScore = Math.min((matchedKeywords.length / keywords.length) * 80, 40);

    // Recency: posts within last 30 days (max 20 points)
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    let recentCount = 0;
    for (const post of evidencePosts) {
      const timestamp =
        (post.postedAt as Record<string, number>)?.timestamp ||
        (post.tweet_created_at ? new Date(post.tweet_created_at as string).getTime() : 0);
      if (now - timestamp <= thirtyDaysMs) {
        recentCount++;
      }
    }
    const recencyScore =
      evidencePosts.length > 0
        ? Math.min((recentCount / evidencePosts.length) * 20, 20)
        : 0;

    // Engagement: having evidence posts = engagement (max 20 points)
    const engagementScore = evidencePosts.length > 0 ? 15 : 0;

    // Base authenticity score
    const authenticityScore = 20;

    const totalScore = Math.round(painPointScore + recencyScore + engagementScore + authenticityScore);
    const qualified = totalScore >= 80;

    // Step 6: Save qualification result
    await step.runMutation(internal.prospects.updateProspectQualification, {
      prospectId: args.prospectId,
      qualificationStatus: qualified ? "qualified" : "disqualified",
      qualificationScore: totalScore,
      evidencePosts: evidencePosts.slice(0, 10), // Store top 10 evidence posts
      qualificationKeywords: matchedKeywords,
    });

    console.log(
      `[Qualification] Prospect ${args.prospectId}: ${qualified ? "qualified" : "disqualified"} (score: ${totalScore})`
    );

    return { success: true, qualified, score: totalScore };
  },
});

// ============================================================================
// Qualification Starter (for scheduler)
// ============================================================================

/**
 * Run qualification workflow for a prospect.
 * This is the actual worker action that gets enqueued via Workpool.
 */
export const runQualificationWorkflow = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    const wfId = await workflow.start(
      ctx,
      internal.workflows.qualification.qualificationWorkflow,
      {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
      }
    );

    console.log(
      `[Qualification] Started workflow ${wfId} for prospect ${args.prospectId}`
    );

    return { workflowId: wfId.toString() };
  },
});

/**
 * Start qualification for a prospect via Workpool.
 * This is called by ctx.scheduler from mutations - it enqueues the actual
 * workflow action through Workpool to limit concurrent executions and prevent OCC errors.
 */
export const startQualification = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<{ workId: string }> => {
    // Enqueue the workflow via Workpool - this limits concurrent executions
    // and prevents OCC errors from too many parallel rate limit checks
    const workId = await qualificationPool.enqueueAction(
      ctx,
      internal.workflows.qualification.runQualificationWorkflow,
      {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
      }
    );

    console.log(
      `[Qualification] Enqueued workId ${workId} for prospect ${args.prospectId}`
    );

    return { workId: workId.toString() };
  },
});

