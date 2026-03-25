/**
 * Pause/resume automations when a prospect is archived or unarchived.
 * Outreach plan durable workflows are canceled via workflow.cancel (see docs/convex/workflow-component.md).
 */

import { internalAction } from "./lib/functionBuilders";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { workflow } from "./lib/workflow";
import type { Doc } from "./_generated/dataModel";

type PlanArchivePrev = NonNullable<
  Doc<"outreachPlans">["archiveHold"]
>["previousStatus"];

function isArchiveHoldPreviousStatus(s: string): s is PlanArchivePrev {
  return (
    s === "draft" ||
    s === "approved" ||
    s === "executing" ||
    s === "paused" ||
    s === "blocked_auth"
  );
}

/**
 * Runs after prospect status is patched to archived. Cancels durable workflows and
 * sets outreach plans to paused with archiveHold for restoration on unarchive.
 */
export const pauseAutomationsForArchivedProspect = internalAction({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );
    if (!prospect || prospect.status !== "archived") {
      return { ok: true as const, skipped: true };
    }

    if (prospect.qualificationWorkflowId) {
      try {
        await workflow.cancel(ctx, prospect.qualificationWorkflowId as any);
      } catch (e) {
        console.warn(
          `[archivePause] Failed to cancel qualification workflow for ${args.prospectId}`,
          e
        );
      }
      await ctx.runMutation(internal.prospects.clearQualificationWorkflowId, {
        prospectId: args.prospectId,
      });
    }

    if (prospect.enrichmentWorkflowId) {
      try {
        await workflow.cancel(ctx, prospect.enrichmentWorkflowId as any);
      } catch (e) {
        console.warn(
          `[archivePause] Failed to cancel enrichment workflow for ${args.prospectId}`,
          e
        );
      }
      await ctx.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
        prospectId: args.prospectId,
      });
    }

    if (prospect.planGenerationStatus === "generating") {
      await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
        prospectId: args.prospectId,
        status: "idle",
      });
    }

    const plans = await ctx.runQuery(
      internal.outreach.listOutreachPlansForProspectInternal,
      { prospectId: args.prospectId }
    );

    for (const plan of plans) {
      if (plan.status === "completed" || plan.status === "abandoned") {
        continue;
      }
      if (plan.archiveHold) {
        continue;
      }
      if (!isArchiveHoldPreviousStatus(plan.status)) {
        continue;
      }

      if (plan.workflowId) {
        try {
          await workflow.cancel(ctx, plan.workflowId as any);
        } catch (e) {
          console.warn(
            `[archivePause] Failed to cancel outreach plan workflow for plan ${plan._id}`,
            e
          );
        }
      }

      await ctx.runMutation(internal.outreach.patchPlanPausedForArchive, {
        planId: plan._id,
        previousStatus: plan.status,
      });
    }

    return { ok: true as const };
  },
});
