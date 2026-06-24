"use client";

import * as React from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import {
  Bot,
  BrainCircuit,
  Cable,
  HeartPulse,
  Radar,
  Search,
} from "lucide-react";
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
  useWorkspaceReportingTimeZone,
} from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";
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
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { AgentOpsPanel } from "./AgentOpsPanel";
import type {
  AgentOpsActivityItem,
  AgentOpsDashboardData,
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

// ============================================================================
// Main Dashboard
// ============================================================================

export function AgentOpsDashboard() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [querySearch, setQuerySearch] = React.useState("");
  const [queryStatus, setQueryStatus] = React.useState("all");
  const [memorySearch, setMemorySearch] = React.useState("");
  const [memoryCategory, setMemoryCategory] = React.useState("all");
  const [activitySearch, setActivitySearch] = React.useState("");
  const [activityKind, setActivityKind] = React.useState("all");
  const [querySort, setQuerySort] = React.useState<
    "updated_desc" | "novelty_desc" | "performance_desc"
  >("updated_desc");
  const [memorySort, setMemorySort] = React.useState<
    "impact_desc" | "confidence_desc" | "recent_desc"
  >("impact_desc");
  const [queryPageSize, setQueryPageSize] = React.useState(10);
  const [memoryPageSize, setMemoryPageSize] = React.useState(10);
  const [activityPageSize, setActivityPageSize] = React.useState(10);
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
  const workspaceId =
    workspaceStatusQuery.data?.status === "complete"
      ? workspaceStatusQuery.data.workspace.id
      : null;
  const { reportingTimeZone } = useWorkspaceReportingTimeZone(
    workspaceId,
    workspaceStatusQuery.data?.status === "complete"
      ? workspaceStatusQuery.data.workspace.reportingTimeZone
      : null
  );

  const dashboardQuery = useQueryWithStatus(
    api.agentOps.getAgentOpsDashboard,
    workspaceId
      ? {
          workspaceId,
          range: params.range,
          tab: params.tab,
          timeZone: reportingTimeZone,
          ...(params.from ? { fromDate: params.from } : {}),
          ...(params.to ? { toDate: params.to } : {}),
        }
      : "skip"
  );

  // Always have data — zero defaults until real data loads (mirrors Analytics)
  const defaultData = React.useMemo(
    () => getDefaultAgentOpsData(params.range),
    [params.range]
  );
  const data =
    (dashboardQuery.data as AgentOpsDashboardData | undefined) ?? defaultData;

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
        "health-score",
        "Agent health",
        data.overview.metrics.healthScore,
        "score",
        <HeartPulse className="h-4 w-4" />
      ),
      metricCard(
        "quality-score",
        "Quality score",
        data.overview.metrics.qualityScore,
        "composite",
        <Radar className="h-4 w-4" />
      ),
      metricCard(
        "self-improvement",
        "Self-improvement",
        data.overview.metrics.selfImprovementImpact,
        "impact",
        <BrainCircuit className="h-4 w-4" />
      ),
      metricCard(
        "needs-attention",
        "Needs attention",
        data.overview.metrics.needsAttention,
        "failures this period",
        <Cable className="h-4 w-4" />,
        "destructive"
      ),
    ],
    [data]
  );

  const metricsRow2: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "keywords-created",
        "Keywords created",
        data.overview.metrics.keywordsCreated,
        "this period",
        <Search className="h-4 w-4" />
      ),
      metricCard(
        "queries-generated",
        "Queries generated",
        data.overview.metrics.queriesGenerated,
        "this period",
        <Bot className="h-4 w-4" />
      ),
      metricCard(
        "queries-activated",
        "Queries activated",
        data.overview.metrics.queriesActivated,
        "this period",
        <Cable className="h-4 w-4" />
      ),
      metricCard(
        "reply-rate",
        "Reply rate",
        data.overview.metrics.replyRate,
        "response quality",
        <HeartPulse className="h-4 w-4" />,
        "default",
        "percent"
      ),
    ],
    [data]
  );

  // ── Filtered / sorted lists ──────────────────────────────────────────

  const filteredQueries = React.useMemo(() => {
    const rows = data.discovery.inventory.filter((row) => {
      const matchesStatus = queryStatus === "all" || row.status === queryStatus;
      const needle = querySearch.trim().toLowerCase();
      const matchesSearch =
        needle.length === 0 ||
        row.rawValue.toLowerCase().includes(needle) ||
        row.canonicalValue.toLowerCase().includes(needle) ||
        (row.sourceTheme ?? "").toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });

    rows.sort((left, right) => {
      if (querySort === "novelty_desc") {
        const leftScore = left.noveltyScore ?? Number.NEGATIVE_INFINITY;
        const rightScore = right.noveltyScore ?? Number.NEGATIVE_INFINITY;
        if (rightScore !== leftScore) return rightScore - leftScore;
        return right.updatedAt - left.updatedAt;
      }
      if (querySort === "performance_desc") {
        const leftScore = left.performanceScore ?? Number.NEGATIVE_INFINITY;
        const rightScore = right.performanceScore ?? Number.NEGATIVE_INFINITY;
        if (rightScore !== leftScore) return rightScore - leftScore;
        return right.updatedAt - left.updatedAt;
      }
      return right.updatedAt - left.updatedAt;
    });

    return rows;
  }, [data, querySearch, queryStatus, querySort]);

  const filteredMemories = React.useMemo(() => {
    const rows = data.memory.inventory.filter((row) => {
      const matchesCategory =
        memoryCategory === "all" || row.category === memoryCategory;
      const needle = memorySearch.trim().toLowerCase();
      const matchesSearch =
        needle.length === 0 ||
        row.title.toLowerCase().includes(needle) ||
        row.summary.toLowerCase().includes(needle) ||
        row.source.toLowerCase().includes(needle);
      return matchesCategory && matchesSearch;
    });

    rows.sort((left, right) => {
      if (memorySort === "confidence_desc") {
        if (right.confidence !== left.confidence)
          return right.confidence - left.confidence;
        return right.createdAt - left.createdAt;
      }
      if (memorySort === "recent_desc") return right.createdAt - left.createdAt;
      if (right.impactScore !== left.impactScore)
        return right.impactScore - left.impactScore;
      return right.createdAt - left.createdAt;
    });

    return rows;
  }, [data, memorySearch, memoryCategory, memorySort]);

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

  const queryPages = usePagedRows(filteredQueries, queryPageSize);
  const memoryPages = usePagedRows(filteredMemories, memoryPageSize);
  const activityPages = usePagedRows(filteredActivity, activityPageSize);

  // ── Per-tab StatsOverview metrics ────────────────────────────────────

  const discoveryMetrics: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "disc-keywords",
        "Keywords created",
        data.discovery.stats.keywordsCreated,
        "this period",
        <Search className="h-4 w-4" />
      ),
      metricCard(
        "disc-generated",
        "Queries generated",
        data.discovery.stats.queriesGenerated,
        "this period",
        <Bot className="h-4 w-4" />
      ),
      metricCard(
        "disc-activated",
        "Queries activated",
        data.discovery.stats.queriesActivated,
        "this period",
        <Cable className="h-4 w-4" />
      ),
      metricCard(
        "disc-duplicate-rate",
        "Duplicate rejection rate",
        data.discovery.stats.duplicateRejectionRate,
        "of reviewed queries",
        <Radar className="h-4 w-4" />,
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
        <Radar className="h-4 w-4" />,
        "default",
        "percent"
      ),
      metricCard(
        "qual-enrichment",
        "Enrichment usefulness",
        data.quality.summary.enrichmentUsefulness,
        "avg score",
        <BrainCircuit className="h-4 w-4" />
      ),
      metricCard(
        "qual-outreach",
        "Outreach effectiveness",
        data.quality.summary.outreachEffectiveness,
        "reply rate",
        <Bot className="h-4 w-4" />,
        "default",
        "percent"
      ),
      metricCard(
        "qual-corrections",
        "Corrections",
        data.quality.summary.correctionRate,
        "applied",
        <Cable className="h-4 w-4" />
      ),
    ],
    [data]
  );

  const memoryMetrics: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "mem-written",
        "Memories written",
        data.memory.summary.memoriesWritten,
        "this period",
        <BrainCircuit className="h-4 w-4" />
      ),
      metricCard(
        "mem-promoted",
        "Memories promoted",
        data.memory.summary.memoriesPromoted,
        "this period",
        <Bot className="h-4 w-4" />
      ),
      metricCard(
        "mem-suggestions-created",
        "Suggestions created",
        data.memory.summary.suggestionsCreated,
        "this period",
        <Radar className="h-4 w-4" />
      ),
      metricCard(
        "mem-suggestions-rejected",
        "Suggestions rejected",
        data.memory.summary.suggestionsRejected,
        "this period",
        <Cable className="h-4 w-4" />,
        "destructive"
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
        "this period",
        <HeartPulse className="h-4 w-4" />
      ),
      metricCard(
        "act-runs-started",
        "Runs started",
        data.activity.counts.runsStarted,
        "this period",
        <Bot className="h-4 w-4" />
      ),
      {
        id: "act-failed-events",
        title: "Failed events",
        value: data.activity.counts.failedEvents,
        change: 0,
        changePercent: 0,
        trend: "up" as const,
        context: "errors",
        semantic: "destructive" as const,
        icon: <Cable className="h-4 w-4" />,
      },
      {
        id: "act-failed-runs",
        title: "Failed runs",
        value: data.activity.counts.failedRuns,
        change: 0,
        changePercent: 0,
        trend: "up" as const,
        context: "errors",
        semantic: "destructive" as const,
        icon: <Radar className="h-4 w-4" />,
      },
    ],
    [data]
  );

  // ── Layout ───────────────────────────────────────────────────────────

  const content = (
    <div className="space-y-4">
      {dashboardQuery.isError || workspaceStatusQuery.isError ? (
        <div className="border-destructive bg-destructive/10 rounded-lg border p-4">
          <p className="text-destructive text-sm font-medium">
            Could not load Agent Ops
          </p>
          <p className="text-destructive/80 mt-1 text-sm">
            {dashboardQuery.error?.message ||
              workspaceStatusQuery.error?.message ||
              "Please try again."}
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

      {workspaceStatusQuery.data &&
      workspaceStatusQuery.data.status !== "complete" ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">Workspace setup is incomplete</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Finish setup to unlock the Agent Ops surface.
          </p>
        </div>
      ) : null}

      <DateRangeSelector />

      <StatsOverview key={`row1-${params.tab}`} metrics={metricsRow1} />

      {/* ── Overview ─────────────────────────────────────────── */}
      {params.tab === "overview" && (
        <>
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
            onSearchChange={setQuerySearch}
            filterValue={queryStatus}
            onFilterChange={setQueryStatus}
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
            onSortChange={(value) =>
              setQuerySort(
                value as "updated_desc" | "novelty_desc" | "performance_desc"
              )
            }
            sortOptions={[
              ["updated_desc", "Most recent"],
              ["novelty_desc", "Highest novelty"],
              ["performance_desc", "Best performance"],
            ]}
            onExport={() =>
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
                filteredQueries.map((row) => [
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
              )
            }
          >
            {filteredQueries.length === 0 ? (
              <EmptyState
                title="No discovery records yet"
                description="When the agent proposes and reviews discovery queries during the selected period, they will appear here."
              />
            ) : (
              <>
                <DiscoveryTable
                  rows={queryPages.items}
                  onOpenQuery={(queryId) => openPanel("query", { queryId })}
                />
                <TablePagination
                  page={queryPages.page}
                  totalPages={queryPages.totalPages}
                  pageSize={queryPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={(nextPage) => queryPages.setPage(nextPage)}
                  onPageSizeChange={setQueryPageSize}
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
              title="Correction trend"
              config={{
                corrections: {
                  label: "Corrections",
                  color: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
              }}
              data={data.quality.correctionTrend}
              lines={[
                {
                  dataKey: "corrections",
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
              title="Memory impact distribution"
              config={{
                impactScore: {
                  label: "Impact",
                  color: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
                confidence: {
                  label: "Confidence",
                  color: "hsl(var(--chart-3))",
                },
              }}
              data={data.memory.impactTrend}
              bars={[
                {
                  dataKey: "impactScore",
                  fill: AGENT_OPS_PRIMARY_CHART_COLOR,
                },
                { dataKey: "confidence", fill: "hsl(var(--chart-3))" },
              ]}
            />
          </div>
          <InventoryCard
            heading="Memory activity"
            searchValue={memorySearch}
            onSearchChange={setMemorySearch}
            filterValue={memoryCategory}
            onFilterChange={setMemoryCategory}
            filterOptions={[
              ["all", "All categories"],
              ...Array.from(
                new Set(data.memory.inventory.map((row) => row.category))
              ).map((value) => [value, value] as const),
            ]}
            sortValue={memorySort}
            onSortChange={(value) =>
              setMemorySort(
                value as "impact_desc" | "confidence_desc" | "recent_desc"
              )
            }
            sortOptions={[
              ["impact_desc", "Highest impact"],
              ["confidence_desc", "Highest confidence"],
              ["recent_desc", "Most recent"],
            ]}
            onExport={() =>
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
                filteredMemories.map((row) => [
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
              )
            }
          >
            {filteredMemories.length === 0 ? (
              <EmptyState
                title="No memories yet"
                description="Once the evaluator promotes or suggests reusable lessons, they will show up here."
              />
            ) : (
              <>
                <MemoryTable
                  rows={memoryPages.items}
                  onOpen={(memoryId) => openPanel("memory", { memoryId })}
                />
                <TablePagination
                  page={memoryPages.page}
                  totalPages={memoryPages.totalPages}
                  pageSize={memoryPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={(nextPage) => memoryPages.setPage(nextPage)}
                  onPageSizeChange={setMemoryPageSize}
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
            {filteredActivity.length === 0 ? (
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
            onClose={closePanel}
            onOpenMonitor={(monitorId) => openPanel("monitor", { monitorId })}
            onOpenMemory={(memoryId) => openPanel("memory", { memoryId })}
          />
        </div>
      ) : null}

      {workspaceId && hasPanel && isMobile ? (
        <Drawer open onOpenChange={(open) => !open && closePanel()}>
          <DrawerContent fullScreen ariaTitle="Agent Ops detail panel">
            <DrawerHeader className="border-b text-left">
              <DrawerTitle>Agent Ops detail</DrawerTitle>
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
              onClose={closePanel}
              onOpenMonitor={(monitorId) => openPanel("monitor", { monitorId })}
              onOpenMemory={(memoryId) => openPanel("memory", { memoryId })}
            />
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function metricCard(
  id: string,
  title: string,
  metric: AgentOpsDashboardData["overview"]["metrics"]["healthScore"],
  context: string,
  icon: React.ReactNode,
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
    icon,
    semantic,
    format,
  };
}

function openActivityPanel(
  row: AgentOpsActivityItem,
  openPanel: (
    panel: "event" | "run" | "suggestion",
    ids: Record<string, string>
  ) => void
) {
  if (row.kind === "event") openPanel("event", { eventId: row.id });
  if (row.kind === "run") openPanel("run", { runId: row.id });
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
              <Button size="sm" onClick={onExport}>
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

function DiscoveryTable({
  rows,
  onOpenQuery,
}: {
  rows: DiscoveryInventoryRow[];
  onOpenQuery: (id: string) => void;
}) {
  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Query</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Performance</TableHead>
            <TableHead>Reviewed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.queryCandidateId}
              className="cursor-pointer"
              onClick={() => onOpenQuery(row.queryCandidateId)}
            >
              <TableCell>
                <p className="font-medium">{row.rawValue}</p>
                <p className="text-muted-foreground text-xs">
                  {row.sourceTheme ?? row.canonicalValue}
                </p>
              </TableCell>
              <TableCell>
                <div className="flex flex-nowrap gap-1.5">
                  <StatusBadge value={row.status} />
                </div>
              </TableCell>
              <TableCell>
                <p>{row.replyRate.toFixed(1)}% replies</p>
                <p className="text-muted-foreground text-xs">
                  {`${row.qualifiedCount} qualified · ${row.convertedCount} converted`}
                </p>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Memory</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Impact</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.memoryId}
              className="cursor-pointer"
              onClick={() => onOpen(row.memoryId)}
            >
              <TableCell>
                <p className="font-medium">{row.title}</p>
                <p className="text-muted-foreground text-xs">{row.summary}</p>
              </TableCell>
              <TableCell>
                <div className="flex flex-nowrap gap-1.5">
                  <StatusBadge value={row.source} />
                  <StatusBadge value={row.category} />
                </div>
              </TableCell>
              <TableCell>
                <p>{row.impactScore.toFixed(1)} impact</p>
                <p className="text-muted-foreground text-xs">
                  {row.confidence.toFixed(1)}% confidence
                </p>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Activity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={`${row.kind}-${row.id}`}
              className="cursor-pointer"
              onClick={() => onOpen(row)}
            >
              <TableCell>
                <p className="font-medium capitalize">{row.title}</p>
                <p className="text-muted-foreground text-xs">
                  {row.description}
                </p>
              </TableCell>
              <TableCell>
                <div className="flex flex-nowrap gap-1.5">
                  <StatusBadge value={row.kind} />
                  <StatusBadge value={row.status} />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
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
      title="Agent quality over time"
      config={{
        qualityScore: {
          label: "Quality",
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
      title="Self-improvement impact"
      config={{
        noveltyYield: {
          label: "Novelty yield",
          color: AGENT_OPS_PRIMARY_CHART_COLOR,
        },
        duplicateWaste: {
          label: "Duplicate waste",
          color: "hsl(var(--chart-4))",
        },
        promotedMemories: { label: "Promotions", color: "hsl(var(--chart-2))" },
      }}
      data={data}
      bars={[
        {
          dataKey: "noveltyYield",
          fill: AGENT_OPS_PRIMARY_CHART_COLOR,
        },
        { dataKey: "duplicateWaste", fill: "hsl(var(--chart-4))" },
        { dataKey: "promotedMemories", fill: "hsl(var(--chart-2))" },
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
      title="Memory quality over time"
      config={{
        memoryWrites: { label: "Writes", color: "hsl(var(--chart-1))" },
        impactScore: { label: "Impact", color: "hsl(var(--chart-2))" },
        confidence: { label: "Confidence", color: "hsl(var(--chart-3))" },
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
