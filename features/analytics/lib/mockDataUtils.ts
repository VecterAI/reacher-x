import {
  addDays,
  addHours,
  differenceInCalendarDays,
  differenceInHours,
  format,
  startOfDay,
  subDays,
  subHours,
} from "date-fns";
import { getInclusiveDayCount } from "@/shared/lib/utils/time/timeUtils";
import type {
  AnalyticsData,
  DateRangePreset,
  TrendDataPoint,
  PipelineFunnelDataPoint,
} from "./types";

type SeededRandom = () => number;

function hashStringToSeed(input: string): number {
  // djb2
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // Force unsigned 32-bit
  return hash >>> 0;
}

function mulberry32(seed: number): SeededRandom {
  return function random() {
    // https://stackoverflow.com/a/47593316
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Generate pipeline funnel data with realistic conversion rates.
 * Each stage has progressively fewer prospects.
 */
function generatePipelineFunnel(
  newCount: number,
  rand: SeededRandom
): PipelineFunnelDataPoint[] {
  // Realistic conversion rates with some variance
  const contactedRate = 0.65 + rand() * 0.15; // 65-80% of new get contacted
  const inProgressRate = 0.35 + rand() * 0.15; // 35-50% of contacted respond
  const convertedRate = 0.25 + rand() * 0.2; // 25-45% of in_progress convert

  const contacted = Math.round(newCount * contactedRate);
  const inProgress = Math.round(contacted * inProgressRate);
  const converted = Math.round(inProgress * convertedRate);

  return [
    {
      stage: "new",
      count: newCount,
      conversionRate: null, // First stage has no conversion rate
      fill: "hsl(var(--chart-1))",
    },
    {
      stage: "contacted",
      count: contacted,
      conversionRate: Math.round(contactedRate * 1000) / 10,
      fill: "hsl(var(--chart-2))",
    },
    {
      stage: "in_progress",
      count: inProgress,
      conversionRate: Math.round(inProgressRate * 1000) / 10,
      fill: "hsl(var(--chart-3))",
    },
    {
      stage: "converted",
      count: converted,
      conversionRate: Math.round(convertedRate * 1000) / 10,
      fill: "hsl(var(--chart-4))",
    },
  ];
}

function pickDeterministicRange(
  range: DateRangePreset,
  from?: Date,
  to?: Date
) {
  const now = new Date();
  const end = now;

  if (range === "custom") {
    if (from && to) {
      const start = startOfDay(from < to ? from : to);
      const endCustom = startOfDay(from < to ? to : from);
      return { start, end: endCustom };
    }

    if (from) {
      return { start: startOfDay(from), end };
    }

    if (to) {
      return { start: subDays(end, 7), end: startOfDay(to) };
    }

    return { start: subDays(end, 7), end };
  }

  if (range === "today") {
    return { start: startOfDay(now), end };
  }

  if (range === "1d") {
    return { start: subHours(end, 24), end };
  }

  if (range === "7d") {
    return { start: subDays(end, 7), end };
  }

  // "30d"
  return { start: subDays(end, 30), end };
}

function makeTrendDataDaily({
  start,
  end,
  points,
  labelFormat,
  rand,
  dailyTotalProspects,
}: {
  start: Date;
  end: Date;
  points: number;
  labelFormat: string;
  rand: SeededRandom;
  dailyTotalProspects: number;
}): TrendDataPoint[] {
  const totalDays = Math.max(1, differenceInCalendarDays(end, start));
  const stepDays = totalDays / points;

  const result: TrendDataPoint[] = [];
  for (let i = 0; i < points; i += 1) {
    const d = addDays(start, Math.round(i * stepDays));
    const wave = Math.sin(i * 0.7) * 0.18 + Math.cos(i * 0.33) * 0.12;
    const jitter = (rand() - 0.5) * 0.18;
    const trend = i / Math.max(1, points - 1);

    const prospects = Math.max(
      0,
      Math.round(
        dailyTotalProspects * (0.7 + trend * 0.7) * (1 + wave + jitter)
      )
    );
    const contacted = Math.max(
      0,
      Math.round(prospects * (0.55 + rand() * 0.2))
    );

    result.push({
      date: format(d, labelFormat),
      prospects,
      contacted,
    });
  }

  return result;
}

function makeTrendDataHourly({
  start,
  end,
  points,
  labelFormat,
  rand,
  hourlyTotalProspects,
}: {
  start: Date;
  end: Date;
  points: number;
  labelFormat: string;
  rand: SeededRandom;
  hourlyTotalProspects: number;
}): TrendDataPoint[] {
  const totalHours = Math.max(1, differenceInHours(end, start));
  const stepHours = totalHours / points;

  const result: TrendDataPoint[] = [];
  for (let i = 0; i < points; i += 1) {
    const d = addHours(start, Math.round(i * stepHours));
    const wave = Math.sin(i * 0.7) * 0.18 + Math.cos(i * 0.33) * 0.12;
    const jitter = (rand() - 0.5) * 0.18;
    const trend = i / Math.max(1, points - 1);

    const prospects = Math.max(
      0,
      Math.round(
        hourlyTotalProspects * (0.7 + trend * 0.7) * (1 + wave + jitter)
      )
    );
    const contacted = Math.max(
      0,
      Math.round(prospects * (0.55 + rand() * 0.2))
    );

    result.push({
      date: format(d, labelFormat),
      prospects,
      contacted,
    });
  }

  return result;
}

export function getMockAnalyticsForRange(args: {
  range: DateRangePreset;
  from?: Date | null;
  to?: Date | null;
}): AnalyticsData {
  const from = args.from ?? undefined;
  const to = args.to ?? undefined;

  const { start, end } = pickDeterministicRange(args.range, from, to);
  const days = clamp(getInclusiveDayCount(start, end) ?? 1, 1, 60);

  const seed = hashStringToSeed(
    `${args.range}|${start.toISOString()}|${end.toISOString()}`
  );
  const rand = mulberry32(seed);

  // Scale totals by window length (30d baseline)
  const windowScale = clamp(days / 30, 0.05, 2);

  const prospectsTotal = Math.round(89935 * windowScale * (0.9 + rand() * 0.2));
  const responseRateValue = clamp(46.8 + (rand() - 0.5) * 8, 5, 95);

  const dailyTotalProspects = Math.max(10, Math.round(prospectsTotal / days));
  const hours = Math.max(1, differenceInHours(end, start));
  const hourlyTotalProspects = Math.max(3, Math.round(prospectsTotal / hours));

  const trendPreset =
    args.range === "today"
      ? { points: 12, labelFormat: "ha", mode: "hourly" as const } // 1AM, 3PM, ...
      : args.range === "1d"
        ? { points: 12, labelFormat: "ha", mode: "hourly" as const }
        : args.range === "7d"
          ? { points: 7, labelFormat: "EEE", mode: "daily" as const } // Mon, Tue...
          : {
              points: Math.min(30, days),
              labelFormat: "MMM d",
              mode: "daily" as const,
            };

  const trendsOverTime =
    trendPreset.mode === "hourly"
      ? makeTrendDataHourly({
          start,
          end,
          points: trendPreset.points,
          labelFormat: trendPreset.labelFormat,
          rand,
          hourlyTotalProspects,
        })
      : makeTrendDataDaily({
          start,
          end,
          points: trendPreset.points,
          labelFormat: trendPreset.labelFormat,
          rand,
          dailyTotalProspects,
        });

  // Distributions scale with volume
  const fitDistribution = [
    {
      range: "0-49",
      count: Math.round(1200 * windowScale * (0.85 + rand() * 0.3)),
    },
    {
      range: "50-69",
      count: Math.round(3400 * windowScale * (0.85 + rand() * 0.3)),
    },
    {
      range: "70-79",
      count: Math.round(2800 * windowScale * (0.85 + rand() * 0.3)),
    },
    {
      range: "80-100",
      count: Math.round(1800 * windowScale * (0.85 + rand() * 0.3)),
    },
  ];

  const platformDistribution = [
    {
      platform: "Twitter/X",
      count: Math.round(8500 * windowScale * (0.9 + rand() * 0.2)),
    },
    { platform: "LinkedIn", count: 0 },
    { platform: "Reddit", count: 0 },
    { platform: "Threads", count: 0 },
    { platform: "Bluesky", count: 0 },
  ];

  const qualificationDistribution = [
    {
      segment: "qualified" as const,
      count: Math.round(1200 * windowScale * (0.85 + rand() * 0.3)),
    },
    {
      segment: "disqualified" as const,
      count: Math.round(400 * windowScale * (0.85 + rand() * 0.3)),
    },
  ];

  // Generate pipeline funnel with realistic numbers based on new prospects
  const newProspectsCount = Math.round(47 * windowScale * (0.8 + rand() * 0.4));
  const pipelineFunnel = generatePipelineFunnel(newProspectsCount, rand);

  // Extract contacted count from funnel for response rate context
  const contactedFromFunnel =
    pipelineFunnel.find((p) => p.stage === "contacted")?.count ?? 0;

  // Generate pending approvals (realistic small numbers)
  const pendingPlans = Math.round(rand() * 4);
  const pendingTasks = Math.round(rand() * 3);
  const totalPending = pendingPlans + pendingTasks;
  const prevPending = Math.round(rand() * 5);
  const pendingChange = totalPending - prevPending;

  // Generate issues (paused + failed - should be low)
  const pausedPlans = Math.round(rand() * 2);
  const failedItems = Math.round(rand() * 2);
  const totalIssues = pausedPlans + failedItems;
  const prevIssues = Math.round(rand() * 3);
  const issuesChange = totalIssues - prevIssues;

  return {
    // New primary metrics
    newProspects: {
      value: newProspectsCount,
      change: Math.round((rand() - 0.4) * 12 * 10) / 10,
      changePercent: Math.round((rand() - 0.4) * 34 * 100) / 100,
      trend: rand() > 0.35 ? "up" : "down",
    },
    responseRate: {
      value: Math.round(responseRateValue * 10) / 10,
      change: Math.round((rand() - 0.5) * 6 * 100) / 100,
      changePercent: Math.round((rand() - 0.5) * 2 * 100) / 100,
      trend: rand() > 0.55 ? "up" : "down",
      contacted: contactedFromFunnel,
    },
    pendingApprovals: {
      value: totalPending,
      change: pendingChange,
      changePercent:
        prevPending > 0
          ? Math.round((pendingChange / prevPending) * 100 * 100) / 100
          : 0,
      trend: pendingChange <= 0 ? "down" : "up",
      plans: pendingPlans,
      tasks: pendingTasks,
    },
    issues: {
      value: totalIssues,
      change: issuesChange,
      changePercent:
        prevIssues > 0
          ? Math.round((issuesChange / prevIssues) * 100 * 100) / 100
          : 0,
      trend: issuesChange <= 0 ? "down" : "up",
      paused: pausedPlans,
      failed: failedItems,
    },

    // Chart data
    pipelineFunnel,
    trendsOverTime,
    qualificationDistribution,
    fitDistribution,
    platformDistribution,
  };
}
