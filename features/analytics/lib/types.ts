// features/analytics/lib/types.ts

import type * as React from "react";

export type DateRangePreset = "today" | "1d" | "7d" | "30d" | "custom";

export interface StatMetric {
  value: number;
  change: number;
  changePercent: number;
  trend: "up" | "down";
}

/**
 * Extended StatMetric with display metadata for UI rendering.
 * Used by StatsOverview component.
 */
export interface StatMetricData extends StatMetric {
  id: string;
  title: string;
  icon?: React.ReactNode;
  format?: "number" | "percent" | "decimal";
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

export interface ResponseTimeDataPoint {
  bucket: string;
  count: number;
}

export interface PlatformDistributionDataPoint {
  platform: string;
  count: number;
}

export interface AnalyticsData {
  prospects: StatMetric;
  contacted: StatMetric;
  responseRate: StatMetric;
  conversions: StatMetric;
  trendsOverTime: TrendDataPoint[];
  fitDistribution: FitDistributionDataPoint[];
  responseTime: ResponseTimeDataPoint[];
  platformDistribution: PlatformDistributionDataPoint[];
}
