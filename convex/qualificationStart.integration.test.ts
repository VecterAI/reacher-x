/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
async function fixture() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const testPath = ["@convex-dev/workflow", "test"].join("/");
  const component = await import(testPath);
  component.default.register(t);
  const args = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "atomic-start",
      email: "atomic@example.test",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "QA",
      description: "QA",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      userId,
      workspaceId,
      platform: "twitter",
      externalId: "atomic-start",
      origin: "workspace_discovery",
      data: {},
      status: "new",
      qualificationStatus: "pending",
      updatedAt: 1,
    });
    return { workspaceId, prospectId };
  });
  return { t, args };
}
test("concurrent queued starters persist exactly one workflow lease before execution", async () => {
  const { t, args } = await fixture();
  const results = await Promise.all(
    Array.from({ length: 3 }, () =>
      t.mutation(
        internal.workflows.qualification.startQualificationWorkflowAtomically,
        args
      )
    )
  );
  expect(results[0].workflowId).not.toBe("");
  expect(new Set(results.map((result) => result.workflowId)).size).toBe(1);
  expect(
    (await t.run((ctx) => ctx.db.get(args.prospectId)))?.qualificationWorkflowId
  ).toBe(results[0].workflowId);
});
test.each(["archived", "qualified", "deleting", "mismatch", "missing"])(
  "does not start queued work for %s records",
  async (kind) => {
    const { t, args } = await fixture();
    await t.run(async (ctx) => {
      if (kind === "missing") await ctx.db.delete(args.prospectId);
      else if (kind === "archived")
        await ctx.db.patch(args.prospectId, { status: "archived" });
      else if (kind === "qualified")
        await ctx.db.patch(args.prospectId, {
          qualificationStatus: "qualified",
        });
      else if (kind === "deleting")
        await ctx.db.patch(args.workspaceId, { deletionStartedAt: 1 });
      else {
        const workspace = (await ctx.db.get(args.workspaceId))!;
        args.workspaceId = await ctx.db.insert("workspaces", {
          userId: workspace.userId,
          name: "Other",
          description: "Other",
          isDefault: false,
          updatedAt: 1,
        });
      }
    });
    expect(
      await t.mutation(
        internal.workflows.qualification.startQualificationWorkflowAtomically,
        args
      )
    ).toEqual({ workflowId: "" });
  }
);
