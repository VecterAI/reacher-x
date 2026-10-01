import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { computeUsageCycleWindow } from "./planCycleUtils";
import type { PolarSubscriptionLike } from "./planCycleUtils";
import { getComplimentaryGrant } from "./planGrantCore";
import { getOrCreateUserPlan } from "./planCore";
import { getWorkspaceCount } from "./planHelpers";
import { computeQualifiedProspectUsageForWindow } from "./planQualifiedUsageCore";

function windowMatchesCycle(
  row: { cycleStart: number; cycleEnd: number },
  window: { cycleStart: number; cycleEnd: number }
) {
  return (
    row.cycleStart === window.cycleStart && row.cycleEnd === window.cycleEnd
  );
}

/**
 * Rebuild the active usage snapshot from canonical plan and usage data.
 * Historical snapshots are left unchanged.
 */
export async function reconcilePlanUsageForUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    subscription: PolarSubscriptionLike;
  }
) {
  const now = getCurrentUTCTimestamp();
  const plan = await getOrCreateUserPlan(ctx, args.userId);
  const complimentaryGrant = await getComplimentaryGrant(ctx, args.userId);
  const window = computeUsageCycleWindow({
    now,
    tier: plan.tier,
    subscription: args.subscription,
    complimentaryGrantTerm: complimentaryGrant,
  });
  const workspacesUsed = await getWorkspaceCount(ctx, args.userId);

  const currentRows = await ctx.db
    .query("planUsageCycles")
    .withIndex("by_user_is_current", (q) =>
      q.eq("userId", args.userId).eq("isCurrent", true)
    )
    .collect();

  const currentRow = currentRows[0] ?? null;
  await Promise.all(
    currentRows
      .slice(1)
      .map((extra) =>
        ctx.db.patch(extra._id, { isCurrent: false, updatedAt: now })
      )
  );

  const matchingRows = await ctx.db
    .query("planUsageCycles")
    .withIndex("by_user_cycle_start", (q) =>
      q.eq("userId", args.userId).eq("cycleStart", window.cycleStart)
    )
    .collect();
  const matchingRow =
    matchingRows.find((row) => windowMatchesCycle(row, window)) ?? null;

  const prospectsUsed = await computeQualifiedProspectUsageForWindow(
    ctx,
    args.userId,
    window
  );

  if (plan._id) {
    await ctx.db.patch(plan._id, {
      currentProspectsCount: prospectsUsed,
      currentProspectsCycleStart: window.cycleStart,
      currentProspectsCycleEnd: window.cycleEnd,
      updatedAt: now,
    });
  }

  const snapshot = {
    tier: plan.tier,
    prospectsUsed,
    prospectsLimit: plan.prospectsLimit,
    workspacesUsed,
    workspacesLimit: plan.workspacesLimit,
    isCurrent: true,
    updatedAt: now,
  };

  if (currentRow && windowMatchesCycle(currentRow, window)) {
    await ctx.db.patch(currentRow._id, snapshot);
    return;
  }

  if (currentRow) {
    await ctx.db.patch(currentRow._id, {
      isCurrent: false,
      workspacesUsed,
      updatedAt: now,
    });
  }

  if (matchingRow) {
    await ctx.db.patch(matchingRow._id, snapshot);
    return;
  }

  await ctx.db.insert("planUsageCycles", {
    userId: args.userId,
    cycleStart: window.cycleStart,
    cycleEnd: window.cycleEnd,
    ...snapshot,
  });
}
