export type UsageCycleOption = {
  key: string;
  label: string;
  isCurrent: boolean;
};

export type UsageSummary = {
  plan: {
    tier: "free" | "hobby" | "base" | "pro";
    label: string;
  };
  perWorkspaceLimit: number;
  workspacesUsed: number;
  workspacesLimit: number;
  resetDaysLeft: number;
  resetLabel: string;
};

export type UsageTrendPoint = {
  date: string;
  value: number;
};

export type UsageWorkspaceRow = {
  workspaceId: string;
  name: string;
  used: number;
  limit: number;
  unlimited: boolean;
  percentUsed: number;
  trend: UsageTrendPoint[];
};

export type UsageComparisonMode = "count" | "percent";

export type UsageComparisonRow = {
  workspaceId: string;
  name: string;
  value: number;
  used: number;
  limit: number | null;
};

export type UsageDashboardData = {
  cycleOptions: UsageCycleOption[];
  selectedCycleKey: string;
  summary: UsageSummary;
  workspaces: UsageWorkspaceRow[];
  comparison: {
    mode: UsageComparisonMode;
    rows: UsageComparisonRow[];
  };
};

export type UsageWorkspaceTemplate = {
  name: string;
  trendLabels?: string[];
};
