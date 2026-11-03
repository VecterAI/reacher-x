/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

vi.stubEnv("OPENROUTER_API_KEY", "task-mention-search-test-key");
vi.stubEnv("OPENAI_API_KEY", "task-mention-search-test-key");

describe("task mention search", () => {
  test("a task stays searchable by draft text beyond its compact label", async () => {
    const t = convexTest(schema, modules);

    const draft = `Hi Jarl,\n\n${"Thanks again for the thoughtful reply. ".repeat(6)}See you at the Nairobi fintech meetup.`;

    const seeded = await t.run(async (ctx) => {
      const workosUserId = "task-mention-search-user";
      const userId = await ctx.db.insert("users", {
        workosUserId,
        email: "task-mention-search@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Task mention search workspace",
        description: "Regression coverage for compact task mentions",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "task-mention-search-prospect",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        displayName: "Jarl Hansen",
        updatedAt: 1,
      });
      const planId = await ctx.db.insert("outreachPlans", {
        prospectId,
        workspaceId,
        userId,
        status: "draft",
        strategy: {
          rationale: "Test compact task mentions.",
          valueProposition: "A useful observation.",
          tone: "peer",
        },
        version: 1,
        updatedAt: 1,
      });
      const taskId = await ctx.db.insert("outreachTasks", {
        planId,
        order: 4,
        type: "dm",
        description: "Reply to Jarl",
        status: "pending",
        timing: { type: "immediate" },
        content: draft,
      });

      return { workosUserId, prospectId, taskId };
    });

    const search = (query: string) =>
      t
        .withIdentity({ subject: seeded.workosUserId })
        .query(api.mediaMentions.searchMentionEntities, {
          query,
          prospectId: seeded.prospectId,
          allowedKinds: ["task"],
        });

    const results = await search("nairobi fintech");

    expect(results.map((entity) => entity.id)).toEqual([
      `task:${String(seeded.taskId)}`,
    ]);
    const [task] = results;
    expect(task.mentionText).toBe("Task 4: Jarl Hansen");
    expect(task.label.startsWith("Task 4: Hi Jarl, Thanks again")).toBe(true);
    expect(task.label.length).toBeLessThan(100);
    // The query matched text that the compact label does not contain.
    expect(task.label.toLowerCase()).not.toContain("nairobi");

    expect(await search("nothing-in-this-plan")).toEqual([]);
  }, 30_000);
});
