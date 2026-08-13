/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import { createThread, saveMessages } from "@convex-dev/agent";
import { describe, expect, test, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

vi.stubEnv("OPENROUTER_API_KEY", "generation-recovery-test-key");
vi.stubEnv("OPENAI_API_KEY", "generation-recovery-test-key");

describe("agent generation recovery", () => {
  test("marks a pending message failed when stream replay contains an error chunk", async () => {
    const t = convexTest(schema, modules);
    agentTest.register(t);

    const seeded = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "generation-recovery-user",
        email: "generation-recovery@example.com",
      });
      const threadId = await createThread(ctx, components.agent, {
        userId: String(userId),
      });
      const saved = await saveMessages(ctx, components.agent, {
        threadId,
        userId: String(userId),
        messages: [
          { role: "user", content: "Trigger a generation." },
          { role: "assistant", content: [] },
        ],
        metadata: [{}, { status: "pending" }],
      });
      const pendingMessage = saved.messages[saved.messages.length - 1];
      if (!pendingMessage) {
        throw new Error("Expected a pending assistant message.");
      }

      return {
        workosUserId: "generation-recovery-user",
        threadId,
        messageId: pendingMessage._id,
        order: pendingMessage.order,
        stepOrder: pendingMessage.stepOrder,
        userId: String(userId),
      };
    });

    const streamId = await t.mutation(components.agent.streams.create, {
      threadId: seeded.threadId,
      order: seeded.order,
      stepOrder: seeded.stepOrder,
      format: "UIMessageChunk",
      userId: seeded.userId,
    });
    await t.mutation(components.agent.streams.addDelta, {
      streamId,
      start: 0,
      end: 1,
      parts: [{ type: "start" }],
    });
    await t.mutation(components.agent.streams.addDelta, {
      streamId,
      start: 1,
      end: 2,
      parts: [{ type: "error", errorText: "An error occurred." }],
    });
    await t.mutation(components.agent.streams.abort, {
      streamId,
      reason: "Uncaught Error: An error occurred.",
    });

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    let result: {
      resolved: boolean;
      order?: number;
      reason?: "still_streaming" | "no_pending_message";
    };
    try {
      result = await t
        .withIdentity({ subject: seeded.workosUserId })
        .mutation(api.chat.reconcileThreadGenerationFailure, {
          threadId: seeded.threadId,
          order: seeded.order,
        });
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }

    expect(result).toEqual({
      resolved: true,
      order: seeded.order,
    });

    const [message] = await t.run((ctx) =>
      ctx.runQuery(components.agent.messages.getMessagesByIds, {
        messageIds: [seeded.messageId],
      })
    );
    expect(message).toMatchObject({
      _id: seeded.messageId,
      status: "failed",
      finishReason: "error",
      text: "That response took too long and stopped before it finished. Please try again.",
    });

    const abortedStreams = await t.query(components.agent.streams.list, {
      threadId: seeded.threadId,
      statuses: ["aborted"],
    });
    expect(
      abortedStreams.filter((stream) => stream.order === seeded.order)
    ).toEqual([]);
  }, 30_000);
});
