/// <reference types="vite/client" />

import type { MigrationResult } from "@convex-dev/migrations";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import {
  getOrCreateUserPlan,
  upgradePlan,
} from "./lib/planCore";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function runRemovalMigrationPass(
  t: ReturnType<typeof convexTest>
) {
  let cursor: string | null = null;
  let processed = 0;
  let batches = 0;

  while (true) {
    const result: MigrationResult = await t.mutation(
      internal.migrations.removeLegacyCurrentWorkspacesCount,
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
}

describe("legacy workspace counter removal", () => {
  test("new plan writers omit the legacy workspace counter", async () => {
    const t = convexTest(schema, modules);

    const state = await t.run(async (ctx) => {
      const defaultUserId = await ctx.db.insert("users", {
        workosUserId: "workspace-counter-default-plan",
        email: "workspace-counter-default@example.com",
      });
      const upgradedUserId = await ctx.db.insert("users", {
        workosUserId: "workspace-counter-upgraded-plan",
        email: "workspace-counter-upgraded@example.com",
      });

      await getOrCreateUserPlan(ctx, defaultUserId);
      await upgradePlan(ctx, upgradedUserId, "hobby");

      const defaultPlan = await ctx.db
        .query("userPlans")
        .withIndex("by_user", (q) => q.eq("userId", defaultUserId))
        .unique();
      const upgradedPlan = await ctx.db
        .query("userPlans")
        .withIndex("by_user", (q) => q.eq("userId", upgradedUserId))
        .unique();

      return { defaultPlan, upgradedPlan };
    });

    expect(state.defaultPlan).not.toHaveProperty("currentWorkspacesCount");
    expect(state.upgradedPlan).not.toHaveProperty("currentWorkspacesCount");
  });

  test("removes existing values and is safe to rerun", async () => {
    const t = convexTest(schema, modules);

    const ids = await t.run(async (ctx) => {
      const legacyUserId = await ctx.db.insert("users", {
        workosUserId: "workspace-counter-legacy-owner",
        email: "workspace-counter-legacy@example.com",
      });
      const modernUserId = await ctx.db.insert("users", {
        workosUserId: "workspace-counter-modern-owner",
        email: "workspace-counter-modern@example.com",
      });
      const legacyPlanId = await ctx.db.insert("userPlans", {
        userId: legacyUserId,
        tier: "hobby",
        prospectsLimit: 100,
        workspacesLimit: 1,
        currentProspectsCount: 24,
        currentWorkspacesCount: 7,
        updatedAt: 1,
      });
      const modernPlanId = await ctx.db.insert("userPlans", {
        userId: modernUserId,
        tier: "base",
        prospectsLimit: 1000,
        workspacesLimit: 2,
        currentProspectsCount: 12,
        updatedAt: 2,
      });

      return { legacyPlanId, modernPlanId };
    });

    const readPlans = async () =>
      await t.run(async (ctx) => ({
        legacy: await ctx.db.get("userPlans", ids.legacyPlanId),
        modern: await ctx.db.get("userPlans", ids.modernPlanId),
      }));

    const firstResult = await runRemovalMigrationPass(t);
    const firstState = await readPlans();

    expect(firstResult.processed).toBe(2);
    expect(firstResult.batches).toBeGreaterThanOrEqual(1);
    expect(firstState.legacy).toMatchObject({
      currentProspectsCount: 24,
      updatedAt: 1,
    });
    expect(firstState.modern).toMatchObject({
      currentProspectsCount: 12,
      updatedAt: 2,
    });
    expect(firstState.legacy).not.toHaveProperty("currentWorkspacesCount");
    expect(firstState.modern).not.toHaveProperty("currentWorkspacesCount");

    const secondResult = await runRemovalMigrationPass(t);
    const secondState = await readPlans();

    expect(secondResult.processed).toBe(2);
    expect(secondState).toEqual(firstState);
  });
});
