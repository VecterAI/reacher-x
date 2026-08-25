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
    return workspaceId;
  });
}

describe("Twitter prospecting search mode", () => {
  test("persists the LLM mode and safely defaults or demotes queries", async () => {
    const t = convexTest(schema, modules);
    const workspaceId = await seedWorkspace(t);

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
