"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { usePreferredShellQueryArgs, useQueryWithStatus } from "@/shared/hooks";
import { Button } from "@/shared/ui/components/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import { getDefaultUsageDashboardData } from "../lib/defaults";
import {
  getUsageLayoutCacheServerSnapshot,
  getUsageLayoutCacheSnapshot,
  subscribeUsageLayoutCache,
  type UsageLayoutCache,
  writeUsageLayoutCache,
} from "../lib/layoutCache";
import type { UsageDashboardData, UsageWorkspaceTemplate } from "../lib/types";
import { UsageDashboard } from "./UsageDashboard";

const PLAN_LIMITS_BY_TIER = {
  free: 0,
  hobby: 100,
  base: 1000,
  pro: -1,
} as const;
const LOADING_CYCLE_VALUE = "__loading_cycle__";
const EMPTY_WORKSPACE_TEMPLATES: UsageWorkspaceTemplate[] = [];

function formatPlanLabel(tier: "free" | "hobby" | "base" | "pro") {
  if (tier === "free") return "Plan required";
  if (tier === "hobby") return "Hobby";
  if (tier === "base") return "Base";
  return "Pro";
}

export function UsagePage() {
  const router = useRouter();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const [selectedCycleKey, setSelectedCycleKey] = React.useState<
    string | undefined
  >(undefined);
  const layoutCache = React.useSyncExternalStore(
    subscribeUsageLayoutCache,
    getUsageLayoutCacheSnapshot,
    getUsageLayoutCacheServerSnapshot
  );
  const lastResolvedUsageRef = React.useRef<UsageDashboardData | null>(null);

  const usageQuery = useQueryWithStatus(api.usage.getUsageDashboard, {
    selectedCycleKey,
  });
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    preferredShellQueryArgs
  );
  const planQuery = useQueryWithStatus(api.plans.getCurrentPlan);

  if (usageQuery.data) {
    lastResolvedUsageRef.current = usageQuery.data;
  }

  const lastResolvedUsage = lastResolvedUsageRef.current;

  React.useEffect(() => {
    if (usageQuery.data) {
      const nextCache: UsageLayoutCache = {
        cycleOptions: usageQuery.data.cycleOptions,
        perWorkspaceLimit: usageQuery.data.summary.perWorkspaceLimit,
        planLabel: usageQuery.data.summary.plan.label,
        planTier: usageQuery.data.summary.plan.tier,
        resetDaysLeft: usageQuery.data.summary.resetDaysLeft,
        resetLabel: usageQuery.data.summary.resetLabel,
        selectedCycleKey: usageQuery.data.selectedCycleKey,
        workspaceTemplates: usageQuery.data.workspaces.map((workspace) => ({
          name: workspace.name,
          workspaceId: workspace.workspaceId,
          trendLabels: workspace.trend.map((point) => point.date),
        })),
        workspacesLimit: usageQuery.data.summary.workspacesLimit,
        workspacesUsed: usageQuery.data.summary.workspacesUsed,
      };

      writeUsageLayoutCache(nextCache);
    }
  }, [usageQuery.data]);

  const usage = usageQuery.data;
  const shellWorkspaceTemplates = React.useMemo<
    UsageWorkspaceTemplate[]
  >(() => {
    const switcherItems = shellStateQuery.data?.switcherItems;
    if (!switcherItems) {
      return EMPTY_WORKSPACE_TEMPLATES;
    }

    const templates: UsageWorkspaceTemplate[] = [];
    for (const item of switcherItems) {
      if (item.kind !== "workspace") {
        continue;
      }

      templates.push({
        name: item.label,
        workspaceId: item.workspaceId,
      });
    }

    return templates;
  }, [shellStateQuery.data?.switcherItems]);
  const cachedWorkspaceTemplates =
    layoutCache?.workspaceTemplates ?? EMPTY_WORKSPACE_TEMPLATES;
  const knownWorkspaceCount =
    lastResolvedUsage?.summary.workspacesUsed ??
    (shellWorkspaceTemplates.length > 0
      ? shellWorkspaceTemplates.length
      : undefined) ??
    planQuery.data?.workspaces.used ??
    layoutCache?.workspacesUsed ??
    0;

  const workspaceTemplates = React.useMemo<UsageWorkspaceTemplate[]>(() => {
    if (lastResolvedUsage?.workspaces.length) {
      return lastResolvedUsage.workspaces.map((workspace) => ({
        name: workspace.name,
        workspaceId: workspace.workspaceId,
        trendLabels: workspace.trend.map((point) => point.date),
      }));
    }

    if (shellWorkspaceTemplates.length > 0) {
      return shellWorkspaceTemplates;
    }

    if (cachedWorkspaceTemplates.length > 0) {
      return cachedWorkspaceTemplates;
    }

    return [];
  }, [cachedWorkspaceTemplates, lastResolvedUsage, shellWorkspaceTemplates]);

  const planTier =
    lastResolvedUsage?.summary.plan.tier ?? planQuery.data?.tier ?? "free";
  const fallbackCycleOptions =
    lastResolvedUsage?.cycleOptions ?? layoutCache?.cycleOptions;
  const data =
    usage ??
    getDefaultUsageDashboardData({
      cycleOptions: fallbackCycleOptions,
      perWorkspaceLimit:
        lastResolvedUsage?.summary.perWorkspaceLimit ??
        layoutCache?.perWorkspaceLimit ??
        PLAN_LIMITS_BY_TIER[planTier],
      planLabel:
        lastResolvedUsage?.summary.plan.label ??
        (planQuery.data
          ? formatPlanLabel(planTier)
          : (layoutCache?.planLabel ?? "--")),
      planTier,
      resetDaysLeft:
        lastResolvedUsage?.summary.resetDaysLeft ??
        layoutCache?.resetDaysLeft ??
        0,
      resetLabel:
        lastResolvedUsage?.summary.resetLabel ?? layoutCache?.resetLabel,
      selectedCycleKey:
        selectedCycleKey ??
        lastResolvedUsage?.selectedCycleKey ??
        layoutCache?.selectedCycleKey ??
        "",
      workspaceTemplates,
      workspacesLimit:
        lastResolvedUsage?.summary.workspacesLimit ??
        planQuery.data?.workspaces.limit ??
        layoutCache?.workspacesLimit ??
        Math.max(workspaceTemplates.length, knownWorkspaceCount, 0),
      workspacesUsed:
        lastResolvedUsage?.summary.workspacesUsed ??
        layoutCache?.workspacesUsed ??
        Math.max(workspaceTemplates.length, knownWorkspaceCount, 0),
    });
  const hasCycleOptions = data.cycleOptions.length > 0;
  const requestedCycleKey =
    selectedCycleKey ??
    usage?.selectedCycleKey ??
    lastResolvedUsage?.selectedCycleKey ??
    layoutCache?.selectedCycleKey ??
    null;
  const selectedValue =
    hasCycleOptions && requestedCycleKey
      ? (data.cycleOptions.find((option) => option.key === requestedCycleKey)
          ?.key ??
        data.cycleOptions[0]?.key ??
        LOADING_CYCLE_VALUE)
      : hasCycleOptions
        ? (data.cycleOptions[0]?.key ?? LOADING_CYCLE_VALUE)
        : LOADING_CYCLE_VALUE;

  return (
    <PageLayout className="flex max-w-none flex-col overflow-hidden border-none">
      <PageHeader
        title="Usage"
        onBack={() => router.back()}
        actions={
          <Select
            value={selectedValue}
            onValueChange={(value) => setSelectedCycleKey(value)}
            disabled={usageQuery.isPending || !hasCycleOptions}
          >
            <SelectTrigger size="xs">
              <SelectValue
                placeholder={usageQuery.isPending ? "Loading cycle" : "Cycle"}
              />
            </SelectTrigger>
            <SelectContent>
              {hasCycleOptions ? (
                data.cycleOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.isCurrent
                      ? `${option.label} (current)`
                      : option.label}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value={LOADING_CYCLE_VALUE} disabled>
                  Loading cycle
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        }
      />
      <PageContent className="scroll-fade-effect-y min-h-0 flex-1 overflow-y-auto p-4">
        {usageQuery.isError ? (
          <div className="border-destructive bg-destructive/10 mb-4 rounded-lg border p-4">
            <p className="text-destructive text-sm font-medium">
              Could not load usage
            </p>
            <p className="text-destructive/80 mt-1 text-sm">
              {usageQuery.error.message || "Please try again."}
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
        ) : null}

        <UsageDashboard
          data={data}
          isLoading={usageQuery.isPending && !usageQuery.isError}
        />
      </PageContent>
    </PageLayout>
  );
}
