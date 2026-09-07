import { formatSyntheticTargetingExamples } from "../lib/syntheticProfileCore";
import {
  getLearningTargetingFingerprint,
  isCurrentTargetingLearning,
} from "../lib/learningTargetingHelpers";
import { paginationOptsValidator } from "convex/server";
import { Infer, v } from "convex/values";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../lib/functionBuilders";
import { workflow } from "../lib/workflow";
import {
  MAX_EVIDENCE_POSTS,
  MAX_KEYWORDS_TO_SEARCH,
  QUALIFICATION_THRESHOLD,
  QualificationEvaluationError,
  type QualificationResult,
} from "../lib/qualificationCore";
import { evaluateQualificationWithExternalArticles } from "../lib/qualificationEvaluationCore";
import { prepareQualificationCandidates } from "../lib/qualificationEvidenceCore";
import {
  buildQualificationAuditKeywordContext,
  getQualificationAuditProspectContext,
  mergeQualificationAuditEvidence,
} from "../lib/qualificationAuditCore";
import { sanitizeProspectEvidencePostsForWorkflow } from "../lib/workflowSafeProspect";
import { resolveWorkspaceUseCaseKey } from "../../shared/lib/workspaceUseCases";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import {
  qualificationAuditItemResultValidator,
  qualificationAuditOutcomeValidator,
  qualificationFailureValidator,
} from "../validators";
import { buildLegacyWorkspaceTargetingSpec } from "../lib/targetingSpecCore";

const AUDIT_PAGE_SIZE = 30;
const AUDIT_BATCH_SIZE = 3;
const MAX_AUDIT_PROSPECTS = 1_000;

type AuditItemResult = Infer<typeof qualificationAuditItemResultValidator>;
type QualificationFailure = Infer<typeof qualificationFailureValidator>;

function outcomeContribution(
  item: Pick<
    Doc<"qualificationAuditItems">,
    "outcome" | "verifiedSourceCount" | "evidenceOrigin"
  >
) {
  return {
    keptQualified: item.outcome === "kept_qualified" ? 1 : 0,
    wouldDisqualify: item.outcome === "would_disqualify" ? 1 : 0,
    errored: item.outcome === "error" ? 1 : 0,
    noVerifiedEvidence: item.verifiedSourceCount === 0 ? 1 : 0,
    refetched: item.evidenceOrigin === "existing" ? 0 : 1,
  };
}

export const countQualifiedAtSnapshotInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    snapshotAt: v.number(),
  },
  returns: v.object({ total: v.number(), exceedsLimit: v.boolean() }),
  handler: async (ctx, args) => {
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_workspace_qualification", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("qualificationStatus", "qualified")
          .lte("_creationTime", args.snapshotAt)
      )
      .take(MAX_AUDIT_PROSPECTS + 1);
    return {
      total: Math.min(prospects.length, MAX_AUDIT_PROSPECTS),
      exceedsLimit: prospects.length > MAX_AUDIT_PROSPECTS,
    };
  },
});

export const listQualifiedAtSnapshotInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    snapshotAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("prospects")
      .withIndex("by_workspace_qualification", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("qualificationStatus", "qualified")
          .lte("_creationTime", args.snapshotAt)
      )
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((prospect) => prospect._id),
    };
  },
});

export const getAuditBatchContextInternal = internalQuery({
  args: {
    runId: v.id("qualificationAuditRuns"),
    prospectIds: v.array(v.id("prospects")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    const workspace = await ctx.db.get(run.workspaceId);
    if (!workspace || !isCurrentTargetingLearning(run, workspace))
      throw new Error(
        "Workspace targeting changed; run a new qualification audit"
      );
    const prospects = await Promise.all(
      args.prospectIds.map((prospectId) => ctx.db.get(prospectId))
    );
    return {
      run,
      workspace,
      prospects: prospects.filter(
        (prospect): prospect is Doc<"prospects"> => prospect !== null
      ),
    };
  },
});

export const getUnresolvedTargetsInternal = internalQuery({
  args: { sourceRunId: v.id("qualificationAuditRuns") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const sourceRun = await ctx.db.get(args.sourceRunId);
    if (!sourceRun) return null;
    const items = await ctx.db
      .query("qualificationAuditItems")
      .withIndex("by_run_and_outcome", (q) =>
        q.eq("runId", args.sourceRunId).eq("outcome", "error")
      )
      .take(100);
    return {
      sourceRun,
      prospectIds: items.map((item) => item.prospectId),
    };
  },
});

export const createRunInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    snapshotAt: v.number(),
    totalProspects: v.number(),
    selection: v.optional(
      v.union(v.literal("full_snapshot"), v.literal("unresolved_retry"))
    ),
    sourceRunId: v.optional(v.id("qualificationAuditRuns")),
  },
  returns: v.id("qualificationAuditRuns"),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    for (const status of ["pending", "running"] as const) {
      const active = await ctx.db
        .query("qualificationAuditRuns")
        .withIndex("by_workspace_and_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", status)
        )
        .first();
      if (active) return active._id;
    }

    return await ctx.db.insert("qualificationAuditRuns", {
      targetingFingerprint: getLearningTargetingFingerprint(workspace),
      workspaceId: args.workspaceId,
      userId: workspace.userId,
      mode: "dry_run",
      selection: args.selection ?? "full_snapshot",
      sourceRunId: args.sourceRunId,
      status: "pending",
      snapshotAt: args.snapshotAt,
      totalProspects: args.totalProspects,
      processedProspects: 0,
      keptQualified: 0,
      wouldDisqualify: 0,
      errored: 0,
      noVerifiedEvidence: 0,
      refetched: 0,
      qualificationThreshold: QUALIFICATION_THRESHOLD,
      verificationVersion: 1,
      startedAt: args.snapshotAt,
      updatedAt: args.snapshotAt,
    });
  },
});

export const markRunStartedInternal = internalMutation({
  args: {
    runId: v.id("qualificationAuditRuns"),
    workflowId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "pending") return null;
    await ctx.db.patch(run._id, {
      status: "running",
      workflowId: args.workflowId,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return null;
  },
});

export const storeBatchResultsInternal = internalMutation({
  args: {
    runId: v.id("qualificationAuditRuns"),
    results: v.array(qualificationAuditItemResultValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || (run.status !== "running" && run.status !== "pending")) {
      throw new Error("Qualification audit run is not active");
    }

    let processedDelta = 0;
    const deltas = {
      keptQualified: 0,
      wouldDisqualify: 0,
      errored: 0,
      noVerifiedEvidence: 0,
      refetched: 0,
    };
    const now = getCurrentUTCTimestamp();

    for (const result of args.results) {
      const existing = await ctx.db
        .query("qualificationAuditItems")
        .withIndex("by_run_and_prospect", (q) =>
          q.eq("runId", args.runId).eq("prospectId", result.prospectId)
        )
        .unique();
      const nextContribution = outcomeContribution(result);

      if (existing) {
        const previousContribution = outcomeContribution(existing);
        for (const key of Object.keys(deltas) as Array<keyof typeof deltas>) {
          deltas[key] += nextContribution[key] - previousContribution[key];
        }
        await ctx.db.patch(existing._id, {
          ...result,
          updatedAt: now,
        });
      } else {
        processedDelta += 1;
        for (const key of Object.keys(deltas) as Array<keyof typeof deltas>) {
          deltas[key] += nextContribution[key];
        }
        await ctx.db.insert("qualificationAuditItems", {
          runId: args.runId,
          workspaceId: run.workspaceId,
          previousStatus: "qualified",
          ...result,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(run._id, {
      processedProspects: run.processedProspects + processedDelta,
      keptQualified: run.keptQualified + deltas.keptQualified,
      wouldDisqualify: run.wouldDisqualify + deltas.wouldDisqualify,
      errored: run.errored + deltas.errored,
      noVerifiedEvidence: run.noVerifiedEvidence + deltas.noVerifiedEvidence,
      refetched: run.refetched + deltas.refetched,
      updatedAt: now,
    });
    return null;
  },
});

async function refetchProspectEvidence(
  ctx: ActionCtx,
  args: {
    prospect: Doc<"prospects">;
    providerIdentity: string | null;
    keywords: string[];
  }
): Promise<
  | { success: true; posts: Array<Record<string, unknown>>; queries: string[] }
  | { success: false; failure: QualificationFailure }
> {
  const failedAt = getCurrentUTCTimestamp();
  if (!args.providerIdentity) {
    return {
      success: false,
      failure: {
        stage: "evidence_fetch",
        provider:
          args.prospect.platform === "twitter" ? "socialapi" : "linkdapi",
        code: "missing_provider_identity",
        message: "Missing provider profile identity",
        failedAt,
      },
    };
  }
  if (args.keywords.length === 0) {
    return {
      success: false,
      failure: {
        stage: "evidence_fetch",
        provider: "reacherx",
        code: "missing_search_keywords",
        message: "Workspace has no evidence search keywords",
        failedAt,
      },
    };
  }

  try {
    const result =
      args.prospect.platform === "twitter"
        ? await ctx.runAction(
            api.integrations.twitter.searchUserPosts.searchUserPosts,
            {
              screenName: args.providerIdentity,
              keywords: args.keywords,
              maxPosts: MAX_EVIDENCE_POSTS,
            }
          )
        : await ctx.runAction(
            api.integrations.linkedin.searchUserPosts.searchUserPosts,
            {
              urn: args.providerIdentity,
              keywords: args.keywords,
              maxPosts: MAX_EVIDENCE_POSTS,
            }
          );
    if (!result.success) {
      return {
        success: false,
        failure: {
          stage: "evidence_fetch",
          provider:
            args.prospect.platform === "twitter" ? "socialapi" : "linkdapi",
          code: "provider_search_failed",
          message: result.error ?? "Provider search failed",
          failedAt,
        },
      };
    }
    return {
      success: true,
      posts: sanitizeProspectEvidencePostsForWorkflow(
        result.posts as unknown[],
        args.prospect.platform
      ),
      queries: result.matchedKeywords,
    };
  } catch (error) {
    return {
      success: false,
      failure: {
        stage: "evidence_fetch",
        provider:
          args.prospect.platform === "twitter" ? "socialapi" : "linkdapi",
        code: "provider_search_threw",
        message:
          error instanceof Error ? error.message : "Provider search failed",
        failedAt,
      },
    };
  }
}

function buildErrorResult(args: {
  prospect: Doc<"prospects">;
  displayName: string;
  existingEvidenceCount: number;
  evaluatedEvidenceCount: number;
  evidenceOrigin: "existing" | "refetched" | "mixed";
  failure: QualificationFailure;
}): AuditItemResult {
  return {
    prospectId: args.prospect._id,
    platform: args.prospect.platform,
    displayName: args.displayName,
    previousScore: args.prospect.qualificationScore,
    outcome: "error",
    evidenceOrigin: args.evidenceOrigin,
    existingEvidenceCount: args.existingEvidenceCount,
    evaluatedEvidenceCount: args.evaluatedEvidenceCount,
    verifiedSourceCount: 0,
    reasoning: "Could not produce a trustworthy dry-run decision.",
    error: args.failure.message,
    failure: args.failure,
    qualificationSources: [],
  };
}

async function auditProspect(
  ctx: ActionCtx,
  prospect: Doc<"prospects">,
  workspace: Doc<"workspaces">
): Promise<AuditItemResult> {
  const context = getQualificationAuditProspectContext(prospect);
  const keywordContext = buildQualificationAuditKeywordContext(workspace);
  let evidence = mergeQualificationAuditEvidence({
    existing: context.existingEvidence,
    refetched: [],
  });
  let discoveryQueries = context.discoveryQueries;
  const existingCandidates = prepareQualificationCandidates({
    platform: prospect.platform,
    evidencePosts: evidence.posts,
    profileData: context.profileData,
    discoveryQueries,
  });

  if (existingCandidates.length === 0) {
    const refetch = await refetchProspectEvidence(ctx, {
      prospect,
      providerIdentity: context.providerIdentity,
      keywords: keywordContext.searchKeywords.slice(0, MAX_KEYWORDS_TO_SEARCH),
    });
    if (!refetch.success) {
      return buildErrorResult({
        prospect,
        displayName: context.displayName,
        existingEvidenceCount: context.existingEvidence.length,
        evaluatedEvidenceCount: evidence.posts.length,
        evidenceOrigin: evidence.origin,
        failure: refetch.failure,
      });
    }
    evidence = mergeQualificationAuditEvidence({
      existing: context.existingEvidence,
      refetched: refetch.posts,
    });
    discoveryQueries = [
      ...new Set([...context.discoveryQueries, ...refetch.queries]),
    ];
  }

  let result: QualificationResult;
  try {
    result = await evaluateQualificationWithExternalArticles(ctx, {
      platform: prospect.platform,
      evidencePosts: evidence.posts,
      discoveryQueries,
      totalKeywords: keywordContext.evaluationKeywords.length || 1,
      profileData: context.profileData,
      targetingSpec:
        workspace.targetingSpec ??
        buildLegacyWorkspaceTargetingSpec({
          description: workspace.description,
          profiles: workspace.icps ?? [],
        }),
      workspaceId: workspace._id,
      prospectId: prospect._id,
      icpDescription: workspace.description,
      syntheticTargetingExamples: formatSyntheticTargetingExamples(
        workspace.icps ?? []
      ),
      icpPainPoints: keywordContext.evaluationKeywords,
      useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
      routing: "onboarding",
    });
  } catch (error) {
    const failure: QualificationFailure =
      error instanceof QualificationEvaluationError
        ? {
            stage: error.stage,
            provider: error.provider,
            model: error.model,
            code: error.code,
            message: error.originalMessage,
            attemptCount: error.attemptCount,
            failedAt: getCurrentUTCTimestamp(),
          }
        : {
            stage: "model_evaluation",
            provider: "configured_llm_route",
            code: "qualification_evaluation_threw",
            message:
              error instanceof Error ? error.message : "Qualification failed",
            failedAt: getCurrentUTCTimestamp(),
          };
    return buildErrorResult({
      prospect,
      displayName: context.displayName,
      existingEvidenceCount: context.existingEvidence.length,
      evaluatedEvidenceCount: evidence.posts.length,
      evidenceOrigin: evidence.origin,
      failure,
    });
  }

  if (result.qualificationVerification.status === "failed") {
    return buildErrorResult({
      prospect,
      displayName: context.displayName,
      existingEvidenceCount: context.existingEvidence.length,
      evaluatedEvidenceCount: evidence.posts.length,
      evidenceOrigin: evidence.origin,
      failure: {
        stage: "model_evaluation",
        provider: "configured_llm_route",
        code: "evidence_verification_failed",
        message: "Evidence verification failed",
        failedAt: getCurrentUTCTimestamp(),
      },
    });
  }

  return {
    prospectId: prospect._id,
    platform: prospect.platform,
    displayName: context.displayName,
    previousScore: prospect.qualificationScore,
    proposedScore: result.score,
    scoreBreakdown: result.scoreBreakdown,
    qualificationCriteriaVersion: 1,
    qualificationCriterionResults: result.criterionResults,
    proposedStatus: result.status,
    outcome: result.qualified ? "kept_qualified" : "would_disqualify",
    evidenceOrigin: evidence.origin,
    existingEvidenceCount: context.existingEvidence.length,
    evaluatedEvidenceCount: evidence.posts.length,
    verifiedSourceCount: result.qualificationSources.length,
    reasoning: result.reasoning,
    matchReasoning: result.matchReasoning,
    qualificationSources: result.qualificationSources,
    qualificationVerification: result.qualificationVerification,
    authenticity: result.authenticity,
  };
}

export const processBatchInternal = internalAction({
  args: {
    runId: v.id("qualificationAuditRuns"),
    prospectIds: v.array(v.id("prospects")),
  },
  returns: v.object({ processed: v.number() }),
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const context: {
      run: Doc<"qualificationAuditRuns">;
      workspace: Doc<"workspaces"> | null;
      prospects: Doc<"prospects">[];
    } | null = await ctx.runQuery(
      internal.workflows.qualificationAudit.getAuditBatchContextInternal,
      args
    );
    if (!context?.workspace) throw new Error("Audit context not found");

    const prospects = context.prospects as Doc<"prospects">[];
    const results: AuditItemResult[] = await Promise.all(
      prospects.map(
        (prospect): Promise<AuditItemResult> =>
          auditProspect(ctx, prospect, context.workspace as Doc<"workspaces">)
      )
    );
    await ctx.runMutation(
      internal.workflows.qualificationAudit.storeBatchResultsInternal,
      { runId: args.runId, results }
    );
    return { processed: results.length };
  },
});

export const qualificationAuditWorkflow = workflow.define({
  args: {
    runId: v.id("qualificationAuditRuns"),
    workspaceId: v.id("workspaces"),
    snapshotAt: v.number(),
    targetProspectIds: v.optional(v.array(v.id("prospects"))),
  },
  returns: v.object({ processed: v.number() }),
  handler: async (step, args): Promise<{ processed: number }> => {
    if (args.targetProspectIds) {
      let processed = 0;
      for (
        let index = 0;
        index < args.targetProspectIds.length;
        index += AUDIT_BATCH_SIZE
      ) {
        const result = await step.runAction(
          internal.workflows.qualificationAudit.processBatchInternal,
          {
            runId: args.runId,
            prospectIds: args.targetProspectIds.slice(
              index,
              index + AUDIT_BATCH_SIZE
            ),
          },
          { retry: true }
        );
        processed += result.processed;
      }
      return { processed };
    }

    let cursor: string | null = null;
    let processed = 0;
    let isDone = false;

    while (!isDone) {
      const page: {
        page: Id<"prospects">[];
        continueCursor: string;
        isDone: boolean;
      } = await step.runQuery(
        internal.workflows.qualificationAudit.listQualifiedAtSnapshotInternal,
        {
          workspaceId: args.workspaceId,
          snapshotAt: args.snapshotAt,
          paginationOpts: { cursor, numItems: AUDIT_PAGE_SIZE },
        }
      );
      const prospectIds = page.page as Id<"prospects">[];
      for (
        let index = 0;
        index < prospectIds.length;
        index += AUDIT_BATCH_SIZE
      ) {
        const result = await step.runAction(
          internal.workflows.qualificationAudit.processBatchInternal,
          {
            runId: args.runId,
            prospectIds: prospectIds.slice(index, index + AUDIT_BATCH_SIZE),
          },
          { retry: true }
        );
        processed += result.processed;
      }
      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    return { processed };
  },
});

export const handleAuditCompleteInternal = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const runId = (args.context as { runId: Id<"qualificationAuditRuns"> })
      .runId;
    const run = await ctx.db.get(runId);
    if (!run) return null;
    const now = getCurrentUTCTimestamp();

    if (args.result.kind === "success") {
      await ctx.db.patch(run._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
    } else if (args.result.kind === "failed") {
      await ctx.db.patch(run._id, {
        status: "failed",
        error: args.result.error,
        completedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(run._id, {
        status: "failed",
        error: "Qualification audit workflow was canceled",
        completedAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const startDryRun = internalAction({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    runId: v.id("qualificationAuditRuns"),
    workflowId: v.string(),
    totalProspects: v.number(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    runId: Id<"qualificationAuditRuns">;
    workflowId: string;
    totalProspects: number;
  }> => {
    const snapshotAt = getCurrentUTCTimestamp();
    const count: { total: number; exceedsLimit: boolean } = await ctx.runQuery(
      internal.workflows.qualificationAudit.countQualifiedAtSnapshotInternal,
      { workspaceId: args.workspaceId, snapshotAt }
    );
    if (count.exceedsLimit) {
      throw new Error(`Dry-run is limited to ${MAX_AUDIT_PROSPECTS} prospects`);
    }

    const runId: Id<"qualificationAuditRuns"> = await ctx.runMutation(
      internal.workflows.qualificationAudit.createRunInternal,
      {
        workspaceId: args.workspaceId,
        snapshotAt,
        totalProspects: count.total,
        selection: "full_snapshot",
      }
    );
    const workflowId: Awaited<ReturnType<typeof workflow.start>> =
      await workflow.start(
        ctx,
        internal.workflows.qualificationAudit.qualificationAuditWorkflow,
        { runId, workspaceId: args.workspaceId, snapshotAt },
        {
          onComplete:
            internal.workflows.qualificationAudit.handleAuditCompleteInternal,
          context: { runId },
        }
      );
    await ctx.runMutation(
      internal.workflows.qualificationAudit.markRunStartedInternal,
      { runId, workflowId: String(workflowId) }
    );
    return {
      runId,
      workflowId: String(workflowId),
      totalProspects: count.total,
    };
  },
});

export const startUnresolvedRetryDryRun = internalAction({
  args: { sourceRunId: v.id("qualificationAuditRuns") },
  returns: v.object({
    runId: v.id("qualificationAuditRuns"),
    workflowId: v.string(),
    totalProspects: v.number(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    runId: Id<"qualificationAuditRuns">;
    workflowId: string;
    totalProspects: number;
  }> => {
    const targetContext: {
      sourceRun: Doc<"qualificationAuditRuns">;
      prospectIds: Id<"prospects">[];
    } | null = await ctx.runQuery(
      internal.workflows.qualificationAudit.getUnresolvedTargetsInternal,
      args
    );
    if (!targetContext) throw new Error("Source audit run not found");
    if (targetContext.sourceRun.status !== "completed") {
      throw new Error("Source audit run is not complete");
    }
    if (targetContext.prospectIds.length === 0) {
      throw new Error("Source audit run has no unresolved prospects");
    }

    const snapshotAt = getCurrentUTCTimestamp();
    const runId: Id<"qualificationAuditRuns"> = await ctx.runMutation(
      internal.workflows.qualificationAudit.createRunInternal,
      {
        workspaceId: targetContext.sourceRun.workspaceId,
        snapshotAt,
        totalProspects: targetContext.prospectIds.length,
        selection: "unresolved_retry",
        sourceRunId: args.sourceRunId,
      }
    );
    const workflowId: Awaited<ReturnType<typeof workflow.start>> =
      await workflow.start(
        ctx,
        internal.workflows.qualificationAudit.qualificationAuditWorkflow,
        {
          runId,
          workspaceId: targetContext.sourceRun.workspaceId,
          snapshotAt,
          targetProspectIds: targetContext.prospectIds,
        },
        {
          onComplete:
            internal.workflows.qualificationAudit.handleAuditCompleteInternal,
          context: { runId },
        }
      );
    await ctx.runMutation(
      internal.workflows.qualificationAudit.markRunStartedInternal,
      { runId, workflowId: String(workflowId) }
    );
    return {
      runId,
      workflowId: String(workflowId),
      totalProspects: targetContext.prospectIds.length,
    };
  },
});

export const getDryRunSummaryInternal = internalQuery({
  args: { runId: v.id("qualificationAuditRuns") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    const [wouldDisqualifySample, errorsSample] = await Promise.all([
      ctx.db
        .query("qualificationAuditItems")
        .withIndex("by_run_and_outcome", (q) =>
          q.eq("runId", args.runId).eq("outcome", "would_disqualify")
        )
        .take(20),
      ctx.db
        .query("qualificationAuditItems")
        .withIndex("by_run_and_outcome", (q) =>
          q.eq("runId", args.runId).eq("outcome", "error")
        )
        .take(20),
    ]);
    const compact = (item: Doc<"qualificationAuditItems">) => ({
      prospectId: item.prospectId,
      displayName: item.displayName,
      platform: item.platform,
      previousScore: item.previousScore,
      proposedScore: item.proposedScore,
      evidenceOrigin: item.evidenceOrigin,
      verifiedSourceCount: item.verifiedSourceCount,
      reasoning: item.reasoning,
      error: item.error,
    });
    return {
      run,
      impact: {
        reviewedDecisionCount: run.keptQualified + run.wouldDisqualify,
        wouldDisqualifyPercent:
          run.keptQualified + run.wouldDisqualify > 0
            ? Math.round(
                (run.wouldDisqualify /
                  (run.keptQualified + run.wouldDisqualify)) *
                  10_000
              ) / 100
            : 0,
      },
      wouldDisqualifySample: wouldDisqualifySample.map(compact),
      errorsSample: errorsSample.map(compact),
    };
  },
});

export const listDryRunItemsInternal = internalQuery({
  args: {
    runId: v.id("qualificationAuditRuns"),
    outcome: v.optional(qualificationAuditOutcomeValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.outcome) {
      const outcome: Infer<typeof qualificationAuditOutcomeValidator> =
        args.outcome;
      return await ctx.db
        .query("qualificationAuditItems")
        .withIndex("by_run_and_outcome", (q) =>
          q.eq("runId", args.runId).eq("outcome", outcome)
        )
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("qualificationAuditItems")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .paginate(args.paginationOpts);
  },
});
