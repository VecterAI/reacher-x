// features/analytics/ui/AnalyticsDashboard.tsx
"use client";

import * as React from "react";
import { parseAsIsoDateTime, parseAsStringLiteral, useQueryStates } from "nuqs";
import {
  FramePersonIcon,
  QuickPhrasesIcon,
  InsertChartIcon,
  AccountBoxIcon,
} from "@/shared/ui/components/icons";
import {
  StatsOverview,
  StatsOverviewSkeleton,
  ChartCardSkeleton,
  type StatMetricData,
  DateRangeSelector,
  ProspectsTrendChart,
  FitDistributionChart,
  ResponseTimeChart,
  PlatformDistributionChart,
} from "./components";
import { DATE_RANGE_PRESETS } from "../lib/dateRange";
import { getMockAnalyticsForRange } from "../lib/mockDataUtils";

export interface AnalyticsDashboardProps {
  className?: string;
}

/**
 * AnalyticsDashboard - Main analytics view with stat cards and charts.
 *
 * Performance optimizations applied:
 * - `rerender-memo`: Chart components are React.memo'd to prevent unnecessary re-renders
 * - `rendering-conditional-render`: Uses ternary for loading states
 * - All charts use consistent monochrome color scheme from design language
 */
export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  // In Phase 1, we use mock data
  // Phase 2 will replace this with Convex queries
  const isLoading = false;
  const [{ range, from, to }] = useQueryStates({
    range: parseAsStringLiteral(DATE_RANGE_PRESETS).withDefault("7d"),
    from: parseAsIsoDateTime,
    to: parseAsIsoDateTime,
  });

  const data = React.useMemo(
    () => getMockAnalyticsForRange({ range, from, to }),
    [from, range, to]
  );

  // Transform data into metrics array for StatsOverview
  const metrics: StatMetricData[] = React.useMemo(
    () => [
      {
        id: "prospects",
        title: "Total Prospects",
        value: data.prospects.value,
        change: data.prospects.change,
        changePercent: data.prospects.changePercent,
        trend: data.prospects.trend,
        icon: <FramePersonIcon className="fill-current" />,
      },
      {
        id: "contacted",
        title: "Contacted",
        value: data.contacted.value,
        change: data.contacted.change,
        changePercent: data.contacted.changePercent,
        trend: data.contacted.trend,
        icon: <QuickPhrasesIcon className="fill-current" />,
      },
      {
        id: "response-rate",
        title: "Response Rate",
        value: data.responseRate.value,
        change: data.responseRate.change,
        changePercent: data.responseRate.changePercent,
        trend: data.responseRate.trend,
        format: "percent",
        icon: <InsertChartIcon className="fill-current" />,
      },
      {
        id: "conversions",
        title: "Conversions",
        value: data.conversions.value,
        change: data.conversions.change,
        changePercent: data.conversions.changePercent,
        trend: data.conversions.trend,
        icon: <AccountBoxIcon className="fill-current" />,
      },
    ],
    [data]
  );

  return (
    <div className={className}>
      {/* Date Range Selector */}
      <DateRangeSelector className="mb-4" />

      {/* Stats Overview - Composition pattern for loading */}
      {isLoading ? (
        <StatsOverviewSkeleton />
      ) : (
        <StatsOverview metrics={metrics} />
      )}

      {/* Charts - Composition pattern for loading */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {isLoading ? (
          <>
            <ChartCardSkeleton />
            <ChartCardSkeleton />
            <ChartCardSkeleton />
            <ChartCardSkeleton />
          </>
        ) : (
          <>
            <ProspectsTrendChart data={data.trendsOverTime} />
            <FitDistributionChart data={data.fitDistribution} />
            <ResponseTimeChart data={data.responseTime} />
            <PlatformDistributionChart data={data.platformDistribution} />
          </>
        )}
      </div>
    </div>
  );
}
