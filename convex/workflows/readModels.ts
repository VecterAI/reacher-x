import { v } from "convex/values";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../lib/functionBuilders";
import {
  READ_MODEL_ROLLOUT_CLEANUP_DELAY_MS,
  type ReadModelRebuildResult,
} from "../lib/readModelRolloutHelpers";
import { workflow as workflowManager } from "../lib/workflow";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { readModelRolloutWorkflowResultValidator } from "../validators";

type WorkflowId = Awaited<ReturnType<typeof workflowManager.start>>;

type ReadModelRolloutWorkflowResult = {
  rebuiltWorkspaceCount: number;
  results: ReadModelRebuildResult[];
};

export const readModelRolloutWorkflow = workflowManager.define({
  args: {
    rolloutId: v.id("readModelRollouts"),
    userId: v.id("users"),
    workspaceIds: v.array(v.id("workspaces")),
  },
  returns: readModelRolloutWorkflowResultValidator,
  handler: async (step, args): Promise<ReadModelRolloutWorkflowResult> => {
    await step.runMutation(
      internal.readModels.markReadModelRolloutRunningInternal,
      {
        rolloutId: args.rolloutId,
        workflowId: String(step.workflowId),
      }
    );

    const results: ReadModelRebuildResult[] = [];

    for (const workspaceId of args.workspaceIds) {
      const workspace = await step.runQuery(internal.workspaces.getById, {
        workspaceId,
      });
      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }
      if (workspace.userId !== args.userId) {
        throw new Error(`Workspace ${workspaceId} is not owned by the caller`);
      }

      await step.runMutation(
        internal.readModels.markReadModelRolloutWorkspaceStartedInternal,
        {
          rolloutId: args.rolloutId,
          workspaceId,
        }
      );

      const result: ReadModelRebuildResult = await step.runMutation(
        internal.readModels.rebuildWorkspaceReadModelsInternal,
        {
          workspaceId,
        }
      );

      await step.runMutation(
        internal.readModels.recordReadModelRolloutWorkspaceCompletedInternal,
        {
          rolloutId: args.rolloutId,
          workspaceId,
          result,
        }
      );

      results.push(result);
    }

    return {
      rebuiltWorkspaceCount: results.length,
      results,
    };
  },
});

export const handleReadModelRolloutComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(),
  },
  handler: async (ctx, args): Promise<void> => {
    const rolloutId = (args.context as { rolloutId: Id<"readModelRollouts"> })
      .rolloutId;

    if (args.result.kind === "success") {
      await ctx.runMutation(
        internal.readModels.markReadModelRolloutTerminalInternal,
        {
          rolloutId,
          status: "completed",
        }
      );
    } else if (args.result.kind === "failed") {
      await ctx.runMutation(
        internal.readModels.markReadModelRolloutTerminalInternal,
        {
          rolloutId,
          status: "failed",
          error: args.result.error,
        }
      );
    } else if (args.result.kind === "canceled") {
      await ctx.runMutation(
        internal.readModels.markReadModelRolloutTerminalInternal,
        {
          rolloutId,
          status: "canceled",
        }
      );
    }

    const cleanupScheduledAt =
      getCurrentUTCTimestamp() + READ_MODEL_ROLLOUT_CLEANUP_DELAY_MS;
    await ctx.scheduler.runAfter(
      READ_MODEL_ROLLOUT_CLEANUP_DELAY_MS,
      internal.workflows.readModels.cleanupCompletedReadModelRolloutWorkflow,
      {
        rolloutId,
        workflowId: String(args.workflowId),
      }
    );
    await ctx.runMutation(
      internal.readModels.markReadModelRolloutCleanupScheduledInternal,
      {
        rolloutId,
        cleanupScheduledAt,
      }
    );
  },
});

export const cleanupCompletedReadModelRolloutWorkflow = internalAction({
  args: {
    rolloutId: v.id("readModelRollouts"),
    workflowId: v.string(),
  },
  handler: async (
    ctx,
    { rolloutId, workflowId }
  ): Promise<{ cleanedUp: boolean; status: string }> => {
    const status = await workflowManager.status(ctx, workflowId as WorkflowId);
    if (status.type === "inProgress") {
      return {
        cleanedUp: false,
        status: status.type,
      };
    }

    await workflowManager.cleanup(ctx, workflowId as WorkflowId);
    await ctx.runMutation(
      internal.readModels.markReadModelRolloutCleanedUpInternal,
      {
        rolloutId,
      }
    );

    return {
      cleanedUp: true,
      status: status.type,
    };
  },
});
