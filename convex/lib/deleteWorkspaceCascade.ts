/**
 * Deletes a workspace and all rows that reference workspaceId across schema.ts tables.
 * Order: children first, then prospects, then workspace-scoped aggregates, then the workspace row.
 */
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

export async function deleteWorkspaceCascade(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<void> {
  const prospects = await ctx.db
    .query("prospects")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  const prospectIds = new Set(prospects.map((p) => p._id));

  const plans = await ctx.db
    .query("outreachPlans")
    .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
    .collect();

  for (const plan of plans) {
    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }
    await ctx.db.delete(plan._id);
  }

  const prospectMonitors = await ctx.db
    .query("prospectMonitors")
    .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
    .collect();
  for (const m of prospectMonitors) {
    await ctx.db.delete(m._id);
  }

  for (const prospectId of prospectIds) {
    const threads = await ctx.db
      .query("prospectThreads")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .collect();
    for (const t of threads) {
      await ctx.db.delete(t._id);
    }

    const interactions = await ctx.db
      .query("prospectInteractions")
      .withIndex("by_prospect_replied", (q) => q.eq("prospectId", prospectId))
      .collect();
    for (const row of interactions) {
      await ctx.db.delete(row._id);
    }

    const interactionSyncStates = await ctx.db
      .query("prospectInteractionSyncStates")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .collect();
    for (const row of interactionSyncStates) {
      await ctx.db.delete(row._id);
    }

    const logs = await ctx.db
      .query("prospectActivityLog")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    const summaries = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .collect();
    for (const s of summaries) {
      await ctx.db.delete(s._id);
    }

    const actionByProspect = await ctx.db
      .query("agentActionRequests")
      .withIndex("by_prospect_status", (q) => q.eq("prospectId", prospectId))
      .collect();
    for (const a of actionByProspect) {
      await ctx.db.delete(a._id);
    }

    const platformConversations = await ctx.db
      .query("platformConversations")
      .withIndex("by_prospect_platform", (q) =>
        q.eq("prospectId", prospectId).eq("platform", "twitter")
      )
      .collect();
    for (const conversation of platformConversations) {
      const messages = await ctx.db
        .query("platformConversationMessages")
        .withIndex("by_user_conversation_created_at", (q) =>
          q
            .eq("userId", conversation.userId)
            .eq("conversationId", conversation.conversationId)
        )
        .collect();
      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
      await ctx.db.delete(conversation._id);
    }

    await ctx.db.delete(prospectId);
  }

  const socialMonitors = await ctx.db
    .query("socialQueryMonitors")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const sm of socialMonitors) {
    await ctx.db.delete(sm._id);
  }

  const replyCandidates = await ctx.db
    .query("twitterReplyDiscoveryCandidates")
    .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const candidate of replyCandidates) {
    await ctx.db.delete(candidate._id);
  }

  for (const status of [
    "pending_backfill",
    "active",
    "paused",
    "archived",
    "failed",
  ] as const) {
    const seeds = await ctx.db
      .query("twitterConversationSeeds")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", status)
      )
      .collect();
    for (const seed of seeds) {
      await ctx.db.delete(seed._id);
    }
  }

  const discoveryEdges = await ctx.db
    .query("discoveryEdges")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const edge of discoveryEdges) {
    await ctx.db.delete(edge._id);
  }

  const keywords = await ctx.db
    .query("keywords")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const kw of keywords) {
    await ctx.db.delete(kw._id);
  }

  const qp = await ctx.db
    .query("queryPerformance")
    .withIndex("by_workspace_updated_at", (q) =>
      q.eq("workspaceId", workspaceId)
    )
    .collect();
  for (const row of qp) {
    await ctx.db.delete(row._id);
  }

  const qc = await ctx.db
    .query("queryCandidates")
    .withIndex("by_workspace_updated_at", (q) =>
      q.eq("workspaceId", workspaceId)
    )
    .collect();
  for (const row of qc) {
    await ctx.db.delete(row._id);
  }

  const evalRuns = await ctx.db
    .query("memoryEvaluatorRuns")
    .withIndex("by_workspace_updated_at", (q) =>
      q.eq("workspaceId", workspaceId)
    )
    .collect();
  for (const row of evalRuns) {
    await ctx.db.delete(row._id);
  }

  const suggestions = await ctx.db
    .query("memorySuggestions")
    .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
    .collect();
  for (const row of suggestions) {
    await ctx.db.delete(row._id);
  }

  const memEvents = await ctx.db
    .query("memoryWorkflowEvents")
    .withIndex("by_workspace_occurred_at", (q) =>
      q.eq("workspaceId", workspaceId)
    )
    .collect();
  for (const row of memEvents) {
    await ctx.db.delete(row._id);
  }

  const memoryQueues = await ctx.db
    .query("memoryEvaluationWorkspaceQueues")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const row of memoryQueues) {
    await ctx.db.delete(row._id);
  }

  const notifs = await ctx.db
    .query("outreachNotifications")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const n of notifs) {
    await ctx.db.delete(n._id);
  }

  const actionsWs = await ctx.db
    .query("agentActionRequests")
    .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
    .collect();
  for (const a of actionsWs) {
    await ctx.db.delete(a._id);
  }

  const stats = await ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const s of stats) {
    await ctx.db.delete(s._id);
  }

  const analytics = await ctx.db
    .query("workspaceAnalyticsDaily")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const row of analytics) {
    await ctx.db.delete(row._id);
  }

  const agentOpsDaily = await ctx.db
    .query("workspaceAgentOpsDaily")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const row of agentOpsDaily) {
    await ctx.db.delete(row._id);
  }

  const queryPerformanceDaily = await ctx.db
    .query("workspaceQueryPerformanceDaily")
    .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const row of queryPerformanceDaily) {
    await ctx.db.delete(row._id);
  }

  const setupSessions = await ctx.db
    .query("workspaceSetupSessions")
    .withIndex("by_target_workspace", (q) =>
      q.eq("targetWorkspaceId", workspaceId)
    )
    .collect();
  const now = getCurrentUTCTimestamp();
  for (const session of setupSessions) {
    await ctx.db.patch(session._id, {
      targetWorkspaceId: undefined,
      statusUpdatedAt: now,
      lastActiveAt: now,
    });
  }

  const setupByExisting = await ctx.db
    .query("workspaceSetupSessions")
    .withIndex("by_existing_workspace", (q) =>
      q.eq("existingWorkspaceId", workspaceId)
    )
    .collect();
  for (const session of setupByExisting) {
    await ctx.db.patch(session._id, {
      existingWorkspaceId: undefined,
      statusUpdatedAt: now,
      lastActiveAt: now,
    });
  }

  await ctx.db.delete(workspaceId);
}
