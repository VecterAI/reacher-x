/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("structured generation usage telemetry", () => {
  test("records per-attempt usage with workspace and failure attribution", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    const t = convexTest(schema, modules);
    const workspaceId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "usage-telemetry-user",
        email: "usage-telemetry@example.test",
      });
      return await ctx.db.insert("workspaces", {
        userId,
        name: "Usage telemetry",
        description: "Usage telemetry test workspace",
        isDefault: true,
        updatedAt: 1,
      });
    });

    await t.mutation(internal.agentTelemetry.insertUsageEvent, {
      agentName: "Qualification Evaluator",
      workspaceId,
      model: "openai/gpt-5.6-sol",
      provider: "openai/azure",
      usage: {
        inputTokens: 19888,
        outputTokens: 899,
        totalTokens: 20787,
        cachedInputTokens: 6160,
        cost: 0.0456,
        modelSelected: "openai/gpt-5.6-sol",
        providerSelected: "openai/azure",
      },
      errorMessage: undefined,
    });

    await t.mutation(internal.agentTelemetry.insertUsageEvent, {
      agentName: "Qualification Evaluator",
      workspaceId,
      model: "openai/gpt-5.6-sol",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      errorMessage: "This request requires more credits, or fewer max_tokens.",
    });

    const events = await t.run(async (ctx) =>
      ctx.db
        .query("agentUsageEvents")
        .withIndex("by_workspace_recorded_at", (q) =>
          q.eq("workspaceId", workspaceId)
        )
        .collect()
    );

    expect(events).toHaveLength(2);
    const success = events.find((event) => !event.errorMessage);
    const failure = events.find((event) => event.errorMessage);
    expect(success).toMatchObject({
      agentName: "Qualification Evaluator",
      workspaceId,
      usage: { inputTokens: 19888, cost: 0.0456 },
    });
    expect(failure).toMatchObject({
      agentName: "Qualification Evaluator",
      workspaceId,
      errorMessage: "This request requires more credits, or fewer max_tokens.",
    });
  });
});
