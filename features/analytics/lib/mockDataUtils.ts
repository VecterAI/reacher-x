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
import type { AnalyticsData, DateRangePreset, TrendDataPoint } from "./types";

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
  const days = clamp(differenceInCalendarDays(end, start) + 1, 1, 60);

  const seed = hashStringToSeed(
    `${args.range}|${start.toISOString()}|${end.toISOString()}`
  );
  const rand = mulberry32(seed);

  // Scale totals by window length (30d baseline)
  const windowScale = clamp(days / 30, 0.05, 2);

  const prospectsTotal = Math.round(89935 * windowScale * (0.9 + rand() * 0.2));
  const contactedTotal = Math.round(23283 * windowScale * (0.9 + rand() * 0.2));
  const conversionsTotal = Math.round(
    124854 * windowScale * (0.9 + rand() * 0.2)
  );
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

  const responseTime = [
    {
      bucket: "<1h",
      count: Math.round(450 * windowScale * (0.85 + rand() * 0.3)),
    },
    {
      bucket: "1-6h",
      count: Math.round(820 * windowScale * (0.85 + rand() * 0.3)),
    },
    {
      bucket: "6-24h",
      count: Math.round(650 * windowScale * (0.85 + rand() * 0.3)),
    },
    {
      bucket: "1-3d",
      count: Math.round(380 * windowScale * (0.85 + rand() * 0.3)),
    },
    {
      bucket: ">3d",
      count: Math.round(290 * windowScale * (0.85 + rand() * 0.3)),
    },
    {
      bucket: ">1w",
      count: Math.round(180 * windowScale * (0.85 + rand() * 0.3)),
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

  return {
    prospects: {
      value: prospectsTotal,
      change: Math.round((rand() - 0.4) * 20 * 10) / 10,
      changePercent: Math.round((rand() - 0.4) * 3 * 100) / 100,
      trend: rand() > 0.25 ? "up" : "down",
    },
    contacted: {
      value: contactedTotal,
      change: Math.round((rand() - 0.4) * 10 * 10) / 10,
      changePercent: Math.round((rand() - 0.4) * 2 * 100) / 100,
      trend: rand() > 0.25 ? "up" : "down",
    },
    responseRate: {
      value: Math.round(responseRateValue * 10) / 10,
      change: Math.round((rand() - 0.5) * 6 * 100) / 100,
      changePercent: Math.round((rand() - 0.5) * 2 * 100) / 100,
      trend: rand() > 0.55 ? "up" : "down",
    },
    conversions: {
      value: conversionsTotal,
      change: Math.round((rand() - 0.4) * 25 * 10) / 10,
      changePercent: Math.round((rand() - 0.4) * 3.5 * 100) / 100,
      trend: rand() > 0.25 ? "up" : "down",
    },
    trendsOverTime,
    fitDistribution,
    responseTime,
    platformDistribution,
  };
}
