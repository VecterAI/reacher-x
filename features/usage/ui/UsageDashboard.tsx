"use client";

import * as React from "react";
import {
  CalendarTodayIcon,
  CreditCardIcon,
  DataUsageIcon,
  FolderIcon,
} from "@/shared/ui/components/icons";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
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
  "text-3xl font-semibold tracking-tight leading-none font-mono tabular-nums [&_number-flow-react]:inline-block [&_number-flow-react]:leading-none [&_number-flow-react]:[--number-flow-mask-height:0em]";

export interface UsageDashboardProps {
  data: UsageDashboardData;
  isLoading?: boolean;
}

export function UsageDashboard({
  data,
  isLoading = false,
}: UsageDashboardProps) {
  const renderTextValue = React.useCallback(
    (value: string) => <span className={SUMMARY_TEXT_CLASS_NAME}>{value}</span>,
    []
  );

  const renderNumberValue = React.useCallback(
    (value: number) => (
      <AnimatedNumber
        value={value}
        animateOnMount
        className={SUMMARY_NUMBER_CLASS_NAME}
        format={{ useGrouping: true }}
      />
    ),
    []
  );

  const renderFractionValue = React.useCallback(
    (current: number, total: number) => (
      <span className="inline-flex items-start gap-1 leading-none">
        {renderNumberValue(current)}
        <span
          className={`text-muted-foreground ${SUMMARY_TEXT_CLASS_NAME}`}
          aria-hidden="true"
        >
          /
        </span>
        {renderNumberValue(total)}
      </span>
    ),
    [renderNumberValue]
  );

  const renderDaysLeftValue = React.useCallback(
    (daysLeft: number) => renderNumberValue(daysLeft),
    [renderNumberValue]
  );

  const summaryMetrics = React.useMemo(
    () => [
      {
        id: "plan",
        label: "Plan",
        icon: CreditCardIcon,
        value: renderTextValue(data.summary.plan.label),
      },
      {
        id: "limit",
        label: "Per-workspace limit",
        icon: DataUsageIcon,
        value:
          data.summary.perWorkspaceLimit === -1
            ? renderTextValue("Unlimited")
            : renderNumberValue(data.summary.perWorkspaceLimit),
      },
      {
        id: "workspaces",
        label: "Workspaces",
        icon: FolderIcon,
        value: renderFractionValue(
          data.summary.workspacesUsed,
          data.summary.workspacesLimit
        ),
      },
      {
        id: "cycle-end",
        label: "Days until reset",
        icon: CalendarTodayIcon,
        value: renderDaysLeftValue(data.summary.resetDaysLeft),
        valueTitle: `Resets on ${data.summary.resetLabel}`,
      },
    ],
    [data.summary, renderDaysLeftValue, renderFractionValue, renderTextValue]
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
            key={workspace.workspaceId}
            accentColor={
              WORKSPACE_CHART_COLORS[index % WORKSPACE_CHART_COLORS.length]!
            }
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
