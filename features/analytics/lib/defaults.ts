import { format, subDays, subHours } from "date-fns";
import type {
  AnalyticsData,
  DateRangePreset,
  TrendDataPoint,
  FitDistributionDataPoint,
  PlatformDistributionDataPoint,
  PipelineFunnelDataPoint,
  QualificationDistributionDataPoint,
} from "./types";

const ZERO_METRIC = {
  value: 0,
  change: 0,
  changePercent: 0,
  trend: "up" as const,
};

const DEFAULT_PIPELINE_FUNNEL: PipelineFunnelDataPoint[] = [
  { stage: "new", count: 0, conversionRate: null, fill: "hsl(var(--chart-1))" },
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
];

const DEFAULT_FIT_DISTRIBUTION: FitDistributionDataPoint[] = [
  { range: "0-49", count: 0 },
  { range: "50-69", count: 0 },
  { range: "70-79", count: 0 },
  { range: "80-100", count: 0 },
];

const DEFAULT_PLATFORM_DISTRIBUTION: PlatformDistributionDataPoint[] = [
  { platform: "X/Twitter", count: 0 },
  { platform: "LinkedIn", count: 0 },
  { platform: "Reddit", count: 0 },
  { platform: "Threads", count: 0 },
  { platform: "Bluesky", count: 0 },
];

const DEFAULT_QUALIFICATION_DISTRIBUTION: QualificationDistributionDataPoint[] =
  [
    { segment: "qualified", count: 0 },
    { segment: "disqualified", count: 0 },
  ];

function createDefaultTrends(range: DateRangePreset): TrendDataPoint[] {
  const now = new Date();

  if (range === "today" || range === "1d") {
    return Array.from({ length: 12 }, (_, i) => ({
      date: format(subHours(now, 11 - i), "ha"),
      prospects: 0,
      contacted: 0,
    }));
  }

  if (range === "7d") {
    return Array.from({ length: 7 }, (_, i) => ({
      date: format(subDays(now, 6 - i), "EEE"),
      prospects: 0,
      contacted: 0,
    }));
  }

  if (range === "custom") {
    // Custom range length is unknown in this client fallback context.
    return [];
  }

  // 30d
  return Array.from({ length: 30 }, (_, i) => ({
    date: format(subDays(now, 29 - i), "MMM d"),
    prospects: 0,
    contacted: 0,
  }));
}

export function getDefaultAnalyticsData(range: DateRangePreset): AnalyticsData {
  return {
    newProspects: { ...ZERO_METRIC },
    responseRate: { ...ZERO_METRIC, contacted: 0 },
    pendingApprovals: { ...ZERO_METRIC, plans: 0, tasks: 0 },
    issues: { ...ZERO_METRIC, trend: "down" as const, paused: 0, failed: 0 },
    pipelineFunnel: DEFAULT_PIPELINE_FUNNEL.map((stage) => ({ ...stage })),
    trendsOverTime: createDefaultTrends(range),
    qualificationDistribution: DEFAULT_QUALIFICATION_DISTRIBUTION.map(
      (point) => ({ ...point })
    ),
    fitDistribution: DEFAULT_FIT_DISTRIBUTION.map((point) => ({ ...point })),
    platformDistribution: DEFAULT_PLATFORM_DISTRIBUTION.map((point) => ({
      ...point,
    })),
  };
}
