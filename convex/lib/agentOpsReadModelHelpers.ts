import type { Doc, Id } from "../_generated/dataModel";
import type { WorkspaceAgentMemoryRecord } from "./agentMemoryCore";
import {
  createEmptyHourlyAnalyticsCounts,
  getUtcDayKeyFromStart,
  getUtcDayStartTimestamp,
  getUtcHourIndex,
} from "./readModelHelpers";
import { buildQueryCandidateCanonicalRecord } from "./memoryHelpers";
import { getNumberProperty, isRecord } from "./typeGuards";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

const AGENT_OPS_NUMERIC_FIELDS = [
  "keywordsCreatedCount",
  "queriesGeneratedCount",
  "queriesReviewedCount",
  "queriesActivatedCount",
  "queriesRejectedExactDuplicateCount",
  "queriesRejectedSemanticDuplicateCount",
  "suggestionsCreatedCount",
  "suggestionsPendingReviewCount",
  "suggestionsPromotedCount",
  "suggestionsRejectedCount",
  "memoriesWrittenCount",
  "memoryImpactScoreSum",
  "memoryConfidenceSum",
  "eventsReceivedCount",
  "failedEventsCount",
  "runsStartedCount",
  "failedRunsCount",
  "qualificationCompletedCount",
  "qualificationQualifiedCount",
  "enrichmentCompletedCount",
  "enrichmentPainPointCountSum",
  "outreachTaskApprovedCount",
  "outreachTaskApprovedEditedCount",
] as const;

const AGENT_OPS_HOURLY_FIELDS = [
  "hourlyKeywordsCreatedCounts",
  "hourlyQueriesGeneratedCounts",
  "hourlyQueriesReviewedCounts",
  "hourlyQueriesActivatedCounts",
  "hourlyQueriesRejectedExactDuplicateCounts",
  "hourlyQueriesRejectedSemanticDuplicateCounts",
  "hourlySuggestionsCreatedCounts",
  "hourlySuggestionsPendingReviewCounts",
  "hourlySuggestionsPromotedCounts",
  "hourlySuggestionsRejectedCounts",
  "hourlyMemoriesWrittenCounts",
  "hourlyMemoryImpactScoreSums",
  "hourlyMemoryConfidenceSums",
  "hourlyEventsReceivedCounts",
  "hourlyFailedEventsCounts",
  "hourlyRunsStartedCounts",
  "hourlyFailedRunsCounts",
  "hourlyQualificationCompletedCounts",
  "hourlyQualificationQualifiedCounts",
  "hourlyEnrichmentCompletedCounts",
  "hourlyEnrichmentPainPointCountSums",
  "hourlyOutreachTaskApprovedCounts",
  "hourlyOutreachTaskApprovedEditedCounts",
] as const;

const QUERY_PERFORMANCE_NUMERIC_FIELDS = [
  "impressionsCount",
  "prospectsFoundCount",
  "qualifiedCount",
  "convertedCount",
  "replyCount",
] as const;

const QUERY_PERFORMANCE_HOURLY_FIELDS = [
  "hourlyImpressionsCounts",
  "hourlyProspectsFoundCounts",
  "hourlyQualifiedCounts",
  "hourlyConvertedCounts",
  "hourlyReplyCounts",
] as const;

type AgentOpsNumericField = (typeof AGENT_OPS_NUMERIC_FIELDS)[number];
type AgentOpsHourlyField = (typeof AGENT_OPS_HOURLY_FIELDS)[number];
type QueryPerformanceNumericField =
  (typeof QUERY_PERFORMANCE_NUMERIC_FIELDS)[number];
type QueryPerformanceHourlyField =
  (typeof QUERY_PERFORMANCE_HOURLY_FIELDS)[number];

export interface WorkspaceAgentOpsDailyContribution {
  keywordsCreatedCount: number;
  queriesGeneratedCount: number;
  queriesReviewedCount: number;
  queriesActivatedCount: number;
  queriesRejectedExactDuplicateCount: number;
  queriesRejectedSemanticDuplicateCount: number;
  suggestionsCreatedCount: number;
  suggestionsPendingReviewCount: number;
  suggestionsPromotedCount: number;
  suggestionsRejectedCount: number;
  memoriesWrittenCount: number;
  memoryImpactScoreSum: number;
  memoryConfidenceSum: number;
  eventsReceivedCount: number;
  failedEventsCount: number;
  runsStartedCount: number;
  failedRunsCount: number;
  qualificationCompletedCount: number;
  qualificationQualifiedCount: number;
  enrichmentCompletedCount: number;
  enrichmentPainPointCountSum: number;
  outreachTaskApprovedCount: number;
  outreachTaskApprovedEditedCount: number;
  hourlyKeywordsCreatedCounts: number[];
  hourlyQueriesGeneratedCounts: number[];
  hourlyQueriesReviewedCounts: number[];
  hourlyQueriesActivatedCounts: number[];
  hourlyQueriesRejectedExactDuplicateCounts: number[];
  hourlyQueriesRejectedSemanticDuplicateCounts: number[];
  hourlySuggestionsCreatedCounts: number[];
  hourlySuggestionsPendingReviewCounts: number[];
  hourlySuggestionsPromotedCounts: number[];
  hourlySuggestionsRejectedCounts: number[];
  hourlyMemoriesWrittenCounts: number[];
  hourlyMemoryImpactScoreSums: number[];
  hourlyMemoryConfidenceSums: number[];
  hourlyEventsReceivedCounts: number[];
  hourlyFailedEventsCounts: number[];
  hourlyRunsStartedCounts: number[];
  hourlyFailedRunsCounts: number[];
  hourlyQualificationCompletedCounts: number[];
  hourlyQualificationQualifiedCounts: number[];
  hourlyEnrichmentCompletedCounts: number[];
  hourlyEnrichmentPainPointCountSums: number[];
  hourlyOutreachTaskApprovedCounts: number[];
  hourlyOutreachTaskApprovedEditedCounts: number[];
}

export interface WorkspaceAgentOpsDailyRecord extends WorkspaceAgentOpsDailyContribution {
  workspaceId: Id<"workspaces">;
  dayStartUtcMs: number;
  dayKey: string;
  updatedAt: number;
}

export interface TargetedWorkspaceAgentOpsContribution {
  workspaceId: Id<"workspaces">;
  dayStartUtcMs: number;
  contribution: WorkspaceAgentOpsDailyContribution;
}

export interface WorkspaceQueryPerformanceDailyRecord {
  workspaceId: Id<"workspaces">;
  queryId: Id<"keywords">;
  activatedQueryCandidateId?: Id<"queryCandidates">;
  dayStartUtcMs: number;
  dayKey: string;
  impressionsCount: number;
  prospectsFoundCount: number;
  qualifiedCount: number;
  convertedCount: number;
  replyCount: number;
  hourlyImpressionsCounts: number[];
  hourlyProspectsFoundCounts: number[];
  hourlyQualifiedCounts: number[];
  hourlyConvertedCounts: number[];
  hourlyReplyCounts: number[];
  updatedAt: number;
}

export interface WorkspaceQueryPerformanceDailyDelta {
  workspaceId: Id<"workspaces">;
  queryId: Id<"keywords">;
  activatedQueryCandidateId?: Id<"queryCandidates">;
  timestamp: number;
  impressionsDelta?: number;
  prospectsFoundDelta?: number;
  qualifiedCountDelta?: number;
  convertedCountDelta?: number;
  replyCountDelta?: number;
}

function createEmptyAgentOpsContribution(): WorkspaceAgentOpsDailyContribution {
  return {
    keywordsCreatedCount: 0,
    queriesGeneratedCount: 0,
    queriesReviewedCount: 0,
    queriesActivatedCount: 0,
    queriesRejectedExactDuplicateCount: 0,
    queriesRejectedSemanticDuplicateCount: 0,
    suggestionsCreatedCount: 0,
    suggestionsPendingReviewCount: 0,
    suggestionsPromotedCount: 0,
    suggestionsRejectedCount: 0,
    memoriesWrittenCount: 0,
    memoryImpactScoreSum: 0,
    memoryConfidenceSum: 0,
    eventsReceivedCount: 0,
    failedEventsCount: 0,
    runsStartedCount: 0,
    failedRunsCount: 0,
    qualificationCompletedCount: 0,
    qualificationQualifiedCount: 0,
    enrichmentCompletedCount: 0,
    enrichmentPainPointCountSum: 0,
    outreachTaskApprovedCount: 0,
    outreachTaskApprovedEditedCount: 0,
    hourlyKeywordsCreatedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyQueriesGeneratedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyQueriesReviewedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyQueriesActivatedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyQueriesRejectedExactDuplicateCounts:
      createEmptyHourlyAnalyticsCounts(),
    hourlyQueriesRejectedSemanticDuplicateCounts:
      createEmptyHourlyAnalyticsCounts(),
    hourlySuggestionsCreatedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlySuggestionsPendingReviewCounts: createEmptyHourlyAnalyticsCounts(),
    hourlySuggestionsPromotedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlySuggestionsRejectedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyMemoriesWrittenCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyMemoryImpactScoreSums: createEmptyHourlyAnalyticsCounts(),
    hourlyMemoryConfidenceSums: createEmptyHourlyAnalyticsCounts(),
    hourlyEventsReceivedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyFailedEventsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyRunsStartedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyFailedRunsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyQualificationCompletedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyQualificationQualifiedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyEnrichmentCompletedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyEnrichmentPainPointCountSums: createEmptyHourlyAnalyticsCounts(),
    hourlyOutreachTaskApprovedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyOutreachTaskApprovedEditedCounts: createEmptyHourlyAnalyticsCounts(),
  };
}

export function createEmptyWorkspaceAgentOpsDailyRecord(args: {
  workspaceId: Id<"workspaces">;
  dayStartUtcMs: number;
}): WorkspaceAgentOpsDailyRecord {
  return {
    workspaceId: args.workspaceId,
    dayStartUtcMs: args.dayStartUtcMs,
    dayKey: getUtcDayKeyFromStart(args.dayStartUtcMs),
    updatedAt: 0,
    ...createEmptyAgentOpsContribution(),
  };
}

function createEmptyWorkspaceQueryPerformanceDailyRecord(args: {
  workspaceId: Id<"workspaces">;
  queryId: Id<"keywords">;
  activatedQueryCandidateId?: Id<"queryCandidates">;
  dayStartUtcMs: number;
}): WorkspaceQueryPerformanceDailyRecord {
  return {
    workspaceId: args.workspaceId,
    queryId: args.queryId,
    activatedQueryCandidateId: args.activatedQueryCandidateId,
    dayStartUtcMs: args.dayStartUtcMs,
    dayKey: getUtcDayKeyFromStart(args.dayStartUtcMs),
    impressionsCount: 0,
    prospectsFoundCount: 0,
    qualifiedCount: 0,
    convertedCount: 0,
    replyCount: 0,
    hourlyImpressionsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyProspectsFoundCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyQualifiedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyConvertedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyReplyCounts: createEmptyHourlyAnalyticsCounts(),
    updatedAt: 0,
  };
}

function addHourlyValue(counts: number[], hour: number, delta: number) {
  if (hour < 0 || hour >= counts.length) {
    return counts;
  }
  const next = [...counts];
  next[hour] = Math.max(0, next[hour] + delta);
  return next;
}

function applyTimedAgentOpsValue(
  contribution: WorkspaceAgentOpsDailyContribution,
  timestamp: number,
  numericField: AgentOpsNumericField,
  hourlyField: AgentOpsHourlyField,
  delta: number
) {
  const hour = getUtcHourIndex(timestamp);
  contribution[numericField] = Math.max(0, contribution[numericField] + delta);
  contribution[hourlyField] = addHourlyValue(
    contribution[hourlyField],
    hour,
    delta
  );
}

function buildTimedAgentOpsContribution(args: {
  workspaceId: Id<"workspaces">;
  timestamp: number;
  apply: (contribution: WorkspaceAgentOpsDailyContribution) => void;
}): TargetedWorkspaceAgentOpsContribution {
  const contribution = createEmptyAgentOpsContribution();
  args.apply(contribution);
  return {
    workspaceId: args.workspaceId,
    dayStartUtcMs: getUtcDayStartTimestamp(args.timestamp),
    contribution,
  };
}

function getQueryReviewTimestamp(
  candidate: Pick<Doc<"queryCandidates">, "status" | "reviewedAt" | "updatedAt">
) {
  if (typeof candidate.reviewedAt === "number") {
    return candidate.reviewedAt;
  }

  if (candidate.status === "generated") {
    return undefined;
  }

  return candidate.updatedAt;
}

function getSuggestionDecisionTimestamp(
  suggestion: Pick<Doc<"memorySuggestions">, "reviewedAt" | "updatedAt">
) {
  return suggestion.reviewedAt ?? suggestion.updatedAt;
}

function getRunStartedTimestamp(
  run: Pick<Doc<"memoryEvaluatorRuns">, "startedAt" | "_creationTime">
) {
  return run.startedAt ?? run._creationTime;
}

function getRunFinishedTimestamp(
  run: Pick<
    Doc<"memoryEvaluatorRuns">,
    "completedAt" | "updatedAt" | "startedAt" | "_creationTime"
  >
) {
  return run.completedAt ?? run.updatedAt ?? run.startedAt ?? run._creationTime;
}

export function getWorkspaceAgentOpsContributionsFromKeyword(
  keyword: Pick<Doc<"keywords">, "_creationTime" | "workspaceId">
) {
  return [
    buildTimedAgentOpsContribution({
      workspaceId: keyword.workspaceId,
      timestamp: keyword._creationTime,
      apply: (contribution) => {
        applyTimedAgentOpsValue(
          contribution,
          keyword._creationTime,
          "keywordsCreatedCount",
          "hourlyKeywordsCreatedCounts",
          1
        );
      },
    }),
  ];
}

export function getWorkspaceAgentOpsContributionsFromQueryCandidate(
  candidate: Pick<
    Doc<"queryCandidates">,
    "_creationTime" | "workspaceId" | "status" | "reviewedAt" | "updatedAt"
  >
) {
  const contributions: TargetedWorkspaceAgentOpsContribution[] = [
    buildTimedAgentOpsContribution({
      workspaceId: candidate.workspaceId,
      timestamp: candidate._creationTime,
      apply: (contribution) => {
        applyTimedAgentOpsValue(
          contribution,
          candidate._creationTime,
          "queriesGeneratedCount",
          "hourlyQueriesGeneratedCounts",
          1
        );
      },
    }),
  ];

  const reviewedAt = getQueryReviewTimestamp(candidate);
  if (typeof reviewedAt !== "number") {
    return contributions;
  }

  contributions.push(
    buildTimedAgentOpsContribution({
      workspaceId: candidate.workspaceId,
      timestamp: reviewedAt,
      apply: (contribution) => {
        applyTimedAgentOpsValue(
          contribution,
          reviewedAt,
          "queriesReviewedCount",
          "hourlyQueriesReviewedCounts",
          1
        );

        if (candidate.status === "activated") {
          applyTimedAgentOpsValue(
            contribution,
            reviewedAt,
            "queriesActivatedCount",
            "hourlyQueriesActivatedCounts",
            1
          );
        }

        if (candidate.status === "rejected_exact_duplicate") {
          applyTimedAgentOpsValue(
            contribution,
            reviewedAt,
            "queriesRejectedExactDuplicateCount",
            "hourlyQueriesRejectedExactDuplicateCounts",
            1
          );
        }

        if (candidate.status === "rejected_semantic_duplicate") {
          applyTimedAgentOpsValue(
            contribution,
            reviewedAt,
            "queriesRejectedSemanticDuplicateCount",
            "hourlyQueriesRejectedSemanticDuplicateCounts",
            1
          );
        }
      },
    })
  );

  return contributions;
}

export function getWorkspaceAgentOpsContributionsFromMemorySuggestion(
  suggestion: Pick<
    Doc<"memorySuggestions">,
    "_creationTime" | "workspaceId" | "status" | "reviewedAt" | "updatedAt"
  >
) {
  const contributions: TargetedWorkspaceAgentOpsContribution[] = [
    buildTimedAgentOpsContribution({
      workspaceId: suggestion.workspaceId,
      timestamp: suggestion._creationTime,
      apply: (contribution) => {
        applyTimedAgentOpsValue(
          contribution,
          suggestion._creationTime,
          "suggestionsCreatedCount",
          "hourlySuggestionsCreatedCounts",
          1
        );
        if (suggestion.status === "pending_review") {
          applyTimedAgentOpsValue(
            contribution,
            suggestion._creationTime,
            "suggestionsPendingReviewCount",
            "hourlySuggestionsPendingReviewCounts",
            1
          );
        }
      },
    }),
  ];

  const reviewedAt = getSuggestionDecisionTimestamp(suggestion);
  if (typeof reviewedAt !== "number") {
    return contributions;
  }

  if (suggestion.status === "promoted") {
    contributions.push(
      buildTimedAgentOpsContribution({
        workspaceId: suggestion.workspaceId,
        timestamp: reviewedAt,
        apply: (contribution) => {
          applyTimedAgentOpsValue(
            contribution,
            reviewedAt,
            "suggestionsPromotedCount",
            "hourlySuggestionsPromotedCounts",
            1
          );
        },
      })
    );
  }

  if (suggestion.status === "rejected") {
    contributions.push(
      buildTimedAgentOpsContribution({
        workspaceId: suggestion.workspaceId,
        timestamp: reviewedAt,
        apply: (contribution) => {
          applyTimedAgentOpsValue(
            contribution,
            reviewedAt,
            "suggestionsRejectedCount",
            "hourlySuggestionsRejectedCounts",
            1
          );
        },
      })
    );
  }

  return contributions;
}

function getEventBooleanPayload(
  event: Pick<Doc<"memoryWorkflowEvents">, "payload">,
  key: string
) {
  const payload = isRecord(event.payload) ? event.payload : undefined;
  const value = payload?.[key];
  return typeof value === "boolean" ? value : undefined;
}

export function getWorkspaceAgentOpsContributionsFromWorkflowEvent(
  event: Pick<
    Doc<"memoryWorkflowEvents">,
    "workspaceId" | "occurredAt" | "status" | "eventType" | "payload"
  >
) {
  return [
    buildTimedAgentOpsContribution({
      workspaceId: event.workspaceId,
      timestamp: event.occurredAt,
      apply: (contribution) => {
        applyTimedAgentOpsValue(
          contribution,
          event.occurredAt,
          "eventsReceivedCount",
          "hourlyEventsReceivedCounts",
          1
        );

        if (event.status === "failed") {
          applyTimedAgentOpsValue(
            contribution,
            event.occurredAt,
            "failedEventsCount",
            "hourlyFailedEventsCounts",
            1
          );
        }

        if (event.eventType === "qualification_completed") {
          applyTimedAgentOpsValue(
            contribution,
            event.occurredAt,
            "qualificationCompletedCount",
            "hourlyQualificationCompletedCounts",
            1
          );
          if (getEventBooleanPayload(event, "qualified") === true) {
            applyTimedAgentOpsValue(
              contribution,
              event.occurredAt,
              "qualificationQualifiedCount",
              "hourlyQualificationQualifiedCounts",
              1
            );
          }
        }

        if (event.eventType === "enrichment_completed") {
          applyTimedAgentOpsValue(
            contribution,
            event.occurredAt,
            "enrichmentCompletedCount",
            "hourlyEnrichmentCompletedCounts",
            1
          );
          const painPointCount = getNumberProperty(
            isRecord(event.payload) ? event.payload : undefined,
            "painPointCount"
          );
          if (typeof painPointCount === "number" && painPointCount > 0) {
            applyTimedAgentOpsValue(
              contribution,
              event.occurredAt,
              "enrichmentPainPointCountSum",
              "hourlyEnrichmentPainPointCountSums",
              painPointCount
            );
          }
        }

        if (event.eventType === "outreach_task_approved") {
          applyTimedAgentOpsValue(
            contribution,
            event.occurredAt,
            "outreachTaskApprovedCount",
            "hourlyOutreachTaskApprovedCounts",
            1
          );
          if (getEventBooleanPayload(event, "edited") === true) {
            applyTimedAgentOpsValue(
              contribution,
              event.occurredAt,
              "outreachTaskApprovedEditedCount",
              "hourlyOutreachTaskApprovedEditedCounts",
              1
            );
          }
        }
      },
    }),
  ];
}

export function getWorkspaceAgentOpsContributionsFromEvaluatorRun(
  run: Pick<
    Doc<"memoryEvaluatorRuns">,
    | "_creationTime"
    | "workspaceId"
    | "status"
    | "startedAt"
    | "completedAt"
    | "updatedAt"
  >
) {
  const startedAt = getRunStartedTimestamp(run);
  const contributions: TargetedWorkspaceAgentOpsContribution[] = [
    buildTimedAgentOpsContribution({
      workspaceId: run.workspaceId,
      timestamp: startedAt,
      apply: (contribution) => {
        applyTimedAgentOpsValue(
          contribution,
          startedAt,
          "runsStartedCount",
          "hourlyRunsStartedCounts",
          1
        );
      },
    }),
  ];

  if (run.status === "failed") {
    const failedAt = getRunFinishedTimestamp(run);
    contributions.push(
      buildTimedAgentOpsContribution({
        workspaceId: run.workspaceId,
        timestamp: failedAt,
        apply: (contribution) => {
          applyTimedAgentOpsValue(
            contribution,
            failedAt,
            "failedRunsCount",
            "hourlyFailedRunsCounts",
            1
          );
        },
      })
    );
  }

  return contributions;
}

export function getWorkspaceAgentOpsContributionsFromBuiltInMemory(args: {
  workspaceId: Id<"workspaces">;
  memory: Pick<WorkspaceAgentMemoryRecord, "createdAt" | "parsed">;
}) {
  return [
    buildTimedAgentOpsContribution({
      workspaceId: args.workspaceId,
      timestamp: args.memory.createdAt,
      apply: (contribution) => {
        applyTimedAgentOpsValue(
          contribution,
          args.memory.createdAt,
          "memoriesWrittenCount",
          "hourlyMemoriesWrittenCounts",
          1
        );
        applyTimedAgentOpsValue(
          contribution,
          args.memory.createdAt,
          "memoryImpactScoreSum",
          "hourlyMemoryImpactScoreSums",
          Math.max(0, args.memory.parsed.impactScore * 100)
        );
        applyTimedAgentOpsValue(
          contribution,
          args.memory.createdAt,
          "memoryConfidenceSum",
          "hourlyMemoryConfidenceSums",
          Math.max(0, args.memory.parsed.confidence * 100)
        );
      },
    }),
  ];
}

export function mergeWorkspaceAgentOpsContributions(
  existing: WorkspaceAgentOpsDailyRecord | Doc<"workspaceAgentOpsDaily"> | null,
  args: {
    workspaceId: Id<"workspaces">;
    dayStartUtcMs: number;
    remove?: WorkspaceAgentOpsDailyContribution[];
    add?: WorkspaceAgentOpsDailyContribution[];
  }
): WorkspaceAgentOpsDailyRecord {
  const now = getCurrentUTCTimestamp();
  const next = existing
    ? ({
        ...existing,
        dayKey: getUtcDayKeyFromStart(args.dayStartUtcMs),
        updatedAt: now,
      } as WorkspaceAgentOpsDailyRecord)
    : createEmptyWorkspaceAgentOpsDailyRecord({
        workspaceId: args.workspaceId,
        dayStartUtcMs: args.dayStartUtcMs,
      });

  const mergeContribution = (
    contribution: WorkspaceAgentOpsDailyContribution,
    direction: 1 | -1
  ) => {
    for (const field of AGENT_OPS_NUMERIC_FIELDS) {
      next[field] = Math.max(0, next[field] + contribution[field] * direction);
    }
    for (const field of AGENT_OPS_HOURLY_FIELDS) {
      next[field] = next[field].map((value, index) =>
        Math.max(0, value + contribution[field][index] * direction)
      );
    }
  };

  for (const contribution of args.remove ?? []) {
    mergeContribution(contribution, -1);
  }
  for (const contribution of args.add ?? []) {
    mergeContribution(contribution, 1);
  }

  next.workspaceId = args.workspaceId;
  next.dayStartUtcMs = args.dayStartUtcMs;
  next.dayKey = getUtcDayKeyFromStart(args.dayStartUtcMs);
  next.updatedAt = now;

  return next;
}

export function isWorkspaceAgentOpsDailyRecordEmpty(
  row: WorkspaceAgentOpsDailyRecord
) {
  return AGENT_OPS_NUMERIC_FIELDS.every((field) => row[field] === 0);
}

export function mergeWorkspaceQueryPerformanceDailyDelta(
  existing:
    | WorkspaceQueryPerformanceDailyRecord
    | Doc<"workspaceQueryPerformanceDaily">
    | null,
  args: WorkspaceQueryPerformanceDailyDelta
): WorkspaceQueryPerformanceDailyRecord {
  const dayStartUtcMs = getUtcDayStartTimestamp(args.timestamp);
  const hour = getUtcHourIndex(args.timestamp);
  const next = existing
    ? ({
        ...existing,
      } as WorkspaceQueryPerformanceDailyRecord)
    : createEmptyWorkspaceQueryPerformanceDailyRecord({
        workspaceId: args.workspaceId,
        queryId: args.queryId,
        activatedQueryCandidateId: args.activatedQueryCandidateId,
        dayStartUtcMs,
      });

  next.workspaceId = args.workspaceId;
  next.queryId = args.queryId;
  next.activatedQueryCandidateId =
    args.activatedQueryCandidateId ?? next.activatedQueryCandidateId;
  next.dayStartUtcMs = dayStartUtcMs;
  next.dayKey = getUtcDayKeyFromStart(dayStartUtcMs);
  next.updatedAt = getCurrentUTCTimestamp();

  const deltas: Array<
    [
      QueryPerformanceNumericField,
      QueryPerformanceHourlyField,
      number | undefined,
    ]
  > = [
    ["impressionsCount", "hourlyImpressionsCounts", args.impressionsDelta],
    [
      "prospectsFoundCount",
      "hourlyProspectsFoundCounts",
      args.prospectsFoundDelta,
    ],
    ["qualifiedCount", "hourlyQualifiedCounts", args.qualifiedCountDelta],
    ["convertedCount", "hourlyConvertedCounts", args.convertedCountDelta],
    ["replyCount", "hourlyReplyCounts", args.replyCountDelta],
  ];

  for (const [numericField, hourlyField, delta] of deltas) {
    if (typeof delta !== "number" || delta === 0) {
      continue;
    }
    next[numericField] = Math.max(0, next[numericField] + delta);
    next[hourlyField] = addHourlyValue(next[hourlyField], hour, delta);
  }

  return next;
}

export function isWorkspaceQueryPerformanceDailyRecordEmpty(
  row: WorkspaceQueryPerformanceDailyRecord
) {
  return QUERY_PERFORMANCE_NUMERIC_FIELDS.every((field) => row[field] === 0);
}

export function getWorkspaceQueryPerformanceDailyDeltasFromWorkflowEvent(args: {
  workspaceId: Id<"workspaces">;
  event: Pick<
    Doc<"memoryWorkflowEvents">,
    "eventType" | "occurredAt" | "prospectId" | "payload"
  >;
  prospect: Pick<
    Doc<"prospects">,
    "matchedKeywords" | "qualificationStatus"
  > | null;
  keywordIdByCanonicalHash: ReadonlyMap<string, Id<"keywords">>;
  candidateIdByKeywordId: ReadonlyMap<
    Id<"keywords">,
    Id<"queryCandidates"> | undefined
  >;
}) {
  if (!args.prospect) {
    return [];
  }

  let deltaField:
    | "qualifiedCountDelta"
    | "replyCountDelta"
    | "convertedCountDelta"
    | null = null;
  let deltaValue = 0;

  if (args.event.eventType === "qualification_completed") {
    const qualified =
      getEventBooleanPayload(args.event, "qualified") === true ||
      args.prospect.qualificationStatus === "qualified";
    deltaField = "qualifiedCountDelta";
    deltaValue = qualified ? 1 : 0;
  } else if (args.event.eventType === "prospect_responded") {
    deltaField = "replyCountDelta";
    deltaValue = 1;
  } else if (args.event.eventType === "prospect_converted") {
    deltaField = "convertedCountDelta";
    deltaValue = 1;
  }

  if (!deltaField || deltaValue <= 0) {
    return [];
  }

  const deltas: WorkspaceQueryPerformanceDailyDelta[] = [];
  const seen = new Set<string>();

  for (const matchedKeyword of args.prospect.matchedKeywords ?? []) {
    const canonical = buildQueryCandidateCanonicalRecord({
      type: "social_query",
      value: matchedKeyword,
    });
    const queryId = args.keywordIdByCanonicalHash.get(canonical.canonicalHash);
    if (!queryId) {
      continue;
    }
    const dedupeKey = String(queryId);
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    deltas.push({
      workspaceId: args.workspaceId,
      queryId,
      activatedQueryCandidateId: args.candidateIdByKeywordId.get(queryId),
      timestamp: args.event.occurredAt,
      [deltaField]: deltaValue,
    });
  }

  return deltas;
}
