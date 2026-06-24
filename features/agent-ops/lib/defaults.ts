import { format, subDays, subHours } from "date-fns";
import type { DateRangePreset } from "@/features/analytics/lib/types";
import type { AgentOpsDashboardData, AgentOpsMetric } from "../ui/types";

// ============================================================================
// Zero-metric helper
// ============================================================================

const ZERO_METRIC: AgentOpsMetric = {
  value: 0,
  change: 0,
  changePercent: 0,
  trend: "up",
};

// ============================================================================
// Date-label generators (mirrors features/analytics/lib/defaults.ts)
// ============================================================================

function createDateLabels(range: DateRangePreset): string[] {
  const now = new Date();

  if (range === "today" || range === "1d") {
    return Array.from({ length: 12 }, (_, i) =>
      format(subHours(now, 11 - i), "ha")
    );
  }

  if (range === "7d") {
    return Array.from({ length: 7 }, (_, i) =>
      format(subDays(now, 6 - i), "EEE")
    );
  }

  if (range === "custom") {
    return [];
  }

  // 30d
  return Array.from({ length: 30 }, (_, i) =>
    format(subDays(now, 29 - i), "MMM d")
  );
}

// ============================================================================
// Default AgentOpsDashboardData factory
// ============================================================================

export function getDefaultAgentOpsData(
  range: DateRangePreset
): AgentOpsDashboardData {
  const dates = createDateLabels(range);

  const zeroMetrics = {
    healthScore: { ...ZERO_METRIC },
    qualityScore: { ...ZERO_METRIC },
    selfImprovementImpact: { ...ZERO_METRIC },
    needsAttention: { ...ZERO_METRIC },
    keywordsCreated: { ...ZERO_METRIC },
    queriesGenerated: { ...ZERO_METRIC },
    queriesActivated: { ...ZERO_METRIC },
    replyRate: { ...ZERO_METRIC },
  };

  return {
    overview: {
      metrics: zeroMetrics,
      qualityTrend: dates.map((date) => ({ date, qualityScore: 0 })),
      selfImprovementTrend: dates.map((date) => ({
        date,
        duplicateWaste: 0,
        noveltyYield: 0,
        promotedMemories: 0,
        replies: 0,
      })),
      bestQueries: [],
      weakestQueries: [],
      funnel: [
        {
          stage: "new",
          count: 0,
          conversionRate: null,
          fill: "hsl(var(--chart-1))",
        },
        {
          stage: "contacted",
          count: 0,
          conversionRate: 0,
          fill: "hsl(var(--chart-2))",
        },
        {
          stage: "in_progress",
          count: 0,
          conversionRate: 0,
          fill: "hsl(var(--chart-3))",
        },
        {
          stage: "converted",
          count: 0,
          conversionRate: 0,
          fill: "hsl(var(--chart-4))",
        },
      ],
      recentChanges: [],
      blockedBreakdown: {
        pendingSuggestions: 0,
        failedRuns: 0,
        failedEvents: 0,
        failingMonitors: 0,
      },
    },
    discovery: {
      stats: {
        keywordsCreated: { ...ZERO_METRIC },
        queriesGenerated: { ...ZERO_METRIC },
        queriesActivated: { ...ZERO_METRIC },
        duplicateRejectionRate: { ...ZERO_METRIC, trend: "down" },
      },
      growthSeries: dates.map((date) => ({
        date,
        keywords: 0,
        generated: 0,
        activated: 0,
      })),
      efficiencySeries: dates.map((date) => ({
        date,
        generated: 0,
        accepted: 0,
        exactDuplicates: 0,
        semanticDuplicates: 0,
      })),
      bestQueries: [],
      weakestQueries: [],
      inventory: [],
    },
    quality: {
      summary: {
        qualificationPrecision: { ...ZERO_METRIC },
        enrichmentUsefulness: { ...ZERO_METRIC },
        outreachEffectiveness: { ...ZERO_METRIC },
        correctionRate: { ...ZERO_METRIC },
      },
      qualificationTrend: dates.map((date) => ({
        date,
        precision: 0,
        completed: 0,
      })),
      enrichmentTrend: dates.map((date) => ({
        date,
        usefulness: 0,
        completions: 0,
      })),
      outreachTrend: dates.map((date) => ({
        date,
        effectiveness: 0,
        approvals: 0,
        responses: 0,
      })),
      correctionTrend: dates.map((date) => ({
        date,
        corrections: 0,
        editedApprovals: 0,
        rejectedSuggestions: 0,
      })),
      scorecards: {
        convertedAvgScore: 0,
        archivedAvgScore: 0,
        inProgressCount: 0,
        convertedCount: 0,
      },
    },
    memory: {
      summary: {
        memoriesWritten: { ...ZERO_METRIC },
        memoriesPromoted: { ...ZERO_METRIC },
        suggestionsCreated: { ...ZERO_METRIC },
        suggestionsRejected: { ...ZERO_METRIC, trend: "down" },
      },
      impactTrend: dates.map((date) => ({
        date,
        memoryWrites: 0,
        impactScore: 0,
        confidence: 0,
      })),
      helpfulMemories: [],
      recentPromotions: [],
      inventory: [],
    },
    activity: {
      counts: {
        eventsReceived: { ...ZERO_METRIC },
        runsStarted: { ...ZERO_METRIC },
        failedEvents: 0,
        failedRuns: 0,
      },
      feed: [],
    },
  };
}
