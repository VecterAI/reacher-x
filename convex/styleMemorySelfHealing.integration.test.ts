/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import {
  classifyAutoPlanFailure,
  isAutoPlanFailureRecoveryEligible,
} from "./lib/autoPlanCore";
import {
  STYLE_MEMORY_RECOVERY_MAX_ATTEMPTS,
  getWorkspaceWritingStyleContext,
} from "./lib/workspaceStyleProfileCore";
import { upsertCanonicalWorkspaceMemory } from "./lib/workspaceMemoryCore";
import schema from "./schema";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const modules = import.meta.glob("./**/*.ts");

async function seedOrphanedTwitterStyle(
  t: ReturnType<typeof convexTest>,
  suffix: string
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `style-repair-${suffix}`,
      email: `style-repair-${suffix}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Style repair ${suffix}`,
      description: "Style repair integration test",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    const sourceVersion = 10_000;
    const sourceExternalUserId = `x-user-${suffix}`;
    await ctx.db.insert("xAccounts", {
      userId,
      xUserId: sourceExternalUserId,
      styleSourceKey: `twitter:${sourceExternalUserId}`,
      styleSourceVersion: sourceVersion,
      username: `style_repair_${suffix}`,
      accessToken: "test-access-token",
      expiresAt: 99_999_999,
      grantedScopes: ["tweet.read", "users.read"],
      tokenType: "bearer",
      status: "connected",
      updatedAt: 1,
    });
    await ctx.db.insert("workspaceStyleProfiles", {
      workspaceId,
      userId,
      platform: "twitter",
      status: "ready",
      version: 1,
      sourceKey: `twitter:${sourceExternalUserId}`,
      sourceVersion,
      sourceExternalUserId,
      sampleCount: 5,
      editDiffCount: 0,
      promotedMemoryId: `missing-memory-${suffix}`,
    });
    for (let index = 0; index < 5; index += 1) {
      await ctx.db.insert("styleContentSamples", {
        userId,
        platform: "twitter",
        sourceVersion,
        sourceExternalUserId,
        externalContentId: `${suffix}-sample-${index}`,
        fullText: `A realistic writing-style sample number ${index}.`,
        contentType: "original_post",
        postedAt: index + 1,
        source: "backfill",
        processedForStyle: true,
      });
    }
    return { sourceExternalUserId, sourceVersion, userId, workspaceId };
  });
}

async function addCanonicalTwitterStyle(
  t: ReturnType<typeof convexTest>,
  args: Awaited<ReturnType<typeof seedOrphanedTwitterStyle>>
) {
  await t.run(async (ctx) => {
    await upsertCanonicalWorkspaceMemory(ctx.db, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      source: "style_analysis",
      category: "writing_style_profile_twitter",
      namespace: "style",
      kind: "writing_style_profile_twitter",
      title: "X Writing Style Profile",
      summary: "Concise, practical, and direct.",
      canonicalContent: "Use concise, practical sentences with a direct tone.",
      confidence: 0.9,
      impactScore: 0.95,
    });
  });
}

async function addCanonicalLinkedInStyle(
  t: ReturnType<typeof convexTest>,
  args: Awaited<ReturnType<typeof seedOrphanedTwitterStyle>>
) {
  await t.run(async (ctx) => {
    await upsertCanonicalWorkspaceMemory(ctx.db, {
      userId: args.userId,
      workspaceId: args.workspaceId,
      source: "style_analysis",
      category: "writing_style_profile_linkedin",
      namespace: "style",
      kind: "writing_style_profile_linkedin",
      title: "LinkedIn Writing Style Profile",
      summary: "A LinkedIn-only style.",
      canonicalContent: "Use the LinkedIn writing style.",
      confidence: 0.9,
      impactScore: 0.95,
    });
  });
}

describe("writing-style memory self-healing", () => {
  test("detects an orphan and prefers the canonical style after repair", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedOrphanedTwitterStyle(t, "context");

    const orphaned = await t.query(
      internal.workspaceStyleProfiles.getWorkspaceWritingStyleContextInternal,
      { workspaceId: seeded.workspaceId, platform: "twitter" }
    );
    expect(orphaned).toEqual({
      status: "not_ready",
      reason: "memory_missing",
      profileVersion: 1,
    });

    await addCanonicalTwitterStyle(t, seeded);
    const repaired = await t.run(async (ctx) =>
      getWorkspaceWritingStyleContext(ctx.db, {
        workspaceId: seeded.workspaceId,
        platform: "twitter",
      })
    );
    expect(repaired).toMatchObject({
      status: "ready",
      source: "canonical",
      writingStyle: "Use concise, practical sentences with a direct tone.",
    });
  });

  test("queues one deterministic repair event across repeated calls", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedOrphanedTwitterStyle(t, "idempotent");
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("workspaceStyleProfiles")
        .withIndex("by_workspace_platform", (q) =>
          q.eq("workspaceId", seeded.workspaceId).eq("platform", "twitter")
        )
        .unique();
      if (!profile) throw new Error("Expected seeded style profile");
      await ctx.db.patch(profile._id, {
        lastError: "Prior repair failed",
        lastErrorAt: 500,
      });
    });

    const first = await t.mutation(
      internal.styleAnalysis.bootstrapWorkspaceStyleProfilesForWorkspace,
      { workspaceId: seeded.workspaceId, userId: seeded.userId }
    );
    const second = await t.mutation(
      internal.styleAnalysis.bootstrapWorkspaceStyleProfilesForWorkspace,
      { workspaceId: seeded.workspaceId, userId: seeded.userId }
    );

    expect(first.find(({ platform }) => platform === "twitter")).toMatchObject({
      status: "scheduled",
      reason: "scheduled",
    });
    expect(second.find(({ platform }) => platform === "twitter")).toMatchObject(
      { status: "skipped", reason: "already_queued" }
    );

    const state = await t.run(async (ctx) => ({
      events: await ctx.db
        .query("memoryWorkflowEvents")
        .withIndex("by_workspace_event_type_occurred_at", (q) =>
          q
            .eq("workspaceId", seeded.workspaceId)
            .eq("eventType", "style_content_backfill_completed")
        )
        .collect(),
      profile: await ctx.db
        .query("workspaceStyleProfiles")
        .withIndex("by_workspace_platform", (q) =>
          q.eq("workspaceId", seeded.workspaceId).eq("platform", "twitter")
        )
        .unique(),
    }));
    expect(state.events).toHaveLength(1);
    expect(state.events[0].eventKey).toContain("style-repair:");
    expect(state.events[0].status).toBe("pending");
    expect(state.profile?.status).toBe("collecting");
  });

  test("rejects a platform repair request with mismatched workspace ownership", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedOrphanedTwitterStyle(t, "ownership");
    const otherUserId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        workosUserId: "style-repair-other-user",
        email: "style-repair-other-user@example.com",
      })
    );

    expect(
      await t.mutation(
        internal.styleAnalysis.bootstrapWorkspaceStyleProfileForPlatform,
        {
          workspaceId: seeded.workspaceId,
          userId: otherUserId,
          platform: "twitter",
        }
      )
    ).toEqual({
      platform: "twitter",
      status: "skipped",
      reason: "no_workspace",
    });
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("memoryWorkflowEvents")
          .withIndex("by_workspace_occurred_at", (q) =>
            q.eq("workspaceId", seeded.workspaceId)
          )
          .collect()
      )
    ).toEqual([]);
  });

  test("bounds repeated repair attempts within the recovery window", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedOrphanedTwitterStyle(t, "bounded");

    await t.run(async (ctx) => {
      for (
        let attempt = 0;
        attempt < STYLE_MEMORY_RECOVERY_MAX_ATTEMPTS;
        attempt += 1
      ) {
        await ctx.db.insert("memoryWorkflowEvents", {
          workspaceId: seeded.workspaceId,
          eventType: "style_content_backfill_completed",
          status: "failed",
          sourceType: "style_content",
          sourceId: `style-repair:${String(seeded.userId)}:twitter:${seeded.sourceVersion}`,
          eventKey: `prior-style-repair-${attempt}`,
          occurredAt: getCurrentUTCTimestamp(),
        });
      }
    });

    const result = await t.mutation(
      internal.styleAnalysis.bootstrapWorkspaceStyleProfilesForWorkspace,
      { workspaceId: seeded.workspaceId, userId: seeded.userId }
    );
    expect(result.find(({ platform }) => platform === "twitter")).toMatchObject(
      { status: "skipped", reason: "recovery_exhausted" }
    );
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("workspaceStyleProfiles")
          .withIndex("by_workspace_platform", (q) =>
            q.eq("workspaceId", seeded.workspaceId).eq("platform", "twitter")
          )
          .unique()
      )
    ).toMatchObject({
      status: "failed",
      lastError: "Writing style memory recovery attempts were exhausted",
    });
  });

  test("claims a failed auto-plan only after its exact platform style is ready", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedOrphanedTwitterStyle(t, "recovery");
    const { prospectId, runId } = await t.run(async (ctx) => {
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "style-recovery-prospect",
        data: {},
        status: "in_progress",
        planGenerationStatus: "failed",
        updatedAt: 1,
      });
      const runId = await ctx.db.insert("autoPlanRuns", {
        prospectId,
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        status: "failed",
        attemptCount: 1,
        errorCode: "writing_style_unavailable",
        errorMessage: "Workspace writing style repair is in progress",
        retryable: false,
        completedAt: 1,
        updatedAt: 1,
      });
      return { prospectId, runId };
    });

    await addCanonicalLinkedInStyle(t, seeded);
    expect(
      await t.mutation(
        internal.autoPlanRuns.claimFailedAutoPlanRecoveryBatchGlobal,
        { limit: 10 }
      )
    ).toEqual([]);
    expect(
      await t.run(async (ctx) => (await ctx.db.get(runId))?.recoveryRetriedAt)
    ).toBeNull();

    await addCanonicalTwitterStyle(t, seeded);
    const claimed = await t.mutation(
      internal.autoPlanRuns.claimFailedAutoPlanRecoveryBatchGlobal,
      { limit: 10 }
    );
    expect(claimed).toEqual([
      expect.objectContaining({
        sourceRunId: runId,
        prospectId,
        workspaceId: seeded.workspaceId,
      }),
    ]);
    expect(
      await t.run(async (ctx) => (await ctx.db.get(runId))?.recoveryRetriedAt)
    ).toEqual(expect.any(Number));
  });

  test("uses friendly automatic-repair semantics for auto-plan failures", () => {
    const failure = classifyAutoPlanFailure(
      "Workspace writing style repair is in progress"
    );
    expect(failure).toMatchObject({
      code: "writing_style_unavailable",
      retryable: false,
      userMessage:
        "Agent is refreshing the writing style and will retry automatically.",
    });
    expect(failure.actionLabel).toBeUndefined();
    expect(isAutoPlanFailureRecoveryEligible(failure.code)).toBe(true);
  });
});
