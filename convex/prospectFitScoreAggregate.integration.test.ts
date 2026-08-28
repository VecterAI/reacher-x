/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import schema from "./schema";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const modules = import.meta.glob("./**/*.ts");

type StartMigrationArgs = {
  workspaceId: Id<"workspaces">;
  backfillBatchSize?: number;
  verifyBatchSize?: number;
  restart?: boolean;
};
type StartMigrationResult = {
  rolloutId: Id<"fitScoreAggregateRollouts">;
  status: "backfilling" | "verifying" | "verified" | "failed";
  revision: number;
  alreadyActive: boolean;
};

const startMigration = makeFunctionReference<
  "mutation",
  StartMigrationArgs,
  StartMigrationResult
>("prospectFitScoreAggregateMigration:startWorkspaceMigrationInternal");

async function registerAggregate(t: ReturnType<typeof convexTest>) {
  const aggregateTestPath = ["@convex-dev/aggregate", "test"].join("/");
  const aggregateTest = (await import(aggregateTestPath)) as {
    default: {
      register: (instance: typeof t, name?: string) => void;
    };
  };
  aggregateTest.default.register(t, "fitScoreHistogramAggregate");
}

describe("fit-score Aggregate migration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("backfills, verifies, preserves filters, and dual-writes live changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 7, 28, 8));
    const t = convexTest({ schema, modules, transactionLimits: true });
    await registerAggregate(t);

    const seeded = await t.run(async (ctx) => {
      const workosUserId = "fit-score-aggregate-owner";
      const userId = await ctx.db.insert("users", {
        workosUserId,
        email: "fit-score-aggregate@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Aggregate migration",
        description: "Paused migration fixture",
        isDefault: true,
        prospectingWorkflowStatus: "paused",
        updatedAt: getCurrentUTCTimestamp(),
      });
      const otherWorkspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Aggregate isolation",
        description: "Second paused migration fixture",
        isDefault: false,
        prospectingWorkflowStatus: "paused",
        updatedAt: getCurrentUTCTimestamp(),
      });

      const insertProspect = async (args: {
        workspaceId: Id<"workspaces">;
        externalId: string;
        platform: "twitter" | "linkedin";
        status: "new" | "contacted" | "in_progress" | "converted" | "archived";
        score?: number;
        prospectType?: "individual" | "organization" | "unknown";
        origin?: "workspace_discovery" | "setup_preview";
      }) => {
        const prospectId = await ctx.db.insert("prospects", {
          workspaceId: args.workspaceId,
          userId,
          platform: args.platform,
          origin: args.origin ?? "workspace_discovery",
          externalId: args.externalId,
          data: {},
          status: args.status,
          prospectType: args.prospectType,
          qualificationStatus:
            args.score === undefined ? "pending" : "qualified",
          qualificationScore: args.score,
          updatedAt: getCurrentUTCTimestamp(),
        });
        const prospect = await ctx.db.get("prospects", prospectId);
        if (!prospect) throw new Error("Failed to seed prospect");
        await ctx.db.insert(
          "prospectSummaries",
          buildProspectSummaryRecord(prospect)
        );
        return prospect;
      };

      const lowScore = await insertProspect({
        workspaceId,
        externalId: "low-score",
        platform: "twitter",
        status: "new",
        score: 5,
        prospectType: "individual",
      });
      await insertProspect({
        workspaceId,
        externalId: "middle-score",
        platform: "linkedin",
        status: "contacted",
        score: 55,
        prospectType: "organization",
      });
      await insertProspect({
        workspaceId,
        externalId: "max-score",
        platform: "twitter",
        status: "archived",
        score: 100,
        prospectType: "unknown",
      });
      await insertProspect({
        workspaceId,
        externalId: "missing-type",
        platform: "twitter",
        status: "new",
        score: 79,
      });
      await insertProspect({
        workspaceId,
        externalId: "preview-excluded",
        platform: "twitter",
        status: "new",
        score: 85,
        prospectType: "individual",
        origin: "setup_preview",
      });
      await insertProspect({
        workspaceId,
        externalId: "unscored-excluded",
        platform: "linkedin",
        status: "new",
      });
      await insertProspect({
        workspaceId: otherWorkspaceId,
        externalId: "other-workspace",
        platform: "twitter",
        status: "new",
        score: 25,
        prospectType: "individual",
      });

      return {
        workosUserId,
        workspaceId,
        otherWorkspaceId,
        lowScoreProspectId: lowScore._id,
        lowScoreCreatedAt: lowScore._creationTime,
      };
    });

    const start = await t.mutation(startMigration, {
      workspaceId: seeded.workspaceId,
      backfillBatchSize: 2,
      verifyBatchSize: 2,
    });
    expect(start).toMatchObject({
      status: "backfilling",
      revision: 1,
      alreadyActive: false,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const rollout = await t.run(async (ctx) =>
      ctx.db
        .query("fitScoreAggregateRollouts")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique()
    );
    expect(rollout).toMatchObject({
      status: "verified",
      aggregateVersion: 1,
      backfilledCount: 4,
      verifiedSourceCount: 4,
      expectedBinCounts: [1, 0, 0, 0, 0, 1, 0, 1, 0, 1],
      aggregateBinCounts: [1, 0, 0, 0, 0, 1, 0, 1, 0, 1],
    });

    const owner = t.withIdentity({ subject: seeded.workosUserId });
    await expect(
      owner.query(api.prospectSummaries.getWorkspaceFitScoreHistogram, {
        workspaceId: seeded.workspaceId,
      })
    ).resolves.toEqual({
      binCounts: [1, 0, 0, 0, 0, 1, 0, 1, 0, 1],
    });
    await expect(
      owner.query(api.prospectSummaries.getWorkspaceFitScoreHistogram, {
        workspaceId: seeded.workspaceId,
        platform: "twitter",
        prospectType: "unknown",
      })
    ).resolves.toEqual({
      binCounts: [0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
    });
    await expect(
      owner.query(api.prospectSummaries.getWorkspaceFitScoreHistogram, {
        workspaceId: seeded.otherWorkspaceId,
      })
    ).resolves.toEqual({
      binCounts: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    });
    await expect(
      owner.query(api.prospectSummaries.getWorkspaceFitScoreHistogram, {
        workspaceId: seeded.workspaceId,
        createdBeforeMs: seeded.lowScoreCreatedAt,
      })
    ).resolves.toEqual({
      binCounts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    await expect(
      owner.query(api.prospectSummaries.getWorkspaceFitScoreHistogram, {
        workspaceId: seeded.workspaceId,
        createdAfterMs: seeded.lowScoreCreatedAt,
      })
    ).resolves.toEqual({
      binCounts: [1, 0, 0, 0, 0, 1, 0, 1, 0, 1],
    });

    await t.mutation(internal.outreach.updateProspectStatusInternal, {
      prospectId: seeded.lowScoreProspectId,
      status: "contacted",
    });
    await expect(
      owner.query(api.prospectSummaries.getWorkspaceFitScoreHistogram, {
        workspaceId: seeded.workspaceId,
        status: "new",
      })
    ).resolves.toEqual({
      binCounts: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    });
    await expect(
      owner.query(api.prospectSummaries.getWorkspaceFitScoreHistogram, {
        workspaceId: seeded.workspaceId,
        status: "contacted",
      })
    ).resolves.toEqual({
      binCounts: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    });

    await expect(
      t.mutation(startMigration, { workspaceId: seeded.workspaceId })
    ).resolves.toMatchObject({
      rolloutId: start.rolloutId,
      status: "verified",
      revision: 1,
      alreadyActive: true,
    });
  });

  test("stays within transaction limits at maximum migration page sizes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 7, 28, 10));
    const t = convexTest({ schema, modules, transactionLimits: true });
    await registerAggregate(t);
    const workspaceId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "fit-score-bounded-owner",
        email: "fit-score-bounded@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Bounded Aggregate migration",
        description: "Exercises maximum migration page sizes",
        isDefault: true,
        prospectingWorkflowStatus: "paused",
        updatedAt: getCurrentUTCTimestamp(),
      });
      for (let index = 0; index < 100; index += 1) {
        const prospectId = await ctx.db.insert("prospects", {
          workspaceId,
          userId,
          platform: index % 2 === 0 ? "twitter" : "linkedin",
          origin: "workspace_discovery",
          externalId: `bounded-${index}`,
          data: {},
          status: "new",
          prospectType: "individual",
          qualificationStatus: "qualified",
          qualificationScore: 45,
          updatedAt: getCurrentUTCTimestamp(),
        });
        const prospect = await ctx.db.get("prospects", prospectId);
        if (!prospect) throw new Error("Failed to seed bounded prospect");
        await ctx.db.insert(
          "prospectSummaries",
          buildProspectSummaryRecord(prospect)
        );
      }
      return workspaceId;
    });

    const start = await t.mutation(startMigration, { workspaceId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const rollout = await t.run(async (ctx) =>
      ctx.db.get("fitScoreAggregateRollouts", start.rolloutId)
    );
    expect(rollout).toMatchObject({
      status: "verified",
      backfillBatchSize: 25,
      verifyBatchSize: 100,
      backfilledCount: 100,
      verifiedSourceCount: 100,
      expectedBinCounts: [0, 0, 0, 0, 100, 0, 0, 0, 0, 0],
      aggregateBinCounts: [0, 0, 0, 0, 100, 0, 0, 0, 0, 0],
    });
  });

  test("rejects migration while workspace prospecting is running", async () => {
    const t = convexTest(schema, modules);
    await registerAggregate(t);
    const workspaceId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "fit-score-running-owner",
        email: "fit-score-running@example.com",
      });
      return await ctx.db.insert("workspaces", {
        userId,
        name: "Running workspace",
        description: "Must be paused before migration",
        isDefault: true,
        prospectingWorkflowStatus: "running",
        updatedAt: getCurrentUTCTimestamp(),
      });
    });

    await expect(t.mutation(startMigration, { workspaceId })).rejects.toThrow(
      "requires an existing, non-deleting workspace with prospecting paused or stopped"
    );
  });
});
