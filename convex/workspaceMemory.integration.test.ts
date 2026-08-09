/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { normalizeWorkspaceMemoryCategories } from "./lib/agentMemoryCore";
import {
  buildWorkspaceMemoryContext,
  listCanonicalWorkspaceMemoryCandidates,
  searchCanonicalWorkspaceMemories,
  upsertCanonicalWorkspaceMemory,
} from "./lib/workspaceMemoryCore";

const modules = import.meta.glob("./**/*.ts");

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "workspace-memory-user",
      email: "workspace-memory@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Workspace memory test",
      description: "Workspace memory test",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    return { userId, workspaceId };
  });
}

describe("canonical workspace memory", () => {
  test("treats an empty category list as no filter", () => {
    expect(normalizeWorkspaceMemoryCategories([])).toBeUndefined();
    expect(normalizeWorkspaceMemoryCategories(undefined)).toBeUndefined();
    expect(
      normalizeWorkspaceMemoryCategories(["operator_instruction"])
    ).toEqual(["operator_instruction"]);
  });

  test("is idempotent and a newer correction supersedes the prior value", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);

    const state = await t.run(async (ctx) => {
      const first = await upsertCanonicalWorkspaceMemory(ctx.db, {
        ...seeded,
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        kind: "writing_preference",
        conflictKey: "outreach.copy_length",
        title: "Keep outreach concise",
        summary: "Keep outreach to three short sentences.",
        instruction: "Keep my outreach to three short sentences.",
        canonicalContent: "Keep my outreach to three short sentences.",
        confidence: 1,
        impactScore: 1,
      });
      const duplicate = await upsertCanonicalWorkspaceMemory(ctx.db, {
        ...seeded,
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        kind: "writing_preference",
        conflictKey: "outreach.copy_length",
        title: "Keep outreach concise",
        summary: "Keep outreach to three short sentences.",
        instruction: "Keep my outreach to three short sentences.",
        canonicalContent: "Keep my outreach to three short sentences.",
        confidence: 1,
        impactScore: 1,
      });
      const correction = await upsertCanonicalWorkspaceMemory(ctx.db, {
        ...seeded,
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        kind: "writing_preference",
        conflictKey: "outreach.copy_length",
        title: "Keep outreach even shorter",
        summary: "Keep outreach to two short sentences.",
        instruction: "Correction: use two short sentences.",
        canonicalContent: "Correction: use two short sentences.",
        confidence: 1,
        impactScore: 1,
      });
      const rows = await ctx.db
        .query("workspaceMemories")
        .withIndex("by_workspace_and_conflict_key_and_status", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .collect();
      return { first, duplicate, correction, rows };
    });

    expect(state.duplicate.memory.memoryId).toBe(state.first.memory.memoryId);
    expect(state.duplicate.created).toBe(false);
    expect(
      state.rows.find((row) => String(row._id) === state.first.memory.memoryId)
        ?.status
    ).toBe("superseded");
    expect(
      state.rows.find(
        (row) => String(row._id) === state.correction.memory.memoryId
      )?.status
    ).toBe("active");
    expect(state.correction.memory.instruction).toBe(
      "Correction: use two short sentences."
    );
  });

  test("exact search hydrates an older operator memory outside the bounded candidate page", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);

    const result = await t.run(async (ctx) => {
      const target = await upsertCanonicalWorkspaceMemory(ctx.db, {
        ...seeded,
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        kind: "resource",
        title: "Tutorial resource",
        summary: "Use the tutorial when relevant.",
        instruction: "Use https://youtube.com/watch?v=unique-memory-tutorial",
        canonicalContent:
          "Use https://youtube.com/watch?v=unique-memory-tutorial",
        confidence: 1,
        impactScore: 1,
      });
      for (let index = 0; index < 200; index += 1) {
        await upsertCanonicalWorkspaceMemory(ctx.db, {
          ...seeded,
          source: "operator",
          category: "operator_instruction",
          namespace: "lessons",
          kind: "distractor",
          title: `Distractor ${index}`,
          summary: `Unrelated preference ${index}`,
          instruction: `Unrelated preference ${index}`,
          canonicalContent: `Unrelated preference ${index}`,
          precedence: 2_000 + index,
          confidence: 1,
          impactScore: 1,
        });
      }
      const candidates = await listCanonicalWorkspaceMemoryCandidates(ctx.db, {
        ...seeded,
      });
      const exact = await searchCanonicalWorkspaceMemories(ctx.db, {
        ...seeded,
        query: "unique memory tutorial",
        authority: "operator",
      });
      return { target, candidates, exact };
    });

    expect(
      result.candidates.some(
        (memory) => memory.memoryId === result.target.memory.memoryId
      )
    ).toBe(false);
    expect(
      result.exact.some(
        (memory) => memory.memoryId === result.target.memory.memoryId
      )
    ).toBe(true);
  });

  test("keeps canonical reads isolated to the owned workspace", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);

    const result = await t.run(async (ctx) => {
      const otherWorkspaceId = await ctx.db.insert("workspaces", {
        userId: seeded.userId,
        name: "Other workspace",
        description: "Must remain isolated",
        isDefault: false,
        entitlementSlot: 2,
        updatedAt: 1,
      });
      const own = await upsertCanonicalWorkspaceMemory(ctx.db, {
        ...seeded,
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        title: "Owned instruction",
        summary: "Only for the first workspace",
        canonicalContent: "Only use this in the first workspace.",
        instruction: "Only use this in the first workspace.",
        confidence: 1,
        impactScore: 1,
      });
      const other = await upsertCanonicalWorkspaceMemory(ctx.db, {
        userId: seeded.userId,
        workspaceId: otherWorkspaceId,
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        title: "Other instruction",
        summary: "Only for the other workspace",
        canonicalContent: "Only use this in the other workspace.",
        instruction: "Only use this in the other workspace.",
        confidence: 1,
        impactScore: 1,
      });
      const candidates = await listCanonicalWorkspaceMemoryCandidates(ctx.db, {
        ...seeded,
      });
      return { own, other, candidates };
    });

    expect(result.candidates.map((memory) => memory.memoryId)).toContain(
      result.own.memory.memoryId
    );
    expect(result.candidates.map((memory) => memory.memoryId)).not.toContain(
      result.other.memory.memoryId
    );
  });

  test("applies prospect and surface scopes without leaking them", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    const base = await t.run(async (ctx) => {
      const result = await upsertCanonicalWorkspaceMemory(ctx.db, {
        ...seeded,
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        title: "Scoped instruction",
        summary: "Only for one prospect surface",
        canonicalContent: "Use this only for the scoped prospect.",
        instruction: "Use this only for the scoped prospect.",
        confidence: 1,
        impactScore: 1,
      });
      return result.memory;
    });
    const scoped = {
      ...base,
      memoryId: "scoped-memory",
      prospectId: "prospect-a",
      surfaces: ["manual_prospect"],
    };
    const request = {
      workspaceId: String(seeded.workspaceId),
      userId: String(seeded.userId),
      query: "scoped prospect",
      surface: "manual_prospect",
      prospectId: "prospect-a",
    };

    expect(
      buildWorkspaceMemoryContext({ request, memories: [scoped] }).memoryIds
    ).toEqual(["scoped-memory"]);
    expect(
      buildWorkspaceMemoryContext({
        request: { ...request, prospectId: "prospect-b" },
        memories: [scoped],
      }).memoryIds
    ).toEqual([]);
    expect(
      buildWorkspaceMemoryContext({
        request: { ...request, surface: "qualification" },
        memories: [scoped],
      }).memoryIds
    ).toEqual([]);
  });
});
