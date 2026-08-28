const AGENT_OPS_MEMORY_CURSOR_PREFIX = "aom1:";
const MAX_BUFFERED_MEMORY_IDS = 50;
const MAX_MEMORY_ID_LENGTH = 128;
const MAX_CURSOR_LENGTH = 100_000;

export type AgentOpsMemoryInventoryCursorState = {
  scopeKey: string;
  sourceCursor: string | null;
  bufferedMemoryIds: string[];
  sourceDone: boolean;
  windowStartMs: number;
  windowEndMs: number;
};

export function encodeAgentOpsMemoryInventoryCursor(
  state: AgentOpsMemoryInventoryCursorState
): string | null {
  if (state.sourceDone && state.bufferedMemoryIds.length === 0) {
    return null;
  }

  return `${AGENT_OPS_MEMORY_CURSOR_PREFIX}${encodeURIComponent(
    JSON.stringify(state)
  )}`;
}

export function decodeAgentOpsMemoryInventoryCursor(
  cursor: string | undefined,
  scopeKey: string,
  window: { startMs: number; endMs: number }
): AgentOpsMemoryInventoryCursorState {
  const initialState: AgentOpsMemoryInventoryCursorState = {
    scopeKey,
    sourceCursor: null,
    bufferedMemoryIds: [],
    sourceDone: false,
    windowStartMs: window.startMs,
    windowEndMs: window.endMs,
  };

  if (
    !cursor?.startsWith(AGENT_OPS_MEMORY_CURSOR_PREFIX) ||
    cursor.length > MAX_CURSOR_LENGTH
  ) {
    return initialState;
  }

  try {
    const decoded: unknown = JSON.parse(
      decodeURIComponent(cursor.slice(AGENT_OPS_MEMORY_CURSOR_PREFIX.length))
    );
    if (!decoded || typeof decoded !== "object") {
      return initialState;
    }

    const state = decoded as Partial<AgentOpsMemoryInventoryCursorState>;
    if (
      state.scopeKey !== scopeKey ||
      (state.sourceCursor !== null && typeof state.sourceCursor !== "string") ||
      typeof state.sourceDone !== "boolean" ||
      typeof state.windowStartMs !== "number" ||
      !Number.isFinite(state.windowStartMs) ||
      typeof state.windowEndMs !== "number" ||
      !Number.isFinite(state.windowEndMs) ||
      state.windowEndMs < state.windowStartMs ||
      !Array.isArray(state.bufferedMemoryIds) ||
      state.bufferedMemoryIds.length > MAX_BUFFERED_MEMORY_IDS ||
      !state.bufferedMemoryIds.every(
        (memoryId): memoryId is string =>
          typeof memoryId === "string" &&
          memoryId.length <= MAX_MEMORY_ID_LENGTH
      )
    ) {
      return initialState;
    }

    return {
      scopeKey,
      sourceCursor: state.sourceCursor,
      bufferedMemoryIds: state.bufferedMemoryIds,
      sourceDone: state.sourceDone,
      windowStartMs: state.windowStartMs,
      windowEndMs: state.windowEndMs,
    };
  } catch {
    return initialState;
  }
}
