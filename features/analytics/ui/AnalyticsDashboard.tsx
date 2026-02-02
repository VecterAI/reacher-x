// features/analytics/ui/AnalyticsDashboard.tsx
"use client";

import * as React from "react";
import { parseAsIsoDateTime, parseAsStringLiteral, useQueryStates } from "nuqs";
import {
  FramePersonIcon,
  ErrorIcon,
  QuickPhrasesIcon,
  ThumbsUpDownIcon,
} from "@/shared/ui/components/icons";
import {
  StatsOverview,
  StatsOverviewSkeleton,
  ChartCardSkeleton,
  type StatMetricData,
  DateRangeSelector,
  PipelineFunnelChart,
  ProspectsTrendChart,
  FitDistributionChart,
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
 * ## Redesigned Layout (v4.1)
 *
 * **Stats Row (4 cards):**
 * 1. New Prospects - Found this period
 * 2. Response Rate - % with "of X contacted" context
 * 3. Pending Approvals - Plans/tasks breakdown
 * 4. Issues - Paused/failed breakdown (semantic: destructive)
 *
 * **Charts Grid (2x2):**
 * 1. Pipeline Funnel - New → Contacted → In Progress → Converted
 * 2. Prospects Over Time - Area chart of found vs contacted
 * 3. Fit Score Distribution - Quality breakdown
 * 4. Platform Distribution - Source breakdown
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
        id: "new-prospects",
        title: "New Prospects",
        value: data.newProspects.value,
        change: data.newProspects.change,
        changePercent: data.newProspects.changePercent,
        trend: data.newProspects.trend,
        context: "found this period",
        icon: <FramePersonIcon className="fill-current" />,
      },
      {
        id: "response-rate",
        title: "Response Rate",
        value: data.responseRate.value,
        change: data.responseRate.change,
        changePercent: data.responseRate.changePercent,
        trend: data.responseRate.trend,
        format: "percent",
        context: `of ${data.responseRate.contacted.toLocaleString()} contacted`,
        icon: <QuickPhrasesIcon className="fill-current" />,
      },
      {
        id: "pending-approvals",
        title: "Pending Approvals",
        value: data.pendingApprovals.value,
        change: data.pendingApprovals.change,
        changePercent: data.pendingApprovals.changePercent,
        trend: data.pendingApprovals.trend,
        context: `${data.pendingApprovals.plans} plan${data.pendingApprovals.plans === 1 ? "" : "s"} · ${data.pendingApprovals.tasks} task${data.pendingApprovals.tasks === 1 ? "" : "s"}`,
        icon: <ThumbsUpDownIcon className="fill-current" />,
      },
      {
        id: "issues",
        title: "Outreach Issues",
        value: data.issues.value,
        change: data.issues.change,
        changePercent: data.issues.changePercent,
        trend: data.issues.trend,
        context: `${data.issues.paused} plan${data.issues.paused === 1 ? "" : "s"} paused · ${data.issues.failed} task${data.issues.failed === 1 ? "" : "s"} failed`,
        semantic: "destructive",
        icon: <ErrorIcon className="fill-current" />,
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

      {/* Charts Grid - 2x2 layout on desktop, stacked on mobile */}
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
            <PipelineFunnelChart data={data.pipelineFunnel} />
            <ProspectsTrendChart data={data.trendsOverTime} />
            <FitDistributionChart data={data.fitDistribution} />
            <PlatformDistributionChart data={data.platformDistribution} />
          </>
        )}
      </div>
    </div>
  );
}
