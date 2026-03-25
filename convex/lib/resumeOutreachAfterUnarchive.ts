import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

/**
 * Restores outreach plans from archiveHold after a prospect leaves "archived" status.
 */
export async function resumeOutreachPlansAfterUnarchiveCore(
  ctx: MutationCtx,
  prospectId: Id<"prospects">
): Promise<{ ok: boolean }> {
  const prospect = await ctx.db.get(prospectId);
  if (!prospect || prospect.status === "archived") {
    return { ok: false };
  }

  const plans = await ctx.db
    .query("outreachPlans")
    .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
    .collect();

  const now = getCurrentUTCTimestamp();

  for (const plan of plans) {
    if (!plan.archiveHold) {
      continue;
    }
    const prev = plan.archiveHold.previousStatus;

    if (prev === "approved" || prev === "executing") {
      await ctx.db.patch(plan._id, {
        status: "approved",
        archiveHold: undefined,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.outreach.startOutreachWorkflow,
        { planId: plan._id }
      );
    } else {
      await ctx.db.patch(plan._id, {
        status: prev,
        archiveHold: undefined,
        updatedAt: now,
      });
    }
  }

  return { ok: true };
}
