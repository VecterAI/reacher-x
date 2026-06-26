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
  kind: "event" | "run" | "memory" | "suggestion";
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
      | "queryWinRate"
      | "qualificationPrecision"
      | "outreachEffectiveness"
      | "memoriesLearned"
      | "averageMemoryImpact"
      | "queriesActivated"
      | "runReliability",
      AgentOpsMetric
    >;
    qualityTrend: Array<{ date: string; qualityScore: number }>;
    selfImprovementTrend: Array<{
      date: string;
      memoriesLearned: number;
      queriesActivated: number;
      qualifiedProspects: number;
    }>;
  };
  discovery: {
    stats: {
      keywordsCreated: AgentOpsMetric;
      queriesGenerated: AgentOpsMetric;
      queryWinRate: AgentOpsMetric;
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
      | "runReliability",
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
      contacted: number;
      responses: number;
    }>;
    reliabilityTrend: Array<{
      date: string;
      reliability: number;
      runsStarted: number;
      failedRuns: number;
    }>;
  };
  memory: {
    summary: Record<
      | "memoriesLearned"
      | "highImpactMemories"
      | "averageImpact"
      | "averageConfidence",
      AgentOpsMetric
    >;
    impactTrend: Array<{
      date: string;
      memoryWrites: number;
      impactScore: number;
      confidence: number;
      highImpactMemories: number;
    }>;
    helpfulMemories: MemoryInventoryRow[];
    recentMemories: Array<{
      memoryId: string;
      title: string;
      summary: string;
      source: string;
      category: string;
      createdAt: number;
      impactScore: number;
      confidence: number;
    }>;
    inventory: MemoryInventoryRow[];
  };
  activity: {
    counts: {
      eventsReceived: AgentOpsMetric;
      runsStarted: AgentOpsMetric;
      failedEvents: AgentOpsMetric;
      failedRuns: AgentOpsMetric;
    };
    feed: AgentOpsActivityItem[];
  };
};
