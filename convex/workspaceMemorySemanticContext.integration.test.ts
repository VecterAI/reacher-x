/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { getWorkspaceMemoryNamespace } from "./lib/memoryHelpers";
import { clearSharedMemorySemanticCache } from "./lib/sharedMemorySemanticCache";
import { upsertCanonicalWorkspaceMemory } from "./lib/workspaceMemoryCore";

const SHARED_MEMORY_SEMANTIC_NAMESPACES = [
  "lessons",
  "patterns",
  "objections",
  "wins",
  "losses",
  "style",
] as const;

const ragState = vi.hoisted(() => {
  return {
    calls: [] as Array<{ namespace: string; query: string }>,
    entries: [] as Array<{ metadata?: { memoryItemId?: string } }>,
    searchImpl: null as
      | null
      | ((args: { namespace: string; query: string }) => Promise<unknown>),
  };
});
vi.mock("./agents/outreach/rag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./agents/outreach/rag")>();
  return {
    ...actual,
    getAgentMemoryRag: () => ({
      search: async (
        _ctx: unknown,
        args: { namespace: string; query: string }
      ) => {
        ragState.calls.push({
          namespace: args.namespace,
          query: args.query,
        });
        if (ragState.searchImpl) {
          return await ragState.searchImpl(args);
        }
        return { entries: ragState.entries };
      },
    }),
  };
});

const modules = import.meta.glob("./**/*.ts");

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "shared-memory-semantic-user",
      email: "shared-memory-semantic@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Shared memory semantic test",
      description: "Shared memory semantic test",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    return { userId, workspaceId };
  });
}

async function seedOperatorMemory(
  t: ReturnType<typeof convexTest>,
  seeded: { userId: Id<"users">; workspaceId: Id<"workspaces"> }
) {
  return await t.run(async (ctx) => {
    const memory = await upsertCanonicalWorkspaceMemory(ctx.db, {
      ...seeded,
      source: "operator",
      category: "operator_instruction",
      namespace: "lessons",
      kind: "resource",
      title: "Async channels",
      summary: "Prefer async channels after six.",
      instruction: "Prefer async channels after six.",
      canonicalContent: "Prefer async channels after six.",
      confidence: 1,
      impactScore: 1,
    });
    return String(memory.memory.memoryId);
  });
}

describe("shared workspace memory semantic context", () => {
  beforeEach(() => {
    clearSharedMemorySemanticCache();
    ragState.calls = [];
    ragState.entries = [];
    ragState.searchImpl = null;
  });

  test("skips semantic searches entirely for workspaces without memories", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);

    const context = await t.action(
      internal.memory.buildWorkspaceMemoryContextInternal,
      {
        ...seeded,
        query: "how should I reach this prospect",
        surface: "main",
      }
    );

    expect(context.memoryIds).toEqual([]);
    expect(context.semanticMatches).toEqual([]);
    expect(ragState.calls).toEqual([]);
  });

  test("caches semantic ids so repeated identical queries skip the vector searches", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    const memoryId = await seedOperatorMemory(t, seeded);
    ragState.entries = [{ metadata: { memoryItemId: memoryId } }];

    const args = {
      ...seeded,
      query: "async channels after six",
      surface: "main",
    };
    const first = await t.action(
      internal.memory.buildWorkspaceMemoryContextInternal,
      args
    );

    expect(ragState.calls.length).toBe(6);
    expect(ragState.calls.map((call) => call.namespace).sort()).toEqual(
      SHARED_MEMORY_SEMANTIC_NAMESPACES.map((namespace) =>
        getWorkspaceMemoryNamespace(String(seeded.workspaceId), namespace)
      ).sort()
    );
    expect(
      ragState.calls.every((call) => call.query === "async channels after six")
    ).toBe(true);
    expect(first.semanticMatches).toContain("Prefer async channels after six.");

    const second = await t.action(
      internal.memory.buildWorkspaceMemoryContextInternal,
      args
    );

    expect(ragState.calls.length).toBe(6);
    expect(second.semanticMatches).toEqual(first.semanticMatches);
  });

  test("caches empty semantic results without re-searching", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    await seedOperatorMemory(t, seeded);
    ragState.entries = [];

    const args = {
      ...seeded,
      query: "nothing matches this",
      surface: "main",
    };
    await t.action(internal.memory.buildWorkspaceMemoryContextInternal, args);
    expect(ragState.calls.length).toBe(6);

    const second = await t.action(
      internal.memory.buildWorkspaceMemoryContextInternal,
      args
    );

    expect(ragState.calls.length).toBe(6);
    expect(second.semanticMatches).toEqual([]);
  });

  test("a failed namespace search is not cached", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    await seedOperatorMemory(t, seeded);
    ragState.entries = [];

    const args = {
      ...seeded,
      query: "async channels after six",
      surface: "main",
    };

    let failuresRemaining = 1;
    ragState.searchImpl = async () => {
      if (failuresRemaining > 0) {
        failuresRemaining -= 1;
        throw new Error("transient embed failure");
      }
      return { entries: ragState.entries };
    };

    await t.action(internal.memory.buildWorkspaceMemoryContextInternal, args);
    expect(ragState.calls.length).toBe(6);

    ragState.searchImpl = null;
    await t.action(internal.memory.buildWorkspaceMemoryContextInternal, args);
    expect(ragState.calls.length).toBe(12);

    await t.action(internal.memory.buildWorkspaceMemoryContextInternal, args);
    expect(ragState.calls.length).toBe(12);
  });
});
