/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  getWorkspaceAnalyticsContributionsFromProspect,
  getWorkspaceStatsContributionFromProspect,
  mergeWorkspaceAnalyticsContributions,
  mergeWorkspaceStatsContributions,
} from "./lib/readModelHelpers";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("striped read-model cutover", () => {
  test("combines an immutable baseline with a signed prospect update", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 7, 28, 7));
    const t = convexTest(schema, modules);

    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "read-model-stripe-owner",
        email: "read-model-stripe@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Striped read models",
        description: "Test workspace",
        isDefault: true,
        updatedAt: Date.now(),
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "stripe-prospect",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        qualificationScore: 82,
        qualifiedAt: Date.now(),
        updatedAt: Date.now(),
      });
      const prospect = await ctx.db.get("prospects", prospectId);
      if (!prospect) throw new Error("Failed to seed prospect");

      const stats = mergeWorkspaceStatsContributions(null, {
        workspaceId,
        userId,
        add: [getWorkspaceStatsContributionFromProspect(prospect)],
      });
      await ctx.db.insert("workspaceStats", stats);

      const analyticsByDay = new Map<
        number,
        ReturnType<typeof mergeWorkspaceAnalyticsContributions>
      >();
      for (const entry of getWorkspaceAnalyticsContributionsFromProspect(
        prospect
      )) {
        const analytics = mergeWorkspaceAnalyticsContributions(
          analyticsByDay.get(entry.dayStartUtcMs) ?? null,
          {
            workspaceId,
            dayStartUtcMs: entry.dayStartUtcMs,
            add: [entry.contribution],
          }
        );
        analyticsByDay.set(entry.dayStartUtcMs, analytics);
      }
      for (const analytics of analyticsByDay.values()) {
        await ctx.db.insert("workspaceAnalyticsDaily", analytics);
      }

      return { workspaceId, prospectId };
    });

    vi.setSystemTime(Date.UTC(2026, 7, 28, 9));
    await t.mutation(internal.outreach.updateProspectStatusInternal, {
      prospectId: seeded.prospectId,
      status: "contacted",
    });

    const stats = await t.query(
      internal.workspaceStats.getWorkspaceStatsInternal,
      { workspaceId: seeded.workspaceId }
    );
    const analytics = await t.query(
      internal.workspaceAnalyticsDaily.listWorkspaceAnalyticsDailyInternal,
      { workspaceId: seeded.workspaceId }
    );
    const stripeState = await t.run(async (ctx) => ({
      stats: await ctx.db.query("workspaceStatsStripes").collect(),
      analytics: await ctx.db.query("workspaceAnalyticsDailyStripes").collect(),
    }));

    expect(stats).toMatchObject({
      totalProspectsCount: 1,
      newProspectsCount: 0,
      contactedProspectsCount: 1,
      qualifiedProspectsCount: 1,
      qualificationScoreSum: 82,
      qualificationScoreCount: 1,
      avgQualificationScore: 82,
    });
    expect(analytics).toHaveLength(1);
    expect(analytics[0]).toMatchObject({
      newProspectsCount: 1,
      reachedContactedProspectsCount: 1,
      qualificationQualifiedCount: 1,
    });
    expect(analytics[0].hourlyNewProspectsCounts[7]).toBe(1);
    expect(analytics[0].hourlyReachedContactedProspectsCounts[7]).toBe(1);
    expect(stripeState.stats).toHaveLength(1);
    expect(stripeState.stats[0]).toMatchObject({
      newProspectsCount: -1,
      contactedProspectsCount: 1,
    });
    expect(stripeState.analytics).toHaveLength(1);

    const analyticsSnapshot = await t
      .withIdentity({ subject: "read-model-stripe-owner" })
      .action(api.analytics.getDashboardAnalyticsSnapshot, {
        workspaceId: seeded.workspaceId,
        range: "custom",
        timeZone: "UTC",
        fromDate: "2026-08-28",
        toDate: "2026-08-28",
      });
    expect(analyticsSnapshot).toMatchObject({
      status: "success",
      data: {
        newProspects: { value: 1 },
      },
    });
    expect(analyticsSnapshot.data.pipelineFunnel.slice(0, 2)).toMatchObject([
      { stage: "new", count: 1 },
      { stage: "contacted", count: 1 },
    ]);

    const stageCounts = await t
      .withIdentity({ subject: "read-model-stripe-owner" })
      .action(api.prospectSummaries.getWorkspaceProspectStageCountsSnapshot, {
        workspaceId: seeded.workspaceId,
        visibilityMode: "all",
      });
    expect(stageCounts).toEqual({ new: 0, contacted: 1, in_progress: 0 });
  });
});
