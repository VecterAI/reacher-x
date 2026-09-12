/// <reference types="vite/client" />
import { DirectAggregate } from "@convex-dev/aggregate";
import polarTest from "@convex-dev/polar/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import { PLAN_LIMITS } from "./lib/planConstants";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const modules = import.meta.glob("./**/*.ts");
const now = Date.UTC(2026, 8, 12, 12);
vi.stubEnv("OPENAI_API_KEY", "test-key");
afterEach(() => vi.useRealTimers());

async function fixture(
  used = 100,
  tier: "free" | "hobby" | "base" | "pro" = "hobby",
  ready = true
) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  polarTest.register(t);
  const data = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "usage-owner",
      email: "owner@example.test",
    });
    const planId = await ctx.db.insert("userPlans", {
      userId,
      tier,
      ...PLAN_LIMITS[tier],
      currentProspectsCount: used,
      updatedAt: now,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Creators",
      description: "Find creators",
      useCaseKey: "creator_outreach",
      isDefault: true,
      setupCompletedAt: now - 1,
      prospectingWorkflowStatus: "running",
      updatedAt: now,
    });
    const otherUserId = await ctx.db.insert("users", {
      workosUserId: "other-owner",
      email: "other@example.test",
    });
    const otherWorkspaceId = await ctx.db.insert("workspaces", {
      userId: otherUserId,
      name: "Other",
      description: "Other",
      isDefault: true,
      updatedAt: now,
    });
    if (ready)
      await ctx.db.insert("workspaceReportingRollouts", {
        workspaceId,
        userId,
        aggregateVersion: 1,
        status: "verified",
        revision: 1,
        stage: "verifyAgentOpsStripes",
        batchSize: 10,
        backfilledCount: 0,
        verifiedSourceCount: 0,
        expectedAnalyticsSums: [],
        expectedAgentOpsSums: [],
        expectedQualifiedUsageCount: used,
        startedAt: now,
        updatedAt: now,
      });
    const aggregate = new DirectAggregate(
      components.workspaceReportingAggregate
    );
    await aggregate.insert(ctx, {
      namespace: [1, workspaceId, "usage"],
      key: ["qualifiedProspectsCount", now],
      id: "usage",
      sumValue: used,
    });
    for (let i = 0; i < used; i++)
      await ctx.db.insert("prospects", {
        userId,
        workspaceId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: `creator-${i}`,
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        qualifiedAt: now,
        updatedAt: now,
      });
    return { userId, planId, workspaceId, otherWorkspaceId };
  });
  return { t, owner: t.withIdentity({ subject: "usage-owner" }), ...data };
}

describe("workspace plan usage", () => {
  test("server-issued query time keeps month-boundary usage and dismissal in the same cycle", async () => {
    const { owner, workspaceId } = await fixture();
    const serverNow = Date.UTC(2026, 8, 30, 23, 59);
    vi.setSystemTime(serverNow);
    const nowMs = await owner.action(api.workspacePlanUsage.getServerTime, {});
    expect(nowMs).toBe(serverNow);
    const usage = (await owner.query(api.workspacePlanUsage.getCurrent, {
      workspaceId,
      nowMs,
    }))!;
    expect(usage).toMatchObject({
      used: 100,
      limitReached: true,
      cycleEnd: Date.UTC(2026, 9, 1) - 1,
    });
    await owner.mutation(api.workspacePlanUsage.dismissNotice, {
      workspaceId,
      noticeKey: usage.noticeKey,
    });
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, {
        workspaceId,
        nowMs,
      })
    ).toMatchObject({ noticeDismissed: true });
    vi.setSystemTime(Date.UTC(2026, 9, 1, 0, 1));
    const nextNowMs = await owner.action(
      api.workspacePlanUsage.getServerTime,
      {}
    );
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, {
        workspaceId,
        nowMs: nextNowMs,
      })
    ).toMatchObject({ used: 0, limitReached: false, noticeDismissed: false });
  });
  test("server-issued query time respects the actual subscription expiry", async () => {
    const { t, owner, workspaceId, userId } = await fixture();
    const start = Date.UTC(2026, 8, 5);
    const end = Date.UTC(2026, 9, 5);
    await t.mutation(components.polar.lib.createProduct, {
      product: {
        id: "clock-product",
        createdAt: new Date(start).toISOString(),
        modifiedAt: null,
        name: "Hobby",
        description: null,
        recurringInterval: "month",
        isRecurring: true,
        isArchived: false,
        organizationId: "clock-test",
        prices: [],
        medias: [],
      },
    });
    await t.mutation(components.polar.lib.insertCustomer, {
      userId,
      id: "clock-customer",
    });
    await t.mutation(components.polar.lib.updateSubscription, {
      subscription: {
        id: "clock-subscription",
        customerId: "clock-customer",
        createdAt: new Date(start).toISOString(),
        modifiedAt: null,
        amount: 1000,
        currency: "usd",
        recurringInterval: "month",
        status: "active",
        currentPeriodStart: new Date(start).toISOString(),
        currentPeriodEnd: new Date(end).toISOString(),
        cancelAtPeriodEnd: false,
        startedAt: new Date(start).toISOString(),
        endedAt: null,
        productId: "clock-product",
        checkoutId: null,
        metadata: {},
      },
    });
    vi.setSystemTime(end - 60_000);
    const nowMs = await owner.action(api.workspacePlanUsage.getServerTime, {});
    const usage = (await owner.query(api.workspacePlanUsage.getCurrent, {
      workspaceId,
      nowMs,
    }))!;
    expect(usage).toMatchObject({
      cycleEnd: end,
      used: 100,
      limitReached: true,
    });
    await owner.mutation(api.workspacePlanUsage.dismissNotice, {
      workspaceId,
      noticeKey: usage.noticeKey,
    });
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, {
        workspaceId,
        nowMs,
      })
    ).toMatchObject({ noticeDismissed: true });
    vi.setSystemTime(end + 60_000);
    const nextNowMs = await owner.action(
      api.workspacePlanUsage.getServerTime,
      {}
    );
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, {
        workspaceId,
        nowMs: nextNowMs,
      })
    ).toMatchObject({
      cycleEnd: Date.UTC(2026, 10, 1) - 1,
      used: 0,
      limitReached: false,
      noticeDismissed: false,
    });
  });
  test.each([0, 99, 100, 105])("matches /usage at %i used", async (used) => {
    const { owner, workspaceId } = await fixture(used);
    const usage = await owner.query(api.workspacePlanUsage.getCurrent, {
      workspaceId,
      nowMs: now,
    });
    const dashboard = await owner.query(api.usage.getUsageDashboard, {
      nowMs: now,
    });
    expect(usage).toMatchObject({
      used,
      limit: 100,
      limitReached: used >= 100,
      entityPlural: "Creators",
      noticeDismissed: false,
    });
    expect(dashboard?.workspaces[0].used).toBe(usage?.used);
    expect(dashboard?.workspaces[0].limit).toBe(usage?.limit);
  });
  test("persists dismissal without changing agent status; scopes it to cycle and plan", async () => {
    const { t, owner, workspaceId, planId } = await fixture();
    const args = { workspaceId, nowMs: now };
    const usage = (await owner.query(api.workspacePlanUsage.getCurrent, args))!;
    await owner.mutation(api.workspacePlanUsage.dismissNotice, {
      workspaceId,
      noticeKey: usage.noticeKey,
    });
    expect(
      (await owner.query(api.workspacePlanUsage.getCurrent, args))
        ?.noticeDismissed
    ).toBe(true);
    expect(
      (await t.run((ctx) => ctx.db.get(workspaceId)))?.prospectingWorkflowStatus
    ).toBe("running");
    await t.run((ctx) =>
      ctx.db.patch(planId, { tier: "base", ...PLAN_LIMITS.base })
    );
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, args)
    ).toMatchObject({
      noticeDismissed: false,
      limitReached: false,
      limit: 1000,
    });
    await t.run((ctx) =>
      ctx.db.patch(planId, { tier: "hobby", ...PLAN_LIMITS.hobby })
    );
    vi.setSystemTime(Date.UTC(2026, 9, 1));
    await owner.mutation(api.workspacePlanUsage.dismissNotice, {
      workspaceId,
      noticeKey: usage.noticeKey,
    });
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, {
        workspaceId,
        nowMs: getCurrentUTCTimestamp(),
      })
    ).toMatchObject({ used: 0, noticeDismissed: false, limitReached: false });
  });
  test("rejects anonymous and cross-workspace dismissal and never leaks usage", async () => {
    const { t, owner, workspaceId, otherWorkspaceId } = await fixture();
    expect(
      await t.query(api.workspacePlanUsage.getCurrent, {
        workspaceId,
        nowMs: now,
      })
    ).toBeNull();
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, {
        workspaceId: otherWorkspaceId,
        nowMs: now,
      })
    ).toBeNull();
    await expect(
      t.mutation(api.workspacePlanUsage.dismissNotice, {
        workspaceId,
        noticeKey: "fake",
      })
    ).rejects.toThrow("Not authenticated");
    await expect(
      owner.mutation(api.workspacePlanUsage.dismissNotice, {
        workspaceId: otherWorkspaceId,
        noticeKey: "fake",
      })
    ).rejects.toThrow("Workspace not found");
  });
  test.each(["free", "pro"] as const)(
    "%s is never reported as a consumed finite allowance",
    async (tier) => {
      const { owner, workspaceId } = await fixture(0, tier);
      expect(
        await owner.query(api.workspacePlanUsage.getCurrent, {
          workspaceId,
          nowMs: now,
        })
      ).toMatchObject({
        tier,
        limitReached: false,
        limit: PLAN_LIMITS[tier].prospectsLimit,
      });
    }
  );
  test("unfinished and deleted workspaces stay out of the header", async () => {
    const { t, owner, workspaceId } = await fixture();
    await t.run((ctx) =>
      ctx.db.patch(workspaceId, { setupCompletedAt: undefined })
    );
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, {
        workspaceId,
        nowMs: now,
      })
    ).toBeNull();
    await t.run((ctx) =>
      ctx.db.patch(workspaceId, {
        setupCompletedAt: now - 1,
        deletionWorkflowId: "deleting",
      })
    );
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, {
        workspaceId,
        nowMs: now,
      })
    ).toBeNull();
  });
  test("unprepared reporting is unknown, not zero usage", async () => {
    const { owner, workspaceId } = await fixture(100, "hobby", false);
    expect(
      await owner.query(api.workspacePlanUsage.getCurrent, {
        workspaceId,
        nowMs: now,
      })
    ).toMatchObject({ used: null });
  });
  test("capacity transition creates one durable notification, including retries after dismissal", async () => {
    const { t, workspaceId } = await fixture();
    const transition = () =>
      t.mutation(internal.workflows.prospecting.updateWorkflowStatus, {
        workspaceId,
        status: "limit_reached",
      });
    await transition();
    await transition();
    const rows = await t.run((ctx) =>
      ctx.db.query("outreachNotifications").collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "plan_limit_reached",
      title: "Creators limit reached",
      targetHref: "/usage",
      actionLabel: "View usage",
      eventVersion: 1,
      status: "pending",
    });
    await t.run((ctx) => ctx.db.patch(rows[0]._id, { status: "dismissed" }));
    await transition();
    expect(
      await t.run((ctx) => ctx.db.query("outreachNotifications").collect())
    ).toEqual([{ ...rows[0], status: "dismissed" }]);
  });
  test.each(["free", "pro"] as const)(
    "does not send limit notification for %s",
    async (tier) => {
      const { t, workspaceId } = await fixture(0, tier);
      await t.mutation(internal.workflows.prospecting.updateWorkflowStatus, {
        workspaceId,
        status: "limit_reached",
      });
      expect(
        await t.run((ctx) => ctx.db.query("outreachNotifications").collect())
      ).toEqual([]);
    }
  );
  test("a new cycle can notify again, but prior-cycle prospects cannot trigger it", async () => {
    const { t, workspaceId, userId } = await fixture();
    const transition = () =>
      t.mutation(internal.workflows.prospecting.updateWorkflowStatus, {
        workspaceId,
        status: "limit_reached",
      });
    await transition();
    const nextCycle = Date.UTC(2026, 9, 2);
    vi.setSystemTime(nextCycle);
    await transition();
    expect(
      await t.run((ctx) => ctx.db.query("outreachNotifications").collect())
    ).toHaveLength(1);
    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++)
        await ctx.db.insert("prospects", {
          userId,
          workspaceId,
          platform: "twitter",
          origin: "workspace_discovery",
          externalId: `next-${i}`,
          data: {},
          status: "new",
          qualificationStatus: "qualified",
          qualifiedAt: nextCycle,
          updatedAt: nextCycle,
        });
    });
    await transition();
    const notifications = await t.run((ctx) =>
      ctx.db.query("outreachNotifications").collect()
    );
    expect(notifications).toHaveLength(2);
    expect(new Set(notifications.map((n) => n.notificationKey)).size).toBe(2);
  });
});
