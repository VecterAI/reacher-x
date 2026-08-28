import {
  DEFAULT_REPORTING_TIME_ZONE,
  getCurrentUTCTimestamp,
  getNextTimeZoneDayStartTimestamp,
  getTimeZoneDayStartTimestamp,
  getTimeZoneInclusiveDayCount,
  getTimeZoneLocalDateTimeUtcTimestamp,
  normalizeTimeZoneIdentifier,
  parseDateOnlyValue,
  shiftTimestampByTimeZoneDays,
} from "../../shared/lib/utils/time/timeUtils";
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

export type QualificationDistributionSegment =
  | "qualified"
  | "disqualified"
  | "pending";

export interface QualificationDistributionDataPoint {
  segment: QualificationDistributionSegment;
  count: number;
}

export interface PipelineFunnelDataPoint {
  stage: WorkspaceUseCaseFunnelStageKey;
  count: number;
  conversionRate: number | null;
  fill: string;
}

export interface ProcessingSummaryMetricSet {
  pending: StatMetric;
  qualified: StatMetric;
  ready: StatMetric;
  disqualified: StatMetric;
}

export interface AnalyticsDataPayload {
  newProspects: StatMetric;
  responseRate: StatMetric & { contacted: number };
  pendingApprovals: PendingApprovalsMetric;
  issues: IssuesMetric;
  processingSummary: ProcessingSummaryMetricSet;
  pipelineFunnel: PipelineFunnelDataPoint[];
  trendsOverTime: TrendDataPoint[];
  qualificationDistribution: QualificationDistributionDataPoint[];
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
  granularity: "hourly" | "daily" | "weekly" | "monthly";
  timeZone: string;
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

export type HourlyAnalyticsRow<Field extends string> = {
  dayStartUtcMs: number;
} & Record<Field, number[]>;

interface NormalizeWindowInput {
  range: AnalyticsDateRange;
  from?: number;
  to?: number;
  fromDate?: string;
  toDate?: string;
  timeZone?: string;
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
const DAILY_TREND_MAX_DAYS = 31;
const WEEKLY_TREND_MAX_DAYS = 180;

const FIT_DISTRIBUTION_BUCKETS = ["0-49", "50-69", "70-79", "80-100"] as const;

const PLATFORM_LABELS = [
  "Twitter/X",
  "LinkedIn",
  "Reddit",
  "Threads",
  "Bluesky",
] as const;

const hourLabelFormatterCache = new Map<string, Intl.DateTimeFormat>();
const weekdayLabelFormatterCache = new Map<string, Intl.DateTimeFormat>();
const monthDayLabelFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getHourLabelFormatter(timeZone: string) {
  const normalized = normalizeTimeZoneIdentifier(timeZone);
  const cached = hourLabelFormatterCache.get(normalized);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
    timeZone: normalized,
  });
  hourLabelFormatterCache.set(normalized, formatter);
  return formatter;
}

function getWeekdayLabelFormatter(timeZone: string) {
  const normalized = normalizeTimeZoneIdentifier(timeZone);
  const cached = weekdayLabelFormatterCache.get(normalized);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: normalized,
  });
  weekdayLabelFormatterCache.set(normalized, formatter);
  return formatter;
}

function getMonthDayLabelFormatter(timeZone: string) {
  const normalized = normalizeTimeZoneIdentifier(timeZone);
  const cached = monthDayLabelFormatterCache.get(normalized);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: normalized,
  });
  monthDayLabelFormatterCache.set(normalized, formatter);
  return formatter;
}

function formatBucketLabel(
  bucketStart: number,
  timeZone: string,
  granularity: NormalizedAnalyticsWindow["granularity"],
  targetPoints: number
): string {
  const date = new Date(bucketStart);
  if (granularity === "hourly") {
    return getHourLabelFormatter(timeZone).format(date).replace(/\s+/g, "");
  }
  if (targetPoints <= 7) {
    return getWeekdayLabelFormatter(timeZone).format(date);
  }
  return getMonthDayLabelFormatter(timeZone).format(date);
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
  const timeZone = normalizeTimeZoneIdentifier(
    args.timeZone ?? DEFAULT_REPORTING_TIME_ZONE
  );

  let startMs: number;
  let endMs: number;

  const fromMs = normalizeTimestamp(args.from);
  const toMs = normalizeTimestamp(args.to);
  const fromDate = parseDateOnlyValue(args.fromDate);
  const toDate = parseDateOnlyValue(args.toDate);
  const todayStartMs = getTimeZoneDayStartTimestamp(nowMs, timeZone);

  if (args.range === "custom") {
    if (fromDate || toDate) {
      const resolvedStartDate = fromDate ?? toDate!;
      const resolvedEndDate = toDate ?? fromDate!;

      const orderedStartDate =
        Date.UTC(
          resolvedStartDate.year,
          resolvedStartDate.month - 1,
          resolvedStartDate.day
        ) <=
        Date.UTC(
          resolvedEndDate.year,
          resolvedEndDate.month - 1,
          resolvedEndDate.day
        )
          ? resolvedStartDate
          : resolvedEndDate;
      const orderedEndDate =
        orderedStartDate === resolvedStartDate
          ? resolvedEndDate
          : resolvedStartDate;

      startMs = getTimeZoneLocalDateTimeUtcTimestamp({
        timeZone,
        year: orderedStartDate.year,
        month: orderedStartDate.month,
        day: orderedStartDate.day,
      });
      endMs = getTimeZoneLocalDateTimeUtcTimestamp({
        timeZone,
        ...orderedEndDate,
      });
      endMs = shiftTimestampByTimeZoneDays(endMs, timeZone, 1);
    } else if (fromMs !== undefined || toMs !== undefined) {
      const minMs = Math.min(fromMs ?? toMs ?? nowMs, toMs ?? fromMs ?? nowMs);
      const maxMs = Math.max(fromMs ?? toMs ?? nowMs, toMs ?? fromMs ?? nowMs);
      startMs = getTimeZoneDayStartTimestamp(minMs, timeZone);
      endMs = getNextTimeZoneDayStartTimestamp(maxMs, timeZone);
    } else {
      startMs = shiftTimestampByTimeZoneDays(todayStartMs, timeZone, -6);
      endMs = nowMs;
    }
  } else if (args.range === "today") {
    startMs = todayStartMs;
    endMs = nowMs;
  } else if (args.range === "1d") {
    startMs = shiftTimestampByTimeZoneDays(todayStartMs, timeZone, -1);
    endMs = todayStartMs;
  } else if (args.range === "7d") {
    startMs = shiftTimestampByTimeZoneDays(todayStartMs, timeZone, -6);
    endMs = nowMs;
  } else {
    startMs = shiftTimestampByTimeZoneDays(todayStartMs, timeZone, -29);
    endMs = nowMs;
  }

  // Keep the selected window bounded and valid.
  endMs = Math.min(endMs, nowMs);
  if (endMs <= startMs) {
    endMs = startMs + MIN_WINDOW_MS;
  }

  const previousShiftDays =
    args.range === "today"
      ? 1
      : args.range === "1d"
        ? 1
        : args.range === "7d"
          ? 7
          : args.range === "30d"
            ? 30
            : getTimeZoneInclusiveDayCount(startMs, endMs, timeZone);
  const previous: TimeWindow = {
    startMs: shiftTimestampByTimeZoneDays(
      startMs,
      timeZone,
      -previousShiftDays
    ),
    endMs: shiftTimestampByTimeZoneDays(endMs, timeZone, -previousShiftDays),
  };

  return {
    range: args.range,
    granularity: (() => {
      if (args.range === "today" || args.range === "1d") {
        return "hourly";
      }
      const inclusiveDays = getTimeZoneInclusiveDayCount(
        startMs,
        endMs,
        timeZone
      );
      if (inclusiveDays <= DAILY_TREND_MAX_DAYS) {
        return "daily";
      }
      return inclusiveDays <= WEEKLY_TREND_MAX_DAYS ? "weekly" : "monthly";
    })(),
    timeZone,
    current: { startMs, endMs },
    previous,
  };
}

export function createTrendBucketSet(
  normalizedWindow: NormalizedAnalyticsWindow
): TrendBucketSet {
  const { current, granularity, timeZone } = normalizedWindow;
  const buckets: TrendBucket[] = [];

  if (granularity === "hourly") {
    for (
      let bucketStart = current.startMs;
      bucketStart < current.endMs;
      bucketStart += HOUR_MS
    ) {
      const bucketEnd = Math.min(current.endMs, bucketStart + HOUR_MS);
      buckets.push({
        label: formatBucketLabel(bucketStart, timeZone, granularity, 24),
        startMs: bucketStart,
        endMs: bucketEnd,
      });
    }
  } else {
    const bucketDays =
      granularity === "monthly" ? 30 : granularity === "weekly" ? 7 : 1;
    let bucketStart = current.startMs;

    while (bucketStart < current.endMs) {
      const nextDayStart = shiftTimestampByTimeZoneDays(
        bucketStart,
        timeZone,
        bucketDays
      );
      const bucketEnd = Math.min(current.endMs, nextDayStart);
      buckets.push({
        label: formatBucketLabel(
          bucketStart,
          timeZone,
          granularity,
          Math.max(1, buckets.length + 1)
        ),
        startMs: bucketStart,
        endMs: bucketEnd,
      });
      bucketStart = nextDayStart;
    }
  }

  const targetPoints = Math.max(1, buckets.length);
  const relabeledBuckets = buckets.map((bucket) => ({
    ...bucket,
    label: formatBucketLabel(
      bucket.startMs,
      timeZone,
      granularity,
      targetPoints
    ),
  }));

  return {
    window: current,
    stepMs:
      relabeledBuckets.length > 1
        ? relabeledBuckets[1].startMs - relabeledBuckets[0].startMs
        : Math.max(MIN_WINDOW_MS, current.endMs - current.startMs),
    buckets: relabeledBuckets,
  };
}

export function findBucketIndex(
  bucketSet: TrendBucketSet,
  timestamp: number
): number {
  for (let index = 0; index < bucketSet.buckets.length; index += 1) {
    const bucket = bucketSet.buckets[index];
    if (timestamp >= bucket.startMs && timestamp < bucket.endMs) {
      return index;
    }
  }

  if (bucketSet.buckets.length === 0) {
    return -1;
  }

  if (timestamp === bucketSet.window.endMs) {
    return bucketSet.buckets.length - 1;
  }

  return -1;
}

export function rowIntersectsWindow(
  row: Pick<HourlyAnalyticsRow<string>, "dayStartUtcMs">,
  window: TimeWindow
): boolean {
  const rowStartMs = row.dayStartUtcMs;
  const rowEndMs = row.dayStartUtcMs + DAY_MS;
  return rowStartMs < window.endMs && rowEndMs > window.startMs;
}

export function sumHourlyFieldInWindow<Field extends string>(
  rows: Array<HourlyAnalyticsRow<Field>>,
  field: Field,
  window: TimeWindow
): number {
  let total = 0;

  for (const row of rows) {
    if (!rowIntersectsWindow(row, window)) {
      continue;
    }

    row[field].forEach((count, hour) => {
      if (count <= 0) {
        return;
      }

      const hourStartMs = row.dayStartUtcMs + hour * HOUR_MS;
      if (isTimestampInWindow(hourStartMs, window)) {
        total += count;
      }
    });
  }

  return total;
}

export function countHourlyFieldByBucket<Field extends string>(
  rows: Array<HourlyAnalyticsRow<Field>>,
  field: Field,
  bucketSet: TrendBucketSet
): number[] {
  const counts = Array.from({ length: bucketSet.buckets.length }, () => 0);

  for (const row of rows) {
    row[field].forEach((count, hour) => {
      if (count <= 0) {
        return;
      }

      const hourStartMs = row.dayStartUtcMs + hour * HOUR_MS;
      if (!isTimestampInWindow(hourStartMs, bucketSet.window)) {
        return;
      }

      const bucketIndex = findBucketIndex(bucketSet, hourStartMs);
      if (bucketIndex >= 0) {
        counts[bucketIndex] += count;
      }
    });
  }

  return counts;
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

    const bucketIndex = findBucketIndex(bucketSet, timestamp);
    if (bucketIndex >= 0) {
      counts[bucketIndex] += 1;
    }
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

  const qualificationDistribution: QualificationDistributionDataPoint[] = [
    { segment: "qualified", count: 0 },
    { segment: "disqualified", count: 0 },
    { segment: "pending", count: 0 },
  ];

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
    processingSummary: {
      pending: buildMetric({
        currentValue: 0,
        previousValue: 0,
      }),
      qualified: buildMetric({
        currentValue: 0,
        previousValue: 0,
      }),
      ready: buildMetric({
        currentValue: 0,
        previousValue: 0,
      }),
      disqualified: buildMetric({
        currentValue: 0,
        previousValue: 0,
        trendWhenEqual: "down",
      }),
    },
    pipelineFunnel: buildPipelineFunnel({
      newCount: 0,
      contactedCount: 0,
      inProgressCount: 0,
      convertedCount: 0,
    }),
    trendsOverTime,
    qualificationDistribution,
    fitDistribution,
    platformDistribution,
  };
}
