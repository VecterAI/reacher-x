import { v } from "convex/values";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalMutation } from "../lib/functionBuilders";
import { workflow } from "../lib/workflow";
import { failAdaptiveOutreachEvent } from "../lib/adaptiveOutreachCore";

export const adaptiveOutreachWorkflow = workflow.define({
  args: {
    eventId: v.id("outreachInteractionEvents"),
  },
  returns: v.object({
    status: v.string(),
  }),
  handler: async (step, args): Promise<{ status: string }> => {
    const claimed = await step.runMutation(
      internal.adaptiveOutreach.claimAdaptiveOutreachEventInternal,
      args
    );
    if (!claimed) {
      return { status: "ignored" as const };
    }

    const decision: import("../lib/adaptiveOutreachCore").AdaptiveOutreachDecision =
      await step.runAction(
        internal.adaptiveOutreachActions
          .generateAdaptiveOutreachDecisionInternal,
        args,
        {
          retry: {
            maxAttempts: 3,
            initialBackoffMs: 2_000,
            base: 2,
          },
        }
      );
    const result: {
      applied: boolean;
      outcome: "continue" | "completed" | "abandoned";
      planId?: Id<"outreachPlans">;
      planVersion?: number;
    } = await step.runMutation(
      internal.adaptiveOutreach.applyAdaptiveOutreachDecisionInternal,
      {
        eventId: args.eventId,
        decision,
      }
    );

    if (result.applied && result.outcome === "continue" && result.planId) {
      await step.runAction(internal.workflows.outreach.startOutreachWorkflow, {
        planId: result.planId,
      });
    }

    return {
      status: result.applied ? result.outcome : ("superseded" as const),
    };
  },
});

export const handleAdaptiveOutreachWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(),
  },
  handler: async (ctx, args) => {
    if (args.result.kind === "success") return;
    const eventId = (
      args.context as { eventId: Id<"outreachInteractionEvents"> }
    ).eventId;
    const event = await ctx.db.get(eventId);
    if (!event) return;
    await failAdaptiveOutreachEvent(
      ctx,
      event,
      args.result.kind === "failed"
        ? String(args.result.error)
        : "Adaptive outreach workflow was cancelled."
    );
  },
});
