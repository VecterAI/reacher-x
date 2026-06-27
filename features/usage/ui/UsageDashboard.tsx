"use client";

import * as React from "react";
import {
  CalendarTodayIcon,
  CreditCardIcon,
  DataUsageIcon,
  FolderIcon,
} from "@/shared/ui/components/icons";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { cn } from "@/shared/lib/utils";
import { UsageSummaryStrip } from "./components/UsageSummaryStrip";
import { WorkspaceUsageCard } from "./components/WorkspaceUsageCard";
import { WorkspaceComparisonChart } from "./components/WorkspaceComparisonChart";
import type { UsageDashboardData } from "../lib/types";

const WORKSPACE_CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;
const SUMMARY_TEXT_CLASS_NAME =
  "text-3xl font-semibold tracking-tight leading-none font-mono tabular-nums";
const SUMMARY_NUMBER_CLASS_NAME =
  "text-3xl font-semibold tracking-tight leading-none font-mono tabular-nums [&_number-flow-react]:inline-block [&_number-flow-react]:leading-none";

function SummaryTextValue({ value }: { value: string }) {
  return <span className={SUMMARY_TEXT_CLASS_NAME}>{value}</span>;
}

function SummaryNumberValue({ value }: { value: number }) {
  return (
    <AnimatedNumber
      value={value}
      animateOnMount
      className={SUMMARY_NUMBER_CLASS_NAME}
      format={{ useGrouping: true }}
    />
  );
}

function SummaryFractionValue({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <span className="inline-flex items-start gap-1 leading-none">
      <SummaryNumberValue value={current} />
      <span
        className={`text-muted-foreground ${SUMMARY_TEXT_CLASS_NAME}`}
        aria-hidden="true"
      >
        /
      </span>
      <SummaryNumberValue value={total} />
    </span>
  );
}

export interface UsageDashboardProps {
  data: UsageDashboardData;
  isLoading?: boolean;
}

export function UsageDashboard({
  data,
  isLoading = false,
}: UsageDashboardProps) {
  const hasOddWorkspaceCount = data.workspaces.length % 2 === 1;

  const summaryMetrics = React.useMemo(
    () => [
      {
        id: "plan",
        label: "Plan",
        icon: CreditCardIcon,
        value: <SummaryTextValue value={data.summary.plan.label} />,
      },
      {
        id: "limit",
        label: "Per-workspace limit",
        icon: DataUsageIcon,
        value:
          data.summary.perWorkspaceLimit === -1 ? (
            <SummaryTextValue value="Unlimited" />
          ) : (
            <SummaryNumberValue value={data.summary.perWorkspaceLimit} />
          ),
      },
      {
        id: "workspaces",
        label: "Workspaces",
        icon: FolderIcon,
        value: (
          <SummaryFractionValue
            current={data.summary.workspacesUsed}
            total={data.summary.workspacesLimit}
          />
        ),
      },
      {
        id: "cycle-end",
        label: "Days until reset",
        icon: CalendarTodayIcon,
        value: <SummaryNumberValue value={data.summary.resetDaysLeft} />,
        valueTitle: `Resets on ${data.summary.resetLabel}`,
      },
    ],
    [data.summary]
  );

  if (!isLoading && data.workspaces.length === 0) {
    return (
      <>
        <UsageSummaryStrip metrics={summaryMetrics} />
        <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No workspaces yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Create a workspace to start tracking usage.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <UsageSummaryStrip metrics={summaryMetrics} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.workspaces.map((workspace, index) => (
          <WorkspaceUsageCard
            key={workspace.name}
            accentColor={
              WORKSPACE_CHART_COLORS[index % WORKSPACE_CHART_COLORS.length]!
            }
            className={cn(
              hasOddWorkspaceCount &&
                index === data.workspaces.length - 1 &&
                "lg:col-span-2"
            )}
            limit={workspace.limit}
            name={workspace.name}
            trend={workspace.trend}
            unlimited={workspace.unlimited}
            used={workspace.used}
          />
        ))}
      </div>

      {data.comparison.rows.length > 1 ? (
        <div className="mt-4">
          <WorkspaceComparisonChart
            accentColors={[...WORKSPACE_CHART_COLORS]}
            mode={data.comparison.mode}
            rows={data.comparison.rows}
          />
        </div>
      ) : null}
    </>
  );
}
