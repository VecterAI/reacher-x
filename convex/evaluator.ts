import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  categoryToNamespace,
  promoteAgentMemory,
  type WorkspaceMemoryCategory,
  type WorkspaceMemorySource,
} from "./lib/agentMemoryCore";
import {
  buildMemorySuggestionIdentityHash,
  MEMORY_EVALUATOR_PROMPT_VERSION,
  shouldAutoPromoteMemory,
} from "./lib/memoryEvaluatorCore";
import {
  buildKeywordCanonicalRecord,
  createStableHash,
} from "./lib/memoryHelpers";
import {
  distillEnrichmentLearningDetailed,
  distillOutreachLearningDetailed,
  distillQualificationLearningDetailed,
} from "./lib/learningCore";
import { upsertQueryPerformanceRecord } from "./lib/memoryCore";
import { indexWorkspaceMemoryDocument } from "./lib/ragIndexing";
import {
  sanitizeProviderMetadataForConvex,
  sanitizeTelemetryPayload,
} from "./lib/agentMetadata";
import {
  getStyleMemoryCategory,
  isActiveStyleSource,
  isStyleMemoryCategory,
} from "./lib/styleSourceCore";
import { getNestedRecord, getStringProperty, isRecord } from "./lib/typeGuards";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import {
  memoryEvaluatorRunStatusValidator,
  memorySuggestionStatusValidator,
  workspaceMemoryCategoryValidator,
  workspaceMemorySourceValidator,
} from "./validators";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

const memoryDraftValidator = v.object({
  source: workspaceMemorySourceValidator,
  category: workspaceMemoryCategoryValidator,
  title: v.string(),
  summary: v.string(),
  confidence: v.number(),
  impactScore: v.number(),
  prospectId: v.optional(v.string()),
  planId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  threadId: v.optional(v.string()),
  signals: v.array(v.string()),
  evidence: v.array(v.string()),
  relatedQueries: v.array(v.string()),
  narrative: v.string(),
});

const queryPerformanceUpdateValidator = v.object({
  queryId: v.string(),
  canonicalValue: v.string(),
  canonicalHash: v.string(),
  activatedQueryCandidateId: v.optional(v.string()),
  qualifiedCountDelta: v.optional(v.number()),
  replyCountDelta: v.optional(v.number()),
  convertedCountDelta: v.optional(v.number()),
  lastUsedAt: v.optional(v.number()),
});

const retrievalStatsValidator = v.object({
  relevantMemories: v.number(),
  semanticMatches: v.number(),
  matchedQueries: v.number(),
});

type MemoryEvaluationPlan = {
  status: "apply" | "ignored";
  ignoredReason?: string;
  summary?: string;
  promptVersion: string;
  model?: string;
  workspaceId?: string;
  drafts: Array<{
    source: WorkspaceMemorySource;
    category: WorkspaceMemoryCategory;
    title: string;
    summary: string;
    confidence: number;
    impactScore: number;
    prospectId?: string;
    planId?: string;
    taskId?: string;
    threadId?: string;
    signals: string[];
    evidence: string[];
    relatedQueries: string[];
    narrative: string;
  }>;
  queryPerformanceUpdates: Array<{
    queryId: string;
    canonicalValue: string;
    canonicalHash: string;
    activatedQueryCandidateId?: string;
    qualifiedCountDelta?: number;
    replyCountDelta?: number;
    convertedCountDelta?: number;
    lastUsedAt?: number;
  }>;
  retrievalStats: {
    relevantMemories: number;
    semanticMatches: number;
    matchedQueries: number;
  };
  styleMetadata?: {
    platform: "twitter" | "linkedin";
    sourceVersion: number;
    sourceExternalUserId: string;
    sampleCount: number;
    editDiffCount: number;
  };
  telemetry?: {
    request?: unknown;
    response?: unknown;
    providerMetadata?: unknown;
    usage?: unknown;
    model?: string;
  };
};

function toListLimit(limit?: number): number {
  const normalized =
    typeof limit === "number" ? Math.floor(limit) : DEFAULT_LIST_LIMIT;
  return Math.min(MAX_LIST_LIMIT, Math.max(1, normalized));
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function extractEvidenceHighlights(prospect: Doc<"prospects">): string[] {
  if (!Array.isArray(prospect.evidencePosts)) {
    return [];
  }

  return prospect.evidencePosts
    .map((post) => {
      if (!isRecord(post)) {
        return "";
      }
      return (
        getStringProperty(post, "full_text") ||
        getStringProperty(post, "text") ||
        ""
      );
    })
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .slice(0, 5);
}

function extractPainPoints(prospect: Doc<"prospects">): string[] {
  if (!Array.isArray(prospect.painPoints)) {
    return [];
  }

  return prospect.painPoints
    .map((item) =>
      isRecord(item) ? getStringProperty(item, "pain") : undefined
    )
    .filter(
      (item): item is string => typeof item === "string" && item.length > 0
    );
}

function extractTaskResponseText(
  task: Doc<"outreachTasks"> | null
): string | undefined {
  if (!task || !isRecord(task.resultData)) {
    return undefined;
  }

  return getStringProperty(task.resultData, "responseText");
}

function extractTaskFailureReason(
  task: Doc<"outreachTasks"> | null
): string | undefined {
  if (!task) {
    return undefined;
  }

  const resultData = isRecord(task.resultData) ? task.resultData : undefined;
  const error = getNestedRecord(resultData, "error");
  return (
    task.errorMessage ||
    getStringProperty(resultData, "errorMessage") ||
    getStringProperty(resultData, "errorClassification") ||
    getStringProperty(error, "message") ||
    undefined
  );
}

function extractTaskContent(
  task: Doc<"outreachTasks"> | null
): string | undefined {
  if (!task) {
    return undefined;
  }

  if (task.content?.trim()) {
    return task.content.trim();
  }

  if (!isRecord(task.resultData)) {
    return undefined;
  }

  return (
    getStringProperty(task.resultData, "postedText") ||
    getStringProperty(task.resultData, "text") ||
    undefined
  );
}

async function resolveSuggestionThreadId(
  db: Parameters<typeof promoteAgentMemory>[0],
  suggestion: Doc<"memorySuggestions">
): Promise<string | undefined> {
  if (!suggestion.planId) {
    return undefined;
  }

  const plan = await db.get(suggestion.planId);
  return plan?.threadId;
}

async function resolveMatchedQueryPerformanceUpdates(
  ctx: ActionCtx,
  args: {
    workspaceId: Id<"workspaces">;
    matchedKeywords: string[];
    qualifiedCountDelta?: number;
    replyCountDelta?: number;
    convertedCountDelta?: number;
    lastUsedAt?: number;
  }
): Promise<MemoryEvaluationPlan["queryPerformanceUpdates"]> {
  const updates: MemoryEvaluationPlan["queryPerformanceUpdates"] = [];
  const seenQueryIds = new Set<string>();

  for (const matchedKeyword of args.matchedKeywords) {
    const canonical = buildKeywordCanonicalRecord({
      type: "social_query",
      value: matchedKeyword,
    });
    const keyword = await ctx.runQuery(
      internal.keywords.getKeywordByCanonicalHashInternal,
      {
        workspaceId: args.workspaceId,
        canonicalHash: canonical.canonicalHash,
      }
    );

    if (!keyword || keyword.type !== "social_query") {
      continue;
    }
    if (seenQueryIds.has(String(keyword._id))) {
      continue;
    }
    seenQueryIds.add(String(keyword._id));

    updates.push({
      queryId: String(keyword._id),
      canonicalValue: canonical.canonicalValue,
      canonicalHash: canonical.canonicalHash,
      activatedQueryCandidateId: keyword.activatedQueryCandidateId
        ? String(keyword.activatedQueryCandidateId)
        : undefined,
      qualifiedCountDelta: args.qualifiedCountDelta,
      replyCountDelta: args.replyCountDelta,
      convertedCountDelta: args.convertedCountDelta,
      lastUsedAt: args.lastUsedAt,
    });
  }

  return updates;
}

function buildTelemetryPayload(args: {
  event: Doc<"memoryWorkflowEvents">;
  model?: string;
  request?: unknown;
  response?: unknown;
  providerMetadata?: unknown;
  usage?: unknown;
}) {
  return {
    model: args.model,
    request: {
      eventId: String(args.event._id),
      eventKey: args.event.eventKey,
      eventType: args.event.eventType,
      sourceType: args.event.sourceType,
      sourceId: args.event.sourceId,
      payload: args.event.payload,
      distillation: args.request,
    },
    response: args.response,
    providerMetadata: args.providerMetadata,
    usage: args.usage,
  };
}

export const getMemoryWorkflowEventByIdInternal = internalQuery({
  args: {
    eventId: v.id("memoryWorkflowEvents"),
  },
  handler: async (ctx, { eventId }) => {
    return await ctx.db.get(eventId);
  },
});

export const getLatestPlanForProspectInternal = internalQuery({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const plans = await ctx.db
      .query("outreachPlans")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .collect();

    return plans.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  },
});

export const claimMemoryWorkflowEventForEvaluationInternal = internalMutation({
  args: {
    eventId: v.id("memoryWorkflowEvents"),
    workflowId: v.string(),
  },
  handler: async (ctx, { eventId, workflowId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) {
      return { status: "missing" as const };
    }

    if (event.status === "processed" || event.status === "ignored") {
      return { status: "terminal" as const };
    }

    if (
      event.status === "processing" &&
      event.evaluatorWorkflowId &&
      event.evaluatorWorkflowId !== workflowId
    ) {
      return {
        status: "already_processing" as const,
        workflowId: event.evaluatorWorkflowId,
      };
    }

    if (event.status === "failed") {
      return { status: "failed" as const };
    }

    const existingRun = await ctx.db
      .query("memoryEvaluatorRuns")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .first();
    const now = getCurrentUTCTimestamp();

    let runId = existingRun?._id;
    if (existingRun) {
      await ctx.db.patch(existingRun._id, {
        workflowId,
        status: "running",
        startedAt: existingRun.startedAt ?? now,
        completedAt: undefined,
        ignoredReason: undefined,
        error: undefined,
        updatedAt: now,
      });
    } else {
      const workspace = await ctx.db.get(event.workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found for memory evaluator run");
      }
      runId = await ctx.db.insert("memoryEvaluatorRuns", {
        workspaceId: event.workspaceId,
        eventId,
        eventKey: event.eventKey,
        eventType: event.eventType,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        workflowId,
        status: "running",
        promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
        model: undefined,
        summary: undefined,
        ignoredReason: undefined,
        error: undefined,
        promotedMemoryIds: [],
        suggestionIds: [],
        promotedMemoryCount: 0,
        suggestedMemoryCount: 0,
        queryPerformanceUpdateCount: 0,
        retrievalStats: undefined,
        startedAt: now,
        completedAt: undefined,
        updatedAt: now,
      });
    }

    await ctx.db.patch(eventId, {
      status: "processing",
      processedAt: undefined,
      evaluatorWorkflowId: workflowId,
      error: undefined,
    });

    return { status: "claimed" as const, runId };
  },
});

export const finalizeMemoryEvaluatorRunInternal = internalMutation({
  args: {
    runId: v.id("memoryEvaluatorRuns"),
    eventId: v.id("memoryWorkflowEvents"),
    status: memoryEvaluatorRunStatusValidator,
    promptVersion: v.optional(v.string()),
    model: v.optional(v.string()),
    summary: v.optional(v.string()),
    ignoredReason: v.optional(v.string()),
    error: v.optional(v.string()),
    promotedMemoryIds: v.optional(v.array(v.string())),
    suggestionIds: v.optional(v.array(v.string())),
    promotedMemoryCount: v.optional(v.number()),
    suggestedMemoryCount: v.optional(v.number()),
    queryPerformanceUpdateCount: v.optional(v.number()),
    retrievalStats: v.optional(retrievalStatsValidator),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(args.runId, {
      status: args.status,
      promptVersion: args.promptVersion,
      model: args.model,
      summary: args.summary,
      ignoredReason: args.ignoredReason,
      error: args.error,
      promotedMemoryIds: args.promotedMemoryIds,
      suggestionIds: args.suggestionIds,
      promotedMemoryCount: args.promotedMemoryCount ?? 0,
      suggestedMemoryCount: args.suggestedMemoryCount ?? 0,
      queryPerformanceUpdateCount: args.queryPerformanceUpdateCount ?? 0,
      retrievalStats: args.retrievalStats,
      completedAt: args.status === "failed" ? undefined : now,
      updatedAt: now,
    });

    const eventStatus =
      args.status === "completed"
        ? "processed"
        : args.status === "ignored"
          ? "ignored"
          : "failed";
    await ctx.db.patch(args.eventId, {
      status: eventStatus,
      processedAt: eventStatus === "failed" ? undefined : now,
      error: args.error,
    });
  },
});

export const resetMemoryWorkflowEventInternal = internalMutation({
  args: {
    eventId: v.id("memoryWorkflowEvents"),
  },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) {
      return { reset: false };
    }

    await ctx.db.patch(eventId, {
      status: "pending",
      processedAt: undefined,
      evaluatorWorkflowId: undefined,
      error: undefined,
    });
    return { reset: true };
  },
});

export const listMemoryWorkflowEventsForWorkspaceInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, limit }) => {
    return await ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_workspace_occurred_at", (q) =>
        q.eq("workspaceId", workspaceId)
      )
      .order("desc")
      .take(toListLimit(limit));
  },
});

export const buildMemoryEvaluationPlanInternal = internalAction({
  args: {
    eventId: v.id("memoryWorkflowEvents"),
  },
  handler: async (ctx, { eventId }): Promise<MemoryEvaluationPlan> => {
    const event = await ctx.runQuery(
      internal.evaluator.getMemoryWorkflowEventByIdInternal,
      {
        eventId,
      }
    );

    if (!event) {
      return {
        status: "ignored",
        ignoredReason: "missing_event",
        summary: "Memory evaluator event no longer exists.",
        promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
        drafts: [],
        queryPerformanceUpdates: [],
        retrievalStats: {
          relevantMemories: 0,
          semanticMatches: 0,
          matchedQueries: 0,
        },
      };
    }

    if (
      event.eventType === "style_backfill_completed" ||
      event.eventType === "style_content_backfill_completed" ||
      event.eventType === "style_content_batch_ready" ||
      event.eventType === "style_edit_diff_captured"
    ) {
      return await ctx.runAction(
        internal.styleAnalysisActions.buildStyleAnalysisPlan,
        {
          eventId: event._id,
        }
      );
    }

    if (!event.prospectId) {
      return {
        status: "ignored",
        ignoredReason: "no_prospect_context",
        summary: `Event ${event.eventType} has no prospect context for learning.`,
        promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
        drafts: [],
        queryPerformanceUpdates: [],
        retrievalStats: {
          relevantMemories: 0,
          semanticMatches: 0,
          matchedQueries: 0,
        },
      };
    }

    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: event.prospectId,
      }
    );
    const workspace = prospect
      ? await ctx.runQuery(internal.workspaces.getById, {
          workspaceId: prospect.workspaceId,
        })
      : null;

    if (!prospect || !workspace) {
      return {
        status: "ignored",
        ignoredReason: "missing_workspace_or_prospect",
        summary: `Event ${event.eventType} is missing workspace or prospect state.`,
        promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
        drafts: [],
        queryPerformanceUpdates: [],
        retrievalStats: {
          relevantMemories: 0,
          semanticMatches: 0,
          matchedQueries: 0,
        },
      };
    }

    const matchedKeywords = coerceStringArray(prospect.matchedKeywords);

    switch (event.eventType) {
      case "qualification_completed": {
        const learningContext = await ctx.runAction(
          internal.memory.getQualificationLearningContextInternal,
          {
            workspaceId: String(workspace._id),
            userId: String(workspace.userId),
            title: prospect.title,
            briefIntro: prospect.briefIntro,
            matchedKeywords,
            evidenceHighlights: extractEvidenceHighlights(prospect),
          }
        );
        const distillation = await distillQualificationLearningDetailed({
          workspaceName: workspace.name,
          workspaceDescription: workspace.description,
          useCaseKey: workspace.useCaseKey,
          prospectName:
            prospect.displayName || prospect.title || "Unknown prospect",
          prospectTitle: prospect.title,
          matchedKeywords,
          score:
            typeof event.payload?.score === "number"
              ? event.payload.score
              : (prospect.qualificationScore ?? 0),
          qualified:
            (isRecord(event.payload) && event.payload.qualified === true) ||
            prospect.qualificationStatus === "qualified",
          reasoning:
            (isRecord(event.payload)
              ? getStringProperty(event.payload, "reasoning")
              : undefined) ||
            prospect.matchReason ||
            "No reasoning recorded",
          evidenceHighlights: extractEvidenceHighlights(prospect),
          priorMemoryContext: learningContext.relevantMemories,
          similarQualifiedCases: learningContext.similarQualifiedCases,
          similarDisqualifiedCases: learningContext.similarDisqualifiedCases,
        });
        const queryPerformanceUpdates =
          await resolveMatchedQueryPerformanceUpdates(ctx, {
            workspaceId: workspace._id,
            matchedKeywords,
            qualifiedCountDelta:
              prospect.qualificationStatus === "qualified" ? 1 : undefined,
            lastUsedAt: getCurrentUTCTimestamp(),
          });

        return {
          status: "apply",
          summary: `Qualification evaluator distilled ${distillation.drafts.length} reusable lesson(s).`,
          promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
          model: distillation.telemetry.model,
          workspaceId: String(workspace._id),
          drafts: distillation.drafts.map((draft) => ({
            source: "qualification",
            category: draft.category,
            title: draft.title,
            summary: draft.summary,
            confidence: draft.confidence,
            impactScore: draft.impactScore ?? 0.5,
            prospectId: String(prospect._id),
            signals: draft.signals ?? [],
            evidence: draft.evidence ?? [],
            relatedQueries: draft.relatedQueries ?? matchedKeywords,
            narrative: draft.narrative ?? draft.summary,
          })),
          queryPerformanceUpdates,
          retrievalStats: {
            relevantMemories: learningContext.relevantMemories.length,
            semanticMatches:
              learningContext.similarQualifiedCases.length +
              learningContext.similarDisqualifiedCases.length,
            matchedQueries: queryPerformanceUpdates.length,
          },
          telemetry: buildTelemetryPayload({
            event,
            model: distillation.telemetry.model,
            request: distillation.telemetry.request,
            response: distillation.telemetry.response,
            providerMetadata: distillation.telemetry.providerMetadata,
            usage: distillation.telemetry.usage,
          }),
        };
      }

      case "enrichment_completed": {
        const relatedMemoryContext = await ctx.runQuery(
          internal.memory.findRelevantBuiltInAgentMemoriesInternal,
          {
            userId: String(workspace.userId),
            workspaceId: String(workspace._id),
            query: [
              prospect.title || "",
              prospect.briefIntro || "",
              prospect.finance?.displayValue || "",
              ...extractPainPoints(prospect),
            ]
              .filter((value) => value.length > 0)
              .join(" "),
            limit: 5,
          }
        );
        const distillation = await distillEnrichmentLearningDetailed({
          workspaceName: workspace.name,
          workspaceDescription: workspace.description,
          useCaseKey: workspace.useCaseKey,
          prospectName:
            prospect.displayName || prospect.title || "Unknown prospect",
          prospectTitle: prospect.title,
          prospectType: prospect.prospectType,
          briefIntro: prospect.briefIntro,
          financeSummary: prospect.finance?.displayValue,
          painPoints: extractPainPoints(prospect),
          relatedMemoryContext: relatedMemoryContext.map(
            (memory: { promptLine: string }) => memory.promptLine
          ),
        });

        return {
          status: "apply",
          summary: `Enrichment evaluator distilled ${distillation.drafts.length} reusable lesson(s).`,
          promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
          model: distillation.telemetry.model,
          workspaceId: String(workspace._id),
          drafts: distillation.drafts.map((draft) => ({
            source: "enrichment",
            category: draft.category,
            title: draft.title,
            summary: draft.summary,
            confidence: draft.confidence,
            impactScore: draft.impactScore ?? 0.5,
            prospectId: String(prospect._id),
            signals: draft.signals ?? [],
            evidence: draft.evidence ?? [],
            relatedQueries: draft.relatedQueries ?? matchedKeywords,
            narrative: draft.narrative ?? draft.summary,
          })),
          queryPerformanceUpdates: [],
          retrievalStats: {
            relevantMemories: relatedMemoryContext.length,
            semanticMatches: 0,
            matchedQueries: matchedKeywords.length,
          },
          telemetry: buildTelemetryPayload({
            event,
            model: distillation.telemetry.model,
            request: distillation.telemetry.request,
            response: distillation.telemetry.response,
            providerMetadata: distillation.telemetry.providerMetadata,
            usage: distillation.telemetry.usage,
          }),
        };
      }

      case "prospect_responded":
      case "prospect_converted":
      case "outreach_plan_abandoned":
      case "outreach_task_completed":
      case "outreach_task_failed":
      case "prospect_archived": {
        if (event.eventType === "prospect_archived") {
          const previousStatus = isRecord(event.payload)
            ? getStringProperty(event.payload, "previousStatus")
            : undefined;
          if (
            previousStatus !== "contacted" &&
            previousStatus !== "in_progress" &&
            previousStatus !== "converted"
          ) {
            return {
              status: "ignored",
              ignoredReason: "archive_without_outreach_context",
              summary:
                "Archived prospect did not have prior outreach context, so no outreach learning was promoted.",
              promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
              drafts: [],
              queryPerformanceUpdates: [],
              retrievalStats: {
                relevantMemories: 0,
                semanticMatches: 0,
                matchedQueries: matchedKeywords.length,
              },
            };
          }
        }

        const outreachContext = await ctx.runAction(
          internal.memory.getOutreachLearningContextInternal,
          {
            workspaceId: String(workspace._id),
            userId: String(workspace.userId),
            title: prospect.title,
            briefIntro: prospect.briefIntro,
            painPoints: extractPainPoints(prospect),
            matchedKeywords,
            finance: prospect.finance?.displayValue,
          }
        );
        const plan = event.planId
          ? await ctx.runQuery(internal.outreach.getPlanInternal, {
              planId: event.planId,
            })
          : null;
        const fallbackPlan =
          !plan && event.prospectId
            ? await ctx.runQuery(
                internal.evaluator.getLatestPlanForProspectInternal,
                {
                  prospectId: event.prospectId,
                }
              )
            : null;
        const planDoc = plan?.plan ?? fallbackPlan;
        const task = event.taskId
          ? await ctx.runQuery(internal.outreach.getTaskInternal, {
              taskId: event.taskId,
            })
          : null;
        const outcome =
          event.eventType === "prospect_converted"
            ? "converted"
            : event.eventType === "prospect_responded"
              ? "responded"
              : event.eventType === "outreach_plan_abandoned"
                ? "plan_abandoned"
                : event.eventType === "outreach_task_completed"
                  ? "task_completed"
                  : event.eventType === "outreach_task_failed"
                    ? "task_failed"
                    : "archived";
        const distillation = await distillOutreachLearningDetailed({
          workspaceName: workspace.name,
          workspaceDescription: workspace.description,
          useCaseKey: workspace.useCaseKey,
          prospectName:
            prospect.displayName || prospect.title || "Unknown prospect",
          prospectTitle: prospect.title,
          briefIntro: prospect.briefIntro,
          financeSummary: prospect.finance?.displayValue,
          painPoints: extractPainPoints(prospect),
          matchedKeywords,
          outcome,
          planRationale: planDoc?.strategy.rationale,
          planTone: planDoc?.strategy.tone,
          taskType: task?.type,
          taskContent: extractTaskContent(task),
          responseText: extractTaskResponseText(task),
          failureReason: extractTaskFailureReason(task),
          relevantMemories: outreachContext.relevantMemories,
          winningPatterns: outreachContext.winningPatterns,
          objections: outreachContext.objections,
          similarCases: outreachContext.similarCases,
        });
        const queryPerformanceUpdates =
          await resolveMatchedQueryPerformanceUpdates(ctx, {
            workspaceId: workspace._id,
            matchedKeywords,
            replyCountDelta:
              event.eventType === "prospect_responded" ? 1 : undefined,
            convertedCountDelta:
              event.eventType === "prospect_converted" ? 1 : undefined,
            lastUsedAt: getCurrentUTCTimestamp(),
          });

        return {
          status: "apply",
          summary: `Outreach evaluator distilled ${distillation.drafts.length} reusable lesson(s).`,
          promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
          model: distillation.telemetry.model,
          workspaceId: String(workspace._id),
          drafts: distillation.drafts.map((draft) => ({
            source: "outreach",
            category: draft.category,
            title: draft.title,
            summary: draft.summary,
            confidence: draft.confidence,
            impactScore: draft.impactScore ?? 0.5,
            prospectId: String(prospect._id),
            planId: planDoc ? String(planDoc._id) : undefined,
            taskId: task ? String(task._id) : undefined,
            threadId: planDoc?.threadId,
            signals: draft.signals ?? [],
            evidence: draft.evidence ?? [],
            relatedQueries: draft.relatedQueries ?? matchedKeywords,
            narrative: draft.narrative ?? draft.summary,
          })),
          queryPerformanceUpdates,
          retrievalStats: {
            relevantMemories: outreachContext.relevantMemories.length,
            semanticMatches:
              outreachContext.winningPatterns.length +
              outreachContext.objections.length +
              outreachContext.similarCases.length,
            matchedQueries: queryPerformanceUpdates.length,
          },
          telemetry: buildTelemetryPayload({
            event,
            model: distillation.telemetry.model,
            request: distillation.telemetry.request,
            response: distillation.telemetry.response,
            providerMetadata: distillation.telemetry.providerMetadata,
            usage: distillation.telemetry.usage,
          }),
        };
      }

      case "outreach_plan_approved":
      case "outreach_task_approved":
        return {
          status: "ignored",
          ignoredReason: "audit_only_event",
          summary: `Event ${event.eventType} is retained for auditability and downstream UX, but it is not promoted until stronger outcome evidence exists.`,
          promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
          drafts: [],
          queryPerformanceUpdates: [],
          retrievalStats: {
            relevantMemories: 0,
            semanticMatches: 0,
            matchedQueries: matchedKeywords.length,
          },
        };

      default:
        return {
          status: "ignored",
          ignoredReason: "unsupported_event_type",
          summary: `Event ${event.eventType} is not handled by the memory evaluator.`,
          promptVersion: MEMORY_EVALUATOR_PROMPT_VERSION,
          drafts: [],
          queryPerformanceUpdates: [],
          retrievalStats: {
            relevantMemories: 0,
            semanticMatches: 0,
            matchedQueries: matchedKeywords.length,
          },
        };
    }
  },
});

export const indexPromotedAgentMemoryInternal = internalAction({
  args: {
    workspaceId: v.string(),
    category: workspaceMemoryCategoryValidator,
    source: workspaceMemorySourceValidator,
    memoryId: v.string(),
    memoryText: v.string(),
    title: v.string(),
    importance: v.number(),
    prospectId: v.optional(v.string()),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const attempt = args.attempt ?? 0;
    const namespace = categoryToNamespace(
      args.category as WorkspaceMemoryCategory
    );
    const key = [
      "workspace-memory",
      args.workspaceId,
      namespace,
      createStableHash(args.memoryText),
    ].join(":");

    const indexResult = await indexWorkspaceMemoryDocument(ctx, {
      workspaceId: args.workspaceId,
      namespace,
      key,
      title: args.title,
      text: args.memoryText,
      importance: args.importance,
      prospectId: args.prospectId,
      memoryItemId: args.memoryId,
      category: args.category,
      source: args.source,
    });

    if (indexResult.indexed) {
      return { indexed: true };
    }

    const shouldRetry = indexResult.retryable && attempt < 3;
    if (shouldRetry) {
      const delayMs = 1_000 * 2 ** attempt;
      await ctx.scheduler.runAfter(
        delayMs,
        internal.evaluator.indexPromotedAgentMemoryInternal,
        {
          workspaceId: args.workspaceId,
          category: args.category,
          source: args.source,
          memoryId: args.memoryId,
          memoryText: args.memoryText,
          title: args.title,
          importance: args.importance,
          prospectId: args.prospectId,
          attempt: attempt + 1,
        }
      );
      return { indexed: false, retryScheduled: true };
    }

    console.warn(
      `[RAG] Failed to index workspace memory ${key}:`,
      indexResult.error ?? "Unknown error"
    );
    return {
      indexed: false,
      retryScheduled: false,
      error: indexResult.error,
    };
  },
});

export const applyMemoryEvaluationPlanInternal = internalMutation({
  args: {
    runId: v.id("memoryEvaluatorRuns"),
    eventId: v.id("memoryWorkflowEvents"),
    workspaceId: v.id("workspaces"),
    promptVersion: v.string(),
    model: v.optional(v.string()),
    summary: v.optional(v.string()),
    drafts: v.array(memoryDraftValidator),
    queryPerformanceUpdates: v.array(queryPerformanceUpdateValidator),
    retrievalStats: retrievalStatsValidator,
    telemetryRequest: v.optional(v.any()),
    telemetryResponse: v.optional(v.any()),
    telemetryProviderMetadata: v.optional(v.any()),
    telemetryUsage: v.optional(v.any()),
    styleMetadata: v.optional(
      v.object({
        platform: v.union(v.literal("twitter"), v.literal("linkedin")),
        sourceVersion: v.number(),
        sourceExternalUserId: v.string(),
        sampleCount: v.number(),
        editDiffCount: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Memory workflow event not found");
    }
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const promotedMemoryIds: string[] = [];
    const suggestionIds: string[] = [];
    let promotedStyleMemoryId: string | null = null;
    let styleSourceStillActive = true;

    if (args.styleMetadata) {
      if (args.styleMetadata.platform === "twitter") {
        const xAccount = await ctx.db
          .query("xAccounts")
          .withIndex("by_user", (q) => q.eq("userId", workspace.userId))
          .first();
        styleSourceStillActive =
          xAccount !== null &&
          isActiveStyleSource(xAccount, {
            platform: "twitter",
            sourceVersion: args.styleMetadata.sourceVersion,
            sourceExternalUserId: args.styleMetadata.sourceExternalUserId,
          });
      } else {
        const linkedInAccount = await ctx.db
          .query("linkedinAccounts")
          .withIndex("by_user", (q) => q.eq("userId", workspace.userId))
          .first();
        styleSourceStillActive =
          linkedInAccount !== null &&
          isActiveStyleSource(linkedInAccount, {
            platform: "linkedin",
            sourceVersion: args.styleMetadata.sourceVersion,
            sourceExternalUserId: args.styleMetadata.sourceExternalUserId,
          });
      }
    }

    for (const draft of args.drafts) {
      const shouldPromoteStyleProfile =
        args.styleMetadata !== undefined &&
        draft.category === getStyleMemoryCategory(args.styleMetadata.platform);
      if (shouldPromoteStyleProfile && !styleSourceStillActive) {
        continue;
      }
      if (
        (shouldPromoteStyleProfile && styleSourceStillActive) ||
        shouldAutoPromoteMemory({
          confidence: draft.confidence,
          impactScore: draft.impactScore,
        })
      ) {
        const promoted = await promoteAgentMemory(ctx.db, {
          userId: String(workspace.userId),
          workspaceId: String(args.workspaceId),
          category: draft.category as WorkspaceMemoryCategory,
          namespace: categoryToNamespace(
            draft.category as WorkspaceMemoryCategory
          ),
          source: draft.source as WorkspaceMemorySource,
          title: draft.title,
          summary: draft.summary,
          confidence: draft.confidence,
          impactScore: draft.impactScore,
          prospectId: draft.prospectId,
          threadId: draft.threadId,
          signals: draft.signals,
          evidence: draft.evidence,
          relatedQueries: draft.relatedQueries,
          narrative: draft.narrative,
        });
        promotedMemoryIds.push(promoted.memoryId);
        if (isStyleMemoryCategory(draft.category)) {
          promotedStyleMemoryId = promoted.memoryId;
        }
        await ctx.scheduler.runAfter(
          0,
          internal.evaluator.indexPromotedAgentMemoryInternal,
          {
            workspaceId: String(args.workspaceId),
            category: draft.category,
            source: draft.source,
            memoryId: promoted.memoryId,
            memoryText: promoted.memoryText,
            title: promoted.parsed.title,
            importance: promoted.parsed.impactScore,
            prospectId: draft.prospectId,
          }
        );
        continue;
      }

      const identityHash = buildMemorySuggestionIdentityHash({
        workspaceId: String(args.workspaceId),
        eventKey: event.eventKey,
        category: draft.category,
        title: draft.title,
        summary: draft.summary,
      });
      const existingSuggestion = await ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_identity_hash", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("identityHash", identityHash)
        )
        .first();

      if (existingSuggestion) {
        await ctx.db.patch(existingSuggestion._id, {
          runId: String(args.runId),
          confidence: draft.confidence,
          impactScore: draft.impactScore,
          signals: draft.signals,
          evidence: draft.evidence,
          relatedQueries: draft.relatedQueries,
          narrative: draft.narrative,
          updatedAt: now,
        });
        suggestionIds.push(String(existingSuggestion._id));
        continue;
      }

      const suggestionId = await ctx.db.insert("memorySuggestions", {
        workspaceId: args.workspaceId,
        eventId: args.eventId,
        runId: String(args.runId),
        source: draft.source,
        category: draft.category,
        identityHash,
        title: draft.title,
        summary: draft.summary,
        confidence: draft.confidence,
        impactScore: draft.impactScore,
        prospectId: draft.prospectId
          ? (draft.prospectId as Id<"prospects">)
          : undefined,
        planId: draft.planId
          ? (draft.planId as Id<"outreachPlans">)
          : undefined,
        taskId: draft.taskId
          ? (draft.taskId as Id<"outreachTasks">)
          : undefined,
        signals: draft.signals,
        evidence: draft.evidence,
        relatedQueries: draft.relatedQueries,
        narrative: draft.narrative,
        status: "pending_review",
        promotedMemoryId: undefined,
        reviewedAt: undefined,
        updatedAt: now,
      });
      suggestionIds.push(String(suggestionId));
    }

    for (const update of args.queryPerformanceUpdates) {
      await upsertQueryPerformanceRecord(ctx.db, {
        workspaceId: args.workspaceId,
        queryId: update.queryId as Id<"keywords">,
        canonicalValue: update.canonicalValue,
        canonicalHash: update.canonicalHash,
        activatedQueryCandidateId: update.activatedQueryCandidateId as
          | Id<"queryCandidates">
          | undefined,
        qualifiedCountDelta: update.qualifiedCountDelta,
        replyCountDelta: update.replyCountDelta,
        convertedCountDelta: update.convertedCountDelta,
        lastUsedAt: update.lastUsedAt,
      });
    }

    if (promotedStyleMemoryId && args.styleMetadata) {
      await ctx.runMutation(
        internal.styleAnalysis.finalizeStyleProfilePromotion,
        {
          workspaceId: args.workspaceId,
          userId: workspace.userId,
          platform: args.styleMetadata.platform,
          sourceVersion: args.styleMetadata.sourceVersion,
          promotedMemoryId: promotedStyleMemoryId,
          sampleCount: args.styleMetadata.sampleCount,
          editDiffCount: args.styleMetadata.editDiffCount,
        }
      );
    }

    if (args.model || args.telemetryUsage) {
      const sanitizedUsage = sanitizeTelemetryPayload(args.telemetryUsage);
      await ctx.db.insert("agentUsageEvents", {
        userId: String(workspace.userId),
        threadId: undefined,
        agentName: "Memory Evaluator",
        model: args.model,
        provider: "openrouter",
        usage: isRecord(sanitizedUsage)
          ? (sanitizedUsage as {
              inputTokens?: number;
              outputTokens?: number;
              totalTokens?: number;
              reasoningTokens?: number;
              cachedInputTokens?: number;
            })
          : {},
        providerMetadata: sanitizeProviderMetadataForConvex(
          args.telemetryProviderMetadata
        ),
        recordedAt: now,
      });
    }

    if (args.telemetryRequest || args.telemetryResponse) {
      await ctx.db.insert("agentRawResponses", {
        userId: String(workspace.userId),
        threadId: undefined,
        agentName: "Memory Evaluator",
        request: sanitizeTelemetryPayload(args.telemetryRequest),
        response: sanitizeTelemetryPayload(args.telemetryResponse),
        providerMetadata: sanitizeProviderMetadataForConvex(
          args.telemetryProviderMetadata
        ),
        recordedAt: now,
      });
    }

    return {
      promotedMemoryIds,
      suggestionIds,
      promotedMemoryCount: promotedMemoryIds.length,
      suggestedMemoryCount: suggestionIds.length,
      queryPerformanceUpdateCount: args.queryPerformanceUpdates.length,
    };
  },
});

export const listWorkspaceMemorySuggestions = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(memorySuggestionStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, status, limit }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Workspace not found",
    });

    if (status) {
      return await ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", status)
        )
        .order("desc")
        .take(toListLimit(limit));
    }

    const rows = await Promise.all([
      ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "pending_review")
        )
        .order("desc")
        .take(MAX_LIST_LIMIT),
      ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "promoted")
        )
        .order("desc")
        .take(MAX_LIST_LIMIT),
      ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "rejected")
        )
        .order("desc")
        .take(MAX_LIST_LIMIT),
    ]);

    return rows
      .flat()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, toListLimit(limit));
  },
});

export const listWorkspaceMemoryEvaluatorRuns = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(memoryEvaluatorRunStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, status, limit }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Workspace not found",
    });

    const rows = status
      ? await ctx.db
          .query("memoryEvaluatorRuns")
          .withIndex("by_workspace_status_updated_at", (q) =>
            q.eq("workspaceId", workspaceId).eq("status", status)
          )
          .order("desc")
          .take(toListLimit(limit))
      : await ctx.db
          .query("memoryEvaluatorRuns")
          .withIndex("by_workspace_updated_at", (q) =>
            q.eq("workspaceId", workspaceId)
          )
          .order("desc")
          .take(toListLimit(limit));

    return rows;
  },
});

export const retryWorkspaceMemoryEvaluations = action({
  args: {
    workspaceId: v.id("workspaces"),
    includeFailed: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { workspaceId, includeFailed, limit }
  ): Promise<{ scheduledCount: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId,
    });
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const rows: Doc<"memoryWorkflowEvents">[] = await ctx.runQuery(
      internal.evaluator.listMemoryWorkflowEventsForWorkspaceInternal,
      {
        workspaceId,
        limit: toListLimit(limit),
      }
    );
    const candidates: Doc<"memoryWorkflowEvents">[] = rows.filter((event) =>
      includeFailed
        ? event.status === "pending" || event.status === "failed"
        : event.status === "pending"
    );

    for (const event of candidates) {
      if (event.status === "failed") {
        await ctx.runMutation(
          internal.evaluator.resetMemoryWorkflowEventInternal,
          {
            eventId: event._id,
          }
        );
      }
    }

    if (candidates.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.memory.enqueueWorkspaceMemoryEvaluationInternal,
        {
          workspaceId,
        }
      );
    }

    return {
      scheduledCount: candidates.length,
    };
  },
});

export const reviewMemorySuggestion = mutation({
  args: {
    suggestionId: v.id("memorySuggestions"),
    action: v.union(v.literal("promote"), v.literal("reject")),
  },
  handler: async (ctx, { suggestionId, action }) => {
    const user = await requireUser(ctx);
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) {
      throw new Error("Memory suggestion not found");
    }
    const workspace = await ctx.db.get(suggestion.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Memory suggestion not found");
    }

    if (suggestion.status !== "pending_review") {
      return {
        status: suggestion.status,
        promotedMemoryId: suggestion.promotedMemoryId ?? null,
      };
    }

    const now = getCurrentUTCTimestamp();
    if (action === "reject") {
      await ctx.db.patch(suggestionId, {
        status: "rejected",
        reviewedAt: now,
        updatedAt: now,
      });
      return { status: "rejected", promotedMemoryId: null };
    }

    const threadId = await resolveSuggestionThreadId(ctx.db, suggestion);
    const promoted = await promoteAgentMemory(ctx.db, {
      userId: String(workspace.userId),
      workspaceId: String(suggestion.workspaceId),
      category: suggestion.category as WorkspaceMemoryCategory,
      namespace: categoryToNamespace(
        suggestion.category as WorkspaceMemoryCategory
      ),
      source: suggestion.source as WorkspaceMemorySource,
      title: suggestion.title,
      summary: suggestion.summary,
      confidence: suggestion.confidence,
      impactScore: suggestion.impactScore,
      prospectId: suggestion.prospectId
        ? String(suggestion.prospectId)
        : undefined,
      threadId,
      signals: suggestion.signals,
      evidence: suggestion.evidence,
      relatedQueries: suggestion.relatedQueries,
      narrative: suggestion.narrative,
    });
    await ctx.db.patch(suggestionId, {
      status: "promoted",
      promotedMemoryId: promoted.memoryId,
      reviewedAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.evaluator.indexPromotedAgentMemoryInternal,
      {
        workspaceId: String(suggestion.workspaceId),
        category: suggestion.category,
        source: suggestion.source,
        memoryId: promoted.memoryId,
        memoryText: promoted.memoryText,
        title: promoted.parsed.title,
        importance: promoted.parsed.impactScore,
        prospectId: suggestion.prospectId
          ? String(suggestion.prospectId)
          : undefined,
      }
    );

    return { status: "promoted", promotedMemoryId: promoted.memoryId };
  },
});
