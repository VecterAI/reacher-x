import type { Doc } from "../_generated/dataModel";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import {
  buildMetric,
  buildPipelineFunnel,
  calculateRate,
  countTimestampsByBucket,
  type TimeWindow,
  type TrendBucketSet,
} from "./analyticsCore";
import type { WorkspaceStatsSnapshot } from "../workspaceStats";
import type { WorkspaceAgentMemoryRecord } from "./agentMemoryCore";

type AnalyticsDailyRow = Doc<"workspaceAnalyticsDaily">;
type QueryCandidateRow = Doc<"queryCandidates">;
type QueryPerformanceRow = Doc<"queryPerformance">;
type WorkflowEventRow = Doc<"memoryWorkflowEvents">;
type EvaluatorRunRow = Doc<"memoryEvaluatorRuns">;
type MemorySuggestionRow = Doc<"memorySuggestions">;
type MonitorRow = Doc<"socialQueryMonitors">;
type KeywordRow = Doc<"keywords">;
type ProspectScoreRow = {
  status?: "converted" | "archived" | string;
  qualificationScore?: number;
};

export type AgentOpsActivityItem = {
  id: string;
  kind: "event" | "run" | "suggestion";
  title: string;
  description: string;
  status: string;
  timestamp: number;
  severity: "default" | "warning" | "destructive" | "success";
  linkedEntity: string | null;
};

const HEALTH_BLOCKED_WEIGHT = 8;
const HEALTH_FAILING_MONITOR_WEIGHT = 10;
const HEALTH_FAILED_RUN_WEIGHT = 7;
const HEALTH_FAILED_EVENT_WEIGHT = 4;

const QUALITY_QUALIFIED_WEIGHT = 0.35;
const QUALITY_RESPONSE_WEIGHT = 0.35;
const QUALITY_CONVERTED_WEIGHT = 0.3;

const SELF_IMPROVEMENT_ACCEPTED_WEIGHT = 0.45;
const SELF_IMPROVEMENT_PROMOTED_WEIGHT = 8;
const SELF_IMPROVEMENT_REPLY_RATE_WEIGHT = 0.25;
const SELF_IMPROVEMENT_DUPLICATE_WASTE_WEIGHT = 0.3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function computeAverageQualificationScore(rows: ProspectScoreRow[]) {
  if (rows.length === 0) {
    return 0;
  }

  const total = rows.reduce(
    (sum, row) =>
      sum +
      (typeof row.qualificationScore === "number" ? row.qualificationScore : 0),
    0
  );
  return roundTo(total / rows.length, 1);
}

function isWithinWindow(timestamp: number | undefined, window: TimeWindow) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return false;
  }

  return timestamp >= window.startMs && timestamp < window.endMs;
}

function rowIntersectsWindow(row: AnalyticsDailyRow, window: TimeWindow) {
  const rowStartMs = row.dayStartUtcMs;
  const rowEndMs = row.dayStartUtcMs + 24 * 60 * 60 * 1000;
  return rowStartMs < window.endMs && rowEndMs > window.startMs;
}

function sumDailyFieldInWindow(
  rows: AnalyticsDailyRow[],
  field: keyof Pick<
    AnalyticsDailyRow,
    | "newProspectsCount"
    | "reachedContactedProspectsCount"
    | "reachedInProgressProspectsCount"
    | "reachedConvertedProspectsCount"
    | "fitScore0To49Count"
    | "fitScore50To69Count"
    | "fitScore70To79Count"
    | "fitScore80To100Count"
    | "twitterProspectsCount"
    | "linkedInProspectsCount"
    | "contactedEventsCount"
    | "respondedEventsCount"
    | "draftPlansCount"
    | "pendingApprovalTasksCount"
    | "pausedPlansCount"
    | "blockedAuthPlansCount"
    | "failedTasksCount"
  >,
  window: TimeWindow
) {
  return rows.reduce((total, row) => {
    if (!rowIntersectsWindow(row, window)) {
      return total;
    }

    return total + (row[field] ?? 0);
  }, 0);
}

function buildSeriesFromCounts(
  bucketSet: TrendBucketSet,
  values: number[],
  fieldName: string
) {
  return bucketSet.buckets.map((bucket, index) => ({
    date: bucket.label,
    [fieldName]: values[index] ?? 0,
  }));
}

function countRowsByBucket<T>(
  rows: T[],
  bucketSet: TrendBucketSet,
  getTimestamp: (row: T) => number | undefined,
  predicate?: (row: T) => boolean
) {
  return countTimestampsByBucket(
    rows
      .filter((row) => (predicate ? predicate(row) : true))
      .map((row) => getTimestamp(row))
      .filter((value): value is number => typeof value === "number"),
    bucketSet
  );
}

function buildInventoryStatusLabel(status: QueryCandidateRow["status"]) {
  switch (status) {
    case "activated":
      return "active";
    case "rejected_exact_duplicate":
      return "duplicate";
    case "rejected_semantic_duplicate":
      return "semantic duplicate";
    case "rejected_low_novelty":
      return "low novelty";
    case "retired":
      return "retired";
    default:
      return "generated";
  }
}

function buildQueryPerformanceRank(row: QueryPerformanceRow) {
  return (
    row.qualifiedCount * 5 +
    row.convertedCount * 8 +
    row.replyCount * 3 +
    row.replyRate * 1.5 +
    row.qualificationRate
  );
}

function buildHealthScore(args: {
  blockedCount: number;
  failingMonitors: number;
  failedRuns: number;
  failedEvents: number;
}) {
  return clamp(
    100 -
      args.blockedCount * HEALTH_BLOCKED_WEIGHT -
      args.failingMonitors * HEALTH_FAILING_MONITOR_WEIGHT -
      args.failedRuns * HEALTH_FAILED_RUN_WEIGHT -
      args.failedEvents * HEALTH_FAILED_EVENT_WEIGHT,
    0,
    100
  );
}

function buildQualityScore(args: {
  qualifiedRate: number;
  responseRate: number;
  convertedRate: number;
  issuePenalty: number;
}) {
  return clamp(
    args.qualifiedRate * QUALITY_QUALIFIED_WEIGHT +
      args.responseRate * QUALITY_RESPONSE_WEIGHT +
      args.convertedRate * QUALITY_CONVERTED_WEIGHT -
      args.issuePenalty,
    0,
    100
  );
}

function buildSelfImprovementScore(args: {
  acceptedRate: number;
  promotedCount: number;
  impactedReplyRate: number;
  duplicateWaste: number;
}) {
  return clamp(
    args.acceptedRate * SELF_IMPROVEMENT_ACCEPTED_WEIGHT +
      args.promotedCount * SELF_IMPROVEMENT_PROMOTED_WEIGHT +
      args.impactedReplyRate * SELF_IMPROVEMENT_REPLY_RATE_WEIGHT -
      args.duplicateWaste * SELF_IMPROVEMENT_DUPLICATE_WASTE_WEIGHT,
    0,
    100
  );
}

function getCurrentReplyRate(rows: AnalyticsDailyRow[], window: TimeWindow) {
  const responses = sumDailyFieldInWindow(rows, "respondedEventsCount", window);
  const contacted = sumDailyFieldInWindow(rows, "contactedEventsCount", window);
  return roundTo(calculateRate(responses, contacted), 1);
}

function getCurrentQualifiedRate(
  events: WorkflowEventRow[],
  window: TimeWindow
): number {
  const relevant = events.filter(
    (event) =>
      event.eventType === "qualification_completed" &&
      isWithinWindow(event.occurredAt, window)
  );
  const qualified = relevant.filter(
    (event) => (event.payload as { qualified?: boolean } | undefined)?.qualified
  ).length;

  return roundTo(calculateRate(qualified, relevant.length), 1);
}

function getCurrentConvertedRate(
  rows: AnalyticsDailyRow[],
  window: TimeWindow
): number {
  const converted = sumDailyFieldInWindow(
    rows,
    "reachedConvertedProspectsCount",
    window
  );
  const inProgress = sumDailyFieldInWindow(
    rows,
    "reachedInProgressProspectsCount",
    window
  );
  return roundTo(calculateRate(converted, inProgress), 1);
}

function buildActivityItemFromEvent(
  event: WorkflowEventRow
): AgentOpsActivityItem {
  const payload = event.payload as Record<string, unknown> | undefined;
  const eventLabel = event.eventType.replaceAll("_", " ");
  const description = payload
    ? Object.entries(payload)
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(" · ")
    : "Workflow event recorded";

  return {
    id: String(event._id),
    kind: "event",
    title: eventLabel,
    description,
    status: event.status,
    timestamp: event.occurredAt,
    severity:
      event.status === "failed"
        ? "destructive"
        : event.status === "pending" || event.status === "processing"
          ? "warning"
          : "default",
    linkedEntity: event.eventType.includes("query")
      ? "discovery"
      : event.eventType.includes("outreach")
        ? "outreach"
        : event.eventType.includes("qualification")
          ? "quality"
          : event.eventType.includes("enrichment")
            ? "memory"
            : null,
  };
}

function buildActivityItemFromRun(run: EvaluatorRunRow): AgentOpsActivityItem {
  return {
    id: String(run._id),
    kind: "run",
    title: "memory evaluator run",
    description:
      run.summary ||
      `${run.promotedMemoryCount} promoted · ${run.suggestedMemoryCount} suggested`,
    status: run.status,
    timestamp: run.updatedAt,
    severity:
      run.status === "failed"
        ? "destructive"
        : run.status === "completed"
          ? "success"
          : run.status === "running"
            ? "warning"
            : "default",
    linkedEntity: "memory",
  };
}

function buildActivityItemFromSuggestion(
  suggestion: MemorySuggestionRow
): AgentOpsActivityItem {
  return {
    id: String(suggestion._id),
    kind: "suggestion",
    title:
      suggestion.status === "promoted"
        ? "memory promoted"
        : "memory suggestion",
    description: suggestion.title,
    status: suggestion.status,
    timestamp: suggestion.updatedAt,
    severity:
      suggestion.status === "rejected"
        ? "destructive"
        : suggestion.status === "promoted"
          ? "success"
          : "warning",
    linkedEntity: "memory",
  };
}

export function buildAgentOpsDashboardData(args: {
  bucketSet: TrendBucketSet;
  currentWindow: TimeWindow;
  previousWindow: TimeWindow;
  workspaceStats: WorkspaceStatsSnapshot;
  analyticsRows?: AnalyticsDailyRow[];
  queryCandidates?: QueryCandidateRow[];
  queryPerformance?: QueryPerformanceRow[];
  workflowEvents?: WorkflowEventRow[];
  evaluatorRuns?: EvaluatorRunRow[];
  memorySuggestions?: MemorySuggestionRow[];
  builtInMemories?: WorkspaceAgentMemoryRecord[];
  monitors?: MonitorRow[];
  rawKeywords?: KeywordRow[];
  prospects?: ProspectScoreRow[];
  convertedAvgScore?: number;
  archivedAvgScore?: number;
}) {
  const legacyProspects = args.prospects ?? [];
  const {
    bucketSet,
    currentWindow,
    previousWindow,
    workspaceStats,
    analyticsRows = [],
    queryCandidates = [],
    queryPerformance = [],
    workflowEvents = [],
    evaluatorRuns = [],
    memorySuggestions = [],
    builtInMemories = [],
    monitors = [],
    rawKeywords = [],
    convertedAvgScore = computeAverageQualificationScore(
      legacyProspects.filter((row) => row.status === "converted")
    ),
    archivedAvgScore = computeAverageQualificationScore(
      legacyProspects.filter((row) => row.status === "archived")
    ),
  } = args;

  const currentReplyRate = getCurrentReplyRate(analyticsRows, currentWindow);
  const previousReplyRate = getCurrentReplyRate(analyticsRows, previousWindow);
  const currentQualifiedRate = getCurrentQualifiedRate(
    workflowEvents,
    currentWindow
  );
  const previousQualifiedRate = getCurrentQualifiedRate(
    workflowEvents,
    previousWindow
  );
  const currentConvertedRate = getCurrentConvertedRate(
    analyticsRows,
    currentWindow
  );
  const previousConvertedRate = getCurrentConvertedRate(
    analyticsRows,
    previousWindow
  );

  const currentAccepted = queryCandidates.filter(
    (row) =>
      row.status === "activated" && isWithinWindow(row.updatedAt, currentWindow)
  ).length;
  const previousAccepted = queryCandidates.filter(
    (row) =>
      row.status === "activated" &&
      isWithinWindow(row.updatedAt, previousWindow)
  ).length;
  const currentRejected = queryCandidates.filter(
    (row) =>
      row.status !== "activated" &&
      row.status !== "generated" &&
      isWithinWindow(row.updatedAt, currentWindow)
  ).length;
  const previousRejected = queryCandidates.filter(
    (row) =>
      row.status !== "activated" &&
      row.status !== "generated" &&
      isWithinWindow(row.updatedAt, previousWindow)
  ).length;
  const currentGenerated = currentAccepted + currentRejected;
  const previousGenerated = previousAccepted + previousRejected;
  const currentAcceptedRate = roundTo(
    calculateRate(currentAccepted, currentGenerated),
    1
  );
  const previousAcceptedRate = roundTo(
    calculateRate(previousAccepted, previousGenerated),
    1
  );

  const currentPromotedSuggestions = memorySuggestions.filter(
    (row) =>
      row.status === "promoted" && isWithinWindow(row.updatedAt, currentWindow)
  ).length;
  const previousPromotedSuggestions = memorySuggestions.filter(
    (row) =>
      row.status === "promoted" && isWithinWindow(row.updatedAt, previousWindow)
  ).length;
  const currentPendingSuggestions = memorySuggestions.filter(
    (row) => row.status === "pending_review"
  ).length;
  const currentFailedRuns = evaluatorRuns.filter(
    (row) => row.status === "failed"
  ).length;
  const currentFailedEvents = workflowEvents.filter(
    (row) => row.status === "failed"
  ).length;
  const failingMonitors = monitors.filter(
    (row) => row.healthStatus === "failing"
  ).length;
  const blockedItems =
    currentPendingSuggestions +
    currentFailedRuns +
    currentFailedEvents +
    failingMonitors;

  const currentHealthScore = buildHealthScore({
    blockedCount: blockedItems,
    failingMonitors,
    failedRuns: currentFailedRuns,
    failedEvents: currentFailedEvents,
  });
  const previousHealthScore = buildHealthScore({
    blockedCount:
      memorySuggestions.filter(
        (row) =>
          row.status === "pending_review" &&
          isWithinWindow(row.updatedAt, previousWindow)
      ).length +
      evaluatorRuns.filter(
        (row) =>
          row.status === "failed" &&
          isWithinWindow(row.updatedAt, previousWindow)
      ).length +
      workflowEvents.filter(
        (row) =>
          row.status === "failed" &&
          isWithinWindow(row.occurredAt, previousWindow)
      ).length,
    failingMonitors: monitors.filter((row) => row.healthStatus === "failing")
      .length,
    failedRuns: evaluatorRuns.filter(
      (row) =>
        row.status === "failed" && isWithinWindow(row.updatedAt, previousWindow)
    ).length,
    failedEvents: workflowEvents.filter(
      (row) =>
        row.status === "failed" &&
        isWithinWindow(row.occurredAt, previousWindow)
    ).length,
  });

  const currentQualityScore = roundTo(
    buildQualityScore({
      qualifiedRate: currentQualifiedRate,
      responseRate: currentReplyRate,
      convertedRate: currentConvertedRate,
      issuePenalty: blockedItems * 1.2,
    }),
    1
  );
  const previousQualityScore = roundTo(
    buildQualityScore({
      qualifiedRate: previousQualifiedRate,
      responseRate: previousReplyRate,
      convertedRate: previousConvertedRate,
      issuePenalty:
        evaluatorRuns.filter(
          (row) =>
            row.status === "failed" &&
            isWithinWindow(row.updatedAt, previousWindow)
        ).length * 1.2,
    }),
    1
  );

  const currentSelfImprovementScore = roundTo(
    buildSelfImprovementScore({
      acceptedRate: currentAcceptedRate,
      promotedCount: currentPromotedSuggestions,
      impactedReplyRate: currentReplyRate,
      duplicateWaste: currentGenerated - currentAccepted,
    }),
    1
  );
  const previousSelfImprovementScore = roundTo(
    buildSelfImprovementScore({
      acceptedRate: previousAcceptedRate,
      promotedCount: previousPromotedSuggestions,
      impactedReplyRate: previousReplyRate,
      duplicateWaste: previousGenerated - previousAccepted,
    }),
    1
  );

  const seedKeywords = rawKeywords.filter((row) => row.type === "seed");
  const socialQueries = rawKeywords.filter(
    (row) => row.type === "social_query"
  );

  const qualityTrend = bucketSet.buckets.map((bucket) => {
    const qualifiedRate = getCurrentQualifiedRate(workflowEvents, {
      startMs: bucket.startMs,
      endMs: bucket.endMs,
    });
    const replyRate = getCurrentReplyRate(analyticsRows, {
      startMs: bucket.startMs,
      endMs: bucket.endMs,
    });
    const convertedRate = getCurrentConvertedRate(analyticsRows, {
      startMs: bucket.startMs,
      endMs: bucket.endMs,
    });
    return {
      date: bucket.label,
      qualityScore: roundTo(
        buildQualityScore({
          qualifiedRate,
          responseRate: replyRate,
          convertedRate,
          issuePenalty: 0,
        }),
        1
      ),
    };
  });

  const exactDuplicateCounts = countRowsByBucket(
    queryCandidates,
    bucketSet,
    (row) => row.updatedAt,
    (row) => row.status === "rejected_exact_duplicate"
  );
  const semanticDuplicateCounts = countRowsByBucket(
    queryCandidates,
    bucketSet,
    (row) => row.updatedAt,
    (row) => row.status === "rejected_semantic_duplicate"
  );
  const acceptedCounts = countRowsByBucket(
    queryCandidates,
    bucketSet,
    (row) => row.updatedAt,
    (row) => row.status === "activated"
  );
  const promotedCounts = countRowsByBucket(
    memorySuggestions,
    bucketSet,
    (row) => row.updatedAt,
    (row) => row.status === "promoted"
  );
  const replyCounts = bucketSet.buckets.map((bucket) =>
    sumDailyFieldInWindow(analyticsRows, "respondedEventsCount", {
      startMs: bucket.startMs,
      endMs: bucket.endMs,
    })
  );

  const selfImprovementTrend = bucketSet.buckets.map((bucket, index) => {
    const generated =
      acceptedCounts[index] +
      exactDuplicateCounts[index] +
      semanticDuplicateCounts[index];
    return {
      date: bucket.label,
      duplicateWaste:
        exactDuplicateCounts[index] + semanticDuplicateCounts[index],
      noveltyYield: roundTo(calculateRate(acceptedCounts[index], generated), 1),
      promotedMemories: promotedCounts[index],
      replies: replyCounts[index],
    };
  });

  const discoveredNewCounts = bucketSet.buckets.map((bucket) =>
    sumDailyFieldInWindow(analyticsRows, "newProspectsCount", {
      startMs: bucket.startMs,
      endMs: bucket.endMs,
    })
  );
  const contactedCounts = bucketSet.buckets.map((bucket) =>
    sumDailyFieldInWindow(analyticsRows, "contactedEventsCount", {
      startMs: bucket.startMs,
      endMs: bucket.endMs,
    })
  );

  const queryInventory = queryCandidates
    .map((candidate) => {
      const performance = queryPerformance.find(
        (row) => row.activatedQueryCandidateId === candidate._id
      );
      const monitor = candidate.activatedKeywordId
        ? monitors.find((row) => row.keywordId === candidate.activatedKeywordId)
        : null;

      return {
        queryCandidateId: String(candidate._id),
        rawValue: candidate.rawValue,
        canonicalValue: candidate.canonicalValue,
        type: candidate.type,
        status: candidate.status,
        statusLabel: buildInventoryStatusLabel(candidate.status),
        sourceTheme: candidate.sourceTheme ?? null,
        noveltyScore: candidate.noveltyScore ?? null,
        performanceScore: candidate.performanceScore ?? null,
        prospectsFound: performance?.prospectsFound ?? 0,
        qualifiedCount: performance?.qualifiedCount ?? 0,
        convertedCount: performance?.convertedCount ?? 0,
        replyRate: performance?.replyRate ?? 0,
        monitorId: monitor ? String(monitor._id) : null,
        monitorStatus: monitor?.status ?? null,
        monitorHealth: monitor?.healthStatus ?? null,
        updatedAt: candidate.updatedAt,
      };
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);

  const rankedQueryPerformance = queryPerformance
    .map((row) => ({
      row,
      rank: buildQueryPerformanceRank(row),
      query: queryCandidates.find(
        (candidate) => candidate._id === row.activatedQueryCandidateId
      ),
    }))
    .filter(
      (
        value
      ): value is {
        row: QueryPerformanceRow;
        rank: number;
        query: QueryCandidateRow;
      } => Boolean(value.query)
    )
    .sort((left, right) => right.rank - left.rank);

  const bestQueries = rankedQueryPerformance
    .slice(0, 5)
    .map(({ row, query }) => ({
      queryCandidateId: String(query._id),
      label: query.rawValue,
      replyRate: roundTo(row.replyRate, 1),
      qualifiedCount: row.qualifiedCount,
      convertedCount: row.convertedCount,
      prospectsFound: row.prospectsFound,
    }));
  const weakestQueries = [...rankedQueryPerformance]
    .reverse()
    .slice(0, 5)
    .map(({ row, query }) => ({
      queryCandidateId: String(query._id),
      label: query.rawValue,
      replyRate: roundTo(row.replyRate, 1),
      qualifiedCount: row.qualifiedCount,
      convertedCount: row.convertedCount,
      prospectsFound: row.prospectsFound,
    }));

  const activityFeed = [
    ...workflowEvents.map(buildActivityItemFromEvent),
    ...evaluatorRuns.map(buildActivityItemFromRun),
    ...memorySuggestions.map(buildActivityItemFromSuggestion),
  ]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 40);

  const memoryInventory = builtInMemories.map((memory) => ({
    memoryId: memory.memoryId,
    title: memory.parsed.title,
    summary: memory.parsed.summary,
    source: memory.parsed.source,
    category: memory.parsed.category,
    confidence: roundTo(memory.parsed.confidence * 100, 1),
    impactScore: roundTo(memory.parsed.impactScore * 100, 1),
    relatedQueries: memory.parsed.relatedQueries.length,
    evidenceCount: memory.parsed.evidence.length,
    createdAt: memory.createdAt,
  }));

  const helpfulMemories = [...builtInMemories]
    .sort(
      (left, right) =>
        right.parsed.impactScore - left.parsed.impactScore ||
        right.createdAt - left.createdAt
    )
    .slice(0, 5)
    .map((memory) => ({
      memoryId: memory.memoryId,
      title: memory.parsed.title,
      summary: memory.parsed.summary,
      source: memory.parsed.source,
      category: memory.parsed.category,
      impactScore: roundTo(memory.parsed.impactScore * 100, 1),
      confidence: roundTo(memory.parsed.confidence * 100, 1),
      createdAt: memory.createdAt,
    }));

  const recentPromotions = memorySuggestions
    .filter((row) => row.status === "promoted")
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 5)
    .map((row) => ({
      suggestionId: String(row._id),
      title: row.title,
      summary: row.summary,
      source: row.source,
      category: row.category,
      status: row.status,
      updatedAt: row.updatedAt,
      promotedMemoryId: row.promotedMemoryId ?? null,
    }));

  const memoryCreatedCounts = countRowsByBucket(
    builtInMemories,
    bucketSet,
    (row) => row.createdAt
  );
  const memoryImpactTrend = bucketSet.buckets.map((bucket, index) => {
    const bucketMemories = builtInMemories.filter((row) =>
      isWithinWindow(row.createdAt, {
        startMs: bucket.startMs,
        endMs: bucket.endMs,
      })
    );
    const avgImpact =
      bucketMemories.length > 0
        ? bucketMemories.reduce((sum, row) => sum + row.parsed.impactScore, 0) /
          bucketMemories.length
        : 0;
    const avgConfidence =
      bucketMemories.length > 0
        ? bucketMemories.reduce((sum, row) => sum + row.parsed.confidence, 0) /
          bucketMemories.length
        : 0;

    return {
      date: bucket.label,
      memoryWrites: memoryCreatedCounts[index],
      impactScore: roundTo(avgImpact * 100, 1),
      confidence: roundTo(avgConfidence * 100, 1),
    };
  });

  const staleThreshold = getCurrentUTCTimestamp() - 30 * 24 * 60 * 60 * 1000;
  const freshMemories = builtInMemories.filter(
    (row) => row.createdAt >= staleThreshold
  );
  const freshnessRate = roundTo(
    calculateRate(freshMemories.length, builtInMemories.length || 1),
    1
  );
  const avgMemoryConfidence =
    builtInMemories.length > 0
      ? roundTo(
          (builtInMemories.reduce(
            (sum, row) => sum + row.parsed.confidence,
            0
          ) /
            builtInMemories.length) *
            100,
          1
        )
      : 0;
  const avgMemoryImpact =
    builtInMemories.length > 0
      ? roundTo(
          (builtInMemories.reduce(
            (sum, row) => sum + row.parsed.impactScore,
            0
          ) /
            builtInMemories.length) *
            100,
          1
        )
      : 0;

  const qualificationTrend = bucketSet.buckets.map((bucket) => {
    const completedEvents = workflowEvents.filter(
      (event) =>
        event.eventType === "qualification_completed" &&
        isWithinWindow(event.occurredAt, {
          startMs: bucket.startMs,
          endMs: bucket.endMs,
        })
    );
    const qualifiedEvents = completedEvents.filter(
      (event) =>
        (event.payload as { qualified?: boolean } | undefined)?.qualified
    );

    return {
      date: bucket.label,
      precision: roundTo(
        calculateRate(qualifiedEvents.length, completedEvents.length),
        1
      ),
      completed: completedEvents.length,
    };
  });

  const enrichmentTrend = bucketSet.buckets.map((bucket) => {
    const relevantEvents = workflowEvents.filter(
      (event) =>
        event.eventType === "enrichment_completed" &&
        isWithinWindow(event.occurredAt, {
          startMs: bucket.startMs,
          endMs: bucket.endMs,
        })
    );
    const avgPainPointCount =
      relevantEvents.length > 0
        ? relevantEvents.reduce((sum, event) => {
            const payload = event.payload as
              | { painPointCount?: number }
              | undefined;
            return sum + (payload?.painPointCount ?? 0);
          }, 0) / relevantEvents.length
        : 0;

    return {
      date: bucket.label,
      usefulness: roundTo(Math.min(100, avgPainPointCount * 20), 1),
      completions: relevantEvents.length,
    };
  });

  const outreachTrend = bucketSet.buckets.map((bucket) => {
    const approvedTasks = workflowEvents.filter(
      (event) =>
        event.eventType === "outreach_task_approved" &&
        isWithinWindow(event.occurredAt, {
          startMs: bucket.startMs,
          endMs: bucket.endMs,
        })
    ).length;
    const responded = sumDailyFieldInWindow(
      analyticsRows,
      "respondedEventsCount",
      {
        startMs: bucket.startMs,
        endMs: bucket.endMs,
      }
    );

    return {
      date: bucket.label,
      effectiveness: roundTo(calculateRate(responded, approvedTasks), 1),
      approvals: approvedTasks,
      responses: responded,
    };
  });

  const correctionTrend = bucketSet.buckets.map((bucket) => {
    const editedApprovals = workflowEvents.filter((event) => {
      if (event.eventType !== "outreach_task_approved") {
        return false;
      }

      if (
        !isWithinWindow(event.occurredAt, {
          startMs: bucket.startMs,
          endMs: bucket.endMs,
        })
      ) {
        return false;
      }

      const payload = event.payload as { edited?: boolean } | undefined;
      return payload?.edited === true;
    }).length;
    const rejectedSuggestions = memorySuggestions.filter(
      (row) =>
        row.status === "rejected" &&
        isWithinWindow(row.updatedAt, {
          startMs: bucket.startMs,
          endMs: bucket.endMs,
        })
    ).length;

    return {
      date: bucket.label,
      corrections: editedApprovals + rejectedSuggestions,
      editedApprovals,
      rejectedSuggestions,
    };
  });

  return {
    overview: {
      metrics: {
        healthScore: buildMetric({
          currentValue: currentHealthScore,
          previousValue: previousHealthScore,
          valueDecimals: 0,
        }),
        qualityScore: buildMetric({
          currentValue: currentQualityScore,
          previousValue: previousQualityScore,
          valueDecimals: 1,
        }),
        selfImprovementImpact: buildMetric({
          currentValue: currentSelfImprovementScore,
          previousValue: previousSelfImprovementScore,
          valueDecimals: 1,
        }),
        blockedItems: buildMetric({
          currentValue: blockedItems,
          previousValue: memorySuggestions.filter(
            (row) =>
              row.status === "pending_review" &&
              isWithinWindow(row.updatedAt, previousWindow)
          ).length,
        }),
        keywords: buildMetric({
          currentValue: seedKeywords.length,
          previousValue:
            seedKeywords.length -
            seedKeywords.filter((row) =>
              isWithinWindow(row._creationTime, currentWindow)
            ).length,
        }),
        queries: buildMetric({
          currentValue: socialQueries.length,
          previousValue:
            socialQueries.length -
            socialQueries.filter((row) =>
              isWithinWindow(row._creationTime, currentWindow)
            ).length,
        }),
        monitors: buildMetric({
          currentValue: monitors.length,
          previousValue:
            monitors.length -
            monitors.filter((row) =>
              isWithinWindow(row._creationTime, currentWindow)
            ).length,
        }),
        replyRate: buildMetric({
          currentValue: currentReplyRate,
          previousValue: previousReplyRate,
          valueDecimals: 1,
        }),
      },
      qualityTrend,
      selfImprovementTrend,
      bestQueries,
      weakestQueries,
      funnel: buildPipelineFunnel({
        newCount: workspaceStats.newProspectsCount,
        contactedCount: workspaceStats.contactedProspectsCount,
        inProgressCount: workspaceStats.inProgressProspectsCount,
        convertedCount: workspaceStats.convertedProspectsCount,
      }),
      recentChanges: activityFeed.slice(0, 8),
      blockedBreakdown: {
        pendingSuggestions: currentPendingSuggestions,
        failedRuns: currentFailedRuns,
        failedEvents: currentFailedEvents,
        failingMonitors,
      },
    },
    discovery: {
      stats: {
        totalKeywords: rawKeywords.length,
        seedKeywords: seedKeywords.length,
        socialQueries: socialQueries.length,
        activeQueries: queryCandidates.filter(
          (row) => row.status === "activated"
        ).length,
        retiredQueries: queryCandidates.filter(
          (row) => row.status === "retired"
        ).length,
        duplicateRate: roundTo(
          calculateRate(currentRejected, currentGenerated),
          1
        ),
        noveltyYield: currentAcceptedRate,
        monitors: {
          total: monitors.length,
          active: monitors.filter((row) => row.status === "active").length,
          paused: monitors.filter((row) => row.status === "paused").length,
          failing: monitors.filter((row) => row.healthStatus === "failing")
            .length,
        },
      },
      growthSeries: bucketSet.buckets.map((bucket, index) => ({
        date: bucket.label,
        keywords:
          countRowsByBucket(rawKeywords, bucketSet, (row) => row._creationTime)[
            index
          ] ?? 0,
        queries: acceptedCounts[index] ?? 0,
        monitors:
          countRowsByBucket(monitors, bucketSet, (row) => row._creationTime)[
            index
          ] ?? 0,
      })),
      efficiencySeries: bucketSet.buckets.map((bucket, index) => ({
        date: bucket.label,
        generated:
          acceptedCounts[index] +
          exactDuplicateCounts[index] +
          semanticDuplicateCounts[index],
        accepted: acceptedCounts[index],
        exactDuplicates: exactDuplicateCounts[index],
        semanticDuplicates: semanticDuplicateCounts[index],
      })),
      bestQueries,
      weakestQueries,
      inventory: queryInventory,
    },
    quality: {
      summary: {
        qualificationPrecision: buildMetric({
          currentValue: currentQualifiedRate,
          previousValue: previousQualifiedRate,
          valueDecimals: 1,
        }),
        enrichmentUsefulness: buildMetric({
          currentValue:
            enrichmentTrend.reduce((sum, row) => sum + row.usefulness, 0) /
              (enrichmentTrend.length || 1) || 0,
          previousValue: 0,
          valueDecimals: 1,
        }),
        outreachEffectiveness: buildMetric({
          currentValue: currentReplyRate,
          previousValue: previousReplyRate,
          valueDecimals: 1,
        }),
        correctionRate: buildMetric({
          currentValue: correctionTrend.reduce(
            (sum, row) => sum + row.corrections,
            0
          ),
          previousValue: 0,
        }),
      },
      qualificationTrend,
      enrichmentTrend,
      outreachTrend,
      correctionTrend,
      scorecards: {
        convertedAvgScore,
        archivedAvgScore,
        inProgressCount: workspaceStats.inProgressProspectsCount,
        convertedCount: workspaceStats.convertedProspectsCount,
      },
    },
    memory: {
      summary: {
        storedMemories: buildInMetricFromCount(
          builtInMemories.length,
          builtInMemories.filter((row) =>
            isWithinWindow(row.createdAt, currentWindow)
          ).length
        ),
        recentWrites: buildMetric({
          currentValue: builtInMemories.filter((row) =>
            isWithinWindow(row.createdAt, currentWindow)
          ).length,
          previousValue: builtInMemories.filter((row) =>
            isWithinWindow(row.createdAt, previousWindow)
          ).length,
        }),
        retrievedThisPeriod: buildMetric({
          currentValue: evaluatorRuns.reduce(
            (sum, row) => sum + (row.retrievalStats?.relevantMemories ?? 0),
            0
          ),
          previousValue: 0,
        }),
        memoryFreshness: buildMetric({
          currentValue: freshnessRate,
          previousValue: 0,
          valueDecimals: 1,
        }),
        avgConfidence: buildMetric({
          currentValue: avgMemoryConfidence,
          previousValue: 0,
          valueDecimals: 1,
        }),
        impactScore: buildMetric({
          currentValue: avgMemoryImpact,
          previousValue: 0,
          valueDecimals: 1,
        }),
        pendingReview: buildMetric({
          currentValue: currentPendingSuggestions,
          previousValue: memorySuggestions.filter(
            (row) =>
              row.status === "pending_review" &&
              isWithinWindow(row.updatedAt, previousWindow)
          ).length,
        }),
      },
      impactTrend: memoryImpactTrend,
      helpfulMemories,
      recentPromotions,
      inventory: memoryInventory,
    },
    activity: {
      counts: {
        pendingEvents: workflowEvents.filter((row) => row.status === "pending")
          .length,
        processingEvents: workflowEvents.filter(
          (row) => row.status === "processing"
        ).length,
        failedEvents: currentFailedEvents,
        runningRuns: evaluatorRuns.filter((row) => row.status === "running")
          .length,
        failedRuns: currentFailedRuns,
      },
      feed: activityFeed,
    },
    chartSeries: {
      discoveryVolume: bucketSet.buckets.map((bucket, index) => ({
        date: bucket.label,
        discovered: discoveredNewCounts[index] ?? 0,
        contacted: contactedCounts[index] ?? 0,
      })),
      memoryWrites: buildSeriesFromCounts(
        bucketSet,
        memoryCreatedCounts,
        "writes"
      ),
    },
  };
}

function buildInMetricFromCount(total: number, currentWindowCount: number) {
  return buildMetric({
    currentValue: total,
    previousValue: Math.max(0, total - currentWindowCount),
  });
}
