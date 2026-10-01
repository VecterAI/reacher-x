import type { WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { workflow } from "../lib/workflow";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { getProspectNamespace } from "../agents/outreach/rag";
import { WORKSPACE_DELETE_BATCH_SIZE } from "../lib/deleteWorkspaceCore";
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
      // A failed run's journal may exceed the workflow component's 8 MiB load
      // limit, which makes restart permanently unable to progress ("Failed to
      // load journal"). Clean up the dead run and start a fresh workflow;
      // deletion steps are idempotent, so starting over is safe.
      await workflow.cleanup(ctx, workflowId);
      await startNewWorkspaceDeletionWorkflow(ctx, workspace, result);
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
    // Workspace-level agent threads (setup/onboarding chats). Unprocessed
    // threads keep their links, so each indexed re-query returns whatever a
    // partial action step left behind and progress is guaranteed.
    while (true) {
      const threadIds = await step.runQuery(
        internal.lib.deleteWorkspaceCore.getNextWorkspaceThreadBatchInternal,
        { workspaceId: args.workspaceId }
      );
      if (threadIds.length === 0) break;
      await step.runAction(
        internal.lib.deleteWorkspaceCore.deleteThreadsBatchInternal,
        { threadIds },
        { retry: true }
      );
    }

    // Per-prospect agent threads, batched per paginated prospect page.
    let prospectCursor: string | null = null;
    while (true) {
      const page: {
        threadIds: string[];
        continueCursor: string;
        isDone: boolean;
      } = await step.runQuery(
        internal.lib.deleteWorkspaceCore.getNextProspectThreadBatchInternal,
        {
          workspaceId: args.workspaceId,
          paginationOpts: {
            cursor: prospectCursor,
            numItems: WORKSPACE_DELETE_BATCH_SIZE,
          },
        }
      );
      let pending = page.threadIds;
      while (pending.length > 0) {
        const result = await step.runAction(
          internal.lib.deleteWorkspaceCore.deleteThreadsBatchInternal,
          { threadIds: pending },
          { retry: true }
        );
        pending = pending.filter(
          (threadId) => !result.deletedThreadIds.includes(threadId)
        );
      }
      if (page.isDone) break;
      prospectCursor = page.continueCursor;
    }

    // Workspace-level semantic memory namespaces (bounded kinds). The batch
    // action stops between namespaces once past its time budget, so retry
    // whatever it has not yet reported as fully deleted.
    let pendingMemoryNamespaces = WORKSPACE_MEMORY_NAMESPACE_KINDS.map((kind) =>
      getWorkspaceMemoryNamespace(String(args.workspaceId), kind)
    );
    while (pendingMemoryNamespaces.length > 0) {
      const result = await step.runAction(
        internal.lib.deleteWorkspaceCore.deleteRagNamespacesBatchInternal,
        { namespaces: pendingMemoryNamespaces },
        { retry: true }
      );
      pendingMemoryNamespaces = pendingMemoryNamespaces.filter(
        (namespace) => !result.deletedNamespaces.includes(namespace)
      );
    }

    // Per-prospect RAG namespaces, batched per paginated prospect page.
    let ragCursor: string | null = null;
    while (true) {
      const page: {
        prospectIds: Id<"prospects">[];
        continueCursor: string;
        isDone: boolean;
      } = await step.runQuery(
        internal.lib.deleteWorkspaceCore.getNextWorkspaceProspectBatchInternal,
        {
          workspaceId: args.workspaceId,
          paginationOpts: {
            cursor: ragCursor,
            numItems: WORKSPACE_DELETE_BATCH_SIZE,
          },
        }
      );
      let pending = page.prospectIds.map((prospectId) =>
        getProspectNamespace(String(prospectId))
      );
      while (pending.length > 0) {
        const result = await step.runAction(
          internal.lib.deleteWorkspaceCore.deleteRagNamespacesBatchInternal,
          { namespaces: pending },
          { retry: true }
        );
        pending = pending.filter(
          (namespace) => !result.deletedNamespaces.includes(namespace)
        );
      }
      if (page.isDone) break;
      ragCursor = page.continueCursor;
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
