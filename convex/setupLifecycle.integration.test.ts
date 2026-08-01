/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import { describe, expect, test } from "vitest";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const setupProfiles = [
  {
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
      currentWorkspacesCount: 0,
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
      | "awaiting_preview_confirmation"
      | "awaiting_plan";
    targetWorkspaceId?: Id<"workspaces">;
    entitlementSlot?: number;
    setupThreadId?: string;
    suffix: string;
  }
) {
  return await t.run((ctx) =>
    ctx.db.insert("workspaceSetupSessions", {
      userId: args.userId,
      mode: args.mode ?? "new_workspace",
      status: args.status ?? "awaiting_input",
      setupThreadId: args.setupThreadId ?? `setup-thread-${args.suffix}`,
      useCaseKey: "general_outreach",
      draftOrdinal: 1,
      draftName: "Draft workspace",
      seedDescription: "Find qualified product designers.",
      improvedDescription: "Find qualified product designers.",
      generatedProfiles: setupProfiles,
      targetWorkspaceId: args.targetWorkspaceId,
      entitlementSlot: args.entitlementSlot ?? 2,
      statusUpdatedAt: 20,
      lastActiveAt: 20,
    })
  );
}

describe("setup session and workspace lifecycle", () => {
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

  test("finishing setup promotes the provisional workspace to completed and default", async () => {
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
    expect(state.promotedWorkspace?.isDefault).toBe(true);
    expect(state.existingWorkspace?.isDefault).toBe(false);
  });
});
