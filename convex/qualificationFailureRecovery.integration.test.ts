/// <reference types="vite/client" />

import type { WorkflowId } from "@convex-dev/workflow";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { formatQualificationModelFailure } from "./lib/qualificationFailureCore";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("qualification model failure recovery", () => {
  test("schedules one delayed retry and stops after the bounded second run", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T12:46:00.000Z"));
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "qualification-recovery-user",
        email: "qualification-recovery@example.test",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Qualification recovery",
        description: "Qualification recovery test workspace",
        isDefault: true,
        prospectingWorkflowStatus: "running",
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "qualification-recovery-prospect",
        data: {},
        status: "new",
        qualificationStatus: "pending",
        qualificationWorkflowId: "qualification-workflow-1",
        updatedAt: 1,
      });
      return { prospectId, workspaceId };
    });
    const modelError = formatQualificationModelFailure({
      provider: "cerebras -> groq -> openai/azure",
      model: "openai/gpt-oss-120b -> openai/gpt-5.6-sol",
      attemptCount: 3,
      message: "AI_NoObjectGeneratedError: JSONParseError",
    });

    await t.mutation(
      internal.workflows.qualification.handleQualificationComplete,
      {
        workflowId: "qualification-workflow-1" as WorkflowId,
        result: { kind: "failed", error: modelError },
        context: { prospectId: seeded.prospectId },
      }
    );

    const firstFailure = await t.run(async (ctx) => ({
      prospect: await ctx.db.get("prospects", seeded.prospectId),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(firstFailure.prospect?.qualificationLastFailure).toMatchObject({
      attemptCount: 3,
      workflowAttemptCount: 1,
    });
    expect(
      firstFailure.prospect?.qualificationLastFailure?.nextRetryAt
    ).toBeGreaterThan(Date.now());
    expect(
      firstFailure.scheduled.filter((job) =>
        job.name.includes("startQualification")
      )
    ).toHaveLength(1);

    vi.advanceTimersByTime(1_000);
    await t.run((ctx) =>
      ctx.db.patch("prospects", seeded.prospectId, {
        qualificationWorkflowId: "qualification-workflow-2",
      })
    );
    await t.mutation(
      internal.workflows.qualification.handleQualificationComplete,
      {
        workflowId: "qualification-workflow-2" as WorkflowId,
        result: { kind: "failed", error: modelError },
        context: { prospectId: seeded.prospectId },
      }
    );

    const exhausted = await t.run((ctx) =>
      ctx.db.get("prospects", seeded.prospectId)
    );
    expect(exhausted?.qualificationLastFailure).toMatchObject({
      attemptCount: 3,
      workflowAttemptCount: 2,
    });
    expect(exhausted?.qualificationLastFailure?.nextRetryAt).toBeUndefined();
  });
});
