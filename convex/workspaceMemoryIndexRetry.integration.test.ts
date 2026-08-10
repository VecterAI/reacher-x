/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import schema from "./schema";
import {
  claimFailedCanonicalWorkspaceMemoryIndexRetries,
  getWorkspaceMemoryIndexRetryDelayMs,
  markCanonicalWorkspaceMemoryIndexResult,
  upsertCanonicalWorkspaceMemory,
  WORKSPACE_MEMORY_INDEX_RETRY_BASE_DELAY_MS,
  WORKSPACE_MEMORY_INDEX_RETRY_MAX_DELAY_MS,
  WORKSPACE_MEMORY_INDEX_RETRY_MAX_FAILURES,
  WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS,
} from "./lib/workspaceMemoryCore";

const modules = import.meta.glob("./**/*.ts");

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "workspace-memory-index-retry-user",
      email: "workspace-memory-index-retry@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Workspace memory index retry test",
      description: "Workspace memory index retry test",
      isDefault: true,
      entitlementSlot: 1,
      updatedAt: 1,
    });
    return { userId, workspaceId };
  });
}

async function insertCanonicalMemory(
  t: ReturnType<typeof convexTest>,
  seeded: Awaited<ReturnType<typeof seedWorkspace>>,
  label: string
): Promise<Id<"workspaceMemories">> {
  return await t.run(async (ctx) => {
    const result = await upsertCanonicalWorkspaceMemory(ctx.db, {
      ...seeded,
      source: "operator",
      category: "operator_instruction",
      namespace: "lessons",
      kind: "retry_test",
      title: label,
      summary: label,
      canonicalContent: `Exact canonical memory: ${label}`,
      confidence: 1,
      impactScore: 1,
    });
    const memoryId = ctx.db.normalizeId(
      "workspaceMemories",
      result.memory.memoryId
    );
    if (!memoryId) {
      throw new Error("Expected a canonical workspace memory ID");
    }
    return memoryId;
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("workspace memory embedding retry", () => {
  test("uses deterministic capped exponential backoff", () => {
    expect(getWorkspaceMemoryIndexRetryDelayMs(0)).toBe(
      WORKSPACE_MEMORY_INDEX_RETRY_BASE_DELAY_MS
    );
    expect(getWorkspaceMemoryIndexRetryDelayMs(1)).toBe(
      WORKSPACE_MEMORY_INDEX_RETRY_BASE_DELAY_MS * 2
    );
    expect(getWorkspaceMemoryIndexRetryDelayMs(100)).toBe(
      WORKSPACE_MEMORY_INDEX_RETRY_MAX_DELAY_MS
    );
  });

  test("claims due and legacy failures without selecting ineligible rows", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    const now = 1_000_000;
    const exhaustedId = await insertCanonicalMemory(t, seeded, "exhausted");
    const dueId = await insertCanonicalMemory(t, seeded, "due");
    const futureId = await insertCanonicalMemory(t, seeded, "future");
    const nonRetryableId = await insertCanonicalMemory(
      t,
      seeded,
      "non-retryable"
    );
    const readyId = await insertCanonicalMemory(t, seeded, "ready");
    const disabledId = await insertCanonicalMemory(t, seeded, "disabled");
    const legacyId = await insertCanonicalMemory(t, seeded, "legacy");

    const beforeUpdatedAt = await t.run(async (ctx) => {
      await ctx.db.patch(exhaustedId, {
        indexStatus: "failed",
        indexRetryable: true,
        indexRetryCount: WORKSPACE_MEMORY_INDEX_RETRY_MAX_FAILURES,
        indexRetryAt: now - 200,
      });
      await ctx.db.patch(dueId, {
        indexStatus: "failed",
        indexRetryable: true,
        indexRetryCount: 0,
        indexRetryAt: now - 100,
      });
      await ctx.db.patch(futureId, {
        indexStatus: "failed",
        indexRetryable: true,
        indexRetryAt: now + 1,
      });
      await ctx.db.patch(nonRetryableId, {
        indexStatus: "failed",
        indexRetryable: false,
      });
      await ctx.db.patch(readyId, {
        indexStatus: "ready",
        indexRetryable: true,
        indexRetryAt: now - 1,
      });
      await ctx.db.patch(disabledId, {
        status: "disabled",
        indexStatus: "failed",
        indexRetryable: true,
        indexRetryAt: now - 1,
      });
      await ctx.db.patch(legacyId, {
        indexStatus: "failed",
        indexRetryable: undefined,
        indexRetryAt: undefined,
      });
      return (await ctx.db.get(dueId))?.updatedAt;
    });

    const claims = await t.run(
      async (ctx) =>
        await claimFailedCanonicalWorkspaceMemoryIndexRetries(ctx.db, {
          now,
          limit: 4,
          leaseMs: 1_000,
        })
    );
    expect(new Set(claims.map((claim) => claim.memoryId))).toEqual(
      new Set([dueId, legacyId])
    );

    const state = await t.run(async (ctx) => ({
      exhausted: await ctx.db.get(exhaustedId),
      due: await ctx.db.get(dueId),
      legacy: await ctx.db.get(legacyId),
      future: await ctx.db.get(futureId),
      nonRetryable: await ctx.db.get(nonRetryableId),
      ready: await ctx.db.get(readyId),
      disabled: await ctx.db.get(disabledId),
    }));
    expect(state.exhausted?.indexRetryable).toBe(false);
    expect(state.exhausted?.indexRetryExhaustedAt).toBe(now);
    expect(state.due?.indexRetryAt).toBe(now + 1_000);
    expect(state.legacy?.indexRetryAt).toBe(now + 1_000);
    expect(state.due?.updatedAt).toBe(beforeUpdatedAt);
    expect(state.future?.indexRetryClaimToken).toBeUndefined();
    expect(state.nonRetryable?.indexRetryClaimToken).toBeUndefined();
    expect(state.ready?.indexRetryClaimToken).toBeUndefined();
    expect(state.disabled?.indexRetryClaimToken).toBeUndefined();
  });

  test("prevents duplicate claims until lease expiry and rejects stale results", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    const memoryId = await insertCanonicalMemory(t, seeded, "lease and CAS");
    const firstNow = 2_000_000;
    const leaseMs = 1_000;
    await t.run(async (ctx) => {
      await ctx.db.patch(memoryId, {
        indexStatus: "failed",
        indexRetryable: true,
        indexRetryAt: firstNow,
      });
    });

    const firstClaim = await t.run(
      async (ctx) =>
        (
          await claimFailedCanonicalWorkspaceMemoryIndexRetries(ctx.db, {
            now: firstNow,
            limit: 1,
            leaseMs,
          })
        )[0]
    );
    expect(firstClaim).toBeDefined();

    const duplicateClaims = await t.run(
      async (ctx) =>
        await claimFailedCanonicalWorkspaceMemoryIndexRetries(ctx.db, {
          now: firstNow + leaseMs - 1,
          limit: 1,
          leaseMs,
        })
    );
    expect(duplicateClaims).toEqual([]);

    const secondClaim = await t.run(
      async (ctx) =>
        (
          await claimFailedCanonicalWorkspaceMemoryIndexRetries(ctx.db, {
            now: firstNow + leaseMs,
            limit: 1,
            leaseMs,
          })
        )[0]
    );
    expect(secondClaim.claimToken).not.toBe(firstClaim.claimToken);

    const result = await t.run(async (ctx) => {
      const memory = await ctx.db.get(memoryId);
      if (!memory) {
        throw new Error("Expected claimed memory");
      }
      const staleRecorded = await markCanonicalWorkspaceMemoryIndexResult(
        ctx.db,
        {
          memoryId,
          contentHash: memory.contentHash,
          indexed: false,
          error: "stale failure",
          retryable: true,
          retryClaimToken: firstClaim.claimToken,
          now: firstNow + leaseMs + 1,
        }
      );
      const currentRecorded = await markCanonicalWorkspaceMemoryIndexResult(
        ctx.db,
        {
          memoryId,
          contentHash: memory.contentHash,
          indexed: false,
          error: "current failure",
          retryable: true,
          retryClaimToken: secondClaim.claimToken,
          now: firstNow + leaseMs + 2,
        }
      );
      return {
        staleRecorded,
        currentRecorded,
        memory: await ctx.db.get(memoryId),
      };
    });

    expect(result.staleRecorded).toBe(false);
    expect(result.currentRecorded).toBe(true);
    expect(result.memory?.indexRetryCount).toBe(1);
    expect(result.memory?.indexRetryAt).toBe(
      firstNow + leaseMs + 2 + getWorkspaceMemoryIndexRetryDelayMs(1)
    );
    expect(result.memory?.indexRetryClaimToken).toBeUndefined();
    expect(result.memory?.canonicalContent).toBe(
      "Exact canonical memory: lease and CAS"
    );
  });

  test("schedules only one bounded, staggered batch with inline retries disabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    const seeded = await seedWorkspace(t);
    const memoryIds: Id<"workspaceMemories">[] = [];
    for (let index = 0; index < 14; index += 1) {
      memoryIds.push(
        await insertCanonicalMemory(t, seeded, `scheduled ${index}`)
      );
    }
    await t.run(async (ctx) => {
      for (const memoryId of memoryIds) {
        await ctx.db.patch(memoryId, {
          indexStatus: "failed",
          indexRetryable: true,
          indexRetryAt: 1,
        });
      }
    });

    const result = await t.mutation(
      internal.memory.retryFailedCanonicalWorkspaceMemoryIndexesCron,
      {}
    );
    expect(result).toEqual({ claimed: 12, scheduled: 12 });

    const scheduled = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect())
        .filter((job) =>
          job.name.includes("indexCanonicalWorkspaceMemoryInternal")
        )
        .sort((left, right) => left.scheduledTime - right.scheduledTime)
    );
    expect(scheduled).toHaveLength(12);
    expect(
      scheduled.map((job) => job.scheduledTime - scheduled[0].scheduledTime)
    ).toEqual([
      0,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 2,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 3,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 4,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 5,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 6,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 7,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 8,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 9,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 10,
      WORKSPACE_MEMORY_INDEX_RETRY_STAGGER_MS * 11,
    ]);
    for (const job of scheduled) {
      expect(job.args[0]).toMatchObject({ inlineRetries: false });
      expect(job.args[0]).toHaveProperty("retryClaimToken");
    }
  });
});
