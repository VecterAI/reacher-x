import { api } from "@/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import {
  buildMetric,
  buildPipelineFunnel,
  calculateRate,
  createEmptyAnalyticsData,
  createTrendBucketSet,
  normalizeAnalyticsWindow,
} from "@/convex/lib/analyticsCore";
import {
  getAgentOpsDashboardFields,
  getAgentOpsDashboardWindow,
  getAgentOpsTrendSlice,
} from "@/convex/lib/agentOpsDashboardCore";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";

type State = ReturnType<typeof createAppFixtures>;
type Memory = NonNullable<
  FunctionReturnType<typeof api.agentOps.getAgentOpsMemoryDetail>
>;
export const DEMO_MEMORY_INSTRUCTION =
  "Keep the first message under 80 words. Ask one question. Don't ask for a meeting in the first message.";

export function registerReportingServices(client: LocalClient, state: State) {
  const recordedAt = getCurrentUTCTimestamp();
  const memories = new Map<string, Memory>();
  const saveMemory = (instruction: string) => {
    const memory: Memory = {
      memoryId: "demo_memory_intro",
      title: "Short, question-led introductions",
      summary: instruction,
      createdAt: recordedAt,
      source: "operator",
      category: "operator_instruction",
      namespace: "lessons",
      confidence: 1,
      impactScore: 0.9,
      prospect: null,
      signals: [],
      evidence: [],
      relatedQueries: [],
      promotions: [],
      narrative:
        "Saved from an explicit instruction in the workspace Agent conversation.",
      memoryText: instruction,
      canonicalMemory: {
        memoryId: "demo_memory_intro",
        authority: "operator",
        kind: "instruction",
        status: "active",
        indexStatus: "ready",
        instruction,
        canonicalContent: instruction,
        surfaces: ["outreach"],
        channels: ["linkedin", "twitter"],
        indexError: null,
        updatedAt: recordedAt,
      },
    };
    memories.set(memory.memoryId, memory);
    return memory;
  };
  if (state.scenario !== "teach-reacherx-what-you-want")
    saveMemory(DEMO_MEMORY_INSTRUCTION);
  client.register(api.workspaceReporting.getWorkspaceReportingStatus, () => ({
    ready: true,
    status: "verified",
    aggregateVersion: 1,
    updatedAt: recordedAt,
  }));
  const analytics = (
    args: FunctionArgs<typeof api.analytics.getDashboardAnalyticsSnapshot>
  ) => {
    const window = normalizeAnalyticsWindow({
      ...args,
      nowMs: getCurrentUTCTimestamp(),
    });
    const buckets = createTrendBucketSet(window);
    const data = createEmptyAnalyticsData(buckets);
    const people = state.prospects.filter(
      (person) => person.workspaceId === args.workspaceId
    );
    const current = people.filter(
      (person) =>
        person._creationTime >= window.current.startMs &&
        person._creationTime < window.current.endMs
    );
    const contacted = current.filter(
      (person) =>
        person.status === "contacted" ||
        person.status === "in_progress" ||
        person.status === "converted"
    );
    const replied = contacted.filter(
      (person) =>
        person.status === "in_progress" || person.status === "converted"
    );
    const pendingPlans = [...state.plans.values()].filter(
      ({ plan }) =>
        plan.workspaceId === args.workspaceId && plan.status === "draft"
    ).length;
    const metric = (value: number) =>
      buildMetric({ currentValue: value, previousValue: 0 });
    data.newProspects = metric(current.length);
    data.responseRate = {
      ...buildMetric({
        currentValue: calculateRate(replied.length, contacted.length),
        previousValue: 0,
        valueDecimals: 1,
        changeDecimals: 2,
      }),
      contacted: contacted.length,
    };
    data.pendingApprovals = {
      ...metric(pendingPlans),
      plans: pendingPlans,
      tasks: 0,
    };
    const qualified = current.filter(
      (person) => person.qualificationStatus === "qualified"
    ).length;
    const disqualified = current.filter(
      (person) => person.qualificationStatus === "disqualified"
    ).length;
    data.processingSummary = {
      qualified: metric(qualified),
      ready: metric(current.filter((person) => person.readyAt).length),
      pending: metric(current.length - qualified - disqualified),
      disqualified: metric(disqualified),
    };
    data.qualificationDistribution = [
      { segment: "qualified", count: qualified },
      { segment: "disqualified", count: disqualified },
      { segment: "pending", count: current.length - qualified - disqualified },
    ];
    data.pipelineFunnel = buildPipelineFunnel({
      newCount: current.length,
      contactedCount: contacted.length,
      inProgressCount: replied.length,
      convertedCount: current.filter((person) => person.status === "converted")
        .length,
    });
    data.trendsOverTime = buckets.buckets.map((bucket) => ({
      date: bucket.label,
      prospects: current.filter(
        (person) =>
          person._creationTime >= bucket.startMs &&
          person._creationTime < bucket.endMs
      ).length,
      contacted: contacted.filter(
        (person) =>
          person._creationTime >= bucket.startMs &&
          person._creationTime < bucket.endMs
      ).length,
    }));
    data.platformDistribution = ["twitter", "linkedin"].map((platform) => ({
      platform: platform === "twitter" ? "X" : "LinkedIn",
      count: current.filter((person) => person.platform === platform).length,
    }));
    data.fitDistribution = data.fitDistribution.map((bucket) => {
      const [min, max] = bucket.range.split("-").map(Number);
      return {
        ...bucket,
        count: current.filter(
          (person) =>
            (person.qualificationScore ?? 0) >= min &&
            (person.qualificationScore ?? 0) <= max
        ).length,
      };
    });
    return { status: "success" as const, data, generatedAt: recordedAt };
  };
  client.register(api.analytics.getDashboardAnalytics, analytics);
  client.register(api.analytics.getDashboardAnalyticsSnapshot, analytics);

  const query = () => {
    const workspace = state.workspaces.find(
      (item) => item._id === state.selectedWorkspaceId
    )!;
    const people = state.prospects.filter(
      (person) =>
        person.workspaceId === workspace._id &&
        person.discoverySource === "search_post"
    );
    const terms = people[0]?.matchedKeywords?.length
      ? people[0].matchedKeywords
          .slice(0, 2)
          .map((term) => `"${term}"`)
          .join(" ")
      : (people[0]?.title ?? workspace.name);
    return {
      queryCandidateId: "demo_query_accessibility",
      rawValue: terms,
      canonicalValue: terms,
      type: "social_query" as const,
      status: "activated" as const,
      statusLabel: "Active",
      sourceTheme: workspace.name,
      noveltyScore: 0.92,
      performanceScore: 0.8,
      createdAt: recordedAt - 3600000,
      reviewedAt: recordedAt - 3500000,
      updatedAt: recordedAt - 600000,
      prospectsFound: people.length,
      qualifiedCount: people.filter(
        (person) => person.qualificationStatus === "qualified"
      ).length,
      convertedCount: 0,
      replyRate: 0,
    };
  };
  client.register(
    api.agentOps.getAgentOpsDiscoveryInventoryPageSnapshot,
    ({ search, status, pageSize = 10 }) => {
      const rows =
        (!search ||
          query().rawValue.toLowerCase().includes(search.toLowerCase())) &&
        (!status || status === query().status)
          ? [query()]
          : [];
      return {
        rows,
        page: 0,
        pageSize,
        totalCount: rows.length,
        totalPages: 1,
      };
    }
  );
  client.register(
    api.agentOps.getAgentOpsQueryDetail,
    ({ queryCandidateId }) =>
      queryCandidateId === query().queryCandidateId
        ? {
            ...query(),
            duplicateReason: null,
            retiredAt: null,
            activatedKeywordId: "demo_keyword_accessibility",
            keyword: {
              keywordId: "demo_keyword_accessibility",
              type: "social_query" as const,
              value: query().rawValue,
            },
            monitor: null,
            performance: {
              impressions: 18,
              prospectsFound: query().prospectsFound,
              qualifiedCount: query().qualifiedCount,
              convertedCount: 0,
              replyCount: 0,
              replyRate: 0,
              qualificationRate: calculateRate(
                query().qualifiedCount,
                query().prospectsFound
              ),
              lastUsedAt: query().updatedAt,
            },
            relatedEvents: [
              {
                eventId: "demo_event_query",
                eventType: "query_candidate_activated" as const,
                status: "processed" as const,
                occurredAt: query().updatedAt,
              },
            ],
          }
        : null
  );
  client.register(
    api.agentOps.getAgentOpsMemoryInventoryPageSnapshot,
    ({ search, category, page = 0 }) => {
      const rows = [...memories.values()]
        .filter(
          (memory) =>
            (!search ||
              `${memory.title} ${memory.summary}`
                .toLowerCase()
                .includes(search.toLowerCase())) &&
            (!category || category === "all" || category === memory.category)
        )
        .map((memory) => ({
          ...memory,
          relatedQueries: memory.relatedQueries.length,
          evidenceCount: memory.evidence.length,
        }));
      return {
        rows,
        page,
        totalCount: rows.length,
        totalPages: 1,
        availableCategories: ["operator_instruction"],
        continueCursor: null,
        isDone: true,
        scanned: rows.length,
      };
    }
  );
  client.register(
    api.agentOps.getAgentOpsMemoryDetail,
    ({ memoryId }) => memories.get(memoryId) ?? null
  );
  const activity = () => [
    {
      id: "demo_event_query",
      kind: "event" as const,
      title: "Discovery query activated",
      description: query().rawValue,
      status: "processed" as const,
      timestamp: query().updatedAt,
      severity: "success" as const,
      linkedEntity: query().queryCandidateId,
    },
  ];
  client.register(api.agentOps.getAgentOpsDashboardActivity, activity);
  client.register(api.agentOps.getAgentOpsEventDetail, ({ eventId }) =>
    eventId === "demo_event_query"
      ? {
          eventId,
          eventType: "query_candidate_activated" as const,
          status: "processed" as const,
          sourceType: "workspace" as const,
          sourceId: String(state.selectedWorkspaceId),
          workflowName: "Discovery",
          occurredAt: query().updatedAt,
          processedAt: query().updatedAt,
          evaluatorWorkflowId: null,
          error: null,
          payload: {
            query: query().rawValue,
            source: query().sourceTheme,
          },
          prospect: null,
          plan: null,
          task: null,
        }
      : null
  );
  const values: Record<string, number> = {
    hourlyKeywordsCreatedCounts: 1,
    hourlyQueriesGeneratedCounts: 1,
    hourlyQueriesReviewedCounts: 1,
    hourlyQueriesActivatedCounts: 1,
    hourlyQueriesRejectedExactDuplicateCounts: 0,
    hourlyQualificationCompletedCounts: 3,
    hourlyQualificationQualifiedCounts: 2,
    hourlyRunsStartedCounts: 0,
    hourlyEventsReceivedCounts: 1,
  };
  const slice = (
    args: FunctionArgs<typeof api.agentOps.getAgentOpsDashboardSummary>,
    kind: "summary" | "trend",
    offset = 0
  ) => {
    const { normalizedWindow } = getAgentOpsDashboardWindow(args);
    const windows =
      kind === "summary"
        ? [normalizedWindow.current, normalizedWindow.previous]
        : getAgentOpsTrendSlice(normalizedWindow, offset);
    const fields = getAgentOpsDashboardFields(args.tab, kind);
    const metricValues = {
      ...values,
      hourlyQualificationCompletedCounts: query().prospectsFound,
      hourlyQualificationQualifiedCounts: query().qualifiedCount,
      hourlyMemoriesWrittenCounts: memories.size,
      hourlyHighImpactMemoriesCounts: memories.size,
      hourlyMemoryImpactScoreSums: memories.size * 0.9,
      hourlyMemoryConfidenceSums: memories.size,
    };
    const inWindow = (startMs: number, endMs: number) =>
      query().updatedAt >= startMs && query().updatedAt < endMs;
    return {
      analytics: windows.map(() => fields.analytics.map(() => 0)),
      agentOps: windows.map((window) =>
        fields.agentOps.map((field) =>
          inWindow(window.startMs, window.endMs)
            ? (metricValues[field as keyof typeof metricValues] ?? 0)
            : 0
        )
      ),
    };
  };
  client.register(api.agentOps.getAgentOpsDashboardSummary, (args) => ({
    ...slice(args, "summary"),
    timeZone: "UTC",
  }));
  client.register(api.agentOps.getAgentOpsDashboardTrendSlice, (args) =>
    slice(args, "trend", args.offset)
  );
  return { memories, saveMemory };
}
