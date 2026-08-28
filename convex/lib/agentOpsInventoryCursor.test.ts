import { describe, expect, test } from "vitest";
import {
  decodeAgentOpsMemoryInventoryCursor,
  encodeAgentOpsMemoryInventoryCursor,
  type AgentOpsMemoryInventoryCursorState,
} from "./agentOpsInventoryCursor";

const window = { startMs: 100, endMs: 200 };

function buildState(
  overrides: Partial<AgentOpsMemoryInventoryCursorState> = {}
): AgentOpsMemoryInventoryCursorState {
  return {
    scopeKey: "scope-a",
    sourceCursor: "source-cursor",
    bufferedMemoryIds: ["memory-1", "memory-2"],
    sourceDone: false,
    windowStartMs: window.startMs,
    windowEndMs: window.endMs,
    ...overrides,
  };
}

describe("Agent Ops inventory cursor", () => {
  test("round-trips the fixed snapshot watermark and buffered IDs", () => {
    const cursor = encodeAgentOpsMemoryInventoryCursor(buildState());
    expect(cursor).not.toBeNull();
    expect(
      decodeAgentOpsMemoryInventoryCursor(cursor ?? undefined, "scope-a", {
        startMs: 500,
        endMs: 600,
      })
    ).toEqual(buildState());
  });

  test("resets a cursor when its filter scope changes", () => {
    const cursor = encodeAgentOpsMemoryInventoryCursor(buildState());
    expect(
      decodeAgentOpsMemoryInventoryCursor(
        cursor ?? undefined,
        "scope-b",
        window
      )
    ).toEqual({
      scopeKey: "scope-b",
      sourceCursor: null,
      bufferedMemoryIds: [],
      sourceDone: false,
      windowStartMs: window.startMs,
      windowEndMs: window.endMs,
    });
  });

  test("rejects oversized buffers and ends without another cursor", () => {
    const oversized = encodeAgentOpsMemoryInventoryCursor(
      buildState({
        bufferedMemoryIds: Array.from(
          { length: 51 },
          (_, index) => `memory-${index}`
        ),
      })
    );
    expect(
      decodeAgentOpsMemoryInventoryCursor(
        oversized ?? undefined,
        "scope-a",
        window
      ).bufferedMemoryIds
    ).toEqual([]);
    expect(
      encodeAgentOpsMemoryInventoryCursor(
        buildState({
          sourceCursor: null,
          bufferedMemoryIds: [],
          sourceDone: true,
        })
      )
    ).toBeNull();
  });
});
