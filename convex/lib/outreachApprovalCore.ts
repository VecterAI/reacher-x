import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { approvePlan } from "./outreachCore";
import { requireProspectEligibleForOutreach } from "./accessHelpers";
import { recordMemoryWorkflowEvent } from "./memoryCore";

import { getPlanReadiness, requirePlanAccounts } from "./outreachReadinessCore";

export async function startOutreachPlanExecution(
  ctx: MutationCtx,
  planId: Id<"outreachPlans">,
  options?: {
    runAfterMs?: number;
    approvalSource?: "manual" | "autonomy" | "agent_command";
  }
): Promise<{ started: boolean; status: string }> {
  const plan = await ctx.db.get("outreachPlans", planId);
  if (!plan) {
    throw new Error("Plan not found");
  }

  if (plan.status !== "draft" && plan.status !== "approved") {
    return { started: false, status: plan.status };
  }

  const prospect = await ctx.db.get("prospects", plan.prospectId);
  if (!prospect) {
    throw new Error("Prospect not found");
  }
  requireProspectEligibleForOutreach(prospect);

  if (options?.approvalSource === "autonomy") {
    const readiness = await getPlanReadiness(ctx, plan);
    if (readiness.missingPlatforms.length)
      return { started: false, status: plan.status };
  } else {
    await requirePlanAccounts(ctx, plan);
  }

  if (plan.status === "draft") {
    await approvePlan(ctx, planId);
  }

  await recordMemoryWorkflowEvent(ctx, {
    workspaceId: plan.workspaceId,
    eventType: "outreach_plan_approved",
    sourceType: "outreach_plan",
    sourceId: String(planId),
    planId,
    prospectId: plan.prospectId,
    payload: {
      status: "approved",
      approvalSource: options?.approvalSource ?? "manual",
    },
  });

  if (
    options?.runAfterMs === undefined &&
    options?.approvalSource !== "autonomy"
  ) {
    // Approval and durable startup share one transaction. If startup fails,
    // the plan remains a draft and the caller gets the error.
    await ctx.runMutation(internal.workflows.outreach.startOutreachWorkflow, {
      planId,
    });
  } else {
    await ctx.scheduler.runAfter(
      options?.runAfterMs ?? 0,
      internal.workflows.outreach.startOutreachWorkflow,
      { planId }
    );
  }

  return { started: true, status: "approved" };
}
