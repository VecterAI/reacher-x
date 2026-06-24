"use client";

export type AgentOpsTab =
  | "overview"
  | "discovery"
  | "quality"
  | "memory"
  | "activity";

export type AgentOpsPanelKind =
  | "query"
  | "monitor"
  | "memory"
  | "event"
  | "run"
  | "suggestion";

export type AgentOpsMetric = {
  value: number;
  change: number;
  changePercent: number;
  trend: "up" | "down";
};

export type DiscoveryInventoryRow = {
  queryCandidateId: string;
  rawValue: string;
  canonicalValue: string;
  type: string;
  status: string;
  statusLabel: string;
  sourceTheme: string | null;
  noveltyScore: number | null;
  performanceScore: number | null;
  createdAt: number;
  reviewedAt: number | null;
  prospectsFound: number;
  qualifiedCount: number;
  convertedCount: number;
  replyRate: number;
  updatedAt: number;
};

export type MemoryInventoryRow = {
  memoryId: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  confidence: number;
  impactScore: number;
  relatedQueries: number;
  evidenceCount: number;
  createdAt: number;
};

export type AgentOpsActivityItem = {
  id: string;
  kind: "event" | "run" | "suggestion";
  title: string;
  description: string;
  status: string;
  timestamp: number;
  severity: "default" | "warning" | "destructive" | "success";
  linkedEntity: string | null;
};

export type AgentOpsDashboardData = {
  overview: {
    metrics: Record<
      | "healthScore"
      | "qualityScore"
      | "selfImprovementImpact"
      | "needsAttention"
      | "keywordsCreated"
      | "queriesGenerated"
      | "queriesActivated"
      | "replyRate",
      AgentOpsMetric
    >;
    qualityTrend: Array<{ date: string; qualityScore: number }>;
    selfImprovementTrend: Array<{
      date: string;
      duplicateWaste: number;
      noveltyYield: number;
      promotedMemories: number;
      replies: number;
    }>;
    bestQueries: Array<{
      queryCandidateId: string;
      label: string;
      replyRate: number;
      qualifiedCount: number;
      convertedCount: number;
      prospectsFound: number;
    }>;
    weakestQueries: Array<{
      queryCandidateId: string;
      label: string;
      replyRate: number;
      qualifiedCount: number;
      convertedCount: number;
      prospectsFound: number;
    }>;
    funnel: Array<{
      stage: "new" | "contacted" | "in_progress" | "converted";
      count: number;
      conversionRate: number | null;
      fill: string;
    }>;
    recentChanges: AgentOpsActivityItem[];
    blockedBreakdown: {
      pendingSuggestions: number;
      failedRuns: number;
      failedEvents: number;
      failingMonitors: number;
    };
  };
  discovery: {
    stats: {
      keywordsCreated: AgentOpsMetric;
      queriesGenerated: AgentOpsMetric;
      queriesActivated: AgentOpsMetric;
      duplicateRejectionRate: AgentOpsMetric;
    };
    growthSeries: Array<{
      date: string;
      keywords: number;
      generated: number;
      activated: number;
    }>;
    efficiencySeries: Array<{
      date: string;
      generated: number;
      accepted: number;
      exactDuplicates: number;
      semanticDuplicates: number;
    }>;
    bestQueries: Array<{
      queryCandidateId: string;
      label: string;
      replyRate: number;
      qualifiedCount: number;
      convertedCount: number;
      prospectsFound: number;
    }>;
    weakestQueries: Array<{
      queryCandidateId: string;
      label: string;
      replyRate: number;
      qualifiedCount: number;
      convertedCount: number;
      prospectsFound: number;
    }>;
    inventory: DiscoveryInventoryRow[];
  };
  quality: {
    summary: Record<
      | "qualificationPrecision"
      | "enrichmentUsefulness"
      | "outreachEffectiveness"
      | "correctionRate",
      AgentOpsMetric
    >;
    qualificationTrend: Array<{
      date: string;
      precision: number;
      completed: number;
    }>;
    enrichmentTrend: Array<{
      date: string;
      usefulness: number;
      completions: number;
    }>;
    outreachTrend: Array<{
      date: string;
      effectiveness: number;
      approvals: number;
      responses: number;
    }>;
    correctionTrend: Array<{
      date: string;
      corrections: number;
      editedApprovals: number;
      rejectedSuggestions: number;
    }>;
    scorecards: {
      convertedAvgScore: number;
      archivedAvgScore: number;
      inProgressCount: number;
      convertedCount: number;
    };
  };
  memory: {
    summary: Record<
      | "memoriesWritten"
      | "memoriesPromoted"
      | "suggestionsCreated"
      | "suggestionsRejected",
      AgentOpsMetric
    >;
    impactTrend: Array<{
      date: string;
      memoryWrites: number;
      impactScore: number;
      confidence: number;
    }>;
    helpfulMemories: MemoryInventoryRow[];
    recentPromotions: Array<{
      suggestionId: string;
      title: string;
      summary: string;
      source: string;
      category: string;
      status: string;
      updatedAt: number;
      promotedMemoryId: string | null;
    }>;
    inventory: MemoryInventoryRow[];
  };
  activity: {
    counts: {
      eventsReceived: AgentOpsMetric;
      runsStarted: AgentOpsMetric;
      failedEvents: number;
      failedRuns: number;
    };
    feed: AgentOpsActivityItem[];
  };
};
