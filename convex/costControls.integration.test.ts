/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "cost-controls-user",
      email: "cost-controls@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Cost controls",
      description: "Cost control tests",
      isDefault: true,
      updatedAt: 1,
    });
    return { userId, workspaceId };
  });
}

describe("Convex cost controls", () => {
  test("deduplicates a webhook receipt and allows a retry after release", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(
      internal.socialApiWebhookReceipts.claimInternal,
      {
        monitorId: "monitor-1",
        eventId: "tweet-1",
      }
    );
    const duplicate = await t.mutation(
      internal.socialApiWebhookReceipts.claimInternal,
      {
        monitorId: "monitor-1",
        eventId: "tweet-1",
      }
    );

    expect(first.claimed).toBe(true);
    expect(duplicate.claimed).toBe(false);
    if (!first.claimed) {
      throw new Error("Expected the first receipt to be claimed");
    }

    await t.mutation(internal.socialApiWebhookReceipts.releaseInternal, {
      receiptId: first.receiptId,
    });
    const retry = await t.mutation(
      internal.socialApiWebhookReceipts.claimInternal,
      {
        monitorId: "monitor-1",
        eventId: "tweet-1",
      }
    );
    expect(retry.claimed).toBe(true);
  });

  test("retires workspace discovery monitors but preserves real-time monitors", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedWorkspace(t);
    const keywordId = await t.run((ctx) =>
      ctx.db.insert("keywords", {
        workspaceId,
        type: "social_query",
        value: "founder pain",
        status: "active",
        monitorId: "workspace-monitor",
      })
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("socialQueryMonitors", {
        workspaceId,
        userId,
        keywordId,
        purpose: "workspace_query",
        monitorId: "workspace-monitor",
        query: "founder pain",
        refreshFrequency: 3600,
        status: "active",
      });
      await ctx.db.insert("socialQueryMonitors", {
        workspaceId,
        userId,
        purpose: "conversation_seed",
        monitorId: "realtime-monitor",
        query: "conversation_id:123",
        refreshFrequency: 3600,
        status: "active",
      });
    });

    const targets = await t.query(
      internal.socialapiMonitors.listDiscoveryMonitorsForRetirementInternal,
      { limit: 25 }
    );
    expect(targets.map((target) => target.monitorId)).toEqual([
      "workspace-monitor",
    ]);

    await t.mutation(
      internal.socialapiMonitors.markDiscoveryMonitorsRetiredInternal,
      { monitorIds: ["workspace-monitor", "realtime-monitor"] }
    );
    const state = await t.run(async (ctx) => ({
      keyword: await ctx.db.get(keywordId),
      monitors: await ctx.db
        .query("socialQueryMonitors")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect(),
    }));

    expect(state.keyword?.monitorId).toBeUndefined();
    expect(
      state.monitors.find(
        (monitor) => monitor.monitorId === "workspace-monitor"
      )?.status
    ).toBe("deleted");
    expect(
      state.monitors.find((monitor) => monitor.monitorId === "realtime-monitor")
        ?.status
    ).toBe("active");
  });
});
