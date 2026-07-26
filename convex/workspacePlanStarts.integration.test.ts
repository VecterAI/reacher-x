/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createOutreachPlan } from "./lib/outreachCore";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const TEST_STRATEGY = {
  rationale: "Reach out with relevant context.",
  valueProposition: "Share a useful observation.",
  tone: "peer",
};

const TEST_TASKS = [
  {
    type: "dm" as const,
    description: "Send a concise introduction.",
    content: "Hello from ReacherX.",
    timing: { type: "immediate" as const },
  },
];

async function seedWorkspace(
  t: ReturnType<typeof convexTest>,
  suffix: string,
  prospectCount = 1
) {
  return await t.run(async (ctx) => {
    const workosUserId = `workos-workspace-plan-start-${suffix}`;
    const userId = await ctx.db.insert("users", {
      workosUserId,
      email: `${suffix}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Workspace ${suffix}`,
      description: "Test workspace",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    const prospectIds: Id<"prospects">[] = [];
    for (let index = 0; index < prospectCount; index += 1) {
      prospectIds.push(
        await ctx.db.insert("prospects", {
          workspaceId,
          userId,
          platform: "twitter",
          origin: "workspace_discovery",
          externalId: `external-${suffix}-${index}`,
          data: {},
          status: "new",
          qualificationStatus: "qualified",
          displayName: `Prospect ${suffix} ${index}`,
          updatedAt: 1,
        })
      );
    }
    return { prospectIds, userId, workspaceId, workosUserId };
  });
}

async function insertDraftPlan(
  t: ReturnType<typeof convexTest>,
  args: {
    prospectId: Id<"prospects">;
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
  }
) {
  const [planId] = await insertDraftPlans(t, {
    prospectIds: [args.prospectId],
    workspaceId: args.workspaceId,
    userId: args.userId,
  });
  return planId;
}

async function insertDraftPlans(
  t: ReturnType<typeof convexTest>,
  args: {
    prospectIds: Id<"prospects">[];
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
  }
) {
  return await t.run(async (ctx) => {
    const planIds: Id<"outreachPlans">[] = [];
    for (const prospectId of args.prospectIds) {
      const planId = await ctx.db.insert("outreachPlans", {
        prospectId,
        workspaceId: args.workspaceId,
        userId: args.userId,
        status: "draft",
        strategy: TEST_STRATEGY,
        version: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("outreachTasks", {
        planId,
        order: 1,
        type: "dm",
        description: "Send a concise introduction.",
        content: "Hello from ReacherX.",
        status: "pending",
        timing: { type: "immediate" },
      });
      planIds.push(planId);
    }
    return planIds;
  });
}

async function processPlanStartRunToCompletion(
  t: ReturnType<typeof convexTest>,
  runId: Id<"workspacePlanStartRuns">,
  maximumBatchCalls: number
) {
  for (let batchCall = 0; batchCall < maximumBatchCalls; batchCall += 1) {
    await t.mutation(
      internal.workspacePlanStarts.processWorkspacePlanStartBatchInternal,
      { runId }
    );
    const run = await t.run((ctx) =>
      ctx.db.get("workspacePlanStartRuns", runId)
    );
    if (run?.status === "completed") {
      return run;
    }
  }
  throw new Error("Workspace plan start run did not complete");
}

describe("workspace plan starts", () => {
  test("returns an empty preview without creating a chat confirmation", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, "empty-state");
    const sourceThreadId = "empty-workspace-thread";

    const preview = await t
      .withIdentity({ subject: seeded.workosUserId })
      .query(api.workspacePlanStarts.getWorkspacePlanStartPreviewQuery, {
        workspaceId: seeded.workspaceId,
      });
    const prepared = await t.mutation(
      internal.workspacePlanStarts.prepareWorkspacePlanStartRunInternal,
      {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId,
      }
    );
    const confirmed = await t.mutation(
      internal.workspacePlanStarts.confirmLatestWorkspacePlanStartRunInternal,
      {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId,
      }
    );

    expect(preview).toEqual({
      draftPlanCount: 0,
      draftPlanCountIsCapped: false,
    });
    expect(prepared).toMatchObject({
      runId: null,
      draftPlanCount: 0,
      draftPlanCountIsCapped: false,
    });
    expect(confirmed).toBeNull();
  });

  test("keeps review plans as drafts and schedules autonomous plans", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, "creation-mode", 2);

    const reviewPlanId = await t.run((ctx) =>
      createOutreachPlan(ctx, {
        prospectId: seeded.prospectIds[0],
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        strategy: TEST_STRATEGY,
        tasks: TEST_TASKS,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert("workspaceAgentSettings", {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        autonomyMode: "autonomous",
        updatedAt: 2,
      })
    );
    const autonomousPlanId = await t.mutation(internal.outreach.createPlan, {
      prospectId: seeded.prospectIds[1],
      workspaceId: seeded.workspaceId,
      userId: seeded.userId,
      strategy: TEST_STRATEGY,
      tasks: TEST_TASKS,
      threadId: "autonomous-plan-thread",
    });

    const state = await t.run(async (ctx) => ({
      autonomous: await ctx.db.get("outreachPlans", autonomousPlanId),
      review: await ctx.db.get("outreachPlans", reviewPlanId),
      scheduledFunctions: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
    }));
    expect(state.review?.status).toBe("draft");
    expect(state.autonomous?.status).toBe("approved");
    expect(
      state.scheduledFunctions.some(
        (scheduledFunction) =>
          scheduledFunction.name.includes("startOutreachWorkflow") &&
          scheduledFunction.state.kind === "pending"
      )
    ).toBe(true);
  });

  test("requires explicit UI confirmation before autonomy starts existing drafts", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, "toggle-confirmation");
    await insertDraftPlan(t, {
      prospectId: seeded.prospectIds[0],
      workspaceId: seeded.workspaceId,
      userId: seeded.userId,
    });
    const authenticated = t.withIdentity({ subject: seeded.workosUserId });

    await expect(
      authenticated.mutation(api.workspaces.updateWorkspaceAgentSettings, {
        workspaceId: seeded.workspaceId,
        autonomyMode: "autonomous",
      })
    ).rejects.toThrow(
      "Confirm that existing draft plans may start before enabling autonomous sending."
    );

    const result = await authenticated.mutation(
      api.workspaces.updateWorkspaceAgentSettings,
      {
        workspaceId: seeded.workspaceId,
        autonomyMode: "autonomous",
        startExistingDraftPlans: true,
      }
    );
    const state = await t.run(async (ctx) => ({
      run: result.planStartRunId
        ? await ctx.db.get("workspacePlanStartRuns", result.planStartRunId)
        : null,
      settings: await ctx.db
        .query("workspaceAgentSettings")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique(),
    }));

    expect(result).toMatchObject({
      autonomyMode: "autonomous",
      draftPlanCount: 1,
      draftPlanCountIsCapped: false,
    });
    expect(state.settings?.autonomyMode).toBe("autonomous");
    expect(state.run).toMatchObject({
      source: "workspace_settings",
      status: "queued",
      targetPlanCount: 1,
    });

    const duplicate = await authenticated.mutation(
      api.workspaces.updateWorkspaceAgentSettings,
      {
        workspaceId: seeded.workspaceId,
        autonomyMode: "autonomous",
        startExistingDraftPlans: true,
      }
    );
    const runs = await t.run((ctx) =>
      ctx.db
        .query("workspacePlanStartRuns")
        .withIndex("by_workspace_and_updated_at", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .collect()
    );
    expect(duplicate.planStartRunId).toBeNull();
    expect(runs).toHaveLength(1);
  });

  test("prepares, confirms, and gradually starts draft plans from chat", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, "agent-command", 3);
    const planIds = await Promise.all(
      seeded.prospectIds.map((prospectId) =>
        insertDraftPlan(t, {
          prospectId,
          workspaceId: seeded.workspaceId,
          userId: seeded.userId,
        })
      )
    );
    await t.run((ctx) =>
      ctx.db.patch("prospects", seeded.prospectIds[2], {
        status: "archived",
      })
    );
    const sourceThreadId = "workspace-agent-command-thread";

    const prepared = await t.mutation(
      internal.workspacePlanStarts.prepareWorkspacePlanStartRunInternal,
      {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId,
      }
    );
    expect(prepared).toMatchObject({
      autonomyMode: "review_required",
      draftPlanCount: 3,
      draftPlanCountIsCapped: false,
    });
    expect(prepared.runId).not.toBeNull();

    const beforeConfirmation = await t.run((ctx) =>
      Promise.all(planIds.map((planId) => ctx.db.get("outreachPlans", planId)))
    );
    expect(beforeConfirmation.every((plan) => plan?.status === "draft")).toBe(
      true
    );

    const confirmed = await t.mutation(
      internal.workspacePlanStarts.confirmLatestWorkspacePlanStartRunInternal,
      {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId,
      }
    );
    expect(confirmed?.status).toBe("queued");
    const duplicateConfirmation = await t.mutation(
      internal.workspacePlanStarts.confirmLatestWorkspacePlanStartRunInternal,
      {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId,
      }
    );
    expect(duplicateConfirmation).toBeNull();
    if (!prepared.runId) {
      throw new Error("Expected a prepared workspace plan start run");
    }
    const runId = prepared.runId;

    await t.mutation(
      internal.workspacePlanStarts.processWorkspacePlanStartBatchInternal,
      { runId }
    );
    await t.mutation(
      internal.workspacePlanStarts.processWorkspacePlanStartBatchInternal,
      { runId }
    );

    const completed = await t.run(async (ctx) => ({
      plans: await Promise.all(
        planIds.map((planId) => ctx.db.get("outreachPlans", planId))
      ),
      run: await ctx.db.get("workspacePlanStartRuns", runId),
    }));
    expect(completed.plans.map((plan) => plan?.status)).toEqual([
      "approved",
      "approved",
      "abandoned",
    ]);
    expect(completed.run).toMatchObject({
      status: "completed",
      startedPlanCount: 2,
      skippedPlanCount: 1,
    });
  });

  test("processes 166 drafts in controlled five-plan batches", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, "large-batch", 166);
    const planIds = await insertDraftPlans(t, {
      prospectIds: seeded.prospectIds,
      workspaceId: seeded.workspaceId,
      userId: seeded.userId,
    });
    const prepared = await t.mutation(
      internal.workspacePlanStarts.prepareWorkspacePlanStartRunInternal,
      {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId: "large-batch-thread",
      }
    );
    if (!prepared.runId) {
      throw new Error("Expected a large workspace plan start run");
    }
    const runId = prepared.runId;

    await t.mutation(
      internal.workspacePlanStarts.confirmLatestWorkspacePlanStartRunInternal,
      {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId: "large-batch-thread",
      }
    );
    await t.mutation(
      internal.workspacePlanStarts.processWorkspacePlanStartBatchInternal,
      { runId }
    );
    const firstBatch = await t.run(async (ctx) => ({
      drafts: await ctx.db
        .query("outreachPlans")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", seeded.workspaceId).eq("status", "draft")
        )
        .collect(),
      run: await ctx.db.get("workspacePlanStartRuns", runId),
    }));
    expect(firstBatch.drafts).toHaveLength(161);
    expect(firstBatch.run).toMatchObject({
      status: "running",
      startedPlanCount: 5,
    });

    const completedRun = await processPlanStartRunToCompletion(t, runId, 34);
    const completedPlans = await t.run((ctx) =>
      Promise.all(planIds.map((planId) => ctx.db.get("outreachPlans", planId)))
    );
    expect(completedPlans.every((plan) => plan?.status === "approved")).toBe(
      true
    );
    expect(completedRun).toMatchObject({
      status: "completed",
      targetPlanCount: 166,
      startedPlanCount: 166,
      skippedPlanCount: 0,
    });
  });

  test("releases approval-gated reply and DM tasks after autonomy is enabled", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, "release-approval");
    const { actionableTaskIds, humanTaskId, runId, waitTaskId } = await t.run(
      async (ctx) => {
        const planId = await ctx.db.insert("outreachPlans", {
          prospectId: seeded.prospectIds[0],
          workspaceId: seeded.workspaceId,
          userId: seeded.userId,
          status: "executing",
          strategy: TEST_STRATEGY,
          version: 1,
          updatedAt: 1,
        });
        const dmTaskId = await ctx.db.insert("outreachTasks", {
          planId,
          order: 1,
          type: "dm",
          description: "Send the approved message.",
          content: "Hello from ReacherX.",
          status: "executing",
          timing: { type: "immediate" },
          approvalEventId: "approval-event",
          approvalRequestedAt: 1,
          approvalNonce: 1,
        });
        const commentTaskId = await ctx.db.insert("outreachTasks", {
          planId,
          order: 2,
          type: "comment",
          description: "Reply to the post.",
          content: "Useful context.",
          targetTweetId: "target-post",
          status: "executing",
          timing: { type: "immediate" },
          approvalEventId: "comment-approval-event",
          approvalRequestedAt: 1,
          approvalNonce: 1,
        });
        const waitTaskId = await ctx.db.insert("outreachTasks", {
          planId,
          order: 3,
          type: "wait",
          description: "Wait for a response.",
          status: "executing",
          timing: { type: "delay", value: "2 days" },
          approvalEventId: "wait-event",
          approvalRequestedAt: 1,
        });
        const humanTaskId = await ctx.db.insert("outreachTasks", {
          planId,
          order: 4,
          type: "ask_human",
          description: "Ask the user for a decision.",
          status: "executing",
          timing: { type: "immediate" },
          approvalEventId: "human-event",
          approvalRequestedAt: 1,
        });
        const runId = await ctx.db.insert("workspacePlanStartRuns", {
          workspaceId: seeded.workspaceId,
          userId: seeded.userId,
          source: "workspace_settings",
          status: "running",
          autonomyMode: "autonomous",
          snapshotAt: 1,
          targetPlanCount: 0,
          targetPlanCountIsCapped: false,
          startedPlanCount: 0,
          skippedPlanCount: 0,
          releasedTaskCount: 0,
          planStartCompleted: true,
          approvalReleaseCompleted: false,
          confirmedAt: 1,
          createdAt: 1,
          updatedAt: 1,
        });
        return {
          actionableTaskIds: [dmTaskId, commentTaskId],
          humanTaskId,
          runId,
          waitTaskId,
        };
      }
    );

    await t.mutation(
      internal.workspacePlanStarts.releasePendingApprovalsBatchInternal,
      { runId, cursor: null }
    );

    const completed = await t.run(async (ctx) => {
      const [dmTask, commentTask] = await Promise.all(
        actionableTaskIds.map((taskId) => ctx.db.get("outreachTasks", taskId))
      );
      return {
        actionableTasks: [dmTask, commentTask],
        humanTask: await ctx.db.get("outreachTasks", humanTaskId),
        run: await ctx.db.get("workspacePlanStartRuns", runId),
        waitTask: await ctx.db.get("outreachTasks", waitTaskId),
      };
    });
    expect(
      completed.actionableTasks.every(
        (task) => typeof task?.approvedAt === "number"
      )
    ).toBe(true);
    expect(completed.waitTask?.approvedAt).toBeUndefined();
    expect(completed.humanTask?.approvedAt).toBeUndefined();
    expect(completed.run).toMatchObject({
      status: "completed",
      releasedTaskCount: 2,
      approvalReleaseCompleted: true,
    });
  });

  test("switching back to review mode makes future plans drafts again", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, "mode-reversal", 2);
    const authenticated = t.withIdentity({ subject: seeded.workosUserId });

    await authenticated.mutation(api.workspaces.updateWorkspaceAgentSettings, {
      workspaceId: seeded.workspaceId,
      autonomyMode: "autonomous",
      startExistingDraftPlans: true,
    });
    const autonomousPlanId = await t.run((ctx) =>
      createOutreachPlan(ctx, {
        prospectId: seeded.prospectIds[0],
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        strategy: TEST_STRATEGY,
        tasks: TEST_TASKS,
      })
    );
    await authenticated.mutation(api.workspaces.updateWorkspaceAgentSettings, {
      workspaceId: seeded.workspaceId,
      autonomyMode: "review_required",
    });
    const reviewPlanId = await t.run((ctx) =>
      createOutreachPlan(ctx, {
        prospectId: seeded.prospectIds[1],
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        strategy: TEST_STRATEGY,
        tasks: TEST_TASKS,
      })
    );

    const state = await t.run(async (ctx) => ({
      autonomousPlan: await ctx.db.get("outreachPlans", autonomousPlanId),
      reviewPlan: await ctx.db.get("outreachPlans", reviewPlanId),
      settings: await ctx.db
        .query("workspaceAgentSettings")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique(),
    }));
    expect(state.autonomousPlan?.status).toBe("approved");
    expect(state.reviewPlan?.status).toBe("draft");
    expect(state.settings?.autonomyMode).toBe("review_required");
  });

  test("rejects cross-workspace bulk-start requests", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedWorkspace(t, "workspace-owner");
    const outsider = await seedWorkspace(t, "workspace-outsider");

    await expect(
      t.mutation(
        internal.workspacePlanStarts.prepareWorkspacePlanStartRunInternal,
        {
          workspaceId: owner.workspaceId,
          userId: outsider.userId,
          sourceThreadId: "cross-workspace-thread",
        }
      )
    ).rejects.toThrow("Workspace not found");
    await expect(
      t
        .withIdentity({ subject: outsider.workosUserId })
        .mutation(api.workspaces.updateWorkspaceAgentSettings, {
          workspaceId: owner.workspaceId,
          autonomyMode: "autonomous",
          startExistingDraftPlans: true,
        })
    ).rejects.toThrow("Not authorized to update this workspace");
  });

  test("does not restart or release tasks for blocked-auth plans", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t, "blocked-auth");
    const { planId, taskId } = await t.run(async (ctx) => {
      const planId = await ctx.db.insert("outreachPlans", {
        prospectId: seeded.prospectIds[0],
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        status: "blocked_auth",
        strategy: TEST_STRATEGY,
        version: 1,
        updatedAt: 1,
      });
      const taskId = await ctx.db.insert("outreachTasks", {
        planId,
        order: 1,
        type: "dm",
        description: "Blocked DM.",
        content: "This must remain blocked.",
        status: "executing",
        timing: { type: "immediate" },
        approvalEventId: "blocked-auth-approval",
        approvalRequestedAt: 1,
      });
      return { planId, taskId };
    });
    const result = await t
      .withIdentity({ subject: seeded.workosUserId })
      .mutation(api.workspaces.updateWorkspaceAgentSettings, {
        workspaceId: seeded.workspaceId,
        autonomyMode: "autonomous",
        startExistingDraftPlans: true,
      });
    if (!result.planStartRunId) {
      throw new Error("Expected an autonomy release run");
    }

    await t.mutation(
      internal.workspacePlanStarts.releasePendingApprovalsBatchInternal,
      { runId: result.planStartRunId, cursor: null }
    );
    const state = await t.run(async (ctx) => ({
      plan: await ctx.db.get("outreachPlans", planId),
      task: await ctx.db.get("outreachTasks", taskId),
    }));
    expect(state.plan?.status).toBe("blocked_auth");
    expect(state.task?.approvedAt).toBeUndefined();
  });
});
