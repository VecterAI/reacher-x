/**
 * useAgentChat - Hook for AI agent chat using @convex-dev/agent with streaming
 *
 * Per docs: https://docs.convex.dev/agents/messages#showing-messages-in-react
 * Uses useUIMessages from @convex-dev/agent/react for streaming support.
 */

import { useCallback, useEffect, useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  useUIMessages,
  optimisticallySendMessage,
  type UIMessage,
} from "@convex-dev/agent/react";
import { api } from "@/convex/_generated/api";
import type { SuggestionPhase } from "../lib/suggestions";

// ============================================================================
// Types
// ============================================================================

// Re-export UIMessage from the agent library for consumers
export type { UIMessage };

// Our simplified Message type for backward compatibility
export interface Message {
  id: string;
  key: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  content: string;
  createdAt?: number;
  status?: "pending" | "streaming" | "success" | "failed";
  toolCalls?: Array<{
    toolName: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
  parts?: Array<{ type: "text"; text: string }>;
}

export interface UseAgentChatOptions {
  /** Initial messages to load (for restoring chat state) */
  initialMessages?: Message[];
}

export interface UserData {
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

export interface UseAgentChatReturn {
  // Chat state - returns UIMessage[] directly from the agent
  messages: UIMessage[];
  input: string;
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | undefined;

  // Chat info
  threadId: string | null;
  isInitialized: boolean;

  // Current phase for suggestions
  suggestionPhase: SuggestionPhase;

  // User data for avatars
  user: UserData | null;

  // Actions
  setInput: (value: string) => void;
  sendMessage: (content?: string) => void;
  stop: () => void;
  loadMore: () => void;
  hasMore: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// Special init prompt used to trigger agent greeting - filtered out in UI
const INIT_PROMPT = "__INIT__";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extracts tool call information from message parts.
 */
function extractToolCalls(message: UIMessage): Array<{
  toolName: string;
  state: "pending" | "running" | "completed" | "failed";
  args?: Record<string, unknown>;
  result?: unknown;
}> {
  if (!message.parts) return [];

  return message.parts
    .filter(
      (part): part is typeof part & { type: "tool-invocation" } =>
        part.type === "tool-invocation"
    )
    .map((part) => ({
      toolName: (part as { toolName?: string }).toolName || "unknown",
      state: getToolState(part as { state?: string }),
      args: (part as { args?: Record<string, unknown> }).args,
      result: (part as { result?: unknown }).result,
    }));
}

function getToolState(part: {
  state?: string;
}): "pending" | "running" | "completed" | "failed" {
  switch (part.state) {
    case "call":
      return "running";
    case "result":
      return "completed";
    case "partial-call":
      return "running";
    default:
      return "pending";
  }
}

/**
 * Determines if we're in the middle of an operation (tool running).
 */
function hasActiveToolCalls(messages: UIMessage[]): boolean {
  const lastMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  if (!lastMessage) return false;

  const toolCalls = extractToolCalls(lastMessage);
  return toolCalls.some(
    (tc) => tc.state === "running" || tc.state === "pending"
  );
}

/**
 * Gets the completed tool calls from the conversation.
 */
function getCompletedToolCalls(messages: UIMessage[]): string[] {
  const completedTools: string[] = [];

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const toolCalls = extractToolCalls(msg);
    for (const tc of toolCalls) {
      if (tc.state === "completed" && !completedTools.includes(tc.toolName)) {
        completedTools.push(tc.toolName);
      }
    }
  }

  return completedTools;
}

/**
 * Determines the current suggestion phase based on messages, tool calls, and conversation state.
 * This is a more sophisticated phase detection that considers:
 * 1. Active tool calls (don't show suggestions while tools are running)
 * 2. Completed tool calls (what has been done)
 * 3. Message content (what the agent is asking)
 */
function determineSuggestionPhase(
  messages: UIMessage[],
  hasWorkspace: boolean
): SuggestionPhase {
  if (messages.length === 0) return "greeting";

  // If tools are running, no suggestions
  if (hasActiveToolCalls(messages)) return "prospecting"; // Return a phase with no suggestions

  const completedTools = getCompletedToolCalls(messages);
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  if (!lastAssistantMessage) return "awaiting_url";

  const lastText = lastAssistantMessage.text?.toLowerCase() ?? "";

  // Check tool-based phase detection first (more reliable)

  // If workspace was just created or updated
  if (
    completedTools.includes("createWorkspace") ||
    completedTools.includes("updateWorkspace")
  ) {
    if (
      lastText.includes("workspace is ready") ||
      lastText.includes("workspace has been created") ||
      lastText.includes("successfully created") ||
      lastText.includes("all set") ||
      lastText.includes("you're ready")
    ) {
      return "workspace_ready";
    }
  }

  // If ICPs were generated, we're awaiting approval
  if (completedTools.includes("generateImprovedDescriptionAndICPs")) {
    // Check if workspace was also created (meaning approval was given)
    if (
      !completedTools.includes("createWorkspace") &&
      !completedTools.includes("updateWorkspace")
    ) {
      if (
        lastText.includes("does this look") ||
        lastText.includes("look right") ||
        lastText.includes("look good") ||
        lastText.includes("ready to create") ||
        lastText.includes("shall i create") ||
        lastText.includes("approve") ||
        lastText.includes("ideal customer")
      ) {
        return "awaiting_approval";
      }
    }
  }

  // If URL was analyzed, we should be generating or awaiting approval
  if (completedTools.includes("analyzeUrl")) {
    if (!completedTools.includes("generateImprovedDescriptionAndICPs")) {
      // URL analyzed but no ICPs yet - might be in progress
      return "awaiting_approval";
    }
  }

  // Fall back to text-based detection for edge cases

  // Check for approval phase
  if (
    lastText.includes("does this look") ||
    lastText.includes("look right") ||
    lastText.includes("look good") ||
    lastText.includes("ready to create") ||
    lastText.includes("shall i create") ||
    lastText.includes("approve")
  ) {
    return "awaiting_approval";
  }

  // Check for workspace ready
  if (
    lastText.includes("workspace is ready") ||
    lastText.includes("workspace has been created") ||
    lastText.includes("successfully created") ||
    lastText.includes("all set")
  ) {
    return "workspace_ready";
  }

  // Check for existing user migration choice
  if (
    lastText.includes("existing workspace") ||
    lastText.includes("update your info") ||
    lastText.includes("use existing") ||
    lastText.includes("already have")
  ) {
    return "existing_user_choice";
  }

  // Check if waiting for URL
  if (
    lastText.includes("website url") ||
    lastText.includes("share your url") ||
    lastText.includes("provide your url") ||
    lastText.includes("what's your url") ||
    lastText.includes("website") ||
    lastText.includes("get started")
  ) {
    return "awaiting_url";
  }

  // Check if waiting for description
  if (
    lastText.includes("describe your business") ||
    lastText.includes("tell me about") ||
    lastText.includes("manual description")
  ) {
    return "awaiting_description";
  }

  // Default based on workspace state
  return hasWorkspace ? "workspace_ready" : "awaiting_url";
}

// ============================================================================
// Hook
// ============================================================================

export function useAgentChat(
  _options: UseAgentChatOptions = {}
): UseAgentChatReturn {
  // Thread state
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<Error | undefined>();
  const [localLoading, setLocalLoading] = useState(false);

  // Convex hooks
  const user = useQuery(api.users.getCurrentUser);
  const workspaceStatus = useQuery(api.workspaces.getWorkspaceSetupStatus);
  const getOrCreateThread = useMutation(api.chat.getOrCreateThread);

  // Per docs: https://docs.convex.dev/agents/messages#optimistic-updates-for-sending-messages
  // Use optimisticallySendMessage for better UX
  const sendMessageMutation = useMutation(
    api.chat.initiateStreamingMessage
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages)
  );

  // Initialize thread on mount
  useEffect(() => {
    if (!user || isInitialized) return;

    const initThread = async () => {
      try {
        const result = await getOrCreateThread();
        setThreadId(result.threadId);
        setIsInitialized(true);
      } catch (err) {
        console.error("Failed to initialize thread:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to initialize")
        );
        setIsInitialized(true);
      }
    };

    initThread();
  }, [user, isInitialized, getOrCreateThread]);

  // Per docs: https://docs.convex.dev/agents/messages#useuimessages-hook
  // Use useUIMessages with stream: true for streaming support
  const {
    results: agentMessages,
    status: messageStatus,
    loadMore: loadMoreMessages,
  } = useUIMessages(
    api.chat.listThreadMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems: 30,
      // Per docs: pass stream: true to enable streaming
      stream: true,
    }
  );

  // Messages from the agent - filter out the __INIT__ trigger message
  const messages = useMemo(() => {
    if (!agentMessages) return [];
    // Filter out the init prompt message (used to trigger agent greeting)
    return agentMessages.filter(
      (m) => !(m.role === "user" && m.text === INIT_PROMPT)
    );
  }, [agentMessages]);

  // Per docs: UIMessage has status field - check for streaming
  const isStreaming = messages.some((m) => m.status === "streaming");

  // Combined loading state
  const isLoading = localLoading || isStreaming;

  // Determine if user has a workspace
  const hasWorkspace =
    workspaceStatus?.status === "complete" ||
    workspaceStatus?.status === "needs_icp";

  // Determine current suggestion phase
  const suggestionPhase = determineSuggestionPhase(messages, hasWorkspace);

  // Send message handler
  const sendMessage = useCallback(
    async (content?: string) => {
      const messageContent = content ?? inputValue;
      if (!messageContent.trim() || !threadId) return;

      setInputValue("");
      setLocalLoading(true);
      setError(undefined);

      try {
        await sendMessageMutation({
          threadId,
          prompt: messageContent.trim(),
        });
      } catch (err) {
        console.error("Failed to send message:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to send message")
        );
      } finally {
        setLocalLoading(false);
      }
    },
    [inputValue, threadId, sendMessageMutation]
  );

  // Stop handler (for future use with abort)
  const stop = useCallback(() => {
    setLocalLoading(false);
    // TODO: Implement stream abort when supported
  }, []);

  // Load more messages
  const loadMore = useCallback(() => {
    loadMoreMessages(20);
  }, [loadMoreMessages]);

  // Memoize user data to avoid unnecessary re-renders
  const userData = useMemo((): UserData | null => {
    if (!user) return null;
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    };
  }, [user]);

  return {
    // Chat state
    messages,
    input: inputValue,
    isLoading,
    isStreaming,
    error,

    // Chat info
    threadId,
    isInitialized,
    suggestionPhase,

    // User data
    user: userData,

    // Actions
    setInput: setInputValue,
    sendMessage,
    stop,
    loadMore,
    hasMore: messageStatus === "CanLoadMore",
  };
}
