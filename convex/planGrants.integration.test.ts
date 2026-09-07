/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import polarTest from "@convex-dev/polar/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import { PLAN_LIMITS, type PaidPlanTier } from "./lib/planConstants";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { resolveGrantExpiry } from "./lib/planGrantCore";
import { isWorkspaceAccessibleForUser } from "./lib/workspaceEntitlements";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import { refreshUserPlanFromBilling } from "./lib/planTransitionCore";

const modules = import.meta.glob("./**/*.ts");
const NOW = Date.UTC(2026, 8, 7, 12);
const DAY = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  for (const tier of ["hobby", "base", "pro"]) {
    vi.stubEnv(
      `POLAR_PRODUCT_${tier.toUpperCase()}_MONTHLY`,
      `product-${tier}`
    );
  }
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function fixture(email = "tester@example.com") {
  const t = convexTest(schema, modules);
  polarTest.register(t);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      workosUserId: email,
      email,
      onboardingCompletedAt: undefined,
    })
  );
  for (const tier of ["hobby", "base", "pro"]) {
    await t.mutation(components.polar.lib.createProduct, {
      product: {
        id: `product-${tier}`,
        createdAt: new Date(NOW).toISOString(),
        modifiedAt: null,
        name: tier,
        description: null,
        recurringInterval: "month",
        isRecurring: true,
        isArchived: false,
        organizationId: "qa-org",
        prices: [],
        medias: [],
      },
    });
  }
  await t.mutation(components.polar.lib.insertCustomer, {
    userId,
    id: `customer-${email}`,
  });
  const subscription = (tier: PaidPlanTier, status = "active") => ({
    id: `subscription-${email}`,
    customerId: `customer-${email}`,
    createdAt: new Date(NOW).toISOString(),
    modifiedAt: new Date(getCurrentUTCTimestamp()).toISOString(),
    amount: 1000,
    currency: "usd",
    recurringInterval: "month",
    status,
    currentPeriodStart: new Date(NOW - DAY * 4).toISOString(),
    currentPeriodEnd: new Date(NOW + DAY * 90).toISOString(),
    cancelAtPeriodEnd: false,
    startedAt: new Date(NOW).toISOString(),
    endedAt:
      status === "canceled"
        ? new Date(getCurrentUTCTimestamp()).toISOString()
        : null,
    productId: `product-${tier}`,
    checkoutId: null,
    metadata: {},
  });
  async function bill(tier: PaidPlanTier, status = "active") {
    const sub = subscription(tier, status);
    await t.mutation(components.polar.lib.updateSubscription, {
      subscription: sub,
    });
    await t.mutation(internal.polar.syncSubscriptionToUserPlan, {
      userId,
      productId: sub.productId,
      subscriptionId: sub.id,
      status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      polarCustomerId: sub.customerId,
    });
  }
  const grant = (tier: PaidPlanTier, durationDays = 30) =>
    t.mutation(internal.testerPlans.grantTesterPlanByEmail, {
      email,
      tier,
      durationDays,
    });
  const state = () =>
    t.run(async (ctx) => ({
      plan: await ctx.db
        .query("userPlans")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
      grant: await ctx.db
        .query("complimentaryPlanGrants")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique(),
      user: await ctx.db.get(userId),
      usage: await ctx.db
        .query("planUsageCycles")
        .withIndex("by_user_is_current", (q) =>
          q.eq("userId", userId).eq("isCurrent", true)
        )
        .unique(),
    }));
  async function advance(ms: number) {
    vi.advanceTimersByTime(ms);
    await t.finishInProgressScheduledFunctions();
  }
  return { t, userId, email, subscription, bill, grant, state, advance };
}

describe("complimentary plan grants", () => {
  test.each(["hobby", "base", "pro"] as const)(
    "%s grant expires automatically without a subscription",
    async (tier) => {
      const f = await fixture();
      await f.grant(tier, 60);
      expect((await f.state()).plan).toMatchObject({
        tier,
        subscriptionTier: "free",
        ...PLAN_LIMITS[tier],
      });
      expect((await f.state()).user?.onboardingCompletedAt).toBeUndefined();
      await f.advance(60 * DAY - 1);
      expect((await f.state()).plan?.tier).toBe(tier);
      await f.advance(1);
      const state = await f.state();
      expect(state.grant).toBeNull();
      expect(state.plan).toMatchObject({ tier: "free", ...PLAN_LIMITS.free });
      expect(state.usage).toMatchObject({ tier: "free", prospectsLimit: 0 });
      expect(state.user?.onboardingCompletedAt).toBeUndefined();
      const jobs = await f.t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").take(10)
      );
      expect(jobs.some((job) => job.state.kind === "success")).toBe(true);
    }
  );

  test.each(["hobby", "base"] as const)(
    "Pro upgrade restores paid %s and preserves billing identity/cycle",
    async (tier) => {
      const f = await fixture();
      await f.bill(tier);
      await f.grant("pro");
      const before = await f.state();
      expect(before.plan).toMatchObject({
        tier: "pro",
        subscriptionTier: tier,
        externalSubscriptionId: f.subscription(tier).id,
      });
      expect(before.usage?.cycleStart).toBe(NOW - DAY * 4);
      await f.advance(DAY * 30);
      const after = await f.state();
      expect(after.plan).toMatchObject({
        tier,
        externalSubscriptionId: f.subscription(tier).id,
        ...PLAN_LIMITS[tier],
      });
      expect(after.usage).toMatchObject({ tier, cycleStart: NOW - DAY * 4 });
    }
  );

  test("extension ignores the old expiry job, including an identical new end date", async () => {
    const f = await fixture();
    await f.grant("pro", 1);
    const old = (await f.state()).grant!;
    await f.grant("base", 2);
    await f.advance(DAY);
    await f.t.mutation(internal.testerPlans.expireGrantInternal, {
      grantId: old._id,
    });
    expect((await f.state()).plan?.tier).toBe("base");
    const second = (await f.state()).grant!;
    await f.t.mutation(internal.testerPlans.grantTesterPlanByEmail, {
      email: f.email,
      tier: "hobby",
      expiresAt: second.expiresAt,
    });
    await f.t.mutation(internal.testerPlans.expireGrantInternal, {
      grantId: second._id,
    });
    expect((await f.state()).plan?.tier).toBe("hobby");
    await f.advance(DAY);
    expect((await f.state()).plan?.tier).toBe("free");
  });

  test("revocation restores billing, is idempotent, and old jobs cannot revoke a new grant", async () => {
    const f = await fixture();
    await f.bill("hobby");
    await f.grant("pro", 1);
    await f.t.mutation(internal.testerPlans.revokeTesterPlanByEmail, {
      email: f.email,
    });
    await f.t.mutation(internal.testerPlans.revokeTesterPlanByEmail, {
      email: f.email,
    });
    expect((await f.state()).plan?.tier).toBe("hobby");
    await f.grant("base", 2);
    await f.advance(DAY);
    expect((await f.state()).plan?.tier).toBe("base");
  });

  test("billing renewals and plan changes keep the gift, then restore the latest paid tier", async () => {
    const f = await fixture();
    await f.bill("hobby");
    await f.grant("pro");
    await f.bill("hobby");
    expect((await f.state()).plan?.tier).toBe("pro");
    await f.bill("base");
    expect((await f.state()).plan?.tier).toBe("pro");
    await f.advance(DAY * 30);
    expect((await f.state()).plan?.tier).toBe("base");
  });

  test("cancellation during a gift keeps the gift and prevents resurrecting a canceled subscription", async () => {
    const f = await fixture();
    await f.bill("base");
    await f.grant("pro");
    await f.bill("base", "canceled");
    expect((await f.state()).plan?.tier).toBe("pro");
    await f.advance(DAY * 30);
    expect((await f.state()).plan?.tier).toBe("free");
  });

  test("a lower gift never reduces paid access, including a purchase during the gift", async () => {
    const f = await fixture();
    await f.grant("hobby");
    await f.bill("pro");
    expect((await f.state()).plan?.tier).toBe("pro");
    await f.grant("base");
    expect((await f.state()).plan?.tier).toBe("pro");
    await f.advance(DAY * 30);
    expect((await f.state()).plan?.tier).toBe("pro");
  });

  test("a stale billing callback cannot roll back the latest subscription", async () => {
    const f = await fixture();
    await f.bill("hobby");
    await f.grant("pro", 1);
    await f.bill("base");
    await f.t.mutation(internal.polar.syncSubscriptionToUserPlan, {
      userId: f.userId,
      productId: "product-hobby",
      status: "canceled",
    });
    expect((await f.state()).plan).toMatchObject({
      tier: "pro",
      subscriptionTier: "base",
    });
    await f.advance(DAY);
    expect((await f.state()).plan?.tier).toBe("base");
  });

  test("expiry restores workspace limits without deleting workspaces or resetting usage", async () => {
    const f = await fixture();
    await f.bill("hobby");
    await f.grant("pro", 1);
    const workspaceIds = await f.t.run(async (ctx) => {
      const ids = [];
      for (let slot = 1; slot <= 3; slot++) {
        ids.push(
          await ctx.db.insert("workspaces", {
            userId: f.userId,
            name: `Workspace ${slot}`,
            description: "QA workspace",
            entitlementSlot: slot,
            setupCompletedAt: NOW,
            updatedAt: NOW,
            isDefault: slot === 1,
            prospectingWorkflowStatus: "paused",
          })
        );
      }
      const prospectId = await ctx.db.insert("prospects", {
        userId: f.userId,
        workspaceId: ids[0],
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qa-qualified",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        qualifiedAt: NOW,
        updatedAt: NOW,
      });
      const prospect = await ctx.db.get(prospectId);
      await ctx.db.insert(
        "prospectSummaries",
        buildProspectSummaryRecord(prospect!)
      );
      return ids;
    });
    await f.t.run(async (ctx) => {
      for (const id of workspaceIds)
        expect(
          await isWorkspaceAccessibleForUser(ctx, (await ctx.db.get(id))!)
        ).toBe(true);
    });
    // Check the expiry transaction directly; independent capacity reconciliation
    // jobs are covered by the existing workspace lifecycle suite.
    const grant = (await f.state()).grant!;
    vi.setSystemTime(NOW + DAY);
    await f.t.mutation(internal.testerPlans.expireGrantInternal, {
      grantId: grant._id,
    });
    const state = await f.state();
    expect(state.plan).toMatchObject({
      tier: "hobby",
      currentProspectsCount: 1,
      workspacesLimit: 1,
    });
    expect(state.usage).toMatchObject({ tier: "hobby", prospectsUsed: 1 });
    await f.t.run(async (ctx) => {
      for (const [i, id] of workspaceIds.entries()) {
        const workspace = await ctx.db.get(id);
        expect(workspace).not.toBeNull();
        expect(await isWorkspaceAccessibleForUser(ctx, workspace!)).toBe(
          i === 0
        );
      }
    });
  });

  test("cancel-at-period-end remains paid until the subscription ends", async () => {
    const f = await fixture();
    await f.bill("hobby");
    await f.grant("pro");
    await f.t.mutation(components.polar.lib.updateSubscription, {
      subscription: { ...f.subscription("hobby"), cancelAtPeriodEnd: true },
    });
    await f.advance(DAY * 30);
    expect((await f.state()).plan?.tier).toBe("hobby");
  });

  test.each(["incomplete", "incomplete_expired", "unpaid", "canceled"])(
    "does not restore %s subscriptions",
    async (status) => {
      const f = await fixture();
      await f.bill("base", status);
      await f.grant("pro");
      await f.advance(DAY * 30);
      const { plan } = await f.state();
      expect(plan?.tier).toBe("free");
      expect(plan?.externalSubscriptionId).toBeUndefined();
      expect(plan?.expiresAt).toBeUndefined();
      expect(plan?.polarCustomerId).toBeUndefined();
    }
  );

  test.each(["trialing", "past_due"])(
    "restores %s according to existing billing policy",
    async (status) => {
      const f = await fixture();
      await f.bill("base", status);
      await f.grant("pro");
      await f.advance(DAY * 30);
      expect((await f.state()).plan?.tier).toBe("base");
    }
  );

  test("unknown user fails and one user's grant never affects another", async () => {
    const f = await fixture();
    await expect(
      f.t.mutation(internal.testerPlans.grantTesterPlanByEmail, {
        email: "missing@example.com",
        tier: "pro",
        durationDays: 1,
      })
    ).rejects.toThrow("User not found");
    const other = await f.t.run((ctx) =>
      ctx.db.insert("users", {
        workosUserId: "other",
        email: "other@example.com",
      })
    );
    await f.grant("pro");
    expect(
      await f.t
        .withIdentity({ subject: "other" })
        .query(api.plans.getCurrentPlan)
    ).toMatchObject({ tier: "free" });
    expect(
      await f.t.query(internal.plans.getPaidFeatureEligibilityByUserId, {
        userId: other,
      })
    ).toMatchObject({ allowed: false });
    expect(
      await f.t.query(internal.plans.getPaidFeatureEligibilityByUserId, {
        userId: f.userId,
      })
    ).toMatchObject({ allowed: true });
  });

  test("normalizes operator email and returns separate grant and billing details", async () => {
    const f = await fixture();
    const result = await f.t.mutation(
      internal.testerPlans.grantTesterPlanByEmail,
      { email: " TESTER@EXAMPLE.COM ", tier: "hobby", durationDays: 30 }
    );
    expect(result).toMatchObject({
      tier: "hobby",
      complimentaryGrant: { tier: "hobby", expiresAt: NOW + 30 * DAY },
    });
    expect(result.externalSubscriptionId).toBeUndefined();
    const publicPlan = await f.t
      .withIdentity({ subject: f.email })
      .query(api.plans.getCurrentPlan);
    expect(publicPlan).toMatchObject({
      complimentaryGrant: { tier: "hobby", expiresAt: NOW + 30 * DAY },
      subscriptionTier: "free",
    });
  });

  test("grant and schedule roll back together if billing reconciliation fails", async () => {
    const t = convexTest(schema, modules);
    // Deliberately omit the Polar component to fail after the grant is written.
    await t.run((ctx) =>
      ctx.db.insert("users", {
        workosUserId: "rollback",
        email: "rollback@example.com",
      })
    );
    await expect(
      t.mutation(internal.testerPlans.grantTesterPlanByEmail, {
        email: "rollback@example.com",
        tier: "pro",
        durationDays: 1,
      })
    ).rejects.toThrow();
    const state = await t.run(async (ctx) => ({
      grants: await ctx.db.query("complimentaryPlanGrants").take(10),
      plans: await ctx.db.query("userPlans").take(10),
      jobs: await ctx.db.system.query("_scheduled_functions").take(10),
    }));
    expect(state).toEqual({ grants: [], plans: [], jobs: [] });
  });

  test("invalid input leaves an existing grant unchanged", async () => {
    const f = await fixture();
    await f.grant("base");
    const original = (await f.state()).grant;
    for (const args of [
      {},
      { durationDays: 0 },
      { durationDays: -1 },
      { durationDays: 1, expiresAt: NOW + DAY },
      { expiresAt: NOW },
      { expiresAt: NOW - 1 },
    ]) {
      await expect(
        f.t.mutation(internal.testerPlans.grantTesterPlanByEmail, {
          email: f.email,
          tier: "pro",
          ...args,
        })
      ).rejects.toThrow();
      expect((await f.state()).grant).toEqual(original);
    }
  });

  test.each([NaN, Infinity, -Infinity, Number.MAX_VALUE])(
    "rejects non-finite or overflowing duration %s",
    (value) => {
      expect(() => resolveGrantExpiry(NOW, { durationDays: value })).toThrow();
      expect(() => resolveGrantExpiry(NOW, { expiresAt: value })).toThrow();
    }
  );

  test("deleted user, duplicate jobs, and early callback are safe", async () => {
    const f = await fixture();
    await f.grant("pro", 1);
    const grant = (await f.state()).grant!;
    await f.t.mutation(internal.testerPlans.expireGrantInternal, {
      grantId: grant._id,
    });
    expect((await f.state()).grant).not.toBeNull();
    await f.t.run((ctx) => ctx.db.delete(f.userId));
    await f.advance(DAY);
    await f.t.mutation(internal.testerPlans.expireGrantInternal, {
      grantId: grant._id,
    });
    expect((await f.state()).grant).toBeNull();
  });

  test("recovery processes overdue grants when the original schedule is missing", async () => {
    const f = await fixture();
    await f.grant("pro", 1);
    await f.t.run(async (ctx) => {
      for (const job of await ctx.db.system
        .query("_scheduled_functions")
        .take(10))
        await ctx.scheduler.cancel(job._id);
    });
    await f.advance(DAY);
    await f.t.mutation(internal.testerPlans.recoverExpiredGrantsInternal, {});
    await f.advance(1);
    expect((await f.state()).plan?.tier).toBe("free");
  });

  test("billing refresh clears an overdue grant before its delayed job runs", async () => {
    const f = await fixture();
    await f.bill("hobby");
    await f.grant("pro", 1);
    const grant = (await f.state()).grant!;
    // Change the clock without executing scheduled callbacks.
    vi.setSystemTime(NOW + DAY);
    await f.bill("base");
    expect((await f.state()).grant).toBeNull();
    expect((await f.state()).plan?.tier).toBe("base");
    const summary = await f.t
      .withIdentity({ subject: f.email })
      .query(api.plans.getCurrentPlan, {});
    expect(summary?.complimentaryGrant).toBeNull();
    await f.t.mutation(internal.testerPlans.expireGrantInternal, {
      grantId: grant._id,
    });
    expect((await f.state()).plan?.tier).toBe("base");
  });

  test.each(["future", "expired", "indefinite"])(
    "migrates %s legacy grants idempotently without disturbing billing",
    async (kind) => {
      const f = await fixture();
      await f.bill("hobby");
      const expiresAt =
        kind === "indefinite"
          ? undefined
          : NOW + (kind === "future" ? DAY : -DAY);
      await f.t.run(async (ctx) => {
        const plan = await ctx.db
          .query("userPlans")
          .withIndex("by_user", (q) => q.eq("userId", f.userId))
          .unique();
        await ctx.db.patch(plan!._id, {
          tier: "pro",
          externalSubscriptionId: "tester_free_access",
          expiresAt,
        });
        await refreshUserPlanFromBilling(ctx, f.userId);
        await refreshUserPlanFromBilling(ctx, f.userId);
      });
      expect((await f.state()).plan?.tier).toBe(
        kind === "expired" ? "hobby" : "pro"
      );
      expect((await f.state()).plan?.externalSubscriptionId).toBe(
        f.subscription("hobby").id
      );
      await f.advance(DAY);
      expect((await f.state()).plan?.tier).toBe(
        kind === "indefinite" ? "pro" : "hobby"
      );
    }
  );
});
