/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { DirectAggregate } from "@convex-dev/aggregate";
import { describe, expect, test } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
import {
  buildAgentOpsDashboardFromSlices,
  getAgentOpsDashboardWindow,
  getAgentOpsTrendSliceOffsets,
  AGENT_OPS_MAX_TREND_BUCKETS,
} from "./lib/agentOpsDashboardCore";
import {
  AGENT_OPS_HOURLY_FIELDS,
  createEmptyWorkspaceAgentOpsDailyRecord,
} from "./lib/agentOpsReadModelHelpers";
import {
  WORKSPACE_ANALYTICS_HOURLY_FIELDS,
  createEmptyWorkspaceAnalyticsDailyRecord,
} from "./lib/readModelHelpers";
import { buildAgentOpsDashboardData } from "./lib/agentOpsCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const modules = import.meta.glob("./**/*.ts");
const nowMs = Date.UTC(2026, 8, 7, 12, 30);
const tabs = [
  "overview",
  "discovery",
  "quality",
  "memory",
  "activity",
] as const;

async function fixture() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const seeded = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "ops-owner",
      email: "ops@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Agent Ops",
      description: "Isolated reporting fixture",
      isDefault: true,
      reportingTimeZone: "UTC",
      updatedAt: getCurrentUTCTimestamp(),
    });
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
      expectedQualifiedUsageCount: 0,
      startedAt: nowMs,
      updatedAt: nowMs,
    });
    const otherUserId = await ctx.db.insert("users", {
      workosUserId: "other-owner",
      email: "other@example.com",
    });
    const otherWorkspaceId = await ctx.db.insert("workspaces", {
      userId: otherUserId,
      name: "Other",
      description: "Other tenant",
      isDefault: true,
      updatedAt: nowMs,
    });
    return { workspaceId, otherWorkspaceId };
  });
  return { t, ...seeded, owner: t.withIdentity({ subject: "ops-owner" }) };
}

describe("bounded reactive Agent Ops dashboard", () => {
  test("preserves all selected-tab formulas, totals, comparison deltas and chart buckets", async () => {
    const { t, owner, workspaceId } = await fixture();
    const analyticsRows = [];
    const agentOpsRows = [];
    // Unequal values in adjacent days catch averaging percentages and slice boundaries.
    for (let day = 0; day < 65; day++) {
      const dayStartUtcMs = Date.UTC(2026, 6, 5 + day);
      const analytics = createEmptyWorkspaceAnalyticsDailyRecord({
        workspaceId,
        dayStartUtcMs,
      });
      const ops = createEmptyWorkspaceAgentOpsDailyRecord({
        workspaceId,
        dayStartUtcMs,
      });
      await t.run(async (ctx) => {
        const aggregate = new DirectAggregate(
          components.workspaceReportingAggregate
        );
        for (const [dataset, fields, row] of [
          ["analytics", WORKSPACE_ANALYTICS_HOURLY_FIELDS, analytics],
          ["agentOps", AGENT_OPS_HOURLY_FIELDS, ops],
        ] as const) {
          for (const [index, metric] of fields.entries()) {
            const value = ((day % 9) + 1) * ((index % 4) + 1);
            (row as unknown as Record<string, number[]>)[metric][8] = value;
            await aggregate.insert(ctx, {
              namespace: [1, workspaceId, dataset],
              key: [metric, dayStartUtcMs + 8 * 3600000],
              id: `${dataset}-${day}-${metric}-${"s".repeat(120)}`,
              sumValue: value,
            });
          }
        }
      });
      analyticsRows.push(analytics);
      agentOpsRows.push(ops);
    }
    // Reproduce the production failure on populated component trees. The same
    // data must remain readable through each independent subscription below.
    await expect(
      owner.query(api.agentOps.getAgentOpsDashboard, {
        workspaceId,
        nowMs,
        range: "30d",
        tab: "overview",
      })
    ).rejects.toThrow(/bytes read|bytesRead|limit/i);
    for (const range of ["today", "1d", "7d", "30d", "custom"] as const) {
      const base = {
        workspaceId,
        nowMs,
        range,
        timeZone: "UTC",
        ...(range === "custom"
          ? { fromDate: "2026-07-07", toDate: "2026-09-07" }
          : {}),
      };
      const { normalizedWindow, bucketSet } = getAgentOpsDashboardWindow(base);
      const expected = buildAgentOpsDashboardData({
        analyticsRows,
        agentOpsRows,
        bucketSet,
        currentWindow: normalizedWindow.current,
        previousWindow: normalizedWindow.previous,
      });
      for (const tab of tabs) {
        const args = { ...base, tab };
        const summary = await owner.run(async (ctx) => {
          const result = await ctx.runQuery(
            api.agentOps.getAgentOpsDashboardSummary,
            args
          );
          expect(
            (await ctx.meta.getTransactionMetrics()).bytesRead.used
          ).toBeLessThan(4 * 1024 * 1024);
          return result;
        });
        const trends = [];
        for (const offset of getAgentOpsTrendSliceOffsets(
          bucketSet.buckets.length,
          tab
        ))
          trends.push(
            await owner.query(api.agentOps.getAgentOpsDashboardTrendSlice, {
              ...args,
              offset,
            })
          );
        const actual = buildAgentOpsDashboardFromSlices({
          ...args,
          normalizedWindow,
          summary,
          trends,
        });
        expect(actual[tab], `${tab}/${range}`).toEqual(expected[tab]);
      }
    }
  }, 120000);

  test("rejects unauthenticated/cross-workspace reads and invalid slice offsets", async () => {
    const { t, owner, workspaceId, otherWorkspaceId } = await fixture();
    const args = {
      workspaceId,
      nowMs,
      range: "30d" as const,
      tab: "overview" as const,
    };
    for (const [query, extra] of [
      [api.agentOps.getAgentOpsDashboardSummary, {}],
      [api.agentOps.getAgentOpsDashboardTrendSlice, { offset: 0 }],
      [api.agentOps.getAgentOpsDashboardActivity, {}],
    ] as const) {
      await expect(t.query(query, { ...args, ...extra })).rejects.toThrow();
      await expect(
        owner.query(query, { ...args, ...extra, workspaceId: otherWorkspaceId })
      ).rejects.toThrow("Workspace not found");
    }
    for (const offset of [-4, 1, 4.5, 32, Infinity, NaN]) {
      await expect(
        owner.query(api.agentOps.getAgentOpsDashboardTrendSlice, {
          ...args,
          offset,
        })
      ).rejects.toThrow("Invalid Agent Ops chart slice");
    }
    await expect(
      owner.query(api.agentOps.getAgentOpsDashboardSummary, {
        ...args,
        nowMs: Infinity,
      })
    ).rejects.toThrow("Invalid reporting timestamp");
    await t.run(async (ctx) => {
      const row = await ctx.db.query("workspaceReportingRollouts").first();
      await ctx.db.patch(row!._id, { status: "backfilling" });
    });
    await expect(
      owner.query(api.agentOps.getAgentOpsDashboardSummary, args)
    ).rejects.toThrow("still being prepared");
  });

  test("empty and very long ranges stay bounded without dropping the selected period", async () => {
    const { owner, workspaceId } = await fixture();
    for (const [fromDate, toDate] of [
      ["2025-09-07", "2026-09-07"],
      ["2000-01-01", "2026-09-07"],
      ["2026-09-07", "2026-01-01"],
      ["2026-09-07", "2026-09-07"],
      ["bad-date", "bad-date"],
    ]) {
      const args = {
        workspaceId,
        nowMs,
        range: "custom" as const,
        tab: "overview" as const,
        fromDate,
        toDate,
      };
      const { normalizedWindow, bucketSet } = getAgentOpsDashboardWindow(args);
      expect(bucketSet.buckets.length).toBeLessThanOrEqual(
        AGENT_OPS_MAX_TREND_BUCKETS
      );
      expect(bucketSet.buckets[0].startMs).toBe(
        normalizedWindow.current.startMs
      );
      expect(bucketSet.buckets.at(-1)!.endMs).toBe(
        normalizedWindow.current.endMs
      );
      const summary = await owner.query(
        api.agentOps.getAgentOpsDashboardSummary,
        args
      );
      expect(summary.agentOps.flat().every((value) => value === 0)).toBe(true);
    }
  });
});
