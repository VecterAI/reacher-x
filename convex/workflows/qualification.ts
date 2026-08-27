import { v } from "convex/values";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { workflow } from "../lib/workflow";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../lib/functionBuilders";
import { getQualificationPool } from "../lib/qualificationPool";
import { previewQualificationPool } from "../lib/previewQualificationPool";
import { QUALIFICATION_THRESHOLD } from "../lib/qualificationCore";
import { evaluateQualificationWithExternalArticles } from "../lib/qualificationEvaluationCore";
import { indexEvidencePosts, type EvidencePost } from "../lib/ragIndexing";
import {
  prospectPlatformValidator,
  workspaceUseCaseKeyValidator,
} from "../validators";
import { isRecord, getNestedRecord } from "../lib/typeGuards";
import { logger } from "../../shared/lib/logger";
import { resolveWorkspaceUseCaseKey } from "../../shared/lib/workspaceUseCases";
import { getWorkflowEvidencePostText } from "../lib/workflowSafeProspect";
import { isValidatedSetupPreviewProspect } from "../lib/setupSessionCore";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { parseQualificationModelFailure } from "../lib/qualificationFailureCore";
import { TENANT_JOB_PRIORITY } from "../lib/tenantSchedulerCore";
import { enqueueTenantJobWithRetry } from "../lib/tenantSchedulerEnqueue";
import { completeTenantJob } from "../lib/tenantSchedulerHelpers";
const qualificationWorkflowLogger = logger.withScope("QualificationWorkflow");

async function hasValidatedSetupPreviewContext(
  ctx: ActionCtx,
  prospect: Doc<"prospects">,
  workspaceId: Doc<"workspaces">["_id"]
): Promise<boolean> {
  if (!prospect.setupSessionId) {
    return false;
  }

  const [session, workspace] = await Promise.all([
    ctx.runQuery(internal.setupSessions.getByIdInternal, {
      sessionId: prospect.setupSessionId,
    }),
    ctx.runQuery(internal.workspaces.getById, { workspaceId }),
  ]);

  return Boolean(
    workspace &&
    isValidatedSetupPreviewProspect({
      prospect,
      session,
      workspaceUserId: workspace.userId,
      workspaceId,
    })
  );
}

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
    platform: prospectPlatformValidator,
    discoveryQueries: v.array(v.string()),
    totalKeywords: v.number(),
    profileData: v.any(),
    workspaceId: v.id("workspaces"),
    prospectId: v.id("prospects"),
    icpDescription: v.optional(v.string()),
    icpPainPoints: v.optional(v.array(v.string())),
    useCaseKey: v.optional(workspaceUseCaseKeyValidator),
    relevantMemories: v.optional(v.array(v.string())),
    workspaceMemoryPolicy: v.optional(v.string()),
    complianceInstructions: v.optional(v.array(v.string())),
    similarQualifiedCases: v.optional(v.array(v.string())),
    similarDisqualifiedCases: v.optional(v.array(v.string())),
    routing: v.optional(
      v.union(
        v.literal("fast"),
        v.literal("reasoning"),
        v.literal("onboarding")
      )
    ),
  },
  handler: async (ctx, args) => {
    return await evaluateQualificationWithExternalArticles(ctx, {
      evidencePosts: args.evidencePosts as Array<Record<string, unknown>>,
      platform: args.platform,
      discoveryQueries: args.discoveryQueries,
      totalKeywords: args.totalKeywords,
      profileData: args.profileData as Record<string, unknown>,
      workspaceId: args.workspaceId,
      prospectId: args.prospectId,
      icpDescription: args.icpDescription,
      icpPainPoints: args.icpPainPoints,
      useCaseKey: resolveWorkspaceUseCaseKey(args.useCaseKey),
      relevantMemories: args.relevantMemories,
      workspaceMemoryPolicy: args.workspaceMemoryPolicy,
      complianceInstructions: args.complianceInstructions,
      similarQualifiedCases: args.similarQualifiedCases,
      similarDisqualifiedCases: args.similarDisqualifiedCases,
      routing: args.routing,
    });
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
    skipped: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }),
  handler: async (
    step,
    args
  ): Promise<{
    success: boolean;
    qualified?: boolean;
    score?: number;
    skipped?: boolean;
    error?: string;
  }> => {
    // Step 1: Get prospect data
    const prospect = await step.runQuery(
      internal.prospects.getProspectWorkflowDataInternal,
      { prospectId: args.prospectId }
    );

    if (!prospect) {
      return {
        success: false,
        error: "Prospect not found",
      };
    }

    await step.runMutation(internal.prospects.setQualificationWorkflowId, {
      prospectId: args.prospectId,
      workflowId: String(step.workflowId),
    });

    const isSetupPreview = prospect.origin === "setup_preview";
    if (isSetupPreview) {
      if (!prospect.setupSessionId) {
        await step.runMutation(
          internal.prospects.clearQualificationWorkflowId,
          { prospectId: args.prospectId }
        );
        return {
          success: true,
          qualified: false,
          score: prospect.qualificationScore,
        };
      }

      const setupSession = await step.runQuery(
        internal.setupSessions.getByIdInternal,
        {
          sessionId: prospect.setupSessionId,
        }
      );
      if (!setupSession || setupSession.status === "discarded") {
        await step.runMutation(
          internal.prospects.clearQualificationWorkflowId,
          { prospectId: args.prospectId }
        );
        return {
          success: true,
          qualified: false,
          score: prospect.qualificationScore,
        };
      }
    }

    // Skip if already qualified
    if (
      prospect.qualificationStatus === "qualified" ||
      prospect.qualificationStatus === "disqualified"
    ) {
      await step.runMutation(internal.prospects.clearQualificationWorkflowId, {
        prospectId: args.prospectId,
      });
      return {
        success: true,
        qualified: prospect.qualificationStatus === "qualified",
        score: prospect.qualificationScore,
      };
    }

    if (prospect.status === "archived") {
      await step.runMutation(internal.prospects.clearQualificationWorkflowId, {
        prospectId: args.prospectId,
      });
      return {
        success: true,
        skipped: true,
        qualified: false,
        score: prospect.qualificationScore,
      };
    }

    // Step 2: Get workspace for ICPs and keywords
    const workspace = await step.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      await step.runMutation(internal.prospects.clearQualificationWorkflowId, {
        prospectId: args.prospectId,
      });
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
    const discoveryQueries = Array.isArray(
      prospect.discoveryContext?.matchedQueries
    )
      ? prospect.discoveryContext.matchedQueries
      : [];

    // Extract profile data for authenticity analysis
    const profileData =
      getNestedRecord(prospectData, "user") ||
      getNestedRecord(prospectData, "author") ||
      prospectData;

    const learningContext = await step.runAction(
      internal.memory.getQualificationLearningContextInternal,
      {
        workspaceId: String(args.workspaceId),
        userId: String(workspace.userId),
        prospectId: String(args.prospectId),
        title:
          (prospect.title as string | undefined) ||
          ((profileData.name as string | undefined) ?? undefined),
        briefIntro: prospect.briefIntro,
        matchedKeywords: discoveryQueries,
        evidenceHighlights: rawEvidencePosts
          .flatMap((post) => {
            const text = getWorkflowEvidencePostText(post).trim();
            return text ? [text] : [];
          })
          .slice(0, 5),
      }
    );

    // Step 4: Run qualification via action (AI calls require Node.js runtime)
    const result = await step.runAction(
      internal.workflows.qualification.runQualificationCore,
      {
        evidencePosts: rawEvidencePosts,
        platform: prospect.platform,
        discoveryQueries,
        totalKeywords: allKeywords.length || 1, // Avoid division by zero
        profileData,
        workspaceId: args.workspaceId,
        prospectId: args.prospectId,
        icpDescription: workspace.description,
        icpPainPoints: allKeywords,
        useCaseKey: workspace.useCaseKey,
        relevantMemories: learningContext.relevantMemories,
        workspaceMemoryPolicy: learningContext.policyPrompt,
        complianceInstructions: learningContext.complianceInstructions,
        similarQualifiedCases: learningContext.similarQualifiedCases,
        similarDisqualifiedCases: learningContext.similarDisqualifiedCases,
        routing: isSetupPreview ? "onboarding" : "reasoning",
      }
    );

    // Step 5: Update prospect with qualification result
    const qualificationUpdate = await step.runMutation(
      internal.prospects.updateProspectQualification,
      {
        prospectId: args.prospectId,
        qualificationStatus: result.status,
        qualificationScore: result.score,
        qualificationScoreBreakdown: result.scoreBreakdown,
        qualifiedAt: result.qualifiedAt,
        qualificationKeywords: result.matchedKeywords,
        qualificationSources: result.qualificationSources,
        qualificationVerification: result.qualificationVerification,
        authenticity: result.authenticity,
      }
    );

    if (qualificationUpdate.skipped) {
      await step.runMutation(internal.prospects.clearQualificationWorkflowId, {
        prospectId: args.prospectId,
      });
      return {
        success: true,
        qualified: false,
        score: result.score,
        skipped: true,
      };
    }

    const currentProspect = await step.runQuery(
      internal.prospects.getProspectWorkflowDataInternal,
      { prospectId: args.prospectId }
    );

    if (!currentProspect) {
      await step.runMutation(internal.prospects.clearQualificationWorkflowId, {
        prospectId: args.prospectId,
      });
      return {
        success: true,
        qualified: result.qualified,
        score: result.score,
        skipped: true,
      };
    }

    const isStillSetupPreview = currentProspect.origin === "setup_preview";

    // Log qualification activity
    await step.runMutation(internal.outreach.logActivity, {
      prospectId: args.prospectId,
      workspaceId: args.workspaceId,
      type: "qualified",
      title: result.qualified
        ? `Qualified with ${result.score}% fit`
        : `Did not qualify (${result.score}% fit)`,
      description: result.qualified
        ? `Qualified with a score of ${result.score}. Minimum required: ${QUALIFICATION_THRESHOLD}. Moving to enrichment.`
        : `Scored ${result.score}. Minimum required: ${QUALIFICATION_THRESHOLD}.`,
    });
    await step.runMutation(internal.memory.recordMemoryWorkflowEventInternal, {
      workspaceId: args.workspaceId,
      eventType: "qualification_completed",
      sourceType: "prospect",
      sourceId: String(args.prospectId),
      workflowName: "qualificationWorkflow",
      prospectId: args.prospectId,
      payload: {
        qualified: result.qualified,
        status: result.status,
        score: result.score,
        discoveryQueries: result.qualificationVerification.discoveryQueries,
        evidenceValidated:
          result.qualificationVerification.status === "validated" &&
          result.qualificationVerification.candidateSourceCount > 0,
        qualificationSourceCount: result.qualificationSources.length,
        reasoning: result.reasoning,
      },
      eventKey: `qualification:${String(step.workflowId)}:completed`,
    });

    const evidenceValidationCompleted =
      result.qualificationVerification.status === "validated" &&
      result.qualificationVerification.candidateSourceCount > 0;

    if (!isStillSetupPreview && evidenceValidationCompleted) {
      await step
        .runAction(internal.memory.indexWorkspaceProspectSummaryInternal, {
          workspaceId: String(args.workspaceId),
          prospectId: String(args.prospectId),
          namespace: result.qualified ? "verified_wins" : "verified_losses",
          displayName:
            currentProspect.displayName ||
            currentProspect.title ||
            "Unknown prospect",
          title: currentProspect.title,
          briefIntro: currentProspect.briefIntro,
          qualificationStatus: result.status,
          qualificationScore: result.score,
          matchedKeywords: result.matchedKeywords,
          finance: currentProspect.finance?.displayValue,
          reasoning: result.reasoning,
          importance: result.qualified ? 0.8 : 0.65,
        })
        .catch((error) => {
          qualificationWorkflowLogger.warn(
            "Workspace summary indexing failed",
            {
              workspaceId: String(args.workspaceId),
              workspaceName: workspace.name,
              prospectId: String(args.prospectId),
            },
            error instanceof Error ? error : new Error(String(error))
          );
        });
    }

    if (!isStillSetupPreview) {
      await step
        .runAction(internal.memory.indexProspectSearchListInternal, {
          prospectId: args.prospectId,
        })
        .catch((error) => {
          qualificationWorkflowLogger.warn(
            "Prospect list search RAG indexing failed",
            {
              workspaceId: String(args.workspaceId),
              workspaceName: workspace.name,
              prospectId: String(args.prospectId),
            },
            error instanceof Error ? error : new Error(String(error))
          );
        });
    }

    // Step 6: If qualified, index evidence to RAG and start enrichment
    if (result.qualified) {
      // Convert evidence posts for RAG indexing
      const platform = (currentProspect.platform || "twitter") as
        | "twitter"
        | "linkedin";
      const evidenceForRag = result.qualificationSources.map((source) => ({
        id: source.sourceId,
        text: source.text,
        url: source.evidenceUrl ?? source.sourceUrl,
        platform,
      }));

      // Index evidence posts to RAG (fire and forget, don't block workflow)
      if (!isStillSetupPreview) {
        await step
          .runAction(
            internal.workflows.qualification.indexQualificationEvidence,
            {
              prospectId: args.prospectId,
              evidencePosts: evidenceForRag.filter((p) => p.text.length > 0),
            }
          )
          .catch((error) => {
            qualificationWorkflowLogger.warn(
              "Qualification RAG indexing failed",
              {
                workspaceId: String(args.workspaceId),
                workspaceName: workspace.name,
                prospectId: String(args.prospectId),
              },
              error instanceof Error ? error : new Error(String(error))
            );
          });
      }

      // Start enrichment workflow
      if (isStillSetupPreview && currentProspect.setupSessionId) {
        await step.runAction(
          internal.workflows.enrichment.scheduleSetupPreviewEnrichmentInternal,
          {
            sessionId: currentProspect.setupSessionId,
            workspaceId: args.workspaceId,
          }
        );
      } else {
        await step.runAction(internal.workflows.enrichment.startEnrichment, {
          prospectId: args.prospectId,
          workspaceId: args.workspaceId,
        });
      }
    }

    await step.runMutation(internal.prospects.clearQualificationWorkflowId, {
      prospectId: args.prospectId,
    });

    if (isStillSetupPreview && currentProspect.setupSessionId) {
      await step.runAction(
        internal.setupSessions.resumePreviewWorkflowIfNeededInternal,
        {
          sessionId: currentProspect.setupSessionId,
        }
      );
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
    tenantJobId: v.optional(v.id("tenantJobs")),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );
    if (!prospect) {
      return { workflowId: "" };
    }

    const isValidatedSetupPreview = await hasValidatedSetupPreviewContext(
      ctx,
      prospect,
      args.workspaceId
    );
    if (!isValidatedSetupPreview) {
      const limitState = await ctx.runQuery(
        internal.workflows.prospecting.checkProspectLimitInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      if (limitState.limitReached) {
        await ctx.runAction(
          internal.workspaces.reconcileWorkspaceCapacityStateInternal,
          {
            workspaceId: args.workspaceId,
          }
        );
        return { workflowId: "" };
      }
    }

    const wfId = await workflow.start(
      ctx,
      internal.workflows.qualification.qualificationWorkflow,
      {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
      },
      {
        onComplete:
          internal.workflows.qualification.handleQualificationComplete,
        context: {
          prospectId: args.prospectId,
          tenantJobId: args.tenantJobId,
        },
      }
    );

    return { workflowId: wfId.toString() };
  },
});

/**
 * Clears a failed workflow lease without changing qualification state. The
 * model helper already exhausts its bounded structured-output retries before
 * surfacing a model evaluation failure.
 */
export const handleQualificationComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenantJobId = (
      args.context as {
        prospectId: Id<"prospects">;
        tenantJobId?: Id<"tenantJobs">;
      }
    ).tenantJobId;
    if (args.result.kind === "success") {
      if (tenantJobId) {
        await completeTenantJob(ctx, {
          jobId: tenantJobId,
          status: "succeeded",
        });
      }
      return null;
    }

    const prospectId = (args.context as { prospectId: Id<"prospects"> })
      .prospectId;
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) {
      if (tenantJobId) {
        await completeTenantJob(ctx, {
          jobId: tenantJobId,
          status: args.result.kind === "canceled" ? "cancelled" : "failed",
          errorMessage:
            args.result.kind === "failed" ? args.result.error : undefined,
        });
      }
      return null;
    }

    const workflowId = String(args.workflowId);
    if (
      prospect.qualificationWorkflowId &&
      prospect.qualificationWorkflowId !== workflowId
    ) {
      if (tenantJobId) {
        await completeTenantJob(ctx, {
          jobId: tenantJobId,
          status: args.result.kind === "canceled" ? "cancelled" : "failed",
          errorMessage:
            args.result.kind === "failed" ? args.result.error : undefined,
        });
      }
      return null;
    }

    const now = getCurrentUTCTimestamp();
    if (args.result.kind === "failed") {
      const modelFailure = parseQualificationModelFailure(args.result.error);
      await ctx.db.patch(prospect._id, {
        qualificationWorkflowId: undefined,
        qualificationLastFailure: {
          stage: modelFailure ? "model_evaluation" : "workflow",
          provider: modelFailure?.provider ?? "convex_workflow",
          model: modelFailure?.model,
          code: modelFailure
            ? "qualification_model_evaluation_failed"
            : "qualification_workflow_failed",
          message: modelFailure?.message ?? args.result.error,
          attemptCount: modelFailure?.attemptCount,
          failedAt: now,
        },
        updatedAt: now,
      });
      if (tenantJobId) {
        await completeTenantJob(ctx, {
          jobId: tenantJobId,
          status: "failed",
          errorMessage: args.result.error,
        });
      }
      return null;
    }

    await ctx.db.patch(prospect._id, {
      qualificationWorkflowId: undefined,
      updatedAt: now,
    });
    if (tenantJobId) {
      await completeTenantJob(ctx, {
        jobId: tenantJobId,
        status: "cancelled",
      });
    }
    return null;
  },
});

/**
 * Start qualification for a prospect via Workpool.
 * Called when prospects are created by the bounded search pipeline.
 * This enqueues the workflow through Workpool to limit concurrent executions.
 */
export const startQualification = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<{ workId: string }> => {
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );
    if (
      !prospect ||
      prospect.status === "archived" ||
      prospect.qualificationStatus === "qualified" ||
      prospect.qualificationStatus === "disqualified" ||
      typeof prospect.qualificationWorkflowId === "string"
    ) {
      return { workId: "" };
    }

    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    if (limitState.limitReached) {
      await ctx.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return { workId: "" };
    }

    const tenantRoute = await enqueueTenantJobWithRetry(ctx, {
      workspaceId: args.workspaceId,
      userId: prospect.userId,
      class: "background",
      priority: TENANT_JOB_PRIORITY.background,
      idempotencyKey: `qualification:${String(args.prospectId)}:${prospect.updatedAt}`,
      payload: {
        kind: "qualification",
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
        preview: false,
      },
    });
    if (tenantRoute.route === "enforced") {
      return { workId: String(tenantRoute.jobId) };
    }

    const workId = await getQualificationPool().enqueueAction(
      ctx,
      internal.workflows.qualification.runQualificationWorkflow,
      {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
      }
    );

    return { workId: workId.toString() };
  },
});

export const startPreviewQualification = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<{ workId: string }> => {
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );
    if (
      !prospect ||
      prospect.status === "archived" ||
      prospect.qualificationStatus === "qualified" ||
      prospect.qualificationStatus === "disqualified" ||
      typeof prospect.qualificationWorkflowId === "string"
    ) {
      return { workId: "" };
    }

    if (
      !(await hasValidatedSetupPreviewContext(ctx, prospect, args.workspaceId))
    ) {
      return { workId: "" };
    }

    const tenantRoute = await enqueueTenantJobWithRetry(ctx, {
      workspaceId: args.workspaceId,
      userId: prospect.userId,
      class: "preview",
      priority: TENANT_JOB_PRIORITY.preview,
      idempotencyKey: `preview-qualification:${String(args.prospectId)}:${prospect.setupRevision ?? prospect.updatedAt}`,
      payload: {
        kind: "qualification",
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
        preview: true,
      },
    });
    if (tenantRoute.route === "enforced") {
      return { workId: String(tenantRoute.jobId) };
    }

    const workId = await previewQualificationPool.enqueueAction(
      ctx,
      internal.workflows.qualification.runQualificationWorkflow,
      {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
      }
    );

    return { workId: workId.toString() };
  },
});
