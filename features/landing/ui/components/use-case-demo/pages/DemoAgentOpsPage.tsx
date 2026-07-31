/**
 * DemoAgentOpsPage
 * Agent observability demo page: faithful static replica of the real
 * /agent-ops route (app/(webapp)/agent-ops/page.tsx) and the presentational
 * layer of features/agent-ops/ui/AgentOpsDashboard.tsx, driven entirely by
 * local mock data. No Convex, no URL state, no routing.
 *
 * Reused as-is (prop-driven, Convex-free): PageLayout/PageHeader/PageContent,
 * StatsOverview, SearchInput, Select/Tabs/Table/TablePagination/Button, and
 * the AgentOps*Chart + StatusBadge + usePagedRows + formatRelativeDate helpers
 * from features/agent-ops/ui/shared.tsx.
 *
 * Replicated verbatim (module-private or wired in the real code): the tab
 * Select header action, the DateRangeSelector markup (local state instead of
 * nuqs), InventoryCard, EmptyState, the three inventory tables, downloadCsv,
 * and the metricCard helper. Omitted: the Convex-backed detail panel/Drawer,
 * error state, and loading skeletons (the demo always has data). Table row
 * clicks are inert because the detail panel needs Convex.
 */
"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import {
  Bot,
  BrainCircuit,
  Cable,
  HeartPulse,
  Radar,
  Search,
} from "lucide-react";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import {
  StatsOverview,
  type StatMetricData,
} from "@/features/analytics/ui/components/StatsOverview";
import { DateRangeInputPicker } from "@/features/analytics/ui/components/DateRangeInputPicker";
import type { DateRangePreset } from "@/features/analytics/lib/types";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import {
  formatDateOnlyValue,
  getInclusiveDayCount,
  parseDateOnlyValue,
} from "@/shared/lib/utils/time/timeUtils";
import { Button } from "@/shared/ui/components/Button";
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
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import type {
  AgentOpsActivityItem,
  AgentOpsDashboardData,
  AgentOpsMemorySort,
  AgentOpsMetric,
  AgentOpsTab,
  DiscoveryInventoryRow,
  MemoryInventoryRow,
} from "@/features/agent-ops/ui/types";
import {
  AgentOpsAreaChart,
  AgentOpsBarChart,
  AgentOpsLineChart,
  StatusBadge,
  formatRelativeDate,
  usePagedRows,
} from "@/features/agent-ops/ui/shared";

const AGENT_OPS_PRIMARY_CHART_COLOR = "hsl(var(--chart-1))";

const TAB_OPTIONS: { value: AgentOpsTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "discovery", label: "Discovery" },
  { value: "quality", label: "Quality" },
  { value: "memory", label: "Memory" },
  { value: "activity", label: "Activity" },
];

// ============================================================================
// Mock data (AgentOpsDashboardData shape, fixed timestamps for determinism)
// ============================================================================

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DEMO_NOW = Date.UTC(2026, 6, 29, 9, 41);

const TREND_DATES = [
  "Jul 23",
  "Jul 24",
  "Jul 25",
  "Jul 26",
  "Jul 27",
  "Jul 28",
  "Jul 29",
];

function metric(
  value: number,
  change: number,
  changePercent: number,
  trend: "up" | "down" = change >= 0 ? "up" : "down"
): AgentOpsMetric {
  return { value, change, changePercent, trend };
}

const DISCOVERY_INVENTORY: DiscoveryInventoryRow[] = [
  {
    queryCandidateId: "qc-01",
    rawValue: "saas founders hiring first sales rep",
    canonicalValue: "saas founders hiring sales",
    type: "keyword",
    status: "activated",
    statusLabel: "Activated",
    sourceTheme: "Hiring signals",
    noveltyScore: 92,
    performanceScore: 88,
    createdAt: DEMO_NOW - 6 * DAY,
    reviewedAt: DEMO_NOW - 5 * DAY,
    prospectsFound: 34,
    qualifiedCount: 11,
    convertedCount: 2,
    replyRate: 14.7,
    updatedAt: DEMO_NOW - 2 * HOUR,
  },
  {
    queryCandidateId: "qc-02",
    rawValue: "revops leaders evaluating outbound tools",
    canonicalValue: "revops leaders evaluating outbound tools",
    type: "semantic",
    status: "activated",
    statusLabel: "Activated",
    sourceTheme: "Tool evaluation",
    noveltyScore: 87,
    performanceScore: 81,
    createdAt: DEMO_NOW - 5 * DAY,
    reviewedAt: DEMO_NOW - 4 * DAY,
    prospectsFound: 27,
    qualifiedCount: 8,
    convertedCount: 1,
    replyRate: 11.1,
    updatedAt: DEMO_NOW - 5 * HOUR,
  },
  {
    queryCandidateId: "qc-03",
    rawValue: "seed stage startups raising a round",
    canonicalValue: "seed stage startups raising",
    type: "keyword",
    status: "activated",
    statusLabel: "Activated",
    sourceTheme: "Funding events",
    noveltyScore: 84,
    performanceScore: 76,
    createdAt: DEMO_NOW - 5 * DAY,
    reviewedAt: DEMO_NOW - 4 * DAY,
    prospectsFound: 41,
    qualifiedCount: 9,
    convertedCount: 1,
    replyRate: 9.8,
    updatedAt: DEMO_NOW - 9 * HOUR,
  },
  {
    queryCandidateId: "qc-04",
    rawValue: "vp sales complaining about pipeline coverage",
    canonicalValue: "vp sales pipeline complaints",
    type: "semantic",
    status: "generated",
    statusLabel: "Generated",
    sourceTheme: "Pain points",
    noveltyScore: 79,
    performanceScore: null,
    createdAt: DEMO_NOW - 1 * DAY,
    reviewedAt: null,
    prospectsFound: 12,
    qualifiedCount: 3,
    convertedCount: 0,
    replyRate: 8.3,
    updatedAt: DEMO_NOW - 1 * DAY,
  },
  {
    queryCandidateId: "qc-05",
    rawValue: "head of growth at plg companies",
    canonicalValue: "head of growth plg",
    type: "keyword",
    status: "generated",
    statusLabel: "Generated",
    sourceTheme: "Role targeting",
    noveltyScore: 74,
    performanceScore: null,
    createdAt: DEMO_NOW - 2 * DAY,
    reviewedAt: null,
    prospectsFound: 18,
    qualifiedCount: 4,
    convertedCount: 0,
    replyRate: 5.6,
    updatedAt: DEMO_NOW - 2 * DAY,
  },
  {
    queryCandidateId: "qc-06",
    rawValue: "saas founders hiring a sales rep",
    canonicalValue: "saas founders hiring sales",
    type: "keyword",
    status: "rejected_exact_duplicate",
    statusLabel: "Exact duplicate",
    sourceTheme: "Hiring signals",
    noveltyScore: 12,
    performanceScore: null,
    createdAt: DEMO_NOW - 3 * DAY,
    reviewedAt: DEMO_NOW - 3 * DAY,
    prospectsFound: 0,
    qualifiedCount: 0,
    convertedCount: 0,
    replyRate: 0,
    updatedAt: DEMO_NOW - 3 * DAY,
  },
  {
    queryCandidateId: "qc-07",
    rawValue: "startups looking for lead gen agencies",
    canonicalValue: "startups looking for lead gen",
    type: "semantic",
    status: "rejected_semantic_duplicate",
    statusLabel: "Semantic duplicate",
    sourceTheme: "Tool evaluation",
    noveltyScore: 31,
    performanceScore: null,
    createdAt: DEMO_NOW - 3 * DAY,
    reviewedAt: DEMO_NOW - 2 * DAY,
    prospectsFound: 0,
    qualifiedCount: 0,
    convertedCount: 0,
    replyRate: 0,
    updatedAt: DEMO_NOW - 2 * DAY,
  },
  {
    queryCandidateId: "qc-08",
    rawValue: "founders talking about churn",
    canonicalValue: "founders talking about churn",
    type: "keyword",
    status: "rejected_low_novelty",
    statusLabel: "Low novelty",
    sourceTheme: "Pain points",
    noveltyScore: 22,
    performanceScore: null,
    createdAt: DEMO_NOW - 4 * DAY,
    reviewedAt: DEMO_NOW - 4 * DAY,
    prospectsFound: 0,
    qualifiedCount: 0,
    convertedCount: 0,
    replyRate: 0,
    updatedAt: DEMO_NOW - 4 * DAY,
  },
  {
    queryCandidateId: "qc-09",
    rawValue: "series a companies expanding sales teams",
    canonicalValue: "series a expanding sales team",
    type: "semantic",
    status: "activated",
    statusLabel: "Activated",
    sourceTheme: "Hiring signals",
    noveltyScore: 90,
    performanceScore: 84,
    createdAt: DEMO_NOW - 6 * DAY,
    reviewedAt: DEMO_NOW - 5 * DAY,
    prospectsFound: 29,
    qualifiedCount: 10,
    convertedCount: 2,
    replyRate: 13.8,
    updatedAt: DEMO_NOW - 4 * HOUR,
  },
  {
    queryCandidateId: "qc-10",
    rawValue: "cto mentions of manual prospecting",
    canonicalValue: "cto manual prospecting",
    type: "semantic",
    status: "generated",
    statusLabel: "Generated",
    sourceTheme: "Pain points",
    noveltyScore: 68,
    performanceScore: null,
    createdAt: DEMO_NOW - 12 * HOUR,
    reviewedAt: null,
    prospectsFound: 9,
    qualifiedCount: 2,
    convertedCount: 0,
    replyRate: 0,
    updatedAt: DEMO_NOW - 12 * HOUR,
  },
  {
    queryCandidateId: "qc-11",
    rawValue: "b2b founders new to outbound",
    canonicalValue: "b2b founders new to outbound",
    type: "keyword",
    status: "retired",
    statusLabel: "Retired",
    sourceTheme: "Role targeting",
    noveltyScore: 55,
    performanceScore: 41,
    createdAt: DEMO_NOW - 12 * DAY,
    reviewedAt: DEMO_NOW - 11 * DAY,
    prospectsFound: 22,
    qualifiedCount: 3,
    convertedCount: 0,
    replyRate: 3.1,
    updatedAt: DEMO_NOW - 2 * DAY,
  },
  {
    queryCandidateId: "qc-12",
    rawValue: "sales leaders hiring sdrs this quarter",
    canonicalValue: "sales leaders hiring sdrs",
    type: "keyword",
    status: "activated",
    statusLabel: "Activated",
    sourceTheme: "Hiring signals",
    noveltyScore: 86,
    performanceScore: 79,
    createdAt: DEMO_NOW - 4 * DAY,
    reviewedAt: DEMO_NOW - 3 * DAY,
    prospectsFound: 25,
    qualifiedCount: 7,
    convertedCount: 1,
    replyRate: 12.0,
    updatedAt: DEMO_NOW - 7 * HOUR,
  },
];

const MEMORY_INVENTORY: MemoryInventoryRow[] = [
  {
    memoryId: "mem-01",
    title: "Hiring signals convert best",
    summary:
      "Prospects posting sales roles reply at 2x the baseline rate, so hiring-signal queries are prioritized during review.",
    source: "outcome_evaluator",
    category: "qualification",
    confidence: 91.2,
    impactScore: 88.4,
    relatedQueries: 4,
    evidenceCount: 17,
    createdAt: DEMO_NOW - 1 * DAY,
  },
  {
    memoryId: "mem-02",
    title: "Short openers outperform",
    summary:
      "Plans with a two sentence opener see higher reply rates than longer personalized paragraphs.",
    source: "reply_analysis",
    category: "outreach",
    confidence: 87.5,
    impactScore: 82.1,
    relatedQueries: 3,
    evidenceCount: 12,
    createdAt: DEMO_NOW - 2 * DAY,
  },
  {
    memoryId: "mem-03",
    title: "Funding news is time sensitive",
    summary:
      "Contacting within 72 hours of a raise announcement lifts reply rates sharply; older announcements decay fast.",
    source: "outcome_evaluator",
    category: "discovery",
    confidence: 84.9,
    impactScore: 79.6,
    relatedQueries: 5,
    evidenceCount: 14,
    createdAt: DEMO_NOW - 2 * DAY,
  },
  {
    memoryId: "mem-04",
    title: "Founder titles beat vp titles",
    summary:
      "Founder-led companies under 50 people respond more often than vp-level contacts at larger accounts.",
    source: "reply_analysis",
    category: "qualification",
    confidence: 81.3,
    impactScore: 74.8,
    relatedQueries: 2,
    evidenceCount: 9,
    createdAt: DEMO_NOW - 3 * DAY,
  },
  {
    memoryId: "mem-05",
    title: "Avoid generic pain openers",
    summary:
      "Openers referencing a generic pain point underperform openers that cite a specific recent post.",
    source: "reply_analysis",
    category: "outreach",
    confidence: 78.6,
    impactScore: 71.2,
    relatedQueries: 3,
    evidenceCount: 11,
    createdAt: DEMO_NOW - 3 * DAY,
  },
  {
    memoryId: "mem-06",
    title: "Exact dupes cluster around themes",
    summary:
      "Most rejected exact duplicates come from regenerating the hiring-signals theme with minor wording changes.",
    source: "novelty_gate",
    category: "discovery",
    confidence: 76.1,
    impactScore: 63.5,
    relatedQueries: 6,
    evidenceCount: 8,
    createdAt: DEMO_NOW - 4 * DAY,
  },
  {
    memoryId: "mem-07",
    title: "Weekday mornings send best",
    summary:
      "Comments queued between 8 and 10 am local time earn more replies than afternoon sends.",
    source: "outcome_evaluator",
    category: "outreach",
    confidence: 73.4,
    impactScore: 61.9,
    relatedQueries: 1,
    evidenceCount: 10,
    createdAt: DEMO_NOW - 4 * DAY,
  },
  {
    memoryId: "mem-08",
    title: "Enrichment boosts precision",
    summary:
      "Prospects with refreshed finance signals are qualified correctly 18 percent more often.",
    source: "quality_evaluator",
    category: "qualification",
    confidence: 71.8,
    impactScore: 58.3,
    relatedQueries: 2,
    evidenceCount: 7,
    createdAt: DEMO_NOW - 5 * DAY,
  },
  {
    memoryId: "mem-09",
    title: "Pain-point queries need review",
    summary:
      "Generated pain-point queries have the widest quality spread and benefit from manual review before activation.",
    source: "novelty_gate",
    category: "discovery",
    confidence: 68.2,
    impactScore: 52.7,
    relatedQueries: 4,
    evidenceCount: 6,
    createdAt: DEMO_NOW - 5 * DAY,
  },
  {
    memoryId: "mem-10",
    title: "Second touch lifts replies",
    summary:
      "A single follow up comment after three days recovers about a fifth of non-responders.",
    source: "reply_analysis",
    category: "outreach",
    confidence: 65.9,
    impactScore: 49.4,
    relatedQueries: 2,
    evidenceCount: 5,
    createdAt: DEMO_NOW - 6 * DAY,
  },
  {
    memoryId: "mem-11",
    title: "Role targeting saturates fast",
    summary:
      "Role-based queries exhaust fresh matches within a week and should rotate with signal-based themes.",
    source: "outcome_evaluator",
    category: "discovery",
    confidence: 62.5,
    impactScore: 44.1,
    relatedQueries: 3,
    evidenceCount: 4,
    createdAt: DEMO_NOW - 6 * DAY,
  },
  {
    memoryId: "mem-12",
    title: "Long-tail keywords underperform",
    summary:
      "Keyword queries longer than six words rarely qualify prospects and are deprioritized at review.",
    source: "novelty_gate",
    category: "qualification",
    confidence: 58.7,
    impactScore: 39.8,
    relatedQueries: 2,
    evidenceCount: 3,
    createdAt: DEMO_NOW - 7 * DAY,
  },
];

const ACTIVITY_FEED: AgentOpsActivityItem[] = [
  {
    id: "evt-01",
    kind: "event",
    title: "Discovery sweep completed",
    description:
      "Scanned new posts across 14 saved searches and queued 6 candidates for review.",
    status: "processed",
    timestamp: DEMO_NOW - 12 * 60 * 1000,
    severity: "success",
    linkedEntity: "Discovery sweep",
  },
  {
    id: "run-01",
    kind: "run",
    title: "Qualification evaluator run",
    description: "Scored 6 new matches against the workspace profile.",
    status: "completed",
    timestamp: DEMO_NOW - 25 * 60 * 1000,
    severity: "success",
    linkedEntity: "Qualification",
  },
  {
    id: "mem-13",
    kind: "memory",
    title: "Memory learned: hiring signals convert best",
    description:
      "Captured a reusable lesson from recent reply outcomes with impact 88.4.",
    status: "completed",
    timestamp: DEMO_NOW - 1 * HOUR,
    severity: "default",
    linkedEntity: "Memory",
  },
  {
    id: "evt-02",
    kind: "event",
    title: "Enrichment refresh finished",
    description: "Updated profiles and finance signals for 4 prospects.",
    status: "processed",
    timestamp: DEMO_NOW - 2 * HOUR,
    severity: "default",
    linkedEntity: "Enrichment",
  },
  {
    id: "run-02",
    kind: "run",
    title: "Outreach plan drafted",
    description: "Drafted a plan for Priya Nair. Waiting for approval.",
    status: "running",
    timestamp: DEMO_NOW - 3 * HOUR,
    severity: "default",
    linkedEntity: "Plans",
  },
  {
    id: "sug-01",
    kind: "suggestion",
    title: "New query suggested",
    description:
      "cto mentions of manual prospecting scored 68 on the novelty gate.",
    status: "pending",
    timestamp: DEMO_NOW - 5 * HOUR,
    severity: "default",
    linkedEntity: "Discovery",
  },
  {
    id: "run-03",
    kind: "run",
    title: "Monitor check rescheduled",
    description: "One monitor timed out and was rescheduled with backoff.",
    status: "failed",
    timestamp: DEMO_NOW - 8 * HOUR,
    severity: "warning",
    linkedEntity: "Monitors",
  },
  {
    id: "evt-03",
    kind: "event",
    title: "Reply detected",
    description: "Marcus Webb replied to a comment on his funding post.",
    status: "processed",
    timestamp: DEMO_NOW - 11 * HOUR,
    severity: "success",
    linkedEntity: "Outreach",
  },
  {
    id: "mem-14",
    kind: "memory",
    title: "Memory learned: short openers outperform",
    description:
      "Reply analysis promoted a new outreach lesson with confidence 87.5.",
    status: "completed",
    timestamp: DEMO_NOW - 1 * DAY,
    severity: "default",
    linkedEntity: "Memory",
  },
  {
    id: "run-04",
    kind: "run",
    title: "Novelty gate review",
    description: "Rejected 2 duplicates and activated 1 new query.",
    status: "completed",
    timestamp: DEMO_NOW - 2 * DAY,
    severity: "default",
    linkedEntity: "Discovery",
  },
  {
    id: "evt-04",
    kind: "event",
    title: "Webhook delivery failed",
    description: "A profile sync webhook failed and will be retried.",
    status: "failed",
    timestamp: DEMO_NOW - 2 * DAY,
    severity: "destructive",
    linkedEntity: "Integrations",
  },
  {
    id: "sug-02",
    kind: "suggestion",
    title: "Theme rotation suggested",
    description:
      "Role-based queries are saturating; the agent suggests rotating themes.",
    status: "pending",
    timestamp: DEMO_NOW - 3 * DAY,
    severity: "default",
    linkedEntity: "Discovery",
  },
];

const MOCK_AGENT_OPS_DATA: AgentOpsDashboardData = {
  overview: {
    metrics: {
      healthScore: metric(82, 4, 5.1),
      queryWinRate: metric(64.3, 3.2, 5.2),
      qualificationPrecision: metric(71.8, 2.6, 3.8),
      outreachEffectiveness: metric(12.4, 1.1, 9.7),
      memoriesLearned: metric(38, 6, 18.8),
      averageMemoryImpact: metric(66.2, 2.4, 3.8),
      queriesActivated: metric(14, 3, 27.3),
      runReliability: metric(96.8, 0.6, 0.6),
    },
    qualityTrend: TREND_DATES.map((date, index) => ({
      date,
      qualityScore: [68, 71, 70, 74, 76, 75, 78][index],
    })),
    selfImprovementTrend: TREND_DATES.map((date, index) => ({
      date,
      memoriesLearned: [3, 5, 4, 6, 5, 7, 8][index],
      queriesActivated: [1, 2, 1, 3, 2, 2, 3][index],
      qualifiedProspects: [6, 9, 7, 11, 10, 12, 13][index],
    })),
  },
  discovery: {
    stats: {
      keywordsCreated: metric(21, 5, 31.3),
      queriesGenerated: metric(47, 9, 23.7),
      queryWinRate: metric(64.3, 3.2, 5.2),
      duplicateRejectionRate: metric(18.6, -2.4, -11.4, "down"),
    },
    growthSeries: TREND_DATES.map((date, index) => ({
      date,
      keywords: [2, 3, 3, 4, 3, 3, 3][index],
      generated: [5, 7, 6, 8, 7, 7, 7][index],
      activated: [1, 2, 2, 3, 2, 2, 2][index],
    })),
    efficiencySeries: TREND_DATES.map((date, index) => ({
      date,
      generated: [5, 7, 6, 8, 7, 7, 7][index],
      accepted: [4, 5, 5, 6, 6, 6, 6][index],
      exactDuplicates: [1, 1, 0, 1, 1, 0, 1][index],
      semanticDuplicates: [0, 1, 1, 1, 0, 1, 0][index],
    })),
    bestQueries: [],
    weakestQueries: [],
    inventory: DISCOVERY_INVENTORY,
  },
  quality: {
    summary: {
      qualificationPrecision: metric(71.8, 2.6, 3.8),
      enrichmentUsefulness: metric(78.4, 1.9, 2.5),
      outreachEffectiveness: metric(12.4, 1.1, 9.7),
      runReliability: metric(96.8, 0.6, 0.6),
    },
    qualificationTrend: TREND_DATES.map((date, index) => ({
      date,
      precision: [66, 69, 68, 71, 73, 72, 75][index],
      completed: [8, 11, 9, 13, 12, 14, 15][index],
    })),
    enrichmentTrend: TREND_DATES.map((date, index) => ({
      date,
      usefulness: [74, 76, 75, 78, 79, 78, 80][index],
      completions: [5, 7, 6, 9, 8, 10, 11][index],
    })),
    outreachTrend: TREND_DATES.map((date, index) => ({
      date,
      effectiveness: [9.8, 10.6, 11.2, 10.9, 11.8, 12.1, 12.4][index],
      contacted: [4, 6, 5, 7, 6, 8, 9][index],
      responses: [1, 1, 2, 1, 2, 2, 3][index],
    })),
    reliabilityTrend: TREND_DATES.map((date, index) => ({
      date,
      reliability: [95.1, 96.4, 96.0, 97.2, 96.5, 97.0, 96.8][index],
      runsStarted: [12, 14, 13, 15, 14, 16, 15][index],
      failedRuns: [1, 0, 1, 0, 1, 0, 1][index],
    })),
  },
  memory: {
    summary: {
      memoriesLearned: metric(38, 6, 18.8),
      highImpactMemories: metric(7, 2, 40.0),
      averageImpact: metric(66.2, 2.4, 3.8),
      averageConfidence: metric(73.1, 1.8, 2.5),
    },
    impactTrend: TREND_DATES.map((date, index) => ({
      date,
      memoryWrites: [3, 5, 4, 6, 5, 7, 8][index],
      impactScore: [58, 61, 60, 64, 65, 66, 68][index],
      confidence: [68, 70, 69, 72, 73, 72, 74][index],
      highImpactMemories: [0, 1, 1, 1, 1, 1, 2][index],
    })),
    helpfulMemories: [],
    recentMemories: [],
    inventory: MEMORY_INVENTORY,
  },
  activity: {
    counts: {
      eventsReceived: metric(126, 14, 12.5),
      runsStarted: metric(99, 8, 8.8),
      failedEvents: metric(2, -1, -33.3, "down"),
      failedRuns: metric(3, -2, -40.0, "down"),
    },
    feed: ACTIVITY_FEED,
  },
};

const MEMORY_CATEGORIES = Array.from(
  new Set(MEMORY_INVENTORY.map((row) => row.category))
);

// ============================================================================
// Main demo page
// ============================================================================

export function DemoAgentOpsPage() {
  const [tab, setTab] = React.useState<AgentOpsTab>("overview");
  const [querySearch, setQuerySearch] = React.useState("");
  const [queryStatus, setQueryStatus] = React.useState("all");
  const [memorySearch, setMemorySearch] = React.useState("");
  const [memoryCategory, setMemoryCategory] = React.useState("all");
  const [activitySearch, setActivitySearch] = React.useState("");
  const [activityKind, setActivityKind] = React.useState("all");
  const [querySort, setQuerySort] = React.useState<
    "updated_desc" | "novelty_desc" | "performance_desc"
  >("updated_desc");
  const [memorySort, setMemorySort] =
    React.useState<AgentOpsMemorySort>("impact_desc");
  const [queryPageSize, setQueryPageSize] = React.useState(10);
  const [memoryPageSize, setMemoryPageSize] = React.useState(10);
  const [activityPageSize, setActivityPageSize] = React.useState(10);

  const data = MOCK_AGENT_OPS_DATA;

  // ── Stats rows (4 + 4), mirrors AgentOpsDashboard ─────────────────────

  const metricsRow1: StatMetricData[] = [
    metricCard(
      "learning-loop",
      "Learning loop",
      data.overview.metrics.healthScore,
      "composite",
      <HeartPulse className="h-4 w-4" />
    ),
    metricCard(
      "query-win-rate",
      "Query win rate",
      data.overview.metrics.queryWinRate,
      "activated after review",
      <Radar className="h-4 w-4" />,
      "default",
      "percent"
    ),
    metricCard(
      "qualification-precision",
      "Qualification precision",
      data.overview.metrics.qualificationPrecision,
      "qualified prospects",
      <BrainCircuit className="h-4 w-4" />,
      "default",
      "percent"
    ),
    metricCard(
      "outreach-effectiveness",
      "Outreach effectiveness",
      data.overview.metrics.outreachEffectiveness,
      "reply rate",
      <Cable className="h-4 w-4" />,
      "default",
      "percent"
    ),
  ];

  const metricsRow2: StatMetricData[] = [
    metricCard(
      "memories-learned",
      "Memories learned",
      data.overview.metrics.memoriesLearned,
      "this period",
      <BrainCircuit className="h-4 w-4" />
    ),
    metricCard(
      "average-memory-impact",
      "Avg memory impact",
      data.overview.metrics.averageMemoryImpact,
      "learned memories",
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
      "run-reliability",
      "Run reliability",
      data.overview.metrics.runReliability,
      "successful evaluator runs",
      <HeartPulse className="h-4 w-4" />,
      "default",
      "percent"
    ),
  ];

  const discoveryMetrics: StatMetricData[] = [
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
      "disc-query-win-rate",
      "Query win rate",
      data.discovery.stats.queryWinRate,
      "activated after review",
      <Cable className="h-4 w-4" />,
      "default",
      "percent"
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
  ];

  const qualityMetrics: StatMetricData[] = [
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
      "qual-reliability",
      "Run reliability",
      data.quality.summary.runReliability,
      "successful evaluator runs",
      <Cable className="h-4 w-4" />,
      "default",
      "percent"
    ),
  ];

  const memoryMetrics: StatMetricData[] = [
    metricCard(
      "mem-learned",
      "Memories learned",
      data.memory.summary.memoriesLearned,
      "this period",
      <BrainCircuit className="h-4 w-4" />
    ),
    metricCard(
      "mem-high-impact",
      "High-impact memories",
      data.memory.summary.highImpactMemories,
      "impact >= 80",
      <Bot className="h-4 w-4" />
    ),
    metricCard(
      "mem-average-impact",
      "Average impact",
      data.memory.summary.averageImpact,
      "learned memories",
      <Radar className="h-4 w-4" />
    ),
    metricCard(
      "mem-average-confidence",
      "Average confidence",
      data.memory.summary.averageConfidence,
      "learned memories",
      <Cable className="h-4 w-4" />,
      "default",
      "percent"
    ),
  ];

  const activityMetrics: StatMetricData[] = [
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
    metricCard(
      "act-failed-events",
      "Failed events",
      data.activity.counts.failedEvents,
      "errors",
      <Cable className="h-4 w-4" />,
      "destructive"
    ),
    metricCard(
      "act-failed-runs",
      "Failed runs",
      data.activity.counts.failedRuns,
      "errors",
      <Radar className="h-4 w-4" />,
      "destructive"
    ),
  ];

  // ── Filtered / sorted lists (same logic as the real dashboard) ─────────

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

  // The real dashboard filters/sorts/paginates memory server-side; the demo
  // applies the same semantics locally to the mock inventory.
  const filteredMemories = React.useMemo(() => {
    const rows = data.memory.inventory.filter((row) => {
      const matchesCategory =
        memoryCategory === "all" || row.category === memoryCategory;
      const needle = memorySearch.trim().toLowerCase();
      const matchesSearch =
        needle.length === 0 ||
        row.title.toLowerCase().includes(needle) ||
        row.summary.toLowerCase().includes(needle) ||
        row.category.toLowerCase().includes(needle);
      return matchesCategory && matchesSearch;
    });

    rows.sort((left, right) => {
      if (memorySort === "confidence_desc") {
        return right.confidence - left.confidence;
      }
      if (memorySort === "recent_desc") {
        return right.createdAt - left.createdAt;
      }
      return right.impactScore - left.impactScore;
    });

    return rows;
  }, [data, memoryCategory, memorySearch, memorySort]);

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

  // ── Layout (mirrors app/(webapp)/agent-ops/page.tsx) ──────────────────

  return (
    <PageLayout className="flex max-w-none flex-col overflow-hidden border-none">
      <PageHeader
        title="Agent observability"
        actions={
          <Select
            value={tab}
            onValueChange={(value) => setTab(value as AgentOpsTab)}
          >
            <SelectTrigger size="xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAB_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <PageContent className="scroll-fade min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-none p-4">
        <div className="flex min-h-0 gap-0">
          <div className="min-w-0 flex-1">
            <div className="space-y-4">
              <DemoDateRangeSelector />

              {/* ── Overview ─────────────────────────────────────────── */}
              {tab === "overview" && (
                <>
                  <StatsOverview key={`row1-${tab}`} metrics={metricsRow1} />
                  <StatsOverview key={`row2-${tab}`} metrics={metricsRow2} />
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <AgentOpsLineChart
                      title="Outcome quality over time"
                      config={{
                        qualityScore: {
                          label: "Outcome quality",
                          color: AGENT_OPS_PRIMARY_CHART_COLOR,
                        },
                      }}
                      data={data.overview.qualityTrend}
                      lines={[
                        {
                          dataKey: "qualityScore",
                          stroke: AGENT_OPS_PRIMARY_CHART_COLOR,
                        },
                      ]}
                    />
                    <AgentOpsBarChart
                      title="Learning loop output"
                      config={{
                        memoriesLearned: {
                          label: "Memories learned",
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
                      data={data.overview.selfImprovementTrend}
                      bars={[
                        {
                          dataKey: "memoriesLearned",
                          fill: AGENT_OPS_PRIMARY_CHART_COLOR,
                        },
                        {
                          dataKey: "queriesActivated",
                          fill: "hsl(var(--chart-2))",
                        },
                        {
                          dataKey: "qualifiedProspects",
                          fill: "hsl(var(--chart-3))",
                        },
                      ]}
                    />
                  </div>
                </>
              )}

              {/* ── Discovery ────────────────────────────────────────── */}
              {tab === "discovery" && (
                <div className="space-y-4">
                  <StatsOverview
                    key={`discovery-${tab}`}
                    metrics={discoveryMetrics}
                  />
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <AgentOpsAreaChart
                      title="Discovery growth"
                      config={{
                        keywords: {
                          label: "Keywords",
                          color: AGENT_OPS_PRIMARY_CHART_COLOR,
                        },
                        generated: {
                          label: "Generated",
                          color: "hsl(var(--chart-2))",
                        },
                        activated: {
                          label: "Activated",
                          color: "hsl(var(--chart-3))",
                        },
                      }}
                      data={data.discovery.growthSeries}
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
                    <AgentOpsBarChart
                      title="Novelty gate efficiency"
                      config={{
                        accepted: {
                          label: "Accepted",
                          color: AGENT_OPS_PRIMARY_CHART_COLOR,
                        },
                        exactDuplicates: {
                          label: "Exact dupes",
                          color: "hsl(var(--chart-4))",
                        },
                        semanticDuplicates: {
                          label: "Semantic dupes",
                          color: "hsl(var(--chart-3))",
                        },
                      }}
                      data={data.discovery.efficiencySeries}
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
                        value as
                          | "updated_desc"
                          | "novelty_desc"
                          | "performance_desc"
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
                          row.reviewedAt
                            ? new Date(row.reviewedAt).toISOString()
                            : "",
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
                          onOpenQuery={() => {
                            // Detail panel is Convex-backed; inert in the demo.
                          }}
                        />
                        <TablePagination
                          page={queryPages.page}
                          totalPages={queryPages.totalPages}
                          pageSize={queryPageSize}
                          pageSizeOptions={[5, 10, 20]}
                          onPageChange={(nextPage) =>
                            queryPages.setPage(nextPage)
                          }
                          onPageSizeChange={setQueryPageSize}
                          size="xs"
                        />
                      </>
                    )}
                  </InventoryCard>
                </div>
              )}

              {/* ── Quality ──────────────────────────────────────────── */}
              {tab === "quality" && (
                <div className="space-y-4">
                  <StatsOverview
                    key={`quality-${tab}`}
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
              {tab === "memory" && (
                <div className="space-y-4">
                  <StatsOverview
                    key={`memory-${tab}`}
                    metrics={memoryMetrics}
                  />
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <AgentOpsLineChart
                      title="Memory quality over time"
                      config={{
                        memoryWrites: {
                          label: "Writes",
                          color: "hsl(var(--chart-1))",
                        },
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
                      lines={[
                        {
                          dataKey: "memoryWrites",
                          stroke: "hsl(var(--chart-1))",
                        },
                        {
                          dataKey: "impactScore",
                          stroke: "hsl(var(--chart-2))",
                        },
                        {
                          dataKey: "confidence",
                          stroke: "hsl(var(--chart-3))",
                        },
                      ]}
                    />
                    <AgentOpsBarChart
                      title="High-impact memories over time"
                      config={{
                        memoryWrites: {
                          label: "Memories learned",
                          color: AGENT_OPS_PRIMARY_CHART_COLOR,
                        },
                        highImpactMemories: {
                          label: "High-impact",
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
                    onSearchChange={setMemorySearch}
                    filterValue={memoryCategory}
                    onFilterChange={setMemoryCategory}
                    filterOptions={[
                      ["all", "All categories"],
                      ...MEMORY_CATEGORIES.map(
                        (value) => [value, value] as const
                      ),
                    ]}
                    sortValue={memorySort}
                    onSortChange={(value) =>
                      setMemorySort(value as AgentOpsMemorySort)
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
                        description="Once the system captures reusable lessons in memory, they will show up here."
                      />
                    ) : (
                      <>
                        <MemoryTable
                          rows={memoryPages.items}
                          onOpen={() => {
                            // Detail panel is Convex-backed; inert in the demo.
                          }}
                        />
                        <TablePagination
                          page={memoryPages.page}
                          totalPages={memoryPages.totalPages}
                          pageSize={memoryPageSize}
                          pageSizeOptions={[5, 10, 20]}
                          onPageChange={memoryPages.setPage}
                          onPageSizeChange={setMemoryPageSize}
                          size="xs"
                        />
                      </>
                    )}
                  </InventoryCard>
                </div>
              )}

              {/* ── Activity ─────────────────────────────────────────── */}
              {tab === "activity" && (
                <div className="space-y-4">
                  <StatsOverview
                    key={`activity-${tab}`}
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
                    {filteredActivity.length === 0 ? (
                      <EmptyState
                        title="No recent activity"
                        description="As workflows, evaluator runs, and memory events execute, they will appear in this feed."
                      />
                    ) : (
                      <>
                        <ActivityTable
                          rows={activityPages.items}
                          onOpen={() => {
                            // Detail panel is Convex-backed; inert in the demo.
                          }}
                        />
                        <TablePagination
                          page={activityPages.page}
                          totalPages={activityPages.totalPages}
                          pageSize={activityPageSize}
                          pageSizeOptions={[5, 10, 20]}
                          onPageChange={(nextPage) =>
                            activityPages.setPage(nextPage)
                          }
                          onPageSizeChange={setActivityPageSize}
                          size="xs"
                        />
                      </>
                    )}
                  </InventoryCard>
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}

function metricCard(
  id: string,
  title: string,
  metric: AgentOpsMetric,
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

// ============================================================================
// DemoDateRangeSelector — exact DateRangeSelector markup, local state
// instead of nuqs URL params (the landing page must not touch the URL).
// ============================================================================

function DemoDateRangeSelector() {
  const [range, setRange] = React.useState<DateRangePreset>("7d");
  const [from, setFrom] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string | null>(null);

  const fromDate = React.useMemo(() => {
    const parsed = parseDateOnlyValue(from);
    return parsed
      ? new Date(parsed.year, parsed.month - 1, parsed.day)
      : undefined;
  }, [from]);
  const toDate = React.useMemo(() => {
    const parsed = parseDateOnlyValue(to);
    return parsed
      ? new Date(parsed.year, parsed.month - 1, parsed.day)
      : undefined;
  }, [to]);

  const customDaysLabel = React.useMemo(() => {
    const days = getInclusiveDayCount(fromDate ?? null, toDate ?? null);
    return days ? `${days}d` : "Custom";
  }, [fromDate, toDate]);

  const handlePresetChange = (value: string) => {
    const preset = value as DateRangePreset;
    if (preset === "custom") {
      setRange(preset);
    } else {
      setRange(preset);
      setFrom(null);
      setTo(null);
    }
  };

  const handleCustomRangeChange = (dateRange: DateRange | undefined) => {
    if (dateRange?.from && dateRange?.to) {
      setRange("custom");
      setFrom(formatDateOnlyValue(dateRange.from));
      setTo(formatDateOnlyValue(dateRange.to));
    } else if (dateRange?.from) {
      setRange("custom");
      setFrom(formatDateOnlyValue(dateRange.from));
      setTo(null);
    }
  };

  const customDateRange: DateRange | undefined =
    fromDate || toDate
      ? { from: fromDate ?? undefined, to: toDate ?? undefined }
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-3">
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

// ============================================================================
// InventoryCard — verbatim replica of the private component in
// AgentOpsDashboard.tsx
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
// EmptyState — verbatim replica
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
// CSV Export — verbatim replica (client-side only, no Convex)
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
// Tables — verbatim replicas of the private tables in AgentOpsDashboard.tsx
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
