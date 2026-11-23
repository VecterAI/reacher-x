/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { getWorkspaceMemoryNamespace } from "./lib/memoryHelpers";
import { clearSharedMemorySemanticCache } from "./lib/sharedMemorySemanticCache";
import { upsertCanonicalWorkspaceMemory } from "./lib/workspaceMemoryCore";
import { buildWorkspaceMemoryContextFromStore } from "./lib/workspaceMemoryContextRuntime";

const SHARED_MEMORY_SEMANTIC_NAMESPACES = [
  "lessons",
  "patterns",
  "objections",
  "wins",
  "losses",
  "style",
] as const;

const TEST_QUERY_EMBEDDING = [0.25, 0.5, 0.75];

const ragState = vi.hoisted(() => {
  return {
    embedCalls: [] as string[],
    embedImpl: null as null | ((query: string) => Promise<number[]>),
    calls: [] as Array<{ namespace: string; query: string | number[] }>,
    entries: [] as Array<{ metadata?: { memoryItemId?: string } }>,
    searchImpl: null as
      | null
      | ((args: {
          namespace: string;
          query: string | number[];
        }) => Promise<unknown>),
  };
});
vi.mock("./agents/outreach/rag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./agents/outreach/rag")>();
  return {
    ...actual,
    embedAgentMemoryQuery: async (query: string) => {
      ragState.embedCalls.push(query);
      if (ragState.embedImpl) {
        return await ragState.embedImpl(query);
      }
      return TEST_QUERY_EMBEDDING;
    },
    getAgentMemoryRag: () => ({
      search: async (
        _ctx: unknown,
        args: { namespace: string; query: string | number[] }
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
    ragState.embedCalls = [];
    ragState.embedImpl = null;
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
    expect(ragState.embedCalls).toEqual([]);
    expect(ragState.calls).toEqual([]);
  });

  test("embeds the query once, reuses the vector across namespaces, and caches semantic ids", async () => {
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

    expect(ragState.embedCalls).toEqual(["async channels after six"]);
    expect(ragState.calls.length).toBe(6);
    expect(ragState.calls.map((call) => call.namespace).sort()).toEqual(
      SHARED_MEMORY_SEMANTIC_NAMESPACES.map((namespace) =>
        getWorkspaceMemoryNamespace(String(seeded.workspaceId), namespace)
      ).sort()
    );
    expect(
      ragState.calls.every((call) => call.query === TEST_QUERY_EMBEDDING)
    ).toBe(true);
    expect(first.semanticMatches).toContain("Prefer async channels after six.");

    const second = await t.action(
      internal.memory.buildWorkspaceMemoryContextInternal,
      args
    );

    expect(ragState.embedCalls).toEqual(["async channels after six"]);
    expect(ragState.calls.length).toBe(6);
    expect(second.semanticMatches).toEqual(first.semanticMatches);
  });

  test("a failed query embedding skips namespace searches and is not cached", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    const memoryId = await seedOperatorMemory(t, seeded);
    ragState.entries = [{ metadata: { memoryItemId: memoryId } }];

    ragState.embedImpl = async () => {
      throw new Error("embedding provider unavailable");
    };

    const args = {
      ...seeded,
      query: "async channels after six",
      surface: "main",
    };
    const degraded = await t.action(
      internal.memory.buildWorkspaceMemoryContextInternal,
      args
    );
    expect(ragState.embedCalls).toEqual(["async channels after six"]);
    expect(ragState.calls).toEqual([]);
    expect(degraded.semanticMatches).toEqual([]);

    ragState.embedImpl = null;
    const recovered = await t.action(
      internal.memory.buildWorkspaceMemoryContextInternal,
      args
    );
    expect(ragState.embedCalls).toEqual([
      "async channels after six",
      "async channels after six",
    ]);
    expect(ragState.calls.length).toBe(6);
    expect(recovered.semanticMatches).toContain(
      "Prefer async channels after six."
    );
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

  test("batched thread snapshot resolves workspace thread and isolates draft setup threads", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    await seedOperatorMemory(t, seeded);

    await t.run(async (ctx) => {
      await ctx.db.insert("workspaceAgentThreads", {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        threadId: "workspace-thread-1",
        threadStatus: "active",
      });
      await ctx.db.insert("workspaceSetupSessions", {
        userId: seeded.userId,
        mode: "new_workspace",
        status: "draft",
        setupThreadId: "draft-setup-thread-1",
        useCaseKey: "customer_prospecting",
        draftOrdinal: 1,
        statusUpdatedAt: 1,
      });
    });

    const workspaceLoaded = await t.query(
      internal.memory.loadWorkspaceMemoryContextSnapshotForThreadInternal,
      {
        userId: seeded.userId,
        threadId: "workspace-thread-1",
        allowDefaultWorkspace: false,
        query: "async channels",
      }
    );
    expect(workspaceLoaded.scope.workspaceId).toBe(seeded.workspaceId);
    expect(workspaceLoaded.snapshot?.ownsWorkspace).toBe(true);
    expect(workspaceLoaded.snapshot?.candidatesComplete).toBe(true);
    expect(workspaceLoaded.snapshot?.candidates.length).toBeGreaterThan(0);

    const promptOnlyComplete = await buildWorkspaceMemoryContextFromStore(
      {
        runQuery: async () => {
          throw new Error("should not query when snapshot is preloaded");
        },
        runAction: async () => {
          throw new Error("should not search RAG when candidates are complete");
        },
      } as unknown as Parameters<
        typeof buildWorkspaceMemoryContextFromStore
      >[0],
      {
        workspaceId: String(seeded.workspaceId),
        userId: String(seeded.userId),
        query: "async channels",
        surface: "main",
      },
      {
        preloadedSnapshot: workspaceLoaded.snapshot!,
        skipSemanticWhenComplete: true,
      }
    );
    expect(promptOnlyComplete.prompt).toContain(
      "Prefer async channels after six."
    );
    expect(ragState.embedCalls).toEqual([]);
    expect(ragState.calls).toEqual([]);

    const draftSetupLoaded = await t.query(
      internal.memory.loadWorkspaceMemoryContextSnapshotForThreadInternal,
      {
        userId: seeded.userId,
        threadId: "draft-setup-thread-1",
        allowDefaultWorkspace: false,
        query: "setup policy",
      }
    );
    expect(draftSetupLoaded.scope.workspaceId).toBeNull();
    expect(draftSetupLoaded.snapshot).toBeNull();
  });
});
