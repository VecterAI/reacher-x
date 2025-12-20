// convex/workflows/qualification.ts
// Per-prospect qualification workflow
// Triggered via Workpool to prevent OCC errors
// Uses core logic from lib/qualificationCore.ts

import { v } from "convex/values";
import { workflow } from "../lib/workflow";
import { internal, api } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { qualificationPool } from "../lib/qualificationPool";
import {
  qualifyProspectCore,
  MAX_KEYWORDS_TO_SEARCH,
  MAX_EVIDENCE_POSTS,
} from "../lib/qualificationCore";

// ============================================================================
// Qualification Workflow
// ============================================================================

/**
 * Qualifies a single prospect by fetching evidence and calculating score.
 * Delegates all scoring logic to qualificationCore.ts (single source of truth).
 *
 * Flow:
 * 1. Get prospect and workspace data
 * 2. Fetch evidence posts from user's timeline
 * 3. Call qualifyProspectCore for scoring + AI bot detection
 * 4. Update prospect with qualification status
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
        qualifiedAt: Date.now(),
      });
      return { success: true, qualified: true, score: 50 };
    }

    // Use top keywords (deduplicated)
    const keywords = [...new Set(allQualificationKeywords)].slice(0, MAX_KEYWORDS_TO_SEARCH);

    // Step 3: Fetch evidence posts
    const platform = prospect.platform as "twitter" | "linkedin";
    const prospectData = prospect.data as Record<string, unknown>;
    let evidencePosts: Array<Record<string, unknown>> = [];
    let matchedKeywords: string[] = [];

    if (platform === "twitter") {
      // Type-safe screen_name extraction
      const user = prospectData.user as Record<string, unknown> | undefined;
      const author = prospectData.author as Record<string, unknown> | undefined;
      const screenName = typeof user?.screen_name === 'string' ? user.screen_name :
                         typeof author?.screen_name === 'string' ? author.screen_name : null;

      if (!screenName) {
        console.warn(`[Qualification] No valid screen_name found for prospect ${args.prospectId}`);
      } else {
        try {
          const result = await step.runAction(
            api.integrations.twitter.searchUserPosts.searchUserPosts,
            { screenName, keywords, maxPosts: MAX_EVIDENCE_POSTS }
          );

          if (result.success) {
            evidencePosts = result.posts as unknown as Array<Record<string, unknown>>;
            matchedKeywords = result.matchedKeywords;
          } else {
            console.warn(`[Qualification] Twitter search failed for ${args.prospectId}: ${result.error || 'Unknown error'}`);
          }
        } catch (err) {
          console.error(`[Qualification] Twitter evidence fetch error for ${args.prospectId}:`, err);
        }
      }
    } else if (platform === "linkedin") {
      // LinkedIn disabled - skip qualification entirely, leave as pending
      console.log(`[Qualification] LinkedIn disabled, skipping qualification for prospect ${args.prospectId}`);
      await step.runMutation(internal.prospects.updateProspectQualification, {
        prospectId: args.prospectId,
        qualificationStatus: "pending",
        qualificationScore: 0,
      });
      return { success: true, qualified: false, score: 0, error: "LinkedIn qualification paused" };
    }

    // Step 4: Calculate qualification using core logic (includes AI bot detection)
    const profileData = prospectData.user || prospectData.author || prospectData;
    
    const result = await qualifyProspectCore({
      evidencePosts,
      matchedKeywords,
      totalKeywords: keywords.length,
      profileData: profileData as Record<string, unknown>,
    });

    // Step 5: Save qualification result
    await step.runMutation(internal.prospects.updateProspectQualification, {
      prospectId: args.prospectId,
      qualificationStatus: result.status,
      qualificationScore: result.score,
      qualifiedAt: result.qualifiedAt,
      evidencePosts: evidencePosts.slice(0, MAX_EVIDENCE_POSTS),
      qualificationKeywords: result.matchedKeywords,
      authenticity: result.authenticity,
    });

    console.log(
      `[Qualification] Prospect ${args.prospectId}: ${result.status} (score: ${result.score}, bot: ${result.authenticity.isLikelyBot})`
    );

    return { success: true, qualified: result.qualified, score: result.score };
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
