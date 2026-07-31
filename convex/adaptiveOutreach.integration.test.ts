/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import workflowComponentSchema from "../node_modules/@convex-dev/workflow/dist/component/schema.js";
import workpoolComponentSchema from "../node_modules/@convex-dev/workpool/dist/component/schema.js";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  createOutreachPlan,
  refinePlan,
  type OutreachTaskInput,
} from "./lib/outreachCore";
import { parseAdaptiveOutreachDecision } from "./lib/adaptiveOutreachCore";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const workflowComponentModules = import.meta.glob(
  "../node_modules/@convex-dev/workflow/dist/component/**/*.js"
);
const workpoolComponentModules = import.meta.glob(
  "../node_modules/@convex-dev/workpool/dist/component/**/*.js"
);

function createAdaptiveTest() {
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

const TEST_STRATEGY = {
  rationale: "Start with a relevant observation.",
  valueProposition: "Help improve qualified conversations.",
  tone: "peer",
};

async function seedOutreach(
  t: ReturnType<typeof convexTest>,
  platform: "twitter" | "linkedin"
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `adaptive-${platform}`,
      email: `adaptive-${platform}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Adaptive ${platform}`,
      description: "Adaptive outreach test",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform,
      origin: "workspace_discovery",
      externalId: `adaptive-${platform}`,
      data: {},
      status: "in_progress",
      qualificationStatus: "qualified",
      displayName: `Adaptive ${platform} prospect`,
      updatedAt: 1,
    });
    const tasks: OutreachTaskInput[] = [
      {
        type: "dm",
        description: "Send the first message.",
        content: "Initial outreach.",
        timing: { type: "immediate" },
      },
      {
        type: "wait",
        description: "Wait for a response.",
        timing: { type: "event", value: "response" },
      },
    ];
    const planId = await createOutreachPlan(ctx, {
      prospectId,
      workspaceId,
      userId,
      strategy: TEST_STRATEGY,
      tasks,
    });
    return { planId, prospectId, userId, workspaceId };
  });
}

describe("adaptive outreach planning", () => {
  test("stores immutable revisions and preserves completed task history", async () => {
    const t = createAdaptiveTest();
    const seeded = await seedOutreach(t, "twitter");

    await t.run(async (ctx) => {
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", seeded.planId))
        .collect();
      await ctx.db.patch(tasks[0]._id, { status: "completed", executedAt: 2 });
      await ctx.db.patch(seeded.planId, { status: "paused" });

      await refinePlan(ctx, seeded.planId, {
        strategy: {
          ...TEST_STRATEGY,
          rationale: "Continue after new context.",
        },
        tasks: [
          {
            type: "dm",
            description: "Send a context-aware follow-up.",
            content: "Thanks for the context.",
            timing: { type: "immediate" },
          },
        ],
      });
    });

    const state = await t.run(async (ctx) => {
      const plan = await ctx.db.get(seeded.planId);
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", seeded.planId))
        .collect();
      const revisions = await ctx.db
        .query("outreachPlanRevisions")
        .withIndex("by_plan_and_version", (q) => q.eq("planId", seeded.planId))
        .collect();
      return { plan, revisions, tasks };
    });

    expect(state.plan?.version).toBe(2);
    expect(state.revisions.map((revision) => revision.version)).toEqual([1, 2]);
    expect(state.revisions[0].tasks).toHaveLength(2);
    expect(state.revisions[1].tasks.map((task) => task.description)).toEqual([
      "Send the first message.",
      "Send a context-aware follow-up.",
    ]);
    expect(
      state.tasks.find((task) => task.description === "Send the first message.")
        ?.status
    ).toBe("completed");
    expect(
      state.tasks.find((task) => task.description === "Wait for a response.")
        ?.supersededByVersion
    ).toBe(2);
  });

  test("deduplicates inbound DMs, pauses execution, and schedules replanning", async () => {
    const t = createAdaptiveTest();
    const seeded = await seedOutreach(t, "linkedin");

    await t.run(async (ctx) => {
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", seeded.planId))
        .collect();
      await ctx.db.patch(tasks[0]._id, {
        status: "waiting_response",
        resultData: { messageId: "outbound-1" },
      });
      await ctx.db.patch(seeded.planId, {
        status: "executing",
        executionGeneration: 4,
      });
    });

    const responseArgs = {
      prospectId: seeded.prospectId,
      planId: seeded.planId,
      responseType: "dm" as const,
      responseMessageId: "inbound-1",
      responseText: "This is interesting. How does it work?",
      conversationId: "chat-1",
    };
    const first = await t.mutation(
      internal.outreach.onProspectLinkedInResponse,
      responseArgs
    );
    const duplicate = await t.mutation(
      internal.outreach.onProspectLinkedInResponse,
      responseArgs
    );

    const state = await t.run(async (ctx) => {
      const plan = await ctx.db.get(seeded.planId);
      const events = await ctx.db
        .query("outreachInteractionEvents")
        .withIndex("by_prospect_and_created_at", (q) =>
          q.eq("prospectId", seeded.prospectId)
        )
        .collect();
      const notifications = await ctx.db
        .query("outreachNotifications")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .collect();
      return { events, notifications, plan };
    });

    expect(first.adaptiveReplanScheduled).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(state.plan?.status).toBe("paused");
    expect(state.plan?.executionGeneration).toBe(5);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      status: "pending",
      basePlanVersion: 1,
      executionGeneration: 5,
      responseText: "This is interesting. How does it work?",
    });
    expect(state.events[0].workflowId).toEqual(expect.any(String));
    expect(state.notifications).toHaveLength(1);
  });

  test("safely replays a recorded response without duplicate artifacts", async () => {
    const t = createAdaptiveTest();
    const seeded = await seedOutreach(t, "linkedin");

    await t.run(async (ctx) => {
      await ctx.db.patch(seeded.planId, { status: "paused" });
      await ctx.db.insert("workspaceAgentSettings", {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        autonomyMode: "review_required",
        updatedAt: 2,
      });
      await ctx.db.insert("prospectActivityLog", {
        prospectId: seeded.prospectId,
        workspaceId: seeded.workspaceId,
        type: "responded",
        title: "LinkedIn comment response received",
        description: "What part resonated most with you?",
        metadata: {
          responseCommentId: "historical-comment-1",
          conversationId: "historical-post-1",
        },
      });
    });

    const replayArgs = {
      prospectId: seeded.prospectId,
      planId: seeded.planId,
      responseCommentId: "historical-comment-1",
      responseText: "What part resonated most with you?",
      conversationId: "historical-post-1",
    };
    const first = await t.mutation(
      internal.outreach.replayHistoricalLinkedInCommentResponse,
      replayArgs
    );
    const duplicate = await t.mutation(
      internal.outreach.replayHistoricalLinkedInCommentResponse,
      replayArgs
    );

    const state = await t.run(async (ctx) => {
      const events = await ctx.db
        .query("outreachInteractionEvents")
        .withIndex("by_prospect_and_created_at", (q) =>
          q.eq("prospectId", seeded.prospectId)
        )
        .collect();
      const activities = await ctx.db
        .query("prospectActivityLog")
        .withIndex("by_prospect", (q) => q.eq("prospectId", seeded.prospectId))
        .collect();
      const notifications = await ctx.db
        .query("outreachNotifications")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .collect();
      return {
        activities,
        events,
        notifications,
        plan: await ctx.db.get(seeded.planId),
      };
    });

    expect(first.adaptiveReplanScheduled).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(state.plan).toMatchObject({
      status: "paused",
      executionGeneration: 1,
    });
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      channel: "linkedin_comment",
      responseMessageId: "historical-comment-1",
      status: "pending",
    });
    expect(state.events[0].workflowId).toEqual(expect.any(String));
    expect(
      state.activities.filter((activity) => activity.type === "responded")
    ).toHaveLength(1);
    expect(state.notifications).toHaveLength(0);
  });

  test("refuses historical replay when autonomous execution is enabled", async () => {
    const t = createAdaptiveTest();
    const seeded = await seedOutreach(t, "linkedin");

    await t.run(async (ctx) => {
      await ctx.db.patch(seeded.planId, { status: "paused" });
      await ctx.db.insert("workspaceAgentSettings", {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        autonomyMode: "autonomous",
        updatedAt: 2,
      });
      await ctx.db.insert("prospectActivityLog", {
        prospectId: seeded.prospectId,
        workspaceId: seeded.workspaceId,
        type: "responded",
        title: "LinkedIn comment response received",
        metadata: {
          responseCommentId: "unsafe-comment-1",
          conversationId: "unsafe-post-1",
        },
      });
    });

    await expect(
      t.mutation(internal.outreach.replayHistoricalLinkedInCommentResponse, {
        prospectId: seeded.prospectId,
        planId: seeded.planId,
        responseCommentId: "unsafe-comment-1",
        responseText: "Please follow up.",
        conversationId: "unsafe-post-1",
      })
    ).rejects.toThrow(
      "Historical replay requires approval-required workspace settings"
    );
  });

  test("applies a simulated agent decision without invoking a social provider", async () => {
    const t = createAdaptiveTest();
    const seeded = await seedOutreach(t, "linkedin");

    const response = await t.mutation(
      internal.outreach.onProspectLinkedInResponse,
      {
        prospectId: seeded.prospectId,
        planId: seeded.planId,
        responseType: "comment",
        responseMessageId: "comment-reply-1",
        responseText: "What part did you find most useful?",
        conversationId: "linkedin-post-1",
      }
    );

    const decision = parseAdaptiveOutreachDecision(
      {
        outcome: "continue",
        summary: "Answer the prospect's question on the same thread.",
        reasoning: "A direct answer is the natural next move.",
        strategy: {
          rationale: "Continue the live public conversation.",
          targetTweetId: "linkedin-post-1",
          valueProposition: "Explain the relevant workflow.",
          tone: "helpful",
        },
        tasks: [
          {
            type: "comment",
            description: "Answer the prospect's question.",
            timing: { type: "immediate", value: null },
            targetTweetId: null,
            targetCommentId: null,
            reactionType: null,
            content: "The live intent signal was the most useful part.",
          },
        ],
      },
      {
        channel: "linkedin_comment",
        responseMessageId: "comment-reply-1",
        responseText: "What part did you find most useful?",
        conversationId: "linkedin-post-1",
      }
    );
    const applied = await t.mutation(
      internal.adaptiveOutreach.applyAdaptiveOutreachDecisionInternal,
      {
        eventId: response.eventId as Id<"outreachInteractionEvents">,
        decision,
      }
    );

    const state = await t.run(async (ctx) => {
      const plan = await ctx.db.get(seeded.planId);
      const tasks = await ctx.db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", seeded.planId))
        .collect();
      const event = await ctx.db.get(
        response.eventId as Id<"outreachInteractionEvents">
      );
      const revision = await ctx.db
        .query("outreachPlanRevisions")
        .withIndex("by_plan_and_version", (q) =>
          q.eq("planId", seeded.planId).eq("version", 2)
        )
        .unique();
      return { event, plan, revision, tasks };
    });

    expect(applied).toMatchObject({
      applied: true,
      outcome: "continue",
      planVersion: 2,
    });
    expect(state.plan?.status).toBe("approved");
    expect(state.event).toMatchObject({
      status: "completed",
      decisionOutcome: "continue",
      appliedPlanVersion: 2,
    });
    expect(state.revision?.trigger).toMatchObject({
      kind: "interaction_replan",
      sourceEventKey:
        "outreach_interaction:" +
        `${seeded.prospectId}:linkedin_comment:comment-reply-1`,
    });
    const activeComment = state.tasks.find(
      (task) =>
        task.description === "Answer the prospect's question." &&
        task.supersededAt === undefined
    );
    expect(activeComment).toMatchObject({
      targetTweetId: "linkedin-post-1",
      targetCommentId: "comment-reply-1",
      planVersion: 2,
      status: "pending",
    });
  });

  test("rejects a stale decision after a newer interaction generation", async () => {
    const t = createAdaptiveTest();
    const seeded = await seedOutreach(t, "twitter");
    const response = await t.mutation(internal.outreach.onProspectResponse, {
      prospectId: seeded.prospectId,
      planId: seeded.planId,
      responseTweetId: "reply-1",
      responseText: "Tell me more.",
    });

    await t.run(async (ctx) => {
      const plan = await ctx.db.get(seeded.planId);
      await ctx.db.patch(seeded.planId, {
        executionGeneration: (plan?.executionGeneration ?? 0) + 1,
      });
    });

    const result = await t.mutation(
      internal.adaptiveOutreach.applyAdaptiveOutreachDecisionInternal,
      {
        eventId: response.eventId as Id<"outreachInteractionEvents">,
        decision: {
          outcome: "abandoned",
          summary: "Stop outreach.",
          reasoning: "A newer event should win.",
          tasks: [],
        },
      }
    );
    const state = await t.run(async (ctx) => ({
      event: await ctx.db.get(
        response.eventId as Id<"outreachInteractionEvents">
      ),
      plan: await ctx.db.get(seeded.planId),
    }));

    expect(result.applied).toBe(false);
    expect(state.event?.status).toBe("superseded");
    expect(state.plan?.status).toBe("paused");
    expect(state.plan?.version).toBe(1);
  });

  test("stores terminal decisions as a new immutable revision", async () => {
    const t = createAdaptiveTest();
    const seeded = await seedOutreach(t, "twitter");
    const response = await t.mutation(internal.outreach.onProspectDmResponse, {
      prospectId: seeded.prospectId,
      planId: seeded.planId,
      responseMessageId: "decline-1",
      responseText: "No thanks, please stop.",
      conversationId: "dm-1",
    });

    await t.mutation(
      internal.adaptiveOutreach.applyAdaptiveOutreachDecisionInternal,
      {
        eventId: response.eventId as Id<"outreachInteractionEvents">,
        decision: {
          outcome: "abandoned",
          summary: "The prospect asked to stop.",
          reasoning: "Respect the explicit opt-out.",
          tasks: [],
        },
      }
    );

    const state = await t.run(async (ctx) => {
      const plan = await ctx.db.get(seeded.planId);
      const revision = await ctx.db
        .query("outreachPlanRevisions")
        .withIndex("by_plan_and_version", (q) =>
          q.eq("planId", seeded.planId).eq("version", 2)
        )
        .unique();
      return { plan, revision };
    });

    expect(state.plan).toMatchObject({ status: "abandoned", version: 2 });
    expect(state.revision).toMatchObject({
      status: "abandoned",
      trigger: {
        kind: "interaction_replan",
        actor: "agent",
        reason: "The prospect asked to stop.",
        sourceEventKey:
          "outreach_interaction:" + `${seeded.prospectId}:twitter_dm:decline-1`,
        interactionChannel: "twitter_dm",
        responseMessageId: "decline-1",
      },
      tasks: [],
    });
  });
});
