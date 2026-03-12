/**
 * Barrel exports for agent hooks
 */

export { useAgentChat } from "./useAgentChat";

// Re-export UIMessage from the agent library
export type { UIMessage } from "@convex-dev/agent/react";

export type {
  PendingTurnState,
  PendingTurnPhase,
  UseAgentChatReturn,
  UseAgentChatOptions,
  UserData,
} from "./useAgentChat";
