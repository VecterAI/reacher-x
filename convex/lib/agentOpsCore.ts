import type { Doc } from "../_generated/dataModel";
import type { WorkspaceAgentMemoryInventoryRecord } from "./agentMemoryCore";
import {
  buildMetric,
  calculateRate,
  countHourlyFieldByBucket,
  sumHourlyFieldInWindow,
  type TimeWindow,
  type TrendBucketSet,
} from "./analyticsCore";
import { isRecord } from "./typeGuards";

type AnalyticsDailyRow = Doc<"workspaceAnalyticsDaily">;
type AgentOpsDailyRow = Doc<"workspaceAgentOpsDaily">;
type QueryCandidateRow = Doc<"queryCandidates">;
type QueryPerformanceDailyRow = Doc<"workspaceQueryPerformanceDaily">;
type WorkflowEventRow = Doc<"memoryWorkflowEvents">;
type EvaluatorRunRow = Doc<"memoryEvaluatorRuns">;
type MemorySuggestionRow = Doc<"memorySuggestions">;

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

function buildQueryPerformanceScore(row: {
  prospectsFound: number;
  qualifiedCount: number;
  convertedCount: number;
  replyCount: number;
  replyRate: number;
  qualificationRate: number;
}) {
  return (
    row.convertedCount * 100 +
    row.replyCount * 25 +
    row.qualifiedCount * 10 +
    row.prospectsFound * 2 +
    row.replyRate +
    row.qualificationRate
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

function getSuggestionDecisionTimestamp(suggestion: MemorySuggestionRow) {
  return suggestion.reviewedAt ?? suggestion.updatedAt;
}

function getSuggestionActivityTimestamp(suggestion: MemorySuggestionRow) {
  return getSuggestionDecisionTimestamp(suggestion) ?? suggestion._creationTime;
}

function getRunFinishedTimestamp(run: EvaluatorRunRow) {
  return run.completedAt ?? run.updatedAt ?? run.startedAt ?? run._creationTime;
}

function sumHourlyRowFieldInWindow(
  row: {
    dayStartUtcMs: number;
    [key: string]: number | number[] | string | undefined;
  },
  field: string,
  window: TimeWindow
) {
  const counts = Array.isArray(row[field]) ? (row[field] as number[]) : [];
  let total = 0;
  for (let hour = 0; hour < counts.length; hour += 1) {
    const hourStartMs = row.dayStartUtcMs + hour * 60 * 60 * 1000;
    if (isWithinWindow(hourStartMs, window)) {
      total += counts[hour] ?? 0;
    }
  }
  return total;
}

type WindowQueryPerformanceRow = {
  queryId: string;
  queryCandidateId: string | null;
  impressions: number;
  prospectsFound: number;
  qualifiedCount: number;
  convertedCount: number;
  replyCount: number;
  replyRate: number;
  qualificationRate: number;
  performanceScore: number;
  updatedAt: number;
};

function buildWindowQueryPerformanceRows(
  rows: QueryPerformanceDailyRow[],
  window: TimeWindow
): WindowQueryPerformanceRow[] {
  const grouped = new Map<string, WindowQueryPerformanceRow>();

  for (const row of rows) {
    const queryCandidateId = row.activatedQueryCandidateId
      ? String(row.activatedQueryCandidateId)
      : null;
    const key = queryCandidateId ?? `query:${String(row.queryId)}`;
    const current = grouped.get(key) ?? {
      queryId: String(row.queryId),
      queryCandidateId,
      impressions: 0,
      prospectsFound: 0,
      qualifiedCount: 0,
      convertedCount: 0,
      replyCount: 0,
      replyRate: 0,
      qualificationRate: 0,
      performanceScore: 0,
      updatedAt: 0,
    };

    current.impressions += sumHourlyRowFieldInWindow(
      row,
      "hourlyImpressionsCounts",
      window
    );
    current.prospectsFound += sumHourlyRowFieldInWindow(
      row,
      "hourlyProspectsFoundCounts",
      window
    );
    current.qualifiedCount += sumHourlyRowFieldInWindow(
      row,
      "hourlyQualifiedCounts",
      window
    );
    current.convertedCount += sumHourlyRowFieldInWindow(
      row,
      "hourlyConvertedCounts",
      window
    );
    current.replyCount += sumHourlyRowFieldInWindow(
      row,
      "hourlyReplyCounts",
      window
    );
    current.updatedAt = Math.max(current.updatedAt, row.updatedAt);
    grouped.set(key, current);
  }

  return [...grouped.values()].map((row) => {
    const replyRate = roundTo(
      calculateRate(row.replyCount, row.prospectsFound),
      1
    );
    const qualificationRate = roundTo(
      calculateRate(row.qualifiedCount, row.prospectsFound),
      1
    );
    return {
      ...row,
      replyRate,
      qualificationRate,
      performanceScore: buildQueryPerformanceScore({
        prospectsFound: row.prospectsFound,
        qualifiedCount: row.qualifiedCount,
        convertedCount: row.convertedCount,
        replyCount: row.replyCount,
        replyRate,
        qualificationRate,
      }),
    };
  });
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

function sumAgentOpsFieldInWindow(
  rows: AgentOpsDailyRow[],
  field: keyof Pick<
    AgentOpsDailyRow,
    | "hourlyKeywordsCreatedCounts"
    | "hourlyQueriesGeneratedCounts"
    | "hourlyQueriesReviewedCounts"
    | "hourlyQueriesActivatedCounts"
    | "hourlyQueriesRejectedExactDuplicateCounts"
    | "hourlyQueriesRejectedSemanticDuplicateCounts"
    | "hourlySuggestionsCreatedCounts"
    | "hourlySuggestionsPendingReviewCounts"
    | "hourlySuggestionsPromotedCounts"
    | "hourlySuggestionsRejectedCounts"
    | "hourlyMemoriesWrittenCounts"
    | "hourlyMemoryImpactScoreSums"
    | "hourlyMemoryConfidenceSums"
    | "hourlyEventsReceivedCounts"
    | "hourlyFailedEventsCounts"
    | "hourlyRunsStartedCounts"
    | "hourlyFailedRunsCounts"
    | "hourlyQualificationCompletedCounts"
    | "hourlyQualificationQualifiedCounts"
    | "hourlyEnrichmentCompletedCounts"
    | "hourlyEnrichmentPainPointCountSums"
    | "hourlyOutreachTaskApprovedCounts"
    | "hourlyOutreachTaskApprovedEditedCounts"
  >,
  window: TimeWindow
) {
  return sumHourlyFieldInWindow(rows, field, window);
}

function countAgentOpsFieldByBucket(
  rows: AgentOpsDailyRow[],
  field: keyof Pick<
    AgentOpsDailyRow,
    | "hourlyKeywordsCreatedCounts"
    | "hourlyQueriesGeneratedCounts"
    | "hourlyQueriesReviewedCounts"
    | "hourlyQueriesActivatedCounts"
    | "hourlyQueriesRejectedExactDuplicateCounts"
    | "hourlyQueriesRejectedSemanticDuplicateCounts"
    | "hourlySuggestionsPromotedCounts"
    | "hourlySuggestionsRejectedCounts"
    | "hourlyMemoriesWrittenCounts"
    | "hourlyMemoryImpactScoreSums"
    | "hourlyMemoryConfidenceSums"
    | "hourlyEventsReceivedCounts"
    | "hourlyFailedEventsCounts"
    | "hourlyRunsStartedCounts"
    | "hourlyFailedRunsCounts"
    | "hourlyQualificationCompletedCounts"
    | "hourlyQualificationQualifiedCounts"
    | "hourlyEnrichmentCompletedCounts"
    | "hourlyEnrichmentPainPointCountSums"
    | "hourlyOutreachTaskApprovedCounts"
    | "hourlyOutreachTaskApprovedEditedCounts"
  >,
  bucketSet: TrendBucketSet
) {
  return countHourlyFieldByBucket(rows, field, bucketSet);
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
  agentOpsRows?: AgentOpsDailyRow[];
  queryCandidates?: QueryCandidateRow[];
  queryPerformanceDailyRows?: QueryPerformanceDailyRow[];
  workflowEvents?: WorkflowEventRow[];
  evaluatorRuns?: EvaluatorRunRow[];
  memorySuggestions?: MemorySuggestionRow[];
  memoryInventoryRows?: WorkspaceAgentMemoryInventoryRecord[];
}) {
  const {
    bucketSet,
    currentWindow,
    previousWindow,
    analyticsRows = [],
    agentOpsRows = [],
    queryCandidates = [],
    queryPerformanceDailyRows = [],
    workflowEvents = [],
    evaluatorRuns = [],
    memorySuggestions = [],
    memoryInventoryRows = [],
  } = args;

  const currentReplyRate = getReplyRate(analyticsRows, currentWindow);
  const previousReplyRate = getReplyRate(analyticsRows, previousWindow);

  const currentQualificationCompleted = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQualificationCompletedCounts",
    currentWindow
  );
  const previousQualificationCompleted = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQualificationCompletedCounts",
    previousWindow
  );
  const currentQualificationQualified = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQualificationQualifiedCounts",
    currentWindow
  );
  const previousQualificationQualified = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQualificationQualifiedCounts",
    previousWindow
  );
  const currentQualification = {
    completedCount: currentQualificationCompleted,
    qualifiedCount: currentQualificationQualified,
    rate: roundTo(
      calculateRate(
        currentQualificationQualified,
        currentQualificationCompleted
      ),
      1
    ),
  };
  const previousQualification = {
    completedCount: previousQualificationCompleted,
    qualifiedCount: previousQualificationQualified,
    rate: roundTo(
      calculateRate(
        previousQualificationQualified,
        previousQualificationCompleted
      ),
      1
    ),
  };

  const currentEnrichmentCompletions = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyEnrichmentCompletedCounts",
    currentWindow
  );
  const previousEnrichmentCompletions = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyEnrichmentCompletedCounts",
    previousWindow
  );
  const currentEnrichmentPainPointSum = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyEnrichmentPainPointCountSums",
    currentWindow
  );
  const previousEnrichmentPainPointSum = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyEnrichmentPainPointCountSums",
    previousWindow
  );
  const currentEnrichment = {
    completions: currentEnrichmentCompletions,
    usefulness:
      currentEnrichmentCompletions > 0
        ? roundTo(
            Math.min(
              100,
              (currentEnrichmentPainPointSum / currentEnrichmentCompletions) *
                20
            ),
            1
          )
        : 0,
  };
  const previousEnrichment = {
    completions: previousEnrichmentCompletions,
    usefulness:
      previousEnrichmentCompletions > 0
        ? roundTo(
            Math.min(
              100,
              (previousEnrichmentPainPointSum / previousEnrichmentCompletions) *
                20
            ),
            1
          )
        : 0,
  };

  const currentEditedApprovals = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyOutreachTaskApprovedEditedCounts",
    currentWindow
  );
  const previousEditedApprovals = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyOutreachTaskApprovedEditedCounts",
    previousWindow
  );
  const currentRejectedSuggestions = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlySuggestionsRejectedCounts",
    currentWindow
  );
  const previousRejectedSuggestions = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlySuggestionsRejectedCounts",
    previousWindow
  );
  const currentCorrections = {
    count: currentEditedApprovals + currentRejectedSuggestions,
    editedApprovals: currentEditedApprovals,
    rejectedSuggestions: currentRejectedSuggestions,
  };
  const previousCorrections = {
    count: previousEditedApprovals + previousRejectedSuggestions,
    editedApprovals: previousEditedApprovals,
    rejectedSuggestions: previousRejectedSuggestions,
  };

  const currentKeywordsCreated = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyKeywordsCreatedCounts",
    currentWindow
  );
  const previousKeywordsCreated = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyKeywordsCreatedCounts",
    previousWindow
  );

  const currentQueriesGenerated = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesGeneratedCounts",
    currentWindow
  );
  const previousQueriesGenerated = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesGeneratedCounts",
    previousWindow
  );

  const currentQueriesActivated = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesActivatedCounts",
    currentWindow
  );
  const previousQueriesActivated = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesActivatedCounts",
    previousWindow
  );

  const currentReviewedQueries = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesReviewedCounts",
    currentWindow
  );
  const previousReviewedQueries = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesReviewedCounts",
    previousWindow
  );

  const currentExactDuplicates = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesRejectedExactDuplicateCounts",
    currentWindow
  );
  const previousExactDuplicates = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesRejectedExactDuplicateCounts",
    previousWindow
  );

  const currentSemanticDuplicates = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesRejectedSemanticDuplicateCounts",
    currentWindow
  );
  const previousSemanticDuplicates = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyQueriesRejectedSemanticDuplicateCounts",
    previousWindow
  );

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

  const currentSuggestionsCreated = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlySuggestionsCreatedCounts",
    currentWindow
  );
  const previousSuggestionsCreated = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlySuggestionsCreatedCounts",
    previousWindow
  );

  const currentPromotedSuggestions = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlySuggestionsPromotedCounts",
    currentWindow
  );
  const previousPromotedSuggestions = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlySuggestionsPromotedCounts",
    previousWindow
  );

  const currentPendingReviewSuggestions = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlySuggestionsPendingReviewCounts",
    currentWindow
  );
  const previousPendingReviewSuggestions = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlySuggestionsPendingReviewCounts",
    previousWindow
  );

  const currentMemoriesWritten = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyMemoriesWrittenCounts",
    currentWindow
  );
  const previousMemoriesWritten = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyMemoriesWrittenCounts",
    previousWindow
  );

  const currentEventsReceived = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyEventsReceivedCounts",
    currentWindow
  );
  const previousEventsReceived = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyEventsReceivedCounts",
    previousWindow
  );

  const currentFailedEvents = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyFailedEventsCounts",
    currentWindow
  );
  const previousFailedEvents = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyFailedEventsCounts",
    previousWindow
  );

  const currentRunsStarted = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyRunsStartedCounts",
    currentWindow
  );
  const previousRunsStarted = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyRunsStartedCounts",
    previousWindow
  );

  const currentFailedRuns = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyFailedRunsCounts",
    currentWindow
  );
  const previousFailedRuns = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyFailedRunsCounts",
    previousWindow
  );

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
    const bucketQualificationCompleted = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyQualificationCompletedCounts",
      bucket
    );
    const bucketQualificationQualified = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyQualificationQualifiedCounts",
      bucket
    );
    const bucketReplyRate = getReplyRate(analyticsRows, bucket);
    const bucketEnrichmentCompletions = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyEnrichmentCompletedCounts",
      bucket
    );
    const bucketEnrichmentPainPointSum = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyEnrichmentPainPointCountSums",
      bucket
    );
    const bucketFailedEvents = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyFailedEventsCounts",
      bucket
    );
    const bucketFailedRuns = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyFailedRunsCounts",
      bucket
    );

    return {
      date: bucket.label,
      qualityScore: roundTo(
        buildQualityScore({
          qualifiedRate: roundTo(
            calculateRate(
              bucketQualificationQualified,
              bucketQualificationCompleted
            ),
            1
          ),
          responseRate: bucketReplyRate,
          usefulnessScore:
            bucketEnrichmentCompletions > 0
              ? roundTo(
                  Math.min(
                    100,
                    (bucketEnrichmentPainPointSum /
                      bucketEnrichmentCompletions) *
                      20
                  ),
                  1
                )
              : 0,
          issuePenalty: bucketFailedEvents * 1.5 + bucketFailedRuns * 2,
        }),
        1
      ),
    };
  });

  const queryGeneratedCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyQueriesGeneratedCounts",
    bucketSet
  );
  const queryReviewedCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyQueriesReviewedCounts",
    bucketSet
  );
  const queryActivatedCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyQueriesActivatedCounts",
    bucketSet
  );
  const exactDuplicateCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyQueriesRejectedExactDuplicateCounts",
    bucketSet
  );
  const semanticDuplicateCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyQueriesRejectedSemanticDuplicateCounts",
    bucketSet
  );
  const promotedCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlySuggestionsPromotedCounts",
    bucketSet
  );
  const keywordCreatedCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyKeywordsCreatedCounts",
    bucketSet
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

  const queryPerformance = buildWindowQueryPerformanceRows(
    queryPerformanceDailyRows,
    currentWindow
  );
  const performanceByCandidateId = new Map<
    string,
    (typeof queryPerformance)[number]
  >();
  for (const performance of queryPerformance) {
    if (!performance.queryCandidateId) {
      continue;
    }
    performanceByCandidateId.set(performance.queryCandidateId, performance);
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
        performanceScore: performance?.performanceScore ?? null,
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

  const memoryInventory = memoryInventoryRows
    .filter((memory) => isWithinWindow(memory.createdAt, currentWindow))
    .map((memory) => ({
      memoryId: memory.memoryId,
      title: memory.title,
      summary: memory.summary,
      source: memory.source,
      category: memory.category,
      confidence: roundTo(memory.confidence * 100, 1),
      impactScore: roundTo(memory.impactScore * 100, 1),
      relatedQueries: memory.relatedQueriesCount,
      evidenceCount: memory.evidenceCount,
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

  const memoryCreatedCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyMemoriesWrittenCounts",
    bucketSet
  );
  const memoryImpactSums = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyMemoryImpactScoreSums",
    bucketSet
  );
  const memoryConfidenceSums = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyMemoryConfidenceSums",
    bucketSet
  );
  const memoryImpactTrend = bucketSet.buckets.map((bucket, index) => {
    const writes = memoryCreatedCounts[index] ?? 0;
    const avgImpact = writes > 0 ? (memoryImpactSums[index] ?? 0) / writes : 0;
    const avgConfidence =
      writes > 0 ? (memoryConfidenceSums[index] ?? 0) / writes : 0;

    return {
      date: bucket.label,
      memoryWrites: writes,
      impactScore: roundTo(avgImpact, 1),
      confidence: roundTo(avgConfidence, 1),
    };
  });

  const qualificationTrend = bucketSet.buckets.map((bucket) => {
    const completed = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyQualificationCompletedCounts",
      bucket
    );
    const qualified = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyQualificationQualifiedCounts",
      bucket
    );

    return {
      date: bucket.label,
      precision: roundTo(calculateRate(qualified, completed), 1),
      completed,
    };
  });

  const enrichmentTrend = bucketSet.buckets.map((bucket) => {
    const completions = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyEnrichmentCompletedCounts",
      bucket
    );
    const painPointSum = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyEnrichmentPainPointCountSums",
      bucket
    );

    return {
      date: bucket.label,
      usefulness:
        completions > 0
          ? roundTo(Math.min(100, (painPointSum / completions) * 20), 1)
          : 0,
      completions,
    };
  });

  const outreachTrend = bucketSet.buckets.map((bucket) => {
    const approvals = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyOutreachTaskApprovedCounts",
      bucket
    );
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
    const editedApprovals = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyOutreachTaskApprovedEditedCounts",
      bucket
    );
    const rejectedSuggestions = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlySuggestionsRejectedCounts",
      bucket
    );

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
        failedEvents: buildMetric({
          currentValue: currentFailedEvents,
          previousValue: previousFailedEvents,
          trendWhenEqual: "down",
        }),
        failedRuns: buildMetric({
          currentValue: currentFailedRuns,
          previousValue: previousFailedRuns,
          trendWhenEqual: "down",
        }),
      },
      feed: activityFeed,
    },
  };
}
