import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc, TableNames } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { polar } from "../polar";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./functionBuilders";
import { reconcilePlanUsageForUser } from "./planUsageCore";
import { deleteWorkspaceAgentMemoryBatch } from "./agentMemoryCore";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { clearWorkspaceReportingAggregate } from "./workspaceReportingAggregate";

export const WORKSPACE_DELETE_BATCH_SIZE = 25;
const SWEEP_BATCH_SIZE = 25;
const THREAD_DELETE_BATCH_SIZE = 25;
const PROSPECT_DELETE_BATCH_SIZE = 10;
const OUTREACH_PLAN_DELETE_BATCH_SIZE = 10;
/**
 * Wall-clock budget for one batched deletion action step. The action always
 * fully finishes the item it starts, then stops between items once past this
 * budget, so every step makes progress and the durable workflow journal stays
 * small enough to reload (the workflow component fails a workflow whose
 * journal exceeds 8 MiB with "Failed to load journal").
 */
const DELETE_ACTION_BUDGET_MS = 45_000;

async function deleteDocuments<TableName extends TableNames>(
  ctx: MutationCtx,
  rows: Array<Doc<TableName>>
): Promise<number> {
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length;
}

async function deleteVoiceNoteUploadIntents(
  ctx: MutationCtx,
  rows: Array<Doc<"outboundVoiceNoteUploadIntents">>
): Promise<number> {
  for (const row of rows) {
    const cached = row.cacheId ? await ctx.db.get(row.cacheId) : null;
    const storageId = cached?.storageId ?? row.storageId;
    if (storageId && (await ctx.db.system.get("_storage", storageId))) {
      await ctx.storage.delete(storageId);
    }
    if (cached) {
      await ctx.db.delete(cached._id);
    }
    await ctx.db.delete(row._id);
  }
  return rows.length;
}

export const sweepWorkspaceRowsInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const w = args.workspaceId;
    const n = SWEEP_BATCH_SIZE;
    const [
      profileChanges,
      styleProfiles,
      keywords,
      auditItems,
      memoryQueues,
      mediaUploads,
      attachmentStats,
      conversationMessages,
      conversations,
      outboundOperations,
      voiceNoteUploadIntents,
      socialMonitors,
      replyCandidates,
      conversationSeeds,
      discoveryEdges,
      prospectMonitors,
      providerEvents,
      messageContexts,
      targetSelections,
      prospectSummaries,
      feedAnchors,
      prospectViews,
      workspaceStats,
      workspaceStatsStripes,
      analytics,
      analyticsStripes,
      agentOps,
      agentOpsStripes,
      reportingRollouts,
      agentSettings,
      queryPerformance,
      queryCandidates,
      queryPerformanceDaily,
      memoryEvents,
      memorySuggestions,
      memoryRuns,
      notifications,
      actionRequests,
      planStartRuns,
      autoPlanRuns,
      groundingCache,
      recoveryMonitors,
      activityLogs,
      interactionEvents,
      planRevisions,
    ] = await Promise.all([
      ctx.db
        .query("workspaceProfileChangeRequests")
        .withIndex("by_workspace_id_and_status", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceStyleProfiles")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("keywords")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("qualificationAuditItems")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("memoryEvaluationWorkspaceQueues")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("mediaUploads")
        .withIndex("by_workspace_uploaded_at", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceAttachmentStats")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("platformConversationMessages")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("platformConversations")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("outboundMessageOperations")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("outboundVoiceNoteUploadIntents")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("twitterReplyDiscoveryCandidates")
        .withIndex("by_workspace_status", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("twitterConversationSeeds")
        .withIndex("by_workspace_status", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("discoveryEdges")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("prospectMonitors")
        .withIndex("by_workspace_status", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("providerRequestEvents")
        .withIndex("by_workspace_recorded_at", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("agentMessageContexts")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("agentThreadTargetSelections")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("prospectListFeedAnchors")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("prospectViews")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", args.userId).eq("workspaceId", w)
        )
        .take(n),
      ctx.db
        .query("workspaceStats")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceStatsStripes")
        .withIndex("by_workspace_and_stripe", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceAnalyticsDaily")
        .withIndex("by_workspace_day", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceAnalyticsDailyStripes")
        .withIndex("by_workspace_day_and_stripe", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceAgentOpsDaily")
        .withIndex("by_workspace_day", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceAgentOpsDailyStripes")
        .withIndex("by_workspace_day_and_stripe", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceReportingRollouts")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceAgentSettings")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("queryPerformance")
        .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("queryCandidates")
        .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspaceQueryPerformanceDaily")
        .withIndex("by_workspace_day", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("memoryWorkflowEvents")
        .withIndex("by_workspace_occurred_at", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("memorySuggestions")
        .withIndex("by_workspace_status_updated_at", (q) =>
          q.eq("workspaceId", w)
        )
        .take(n),
      ctx.db
        .query("memoryEvaluatorRuns")
        .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("outreachNotifications")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("agentActionRequests")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("workspacePlanStartRuns")
        .withIndex("by_workspace_and_updated_at", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("autoPlanRuns")
        .withIndex("by_workspace_and_status", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("autoPlanGroundingCache")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("prospectActivityLog")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("outreachInteractionEvents")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
      ctx.db
        .query("outreachPlanRevisions")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", w))
        .take(n),
    ]);

    let deleted = 0;
    for (const upload of mediaUploads) {
      await ctx.storage.delete(upload.storageId);
      await ctx.db.delete(upload._id);
      deleted += 1;
    }
    deleted += await deleteDocuments(ctx, profileChanges);
    deleted += await deleteDocuments(ctx, styleProfiles);
    deleted += await deleteDocuments(ctx, keywords);
    deleted += await deleteDocuments(ctx, auditItems);
    deleted += await deleteDocuments(ctx, memoryQueues);
    deleted += await deleteDocuments(ctx, attachmentStats);
    deleted += await deleteDocuments(ctx, conversationMessages);
    deleted += await deleteDocuments(ctx, conversations);
    deleted += await deleteDocuments(ctx, outboundOperations);
    deleted += await deleteVoiceNoteUploadIntents(ctx, voiceNoteUploadIntents);
    deleted += await deleteDocuments(ctx, socialMonitors);
    deleted += await deleteDocuments(ctx, replyCandidates);
    deleted += await deleteDocuments(ctx, conversationSeeds);
    deleted += await deleteDocuments(ctx, discoveryEdges);
    deleted += await deleteDocuments(ctx, prospectMonitors);
    deleted += await deleteDocuments(ctx, providerEvents);
    deleted += await deleteDocuments(ctx, messageContexts);
    deleted += await deleteDocuments(ctx, targetSelections);
    deleted += await deleteDocuments(ctx, prospectSummaries);
    deleted += await deleteDocuments(ctx, feedAnchors);
    deleted += await deleteDocuments(ctx, prospectViews);
    deleted += await deleteDocuments(ctx, workspaceStats);
    deleted += await deleteDocuments(ctx, workspaceStatsStripes);
    deleted += await deleteDocuments(ctx, analytics);
    deleted += await deleteDocuments(ctx, analyticsStripes);
    deleted += await deleteDocuments(ctx, agentOps);
    deleted += await deleteDocuments(ctx, agentOpsStripes);
    deleted += await deleteDocuments(ctx, reportingRollouts);
    deleted += await deleteDocuments(ctx, agentSettings);
    deleted += await deleteDocuments(ctx, queryPerformance);
    deleted += await deleteDocuments(ctx, queryCandidates);
    deleted += await deleteDocuments(ctx, queryPerformanceDaily);
    deleted += await deleteDocuments(ctx, memoryEvents);
    deleted += await deleteDocuments(ctx, memorySuggestions);
    deleted += await deleteDocuments(ctx, memoryRuns);
    deleted += await deleteDocuments(ctx, notifications);
    deleted += await deleteDocuments(ctx, actionRequests);
    deleted += await deleteDocuments(ctx, planStartRuns);
    deleted += await deleteDocuments(ctx, autoPlanRuns);
    deleted += await deleteDocuments(ctx, groundingCache);
    deleted += await deleteDocuments(ctx, recoveryMonitors);
    deleted += await deleteDocuments(ctx, activityLogs);
    deleted += await deleteDocuments(ctx, interactionEvents);
    deleted += await deleteDocuments(ctx, planRevisions);
    return { deleted };
  },
});

export const clearWorkspaceReferencesInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ updated: v.number() }),
  handler: async (ctx, args) => {
    const n = WORKSPACE_DELETE_BATCH_SIZE;
    const [targetSessions, existingSessions, requested, current, completed] =
      await Promise.all([
        ctx.db
          .query("workspaceSetupSessions")
          .withIndex("by_target_workspace", (q) =>
            q.eq("targetWorkspaceId", args.workspaceId)
          )
          .take(n),
        ctx.db
          .query("workspaceSetupSessions")
          .withIndex("by_existing_workspace", (q) =>
            q.eq("existingWorkspaceId", args.workspaceId)
          )
          .take(n),
        ctx.db
          .query("readModelRollouts")
          .withIndex("by_requested_workspace", (q) =>
            q.eq("requestedWorkspaceId", args.workspaceId)
          )
          .take(n),
        ctx.db
          .query("readModelRollouts")
          .withIndex("by_current_workspace", (q) =>
            q.eq("currentWorkspaceId", args.workspaceId)
          )
          .take(n),
        ctx.db
          .query("readModelRollouts")
          .withIndex("by_last_completed_workspace", (q) =>
            q.eq("lastCompletedWorkspaceId", args.workspaceId)
          )
          .take(n),
      ]);
    const now = getCurrentUTCTimestamp();
    const sessionIds = new Set(
      [...targetSessions, ...existingSessions].map((s) => s._id)
    );
    for (const sessionId of sessionIds) {
      const session = await ctx.db.get("workspaceSetupSessions", sessionId);
      if (!session) continue;
      await ctx.db.patch(sessionId, {
        ...(session.targetWorkspaceId === args.workspaceId
          ? { targetWorkspaceId: undefined }
          : {}),
        ...(session.existingWorkspaceId === args.workspaceId
          ? { existingWorkspaceId: undefined }
          : {}),
        previewProspectIds: undefined,
        statusUpdatedAt: now,
        lastActiveAt: now,
      });
    }
    const rolloutIds = new Set(
      [...requested, ...current, ...completed].map((r) => r._id)
    );
    for (const rolloutId of rolloutIds) {
      const rollout = await ctx.db.get("readModelRollouts", rolloutId);
      if (!rollout) continue;
      await ctx.db.patch(rolloutId, {
        ...(rollout.requestedWorkspaceId === args.workspaceId
          ? { requestedWorkspaceId: undefined }
          : {}),
        ...(rollout.currentWorkspaceId === args.workspaceId
          ? { currentWorkspaceId: undefined }
          : {}),
        ...(rollout.lastCompletedWorkspaceId === args.workspaceId
          ? { lastCompletedWorkspaceId: undefined }
          : {}),
        updatedAt: now,
      });
    }
    return { updated: sessionIds.size + rolloutIds.size };
  },
});

export const deleteWorkspaceMemoryBatchInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => ({
    deleted: await deleteWorkspaceAgentMemoryBatch(ctx.db, {
      workspaceId: args.workspaceId,
      limit: WORKSPACE_DELETE_BATCH_SIZE,
    }),
  }),
});

export const getNextWorkspaceThreadBatchInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("workspaceAgentThreads")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(THREAD_DELETE_BATCH_SIZE);
    return rows.map((row) => row.threadId);
  },
});

export const getNextProspectThreadBatchInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    threadIds: v.array(v.string()),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .paginate(args.paginationOpts);
    const threadIds: string[] = [];
    for (const prospect of page.page) {
      // A prospect can hold several thread links (chat history), so collect
      // every link row before the cursor moves past it; the cursor is never
      // revisited, so truncating here would orphan the extra threads.
      for await (const link of ctx.db
        .query("prospectThreads")
        .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))) {
        threadIds.push(link.threadId);
      }
    }
    return {
      threadIds,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const getNextWorkspaceProspectBatchInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    prospectIds: v.array(v.id("prospects")),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .paginate(args.paginationOpts);
    return {
      prospectIds: page.page.map((prospect) => prospect._id),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Fully deletes one agent thread (component messages, then app-owned rows).
 * Idempotent: already-deleted rows are no-ops, so retried steps converge.
 */
async function deleteThreadFully(
  ctx: ActionCtx,
  threadId: string
): Promise<void> {
  await ctx.runAction(components.agent.threads.deleteAllForThreadIdSync, {
    threadId,
    limit: 25,
  });
  let local = { deleted: 1 };
  while (local.deleted > 0) {
    local = await ctx.runMutation(
      internal.lib.deleteWorkspaceCore.deleteThreadLocalRowsInternal,
      { threadId }
    );
  }
  let links = { deleted: 1 };
  while (links.deleted > 0) {
    links = await ctx.runMutation(
      internal.lib.deleteWorkspaceCore.deleteThreadLinksInternal,
      { threadId }
    );
  }
}

/**
 * Deletes agent threads in one durable step. Always fully deletes the first
 * thread, then stops between threads once past the time budget, so every
 * invocation makes progress and retried steps stay idempotent.
 */
export const deleteThreadsBatchInternal = internalAction({
  args: { threadIds: v.array(v.string()) },
  returns: v.object({ deletedThreadIds: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const deadline = Date.now() + DELETE_ACTION_BUDGET_MS;
    const deletedThreadIds: string[] = [];
    for (const [index, threadId] of args.threadIds.entries()) {
      if (index > 0 && Date.now() >= deadline) break;
      await deleteThreadFully(ctx, threadId);
      deletedThreadIds.push(threadId);
    }
    return { deletedThreadIds };
  },
});

/**
 * Deletes RAG namespaces in one durable step. Always fully deletes the first
 * namespace (all versions), then stops between namespaces once past the time
 * budget, so every invocation makes progress and retried steps stay idempotent.
 */
export const deleteRagNamespacesBatchInternal = internalAction({
  args: { namespaces: v.array(v.string()) },
  returns: v.object({ deletedNamespaces: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const deadline = Date.now() + DELETE_ACTION_BUDGET_MS;
    const deletedNamespaces: string[] = [];
    for (const [index, namespace] of args.namespaces.entries()) {
      if (index > 0 && Date.now() >= deadline) break;
      while (true) {
        const page = await ctx.runQuery(
          components.rag.namespaces.listNamespaceVersions,
          { namespace, paginationOpts: { cursor: null, numItems: 1 } }
        );
        const namespaceId = page.page[0]?.namespaceId;
        if (!namespaceId) break;
        await ctx.runAction(components.rag.namespaces.deleteNamespaceSync, {
          namespaceId,
        });
      }
      deletedNamespaces.push(namespace);
    }
    return { deletedNamespaces };
  },
});

export const deleteThreadLocalRowsInternal = internalMutation({
  args: { threadId: v.string() },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const n = WORKSPACE_DELETE_BATCH_SIZE;
    const [controls, contexts, selections, usage, raw, requests] =
      await Promise.all([
        ctx.db
          .query("threadHelperAiControls")
          .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
          .take(n),
        ctx.db
          .query("agentMessageContexts")
          .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
          .take(n),
        ctx.db
          .query("agentThreadTargetSelections")
          .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
          .take(n),
        ctx.db
          .query("agentUsageEvents")
          .withIndex("by_thread_recorded_at", (q) =>
            q.eq("threadId", args.threadId)
          )
          .take(n),
        ctx.db
          .query("agentRawResponses")
          .withIndex("by_thread_recorded_at", (q) =>
            q.eq("threadId", args.threadId)
          )
          .take(n),
        ctx.db
          .query("agentActionRequests")
          .withIndex("by_thread_status", (q) => q.eq("threadId", args.threadId))
          .take(n),
      ]);
    let deleted = 0;
    deleted += await deleteDocuments(ctx, controls);
    deleted += await deleteDocuments(ctx, contexts);
    deleted += await deleteDocuments(ctx, selections);
    deleted += await deleteDocuments(ctx, usage);
    deleted += await deleteDocuments(ctx, raw);
    deleted += await deleteDocuments(ctx, requests);
    return { deleted };
  },
});

export const deleteThreadLinksInternal = internalMutation({
  args: { threadId: v.string() },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const [prospectLinks, workspaceLinks] = await Promise.all([
      ctx.db
        .query("prospectThreads")
        .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
        .take(WORKSPACE_DELETE_BATCH_SIZE),
      ctx.db
        .query("workspaceAgentThreads")
        .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
        .take(WORKSPACE_DELETE_BATCH_SIZE),
    ]);
    return {
      deleted:
        (await deleteDocuments(ctx, prospectLinks)) +
        (await deleteDocuments(ctx, workspaceLinks)),
    };
  },
});

export const deleteQualificationAuditBatchInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("qualificationAuditRuns")
      .withIndex("by_workspace_and_started_at", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .first();
    if (!run) return { deleted: 0, done: true };
    const items = await ctx.db
      .query("qualificationAuditItems")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .take(WORKSPACE_DELETE_BATCH_SIZE);
    if (items.length > 0) {
      return { deleted: await deleteDocuments(ctx, items), done: false };
    }
    await ctx.db.delete(run._id);
    return { deleted: 1, done: false };
  },
});

export const deletePlanBatchInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("planBatchRuns")
      .withIndex("by_workspace_and_updated_at", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .first();
    if (!run) return { deleted: 0, done: true };
    const items = await ctx.db
      .query("planBatchItems")
      .withIndex("by_run_and_status", (q) => q.eq("runId", run._id))
      .take(WORKSPACE_DELETE_BATCH_SIZE);
    if (items.length > 0) {
      return { deleted: await deleteDocuments(ctx, items), done: false };
    }
    await ctx.db.delete(run._id);
    return { deleted: 1, done: false };
  },
});

export const deleteOutreachPlanBatchInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    let deleted = 0;
    for (let index = 0; index < OUTREACH_PLAN_DELETE_BATCH_SIZE; index += 1) {
      const plan = await ctx.db
        .query("outreachPlans")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId)
        )
        .first();
      if (!plan) return { deleted, done: true };
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .take(WORKSPACE_DELETE_BATCH_SIZE);
      if (tasks.length > 0) {
        deleted += await deleteDocuments(ctx, tasks);
        return { deleted, done: false };
      }
      const revisions = await ctx.db
        .query("outreachPlanRevisions")
        .withIndex("by_plan_and_version", (q) => q.eq("planId", plan._id))
        .take(WORKSPACE_DELETE_BATCH_SIZE);
      if (revisions.length > 0) {
        deleted += await deleteDocuments(ctx, revisions);
        return { deleted, done: false };
      }
      await ctx.db.delete(plan._id);
      deleted += 1;
    }
    return { deleted, done: false };
  },
});

/**
 * Deletes one prospect plus every child row that references it. Idempotent:
 * callers re-invoke it while the prospect still exists.
 */
async function deleteProspectWithChildren(
  ctx: MutationCtx,
  prospect: Doc<"prospects">
): Promise<number> {
  const n = WORKSPACE_DELETE_BATCH_SIZE;
  const [
    threads,
    interactions,
    syncStates,
    messages,
    conversations,
    outboundOperations,
    voiceNoteUploadIntents,
    contexts,
    requests,
    providerEvents,
    linkedInEngagements,
  ] = await Promise.all([
    ctx.db
      .query("prospectThreads")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))
      .take(n),
    ctx.db
      .query("prospectInteractions")
      .withIndex("by_prospect_replied", (q) => q.eq("prospectId", prospect._id))
      .take(n),
    ctx.db
      .query("prospectInteractionSyncStates")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))
      .take(n),
    ctx.db
      .query("platformConversationMessages")
      .withIndex("by_prospect_created_at", (q) =>
        q.eq("prospectId", prospect._id)
      )
      .take(n),
    ctx.db
      .query("platformConversations")
      .withIndex("by_prospect_platform", (q) =>
        q.eq("prospectId", prospect._id)
      )
      .take(n),
    ctx.db
      .query("outboundMessageOperations")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))
      .take(n),
    ctx.db
      .query("outboundVoiceNoteUploadIntents")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))
      .take(n),
    ctx.db
      .query("agentMessageContexts")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))
      .take(n),
    ctx.db
      .query("agentActionRequests")
      .withIndex("by_prospect_status", (q) => q.eq("prospectId", prospect._id))
      .take(n),
    ctx.db
      .query("providerRequestEvents")
      .withIndex("by_prospect_recorded_at", (q) =>
        q.eq("prospectId", prospect._id)
      )
      .take(n),
    ctx.db
      .query("linkedinUserPostEngagements")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id))
      .take(n),
  ]);
  const childRows =
    threads.length +
    interactions.length +
    syncStates.length +
    messages.length +
    conversations.length +
    outboundOperations.length +
    voiceNoteUploadIntents.length +
    contexts.length +
    requests.length +
    providerEvents.length +
    linkedInEngagements.length;
  if (childRows > 0) {
    let deleted = 0;
    deleted += await deleteDocuments(ctx, threads);
    deleted += await deleteDocuments(ctx, interactions);
    deleted += await deleteDocuments(ctx, syncStates);
    deleted += await deleteDocuments(ctx, messages);
    deleted += await deleteDocuments(ctx, conversations);
    deleted += await deleteDocuments(ctx, outboundOperations);
    deleted += await deleteVoiceNoteUploadIntents(ctx, voiceNoteUploadIntents);
    deleted += await deleteDocuments(ctx, contexts);
    deleted += await deleteDocuments(ctx, requests);
    deleted += await deleteDocuments(ctx, providerEvents);
    deleted += await deleteDocuments(ctx, linkedInEngagements);
    return deleted;
  }
  await ctx.db.delete(prospect._id);
  return 1;
}

export const deleteProspectBatchInternal = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    let deleted = 0;
    for (let index = 0; index < PROSPECT_DELETE_BATCH_SIZE; index += 1) {
      const prospect = await ctx.db
        .query("prospects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .first();
      if (!prospect) return { deleted, done: true };
      deleted += await deleteProspectWithChildren(ctx, prospect);
    }
    return { deleted, done: false };
  },
});

export const finalizeWorkspaceDeletionInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get("workspaces", args.workspaceId);
    if (!workspace) return { deleted: false };
    if (workspace.userId !== args.userId) {
      throw new Error("Workspace owner changed during deletion");
    }
    if (!workspace.deletionWorkflowId) {
      throw new Error("Workspace deletion was not requested");
    }
    const fitScoreAggregateRollout = await ctx.db
      .query("fitScoreAggregateRollouts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (fitScoreAggregateRollout) {
      await ctx.db.delete(fitScoreAggregateRollout._id);
    }
    await clearWorkspaceReportingAggregate(ctx, args.workspaceId);
    await ctx.db.delete(workspace._id);

    const subscription = await polar.getCurrentSubscription(ctx, {
      userId: args.userId,
    });
    await reconcilePlanUsageForUser(ctx, {
      userId: args.userId,
      subscription,
    });

    return { deleted: true };
  },
});
