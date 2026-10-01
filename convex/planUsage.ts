// convex/planUsage.ts
// Cycle-based usage snapshots for billing and usage dashboards

import type { Id } from "./_generated/dataModel";
import { polar } from "./polar";
import type { MutationCtx } from "./_generated/server";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { requireUser } from "./lib/accessHelpers";
import { internalMutation, mutation } from "./lib/functionBuilders";
import { reconcilePlanUsageForUser } from "./lib/planUsageCore";
import { areAutonomousJobsPaused } from "./lib/autonomousJobHelpers";
import { scheduleWorkspaceCapacityReconciliationForUser } from "./lib/workspaceCapacityCore";

async function reconcileUsageCyclesForUser(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const subscription = await polar.getCurrentSubscription(ctx, { userId });
  await reconcilePlanUsageForUser(ctx, {
    userId,
    subscription,
  });
}

export const rolloverStaleUsageCycles = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (areAutonomousJobsPaused()) {
      console.warn(
        "[PlanUsage] Autonomous jobs paused, skipping usage cycle rollover"
      );
      return;
    }
    const now = getCurrentUTCTimestamp();
    const stale = await ctx.db
      .query("planUsageCycles")
      .filter((q) =>
        q.and(q.eq(q.field("isCurrent"), true), q.lt(q.field("cycleEnd"), now))
      )
      .collect();

    const userIds = [...new Set(stale.map((row) => row.userId))];
    await Promise.all(
      userIds.map(async (userId) => {
        await reconcileUsageCyclesForUser(ctx, userId);
        await scheduleWorkspaceCapacityReconciliationForUser(ctx, userId);
      })
    );
  },
});

export const ensureUsageCycles = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await reconcileUsageCyclesForUser(ctx, user._id);

    await scheduleWorkspaceCapacityReconciliationForUser(ctx, user._id);
  },
});
