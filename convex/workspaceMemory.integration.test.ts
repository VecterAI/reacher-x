/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import {
  normalizeWorkspaceMemoryCategories,
  promoteAgentMemory,
} from "./lib/agentMemoryCore";
import {
  buildWorkspaceMemoryContext,
  listCanonicalLegacyMemoryIds,
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

  test("legacy fallback cannot resurrect a superseded correction", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);

    const state = await t.run(async (ctx) => {
      const first = await upsertCanonicalWorkspaceMemory(ctx.db, {
        ...seeded,
        legacyMemoryId: "legacy-v1",
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        kind: "resource",
        conflictKey: "resource.pineglass",
        title: "Pineglass v1",
        summary: "Use version one",
        instruction: "Use https://example.com/pineglass-v1",
        canonicalContent: "Use https://example.com/pineglass-v1",
        confidence: 1,
        impactScore: 1,
      });
      const correction = await upsertCanonicalWorkspaceMemory(ctx.db, {
        ...seeded,
        legacyMemoryId: "legacy-v2",
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        kind: "resource",
        conflictKey: "resource.pineglass",
        title: "Pineglass v2",
        summary: "Use version two",
        instruction: "Use https://example.com/pineglass-v2",
        canonicalContent: "Use https://example.com/pineglass-v2",
        confidence: 1,
        impactScore: 1,
      });
      const representedLegacyIds = await listCanonicalLegacyMemoryIds(ctx.db, {
        ...seeded,
        legacyMemoryIds: ["legacy-v1", "legacy-v2", "unmigrated"],
      });
      const active = await listCanonicalWorkspaceMemoryCandidates(ctx.db, {
        ...seeded,
      });
      return { first, correction, representedLegacyIds, active };
    });

    expect(state.representedLegacyIds).toEqual(["legacy-v1", "legacy-v2"]);
    expect(state.active.map((memory) => memory.memoryId)).toEqual([
      state.correction.memory.memoryId,
    ]);
    expect(state.active.map((memory) => memory.memoryId)).not.toContain(
      state.first.memory.memoryId
    );
  });

  test("shared context injects only the active correction", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    await t.run(async (ctx) => {
      const base = {
        userId: String(seeded.userId),
        workspaceId: String(seeded.workspaceId),
        source: "operator" as const,
        category: "operator_instruction" as const,
        namespace: "lessons" as const,
        kind: "resource",
        conflictKey: "resource.pineglass",
        confidence: 1,
        impactScore: 1,
      };
      await promoteAgentMemory(ctx.db, {
        ...base,
        title: "Pineglass v1",
        summary: "Use the v1 URL.",
        instruction: "Use https://example.com/pineglass-v1",
        canonicalContent: "Use https://example.com/pineglass-v1",
      });
      await promoteAgentMemory(ctx.db, {
        ...base,
        title: "Pineglass v2",
        summary: "Use the corrected v2 URL.",
        instruction: "Use https://example.com/pineglass-v2",
        canonicalContent: "Use https://example.com/pineglass-v2",
      });
    });

    const context = await t.action(
      internal.memory.buildWorkspaceMemoryContextInternal,
      {
        ...seeded,
        query: "",
        surface: "main",
      }
    );

    expect(context.prompt).toContain("https://example.com/pineglass-v2");
    expect(context.prompt).not.toContain("https://example.com/pineglass-v1");
  });

  test("shared context rejects a different owner before legacy fallback", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    const otherUserId = await t.run(
      async (ctx) =>
        await ctx.db.insert("users", {
          workosUserId: "other-workspace-memory-user",
          email: "other-workspace-memory@example.com",
        })
    );
    await t.run(async (ctx) => {
      await promoteAgentMemory(ctx.db, {
        userId: String(seeded.userId),
        workspaceId: String(seeded.workspaceId),
        source: "operator",
        category: "operator_instruction",
        namespace: "lessons",
        kind: "resource",
        title: "Private workspace resource",
        summary: "Must never cross the ownership boundary.",
        instruction: "Use https://example.com/private-workspace-only",
        canonicalContent: "Use https://example.com/private-workspace-only",
        confidence: 1,
        impactScore: 1,
      });
    });

    const context = await t.action(
      internal.memory.buildWorkspaceMemoryContextInternal,
      {
        workspaceId: seeded.workspaceId,
        userId: otherUserId,
        query: "private resource",
        surface: "main",
      }
    );

    expect(context.memoryIds).toEqual([]);
    expect(context.prompt).toBe("");
  });

  test("shared context delivers an exact sentinel to every agent surface", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    const surfaces = [
      "main",
      "setup",
      "manual_prospect",
      "qualification",
      "auto_plan",
      "adaptive_outreach",
    ];
    const exactInstruction =
      "Use the exact sentinel https://example.com/all-agent-surfaces";
    const memory = await t.run(
      async (ctx) =>
        await upsertCanonicalWorkspaceMemory(ctx.db, {
          ...seeded,
          source: "operator",
          category: "operator_instruction",
          namespace: "lessons",
          kind: "resource",
          title: "All-surface sentinel",
          summary: "Make this exact sentinel available to every agent surface.",
          instruction: exactInstruction,
          canonicalContent: exactInstruction,
          surfaces,
          confidence: 1,
          impactScore: 1,
        })
    );

    for (const surface of surfaces) {
      const context = await t.action(
        internal.memory.buildWorkspaceMemoryContextInternal,
        {
          ...seeded,
          query: "sentinel",
          surface,
        }
      );
      expect(context.memoryIds, surface).toContain(memory.memory.memoryId);
      expect(context.prompt, surface).toContain(exactInstruction);
    }
  });

  test("full persistence path saves the same exact instruction once despite changed model labels", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);

    const state = await t.run(async (ctx) => {
      const base = {
        userId: String(seeded.userId),
        workspaceId: String(seeded.workspaceId),
        source: "operator" as const,
        category: "operator_instruction" as const,
        namespace: "lessons" as const,
        kind: "resource",
        conflictKey: "resource.pineglass",
        instruction: "Use exactly https://example.com/pineglass",
        canonicalContent: "Use exactly https://example.com/pineglass",
        confidence: 1,
        impactScore: 1,
      };
      const first = await promoteAgentMemory(ctx.db, {
        ...base,
        title: "Pineglass handbook URL",
        summary: "Use the saved Pineglass handbook URL when relevant.",
      });
      const duplicate = await promoteAgentMemory(ctx.db, {
        ...base,
        kind: "tutorial_resource",
        conflictKey: "resource.pineglass_handbook",
        title: "Canonical Pineglass resource",
        summary:
          "Recall this exact Pineglass resource whenever it is requested.",
      });
      const inventory = await ctx.db
        .query("workspaceAgentMemoryInventory")
        .withIndex("by_workspace_created_at", (query) =>
          query.eq("workspaceId", seeded.workspaceId)
        )
        .collect();
      const canonical = await ctx.db
        .query("workspaceMemories")
        .withIndex("by_workspace_and_status_and_precedence", (query) =>
          query.eq("workspaceId", seeded.workspaceId).eq("status", "active")
        )
        .collect();
      return { first, duplicate, inventory, canonical };
    });

    expect(state.duplicate.memoryId).toBe(state.first.memoryId);
    expect(state.duplicate.canonicalMemoryId).toBe(
      state.first.canonicalMemoryId
    );
    expect(state.inventory).toHaveLength(1);
    expect(state.canonical).toHaveLength(1);
  });

  test("the same topic key remains independent across agent surfaces", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);

    const state = await t.run(async (ctx) => {
      const write = (surface: string, content: string) =>
        upsertCanonicalWorkspaceMemory(ctx.db, {
          ...seeded,
          source: "operator",
          category: "operator_instruction",
          namespace: "lessons",
          kind: "workflow_preference",
          conflictKey: "workflow.review_mode",
          title: `${surface} review mode`,
          summary: content,
          instruction: content,
          canonicalContent: content,
          surfaces: [surface],
          confidence: 1,
          impactScore: 1,
        });
      const mainV1 = await write("main", "Main should summarize first.");
      const qualification = await write(
        "qualification",
        "Qualification should cite evidence first."
      );
      const mainV2 = await write("main", "Main should ask one question first.");
      const rows = await ctx.db
        .query("workspaceMemories")
        .withIndex("by_workspace_and_status_and_precedence", (query) =>
          query.eq("workspaceId", seeded.workspaceId)
        )
        .collect();
      return { mainV1, qualification, mainV2, rows };
    });

    expect(
      state.rows.find((row) => String(row._id) === state.mainV1.memory.memoryId)
        ?.status
    ).toBe("superseded");
    expect(
      state.rows.find((row) => String(row._id) === state.mainV2.memory.memoryId)
        ?.status
    ).toBe("active");
    expect(
      state.rows.find(
        (row) => String(row._id) === state.qualification.memory.memoryId
      )?.status
    ).toBe("active");
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
      channels: ["twitter"],
    };
    const request = {
      workspaceId: String(seeded.workspaceId),
      userId: String(seeded.userId),
      query: "scoped prospect",
      surface: "manual_prospect",
      prospectId: "prospect-a",
      channel: "twitter",
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
    expect(
      buildWorkspaceMemoryContext({
        request: { ...request, channel: "linkedin" },
        memories: [scoped],
      }).memoryIds
    ).toEqual([]);
  });
});
