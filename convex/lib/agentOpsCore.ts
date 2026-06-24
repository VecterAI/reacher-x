import type { Doc } from "../_generated/dataModel";
import type { WorkspaceAgentMemoryRecord } from "./agentMemoryCore";
import {
  buildMetric,
  buildPipelineFunnel,
  calculateRate,
  countHourlyFieldByBucket,
  countTimestampsByBucket,
  sumHourlyFieldInWindow,
  type TimeWindow,
  type TrendBucketSet,
} from "./analyticsCore";
import { getNumberProperty, isRecord } from "./typeGuards";

type AnalyticsDailyRow = Doc<"workspaceAnalyticsDaily">;
type QueryCandidateRow = Doc<"queryCandidates">;
type QueryPerformanceRow = Doc<"queryPerformance">;
type WorkflowEventRow = Doc<"memoryWorkflowEvents">;
type EvaluatorRunRow = Doc<"memoryEvaluatorRuns">;
type MemorySuggestionRow = Doc<"memorySuggestions">;
type KeywordRow = Doc<"keywords">;

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

const HEALTH_PENDING_REVIEW_WEIGHT = 8;
const HEALTH_FAILED_RUN_WEIGHT = 10;
const HEALTH_FAILED_EVENT_WEIGHT = 6;

const QUALITY_QUALIFIED_WEIGHT = 0.4;
const QUALITY_RESPONSE_WEIGHT = 0.35;
const QUALITY_USEFULNESS_WEIGHT = 0.25;

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

function isWithinWindow(timestamp: number | undefined, window: TimeWindow) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return false;
  }

  return timestamp >= window.startMs && timestamp < window.endMs;
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
      return "activated";
    case "rejected_exact_duplicate":
      return "exact duplicate";
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

function buildQueryPerformanceRank(row: {
  replyRate: number;
  qualifiedCount: number;
  convertedCount: number;
  prospectsFound: number;
  performanceScore: number | null;
}) {
  return (
    row.qualifiedCount * 5 +
    row.convertedCount * 8 +
    row.replyRate * 1.5 +
    row.prospectsFound +
    (row.performanceScore ?? 0)
  );
}

function buildHealthScore(args: {
  pendingReviewCount: number;
  failedRuns: number;
  failedEvents: number;
}) {
  return clamp(
    100 -
      args.pendingReviewCount * HEALTH_PENDING_REVIEW_WEIGHT -
      args.failedRuns * HEALTH_FAILED_RUN_WEIGHT -
      args.failedEvents * HEALTH_FAILED_EVENT_WEIGHT,
    0,
    100
  );
}

function buildQualityScore(args: {
  qualifiedRate: number;
  responseRate: number;
  usefulnessScore: number;
  issuePenalty: number;
}) {
  return clamp(
    args.qualifiedRate * QUALITY_QUALIFIED_WEIGHT +
      args.responseRate * QUALITY_RESPONSE_WEIGHT +
      args.usefulnessScore * QUALITY_USEFULNESS_WEIGHT -
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

function getQueryReviewTimestamp(candidate: QueryCandidateRow) {
  if (typeof candidate.reviewedAt === "number") {
    return candidate.reviewedAt;
  }

  if (candidate.status === "generated") {
    return undefined;
  }

  return candidate.updatedAt;
}

function getQueryActivityTimestamp(candidate: QueryCandidateRow) {
  return (
    getQueryReviewTimestamp(candidate) ??
    candidate.retiredAt ??
    candidate.updatedAt ??
    candidate._creationTime
  );
}

function isQueryReviewed(candidate: QueryCandidateRow) {
  return candidate.status !== "generated";
}

function getSuggestionDecisionTimestamp(suggestion: MemorySuggestionRow) {
  return suggestion.reviewedAt ?? suggestion.updatedAt;
}

function getSuggestionActivityTimestamp(suggestion: MemorySuggestionRow) {
  return getSuggestionDecisionTimestamp(suggestion) ?? suggestion._creationTime;
}

function getRunStartedTimestamp(run: EvaluatorRunRow) {
  return run.startedAt ?? run._creationTime;
}

function getRunFinishedTimestamp(run: EvaluatorRunRow) {
  return run.completedAt ?? run.updatedAt ?? run.startedAt ?? run._creationTime;
}

function getReplyTotals(
  rows: AnalyticsDailyRow[],
  window: TimeWindow
): {
  contacted: number;
  responded: number;
} {
  return {
    contacted: sumHourlyFieldInWindow(
      rows,
      "hourlyContactedEventsCounts",
      window
    ),
    responded: sumHourlyFieldInWindow(
      rows,
      "hourlyRespondedEventsCounts",
      window
    ),
  };
}

function getReplyRate(rows: AnalyticsDailyRow[], window: TimeWindow) {
  const totals = getReplyTotals(rows, window);
  return roundTo(calculateRate(totals.responded, totals.contacted), 1);
}

function getEventBooleanPayload(
  event: WorkflowEventRow,
  key: string
): boolean | undefined {
  const payload = isRecord(event.payload) ? event.payload : undefined;
  const value = payload?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function getQualifiedRate(events: WorkflowEventRow[], window: TimeWindow) {
  const completed = events.filter(
    (event) =>
      event.eventType === "qualification_completed" &&
      isWithinWindow(event.occurredAt, window)
  );
  const qualified = completed.filter(
    (event) => getEventBooleanPayload(event, "qualified") === true
  ).length;

  return {
    completedCount: completed.length,
    qualifiedCount: qualified,
    rate: roundTo(calculateRate(qualified, completed.length), 1),
  };
}

function getEnrichmentUsefulness(
  events: WorkflowEventRow[],
  window: TimeWindow
) {
  const relevant = events.filter(
    (event) =>
      event.eventType === "enrichment_completed" &&
      isWithinWindow(event.occurredAt, window)
  );

  if (relevant.length === 0) {
    return {
      completions: 0,
      usefulness: 0,
    };
  }

  const totalPainPointCount = relevant.reduce((sum, event) => {
    return sum + (getNumberProperty(event.payload, "painPointCount") ?? 0);
  }, 0);

  return {
    completions: relevant.length,
    usefulness: roundTo(
      Math.min(100, (totalPainPointCount / relevant.length) * 20),
      1
    ),
  };
}

function getCorrectionsCount(
  workflowEvents: WorkflowEventRow[],
  memorySuggestions: MemorySuggestionRow[],
  window: TimeWindow
) {
  const editedApprovals = workflowEvents.filter((event) => {
    return (
      event.eventType === "outreach_task_approved" &&
      isWithinWindow(event.occurredAt, window) &&
      getEventBooleanPayload(event, "edited") === true
    );
  }).length;

  const rejectedSuggestions = memorySuggestions.filter(
    (suggestion) =>
      suggestion.status === "rejected" &&
      isWithinWindow(getSuggestionDecisionTimestamp(suggestion), window)
  ).length;

  return {
    count: editedApprovals + rejectedSuggestions,
    editedApprovals,
    rejectedSuggestions,
  };
}

function buildActivityItemFromEvent(
  event: WorkflowEventRow
): AgentOpsActivityItem {
  const payload = isRecord(event.payload) ? event.payload : undefined;
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
    timestamp: getRunFinishedTimestamp(run),
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
        : suggestion.status === "rejected"
          ? "memory suggestion rejected"
          : "memory suggestion",
    description: suggestion.title,
    status: suggestion.status,
    timestamp: getSuggestionActivityTimestamp(suggestion),
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
  analyticsRows?: AnalyticsDailyRow[];
  queryCandidates?: QueryCandidateRow[];
  queryPerformance?: QueryPerformanceRow[];
  workflowEvents?: WorkflowEventRow[];
  evaluatorRuns?: EvaluatorRunRow[];
  memorySuggestions?: MemorySuggestionRow[];
  builtInMemories?: WorkspaceAgentMemoryRecord[];
  rawKeywords?: KeywordRow[];
}) {
  const {
    bucketSet,
    currentWindow,
    previousWindow,
    analyticsRows = [],
    queryCandidates = [],
    queryPerformance = [],
    workflowEvents = [],
    evaluatorRuns = [],
    memorySuggestions = [],
    builtInMemories = [],
    rawKeywords = [],
  } = args;

  const currentReplyRate = getReplyRate(analyticsRows, currentWindow);
  const previousReplyRate = getReplyRate(analyticsRows, previousWindow);

  const currentQualification = getQualifiedRate(workflowEvents, currentWindow);
  const previousQualification = getQualifiedRate(
    workflowEvents,
    previousWindow
  );

  const currentEnrichment = getEnrichmentUsefulness(
    workflowEvents,
    currentWindow
  );
  const previousEnrichment = getEnrichmentUsefulness(
    workflowEvents,
    previousWindow
  );

  const currentCorrections = getCorrectionsCount(
    workflowEvents,
    memorySuggestions,
    currentWindow
  );
  const previousCorrections = getCorrectionsCount(
    workflowEvents,
    memorySuggestions,
    previousWindow
  );

  const currentKeywordsCreated = rawKeywords.filter((row) =>
    isWithinWindow(row._creationTime, currentWindow)
  ).length;
  const previousKeywordsCreated = rawKeywords.filter((row) =>
    isWithinWindow(row._creationTime, previousWindow)
  ).length;

  const currentQueriesGenerated = queryCandidates.filter((row) =>
    isWithinWindow(row._creationTime, currentWindow)
  ).length;
  const previousQueriesGenerated = queryCandidates.filter((row) =>
    isWithinWindow(row._creationTime, previousWindow)
  ).length;

  const currentQueriesActivated = queryCandidates.filter(
    (row) =>
      row.status === "activated" &&
      isWithinWindow(getQueryReviewTimestamp(row), currentWindow)
  ).length;
  const previousQueriesActivated = queryCandidates.filter(
    (row) =>
      row.status === "activated" &&
      isWithinWindow(getQueryReviewTimestamp(row), previousWindow)
  ).length;

  const currentReviewedQueries = queryCandidates.filter(
    (row) =>
      isQueryReviewed(row) &&
      isWithinWindow(getQueryReviewTimestamp(row), currentWindow)
  ).length;
  const previousReviewedQueries = queryCandidates.filter(
    (row) =>
      isQueryReviewed(row) &&
      isWithinWindow(getQueryReviewTimestamp(row), previousWindow)
  ).length;

  const currentExactDuplicates = queryCandidates.filter(
    (row) =>
      row.status === "rejected_exact_duplicate" &&
      isWithinWindow(getQueryReviewTimestamp(row), currentWindow)
  ).length;
  const previousExactDuplicates = queryCandidates.filter(
    (row) =>
      row.status === "rejected_exact_duplicate" &&
      isWithinWindow(getQueryReviewTimestamp(row), previousWindow)
  ).length;

  const currentSemanticDuplicates = queryCandidates.filter(
    (row) =>
      row.status === "rejected_semantic_duplicate" &&
      isWithinWindow(getQueryReviewTimestamp(row), currentWindow)
  ).length;
  const previousSemanticDuplicates = queryCandidates.filter(
    (row) =>
      row.status === "rejected_semantic_duplicate" &&
      isWithinWindow(getQueryReviewTimestamp(row), previousWindow)
  ).length;

  const currentDuplicateRejected =
    currentExactDuplicates + currentSemanticDuplicates;
  const previousDuplicateRejected =
    previousExactDuplicates + previousSemanticDuplicates;

  const currentDuplicateRejectionRate = roundTo(
    calculateRate(currentDuplicateRejected, currentReviewedQueries),
    1
  );
  const previousDuplicateRejectionRate = roundTo(
    calculateRate(previousDuplicateRejected, previousReviewedQueries),
    1
  );

  const currentAcceptanceRate = roundTo(
    calculateRate(currentQueriesActivated, currentReviewedQueries),
    1
  );
  const previousAcceptanceRate = roundTo(
    calculateRate(previousQueriesActivated, previousReviewedQueries),
    1
  );

  const currentSuggestionsCreated = memorySuggestions.filter((row) =>
    isWithinWindow(row._creationTime, currentWindow)
  ).length;
  const previousSuggestionsCreated = memorySuggestions.filter((row) =>
    isWithinWindow(row._creationTime, previousWindow)
  ).length;

  const currentPromotedSuggestions = memorySuggestions.filter(
    (row) =>
      row.status === "promoted" &&
      isWithinWindow(getSuggestionDecisionTimestamp(row), currentWindow)
  ).length;
  const previousPromotedSuggestions = memorySuggestions.filter(
    (row) =>
      row.status === "promoted" &&
      isWithinWindow(getSuggestionDecisionTimestamp(row), previousWindow)
  ).length;

  const currentRejectedSuggestions = memorySuggestions.filter(
    (row) =>
      row.status === "rejected" &&
      isWithinWindow(getSuggestionDecisionTimestamp(row), currentWindow)
  ).length;
  const previousRejectedSuggestions = memorySuggestions.filter(
    (row) =>
      row.status === "rejected" &&
      isWithinWindow(getSuggestionDecisionTimestamp(row), previousWindow)
  ).length;

  const currentPendingReviewSuggestions = memorySuggestions.filter(
    (row) =>
      row.status === "pending_review" &&
      isWithinWindow(row._creationTime, currentWindow)
  ).length;
  const previousPendingReviewSuggestions = memorySuggestions.filter(
    (row) =>
      row.status === "pending_review" &&
      isWithinWindow(row._creationTime, previousWindow)
  ).length;

  const currentMemoriesWritten = builtInMemories.filter((row) =>
    isWithinWindow(row.createdAt, currentWindow)
  ).length;
  const previousMemoriesWritten = builtInMemories.filter((row) =>
    isWithinWindow(row.createdAt, previousWindow)
  ).length;

  const currentEventsReceived = workflowEvents.filter((row) =>
    isWithinWindow(row.occurredAt, currentWindow)
  ).length;
  const previousEventsReceived = workflowEvents.filter((row) =>
    isWithinWindow(row.occurredAt, previousWindow)
  ).length;

  const currentFailedEvents = workflowEvents.filter(
    (row) =>
      row.status === "failed" && isWithinWindow(row.occurredAt, currentWindow)
  ).length;
  const previousFailedEvents = workflowEvents.filter(
    (row) =>
      row.status === "failed" && isWithinWindow(row.occurredAt, previousWindow)
  ).length;

  const currentRunsStarted = evaluatorRuns.filter((row) =>
    isWithinWindow(getRunStartedTimestamp(row), currentWindow)
  ).length;
  const previousRunsStarted = evaluatorRuns.filter((row) =>
    isWithinWindow(getRunStartedTimestamp(row), previousWindow)
  ).length;

  const currentFailedRuns = evaluatorRuns.filter(
    (row) =>
      row.status === "failed" &&
      isWithinWindow(getRunFinishedTimestamp(row), currentWindow)
  ).length;
  const previousFailedRuns = evaluatorRuns.filter(
    (row) =>
      row.status === "failed" &&
      isWithinWindow(getRunFinishedTimestamp(row), previousWindow)
  ).length;

  const currentNeedsAttention =
    currentPendingReviewSuggestions + currentFailedEvents + currentFailedRuns;
  const previousNeedsAttention =
    previousPendingReviewSuggestions +
    previousFailedEvents +
    previousFailedRuns;

  const currentHealthScore = buildHealthScore({
    pendingReviewCount: currentPendingReviewSuggestions,
    failedRuns: currentFailedRuns,
    failedEvents: currentFailedEvents,
  });
  const previousHealthScore = buildHealthScore({
    pendingReviewCount: previousPendingReviewSuggestions,
    failedRuns: previousFailedRuns,
    failedEvents: previousFailedEvents,
  });

  const currentQualityScore = roundTo(
    buildQualityScore({
      qualifiedRate: currentQualification.rate,
      responseRate: currentReplyRate,
      usefulnessScore: currentEnrichment.usefulness,
      issuePenalty: currentFailedEvents * 1.5 + currentFailedRuns * 2,
    }),
    1
  );
  const previousQualityScore = roundTo(
    buildQualityScore({
      qualifiedRate: previousQualification.rate,
      responseRate: previousReplyRate,
      usefulnessScore: previousEnrichment.usefulness,
      issuePenalty: previousFailedEvents * 1.5 + previousFailedRuns * 2,
    }),
    1
  );

  const currentSelfImprovementScore = roundTo(
    buildSelfImprovementScore({
      acceptedRate: currentAcceptanceRate,
      promotedCount: currentPromotedSuggestions,
      impactedReplyRate: currentReplyRate,
      duplicateWaste: currentDuplicateRejected,
    }),
    1
  );
  const previousSelfImprovementScore = roundTo(
    buildSelfImprovementScore({
      acceptedRate: previousAcceptanceRate,
      promotedCount: previousPromotedSuggestions,
      impactedReplyRate: previousReplyRate,
      duplicateWaste: previousDuplicateRejected,
    }),
    1
  );

  const qualityTrend = bucketSet.buckets.map((bucket) => {
    const bucketQualification = getQualifiedRate(workflowEvents, bucket);
    const bucketReplyRate = getReplyRate(analyticsRows, bucket);
    const bucketEnrichment = getEnrichmentUsefulness(workflowEvents, bucket);
    const bucketFailedEvents = workflowEvents.filter(
      (event) =>
        event.status === "failed" && isWithinWindow(event.occurredAt, bucket)
    ).length;
    const bucketFailedRuns = evaluatorRuns.filter(
      (run) =>
        run.status === "failed" &&
        isWithinWindow(getRunFinishedTimestamp(run), bucket)
    ).length;

    return {
      date: bucket.label,
      qualityScore: roundTo(
        buildQualityScore({
          qualifiedRate: bucketQualification.rate,
          responseRate: bucketReplyRate,
          usefulnessScore: bucketEnrichment.usefulness,
          issuePenalty: bucketFailedEvents * 1.5 + bucketFailedRuns * 2,
        }),
        1
      ),
    };
  });

  const queryGeneratedCounts = countRowsByBucket(
    queryCandidates,
    bucketSet,
    (row) => row._creationTime
  );
  const queryReviewedCounts = countRowsByBucket(
    queryCandidates,
    bucketSet,
    (row) => getQueryReviewTimestamp(row),
    (row) => isQueryReviewed(row)
  );
  const queryActivatedCounts = countRowsByBucket(
    queryCandidates,
    bucketSet,
    (row) => getQueryReviewTimestamp(row),
    (row) => row.status === "activated"
  );
  const exactDuplicateCounts = countRowsByBucket(
    queryCandidates,
    bucketSet,
    (row) => getQueryReviewTimestamp(row),
    (row) => row.status === "rejected_exact_duplicate"
  );
  const semanticDuplicateCounts = countRowsByBucket(
    queryCandidates,
    bucketSet,
    (row) => getQueryReviewTimestamp(row),
    (row) => row.status === "rejected_semantic_duplicate"
  );
  const promotedCounts = countRowsByBucket(
    memorySuggestions,
    bucketSet,
    (row) => getSuggestionDecisionTimestamp(row),
    (row) => row.status === "promoted"
  );
  const keywordCreatedCounts = countRowsByBucket(
    rawKeywords,
    bucketSet,
    (row) => row._creationTime
  );
  const replyCounts = countHourlyFieldByBucket(
    analyticsRows,
    "hourlyRespondedEventsCounts",
    bucketSet
  );

  const selfImprovementTrend = bucketSet.buckets.map((bucket, index) => ({
    date: bucket.label,
    duplicateWaste:
      (exactDuplicateCounts[index] ?? 0) +
      (semanticDuplicateCounts[index] ?? 0),
    noveltyYield: roundTo(
      calculateRate(
        queryActivatedCounts[index] ?? 0,
        queryReviewedCounts[index] ?? 0
      ),
      1
    ),
    promotedMemories: promotedCounts[index] ?? 0,
    replies: replyCounts[index] ?? 0,
  }));

  const performanceByCandidateId = new Map<string, QueryPerformanceRow>();
  for (const performance of queryPerformance) {
    if (!performance.activatedQueryCandidateId) {
      continue;
    }

    const key = String(performance.activatedQueryCandidateId);
    const existing = performanceByCandidateId.get(key);
    if (!existing || performance.updatedAt > existing.updatedAt) {
      performanceByCandidateId.set(key, performance);
    }
  }

  const queryInventory = queryCandidates
    .filter(
      (candidate) =>
        isWithinWindow(candidate._creationTime, currentWindow) ||
        isWithinWindow(getQueryReviewTimestamp(candidate), currentWindow) ||
        isWithinWindow(candidate.retiredAt, currentWindow)
    )
    .map((candidate) => {
      const performance = performanceByCandidateId.get(String(candidate._id));

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
        createdAt: candidate._creationTime,
        reviewedAt: getQueryReviewTimestamp(candidate) ?? null,
        prospectsFound: performance?.prospectsFound ?? 0,
        qualifiedCount: performance?.qualifiedCount ?? 0,
        convertedCount: performance?.convertedCount ?? 0,
        replyRate: performance?.replyRate ?? 0,
        updatedAt: getQueryActivityTimestamp(candidate),
      };
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);

  const rankedQueries = queryInventory
    .filter(
      (row) =>
        row.prospectsFound > 0 ||
        row.qualifiedCount > 0 ||
        row.convertedCount > 0 ||
        row.replyRate > 0 ||
        row.performanceScore !== null
    )
    .sort(
      (left, right) =>
        buildQueryPerformanceRank(right) - buildQueryPerformanceRank(left)
    );

  const bestQueries = rankedQueries.slice(0, 5).map((row) => ({
    queryCandidateId: row.queryCandidateId,
    label: row.rawValue,
    replyRate: roundTo(row.replyRate, 1),
    qualifiedCount: row.qualifiedCount,
    convertedCount: row.convertedCount,
    prospectsFound: row.prospectsFound,
  }));
  const weakestQueries = [...rankedQueries]
    .reverse()
    .slice(0, 5)
    .map((row) => ({
      queryCandidateId: row.queryCandidateId,
      label: row.rawValue,
      replyRate: roundTo(row.replyRate, 1),
      qualifiedCount: row.qualifiedCount,
      convertedCount: row.convertedCount,
      prospectsFound: row.prospectsFound,
    }));

  const activityFeed = [
    ...workflowEvents
      .filter((event) => isWithinWindow(event.occurredAt, currentWindow))
      .map(buildActivityItemFromEvent),
    ...evaluatorRuns
      .filter((run) =>
        isWithinWindow(getRunFinishedTimestamp(run), currentWindow)
      )
      .map(buildActivityItemFromRun),
    ...memorySuggestions
      .filter((suggestion) =>
        isWithinWindow(
          getSuggestionActivityTimestamp(suggestion),
          currentWindow
        )
      )
      .map(buildActivityItemFromSuggestion),
  ]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 40);

  const memoryInventory = builtInMemories
    .filter((memory) => isWithinWindow(memory.createdAt, currentWindow))
    .map((memory) => ({
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
    }))
    .sort((left, right) => right.createdAt - left.createdAt);

  const helpfulMemories = [...memoryInventory]
    .sort(
      (left, right) =>
        right.impactScore - left.impactScore || right.createdAt - left.createdAt
    )
    .slice(0, 5);

  const recentPromotions = memorySuggestions
    .filter(
      (row) =>
        row.status === "promoted" &&
        isWithinWindow(getSuggestionDecisionTimestamp(row), currentWindow)
    )
    .sort(
      (left, right) =>
        (getSuggestionDecisionTimestamp(right) ?? right.updatedAt) -
        (getSuggestionDecisionTimestamp(left) ?? left.updatedAt)
    )
    .slice(0, 5)
    .map((row) => ({
      suggestionId: String(row._id),
      title: row.title,
      summary: row.summary,
      source: row.source,
      category: row.category,
      status: row.status,
      updatedAt: getSuggestionDecisionTimestamp(row) ?? row.updatedAt,
      promotedMemoryId: row.promotedMemoryId ?? null,
    }));

  const memoryCreatedCounts = countRowsByBucket(
    builtInMemories,
    bucketSet,
    (row) => row.createdAt
  );
  const memoryImpactTrend = bucketSet.buckets.map((bucket, index) => {
    const bucketMemories = builtInMemories.filter((row) =>
      isWithinWindow(row.createdAt, bucket)
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
      memoryWrites: memoryCreatedCounts[index] ?? 0,
      impactScore: roundTo(avgImpact * 100, 1),
      confidence: roundTo(avgConfidence * 100, 1),
    };
  });

  const qualificationTrend = bucketSet.buckets.map((bucket) => {
    const bucketQualification = getQualifiedRate(workflowEvents, bucket);

    return {
      date: bucket.label,
      precision: bucketQualification.rate,
      completed: bucketQualification.completedCount,
    };
  });

  const enrichmentTrend = bucketSet.buckets.map((bucket) => {
    const bucketEnrichment = getEnrichmentUsefulness(workflowEvents, bucket);

    return {
      date: bucket.label,
      usefulness: bucketEnrichment.usefulness,
      completions: bucketEnrichment.completions,
    };
  });

  const outreachTrend = bucketSet.buckets.map((bucket) => {
    const approvals = workflowEvents.filter(
      (event) =>
        event.eventType === "outreach_task_approved" &&
        isWithinWindow(event.occurredAt, bucket)
    ).length;
    const responses = sumHourlyFieldInWindow(
      analyticsRows,
      "hourlyRespondedEventsCounts",
      bucket
    );

    return {
      date: bucket.label,
      effectiveness: roundTo(calculateRate(responses, approvals), 1),
      approvals,
      responses,
    };
  });

  const correctionTrend = bucketSet.buckets.map((bucket) => {
    const corrections = getCorrectionsCount(
      workflowEvents,
      memorySuggestions,
      bucket
    );

    return {
      date: bucket.label,
      corrections: corrections.count,
      editedApprovals: corrections.editedApprovals,
      rejectedSuggestions: corrections.rejectedSuggestions,
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
        needsAttention: buildMetric({
          currentValue: currentNeedsAttention,
          previousValue: previousNeedsAttention,
          trendWhenEqual: "down",
        }),
        keywordsCreated: buildMetric({
          currentValue: currentKeywordsCreated,
          previousValue: previousKeywordsCreated,
        }),
        queriesGenerated: buildMetric({
          currentValue: currentQueriesGenerated,
          previousValue: previousQueriesGenerated,
        }),
        queriesActivated: buildMetric({
          currentValue: currentQueriesActivated,
          previousValue: previousQueriesActivated,
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
        newCount: 0,
        contactedCount: 0,
        inProgressCount: 0,
        convertedCount: 0,
      }),
      recentChanges: activityFeed.slice(0, 8),
      blockedBreakdown: {
        pendingSuggestions: currentPendingReviewSuggestions,
        failedRuns: currentFailedRuns,
        failedEvents: currentFailedEvents,
        failingMonitors: 0,
      },
    },
    discovery: {
      stats: {
        keywordsCreated: buildMetric({
          currentValue: currentKeywordsCreated,
          previousValue: previousKeywordsCreated,
        }),
        queriesGenerated: buildMetric({
          currentValue: currentQueriesGenerated,
          previousValue: previousQueriesGenerated,
        }),
        queriesActivated: buildMetric({
          currentValue: currentQueriesActivated,
          previousValue: previousQueriesActivated,
        }),
        duplicateRejectionRate: buildMetric({
          currentValue: currentDuplicateRejectionRate,
          previousValue: previousDuplicateRejectionRate,
          valueDecimals: 1,
          trendWhenEqual: "down",
        }),
      },
      growthSeries: bucketSet.buckets.map((bucket, index) => ({
        date: bucket.label,
        keywords: keywordCreatedCounts[index] ?? 0,
        generated: queryGeneratedCounts[index] ?? 0,
        activated: queryActivatedCounts[index] ?? 0,
      })),
      efficiencySeries: bucketSet.buckets.map((bucket, index) => ({
        date: bucket.label,
        generated: queryReviewedCounts[index] ?? 0,
        accepted: queryActivatedCounts[index] ?? 0,
        exactDuplicates: exactDuplicateCounts[index] ?? 0,
        semanticDuplicates: semanticDuplicateCounts[index] ?? 0,
      })),
      bestQueries,
      weakestQueries,
      inventory: queryInventory,
    },
    quality: {
      summary: {
        qualificationPrecision: buildMetric({
          currentValue: currentQualification.rate,
          previousValue: previousQualification.rate,
          valueDecimals: 1,
        }),
        enrichmentUsefulness: buildMetric({
          currentValue: currentEnrichment.usefulness,
          previousValue: previousEnrichment.usefulness,
          valueDecimals: 1,
        }),
        outreachEffectiveness: buildMetric({
          currentValue: currentReplyRate,
          previousValue: previousReplyRate,
          valueDecimals: 1,
        }),
        correctionRate: buildMetric({
          currentValue: currentCorrections.count,
          previousValue: previousCorrections.count,
          trendWhenEqual: "down",
        }),
      },
      qualificationTrend,
      enrichmentTrend,
      outreachTrend,
      correctionTrend,
      scorecards: {
        convertedAvgScore: 0,
        archivedAvgScore: 0,
        inProgressCount: 0,
        convertedCount: 0,
      },
    },
    memory: {
      summary: {
        memoriesWritten: buildMetric({
          currentValue: currentMemoriesWritten,
          previousValue: previousMemoriesWritten,
        }),
        memoriesPromoted: buildMetric({
          currentValue: currentPromotedSuggestions,
          previousValue: previousPromotedSuggestions,
        }),
        suggestionsCreated: buildMetric({
          currentValue: currentSuggestionsCreated,
          previousValue: previousSuggestionsCreated,
        }),
        suggestionsRejected: buildMetric({
          currentValue: currentRejectedSuggestions,
          previousValue: previousRejectedSuggestions,
          trendWhenEqual: "down",
        }),
      },
      impactTrend: memoryImpactTrend,
      helpfulMemories,
      recentPromotions,
      inventory: memoryInventory,
    },
    activity: {
      counts: {
        eventsReceived: buildMetric({
          currentValue: currentEventsReceived,
          previousValue: previousEventsReceived,
        }),
        runsStarted: buildMetric({
          currentValue: currentRunsStarted,
          previousValue: previousRunsStarted,
        }),
        failedEvents: currentFailedEvents,
        failedRuns: currentFailedRuns,
      },
      feed: activityFeed,
    },
  };
}
