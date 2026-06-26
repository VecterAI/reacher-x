import { v } from "convex/values";
import { query } from "./lib/functionBuilders";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  requireOwnedWorkspace,
  requireUser,
  getOwnedWorkspace,
  getUserByIdentity,
} from "./lib/accessHelpers";
import {
  agentOpsTabValidator,
  analyticsDateRangeValidator,
} from "./validators";
import {
  createTrendBucketSet,
  normalizeAnalyticsWindow,
  type TimeWindow,
} from "./lib/analyticsCore";
import { listWorkspaceAnalyticsDailyRows } from "./workspaceAnalyticsDaily";
import { listWorkspaceAgentOpsDailyRows } from "./workspaceAgentOpsDaily";
import { buildAgentOpsDashboardData } from "./lib/agentOpsCore";
import {
  getWorkspaceAgentMemoryById,
  listWorkspaceAgentMemoryInventoryInWindow,
} from "./lib/agentMemoryCore";
import { getUtcDayStartTimestamp } from "./lib/readModelHelpers";
import { listWorkspaceQueryPerformanceDailyRows } from "./workspaceQueryPerformanceDaily";

async function requireOwnedWorkspaceContext(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
) {
  const user = await requireUser(ctx, { notFoundMessage: "User not found" });
  const workspace = await requireOwnedWorkspace(ctx, workspaceId, {
    user,
    notFoundMessage: "Workspace not found",
    notAuthorizedMessage: "Workspace not found",
  });
  return { user, workspace };
}

function getWindowDayRange(window: TimeWindow) {
  const clampedEndMs = Math.max(window.startMs, window.endMs - 1);
  return {
    startDayStartUtcMs: getUtcDayStartTimestamp(window.startMs),
    endDayStartUtcMs: getUtcDayStartTimestamp(clampedEndMs),
  };
}

export const getAgentOpsDashboard = query({
  args: {
    workspaceId: v.id("workspaces"),
    range: analyticsDateRangeValidator,
    tab: v.optional(agentOpsTabValidator),
    timeZone: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireOwnedWorkspaceContext(
      ctx,
      args.workspaceId
    );
    const selectedTab = args.tab ?? "overview";

    const normalizedWindow = normalizeAnalyticsWindow({
      range: args.range,
      timeZone: workspace.reportingTimeZone ?? args.timeZone,
      from: args.from,
      to: args.to,
      fromDate: args.fromDate,
      toDate: args.toDate,
    });

    const bucketSet = createTrendBucketSet(normalizedWindow);
    const currentDayRange = getWindowDayRange(normalizedWindow.current);
    const previousDayRange = getWindowDayRange(normalizedWindow.previous);

    const startDayStartUtcMs = Math.min(
      currentDayRange.startDayStartUtcMs,
      previousDayRange.startDayStartUtcMs
    );
    const endDayStartUtcMs = Math.max(
      currentDayRange.endDayStartUtcMs,
      previousDayRange.endDayStartUtcMs
    );
    const shouldLoadDiscovery = selectedTab === "discovery";
    const shouldLoadMemory = selectedTab === "memory";
    const shouldLoadActivity = selectedTab === "activity";
    const shouldLoadMemoryInventory = shouldLoadMemory || shouldLoadActivity;

    const [
      analyticsRows,
      agentOpsRows,
      queryCandidates,
      queryPerformanceDailyRows,
      workflowEvents,
      evaluatorRuns,
      suggestionPending,
      suggestionPromoted,
      suggestionRejected,
      memoryInventoryRows,
    ] = await Promise.all([
      listWorkspaceAnalyticsDailyRows({
        db: ctx.db,
        workspaceId: args.workspaceId,
        startDayStartUtcMs,
        endDayStartUtcMs,
      }),
      listWorkspaceAgentOpsDailyRows({
        db: ctx.db,
        workspaceId: args.workspaceId,
        startDayStartUtcMs,
        endDayStartUtcMs,
      }),
      shouldLoadDiscovery
        ? ctx.db
            .query("queryCandidates")
            .withIndex("by_workspace_updated_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .gte("updatedAt", normalizedWindow.current.startMs)
                .lte("updatedAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .collect()
        : Promise.resolve([]),
      shouldLoadDiscovery
        ? listWorkspaceQueryPerformanceDailyRows({
            db: ctx.db,
            workspaceId: args.workspaceId,
            startDayStartUtcMs: currentDayRange.startDayStartUtcMs,
            endDayStartUtcMs: currentDayRange.endDayStartUtcMs,
          })
        : Promise.resolve([]),
      shouldLoadActivity
        ? ctx.db
            .query("memoryWorkflowEvents")
            .withIndex("by_workspace_occurred_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .gte("occurredAt", normalizedWindow.current.startMs)
                .lte("occurredAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(80)
        : Promise.resolve([]),
      shouldLoadActivity
        ? ctx.db
            .query("memoryEvaluatorRuns")
            .withIndex("by_workspace_updated_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .gte("updatedAt", normalizedWindow.current.startMs)
                .lte("updatedAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(80)
        : Promise.resolve([]),
      shouldLoadActivity
        ? ctx.db
            .query("memorySuggestions")
            .withIndex("by_workspace_status_updated_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("status", "pending_review")
                .gte("updatedAt", normalizedWindow.current.startMs)
                .lte("updatedAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(20)
        : Promise.resolve([]),
      shouldLoadActivity || shouldLoadMemory
        ? ctx.db
            .query("memorySuggestions")
            .withIndex("by_workspace_status_updated_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("status", "promoted")
                .gte("updatedAt", normalizedWindow.current.startMs)
                .lte("updatedAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(20)
        : Promise.resolve([]),
      shouldLoadActivity || shouldLoadMemory
        ? ctx.db
            .query("memorySuggestions")
            .withIndex("by_workspace_status_updated_at", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("status", "rejected")
                .gte("updatedAt", normalizedWindow.current.startMs)
                .lte("updatedAt", normalizedWindow.current.endMs)
            )
            .order("desc")
            .take(20)
        : Promise.resolve([]),
      shouldLoadMemoryInventory
        ? listWorkspaceAgentMemoryInventoryInWindow(ctx.db, {
            workspaceId: args.workspaceId,
            startMs: shouldLoadMemory
              ? Math.min(
                  normalizedWindow.current.startMs,
                  normalizedWindow.previous.startMs
                )
              : normalizedWindow.current.startMs,
            endMs: shouldLoadMemory
              ? Math.max(
                  normalizedWindow.current.endMs,
                  normalizedWindow.previous.endMs
                )
              : normalizedWindow.current.endMs,
          })
        : Promise.resolve([]),
    ]);

    return buildAgentOpsDashboardData({
      bucketSet,
      currentWindow: normalizedWindow.current,
      previousWindow: normalizedWindow.previous,
      analyticsRows,
      agentOpsRows,
      queryCandidates,
      queryPerformanceDailyRows,
      workflowEvents,
      evaluatorRuns,
      memorySuggestions: [
        ...suggestionPending,
        ...suggestionPromoted,
        ...suggestionRejected,
      ].sort((left, right) => right.updatedAt - left.updatedAt),
      memoryInventoryRows,
    });
  },
});

export const getAgentOpsQueryDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    queryCandidateId: v.id("queryCandidates"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const candidate = await ctx.db.get(args.queryCandidateId);
    if (!candidate || candidate.workspaceId !== args.workspaceId) {
      return null;
    }

    const [performance, keyword, monitor, relatedEvents] = await Promise.all([
      ctx.db
        .query("queryPerformance")
        .withIndex("by_workspace_updated_at", (q) =>
          q.eq("workspaceId", args.workspaceId)
        )
        .filter((q) =>
          q.eq(q.field("activatedQueryCandidateId"), args.queryCandidateId)
        )
        .first(),
      candidate.activatedKeywordId
        ? ctx.db.get(candidate.activatedKeywordId)
        : Promise.resolve(null),
      candidate.activatedKeywordId
        ? ctx.db
            .query("socialQueryMonitors")
            .withIndex("by_keyword", (q) =>
              q.eq("keywordId", candidate.activatedKeywordId!)
            )
            .first()
        : Promise.resolve(null),
      ctx.db
        .query("memoryWorkflowEvents")
        .withIndex("by_workspace_occurred_at", (q) =>
          q.eq("workspaceId", args.workspaceId)
        )
        .order("desc")
        .collect()
        .then((rows) =>
          rows
            .filter(
              (row) =>
                row.queryCandidateId === args.queryCandidateId ||
                row.queryId === candidate.activatedKeywordId
            )
            .slice(0, 10)
        ),
    ]);

    return {
      queryCandidateId: String(candidate._id),
      rawValue: candidate.rawValue,
      canonicalValue: candidate.canonicalValue,
      type: candidate.type,
      status: candidate.status,
      sourceTheme: candidate.sourceTheme ?? null,
      noveltyScore: candidate.noveltyScore ?? null,
      duplicateReason: candidate.duplicateReason ?? null,
      performanceScore: candidate.performanceScore ?? null,
      updatedAt: candidate.updatedAt,
      reviewedAt: candidate.reviewedAt ?? null,
      retiredAt: candidate.retiredAt ?? null,
      activatedKeywordId: candidate.activatedKeywordId
        ? String(candidate.activatedKeywordId)
        : null,
      performance: performance
        ? {
            impressions: performance.impressions,
            prospectsFound: performance.prospectsFound,
            qualifiedCount: performance.qualifiedCount,
            convertedCount: performance.convertedCount,
            replyCount: performance.replyCount,
            replyRate: performance.replyRate,
            qualificationRate: performance.qualificationRate,
            lastUsedAt: performance.lastUsedAt ?? null,
          }
        : null,
      monitor: monitor
        ? {
            monitorId: String(monitor._id),
            status: monitor.status,
            healthStatus: monitor.healthStatus ?? null,
            totalProspectsFound: monitor.totalProspectsFound ?? 0,
            lastWebhookAt: monitor.lastWebhookAt ?? null,
            lastError: monitor.lastErrorMessage ?? null,
          }
        : null,
      keyword: keyword
        ? {
            keywordId: String(keyword._id),
            type: keyword.type,
            value: keyword.originalValue ?? keyword.value,
          }
        : null,
      relatedEvents: relatedEvents.map((event) => ({
        eventId: String(event._id),
        eventType: event.eventType,
        status: event.status,
        occurredAt: event.occurredAt,
      })),
    };
  },
});

export const getAgentOpsMonitorDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    monitorId: v.id("socialQueryMonitors"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor || monitor.workspaceId !== args.workspaceId) {
      return null;
    }

    const [keyword, performance] = await Promise.all([
      monitor.keywordId
        ? ctx.db
            .get(monitor.keywordId)
            .then((row) => row as Doc<"keywords"> | null)
        : Promise.resolve(null),
      monitor.keywordId
        ? ctx.db
            .query("queryPerformance")
            .withIndex("by_workspace_query_id", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("queryId", monitor.keywordId!)
            )
            .first()
        : Promise.resolve(null),
    ]);

    return {
      monitorId: String(monitor._id),
      status: monitor.status,
      healthStatus: monitor.healthStatus ?? null,
      monitorExternalId: monitor.monitorId,
      query:
        keyword?.originalValue ??
        keyword?.value ??
        monitor.query ??
        "Unknown query",
      refreshFrequency: monitor.refreshFrequency,
      totalProspectsFound: monitor.totalProspectsFound ?? 0,
      lastWebhookAt: monitor.lastWebhookAt ?? null,
      lastError: monitor.lastErrorMessage ?? null,
      createdAt: monitor._creationTime,
      performance: performance
        ? {
            prospectsFound: performance.prospectsFound,
            qualifiedCount: performance.qualifiedCount,
            convertedCount: performance.convertedCount,
            replyRate: performance.replyRate,
            qualificationRate: performance.qualificationRate,
          }
        : null,
    };
  },
});

export const getAgentOpsMemoryDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const memory = await getWorkspaceAgentMemoryById(ctx.db, {
      userId: String(user._id),
      workspaceId: String(args.workspaceId),
      memoryId: args.memoryId,
    });
    if (!memory) {
      return null;
    }

    const [prospect, suggestions, queryCandidates] = await Promise.all([
      memory.parsed.prospectId
        ? ctx.db.get(memory.parsed.prospectId as Id<"prospects">)
        : Promise.resolve(null),
      ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", "promoted")
        )
        .order("desc")
        .collect()
        .then((rows) =>
          rows
            .filter((row) => row.promotedMemoryId === memory.memoryId)
            .slice(0, 5)
        ),
      ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_updated_at", (q) =>
          q.eq("workspaceId", args.workspaceId)
        )
        .order("desc")
        .collect()
        .then((rows) =>
          rows.filter((row) =>
            memory.parsed.relatedQueries.some(
              (related) =>
                related.toLowerCase() === row.rawValue.toLowerCase() ||
                related.toLowerCase() === row.canonicalValue.toLowerCase()
            )
          )
        ),
    ]);

    return {
      memoryId: memory.memoryId,
      createdAt: memory.createdAt,
      title: memory.parsed.title,
      summary: memory.parsed.summary,
      source: memory.parsed.source,
      category: memory.parsed.category,
      namespace: memory.parsed.namespace,
      confidence: memory.parsed.confidence,
      impactScore: memory.parsed.impactScore,
      prospect: prospect
        ? {
            prospectId: String(prospect._id),
            displayName: prospect.displayName || prospect.title || "Unknown",
            title: prospect.title ?? null,
          }
        : null,
      signals: memory.parsed.signals,
      evidence: memory.parsed.evidence,
      relatedQueries: queryCandidates.map((row) => ({
        queryCandidateId: String(row._id),
        rawValue: row.rawValue,
        status: row.status,
      })),
      promotions: suggestions.map((row) => ({
        suggestionId: String(row._id),
        updatedAt: row.updatedAt,
        status: row.status,
      })),
      narrative: memory.parsed.narrative,
      memoryText: memory.memoryText,
    };
  },
});

export const getAgentOpsEventDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    eventId: v.id("memoryWorkflowEvents"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.workspaceId !== args.workspaceId) {
      return null;
    }

    const [prospect, plan, task] = await Promise.all([
      event.prospectId ? ctx.db.get(event.prospectId) : Promise.resolve(null),
      event.planId ? ctx.db.get(event.planId) : Promise.resolve(null),
      event.taskId ? ctx.db.get(event.taskId) : Promise.resolve(null),
    ]);

    return {
      eventId: String(event._id),
      eventType: event.eventType,
      status: event.status,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      workflowName: event.workflowName ?? null,
      occurredAt: event.occurredAt,
      processedAt: event.processedAt ?? null,
      evaluatorWorkflowId: event.evaluatorWorkflowId ?? null,
      error: event.error ?? null,
      payload: event.payload ?? null,
      prospect: prospect
        ? {
            prospectId: String(prospect._id),
            displayName: prospect.displayName || prospect.title || "Unknown",
          }
        : null,
      plan: plan ? { planId: String(plan._id), status: plan.status } : null,
      task: task ? { taskId: String(task._id), status: task.status } : null,
    };
  },
});

export const getAgentOpsRunDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    runId: v.id("memoryEvaluatorRuns"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const run = await ctx.db.get(args.runId);
    if (!run || run.workspaceId !== args.workspaceId) {
      return null;
    }

    const [event, suggestions] = await Promise.all([
      ctx.db.get(run.eventId),
      ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", "promoted")
        )
        .order("desc")
        .collect()
        .then((rows) =>
          rows.filter((row) => row.runId === String(run._id)).slice(0, 10)
        ),
    ]);

    return {
      runId: String(run._id),
      status: run.status,
      eventType: run.eventType,
      sourceType: run.sourceType,
      sourceId: run.sourceId,
      promptVersion: run.promptVersion ?? null,
      model: run.model ?? null,
      summary: run.summary ?? null,
      ignoredReason: run.ignoredReason ?? null,
      error: run.error ?? null,
      promotedMemoryCount: run.promotedMemoryCount,
      suggestedMemoryCount: run.suggestedMemoryCount,
      queryPerformanceUpdateCount: run.queryPerformanceUpdateCount,
      retrievalStats: run.retrievalStats ?? null,
      startedAt: run.startedAt ?? null,
      completedAt: run.completedAt ?? null,
      relatedEvent: event
        ? {
            eventId: String(event._id),
            eventType: event.eventType,
            status: event.status,
          }
        : null,
      suggestions: suggestions.map((row) => ({
        suggestionId: String(row._id),
        title: row.title,
        status: row.status,
        promotedMemoryId: row.promotedMemoryId ?? null,
      })),
    };
  },
});

export const getAgentOpsSuggestionDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    suggestionId: v.id("memorySuggestions"),
  },
  handler: async (ctx, args) => {
    await requireOwnedWorkspaceContext(ctx, args.workspaceId);
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion || suggestion.workspaceId !== args.workspaceId) {
      return null;
    }

    const [prospect, memory] = await Promise.all([
      suggestion.prospectId
        ? ctx.db.get(suggestion.prospectId)
        : Promise.resolve(null),
      suggestion.promotedMemoryId
        ? getAgentOpsMemoryDetailFromSuggestion(
            ctx,
            args.workspaceId,
            suggestion.promotedMemoryId
          )
        : Promise.resolve(null),
    ]);

    return {
      suggestionId: String(suggestion._id),
      status: suggestion.status,
      title: suggestion.title,
      summary: suggestion.summary,
      source: suggestion.source,
      category: suggestion.category,
      confidence: suggestion.confidence,
      impactScore: suggestion.impactScore,
      signals: suggestion.signals,
      evidence: suggestion.evidence,
      relatedQueries: suggestion.relatedQueries,
      narrative: suggestion.narrative,
      updatedAt: suggestion.updatedAt,
      reviewedAt: suggestion.reviewedAt ?? null,
      promotedMemoryId: suggestion.promotedMemoryId ?? null,
      prospect: prospect
        ? {
            prospectId: String(prospect._id),
            displayName: prospect.displayName || prospect.title || "Unknown",
          }
        : null,
      promotedMemory: memory,
    };
  },
});

async function getAgentOpsMemoryDetailFromSuggestion(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  memoryId: string
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await getUserByIdentity(ctx, identity);
  if (!user) {
    return null;
  }

  const workspace = await getOwnedWorkspace(ctx, workspaceId, user._id);
  if (!workspace) {
    return null;
  }

  const memory = await getWorkspaceAgentMemoryById(ctx.db, {
    userId: String(user._id),
    workspaceId: String(workspace._id),
    memoryId,
  });

  if (!memory) {
    return null;
  }

  return {
    memoryId: memory.memoryId,
    title: memory.parsed.title,
    summary: memory.parsed.summary,
    createdAt: memory.createdAt,
  };
}
