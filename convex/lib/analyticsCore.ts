import { addDays, subDays, subHours } from "date-fns";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import type { WorkspaceUseCaseFunnelStageKey } from "../../shared/lib/workspaceUseCases";

export type AnalyticsDateRange = "today" | "1d" | "7d" | "30d" | "custom";
export type AnalyticsTrend = "up" | "down";

export interface StatMetric {
  value: number;
  change: number;
  changePercent: number;
  trend: AnalyticsTrend;
}

export interface PendingApprovalsMetric extends StatMetric {
  plans: number;
  tasks: number;
}

export interface IssuesMetric extends StatMetric {
  paused: number;
  failed: number;
}

export interface TrendDataPoint {
  date: string;
  prospects: number;
  contacted: number;
}

export interface FitDistributionDataPoint {
  range: string;
  count: number;
}

export interface PlatformDistributionDataPoint {
  platform: string;
  count: number;
}

export interface PipelineFunnelDataPoint {
  stage: WorkspaceUseCaseFunnelStageKey;
  count: number;
  conversionRate: number | null;
  fill: string;
}

export interface AnalyticsDataPayload {
  newProspects: StatMetric;
  responseRate: StatMetric & { contacted: number };
  pendingApprovals: PendingApprovalsMetric;
  issues: IssuesMetric;
  pipelineFunnel: PipelineFunnelDataPoint[];
  trendsOverTime: TrendDataPoint[];
  fitDistribution: FitDistributionDataPoint[];
  platformDistribution: PlatformDistributionDataPoint[];
}

export interface AnalyticsQueryResult {
  status: "success" | "error";
  data: AnalyticsDataPayload;
  generatedAt: number;
  error?: string;
}

export interface TimeWindow {
  startMs: number;
  endMs: number;
}

export interface NormalizedAnalyticsWindow {
  range: AnalyticsDateRange;
  granularity: "hourly" | "daily";
  current: TimeWindow;
  previous: TimeWindow;
}

export interface TrendBucket {
  label: string;
  startMs: number;
  endMs: number;
}

export interface TrendBucketSet {
  window: TimeWindow;
  stepMs: number;
  buckets: TrendBucket[];
}

interface NormalizeWindowInput {
  range: AnalyticsDateRange;
  from?: number;
  to?: number;
  nowMs?: number;
}

interface BuildMetricInput {
  currentValue: number;
  previousValue: number;
  valueDecimals?: number;
  changeDecimals?: number;
  changePercentDecimals?: number;
  trendWhenEqual?: AnalyticsTrend;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MIN_WINDOW_MS = 1;

const FIT_DISTRIBUTION_BUCKETS = ["0-49", "50-69", "70-79", "80-100"] as const;

const PLATFORM_LABELS = [
  "Twitter/X",
  "LinkedIn",
  "Reddit",
  "Threads",
  "Bluesky",
] as const;

const HOUR_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  hour12: true,
  timeZone: "UTC",
});
const WEEKDAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});
const MONTH_DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatBucketLabelUTC(
  bucketStart: number,
  granularity: NormalizedAnalyticsWindow["granularity"],
  targetPoints: number
): string {
  const date = new Date(bucketStart);
  if (granularity === "hourly") {
    return HOUR_LABEL_FORMATTER.format(date).replace(/\s+/g, "");
  }
  if (targetPoints <= 7) {
    return WEEKDAY_LABEL_FORMATTER.format(date);
  }
  return MONTH_DAY_LABEL_FORMATTER.format(date);
}

function normalizeTimestamp(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = value < 10_000_000_000 ? value * 1000 : value;
  const parsed = new Date(normalized).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function isTimestampInWindow(
  timestamp: number,
  window: TimeWindow
): boolean {
  return timestamp >= window.startMs && timestamp < window.endMs;
}

export function calculateRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return 0;
  }
  if (denominator <= 0) {
    return 0;
  }
  return (numerator / denominator) * 100;
}

export function calculateChangePercent(
  currentValue: number,
  previousValue: number
): number {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return 0;
  }
  if (previousValue === 0) {
    return 0;
  }
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
}

export function buildMetric({
  currentValue,
  previousValue,
  valueDecimals = 0,
  changeDecimals = 1,
  changePercentDecimals = 2,
  trendWhenEqual = "up",
}: BuildMetricInput): StatMetric {
  const currentRounded = roundTo(currentValue, valueDecimals);
  const previousRounded = roundTo(previousValue, valueDecimals);
  const changeRaw = currentRounded - previousRounded;

  return {
    value: currentRounded,
    change: roundTo(changeRaw, changeDecimals),
    changePercent: roundTo(
      calculateChangePercent(currentRounded, previousRounded),
      changePercentDecimals
    ),
    trend: changeRaw === 0 ? trendWhenEqual : changeRaw > 0 ? "up" : "down",
  };
}

export function normalizeAnalyticsWindow(
  args: NormalizeWindowInput
): NormalizedAnalyticsWindow {
  const nowMs = args.nowMs ?? getCurrentUTCTimestamp();
  const nowDate = new Date(nowMs);

  let startMs: number;
  let endMs: number;

  const fromMs = normalizeTimestamp(args.from);
  const toMs = normalizeTimestamp(args.to);

  if (args.range === "custom") {
    if (fromMs !== undefined && toMs !== undefined) {
      const minMs = Math.min(fromMs, toMs);
      const maxMs = Math.max(fromMs, toMs);

      // Keep client-provided timestamps as-is to preserve user timezone intent.
      startMs = minMs;
      endMs = addDays(new Date(maxMs), 1).getTime();
    } else if (fromMs !== undefined) {
      startMs = fromMs;
      endMs = nowMs;
    } else if (toMs !== undefined) {
      const endDay = addDays(new Date(toMs), 1);
      endMs = endDay.getTime();
      startMs = subDays(endDay, 7).getTime();
    } else {
      startMs = subDays(nowDate, 7).getTime();
      endMs = nowMs;
    }
  } else if (args.range === "today") {
    startMs = Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate()
    );
    endMs = nowMs;
  } else if (args.range === "1d") {
    startMs = subHours(nowDate, 24).getTime();
    endMs = nowMs;
  } else if (args.range === "7d") {
    startMs = subDays(nowDate, 7).getTime();
    endMs = nowMs;
  } else {
    startMs = subDays(nowDate, 30).getTime();
    endMs = nowMs;
  }

  // Keep the selected window bounded and valid.
  endMs = Math.min(endMs, nowMs);
  if (endMs <= startMs) {
    endMs = startMs + MIN_WINDOW_MS;
  }

  const durationMs = Math.max(MIN_WINDOW_MS, endMs - startMs);
  const previous: TimeWindow = {
    startMs: startMs - durationMs,
    endMs: startMs,
  };

  return {
    range: args.range,
    granularity:
      args.range === "today" || args.range === "1d" ? "hourly" : "daily",
    current: { startMs, endMs },
    previous,
  };
}

export function createTrendBucketSet(
  normalizedWindow: NormalizedAnalyticsWindow
): TrendBucketSet {
  const { current, granularity, range } = normalizedWindow;
  const durationMs = Math.max(MIN_WINDOW_MS, current.endMs - current.startMs);

  const targetPoints =
    granularity === "hourly"
      ? 12
      : range === "7d"
        ? 7
        : Math.min(30, Math.max(1, Math.ceil(durationMs / DAY_MS)));

  const stepMs = Math.max(MIN_WINDOW_MS, Math.floor(durationMs / targetPoints));
  const buckets: TrendBucket[] = [];

  for (let index = 0; index < targetPoints; index += 1) {
    const bucketStart = current.startMs + index * stepMs;
    const bucketEnd =
      index === targetPoints - 1
        ? current.endMs
        : current.startMs + (index + 1) * stepMs;

    const label = formatBucketLabelUTC(bucketStart, granularity, targetPoints);

    buckets.push({
      label,
      startMs: bucketStart,
      endMs: bucketEnd,
    });
  }

  return {
    window: current,
    stepMs,
    buckets,
  };
}

export function countTimestampsByBucket(
  timestamps: number[],
  bucketSet: TrendBucketSet
): number[] {
  const counts = Array.from({ length: bucketSet.buckets.length }, () => 0);

  for (const timestamp of timestamps) {
    if (!isTimestampInWindow(timestamp, bucketSet.window)) {
      continue;
    }

    const bucketIndex = Math.min(
      bucketSet.buckets.length - 1,
      Math.max(
        0,
        Math.floor((timestamp - bucketSet.window.startMs) / bucketSet.stepMs)
      )
    );

    counts[bucketIndex] += 1;
  }

  return counts;
}

export function buildPipelineFunnel(args: {
  newCount: number;
  contactedCount: number;
  inProgressCount: number;
  convertedCount: number;
}): PipelineFunnelDataPoint[] {
  const newCount = Math.max(0, Math.round(args.newCount));
  const contactedCount = Math.min(
    newCount,
    Math.max(0, Math.round(args.contactedCount))
  );
  const inProgressCount = Math.min(
    contactedCount,
    Math.max(0, Math.round(args.inProgressCount))
  );
  const convertedCount = Math.min(
    inProgressCount,
    Math.max(0, Math.round(args.convertedCount))
  );

  return [
    {
      stage: "new",
      count: newCount,
      conversionRate: null,
      fill: "hsl(var(--chart-1))",
    },
    {
      stage: "contacted",
      count: contactedCount,
      conversionRate: roundTo(calculateRate(contactedCount, newCount), 1),
      fill: "hsl(var(--chart-2))",
    },
    {
      stage: "in_progress",
      count: inProgressCount,
      conversionRate: roundTo(
        calculateRate(inProgressCount, contactedCount),
        1
      ),
      fill: "hsl(var(--chart-3))",
    },
    {
      stage: "converted",
      count: convertedCount,
      conversionRate: roundTo(
        calculateRate(convertedCount, inProgressCount),
        1
      ),
      fill: "hsl(var(--chart-4))",
    },
  ];
}

export function createEmptyAnalyticsData(
  bucketSet: TrendBucketSet
): AnalyticsDataPayload {
  const trendsOverTime: TrendDataPoint[] = bucketSet.buckets.map((bucket) => ({
    date: bucket.label,
    prospects: 0,
    contacted: 0,
  }));

  const fitDistribution: FitDistributionDataPoint[] =
    FIT_DISTRIBUTION_BUCKETS.map((range) => ({
      range,
      count: 0,
    }));

  const platformDistribution: PlatformDistributionDataPoint[] =
    PLATFORM_LABELS.map((platform) => ({
      platform,
      count: 0,
    }));

  return {
    newProspects: buildMetric({
      currentValue: 0,
      previousValue: 0,
    }),
    responseRate: {
      ...buildMetric({
        currentValue: 0,
        previousValue: 0,
        valueDecimals: 1,
        changeDecimals: 2,
      }),
      contacted: 0,
    },
    pendingApprovals: {
      ...buildMetric({
        currentValue: 0,
        previousValue: 0,
      }),
      plans: 0,
      tasks: 0,
    },
    issues: {
      ...buildMetric({
        currentValue: 0,
        previousValue: 0,
        trendWhenEqual: "down",
      }),
      paused: 0,
      failed: 0,
    },
    pipelineFunnel: buildPipelineFunnel({
      newCount: 0,
      contactedCount: 0,
      inProgressCount: 0,
      convertedCount: 0,
    }),
    trendsOverTime,
    fitDistribution,
    platformDistribution,
  };
}
