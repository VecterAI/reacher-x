import type {
  UsageCycleOption,
  UsageDashboardData,
  UsageWorkspaceTemplate,
} from "./types";

type DefaultUsageDashboardOptions = {
  cycleOptions?: UsageCycleOption[];
  perWorkspaceLimit?: number;
  planLabel?: string;
  planTier?: UsageDashboardData["summary"]["plan"]["tier"];
  resetDaysLeft?: number;
  resetLabel?: string;
  selectedCycleKey?: string;
  workspaceTemplates?: UsageWorkspaceTemplate[];
  workspacesLimit?: number;
  workspacesUsed?: number;
};

const FALLBACK_TREND_LABELS = ["1", "2", "3", "4", "5", "6", "7"];

export function getDefaultUsageDashboardData(
  options: DefaultUsageDashboardOptions = {}
): UsageDashboardData {
  const perWorkspaceLimit = options.perWorkspaceLimit ?? 0;
  const workspaceTemplates = options.workspaceTemplates ?? [];
  const workspaces = workspaceTemplates.map((workspace, index) => ({
    workspaceId:
      workspace.workspaceId ?? workspace.name ?? `workspace-${index}`,
    name: workspace.name,
    used: 0,
    limit: perWorkspaceLimit,
    unlimited: perWorkspaceLimit === -1,
    percentUsed: 0,
    trend: (workspace.trendLabels ?? FALLBACK_TREND_LABELS).map((date) => ({
      date,
      value: 0,
    })),
  }));

  return {
    cycleOptions: options.cycleOptions ?? [],
    selectedCycleKey: options.selectedCycleKey ?? "",
    summary: {
      plan: {
        tier: options.planTier ?? "free",
        label: options.planLabel ?? "Plan required",
      },
      perWorkspaceLimit,
      workspacesUsed: options.workspacesUsed ?? workspaceTemplates.length,
      workspacesLimit: options.workspacesLimit ?? 1,
      resetDaysLeft: options.resetDaysLeft ?? 0,
      resetLabel: options.resetLabel ?? "--",
    },
    workspaces,
    comparison: {
      mode: perWorkspaceLimit === -1 ? "count" : "percent",
      rows: workspaces.map((workspace) => ({
        workspaceId: workspace.workspaceId,
        name: workspace.name,
        value: 0,
        used: 0,
        limit: workspace.unlimited ? null : workspace.limit,
      })),
    },
  };
}
