import { type WorkId } from "@convex-dev/workpool";
import type { Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { planBatchDirectWorkPoolValidator } from "../validators";
import { getOutreachPlanPool } from "./outreachPlanPool";
import { tenantExecutionPool } from "./tenantExecutionPool";

type DirectWorkPool = Infer<typeof planBatchDirectWorkPoolValidator>;

function getDirectWorkPool(kind: DirectWorkPool) {
  return kind === "tenant_execution"
    ? tenantExecutionPool
    : getOutreachPlanPool();
}

/** The runtime pool split is global, including enforced workspace overrides. */
async function getActiveDirectWorkPool(
  ctx: MutationCtx
): Promise<DirectWorkPool> {
  const control = await ctx.db
    .query("tenantSchedulerControls")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  if (control?.mode === "enforced") return "tenant_execution";

  const enforcedOverride = await ctx.db
    .query("tenantSchedulerWorkspaceOverrides")
    .withIndex("by_mode", (q) => q.eq("mode", "enforced"))
    .first();
  return enforcedOverride ? "tenant_execution" : "outreach_plan";
}

/** User-requested plan work stays runnable when the discovery lane is paused. */
export async function enqueuePlanBatchItemDirectly(
  ctx: MutationCtx,
  args: { runId: Id<"planBatchRuns">; itemId: Id<"planBatchItems"> }
): Promise<{ workId: string; directWorkPool: DirectWorkPool }> {
  const directWorkPool = await getActiveDirectWorkPool(ctx);
  const workId = await getDirectWorkPool(directWorkPool).enqueueAction(
    ctx,
    internal.planBatchActions.processPlanBatchItem,
    { itemId: args.itemId },
    {
      onComplete: internal.planBatches.handlePlanBatchItemComplete,
      context: { runId: args.runId, itemId: args.itemId },
      retry: true,
    }
  );
  return { workId: String(workId), directWorkPool };
}

export async function cancelDirectPlanBatchItem(
  ctx: MutationCtx,
  args: { workId: string; directWorkPool?: DirectWorkPool }
) {
  // Before directWorkPool was stored, all direct items used outreachPlanPool.
  await getDirectWorkPool(args.directWorkPool ?? "outreach_plan").cancel(
    ctx,
    args.workId as WorkId
  );
}
