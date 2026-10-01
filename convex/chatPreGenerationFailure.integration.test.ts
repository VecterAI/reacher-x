/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import { createThread, saveMessages } from "@convex-dev/agent";
import { describe, expect, test, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

vi.stubEnv("OPENROUTER_API_KEY", "pre-generation-failure-test-key");
vi.stubEnv("OPENAI_API_KEY", "pre-generation-failure-test-key");

async function seedTurn(options: { withAssistant?: boolean } = {}) {
  const t = convexTest(schema, modules);
  agentTest.register(t);

  const seeded = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "pre-generation-failure-user",
      email: "pre-generation-failure@example.com",
    });
    const threadId = await createThread(ctx, components.agent, {
      userId: String(userId),
    });
    const saved = await saveMessages(ctx, components.agent, {
      threadId,
      userId: String(userId),
      messages: options.withAssistant
        ? [
            { role: "user", content: "Who is @Jarl Nylund" },
            { role: "assistant", content: "Here is what I know." },
          ]
        : [{ role: "user", content: "Who is @Jarl Nylund" }],
    });
    const promptMessage = saved.messages[0];
    if (!promptMessage) {
      throw new Error("Expected a user message.");
    }
    return { threadId, order: promptMessage.order };
  });

  return { t, seeded };
}

describe("agent turn failure finalization", () => {
  test("saves a failed assistant message when a turn died before any assistant row existed", async () => {
    const { t, seeded } = await seedTurn();

    const finalized = await t.mutation(
      internal.chat.finalizeWorkspaceAgentGenerationFailureInternal,
      {
        threadId: seeded.threadId,
        order: seeded.order,
        errorMessage: "AI_APICallError: insufficient_quota",
      }
    );
    expect(finalized).toBe(true);

    const turnMessages = await t.run((ctx) =>
      ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
        threadId: seeded.threadId,
        order: "asc",
        paginationOpts: { numItems: 20, cursor: null },
      })
    );
    const assistantRows = turnMessages.page.filter(
      (message) => message.message?.role === "assistant"
    );
    expect(assistantRows).toHaveLength(1);
    expect(assistantRows[0]).toMatchObject({
      order: seeded.order,
      status: "failed",
      finishReason: "error",
      text: "That response stopped because of an unexpected error. Please try again.",
    });
  }, 30_000);

  test("does not duplicate a failure row when an assistant response already exists", async () => {
    const { t, seeded } = await seedTurn({ withAssistant: true });

    const finalized = await t.mutation(
      internal.chat.finalizeWorkspaceAgentGenerationFailureInternal,
      {
        threadId: seeded.threadId,
        order: seeded.order,
        errorMessage: "AI_APICallError: insufficient_quota",
      }
    );
    expect(finalized).toBe(false);

    const turnMessages = await t.run((ctx) =>
      ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
        threadId: seeded.threadId,
        order: "asc",
        paginationOpts: { numItems: 20, cursor: null },
      })
    );
    const assistantRows = turnMessages.page.filter(
      (message) => message.message?.role === "assistant"
    );
    expect(assistantRows).toHaveLength(1);
    expect(assistantRows[0].status).toBe("success");
  }, 30_000);

  test("does not fabricate a failure row while a stream is still active", async () => {
    const { t, seeded } = await seedTurn();

    await t.mutation(components.agent.streams.create, {
      threadId: seeded.threadId,
      order: seeded.order,
      stepOrder: 1,
      format: "UIMessageChunk",
      userId: "pre-generation-failure-user",
    });

    const finalized = await t.mutation(
      internal.chat.finalizeWorkspaceAgentGenerationFailureInternal,
      {
        threadId: seeded.threadId,
        order: seeded.order,
        errorMessage: "AI_APICallError: insufficient_quota",
      }
    );
    expect(finalized).toBe(false);

    const turnMessages = await t.run((ctx) =>
      ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
        threadId: seeded.threadId,
        order: "asc",
        paginationOpts: { numItems: 20, cursor: null },
      })
    );
    expect(
      turnMessages.page.filter(
        (message) => message.message?.role === "assistant"
      )
    ).toEqual([]);
  }, 30_000);

  test("marks a pending assistant message failed when the UI reconciles a stalled turn", async () => {
    const { t, seeded } = await seedTurn();
    await t.run(async (ctx) => {
      await saveMessages(ctx, components.agent, {
        threadId: seeded.threadId,
        messages: [{ role: "assistant", content: [] }],
        metadata: [{ status: "pending" }],
      });
    });

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    try {
      const result = await t
        .withIdentity({ subject: "pre-generation-failure-user" })
        .mutation(api.chat.reconcileThreadGenerationFailure, {
          threadId: seeded.threadId,
          order: seeded.order,
        });
      expect(result).toMatchObject({ resolved: true, order: seeded.order });
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  }, 30_000);
});
