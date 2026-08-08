/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import workflowComponentSchema from "../node_modules/@convex-dev/workflow/dist/component/schema.js";
import workpoolComponentSchema from "../node_modules/@convex-dev/workpool/dist/component/schema.js";
import { internal } from "./_generated/api";
import { createOutreachPlan } from "./lib/outreachCore";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const workflowComponentModules = import.meta.glob(
  "../node_modules/@convex-dev/workflow/dist/component/**/*.js"
);
const workpoolComponentModules = import.meta.glob(
  "../node_modules/@convex-dev/workpool/dist/component/**/*.js"
);

const TEST_STRATEGY = {
  rationale: "Start with a relevant public signal.",
  valueProposition: "Share a useful observation.",
  tone: "peer",
};

function createRecoveryTest() {
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

async function seedOutreach(
  t: ReturnType<typeof createRecoveryTest>,
  taskType: "dm" | "comment",
  suffix: string
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `recovery-${suffix}`,
      email: `recovery-${suffix}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Recovery ${suffix}`,
      description: "Recovery integration test",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("userPlans", {
      userId,
      tier: "pro",
      prospectsLimit: -1,
      workspacesLimit: -1,
      currentProspectsCount: 0,
      currentWorkspacesCount: 1,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "linkedin",
      origin: "workspace_discovery",
      externalId: `recovery-${suffix}`,
      data: {},
      status: "in_progress",
      qualificationStatus: "qualified",
      displayName: `Recovery ${suffix}`,
      updatedAt: 1,
    });
    const planId = await createOutreachPlan(ctx, {
      userId,
      workspaceId,
      prospectId,
      strategy: TEST_STRATEGY,
      tasks: [
        taskType === "dm"
          ? {
              type: "dm",
              description: "Send the approved LinkedIn message.",
              timing: { type: "immediate" },
              content: "A useful observation.",
            }
          : {
              type: "comment",
              description: "Comment on the verified LinkedIn post.",
              timing: { type: "immediate" },
              targetTweetId: "urn:li:activity:legacy",
              content: "A useful observation.",
            },
      ],
    });
    const [task] = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .collect();
    await ctx.db.patch(planId, { status: "paused" });
    await ctx.db.patch(task._id, {
      status: "failed",
      errorMessage: "Legacy LinkedIn task failure",
    });
    return { planId, prospectId, taskId: task._id, workspaceId };
  });
}

describe("LinkedIn outreach recovery safeguards", () => {
  test("dry-run leaves an ineligible failed DM and paused plan unchanged", async () => {
    const t = createRecoveryTest();
    const seeded = await seedOutreach(t, "dm", "dry-run");

    const result = await t.action(
      internal.outreachRecovery.recoverFailedLinkedInOutreach,
      {
        dryRun: true,
        limit: 10,
        workspaceId: seeded.workspaceId,
      }
    );

    expect(result).toMatchObject({
      dryRun: true,
      inspectedCount: 1,
      resumedCount: 0,
      requiresReviewCount: 1,
    });
    expect(result.decisions[0]).toMatchObject({
      taskId: seeded.taskId,
      outcome: "requires_review",
    });

    const state = await t.run(async (ctx) => ({
      plan: await ctx.db.get("outreachPlans", seeded.planId),
      task: await ctx.db.get("outreachTasks", seeded.taskId),
    }));
    expect(state.plan?.status).toBe("paused");
    expect(state.task?.status).toBe("failed");
  });

  test("failed DM reset and resume are idempotent", async () => {
    const t = createRecoveryTest();
    const seeded = await seedOutreach(t, "dm", "reset");

    const firstReset = await t.mutation(
      internal.outreachRecovery.resetFailedLinkedInDmForRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
      }
    );
    const secondReset = await t.mutation(
      internal.outreachRecovery.resetFailedLinkedInDmForRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
      }
    );

    expect(firstReset.applied).toBe(true);
    expect(secondReset.applied).toBe(false);

    const firstResume = await t.mutation(
      internal.outreachRecovery.resumeRecoveredLinkedInDmPlan,
      { planId: seeded.planId }
    );
    const secondResume = await t.mutation(
      internal.outreachRecovery.resumeRecoveredLinkedInDmPlan,
      { planId: seeded.planId }
    );

    expect(firstResume.resumed).toBe(true);
    expect(secondResume.resumed).toBe(false);

    const state = await t.run(async (ctx) => ({
      plan: await ctx.db.get("outreachPlans", seeded.planId),
      task: await ctx.db.get("outreachTasks", seeded.taskId),
    }));
    expect(state.plan?.status).toBe("approved");
    expect(state.task?.status).toBe("pending");
  });

  test("connect-first recovery pauses the approved DM until acceptance", async () => {
    const t = createRecoveryTest();
    const seeded = await seedOutreach(t, "dm", "connect-first");

    const monitorId = await t.mutation(
      internal.outreachRecovery.startLinkedInConnectionThenDmRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
        sourcePostId: "linkedin-target-user",
        errorMessage: "No connection with recipient.",
        invitationOutcome: "invitation_sent",
      }
    );

    const state = await t.run(async (ctx) => ({
      monitor: await ctx.db.get("outreachRecoveryMonitors", monitorId),
      plan: await ctx.db.get("outreachPlans", seeded.planId),
      task: await ctx.db.get("outreachTasks", seeded.taskId),
    }));

    expect(state.monitor).toMatchObject({
      kind: "linkedin_connection_then_dm",
      stage: "awaiting_connection",
      status: "active",
    });
    expect(state.plan?.status).toBe("paused");
    expect(state.task).toMatchObject({
      status: "waiting_connection",
      errorMessage: "No connection with recipient.",
    });

    const accepted = await t.mutation(
      internal.outreachRecovery.onLinkedInConnectionAccepted,
      { prospectId: seeded.prospectId }
    );
    expect(accepted).toBe(1);

    const resumedState = await t.run(async (ctx) => ({
      monitor: await ctx.db.get("outreachRecoveryMonitors", monitorId),
      plan: await ctx.db.get("outreachPlans", seeded.planId),
      task: await ctx.db.get("outreachTasks", seeded.taskId),
    }));
    expect(resumedState.monitor?.status).toBe("completed");
    expect(resumedState.plan?.status).toBe("approved");
    expect(resumedState.task?.status).toBe("pending");
  });

  test("failed DM with a provider artifact is never retried automatically", async () => {
    const t = createRecoveryTest();
    const seeded = await seedOutreach(t, "dm", "provider-artifact");

    await t.run(async (ctx) => {
      await ctx.db.patch(seeded.taskId, {
        resultData: {
          conversationId: "chat-already-created",
          messageId: "message-already-created",
        },
      });
    });

    const reset = await t.mutation(
      internal.outreachRecovery.resetFailedLinkedInDmForRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
      }
    );

    expect(reset.applied).toBe(false);
    const task = await t.run((ctx) =>
      ctx.db.get("outreachTasks", seeded.taskId)
    );
    expect(task?.status).toBe("failed");
  });

  test("archived prospects stay excluded from recovery", async () => {
    const t = createRecoveryTest();
    const seeded = await seedOutreach(t, "dm", "archived");

    await t.run(async (ctx) => {
      await ctx.db.patch(seeded.prospectId, { status: "archived" });
      await ctx.db.patch(seeded.planId, {
        archiveHold: { previousStatus: "approved" },
      });
    });

    const reset = await t.mutation(
      internal.outreachRecovery.resetFailedLinkedInDmForRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
      }
    );

    expect(reset.applied).toBe(false);
    const task = await t.run((ctx) =>
      ctx.db.get("outreachTasks", seeded.taskId)
    );
    expect(task?.status).toBe("failed");
  });

  test("plan refinement can supersede a legacy failed DM without recreating it", async () => {
    const t = createRecoveryTest();
    const seeded = await seedOutreach(t, "dm", "refine-remove");

    await t.mutation(internal.outreach.updatePlan, {
      planId: seeded.planId,
      removeTaskIds: [seeded.taskId],
    });

    const state = await t.run(async (ctx) => ({
      plan: await ctx.db.get("outreachPlans", seeded.planId),
      task: await ctx.db.get("outreachTasks", seeded.taskId),
    }));
    expect(state.plan?.version).toBe(2);
    expect(state.task).toMatchObject({
      status: "skipped",
      supersededByVersion: 2,
    });
  });

  test("canonical comment target repair does not retry an uncertain external write", async () => {
    const t = createRecoveryTest();
    const seeded = await seedOutreach(t, "comment", "comment-target");

    const firstUpdate = await t.mutation(
      internal.outreachRecovery.updateLinkedInCommentTargetForRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
        resolvedSocialId: "urn:li:activity:canonical",
      }
    );
    const secondUpdate = await t.mutation(
      internal.outreachRecovery.updateLinkedInCommentTargetForRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
        resolvedSocialId: "urn:li:activity:canonical",
      }
    );

    expect(firstUpdate.applied).toBe(true);
    expect(secondUpdate.applied).toBe(false);

    const state = await t.run(async (ctx) => ({
      plan: await ctx.db.get("outreachPlans", seeded.planId),
      task: await ctx.db.get("outreachTasks", seeded.taskId),
    }));
    expect(state.plan?.status).toBe("paused");
    expect(state.task).toMatchObject({
      status: "failed",
      targetTweetId: "urn:li:activity:canonical",
    });
  });

  test("safe target-resolution failures reset comments for one retry", async () => {
    const t = createRecoveryTest();
    const seeded = await seedOutreach(t, "comment", "comment-retry");

    await t.run(async (ctx) => {
      await ctx.db.patch(seeded.taskId, {
        errorMessage: "The requested post might not be accessible.",
      });
    });

    const firstReset = await t.mutation(
      internal.outreachRecovery.resetFailedLinkedInCommentForRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
        resolvedSocialId: "urn:li:activity:canonical",
      }
    );
    const secondReset = await t.mutation(
      internal.outreachRecovery.resetFailedLinkedInCommentForRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
        resolvedSocialId: "urn:li:activity:canonical",
      }
    );

    expect(firstReset).toEqual({ applied: true, targetUpdated: true });
    expect(secondReset).toEqual({ applied: false, targetUpdated: false });

    const resumed = await t.mutation(
      internal.outreachRecovery.resumeRecoveredLinkedInDmPlan,
      { planId: seeded.planId }
    );
    expect(resumed.resumed).toBe(true);

    const state = await t.run(async (ctx) => ({
      plan: await ctx.db.get("outreachPlans", seeded.planId),
      task: await ctx.db.get("outreachTasks", seeded.taskId),
    }));
    expect(state.plan?.status).toBe("approved");
    expect(state.task).toMatchObject({
      status: "pending",
      targetTweetId: "urn:li:activity:canonical",
    });
  });

  test("failed comments with a provider artifact are never retried", async () => {
    const t = createRecoveryTest();
    const seeded = await seedOutreach(t, "comment", "comment-artifact");

    await t.run(async (ctx) => {
      await ctx.db.patch(seeded.taskId, {
        errorMessage: "The requested post might not be accessible.",
        resultData: { messageId: "comment-already-created" },
      });
    });

    const reset = await t.mutation(
      internal.outreachRecovery.resetFailedLinkedInCommentForRecovery,
      {
        taskId: seeded.taskId,
        planId: seeded.planId,
        resolvedSocialId: "urn:li:activity:canonical",
      }
    );

    expect(reset).toEqual({ applied: false, targetUpdated: false });
    const task = await t.run((ctx) =>
      ctx.db.get("outreachTasks", seeded.taskId)
    );
    expect(task?.status).toBe("failed");
  });
});
