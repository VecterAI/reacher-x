/** Drain handlers for workflows scheduled before synthetic onboarding shipped.
 * Remove after all legacy preview workflow IDs and callbacks have drained.
 */
import { v } from "convex/values";
import { vResultValidator } from "@convex-dev/workpool";
import { vWorkflowId, type WorkflowId } from "@convex-dev/workflow";
import { workflow } from "../lib/workflow";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../lib/functionBuilders";

export const handlePreviewWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ sessionId: v.id("workspaceSetupSessions") }),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.setupSessions.upgradeLegacySetupInternal, {
      sessionId: args.context.sessionId,
    });
  },
});

export const cancelPreviewWorkflowByIdInternal = internalAction({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    const workflowId = args.workflowId as WorkflowId;

    try {
      const status = await workflow.status(ctx, workflowId);
      if (status.type === "inProgress") {
        await workflow.cancel(ctx, workflowId);
        return { cancelled: true, status: "inProgress" as const };
      }

      await workflow.cleanup(ctx, workflowId);
      return { cancelled: false, status: status.type };
    } catch (error) {
      console.warn(
        "Failed to cancel or clean up workflow",
        { workflowId: args.workflowId },
        error
      );
      return { cancelled: false, status: "error" as const };
    }
  },
});
