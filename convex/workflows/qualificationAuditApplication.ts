import {
  getLearningTargetingFingerprint,
  isCurrentTargetingLearning,
} from "../lib/learningTargetingHelpers";
import { paginationOptsValidator } from "convex/server";
import { Infer, v } from "convex/values";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../lib/functionBuilders";
import { workflow } from "../lib/workflow";
import { qualificationAuditApplicationItemResultValidator } from "../validators";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import {
  calculateQualificationRate,
  getQualificationAuditApplicationDecision,
} from "../lib/qualificationAuditApplyCore";
import { calculateQueryPerformanceScore } from "../lib/memoryCore";
import { isUsableQualificationVerification } from "../lib/qualificationEvidenceCore";
import {
  buildKeywordCanonicalRecord,
  createStableHash,
} from "../lib/memoryHelpers";
import {
  getAgentMemoryRag,
  getWorkspaceNamespace,
} from "../agents/outreach/rag";
import type { WorkspaceAgentMemoryRecord } from "../lib/agentMemoryCore";

const APPLICATION_BATCH_SIZE = 5;
const MEMORY_SCAN_PAGE_SIZE = 50;
const PERFORMANCE_PAGE_SIZE = 50;
const MAX_APPLICATION_ITEMS = 1_000;

type ApplicationItemResult = Infer<
  typeof qualificationAuditApplicationItemResultValidator
>;

type ApplicationTargets = {
  shouldStart: boolean;
  workspaceId: Id<"workspaces">;
  prospectIds: Id<"prospects">[];
  disqualifiedProspectIds: Id<"prospects">[];
  existingWorkflowId?: string;
};

async function deleteRagEntryByKey(
  ctx: ActionCtx,
  args: { namespace: string; key: string }
) {
  const namespace = await getAgentMemoryRag().getNamespace(ctx, {
    namespace: args.namespace,
  });
  if (!namespace) return;
  await getAgentMemoryRag().deleteByKey(ctx, {
    namespaceId: namespace.namespaceId,
    key: args.key,
  });
}

async function deleteProspectSummary(
  ctx: ActionCtx,
  args: {
    workspaceId: Id<"workspaces">;
    prospectId: Id<"prospects">;
    namespace: "verified_wins" | "verified_losses";
  }
) {
  await deleteRagEntryByKey(ctx, {
    namespace: getWorkspaceNamespace(String(args.workspaceId), args.namespace),
    key: `workspace-prospect:${String(args.workspaceId)}:${args.namespace}:${String(args.prospectId)}`,
  });
}

export const beginApplicationInternal = internalMutation({
  args: { runId: v.id("qualificationAuditRuns") },
  returns: v.any(),
  handler: async (ctx, args): Promise<ApplicationTargets> => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Qualification audit run not found");
    const workspace = await ctx.db.get(run.workspaceId);
    if (!workspace || !isCurrentTargetingLearning(run, workspace))
      throw new Error(
        "Workspace targeting changed; run a new qualification audit"
      );
    if (run.status !== "completed") {
      throw new Error("Qualification audit run is not complete");
    }
    if (run.selection !== "full_snapshot") {
      throw new Error("Only a completed full-snapshot audit can be applied");
    }
    if (run.errored !== 0 || run.processedProspects !== run.totalProspects) {
      throw new Error("Qualification audit run is incomplete or has errors");
    }

    const items = await ctx.db
      .query("qualificationAuditItems")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .take(MAX_APPLICATION_ITEMS + 1);
    if (items.length > MAX_APPLICATION_ITEMS) {
      throw new Error(
        `Qualification audit application is limited to ${MAX_APPLICATION_ITEMS} items`
      );
    }
    const applicableItems = items.filter(
      (item) =>
        item.outcome !== "error" &&
        item.proposedStatus !== undefined &&
        item.proposedScore !== undefined
    );
    if (applicableItems.length !== run.processedProspects) {
      throw new Error("Qualification audit decisions are incomplete");
    }

    if (
      run.applicationStatus === "pending" ||
      run.applicationStatus === "running" ||
      run.applicationStatus === "completed"
    ) {
      return {
        shouldStart: false,
        workspaceId: run.workspaceId,
        prospectIds: applicableItems.map((item) => item.prospectId),
        disqualifiedProspectIds: applicableItems
          .filter((item) => item.proposedStatus === "disqualified")
          .map((item) => item.prospectId),
        existingWorkflowId: run.applicationWorkflowId,
      };
    }

    const previouslyApplied = applicableItems.filter(
      (item) => item.applicationOutcome === "applied"
    );
    const previouslySkipped = applicableItems.filter(
      (item) =>
        item.applicationOutcome === "skipped_missing" ||
        item.applicationOutcome === "skipped_stale"
    );
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(run._id, {
      applicationStatus: "pending",
      applicationStartedAt: now,
      applicationCompletedAt: undefined,
      appliedProspects: previouslyApplied.length,
      refreshedQualifiedProspects: previouslyApplied.filter(
        (item) => item.proposedStatus === "qualified"
      ).length,
      disqualifiedProspects: previouslyApplied.filter(
        (item) => item.proposedStatus === "disqualified"
      ).length,
      skippedProspects: previouslySkipped.length,
      quarantinedMemories: run.quarantinedMemories ?? 0,
      correctedQueryPerformanceRows: run.correctedQueryPerformanceRows ?? 0,
      applicationError: undefined,
      updatedAt: now,
    });

    return {
      shouldStart: true,
      workspaceId: run.workspaceId,
      prospectIds: applicableItems.map((item) => item.prospectId),
      disqualifiedProspectIds: applicableItems
        .filter((item) => item.proposedStatus === "disqualified")
        .map((item) => item.prospectId),
    };
  },
});

export const markApplicationStartedInternal = internalMutation({
  args: {
    runId: v.id("qualificationAuditRuns"),
    workflowId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.applicationStatus !== "pending") return null;
    await ctx.db.patch(run._id, {
      applicationStatus: "running",
      applicationWorkflowId: args.workflowId,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return null;
  },
});

export const getApplicationBatchContextInternal = internalQuery({
  args: {
    runId: v.id("qualificationAuditRuns"),
    prospectIds: v.array(v.id("prospects")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.applicationStatus !== "running") return null;
    const workspace = await ctx.db.get(run.workspaceId);
    if (!workspace || !isCurrentTargetingLearning(run, workspace))
      throw new Error(
        "Workspace targeting changed; run a new qualification audit"
      );
    return {
      run,
      targetingFingerprint: getLearningTargetingFingerprint(workspace),
      entries: await Promise.all(
        args.prospectIds.map(async (prospectId) => ({
          item: await ctx.db
            .query("qualificationAuditItems")
            .withIndex("by_run_and_prospect", (q) =>
              q.eq("runId", args.runId).eq("prospectId", prospectId)
            )
            .unique(),
          prospect: await ctx.db.get(prospectId),
        }))
      ),
    };
  },
});

export const getAppliedDisqualifiedProspectIdsInternal = internalQuery({
  args: { runId: v.id("qualificationAuditRuns") },
  returns: v.array(v.id("prospects")),
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("qualificationAuditItems")
      .withIndex("by_run_and_outcome", (q) =>
        q.eq("runId", args.runId).eq("outcome", "would_disqualify")
      )
      .take(MAX_APPLICATION_ITEMS);
    return items
      .filter((item) => item.applicationOutcome === "applied")
      .map((item) => item.prospectId);
  },
});

export const storeApplicationBatchResultsInternal = internalMutation({
  args: {
    runId: v.id("qualificationAuditRuns"),
    results: v.array(qualificationAuditApplicationItemResultValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.applicationStatus !== "running") {
      throw new Error("Qualification audit application is not running");
    }

    let appliedDelta = 0;
    let refreshedDelta = 0;
    let disqualifiedDelta = 0;
    let skippedDelta = 0;
    const now = getCurrentUTCTimestamp();

    for (const result of args.results) {
      const item = await ctx.db
        .query("qualificationAuditItems")
        .withIndex("by_run_and_prospect", (q) =>
          q.eq("runId", args.runId).eq("prospectId", result.prospectId)
        )
        .unique();
      if (!item || item.applicationOutcome !== undefined) continue;

      await ctx.db.patch(item._id, {
        applicationOutcome: result.outcome,
        applicationReason: result.reason,
        appliedAt: result.outcome === "applied" ? now : undefined,
        updatedAt: now,
      });

      if (result.outcome === "applied") {
        appliedDelta += 1;
        if (result.proposedStatus === "qualified") refreshedDelta += 1;
        if (result.proposedStatus === "disqualified") disqualifiedDelta += 1;
      } else {
        skippedDelta += 1;
      }
    }

    await ctx.db.patch(run._id, {
      appliedProspects: (run.appliedProspects ?? 0) + appliedDelta,
      refreshedQualifiedProspects:
        (run.refreshedQualifiedProspects ?? 0) + refreshedDelta,
      disqualifiedProspects:
        (run.disqualifiedProspects ?? 0) + disqualifiedDelta,
      skippedProspects: (run.skippedProspects ?? 0) + skippedDelta,
      updatedAt: now,
    });
    return null;
  },
});

export const processApplicationBatchInternal = internalAction({
  args: {
    runId: v.id("qualificationAuditRuns"),
    prospectIds: v.array(v.id("prospects")),
  },
  returns: v.object({ processed: v.number() }),
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const context: {
      targetingFingerprint: string;
      run: Doc<"qualificationAuditRuns">;
      entries: Array<{
        item: Doc<"qualificationAuditItems"> | null;
        prospect: Doc<"prospects"> | null;
      }>;
    } | null = await ctx.runQuery(
      internal.workflows.qualificationAuditApplication
        .getApplicationBatchContextInternal,
      args
    );
    if (!context) throw new Error("Qualification application context missing");

    const results: ApplicationItemResult[] = [];
    for (const entry of context.entries) {
      if (!entry.item) continue;
      const decision = getQualificationAuditApplicationDecision({
        item: entry.item,
        prospect: entry.prospect,
      });
      if (decision.outcome === "already_applied") continue;
      if (decision.outcome === "recover_applied") {
        results.push({
          prospectId: entry.item.prospectId,
          outcome: "applied",
          proposedStatus: entry.item.proposedStatus,
        });
        continue;
      }
      if (decision.outcome === "skip_missing") {
        results.push({
          prospectId: entry.item.prospectId,
          outcome: "skipped_missing",
          reason: decision.reason,
        });
        continue;
      }
      if (decision.outcome === "skip_stale") {
        results.push({
          prospectId: entry.item.prospectId,
          outcome: "skipped_stale",
          reason: decision.reason,
        });
        continue;
      }
      if (
        !entry.prospect ||
        !entry.item.proposedStatus ||
        entry.item.proposedScore === undefined
      ) {
        continue;
      }

      const update = await ctx.runMutation(
        internal.prospects.updateProspectQualification,
        {
          prospectId: entry.prospect._id,
          expectedTargetingFingerprint: context.targetingFingerprint,
          expectedQualificationStatus: "qualified",
          ...(entry.item.previousScore === undefined
            ? {}
            : { expectedQualificationScore: entry.item.previousScore }),
          qualificationStatus: entry.item.proposedStatus,
          qualificationScore: entry.item.proposedScore,
          qualificationReasoning:
            entry.item.matchReasoning ?? entry.item.reasoning,
          qualificationScoreBreakdown: entry.item.scoreBreakdown,
          qualificationCriteriaVersion: entry.item.qualificationCriteriaVersion,
          qualificationCriterionResults:
            entry.item.qualificationCriterionResults,
          qualifiedAt:
            entry.item.proposedStatus === "qualified"
              ? entry.prospect.qualifiedAt
              : undefined,
          qualificationSources: entry.item.qualificationSources,
          qualificationVerification: entry.item.qualificationVerification,
          qualificationKeywords:
            entry.item.qualificationVerification?.discoveryQueries,
          authenticity: entry.item.authenticity,
        }
      );
      if (update.skipped) {
        results.push({
          prospectId: entry.item.prospectId,
          outcome: "skipped_stale",
          reason: "Prospect changed while the audit decision was being applied",
        });
        continue;
      }

      if (entry.item.proposedStatus === "qualified") {
        await deleteProspectSummary(ctx, {
          workspaceId: context.run.workspaceId,
          prospectId: entry.prospect._id,
          namespace: "verified_losses",
        });
        if (entry.item.qualificationSources.length > 0) {
          await ctx.runAction(
            internal.memory.indexWorkspaceProspectSummaryInternal,
            {
              workspaceId: String(context.run.workspaceId),
              prospectId: String(entry.prospect._id),
              targetingFingerprint: context.targetingFingerprint,
              namespace: "verified_wins",
              displayName:
                entry.prospect.displayName ||
                entry.prospect.title ||
                entry.item.displayName,
              title: entry.prospect.title,
              briefIntro: entry.prospect.briefIntro,
              qualificationStatus: "qualified",
              qualificationScore: entry.item.proposedScore,
              matchedKeywords:
                entry.item.qualificationVerification?.discoveryQueries,
              finance: entry.prospect.finance?.displayValue,
              reasoning: entry.item.reasoning,
              importance: 0.8,
            }
          );
        }
      } else {
        await deleteProspectSummary(ctx, {
          workspaceId: context.run.workspaceId,
          prospectId: entry.prospect._id,
          namespace: "verified_wins",
        });
        if (entry.item.qualificationSources.length > 0) {
          await ctx.runAction(
            internal.memory.indexWorkspaceProspectSummaryInternal,
            {
              workspaceId: String(context.run.workspaceId),
              prospectId: String(entry.prospect._id),
              targetingFingerprint: context.targetingFingerprint,
              namespace: "verified_losses",
              displayName:
                entry.prospect.displayName ||
                entry.prospect.title ||
                entry.item.displayName,
              title: entry.prospect.title,
              briefIntro: entry.prospect.briefIntro,
              qualificationStatus: "disqualified",
              qualificationScore: entry.item.proposedScore,
              matchedKeywords:
                entry.item.qualificationVerification?.discoveryQueries,
              finance: entry.prospect.finance?.displayValue,
              reasoning: entry.item.reasoning,
              importance: 0.65,
            }
          );
        }
      }

      await ctx.runAction(internal.memory.indexProspectSearchListInternal, {
        prospectId: entry.prospect._id,
      });
      results.push({
        prospectId: entry.item.prospectId,
        outcome: "applied",
        proposedStatus: entry.item.proposedStatus,
      });
    }

    if (results.length > 0) {
      await ctx.runMutation(
        internal.workflows.qualificationAuditApplication
          .storeApplicationBatchResultsInternal,
        { runId: args.runId, results }
      );
    }
    return { processed: context.entries.length };
  },
});

export const quarantineQualificationMemoryBatchInternal = internalMutation({
  args: {
    runId: v.id("qualificationAuditRuns"),
    rows: v.array(
      v.object({
        memoryId: v.string(),
        prospectId: v.id("prospects"),
      })
    ),
  },
  returns: v.object({ quarantinedForRun: v.number() }),
  handler: async (ctx, args) => {
    let quarantinedForRun = 0;
    const now = getCurrentUTCTimestamp();
    for (const row of args.rows) {
      const inventory = await ctx.db
        .query("workspaceAgentMemoryInventory")
        .withIndex("by_memory_id", (q) => q.eq("memoryId", row.memoryId))
        .first();
      if (!inventory) continue;
      if (inventory.qualificationAuditRunId !== args.runId) {
        await ctx.db.patch(inventory._id, {
          prospectId: row.prospectId,
          quarantinedAt: now,
          quarantineReason: "source_prospect_failed_qualification_audit",
          qualificationAuditRunId: args.runId,
        });
      }
      quarantinedForRun += 1;
    }
    return { quarantinedForRun };
  },
});

export const setQuarantinedMemoryCountInternal = internalMutation({
  args: {
    runId: v.id("qualificationAuditRuns"),
    quarantinedMemories: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.applicationStatus !== "running") return null;
    await ctx.db.patch(run._id, {
      quarantinedMemories: args.quarantinedMemories,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return null;
  },
});

export const quarantineQualificationMemoriesInternal = internalAction({
  args: {
    runId: v.id("qualificationAuditRuns"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    disqualifiedProspectIds: v.array(v.id("prospects")),
  },
  returns: v.object({ quarantined: v.number() }),
  handler: async (ctx, args): Promise<{ quarantined: number }> => {
    const targetIds = new Map(
      args.disqualifiedProspectIds.map((prospectId) => [
        String(prospectId),
        prospectId,
      ])
    );
    let cursor: string | null = null;
    let quarantined = 0;

    while (true) {
      const page: {
        page: Array<
          Pick<WorkspaceAgentMemoryRecord, "memoryId" | "memoryText" | "parsed">
        >;
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.agentOpsReadModels
          .listWorkspaceBuiltInMemoriesPageForReadModelInternal,
        {
          workspaceId: args.workspaceId,
          userId: args.userId,
          paginationOpts: {
            cursor,
            numItems: MEMORY_SCAN_PAGE_SIZE,
          },
        }
      );
      const matched = page.page.flatMap((memory) => {
        if (
          memory.parsed.source !== "qualification" ||
          memory.parsed.prospectId === undefined
        ) {
          return [];
        }
        const prospectId = targetIds.get(memory.parsed.prospectId);
        return prospectId ? [{ memory, prospectId }] : [];
      });

      if (matched.length > 0) {
        const result = await ctx.runMutation(
          internal.workflows.qualificationAuditApplication
            .quarantineQualificationMemoryBatchInternal,
          {
            runId: args.runId,
            rows: matched.map(({ memory, prospectId }) => ({
              memoryId: memory.memoryId,
              prospectId,
            })),
          }
        );
        quarantined += result.quarantinedForRun;

        await Promise.all(
          matched.map(({ memory }) =>
            deleteRagEntryByKey(ctx, {
              namespace: getWorkspaceNamespace(
                String(args.workspaceId),
                memory.parsed.namespace
              ),
              key: [
                "workspace-memory",
                String(args.workspaceId),
                memory.parsed.namespace,
                createStableHash(memory.memoryText),
              ].join(":"),
            })
          )
        );
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    await ctx.runMutation(
      internal.workflows.qualificationAuditApplication
        .setQuarantinedMemoryCountInternal,
      { runId: args.runId, quarantinedMemories: quarantined }
    );
    return { quarantined };
  },
});

export const getApplicationRunInternal = internalQuery({
  args: { runId: v.id("qualificationAuditRuns") },
  returns: v.any(),
  handler: async (ctx, args) => await ctx.db.get(args.runId),
});

export const listCurrentQualifiedProspectsInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) =>
    await ctx.db
      .query("prospects")
      .withIndex("by_workspace_qualification", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("qualificationStatus", "qualified")
      )
      .paginate(args.paginationOpts),
});

export const listQueryPerformanceForCorrectionInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) =>
    await ctx.db
      .query("queryPerformance")
      .withIndex("by_workspace_updated_at", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .paginate(args.paginationOpts),
});

export const correctQueryPerformanceBatchInternal = internalMutation({
  args: {
    runId: v.id("qualificationAuditRuns"),
    rows: v.array(
      v.object({
        queryPerformanceId: v.id("queryPerformance"),
        qualifiedCount: v.number(),
      })
    ),
  },
  returns: v.object({ corrected: v.number() }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    const workspace = run ? await ctx.db.get(run.workspaceId) : null;
    if (!run || !workspace || !isCurrentTargetingLearning(run, workspace))
      throw new Error(
        "Workspace targeting changed; run a new qualification audit"
      );
    let corrected = 0;
    const now = getCurrentUTCTimestamp();
    for (const input of args.rows) {
      const row = await ctx.db.get(input.queryPerformanceId);
      if (!row) continue;
      if (row.workspaceId !== run.workspaceId)
        throw new Error("Query performance workspace mismatch");
      if (!isCurrentTargetingLearning(row, workspace)) continue;
      const qualifiedCount = Math.max(0, input.qualifiedCount);
      const qualificationRate = calculateQualificationRate(
        qualifiedCount,
        row.prospectsFound
      );
      if (
        row.qualifiedCount === qualifiedCount &&
        row.qualificationRate === qualificationRate
      ) {
        continue;
      }
      const performanceScore = calculateQueryPerformanceScore({
        prospectsFound: row.prospectsFound,
        qualifiedCount,
        convertedCount: row.convertedCount,
        replyCount: row.replyCount,
        replyRate: row.replyRate,
        qualificationRate,
      });
      await ctx.db.patch(row._id, {
        qualifiedCount,
        qualificationRate,
        preAuditQualifiedCount:
          row.preAuditQualifiedCount ?? row.qualifiedCount,
        qualificationAuditAdjustedAt: now,
        qualificationAuditRunId: args.runId,
        updatedAt: now,
      });
      if (row.activatedQueryCandidateId) {
        await ctx.db.patch(row.activatedQueryCandidateId, {
          performanceScore,
          updatedAt: now,
        });
      }
      corrected += 1;
    }
    return { corrected };
  },
});

export const setCorrectedQueryPerformanceCountInternal = internalMutation({
  args: {
    runId: v.id("qualificationAuditRuns"),
    correctedQueryPerformanceRows: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.applicationStatus !== "running") return null;
    await ctx.db.patch(run._id, {
      correctedQueryPerformanceRows: args.correctedQueryPerformanceRows,
      updatedAt: getCurrentUTCTimestamp(),
    });
    return null;
  },
});

export const recomputeQueryPerformanceInternal = internalAction({
  args: {
    runId: v.id("qualificationAuditRuns"),
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({ corrected: v.number() }),
  handler: async (ctx, args): Promise<{ corrected: number }> => {
    const keywordIdByHash = new Map<string, Id<"keywords">>();
    let cursor: string | null = null;
    while (true) {
      const page: {
        page: Doc<"keywords">[];
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.agentOpsReadModels
          .listWorkspaceKeywordsPageForReadModelInternal,
        {
          workspaceId: args.workspaceId,
          paginationOpts: { cursor, numItems: PERFORMANCE_PAGE_SIZE },
        }
      );
      for (const keyword of page.page) {
        if (keyword.type !== "social_query") continue;
        const canonical = buildKeywordCanonicalRecord({
          type: "social_query",
          value: keyword.originalValue ?? keyword.value,
        });
        keywordIdByHash.set(
          keyword.canonicalHash ?? canonical.canonicalHash,
          keyword._id
        );
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    const qualifiedCountByQueryId = new Map<string, number>();
    cursor = null;
    while (true) {
      const page: {
        page: Doc<"prospects">[];
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.workflows.qualificationAuditApplication
          .listCurrentQualifiedProspectsInternal,
        {
          workspaceId: args.workspaceId,
          paginationOpts: { cursor, numItems: PERFORMANCE_PAGE_SIZE },
        }
      );
      for (const prospect of page.page) {
        if (
          !isUsableQualificationVerification(
            prospect.qualificationVerification
          ) ||
          (prospect.qualificationVerification?.supportedSourceCount ?? 0) <= 0
        ) {
          continue;
        }
        const seenQueryIds = new Set<string>();
        for (const query of prospect.qualificationVerification
          ?.discoveryQueries ?? []) {
          const canonical = buildKeywordCanonicalRecord({
            type: "social_query",
            value: query,
          });
          const queryId = keywordIdByHash.get(canonical.canonicalHash);
          if (!queryId || seenQueryIds.has(String(queryId))) continue;
          seenQueryIds.add(String(queryId));
          qualifiedCountByQueryId.set(
            String(queryId),
            (qualifiedCountByQueryId.get(String(queryId)) ?? 0) + 1
          );
        }
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    let corrected = 0;
    cursor = null;
    while (true) {
      const page: {
        page: Doc<"queryPerformance">[];
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.workflows.qualificationAuditApplication
          .listQueryPerformanceForCorrectionInternal,
        {
          workspaceId: args.workspaceId,
          paginationOpts: { cursor, numItems: PERFORMANCE_PAGE_SIZE },
        }
      );
      const result = await ctx.runMutation(
        internal.workflows.qualificationAuditApplication
          .correctQueryPerformanceBatchInternal,
        {
          runId: args.runId,
          rows: page.page.map((row) => ({
            queryPerformanceId: row._id,
            qualifiedCount:
              qualifiedCountByQueryId.get(String(row.queryId)) ?? 0,
          })),
        }
      );
      corrected += result.corrected;
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    await ctx.runMutation(
      internal.workflows.qualificationAuditApplication
        .setCorrectedQueryPerformanceCountInternal,
      { runId: args.runId, correctedQueryPerformanceRows: corrected }
    );
    return { corrected };
  },
});

export const qualificationAuditApplicationWorkflow = workflow.define({
  args: {
    runId: v.id("qualificationAuditRuns"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    prospectIds: v.array(v.id("prospects")),
  },
  returns: v.object({
    processed: v.number(),
    quarantinedMemories: v.number(),
    correctedQueryPerformanceRows: v.number(),
  }),
  handler: async (
    step,
    args
  ): Promise<{
    processed: number;
    quarantinedMemories: number;
    correctedQueryPerformanceRows: number;
  }> => {
    let processed = 0;
    for (
      let index = 0;
      index < args.prospectIds.length;
      index += APPLICATION_BATCH_SIZE
    ) {
      const result: { processed: number } = await step.runAction(
        internal.workflows.qualificationAuditApplication
          .processApplicationBatchInternal,
        {
          runId: args.runId,
          prospectIds: args.prospectIds.slice(
            index,
            index + APPLICATION_BATCH_SIZE
          ),
        },
        { retry: true }
      );
      processed += result.processed;
    }

    const appliedDisqualifiedProspectIds: Id<"prospects">[] =
      await step.runQuery(
        internal.workflows.qualificationAuditApplication
          .getAppliedDisqualifiedProspectIdsInternal,
        { runId: args.runId }
      );

    const memoryResult: { quarantined: number } = await step.runAction(
      internal.workflows.qualificationAuditApplication
        .quarantineQualificationMemoriesInternal,
      {
        runId: args.runId,
        workspaceId: args.workspaceId,
        userId: args.userId,
        disqualifiedProspectIds: appliedDisqualifiedProspectIds,
      },
      { retry: true }
    );
    const performanceResult: { corrected: number } = await step.runAction(
      internal.workflows.qualificationAuditApplication
        .recomputeQueryPerformanceInternal,
      { runId: args.runId, workspaceId: args.workspaceId },
      { retry: true }
    );
    await step.runAction(
      internal.agentOpsReadModels.rebuildWorkspaceAgentOpsReadModelsInternal,
      { workspaceId: args.workspaceId },
      { retry: true }
    );

    return {
      processed,
      quarantinedMemories: memoryResult.quarantined,
      correctedQueryPerformanceRows: performanceResult.corrected,
    };
  },
});

export const handleApplicationCompleteInternal = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const runId = (args.context as { runId: Id<"qualificationAuditRuns"> })
      .runId;
    const run = await ctx.db.get(runId);
    if (!run) return null;
    const now = getCurrentUTCTimestamp();
    if (args.result.kind === "success") {
      await ctx.db.patch(run._id, {
        applicationStatus: "completed",
        applicationCompletedAt: now,
        applicationError: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(run._id, {
        applicationStatus: "failed",
        applicationCompletedAt: now,
        applicationError:
          args.result.kind === "failed"
            ? args.result.error
            : "Qualification audit application was canceled",
        updatedAt: now,
      });
    }
    return null;
  },
});

export const startApplication = internalAction({
  args: { runId: v.id("qualificationAuditRuns") },
  returns: v.object({
    started: v.boolean(),
    workflowId: v.optional(v.string()),
    totalProspects: v.number(),
    disqualifiedProspects: v.number(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    started: boolean;
    workflowId?: string;
    totalProspects: number;
    disqualifiedProspects: number;
  }> => {
    const targets: ApplicationTargets = await ctx.runMutation(
      internal.workflows.qualificationAuditApplication.beginApplicationInternal,
      args
    );
    if (!targets.shouldStart) {
      return {
        started: false,
        workflowId: targets.existingWorkflowId,
        totalProspects: targets.prospectIds.length,
        disqualifiedProspects: targets.disqualifiedProspectIds.length,
      };
    }
    const run: Doc<"qualificationAuditRuns"> | null = await ctx.runQuery(
      internal.workflows.qualificationAuditApplication
        .getApplicationRunInternal,
      args
    );
    if (!run) throw new Error("Qualification audit run not found");

    const workflowId: Awaited<ReturnType<typeof workflow.start>> =
      await workflow.start(
        ctx,
        internal.workflows.qualificationAuditApplication
          .qualificationAuditApplicationWorkflow,
        {
          runId: args.runId,
          workspaceId: targets.workspaceId,
          userId: run.userId,
          prospectIds: targets.prospectIds,
        },
        {
          onComplete:
            internal.workflows.qualificationAuditApplication
              .handleApplicationCompleteInternal,
          context: { runId: args.runId },
        }
      );
    await ctx.runMutation(
      internal.workflows.qualificationAuditApplication
        .markApplicationStartedInternal,
      { runId: args.runId, workflowId: String(workflowId) }
    );
    return {
      started: true,
      workflowId: String(workflowId),
      totalProspects: targets.prospectIds.length,
      disqualifiedProspects: targets.disqualifiedProspectIds.length,
    };
  },
});
