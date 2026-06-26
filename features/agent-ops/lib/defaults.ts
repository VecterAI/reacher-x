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
    queryWinRate: { ...ZERO_METRIC },
    qualificationPrecision: { ...ZERO_METRIC },
    outreachEffectiveness: { ...ZERO_METRIC },
    memoriesLearned: { ...ZERO_METRIC },
    averageMemoryImpact: { ...ZERO_METRIC },
    queriesActivated: { ...ZERO_METRIC },
    runReliability: { ...ZERO_METRIC },
  };

  return {
    overview: {
      metrics: zeroMetrics,
      qualityTrend: dates.map((date) => ({ date, qualityScore: 0 })),
      selfImprovementTrend: dates.map((date) => ({
        date,
        memoriesLearned: 0,
        queriesActivated: 0,
        qualifiedProspects: 0,
      })),
    },
    discovery: {
      stats: {
        keywordsCreated: { ...ZERO_METRIC },
        queriesGenerated: { ...ZERO_METRIC },
        queryWinRate: { ...ZERO_METRIC },
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
        runReliability: { ...ZERO_METRIC },
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
        contacted: 0,
        responses: 0,
      })),
      reliabilityTrend: dates.map((date) => ({
        date,
        reliability: 0,
        runsStarted: 0,
        failedRuns: 0,
      })),
    },
    memory: {
      summary: {
        memoriesLearned: { ...ZERO_METRIC },
        highImpactMemories: { ...ZERO_METRIC },
        averageImpact: { ...ZERO_METRIC },
        averageConfidence: { ...ZERO_METRIC },
      },
      impactTrend: dates.map((date) => ({
        date,
        memoryWrites: 0,
        impactScore: 0,
        confidence: 0,
        highImpactMemories: 0,
      })),
      helpfulMemories: [],
      recentMemories: [],
      inventory: [],
    },
    activity: {
      counts: {
        eventsReceived: { ...ZERO_METRIC },
        runsStarted: { ...ZERO_METRIC },
        failedEvents: { ...ZERO_METRIC, trend: "down" },
        failedRuns: { ...ZERO_METRIC, trend: "down" },
      },
      feed: [],
    },
  };
}
