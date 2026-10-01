/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("cancel queued tenant jobs for a workspace", () => {
  test("cancels only queued jobs in bounded pages and refreshes the lane", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "tenant-cancel-user",
        email: "tenant-cancel@example.test",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Tenant cancel",
        description: "Tenant cancel test workspace",
        isDefault: true,
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
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "tenant-cancel-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        updatedAt: 1,
      });
      const queuedIds: string[] = [];
      for (let index = 0; index < 7; index += 1) {
        queuedIds.push(
          String(
            await ctx.db.insert("tenantJobs", {
              tenantKey: `workspace:${workspaceId}`,
              laneId,
              workspaceId,
              userId,
              class: "background",
              kind: "qualification",
              status: "queued",
              priority: 5,
              idempotencyKey: `qualification:cancel-${index}:1`,
              payload: {
                kind: "qualification",
                prospectId,
                workspaceId,
                preview: false,
              },
              queuedAt: 1000 + index,
              attemptCount: 0,
              updatedAt: 1,
            })
          )
        );
      }
      const runningId = await ctx.db.insert("tenantJobs", {
        tenantKey: `workspace:${workspaceId}`,
        laneId,
        workspaceId,
        userId,
        class: "background",
        kind: "qualification",
        status: "running",
        priority: 5,
        idempotencyKey: "qualification:cancel-running:1",
        payload: {
          kind: "qualification",
          prospectId,
          workspaceId,
          preview: false,
        },
        queuedAt: 1000,
        attemptCount: 1,
        updatedAt: 1,
      });
      const succeededId = await ctx.db.insert("tenantJobs", {
        tenantKey: `workspace:${workspaceId}`,
        laneId,
        workspaceId,
        userId,
        class: "background",
        kind: "qualification",
        status: "succeeded",
        priority: 5,
        idempotencyKey: "qualification:cancel-done:1",
        payload: {
          kind: "qualification",
          prospectId,
          workspaceId,
          preview: false,
        },
        queuedAt: 1000,
        completedAt: 2000,
        attemptCount: 1,
        updatedAt: 1,
      });
      return { workspaceId, queuedIds, runningId, succeededId, laneId };
    });

    const firstPage = await t.mutation(
      internal.tenantScheduler.cancelQueuedTenantJobsForWorkspaceInternal,
      { workspaceId: seeded.workspaceId, batchSize: 5 }
    );
    expect(firstPage).toEqual({ cancelled: 5, hasMore: true });

    const secondPage = await t.mutation(
      internal.tenantScheduler.cancelQueuedTenantJobsForWorkspaceInternal,
      { workspaceId: seeded.workspaceId, batchSize: 5 }
    );
    expect(secondPage).toEqual({ cancelled: 2, hasMore: false });

    const thirdPage = await t.mutation(
      internal.tenantScheduler.cancelQueuedTenantJobsForWorkspaceInternal,
      { workspaceId: seeded.workspaceId }
    );
    expect(thirdPage).toEqual({ cancelled: 0, hasMore: false });

    const jobs = await t.run(async (ctx) => ({
      cancelled: await ctx.db
        .query("tenantJobs")
        .withIndex("by_workspace_and_status", (q) =>
          q.eq("workspaceId", seeded.workspaceId).eq("status", "cancelled")
        )
        .collect(),
      running: await ctx.db.get("tenantJobs", seeded.runningId),
      succeeded: await ctx.db.get("tenantJobs", seeded.succeededId),
      lane: await ctx.db.get("tenantJobLanes", seeded.laneId),
    }));

    expect(jobs.cancelled).toHaveLength(7);
    expect(jobs.cancelled.every((job) => job.completedAt !== undefined)).toBe(
      true
    );
    expect(jobs.running?.status).toBe("running");
    expect(jobs.succeeded?.status).toBe("succeeded");
    // The paused lane stays paused; its marker is untouched by cancellation.
    expect(jobs.lane?.state).toBe("paused");
  });
});
