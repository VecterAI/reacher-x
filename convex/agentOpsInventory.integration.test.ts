/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Agent Ops memory inventory pagination", () => {
  test("advances through a large inventory without rescanning prior rows", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "agent-ops-inventory-owner",
        email: "agent-ops-inventory@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Agent Ops inventory",
        description: "Cursor pagination test",
        isDefault: true,
        reportingTimeZone: "UTC",
        updatedAt: Date.UTC(2026, 7, 28),
      });

      for (let index = 0; index < 120; index += 1) {
        await ctx.db.insert("workspaceAgentMemoryInventory", {
          workspaceId,
          memoryId: `memory-${index}`,
          createdAt: Date.UTC(2026, 7, 1) + index,
          title: index === 117 ? "Needle memory" : `Memory ${index}`,
          summary: `Summary ${index}`,
          source: "qualification",
          category: "qualification_win_pattern",
          confidence: index / 120,
          impactScore: index / 120,
          relatedQueriesCount: 0,
          evidenceCount: 1,
        });
      }

      return { workspaceId };
    });
    const client = t.withIdentity({ subject: "agent-ops-inventory-owner" });
    const baseArgs = {
      workspaceId: seeded.workspaceId,
      range: "custom" as const,
      timeZone: "UTC",
      fromDate: "2026-08-01",
      toDate: "2026-08-28",
      sort: "impact_desc" as const,
      pageSize: 10,
    };

    const first = await client.action(
      api.agentOps.getAgentOpsMemoryInventoryPageSnapshot,
      { ...baseArgs, page: 0 }
    );
    expect(first.rows).toHaveLength(10);
    expect(first.rows.map((row) => row.memoryId)).toEqual(
      Array.from({ length: 10 }, (_, offset) => `memory-${119 - offset}`)
    );
    expect(first.scanned).toBe(50);
    expect(first.isDone).toBe(false);
    expect(first.continueCursor).not.toBeNull();

    const second = await client.action(
      api.agentOps.getAgentOpsMemoryInventoryPageSnapshot,
      {
        ...baseArgs,
        page: 1,
        cursor: first.continueCursor ?? undefined,
      }
    );
    expect(second.rows).toHaveLength(10);
    expect(second.rows.map((row) => row.memoryId)).toEqual(
      Array.from({ length: 10 }, (_, offset) => `memory-${109 - offset}`)
    );
    expect(second.scanned).toBe(0);
    expect(
      new Set([...first.rows, ...second.rows].map((row) => row.memoryId)).size
    ).toBe(20);

    const filtered = await client.action(
      api.agentOps.getAgentOpsMemoryInventoryPageSnapshot,
      {
        ...baseArgs,
        page: 0,
        search: "needle",
      }
    );
    expect(filtered.rows.map((row) => row.memoryId)).toEqual(["memory-117"]);
    expect(filtered.isDone).toBe(true);
    expect(filtered.scanned).toBe(120);
  });

  test("exports each row once while advancing the same cursor", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "agent-ops-export-owner",
        email: "agent-ops-export@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Agent Ops export",
        description: "Cursor export test",
        isDefault: true,
        updatedAt: Date.UTC(2026, 7, 28),
      });
      for (let index = 0; index < 120; index += 1) {
        await ctx.db.insert("workspaceAgentMemoryInventory", {
          workspaceId,
          memoryId: `export-memory-${index}`,
          createdAt: Date.UTC(2026, 7, 1) + index,
          title: `Memory ${index}`,
          summary: `Summary ${index}`,
          source: "operator",
          category: "operator_instruction",
          confidence: 1,
          impactScore: 1,
          relatedQueriesCount: 0,
          evidenceCount: 0,
        });
      }
      return { workspaceId };
    });
    const client = t.withIdentity({ subject: "agent-ops-export-owner" });
    const memoryIds: string[] = [];
    let cursor: string | undefined;
    let page = 0;

    while (true) {
      const result = await client.action(
        api.agentOps.getAgentOpsMemoryInventoryPageSnapshot,
        {
          workspaceId: seeded.workspaceId,
          range: "custom",
          timeZone: "UTC",
          fromDate: "2026-08-01",
          toDate: "2026-08-28",
          sort: "recent_desc",
          page,
          pageSize: 50,
          exportMode: true,
          ...(cursor ? { cursor } : {}),
        }
      );
      memoryIds.push(...result.rows.map((row) => row.memoryId));
      if (result.isDone) break;
      expect(result.continueCursor).not.toBeNull();
      cursor = result.continueCursor ?? undefined;
      page += 1;
    }

    expect(page).toBe(2);
    expect(memoryIds).toHaveLength(120);
    expect(new Set(memoryIds).size).toBe(120);
  });
});
