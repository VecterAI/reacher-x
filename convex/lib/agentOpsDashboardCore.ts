import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type {
  agentOpsMetricSliceValidator,
  agentOpsTabValidator,
} from "../validators";
import {
  buildAgentOpsDashboardData,
  type AgentOpsActivityItem,
} from "./agentOpsCore";
import { createEmptyWorkspaceAgentOpsDailyRecord } from "./agentOpsReadModelHelpers";
import { createEmptyWorkspaceAnalyticsDailyRecord } from "./readModelHelpers";
import {
  createTrendBucketSet,
  normalizeAnalyticsWindow,
  type NormalizedAnalyticsWindow,
  type TimeWindow,
} from "./analyticsCore";
import type {
  WorkspaceAgentOpsMetric,
  WorkspaceAnalyticsMetric,
} from "./workspaceReportingAggregate";

export const AGENT_OPS_TREND_SLICE_BUCKETS = 4;
export const AGENT_OPS_MAX_TREND_BUCKETS = 60;
type Tab = Infer<typeof agentOpsTabValidator>;
export type AgentOpsMetricSlice = Infer<typeof agentOpsMetricSliceValidator>;

const replyFields = [
  "hourlyContactedEventsCounts",
  "hourlyRespondedEventsCounts",
] as const;
const qualificationFields = [
  "hourlyQualificationCompletedCounts",
  "hourlyQualificationQualifiedCounts",
] as const;
const enrichmentFields = [
  "hourlyEnrichmentCompletedCounts",
  "hourlyEnrichmentPainPointCountSums",
] as const;
const reliabilityFields = [
  "hourlyRunsStartedCounts",
  "hourlyFailedRunsCounts",
] as const;

/** Only select fields consumed by the visible tab's existing formulas. */
export function getAgentOpsDashboardFields(
  tab: Tab,
  kind: "summary" | "trend"
): {
  analytics: readonly WorkspaceAnalyticsMetric[];
  agentOps: readonly WorkspaceAgentOpsMetric[];
} {
  switch (tab) {
    case "overview":
      return {
        analytics: replyFields,
        agentOps:
          kind === "summary"
            ? [
                ...qualificationFields,
                ...reliabilityFields,
                "hourlyQueriesReviewedCounts",
                "hourlyQueriesActivatedCounts",
                "hourlyMemoriesWrittenCounts",
                "hourlyMemoryImpactScoreSums",
              ]
            : [
                ...qualificationFields,
                ...enrichmentFields,
                ...reliabilityFields,
                "hourlyMemoriesWrittenCounts",
                "hourlyQueriesActivatedCounts",
              ],
      };
    case "discovery":
      return {
        analytics: [],
        agentOps: [
          "hourlyKeywordsCreatedCounts",
          "hourlyQueriesGeneratedCounts",
          "hourlyQueriesReviewedCounts",
          "hourlyQueriesActivatedCounts",
          "hourlyQueriesRejectedExactDuplicateCounts",
          "hourlyQueriesRejectedSemanticDuplicateCounts",
        ],
      };
    case "quality":
      return {
        analytics: replyFields,
        agentOps: [
          ...qualificationFields,
          ...enrichmentFields,
          ...reliabilityFields,
        ],
      };
    case "memory":
      return {
        analytics: [],
        agentOps: [
          "hourlyMemoriesWrittenCounts",
          "hourlyHighImpactMemoriesCounts",
          "hourlyMemoryImpactScoreSums",
          "hourlyMemoryConfidenceSums",
        ],
      };
    case "activity":
      return {
        analytics: [],
        agentOps:
          kind === "summary"
            ? [
                "hourlyEventsReceivedCounts",
                "hourlyRunsStartedCounts",
                "hourlyFailedEventsCounts",
                "hourlyFailedRunsCounts",
              ]
            : [],
      };
  }
}

export function getAgentOpsDashboardWindow(
  args: Parameters<typeof normalizeAnalyticsWindow>[0]
) {
  if (args.nowMs !== undefined && !Number.isFinite(args.nowMs)) {
    throw new Error("Invalid reporting timestamp");
  }
  const normalizedWindow = normalizeAnalyticsWindow(args);
  const bucketSet = createTrendBucketSet(normalizedWindow, {
    maxBuckets: AGENT_OPS_MAX_TREND_BUCKETS,
  });
  return { normalizedWindow, bucketSet };
}

export function getAgentOpsTrendSliceOffsets(bucketCount: number, tab: Tab) {
  if (tab === "activity") return [];
  return Array.from(
    { length: Math.ceil(bucketCount / AGENT_OPS_TREND_SLICE_BUCKETS) },
    (_, index) => index * AGENT_OPS_TREND_SLICE_BUCKETS
  );
}

export function getAgentOpsTrendSlice(
  window: NormalizedAnalyticsWindow,
  offset: number
) {
  const bucketSet = createTrendBucketSet(window, {
    maxBuckets: AGENT_OPS_MAX_TREND_BUCKETS,
  });
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset >= bucketSet.buckets.length ||
    offset % AGENT_OPS_TREND_SLICE_BUCKETS !== 0
  ) {
    throw new Error("Invalid Agent Ops chart slice");
  }
  return bucketSet.buckets.slice(
    offset,
    offset + AGENT_OPS_TREND_SLICE_BUCKETS
  );
}

function metricSliceRows(
  workspaceId: Id<"workspaces">,
  tab: Tab,
  kind: "summary" | "trend",
  windows: TimeWindow[],
  slice: AgentOpsMetricSlice
) {
  const fields = getAgentOpsDashboardFields(tab, kind);
  return {
    analyticsRows: windows.map((window, index) => {
      const row = createEmptyWorkspaceAnalyticsDailyRecord({
        workspaceId,
        dayStartUtcMs: window.startMs,
      });
      fields.analytics.forEach((field, fieldIndex) => {
        row[field][0] = slice.analytics[index]?.[fieldIndex] ?? 0;
      });
      return row;
    }),
    agentOpsRows: windows.map((window, index) => {
      const row = createEmptyWorkspaceAgentOpsDailyRecord({
        workspaceId,
        dayStartUtcMs: window.startMs,
      });
      fields.agentOps.forEach((field, fieldIndex) => {
        row[field][0] = slice.agentOps[index]?.[fieldIndex] ?? 0;
      });
      return row;
    }),
  };
}

/** Reuse the canonical formulas; never average rates or add partial KPI deltas. */
export function buildAgentOpsDashboardFromSlices(args: {
  workspaceId: Id<"workspaces">;
  tab: Tab;
  normalizedWindow: NormalizedAnalyticsWindow;
  summary: AgentOpsMetricSlice;
  trends: AgentOpsMetricSlice[];
  activity?: AgentOpsActivityItem[];
}) {
  const { current, previous } = args.normalizedWindow;
  const bucketSet = createTrendBucketSet(args.normalizedWindow, {
    maxBuckets: AGENT_OPS_MAX_TREND_BUCKETS,
  });
  const summaries = buildAgentOpsDashboardData({
    currentWindow: current,
    previousWindow: previous,
    bucketSet: { ...bucketSet, buckets: [] },
    ...metricSliceRows(
      args.workspaceId,
      args.tab,
      "summary",
      [current, previous],
      args.summary
    ),
  });
  const trendRows = args.trends.map((slice, index) =>
    metricSliceRows(
      args.workspaceId,
      args.tab,
      "trend",
      getAgentOpsTrendSlice(
        args.normalizedWindow,
        index * AGENT_OPS_TREND_SLICE_BUCKETS
      ),
      slice
    )
  );
  const data = buildAgentOpsDashboardData({
    currentWindow: current,
    previousWindow: previous,
    bucketSet,
    analyticsRows: trendRows.flatMap((rows) => rows.analyticsRows),
    agentOpsRows: trendRows.flatMap((rows) => rows.agentOpsRows),
  });
  data.overview.metrics = summaries.overview.metrics;
  data.discovery.stats = summaries.discovery.stats;
  data.quality.summary = summaries.quality.summary;
  data.memory.summary = summaries.memory.summary;
  data.activity.counts = summaries.activity.counts;
  data.activity.feed = args.activity ?? [];
  return data;
}
