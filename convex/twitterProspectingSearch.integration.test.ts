/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "twitter-search-mode-user",
      email: "twitter-search-mode@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Twitter search mode",
      description: "Twitter prospecting search mode tests",
      isDefault: true,
      updatedAt: 1,
    });
    return { userId, workspaceId };
  });
}

describe("Twitter prospecting search mode", () => {
  test("the workflow save bridge keeps fallback queries that match their seeds", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId } = await seedWorkspace(t);

    await t.mutation(internal.workflows.prospecting.saveKeywordsInternal, {
      workspaceId,
      seedKeywords: ["screen recording workflow"],
      discoveredKeywords: [],
      socialQueries: ["screen recording workflow"],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("keywords")
        .withIndex("by_workspace_value", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("value", "screen recording workflow")
        )
        .collect()
    );
    expect(rows.map((row) => row.type).sort()).toEqual([
      "seed",
      "social_query",
    ]);

    const queue = await t.query(
      internal.keywords.getPrioritizedTwitterQueries,
      { workspaceId, limit: 10 }
    );
    expect(queue.map((item) => item.value)).toEqual([
      "screen recording workflow",
    ]);
  });

  test("preserves an executable query when its text matches a seed keyword", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedWorkspace(t);

    const saved = await t.mutation(internal.keywords.saveKeywordsBatch, {
      workspaceId,
      keywords: [
        {
          type: "seed",
          value: "screen recording workflow",
          source: "agent",
        },
        {
          type: "social_query",
          value: "  Screen   Recording Workflow  ",
          source: "agent",
          platformTargets: ["twitter"],
          queryStyle: "natural_phrase",
          twitterSearchMode: "raw",
        },
        {
          type: "seed",
          value: "SCREEN RECORDING WORKFLOW",
          source: "agent",
        },
      ],
    });

    expect(saved).toEqual({ inserted: 2, updated: 1, skipped: 0 });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("keywords")
        .withIndex("by_workspace_value", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("value", "screen recording workflow")
        )
        .collect()
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.type).sort()).toEqual([
      "seed",
      "social_query",
    ]);
    expect(new Set(rows.map((row) => row.canonicalKey)).size).toBe(2);

    const seed = rows.find((row) => row.type === "seed");
    const socialQuery = rows.find((row) => row.type === "social_query");
    expect(seed).toBeDefined();
    expect(socialQuery).toBeDefined();

    await t.mutation(internal.keywords.updateKeywordMonitorId, {
      workspaceId,
      query: "screen recording workflow",
      monitorId: "keyword-monitor",
    });
    const updatedSeed = await t.run((ctx) => ctx.db.get(seed!._id));
    const updatedSocialQuery = await t.run((ctx) =>
      ctx.db.get(socialQuery!._id)
    );
    expect(updatedSeed?.monitorId).toBeUndefined();
    expect(updatedSocialQuery?.monitorId).toBe("keyword-monitor");

    const monitorId = await t.mutation(internal.socialapiMonitors.saveMonitor, {
      workspaceId,
      userId,
      monitorId: "external-monitor",
      query: "screen recording workflow",
      refreshFrequency: 60,
      purpose: "workspace_query",
    });
    const monitor = await t.run((ctx) => ctx.db.get(monitorId));
    expect(monitor?.keywordId).toBe(socialQuery!._id);
    expect(monitor?.queryCandidateId).toBe(
      updatedSocialQuery?.activatedQueryCandidateId
    );

    const queue = await t.query(
      internal.keywords.getPrioritizedTwitterQueries,
      { workspaceId, limit: 10 }
    );

    expect(queue).toEqual([
      expect.objectContaining({
        value: "Screen   Recording Workflow",
        searchMode: "raw",
      }),
    ]);
  });

  test("the single-keyword save path keeps matching seed and query rows distinct", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId } = await seedWorkspace(t);

    const seedId = await t.mutation(internal.keywords.saveKeywordInternal, {
      workspaceId,
      type: "seed",
      value: "founder hiring",
      source: "agent",
    });
    const queryId = await t.mutation(internal.keywords.saveKeywordInternal, {
      workspaceId,
      type: "social_query",
      value: "FOUNDER HIRING",
      source: "agent",
      platformTargets: ["twitter"],
      queryStyle: "natural_phrase",
      twitterSearchMode: "raw",
    });

    expect(queryId).not.toBe(seedId);

    const queue = await t.query(
      internal.keywords.getPrioritizedTwitterQueries,
      { workspaceId, limit: 10 }
    );
    expect(queue.map((item) => item.id)).toEqual([queryId]);
  });

  test("persists the LLM mode and safely defaults or demotes queries", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId } = await seedWorkspace(t);

    await t.mutation(internal.keywords.saveKeywordsBatch, {
      workspaceId,
      keywords: [
        {
          type: "social_query",
          value: "looking for screen recorder",
          source: "agent",
          platformTargets: ["twitter"],
          queryStyle: "natural_phrase",
          twitterSearchMode: "exact",
        },
        {
          type: "social_query",
          value: "need an integrated screen recorder for",
          source: "agent",
          platformTargets: ["twitter"],
          queryStyle: "natural_phrase",
          twitterSearchMode: "exact",
        },
        {
          type: "social_query",
          value: "screen recording workflow",
          source: "agent",
          platformTargets: ["twitter"],
          queryStyle: "natural_phrase",
        },
      ],
    });

    const queue = await t.query(
      internal.keywords.getPrioritizedTwitterQueries,
      { workspaceId, limit: 10 }
    );
    const modes = new Map(
      queue.map((item) => [item.value, item.searchMode] as const)
    );

    expect(modes.get("looking for screen recorder")).toBe("exact");
    expect(modes.get("need an integrated screen recorder for")).toBe("raw");
    expect(modes.get("screen recording workflow")).toBe("raw");
  });
});
