"use client";

import * as React from "react";
import { useAction, useConvex } from "convex/react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { DATE_RANGE_PRESETS } from "@/features/analytics/lib/dateRange";
import {
  DateRangeSelector,
  StatsOverview,
  type StatMetricData,
} from "@/features/analytics/ui/components";
import { getDefaultAgentOpsData } from "../lib/defaults";
import {
  usePreferredShellQueryArgs,
  useQueryWithStatus,
  useReportingQueryNow,
  useWorkspaceReportingTimeZone,
} from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";
import { useDebouncedValue } from "@/shared/lib/utils/useDebouncedValue";
import { Button } from "@/shared/ui/components/Button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/components/Drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/Table";
import { TablePagination } from "@/shared/ui/components/TablePagination";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { AgentOpsPanel } from "./AgentOpsPanel";
import type {
  AgentOpsActivityItem,
  AgentOpsDashboardData,
  AgentOpsMemoryInventoryPageData,
  AgentOpsMemorySort,
  DiscoveryInventoryPageData,
  DiscoveryInventoryRow,
  MemoryInventoryRow,
} from "./types";
import {
  AgentOpsAreaChart,
  AgentOpsBarChart,
  AgentOpsLineChart,
  StatusBadge,
  formatRelativeDate,
  usePagedRows,
} from "./shared";

const AGENT_OPS_PRIMARY_CHART_COLOR = "hsl(var(--chart-1))";

async function loadRemainingExportPages<T>(args: {
  nextPage: number;
  totalPages: number;
  loadPage: (page: number) => Promise<T[]>;
}): Promise<T[]> {
  if (args.nextPage >= args.totalPages) return [];
  const current = await args.loadPage(args.nextPage);
  const remaining = await loadRemainingExportPages({
    ...args,
    nextPage: args.nextPage + 1,
  });
  return [...current, ...remaining];
}

// ============================================================================
// Main Dashboard
// ============================================================================

export function AgentOpsDashboard() {
  const router = useRouter();
  const convex = useConvex();
  const isMobile = useIsMobile();
  const [querySearch, setQuerySearch] = React.useState("");
  const [queryStatus, setQueryStatus] = React.useState<
    | "all"
    | "generated"
    | "activated"
    | "rejected_exact_duplicate"
    | "rejected_semantic_duplicate"
    | "rejected_low_novelty"
    | "retired"
  >("all");
  const [memorySearch, setMemorySearch] = React.useState("");
  const [memoryCategory, setMemoryCategory] = React.useState("all");
  const [activitySearch, setActivitySearch] = React.useState("");
  const [activityKind, setActivityKind] = React.useState("all");
  const [querySort, setQuerySort] = React.useState<
    "updated_desc" | "novelty_desc" | "performance_desc"
  >("updated_desc");
  const [memorySort, setMemorySort] =
    React.useState<AgentOpsMemorySort>("impact_desc");
  const [memoryPage, setMemoryPage] = React.useState(0);
  const [memoryPageCursors, setMemoryPageCursors] = React.useState<
    Record<number, string | null>
  >({ 0: null });
  const [isExportingQueries, setIsExportingQueries] = React.useState(false);
  const [isExportingMemories, setIsExportingMemories] = React.useState(false);
  const [queryPageSize, setQueryPageSize] = React.useState(10);
  const [queryPage, setQueryPage] = React.useState(0);
  const [memoryPageSize, setMemoryPageSize] = React.useState(10);
  const [activityPageSize, setActivityPageSize] = React.useState(10);
  const [dashboardRefreshKey, setDashboardRefreshKey] = React.useState(0);
  const { queryNowMs, refreshQueryNowMs } = useReportingQueryNow();
  const preferredShellQueryArgs = usePreferredShellQueryArgs();

  const [params, setParams] = useQueryStates({
    range: parseAsStringLiteral(DATE_RANGE_PRESETS).withDefault("7d"),
    from: parseAsString,
    to: parseAsString,
    tab: parseAsStringLiteral([
      "overview",
      "discovery",
      "quality",
      "memory",
      "activity",
    ] as const).withDefault("overview"),
    panel: parseAsStringLiteral([
      "query",
      "monitor",
      "memory",
      "event",
      "run",
      "suggestion",
    ] as const),
    queryId: parseAsString,
    monitorId: parseAsString,
    memoryId: parseAsString,
    eventId: parseAsString,
    runId: parseAsString,
    suggestionId: parseAsString,
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

  const loadDashboard = useAction(api.agentOps.getAgentOpsDashboardSnapshot);
  const loadDiscoveryPage = useAction(
    api.agentOps.getAgentOpsDiscoveryInventoryPageSnapshot
  );
  const loadMemoryPage = useAction(
    api.agentOps.getAgentOpsMemoryInventoryPageSnapshot
  );
  const reportingStatusQuery = useQueryWithStatus(
    api.workspaceReporting.getWorkspaceReportingStatus,
    workspaceId ? { workspaceId } : "skip"
  );
  const reportingReady = reportingStatusQuery.data?.ready === true;
  const realtimeDashboardQuery = useQueryWithStatus(
    api.agentOps.getAgentOpsDashboard,
    workspaceId && reportingReady
      ? {
          workspaceId,
          range: params.range,
          tab: params.tab,
          timeZone: reportingTimeZone,
          ...(params.from ? { fromDate: params.from } : {}),
          ...(params.to ? { toDate: params.to } : {}),
          nowMs: queryNowMs,
        }
      : "skip"
  );
  const [dashboardSnapshot, setDashboardSnapshot] =
    React.useState<AgentOpsDashboardData>();
  const [dashboardSnapshotError, setDashboardSnapshotError] =
    React.useState<Error>();
  const [isDashboardSnapshotLoading, setIsDashboardSnapshotLoading] =
    React.useState(false);
  const [discoveryPageData, setDiscoveryPageData] =
    React.useState<DiscoveryInventoryPageData>();
  const [discoveryPageError, setDiscoveryPageError] = React.useState<Error>();
  const [isDiscoveryPageLoading, setIsDiscoveryPageLoading] =
    React.useState(false);
  const debouncedQuerySearch = useDebouncedValue(querySearch, 300);

  React.useEffect(() => {
    refreshQueryNowMs();
  }, [params.from, params.range, params.to, refreshQueryNowMs]);

  React.useEffect(() => {
    let cancelled = false;
    if (!workspaceId || reportingStatusQuery.data === undefined) return;
    if (reportingReady) {
      setDashboardSnapshot(undefined);
      setDashboardSnapshotError(undefined);
      setIsDashboardSnapshotLoading(false);
      return;
    }
    setIsDashboardSnapshotLoading(true);
    setDashboardSnapshot(undefined);
    setDashboardSnapshotError(undefined);
    void loadDashboard({
      workspaceId,
      range: params.range,
      tab: params.tab,
      timeZone: reportingTimeZone,
      ...(params.from ? { fromDate: params.from } : {}),
      ...(params.to ? { toDate: params.to } : {}),
    })
      .then((result) => {
        if (!cancelled) setDashboardSnapshot(result as AgentOpsDashboardData);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDashboardSnapshotError(
            error instanceof Error ? error : new Error("Please try again.")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsDashboardSnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    loadDashboard,
    dashboardRefreshKey,
    params.from,
    params.range,
    params.tab,
    params.to,
    reportingReady,
    reportingStatusQuery.data,
    reportingTimeZone,
    workspaceId,
  ]);

  const dashboardData = reportingReady
    ? (realtimeDashboardQuery.data as AgentOpsDashboardData | undefined)
    : dashboardSnapshot;
  const dashboardError =
    reportingStatusQuery.error ??
    (reportingReady ? realtimeDashboardQuery.error : dashboardSnapshotError) ??
    discoveryPageError;

  React.useEffect(() => {
    let cancelled = false;
    if (!workspaceId || params.tab !== "discovery") return;
    setIsDiscoveryPageLoading(true);
    setDiscoveryPageData(undefined);
    setDiscoveryPageError(undefined);
    void loadDiscoveryPage({
      workspaceId,
      range: params.range,
      timeZone: reportingTimeZone,
      ...(params.from ? { fromDate: params.from } : {}),
      ...(params.to ? { toDate: params.to } : {}),
      ...(debouncedQuerySearch.trim()
        ? { search: debouncedQuerySearch.trim() }
        : {}),
      ...(queryStatus !== "all" ? { status: queryStatus } : {}),
      sort: querySort,
      page: queryPage,
      pageSize: queryPageSize,
    })
      .then((result) => {
        if (!cancelled)
          setDiscoveryPageData(result as DiscoveryInventoryPageData);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDiscoveryPageError(
            error instanceof Error ? error : new Error("Please try again.")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsDiscoveryPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    debouncedQuerySearch,
    loadDiscoveryPage,
    params.from,
    params.range,
    params.tab,
    params.to,
    queryPage,
    queryPageSize,
    querySort,
    queryStatus,
    reportingTimeZone,
    workspaceId,
  ]);

  const [memoryInventoryData, setMemoryInventoryData] =
    React.useState<AgentOpsMemoryInventoryPageData>();
  const [memoryInventoryError, setMemoryInventoryError] =
    React.useState<Error>();
  const [isMemorySnapshotLoading, setIsMemorySnapshotLoading] =
    React.useState(false);
  const debouncedMemorySearch = useDebouncedValue(memorySearch, 300);
  const memoryCursor = memoryPageCursors[memoryPage] ?? null;
  const memoryRangeScopeKey = [
    workspaceId ?? "",
    params.range,
    params.from ?? "",
    params.to ?? "",
    reportingTimeZone ?? "",
  ].join(":");

  React.useEffect(() => {
    setMemoryPage(0);
    setMemoryPageCursors({ 0: null });
  }, [memoryRangeScopeKey]);

  React.useEffect(() => {
    let cancelled = false;
    if (!workspaceId || params.tab !== "memory") return;
    setIsMemorySnapshotLoading(true);
    setMemoryInventoryData(undefined);
    setMemoryInventoryError(undefined);
    void loadMemoryPage({
      workspaceId,
      range: params.range,
      timeZone: reportingTimeZone,
      ...(params.from ? { fromDate: params.from } : {}),
      ...(params.to ? { toDate: params.to } : {}),
      ...(debouncedMemorySearch.trim()
        ? { search: debouncedMemorySearch.trim() }
        : {}),
      ...(memoryCategory !== "all" ? { category: memoryCategory } : {}),
      sort: memorySort,
      page: memoryPage,
      pageSize: memoryPageSize,
      ...(memoryCursor ? { cursor: memoryCursor } : {}),
    })
      .then((result) => {
        if (!cancelled) {
          const pageData = result as AgentOpsMemoryInventoryPageData;
          setMemoryInventoryData(pageData);
          setMemoryPageCursors((current) => ({
            ...current,
            ...(pageData.continueCursor
              ? { [memoryPage + 1]: pageData.continueCursor }
              : {}),
          }));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMemoryInventoryError(
            error instanceof Error ? error : new Error("Please try again.")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsMemorySnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    debouncedMemorySearch,
    loadMemoryPage,
    memoryCategory,
    memoryCursor,
    memoryPage,
    memoryPageSize,
    memorySort,
    params.from,
    params.range,
    params.tab,
    params.to,
    reportingTimeZone,
    workspaceId,
  ]);

  // Always have data — zero defaults until real data loads (mirrors Analytics)
  const defaultData = React.useMemo(
    () => getDefaultAgentOpsData(params.range),
    [params.range]
  );
  const data = dashboardData ?? defaultData;
  const isDashboardLoading =
    workspaceStatusQuery.isPending ||
    reportingStatusQuery.isPending ||
    (reportingReady
      ? realtimeDashboardQuery.isPending
      : isDashboardSnapshotLoading);
  const isMemoryLoading = isDashboardLoading || isMemorySnapshotLoading;
  const resolvedMemoryInventoryData = memoryInventoryData ?? {
    rows: [],
    page: 0,
    totalCount: 0,
    totalPages: 1,
    availableCategories: [],
    continueCursor: null,
    isDone: true,
    scanned: 0,
  };
  const resetMemoryPagination = () => {
    setMemoryPage(0);
    setMemoryPageCursors({ 0: null });
  };
  const updateMemorySearch = (value: string) => {
    resetMemoryPagination();
    setMemorySearch(value);
  };
  const updateMemoryCategory = (value: string) => {
    resetMemoryPagination();
    setMemoryCategory(value);
  };
  const updateMemorySort = (value: AgentOpsMemorySort) => {
    resetMemoryPagination();
    setMemorySort(value);
  };
  const updateMemoryPageSize = (value: number) => {
    resetMemoryPagination();
    setMemoryPageSize(value);
  };
  const updateMemoryPage = (page: number) => {
    if (page === 0 || memoryPageCursors[page] !== undefined) {
      setMemoryPage(page);
    }
  };

  const hasPanel = Boolean(params.panel);

  const openPanel = (
    panel: NonNullable<typeof params.panel>,
    ids: Partial<typeof params>
  ) => {
    void setParams({
      panel,
      queryId: ids.queryId ?? null,
      monitorId: ids.monitorId ?? null,
      memoryId: ids.memoryId ?? null,
      eventId: ids.eventId ?? null,
      runId: ids.runId ?? null,
      suggestionId: ids.suggestionId ?? null,
    });
  };

  const closePanel = React.useCallback(() => {
    void setParams({
      panel: null,
      queryId: null,
      monitorId: null,
      memoryId: null,
      eventId: null,
      runId: null,
      suggestionId: null,
    });
  }, [setParams]);

  // ── Stats rows (4 + 4) ──────────────────────────────────────────────

  const metricsRow1: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "learning-loop",
        "Learning loop",
        data.overview.metrics.healthScore,
        "composite"
      ),
      metricCard(
        "query-win-rate",
        "Query win rate",
        data.overview.metrics.queryWinRate,
        "activated after review",
        "default",
        "percent"
      ),
      metricCard(
        "qualification-precision",
        "Qualification precision",
        data.overview.metrics.qualificationPrecision,
        "qualified prospects",
        "default",
        "percent"
      ),
      metricCard(
        "outreach-effectiveness",
        "Outreach effectiveness",
        data.overview.metrics.outreachEffectiveness,
        "reply rate",
        "default",
        "percent"
      ),
    ],
    [data]
  );

  const metricsRow2: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "memories-learned",
        "Memories saved",
        data.overview.metrics.memoriesLearned,
        "this period"
      ),
      metricCard(
        "average-memory-impact",
        "Avg assigned impact",
        data.overview.metrics.averageMemoryImpact,
        "saved memories"
      ),
      metricCard(
        "queries-activated",
        "Queries activated",
        data.overview.metrics.queriesActivated,
        "this period"
      ),
      metricCard(
        "run-reliability",
        "Run reliability",
        data.overview.metrics.runReliability,
        "successful evaluator runs",
        "default",
        "percent"
      ),
    ],
    [data]
  );

  // ── Filtered / sorted lists ──────────────────────────────────────────

  const filteredQueries = discoveryPageData?.rows ?? [];

  const filteredMemories = React.useMemo(() => {
    return resolvedMemoryInventoryData.rows;
  }, [resolvedMemoryInventoryData.rows]);

  const filteredActivity = React.useMemo(() => {
    return data.activity.feed.filter((row) => {
      const matchesKind = activityKind === "all" || row.kind === activityKind;
      const needle = activitySearch.trim().toLowerCase();
      const matchesSearch =
        needle.length === 0 ||
        row.title.toLowerCase().includes(needle) ||
        row.description.toLowerCase().includes(needle);
      return matchesKind && matchesSearch;
    });
  }, [data, activityKind, activitySearch]);

  const activityPages = usePagedRows(filteredActivity, activityPageSize);

  const handleQueryExport = React.useCallback(async () => {
    if (!workspaceId || isExportingQueries) return;
    setIsExportingQueries(true);
    try {
      const exportPageSize = 500;
      const requestPage = async (page: number) =>
        (await convex.action(
          api.agentOps.getAgentOpsDiscoveryInventoryPageSnapshot,
          {
            workspaceId,
            range: params.range,
            timeZone: reportingTimeZone,
            ...(params.from ? { fromDate: params.from } : {}),
            ...(params.to ? { toDate: params.to } : {}),
            ...(debouncedQuerySearch.trim()
              ? { search: debouncedQuerySearch.trim() }
              : {}),
            ...(queryStatus !== "all" ? { status: queryStatus } : {}),
            sort: querySort,
            page,
            pageSize: exportPageSize,
          }
        )) as DiscoveryInventoryPageData;
      const firstPage = await requestPage(0);
      const rows = [
        ...firstPage.rows,
        ...(await loadRemainingExportPages({
          nextPage: 1,
          totalPages: firstPage.totalPages,
          loadPage: async (page) => (await requestPage(page)).rows,
        })),
      ];
      downloadCsv(
        "agent-ops-discovery.csv",
        [
          "Query",
          "Canonical value",
          "Status",
          "Type",
          "Source theme",
          "Novelty score",
          "Performance score",
          "Prospects found",
          "Qualified",
          "Converted",
          "Reply rate",
          "Created at",
          "Reviewed at",
          "Updated at",
        ],
        rows.map((row) => [
          row.rawValue,
          row.canonicalValue,
          row.statusLabel,
          row.type,
          row.sourceTheme ?? "",
          row.noveltyScore ?? "",
          row.performanceScore ?? "",
          row.prospectsFound,
          row.qualifiedCount,
          row.convertedCount,
          row.replyRate,
          new Date(row.createdAt).toISOString(),
          row.reviewedAt ? new Date(row.reviewedAt).toISOString() : "",
          new Date(row.updatedAt).toISOString(),
        ])
      );
    } catch (error) {
      console.error("[AgentOpsDashboard] Failed to export queries", error);
    } finally {
      setIsExportingQueries(false);
    }
  }, [
    convex,
    debouncedQuerySearch,
    isExportingQueries,
    params.from,
    params.range,
    params.to,
    querySort,
    queryStatus,
    reportingTimeZone,
    workspaceId,
  ]);

  const handleMemoryExport = React.useCallback(async () => {
    if (!workspaceId || isExportingMemories) {
      return;
    }

    setIsExportingMemories(true);
    try {
      const exportPageSize = 500;
      const rows: MemoryInventoryRow[] = [];
      let cursor: string | undefined;
      let page = 0;

      while (true) {
        const pageData = (await convex.action(
          api.agentOps.getAgentOpsMemoryInventoryPageSnapshot,
          {
            workspaceId,
            range: params.range,
            timeZone: reportingTimeZone,
            ...(params.from ? { fromDate: params.from } : {}),
            ...(params.to ? { toDate: params.to } : {}),
            ...(memorySearch.trim().length > 0 ? { search: memorySearch } : {}),
            ...(memoryCategory !== "all" ? { category: memoryCategory } : {}),
            sort: memorySort,
            page,
            pageSize: exportPageSize,
            exportMode: true,
            ...(cursor ? { cursor } : {}),
          }
        )) as AgentOpsMemoryInventoryPageData;
        rows.push(...pageData.rows);
        if (pageData.isDone) break;
        if (!pageData.continueCursor) {
          throw new Error("Memory export stopped before reaching the end.");
        }
        cursor = pageData.continueCursor;
        page += 1;
      }

      downloadCsv(
        "agent-ops-memories.csv",
        [
          "Memory ID",
          "Title",
          "Summary",
          "Source",
          "Category",
          "Impact score",
          "Confidence",
          "Related queries",
          "Evidence count",
          "Created at",
        ],
        rows.map((row) => [
          row.memoryId,
          row.title,
          row.summary,
          row.source,
          row.category,
          row.impactScore,
          row.confidence,
          row.relatedQueries,
          row.evidenceCount,
          new Date(row.createdAt).toISOString(),
        ])
      );
    } finally {
      setIsExportingMemories(false);
    }
  }, [
    convex,
    isExportingMemories,
    memoryCategory,
    memorySearch,
    memorySort,
    params.from,
    params.range,
    params.to,
    reportingTimeZone,
    workspaceId,
  ]);

  // ── Per-tab StatsOverview metrics ────────────────────────────────────

  const discoveryMetrics: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "disc-keywords",
        "Keywords created",
        data.discovery.stats.keywordsCreated,
        "this period"
      ),
      metricCard(
        "disc-generated",
        "Queries generated",
        data.discovery.stats.queriesGenerated,
        "this period"
      ),
      metricCard(
        "disc-query-win-rate",
        "Query win rate",
        data.discovery.stats.queryWinRate,
        "activated after review",
        "default",
        "percent"
      ),
      metricCard(
        "disc-duplicate-rate",
        "Duplicate rejection rate",
        data.discovery.stats.duplicateRejectionRate,
        "of reviewed queries",
        "default",
        "percent"
      ),
    ],
    [data]
  );

  const qualityMetrics: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "qual-precision",
        "Qualification precision",
        data.quality.summary.qualificationPrecision,
        "of evaluated",
        "default",
        "percent"
      ),
      metricCard(
        "qual-enrichment",
        "Enrichment usefulness",
        data.quality.summary.enrichmentUsefulness,
        "avg score"
      ),
      metricCard(
        "qual-outreach",
        "Outreach effectiveness",
        data.quality.summary.outreachEffectiveness,
        "reply rate",
        "default",
        "percent"
      ),
      metricCard(
        "qual-reliability",
        "Run reliability",
        data.quality.summary.runReliability,
        "successful evaluator runs",
        "default",
        "percent"
      ),
    ],
    [data]
  );

  const memoryMetrics: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "mem-learned",
        "Memories saved",
        data.memory.summary.memoriesLearned,
        "this period"
      ),
      metricCard(
        "mem-high-impact",
        "High-scored memories",
        data.memory.summary.highImpactMemories,
        "assigned impact >= 80"
      ),
      metricCard(
        "mem-average-impact",
        "Average assigned impact",
        data.memory.summary.averageImpact,
        "saved memories"
      ),
      metricCard(
        "mem-average-confidence",
        "Average assigned confidence",
        data.memory.summary.averageConfidence,
        "saved memories",
        "default",
        "percent"
      ),
    ],
    [data]
  );

  const activityMetrics: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "act-events-received",
        "Events received",
        data.activity.counts.eventsReceived,
        "this period"
      ),
      metricCard(
        "act-runs-started",
        "Runs started",
        data.activity.counts.runsStarted,
        "this period"
      ),
      metricCard(
        "act-failed-events",
        "Failed events",
        data.activity.counts.failedEvents,
        "errors",
        "destructive"
      ),
      metricCard(
        "act-failed-runs",
        "Failed runs",
        data.activity.counts.failedRuns,
        "errors",
        "destructive"
      ),
    ],
    [data]
  );

  // ── Layout ───────────────────────────────────────────────────────────

  const content = (
    <div className="space-y-4">
      {dashboardError ||
      workspaceStatusQuery.isError ||
      memoryInventoryError ? (
        <div className="border-destructive bg-destructive/10 rounded-lg border p-4">
          <p className="text-destructive text-sm font-medium">
            Could not load Agent observability
          </p>
          <p className="text-destructive/80 mt-1 text-sm">
            {dashboardError?.message ||
              workspaceStatusQuery.error?.message ||
              memoryInventoryError?.message ||
              "Please try again."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              refreshQueryNowMs();
              setDashboardRefreshKey((value) => value + 1);
              router.refresh();
            }}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <DateRangeSelector />

      {/* ── Overview ─────────────────────────────────────────── */}
      {params.tab === "overview" && (
        <>
          <StatsOverview key={`row1-${params.tab}`} metrics={metricsRow1} />
          <StatsOverview key={`row2-${params.tab}`} metrics={metricsRow2} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AgentOpsLineChartWrapper data={data.overview.qualityTrend} />
            <AgentOpsImprovementChartWrapper
              data={data.overview.selfImprovementTrend}
            />
          </div>
        </>
      )}

      {/* ── Discovery ────────────────────────────────────────── */}
      {params.tab === "discovery" && (
        <div className="space-y-4">
          <StatsOverview
            key={`discovery-${params.tab}`}
            metrics={discoveryMetrics}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AgentOpsDiscoveryGrowthWrapper
              data={data.discovery.growthSeries}
            />
            <AgentOpsDiscoveryEfficiencyWrapper
              data={data.discovery.efficiencySeries}
            />
          </div>
          <InventoryCard
            heading="Query activity"
            searchValue={querySearch}
            onSearchChange={(value) => {
              setQueryPage(0);
              setQuerySearch(value);
            }}
            filterValue={queryStatus}
            onFilterChange={(value) => {
              setQueryPage(0);
              setQueryStatus(value as typeof queryStatus);
            }}
            filterOptions={[
              ["all", "All statuses"],
              ["activated", "Activated"],
              ["generated", "Generated"],
              ["rejected_exact_duplicate", "Exact dupes"],
              ["rejected_semantic_duplicate", "Semantic dupes"],
              ["rejected_low_novelty", "Low novelty"],
              ["retired", "Retired"],
            ]}
            sortValue={querySort}
            onSortChange={(value) => {
              setQueryPage(0);
              setQuerySort(
                value as "updated_desc" | "novelty_desc" | "performance_desc"
              );
            }}
            sortOptions={[
              ["updated_desc", "Most recent"],
              ["novelty_desc", "Highest novelty"],
              ["performance_desc", "Best performance"],
            ]}
            onExport={() => void handleQueryExport()}
            exportDisabled={isExportingQueries}
          >
            {isDashboardLoading || isDiscoveryPageLoading ? (
              <>
                <DiscoveryTableSkeleton rowCount={queryPageSize} />
                <TablePagination
                  page={0}
                  totalPages={1}
                  pageSize={queryPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={setQueryPage}
                  onPageSizeChange={(nextPageSize) => {
                    setQueryPage(0);
                    setQueryPageSize(nextPageSize);
                  }}
                  size="xs"
                  disabled
                />
              </>
            ) : filteredQueries.length === 0 ? (
              <EmptyState
                title="No discovery records yet"
                description="When the agent proposes and reviews discovery queries during the selected period, they will appear here."
              />
            ) : (
              <>
                <DiscoveryTable
                  rows={filteredQueries}
                  onOpenQuery={(queryId) => openPanel("query", { queryId })}
                />
                <TablePagination
                  page={discoveryPageData?.page ?? 0}
                  totalPages={discoveryPageData?.totalPages ?? 1}
                  pageSize={queryPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={setQueryPage}
                  onPageSizeChange={(nextPageSize) => {
                    setQueryPage(0);
                    setQueryPageSize(nextPageSize);
                  }}
                  size="xs"
                />
              </>
            )}
          </InventoryCard>
        </div>
      )}

      {/* ── Quality ──────────────────────────────────────────── */}
      {params.tab === "quality" && (
        <div className="space-y-4">
          <StatsOverview
            key={`quality-${params.tab}`}
            metrics={qualityMetrics}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AgentOpsLineChart
              title="Qualification precision"
              config={{
                precision: {
                  label: "Precision",
                  color: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
              }}
              data={data.quality.qualificationTrend}
              lines={[
                {
                  dataKey: "precision",
                  stroke: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
              ]}
            />
            <AgentOpsLineChart
              title="Outreach effectiveness"
              config={{
                effectiveness: {
                  label: "Effectiveness",
                  color: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
              }}
              data={data.quality.outreachTrend}
              lines={[
                {
                  dataKey: "effectiveness",
                  stroke: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
              ]}
            />
            <AgentOpsLineChart
              title="Enrichment usefulness"
              config={{
                usefulness: {
                  label: "Usefulness",
                  color: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
              }}
              data={data.quality.enrichmentTrend}
              lines={[
                {
                  dataKey: "usefulness",
                  stroke: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
              ]}
            />
            <AgentOpsLineChart
              title="Run reliability"
              config={{
                reliability: {
                  label: "Reliability",
                  color: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
              }}
              data={data.quality.reliabilityTrend}
              lines={[
                {
                  dataKey: "reliability",
                  stroke: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* ── Memory ───────────────────────────────────────────── */}
      {params.tab === "memory" && (
        <div className="space-y-4">
          <StatsOverview key={`memory-${params.tab}`} metrics={memoryMetrics} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AgentOpsMemoryChartWrapper data={data.memory.impactTrend} />
            <AgentOpsBarChart
              title="Memory saves by assigned score"
              config={{
                memoryWrites: {
                  label: "Memories saved",
                  color: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
                highImpactMemories: {
                  label: "High-scored",
                  color: "hsl(var(--chart-3))",
                },
              }}
              data={data.memory.impactTrend}
              bars={[
                {
                  dataKey: "memoryWrites",
                  fill: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
                {
                  dataKey: "highImpactMemories",
                  fill: "hsl(var(--chart-3))",
                },
              ]}
            />
          </div>
          <InventoryCard
            heading="Memory activity"
            searchValue={memorySearch}
            onSearchChange={updateMemorySearch}
            filterValue={memoryCategory}
            onFilterChange={updateMemoryCategory}
            filterOptions={[
              ["all", "All categories"],
              ...resolvedMemoryInventoryData.availableCategories.map(
                (value) => [value, value] as const
              ),
            ]}
            sortValue={memorySort}
            onSortChange={(value) =>
              updateMemorySort(value as AgentOpsMemorySort)
            }
            sortOptions={[
              ["impact_desc", "Highest impact"],
              ["confidence_desc", "Highest confidence"],
              ["recent_desc", "Most recent"],
            ]}
            onExport={() => void handleMemoryExport()}
            exportLabel={isExportingMemories ? "Exporting..." : "Export CSV"}
            exportDisabled={isExportingMemories}
          >
            {isMemoryLoading ? (
              <>
                <MemoryTableSkeleton rowCount={memoryPageSize} />
                <TablePagination
                  page={0}
                  totalPages={1}
                  pageSize={memoryPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={updateMemoryPage}
                  onPageSizeChange={updateMemoryPageSize}
                  size="xs"
                  disabled
                />
              </>
            ) : filteredMemories.length === 0 ? (
              <>
                <EmptyState
                  title={
                    resolvedMemoryInventoryData.isDone
                      ? "No memories yet"
                      : "No matching memories on this page"
                  }
                  description={
                    resolvedMemoryInventoryData.isDone
                      ? "Once the system captures reusable lessons in memory, they will show up here."
                      : "Continue to the next page to search the remaining memories."
                  }
                />
                {!resolvedMemoryInventoryData.isDone || memoryPage > 0 ? (
                  <TablePagination
                    page={memoryPage}
                    totalPages={
                      memoryPage + (resolvedMemoryInventoryData.isDone ? 1 : 2)
                    }
                    pageSize={memoryPageSize}
                    pageSizeOptions={[5, 10, 20]}
                    onPageChange={updateMemoryPage}
                    onPageSizeChange={updateMemoryPageSize}
                    size="xs"
                  />
                ) : null}
              </>
            ) : (
              <>
                <MemoryTable
                  rows={filteredMemories}
                  onOpen={(memoryId) => openPanel("memory", { memoryId })}
                />
                <TablePagination
                  page={resolvedMemoryInventoryData.page}
                  totalPages={
                    resolvedMemoryInventoryData.page +
                    (resolvedMemoryInventoryData.isDone ? 1 : 2)
                  }
                  pageSize={memoryPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={updateMemoryPage}
                  onPageSizeChange={updateMemoryPageSize}
                  size="xs"
                />
              </>
            )}
          </InventoryCard>
        </div>
      )}

      {/* ── Activity ─────────────────────────────────────────── */}
      {params.tab === "activity" && (
        <div className="space-y-4">
          <StatsOverview
            key={`activity-${params.tab}`}
            metrics={activityMetrics}
          />
          <InventoryCard
            heading="Activity feed"
            searchValue={activitySearch}
            onSearchChange={setActivitySearch}
            filterValue={activityKind}
            onFilterChange={setActivityKind}
            filterOptions={[
              ["all", "Everything"],
              ["event", "Events"],
              ["run", "Runs"],
              ["memory", "Memories"],
              ["suggestion", "Suggestions"],
            ]}
            onExport={() =>
              downloadCsv(
                "agent-ops-activity.csv",
                [
                  "ID",
                  "Kind",
                  "Title",
                  "Description",
                  "Status",
                  "Severity",
                  "Linked entity",
                  "Timestamp",
                ],
                filteredActivity.map((row) => [
                  row.id,
                  row.kind,
                  row.title,
                  row.description,
                  row.status,
                  row.severity,
                  row.linkedEntity ?? "",
                  new Date(row.timestamp).toISOString(),
                ])
              )
            }
          >
            {isDashboardLoading ? (
              <>
                <ActivityTableSkeleton rowCount={activityPageSize} />
                <TablePagination
                  page={0}
                  totalPages={1}
                  pageSize={activityPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={activityPages.setPage}
                  onPageSizeChange={setActivityPageSize}
                  size="xs"
                  disabled
                />
              </>
            ) : filteredActivity.length === 0 ? (
              <EmptyState
                title="No recent activity"
                description="As workflows, evaluator runs, and memory events execute, they will appear in this feed."
              />
            ) : (
              <>
                <ActivityTable
                  rows={activityPages.items}
                  onOpen={(row) => openActivityPanel(row, openPanel)}
                />
                <TablePagination
                  page={activityPages.page}
                  totalPages={activityPages.totalPages}
                  pageSize={activityPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={(nextPage) => activityPages.setPage(nextPage)}
                  onPageSizeChange={setActivityPageSize}
                  size="xs"
                />
              </>
            )}
          </InventoryCard>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "flex min-h-0 gap-0",
        hasPanel && !isMobile && "items-stretch"
      )}
    >
      <div
        className={cn(
          "min-w-0 flex-1",
          hasPanel && !isMobile && "border-r pr-4"
        )}
      >
        {content}
      </div>

      {workspaceId && hasPanel && !isMobile ? (
        <div className="h-full w-[420px] shrink-0">
          <AgentOpsPanel
            workspaceId={workspaceId}
            selection={{
              panel: params.panel ?? null,
              queryId: params.queryId ?? null,
              monitorId: params.monitorId ?? null,
              memoryId: params.memoryId ?? null,
              eventId: params.eventId ?? null,
              runId: params.runId ?? null,
              suggestionId: params.suggestionId ?? null,
            }}
            onCloseAction={closePanel}
            onOpenMonitorAction={(monitorId) =>
              openPanel("monitor", { monitorId })
            }
            onOpenMemoryAction={(memoryId) => openPanel("memory", { memoryId })}
          />
        </div>
      ) : null}

      {workspaceId && hasPanel && isMobile ? (
        <Drawer open onOpenChange={(open) => !open && closePanel()}>
          <DrawerContent
            fullScreen
            ariaTitle="Agent observability detail panel"
          >
            <DrawerHeader className="border-b text-left">
              <DrawerTitle>Agent observability detail</DrawerTitle>
            </DrawerHeader>
            <AgentOpsPanel
              workspaceId={workspaceId}
              selection={{
                panel: params.panel ?? null,
                queryId: params.queryId ?? null,
                monitorId: params.monitorId ?? null,
                memoryId: params.memoryId ?? null,
                eventId: params.eventId ?? null,
                runId: params.runId ?? null,
                suggestionId: params.suggestionId ?? null,
              }}
              onCloseAction={closePanel}
              onOpenMonitorAction={(monitorId) =>
                openPanel("monitor", { monitorId })
              }
              onOpenMemoryAction={(memoryId) =>
                openPanel("memory", { memoryId })
              }
            />
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
}

function metricCard(
  id: string,
  title: string,
  metric: AgentOpsDashboardData["overview"]["metrics"]["healthScore"],
  context: string,
  semantic: "default" | "destructive" = "default",
  format: "number" | "percent" = "number"
): StatMetricData {
  return {
    id,
    title,
    value: metric.value,
    change: metric.change,
    changePercent: metric.changePercent,
    trend: metric.trend,
    context,
    semantic,
    format,
  };
}

function openActivityPanel(
  row: AgentOpsActivityItem,
  openPanel: (
    panel: "event" | "run" | "memory" | "suggestion",
    ids: Record<string, string>
  ) => void
) {
  if (row.kind === "event") openPanel("event", { eventId: row.id });
  if (row.kind === "run") openPanel("run", { runId: row.id });
  if (row.kind === "memory") openPanel("memory", { memoryId: row.id });
  if (row.kind === "suggestion")
    openPanel("suggestion", { suggestionId: row.id });
}

// ============================================================================
// InventoryToolbar — card with heading, search, filter/sort selects
// ============================================================================

function InventoryCard({
  heading,
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  filterOptions,
  sortValue,
  onSortChange,
  sortOptions,
  onExport,
  exportLabel = "Export CSV",
  exportDisabled = false,
  children,
}: {
  heading: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterValue: string;
  onFilterChange: (value: string) => void;
  filterOptions: ReadonlyArray<readonly [string, string]>;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: ReadonlyArray<readonly [string, string]>;
  onExport?: () => void;
  exportLabel?: string;
  exportDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <h2 className="text-lg font-medium">{heading}</h2>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SearchInput
            defaultValue={searchValue}
            onQueryChange={onSearchChange}
            placeholder="Search…"
            showExactMatch={false}
            className="w-full min-w-0 md:max-w-md md:flex-1"
          />
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:flex-nowrap">
            <Select value={filterValue} onValueChange={onFilterChange}>
              <SelectTrigger size="sm" className="w-auto max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sortOptions && onSortChange && sortValue ? (
              <Select value={sortValue} onValueChange={onSortChange}>
                <SelectTrigger size="sm" className="w-auto max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {onExport ? (
              <Button size="sm" onClick={onExport} disabled={exportDisabled}>
                {exportLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

// ============================================================================
// EmptyState — clean centered text, no card wrapper
// ============================================================================

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-md text-sm">{description}</p>
    </div>
  );
}

// ============================================================================
// CSV Export
// ============================================================================

function toCsvValue(value: string | number | null | undefined): string {
  const stringValue =
    value === null || value === undefined ? "" : String(value);
  if (
    stringValue.includes('"') ||
    stringValue.includes(",") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function downloadCsv(
  filename: string,
  header: string[],
  rows: Array<Array<string | number | null | undefined>>
) {
  const csvLines = [
    header.map(toCsvValue).join(","),
    ...rows.map((row) => row.map(toCsvValue).join(",")),
  ];
  const blob = new Blob([csvLines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Tables — standalone, no Card wrappers, hover rows, whole-row clickable
// ============================================================================

type TableSkeletonColumn = {
  label: string;
  width: string;
  skeletonWidth: string;
};

function AgentOpsTableSkeleton({
  columns,
  tableClassName,
  rowCount = 10,
}: {
  columns: TableSkeletonColumn[];
  tableClassName: string;
  rowCount?: number;
}) {
  return (
    <TableContainer>
      <Table className={`${tableClassName} table-fixed`}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.label} className={column.width}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }, (_, index) => (
            <TableRow key={`agent-ops-table-skeleton-${index}`}>
              {columns.map((column) => (
                <TableCell key={column.label}>
                  <Skeleton className={`h-3.5 ${column.skeletonWidth}`} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DiscoveryTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <AgentOpsTableSkeleton
      tableClassName="min-w-[700px]"
      rowCount={rowCount}
      columns={[
        { label: "Query", width: "w-[44%]", skeletonWidth: "w-3/4" },
        { label: "Status", width: "w-[18%]", skeletonWidth: "w-16" },
        { label: "Reply rate", width: "w-[24%]", skeletonWidth: "w-14" },
        { label: "Reviewed", width: "w-[14%]", skeletonWidth: "w-20" },
      ]}
    />
  );
}

function MemoryTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <AgentOpsTableSkeleton
      tableClassName="min-w-[780px]"
      rowCount={rowCount}
      columns={[
        { label: "Memory", width: "w-[44%]", skeletonWidth: "w-3/4" },
        { label: "Category", width: "w-[20%]", skeletonWidth: "w-24" },
        { label: "Impact", width: "w-[12%]", skeletonWidth: "w-12" },
        { label: "Confidence", width: "w-[12%]", skeletonWidth: "w-12" },
        { label: "Created", width: "w-[12%]", skeletonWidth: "w-20" },
      ]}
    />
  );
}

function ActivityTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <AgentOpsTableSkeleton
      tableClassName="min-w-[720px]"
      rowCount={rowCount}
      columns={[
        { label: "Activity", width: "w-[48%]", skeletonWidth: "w-2/3" },
        { label: "Type", width: "w-[16%]", skeletonWidth: "w-14" },
        { label: "Status", width: "w-[20%]", skeletonWidth: "w-16" },
        { label: "When", width: "w-[16%]", skeletonWidth: "w-20" },
      ]}
    />
  );
}

function DiscoveryTable({
  rows,
  onOpenQuery,
}: {
  rows: DiscoveryInventoryRow[];
  onOpenQuery: (id: string) => void;
}) {
  return (
    <TableContainer>
      <Table className="min-w-[700px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44%]">Query</TableHead>
            <TableHead className="w-[18%]">Status</TableHead>
            <TableHead className="w-[24%]">Reply rate</TableHead>
            <TableHead className="w-[14%]">Reviewed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.queryCandidateId}
              className="cursor-pointer"
              onClick={() => onOpenQuery(row.queryCandidateId)}
            >
              <TableCell className="max-w-0">
                <span
                  className="block truncate font-medium"
                  title={row.rawValue}
                >
                  {row.rawValue}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-nowrap gap-1.5">
                  <StatusBadge value={row.status} />
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {row.replyRate.toFixed(1)}%
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatRelativeDate(row.reviewedAt ?? row.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MemoryTable({
  rows,
  onOpen,
}: {
  rows: MemoryInventoryRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <TableContainer>
      <Table className="min-w-[780px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44%]">Memory</TableHead>
            <TableHead className="w-[20%]">Category</TableHead>
            <TableHead className="w-[12%]">Impact</TableHead>
            <TableHead className="w-[12%]">Confidence</TableHead>
            <TableHead className="w-[12%]">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.memoryId}
              className="cursor-pointer"
              onClick={() => onOpen(row.memoryId)}
            >
              <TableCell className="max-w-0">
                <span className="block truncate font-medium" title={row.title}>
                  {row.title}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex min-w-0">
                  <StatusBadge value={row.category} />
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {row.impactScore.toFixed(1)}
              </TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {row.confidence.toFixed(1)}%
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatRelativeDate(row.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ActivityTable({
  rows,
  onOpen,
}: {
  rows: AgentOpsActivityItem[];
  onOpen: (row: AgentOpsActivityItem) => void;
}) {
  return (
    <TableContainer>
      <Table className="min-w-[720px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[48%]">Activity</TableHead>
            <TableHead className="w-[16%]">Type</TableHead>
            <TableHead className="w-[20%]">Status</TableHead>
            <TableHead className="w-[16%]">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={`${row.kind}-${row.id}`}
              className="cursor-pointer"
              onClick={() => onOpen(row)}
            >
              <TableCell className="max-w-0">
                <span
                  className="block truncate font-medium capitalize"
                  title={row.description}
                >
                  {row.title}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge value={row.kind} />
              </TableCell>
              <TableCell>
                <StatusBadge value={row.status} />
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs tabular-nums">
                {formatRelativeDate(row.timestamp)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ============================================================================
// Chart Wrappers
// ============================================================================

function AgentOpsLineChartWrapper({
  data,
}: {
  data: AgentOpsDashboardData["overview"]["qualityTrend"];
}) {
  return (
    <AgentOpsLineChart
      title="Outcome quality over time"
      config={{
        qualityScore: {
          label: "Outcome quality",
          color: AGENT_OPS_PRIMARY_CHART_COLOR,
        },
      }}
      data={data}
      lines={[
        {
          dataKey: "qualityScore",
          stroke: AGENT_OPS_PRIMARY_CHART_COLOR,
        },
      ]}
    />
  );
}

function AgentOpsImprovementChartWrapper({
  data,
}: {
  data: AgentOpsDashboardData["overview"]["selfImprovementTrend"];
}) {
  return (
    <AgentOpsBarChart
      title="Learning loop output"
      config={{
        memoriesLearned: {
          label: "Memories saved",
          color: AGENT_OPS_PRIMARY_CHART_COLOR,
        },
        queriesActivated: {
          label: "Queries activated",
          color: "hsl(var(--chart-2))",
        },
        qualifiedProspects: {
          label: "Qualified prospects",
          color: "hsl(var(--chart-3))",
        },
      }}
      data={data}
      bars={[
        {
          dataKey: "memoriesLearned",
          fill: AGENT_OPS_PRIMARY_CHART_COLOR,
        },
        { dataKey: "queriesActivated", fill: "hsl(var(--chart-2))" },
        { dataKey: "qualifiedProspects", fill: "hsl(var(--chart-3))" },
      ]}
    />
  );
}

function AgentOpsDiscoveryGrowthWrapper({
  data,
}: {
  data: AgentOpsDashboardData["discovery"]["growthSeries"];
}) {
  return (
    <AgentOpsAreaChart
      title="Discovery growth"
      config={{
        keywords: {
          label: "Keywords",
          color: AGENT_OPS_PRIMARY_CHART_COLOR,
        },
        generated: { label: "Generated", color: "hsl(var(--chart-2))" },
        activated: { label: "Activated", color: "hsl(var(--chart-3))" },
      }}
      data={data}
      areas={[
        {
          dataKey: "keywords",
          stroke: AGENT_OPS_PRIMARY_CHART_COLOR,
          fill: AGENT_OPS_PRIMARY_CHART_COLOR,
        },
        {
          dataKey: "generated",
          stroke: "hsl(var(--chart-2))",
          fill: "hsl(var(--chart-2))",
        },
        {
          dataKey: "activated",
          stroke: "hsl(var(--chart-3))",
          fill: "hsl(var(--chart-3))",
        },
      ]}
    />
  );
}

function AgentOpsDiscoveryEfficiencyWrapper({
  data,
}: {
  data: AgentOpsDashboardData["discovery"]["efficiencySeries"];
}) {
  return (
    <AgentOpsBarChart
      title="Novelty gate efficiency"
      config={{
        accepted: {
          label: "Accepted",
          color: AGENT_OPS_PRIMARY_CHART_COLOR,
        },
        exactDuplicates: { label: "Exact dupes", color: "hsl(var(--chart-4))" },
        semanticDuplicates: {
          label: "Semantic dupes",
          color: "hsl(var(--chart-3))",
        },
      }}
      data={data}
      bars={[
        {
          dataKey: "accepted",
          fill: AGENT_OPS_PRIMARY_CHART_COLOR,
          stackId: "discovery",
        },
        {
          dataKey: "exactDuplicates",
          fill: "hsl(var(--chart-4))",
          stackId: "discovery",
        },
        {
          dataKey: "semanticDuplicates",
          fill: "hsl(var(--chart-3))",
          stackId: "discovery",
        },
      ]}
    />
  );
}

function AgentOpsMemoryChartWrapper({
  data,
}: {
  data: AgentOpsDashboardData["memory"]["impactTrend"];
}) {
  return (
    <AgentOpsLineChart
      title="Memory write signals over time"
      config={{
        memoryWrites: { label: "Saved", color: "hsl(var(--chart-1))" },
        impactScore: {
          label: "Assigned impact",
          color: "hsl(var(--chart-2))",
        },
        confidence: {
          label: "Assigned confidence",
          color: "hsl(var(--chart-3))",
        },
      }}
      data={data}
      lines={[
        { dataKey: "memoryWrites", stroke: "hsl(var(--chart-1))" },
        { dataKey: "impactScore", stroke: "hsl(var(--chart-2))" },
        { dataKey: "confidence", stroke: "hsl(var(--chart-3))" },
      ]}
    />
  );
}
