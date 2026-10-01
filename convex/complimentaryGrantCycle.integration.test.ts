/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { PLAN_LIMITS } from "./lib/planConstants";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

vi.stubEnv("OPENAI_API_KEY", "complimentary-grant-cycle-test-key");

afterEach(() => {
  vi.useRealTimers();
});

async function registerPolarComponent(t: TestConvex<typeof schema>) {
  const polarTestPath = ["@convex-dev/polar", "test"].join("/");
  const polarTest = (await import(polarTestPath)) as {
    default: { register: (instance: typeof t) => void };
  };
  polarTest.default.register(t);
}

describe("complimentary grant usage cycles", () => {
  test("limit checks run on the grant term, not calendar months", async () => {
    vi.useFakeTimers();
    // Fake now sits inside the grant term (Sep 7 -> Oct 7), and past the
    // calendar-month boundary (Oct 1): the limit window must still follow the
    // grant term instead of resetting on the calendar month.
    vi.setSystemTime(new Date("2026-10-05T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    await registerPolarComponent(t);

    const grantStart = Date.UTC(2026, 8, 7, 15, 0, 0, 0);
    const grantEnd = Date.UTC(2026, 9, 7, 15, 0, 0, 0);
    const workspaceId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "grant-cycle-user",
        email: "grant-cycle@example.test",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "hobby",
        prospectsLimit: PLAN_LIMITS.hobby.prospectsLimit,
        workspacesLimit: PLAN_LIMITS.hobby.workspacesLimit,
        currentProspectsCount: 0,
        updatedAt: 1,
      });
      await ctx.db.insert("complimentaryPlanGrants", {
        userId,
        tier: "hobby",
        createdAt: grantStart,
        expiresAt: grantEnd,
      });
      return await ctx.db.insert("workspaces", {
        userId,
        name: "Grant cycle",
        description: "Grant cycle test workspace",
        isDefault: true,
        updatedAt: 1,
      });
    });

    const limitState = await t.query(
      internal.workflows.prospecting.checkProspectLimitInternal,
      { workspaceId }
    );

    expect(limitState.tier).toBe("hobby");
    expect(limitState.cycleStart).toBe(grantStart);
    expect(limitState.cycleEnd).toBe(grantEnd);
    // The calendar-month boundary must not leak into the grant term window.
    expect(limitState.cycleStart).not.toBe(Date.UTC(2026, 9, 1, 0, 0, 0, 0));
  });

  test("limit_reached stores the cycle window and resume clears it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    await registerPolarComponent(t);

    const workspaceId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "grant-cycle-limit-user",
        email: "grant-cycle-limit@example.test",
      });
      return await ctx.db.insert("workspaces", {
        userId,
        name: "Grant cycle limit",
        description: "Grant cycle limit test workspace",
        isDefault: true,
        updatedAt: 1,
      });
    });

    await t.mutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId,
      status: "limit_reached",
      limitCycleStart: 12345,
    });
    const limited = await t.run(async (ctx) =>
      ctx.db.get("workspaces", workspaceId)
    );
    expect(limited?.prospectingLimitCycleStart).toBe(12345);

    await t.mutation(internal.workflows.prospecting.updateWorkflowStatus, {
      workspaceId,
      status: "running",
    });
    const resumed = await t.run(async (ctx) =>
      ctx.db.get("workspaces", workspaceId)
    );
    expect(resumed?.prospectingLimitCycleStart).toBeUndefined();
    expect(resumed?.prospectingWorkflowStatus).toBe("running");
  });
});
