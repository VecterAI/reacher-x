// features/analytics/ui/AnalyticsDashboard.tsx
"use client";

import * as React from "react";
import { parseAsIsoDateTime, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import { Button } from "@/shared/ui/components/Button";
import {
  FramePersonIcon,
  ErrorIcon,
  QuickPhrasesIcon,
  ThumbsUpDownIcon,
} from "@/shared/ui/components/icons";
import {
  StatsOverview,
  type StatMetricData,
  DateRangeSelector,
  PipelineFunnelChart,
  ProspectsTrendChart,
  FitDistributionChart,
  PlatformDistributionChart,
} from "./components";
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
 * **Charts Grid (2x2):**
 * 1. Pipeline Funnel - New -> Contacted -> In progress -> Converted
 * 2. Prospects Over Time - Area chart of found vs contacted
 * 3. Fit Score Distribution - Quality breakdown
 * 4. Platform Distribution - Source breakdown
 */
export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const router = useRouter();
  const { entityPlural, stageLabels } = useActiveUseCaseLabels();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const entityPluralLower = entityPlural.toLowerCase();

  const [{ range, from, to }] = useQueryStates({
    range: parseAsStringLiteral(DATE_RANGE_PRESETS).withDefault("7d"),
    from: parseAsIsoDateTime,
    to: parseAsIsoDateTime,
  });

  const workspaceStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus
  );
  const workspaceStatus = workspaceStatusQuery.data;
  const workspaceId =
    workspaceStatus?.status === "complete"
      ? workspaceStatus.workspace.id
      : null;

  const analyticsQuery = useQueryWithStatus(
    api.analytics.getDashboardAnalytics,
    workspaceId
      ? {
          workspaceId,
          range,
          ...(from ? { from: from.getTime() } : {}),
          ...(to ? { to: to.getTime() } : {}),
          refreshKey,
        }
      : "skip"
  );
  const analyticsResult = analyticsQuery.data;

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

  // Workspace setup gate — valid to block here since there's no workspace to query
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

  // Workspace setup gate — valid to block here since there's no workspace to query
  if (workspaceStatus && workspaceStatus.status !== "complete") {
    return (
      <div className={className}>
        <DateRangeSelector className="mb-4" />
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">Analytics setup is incomplete</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Finish workspace setup to unlock analytics data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <DateRangeSelector className="mb-4" />

      {(analyticsQuery.isError || analyticsResult?.status === "error") && (
        <div className="border-destructive bg-destructive/10 mb-4 rounded-lg border p-4">
          <p className="text-destructive text-sm font-medium">
            Could not load analytics
          </p>
          <p className="text-destructive/80 mt-1 text-sm">
            {analyticsQuery.error?.message ||
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

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelineFunnelChart data={data.pipelineFunnel} />
        <ProspectsTrendChart data={data.trendsOverTime} />
        <FitDistributionChart data={data.fitDistribution} />
        <PlatformDistributionChart data={data.platformDistribution} />
      </div>
    </div>
  );
}
