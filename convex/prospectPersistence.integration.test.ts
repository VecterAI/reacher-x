/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "prospect-persistence-user",
      email: "prospect-persistence@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Prospect persistence",
      description: "Reliability test workspace",
      isDefault: true,
      prospectingWorkflowStatus: "running",
      updatedAt: 1,
    });
    return { userId, workspaceId };
  });
}

describe("prospect persistence reliability", () => {
  test("persists one heavyweight prospect idempotently without a plan scan", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t);
    const largeProviderPayload = "x".repeat(250_000);
    const baseProspect = {
      platform: "twitter" as const,
      externalId: "provider-post-1",
      data: {
        id_str: "provider-post-1",
        text: largeProviderPayload,
        user: {
          id_str: "provider-user-1",
          name: "Heavy Prospect",
          screen_name: "heavy_prospect",
        },
      },
      discoverySource: "search_post" as const,
    };

    const created = await t.mutation(internal.prospects.createProspectsBatch, {
      ...workspace,
      prospects: [baseProspect],
    });
    const repeated = await t.mutation(internal.prospects.createProspectsBatch, {
      ...workspace,
      prospects: [
        {
          ...baseProspect,
          externalId: "provider-post-2",
          matchReason: "Updated through stable actor identity",
        },
      ],
    });

    expect(created).toMatchObject({ created: 1, updated: 0 });
    expect(repeated).toMatchObject({ created: 0, updated: 1 });
    expect(repeated.prospectIds).toEqual(created.prospectIds);
    const stored = await t.run((ctx) => ctx.db.query("prospects").collect());
    expect(stored).toHaveLength(1);
    expect(stored[0]?.matchReason).toBe(
      "Updated through stable actor identity"
    );
  });

  test("rejects multi-row write transactions before reading prospect rows", async () => {
    const t = convexTest(schema, modules);
    const workspace = await seedWorkspace(t);
    const prospect = (externalId: string) => ({
      platform: "twitter" as const,
      externalId,
      data: { id_str: externalId },
    });

    await expect(
      t.mutation(internal.prospects.createProspectsBatch, {
        ...workspace,
        prospects: [prospect("one"), prospect("two")],
      })
    ).rejects.toThrow("at most 1 rows");
  });
});
