"use client";

import * as React from "react";
import {
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
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
import { useQueryWithStatus } from "@/shared/hooks";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/components/pagination";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/Table";
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

  const [params, setParams] = useQueryStates({
    range: parseAsStringLiteral(DATE_RANGE_PRESETS).withDefault("7d"),
    from: parseAsIsoDateTime,
    to: parseAsIsoDateTime,
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
    api.workspaces.getWorkspaceSetupStatus
  );
  const workspaceId =
    workspaceStatusQuery.data?.status === "complete"
      ? workspaceStatusQuery.data.workspace.id
      : null;

  const dashboardQuery = useQueryWithStatus(
    api.agentOps.getAgentOpsDashboard,
    workspaceId
      ? {
          workspaceId,
          range: params.range,
          ...(params.from ? { from: params.from.getTime() } : {}),
          ...(params.to ? { to: params.to.getTime() } : {}),
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
        "blocked",
        "Needs attention",
        data.overview.metrics.blockedItems,
        "blocked items",
        <Cable className="h-4 w-4" />,
        "destructive"
      ),
    ],
    [data]
  );

  const metricsRow2: StatMetricData[] = React.useMemo(
    () => [
      metricCard(
        "keywords",
        "Keywords",
        data.overview.metrics.keywords,
        "tracked",
        <Search className="h-4 w-4" />
      ),
      metricCard(
        "queries",
        "Queries",
        data.overview.metrics.queries,
        "social queries",
        <Bot className="h-4 w-4" />
      ),
      metricCard(
        "monitors",
        "Monitors",
        data.overview.metrics.monitors,
        "active coverage",
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

  const queryPages = usePagedRows(filteredQueries, 10);
  const memoryPages = usePagedRows(filteredMemories, 8);
  const activityPages = usePagedRows(filteredActivity, 10);

  // ── Per-tab StatsOverview metrics ────────────────────────────────────

  const discoveryMetrics: StatMetricData[] = React.useMemo(
    () => [
      {
        id: "disc-keywords",
        title: "Keywords",
        value: data.discovery.stats.totalKeywords,
        change: 0,
        changePercent: 0,
        trend: "up" as const,
        context: "tracked",
        icon: <Search className="h-4 w-4" />,
      },
      {
        id: "disc-active-queries",
        title: "Active queries",
        value: data.discovery.stats.activeQueries,
        change: 0,
        changePercent: 0,
        trend: "up" as const,
        context: "running",
        icon: <Bot className="h-4 w-4" />,
      },
      {
        id: "disc-duplicate-rate",
        title: "Duplicate rate",
        value: data.discovery.stats.duplicateRate,
        change: 0,
        changePercent: 0,
        trend: "down" as const,
        format: "percent" as const,
        context: "of total",
        icon: <Radar className="h-4 w-4" />,
      },
      {
        id: "disc-failing-monitors",
        title: "Failing monitors",
        value: data.discovery.stats.monitors.failing,
        change: 0,
        changePercent: 0,
        trend: "up" as const,
        context: "monitors",
        semantic: "destructive" as const,
        icon: <Cable className="h-4 w-4" />,
      },
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
        "mem-stored",
        "Stored memories",
        data.memory.summary.storedMemories,
        "total",
        <BrainCircuit className="h-4 w-4" />
      ),
      metricCard(
        "mem-writes",
        "Recent writes",
        data.memory.summary.recentWrites,
        "this period",
        <Bot className="h-4 w-4" />
      ),
      metricCard(
        "mem-freshness",
        "Freshness",
        data.memory.summary.memoryFreshness,
        "up to date",
        <Radar className="h-4 w-4" />,
        "default",
        "percent"
      ),
      metricCard(
        "mem-pending",
        "Pending review",
        data.memory.summary.pendingReview,
        "to review",
        <Cable className="h-4 w-4" />
      ),
    ],
    [data]
  );

  const activityMetrics: StatMetricData[] = React.useMemo(
    () => [
      {
        id: "act-pending",
        title: "Pending events",
        value: data.activity.counts.pendingEvents,
        change: 0,
        changePercent: 0,
        trend: "up" as const,
        context: "in queue",
        icon: <HeartPulse className="h-4 w-4" />,
      },
      {
        id: "act-processing",
        title: "Processing",
        value: data.activity.counts.processingEvents,
        change: 0,
        changePercent: 0,
        trend: "up" as const,
        context: "running now",
        icon: <Bot className="h-4 w-4" />,
      },
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
      <StatsOverview key={`row2-${params.tab}`} metrics={metricsRow2} />

      {/* ── Overview ─────────────────────────────────────────── */}
      {params.tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AgentOpsLineChartWrapper data={data.overview.qualityTrend} />
          <AgentOpsImprovementChartWrapper
            data={data.overview.selfImprovementTrend}
          />
        </div>
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
            heading="Discovery inventory"
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
                  "Monitor status",
                  "Monitor health",
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
                  row.monitorStatus ?? "",
                  row.monitorHealth ?? "",
                  new Date(row.updatedAt).toISOString(),
                ])
              )
            }
          >
            {filteredQueries.length === 0 ? (
              <EmptyState
                title="No discovery records yet"
                description="When the agent proposes and evaluates discovery queries, they will appear here with performance and monitor health."
              />
            ) : (
              <>
                <DiscoveryTable
                  rows={queryPages.items}
                  onOpenQuery={(queryId) => openPanel("query", { queryId })}
                  onOpenMonitor={(monitorId) =>
                    openPanel("monitor", { monitorId })
                  }
                />
                <PaginationRow
                  page={queryPages.page}
                  totalPages={queryPages.totalPages}
                  canPrevious={queryPages.canPrevious}
                  canNext={queryPages.canNext}
                  onPrevious={() => queryPages.setPage((page) => page - 1)}
                  onNext={() => queryPages.setPage((page) => page + 1)}
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
                precision: { label: "Precision", color: "hsl(var(--chart-1))" },
              }}
              data={data.quality.qualificationTrend}
              lines={[{ dataKey: "precision", stroke: "hsl(var(--chart-1))" }]}
            />
            <AgentOpsLineChart
              title="Outreach effectiveness"
              config={{
                effectiveness: {
                  label: "Effectiveness",
                  color: "hsl(var(--chart-3))",
                },
              }}
              data={data.quality.outreachTrend}
              lines={[
                { dataKey: "effectiveness", stroke: "hsl(var(--chart-3))" },
              ]}
            />
            <AgentOpsLineChart
              title="Enrichment usefulness"
              config={{
                usefulness: {
                  label: "Usefulness",
                  color: "hsl(var(--chart-2))",
                },
              }}
              data={data.quality.enrichmentTrend}
              lines={[{ dataKey: "usefulness", stroke: "hsl(var(--chart-2))" }]}
            />
            <AgentOpsLineChart
              title="Correction trend"
              config={{
                corrections: {
                  label: "Corrections",
                  color: "hsl(var(--chart-4))",
                },
              }}
              data={data.quality.correctionTrend}
              lines={[
                { dataKey: "corrections", stroke: "hsl(var(--chart-4))" },
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
                  color: "hsl(var(--chart-2))",
                },
                confidence: {
                  label: "Confidence",
                  color: "hsl(var(--chart-3))",
                },
              }}
              data={data.memory.impactTrend}
              bars={[
                { dataKey: "impactScore", fill: "hsl(var(--chart-2))" },
                { dataKey: "confidence", fill: "hsl(var(--chart-3))" },
              ]}
            />
          </div>
          <InventoryCard
            heading="Memory inventory"
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
                <PaginationRow
                  page={memoryPages.page}
                  totalPages={memoryPages.totalPages}
                  canPrevious={memoryPages.canPrevious}
                  canNext={memoryPages.canNext}
                  onPrevious={() => memoryPages.setPage((page) => page - 1)}
                  onNext={() => memoryPages.setPage((page) => page + 1)}
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
                <PaginationRow
                  page={activityPages.page}
                  totalPages={activityPages.totalPages}
                  canPrevious={activityPages.canPrevious}
                  canNext={activityPages.canNext}
                  onPrevious={() => activityPages.setPage((page) => page - 1)}
                  onNext={() => activityPages.setPage((page) => page + 1)}
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
    <Card className="shadow-none">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-base font-medium">{heading}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            defaultValue={searchValue}
            onQueryChange={onSearchChange}
            placeholder="Search…"
            showExactMatch={false}
            className="w-full max-w-md"
          />
          <div className="flex items-center gap-2">
            <Select value={filterValue} onValueChange={onFilterChange}>
              <SelectTrigger size="xs">
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
                <SelectTrigger size="xs">
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
              <Button size="xs" onClick={onExport}>
                {exportLabel}
              </Button>
            ) : null}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PaginationRow
// ============================================================================

function PaginationRow({
  page,
  totalPages,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <Pagination className="justify-between">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={!canPrevious}
            className={
              !canPrevious ? "pointer-events-none opacity-50" : undefined
            }
            onClick={(event) => {
              event.preventDefault();
              if (canPrevious) onPrevious();
            }}
          />
        </PaginationItem>
        <PaginationItem className="text-muted-foreground px-3 text-sm">
          Page {page + 1} of {totalPages}
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={!canNext}
            className={!canNext ? "pointer-events-none opacity-50" : undefined}
            onClick={(event) => {
              event.preventDefault();
              if (canNext) onNext();
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
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
  onOpenMonitor,
}: {
  rows: DiscoveryInventoryRow[];
  onOpenQuery: (id: string) => void;
  onOpenMonitor: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Query</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Performance</TableHead>
          <TableHead>Monitor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.queryCandidateId}
            className="hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onOpenQuery(row.queryCandidateId)}
          >
            <TableCell>
              <p className="font-medium">{row.rawValue}</p>
              <p className="text-muted-foreground text-xs">
                {row.sourceTheme ?? row.canonicalValue}
              </p>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge value={row.status} />
                {row.monitorHealth ? (
                  <StatusBadge value={row.monitorHealth} />
                ) : null}
              </div>
            </TableCell>
            <TableCell>
              <p>{row.replyRate.toFixed(1)}% replies</p>
              <p className="text-muted-foreground text-xs">
                {row.qualifiedCount} qualified · {row.convertedCount} converted
              </p>
            </TableCell>
            <TableCell>
              {row.monitorId ? (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenMonitor(row.monitorId!);
                  }}
                >
                  Open
                </Button>
              ) : (
                <span className="text-muted-foreground text-sm">None</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
            className="hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onOpen(row.memoryId)}
          >
            <TableCell>
              <p className="font-medium">{row.title}</p>
              <p className="text-muted-foreground text-xs">{row.summary}</p>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1.5">
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
            className="hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onOpen(row)}
          >
            <TableCell>
              <p className="font-medium capitalize">{row.title}</p>
              <p className="text-muted-foreground text-xs">{row.description}</p>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1.5">
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
        qualityScore: { label: "Quality", color: "hsl(var(--chart-1))" },
      }}
      data={data}
      lines={[{ dataKey: "qualityScore", stroke: "hsl(var(--chart-1))" }]}
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
        noveltyYield: { label: "Novelty yield", color: "hsl(var(--chart-1))" },
        duplicateWaste: {
          label: "Duplicate waste",
          color: "hsl(var(--chart-4))",
        },
        promotedMemories: { label: "Promotions", color: "hsl(var(--chart-2))" },
      }}
      data={data}
      bars={[
        { dataKey: "noveltyYield", fill: "hsl(var(--chart-1))" },
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
        keywords: { label: "Keywords", color: "hsl(var(--chart-1))" },
        queries: { label: "Queries", color: "hsl(var(--chart-2))" },
        monitors: { label: "Monitors", color: "hsl(var(--chart-3))" },
      }}
      data={data}
      areas={[
        {
          dataKey: "keywords",
          stroke: "hsl(var(--chart-1))",
          fill: "hsl(var(--chart-1))",
        },
        {
          dataKey: "queries",
          stroke: "hsl(var(--chart-2))",
          fill: "hsl(var(--chart-2))",
        },
        {
          dataKey: "monitors",
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
        accepted: { label: "Accepted", color: "hsl(var(--chart-2))" },
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
          fill: "hsl(var(--chart-2))",
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
