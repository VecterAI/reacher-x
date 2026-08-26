/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { getUtcMonthBounds } from "./lib/planCycleUtils";
import { PLAN_LIMITS } from "./lib/planConstants";
import schema from "./schema";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const modules = import.meta.glob("./**/*.ts");

async function seedBaseTester(t: ReturnType<typeof convexTest>) {
  const now = getCurrentUTCTimestamp();
  const currentWindow = getUtcMonthBounds(now);
  const previousWindow = getUtcMonthBounds(currentWindow.cycleStart - 1);
  const email = "plan-transition@example.com";

  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "workos-plan-transition",
      email,
    });

    await ctx.db.insert("userPlans", {
      userId,
      tier: "base",
      prospectsLimit: PLAN_LIMITS.base.prospectsLimit,
      workspacesLimit: PLAN_LIMITS.base.workspacesLimit,
      currentProspectsCount: 0,
      currentProspectsCycleStart: currentWindow.cycleStart,
      currentProspectsCycleEnd: currentWindow.cycleEnd,
      externalSubscriptionId: "tester_free_access",
      updatedAt: now,
    });

    await ctx.db.insert("planUsageCycles", {
      userId,
      tier: "base",
      cycleStart: currentWindow.cycleStart,
      cycleEnd: currentWindow.cycleEnd,
      prospectsUsed: 0,
      prospectsLimit: PLAN_LIMITS.base.prospectsLimit,
      workspacesUsed: 0,
      workspacesLimit: PLAN_LIMITS.base.workspacesLimit,
      isCurrent: true,
      updatedAt: now,
    });

    await ctx.db.insert("planUsageCycles", {
      userId,
      tier: "hobby",
      cycleStart: previousWindow.cycleStart,
      cycleEnd: previousWindow.cycleEnd,
      prospectsUsed: 25,
      prospectsLimit: PLAN_LIMITS.hobby.prospectsLimit,
      workspacesUsed: 1,
      workspacesLimit: PLAN_LIMITS.hobby.workspacesLimit,
      isCurrent: false,
      updatedAt: previousWindow.cycleEnd,
    });

    return userId;
  });

  return { currentWindow, email, previousWindow, userId };
}

describe("trusted plan transitions", () => {
  test("granting Pro updates the canonical plan and current usage snapshot atomically", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedBaseTester(t);

    await t.mutation(internal.testerPlans.grantTesterPlanByEmail, {
      email: seeded.email,
      tier: "pro",
    });

    const state = await t.run(async (ctx) => {
      const plan = await ctx.db
        .query("userPlans")
        .withIndex("by_user", (q) => q.eq("userId", seeded.userId))
        .unique();
      const currentCycle = await ctx.db
        .query("planUsageCycles")
        .withIndex("by_user_is_current", (q) =>
          q.eq("userId", seeded.userId).eq("isCurrent", true)
        )
        .unique();
      const previousCycle = await ctx.db
        .query("planUsageCycles")
        .withIndex("by_user_cycle_start", (q) =>
          q
            .eq("userId", seeded.userId)
            .eq("cycleStart", seeded.previousWindow.cycleStart)
        )
        .unique();

      return { currentCycle, plan, previousCycle };
    });

    expect(state.plan).toMatchObject({
      tier: "pro",
      prospectsLimit: PLAN_LIMITS.pro.prospectsLimit,
      workspacesLimit: PLAN_LIMITS.pro.workspacesLimit,
      externalSubscriptionId: "tester_free_access",
    });
    expect(state.currentCycle).toMatchObject({
      tier: "pro",
      cycleStart: seeded.currentWindow.cycleStart,
      cycleEnd: seeded.currentWindow.cycleEnd,
      prospectsLimit: PLAN_LIMITS.pro.prospectsLimit,
      workspacesLimit: PLAN_LIMITS.pro.workspacesLimit,
      isCurrent: true,
    });
    expect(state.previousCycle).toMatchObject({
      tier: "hobby",
      prospectsLimit: PLAN_LIMITS.hobby.prospectsLimit,
      workspacesLimit: PLAN_LIMITS.hobby.workspacesLimit,
      isCurrent: false,
    });
  });

  test("revoking tester access uses the same transition and clears paid limits", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedBaseTester(t);

    await t.mutation(internal.testerPlans.revokeTesterPlanByEmail, {
      email: seeded.email,
    });

    const state = await t.run(async (ctx) => {
      const plan = await ctx.db
        .query("userPlans")
        .withIndex("by_user", (q) => q.eq("userId", seeded.userId))
        .unique();
      const currentCycle = await ctx.db
        .query("planUsageCycles")
        .withIndex("by_user_is_current", (q) =>
          q.eq("userId", seeded.userId).eq("isCurrent", true)
        )
        .unique();
      return { currentCycle, plan };
    });

    expect(state.plan).toMatchObject({
      tier: "free",
      prospectsLimit: PLAN_LIMITS.free.prospectsLimit,
      workspacesLimit: PLAN_LIMITS.free.workspacesLimit,
    });
    expect(state.plan?.externalSubscriptionId).toBeUndefined();
    expect(state.currentCycle).toMatchObject({
      tier: "free",
      prospectsLimit: PLAN_LIMITS.free.prospectsLimit,
      workspacesLimit: PLAN_LIMITS.free.workspacesLimit,
      isCurrent: true,
    });
  });
});
