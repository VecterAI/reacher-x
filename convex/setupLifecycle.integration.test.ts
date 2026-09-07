/// <reference types="vite/client" />

import { finishScheduledBatches } from "../test/finishScheduledBatches";
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import type { WorkflowId } from "@convex-dev/workflow";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { X_CORE_SCOPES } from "./lib/xScopes";
import { buildLegacyWorkspaceTargetingSpec } from "./lib/targetingSpecCore";
import { workflow } from "./lib/workflow";

const modules = import.meta.glob("./**/*.ts");

async function registerWorkflowComponent(t: ReturnType<typeof convexTest>) {
  const workflowTestPath = ["@convex-dev/workflow", "test"].join("/");
  const workflowTest = (await import(workflowTestPath)) as {
    default: { register: (instance: typeof t) => void };
  };
  workflowTest.default.register(t);
}

import { syntheticExamples } from "../test/syntheticProfiles";

const setupProfiles = [
  {
    syntheticExamples,
    syntheticPosts: ["Redesigning a complex workflow this week."],
    qualificationKeywords: ["product design"],
    title: "Senior product designers",
    description: "Experienced B2B SaaS product designers.",
    painPoints: ["Hard-to-use workflows"],
    channels: ["LinkedIn"],
  },
];

async function seedUser(t: ReturnType<typeof convexTest>, suffix: string) {
  return await t.run(async (ctx) => {
    const workosUserId = `setup-lifecycle-${suffix}`;
    const userId = await ctx.db.insert("users", {
      workosUserId,
      email: `${suffix}@example.com`,
    });
    await ctx.db.insert("userPlans", {
      userId,
      tier: "pro",
      prospectsLimit: 500,
      workspacesLimit: 10,
      currentProspectsCount: 0,
      updatedAt: 1,
    });
    return { userId, workosUserId };
  });
}

async function seedCompletedWorkspace(
  t: ReturnType<typeof convexTest>,
  args: {
    userId: Id<"users">;
    name: string;
    isDefault: boolean;
    entitlementSlot: number;
  }
) {
  return await t.run((ctx) =>
    ctx.db.insert("workspaces", {
      userId: args.userId,
      name: args.name,
      description: `Find people for ${args.name}.`,
      improvedDescription: `Find qualified people for ${args.name}.`,
      icps: setupProfiles,
      useCaseKey: "general_outreach",
      setupCompletedAt: 10,
      isDefault: args.isDefault,
      entitlementSlot: args.entitlementSlot,
      updatedAt: 10,
    })
  );
}

async function seedProvisionalWorkspace(
  t: ReturnType<typeof convexTest>,
  args: { userId: Id<"users">; entitlementSlot: number }
) {
  return await t.run((ctx) =>
    ctx.db.insert("workspaces", {
      userId: args.userId,
      name: "Provisioned draft",
      description: "Find qualified product designers.",
      improvedDescription: "Find qualified product designers.",
      icps: setupProfiles,
      useCaseKey: "general_outreach",
      isDefault: false,
      entitlementSlot: args.entitlementSlot,
      updatedAt: 20,
    })
  );
}

async function seedSetupSession(
  t: ReturnType<typeof convexTest>,
  args: {
    userId: Id<"users">;
    mode?: "first_workspace" | "new_workspace";
    status?:
      | "awaiting_input"
      | "awaiting_icp_confirmation"
      | "awaiting_preview_confirmation"
      | "awaiting_connections"
      | "awaiting_plan";
    targetWorkspaceId?: Id<"workspaces">;
    entitlementSlot?: number;
    refineFromWorkspace?: boolean;
    setupThreadId?: string;
    suffix: string;
  }
) {
  return await t.run((ctx) =>
    ctx.db.insert("workspaceSetupSessions", {
      userId: args.userId,
      flowVersion: 2,
      generationRevision: 1,
      approvedGenerationRevision: [
        "awaiting_connections",
        "awaiting_plan",
      ].includes(args.status ?? "")
        ? 1
        : undefined,
      mode: args.mode ?? "new_workspace",
      status: args.status ?? "awaiting_input",
      setupThreadId: args.setupThreadId ?? `setup-thread-${args.suffix}`,
      useCaseKey: "general_outreach",
      draftOrdinal: 1,
      draftName: "Draft workspace",
      rawUserDescription: "Find qualified product designers.",
      seedDescription: "Find qualified product designers.",
      improvedDescription: "Find qualified product designers.",
      generatedProfiles: setupProfiles,
      targetWorkspaceId: args.targetWorkspaceId,
      entitlementSlot: args.entitlementSlot ?? 2,
      refineFromWorkspace: args.refineFromWorkspace,
      statusUpdatedAt: 20,
      lastActiveAt: 20,
    })
  );
}

describe("setup session and workspace lifecycle", () => {
  afterEach(() => vi.useRealTimers());
  test("deletes large preview sets through bounded scheduled batches", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const { userId } = await seedUser(t, "bounded-preview-cleanup");
      const workspaceId = await seedProvisionalWorkspace(t, {
        userId,
        entitlementSlot: 2,
      });
      const sessionId = await seedSetupSession(t, {
        userId,
        targetWorkspaceId: workspaceId,
        suffix: "bounded-preview-cleanup",
      });

      await t.run(async (ctx) => {
        for (let index = 0; index < 9; index += 1) {
          await ctx.db.insert("prospects", {
            userId,
            workspaceId,
            platform: "twitter",
            externalId: `preview-post-${index}`,
            data: { payload: "x".repeat(10_000) },
            status: "new",
            qualificationStatus: "pending",
            origin: "setup_preview",
            setupSessionId: sessionId,
            setupRevision: 1,
            updatedAt: index + 1,
          });
        }
      });

      const firstBatch = await t.mutation(
        internal.prospects.deletePreviewProspectsForSessionRevisionInternal,
        { sessionId }
      );
      expect(firstBatch).toEqual({ deleted: 4, done: false });

      await finishScheduledBatches(t);
      const remaining = await t.run((ctx) =>
        ctx.db
          .query("prospects")
          .withIndex("by_setup_session", (q) =>
            q.eq("setupSessionId", sessionId)
          )
          .collect()
      );
      expect(remaining).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test("recovers a stale setup workflow and exposes a bounded retry failure", async () => {
    const t = convexTest(schema, modules);
    await registerWorkflowComponent(t);
    const { userId, workosUserId } = await seedUser(t, "workflow-recovery");
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "workflow-recovery",
    });
    const authenticated = t.withIdentity({ subject: workosUserId });

    const started = await authenticated.mutation(
      api.setupSessions.ensureSetupSessionWorkflow,
      { threadId: "setup-thread-workflow-recovery" }
    );
    expect(started).toMatchObject({
      scheduled: true,
      recovered: false,
      state: "started",
    });
    const originalWorkflowId = await t.run(
      async (ctx) =>
        (await ctx.db.get("workspaceSetupSessions", sessionId))?.workflowId
    );
    expect(originalWorkflowId).toBeTruthy();

    await t.run(async (ctx) => {
      await ctx.db.patch("workspaceSetupSessions", sessionId, {
        status: "generating_profiles",
        statusUpdatedAt: 1,
        generationRequestedAt: 1,
      });
    });
    const recovered = await authenticated.mutation(
      api.setupSessions.ensureSetupSessionWorkflow,
      { threadId: "setup-thread-workflow-recovery" }
    );
    expect(recovered).toMatchObject({
      scheduled: true,
      recovered: true,
      state: "recovered",
    });
    const recoveredSession = await t.run((ctx) =>
      ctx.db.get("workspaceSetupSessions", sessionId)
    );
    expect(recoveredSession?.workflowId).not.toBe(originalWorkflowId);
    expect(recoveredSession?.workflowRecoveryAttempts).toBe(1);

    await t.run(async (ctx) => {
      await ctx.db.patch("workspaceSetupSessions", sessionId, {
        workflowRecoveryAttempts: 3,
        statusUpdatedAt: 1,
        generationRequestedAt: 1,
      });
    });
    const exhausted = await authenticated.mutation(
      api.setupSessions.ensureSetupSessionWorkflow,
      { threadId: "setup-thread-workflow-recovery" }
    );
    expect(exhausted.state).toBe("failed");
    expect(
      await t.run((ctx) => ctx.db.get("workspaceSetupSessions", sessionId))
    ).toMatchObject({
      status: "failed",
      errorCode: "setup_workflow_recovery_exhausted",
    });
  });

  test("recovers stale setup work even when the setup UI is no longer open", async () => {
    const t = convexTest(schema, modules);
    await registerWorkflowComponent(t);
    const { userId, workosUserId } = await seedUser(
      t,
      "background-workflow-recovery"
    );
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "background-workflow-recovery",
    });
    const authenticated = t.withIdentity({ subject: workosUserId });
    await authenticated.mutation(api.setupSessions.ensureSetupSessionWorkflow, {
      threadId: "setup-thread-background-workflow-recovery",
    });
    const originalWorkflowId = await t.run(
      async (ctx) =>
        (await ctx.db.get("workspaceSetupSessions", sessionId))?.workflowId
    );
    await t.run(async (ctx) => {
      await ctx.db.patch("workspaceSetupSessions", sessionId, {
        status: "generating_profiles",
        statusUpdatedAt: 1,
        generationRequestedAt: 1,
      });
    });

    const result = await t.mutation(
      internal.setupSessions.recoverStaleSetupWorkflowsInternal,
      {}
    );
    expect(result).toEqual({ checked: 1, recovered: 1, failed: 0 });
    expect(
      await t.run((ctx) => ctx.db.get("workspaceSetupSessions", sessionId))
    ).toMatchObject({
      workflowRecoveryAttempts: 1,
      status: "generating_profiles",
    });
    expect(
      await t.run(
        async (ctx) =>
          (await ctx.db.get("workspaceSetupSessions", sessionId))?.workflowId
      )
    ).not.toBe(originalWorkflowId);
  });

  test("excludes legacy refine sessions without hiding normal active setup", async () => {
    const t = convexTest(schema, modules);
    const { userId, workosUserId } = await seedUser(t, "legacy-refine");
    await seedSetupSession(t, {
      userId,
      suffix: "legacy-refine",
      refineFromWorkspace: true,
    });
    const authenticated = t.withIdentity({ subject: workosUserId });

    expect(
      await authenticated.query(api.setupSessions.getActiveSetupSession)
    ).toBeNull();

    const activeSessionId = await seedSetupSession(t, {
      userId,
      suffix: "normal-active",
    });
    const activeSession = await authenticated.query(
      api.setupSessions.getActiveSetupSession
    );

    expect(activeSession?.sessionId).toBe(activeSessionId);
  });

  test.each(["awaiting_connections", "awaiting_plan"] as const)(
    "legacy refinement cannot provision a completed workspace through %s",
    async (status) => {
      const t = convexTest(schema, modules);
      const { userId, workosUserId } = await seedUser(t, `refine-${status}`);
      const workspaceId = await seedCompletedWorkspace(t, {
        userId,
        name: "Keep existing",
        isDefault: true,
        entitlementSlot: 1,
      });
      const sessionId = await seedSetupSession(t, {
        userId,
        status,
        refineFromWorkspace: true,
        targetWorkspaceId: workspaceId,
        suffix: status,
      });
      const authenticated = t.withIdentity({ subject: workosUserId });
      const operation =
        status === "awaiting_connections"
          ? authenticated.mutation(api.setupSessions.completeSetupConnections, {
              sessionId,
              connectedX: false,
            })
          : authenticated.mutation(api.setupSessions.selectSetupPlan, {
              sessionId,
              planChoice: "pro",
            });
      await expect(operation).rejects.toThrow("Use workspace settings");
      expect((await t.run((ctx) => ctx.db.get(workspaceId)))?.name).toBe(
        "Keep existing"
      );
      expect(
        (await t.run((ctx) => ctx.db.query("workspaces").collect())).length
      ).toBe(1);
    }
  );

  test.each(["awaiting_connections", "awaiting_plan"] as const)(
    "legacy existing-workspace fallback cannot overwrite a completed workspace through %s",
    async (status) => {
      const t = convexTest(schema, modules);
      const { userId, workosUserId } = await seedUser(t, `existing-${status}`);
      const workspaceId = await seedCompletedWorkspace(t, {
        userId,
        name: "Keep existing",
        isDefault: true,
        entitlementSlot: 1,
      });
      const sessionId = await seedSetupSession(t, {
        userId,
        status,
        suffix: `existing-${status}`,
      });
      await t.run((ctx) =>
        ctx.db.patch(sessionId, { existingWorkspaceId: workspaceId })
      );
      const authenticated = t.withIdentity({ subject: workosUserId });
      const operation =
        status === "awaiting_connections"
          ? authenticated.mutation(api.setupSessions.completeSetupConnections, {
              sessionId,
              connectedX: false,
            })
          : authenticated.mutation(api.setupSessions.selectSetupPlan, {
              sessionId,
              planChoice: "pro",
            });
      await expect(operation).rejects.toThrow("cannot be provisioned");
      expect((await t.run((ctx) => ctx.db.get(workspaceId)))?.name).toBe(
        "Keep existing"
      );
      expect(
        (await t.run((ctx) => ctx.db.query("workspaces").collect())).length
      ).toBe(1);
    }
  );

  test("starting New workspace creates one reusable setup draft and no workspace document", async () => {
    const t = convexTest(schema, modules);
    agentTest.register(t);
    const { userId, workosUserId } = await seedUser(t, "start-draft");
    await seedCompletedWorkspace(t, {
      userId,
      name: "Existing workspace",
      isDefault: true,
      entitlementSlot: 1,
    });
    const authenticated = t.withIdentity({ subject: workosUserId });

    const results = await Promise.all([
      authenticated.mutation(api.setupSessions.startSetupSession, {
        mode: "new_workspace",
      }),
      authenticated.mutation(api.setupSessions.startSetupSession, {
        mode: "new_workspace",
      }),
    ]);
    const created = results.find((result) => !result.reused);
    const reused = results.find((result) => result.reused);

    expect(created).toBeDefined();
    expect(reused).toBeDefined();
    expect(reused).toMatchObject({
      reused: true,
      sessionId: created?.sessionId,
      threadId: created?.threadId,
    });

    const state = await t.run(async (ctx) => ({
      sessions: await ctx.db
        .query("workspaceSetupSessions")
        .withIndex("by_user_last_active", (q) => q.eq("userId", userId))
        .collect(),
      workspaces: await ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
    }));
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]).toMatchObject({
      _id: created?.sessionId,
      mode: "new_workspace",
      status: "awaiting_input",
    });
    expect(state.sessions[0]?.targetWorkspaceId).toBeUndefined();
    expect(state.workspaces).toHaveLength(1);
    expect(state.workspaces[0]?.name).toBe("Existing workspace");

    const messages = await t.run((ctx) =>
      ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
        threadId: created?.threadId ?? "",
        order: "asc",
        paginationOpts: { numItems: 20, cursor: null },
      })
    );
    expect(messages.page).toEqual([]);
    expect(created).not.toHaveProperty("greetingOrder");
  });

  test("keeps the exact chat input when the setup agent submits a shortened tool argument", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedUser(t, "verbatim-input");
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "verbatim-input",
    });
    const originalDescription =
      "  ReacherX is an open-source agent that searches X and LinkedIn.\n\nI am building it solo and need contributors who want to work on open source.  ";

    await t.mutation(
      internal.setupSessions.captureRawSetupInputFromChatInternal,
      {
        sessionId,
        messageId: "user-message-verbatim",
        rawUserDescription: originalDescription,
      }
    );
    await t.mutation(internal.setupSessions.submitSetupInputFromAgentInternal, {
      sessionId,
      inputMode: "manual",
      // Simulates an LLM tool argument that omitted the user's product context.
      inputValue: "Developers seeking open-source contribution opportunities.",
      useCaseKey: "recruiting",
      generationSourceMessageId: "user-message-verbatim",
    });

    const session = await t.run((ctx) =>
      ctx.db.get("workspaceSetupSessions", sessionId)
    );
    expect(session).toMatchObject({
      status: "generating_profiles",
      rawUserDescription: originalDescription,
      seedDescription: originalDescription,
      generationRevision: 2,
      generationSourceMessageId: "user-message-verbatim",
      useCaseKey: "recruiting",
    });
  });

  test("persists AI-generated profile provenance when generation completes", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedUser(t, "generated-profile-provenance");
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "generated-profile-provenance",
    });
    await t.run((ctx) =>
      ctx.db.patch("workspaceSetupSessions", sessionId, {
        status: "generating_profiles",
        generationRevision: 1,
        errorCode: "generation_failed",
        errorMessage: "A previous generation attempt failed.",
      })
    );
    const generatedProfiles = [
      {
        syntheticExamples,
        title: "Hands-on SaaS founders",
        description: "Founders actively improving product-led acquisition.",
        painPoints: ["Finding qualified buyers"],
        channels: ["X"],
        provenance: "ai_generated" as const,
        syntheticPosts: ["How do I find buyers for my SaaS?"],
        qualificationKeywords: ["saas founder"],
      },
    ];

    const result = await t.mutation(
      internal.setupSessions.recordGenerationResultInternal,
      {
        sessionId,
        generationRevision: 1,
        improvedDescription: "Find hands-on SaaS founders with buying intent.",
        generatedProfiles,
        targetingSpec: buildLegacyWorkspaceTargetingSpec({
          description: "Find hands-on SaaS founders with buying intent.",
          profiles: generatedProfiles,
        }),
        generationCompletedAt: 42,
      }
    );

    expect(result).toEqual({ updated: true });
    const session = await t.run((ctx) =>
      ctx.db.get("workspaceSetupSessions", sessionId)
    );
    expect(session).toMatchObject({
      status: "awaiting_icp_confirmation",
      improvedDescription: "Find hands-on SaaS founders with buying intent.",
      generatedProfiles,
      generationCompletedAt: 42,
    });
    expect(session?.errorCode).toBeUndefined();
    expect(session?.errorMessage).toBeUndefined();
  });

  test("repairs legacy setup descriptions without changing generated profiles", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedUser(t, "repair-description");
    const workspaceId = await seedCompletedWorkspace(t, {
      userId,
      name: "Legacy setup workspace",
      isDefault: false,
      entitlementSlot: 2,
    });
    const threadId = "setup-thread-repair-description";
    const sessionId = await seedSetupSession(t, {
      userId,
      status: "awaiting_icp_confirmation",
      suffix: "repair-description",
      setupThreadId: threadId,
      targetWorkspaceId: workspaceId,
    });
    await t.run((ctx) =>
      ctx.db.patch("workspaceSetupSessions", sessionId, { status: "ready" })
    );
    const before = await t.run(async (ctx) => ({
      session: await ctx.db.get("workspaceSetupSessions", sessionId),
      workspace: await ctx.db.get("workspaces", workspaceId),
    }));
    const raw = "The user's complete original description.";
    const improved = "The user's lightly improved original description.";

    await t.mutation(
      internal.setupSessions.repairSetupDescriptionFieldsInternal,
      {
        threadId,
        rawUserDescription: raw,
        improvedDescription: improved,
      }
    );

    const after = await t.run(async (ctx) => ({
      session: await ctx.db.get("workspaceSetupSessions", sessionId),
      workspace: await ctx.db.get("workspaces", workspaceId),
    }));
    expect(after.session).toMatchObject({
      rawUserDescription: raw,
      seedDescription: raw,
      improvedDescription: improved,
      generatedProfiles: before.session?.generatedProfiles,
    });
    expect(after.workspace).toMatchObject({
      rawUserDescription: raw,
      seedDescription: raw,
      improvedDescription: improved,
      description: improved,
      icps: before.workspace?.icps,
    });
  });

  test("keeps descriptions unchanged when an ICP revision is requested", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedUser(t, "icp-only-revision");
    const sessionId = await seedSetupSession(t, {
      userId,
      status: "awaiting_icp_confirmation",
      suffix: "icp-only-revision",
    });
    await t.run((ctx) =>
      ctx.db.patch("workspaceSetupSessions", sessionId, {
        generationRevision: 1,
      })
    );
    const before = await t.run((ctx) =>
      ctx.db.get("workspaceSetupSessions", sessionId)
    );

    await t.mutation(
      internal.setupSessions.submitSetupGenerationFeedbackFromAgentInternal,
      {
        sessionId,
        feedback: "Remove React Native and focus on Next.js developers.",
        generationSourceMessageId: "profile-revision-message",
      }
    );

    const session = await t.run((ctx) =>
      ctx.db.get("workspaceSetupSessions", sessionId)
    );
    expect(session).toMatchObject({
      status: "generating_profiles",
      rawUserDescription: before?.rawUserDescription,
      seedDescription: before?.seedDescription,
      improvedDescription: before?.improvedDescription,
      generationRevision: 2,
      generationSourceMessageId: "profile-revision-message",
    });
  });

  test("keeps generated profile cards immutable and owned by their completion message", async () => {
    const t = convexTest(schema, modules);
    const { userId, workosUserId } = await seedUser(t, "profile-snapshot");
    const threadId = "setup-thread-profile-snapshot";
    const sessionId = await seedSetupSession(t, {
      userId,
      status: "awaiting_icp_confirmation",
      suffix: "profile-snapshot",
      setupThreadId: threadId,
    });
    await t.run((ctx) =>
      ctx.db.patch("workspaceSetupSessions", sessionId, {
        generationRevision: 1,
        generationSourceMessageId: "source-user-message",
      })
    );

    await t.mutation(
      internal.setupSessions.recordSetupProfileSnapshotInternal,
      {
        sessionId,
        generationRevision: 1,
        sourceMessageId: "source-user-message",
        assistantMessageId: "completion-assistant-message",
        improvedDescription: "Find qualified product designers.",
        generatedProfiles: setupProfiles,
        targetingSpec: buildLegacyWorkspaceTargetingSpec({
          description: "Find qualified product designers.",
          profiles: setupProfiles,
        }),
      }
    );
    await t.run((ctx) =>
      ctx.db.patch("workspaceSetupSessions", sessionId, {
        improvedDescription: "A later live-session description.",
        generatedProfiles: setupProfiles.map((profile) => ({
          ...profile,
          title: `Later ${profile.title}`,
        })),
      })
    );

    const authenticated = t.withIdentity({ subject: workosUserId });
    const snapshots = await authenticated.query(
      api.setupSessions.listSetupProfileSnapshots,
      { threadId }
    );

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      sessionId,
      sourceMessageId: "source-user-message",
      assistantMessageId: "completion-assistant-message",
      generationRevision: 1,
      generatedProfiles: setupProfiles,
    });
    expect(snapshots[0]).not.toHaveProperty("improvedDescription");
  });

  test("approval persists examples once without provisioning or searching", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    agentTest.register(t);
    const { userId, workosUserId } = await seedUser(t, "examples");
    const thread = await t.mutation(components.agent.threads.createThread, {
      userId: String(userId),
    });
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "examples",
      status: "awaiting_icp_confirmation",
      setupThreadId: thread._id,
    });
    await t.run((ctx) =>
      ctx.db.patch(sessionId, {
        targetingSpec: buildLegacyWorkspaceTargetingSpec({
          description: "Find product designers",
          profiles: setupProfiles,
        }),
      })
    );
    const viewer = t.withIdentity({ subject: workosUserId });
    await expect(
      viewer.mutation(api.setupSessions.approveSetupGeneration, {
        sessionId,
        generationRevision: 0,
      })
    ).rejects.toThrow("changed");
    const first = await viewer.mutation(
      api.setupSessions.approveSetupGeneration,
      { sessionId, generationRevision: 1 }
    );
    expect(first.status).toBe("awaiting_connections");
    const repeat = await viewer.mutation(
      api.setupSessions.approveSetupGeneration,
      { sessionId, generationRevision: 1 }
    );
    expect(repeat.alreadyCompleted).toBe(true);
    const approvalMessages = await t.run((ctx) =>
      ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
        threadId: thread._id,
        order: "asc",
        paginationOpts: { numItems: 20, cursor: null },
      })
    );
    expect(
      approvalMessages.page
        .filter((item) => item.message?.role === "user")
        .map((item) => item.message?.content)
    ).toEqual(["I approve these example people. Continue with setup."]);

    const state = await t.run(async (ctx) => ({
      session: await ctx.db.get(sessionId),
      workspaces: await ctx.db.query("workspaces").collect(),
      prospects: await ctx.db.query("prospects").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(state.workspaces).toHaveLength(0);
    expect(state.session?.generatedProfiles?.[0]?.syntheticExamples).toEqual(
      syntheticExamples
    );
    expect(state.prospects).toHaveLength(0);
    expect(
      state.jobs.some((job) => job.name.includes("startProspecting"))
    ).toBe(false);
    expect(state.session?.approvedGenerationRevision).toBe(1);
    await expect(
      t
        .withIdentity({ subject: "another-user" })
        .mutation(api.setupSessions.approveSetupGeneration, {
          sessionId,
          generationRevision: 1,
        })
    ).rejects.toThrow();
  });

  test("rejects incomplete platform examples before creating a workspace", async () => {
    const t = convexTest(schema, modules);
    agentTest.register(t);
    const { userId, workosUserId } = await seedUser(t, "missing-example");
    const thread = await t.mutation(components.agent.threads.createThread, {
      userId: String(userId),
    });
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "missing-example",
      setupThreadId: thread._id,
      status: "awaiting_icp_confirmation",
    });
    await t.run((ctx) =>
      ctx.db.patch(sessionId, {
        generatedProfiles: [
          { ...setupProfiles[0]!, syntheticExamples: [syntheticExamples[0]!] },
        ],
      })
    );
    await expect(
      t
        .withIdentity({ subject: workosUserId })
        .mutation(api.setupSessions.approveSetupGeneration, {
          sessionId,
          generationRevision: 1,
        })
    ).rejects.toThrow("one X/Twitter");
    expect(
      await t.run((ctx) => ctx.db.query("workspaces").collect())
    ).toHaveLength(0);
  });

  test("late legacy preview completion cannot change a new draft", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedUser(t, "late-preview");
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "late-preview",
      status: "awaiting_icp_confirmation",
    });
    await t.mutation(internal.workflows.preview.handlePreviewWorkflowComplete, {
      workflowId: "retired-preview" as WorkflowId,
      result: { kind: "failed", error: "old failure" },
      context: { sessionId },
    });
    expect((await t.run((ctx) => ctx.db.get(sessionId)))?.status).toBe(
      "awaiting_icp_confirmation"
    );
  });

  test("anonymous and unknown authenticated visitors do not bootstrap database state", async () => {
    const t = convexTest(schema, modules);

    expect(await t.query(api.setupSessions.getSetupBootstrapState, {})).toEqual(
      {
        activeSession: null,
        suggestedMode: null,
        requiresFirstWorkspace: false,
      }
    );
    expect(
      await t
        .withIdentity({ subject: "missing-workos-user" })
        .query(api.setupSessions.getSetupBootstrapState, {})
    ).toEqual({
      activeSession: null,
      suggestedMode: null,
      requiresFirstWorkspace: false,
    });
  });

  test("an authenticated user without a completed workspace requires first-workspace setup", async () => {
    const t = convexTest(schema, modules);
    const { workosUserId } = await seedUser(t, "bootstrap-first");

    expect(
      await t
        .withIdentity({ subject: workosUserId })
        .query(api.setupSessions.getSetupBootstrapState, {})
    ).toEqual({
      activeSession: null,
      suggestedMode: "first_workspace",
      requiresFirstWorkspace: true,
    });
  });

  test("an authenticated user with a completed workspace needs no setup bootstrap", async () => {
    const t = convexTest(schema, modules);
    const { userId, workosUserId } = await seedUser(t, "bootstrap-complete");
    await seedCompletedWorkspace(t, {
      userId,
      name: "Completed workspace",
      isDefault: true,
      entitlementSlot: 1,
    });

    expect(
      await t
        .withIdentity({ subject: workosUserId })
        .query(api.setupSessions.getSetupBootstrapState, {})
    ).toEqual({
      activeSession: null,
      suggestedMode: null,
      requiresFirstWorkspace: false,
    });
  });

  test("an authenticated user with a completed workspace resumes an additional-workspace draft", async () => {
    const t = convexTest(schema, modules);
    const { userId, workosUserId } = await seedUser(t, "bootstrap-additional");
    await seedCompletedWorkspace(t, {
      userId,
      name: "Completed workspace",
      isDefault: true,
      entitlementSlot: 1,
    });
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "bootstrap-additional",
    });

    expect(
      await t
        .withIdentity({ subject: workosUserId })
        .query(api.setupSessions.getSetupBootstrapState, {})
    ).toMatchObject({
      activeSession: { sessionId, mode: "new_workspace" },
      suggestedMode: "new_workspace",
      requiresFirstWorkspace: false,
    });
  });

  test("an additional-workspace draft is resumable but does not trap a selected completed workspace", async () => {
    const t = convexTest(schema, modules);
    const { userId, workosUserId } = await seedUser(t, "switch-context");
    const workspaceId = await seedCompletedWorkspace(t, {
      userId,
      name: "Existing workspace",
      isDefault: true,
      entitlementSlot: 1,
    });
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "switch-context",
    });
    const authenticated = t.withIdentity({ subject: workosUserId });

    const setupShell = await authenticated.query(api.shell.getAppShellState, {
      preferredContext: "setup_session",
    });
    expect(setupShell).toMatchObject({
      activeContextType: "setup_session",
      activeSetupSessionId: String(sessionId),
      locked: true,
    });
    expect(
      setupShell.switcherItems.find((item) => item.kind === "draft")
    ).toMatchObject({ value: String(sessionId), isActive: true });

    const workspaceShell = await authenticated.query(
      api.shell.getAppShellState,
      { preferredContext: "workspace" }
    );
    expect(workspaceShell).toMatchObject({
      activeContextType: "workspace",
      activeWorkspaceId: String(workspaceId),
    });
    expect(
      workspaceShell.switcherItems.find((item) => item.kind === "draft")
    ).toMatchObject({ value: String(sessionId), isActive: false });
    expect(
      await authenticated.query(api.workspaces.getWorkspaceSetupStatus, {
        preferredContext: "workspace",
      })
    ).toMatchObject({ status: "complete", workspace: { id: workspaceId } });
  });

  test("switching completed workspaces changes the workspace context while preserving the draft", async () => {
    const t = convexTest(schema, modules);
    const { userId, workosUserId } = await seedUser(t, "switch-default");
    await seedCompletedWorkspace(t, {
      userId,
      name: "First workspace",
      isDefault: true,
      entitlementSlot: 1,
    });
    const secondWorkspaceId = await seedCompletedWorkspace(t, {
      userId,
      name: "Second workspace",
      isDefault: false,
      entitlementSlot: 2,
    });
    const sessionId = await seedSetupSession(t, {
      userId,
      entitlementSlot: 3,
      suffix: "switch-default",
    });
    const authenticated = t.withIdentity({ subject: workosUserId });

    await authenticated.mutation(api.workspaces.setDefaultWorkspace, {
      workspaceId: secondWorkspaceId,
    });

    const workspaceShell = await authenticated.query(
      api.shell.getAppShellState,
      { preferredContext: "workspace" }
    );
    expect(workspaceShell).toMatchObject({
      activeContextType: "workspace",
      activeWorkspaceId: String(secondWorkspaceId),
    });
    expect(
      workspaceShell.switcherItems.find(
        (item) => item.value === String(sessionId)
      )
    ).toMatchObject({ kind: "draft", isActive: false });

    const resumedDraftShell = await authenticated.query(
      api.shell.getAppShellState,
      { preferredContext: "setup_session" }
    );
    expect(resumedDraftShell).toMatchObject({
      activeContextType: "setup_session",
      activeSetupSessionId: String(sessionId),
    });
  });

  test("a first-workspace draft remains setup context because no completed workspace exists", async () => {
    const t = convexTest(schema, modules);
    const { userId, workosUserId } = await seedUser(t, "first-workspace");
    const sessionId = await seedSetupSession(t, {
      userId,
      mode: "first_workspace",
      entitlementSlot: 1,
      suffix: "first-workspace",
    });
    const authenticated = t.withIdentity({ subject: workosUserId });

    const shell = await authenticated.query(api.shell.getAppShellState, {
      preferredContext: "workspace",
    });
    expect(shell).toMatchObject({
      activeContextType: "setup_session",
      activeSetupSessionId: String(sessionId),
      activeWorkspaceId: null,
      locked: true,
    });
    expect(shell.switcherItems).toHaveLength(1);
    expect(shell.switcherItems[0]).toMatchObject({ kind: "draft" });
  });

  test("a provisioned preview workspace is still a draft and cannot become default", async () => {
    const t = convexTest(schema, modules);
    const { userId, workosUserId } = await seedUser(t, "provisional");
    const completedWorkspaceId = await seedCompletedWorkspace(t, {
      userId,
      name: "Completed workspace",
      isDefault: true,
      entitlementSlot: 1,
    });
    const provisionalWorkspaceId = await seedProvisionalWorkspace(t, {
      userId,
      entitlementSlot: 2,
    });
    const sessionId = await seedSetupSession(t, {
      userId,
      status: "awaiting_preview_confirmation",
      targetWorkspaceId: provisionalWorkspaceId,
      suffix: "provisional",
    });
    const authenticated = t.withIdentity({ subject: workosUserId });

    const setupShell = await authenticated.query(api.shell.getAppShellState, {
      preferredContext: "setup_session",
    });
    expect(setupShell).toMatchObject({
      activeContextType: "setup_session",
      activeSetupSessionId: String(sessionId),
      activeWorkspaceId: String(provisionalWorkspaceId),
    });
    expect(
      setupShell.switcherItems.some(
        (item) =>
          item.kind === "workspace" &&
          item.value === String(provisionalWorkspaceId)
      )
    ).toBe(false);

    await expect(
      authenticated.mutation(api.workspaces.setDefaultWorkspace, {
        workspaceId: provisionalWorkspaceId,
      })
    ).rejects.toThrow("Workspace setup is not complete");

    const workspaceShell = await authenticated.query(
      api.shell.getAppShellState,
      { preferredContext: "workspace" }
    );
    expect(workspaceShell).toMatchObject({
      activeContextType: "workspace",
      activeWorkspaceId: String(completedWorkspaceId),
    });
  });

  test("discarding an additional-workspace draft deletes its provisional workspace", async () => {
    const t = convexTest(schema, modules);
    const { userId, workosUserId } = await seedUser(t, "discard");
    await seedCompletedWorkspace(t, {
      userId,
      name: "Completed workspace",
      isDefault: true,
      entitlementSlot: 1,
    });
    const provisionalWorkspaceId = await seedProvisionalWorkspace(t, {
      userId,
      entitlementSlot: 2,
    });
    const sessionId = await seedSetupSession(t, {
      userId,
      status: "awaiting_preview_confirmation",
      targetWorkspaceId: provisionalWorkspaceId,
      suffix: "discard",
    });
    const authenticated = t.withIdentity({ subject: workosUserId });

    await authenticated.mutation(api.setupSessions.discardSetupSession, {
      sessionId,
    });

    const state = await t.run(async (ctx) => ({
      session: await ctx.db.get("workspaceSetupSessions", sessionId),
      workspace: await ctx.db.get("workspaces", provisionalWorkspaceId),
    }));
    expect(state.session?.status).toBe("discarded");
    expect(state.workspace).toBeNull();
  });

  test("connected X keeps the persisted connection gate visible and completes paid setup idempotently", async () => {
    vi.useFakeTimers();
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    agentTest.register(t);
    await registerWorkflowComponent(t);
    const { userId, workosUserId } = await seedUser(t, "complete-connections");
    const provisionalWorkspaceId = await seedProvisionalWorkspace(t, {
      userId,
      entitlementSlot: 1,
    });
    const setupThread = await t.mutation(
      components.agent.threads.createThread,
      { userId: String(userId) }
    );
    const sessionId = await seedSetupSession(t, {
      userId,
      mode: "first_workspace",
      status: "awaiting_connections",
      targetWorkspaceId: provisionalWorkspaceId,
      entitlementSlot: 1,
      setupThreadId: String(setupThread._id),
      suffix: "complete-connections",
    });
    const workflowId = await t.run(async (ctx) => {
      const id = await workflow.start(
        ctx,
        internal.workflows.setup.setupSessionWorkflow,
        { sessionId }
      );
      await ctx.db.patch(sessionId, { workflowId: String(id) });
      return id;
    });
    await finishScheduledBatches(t);
    expect(
      await t.run((ctx) => workflow.status(ctx, workflowId))
    ).toMatchObject({ type: "inProgress" });
    await t.run((ctx) =>
      ctx.db.insert("xAccounts", {
        userId,
        xUserId: "connected-x-user",
        username: "connected_user",
        accessToken: "test-access-token",
        expiresAt: 9_999_999_999_999,
        grantedScopes: [...X_CORE_SCOPES],
        tokenType: "bearer",
        status: "connected",
        updatedAt: 30,
      })
    );
    const authenticated = t.withIdentity({ subject: workosUserId });

    const returnedState = await authenticated.query(
      api.setupSessions.getSetupSessionState,
      { sessionId }
    );
    expect(returnedState).toMatchObject({
      status: "awaiting_connections",
      currentStepId: "connections",
      requiresConnections: true,
    });
    expect(returnedState?.visibleSteps.map((step) => step.id)).toEqual([
      "input",
      "connections",
    ]);

    const completion = await authenticated.mutation(
      api.setupSessions.completeSetupConnections,
      { sessionId, connectedX: true }
    );
    expect(completion).toMatchObject({ success: true, status: "ready" });

    const repeatedCompletion = await authenticated.mutation(
      api.setupSessions.completeSetupConnections,
      { sessionId, connectedX: true }
    );
    expect(repeatedCompletion).toMatchObject({
      success: true,
      status: "ready",
      alreadyCompleted: true,
    });
    // Verify discovery is scheduled once, but keep this setup lifecycle test
    // from executing the separate discovery pipeline and its external services.
    await t.run(async (ctx) => {
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      const discoveryJobs = jobs.filter((job) =>
        job.name.includes("startProspectingWorkflowInternal")
      );
      expect(discoveryJobs).toHaveLength(1);
      await ctx.scheduler.cancel(discoveryJobs[0]._id);
    });
    await finishScheduledBatches(t);
    expect(
      await t.run((ctx) => workflow.status(ctx, workflowId))
    ).toMatchObject({
      type: "completed",
      result: { success: true, status: "ready" },
    });

    const state = await t.run(async (ctx) => ({
      session: await ctx.db.get("workspaceSetupSessions", sessionId),
      workspace: await ctx.db.get("workspaces", provisionalWorkspaceId),
    }));
    expect(state.session).toMatchObject({
      status: "ready",
      connectionsCompletedAt: expect.any(Number),
      rawUserDescription: "Find qualified product designers.",
      generatedProfiles: setupProfiles,
    });
    expect(state.workspace).toMatchObject({
      setupCompletedAt: expect.any(Number),
      isDefault: true,
      rawUserDescription: "Find qualified product designers.",
      icps: setupProfiles,
    });
  });

  test("finishing setup promotes the provisional workspace to completed and default", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    agentTest.register(t);
    const { userId, workosUserId } = await seedUser(t, "finish");
    const existingWorkspaceId = await seedCompletedWorkspace(t, {
      userId,
      name: "Existing workspace",
      isDefault: true,
      entitlementSlot: 1,
    });
    const provisionalWorkspaceId = await seedProvisionalWorkspace(t, {
      userId,
      entitlementSlot: 2,
    });
    const setupThread = await t.mutation(
      components.agent.threads.createThread,
      { userId: String(userId) }
    );
    const sessionId = await seedSetupSession(t, {
      userId,
      status: "awaiting_plan",
      targetWorkspaceId: provisionalWorkspaceId,
      setupThreadId: String(setupThread._id),
      suffix: "finish",
    });
    const authenticated = t.withIdentity({ subject: workosUserId });

    await authenticated.mutation(api.setupSessions.selectSetupPlan, {
      sessionId,
      planChoice: "hobby",
    });

    const state = await t.run(async (ctx) => ({
      existingWorkspace: await ctx.db.get("workspaces", existingWorkspaceId),
      promotedWorkspace: await ctx.db.get("workspaces", provisionalWorkspaceId),
      session: await ctx.db.get("workspaceSetupSessions", sessionId),
    }));
    expect(state.session?.status).toBe("ready");
    expect(state.promotedWorkspace?.setupCompletedAt).toEqual(
      expect.any(Number)
    );
    expect(state.promotedWorkspace?.rawUserDescription).toBe(
      "Find qualified product designers."
    );
    expect(state.promotedWorkspace?.seedDescription).toBe(
      "Find qualified product designers."
    );
    expect(state.promotedWorkspace?.isDefault).toBe(true);
    expect(state.existingWorkspace?.isDefault).toBe(false);
  });
  test("free users can approve and skip accounts, but cannot forge payment; finalization creates once", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    agentTest.register(t);
    const { userId, workosUserId } = await seedUser(t, "free-to-paid");
    const thread = await t.mutation(components.agent.threads.createThread, {
      userId: String(userId),
    });
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "free-to-paid",
      entitlementSlot: 1,
      setupThreadId: thread._id,
      status: "awaiting_icp_confirmation",
    });
    const planId = await t.run(async (ctx) => {
      const plan = await ctx.db
        .query("userPlans")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      await ctx.db.patch(plan!._id, { tier: "free" });
      await ctx.db.patch(sessionId, {
        targetingSpec: buildLegacyWorkspaceTargetingSpec({
          description: "Find designers",
          profiles: setupProfiles,
        }),
      });
      return plan!._id;
    });
    const viewer = t.withIdentity({ subject: workosUserId });
    await viewer.mutation(api.setupSessions.approveSetupGeneration, {
      sessionId,
      generationRevision: 1,
    });
    await viewer.mutation(api.setupSessions.completeSetupConnections, {
      sessionId,
      connectedX: false,
    });
    expect((await t.run((ctx) => ctx.db.get(sessionId)))?.status).toBe(
      "awaiting_plan"
    );
    await expect(
      viewer.mutation(api.setupSessions.selectSetupPlan, {
        sessionId,
        planChoice: "pro",
      })
    ).rejects.toThrow("Payment is not confirmed");
    expect(
      await t.run((ctx) => ctx.db.query("workspaces").collect())
    ).toHaveLength(0);
    await t.run((ctx) => ctx.db.patch(planId, { tier: "pro" }));
    await viewer.mutation(api.setupSessions.selectSetupPlan, {
      sessionId,
      planChoice: "pro",
    });
    await viewer.mutation(api.setupSessions.selectSetupPlan, {
      sessionId,
      planChoice: "pro",
    });
    const final = await t.run(async (ctx) => ({
      session: await ctx.db.get(sessionId),
      workspaces: await ctx.db.query("workspaces").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(final.session?.status).toBe("ready");
    expect(final.workspaces).toHaveLength(1);
    expect(final.workspaces[0]?.icps?.[0]?.syntheticExamples).toEqual(
      syntheticExamples
    );
    expect(
      final.jobs.filter((job) =>
        job.name.includes("startProspectingWorkflowInternal")
      )
    ).toHaveLength(1);
  });

  test("late generation and failure callbacks cannot replace a newer revision", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedUser(t, "stale-generation");
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "stale-generation",
    });
    await t.run((ctx) =>
      ctx.db.patch(sessionId, {
        generationRevision: 2,
        status: "generating_profiles",
      })
    );
    expect(
      await t.mutation(internal.setupSessions.recordGenerationResultInternal, {
        sessionId,
        generationRevision: 1,
        improvedDescription: "Old request",
        generatedProfiles: setupProfiles,
        targetingSpec: buildLegacyWorkspaceTargetingSpec({
          description: "Old request",
          profiles: setupProfiles,
        }),
        generationCompletedAt: 10,
      })
    ).toEqual({ updated: false });
    await t.mutation(internal.setupSessions.markGenerationFailedInternal, {
      sessionId,
      generationRevision: 1,
      errorMessage: "Old failure",
    });
    expect((await t.run((ctx) => ctx.db.get(sessionId)))?.status).toBe(
      "generating_profiles"
    );
  });
  test("generation retry preserves the failed refinement and URL context", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerWorkflowComponent(t);
    const { userId, workosUserId } = await seedUser(t, "retry-refinement");
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "retry-refinement",
    });
    await t.run((ctx) =>
      ctx.db.patch(sessionId, {
        status: "generating_profiles",
        inputMode: "url",
        sourceUrl: "https://example.com",
        generationFeedback: "Keep only designers",
        generationRevision: 2,
      })
    );
    await t.mutation(internal.setupSessions.markGenerationFailedInternal, {
      sessionId,
      generationRevision: 2,
      errorMessage: "Provider timed out",
    });
    expect((await t.run((ctx) => ctx.db.get(sessionId)))?.status).toBe(
      "failed"
    );
    await t
      .withIdentity({ subject: workosUserId })
      .mutation(api.setupSessions.retrySetupGeneration, { sessionId });
    const retried = await t.run((ctx) => ctx.db.get(sessionId));
    expect(retried).toMatchObject({
      status: "generating_profiles",
      generationRevision: 3,
      generationFeedback: "Keep only designers",
      inputMode: "url",
      sourceUrl: "https://example.com",
    });
    expect(retried?.errorMessage).toBeUndefined();
    await expect(
      t
        .withIdentity({ subject: workosUserId })
        .mutation(api.setupSessions.retrySetupGeneration, { sessionId })
    ).rejects.toThrow("no failed generation");
    const staleFailure = await t.mutation(
      internal.setupSessions.markGenerationFailedInternal,
      { sessionId, generationRevision: 2, errorMessage: "Late failure" }
    );
    expect(staleFailure.updated).toBe(false);
  });

  test("unfinished legacy previews upgrade once and require new example approval", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await registerWorkflowComponent(t);
    const { userId } = await seedUser(t, "legacy-upgrade");
    const sessionId = await seedSetupSession(t, {
      userId,
      suffix: "legacy-upgrade",
      status: "awaiting_preview_confirmation",
    });
    await t.run((ctx) =>
      ctx.db.patch(sessionId, {
        flowVersion: undefined,
        approvedGenerationRevision: undefined,
      })
    );
    await t.mutation(internal.setupSessions.upgradeLegacySetupInternal, {
      sessionId,
    });
    const upgraded = await t.run((ctx) => ctx.db.get(sessionId));
    expect(upgraded).toMatchObject({
      flowVersion: 2,
      status: "generating_profiles",
      generationRevision: 2,
    });
    expect(upgraded?.generatedProfiles).toBeUndefined();
    expect(upgraded?.approvedGenerationRevision).toBeUndefined();
    await t.mutation(internal.setupSessions.upgradeLegacySetupInternal, {
      sessionId,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(sessionId)))?.generationRevision
    ).toBe(2);
  });
  test("agent approval validates the owner supplied by trusted tool context", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "agent-approval-owner");
    const other = await seedUser(t, "agent-approval-other");
    const sessionId = await seedSetupSession(t, {
      userId: owner.userId,
      suffix: "agent-approval-owner",
      status: "awaiting_icp_confirmation",
    });
    await expect(
      t.mutation(internal.setupSessions.approveSetupExamplesFromAgentInternal, {
        sessionId,
        userId: other.userId,
        generationRevision: 1,
      })
    ).rejects.toThrow("Setup session not found");
    expect(
      (await t.run((ctx) => ctx.db.get(sessionId)))?.approvedGenerationRevision
    ).toBeUndefined();
  });
});
