import { v } from "convex/values";
import { internal } from "../_generated/api";
import { workflow } from "../lib/workflow";
import { getPlanBatchWorkflowEventName } from "../lib/planBatchCore";

export const planBatchWorkflow = workflow.define({
  args: {
    runId: v.id("planBatchRuns"),
  },
  returns: v.object({
    status: v.string(),
  }),
  handler: async (step, { runId }): Promise<{ status: string }> => {
    const finalizeAgentResponse = async () => {
      const terminalRun = await step.runQuery(
        internal.planBatches.getPlanBatchRunInternal,
        { runId }
      );
      if (
        terminalRun?.responsePromptMessageId &&
        !terminalRun.agentResponseCompletedAt
      ) {
        await step.runAction(internal.chat.resumePlanBatchAgentResponse, {
          runId,
        });
      }
      return terminalRun?.status ?? "missing";
    };

    while (true) {
      const selection = await step.runMutation(
        internal.planBatches.selectPlanBatchTargetsPage,
        { runId }
      );
      if (!selection || selection.done) {
        break;
      }
    }

    let run = await step.runQuery(
      internal.planBatches.getPlanBatchRunInternal,
      { runId }
    );
    if (!run) {
      return { status: "missing" };
    }

    if (run.status === "awaiting_confirmation") {
      await step.awaitEvent({
        name: getPlanBatchWorkflowEventName(String(runId)),
      });
      run = await step.runQuery(internal.planBatches.getPlanBatchRunInternal, {
        runId,
      });
      if (!run) {
        return { status: "missing" };
      }
    }

    if (
      run.status === "cancelled" ||
      run.status === "failed" ||
      run.status === "completed" ||
      run.status === "partial"
    ) {
      return { status: await finalizeAgentResponse() };
    }

    while (true) {
      const dispatch = await step.runAction(
        internal.planBatches.dispatchPlanBatchPageWithRetryInternal,
        { runId },
        { retry: true }
      );
      if (!dispatch || dispatch.done) {
        break;
      }
    }

    run = await step.runQuery(internal.planBatches.getPlanBatchRunInternal, {
      runId,
    });
    if (
      run &&
      !["completed", "partial", "failed", "cancelled"].includes(run.status)
    ) {
      await step.awaitEvent({
        name: getPlanBatchWorkflowEventName(String(runId)),
      });
    }

    return { status: await finalizeAgentResponse() };
  },
});
