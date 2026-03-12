import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import {
  buildMemoryWorkflowEventKey,
  buildQueryCandidateCanonicalRecord,
  buildQueryCandidateEmbeddingDocKey,
} from "./memoryHelpers";
import {
  isEvaluatorRelevantEventType,
  resolveDefaultMemoryWorkflowEventStatus,
} from "./memoryEvaluatorCore";

type MemoryDbWriter = GenericDatabaseWriter<DataModel>;

function calculateRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return (numerator / denominator) * 100;
}

export function calculateQueryPerformanceScore(args: {
  prospectsFound: number;
  qualifiedCount: number;
  convertedCount: number;
  replyCount: number;
  replyRate: number;
  qualificationRate: number;
}) {
  return (
    args.convertedCount * 100 +
    args.replyCount * 25 +
    args.qualifiedCount * 10 +
    args.prospectsFound * 2 +
    args.replyRate +
    args.qualificationRate
  );
}

function resolveQueryCandidateStatus(
  previousStatus: Doc<"queryCandidates">["status"] | null,
  nextStatus: Doc<"queryCandidates">["status"]
): Doc<"queryCandidates">["status"] {
  if (!previousStatus) return nextStatus;
  if (previousStatus === "retired" || nextStatus === "retired") {
    return "retired";
  }
  if (previousStatus === "activated" || nextStatus === "activated") {
    return "activated";
  }
  if (
    previousStatus === "rejected_semantic_duplicate" ||
    nextStatus === "rejected_semantic_duplicate"
  ) {
    return "rejected_semantic_duplicate";
  }
  if (
    previousStatus === "rejected_exact_duplicate" ||
    nextStatus === "rejected_exact_duplicate"
  ) {
    return "rejected_exact_duplicate";
  }
  if (
    previousStatus === "rejected_low_novelty" ||
    nextStatus === "rejected_low_novelty"
  ) {
    return "rejected_low_novelty";
  }
  return nextStatus;
}

export async function upsertQueryCandidateRecord(
  db: MemoryDbWriter,
  args: {
    workspaceId: Id<"workspaces">;
    type: Doc<"queryCandidates">["type"];
    rawValue: string;
    sourceTheme?: string;
    sourceRunId?: string;
    noveltyScore?: number;
    status?: Doc<"queryCandidates">["status"];
    duplicateReason?: Doc<"queryCandidates">["duplicateReason"];
    performanceScore?: number;
    activatedKeywordId?: Id<"keywords">;
    embeddingDocKey?: string;
  }
) {
  const now = getCurrentUTCTimestamp();
  const canonical = buildQueryCandidateCanonicalRecord({
    type: args.type,
    value: args.rawValue,
  });
  const embeddingDocKey =
    args.embeddingDocKey ??
    buildQueryCandidateEmbeddingDocKey(
      String(args.workspaceId),
      canonical.canonicalKey
    );
  const existing = await db
    .query("queryCandidates")
    .withIndex("by_workspace_canonical_key", (q) =>
      q
        .eq("workspaceId", args.workspaceId)
        .eq("canonicalKey", canonical.canonicalKey)
    )
    .first();

  if (existing) {
    const nextStatus = resolveQueryCandidateStatus(
      existing.status,
      args.status ?? existing.status
    );

    await db.patch(existing._id, {
      rawValue: args.rawValue,
      sourceTheme: args.sourceTheme ?? existing.sourceTheme,
      sourceRunId: args.sourceRunId ?? existing.sourceRunId,
      noveltyScore: args.noveltyScore ?? existing.noveltyScore,
      status: nextStatus,
      duplicateReason: args.duplicateReason ?? existing.duplicateReason,
      performanceScore: args.performanceScore ?? existing.performanceScore,
      activatedKeywordId:
        args.activatedKeywordId ?? existing.activatedKeywordId,
      embeddingDocKey,
      reviewedAt:
        nextStatus === "activated" || nextStatus.startsWith("rejected_")
          ? now
          : existing.reviewedAt,
      lastEvaluatedAt: now,
      retiredAt: nextStatus === "retired" ? now : existing.retiredAt,
      updatedAt: now,
    });

    return {
      queryCandidateId: existing._id,
      created: false,
      ...canonical,
      status: nextStatus,
    };
  }

  const status = args.status ?? "generated";
  const queryCandidateId = await db.insert("queryCandidates", {
    workspaceId: args.workspaceId,
    type: args.type,
    rawValue: args.rawValue,
    canonicalValue: canonical.canonicalValue,
    canonicalHash: canonical.canonicalHash,
    canonicalKey: canonical.canonicalKey,
    sourceTheme: args.sourceTheme,
    sourceRunId: args.sourceRunId,
    noveltyScore: args.noveltyScore,
    status,
    duplicateReason: args.duplicateReason,
    performanceScore: args.performanceScore,
    activatedKeywordId: args.activatedKeywordId,
    embeddingDocKey,
    updatedAt: now,
    reviewedAt:
      status === "activated" || status.startsWith("rejected_")
        ? now
        : undefined,
    lastEvaluatedAt: now,
    retiredAt: status === "retired" ? now : undefined,
  });

  return { queryCandidateId, created: true, ...canonical, status };
}

export async function upsertQueryPerformanceRecord(
  db: MemoryDbWriter,
  args: {
    workspaceId: Id<"workspaces">;
    queryId: Id<"keywords">;
    canonicalValue: string;
    canonicalHash: string;
    activatedQueryCandidateId?: Id<"queryCandidates">;
    impressionsDelta?: number;
    prospectsFoundDelta?: number;
    qualifiedCountDelta?: number;
    convertedCountDelta?: number;
    replyCountDelta?: number;
    lastUsedAt?: number;
    retiredAt?: number;
  }
) {
  const now = getCurrentUTCTimestamp();
  const existing = await db
    .query("queryPerformance")
    .withIndex("by_workspace_query_id", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("queryId", args.queryId)
    )
    .first();

  const impressions = Math.max(
    0,
    (existing?.impressions ?? 0) + (args.impressionsDelta ?? 0)
  );
  const prospectsFound = Math.max(
    0,
    (existing?.prospectsFound ?? 0) + (args.prospectsFoundDelta ?? 0)
  );
  const qualifiedCount = Math.max(
    0,
    (existing?.qualifiedCount ?? 0) + (args.qualifiedCountDelta ?? 0)
  );
  const convertedCount = Math.max(
    0,
    (existing?.convertedCount ?? 0) + (args.convertedCountDelta ?? 0)
  );
  const replyCount = Math.max(
    0,
    (existing?.replyCount ?? 0) + (args.replyCountDelta ?? 0)
  );

  const payload = {
    canonicalValue: args.canonicalValue,
    canonicalHash: args.canonicalHash,
    activatedQueryCandidateId:
      args.activatedQueryCandidateId ?? existing?.activatedQueryCandidateId,
    impressions,
    prospectsFound,
    qualifiedCount,
    convertedCount,
    replyCount,
    replyRate: calculateRate(replyCount, prospectsFound),
    qualificationRate: calculateRate(qualifiedCount, prospectsFound),
    lastUsedAt: args.lastUsedAt ?? existing?.lastUsedAt ?? now,
    retiredAt: args.retiredAt ?? existing?.retiredAt,
    updatedAt: now,
  };
  const performanceScore = calculateQueryPerformanceScore(payload);
  const queryCandidateId =
    args.activatedQueryCandidateId ?? existing?.activatedQueryCandidateId;

  if (existing) {
    await db.patch(existing._id, payload);
    if (queryCandidateId) {
      await db.patch(queryCandidateId, {
        performanceScore,
        updatedAt: now,
      });
    }
    return { queryPerformanceId: existing._id, created: false };
  }

  const queryPerformanceId = await db.insert("queryPerformance", {
    workspaceId: args.workspaceId,
    queryId: args.queryId,
    ...payload,
  });
  if (queryCandidateId) {
    await db.patch(queryCandidateId, {
      performanceScore,
      updatedAt: now,
    });
  }

  return { queryPerformanceId, created: true };
}

export async function recordMemoryWorkflowEventRecord(
  db: MemoryDbWriter,
  args: {
    workspaceId: Id<"workspaces">;
    eventType: Doc<"memoryWorkflowEvents">["eventType"];
    sourceType: Doc<"memoryWorkflowEvents">["sourceType"];
    sourceId: string;
    workflowName?: string;
    status?: Doc<"memoryWorkflowEvents">["status"];
    prospectId?: Id<"prospects">;
    planId?: Id<"outreachPlans">;
    taskId?: Id<"outreachTasks">;
    queryCandidateId?: Id<"queryCandidates">;
    queryId?: Id<"keywords">;
    payload?: Doc<"memoryWorkflowEvents">["payload"];
    eventKey?: string;
    occurredAt?: number;
  }
) {
  const occurredAt = args.occurredAt ?? getCurrentUTCTimestamp();
  const nextStatus = resolveDefaultMemoryWorkflowEventStatus({
    eventType: args.eventType,
    explicitStatus: args.status,
  });
  const eventKey =
    args.eventKey ??
    buildMemoryWorkflowEventKey([
      args.eventType,
      args.workspaceId,
      args.sourceType,
      args.sourceId,
      args.queryId,
      args.queryCandidateId,
      args.taskId,
      args.planId,
    ]);
  const existing = await db
    .query("memoryWorkflowEvents")
    .withIndex("by_event_key", (q) => q.eq("eventKey", eventKey))
    .first();

  if (existing) {
    await db.patch(existing._id, {
      status: args.status ?? existing.status,
      workflowName: args.workflowName ?? existing.workflowName,
      payload: args.payload ?? existing.payload,
      occurredAt,
      error: undefined,
      processedAt:
        (args.status ?? existing.status) === "processed" ||
        (args.status ?? existing.status) === "ignored"
          ? getCurrentUTCTimestamp()
          : existing.processedAt,
    });
    return {
      eventId: existing._id,
      created: false,
      eventKey,
      status: args.status ?? existing.status,
    };
  }

  const eventId = await db.insert("memoryWorkflowEvents", {
    workspaceId: args.workspaceId,
    eventType: args.eventType,
    status: nextStatus,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    eventKey,
    workflowName: args.workflowName,
    prospectId: args.prospectId,
    planId: args.planId,
    taskId: args.taskId,
    queryCandidateId: args.queryCandidateId,
    queryId: args.queryId,
    payload: args.payload,
    occurredAt,
    processedAt:
      nextStatus === "processed" || nextStatus === "ignored"
        ? getCurrentUTCTimestamp()
        : undefined,
    evaluatorWorkflowId: undefined,
    error: undefined,
  });

  return { eventId, created: true, eventKey, status: nextStatus };
}

export async function recordMemoryWorkflowEvent(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    workspaceId: Id<"workspaces">;
    eventType: Doc<"memoryWorkflowEvents">["eventType"];
    sourceType: Doc<"memoryWorkflowEvents">["sourceType"];
    sourceId: string;
    workflowName?: string;
    status?: Doc<"memoryWorkflowEvents">["status"];
    prospectId?: Id<"prospects">;
    planId?: Id<"outreachPlans">;
    taskId?: Id<"outreachTasks">;
    queryCandidateId?: Id<"queryCandidates">;
    queryId?: Id<"keywords">;
    payload?: Doc<"memoryWorkflowEvents">["payload"];
    eventKey?: string;
    occurredAt?: number;
  }
) {
  const result = await recordMemoryWorkflowEventRecord(ctx.db, args);
  if (
    result.status === "pending" &&
    isEvaluatorRelevantEventType(args.eventType)
  ) {
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.memory.startMemoryEvaluationWorkflowInternal,
      { eventId: result.eventId }
    );
  }
  return result;
}
