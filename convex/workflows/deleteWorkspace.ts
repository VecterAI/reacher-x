import type { WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { workflow } from "../lib/workflow";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { getProspectNamespace } from "../agents/outreach/rag";
import {
  getWorkspaceMemoryNamespace,
  WORKSPACE_MEMORY_NAMESPACE_KINDS,
} from "../lib/memoryHelpers";

export type WorkspaceDeletionResult = {
  wasLastWorkspace: boolean;
  newDefaultWorkspaceId?: Id<"workspaces">;
};

async function startNewWorkspaceDeletionWorkflow(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  result: WorkspaceDeletionResult
): Promise<void> {
  if (workspace.prospectingWorkflowId) {
    const prospectingWorkflowId = workspace.prospectingWorkflowId as WorkflowId;
    const prospectingStatus = await workflow.status(ctx, prospectingWorkflowId);
    if (prospectingStatus.type === "inProgress") {
      await workflow.cancel(ctx, prospectingWorkflowId);
    }
  }
  const workflowId = await workflow.start(
    ctx,
    internal.workflows.deleteWorkspace.deleteWorkspaceWorkflow,
    { workspaceId: workspace._id, userId: workspace.userId },
    { startAsync: true }
  );
  const now = getCurrentUTCTimestamp();
  if (result.newDefaultWorkspaceId) {
    await ctx.db.patch(result.newDefaultWorkspaceId, {
      isDefault: true,
      updatedAt: now,
    });
  }
  await ctx.db.patch(workspace._id, {
    isDefault: false,
    deletionWorkflowId: String(workflowId),
    deletionStartedAt: now,
    deletionWasLastWorkspace: result.wasLastWorkspace,
    deletionNewDefaultWorkspaceId: result.newDefaultWorkspaceId,
    updatedAt: now,
  });
}

/**
 * Starts or resumes the one durable deletion workflow attached to a workspace.
 * Authorization is deliberately performed by the public caller before this
 * orchestration helper is invoked.
 */
export async function requestWorkspaceDeletion(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">
): Promise<WorkspaceDeletionResult> {
  if (workspace.deletionWorkflowId) {
    const result: WorkspaceDeletionResult = {
      wasLastWorkspace: workspace.deletionWasLastWorkspace ?? false,
      newDefaultWorkspaceId: workspace.deletionNewDefaultWorkspaceId,
    };
    const workflowId = workspace.deletionWorkflowId as WorkflowId;
    const status = await workflow.status(ctx, workflowId);
    if (status.type === "failed") {
      await workflow.restart(ctx, workflowId, {
        from: 0,
        startAsync: true,
      });
    } else if (status.type === "canceled" || status.type === "completed") {
      await startNewWorkspaceDeletionWorkflow(ctx, workspace, result);
    }
    return result;
  }

  // Workspace limits are bounded, so read a small fixed page and avoid choosing
  // another workspace whose own deletion is already in progress.
  const candidates = await ctx.db
    .query("workspaces")
    .withIndex("by_user_id", (q) => q.eq("userId", workspace.userId))
    .take(25);
  const replacement = candidates.find(
    (candidate) =>
      candidate._id !== workspace._id && !candidate.deletionWorkflowId
  );
  const result: WorkspaceDeletionResult = {
    wasLastWorkspace: !replacement,
    newDefaultWorkspaceId:
      workspace.isDefault && replacement ? replacement._id : undefined,
  };
  await startNewWorkspaceDeletionWorkflow(ctx, workspace, result);
  return result;
}

export const deleteWorkspaceWorkflow = workflow.define({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (step, args): Promise<{ deleted: boolean }> => {
    const deleteThread = async (threadId: string) => {
      // The installed Agent API synchronously walks bounded component pages.
      // Workflow retries make the action durable if it times out mid-thread.
      await step.runAction(
        components.agent.threads.deleteAllForThreadIdSync,
        { threadId, limit: 25 },
        { retry: true }
      );
      while (true) {
        const local = await step.runMutation(
          internal.lib.deleteWorkspaceCore.deleteThreadLocalRowsInternal,
          { threadId }
        );
        if (local.deleted === 0) break;
      }
      while (true) {
        const links = await step.runMutation(
          internal.lib.deleteWorkspaceCore.deleteThreadLinksInternal,
          { threadId }
        );
        if (links.deleted === 0) break;
      }
    };

    const deleteRagNamespace = async (namespace: string) => {
      while (true) {
        const page = await step.runQuery(
          components.rag.namespaces.listNamespaceVersions,
          { namespace, paginationOpts: { cursor: null, numItems: 1 } }
        );
        const namespaceId = page.page[0]?.namespaceId;
        if (!namespaceId) break;
        await step.runAction(
          components.rag.namespaces.deleteNamespaceSync,
          { namespaceId },
          { retry: true }
        );
      }
    };

    while (true) {
      const threadId = await step.runQuery(
        internal.lib.deleteWorkspaceCore.getNextWorkspaceThreadInternal,
        { workspaceId: args.workspaceId }
      );
      if (!threadId) break;
      await deleteThread(threadId);
    }

    let prospectCursor: string | null = null;
    while (true) {
      const page: {
        threadId: string | null;
        continueCursor: string;
        isDone: boolean;
      } = await step.runQuery(
        internal.lib.deleteWorkspaceCore.getNextProspectThreadInternal,
        {
          workspaceId: args.workspaceId,
          paginationOpts: { cursor: prospectCursor, numItems: 1 },
        }
      );
      if (page.threadId) {
        await deleteThread(page.threadId);
        continue;
      }
      if (page.isDone) break;
      prospectCursor = page.continueCursor;
    }

    for (const kind of WORKSPACE_MEMORY_NAMESPACE_KINDS) {
      await deleteRagNamespace(
        getWorkspaceMemoryNamespace(String(args.workspaceId), kind)
      );
    }
    let ragProspectCursor: string | null = null;
    while (true) {
      const page: {
        prospectId: Id<"prospects"> | null;
        continueCursor: string;
        isDone: boolean;
      } = await step.runQuery(
        internal.lib.deleteWorkspaceCore.getNextWorkspaceProspectInternal,
        {
          workspaceId: args.workspaceId,
          paginationOpts: { cursor: ragProspectCursor, numItems: 1 },
        }
      );
      if (page.prospectId) {
        await deleteRagNamespace(getProspectNamespace(String(page.prospectId)));
      }
      if (page.isDone) break;
      ragProspectCursor = page.continueCursor;
    }

    while (true) {
      const result = await step.runMutation(
        internal.lib.deleteWorkspaceCore.deleteWorkspaceMemoryBatchInternal,
        { workspaceId: args.workspaceId }
      );
      if (result.deleted === 0) break;
    }

    while (true) {
      const result = await step.runMutation(
        internal.lib.deleteWorkspaceCore.clearWorkspaceReferencesInternal,
        { workspaceId: args.workspaceId }
      );
      if (result.updated === 0) break;
    }

    while (true) {
      const result = await step.runMutation(
        internal.lib.deleteWorkspaceCore.sweepWorkspaceRowsInternal,
        { workspaceId: args.workspaceId, userId: args.userId }
      );
      if (result.deleted === 0) break;
    }

    while (true) {
      const result = await step.runMutation(
        internal.lib.deleteWorkspaceCore.deleteQualificationAuditBatchInternal,
        { workspaceId: args.workspaceId }
      );
      if (result.done) break;
    }

    while (true) {
      const result = await step.runMutation(
        internal.lib.deleteWorkspaceCore.deletePlanBatchInternal,
        { workspaceId: args.workspaceId }
      );
      if (result.done) break;
    }

    while (true) {
      const result = await step.runMutation(
        internal.lib.deleteWorkspaceCore.deleteOutreachPlanBatchInternal,
        { workspaceId: args.workspaceId }
      );
      if (result.done) break;
    }

    while (true) {
      const result = await step.runMutation(
        internal.lib.deleteWorkspaceCore.deleteProspectBatchInternal,
        { workspaceId: args.workspaceId }
      );
      if (result.done) break;
    }

    // Re-sweep after parent removal so retried/concurrent writers cannot leave
    // a late workspace-scoped row behind before finalization.
    while (true) {
      const result = await step.runMutation(
        internal.lib.deleteWorkspaceCore.sweepWorkspaceRowsInternal,
        { workspaceId: args.workspaceId, userId: args.userId }
      );
      if (result.deleted === 0) break;
    }

    return await step.runMutation(
      internal.lib.deleteWorkspaceCore.finalizeWorkspaceDeletionInternal,
      { workspaceId: args.workspaceId, userId: args.userId }
    );
  },
});
