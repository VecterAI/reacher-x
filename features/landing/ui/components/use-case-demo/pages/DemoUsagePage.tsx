/**
 * DemoUsagePage
 * Faithful replica of the real usage route (app/(webapp)/usage/page.tsx ->
 * features/usage/ui/UsagePage.tsx) running on static data. Reuses the real
 * UsageDashboard (which renders UsageSummaryStrip, WorkspaceUsageCard, and
 * WorkspaceComparisonChart) as-is with a static UsageDashboardData payload;
 * the header cycle selector uses the real Select components with local state.
 */
"use client";

import * as React from "react";
import type { UsageDashboardData } from "@/features/usage/lib/types";
import { UsageDashboard } from "@/features/usage/ui/UsageDashboard";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import { useDemoShell, type DemoWorkspace } from "../demoShellContext";

// ---------------------------------------------------------------------------
// Usage data derived from the active use case's workspaces, so names and
// numbers always match the rest of the demo. Deterministic per workspace.
// ---------------------------------------------------------------------------

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildUsageData(workspaces: DemoWorkspace[]): UsageDashboardData {
  const entries = workspaces.map((workspace) => {
    const hash = hashString(workspace.id);
    const used = 240 + (hash % 620);
    const trend = Array.from({ length: 7 }, (_, day) => ({
      date: `Jul ${9 + day}`,
      value: 4 + ((hash >> (day * 3)) % 34),
    }));
    return { workspace, used, trend };
  });

  return {
    cycleOptions: [
      { key: "2026-07", label: "Jul 2026", isCurrent: true },
      { key: "2026-06", label: "Jun 2026", isCurrent: false },
      { key: "2026-05", label: "May 2026", isCurrent: false },
    ],
    selectedCycleKey: "2026-07",
    summary: {
      plan: { tier: "base", label: "Base" },
      perWorkspaceLimit: 1000,
      workspacesUsed: workspaces.length,
      workspacesLimit: 2,
      resetDaysLeft: 12,
      resetLabel: "Aug 1, 2026",
    },
    workspaces: entries.map(({ workspace, used, trend }) => ({
      workspaceId: workspace.id,
      name: workspace.name,
      used,
      limit: 1000,
      unlimited: false,
      percentUsed: Math.round((used / 1000) * 1000) / 10,
      trend,
    })),
    comparison: {
      mode: "percent",
      rows: entries.map(({ workspace, used }) => ({
        workspaceId: workspace.id,
        name: workspace.name,
        value: Math.round((used / 1000) * 1000) / 10,
        used,
        limit: 1000,
      })),
    },
  };
}

export function DemoUsagePage() {
  const { workspaces } = useDemoShell();
  const [selectedCycleKey, setSelectedCycleKey] = React.useState<
    string | undefined
  >(undefined);

  const data = React.useMemo(() => buildUsageData(workspaces), [workspaces]);
  const selectedValue =
    data.cycleOptions.find((option) => option.key === selectedCycleKey)?.key ??
    data.selectedCycleKey;

  return (
    <PageLayout className="flex h-full min-h-0 w-full max-w-none min-w-0 flex-1 flex-col overflow-hidden border-none">
      <PageHeader
        title="Usage"
        actions={
          <Select
            value={selectedValue}
            onValueChange={(value) => setSelectedCycleKey(value)}
          >
            <SelectTrigger size="xs">
              <SelectValue placeholder="Cycle" />
            </SelectTrigger>
            <SelectContent>
              {data.cycleOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.isCurrent
                    ? `${option.label} (current)`
                    : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <PageContent className="scroll-fade min-h-0 flex-1 overflow-y-auto p-4">
        <UsageDashboard data={data} isLoading={false} />
      </PageContent>
    </PageLayout>
  );
}
