import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { approvePlan } from "./outreachCore";
import { requireProspectEligibleForOutreach } from "./accessHelpers";
import { recordMemoryWorkflowEvent } from "./memoryCore";

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

  await ctx.scheduler.runAfter(
    options?.runAfterMs ?? 0,
    internal.workflows.outreach.startOutreachWorkflow,
    { planId }
  );

  return { started: true, status: "approved" };
}
