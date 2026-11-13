/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import workflowComponentSchema from "../node_modules/@convex-dev/workflow/dist/component/schema.js";
import workpoolComponentSchema from "../node_modules/@convex-dev/workpool/dist/component/schema.js";
import { internal } from "./_generated/api";
import { dismissPendingAskHumanNotificationsForPlan } from "./lib/notificationHelpers";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const workflowComponentModules = import.meta.glob(
  "../node_modules/@convex-dev/workflow/dist/component/**/*.js"
);
const workpoolComponentModules = import.meta.glob(
  "../node_modules/@convex-dev/workpool/dist/component/**/*.js"
);

function createTest() {
  const t = convexTest(schema, modules);
  t.registerComponent(
    "workflow",
    workflowComponentSchema,
    workflowComponentModules
  );
  t.registerComponent(
    "workflow/workpool",
    workpoolComponentSchema,
    workpoolComponentModules
  );
  return t;
}

async function seed(t: ReturnType<typeof createTest>, suffix: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `ask-human-${suffix}`,
      email: `ask-human-${suffix}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `AskHuman ${suffix}`,
      description: "ask_human cleanup test",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "linkedin",
      origin: "workspace_discovery",
      externalId: `ask-human-${suffix}`,
      data: {},
      status: "in_progress",
      qualificationStatus: "qualified",
      displayName: `AskHuman ${suffix}`,
      updatedAt: 1,
    });
    const planId = await ctx.db.insert("outreachPlans", {
      prospectId,
      workspaceId,
      userId,
      status: "executing",
      strategy: {
        rationale: "Test",
        valueProposition: "Test",
        tone: "peer",
      },
      version: 1,
      updatedAt: 1,
    });
    const taskId = await ctx.db.insert("outreachTasks", {
      planId,
      order: 1,
      type: "comment",
      description: "Reply to their post",
      status: "executing",
      content: "Nice post",
      targetTweetId: "tweet-1",
      timing: { type: "immediate" },
    });
    const notificationId = await ctx.db.insert("outreachNotifications", {
      userId,
      workspaceId,
      type: "ask_human",
      title: "Approve the reply",
      message: '"Nice post"',
      status: "pending",
      prospectId,
      planId,
      taskId,
    });
    const humanOnlyId = await ctx.db.insert("outreachNotifications", {
      userId,
      workspaceId,
      type: "ask_human",
      title: "Need a decision",
      message: "Which angle?",
      status: "pending",
      prospectId,
      planId,
    });
    return { planId, taskId, notificationId, humanOnlyId };
  });
}

describe("ask_human approval notification cleanup", () => {
  test("plan pause helper dismisses task approvals only", async () => {
    const t = createTest();
    const seeded = await seed(t, "pause");
    await t.run(async (ctx) => {
      await dismissPendingAskHumanNotificationsForPlan(ctx, seeded.planId);
    });
    const rows = await t.run(async (ctx) => ({
      approval: await ctx.db.get(seeded.notificationId),
      human: await ctx.db.get(seeded.humanOnlyId),
    }));
    expect(rows.approval?.status).toBe("dismissed");
    expect(rows.human?.status).toBe("pending");
  });

  test("updateTaskStatus to waiting_manual dismisses task approvals", async () => {
    const t = createTest();
    const seeded = await seed(t, "wait");
    await t.mutation(internal.outreach.updateTaskStatus, {
      taskId: seeded.taskId,
      status: "waiting_manual",
    });
    const row = await t.run(async (ctx) => ctx.db.get(seeded.notificationId));
    expect(row?.status).toBe("dismissed");
  });

  test("cleanup mutation dismisses rows for completed tasks", async () => {
    const t = createTest();
    const seeded = await seed(t, "clean");
    await t.run(async (ctx) => {
      await ctx.db.patch(seeded.taskId, { status: "completed" });
    });
    const result = await t.mutation(
      internal.outreach.cleanupStaleAskHumanApprovalNotifications,
      { dryRun: false }
    );
    expect(result.dismissed).toBeGreaterThanOrEqual(1);
    const row = await t.run(async (ctx) => ctx.db.get(seeded.notificationId));
    expect(row?.status).toBe("dismissed");
  });
});
