import { v } from "convex/values";
import { internal } from "../_generated/api";
import { workflow as workflowManager } from "../lib/workflow";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../lib/functionBuilders";

export const memoryEvaluationWorkflow = workflowManager.define({
  args: {
    eventId: v.id("memoryWorkflowEvents"),
  },
  returns: v.object({
    status: v.union(
      v.literal("completed"),
      v.literal("ignored"),
      v.literal("skipped"),
      v.literal("failed")
    ),
    runId: v.optional(v.id("memoryEvaluatorRuns")),
    error: v.optional(v.string()),
  }),
  handler: async (step, { eventId }) => {
    const claim = await step.runMutation(
      internal.evaluator.claimMemoryWorkflowEventForEvaluationInternal,
      {
        eventId,
        workflowId: String(step.workflowId),
      }
    );

    if (claim.status !== "claimed") {
      return {
        status: "skipped" as const,
      };
    }

    const runId = claim.runId as Id<"memoryEvaluatorRuns">;

    try {
      const plan = await step.runAction(
        internal.evaluator.buildMemoryEvaluationPlanInternal,
        {
          eventId,
        }
      );

      if (plan.status === "ignored") {
        await step.runMutation(
          internal.evaluator.finalizeMemoryEvaluatorRunInternal,
          {
            runId,
            eventId,
            status: "ignored",
            promptVersion: plan.promptVersion,
            model: plan.model,
            summary: plan.summary,
            ignoredReason: plan.ignoredReason,
            retrievalStats: plan.retrievalStats,
            promotedMemoryIds: [],
            suggestionIds: [],
            promotedMemoryCount: 0,
            suggestedMemoryCount: 0,
            queryPerformanceUpdateCount: 0,
          }
        );

        return {
          status: "ignored" as const,
          runId,
        };
      }

      if (!plan.workspaceId) {
        throw new Error("Memory evaluation plan is missing workspace context");
      }

      const applied = await step.runMutation(
        internal.evaluator.applyMemoryEvaluationPlanInternal,
        {
          runId,
          eventId,
          workspaceId: plan.workspaceId as Id<"workspaces">,
          promptVersion: plan.promptVersion,
          model: plan.model,
          summary: plan.summary,
          drafts: plan.drafts,
          queryPerformanceUpdates: plan.queryPerformanceUpdates,
          retrievalStats: plan.retrievalStats,
          telemetryRequest: plan.telemetry?.request,
          telemetryResponse: plan.telemetry?.response,
          telemetryProviderMetadata: plan.telemetry?.providerMetadata,
          telemetryUsage: plan.telemetry?.usage,
        }
      );

      await step.runMutation(
        internal.evaluator.finalizeMemoryEvaluatorRunInternal,
        {
          runId,
          eventId,
          status: "completed",
          promptVersion: plan.promptVersion,
          model: plan.model,
          summary: plan.summary,
          promotedMemoryIds: applied.promotedMemoryIds,
          suggestionIds: applied.suggestionIds,
          promotedMemoryCount: applied.promotedMemoryCount,
          suggestedMemoryCount: applied.suggestedMemoryCount,
          queryPerformanceUpdateCount: applied.queryPerformanceUpdateCount,
          retrievalStats: plan.retrievalStats,
        }
      );

      return {
        status: "completed" as const,
        runId,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown memory evaluator error";
      await step.runMutation(
        internal.evaluator.finalizeMemoryEvaluatorRunInternal,
        {
          runId,
          eventId,
          status: "failed",
          error: message,
        }
      );

      return {
        status: "failed" as const,
        runId,
        error: message,
      };
    }
  },
});

export const startMemoryEvaluationWorkflowInternal = internalAction({
  args: {
    eventId: v.id("memoryWorkflowEvents"),
  },
  handler: async (ctx, { eventId }): Promise<{ workflowId: string }> => {
    const workflowId = await workflowManager.start(
      ctx,
      internal.workflows.memory.memoryEvaluationWorkflow,
      {
        eventId,
      }
    );

    return { workflowId: String(workflowId) };
  },
});
