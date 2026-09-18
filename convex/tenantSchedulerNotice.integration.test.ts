/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import batchWorkerTest from "@convex-dev/batch-worker/test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import {
  buildTenantKey,
  getSetupGenerationJobKey,
} from "./lib/tenantSchedulerCore";

const modules = import.meta.glob("./**/*.ts");
const now = Date.UTC(2026, 8, 18);
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  batchWorkerTest.register(t, "batchWorker");
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "notice-owner",
      email: "owner@notice.test",
    });
    const otherUserId = await ctx.db.insert("users", {
      workosUserId: "other-owner",
      email: "other@notice.test",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Notice QA",
      description: "Find founders",
      improvedDescription: "Find founders",
      icps: [
        {
          title: "Founders",
          description: "SaaS founders",
          painPoints: [],
          channels: [],
        },
      ],
      isDefault: true,
      prospectingWorkflowStatus: "running",
      setupCompletedAt: now,
      updatedAt: now,
    });
    const tenantKey = buildTenantKey({ userId, workspaceId });
    const controlId = await ctx.db.insert("tenantSchedulerControls", {
      key: "global",
      mode: "enforced",
      slotCount: 2,
      baseSlotsPerTenant: 1,
      burstSlotsPerTenant: 2,
      leaseDurationMs: 60_000,
      updatedAt: now,
    });
    const laneId = await ctx.db.insert("tenantJobLanes", {
      tenantKey,
      userId,
      workspaceId,
      state: "ready",
      pendingCount: 1,
      runningCount: 0,
      minPriority: 50,
      lastDispatchedAt: 0,
      updatedAt: now,
    });
    const jobId = await ctx.db.insert("tenantJobs", {
      tenantKey,
      laneId,
      userId,
      workspaceId,
      class: "background",
      kind: "memory_evaluation",
      status: "queued",
      priority: 50,
      idempotencyKey: "notice-job",
      payload: { kind: "memory_evaluation", workspaceId },
      queuedAt: now,
      attemptCount: 0,
      updatedAt: now,
    });
    const slotIds = [];
    for (let slotNumber = 0; slotNumber < 2; slotNumber++) {
      slotIds.push(
        await ctx.db.insert("tenantSchedulerSlots", {
          slotNumber,
          status: "claimed",
          jobId,
          tenantKey: "workspace:other",
          claimedAt: now,
          leaseExpiresAt: now + 60_000,
          updatedAt: now,
        })
      );
    }
    return {
      userId,
      otherUserId,
      workspaceId,
      tenantKey,
      controlId,
      laneId,
      jobId,
      slotIds,
    };
  });
  await t.mutation(internal.tenantScheduler.wakeDispatcherInternal, {});
  const viewer = t.withIdentity({ subject: "notice-owner" });
  const scope = { kind: "workspace" as const, workspaceId: ids.workspaceId };
  return { t, viewer, scope, ...ids };
}

describe("high load notice query", () => {
  test("missing controls, missing slot leases and errored waiting jobs do not produce reassurance", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.patch(f.jobId, { errorMessage: "Failed to enqueue" })
    );
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.jobId, { errorMessage: undefined });
      await ctx.db.patch(f.slotIds[0], { leaseExpiresAt: undefined });
    });
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
    await f.t.run((ctx) => ctx.db.delete(f.controlId));
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
  });

  test("own-workspace concurrency caps with free global capacity are not called overload", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.controlId, { burstSlotsPerTenant: 1 });
      await ctx.db.patch(f.slotIds[0], { tenantKey: f.tenantKey });
      await ctx.db.patch(f.slotIds[1], { status: "free" });
    });
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
  });

  test("a workspace legacy override wins over global enforcement", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.insert("tenantSchedulerWorkspaceOverrides", {
        workspaceId: f.workspaceId,
        mode: "legacy",
        updatedAt: now,
      })
    );
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
  });
  test("waiting → partial progress → recovery is reactive to database state", async () => {
    const f = await fixture();
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toEqual({ state: "queued", validUntil: now + 60_000 });
    await f.t.run((ctx) =>
      ctx.db.patch(f.slotIds[0], { tenantKey: f.tenantKey })
    );
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toMatchObject({ state: "slow" });
    await f.t.run((ctx) => ctx.db.patch(f.slotIds[1], { status: "free" }));
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
  });

  test.each(["running", "succeeded", "failed", "cancelled", "shadow"] as const)(
    "does not label a %s job as waiting",
    async (status) => {
      const f = await fixture();
      await f.t.run((ctx) => ctx.db.patch(f.jobId, { status }));
      expect(
        await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
          scope: f.scope,
        })
      ).toBeNull();
    }
  );

  test.each(["paused", "stopped", "limit_reached"] as const)(
    "suppresses a %s workspace",
    async (prospectingWorkflowStatus) => {
      const f = await fixture();
      await f.t.run((ctx) =>
        ctx.db.patch(f.workspaceId, { prospectingWorkflowStatus })
      );
      expect(
        await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
          scope: f.scope,
        })
      ).toBeNull();
    }
  );

  test("suppresses a workspace that needs attention and a paused lane", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.patch(f.workspaceId, {
        onboardingIssueStatusCode: "icp_refresh_required",
      })
    );
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.workspaceId, {
        onboardingIssueStatusCode: undefined,
      });
      await ctx.db.patch(f.laneId, { state: "paused" });
    });
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
  });

  test.each(["legacy", "shadow"] as const)(
    "honors %s rollout and workspace overrides",
    async (mode) => {
      const f = await fixture();
      await f.t.run((ctx) => ctx.db.patch(f.controlId, { mode }));
      expect(
        await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
          scope: f.scope,
        })
      ).toBeNull();
      await f.t.run((ctx) =>
        ctx.db.insert("tenantSchedulerWorkspaceOverrides", {
          workspaceId: f.workspaceId,
          mode: "enforced",
          updatedAt: now,
        })
      );
      expect(
        await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
          scope: f.scope,
        })
      ).toMatchObject({ state: "queued" });
    }
  );

  test("does not leak another workspace or show notices to signed-out/unprovisioned viewers", async () => {
    const f = await fixture();
    expect(
      await f.t.query(api.tenantScheduler.getHighLoadNotice, { scope: f.scope })
    ).toBeNull();
    expect(
      await f.t
        .withIdentity({ subject: "new-user" })
        .query(api.tenantScheduler.getHighLoadNotice, { scope: f.scope })
    ).toBeNull();
    await expect(
      f.t
        .withIdentity({ subject: "other-owner" })
        .query(api.tenantScheduler.getHighLoadNotice, { scope: f.scope })
    ).rejects.toThrow("Not authorized");
  });

  test("does not report overload when slot configuration is incomplete or the dispatcher is stopped", async () => {
    const f = await fixture();
    await f.t.mutation(components.batchWorker.lib.stop, {
      name: "tenant-fair-dispatcher-v1",
    });
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
    await f.t.mutation(components.batchWorker.lib.start, {
      name: "tenant-fair-dispatcher-v1",
    });
    await f.t.run((ctx) => ctx.db.delete(f.slotIds[1]));
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
  });

  test("uses configured capacity, not a hard-coded 36, and ignores slots outside it", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.insert("tenantSchedulerSlots", {
        slotNumber: 35,
        status: "free",
        updatedAt: now,
      })
    );
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toMatchObject({ state: "queued" });
  });

  test("a workspace with no waiting work is unaffected by somebody else's backlog", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.delete(f.jobId));
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: f.scope,
      })
    ).toBeNull();
  });

  test("scopes setup to the authenticated owner, exact thread, generation and recovery revision", async () => {
    const f = await fixture();
    const sessionId = await f.t.run(async (ctx) => {
      const id = await ctx.db.insert("workspaceSetupSessions", {
        userId: f.userId,
        mode: "first_workspace",
        status: "generating_profiles",
        setupThreadId: "setup-qa",
        useCaseKey: "customer_prospecting",
        draftOrdinal: 1,
        lastActiveAt: now,
        statusUpdatedAt: now,
        generationRevision: 2,
        workflowRecoveryRevision: 1,
      });
      const session = (await ctx.db.get(id))!;
      const tenantKey = buildTenantKey({ userId: f.userId });
      const laneId = await ctx.db.insert("tenantJobLanes", {
        tenantKey,
        userId: f.userId,
        state: "ready",
        pendingCount: 1,
        runningCount: 0,
        minPriority: 0,
        lastDispatchedAt: 0,
        updatedAt: now,
      });
      await ctx.db.insert("tenantJobs", {
        tenantKey,
        laneId,
        userId: f.userId,
        class: "interactive",
        kind: "setup_generation",
        status: "queued",
        priority: 0,
        idempotencyKey: getSetupGenerationJobKey(session),
        payload: { kind: "setup_generation", sessionId: id },
        queuedAt: now,
        attemptCount: 0,
        updatedAt: now,
      });
      return id;
    });
    const scope = { kind: "setup" as const, threadId: "setup-qa" };
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, { scope })
    ).toMatchObject({ state: "queued" });
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, {
        scope: { ...scope, threadId: "different-draft" },
      })
    ).toBeNull();
    expect(
      await f.t
        .withIdentity({ subject: "other-owner" })
        .query(api.tenantScheduler.getHighLoadNotice, { scope })
    ).toBeNull();
    await f.t.run((ctx) =>
      ctx.db.patch(sessionId, { workflowRecoveryRevision: 2 })
    );
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, { scope })
    ).toBeNull();
    await f.t.run((ctx) =>
      ctx.db.patch(sessionId, { workflowRecoveryRevision: 1, status: "failed" })
    );
    expect(
      await f.viewer.query(api.tenantScheduler.getHighLoadNotice, { scope })
    ).toBeNull();
  });
});
