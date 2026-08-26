/// <reference types="vite/client" />

import type { MigrationResult } from "@convex-dev/migrations";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  computeUsageCycleWindow,
  getUtcMonthBounds,
} from "./lib/planCycleUtils";
import { PLAN_LIMITS } from "./lib/planConstants";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

vi.stubEnv("OPENAI_API_KEY", "plan-usage-reconciliation-test-key");

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

async function readUsageState(
  t: TestConvex<typeof schema>,
  userId: Id<"users">
) {
  return await t.run(async (ctx) => {
    const plan = await ctx.db
      .query("userPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const cycles = await ctx.db
      .query("planUsageCycles")
      .withIndex("by_user_cycle_start", (q) => q.eq("userId", userId))
      .collect();
    return {
      plan,
      currentCycle: cycles.find((cycle) => cycle.isCurrent),
      historicalCycles: cycles.filter((cycle) => !cycle.isCurrent),
    };
  });
}

describe("current plan usage reconciliation migration", () => {
  test("repairs stale 32-to-24 usage and is safe to rerun", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T12:00:00.000Z"));

    const t = convexTest(schema, modules);
    await registerPolarComponent(t);
    const now = Date.now();
    const currentWindow = computeUsageCycleWindow({
      now,
      tier: "hobby",
      subscription: null,
    });
    const previousWindow = getUtcMonthBounds(currentWindow.cycleStart - 1);

    const userId = await t.run(async (ctx) => {
      const seededUserId = await ctx.db.insert("users", {
        workosUserId: "plan-usage-reconciliation-owner",
        email: "usage-reconciliation@example.com",
      });
      await ctx.db.insert("userPlans", {
        userId: seededUserId,
        tier: "hobby",
        prospectsLimit: PLAN_LIMITS.hobby.prospectsLimit,
        workspacesLimit: PLAN_LIMITS.hobby.workspacesLimit,
        currentProspectsCount: 32,
        currentProspectsCycleStart: currentWindow.cycleStart,
        currentProspectsCycleEnd: currentWindow.cycleEnd,
        currentWorkspacesCount: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("planUsageCycles", {
        userId: seededUserId,
        tier: "hobby",
        cycleStart: currentWindow.cycleStart,
        cycleEnd: currentWindow.cycleEnd,
        prospectsUsed: 32,
        prospectsLimit: PLAN_LIMITS.hobby.prospectsLimit,
        workspacesUsed: 1,
        workspacesLimit: PLAN_LIMITS.hobby.workspacesLimit,
        isCurrent: true,
        updatedAt: 1,
      });
      await ctx.db.insert("planUsageCycles", {
        userId: seededUserId,
        tier: "hobby",
        cycleStart: previousWindow.cycleStart,
        cycleEnd: previousWindow.cycleEnd,
        prospectsUsed: 8,
        prospectsLimit: PLAN_LIMITS.hobby.prospectsLimit,
        workspacesUsed: 1,
        workspacesLimit: PLAN_LIMITS.hobby.workspacesLimit,
        isCurrent: false,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId: seededUserId,
        name: "Untitled workspace",
        description: "Production-style usage reconciliation fixture.",
        isDefault: true,
        setupCompletedAt: now,
        updatedAt: now,
      });

      for (let index = 0; index < 24; index += 1) {
        const prospectId = await ctx.db.insert("prospects", {
          workspaceId,
          userId: seededUserId,
          platform: "twitter",
          origin: "workspace_discovery",
          externalId: `remaining-qualified-${index}`,
          data: {},
          status: "new",
          qualificationStatus: "qualified",
          qualifiedAt: now,
          updatedAt: now,
        });
        const prospect = await ctx.db.get("prospects", prospectId);
        if (!prospect) throw new Error("Failed to seed qualified prospect");
        await ctx.db.insert(
          "prospectSummaries",
          buildProspectSummaryRecord(prospect)
        );
      }

      return seededUserId;
    });

    const runMigrationPass = async () => {
      let cursor: string | null = null;
      let processed = 0;
      let batches = 0;

      while (true) {
        const result: MigrationResult = await t.mutation(
          internal.migrations.reconcileCurrentPlanUsage,
          {
            cursor,
            dryRun: false,
            oneBatchOnly: true,
          }
        );
        processed += result.processed;
        batches += 1;
        if (result.isDone) return { processed, batches };
        cursor = result.continueCursor;
      }
    };

    const firstResult = await runMigrationPass();
    const firstState = await readUsageState(t, userId);

    expect(firstResult).toEqual({ processed: 1, batches: 2 });
    expect(firstState.plan).toMatchObject({
      currentProspectsCount: 24,
      currentProspectsCycleStart: currentWindow.cycleStart,
      currentProspectsCycleEnd: currentWindow.cycleEnd,
      currentWorkspacesCount: 1,
    });
    expect(firstState.currentCycle).toMatchObject({
      prospectsUsed: 24,
      workspacesUsed: 1,
      isCurrent: true,
    });
    expect(firstState.historicalCycles).toHaveLength(1);
    expect(firstState.historicalCycles[0]).toMatchObject({
      cycleStart: previousWindow.cycleStart,
      cycleEnd: previousWindow.cycleEnd,
      prospectsUsed: 8,
      isCurrent: false,
      updatedAt: 1,
    });

    const secondResult = await runMigrationPass();
    const secondState = await readUsageState(t, userId);

    expect(secondResult).toEqual({ processed: 1, batches: 2 });
    expect(secondState).toEqual(firstState);
  });
});
