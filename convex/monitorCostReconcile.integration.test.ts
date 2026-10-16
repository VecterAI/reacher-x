/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import schema from "./schema";
import {
  QUALIFICATION_MAX_WORKFLOW_ATTEMPTS,
  hasReachedQualificationRetryCap,
} from "./lib/qualificationFailureCore";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.useRealTimers();
});

interface ReconcileFixture {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  pausedWorkspaceId: Id<"workspaces">;
}

async function seedReconcileFixture(
  t: ReturnType<typeof convexTest>
): Promise<ReconcileFixture> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "monitor-reconcile-user",
      email: "monitor-reconcile@example.test",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Running workspace",
      description: "Running workspace",
      isDefault: true,
      prospectingWorkflowStatus: "running",
      updatedAt: 1,
    });
    const pausedWorkspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Paused workspace",
      description: "Paused workspace",
      isDefault: false,
      prospectingWorkflowStatus: "paused",
      updatedAt: 1,
    });
    return { workspaceId, userId, pausedWorkspaceId };
  });
}

async function insertSeedMonitor(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    monitorId: string;
    status: "active" | "paused" | "deleted";
    conversationSeedId?: Id<"twitterConversationSeeds">;
    purpose?: "workspace_query" | "conversation_seed";
    keywordId?: Id<"keywords">;
  }
) {
  return await t.run((ctx) =>
    ctx.db.insert("socialQueryMonitors", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      monitorId: args.monitorId,
      query: `conversation_id:${args.monitorId}`,
      refreshFrequency: 3600,
      status: args.status,
      ...(args.purpose === undefined ? {} : { purpose: args.purpose }),
      ...(args.conversationSeedId === undefined
        ? {}
        : { conversationSeedId: args.conversationSeedId }),
      ...(args.keywordId === undefined ? {} : { keywordId: args.keywordId }),
    })
  );
}

async function insertSeed(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    rootTweetId: string;
    monitorId?: string;
    status?: "pending_backfill" | "active" | "paused" | "archived" | "failed";
  }
) {
  return await t.run((ctx) =>
    ctx.db.insert("twitterConversationSeeds", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      rootTweetId: args.rootTweetId,
      conversationId: args.rootTweetId,
      rootTweetData: {},
      seedScore: 0.8,
      seedScoreBreakdown: {
        topicalFit: 0.8,
        freshness: 0.8,
        engagement: 0.8,
        authorQuality: 0.8,
        replyLikelihood: 0.8,
        total: 4,
      },
      status: args.status ?? "active",
      ...(args.monitorId === undefined ? {} : { monitorId: args.monitorId }),
      updatedAt: 1,
    })
  );
}

describe("socialapi monitor cost reconciliation", () => {
  test("workspace automation states separate running from dormant workspaces", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId, pausedWorkspaceId } = await seedReconcileFixture(t);

    const page = await t.query(
      internal.socialapiMonitors.listWorkspaceAutomationStatesInternal,
      {}
    );
    const running = page.workspaces.find(
      (state) => state.workspaceId === workspaceId
    );
    const paused = page.workspaces.find(
      (state) => state.workspaceId === pausedWorkspaceId
    );
    expect(running?.automationActive).toBe(true);
    expect(paused?.automationActive).toBe(false);
  });

  test("drain candidates list only seed monitors of the given workspace", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId, pausedWorkspaceId } =
      await seedReconcileFixture(t);

    const pausedSeedMonitor = await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "paused-seed-monitor",
      status: "active",
      purpose: "conversation_seed",
    });
    await insertSeedMonitor(t, {
      workspaceId,
      userId,
      monitorId: "running-seed-monitor",
      status: "active",
      purpose: "conversation_seed",
    });
    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "paused-query-monitor",
      status: "active",
      purpose: "workspace_query",
    });
    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "already-deleted",
      status: "deleted",
      purpose: "conversation_seed",
    });

    const pausedCandidates = await t.query(
      internal.socialapiMonitors.listWorkspaceMonitorDrainCandidatesInternal,
      { workspaceId: pausedWorkspaceId, limit: 25 }
    );
    expect(pausedCandidates.rows.map((monitor) => monitor._id)).toEqual([
      pausedSeedMonitor,
    ]);
    expect(pausedCandidates.isDone).toBe(true);

    // A workspace that became active mid-run is never drained.
    const activeGuard = await t.query(
      internal.socialapiMonitors.listWorkspaceMonitorDrainCandidatesInternal,
      { workspaceId, limit: 25 }
    );
    expect(activeGuard.rows).toEqual([]);
    expect(activeGuard.isDone).toBe(true);
  });

  test("marking monitors deleted clears seed and keyword pointers", async () => {
    const t = convexTest(schema, modules);
    const { userId, pausedWorkspaceId } = await seedReconcileFixture(t);

    const keywordId = await t.run((ctx) =>
      ctx.db.insert("keywords", {
        workspaceId: pausedWorkspaceId,
        type: "social_query",
        value: "founder pain",
        status: "active",
        monitorId: "keyword-linked-monitor",
      })
    );
    const seedId = await insertSeed(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      rootTweetId: "111",
      monitorId: "keyword-linked-monitor",
    });
    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "keyword-linked-monitor",
      status: "active",
      purpose: "workspace_query",
      conversationSeedId: seedId,
      keywordId,
    });
    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "already-gone",
      status: "deleted",
    });

    const result = await t.mutation(
      internal.socialapiMonitors.markMonitorsDeletedWithSeedCleanupInternal,
      { monitorIds: ["keyword-linked-monitor", "already-gone"] }
    );
    expect(result.marked).toBe(1);

    const state = await t.run(async (ctx) => ({
      keyword: await ctx.db.get(keywordId),
      seed: await ctx.db.get(seedId),
      monitors: await ctx.db.query("socialQueryMonitors").collect(),
    }));

    expect(state.keyword?.monitorId).toBeUndefined();
    expect(state.seed?.monitorId).toBeUndefined();
    const linked = state.monitors.find(
      (monitor) => monitor.monitorId === "keyword-linked-monitor"
    );
    expect(linked?.status).toBe("deleted");
  });

  test("drift candidates are live rows missing from a complete remote listing", async () => {
    vi.useFakeTimers();
    const start = Date.UTC(2026, 10, 1, 12);
    vi.setSystemTime(start);
    const t = convexTest(schema, modules);
    const { userId, workspaceId } = await seedReconcileFixture(t);

    await insertSeedMonitor(t, {
      workspaceId,
      userId,
      monitorId: "missing-remotely",
      status: "active",
      purpose: "conversation_seed",
    });
    await insertSeedMonitor(t, {
      workspaceId,
      userId,
      monitorId: "listed-remotely",
      status: "active",
      purpose: "conversation_seed",
    });

    // Advance past the drift grace window, then create the fresh row in the
    // same workspace so its exclusion is attributable to the grace filter
    // and not to workspace scoping.
    vi.setSystemTime(start + 20 * 60 * 1000);
    await insertSeedMonitor(t, {
      workspaceId,
      userId,
      monitorId: "fresh-row",
      status: "active",
      purpose: "conversation_seed",
    });

    const graceCutoff = Date.now() - 10 * 60 * 1000;
    const candidates = await t.query(
      internal.socialapiMonitors.listWorkspaceDriftCandidatesInternal,
      {
        workspaceId,
        remoteMonitorIds: ["listed-remotely"],
        limit: 25,
        graceCutoff,
      }
    );
    // Only the stale row missing from the remote listing is a candidate; the
    // listed row and the row created inside the grace window are skipped.
    expect(candidates.rows.map((candidate) => candidate.monitorId)).toEqual([
      "missing-remotely",
    ]);

    // Rows created after the grace cutoff are never marked drifted.
    const recentOnly = await t.query(
      internal.socialapiMonitors.listWorkspaceDriftCandidatesInternal,
      {
        workspaceId,
        remoteMonitorIds: [],
        limit: 25,
        graceCutoff: start,
      }
    );
    expect(
      recentOnly.rows.some((candidate) => candidate.monitorId === "fresh-row")
    ).toBe(false);
  });

  test("unknown remote monitor ids are those matching neither monitor table", async () => {
    const t = convexTest(schema, modules);
    const { userId, pausedWorkspaceId } = await seedReconcileFixture(t);

    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "tracked-monitor",
      status: "active",
      purpose: "conversation_seed",
    });
    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "tracked-deleted-monitor",
      status: "deleted",
      purpose: "conversation_seed",
    });
    const prospectWithMonitorId = await t.run((ctx) =>
      ctx.db.insert("prospects", {
        userId,
        workspaceId: pausedWorkspaceId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "prospect-with-monitor",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        updatedAt: 1,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert("prospectMonitors", {
        prospectId: prospectWithMonitorId,
        workspaceId: pausedWorkspaceId,
        userId,
        monitorId: "tracked-prospect-monitor",
        monitoredUserId: "999",
        monitoredUsername: "someone",
        status: "active",
      })
    );

    const unknown = await t.query(
      internal.socialapiMonitors.listUnknownRemoteMonitorIdsInternal,
      {
        remoteMonitorIds: [
          "tracked-monitor",
          "tracked-deleted-monitor",
          "tracked-prospect-monitor",
          "orphan-monitor",
        ],
      }
    );
    // Tracked live discovery monitors and tracked live outreach response
    // monitors are never orphans. Rows already marked deleted still surface
    // when the remote monitor is (still) listed, so older paths that marked
    // rows deleted without a confirmed deletion get reclaimed.
    expect(unknown).toEqual(["tracked-deleted-monitor", "orphan-monitor"]);
  });

  test("stale seed pointers are listed and cleared with an expected monitor guard", async () => {
    const t = convexTest(schema, modules);
    const { userId, pausedWorkspaceId } = await seedReconcileFixture(t);

    const staleSeed = await insertSeed(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      rootTweetId: "222",
      monitorId: "drained-monitor",
    });
    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "drained-monitor",
      status: "deleted",
      purpose: "conversation_seed",
    });
    const liveSeed = await insertSeed(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      rootTweetId: "333",
      monitorId: "live-monitor",
    });
    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "live-monitor",
      status: "active",
      purpose: "conversation_seed",
    });

    const stale = await t.query(
      internal.xConversationDiscovery.listStaleSeedMonitorPointersInternal,
      { workspaceId: pausedWorkspaceId }
    );
    expect(stale).toEqual([
      { seedId: staleSeed, monitorId: "drained-monitor" },
    ]);

    const wrongGuard = await t.mutation(
      internal.xConversationDiscovery.clearSeedMonitorPointerInternal,
      { seedId: liveSeed, expectedMonitorId: "drained-monitor" }
    );
    expect(wrongGuard.cleared).toBe(false);

    const cleared = await t.mutation(
      internal.xConversationDiscovery.clearSeedMonitorPointerInternal,
      { seedId: staleSeed, expectedMonitorId: "drained-monitor" }
    );
    expect(cleared.cleared).toBe(true);
    const seedAfter = await t.run((ctx) => ctx.db.get(staleSeed));
    expect(seedAfter?.monitorId).toBeUndefined();
  });
});

describe("stale work cleanup", () => {
  async function seedProspect(
    t: ReturnType<typeof convexTest>,
    args: {
      userId: Id<"users">;
      workspaceId: Id<"workspaces">;
      externalId: string;
      updatedAt: number;
      qualificationStatus?: "pending" | "qualified" | "disqualified";
      failure?: {
        stage: "evidence_fetch" | "model_evaluation" | "workflow";
        provider: string;
        code: string;
        message: string;
        workflowAttemptCount?: number;
        failedAt: number;
      };
    }
  ) {
    return await t.run((ctx) =>
      ctx.db.insert("prospects", {
        userId: args.userId,
        workspaceId: args.workspaceId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: args.externalId,
        data: {},
        status: "new",
        qualificationStatus: args.qualificationStatus ?? "pending",
        ...(args.failure === undefined
          ? {}
          : { qualificationLastFailure: args.failure }),
        updatedAt: args.updatedAt,
      })
    );
  }

  test("caps stale pending qualifications in dormant workspaces and recovery ignores them", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId, pausedWorkspaceId } =
      await seedReconcileFixture(t);
    const cutoff = Date.now();
    const originalFailure = {
      stage: "workflow" as const,
      provider: "openrouter",
      code: "provider_transient",
      message: "transient failure",
      workflowAttemptCount: 2,
      failedAt: cutoff - 1000,
    };

    const noFailure = await seedProspect(t, {
      userId,
      workspaceId: pausedWorkspaceId,
      externalId: "zombie-no-failure",
      updatedAt: cutoff - 1000,
    });
    const subCap = await seedProspect(t, {
      userId,
      workspaceId: pausedWorkspaceId,
      externalId: "zombie-sub-cap",
      updatedAt: cutoff - 1000,
      failure: originalFailure,
    });
    const alreadyCapped = await seedProspect(t, {
      userId,
      workspaceId: pausedWorkspaceId,
      externalId: "zombie-already-capped",
      updatedAt: cutoff - 1000,
      failure: {
        ...originalFailure,
        workflowAttemptCount: QUALIFICATION_MAX_WORKFLOW_ATTEMPTS,
      },
    });
    await seedProspect(t, {
      userId,
      workspaceId,
      externalId: "running-workspace-pending",
      updatedAt: cutoff - 1000,
    });

    const result = await t.mutation(
      internal.staleWorkMaintenance.capStalePendingQualificationBatchInternal,
      { workspaceId: pausedWorkspaceId, cutoff, cursor: null }
    );
    expect(result.newlyCapped).toBe(2);
    // The batch paginates its own workspace; the running workspace is never
    // scanned by this call.
    expect(result.isDone).toBe(true);

    const [noFailureDoc, subCapDoc, alreadyCappedDoc] = await t.run(
      async (ctx) => [
        await ctx.db.get(noFailure),
        await ctx.db.get(subCap),
        await ctx.db.get(alreadyCapped),
      ]
    );

    expect(
      hasReachedQualificationRetryCap(
        noFailureDoc?.qualificationLastFailure?.workflowAttemptCount ?? 0
      )
    ).toBe(true);
    expect(noFailureDoc?.qualificationLastFailure?.code).toBe(
      "stale_reconcile_cleanup"
    );
    expect(
      hasReachedQualificationRetryCap(
        subCapDoc?.qualificationLastFailure?.workflowAttemptCount ?? 0
      )
    ).toBe(true);
    // The original failure record is preserved, only the retry budget caps.
    expect(subCapDoc?.qualificationLastFailure?.code).toBe(
      "provider_transient"
    );
    expect(subCapDoc?.qualificationLastFailure?.failedAt).toBe(
      originalFailure.failedAt
    );
    expect(alreadyCappedDoc?.qualificationLastFailure?.code).toBe(
      "provider_transient"
    );

    // Recovery must refuse to resurrect any of them.
    for (const prospectId of [noFailure, subCap, alreadyCapped]) {
      const snapshot = await t.run(async (ctx) => {
        const prospect = await ctx.db.get(prospectId);
        if (!prospect) {
          throw new Error("Expected prospect to exist");
        }
        return {
          updatedAt: prospect.updatedAt,
          workflowId: prospect.qualificationWorkflowId,
          failedAt: prospect.qualificationLastFailure?.failedAt,
        };
      });
      const claim = await t.mutation(
        internal.prospects.claimPendingQualificationRecoveryInternal,
        {
          prospectId,
          expectedUpdatedAt: snapshot.updatedAt,
          expectedWorkflowId: snapshot.workflowId,
          expectedFailureAt: snapshot.failedAt,
          now: Date.now(),
        }
      );
      expect(claim).toEqual({
        claimed: false,
        scheduled: false,
        reason: "ineligible",
      });
    }
  });

  test("exhausts failed auto-plan runs in dormant workspaces so recovery claims nothing", async () => {
    const t = convexTest(schema, modules);
    const { userId, workspaceId, pausedWorkspaceId } =
      await seedReconcileFixture(t);

    const dormantProspectId = await t.run((ctx) =>
      ctx.db.insert("prospects", {
        userId: userId,
        workspaceId: pausedWorkspaceId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "plan-zombie",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        updatedAt: 1,
      })
    );
    const dormantRun = await t.run((ctx) =>
      ctx.db.insert("autoPlanRuns", {
        prospectId: dormantProspectId,
        workspaceId: pausedWorkspaceId,
        userId: userId,
        status: "failed",
        attemptCount: 1,
        errorCode: "provider_transient",
        errorMessage: "transient provider failure",
        updatedAt: 1,
      })
    );
    const activeProspectId = await t.run((ctx) =>
      ctx.db.insert("prospects", {
        userId: userId,
        workspaceId: workspaceId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "plan-active",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        updatedAt: 1,
      })
    );
    const activeWorkspaceRun = await t.run((ctx) =>
      ctx.db.insert("autoPlanRuns", {
        prospectId: activeProspectId,
        workspaceId: workspaceId,
        userId: userId,
        status: "failed",
        attemptCount: 1,
        errorCode: "provider_transient",
        errorMessage: "transient provider failure",
        updatedAt: 1,
      })
    );

    const first = await t.mutation(
      internal.staleWorkMaintenance.exhaustStaleAutoPlanRecoveryBatchInternal,
      { workspaceId: pausedWorkspaceId, cursor: null }
    );
    expect(first.exhausted).toBe(1);
    expect(first.isDone).toBe(true);

    const dormantRunDoc = await t.run((ctx) => ctx.db.get(dormantRun));
    expect(dormantRunDoc?.recoveryRetriedAt).toBeTypeOf("number");
    expect(dormantRunDoc?.recoveryExhaustedAt).toBeTypeOf("number");

    // A running workspace's failed runs keep their recovery budget.
    const activeWorkspaceResult = await t.mutation(
      internal.staleWorkMaintenance.exhaustStaleAutoPlanRecoveryBatchInternal,
      { workspaceId, cursor: null }
    );
    expect(activeWorkspaceResult.exhausted).toBe(0);
    const activeRunDoc = await t.run((ctx) => ctx.db.get(activeWorkspaceRun));
    expect(activeRunDoc?.recoveryRetriedAt).toBeUndefined();

    // Nothing unclaimed remains for recovery to pick up.
    const second = await t.mutation(
      internal.staleWorkMaintenance.exhaustStaleAutoPlanRecoveryBatchInternal,
      { workspaceId: pausedWorkspaceId, cursor: null }
    );
    expect(second.exhausted).toBe(0);
  });

  test("expired monitor cleanup lists only active rows past their TTL", async () => {
    const t = convexTest(schema, modules);
    const { userId, pausedWorkspaceId } = await seedReconcileFixture(t);
    const now = Date.now();
    const prospectWithMonitorId = await t.run((ctx) =>
      ctx.db.insert("prospects", {
        userId,
        workspaceId: pausedWorkspaceId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "prospect-with-monitor",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        updatedAt: 1,
      })
    );

    const expiredId = await t.run((ctx) =>
      ctx.db.insert("prospectMonitors", {
        prospectId: prospectWithMonitorId,
        workspaceId: pausedWorkspaceId,
        userId,
        monitorId: "expired-monitor",
        monitoredUserId: "111",
        monitoredUsername: "expired",
        status: "active",
        expiresAt: now - 1000,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert("prospectMonitors", {
        prospectId: prospectWithMonitorId,
        workspaceId: pausedWorkspaceId,
        userId,
        monitorId: "no-expiry-monitor",
        monitoredUserId: "222",
        monitoredUsername: "noexpiry",
        status: "active",
      })
    );
    await t.run((ctx) =>
      ctx.db.insert("prospectMonitors", {
        prospectId: prospectWithMonitorId,
        workspaceId: pausedWorkspaceId,
        userId,
        monitorId: "future-expiry-monitor",
        monitoredUserId: "333",
        monitoredUsername: "future",
        status: "active",
        expiresAt: now + 60_000,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert("prospectMonitors", {
        prospectId: prospectWithMonitorId,
        workspaceId: pausedWorkspaceId,
        userId,
        monitorId: "deleted-expired-monitor",
        monitoredUserId: "444",
        monitoredUsername: "deleted",
        status: "deleted",
        expiresAt: now - 1000,
      })
    );

    const expired = await t.query(
      internal.prospectMonitors.getExpiredMonitors,
      {}
    );
    expect(expired.map((monitor) => monitor._id)).toEqual([expiredId]);
  });

  test("deletion drain query lists live remote monitor ids from both monitor tables", async () => {
    const t = convexTest(schema, modules);
    const { userId, pausedWorkspaceId } = await seedReconcileFixture(t);

    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "social-live",
      status: "active",
    });
    await insertSeedMonitor(t, {
      workspaceId: pausedWorkspaceId,
      userId,
      monitorId: "social-deleted",
      status: "deleted",
    });
    const prospectWithMonitorId = await t.run((ctx) =>
      ctx.db.insert("prospects", {
        userId: userId,
        workspaceId: pausedWorkspaceId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "prospect-with-monitor",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        updatedAt: 1,
      })
    );
    await t.run((ctx) =>
      ctx.db.insert("prospectMonitors", {
        prospectId: prospectWithMonitorId,
        workspaceId: pausedWorkspaceId,
        userId: userId,
        monitorId: "prospect-live",
        monitoredUserId: "999",
        monitoredUsername: "someone",
        status: "active",
      })
    );

    const remoteMonitorIds = await t.query(
      internal.lib.deleteWorkspaceCore.getWorkspaceRemoteMonitorIdsInternal,
      { workspaceId: pausedWorkspaceId }
    );
    expect(remoteMonitorIds).toEqual({
      socialMonitorIds: ["social-live"],
      prospectMonitorIds: ["prospect-live"],
    });
  });
});
