/**
 * DemoAnalyticsPage
 * Faithful replica of the real analytics route (app/(webapp)/analytics/page.tsx
 * + features/analytics/ui/AnalyticsDashboard.tsx) running on the bundled
 * MOCK_ANALYTICS data. Reuses the real StatsOverview and all five chart
 * components as-is; the DateRangeSelector is replicated with local state so
 * no URL params are written from the landing page. The Convex-wired
 * WorkspacePlanLimitAlert from the real page is omitted.
 */
"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import { MOCK_ANALYTICS } from "@/features/analytics/lib/mockData";
import type {
  DateRangePreset,
  StatMetricData,
} from "@/features/analytics/lib/types";
import { DateRangeInputPicker } from "@/features/analytics/ui/components/DateRangeInputPicker";
import { FitDistributionChart } from "@/features/analytics/ui/components/FitDistributionChart";
import { PipelineFunnelChart } from "@/features/analytics/ui/components/PipelineFunnelChart";
import { PlatformDistributionChart } from "@/features/analytics/ui/components/PlatformDistributionChart";
import { ProspectsTrendChart } from "@/features/analytics/ui/components/ProspectsTrendChart";
import { QualificationDistributionChart } from "@/features/analytics/ui/components/QualificationDistributionChart";
import { StatsOverview } from "@/features/analytics/ui/components/StatsOverview";
import { useDemoShell } from "../demoShellContext";
import { getInclusiveDayCount } from "@/shared/lib/utils/time/timeUtils";
import { cn } from "@/shared/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import {
  CheckCircleIcon,
  DoNotDisturbOnIcon,
  ErrorIcon,
  FramePersonIcon,
  PersonCheckIcon,
  QuickPhrasesIcon,
  SearchActivityIcon,
  ThumbsUpDownIcon,
} from "@/shared/ui/components/icons";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";

/**
 * Presentational replica of features/analytics/ui/components/DateRangeSelector.tsx
 * with local React state instead of nuqs URL params.
 */
function DemoDateRangeSelector({ className }: { className?: string }) {
  const [range, setRange] = React.useState<DateRangePreset>("7d");
  const [customDateRange, setCustomDateRange] = React.useState<
    DateRange | undefined
  >(undefined);

  const customDaysLabel = React.useMemo(() => {
    const days = getInclusiveDayCount(
      customDateRange?.from ?? null,
      customDateRange?.to ?? null
    );
    return days ? `${days}d` : "Custom";
  }, [customDateRange]);

  const handlePresetChange = React.useCallback((value: string) => {
    setRange(value as DateRangePreset);
  }, []);

  const handleCustomRangeChange = React.useCallback(
    (dateRange: DateRange | undefined) => {
      setCustomDateRange(dateRange);
    },
    []
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Tabs value={range} onValueChange={handlePresetChange}>
        <TabsList size="sm">
          <TabsTrigger value="today" size="sm">
            Today
          </TabsTrigger>
          <TabsTrigger value="1d" size="sm">
            Yesterday
          </TabsTrigger>
          <TabsTrigger value="7d" size="sm">
            7d
          </TabsTrigger>
          <TabsTrigger value="30d" size="sm">
            30d
          </TabsTrigger>
          <TabsTrigger value="custom" size="sm">
            {customDaysLabel}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {range === "custom" && (
        <DateRangeInputPicker
          value={customDateRange}
          onChange={handleCustomRangeChange}
          className="w-auto"
        />
      )}
    </div>
  );
}

export function DemoAnalyticsPage() {
  const { labels } = useDemoShell();
  const { entityPlural, stageLabels, pageLabels } = labels;
  const entityPluralLower = entityPlural.toLowerCase();
  const data = MOCK_ANALYTICS;

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

  return (
    <PageLayout className="flex h-full min-h-0 w-full max-w-none min-w-0 flex-1 flex-col overflow-hidden border-none">
      <PageHeader title={pageLabels.analytics} />
      <PageContent className="scroll-fade min-h-0 flex-1 overflow-y-auto p-4">
        <div>
          <DemoDateRangeSelector className="mb-4" />

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
      </PageContent>
    </PageLayout>
  );
}
