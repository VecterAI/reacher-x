/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import type { WorkId } from "@convex-dev/workpool";
import { createThread, saveMessage } from "@convex-dev/agent";
import { describe, expect, test } from "vitest";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  consumeAgentThreadTargetSelection,
  upsertAgentThreadTargetSelection,
} from "./lib/agentThreadTargetSelectionHelpers";
import {
  createOutreachPlan,
  refinePlan as refineOutreachPlan,
} from "./lib/outreachCore";
import {
  buildScopedPlanBatchPrompt,
  resolvePlanBatchApplication,
  resolvePlanBatchTargetInstructions,
} from "./lib/planBatchCore";
import schema from "./schema";

type TaggedEntity = Doc<"agentMessageContexts">["taggedEntities"][number];
const modules = import.meta.glob("./**/*.ts");

async function registerWorkflowComponent(t: ReturnType<typeof convexTest>) {
  const testModulePath = ["@convex-dev/workflow", "test"].join("/");
  const workflowTest = (await import(testModulePath)) as {
    default: { register: (testInstance: typeof t) => void };
  };
  workflowTest.default.register(t);
}

async function registerAgentComponent(t: ReturnType<typeof convexTest>) {
  const testModulePath = ["@convex-dev/agent", "test"].join("/");
  const agentTest = (await import(testModulePath)) as {
    default: { register: (testInstance: typeof t) => void };
  };
  agentTest.default.register(t);
}

function createProspectTag(args: {
  prospectId: string;
  workspaceId: string;
  label: string;
  handle: string;
}): TaggedEntity {
  return {
    id: `prospect:${args.prospectId}`,
    entityId: args.prospectId,
    kind: "prospect",
    label: args.label,
    mentionText: args.label,
    secondaryLabel: `@${args.handle}`,
    verified: true,
    workspaceId: args.workspaceId,
    prospectId: args.prospectId,
    handle: args.handle,
  };
}

async function seedQualifiedProspect(
  t: ReturnType<typeof convexTest>,
  suffix: string
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `workos-${suffix}`,
      email: `${suffix}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Workspace ${suffix}`,
      description: "Test workspace",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: `external-${suffix}`,
      data: {},
      status: "new",
      qualificationStatus: "qualified",
      displayName: `Prospect ${suffix}`,
      updatedAt: 1,
    });
    return { userId, workspaceId, prospectId };
  });
}

async function insertRunningBatchItem(
  t: ReturnType<typeof convexTest>,
  args: {
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
    prospectId: Id<"prospects">;
    operation: "create" | "update";
    baselinePlanId?: Id<"outreachPlans">;
    baselinePlanVersion?: number;
  }
) {
  return await t.run(async (ctx) => {
    const runId = await ctx.db.insert("planBatchRuns", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      sourceThreadId: `thread-${String(args.prospectId)}`,
      operation: args.operation,
      scopeKind: "tagged",
      instruction: "Test the exact batch application.",
      attachments: [],
      confirmationRequired: false,
      status: "running",
      targetCount: 1,
      eligibleCount: 1,
      queuedCount: 0,
      runningCount: 1,
      succeededCount: 0,
      createdCount: 0,
      updatedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      selectionSkippedCount: 0,
      finishedCount: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    const itemId = await ctx.db.insert("planBatchItems", {
      runId,
      prospectId: args.prospectId,
      prospectName: `Prospect ${String(args.prospectId)}`,
      operation: args.operation,
      status: "running",
      baselinePlanId: args.baselinePlanId,
      baselinePlanVersion: args.baselinePlanVersion,
      attemptCount: 1,
      startedAt: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    return { runId, itemId };
  });
}

describe("plan batch durable state", () => {
  test("dispatches one tenant item atomically and ignores an idempotent replay", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedQualifiedProspect(t, "tenant-dispatch");
    const { runId, itemId } = await t.run(async (ctx) => {
      await ctx.db.insert("tenantSchedulerControls", {
        key: "global",
        mode: "enforced",
        slotCount: 36,
        baseSlotsPerTenant: 1,
        burstSlotsPerTenant: 30,
        leaseDurationMs: 2 * 60 * 60 * 1000,
        updatedAt: 1,
      });
      const runId = await ctx.db.insert("planBatchRuns", {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId: "tenant-dispatch-thread",
        operation: "create",
        scopeKind: "tagged",
        instruction: "Create the plan.",
        attachments: [],
        confirmationRequired: false,
        status: "queued",
        targetCount: 1,
        eligibleCount: 1,
        queuedCount: 0,
        runningCount: 0,
        succeededCount: 0,
        createdCount: 0,
        updatedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        selectionSkippedCount: 0,
        finishedCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      const itemId = await ctx.db.insert("planBatchItems", {
        runId,
        prospectId: seeded.prospectId,
        prospectName: "Prospect tenant-dispatch",
        operation: "create",
        status: "pending",
        attemptCount: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      return { runId, itemId };
    });

    expect(
      await t.mutation(internal.planBatches.dispatchPlanBatchItemInternal, {
        runId,
        itemId,
      })
    ).toEqual({ dispatched: true, status: "running" });
    expect(
      await t.mutation(internal.planBatches.dispatchPlanBatchItemInternal, {
        runId,
        itemId,
      })
    ).toEqual({ dispatched: false, status: "running" });

    const state = await t.run(async (ctx) => ({
      run: await ctx.db.get("planBatchRuns", runId),
      item: await ctx.db.get("planBatchItems", itemId),
      jobs: await ctx.db.query("tenantJobs").collect(),
    }));
    expect(state.run).toMatchObject({ status: "running", queuedCount: 1 });
    expect(state.item).toMatchObject({ status: "queued" });
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]).toMatchObject({
      idempotencyKey: `plan-batch-item:${String(itemId)}`,
      status: "queued",
    });
  });

  test("exposes terminal results for Agent continuation without appending hard-coded copy", async () => {
    const t = convexTest(schema, modules);
    await registerAgentComponent(t);
    const seeded = await seedQualifiedProspect(t, "completion-message");
    const { threadId, promptMessageId, runId } = await t.run(async (ctx) => {
      const threadId = await createThread(ctx, components.agent, {
        userId: seeded.userId,
      });
      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId,
        prompt: "Update the outreach plan.",
      });
      const runId = await ctx.db.insert("planBatchRuns", {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId: threadId,
        sourceMessageId: messageId,
        responsePromptMessageId: messageId,
        operation: "update",
        scopeKind: "named",
        instruction: "Update the outreach plan.",
        attachments: [],
        confirmationRequired: false,
        status: "completed",
        targetCount: 1,
        eligibleCount: 1,
        queuedCount: 0,
        runningCount: 0,
        succeededCount: 1,
        createdCount: 0,
        updatedCount: 1,
        failedCount: 0,
        skippedCount: 0,
        selectionSkippedCount: 0,
        finishedCount: 1,
        completedAt: 2,
        createdAt: 1,
        updatedAt: 2,
      });
      await ctx.db.insert("planBatchItems", {
        runId,
        prospectId: seeded.prospectId,
        prospectName: "Prospect completion-message",
        operation: "update",
        status: "succeeded",
        attemptCount: 1,
        completedAt: 2,
        createdAt: 1,
        updatedAt: 2,
      });
      return { threadId, promptMessageId: messageId, runId };
    });

    const responseContext = await t.query(
      internal.planBatches.getPlanBatchAgentResponseContextInternal,
      {
        runId,
      }
    );
    const claim = await t.mutation(
      internal.planBatches.claimPlanBatchAgentResponseInternal,
      {
        runId,
      }
    );
    const duplicateClaim = await t.mutation(
      internal.planBatches.claimPlanBatchAgentResponseInternal,
      {
        runId,
      }
    );

    const messagesBeforeAgentResponse = await t.run((ctx) =>
      ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
        threadId,
        order: "asc",
        paginationOpts: { numItems: 20, cursor: null },
      })
    );
    expect(
      messagesBeforeAgentResponse.page.some(
        (message) => message.message?.role === "assistant"
      )
    ).toBe(false);
    expect(responseContext?.result).toMatchObject({
      status: "completed",
      operation: "update",
      succeededCount: 1,
      updatedCount: 1,
      failedCount: 0,
    });
    expect(claim).toMatchObject({ shouldGenerate: true });
    expect(duplicateClaim).toMatchObject({
      startedAt: claim?.startedAt,
      shouldGenerate: false,
    });
    await t.mutation(internal.planBatches.failPlanBatchAgentResponseInternal, {
      runId,
      errorMessage: "Provider returned no text.",
    });
    const retryClaim = await t.mutation(
      internal.planBatches.claimPlanBatchAgentResponseInternal,
      {
        runId,
      }
    );
    expect(retryClaim).toMatchObject({
      startedAt: claim?.startedAt,
      shouldGenerate: true,
    });

    await t.run(async (ctx) => {
      await saveMessage(ctx, components.agent, {
        threadId,
        promptMessageId,
        agentName: "Main Agent",
        message: {
          role: "assistant",
          content: "I updated the outreach plan successfully.",
        },
      });
    });
    await t.mutation(
      internal.planBatches.completePlanBatchAgentResponseInternal,
      {
        runId,
      }
    );
    await t.mutation(
      internal.planBatches.reopenPlanBatchAgentResponseInternal,
      {
        runId,
        errorMessage: "Completion marker had no successful assistant response.",
      }
    );
    const reopenedClaim = await t.mutation(
      internal.planBatches.claimPlanBatchAgentResponseInternal,
      {
        runId,
      }
    );
    expect(reopenedClaim).toMatchObject({
      startedAt: claim?.startedAt,
      shouldGenerate: true,
    });
    await t.mutation(
      internal.planBatches.completePlanBatchAgentResponseInternal,
      {
        runId,
      }
    );

    const { run, messages } = await t.run(async (ctx) => ({
      run: await ctx.db.get("planBatchRuns", runId),
      messages: await ctx.runQuery(
        components.agent.messages.listMessagesByThreadId,
        {
          threadId,
          order: "asc",
          paginationOpts: { numItems: 20, cursor: null },
        }
      ),
    }));
    const promptMessage = messages.page.find(
      (message) => message._id === promptMessageId
    );
    const completionMessage = messages.page.find(
      (message) =>
        message.order === promptMessage?.order &&
        message.message?.role === "assistant"
    );

    expect(run?.agentResponseStartedAt).toBeTypeOf("number");
    expect(run?.agentResponseCompletedAt).toBeTypeOf("number");
    expect(completionMessage?.text).toBe(
      "I updated the outreach plan successfully."
    );
  });

  test("does not claim an Agent response for a non-terminal batch", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedQualifiedProspect(t, "pending-agent-response");
    const runId = await t.run((ctx) =>
      ctx.db.insert("planBatchRuns", {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        sourceThreadId: "workspace-pending-thread",
        sourceMessageId: "prompt-message",
        responsePromptMessageId: "prompt-message",
        operation: "update",
        scopeKind: "named",
        instruction: "Update the outreach plan.",
        attachments: [],
        confirmationRequired: false,
        status: "running",
        targetCount: 1,
        eligibleCount: 1,
        queuedCount: 0,
        runningCount: 1,
        succeededCount: 0,
        createdCount: 0,
        updatedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        selectionSkippedCount: 0,
        finishedCount: 0,
        createdAt: 1,
        updatedAt: 1,
      })
    );

    const claim = await t.mutation(
      internal.planBatches.claimPlanBatchAgentResponseInternal,
      {
        runId,
      }
    );
    expect(claim).toBeNull();
  });

  test("requires exact target names and keeps downstream prompts isolated", () => {
    const targets = [
      {
        prospectId: "prospect-1",
        label: "Nick LoPiccolo",
        handle: "nicklopiccolo",
      },
      {
        prospectId: "prospect-2",
        label: "Nick Johnston",
        handle: "nickjohnston",
      },
    ];

    expect(() =>
      resolvePlanBatchTargetInstructions({
        targets,
        instructions: [
          {
            prospectName: "Nick",
            instruction: "Reference the fundraising discussion.",
          },
        ],
      })
    ).toThrow("did not exactly match");
    expect(() =>
      resolvePlanBatchTargetInstructions({
        targets,
        instructions: [
          {
            prospectName: "@nicklopiccolo",
            instruction: "Reuse @nickjohnston's launch angle.",
          },
        ],
      })
    ).toThrow("contains Nick Johnston's details");

    const resolved = resolvePlanBatchTargetInstructions({
      targets,
      instructions: [
        {
          prospectName: "@nicklopiccolo",
          instruction: "Reference the fundraising discussion.",
        },
      ],
    });
    const prompt = buildScopedPlanBatchPrompt({
      prospectName: "Nick LoPiccolo",
      operation: "create",
      sharedInstruction: "Keep the outreach concise.",
      targetInstruction: resolved.get("prospect-1"),
      attachments: [],
    });
    expect(prompt).toContain("Nick LoPiccolo");
    expect(prompt).toContain("fundraising discussion");
    expect(prompt).not.toContain("Nick Johnston");
  });

  test("consumes only the exact pending selection and clears invalid replacements", async () => {
    const t = convexTest(schema, modules);
    const first = await seedQualifiedProspect(t, "first");
    const second = await t.run(async (ctx) => {
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId: first.workspaceId,
        userId: first.userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "external-second",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        displayName: "Prospect second",
        updatedAt: 2,
      });
      return prospectId;
    });

    await t.run(async (ctx) => {
      await upsertAgentThreadTargetSelection(ctx, {
        threadId: "thread-selection",
        userId: first.userId,
        workspaceId: first.workspaceId,
        sourceMessageId: "message-first",
        sourceContextCreatedAt: 1,
        taggedEntities: [
          createProspectTag({
            prospectId: String(first.prospectId),
            workspaceId: String(first.workspaceId),
            label: "Prospect first",
            handle: "first",
          }),
        ],
      });
      await upsertAgentThreadTargetSelection(ctx, {
        threadId: "thread-selection",
        userId: first.userId,
        workspaceId: first.workspaceId,
        sourceMessageId: "message-second",
        sourceContextCreatedAt: 2,
        taggedEntities: [
          createProspectTag({
            prospectId: String(second),
            workspaceId: String(first.workspaceId),
            label: "Prospect second",
            handle: "second",
          }),
        ],
      });
    });

    expect(
      await t.run(async (ctx) =>
        consumeAgentThreadTargetSelection(ctx, {
          threadId: "thread-selection",
          userId: first.userId,
          workspaceId: first.workspaceId,
          sourceMessageId: "message-first",
        })
      )
    ).toBe(false);
    expect(
      await t.run(async (ctx) =>
        consumeAgentThreadTargetSelection(ctx, {
          threadId: "thread-selection",
          userId: first.userId,
          workspaceId: first.workspaceId,
          sourceMessageId: "message-second",
        })
      )
    ).toBe(true);

    await t.run(async (ctx) => {
      await upsertAgentThreadTargetSelection(ctx, {
        threadId: "thread-selection",
        userId: first.userId,
        workspaceId: first.workspaceId,
        sourceMessageId: "message-third",
        sourceContextCreatedAt: 3,
        taggedEntities: [
          createProspectTag({
            prospectId: String(first.prospectId),
            workspaceId: String(first.workspaceId),
            label: "Prospect first",
            handle: "first",
          }),
        ],
      });
      await upsertAgentThreadTargetSelection(ctx, {
        threadId: "thread-selection",
        userId: first.userId,
        workspaceId: first.workspaceId,
        sourceMessageId: "message-invalid",
        sourceContextCreatedAt: 4,
        taggedEntities: [
          createProspectTag({
            prospectId: "not-a-convex-id",
            workspaceId: String(first.workspaceId),
            label: "Unavailable prospect",
            handle: "unavailable",
          }),
        ],
      });
    });

    const selection = await t.run(async (ctx) =>
      ctx.db
        .query("agentThreadTargetSelections")
        .withIndex("by_thread", (q) => q.eq("threadId", "thread-selection"))
        .unique()
    );
    expect(selection).toBeNull();
  });

  test("updates a referenced plan group with its original attachment", async () => {
    const t = convexTest(schema, modules);
    await registerWorkflowComponent(t);
    const first = await seedQualifiedProspect(t, "follow-up-first");
    const second = await t.run(async (ctx) => {
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId: first.workspaceId,
        userId: first.userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "external-follow-up-second",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        displayName: "Prospect follow-up-second",
        updatedAt: 1,
      });
      return { ...first, prospectId };
    });
    const sourceThreadId = "workspace-follow-up-thread";
    const sourceReference = "plans_0123456789abcdef";

    const [firstPlanId, secondPlanId] = await t.run(async (ctx) =>
      Promise.all(
        [first, second].map((seeded, index) =>
          createOutreachPlan(ctx, {
            prospectId: seeded.prospectId,
            workspaceId: seeded.workspaceId,
            userId: seeded.userId,
            strategy: {
              rationale: `Existing plan ${index + 1}`,
              valueProposition: "Useful context",
              tone: "peer",
            },
            tasks: [
              {
                type: "dm",
                description: "Send the current message",
                content: "Existing outreach",
                timing: { type: "immediate" },
              },
            ],
            threadId: `prospect-thread-${index + 1}`,
          })
        )
      )
    );

    const storedDemoId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["demo"], { type: "video/mp4" }))
    );
    const { sourceRunId, expectedDemoUrl } = await t.run(async (ctx) => {
      const expectedDemoUrl = await ctx.storage.getUrl(storedDemoId);
      if (!expectedDemoUrl) {
        throw new Error("Stored demo URL was not created.");
      }
      const runId = await ctx.db.insert("planBatchRuns", {
        workspaceId: first.workspaceId,
        userId: first.userId,
        sourceThreadId,
        referenceKey: sourceReference,
        operation: "create",
        scopeKind: "tagged",
        instruction: "Create the plans.",
        attachments: [
          {
            fileName: "demo.mp4",
            mediaKind: "video",
            url: expectedDemoUrl,
          },
        ],
        confirmationRequired: false,
        status: "completed",
        targetCount: 2,
        eligibleCount: 2,
        queuedCount: 0,
        runningCount: 0,
        succeededCount: 2,
        createdCount: 2,
        updatedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        selectionSkippedCount: 0,
        finishedCount: 2,
        completedAt: 2,
        createdAt: 1,
        updatedAt: 2,
      });
      await Promise.all([
        ctx.db.insert("planBatchItems", {
          runId,
          prospectId: first.prospectId,
          prospectName: "Prospect follow-up-first",
          operation: "create",
          status: "succeeded",
          planId: firstPlanId,
          attemptCount: 1,
          completedAt: 2,
          createdAt: 1,
          updatedAt: 2,
        }),
        ctx.db.insert("planBatchItems", {
          runId,
          prospectId: second.prospectId,
          prospectName: "Prospect follow-up-second",
          operation: "create",
          status: "succeeded",
          planId: secondPlanId,
          attemptCount: 1,
          completedAt: 2,
          createdAt: 1,
          updatedAt: 2,
        }),
        ctx.db.insert("agentMessageContexts", {
          threadId: sourceThreadId,
          messageId: "follow-up-message",
          userId: first.userId,
          workspaceId: first.workspaceId,
          promptTextSource: "user",
          taggedEntities: [],
          attachments: [],
          createdAt: 3,
        }),
      ]);
      return { sourceRunId: runId, expectedDemoUrl };
    });

    await expect(
      t.mutation(internal.planBatches.createPlanBatchRunInternal, {
        workspaceId: first.workspaceId,
        userId: first.userId,
        sourceThreadId: "different-workspace-thread",
        operation: "update",
        scopeKind: "plan_group",
        sourcePlanBatchReference: sourceReference,
        namedTargets: [],
        instruction: "Update those plans.",
        perProspectInstructions: [],
      })
    ).rejects.toThrow(/not available in this conversation/);

    const created = await t.mutation(
      internal.planBatches.createPlanBatchRunInternal,
      {
        workspaceId: first.workspaceId,
        userId: first.userId,
        sourceThreadId,
        sourceMessageId: "follow-up-message",
        sourcePrompt:
          "Keep the current demo attached and update the plans naturally.",
        operation: "update",
        scopeKind: "plan_group",
        sourcePlanBatchReference: sourceReference,
        namedTargets: [],
        instruction: "Attach the current demo to the pending DM tasks.",
        perProspectInstructions: [],
      }
    );
    const run = await t.run(async (ctx) =>
      ctx.db.get("planBatchRuns", created.runId)
    );
    expect(run?.sourcePlanBatchRunId).toBe(sourceRunId);
    expect(run?.sourceMessageId).toBe("follow-up-message");
    expect(run?.sourcePrompt).toBe(
      "Keep the current demo attached and update the plans naturally."
    );
    expect(run?.attachments).toEqual([
      {
        fileName: "demo.mp4",
        mediaKind: "video",
        url: expectedDemoUrl,
      },
    ]);

    await t.mutation(internal.planBatches.selectPlanBatchTargetsPage, {
      runId: created.runId,
    });
    const [selectedRun, selectedItems] = await t.run(async (ctx) => {
      const selected = await ctx.db
        .query("planBatchItems")
        .withIndex("by_run_and_status", (q) => q.eq("runId", created.runId))
        .collect();
      return [await ctx.db.get("planBatchRuns", created.runId), selected];
    });
    expect(selectedRun?.status).toBe("queued");
    expect(selectedItems).toHaveLength(2);
    expect(selectedItems.every((item) => item.operation === "update")).toBe(
      true
    );
  });

  test("records create and update provenance in the same plan transaction", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedQualifiedProspect(t, "provenance");
    const createBatch = await insertRunningBatchItem(t, {
      ...seeded,
      operation: "create",
    });

    const planId = await t.run(async (ctx) =>
      createOutreachPlan(ctx, {
        prospectId: seeded.prospectId,
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        strategy: {
          rationale: "Start with a relevant conversation.",
          valueProposition: "Useful context",
          tone: "peer",
        },
        tasks: [
          {
            type: "wait",
            description: "Wait before following up",
            timing: { type: "delay", value: "1 day" },
          },
        ],
        threadId: "prospect-thread",
        planBatchItemId: createBatch.itemId,
      })
    );

    const createdItem = await t.run(async (ctx) =>
      ctx.db.get("planBatchItems", createBatch.itemId)
    );
    expect(createdItem?.appliedPlanId).toBe(planId);
    expect(createdItem?.appliedPlanVersion).toBe(1);
    await t.mutation(internal.planBatches.handlePlanBatchItemComplete, {
      workId: "create-work" as WorkId,
      context: {
        runId: createBatch.runId,
        itemId: createBatch.itemId,
      },
      result: {
        kind: "success",
        returnValue: {
          outcome: "succeeded",
          planId,
          threadId: "prospect-thread",
        },
      },
    });
    const completedCreateRun = await t.run(async (ctx) =>
      ctx.db.get("planBatchRuns", createBatch.runId)
    );
    expect(completedCreateRun?.createdCount).toBe(1);
    expect(completedCreateRun?.updatedCount).toBe(0);

    const updateBatch = await insertRunningBatchItem(t, {
      ...seeded,
      operation: "update",
      baselinePlanId: planId,
      baselinePlanVersion: 1,
    });
    await t.run(async (ctx) =>
      refineOutreachPlan(ctx, planId, {
        strategy: {
          rationale: "Use a shorter, sharper opener.",
          valueProposition: "Useful context",
          tone: "peer",
        },
        planBatchItemId: updateBatch.itemId,
      })
    );

    const [updatedItem, updatedPlan] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get("planBatchItems", updateBatch.itemId),
        ctx.db.get("outreachPlans", planId),
      ])
    );
    expect(updatedItem?.appliedPlanId).toBe(planId);
    expect(updatedItem?.appliedPlanVersion).toBe(2);
    expect(updatedPlan?.version).toBe(2);
    await t.mutation(internal.planBatches.handlePlanBatchItemComplete, {
      workId: "update-work" as WorkId,
      context: {
        runId: updateBatch.runId,
        itemId: updateBatch.itemId,
      },
      result: {
        kind: "success",
        returnValue: {
          outcome: "succeeded",
          planId,
          threadId: "prospect-thread",
        },
      },
    });
    const completedUpdateRun = await t.run(async (ctx) =>
      ctx.db.get("planBatchRuns", updateBatch.runId)
    );
    expect(completedUpdateRun?.createdCount).toBe(0);
    expect(completedUpdateRun?.updatedCount).toBe(1);

    expect(
      resolvePlanBatchApplication({
        operation: "update",
        activePlan: { id: String(planId), version: 2 },
        baselinePlanId: String(planId),
        baselinePlanVersion: 1,
        appliedPlanId: String(updatedItem?.appliedPlanId),
        appliedPlanVersion: updatedItem?.appliedPlanVersion,
      })
    ).toEqual({ outcome: "succeeded", planId: String(planId) });
    expect(
      resolvePlanBatchApplication({
        operation: "update",
        activePlan: { id: String(planId), version: 2 },
        baselinePlanId: String(planId),
        baselinePlanVersion: 1,
      })
    ).toEqual({ outcome: "skipped", reason: "plan_changed" });
  });

  test("rolls plan creation back when the batch item belongs to another prospect", async () => {
    const t = convexTest(schema, modules);
    const first = await seedQualifiedProspect(t, "owner");
    const secondProspectId = await t.run(async (ctx) =>
      ctx.db.insert("prospects", {
        workspaceId: first.workspaceId,
        userId: first.userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "external-other",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        displayName: "Other prospect",
        updatedAt: 1,
      })
    );
    const batch = await insertRunningBatchItem(t, {
      ...first,
      operation: "create",
    });

    await expect(
      t.run(async (ctx) =>
        createOutreachPlan(ctx, {
          prospectId: secondProspectId,
          workspaceId: first.workspaceId,
          userId: first.userId,
          strategy: {
            rationale: "Test rollback.",
            valueProposition: "Useful context",
            tone: "peer",
          },
          tasks: [
            {
              type: "wait",
              description: "Wait",
              timing: { type: "delay", value: "1 day" },
            },
          ],
          planBatchItemId: batch.itemId,
        })
      )
    ).rejects.toThrow("Plan batch item context is no longer valid");

    const activePlans = await t.run(async (ctx) =>
      ctx.db
        .query("outreachPlans")
        .withIndex("by_prospect", (q) => q.eq("prospectId", secondProspectId))
        .collect()
    );
    expect(activePlans).toEqual([]);
  });
});
