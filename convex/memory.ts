import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { ActionCtx as ConvexActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { agentMemoryRag, getWorkspaceNamespace } from "./agents/outreach/rag";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./lib/functionBuilders";
import {
  recordMemoryWorkflowEvent,
  upsertQueryCandidateRecord,
  upsertQueryPerformanceRecord,
} from "./lib/memoryCore";
import {
  buildKeywordCanonicalRecord,
  buildQueryCandidateCanonicalRecord,
  createStableHash,
  getNamespaceKindForQueryCandidate,
} from "./lib/memoryHelpers";
import {
  type AgentMemoryPromotionResult,
  categoryToNamespace,
  findRelevantAgentMemories,
  promoteAgentMemory,
  type ParsedAgentMemory,
  type WorkspaceMemoryCategory,
} from "./lib/agentMemoryCore";
import {
  distillEnrichmentLearning,
  distillQualificationLearning,
} from "./lib/learningCore";
import {
  indexProspectSearchListEntry,
  indexWorkspaceMemoryDocument,
  indexWorkspaceProspectSummary,
  indexWorkspaceQueryCandidate,
} from "./lib/ragIndexing";
import {
  memorySourceTypeValidator,
  memoryWorkflowEventStatusValidator,
  memoryWorkflowEventTypeValidator,
  queryCandidateDuplicateReasonValidator,
  queryCandidateStatusValidator,
  queryCandidateTypeValidator,
} from "./validators";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import type { WorkspaceUseCaseKey } from "../shared/lib/workspaceUseCases";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const DISCOVERY_CONTEXT_LIMIT = 6;
const DISCOVERY_SEMANTIC_DUPLICATE_THRESHOLD = 0.92;

type WorkspaceSemanticMatch = {
  score: number;
  text: string;
  title: string | null;
  promptLine: string;
};

type QualificationLearningContext = {
  queryText: string;
  relevantMemories: string[];
  similarQualifiedCases: string[];
  similarDisqualifiedCases: string[];
};

type OutreachLearningContext = {
  queryText: string;
  relevantMemories: string[];
  winningPatterns: string[];
  objections: string[];
  similarCases: string[];
};

function toListLimit(limit?: number): number {
  const normalized =
    typeof limit === "number" ? Math.floor(limit) : DEFAULT_LIST_LIMIT;
  return Math.min(MAX_LIST_LIMIT, Math.max(1, normalized));
}

function matchesOptionalFilter<T extends string>(
  value: T,
  filter: T | undefined
): boolean {
  return filter ? value === filter : true;
}

function calculateQueryPerformanceRank(row: Doc<"queryPerformance">): number {
  return (
    row.convertedCount * 100 +
    row.replyCount * 25 +
    row.qualifiedCount * 10 +
    row.prospectsFound * 2 +
    row.replyRate +
    row.qualificationRate
  );
}

function formatParsedMemoryForPrompt(memory: ParsedAgentMemory): string {
  return `${memory.title}: ${memory.summary} (confidence ${memory.confidence.toFixed(2)}, impact ${memory.impactScore.toFixed(2)})`;
}

function formatSemanticMemoryMatch(match: {
  text: string;
  title: string | null;
}): string {
  if (match.title) {
    return `${match.title}: ${match.text}`;
  }

  return match.text;
}

function buildWorkspaceMemorySearchQuery(args: {
  title?: string | null;
  briefIntro?: string | null;
  matchedKeywords?: string[];
  painPoints?: string[];
  finance?: string | null;
  additionalContext?: string[];
}): string {
  return [
    args.title ?? "",
    args.briefIntro ?? "",
    args.finance ?? "",
    ...(args.matchedKeywords ?? []),
    ...(args.painPoints ?? []),
    ...(args.additionalContext ?? []),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(" ");
}

function hasWorkspaceMemorySearchQuery(query: string): boolean {
  return query.trim().length > 0;
}

function buildWorkspaceProspectSummaryText(args: {
  displayName: string;
  title?: string | null;
  briefIntro?: string | null;
  qualificationStatus?: string | null;
  qualificationScore?: number | null;
  matchedKeywords?: string[];
  painPoints?: string[];
  finance?: string | null;
  reasoning?: string | null;
}): string {
  return [
    `Prospect: ${args.displayName}`,
    args.title ? `Title: ${args.title}` : null,
    args.briefIntro ? `Intro: ${args.briefIntro}` : null,
    args.qualificationStatus
      ? `Qualification: ${args.qualificationStatus}${typeof args.qualificationScore === "number" ? ` (${args.qualificationScore})` : ""}`
      : null,
    args.matchedKeywords && args.matchedKeywords.length > 0
      ? `Matched keywords: ${args.matchedKeywords.join(", ")}`
      : null,
    args.painPoints && args.painPoints.length > 0
      ? `Pain points: ${args.painPoints.join("; ")}`
      : null,
    args.finance ? `Finance: ${args.finance}` : null,
    args.reasoning ? `Why it mattered: ${args.reasoning}` : null,
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}

async function persistWorkspaceMemoryDraft(
  ctx: ConvexActionCtx,
  args: {
    userId: string;
    workspaceId: string;
    category: WorkspaceMemoryCategory;
    source: "qualification" | "enrichment" | "outreach" | "operator";
    title: string;
    summary: string;
    confidence: number;
    impactScore?: number;
    prospectId?: string;
    threadId?: string;
    signals?: string[];
    evidence?: string[];
    relatedQueries?: string[];
    narrative?: string;
  }
): Promise<AgentMemoryPromotionResult> {
  const inserted = await ctx.runMutation(
    internal.memory.insertBuiltInAgentMemoryInternal,
    args
  );
  const namespace = categoryToNamespace(args.category);
  const key = [
    "workspace-memory",
    args.workspaceId,
    namespace,
    createStableHash(inserted.memoryText),
  ].join(":");

  await indexWorkspaceMemoryDocument(ctx, {
    workspaceId: args.workspaceId,
    namespace,
    key,
    title: inserted.parsed.title,
    text: inserted.memoryText,
    importance: inserted.parsed.impactScore,
    prospectId: args.prospectId,
    memoryItemId: inserted.memoryId,
    category: args.category,
    source: args.source,
  });

  return inserted;
}

export const getQueryCandidateByIdInternal = internalQuery({
  args: {
    queryCandidateId: v.id("queryCandidates"),
  },
  handler: async (ctx, { queryCandidateId }) => {
    return await ctx.db.get(queryCandidateId);
  },
});

export const getQueryCandidateByCanonicalKeyInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    canonicalKey: v.string(),
  },
  handler: async (ctx, { workspaceId, canonicalKey }) => {
    return await ctx.db
      .query("queryCandidates")
      .withIndex("by_workspace_canonical_key", (q) =>
        q.eq("workspaceId", workspaceId).eq("canonicalKey", canonicalKey)
      )
      .first();
  },
});

export const getDiscoveryGenerationContextInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const [
      topPerformers,
      activeCandidates,
      exactRejected,
      semanticRejected,
      lowNoveltyRejected,
      retiredCandidates,
      prospectSummaries,
    ] = await Promise.all([
      ctx.db
        .query("queryPerformance")
        .withIndex("by_workspace_updated_at", (q) =>
          q.eq("workspaceId", workspaceId)
        )
        .order("desc")
        .take(MAX_LIST_LIMIT),
      ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "activated")
        )
        .collect(),
      ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_status", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("status", "rejected_exact_duplicate")
        )
        .collect(),
      ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_status", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("status", "rejected_semantic_duplicate")
        )
        .collect(),
      ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "rejected_low_novelty")
        )
        .collect(),
      ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "retired")
        )
        .collect(),
      ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_ready_score", (q) =>
          q.eq("workspaceId", workspaceId).eq("readyQualifiedEnriched", true)
        )
        .take(DISCOVERY_CONTEXT_LIMIT),
    ]);

    return {
      topPerformers: [...topPerformers]
        .sort(
          (a, b) =>
            calculateQueryPerformanceRank(b) - calculateQueryPerformanceRank(a)
        )
        .slice(0, DISCOVERY_CONTEXT_LIMIT)
        .map((row) => ({
          canonicalValue: row.canonicalValue,
          prospectsFound: row.prospectsFound,
          qualifiedCount: row.qualifiedCount,
          convertedCount: row.convertedCount,
          replyCount: row.replyCount,
          replyRate: row.replyRate,
          qualificationRate: row.qualificationRate,
        })),
      activeQueryCount: activeCandidates.length,
      rejectionSummary: {
        exactDuplicates: exactRejected.length,
        semanticDuplicates: semanticRejected.length,
        lowNovelty: lowNoveltyRejected.length,
      },
      recentRejected: [
        ...exactRejected,
        ...semanticRejected,
        ...lowNoveltyRejected,
      ]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, DISCOVERY_CONTEXT_LIMIT)
        .map((candidate) => ({
          rawValue: candidate.rawValue,
          sourceTheme: candidate.sourceTheme,
          status: candidate.status,
          duplicateReason: candidate.duplicateReason,
          noveltyScore: candidate.noveltyScore ?? null,
        })),
      retired: retiredCandidates
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, DISCOVERY_CONTEXT_LIMIT)
        .map((candidate) => ({
          rawValue: candidate.rawValue,
          sourceTheme: candidate.sourceTheme,
          retiredAt: candidate.retiredAt ?? null,
        })),
      promotedDiscoveryMemories: [],
      recentWinningProspects: prospectSummaries.map((summary) => ({
        displayName: summary.displayName,
        title: summary.title ?? null,
        briefIntro: summary.briefIntro ?? null,
        matchedKeywords: summary.matchedKeywords ?? [],
        qualificationScore: summary.qualificationScore ?? null,
      })),
    };
  },
});

export const upsertQueryCandidateInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: queryCandidateTypeValidator,
    rawValue: v.string(),
    sourceTheme: v.optional(v.string()),
    sourceRunId: v.optional(v.string()),
    noveltyScore: v.optional(v.number()),
    status: v.optional(queryCandidateStatusValidator),
    duplicateReason: v.optional(queryCandidateDuplicateReasonValidator),
    performanceScore: v.optional(v.number()),
    activatedKeywordId: v.optional(v.id("keywords")),
    embeddingDocKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await upsertQueryCandidateRecord(ctx.db, args);
    await ctx.scheduler.runAfter(
      0,
      internal.memory.indexQueryCandidateInternal,
      {
        queryCandidateId: result.queryCandidateId,
      }
    );
    return result;
  },
});

export const upsertQueryPerformanceInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    queryId: v.id("keywords"),
    canonicalValue: v.string(),
    canonicalHash: v.string(),
    activatedQueryCandidateId: v.optional(v.id("queryCandidates")),
    impressionsDelta: v.optional(v.number()),
    prospectsFoundDelta: v.optional(v.number()),
    qualifiedCountDelta: v.optional(v.number()),
    convertedCountDelta: v.optional(v.number()),
    replyCountDelta: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    retiredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await upsertQueryPerformanceRecord(ctx.db, args);
  },
});

export const recordMemoryWorkflowEventInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    eventType: memoryWorkflowEventTypeValidator,
    sourceType: memorySourceTypeValidator,
    sourceId: v.string(),
    workflowName: v.optional(v.string()),
    status: v.optional(memoryWorkflowEventStatusValidator),
    prospectId: v.optional(v.id("prospects")),
    planId: v.optional(v.id("outreachPlans")),
    taskId: v.optional(v.id("outreachTasks")),
    queryCandidateId: v.optional(v.id("queryCandidates")),
    queryId: v.optional(v.id("keywords")),
    payload: v.optional(v.any()),
    eventKey: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await recordMemoryWorkflowEvent(ctx, args);
  },
});

export const insertBuiltInAgentMemoryInternal = internalMutation({
  args: {
    userId: v.string(),
    workspaceId: v.string(),
    category: v.string(),
    source: v.string(),
    title: v.string(),
    summary: v.string(),
    confidence: v.number(),
    impactScore: v.optional(v.number()),
    prospectId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    signals: v.optional(v.array(v.string())),
    evidence: v.optional(v.array(v.string())),
    relatedQueries: v.optional(v.array(v.string())),
    narrative: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await promoteAgentMemory(ctx.db, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      category: args.category as WorkspaceMemoryCategory,
      namespace: categoryToNamespace(args.category as WorkspaceMemoryCategory),
      source: args.source as
        | "qualification"
        | "enrichment"
        | "outreach"
        | "operator",
      title: args.title,
      summary: args.summary,
      confidence: args.confidence,
      impactScore: args.impactScore,
      prospectId: args.prospectId,
      threadId: args.threadId,
      signals: args.signals,
      evidence: args.evidence,
      relatedQueries: args.relatedQueries,
      narrative: args.narrative,
    });
  },
});

export const findRelevantBuiltInAgentMemoriesInternal = internalQuery({
  args: {
    userId: v.string(),
    workspaceId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
    categories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const matches = await findRelevantAgentMemories(ctx.db, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      query: args.query,
      limit: args.limit ?? 5,
      categories: args.categories as WorkspaceMemoryCategory[] | undefined,
    });

    return matches.map((match) => ({
      memoryId: match.memoryId,
      createdAt: match.createdAt,
      relevanceScore: match.relevanceScore,
      parsed: match.parsed,
      promptLine: formatParsedMemoryForPrompt(match.parsed),
    }));
  },
});

export const searchWorkspaceMemoryNamespaceInternal = internalAction({
  args: {
    workspaceId: v.string(),
    namespace: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { workspaceId, namespace, query, limit }
  ): Promise<{
    matches: WorkspaceSemanticMatch[];
  }> => {
    if (!hasWorkspaceMemorySearchQuery(query)) {
      return { matches: [] };
    }

    try {
      const result = await agentMemoryRag.search(ctx, {
        namespace: getWorkspaceNamespace(
          workspaceId,
          namespace as Parameters<typeof getWorkspaceNamespace>[1]
        ),
        query,
        limit: limit ?? 3,
      });

      return {
        matches: result.results
          .slice(0, limit ?? 3)
          .map((entry): WorkspaceSemanticMatch => {
            const text = entry.content.map((chunk) => chunk.text).join("\n");
            return {
              score: entry.score,
              text,
              title: null,
              promptLine: formatSemanticMemoryMatch({
                text,
                title: null,
              }),
            };
          }),
      };
    } catch {
      return { matches: [] };
    }
  },
});

export const getQualificationLearningContextInternal = internalAction({
  args: {
    workspaceId: v.string(),
    userId: v.string(),
    title: v.optional(v.string()),
    briefIntro: v.optional(v.string()),
    matchedKeywords: v.array(v.string()),
    evidenceHighlights: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<QualificationLearningContext> => {
    const queryText = buildWorkspaceMemorySearchQuery({
      title: args.title,
      briefIntro: args.briefIntro,
      matchedKeywords: args.matchedKeywords,
      additionalContext: args.evidenceHighlights,
    });

    if (!hasWorkspaceMemorySearchQuery(queryText)) {
      return {
        queryText,
        relevantMemories: [],
        similarQualifiedCases: [],
        similarDisqualifiedCases: [],
      };
    }

    const [relevantMemories, similarQualifiedCases, similarDisqualifiedCases] =
      await Promise.all([
        ctx.runQuery(internal.memory.findRelevantBuiltInAgentMemoriesInternal, {
          userId: args.userId,
          workspaceId: args.workspaceId,
          query: queryText,
          limit: 5,
        }),
        ctx.runAction(internal.memory.searchWorkspaceMemoryNamespaceInternal, {
          workspaceId: args.workspaceId,
          namespace: "wins",
          query: queryText,
          limit: 3,
        }),
        ctx.runAction(internal.memory.searchWorkspaceMemoryNamespaceInternal, {
          workspaceId: args.workspaceId,
          namespace: "losses",
          query: queryText,
          limit: 3,
        }),
      ]);

    return {
      queryText,
      relevantMemories: relevantMemories.map(
        (memory: { promptLine: string }) => memory.promptLine
      ),
      similarQualifiedCases: similarQualifiedCases.matches.map(
        (match: WorkspaceSemanticMatch) => match.promptLine
      ),
      similarDisqualifiedCases: similarDisqualifiedCases.matches.map(
        (match: WorkspaceSemanticMatch) => match.promptLine
      ),
    };
  },
});

export const getOutreachLearningContextInternal = internalAction({
  args: {
    workspaceId: v.string(),
    userId: v.string(),
    title: v.optional(v.string()),
    briefIntro: v.optional(v.string()),
    painPoints: v.optional(v.array(v.string())),
    matchedKeywords: v.optional(v.array(v.string())),
    finance: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<OutreachLearningContext> => {
    const queryText = buildWorkspaceMemorySearchQuery({
      title: args.title,
      briefIntro: args.briefIntro,
      painPoints: args.painPoints,
      matchedKeywords: args.matchedKeywords,
      finance: args.finance,
    });

    if (!hasWorkspaceMemorySearchQuery(queryText)) {
      return {
        queryText,
        relevantMemories: [],
        winningPatterns: [],
        objections: [],
        similarCases: [],
      };
    }

    const [relevantMemories, winningPatterns, objectionPatterns, similarCases] =
      await Promise.all([
        ctx.runQuery(internal.memory.findRelevantBuiltInAgentMemoriesInternal, {
          userId: args.userId,
          workspaceId: args.workspaceId,
          query: queryText,
          limit: 6,
        }),
        Promise.all([
          ctx.runAction(
            internal.memory.searchWorkspaceMemoryNamespaceInternal,
            {
              workspaceId: args.workspaceId,
              namespace: "wins",
              query: queryText,
              limit: 3,
            }
          ),
          ctx.runAction(
            internal.memory.searchWorkspaceMemoryNamespaceInternal,
            {
              workspaceId: args.workspaceId,
              namespace: "patterns",
              query: queryText,
              limit: 3,
            }
          ),
        ]).then((groups) =>
          groups.flatMap(
            (group: { matches: WorkspaceSemanticMatch[] }) => group.matches
          )
        ),
        ctx.runAction(internal.memory.searchWorkspaceMemoryNamespaceInternal, {
          workspaceId: args.workspaceId,
          namespace: "objections",
          query: queryText,
          limit: 3,
        }),
        ctx.runAction(internal.memory.searchWorkspaceMemoryNamespaceInternal, {
          workspaceId: args.workspaceId,
          namespace: "patterns",
          query: queryText,
          limit: 4,
        }),
      ]);

    return {
      queryText,
      relevantMemories: relevantMemories.map(
        (memory: { promptLine: string }) => memory.promptLine
      ),
      winningPatterns: winningPatterns.map(
        (match: WorkspaceSemanticMatch) => match.promptLine
      ),
      objections: objectionPatterns.matches.map(
        (match: WorkspaceSemanticMatch) => match.promptLine
      ),
      similarCases: similarCases.matches.map(
        (match: WorkspaceSemanticMatch) => match.promptLine
      ),
    };
  },
});

export const promoteQualificationLearningInternal = internalAction({
  args: {
    workspaceId: v.string(),
    userId: v.string(),
    workspaceName: v.string(),
    workspaceDescription: v.string(),
    useCaseKey: v.optional(v.string()),
    prospectId: v.string(),
    threadId: v.optional(v.string()),
    prospectName: v.string(),
    prospectTitle: v.optional(v.string()),
    matchedKeywords: v.array(v.string()),
    score: v.number(),
    qualified: v.boolean(),
    reasoning: v.string(),
    evidenceHighlights: v.array(v.string()),
    priorMemoryContext: v.optional(v.array(v.string())),
    similarQualifiedCases: v.optional(v.array(v.string())),
    similarDisqualifiedCases: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<AgentMemoryPromotionResult[]> => {
    const drafts = await distillQualificationLearning({
      workspaceName: args.workspaceName,
      workspaceDescription: args.workspaceDescription,
      useCaseKey: args.useCaseKey as WorkspaceUseCaseKey | undefined,
      prospectName: args.prospectName,
      prospectTitle: args.prospectTitle,
      matchedKeywords: args.matchedKeywords,
      score: args.score,
      qualified: args.qualified,
      reasoning: args.reasoning,
      evidenceHighlights: args.evidenceHighlights,
      priorMemoryContext: args.priorMemoryContext,
      similarQualifiedCases: args.similarQualifiedCases,
      similarDisqualifiedCases: args.similarDisqualifiedCases,
    });

    return await Promise.all(
      drafts.map(
        (draft): Promise<AgentMemoryPromotionResult> =>
          persistWorkspaceMemoryDraft(ctx, {
            userId: args.userId,
            workspaceId: args.workspaceId,
            category: draft.category,
            source: "qualification",
            title: draft.title,
            summary: draft.summary,
            confidence: draft.confidence,
            impactScore: draft.impactScore,
            prospectId: args.prospectId,
            threadId: args.threadId,
            signals: draft.signals,
            evidence: draft.evidence,
            relatedQueries: draft.relatedQueries,
            narrative: draft.narrative,
          })
      )
    );
  },
});

export const promoteEnrichmentLearningInternal = internalAction({
  args: {
    workspaceId: v.string(),
    userId: v.string(),
    workspaceName: v.string(),
    workspaceDescription: v.string(),
    useCaseKey: v.optional(v.string()),
    prospectId: v.string(),
    prospectName: v.string(),
    prospectTitle: v.optional(v.string()),
    prospectType: v.optional(v.string()),
    briefIntro: v.optional(v.string()),
    financeSummary: v.optional(v.string()),
    painPoints: v.array(v.string()),
    relatedMemoryContext: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<AgentMemoryPromotionResult[]> => {
    const drafts = await distillEnrichmentLearning({
      workspaceName: args.workspaceName,
      workspaceDescription: args.workspaceDescription,
      useCaseKey: args.useCaseKey as WorkspaceUseCaseKey | undefined,
      prospectName: args.prospectName,
      prospectTitle: args.prospectTitle,
      prospectType: args.prospectType,
      briefIntro: args.briefIntro,
      financeSummary: args.financeSummary,
      painPoints: args.painPoints,
      relatedMemoryContext: args.relatedMemoryContext,
    });

    return await Promise.all(
      drafts.map(
        (draft): Promise<AgentMemoryPromotionResult> =>
          persistWorkspaceMemoryDraft(ctx, {
            userId: args.userId,
            workspaceId: args.workspaceId,
            category: draft.category,
            source: "enrichment",
            title: draft.title,
            summary: draft.summary,
            confidence: draft.confidence,
            impactScore: draft.impactScore,
            prospectId: args.prospectId,
            signals: draft.signals,
            evidence: draft.evidence,
            relatedQueries: draft.relatedQueries,
            narrative: draft.narrative,
          })
      )
    );
  },
});

export const indexWorkspaceProspectSummaryInternal = internalAction({
  args: {
    workspaceId: v.string(),
    prospectId: v.string(),
    namespace: v.string(),
    displayName: v.string(),
    title: v.optional(v.string()),
    briefIntro: v.optional(v.string()),
    qualificationStatus: v.optional(v.string()),
    qualificationScore: v.optional(v.number()),
    matchedKeywords: v.optional(v.array(v.string())),
    painPoints: v.optional(v.array(v.string())),
    finance: v.optional(v.string()),
    reasoning: v.optional(v.string()),
    importance: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ indexed: boolean }> => {
    const text = buildWorkspaceProspectSummaryText({
      displayName: args.displayName,
      title: args.title,
      briefIntro: args.briefIntro,
      qualificationStatus: args.qualificationStatus,
      qualificationScore: args.qualificationScore,
      matchedKeywords: args.matchedKeywords,
      painPoints: args.painPoints,
      finance: args.finance,
      reasoning: args.reasoning,
    });

    return await indexWorkspaceProspectSummary(ctx, {
      workspaceId: args.workspaceId,
      namespace: args.namespace as Parameters<typeof getWorkspaceNamespace>[1],
      prospectId: args.prospectId,
      title: args.title || args.displayName,
      text,
      importance: args.importance,
    });
  },
});

export const indexProspectSearchListInternal = internalAction({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }): Promise<{ indexed: boolean }> => {
    const prospect = (await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId,
      }
    )) as Doc<"prospects"> | null;
    if (!prospect) {
      return { indexed: false };
    }
    return await indexProspectSearchListEntry(ctx, prospect);
  },
});

export const indexQueryCandidateInternal = internalAction({
  args: {
    queryCandidateId: v.id("queryCandidates"),
  },
  handler: async (
    ctx,
    { queryCandidateId }
  ): Promise<{ indexed: boolean; reason?: "not_found" }> => {
    const candidate = (await ctx.runQuery(
      internal.memory.getQueryCandidateByIdInternal,
      { queryCandidateId }
    )) as Doc<"queryCandidates"> | null;

    if (!candidate) {
      return { indexed: false, reason: "not_found" };
    }

    return await indexWorkspaceQueryCandidate(ctx, {
      queryCandidateId: String(candidate._id),
      workspaceId: String(candidate.workspaceId),
      embeddingDocKey: candidate.embeddingDocKey,
      canonicalKey: candidate.canonicalKey,
      type: candidate.type,
      rawValue: candidate.rawValue,
      canonicalValue: candidate.canonicalValue,
      sourceTheme: candidate.sourceTheme,
      status: candidate.status,
      importance: candidate.performanceScore,
    });
  },
});

export const searchDiscoverySemanticDuplicatesInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { workspaceId, query, limit }
  ): Promise<{
    matches: Array<{ score: number; text: string; title: string | null }>;
  }> => {
    const namespace = getWorkspaceNamespace(
      String(workspaceId),
      getNamespaceKindForQueryCandidate()
    );

    try {
      const result = await agentMemoryRag.search(ctx, {
        namespace,
        query,
        limit: limit ?? 3,
        vectorScoreThreshold: DISCOVERY_SEMANTIC_DUPLICATE_THRESHOLD,
      });

      return {
        matches: result.results.slice(0, limit ?? 3).map((entry) => ({
          score: entry.score,
          text: entry.content.map((chunk) => chunk.text).join("\n"),
          title: null,
        })),
      };
    } catch {
      return { matches: [] };
    }
  },
});

export const screenDiscoveryQueryCandidatesInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    candidates: v.array(
      v.object({
        rawValue: v.string(),
        sourceTheme: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { workspaceId, candidates }
  ): Promise<{
    accepted: Array<{
      rawValue: string;
      sourceTheme?: string;
      queryCandidateId: Doc<"queryCandidates">["_id"];
    }>;
    rejected: Array<{
      rawValue: string;
      sourceTheme?: string;
      reason: "exact_duplicate" | "semantic_duplicate";
      noveltyScore: number;
      queryCandidateId: Doc<"queryCandidates">["_id"];
      semanticMatches?: Array<{
        score: number;
        text: string;
        title: string | null;
      }>;
    }>;
    counts: {
      generated: number;
      accepted: number;
      exactDuplicates: number;
      semanticDuplicates: number;
    };
  }> => {
    const accepted: Array<{
      rawValue: string;
      sourceTheme?: string;
      queryCandidateId: Doc<"queryCandidates">["_id"];
    }> = [];
    const rejected: Array<{
      rawValue: string;
      sourceTheme?: string;
      reason: "exact_duplicate" | "semantic_duplicate";
      noveltyScore: number;
      queryCandidateId: Doc<"queryCandidates">["_id"];
      semanticMatches?: Array<{
        score: number;
        text: string;
        title: string | null;
      }>;
    }> = [];
    const seenCanonicalHashes = new Set<string>();

    for (const candidate of candidates) {
      const canonical = buildQueryCandidateCanonicalRecord({
        type: "social_query",
        value: candidate.rawValue,
      });

      let isExactDuplicate = seenCanonicalHashes.has(canonical.canonicalHash);
      const existingKeyword = await ctx.runQuery(
        internal.keywords.getKeywordByCanonicalHashInternal,
        {
          workspaceId,
          canonicalHash: canonical.canonicalHash,
        }
      );
      if (existingKeyword) {
        isExactDuplicate = true;
      }

      if (!isExactDuplicate) {
        const existingCandidate = await ctx.runQuery(
          internal.memory.getQueryCandidateByCanonicalKeyInternal,
          {
            workspaceId,
            canonicalKey: canonical.canonicalKey,
          }
        );
        if (existingCandidate && existingCandidate.status !== "generated") {
          isExactDuplicate = true;
        }
      }

      seenCanonicalHashes.add(canonical.canonicalHash);

      if (isExactDuplicate) {
        const duplicate = await ctx.runMutation(
          internal.memory.upsertQueryCandidateInternal,
          {
            workspaceId,
            type: "social_query",
            rawValue: candidate.rawValue,
            sourceTheme: candidate.sourceTheme,
            status: "rejected_exact_duplicate",
            duplicateReason: "canonical_match",
            noveltyScore: 0,
          }
        );
        rejected.push({
          rawValue: candidate.rawValue,
          sourceTheme: candidate.sourceTheme,
          reason: "exact_duplicate",
          noveltyScore: 0,
          queryCandidateId: duplicate.queryCandidateId,
        });
        continue;
      }

      const semantic = await ctx.runAction(
        internal.memory.searchDiscoverySemanticDuplicatesInternal,
        {
          workspaceId,
          query: candidate.rawValue,
          limit: 3,
        }
      );

      if (semantic.matches.length > 0) {
        const topScore =
          semantic.matches[0]?.score ?? DISCOVERY_SEMANTIC_DUPLICATE_THRESHOLD;
        const duplicate = await ctx.runMutation(
          internal.memory.upsertQueryCandidateInternal,
          {
            workspaceId,
            type: "social_query",
            rawValue: candidate.rawValue,
            sourceTheme: candidate.sourceTheme,
            status: "rejected_semantic_duplicate",
            duplicateReason: "semantic_match",
            noveltyScore: Math.max(0, 1 - topScore),
          }
        );
        rejected.push({
          rawValue: candidate.rawValue,
          sourceTheme: candidate.sourceTheme,
          reason: "semantic_duplicate",
          noveltyScore: Math.max(0, 1 - topScore),
          queryCandidateId: duplicate.queryCandidateId,
          semanticMatches: semantic.matches,
        });
        continue;
      }

      const unique = await ctx.runMutation(
        internal.memory.upsertQueryCandidateInternal,
        {
          workspaceId,
          type: "social_query",
          rawValue: candidate.rawValue,
          sourceTheme: candidate.sourceTheme,
          status: "generated",
          noveltyScore: 1,
        }
      );
      accepted.push({
        rawValue: candidate.rawValue,
        sourceTheme: candidate.sourceTheme,
        queryCandidateId: unique.queryCandidateId,
      });
    }

    return {
      accepted,
      rejected,
      counts: {
        generated: candidates.length,
        accepted: accepted.length,
        exactDuplicates: rejected.filter(
          (item) => item.reason === "exact_duplicate"
        ).length,
        semanticDuplicates: rejected.filter(
          (item) => item.reason === "semantic_duplicate"
        ).length,
      },
    };
  },
});

export const getWorkspaceMemoryOverview = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Workspace not found",
    });

    const [
      activeCandidates,
      rejectedCandidates,
      retiredCandidates,
      pendingEvents,
      processingEvents,
      failedEvents,
      recentEvent,
      pendingSuggestions,
      runningEvaluatorRuns,
      failedEvaluatorRuns,
    ] = await Promise.all([
      ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "activated")
        )
        .collect(),
      Promise.all([
        ctx.db
          .query("queryCandidates")
          .withIndex("by_workspace_status", (q) =>
            q
              .eq("workspaceId", workspaceId)
              .eq("status", "rejected_exact_duplicate")
          )
          .collect(),
        ctx.db
          .query("queryCandidates")
          .withIndex("by_workspace_status", (q) =>
            q
              .eq("workspaceId", workspaceId)
              .eq("status", "rejected_semantic_duplicate")
          )
          .collect(),
        ctx.db
          .query("queryCandidates")
          .withIndex("by_workspace_status", (q) =>
            q
              .eq("workspaceId", workspaceId)
              .eq("status", "rejected_low_novelty")
          )
          .collect(),
      ]).then((groups) => groups.flat()),
      ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "retired")
        )
        .collect(),
      ctx.db
        .query("memoryWorkflowEvents")
        .withIndex("by_workspace_status_occurred_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "pending")
        )
        .collect(),
      ctx.db
        .query("memoryWorkflowEvents")
        .withIndex("by_workspace_status_occurred_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "processing")
        )
        .collect(),
      ctx.db
        .query("memoryWorkflowEvents")
        .withIndex("by_workspace_status_occurred_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "failed")
        )
        .collect(),
      ctx.db
        .query("memoryWorkflowEvents")
        .withIndex("by_workspace_occurred_at", (q) =>
          q.eq("workspaceId", workspaceId)
        )
        .order("desc")
        .first(),
      ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "pending_review")
        )
        .collect(),
      ctx.db
        .query("memoryEvaluatorRuns")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "running")
        )
        .collect(),
      ctx.db
        .query("memoryEvaluatorRuns")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", "failed")
        )
        .collect(),
    ]);

    return {
      queryCandidates: {
        activated: activeCandidates.length,
        rejected: rejectedCandidates.length,
        retired: retiredCandidates.length,
      },
      workflowEvents: {
        pending: pendingEvents.length,
        processing: processingEvents.length,
        failed: failedEvents.length,
        latestOccurredAt: recentEvent?.occurredAt ?? null,
      },
      suggestions: {
        pendingReview: pendingSuggestions.length,
      },
      evaluatorRuns: {
        running: runningEvaluatorRuns.length,
        failed: failedEvaluatorRuns.length,
      },
    };
  },
});

export const listWorkspaceQueryCandidates = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(queryCandidateStatusValidator),
    type: v.optional(queryCandidateTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, status, type, limit }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Workspace not found",
    });

    const rows = await ctx.db
      .query("queryCandidates")
      .withIndex("by_workspace_updated_at", (q) =>
        q.eq("workspaceId", workspaceId)
      )
      .order("desc")
      .take(MAX_LIST_LIMIT);

    return rows
      .filter(
        (candidate) =>
          matchesOptionalFilter(candidate.status, status) &&
          matchesOptionalFilter(candidate.type, type)
      )
      .slice(0, toListLimit(limit));
  },
});

export const listWorkspaceMemoryWorkflowEvents = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(memoryWorkflowEventStatusValidator),
    eventType: v.optional(memoryWorkflowEventTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, status, eventType, limit }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Workspace not found",
    });

    const rows = await ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_workspace_occurred_at", (q) =>
        q.eq("workspaceId", workspaceId)
      )
      .order("desc")
      .take(MAX_LIST_LIMIT);

    return rows
      .filter(
        (event) =>
          matchesOptionalFilter(event.status, status) &&
          matchesOptionalFilter(event.eventType, eventType)
      )
      .slice(0, toListLimit(limit));
  },
});

export const backfillWorkspaceDiscoveryMemory = action({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    { workspaceId }
  ): Promise<{
    candidateCount: number;
    performanceCount: number;
    keywordCount: number;
  }> => {
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

    const keywords = (await ctx.runQuery(
      internal.keywords.getWorkspaceKeywordsInternal,
      {
        workspaceId,
      }
    )) as { _raw: Doc<"keywords">[] };
    const rawKeywords = keywords._raw;

    let candidateCount = 0;
    let performanceCount = 0;

    for (const keyword of rawKeywords) {
      const candidateType =
        keyword.type === "social_query" ? "social_query" : "seed_keyword";
      const derivedCanonical = buildKeywordCanonicalRecord({
        type: keyword.type,
        value: keyword.originalValue ?? keyword.value,
      });
      const canonicalValue =
        keyword.canonicalValue ?? derivedCanonical.canonicalValue;
      const canonicalHash =
        keyword.canonicalHash ?? derivedCanonical.canonicalHash;
      const candidate = await ctx.runMutation(
        internal.memory.upsertQueryCandidateInternal,
        {
          workspaceId,
          type: candidateType,
          rawValue: keyword.originalValue ?? keyword.value,
          status: "activated",
          activatedKeywordId: keyword._id,
        }
      );
      candidateCount += candidate.created ? 1 : 0;

      await ctx.runMutation(internal.memory.upsertQueryPerformanceInternal, {
        workspaceId,
        queryId: keyword._id,
        canonicalValue,
        canonicalHash,
        activatedQueryCandidateId: candidate.queryCandidateId,
        prospectsFoundDelta: 0,
        lastUsedAt: keyword.lastUsedAt,
      });
      performanceCount += 1;
    }

    return {
      candidateCount,
      performanceCount,
      keywordCount: rawKeywords.length,
    };
  },
});
