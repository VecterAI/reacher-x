/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { syntheticExamples } from "../test/syntheticProfiles";
import { buildLegacyWorkspaceTargetingSpec } from "./lib/targetingSpecCore";
import {
  generateInitialSetupDraft,
  generateSetupProfileRevision,
} from "./lib/setupGenerationCore";
import { analyzeSetupUrl } from "./lib/setupUrlAnalysisCore";
import type { Id } from "./_generated/dataModel";

vi.mock("./lib/setupGenerationCore", () => ({
  generateInitialSetupDraft: vi.fn(),
  generateSetupProfileRevision: vi.fn(),
}));
vi.mock("./lib/setupUrlAnalysisCore", () => ({ analyzeSetupUrl: vi.fn() }));

const modules = import.meta.glob("./**/*.ts");
const profiles = [
  {
    title: "Product designers",
    description: "Designers building B2B products.",
    painPoints: ["Complex workflows"],
    channels: ["LinkedIn"],
    qualificationKeywords: ["product design"],
    syntheticExamples,
    syntheticPosts: ["Working on a B2B workflow."],
  },
];
const generation = {
  improvedDescription: "Find product designers.",
  icps: profiles,
  targetingSpec: buildLegacyWorkspaceTargetingSpec({
    description: "Find product designers.",
    profiles,
  }),
  telemetry: { model: "test-model", usage: {}, request: {}, response: {} },
};

function createTest() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  rateLimiterTest.register(t);
  return t;
}

async function seed(
  t: ReturnType<typeof createTest>,
  suffix = "user",
  existingUserId?: Id<"users">
) {
  const userId =
    existingUserId ??
    (await t.run((ctx) =>
      ctx.db.insert("users", {
        workosUserId: suffix,
        email: suffix + "@example.test",
      })
    ));
  const thread = await t.mutation(components.agent.threads.createThread, {
    userId: String(userId),
  });
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("workspaceSetupSessions", {
      userId,
      flowVersion: 2,
      mode: "first_workspace",
      status: "generating_profiles",
      setupThreadId: thread._id,
      useCaseKey: "general_outreach",
      draftOrdinal: 1,
      inputMode: "manual",
      rawUserDescription: "Find product designers.",
      seedDescription: "Find product designers.",
      generationRevision: 1,
      generationRequestedAt: getCurrentUTCTimestamp(),
      statusUpdatedAt: getCurrentUTCTimestamp(),
      entitlementSlot: 1,
    })
  );
  return {
    userId,
    sessionId,
    threadId: thread._id,
    viewer: t.withIdentity({ subject: suffix }),
  };
}

async function execution(
  t: ReturnType<typeof createTest>,
  sessionId: Id<"workspaceSetupSessions">
) {
  return await t.run(
    async (ctx) => (await ctx.db.get(sessionId))!.generationExecution!
  );
}

async function runAttempt(
  t: ReturnType<typeof createTest>,
  sessionId: Id<"workspaceSetupSessions">
) {
  const current = await execution(t, sessionId);
  return await t.action(internal.setupSessions.runSetupGenerationInternal, {
    sessionId,
    generationRevision: current.revision,
    attempt: current.attempt,
  });
}

describe("setup generation without background admission", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(generateInitialSetupDraft)
      .mockReset()
      .mockResolvedValue(
        generation as Awaited<ReturnType<typeof generateInitialSetupDraft>>
      );
    vi.mocked(generateSetupProfileRevision)
      .mockReset()
      .mockResolvedValue(
        generation as unknown as Awaited<
          ReturnType<typeof generateSetupProfileRevision>
        >
      );
    vi.mocked(analyzeSetupUrl).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  test("100 users can schedule and finish while every background slot is occupied", async () => {
    const t = createTest();
    await t.run(async (ctx) => {
      await ctx.db.insert("tenantSchedulerControls", {
        key: "global",
        mode: "enforced",
        slotCount: 36,
        baseSlotsPerTenant: 1,
        burstSlotsPerTenant: 30,
        leaseDurationMs: 7200000,
        updatedAt: 1,
      });
      for (let slotNumber = 0; slotNumber < 36; slotNumber++) {
        await ctx.db.insert("tenantSchedulerSlots", {
          slotNumber,
          status: "claimed",
          updatedAt: 1,
        });
      }
    });
    const users = [];
    for (let i = 0; i < 100; i++) users.push(await seed(t, "user-" + i));
    for (const { sessionId } of users) {
      expect(
        await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
          sessionId,
        })
      ).toBe(true);
    }
    // Real actions, mutations, component storage and completion paths; only AI
    // provider responses are stubbed to avoid spending money on a load test.
    const results = await Promise.all(
      users.map(({ sessionId }) => runAttempt(t, sessionId))
    );
    expect(results.every((result) => result.success)).toBe(true);
    expect(generateInitialSetupDraft).toHaveBeenCalledTimes(100);
    const state = await t.run(async (ctx) => ({
      jobs: await ctx.db.query("tenantJobs").collect(),
      sessions: await ctx.db.query("workspaceSetupSessions").collect(),
      slots: await ctx.db.query("tenantSchedulerSlots").collect(),
    }));
    expect(state.jobs).toHaveLength(0);
    expect(state.slots.every((slot) => slot.status === "claimed")).toBe(true);
    expect(
      state.sessions.every(
        (session) => session.status === "awaiting_icp_confirmation"
      )
    ).toBe(true);
  });

  test("duplicate scheduling, old queue callbacks and duplicate actions buy one generation", async () => {
    const t = createTest();
    const { sessionId } = await seed(t);
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId,
    });
    const first = await execution(t, sessionId);
    expect(
      await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
        sessionId,
      })
    ).toBe(false);
    await t.action(internal.setupSessions.runSetupGenerationInternal, {
      sessionId,
    });
    expect(await execution(t, sessionId)).toEqual(first);
    const results = await Promise.all([
      runAttempt(t, sessionId),
      runAttempt(t, sessionId),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(generateInitialSetupDraft).toHaveBeenCalledTimes(1);
  });

  test("leaving, returning and approving reuse stored profiles and go directly to plans", async () => {
    const t = createTest();
    const { sessionId, threadId, viewer } = await seed(t);
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId,
    });
    await runAttempt(t, sessionId);
    const first = await viewer.query(api.setupSessions.getSetupSessionState, {
      threadId,
    });
    expect(first).toMatchObject({
      status: "awaiting_icp_confirmation",
      requiresConnections: false,
      totalSteps: 2,
    });
    expect(
      await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
        sessionId,
      })
    ).toBe(false);
    expect(
      await viewer.query(api.setupSessions.getSetupSessionState, { threadId })
    ).toEqual(first);
    await viewer.mutation(api.setupSessions.approveSetupGeneration, {
      sessionId,
      generationRevision: 1,
    });
    const resumed = await viewer.query(api.setupSessions.getSetupSessionState, {
      threadId,
    });
    expect(resumed).toMatchObject({
      status: "awaiting_plan",
      currentStepId: "plan",
      currentStepNumber: 2,
    });
    expect(resumed?.generatedProfiles).toEqual(first?.generatedProfiles);
    expect(generateInitialSetupDraft).toHaveBeenCalledTimes(1);
    await expect(
      viewer.mutation(api.setupSessions.selectSetupPlanByThreadId, {
        threadId,
        planChoice: "pro",
      })
    ).rejects.toThrow("Payment is not confirmed");
    const other = t.withIdentity({ subject: "other-user" });
    await expect(
      other.mutation(api.setupSessions.approveSetupGeneration, {
        sessionId,
        generationRevision: 1,
      })
    ).rejects.toThrow();
  });

  test("failed provider attempts retry up to three times, then stop", async () => {
    const t = createTest();
    const { sessionId } = await seed(t);
    vi.mocked(generateInitialSetupDraft).mockRejectedValue(
      new Error("provider unavailable")
    );
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId,
    });
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect((await execution(t, sessionId)).attempt).toBe(attempt);
      await runAttempt(t, sessionId);
    }
    const session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("failed");
    expect(generateInitialSetupDraft).toHaveBeenCalledTimes(3);
    expect(
      await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
        sessionId,
      })
    ).toBe(false);
  });

  test("cancelled scheduled work is recovered and its old action cannot run", async () => {
    const t = createTest();
    const { sessionId } = await seed(t);
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId,
    });
    const old = await execution(t, sessionId);
    await t.run((ctx) => ctx.scheduler.cancel(old.scheduledFunctionId));
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId,
    });
    await t.action(internal.setupSessions.runSetupGenerationInternal, {
      sessionId,
      generationRevision: old.revision,
      attempt: old.attempt,
    });
    expect(generateInitialSetupDraft).not.toHaveBeenCalled();
    expect((await runAttempt(t, sessionId)).success).toBe(true);
  });

  test("stale attempts cannot overwrite a newer revision or revive a discarded session", async () => {
    const t = createTest();
    const { sessionId } = await seed(t);
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId,
    });
    const old = await execution(t, sessionId);
    await t.run((ctx) => ctx.db.patch(sessionId, { generationRevision: 2 }));
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId,
    });
    await t.action(internal.setupSessions.runSetupGenerationInternal, {
      sessionId,
      generationRevision: old.revision,
      attempt: old.attempt,
    });
    expect(generateInitialSetupDraft).not.toHaveBeenCalled();
    await t.run((ctx) => ctx.db.patch(sessionId, { status: "discarded" }));
    await runAttempt(t, sessionId);
    expect(generateInitialSetupDraft).not.toHaveBeenCalled();
  });

  test("a late provider result cannot overwrite a replacement attempt", async () => {
    const t = createTest();
    const { sessionId } = await seed(t);
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId,
    });
    let release!: (
      value: Awaited<ReturnType<typeof generateInitialSetupDraft>>
    ) => void;
    let started!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.mocked(generateInitialSetupDraft).mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const oldRun = runAttempt(t, sessionId);
    await providerStarted;
    await t.mutation(
      internal.setupSessions.retrySetupGenerationAttemptInternal,
      {
        sessionId,
        generationRevision: 1,
        attempt: 1,
        errorMessage: "Lost execution",
      }
    );
    expect((await execution(t, sessionId)).attempt).toBe(2);
    release(
      generation as Awaited<ReturnType<typeof generateInitialSetupDraft>>
    );
    expect(await oldRun).toMatchObject({ success: false, stale: true });
    expect(
      (await t.run((ctx) => ctx.db.get(sessionId)))?.generatedProfiles
    ).toBeUndefined();
    expect((await runAttempt(t, sessionId)).success).toBe(true);
    expect(generateInitialSetupDraft).toHaveBeenCalledTimes(2);
  });

  test("generation spending allowance is per user and includes retries", async () => {
    const t = createTest();
    const first = await seed(t);
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId: first.sessionId,
    });
    for (let i = 1; i < 20; i++) {
      const next = await seed(t, "user", first.userId);
      expect(
        await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
          sessionId: next.sessionId,
        })
      ).toBe(true);
    }
    const limited = await seed(t, "user", first.userId);
    expect(
      await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
        sessionId: limited.sessionId,
      })
    ).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(limited.sessionId)))?.status).toBe(
      "failed"
    );
    const newcomer = await seed(t, "newcomer");
    expect(
      await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
        sessionId: newcomer.sessionId,
      })
    ).toBe(true);
  });

  test("URL failures retry without dropping URL context; feedback uses the revision generator", async () => {
    const t = createTest();
    const { sessionId, viewer } = await seed(t);
    await t.run((ctx) =>
      ctx.db.patch(sessionId, {
        inputMode: "url",
        sourceUrl: "https://example.test",
      })
    );
    vi.mocked(analyzeSetupUrl)
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValue({
        businessName: "Example",
        keyProblems: [],
        targetAudience: [],
        telemetry: generation.telemetry,
      } as unknown as Awaited<ReturnType<typeof analyzeSetupUrl>>);
    await t.mutation(internal.setupSessions.ensureSetupGenerationInternal, {
      sessionId,
    });
    await runAttempt(t, sessionId);
    await runAttempt(t, sessionId);
    expect(analyzeSetupUrl).toHaveBeenLastCalledWith({
      operation: "setupSessionAnalyzeUrl",
      url: "https://example.test",
    });
    await viewer.mutation(api.setupSessions.submitSetupGenerationFeedback, {
      sessionId,
      feedback: "Focus on senior designers.",
    });
    await runAttempt(t, sessionId);
    expect(generateSetupProfileRevision).toHaveBeenCalledTimes(1);
    expect(analyzeSetupUrl).toHaveBeenCalledTimes(2);
    expect((await execution(t, sessionId)).revision).toBe(2);
  });
});
