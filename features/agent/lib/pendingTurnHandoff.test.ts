import { describe, expect, test } from "vitest";
import { isAssistantPlaceholderMessage } from "./assistantMessageState";
import {
  isAssistantMessageActive,
  updatePendingTurnPhase,
} from "./pendingTurnState";

describe("pending turn and assistant placeholder handoff", () => {
  test("treats both pending and streaming assistant statuses as active", () => {
    expect(isAssistantMessageActive("pending")).toBe(true);
    expect(isAssistantMessageActive("streaming")).toBe(true);
    expect(isAssistantMessageActive("success")).toBe(false);
    expect(isAssistantMessageActive("failed")).toBe(false);
    expect(isAssistantMessageActive(undefined)).toBe(false);
  });

  test("keeps empty pending and streaming shells hidden as placeholders", () => {
    expect(
      isAssistantPlaceholderMessage({
        role: "assistant",
        status: "pending",
        text: "",
        parts: [],
      })
    ).toBe(true);
    expect(
      isAssistantPlaceholderMessage({
        role: "assistant",
        status: "streaming",
        text: "   ",
        parts: [],
      })
    ).toBe(true);
  });

  test("hands off once visible text, tool calls, or visible reasoning arrive", () => {
    expect(
      isAssistantPlaceholderMessage({
        role: "assistant",
        status: "streaming",
        text: "Hello",
        parts: [],
      })
    ).toBe(false);

    expect(
      isAssistantPlaceholderMessage({
        role: "assistant",
        status: "streaming",
        text: "",
        parts: [{ type: "tool-queryWorkspace", state: "call" }],
      })
    ).toBe(false);

    expect(
      isAssistantPlaceholderMessage(
        {
          role: "assistant",
          status: "streaming",
          text: "",
          parts: [{ type: "reasoning", text: "Checking workspace context" }],
        },
        { showReasoning: true }
      )
    ).toBe(false);

    expect(
      isAssistantPlaceholderMessage(
        {
          role: "assistant",
          status: "streaming",
          text: "",
          parts: [{ type: "reasoning", text: "Checking workspace context" }],
        },
        { showReasoning: false }
      )
    ).toBe(true);
  });

  test("preserves pending turn identity when phase is unchanged or stopping", () => {
    const turn = { id: "turn-1", phase: "streaming" };
    expect(updatePendingTurnPhase(turn, "turn-1", "streaming")).toBe(turn);

    const stopping = { id: "turn-1", phase: "stopping" };
    expect(updatePendingTurnPhase(stopping, "turn-1", "streaming")).toBe(
      stopping
    );
  });
});
