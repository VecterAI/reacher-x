// convex/planUsage.ts
// Cycle-based usage snapshots for billing and usage dashboards

import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { polar } from "./polar";
import type { MutationCtx } from "./_generated/server";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { requireUser } from "./lib/accessHelpers";
import { getOrCreateUserPlan, getWorkspaceCount } from "./lib/planHelpers";
import { computeUsageCycleWindow } from "./lib/planCycleUtils";
import { internalMutation, mutation } from "./lib/functionBuilders";
import { computeQualifiedProspectUsageForWindow } from "./lib/planUsageState";

function windowMatchesCycle(
  row: { cycleStart: number; cycleEnd: number },
  window: { cycleStart: number; cycleEnd: number }
) {
  return (
    row.cycleStart === window.cycleStart && row.cycleEnd === window.cycleEnd
  );
}

async function reconcileUsageCyclesForUser(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const now = getCurrentUTCTimestamp();
  const plan = await getOrCreateUserPlan(ctx, userId);
  const subscription = await polar.getCurrentSubscription(ctx, { userId });
  const window = computeUsageCycleWindow({
    now,
    tier: plan.tier,
    subscription,
  });
  const wsUsed = await getWorkspaceCount(ctx, userId);

  const currentRows = await ctx.db
    .query("planUsageCycles")
    .withIndex("by_user_is_current", (q) =>
      q.eq("userId", userId).eq("isCurrent", true)
    )
    .collect();

  const currentRow = currentRows[0] ?? null;
  for (const extra of currentRows.slice(1)) {
    await ctx.db.patch(extra._id, { isCurrent: false, updatedAt: now });
  }

  const matchingRows = await ctx.db
    .query("planUsageCycles")
    .withIndex("by_user_cycle_start", (q) =>
      q.eq("userId", userId).eq("cycleStart", window.cycleStart)
    )
    .collect();
  const matchingRow =
    matchingRows.find((row) => row.cycleEnd === window.cycleEnd) ?? null;

  const qInWindow = await computeQualifiedProspectUsageForWindow(
    ctx,
    userId,
    window
  );

  if (plan._id) {
    await ctx.db.patch(plan._id, {
      currentProspectsCount: qInWindow,
      currentProspectsCycleStart: window.cycleStart,
      currentProspectsCycleEnd: window.cycleEnd,
      updatedAt: now,
    });
  }

  if (currentRow && windowMatchesCycle(currentRow, window)) {
    await ctx.db.patch(currentRow._id, {
      prospectsUsed: qInWindow,
      prospectsLimit: plan.prospectsLimit,
      workspacesUsed: wsUsed,
      workspacesLimit: plan.workspacesLimit,
      tier: plan.tier,
      updatedAt: now,
    });
    return;
  }

  if (currentRow) {
    await ctx.db.patch(currentRow._id, {
      isCurrent: false,
      workspacesUsed: wsUsed,
      updatedAt: now,
    });
  }

  if (matchingRow) {
    await ctx.db.patch(matchingRow._id, {
      tier: plan.tier,
      prospectsUsed: qInWindow,
      prospectsLimit: plan.prospectsLimit,
      workspacesUsed: wsUsed,
      workspacesLimit: plan.workspacesLimit,
      isCurrent: true,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("planUsageCycles", {
    userId,
    tier: plan.tier,
    cycleStart: window.cycleStart,
    cycleEnd: window.cycleEnd,
    prospectsUsed: qInWindow,
    prospectsLimit: plan.prospectsLimit,
    workspacesUsed: wsUsed,
    workspacesLimit: plan.workspacesLimit,
    isCurrent: true,
    updatedAt: now,
  });
}

export const rolloverStaleUsageCycles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = getCurrentUTCTimestamp();
    const stale = await ctx.db
      .query("planUsageCycles")
      .filter((q) =>
        q.and(q.eq(q.field("isCurrent"), true), q.lt(q.field("cycleEnd"), now))
      )
      .collect();

    const seen = new Set<string>();
    for (const row of stale) {
      const key = row.userId;
      if (seen.has(key)) continue;
      seen.add(key);
      await reconcileUsageCyclesForUser(ctx, row.userId);

      const workspaces = await ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", row.userId))
        .collect();
      for (const workspace of workspaces) {
        await ctx.scheduler.runAfter(
          0,
          internal.workspaces.reconcileWorkspaceCapacityStateInternal,
          {
            workspaceId: workspace._id,
          }
        );
      }
    }
  },
});

export const ensureUsageCycles = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await reconcileUsageCyclesForUser(ctx, user._id);

    const workspaces = await ctx.db
      .query("workspaces")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    for (const workspace of workspaces) {
      await ctx.scheduler.runAfter(
        0,
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: workspace._id,
        }
      );
    }
  },
});
