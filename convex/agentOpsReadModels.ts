import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import {
  listWorkspaceAgentMemoriesPage,
  type WorkspaceAgentMemoryRecord,
} from "./lib/agentMemoryCore";
import {
  createEmptyWorkspaceAgentOpsDailyRecord,
  getWorkspaceAgentOpsContributionsFromBuiltInMemory,
  getWorkspaceAgentOpsContributionsFromEvaluatorRun,
  getWorkspaceAgentOpsContributionsFromKeyword,
  getWorkspaceAgentOpsContributionsFromMemorySuggestion,
  getWorkspaceAgentOpsContributionsFromQueryCandidate,
  getWorkspaceAgentOpsContributionsFromWorkflowEvent,
  getWorkspaceQueryPerformanceDailyDeltasFromWorkflowEvent,
  isWorkspaceAgentOpsDailyRecordEmpty,
  isWorkspaceQueryPerformanceDailyRecordEmpty,
  mergeWorkspaceAgentOpsContributions,
  mergeWorkspaceQueryPerformanceDailyDelta,
  type TargetedWorkspaceAgentOpsContribution,
  type WorkspaceAgentOpsDailyRecord,
  type WorkspaceQueryPerformanceDailyRecord,
} from "./lib/agentOpsReadModelHelpers";
import { buildQueryCandidateCanonicalRecord } from "./lib/memoryHelpers";
import { getNumberProperty, isRecord } from "./lib/typeGuards";
import { memorySuggestionStatusValidator } from "./validators";

export const listWorkspaceKeywordsPageForReadModelInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { workspaceId, paginationOpts }) => {
    return await ctx.db
      .query("keywords")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .paginate(paginationOpts);
  },
});

export const listWorkspaceQueryCandidatesPageForReadModelInternal =
  internalQuery({
    args: {
      workspaceId: v.id("workspaces"),
      paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, { workspaceId, paginationOpts }) => {
      return await ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_updated_at", (q) =>
          q.eq("workspaceId", workspaceId)
        )
        .paginate(paginationOpts);
    },
  });

export const listWorkspaceMemorySuggestionsPageForReadModelInternal =
  internalQuery({
    args: {
      workspaceId: v.id("workspaces"),
      status: memorySuggestionStatusValidator,
      paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, { workspaceId, status, paginationOpts }) => {
      return await ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", status)
        )
        .paginate(paginationOpts);
    },
  });

export const listWorkspaceWorkflowEventsPageForReadModelInternal =
  internalQuery({
    args: {
      workspaceId: v.id("workspaces"),
      paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, { workspaceId, paginationOpts }) => {
      return await ctx.db
        .query("memoryWorkflowEvents")
        .withIndex("by_workspace_occurred_at", (q) =>
          q.eq("workspaceId", workspaceId)
        )
        .paginate(paginationOpts);
    },
  });

export const listWorkspaceEvaluatorRunsPageForReadModelInternal = internalQuery(
  {
    args: {
      workspaceId: v.id("workspaces"),
      paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, { workspaceId, paginationOpts }) => {
      return await ctx.db
        .query("memoryEvaluatorRuns")
        .withIndex("by_workspace_updated_at", (q) =>
          q.eq("workspaceId", workspaceId)
        )
        .paginate(paginationOpts);
    },
  }
);

export const listWorkspaceProspectsPageForReadModelInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { workspaceId, paginationOpts }) => {
    return await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .paginate(paginationOpts);
  },
});

export const listWorkspaceBuiltInMemoriesPageForReadModelInternal =
  internalQuery({
    args: {
      workspaceId: v.id("workspaces"),
      userId: v.id("users"),
      paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, { workspaceId, userId, paginationOpts }) => {
      return await listWorkspaceAgentMemoriesPage(ctx.db, {
        userId: String(userId),
        workspaceId: String(workspaceId),
        cursor: paginationOpts.cursor,
        limit: paginationOpts.numItems,
      });
    },
  });

export const replaceWorkspaceAgentOpsReadModelsInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentOpsRows: v.array(v.any()),
    queryPerformanceRows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existingAgentOpsRows = await ctx.db
      .query("workspaceAgentOpsDaily")
      .withIndex("by_workspace_day", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect();
    for (const row of existingAgentOpsRows) {
      await ctx.db.delete(row._id);
    }

    const existingQueryPerformanceRows = await ctx.db
      .query("workspaceQueryPerformanceDaily")
      .withIndex("by_workspace_day", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect();
    for (const row of existingQueryPerformanceRows) {
      await ctx.db.delete(row._id);
    }

    for (const row of args.agentOpsRows as WorkspaceAgentOpsDailyRecord[]) {
      await ctx.db.insert("workspaceAgentOpsDaily", row);
    }

    for (const row of args.queryPerformanceRows as WorkspaceQueryPerformanceDailyRecord[]) {
      await ctx.db.insert("workspaceQueryPerformanceDaily", row);
    }

    return {
      workspaceId: args.workspaceId,
      agentOpsRowsRebuilt: args.agentOpsRows.length,
      queryPerformanceRowsRebuilt: args.queryPerformanceRows.length,
    };
  },
});

export const rebuildWorkspaceAgentOpsReadModelsInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    { workspaceId }
  ): Promise<{
    workspaceId: Id<"workspaces">;
    agentOpsRowsRebuilt: number;
    queryPerformanceRowsRebuilt: number;
  }> => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId,
    });
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const agentOpsByDay = new Map<string, WorkspaceAgentOpsDailyRecord>();
    const queryPerformanceByDay = new Map<
      string,
      WorkspaceQueryPerformanceDailyRecord
    >();
    const keywordIdByCanonicalHash = new Map<string, Id<"keywords">>();
    const candidateIdByKeywordId = new Map<
      Id<"keywords">,
      Id<"queryCandidates"> | undefined
    >();
    const prospectById = new Map<
      string,
      Pick<Doc<"prospects">, "matchedKeywords" | "qualificationStatus">
    >();

    const KEYWORD_PAGE_SIZE = 100;
    const QUERY_CANDIDATE_PAGE_SIZE = 100;
    const MEMORY_SUGGESTION_PAGE_SIZE = 100;
    const BUILT_IN_MEMORY_PAGE_SIZE = 50;
    const PROSPECT_PAGE_SIZE = 100;
    const EVALUATOR_RUN_PAGE_SIZE = 100;
    const WORKFLOW_EVENT_PAGE_SIZE = 50;

    const applyAgentOpsContribution = (
      workspaceId: Id<"workspaces">,
      contribution: TargetedWorkspaceAgentOpsContribution
    ) => {
      const key = `${workspaceId}:${contribution.dayStartUtcMs}`;
      const current =
        agentOpsByDay.get(key) ??
        createEmptyWorkspaceAgentOpsDailyRecord({
          workspaceId,
          dayStartUtcMs: contribution.dayStartUtcMs,
        });
      const next = mergeWorkspaceAgentOpsContributions(current, {
        workspaceId,
        dayStartUtcMs: contribution.dayStartUtcMs,
        add: [contribution.contribution],
      });
      if (isWorkspaceAgentOpsDailyRecordEmpty(next)) {
        agentOpsByDay.delete(key);
      } else {
        agentOpsByDay.set(key, next);
      }
    };

    const applyQueryPerformanceDelta = (
      delta: Parameters<typeof mergeWorkspaceQueryPerformanceDailyDelta>[1]
    ) => {
      const dayKey = `${delta.workspaceId}:${delta.queryId}:${new Date(
        delta.timestamp
      )
        .toISOString()
        .slice(0, 10)}`;
      const current = queryPerformanceByDay.get(dayKey) ?? null;
      const next = mergeWorkspaceQueryPerformanceDailyDelta(current, delta);
      if (isWorkspaceQueryPerformanceDailyRecordEmpty(next)) {
        queryPerformanceByDay.delete(dayKey);
      } else {
        queryPerformanceByDay.set(dayKey, next);
      }
    };

    let keywordCursor: string | null = null;
    while (true) {
      const keywordPage = (await ctx.runQuery(
        internal.agentOpsReadModels
          .listWorkspaceKeywordsPageForReadModelInternal,
        {
          workspaceId,
          paginationOpts: {
            cursor: keywordCursor,
            numItems: KEYWORD_PAGE_SIZE,
          },
        }
      )) as {
        page: Doc<"keywords">[];
        continueCursor: string;
        isDone: boolean;
      };

      for (const keyword of keywordPage.page) {
        const canonicalHash =
          keyword.canonicalHash ??
          buildQueryCandidateCanonicalRecord({
            type: "social_query",
            value: keyword.originalValue ?? keyword.value,
          }).canonicalHash;
        keywordIdByCanonicalHash.set(canonicalHash, keyword._id);
        candidateIdByKeywordId.set(
          keyword._id,
          keyword.activatedQueryCandidateId
        );

        for (const contribution of getWorkspaceAgentOpsContributionsFromKeyword(
          keyword
        )) {
          applyAgentOpsContribution(workspaceId, contribution);
        }
      }

      if (keywordPage.isDone) {
        break;
      }
      keywordCursor = keywordPage.continueCursor;
    }

    let queryCandidateCursor: string | null = null;
    while (true) {
      const queryCandidatePage = (await ctx.runQuery(
        internal.agentOpsReadModels
          .listWorkspaceQueryCandidatesPageForReadModelInternal,
        {
          workspaceId,
          paginationOpts: {
            cursor: queryCandidateCursor,
            numItems: QUERY_CANDIDATE_PAGE_SIZE,
          },
        }
      )) as {
        page: Doc<"queryCandidates">[];
        continueCursor: string;
        isDone: boolean;
      };

      for (const candidate of queryCandidatePage.page) {
        for (const contribution of getWorkspaceAgentOpsContributionsFromQueryCandidate(
          candidate
        )) {
          applyAgentOpsContribution(workspaceId, contribution);
        }
      }

      if (queryCandidatePage.isDone) {
        break;
      }
      queryCandidateCursor = queryCandidatePage.continueCursor;
    }

    for (const suggestionStatus of [
      "pending_review",
      "promoted",
      "rejected",
    ] as const) {
      let memorySuggestionCursor: string | null = null;
      while (true) {
        const memorySuggestionPage = (await ctx.runQuery(
          internal.agentOpsReadModels
            .listWorkspaceMemorySuggestionsPageForReadModelInternal,
          {
            workspaceId,
            status: suggestionStatus,
            paginationOpts: {
              cursor: memorySuggestionCursor,
              numItems: MEMORY_SUGGESTION_PAGE_SIZE,
            },
          }
        )) as {
          page: Doc<"memorySuggestions">[];
          continueCursor: string;
          isDone: boolean;
        };

        for (const suggestion of memorySuggestionPage.page) {
          for (const contribution of getWorkspaceAgentOpsContributionsFromMemorySuggestion(
            suggestion
          )) {
            applyAgentOpsContribution(workspaceId, contribution);
          }
        }

        if (memorySuggestionPage.isDone) {
          break;
        }
        memorySuggestionCursor = memorySuggestionPage.continueCursor;
      }
    }

    let builtInMemoriesCursor: string | null = null;
    while (true) {
      const builtInMemoriesPage = (await ctx.runQuery(
        internal.agentOpsReadModels
          .listWorkspaceBuiltInMemoriesPageForReadModelInternal,
        {
          workspaceId,
          userId: workspace.userId,
          paginationOpts: {
            cursor: builtInMemoriesCursor,
            numItems: BUILT_IN_MEMORY_PAGE_SIZE,
          },
        }
      )) as {
        page: Array<Pick<WorkspaceAgentMemoryRecord, "createdAt" | "parsed">>;
        continueCursor: string;
        isDone: boolean;
      };

      for (const memory of builtInMemoriesPage.page) {
        for (const contribution of getWorkspaceAgentOpsContributionsFromBuiltInMemory(
          {
            workspaceId,
            memory,
          }
        )) {
          applyAgentOpsContribution(workspaceId, contribution);
        }
      }

      if (builtInMemoriesPage.isDone) {
        break;
      }
      builtInMemoriesCursor = builtInMemoriesPage.continueCursor;
    }

    let prospectCursor: string | null = null;
    while (true) {
      const prospectPage = (await ctx.runQuery(
        internal.agentOpsReadModels
          .listWorkspaceProspectsPageForReadModelInternal,
        {
          workspaceId,
          paginationOpts: {
            cursor: prospectCursor,
            numItems: PROSPECT_PAGE_SIZE,
          },
        }
      )) as {
        page: Doc<"prospects">[];
        continueCursor: string;
        isDone: boolean;
      };

      for (const prospect of prospectPage.page) {
        prospectById.set(String(prospect._id), {
          matchedKeywords: prospect.matchedKeywords,
          qualificationStatus: prospect.qualificationStatus,
        });
      }

      if (prospectPage.isDone) {
        break;
      }
      prospectCursor = prospectPage.continueCursor;
    }

    let evaluatorRunCursor: string | null = null;
    while (true) {
      const evaluatorRunPage = (await ctx.runQuery(
        internal.agentOpsReadModels
          .listWorkspaceEvaluatorRunsPageForReadModelInternal,
        {
          workspaceId,
          paginationOpts: {
            cursor: evaluatorRunCursor,
            numItems: EVALUATOR_RUN_PAGE_SIZE,
          },
        }
      )) as {
        page: Doc<"memoryEvaluatorRuns">[];
        continueCursor: string;
        isDone: boolean;
      };

      for (const run of evaluatorRunPage.page) {
        for (const contribution of getWorkspaceAgentOpsContributionsFromEvaluatorRun(
          run
        )) {
          applyAgentOpsContribution(workspaceId, contribution);
        }
      }

      if (evaluatorRunPage.isDone) {
        break;
      }
      evaluatorRunCursor = evaluatorRunPage.continueCursor;
    }

    let workflowEventCursor: string | null = null;
    while (true) {
      const workflowEventPage = (await ctx.runQuery(
        internal.agentOpsReadModels
          .listWorkspaceWorkflowEventsPageForReadModelInternal,
        {
          workspaceId,
          paginationOpts: {
            cursor: workflowEventCursor,
            numItems: WORKFLOW_EVENT_PAGE_SIZE,
          },
        }
      )) as {
        page: Doc<"memoryWorkflowEvents">[];
        continueCursor: string;
        isDone: boolean;
      };

      for (const event of workflowEventPage.page) {
        for (const contribution of getWorkspaceAgentOpsContributionsFromWorkflowEvent(
          event
        )) {
          applyAgentOpsContribution(workspaceId, contribution);
        }

        if (event.eventType === "query_search_executed" && event.queryId) {
          const payload = isRecord(event.payload) ? event.payload : undefined;
          const resultsCount = Math.max(
            0,
            getNumberProperty(payload, "resultsCount") ?? 0
          );
          applyQueryPerformanceDelta({
            workspaceId,
            queryId: event.queryId,
            activatedQueryCandidateId: candidateIdByKeywordId.get(
              event.queryId
            ),
            timestamp: event.occurredAt,
            impressionsDelta: 1,
            prospectsFoundDelta: resultsCount,
          });
        }

        const prospect = event.prospectId
          ? (prospectById.get(String(event.prospectId)) ?? null)
          : null;
        for (const delta of getWorkspaceQueryPerformanceDailyDeltasFromWorkflowEvent(
          {
            workspaceId,
            event,
            prospect,
            keywordIdByCanonicalHash,
            candidateIdByKeywordId,
          }
        )) {
          applyQueryPerformanceDelta(delta);
        }
      }

      if (workflowEventPage.isDone) {
        break;
      }
      workflowEventCursor = workflowEventPage.continueCursor;
    }

    return await ctx.runMutation(
      internal.agentOpsReadModels.replaceWorkspaceAgentOpsReadModelsInternal,
      {
        workspaceId,
        agentOpsRows: [...agentOpsByDay.values()],
        queryPerformanceRows: [...queryPerformanceByDay.values()],
      }
    );
  },
});
