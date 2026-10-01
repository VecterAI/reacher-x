/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function seedExpiredLeaseJob(
  t: ReturnType<typeof convexTest>
): Promise<{ jobId: Id<"tenantJobs"> }> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "brake-reaper-user",
      email: "brake-reaper@example.test",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Brake reaper",
      description: "Brake reaper test workspace",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: "brake-reaper-prospect",
      data: {},
      status: "new",
      qualificationStatus: "pending",
      updatedAt: 1,
    });
    const laneId = await ctx.db.insert("tenantJobLanes", {
      tenantKey: `workspace:${workspaceId}`,
      workspaceId,
      userId,
      state: "paused",
      pendingCount: 0,
      runningCount: 0,
      minPriority: Number.MAX_SAFE_INTEGER,
      lastDispatchedAt: 0,
      updatedAt: 1,
    });
    const jobId = await ctx.db.insert("tenantJobs", {
      tenantKey: `workspace:${workspaceId}`,
      laneId,
      workspaceId,
      userId,
      class: "background",
      kind: "qualification",
      status: "running",
      priority: 5,
      idempotencyKey: "qualification:brake-reaper:1",
      payload: {
        kind: "qualification",
        prospectId,
        workspaceId,
        preview: false,
      },
      queuedAt: 1000,
      startedAt: 1100,
      leaseExpiresAt: 1200,
      attemptCount: 1,
      updatedAt: 1,
    });
    return { jobId };
  });
}

describe("PAUSE_AUTONOMOUS_JOBS gates maintenance crons", () => {
  test("usage rollover and lane reconcile do nothing while paused", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    vi.stubEnv("PAUSE_AUTONOMOUS_JOBS", "true");
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "brake-maintenance-user",
        email: "brake-maintenance@example.test",
      });
      const laneId = await ctx.db.insert("tenantJobLanes", {
        tenantKey: "workspace:brake-maintenance",
        userId,
        state: "idle",
        pendingCount: 0,
        runningCount: 0,
        minPriority: Number.MAX_SAFE_INTEGER,
        lastDispatchedAt: 0,
        updatedAt: 1,
      });
      const staleCycleId = await ctx.db.insert("planUsageCycles", {
        userId,
        tier: "hobby",
        cycleStart: Date.UTC(2026, 8, 1),
        cycleEnd: Date.UTC(2026, 8, 30, 23, 59, 59, 999),
        prospectsUsed: 3,
        prospectsLimit: 100,
        workspacesUsed: 1,
        workspacesLimit: 1,
        isCurrent: true,
        updatedAt: 1,
      });
      return { laneId, staleCycleId };
    });

    const laneResult = await t.mutation(
      internal.tenantScheduler.reconcileQueuedLanesInternal,
      {}
    );
    expect(laneResult).toEqual({ reconciled: 0, hasMore: false });

    await t.mutation(internal.planUsage.rolloverStaleUsageCycles, {});

    const state = await t.run(async (ctx) => ({
      lane: await ctx.db.get("tenantJobLanes", seeded.laneId),
      staleCycle: await ctx.db.get("planUsageCycles", seeded.staleCycleId),
    }));
    expect(state.lane?.updatedAt).toBe(1);
    expect(state.staleCycle?.isCurrent).toBe(true);
    expect(state.staleCycle?.prospectsUsed).toBe(3);
  });

  test("expired-lease reaper skips while paused", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    vi.stubEnv("PAUSE_AUTONOMOUS_JOBS", "true");
    const t = convexTest(schema, modules);
    const { jobId } = await seedExpiredLeaseJob(t);

    const reaped = await t.mutation(
      internal.tenantScheduler.reapExpiredJobsInternal,
      {}
    );
    expect(reaped).toEqual({ reaped: 0, hasMore: false });

    const job = await t.run(async (ctx) => ctx.db.get("tenantJobs", jobId));
    expect(job?.status).toBe("running");
  });

  test("expired-lease reaper reaps without the brake", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    vi.stubEnv("PAUSE_AUTONOMOUS_JOBS", "");
    const t = convexTest(schema, modules);
    const { jobId } = await seedExpiredLeaseJob(t);

    const reaped = await t.mutation(
      internal.tenantScheduler.reapExpiredJobsInternal,
      {}
    );
    expect(reaped).toEqual({ reaped: 1, hasMore: false });

    const job = await t.run(async (ctx) => ctx.db.get("tenantJobs", jobId));
    expect(job?.status).toBe("failed");
    expect(job?.errorMessage).toBe("Tenant job lease expired");
  });
});
