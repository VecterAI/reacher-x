import type { Doc } from "../_generated/dataModel";
import type { WorkspaceAgentMemoryInventoryRecord } from "./agentMemoryCore";
import { normalizeWorkspaceAgentOpsDailyRecord } from "./agentOpsReadModelHelpers";
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
  kind: "event" | "run" | "memory" | "suggestion";
  title: string;
  description: string;
  status: string;
  timestamp: number;
  severity: "default" | "warning" | "destructive" | "success";
  linkedEntity: string | null;
};

export type AgentOpsMemoryInventoryPage = {
  rows: Array<{
    memoryId: string;
    title: string;
    summary: string;
    source: string;
    category: string;
    confidence: number;
    impactScore: number;
    relatedQueries: number;
    evidenceCount: number;
    createdAt: number;
  }>;
  page: number;
  totalCount: number;
  totalPages: number;
  availableCategories: string[];
};

const LEARNING_LOOP_QUERY_WIN_WEIGHT = 0.25;
const LEARNING_LOOP_QUALIFICATION_WEIGHT = 0.25;
const LEARNING_LOOP_REPLY_WEIGHT = 0.15;
const LEARNING_LOOP_MEMORY_IMPACT_WEIGHT = 0.2;
const LEARNING_LOOP_RELIABILITY_WEIGHT = 0.15;

const OUTCOME_QUALITY_QUALIFICATION_WEIGHT = 0.4;
const OUTCOME_QUALITY_REPLY_WEIGHT = 0.3;
const OUTCOME_QUALITY_ENRICHMENT_WEIGHT = 0.15;
const OUTCOME_QUALITY_RELIABILITY_WEIGHT = 0.15;

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

function buildAverageScore(args: { total: number; count: number }) {
  if (args.count <= 0) {
    return 0;
  }

  return roundTo(args.total / args.count, 1);
}

export function buildAgentOpsMemoryInventoryPage(args: {
  memoryInventoryRows: WorkspaceAgentMemoryInventoryRecord[];
  search?: string;
  category?: string;
  sort: "impact_desc" | "confidence_desc" | "recent_desc";
  page: number;
  pageSize: number;
}): AgentOpsMemoryInventoryPage {
  const normalizedSearch = args.search?.trim().toLowerCase() ?? "";
  const normalizedCategory =
    args.category && args.category !== "all" ? args.category : null;

  const availableCategories = [...new Set(args.memoryInventoryRows.map((row) => row.category))].sort(
    (left, right) => left.localeCompare(right)
  );

  const filteredRows = args.memoryInventoryRows
    .filter((row) => {
      const matchesCategory =
        normalizedCategory === null || row.category === normalizedCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.title.toLowerCase().includes(normalizedSearch) ||
        row.summary.toLowerCase().includes(normalizedSearch) ||
        row.source.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    })
    .map((row) => ({
      memoryId: row.memoryId,
      title: row.title,
      summary: row.summary,
      source: row.source,
      category: row.category,
      confidence: roundTo(row.confidence * 100, 1),
      impactScore: roundTo(row.impactScore * 100, 1),
      relatedQueries: row.relatedQueriesCount,
      evidenceCount: row.evidenceCount,
      createdAt: row.createdAt,
    }));

  filteredRows.sort((left, right) => {
    if (args.sort === "confidence_desc") {
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }
      return right.createdAt - left.createdAt;
    }

    if (args.sort === "recent_desc") {
      return right.createdAt - left.createdAt;
    }

    if (right.impactScore !== left.impactScore) {
      return right.impactScore - left.impactScore;
    }
    return right.createdAt - left.createdAt;
  });

  const safePageSize = Math.max(1, args.pageSize);
  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  const safePage = Math.min(Math.max(args.page, 0), totalPages - 1);
  const startIndex = safePage * safePageSize;

  return {
    rows: filteredRows.slice(startIndex, startIndex + safePageSize),
    page: safePage,
    totalCount,
    totalPages,
    availableCategories,
  };
}

function buildRunReliability(args: {
  runsStarted: number;
  failedRuns: number;
}) {
  if (args.runsStarted <= 0) {
    return 0;
  }

  return roundTo(
    clamp(
      ((args.runsStarted - args.failedRuns) / args.runsStarted) * 100,
      0,
      100
    ),
    1
  );
}

function buildOutcomeQualityScore(args: {
  qualificationPrecision: number;
  responseRate: number;
  enrichmentUsefulness: number;
  runReliability: number;
}) {
  return clamp(
    args.qualificationPrecision * OUTCOME_QUALITY_QUALIFICATION_WEIGHT +
      args.responseRate * OUTCOME_QUALITY_REPLY_WEIGHT +
      args.enrichmentUsefulness * OUTCOME_QUALITY_ENRICHMENT_WEIGHT +
      args.runReliability * OUTCOME_QUALITY_RELIABILITY_WEIGHT,
    0,
    100
  );
}

function buildLearningLoopScore(args: {
  queryWinRate: number;
  qualificationPrecision: number;
  responseRate: number;
  averageMemoryImpact: number;
  runReliability: number;
}) {
  return clamp(
    args.queryWinRate * LEARNING_LOOP_QUERY_WIN_WEIGHT +
      args.qualificationPrecision * LEARNING_LOOP_QUALIFICATION_WEIGHT +
      args.responseRate * LEARNING_LOOP_REPLY_WEIGHT +
      args.averageMemoryImpact * LEARNING_LOOP_MEMORY_IMPACT_WEIGHT +
      args.runReliability * LEARNING_LOOP_RELIABILITY_WEIGHT,
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
    | "hourlyHighImpactMemoriesCounts"
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
  return sumHourlyFieldInWindow(
    rows.map(normalizeWorkspaceAgentOpsDailyRecord),
    field,
    window
  );
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
    | "hourlyHighImpactMemoriesCounts"
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
  return countHourlyFieldByBucket(
    rows.map(normalizeWorkspaceAgentOpsDailyRecord),
    field,
    bucketSet
  );
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
    title: "learning evaluator run",
    description:
      run.summary ||
      `${run.promotedMemoryCount} learned · ${run.suggestedMemoryCount} suggested`,
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

function buildActivityItemFromMemory(
  memory: WorkspaceAgentMemoryInventoryRecord
): AgentOpsActivityItem {
  return {
    id: memory.memoryId,
    kind: "memory",
    title: "memory learned",
    description: `${memory.category} · ${roundTo(
      memory.impactScore * 100,
      1
    )} impact · ${roundTo(memory.confidence * 100, 1)}% confidence`,
    status: "learned",
    timestamp: memory.createdAt,
    severity: "success",
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
  const currentHighImpactMemories = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyHighImpactMemoriesCounts",
    currentWindow
  );
  const previousHighImpactMemories = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyHighImpactMemoriesCounts",
    previousWindow
  );
  const currentMemoryImpactSum = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyMemoryImpactScoreSums",
    currentWindow
  );
  const previousMemoryImpactSum = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyMemoryImpactScoreSums",
    previousWindow
  );
  const currentMemoryConfidenceSum = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyMemoryConfidenceSums",
    currentWindow
  );
  const previousMemoryConfidenceSum = sumAgentOpsFieldInWindow(
    agentOpsRows,
    "hourlyMemoryConfidenceSums",
    previousWindow
  );
  const currentAverageMemoryImpact = buildAverageScore({
    total: currentMemoryImpactSum,
    count: currentMemoriesWritten,
  });
  const previousAverageMemoryImpact = buildAverageScore({
    total: previousMemoryImpactSum,
    count: previousMemoriesWritten,
  });
  const currentAverageMemoryConfidence = buildAverageScore({
    total: currentMemoryConfidenceSum,
    count: currentMemoriesWritten,
  });
  const previousAverageMemoryConfidence = buildAverageScore({
    total: previousMemoryConfidenceSum,
    count: previousMemoriesWritten,
  });

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
  const currentRunReliability = buildRunReliability({
    runsStarted: currentRunsStarted,
    failedRuns: currentFailedRuns,
  });
  const previousRunReliability = buildRunReliability({
    runsStarted: previousRunsStarted,
    failedRuns: previousFailedRuns,
  });

  const currentLearningLoopScore = roundTo(
    buildLearningLoopScore({
      queryWinRate: currentAcceptanceRate,
      qualificationPrecision: currentQualification.rate,
      responseRate: currentReplyRate,
      averageMemoryImpact: currentAverageMemoryImpact,
      runReliability: currentRunReliability,
    }),
    1
  );
  const previousLearningLoopScore = roundTo(
    buildLearningLoopScore({
      queryWinRate: previousAcceptanceRate,
      qualificationPrecision: previousQualification.rate,
      responseRate: previousReplyRate,
      averageMemoryImpact: previousAverageMemoryImpact,
      runReliability: previousRunReliability,
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
    const bucketFailedRuns = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyFailedRunsCounts",
      bucket
    );
    const bucketRunReliability = buildRunReliability({
      runsStarted: sumAgentOpsFieldInWindow(
        agentOpsRows,
        "hourlyRunsStartedCounts",
        bucket
      ),
      failedRuns: bucketFailedRuns,
    });

    return {
      date: bucket.label,
      qualityScore: roundTo(
        buildOutcomeQualityScore({
          qualificationPrecision: roundTo(
            calculateRate(
              bucketQualificationQualified,
              bucketQualificationCompleted
            ),
            1
          ),
          responseRate: bucketReplyRate,
          enrichmentUsefulness:
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
          runReliability: bucketRunReliability,
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
  const keywordCreatedCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyKeywordsCreatedCounts",
    bucketSet
  );
  const qualifiedCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyQualificationQualifiedCounts",
    bucketSet
  );
  const memoryCreatedCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyMemoriesWrittenCounts",
    bucketSet
  );

  const selfImprovementTrend = bucketSet.buckets.map((bucket, index) => ({
    date: bucket.label,
    memoriesLearned: memoryCreatedCounts[index] ?? 0,
    queriesActivated: queryActivatedCounts[index] ?? 0,
    qualifiedProspects: qualifiedCounts[index] ?? 0,
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
    ...memoryInventoryRows
      .filter((memory) => isWithinWindow(memory.createdAt, currentWindow))
      .map(buildActivityItemFromMemory),
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

  const recentMemories = memoryInventory.slice(0, 5).map((memory) => ({
    memoryId: memory.memoryId,
    title: memory.title,
    summary: memory.summary,
    source: memory.source,
    category: memory.category,
    createdAt: memory.createdAt,
    impactScore: memory.impactScore,
    confidence: memory.confidence,
  }));

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
  const highImpactMemoryCounts = countAgentOpsFieldByBucket(
    agentOpsRows,
    "hourlyHighImpactMemoriesCounts",
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
      highImpactMemories: highImpactMemoryCounts[index] ?? 0,
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
    const contacted = sumHourlyFieldInWindow(
      analyticsRows,
      "hourlyContactedEventsCounts",
      bucket
    );
    const responses = sumHourlyFieldInWindow(
      analyticsRows,
      "hourlyRespondedEventsCounts",
      bucket
    );

    return {
      date: bucket.label,
      effectiveness: roundTo(calculateRate(responses, contacted), 1),
      contacted,
      responses,
    };
  });

  const reliabilityTrend = bucketSet.buckets.map((bucket) => {
    const runsStarted = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyRunsStartedCounts",
      bucket
    );
    const failedRuns = sumAgentOpsFieldInWindow(
      agentOpsRows,
      "hourlyFailedRunsCounts",
      bucket
    );

    return {
      date: bucket.label,
      reliability: buildRunReliability({ runsStarted, failedRuns }),
      runsStarted,
      failedRuns,
    };
  });

  return {
    overview: {
      metrics: {
        healthScore: buildMetric({
          currentValue: currentLearningLoopScore,
          previousValue: previousLearningLoopScore,
          valueDecimals: 1,
        }),
        queryWinRate: buildMetric({
          currentValue: currentAcceptanceRate,
          previousValue: previousAcceptanceRate,
          valueDecimals: 1,
        }),
        qualificationPrecision: buildMetric({
          currentValue: currentQualification.rate,
          previousValue: previousQualification.rate,
          valueDecimals: 1,
        }),
        outreachEffectiveness: buildMetric({
          currentValue: currentReplyRate,
          previousValue: previousReplyRate,
          valueDecimals: 1,
        }),
        memoriesLearned: buildMetric({
          currentValue: currentMemoriesWritten,
          previousValue: previousMemoriesWritten,
        }),
        averageMemoryImpact: buildMetric({
          currentValue: currentAverageMemoryImpact,
          previousValue: previousAverageMemoryImpact,
          valueDecimals: 1,
        }),
        queriesActivated: buildMetric({
          currentValue: currentQueriesActivated,
          previousValue: previousQueriesActivated,
        }),
        runReliability: buildMetric({
          currentValue: currentRunReliability,
          previousValue: previousRunReliability,
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
        queryWinRate: buildMetric({
          currentValue: currentAcceptanceRate,
          previousValue: previousAcceptanceRate,
          valueDecimals: 1,
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
        runReliability: buildMetric({
          currentValue: currentRunReliability,
          previousValue: previousRunReliability,
          valueDecimals: 1,
        }),
      },
      qualificationTrend,
      enrichmentTrend,
      outreachTrend,
      reliabilityTrend,
    },
    memory: {
      summary: {
        memoriesLearned: buildMetric({
          currentValue: currentMemoriesWritten,
          previousValue: previousMemoriesWritten,
        }),
        highImpactMemories: buildMetric({
          currentValue: currentHighImpactMemories,
          previousValue: previousHighImpactMemories,
        }),
        averageImpact: buildMetric({
          currentValue: currentAverageMemoryImpact,
          previousValue: previousAverageMemoryImpact,
          valueDecimals: 1,
        }),
        averageConfidence: buildMetric({
          currentValue: currentAverageMemoryConfidence,
          previousValue: previousAverageMemoryConfidence,
          valueDecimals: 1,
        }),
      },
      impactTrend: memoryImpactTrend,
      helpfulMemories,
      recentMemories,
      // The full memory table is fetched through a dedicated paginated query.
      inventory: [],
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
