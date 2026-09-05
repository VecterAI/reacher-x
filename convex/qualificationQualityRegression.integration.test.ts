/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "quality-race",
      email: "quality-race@example.test",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Quality race",
      description: "Test",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      userId,
      workspaceId,
      platform: "twitter",
      origin: "setup_preview",
      externalId: "42",
      data: {},
      status: "new",
      qualificationStatus: "pending",
      qualificationWorkflowId: "newer-workflow",
      updatedAt: 1,
    });
    const eventId = await ctx.db.insert("memoryWorkflowEvents", {
      workspaceId,
      prospectId,
      eventKey: "race-event",
      eventType: "qualification_completed",
      sourceType: "prospect",
      sourceId: String(prospectId),
      status: "processing",
      occurredAt: 1,
    });
    const runId = await ctx.db.insert("memoryEvaluatorRuns", {
      workspaceId,
      eventId,
      eventKey: "race-event",
      eventType: "qualification_completed",
      sourceType: "prospect",
      sourceId: String(prospectId),
      status: "running",
      promotedMemoryCount: 0,
      suggestedMemoryCount: 0,
      queryPerformanceUpdateCount: 0,
      updatedAt: 1,
    });
    return { userId, workspaceId, prospectId, eventId, runId };
  });
  return { t, ...ids };
}
describe("qualification and learning lifecycle races", () => {
  test("old completion cannot clear a newer workflow; repeated and deleted cleanup is safe", async () => {
    const { t, prospectId } = await fixture();
    expect(
      await t.mutation(
        internal.prospects.clearQualificationWorkflowIdIfMatchesInternal,
        { prospectId, workflowId: "old-workflow" }
      )
    ).toBe(false);
    expect(
      (await t.query(internal.prospects.getProspectInternal, { prospectId }))
        ?.qualificationWorkflowId
    ).toBe("newer-workflow");
    expect(
      await t.mutation(
        internal.prospects.clearQualificationWorkflowIdIfMatchesInternal,
        { prospectId, workflowId: "newer-workflow" }
      )
    ).toBe(true);
    expect(
      await t.mutation(
        internal.prospects.clearQualificationWorkflowIdIfMatchesInternal,
        { prospectId, workflowId: "newer-workflow" }
      )
    ).toBe(false);
    await t.run((ctx) => ctx.db.delete(prospectId));
    expect(
      await t.mutation(
        internal.prospects.clearQualificationWorkflowIdIfMatchesInternal,
        { prospectId, workflowId: "newer-workflow" }
      )
    ).toBe(false);
    await t.mutation(internal.prospects.clearQualificationWorkflowId, {
      prospectId,
    });
    await t.mutation(internal.prospects.setQualificationWorkflowId, {
      prospectId,
      workflowId: "late-start",
    });
  });
  test("removed preview produces no learned memory or query-performance write", async () => {
    const { t, prospectId, eventId, runId, workspaceId } = await fixture();
    await t.run((ctx) => ctx.db.delete(prospectId));
    const result = await t.mutation(
      internal.evaluator.applyMemoryEvaluationPlanInternal,
      {
        eventId,
        runId,
        workspaceId,
        promptVersion: "test",
        drafts: [],
        queryPerformanceUpdates: [],
        retrievalStats: {
          relevantMemories: 0,
          semanticMatches: 0,
          matchedQueries: 0,
        },
      }
    );
    expect(result).toMatchObject({
      skipped: true,
      promotedMemoryCount: 0,
      suggestedMemoryCount: 0,
      queryPerformanceUpdateCount: 0,
    });
    expect(
      await t.run((ctx) => ctx.db.query("workspaceMemories").collect())
    ).toHaveLength(0);
  });
  test("cross-workspace sources remain errors rather than being silently accepted", async () => {
    const { t, prospectId, eventId, runId, workspaceId, userId } =
      await fixture();
    await t.run(async (ctx) => {
      const other = await ctx.db.insert("workspaces", {
        userId,
        name: "Other",
        description: "Other",
        isDefault: false,
        updatedAt: 1,
      });
      await ctx.db.patch(prospectId, { workspaceId: other });
    });
    await expect(
      t.mutation(internal.evaluator.applyMemoryEvaluationPlanInternal, {
        eventId,
        runId,
        workspaceId,
        promptVersion: "test",
        drafts: [],
        queryPerformanceUpdates: [],
        retrievalStats: {
          relevantMemories: 0,
          semanticMatches: 0,
          matchedQueries: 0,
        },
      })
    ).rejects.toThrow("prospect workspace mismatch");
  });
});
