/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import polarComponentSchema from "../node_modules/@convex-dev/polar/dist/component/schema.js";
import workflowComponentSchema from "../node_modules/@convex-dev/workflow/dist/component/schema.js";
import workpoolComponentSchema from "../node_modules/@convex-dev/workpool/dist/component/schema.js";
import { internal } from "./_generated/api";
import { parseAdaptiveOutreachDecision } from "./lib/adaptiveOutreachCore";
import { createOutreachPlan, refinePlan } from "./lib/outreachCore";
import {
  executeOutreachReaction,
  normalizeOutreachReactionTarget,
} from "./lib/outreachReactionCore";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const polarComponentModules = import.meta.glob(
  "../node_modules/@convex-dev/polar/dist/component/**/*.js"
);
const workflowComponentModules = import.meta.glob(
  "../node_modules/@convex-dev/workflow/dist/component/**/*.js"
);
const workpoolComponentModules = import.meta.glob(
  "../node_modules/@convex-dev/workpool/dist/component/**/*.js"
);

const TEST_STRATEGY = {
  rationale: "Engage naturally before continuing the conversation.",
  valueProposition: "Share a relevant observation.",
  tone: "peer",
};

function createReactionTest() {
  const t = convexTest(schema, modules);
  t.registerComponent("polar", polarComponentSchema, polarComponentModules);
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

async function seedEntities(
  t: ReturnType<typeof createReactionTest>,
  platform: "twitter" | "linkedin",
  suffix: string
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `reaction-${suffix}`,
      email: `reaction-${suffix}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Reaction ${suffix}`,
      description: "Reaction integration test",
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
      platform,
      origin: "workspace_discovery",
      externalId: `reaction-${suffix}`,
      data: {},
      status: "in_progress",
      qualificationStatus: "qualified",
      displayName: `Reaction ${suffix}`,
      updatedAt: 1,
    });
    return { prospectId, userId, workspaceId };
  });
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("outreach reaction execution adapters", () => {
  test("routes X likes without touching the LinkedIn adapter", async () => {
    const likeXPost = vi.fn(async () => ({ success: true }));
    const reactToLinkedIn = vi.fn(async () => ({ success: true }));

    const result = await executeOutreachReaction(
      {
        platform: "twitter",
        targetPostId: "tweet-1",
        reactionType: "like",
      },
      { likeXPost, reactToLinkedIn }
    );

    expect(result).toMatchObject({
      platform: "twitter",
      provider: "x_twitter_sdk",
      reactionType: "like",
      targetPostId: "tweet-1",
    });
    expect(likeXPost).toHaveBeenCalledOnce();
    expect(reactToLinkedIn).not.toHaveBeenCalled();
  });

  test("routes LinkedIn comment reactions with the parent and comment IDs", async () => {
    const likeXPost = vi.fn(async () => ({ success: true }));
    const reactToLinkedIn = vi.fn(async () => ({ success: true }));

    const result = await executeOutreachReaction(
      {
        platform: "linkedin",
        targetPostId: "linkedin-post-1",
        targetCommentId: "linkedin-comment-1",
        reactionType: "insightful",
      },
      { likeXPost, reactToLinkedIn }
    );

    expect(result).toMatchObject({
      platform: "linkedin",
      provider: "linkedin_unipile",
      targetPostId: "linkedin-post-1",
      targetCommentId: "linkedin-comment-1",
      reactionType: "insightful",
    });
    expect(reactToLinkedIn).toHaveBeenCalledWith({
      postId: "linkedin-post-1",
      commentId: "linkedin-comment-1",
      reactionType: "insightful",
    });
    expect(likeXPost).not.toHaveBeenCalled();
  });

  test("rejects unsupported X reactions before any provider call", () => {
    expect(() =>
      normalizeOutreachReactionTarget({
        platform: "twitter",
        targetPostId: "tweet-1",
        reactionType: "celebrate",
      })
    ).toThrow("X reaction tasks support only the like reaction");
  });
});

describe("outreach reaction persistence and adaptive planning", () => {
  test.each([
    {
      platform: "twitter" as const,
      suffix: "x-persistence",
      task: {
        type: "react" as const,
        description: "Like the relevant X reply.",
        timing: { type: "immediate" as const },
        targetTweetId: "tweet-1",
      },
      expectedReaction: "like",
    },
    {
      platform: "linkedin" as const,
      suffix: "linkedin-persistence",
      task: {
        type: "react" as const,
        description: "React to the prospect's LinkedIn comment.",
        timing: { type: "immediate" as const },
        targetTweetId: "linkedin-post-1",
        targetCommentId: "linkedin-comment-1",
        reactionType: "insightful" as const,
      },
      expectedReaction: "insightful",
    },
  ])(
    "stores $platform reactions in the active plan and immutable revision",
    async ({ platform, suffix, task, expectedReaction }) => {
      const t = createReactionTest();
      const seeded = await seedEntities(t, platform, suffix);
      const planId = await t.run((ctx) =>
        createOutreachPlan(ctx, {
          ...seeded,
          strategy: TEST_STRATEGY,
          tasks: [task],
        })
      );

      const state = await t.run(async (ctx) => {
        const [storedTask] = await ctx.db
          .query("outreachTasks")
          .withIndex("by_plan_order", (q) => q.eq("planId", planId))
          .collect();
        const revision = await ctx.db
          .query("outreachPlanRevisions")
          .withIndex("by_plan_and_version", (q) =>
            q.eq("planId", planId).eq("version", 1)
          )
          .unique();
        return { revision, storedTask };
      });

      expect(state.storedTask).toMatchObject({
        type: "react",
        reactionType: expectedReaction,
        planVersion: 1,
      });
      expect(state.revision?.tasks[0]).toMatchObject({
        type: "react",
        reactionType: expectedReaction,
      });
    }
  );

  test("rejects duplicate reaction targets inside one plan", async () => {
    const t = createReactionTest();
    const seeded = await seedEntities(t, "twitter", "duplicates");

    await expect(
      t.run((ctx) =>
        createOutreachPlan(ctx, {
          ...seeded,
          strategy: TEST_STRATEGY,
          tasks: [
            {
              type: "react",
              description: "Like the post.",
              timing: { type: "immediate" },
              targetTweetId: "tweet-duplicate",
            },
            {
              type: "react",
              description: "Like the same post again.",
              timing: { type: "delay", value: "1h" },
              targetTweetId: "tweet-duplicate",
            },
          ],
        })
      )
    ).rejects.toThrow("Plan contains a duplicate reaction task");
  });

  test("completes a repeated cross-revision reaction without a provider call", async () => {
    const t = createReactionTest();
    const seeded = await seedEntities(t, "twitter", "cross-revision");
    const planId = await t.run(async (ctx) => {
      const createdPlanId = await createOutreachPlan(ctx, {
        ...seeded,
        strategy: TEST_STRATEGY,
        tasks: [
          {
            type: "react",
            description: "Like the reply.",
            timing: { type: "immediate" },
            targetTweetId: "tweet-cross-revision",
          },
        ],
      });
      const [completedTask] = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", createdPlanId))
        .collect();
      await ctx.db.patch(completedTask._id, {
        status: "completed",
        resultData: { reactionTargetId: "tweet-cross-revision" },
      });
      await refinePlan(ctx, createdPlanId, {
        strategy: TEST_STRATEGY,
        tasks: [
          {
            type: "react",
            description: "Do not like the same reply twice.",
            timing: { type: "immediate" },
            targetTweetId: "tweet-cross-revision",
          },
        ],
      });
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", createdPlanId))
        .collect();
      const pendingTask = tasks.find((task) => task.status === "pending");
      if (!pendingTask) {
        throw new Error("Expected a new pending reaction task");
      }
      await ctx.db.patch(createdPlanId, { status: "executing" });
      await ctx.db.patch(pendingTask._id, { status: "executing" });
      return { createdPlanId, pendingTaskId: pendingTask._id };
    });

    const result = await t.action(
      internal.outreachActions.executeReactionTask,
      {
        planId: planId.createdPlanId,
        taskId: planId.pendingTaskId,
        executionGeneration: 0,
      }
    );
    const task = await t.run((ctx) => ctx.db.get(planId.pendingTaskId));

    expect(result).toMatchObject({
      success: true,
      duplicate: true,
      reactionTargetId: "tweet-cross-revision",
    });
    expect(task).toMatchObject({
      status: "completed",
      resultData: {
        reactionTargetId: "tweet-cross-revision",
        duplicate: true,
      },
    });
  });

  test.each([
    {
      channel: "twitter_reply" as const,
      responseMessageId: "x-reply-1",
      conversationId: "x-post-1",
      expected: {
        targetTweetId: "x-reply-1",
        targetCommentId: undefined,
        reactionType: "like",
      },
    },
    {
      channel: "linkedin_comment" as const,
      responseMessageId: "linkedin-comment-1",
      conversationId: "linkedin-post-1",
      expected: {
        targetTweetId: "linkedin-post-1",
        targetCommentId: "linkedin-comment-1",
        reactionType: "support",
      },
    },
  ])(
    "grounds a $channel reaction in the actual inbound public interaction",
    ({ channel, responseMessageId, conversationId, expected }) => {
      const decision = parseAdaptiveOutreachDecision(
        {
          outcome: "continue",
          summary: "Acknowledge and continue the public conversation.",
          reasoning: "A lightweight reaction is natural before replying.",
          strategy: {
            rationale: "Continue the public exchange.",
            targetTweetId: conversationId,
            valueProposition: "Answer the prospect's question.",
            tone: "helpful",
          },
          tasks: [
            {
              type: "react",
              description: "Acknowledge the prospect's response.",
              timing: { type: "immediate", value: null },
              targetTweetId: null,
              targetCommentId: null,
              reactionType: channel === "twitter_reply" ? "like" : "support",
              content: null,
            },
          ],
        },
        {
          channel,
          responseMessageId,
          responseText: "Tell me more.",
          conversationId,
        }
      );

      expect(decision.tasks[0]).toMatchObject(expected);
    }
  );

  test("never creates a reaction against a DM", () => {
    expect(() =>
      parseAdaptiveOutreachDecision(
        {
          outcome: "continue",
          summary: "Continue privately.",
          reasoning: "The prospect replied by DM.",
          strategy: {
            rationale: "Continue the private conversation.",
            targetTweetId: null,
            valueProposition: "Answer their question.",
            tone: "helpful",
          },
          tasks: [
            {
              type: "react",
              description: "React to the DM.",
              timing: { type: "immediate", value: null },
              targetTweetId: null,
              targetCommentId: null,
              reactionType: "like",
              content: null,
            },
          ],
        },
        {
          channel: "twitter_dm",
          responseMessageId: "dm-message-1",
          responseText: "How does this work?",
          conversationId: "dm-conversation-1",
        }
      )
    ).toThrow("Reaction tasks cannot target private messages");
  });
});

describe("reaction approval workflow", () => {
  test("stops before provider execution in review mode", async () => {
    vi.useFakeTimers();
    const t = createReactionTest();
    const seeded = await seedEntities(t, "linkedin", "approval");
    const planId = await t.run(async (ctx) => {
      await ctx.db.insert("workspaceAgentSettings", {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        autonomyMode: "review_required",
        updatedAt: 2,
      });
      const createdPlanId = await createOutreachPlan(ctx, {
        ...seeded,
        strategy: TEST_STRATEGY,
        tasks: [
          {
            type: "react",
            description: "Support the prospect's LinkedIn comment.",
            timing: { type: "immediate" },
            targetTweetId: "linkedin-post-approval",
            targetCommentId: "linkedin-comment-approval",
            reactionType: "support",
          },
        ],
      });
      await ctx.db.patch(createdPlanId, { status: "approved" });
      return createdPlanId;
    });

    await t.action(internal.workflows.outreach.startOutreachWorkflow, {
      planId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const state = await t.run(async (ctx) => {
      const [task] = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", planId))
        .collect();
      const notifications = await ctx.db
        .query("outreachNotifications")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .collect();
      return { notifications, plan: await ctx.db.get(planId), task };
    });

    expect(state.plan?.status).toBe("executing");
    expect(state.task).toMatchObject({
      type: "react",
      status: "executing",
    });
    expect(state.task.resultData).toBeUndefined();
    expect(state.task.approvalEventId).toEqual(expect.any(String));
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      type: "ask_human",
      taskId: state.task._id,
      status: "pending",
    });
  });
});
