// features/analytics/ui/AnalyticsDashboard.tsx
"use client";

import * as React from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AnalyticsQueryResult } from "@/convex/lib/analyticsCore";
import {
  useActiveUseCaseLabels,
  usePreferredShellQueryArgs,
  useQueryWithStatus,
  useWorkspaceReportingTimeZone,
} from "@/shared/hooks";
import { Button } from "@/shared/ui/components/Button";
import {
  CheckCircleIcon,
  DoNotDisturbOnIcon,
  FramePersonIcon,
  ErrorIcon,
  PersonCheckIcon,
  QuickPhrasesIcon,
  SearchActivityIcon,
  ThumbsUpDownIcon,
} from "@/shared/ui/components/icons";
import { type StatMetricData } from "../lib/types";
import { StatsOverview } from "./components/StatsOverview";
import { DateRangeSelector } from "./components/DateRangeSelector";
import { PipelineFunnelChart } from "./components/PipelineFunnelChart";
import { ProspectsTrendChart } from "./components/ProspectsTrendChart";
import { FitDistributionChart } from "./components/FitDistributionChart";
import { QualificationDistributionChart } from "./components/QualificationDistributionChart";
import { PlatformDistributionChart } from "./components/PlatformDistributionChart";
import { DATE_RANGE_PRESETS } from "../lib/dateRange";
import { getDefaultAnalyticsData } from "../lib/defaults";

export interface AnalyticsDashboardProps {
  className?: string;
}

/**
 * AnalyticsDashboard - Main analytics view with stat cards and charts.
 *
 * Always renders the full dashboard layout. During loading or when data is
 * empty, all values display as zero. When data arrives, AnimatedNumber and
 * Recharts animate from zero to populated values.
 *
 * ## Layout
 *
 * **Stats Row (4 cards):**
 * 1. New Prospects - Found this period
 * 2. Response Rate - % with "of X contacted" context
 * 3. Pending Approvals - Plans/tasks breakdown
 * 4. Issues - Paused/failed breakdown (semantic: destructive)
 *
 * **Charts (two 2-column rows + full-width fit):**
 * Row 1: Pipeline Funnel | Prospects Over Time
 * Row 2: Qualification breakdown | Platform Distribution
 * Row 3: Fit Score Distribution (full width)
 */
export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const router = useRouter();
  const { entityPlural, stageLabels } = useActiveUseCaseLabels();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const entityPluralLower = entityPlural.toLowerCase();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();

  const [{ range, from, to }] = useQueryStates({
    range: parseAsStringLiteral(DATE_RANGE_PRESETS).withDefault("7d"),
    from: parseAsString,
    to: parseAsString,
  });

  const workspaceStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus,
    preferredShellQueryArgs
  );
  const workspaceStatus = workspaceStatusQuery.data;
  const workspaceId =
    workspaceStatus?.status === "complete"
      ? workspaceStatus.workspace.id
      : null;
  const { reportingTimeZone } = useWorkspaceReportingTimeZone(
    workspaceId,
    workspaceStatus?.status === "complete"
      ? workspaceStatus.workspace.reportingTimeZone
      : null
  );
  const loadAnalytics = useAction(api.analytics.getDashboardAnalyticsSnapshot);
  const [analyticsResult, setAnalyticsResult] =
    React.useState<AnalyticsQueryResult>();
  const [analyticsError, setAnalyticsError] = React.useState<Error>();

  React.useEffect(() => {
    let cancelled = false;
    if (!workspaceId) {
      setAnalyticsResult(undefined);
      return;
    }

    setAnalyticsResult(undefined);
    setAnalyticsError(undefined);
    void loadAnalytics({
      workspaceId,
      range,
      timeZone: reportingTimeZone,
      ...(from ? { fromDate: from } : {}),
      ...(to ? { toDate: to } : {}),
    })
      .then((result) => {
        if (!cancelled) {
          setAnalyticsResult(result);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAnalyticsError(
            error instanceof Error ? error : new Error("Please try again.")
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    from,
    loadAnalytics,
    range,
    refreshKey,
    reportingTimeZone,
    to,
    workspaceId,
  ]);

  const defaultData = React.useMemo(
    () => getDefaultAnalyticsData(range),
    [range]
  );
  const data = analyticsResult?.data ?? defaultData;

  const metrics: StatMetricData[] = React.useMemo(
    () => [
      {
        id: "new-prospects",
        title: `New ${entityPluralLower}`,
        value: data.newProspects.value,
        change: data.newProspects.change,
        changePercent: data.newProspects.changePercent,
        trend: data.newProspects.trend,
        context: "found this period",
        icon: <FramePersonIcon className="fill-current" />,
      },
      {
        id: "response-rate",
        title: "Response rate",
        value: data.responseRate.value,
        change: data.responseRate.change,
        changePercent: data.responseRate.changePercent,
        trend: data.responseRate.trend,
        format: "percent",
        context: `of ${data.responseRate.contacted.toLocaleString()} ${stageLabels.contacted.toLowerCase()}`,
        icon: <QuickPhrasesIcon className="fill-current" />,
      },
      {
        id: "pending-approvals",
        title: "Pending approvals",
        value: data.pendingApprovals.value,
        change: data.pendingApprovals.change,
        changePercent: data.pendingApprovals.changePercent,
        trend: data.pendingApprovals.trend,
        context: `${data.pendingApprovals.plans} plan${data.pendingApprovals.plans === 1 ? "" : "s"} · ${data.pendingApprovals.tasks} task${data.pendingApprovals.tasks === 1 ? "" : "s"}`,
        icon: <ThumbsUpDownIcon className="fill-current" />,
      },
      {
        id: "issues",
        title: "Outreach issues",
        value: data.issues.value,
        change: data.issues.change,
        changePercent: data.issues.changePercent,
        trend: data.issues.trend,
        context: `${data.issues.paused} plan${data.issues.paused === 1 ? "" : "s"} paused · ${data.issues.failed} task${data.issues.failed === 1 ? "" : "s"} failed`,
        semantic: "destructive",
        icon: <ErrorIcon className="fill-current" />,
      },
    ],
    [data, entityPluralLower, stageLabels]
  );

  const processingMetrics: StatMetricData[] = React.useMemo(
    () => [
      {
        id: "pending",
        title: "Pending",
        value: data.processingSummary.pending.value,
        change: data.processingSummary.pending.change,
        changePercent: data.processingSummary.pending.changePercent,
        trend: data.processingSummary.pending.trend,
        context: "new prospects still pending this period",
        icon: <SearchActivityIcon className="fill-current" />,
      },
      {
        id: "qualified",
        title: "Qualified",
        value: data.processingSummary.qualified.value,
        change: data.processingSummary.qualified.change,
        changePercent: data.processingSummary.qualified.changePercent,
        trend: data.processingSummary.qualified.trend,
        context: "new prospects currently qualified",
        icon: <PersonCheckIcon className="fill-current" />,
      },
      {
        id: "ready",
        title: "Ready",
        value: data.processingSummary.ready.value,
        change: data.processingSummary.ready.change,
        changePercent: data.processingSummary.ready.changePercent,
        trend: data.processingSummary.ready.trend,
        context: "new prospects currently ready",
        icon: <CheckCircleIcon className="fill-current" />,
      },
      {
        id: "disqualified",
        title: "Disqualified",
        value: data.processingSummary.disqualified.value,
        change: data.processingSummary.disqualified.change,
        changePercent: data.processingSummary.disqualified.changePercent,
        trend: data.processingSummary.disqualified.trend,
        context: "new prospects currently disqualified",
        semantic: "destructive",
        icon: <DoNotDisturbOnIcon className="fill-current" />,
      },
    ],
    [data]
  );

  if (workspaceStatusQuery.isError) {
    return (
      <div className={className}>
        <DateRangeSelector className="mb-4" />
        <div className="border-destructive bg-destructive/10 rounded-lg border p-4">
          <p className="text-destructive text-sm font-medium">
            Could not load workspace status
          </p>
          <p className="text-destructive/80 mt-1 text-sm">
            {workspaceStatusQuery.error.message || "Please try again."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => router.refresh()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <DateRangeSelector className="mb-4" />

      {(analyticsError || analyticsResult?.status === "error") && (
        <div className="border-destructive bg-destructive/10 mb-4 rounded-lg border p-4">
          <p className="text-destructive text-sm font-medium">
            Could not load analytics
          </p>
          <p className="text-destructive/80 mt-1 text-sm">
            {analyticsError?.message ||
              analyticsResult?.error ||
              "Please try again."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      )}

      <StatsOverview metrics={metrics} />
      <StatsOverview className="mt-4" metrics={processingMetrics} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelineFunnelChart data={data.pipelineFunnel} />
        <ProspectsTrendChart data={data.trendsOverTime} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QualificationDistributionChart
          data={data.qualificationDistribution}
          title="Qualification breakdown for new prospects"
        />
        <PlatformDistributionChart data={data.platformDistribution} />
      </div>

      <div className="mt-4">
        <FitDistributionChart data={data.fitDistribution} />
      </div>
    </div>
  );
}
