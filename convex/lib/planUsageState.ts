import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { polar } from "../polar";
import { computeUsageCycleWindow } from "./planCycleUtils";
import { getOrCreateUserPlan } from "./planCore";

type PlanUsageCtx = QueryCtx | MutationCtx;

async function getWorkspaceCountForUser(
  ctx: PlanUsageCtx,
  userId: Id<"users">
): Promise<number> {
  const workspaces = await ctx.db
    .query("workspaces")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  return workspaces.length;
}

export async function readStoredQualifiedProspectUsageSnapshot(
  ctx: PlanUsageCtx,
  userId: Id<"users">
) {
  const plan = await getOrCreateUserPlan(ctx, userId);
  const subscription = await polar.getCurrentSubscription(ctx, { userId });
  const window = computeUsageCycleWindow({
    now: getCurrentUTCTimestamp(),
    tier: plan.tier,
    subscription,
  });

  const currentRows = await ctx.db
    .query("planUsageCycles")
    .withIndex("by_user_is_current", (q) =>
      q.eq("userId", userId).eq("isCurrent", true)
    )
    .collect();
  const matchingCurrentRow =
    currentRows.find(
      (row) =>
        row.cycleStart === window.cycleStart && row.cycleEnd === window.cycleEnd
    ) ?? null;

  const planMatchesCurrentWindow =
    plan.currentProspectsCycleStart === window.cycleStart &&
    plan.currentProspectsCycleEnd === window.cycleEnd;

  const used = matchingCurrentRow
    ? matchingCurrentRow.prospectsUsed
    : planMatchesCurrentWindow
      ? plan.currentProspectsCount
      : 0;

  return {
    plan,
    window,
    used,
  };
}

export async function applyQualifiedProspectUsageTransition(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    previousQualified: boolean;
    previousQualifiedAt?: number;
    nextQualified: boolean;
    nextQualifiedAt?: number;
  }
) {
  const snapshot = await readStoredQualifiedProspectUsageSnapshot(
    ctx,
    args.userId
  );
  const { plan, window } = snapshot;

  const countsInCurrentWindow = (qualified: boolean, qualifiedAt?: number) =>
    qualified &&
    typeof qualifiedAt === "number" &&
    qualifiedAt >= window.cycleStart &&
    qualifiedAt <= window.cycleEnd;

  const previousCounted = countsInCurrentWindow(
    args.previousQualified,
    args.previousQualifiedAt
  );
  const nextCounted = countsInCurrentWindow(
    args.nextQualified,
    args.nextQualifiedAt
  );
  const delta = Number(nextCounted) - Number(previousCounted);

  if (delta === 0) {
    return {
      delta,
      used: snapshot.used,
      window,
    };
  }

  const now = getCurrentUTCTimestamp();
  const nextUsed = Math.max(0, snapshot.used + delta);

  if (plan._id) {
    await ctx.db.patch(plan._id, {
      currentProspectsCount: nextUsed,
      currentProspectsCycleStart: window.cycleStart,
      currentProspectsCycleEnd: window.cycleEnd,
      updatedAt: now,
    });
  }

  const currentRows = await ctx.db
    .query("planUsageCycles")
    .withIndex("by_user_is_current", (q) =>
      q.eq("userId", args.userId).eq("isCurrent", true)
    )
    .collect();
  const matchingRow =
    currentRows.find(
      (row) =>
        row.cycleStart === window.cycleStart && row.cycleEnd === window.cycleEnd
    ) ??
    (
      await ctx.db
        .query("planUsageCycles")
        .withIndex("by_user_cycle_start", (q) =>
          q.eq("userId", args.userId).eq("cycleStart", window.cycleStart)
        )
        .collect()
    ).find((row) => row.cycleEnd === window.cycleEnd) ??
    null;

  for (const row of currentRows) {
    if (matchingRow && row._id === matchingRow._id) {
      continue;
    }

    await ctx.db.patch(row._id, {
      isCurrent: false,
      updatedAt: now,
    });
  }

  const workspacesUsed = await getWorkspaceCountForUser(ctx, args.userId);

  if (matchingRow) {
    await ctx.db.patch(matchingRow._id, {
      tier: plan.tier,
      prospectsUsed: nextUsed,
      prospectsLimit: plan.prospectsLimit,
      workspacesUsed,
      workspacesLimit: plan.workspacesLimit,
      isCurrent: true,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("planUsageCycles", {
      userId: args.userId,
      tier: plan.tier,
      cycleStart: window.cycleStart,
      cycleEnd: window.cycleEnd,
      prospectsUsed: nextUsed,
      prospectsLimit: plan.prospectsLimit,
      workspacesUsed,
      workspacesLimit: plan.workspacesLimit,
      isCurrent: true,
      updatedAt: now,
    });
  }

  return {
    delta,
    used: nextUsed,
    window,
  };
}
