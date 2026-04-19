// convex/planUsage.ts
// Cycle-based usage snapshots for the Plans page

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { polar } from "./polar";
import type { MutationCtx } from "./_generated/server";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { format } from "date-fns";
import { requireUser } from "./lib/accessHelpers";
import {
  getCurrentQualifiedProspectUsage,
  getOrCreateUserPlan,
  getPlanUsageSummary,
  getWorkspaceCount,
} from "./lib/planHelpers";
import { computeUsageCycleWindow } from "./lib/planCycleUtils";
import { internalMutation, mutation, query } from "./lib/functionBuilders";
import { getUserFromIdentity } from "./lib/userUtils";
import { countQualifiedProspectsInRange } from "./lib/planQualifiedCount";

async function reconcileUsageCyclesForUser(
  ctx: MutationCtx,
  userId: Id<"users">
) {
  const now = getCurrentUTCTimestamp();
  const plan = await getOrCreateUserPlan(ctx, userId);
  const currentQualifiedUsage = await getCurrentQualifiedProspectUsage(
    ctx,
    userId
  );
  const window = currentQualifiedUsage.window;
  const wsUsed = await getWorkspaceCount(ctx, userId);
  const qInWindow = currentQualifiedUsage.used;

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

  const windowMatches = (r: NonNullable<typeof currentRow>) =>
    r.cycleStart === window.cycleStart && r.cycleEnd === window.cycleEnd;

  const planDoc = await ctx.db
    .query("userPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (planDoc) {
    await ctx.db.patch(planDoc._id, {
      currentProspectsCount: qInWindow,
      updatedAt: now,
    });
  }

  if (currentRow && windowMatches(currentRow)) {
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
    const qSnapshot = await countQualifiedProspectsInRange(
      ctx,
      userId,
      currentRow.cycleStart,
      currentRow.cycleEnd
    );
    await ctx.db.patch(currentRow._id, {
      isCurrent: false,
      prospectsUsed: qSnapshot,
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

export const getUsageCyclesForPlansPage = query({
  args: {
    selectedCycleId: v.optional(v.id("planUsageCycles")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserFromIdentity(ctx, identity, false);
    if (!user) return null;

    const planSummary = await getPlanUsageSummary(ctx, user._id);
    const cycles = await ctx.db
      .query("planUsageCycles")
      .withIndex("by_user_cycle_start", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    const subscription = await polar.getCurrentSubscription(ctx, {
      userId: user._id,
    });
    const now = getCurrentUTCTimestamp();
    const window = computeUsageCycleWindow({
      now,
      tier: planSummary.tier,
      subscription,
    });

    const resetLabel = format(window.cycleEnd, "d MMM");

    const currentCycleDoc = cycles.find((c) => c.isCurrent);
    const selectedId =
      args.selectedCycleId ?? currentCycleDoc?._id ?? cycles[0]?._id ?? null;

    const selectedDoc = selectedId
      ? cycles.find((c) => c._id === selectedId)
      : cycles[0];

    const isSelectedCurrent =
      selectedDoc?.isCurrent === true &&
      selectedDoc.cycleStart === window.cycleStart &&
      selectedDoc.cycleEnd === window.cycleEnd;

    const prospectsUsed = isSelectedCurrent
      ? planSummary.prospects.used
      : (selectedDoc?.prospectsUsed ?? planSummary.prospects.used);
    const prospectsLimit = isSelectedCurrent
      ? planSummary.prospects.limit
      : (selectedDoc?.prospectsLimit ?? planSummary.prospects.limit);
    const workspacesUsed = isSelectedCurrent
      ? planSummary.workspaces.used
      : (selectedDoc?.workspacesUsed ?? planSummary.workspaces.used);
    const workspacesLimit = isSelectedCurrent
      ? planSummary.workspaces.limit
      : (selectedDoc?.workspacesLimit ?? planSummary.workspaces.limit);

    const cycleOptions = cycles.map((c) => ({
      id: c._id,
      label: `${format(c.cycleStart, "d MMM")} – ${format(c.cycleEnd, "d MMM yyyy")}`,
      isCurrent: c.isCurrent,
    }));

    return {
      resetLabel,
      cycleOptions,
      selectedCycleId: selectedId,
      prospects: {
        used: prospectsUsed,
        limit: prospectsLimit,
        unlimited: prospectsLimit === -1,
        percentUsed:
          prospectsLimit === -1
            ? 0
            : Math.min(
                100,
                Math.round((prospectsUsed / Math.max(1, prospectsLimit)) * 100)
              ),
      },
      workspaces: {
        used: workspacesUsed,
        limit: workspacesLimit,
        percentUsed: Math.min(
          100,
          Math.round((workspacesUsed / Math.max(1, workspacesLimit)) * 100)
        ),
      },
    };
  },
});
