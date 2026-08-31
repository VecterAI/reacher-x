/// <reference types="vite/client" />

import { createThread, saveMessage } from "@convex-dev/agent";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, components } from "./_generated/api";
import { computeUsageCycleWindow } from "./lib/planCycleUtils";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

vi.stubEnv("OPENAI_API_KEY", "workspace-deletion-test-key");

async function registerComponents(t: ReturnType<typeof convexTest>) {
  const workflowTestPath = ["@convex-dev/workflow", "test"].join("/");
  const workflowTest = (await import(workflowTestPath)) as {
    default: { register: (instance: typeof t) => void };
  };
  workflowTest.default.register(t);

  const agentTestPath = ["@convex-dev/agent", "test"].join("/");
  const agentTest = (await import(agentTestPath)) as {
    default: { register: (instance: typeof t) => void };
  };
  agentTest.default.register(t);

  const ragTestPath = ["@convex-dev/rag", "test"].join("/");
  const ragTest = (await import(ragTestPath)) as {
    default: { register: (instance: typeof t) => void };
  };
  ragTest.default.register(t);

  const polarTestPath = ["@convex-dev/polar", "test"].join("/");
  const polarTest = (await import(polarTestPath)) as {
    default: { register: (instance: typeof t) => void };
  };
  polarTest.default.register(t);
}

describe("durable workspace deletion", () => {
  test("deduplicates requests, deletes bounded children, and reconciles plan usage", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerComponents(t);
    const now = Date.now();
    const currentWindow = computeUsageCycleWindow({
      now,
      tier: "pro",
      subscription: null,
    });
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "workspace-delete-owner",
        email: "delete-owner@example.com",
      });
      await ctx.db.insert("userPlans", {
        userId,
        tier: "pro",
        prospectsLimit: 500,
        workspacesLimit: 10,
        currentProspectsCount: 3,
        currentProspectsCycleStart: currentWindow.cycleStart,
        currentProspectsCycleEnd: currentWindow.cycleEnd,
        updatedAt: 1,
      });
      const usageCycleId = await ctx.db.insert("planUsageCycles", {
        userId,
        tier: "pro",
        cycleStart: currentWindow.cycleStart,
        cycleEnd: currentWindow.cycleEnd,
        prospectsUsed: 3,
        prospectsLimit: 500,
        workspacesUsed: 2,
        workspacesLimit: 10,
        isCurrent: true,
        updatedAt: 1,
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Delete me",
        description:
          "A workspace with enough rows to require multiple batches.",
        isDefault: true,
        setupCompletedAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("workspaceReportingRollouts", {
        workspaceId,
        userId,
        status: "verified",
        aggregateVersion: 1,
        revision: 1,
        stage: "verifyAgentOpsStripes",
        batchSize: 5,
        backfilledCount: 0,
        verifiedSourceCount: 0,
        expectedAnalyticsSums: [],
        expectedAgentOpsSums: [],
        expectedQualifiedUsageCount: 0,
        startedAt: 1,
        verifiedAt: 1,
        updatedAt: 1,
      });
      const replacementId = await ctx.db.insert("workspaces", {
        userId,
        name: "Keep me",
        description: "The fallback workspace.",
        isDefault: false,
        setupCompletedAt: 1,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "delete-prospect",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        qualifiedAt: now,
        updatedAt: 1,
      });
      const prospect = await ctx.db.get("prospects", prospectId);
      if (!prospect) throw new Error("Failed to seed deleting prospect");
      await ctx.db.insert(
        "prospectSummaries",
        buildProspectSummaryRecord(prospect)
      );
      const remainingProspectId = await ctx.db.insert("prospects", {
        workspaceId: replacementId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "remaining-prospect",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        qualifiedAt: now,
        updatedAt: 1,
      });
      const remainingProspect = await ctx.db.get(
        "prospects",
        remainingProspectId
      );
      if (!remainingProspect) {
        throw new Error("Failed to seed remaining prospect");
      }
      await ctx.db.insert(
        "prospectSummaries",
        buildProspectSummaryRecord(remainingProspect)
      );
      for (let index = 0; index < 31; index += 1) {
        await ctx.db.insert("keywords", {
          workspaceId,
          type: "seed",
          value: `keyword-${index}`,
        });
      }
      const planId = await ctx.db.insert("outreachPlans", {
        prospectId,
        workspaceId,
        userId,
        status: "draft",
        strategy: {
          rationale: "Test bounded deletion.",
          valueProposition: "A useful observation.",
          tone: "peer",
        },
        version: 1,
        updatedAt: 1,
      });
      for (let index = 0; index < 31; index += 1) {
        await ctx.db.insert("outreachTasks", {
          planId,
          order: index + 1,
          type: "dm",
          description: `Task ${index}`,
          status: "pending",
          timing: { type: "immediate" },
        });
      }
      const threadId = await createThread(ctx, components.agent, {
        userId: String(userId),
        title: `workspace:${String(workspaceId)}`,
      });
      await saveMessage(ctx, components.agent, {
        threadId,
        prompt: "This message must be deleted with its workspace.",
      });
      await ctx.db.insert("workspaceAgentThreads", {
        workspaceId,
        userId,
        threadId,
        threadStatus: "active",
      });
      const setupSessionId = await ctx.db.insert("workspaceSetupSessions", {
        userId,
        mode: "new_workspace",
        status: "ready",
        setupThreadId: "setup-delete",
        useCaseKey: "general_outreach",
        draftOrdinal: 1,
        existingWorkspaceId: workspaceId,
        targetWorkspaceId: workspaceId,
        previewProspectIds: [prospectId],
        statusUpdatedAt: 1,
      });
      return {
        planId,
        prospectId,
        remainingProspectId,
        replacementId,
        setupSessionId,
        threadId,
        usageCycleId,
        userId,
        workspaceId,
      };
    });
    const authenticated = t.withIdentity({ subject: "workspace-delete-owner" });

    const first = await authenticated.mutation(api.workspaces.deleteWorkspace, {
      workspaceId: seeded.workspaceId,
    });
    const firstMarker = await t.run((ctx) =>
      ctx.db.get("workspaces", seeded.workspaceId)
    );
    const second = await authenticated.mutation(
      api.workspaces.deleteWorkspace,
      {
        workspaceId: seeded.workspaceId,
      }
    );
    const secondMarker = await t.run((ctx) =>
      ctx.db.get("workspaces", seeded.workspaceId)
    );

    expect(first).toEqual({
      wasLastWorkspace: false,
      newDefaultWorkspaceId: seeded.replacementId,
    });
    expect(second).toEqual(first);
    expect(firstMarker?.deletionWorkflowId).toBeTruthy();
    expect(secondMarker?.deletionWorkflowId).toBe(
      firstMarker?.deletionWorkflowId
    );
    expect(secondMarker?.isDefault).toBe(false);

    const [shellDuringDeletion, deletionsDuringWorkflow] = await Promise.all([
      authenticated.query(api.shell.getAppShellState, {
        preferredContext: "workspace",
      }),
      authenticated.query(api.workspaces.getWorkspaceDeletions, {}),
    ]);
    expect(
      shellDuringDeletion.switcherItems.some(
        (item) => item.kind === "workspace" && item.value === seeded.workspaceId
      )
    ).toBe(false);
    expect(shellDuringDeletion.showUnlockCta).toBe(false);
    expect(deletionsDuringWorkflow).toEqual([
      {
        workspaceId: seeded.workspaceId,
        workspaceName: "Delete me",
        status: "deleting",
      },
    ]);

    await (
      t.finishAllScheduledFunctions as unknown as (
        advanceTimers: () => void,
        maxIterations: number
      ) => Promise<void>
    )(vi.runAllTimers, 1_000);

    const state = await t.run(async (ctx) => ({
      workspace: await ctx.db.get("workspaces", seeded.workspaceId),
      reportingRollout: await ctx.db
        .query("workspaceReportingRollouts")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .unique(),
      replacement: await ctx.db.get("workspaces", seeded.replacementId),
      plan: await ctx.db.get("outreachPlans", seeded.planId),
      prospect: await ctx.db.get("prospects", seeded.prospectId),
      setupSession: await ctx.db.get(
        "workspaceSetupSessions",
        seeded.setupSessionId
      ),
      userPlan: await ctx.db
        .query("userPlans")
        .withIndex("by_user", (q) => q.eq("userId", seeded.userId))
        .unique(),
      usageCycle: await ctx.db.get("planUsageCycles", seeded.usageCycleId),
      remainingProspect: await ctx.db.get(
        "prospects",
        seeded.remainingProspectId
      ),
      keywords: await ctx.db
        .query("keywords")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", seeded.workspaceId)
        )
        .take(1),
    }));
    const componentThread = await t.query(components.agent.threads.getThread, {
      threadId: seeded.threadId,
    });
    const deletionsAfterWorkflow = await authenticated.query(
      api.workspaces.getWorkspaceDeletions,
      {}
    );

    expect(state.workspace).toBeNull();
    expect(state.reportingRollout).toBeNull();
    expect(state.replacement?.isDefault).toBe(true);
    expect(state.plan).toBeNull();
    expect(state.prospect).toBeNull();
    expect(state.keywords).toHaveLength(0);
    expect(state.setupSession?.existingWorkspaceId).toBeUndefined();
    expect(state.setupSession?.targetWorkspaceId).toBeUndefined();
    expect(state.setupSession?.previewProspectIds).toBeUndefined();
    expect(state.userPlan?.currentProspectsCount).toBe(1);
    expect(state.userPlan?.currentProspectsCycleStart).toBe(
      currentWindow.cycleStart
    );
    expect(state.userPlan?.currentProspectsCycleEnd).toBe(
      currentWindow.cycleEnd
    );
    expect(state.usageCycle).toMatchObject({
      prospectsUsed: 1,
      workspacesUsed: 1,
      isCurrent: true,
    });
    expect(state.remainingProspect?.workspaceId).toBe(seeded.replacementId);
    expect(componentThread).toBeNull();
    expect(deletionsAfterWorkflow).toEqual([]);
    vi.useRealTimers();
  }, 30_000);

  test("preserves ownership authorization", async () => {
    const t = convexTest(schema, modules);
    await registerComponents(t);
    const workspaceId = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        workosUserId: "workspace-delete-real-owner",
        email: "real-owner@example.com",
      });
      await ctx.db.insert("users", {
        workosUserId: "workspace-delete-outsider",
        email: "outsider@example.com",
      });
      return await ctx.db.insert("workspaces", {
        userId: ownerId,
        name: "Private workspace",
        description: "Only the owner can delete this.",
        isDefault: true,
        updatedAt: 1,
      });
    });

    await expect(
      t
        .withIdentity({ subject: "workspace-delete-outsider" })
        .mutation(api.workspaces.deleteWorkspace, { workspaceId })
    ).rejects.toThrow("Not authorized");
    expect(
      await t.run((ctx) => ctx.db.get("workspaces", workspaceId))
    ).not.toBeNull();
  });
});
