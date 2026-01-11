import { v } from "convex/values";
import { workflow } from "../lib/workflow";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { qualificationPool } from "../lib/qualificationPool";
import {
  qualifyProspectCore,
  QUALIFICATION_THRESHOLD,
} from "../lib/qualificationCore";
import { indexEvidencePosts, type EvidencePost } from "../lib/ragIndexing";
import { prospectPlatformValidator } from "../validators";
import { isRecord, getNestedRecord } from "../lib/typeGuards";

// ============================================================================
// Qualification Action (Node.js runtime)
// ============================================================================

/**
 * Internal action that runs qualification logic.
 * Uses qualifyProspectCore from lib/qualificationCore.ts (single source of truth).
 *
 * This is separated from the workflow to run in Node.js runtime
 * where AI calls are supported.
 */
export const runQualificationCore = internalAction({
  args: {
    evidencePosts: v.array(v.any()),
    matchedKeywords: v.array(v.string()),
    totalKeywords: v.number(),
    profileData: v.any(),
    icpDescription: v.optional(v.string()),
    icpPainPoints: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const result = await qualifyProspectCore({
      evidencePosts: args.evidencePosts as Array<Record<string, unknown>>,
      matchedKeywords: args.matchedKeywords,
      totalKeywords: args.totalKeywords,
      profileData: args.profileData as Record<string, unknown>,
      icpDescription: args.icpDescription,
      icpPainPoints: args.icpPainPoints,
    });

    return result;
  },
});

/**
 * Internal action to index evidence posts to RAG.
 * Called after qualification succeeds.
 */
export const indexQualificationEvidence = internalAction({
  args: {
    prospectId: v.string(),
    evidencePosts: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        url: v.optional(v.string()),
        platform: prospectPlatformValidator,
      })
    ),
  },
  handler: async (ctx, args) => {
    const posts: EvidencePost[] = args.evidencePosts;
    return await indexEvidencePosts(ctx, args.prospectId, posts);
  },
});

// ============================================================================
// Qualification Workflow
// ============================================================================

/**
 * Qualifies a single prospect by analyzing their profile and evidence posts.
 * Delegates all qualification logic to qualificationCore.ts (single source of truth).
 *
 * Flow:
 * 1. Get prospect data
 * 2. Skip if already qualified
 * 3. Get workspace for keyword context
 * 4. Run qualification via runQualificationCore action
 * 5. Update prospect with result
 * 6. If qualified, index evidence to RAG and start enrichment
 */
export const qualificationWorkflow = workflow.define({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({
    success: v.boolean(),
    qualified: v.optional(v.boolean()),
    score: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (
    step,
    args
  ): Promise<{
    success: boolean;
    qualified?: boolean;
    score?: number;
    error?: string;
  }> => {
    // Step 1: Get prospect data
    const prospect = await step.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId: args.prospectId }
    );

    if (!prospect) {
      return {
        success: false,
        error: "Prospect not found",
      };
    }

    // Skip if already qualified
    if (
      prospect.qualificationStatus === "qualified" ||
      prospect.qualificationStatus === "disqualified"
    ) {
      return {
        success: true,
        qualified: prospect.qualificationStatus === "qualified",
        score: prospect.qualificationScore,
      };
    }

    // Step 2: Get workspace for ICPs and keywords
    const workspace = await step.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      return {
        success: false,
        error: "Workspace not found",
      };
    }

    // Build keywords from ICPs
    const allKeywords: string[] = [];
    for (const icp of workspace.icps || []) {
      if (icp.painPoints) {
        allKeywords.push(...icp.painPoints);
      }
    }

    // Step 3: Prepare data for qualification (with runtime type guards)
    const prospectData = isRecord(prospect.data) ? prospect.data : {};
    const rawEvidencePosts = Array.isArray(prospect.evidencePosts)
      ? (prospect.evidencePosts as Array<Record<string, unknown>>)
      : [];
    const matchedKeywords = Array.isArray(prospect.matchedKeywords)
      ? (prospect.matchedKeywords as string[])
      : [];

    // Extract profile data for authenticity analysis
    const profileData =
      getNestedRecord(prospectData, "user") ||
      getNestedRecord(prospectData, "author") ||
      prospectData;

    // Debug logging - critical for diagnosing qualification issues
    console.info("[Qualification] Input data:", {
      prospectId: args.prospectId,
      evidencePostsCount: rawEvidencePosts.length,
      matchedKeywordsCount: matchedKeywords.length,
      totalIcpKeywords: allKeywords.length,
      icpDescription: workspace.description?.substring(0, 100),
    });

    // Step 4: Run qualification via action (AI calls require Node.js runtime)
    const result = await step.runAction(
      internal.workflows.qualification.runQualificationCore,
      {
        evidencePosts: rawEvidencePosts,
        matchedKeywords,
        totalKeywords: allKeywords.length || 1, // Avoid division by zero
        profileData,
        icpDescription: workspace.description,
        icpPainPoints: allKeywords,
      }
    );

    // Step 5: Update prospect with qualification result
    await step.runMutation(internal.prospects.updateProspectQualification, {
      prospectId: args.prospectId,
      qualificationStatus: result.status,
      qualificationScore: result.score,
      qualifiedAt: result.qualifiedAt,
      evidencePosts: rawEvidencePosts,
      qualificationKeywords: result.matchedKeywords,
      authenticity: result.authenticity,
    });

    console.info(
      `[Qualification] Prospect ${args.prospectId}: ${result.status} (score: ${result.score}/${QUALIFICATION_THRESHOLD})`
    );

    // Step 6: If qualified, index evidence to RAG and start enrichment
    if (result.qualified) {
      // Convert evidence posts for RAG indexing
      const platform = (prospect.platform || "twitter") as
        | "twitter"
        | "linkedin";
      const evidenceForRag = rawEvidencePosts.map((p) => ({
        id:
          (p.id_str as string) ||
          (p.postID as string) ||
          String(p.id || Date.now()),
        text: (p.full_text as string) || (p.text as string) || "",
        url: p.postURL as string | undefined,
        platform,
      }));

      // Index evidence posts to RAG (fire and forget, don't block workflow)
      await step
        .runAction(
          internal.workflows.qualification.indexQualificationEvidence,
          {
            prospectId: args.prospectId,
            evidencePosts: evidenceForRag.filter((p) => p.text.length > 0),
          }
        )
        .catch((error) => {
          console.warn(
            `[Qualification] RAG indexing failed:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        });

      // Start enrichment workflow
      await step.runAction(internal.workflows.enrichment.startEnrichment, {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
      });
    }

    return {
      success: true,
      qualified: result.qualified,
      score: result.score,
    };
  },
});

// ============================================================================
// Workflow Starters
// ============================================================================

/**
 * Run qualification workflow for a prospect.
 * This is the internal action that actually starts the workflow.
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

    console.info(
      `[Qualification] Started workflow ${wfId} for prospect ${args.prospectId}`
    );

    return { workflowId: wfId.toString() };
  },
});

/**
 * Start qualification for a prospect via Workpool.
 * Called by saveProspectFromWebhook and createProspectsBatch.
 * This enqueues the workflow through Workpool to limit concurrent executions.
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

    console.info(
      `[Qualification] Enqueued workId ${workId} for prospect ${args.prospectId}`
    );

    return { workId: workId.toString() };
  },
});
