/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  getWorkspaceAnalyticsContributionsFromProspect,
  mergeWorkspaceAnalyticsContributions,
  type WorkspaceAnalyticsDailyRecord,
} from "./lib/readModelHelpers";
import schema from "./schema";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  getWorkspaceAgentOpsContributionsFromKeyword,
  mergeWorkspaceAgentOpsContributions,
} from "./lib/agentOpsReadModelHelpers";
import { getWorkspaceReportingMetricSums } from "./lib/workspaceReportingAggregate";

const modules = import.meta.glob("./**/*.ts");

const startMigration = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces">; batchSize?: number },
  {
    rolloutId: Id<"workspaceReportingRollouts">;
    status: "backfilling" | "verifying" | "verified" | "failed";
    revision: number;
    alreadyActive: boolean;
  }
>("workspaceReportingMigration:startWorkspaceMigrationInternal");

async function registerPolar(t: ReturnType<typeof convexTest>) {
  const polarTestPath = ["@convex-dev/polar", "test"].join("/");
  const polarTest = (await import(polarTestPath)) as {
    default: { register: (instance: typeof t) => void };
  };
  polarTest.default.register(t);
}

describe("workspace reporting Aggregate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("backfills exact totals and keeps analytics reactive after cutover", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 7, 30, 12, 30));
    const t = convexTest({ schema, modules, transactionLimits: true });
    await registerPolar(t);

    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "reporting-aggregate-owner",
        email: "reporting-aggregate@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Realtime reporting",
        description: "Paused reporting migration fixture",
        isDefault: true,
        setupCompletedAt: getCurrentUTCTimestamp(),
        prospectingWorkflowStatus: "paused",
        updatedAt: getCurrentUTCTimestamp(),
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "pro",
        prospectsLimit: -1,
        workspacesLimit: -1,
        currentProspectsCount: 1,
        updatedAt: getCurrentUTCTimestamp(),
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "reporting-existing",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        qualifiedAt: getCurrentUTCTimestamp(),
        updatedAt: getCurrentUTCTimestamp(),
      });
      const prospect = await ctx.db.get("prospects", prospectId);
      if (!prospect) throw new Error("Failed to seed prospect");

      const rows = new Map<number, WorkspaceAnalyticsDailyRecord>();
      for (const targeted of getWorkspaceAnalyticsContributionsFromProspect(
        prospect
      )) {
        rows.set(
          targeted.dayStartUtcMs,
          mergeWorkspaceAnalyticsContributions(
            rows.get(targeted.dayStartUtcMs) ?? null,
            {
              workspaceId,
              dayStartUtcMs: targeted.dayStartUtcMs,
              add: [targeted.contribution],
            }
          )
        );
      }
      for (const row of rows.values()) {
        await ctx.db.insert("workspaceAnalyticsDaily", row);
      }
      const keywordId = await ctx.db.insert("keywords", {
        workspaceId,
        type: "seed",
        value: "realtime",
      });
      const keyword = await ctx.db.get("keywords", keywordId);
      if (!keyword) throw new Error("Failed to seed keyword");
      const keywordContribution =
        getWorkspaceAgentOpsContributionsFromKeyword(keyword)[0];
      if (!keywordContribution) throw new Error("Missing keyword contribution");
      await ctx.db.insert(
        "workspaceAgentOpsDaily",
        mergeWorkspaceAgentOpsContributions(null, {
          workspaceId,
          dayStartUtcMs: keywordContribution.dayStartUtcMs,
          add: [keywordContribution.contribution],
        })
      );
      return { userId, workspaceId };
    });

    await t.mutation(internal.prospects.createProspectsBatch, {
      userId: seeded.userId,
      workspaceId: seeded.workspaceId,
      prospects: [
        {
          platform: "linkedin",
          origin: "workspace_discovery",
          externalId: "reporting-pre-rollout",
          data: {},
          qualificationStatus: "disqualified",
        },
      ],
    });
    await expect(
      t.run((ctx) =>
        getWorkspaceReportingMetricSums(ctx, {
          workspaceId: seeded.workspaceId,
          dataset: "analytics",
          queries: [
            {
              metric: "hourlyNewProspectsCounts",
              startMs: Number.MIN_SAFE_INTEGER,
              endMs: Number.MAX_SAFE_INTEGER,
            },
          ],
        })
      )
    ).resolves.toEqual([0]);

    const migration = await t.mutation(startMigration, {
      workspaceId: seeded.workspaceId,
      batchSize: 2,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.run((ctx) =>
        ctx.db.get("workspaceReportingRollouts", migration.rolloutId)
      )
    ).resolves.toMatchObject({
      status: "verified",
      expectedQualifiedUsageCount: 1,
      aggregateQualifiedUsageCount: 1,
    });

    const owner = t.withIdentity({ subject: "reporting-aggregate-owner" });
    const queryArgs = {
      workspaceId: seeded.workspaceId,
      range: "7d" as const,
      nowMs: getCurrentUTCTimestamp(),
    };
    const before = await owner.query(
      api.analytics.getDashboardAnalytics,
      queryArgs
    );
    expect(before.status).toBe("success");
    expect(before.data.newProspects.value).toBe(2);
    expect(before.data.processingSummary.disqualified.value).toBe(1);
    const agentOpsBefore = await owner.query(
      api.agentOps.getAgentOpsDashboard,
      {
        ...queryArgs,
        tab: "overview",
      }
    );
    expect(agentOpsBefore.discovery.stats.keywordsCreated.value).toBe(1);
    const usageBefore = await owner.query(api.usage.getUsageDashboard, {
      nowMs: queryArgs.nowMs,
    });
    expect(usageBefore?.workspaces).toEqual([
      expect.objectContaining({ workspaceId: seeded.workspaceId, used: 1 }),
    ]);

    await t.mutation(internal.prospects.createProspectsBatch, {
      userId: seeded.userId,
      workspaceId: seeded.workspaceId,
      prospects: [
        {
          platform: "linkedin",
          origin: "workspace_discovery",
          externalId: "reporting-live",
          data: {},
          qualificationStatus: "qualified",
        },
      ],
    });

    const after = await owner.query(
      api.analytics.getDashboardAnalytics,
      queryArgs
    );
    expect(after.status).toBe("success");
    expect(after.data.newProspects.value).toBe(3);
    expect(after.data.platformDistribution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ platform: "Twitter/X", count: 1 }),
        expect.objectContaining({ platform: "LinkedIn", count: 2 }),
      ])
    );
    const usageAfter = await owner.query(api.usage.getUsageDashboard, {
      nowMs: queryArgs.nowMs,
    });
    expect(usageAfter?.workspaces).toEqual([
      expect.objectContaining({ workspaceId: seeded.workspaceId, used: 2 }),
    ]);
  });

  test("rebuilds stale analytics before the Aggregate migration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 7, 30, 12, 30));
    const t = convexTest({ schema, modules, transactionLimits: true });
    await registerPolar(t);

    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "reporting-stale-analytics-owner",
        email: "reporting-stale-analytics@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Stale analytics reporting",
        description: "Paused stale analytics migration fixture",
        isDefault: true,
        setupCompletedAt: getCurrentUTCTimestamp(),
        prospectingWorkflowStatus: "paused",
        updatedAt: getCurrentUTCTimestamp(),
      });
      const firstProspectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "reporting-stale-first",
        data: {},
        status: "new",
        qualificationStatus: "disqualified",
        qualificationScore: 45,
        disqualifiedAt: getCurrentUTCTimestamp(),
        updatedAt: getCurrentUTCTimestamp(),
      });
      await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "reporting-stale-second",
        data: {},
        status: "new",
        qualificationStatus: "disqualified",
        qualificationScore: 45,
        disqualifiedAt: getCurrentUTCTimestamp(),
        updatedAt: getCurrentUTCTimestamp(),
      });

      const firstProspect = await ctx.db.get("prospects", firstProspectId);
      if (!firstProspect) throw new Error("Failed to seed stale prospect");
      for (const targeted of getWorkspaceAnalyticsContributionsFromProspect(
        firstProspect
      )) {
        await ctx.db.insert(
          "workspaceAnalyticsDaily",
          mergeWorkspaceAnalyticsContributions(null, {
            workspaceId,
            dayStartUtcMs: targeted.dayStartUtcMs,
            add: [targeted.contribution],
          })
        );
      }

      return { workspaceId };
    });

    const analyticsRebuilt = await t.action(
      internal.workspaceAnalyticsDaily.rebuildWorkspaceAnalyticsDailyInternal,
      { workspaceId: seeded.workspaceId }
    );
    expect(analyticsRebuilt).toMatchObject({
      prospectsProcessed: 2,
    });

    const migration = await t.mutation(startMigration, {
      workspaceId: seeded.workspaceId,
      batchSize: 2,
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const rollout = await t.run((ctx) =>
      ctx.db.get("workspaceReportingRollouts", migration.rolloutId)
    );
    expect(rollout).toMatchObject({
      status: "verified",
      expectedQualifiedUsageCount: 0,
      aggregateQualifiedUsageCount: 0,
    });
    expect(rollout?.expectedAnalyticsSums).toEqual(
      rollout?.aggregateAnalyticsSums
    );
    expect(rollout?.aggregateAnalyticsSums?.[0]).toBe(2);
    expect(rollout?.aggregateAnalyticsSums?.[4]).toBe(2);
    expect(rollout?.aggregateAnalyticsSums?.[9]).toBe(2);
    expect(rollout?.aggregateAnalyticsSums?.[11]).toBe(2);
  });

  test("does not start backfill when a reporting write lands during preparation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 7, 30, 12, 30));
    const t = convexTest({ schema, modules, transactionLimits: true });
    await registerPolar(t);

    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "reporting-preparation-fence-owner",
        email: "reporting-preparation-fence@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Fenced reporting preparation",
        description: "Paused reporting preparation fixture",
        isDefault: true,
        setupCompletedAt: getCurrentUTCTimestamp(),
        prospectingWorkflowStatus: "paused",
        updatedAt: getCurrentUTCTimestamp(),
      });
      return { userId, workspaceId };
    });

    const preparation = await t.mutation(
      internal.workspaceReportingMigration
        .beginWorkspaceMigrationPreparationInternal,
      { workspaceId: seeded.workspaceId, batchSize: 2 }
    );
    expect(preparation).toMatchObject({
      status: "preparing",
      preparationVersion: 0,
      alreadyActive: false,
    });

    await t.mutation(internal.prospects.createProspectsBatch, {
      userId: seeded.userId,
      workspaceId: seeded.workspaceId,
      prospects: [
        {
          platform: "twitter",
          origin: "workspace_discovery",
          externalId: "reporting-during-preparation",
          data: {},
          qualificationStatus: "disqualified",
        },
      ],
    });

    const fenced = await t.mutation(
      internal.workspaceReportingMigration
        .completeWorkspaceMigrationPreparationInternal,
      {
        rolloutId: preparation.rolloutId,
        revision: preparation.revision,
        expectedPreparationVersion: preparation.preparationVersion,
      }
    );
    expect(fenced).toMatchObject({ status: "preparing", started: false });
    expect(fenced.preparationVersion).toBeGreaterThan(0);

    const started = await t.mutation(
      internal.workspaceReportingMigration
        .completeWorkspaceMigrationPreparationInternal,
      {
        rolloutId: preparation.rolloutId,
        revision: preparation.revision,
        expectedPreparationVersion: fenced.preparationVersion,
      }
    );
    expect(started).toMatchObject({ status: "backfilling", started: true });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const rollout = await t.run((ctx) =>
      ctx.db.get("workspaceReportingRollouts", preparation.rolloutId)
    );
    expect(rollout).toMatchObject({ status: "verified" });
    expect(rollout?.expectedAnalyticsSums).toEqual(
      rollout?.aggregateAnalyticsSums
    );
  });

  test("fences a memory inventory write during preparation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 7, 30, 12, 30));
    const t = convexTest({ schema, modules, transactionLimits: true });
    await registerPolar(t);

    const workspaceId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "reporting-memory-fence-owner",
        email: "reporting-memory-fence@example.com",
      });
      return await ctx.db.insert("workspaces", {
        userId,
        name: "Memory preparation fence",
        description: "Paused memory preparation fixture",
        isDefault: true,
        setupCompletedAt: getCurrentUTCTimestamp(),
        prospectingWorkflowStatus: "paused",
        updatedAt: getCurrentUTCTimestamp(),
      });
    });

    const preparation = await t.mutation(
      internal.workspaceReportingMigration
        .beginWorkspaceMigrationPreparationInternal,
      { workspaceId }
    );
    await t.mutation(
      internal.memory.ensureWorkspaceAgentMemoryInventoryBatchInternal,
      {
        workspaceId,
        rows: [
          {
            memoryId: "memory-created-during-preparation",
            createdAt: getCurrentUTCTimestamp(),
            title: "Concurrent memory",
            summary: "A memory created while reporting is preparing",
            source: "qualification",
            category: "qualification_win_pattern",
            confidence: 0.95,
            impactScore: 0.9,
            relatedQueriesCount: 1,
            evidenceCount: 1,
          },
        ],
      }
    );

    const rollout = await t.run((ctx) =>
      ctx.db.get("workspaceReportingRollouts", preparation.rolloutId)
    );
    expect(rollout).toMatchObject({ status: "preparing" });
    expect(rollout?.preparationVersion).toBeGreaterThan(0);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const failure = await t.mutation(
        internal.workspaceReportingMigration
          .recordWorkspaceMigrationPreparationFailureInternal,
        {
          rolloutId: preparation.rolloutId,
          revision: preparation.revision,
          error: `Preparation failure ${attempt}`,
        }
      );
      expect(failure.status).toBe(attempt === 3 ? "failed" : "preparing");
    }
    await expect(
      t.run((ctx) =>
        ctx.db.get("workspaceReportingRollouts", preparation.rolloutId)
      )
    ).resolves.toMatchObject({
      status: "failed",
      preparationFailureCount: 3,
      error: "Preparation failure 3",
    });
  });
});
