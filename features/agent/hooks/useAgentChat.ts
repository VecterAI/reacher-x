/**
 * useAgentChat - Hook for AI agent chat using @convex-dev/agent with streaming
 *
 * Per docs: https://docs.convex.dev/agents/messages#showing-messages-in-react
 * Uses useUIMessages from @convex-dev/agent/react for streaming support.
 */

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  useUIMessages,
  optimisticallySendMessage,
  type UIMessage,
} from "@convex-dev/agent/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getToolNameFromPart,
  isToolPart,
  type SuggestionPhase,
  type ToolPartLike,
} from "../lib";

// ============================================================================
// Types
// ============================================================================

// Re-export UIMessage from the agent library for consumers
export type { UIMessage };

export interface UseAgentChatOptions {
  /** Thread ID to load (from URL). If provided, uses this thread. */
  threadId?: string | null;
  /** Prospect ID for context. If provided, uses prospect-specific thread functions. */
  prospectId?: string | null;
  /** Action to perform. "generatePlan"/"newWorkspace" trigger auto-prompting. */
  action?: string | null;
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

  /** Thread ID created by auto-generation (for URL sync) */
  generatedThreadId: string | null;

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
type MessagePart = NonNullable<UIMessage["parts"]>[number];
type ToolMessagePart = MessagePart & ToolPartLike;

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

  const toolParts = message.parts.filter((part): part is ToolMessagePart =>
    isToolPart(part)
  );

  return toolParts.map((part) => ({
    toolName: getToolNameFromPart(part),
    state: getToolState(part),
    args: toRecord(part.input),
    result: part.output,
  }));
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function getToolState(part: {
  state?: string;
}): "pending" | "running" | "completed" | "failed" {
  switch (part.state) {
    case "call":
    case "partial-call":
    case "input-streaming":
    case "input-available":
      return "running";
    case "result":
    case "output-available":
      return "completed";
    case "output-error":
      return "failed";
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
  options: UseAgentChatOptions = {}
): UseAgentChatReturn {
  const { threadId: propThreadId, prospectId, action } = options;

  // Thread state - can be controlled by props or internal
  const [internalThreadId, setInternalThreadId] = useState<string | null>(
    propThreadId ?? null
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<Error | undefined>();
  const [localLoading, setLocalLoading] = useState(false);
  const [generatedThreadId, setGeneratedThreadId] = useState<string | null>(
    null
  );

  // Track previous prospectId to detect changes for isolation
  const prevProspectIdRef = useRef<string | null | undefined>(undefined);

  // Convex hooks
  const user = useQuery(api.users.getCurrentUser);
  const workspaceStatus = useQuery(api.workspaces.getWorkspaceSetupStatus);
  const getOrCreateThread = useMutation(api.chat.getOrCreateThread);

  // Query for existing prospect thread (lazy: doesn't create, only finds)
  // Skip query if we have a threadId or no prospectId
  const existingProspectThread = useQuery(
    api.chat.getProspectThread,
    prospectId ? { prospectId: prospectId as Id<"prospects"> } : "skip"
  );

  // Per docs: https://docs.convex.dev/agents/messages#optimistic-updates-for-sending-messages
  // Use optimisticallySendMessage for better UX
  const sendMessageMutation = useMutation(
    api.chat.initiateStreamingMessage
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages)
  );

  // For prospect-specific threads, use sendProspectMessage
  const sendProspectMessageMutation = useMutation(api.chat.sendProspectMessage);

  // For auto-prompting (action=generatePlan), use createProspectThreadWithPrompt
  const createProspectThreadWithPromptMutation = useMutation(
    api.chat.createProspectThreadWithPrompt
  );
  // For additional workspace setup bootstrap (action=newWorkspace)
  const createSetupThreadWithPromptMutation = useMutation(
    api.chat.createSetupThreadWithPrompt
  );

  // Track if we've already triggered auto-generation to prevent duplicate calls
  const hasTriggeredAutoGenRef = useRef(false);

  // Sync with prop changes (URL navigation) - properly handle null for "New" button
  useEffect(() => {
    // Sync when propThreadId changes (including to null for "New" button)
    if (propThreadId !== internalThreadId) {
      setInternalThreadId(propThreadId ?? null);
      hasTriggeredAutoGenRef.current = false;
    }
  }, [propThreadId, internalThreadId]);

  // Reset all thread state when prospectId changes (prospect isolation)
  useEffect(() => {
    // Skip first render (when prevProspectIdRef is undefined)
    if (prevProspectIdRef.current === undefined) {
      prevProspectIdRef.current = prospectId;
      return;
    }

    // If prospectId changed, reset thread state for clean isolation
    if (prevProspectIdRef.current !== prospectId) {
      console.info(
        `[useAgentChat] Prospect changed: ${prevProspectIdRef.current} → ${prospectId}, resetting thread state`
      );

      // Clear all thread-related state
      setInternalThreadId(propThreadId ?? null);
      setGeneratedThreadId(null);
      setError(undefined);
      setInputValue("");
      hasTriggeredAutoGenRef.current = false;

      // Mark as initialized to prevent getOrCreateThread from running
      setIsInitialized(true);

      prevProspectIdRef.current = prospectId;
    }
  }, [prospectId, propThreadId]);

  // Initialize thread on mount
  useEffect(() => {
    if (!user || isInitialized) return;

    // If threadId is provided via props, we're ready
    if (propThreadId) {
      setIsInitialized(true);
      return;
    }

    // If prospectId is provided, use the reactive query result
    // This enables lazy thread creation - no thread created until first message
    if (prospectId) {
      // Wait for query to resolve (undefined = loading, null = no thread found)
      if (existingProspectThread === undefined) {
        return; // Still loading
      }

      if (existingProspectThread) {
        // Found existing thread
        setInternalThreadId(existingProspectThread.threadId);
        console.info(
          `[useAgentChat] Found existing prospect thread: ${existingProspectThread.threadId}`
        );
      }
      // If null, no thread exists - will be created on first message
      setIsInitialized(true);
      return;
    }

    // Additional workspace flow: let the dedicated auto-action create a fresh setup thread
    if (action === "newWorkspace") {
      setIsInitialized(true);
      return;
    }

    // Setup flow: get or create the user's general thread
    const initThread = async () => {
      try {
        const result = await getOrCreateThread();
        setInternalThreadId(result.threadId);
        setIsInitialized(true);
      } catch (err) {
        console.error("[useAgentChat] Failed to initialize thread:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to initialize")
        );
        setIsInitialized(true);
      }
    };

    initThread();
  }, [
    user,
    isInitialized,
    propThreadId,
    prospectId,
    action,
    getOrCreateThread,
    existingProspectThread,
  ]);

  // Auto-generation effect for action=generatePlan
  // Creates thread with auto-prompt when user clicks "Generate Plan"
  useEffect(() => {
    // Only trigger for generatePlan action with prospectId but no existing threadId
    if (
      action !== "generatePlan" ||
      !prospectId ||
      propThreadId ||
      !user ||
      hasTriggeredAutoGenRef.current
    ) {
      return;
    }

    // Mark as triggered to prevent duplicate calls
    hasTriggeredAutoGenRef.current = true;

    const triggerAutoGeneration = async () => {
      try {
        setLocalLoading(true);
        // Create thread with auto-prompt for plan generation
        // NOTE: Do NOT include prospect ID in prompt - context is injected via
        // outreach agent's contextHandler automatically
        const result = await createProspectThreadWithPromptMutation({
          prospectId:
            prospectId as import("@/convex/_generated/dataModel").Id<"prospects">,
          prompt: `Generate an outreach plan for this prospect. Analyze their profile, recent activity, and pain points to create a personalized engagement strategy.`,
        });

        // Update internal state with new threadId
        setInternalThreadId(result.threadId);
        // Set generatedThreadId for URL sync in AgentChat
        setGeneratedThreadId(result.threadId);
        setIsInitialized(true);

        console.info(
          `[useAgentChat] Auto-generated plan thread: ${result.threadId}`
        );
      } catch (err) {
        console.error("[useAgentChat] Failed to auto-generate plan:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to generate plan")
        );
      } finally {
        setLocalLoading(false);
      }
    };

    triggerAutoGeneration();
  }, [
    action,
    prospectId,
    propThreadId,
    user,
    createProspectThreadWithPromptMutation,
  ]);

  // Auto-generation effect for action=newWorkspace
  // Creates a fresh setup thread seeded with a server-owned prompt.
  useEffect(() => {
    if (
      action !== "newWorkspace" ||
      !!prospectId ||
      !!propThreadId ||
      !user ||
      hasTriggeredAutoGenRef.current
    ) {
      return;
    }

    hasTriggeredAutoGenRef.current = true;

    const triggerAdditionalWorkspaceSetup = async () => {
      try {
        setLocalLoading(true);
        const result = await createSetupThreadWithPromptMutation({});
        setInternalThreadId(result.threadId);
        setGeneratedThreadId(result.threadId);
        setIsInitialized(true);
      } catch (err) {
        console.error(
          "[useAgentChat] Failed to create additional workspace setup thread:",
          err
        );
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to start workspace setup")
        );
      } finally {
        setLocalLoading(false);
      }
    };

    triggerAdditionalWorkspaceSetup();
  }, [
    action,
    prospectId,
    propThreadId,
    user,
    createSetupThreadWithPromptMutation,
  ]);

  // NOTE: Auto-approval effect removed. Clicking on task approval notifications
  // now just routes to the thread - users manually type their approval message.

  // Current threadId (prop takes precedence)
  const threadId = propThreadId ?? internalThreadId;

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

  // Send message handler - uses different mutation based on context
  const sendMessage = useCallback(
    async (content?: string) => {
      const messageContent = content ?? inputValue;
      if (!messageContent.trim()) return;

      // If prospectId provided but no thread, create one with the first message
      if (prospectId && !threadId) {
        setInputValue("");
        setLocalLoading(true);
        setError(undefined);

        try {
          const result = await createProspectThreadWithPromptMutation({
            prospectId: prospectId as Id<"prospects">,
            prompt: messageContent.trim(),
          });
          setInternalThreadId(result.threadId);
          setGeneratedThreadId(result.threadId);
          console.info(
            `[useAgentChat] Created prospect thread on first message: ${result.threadId}`
          );
        } catch (err) {
          console.error("[useAgentChat] Failed to create thread:", err);
          setError(
            err instanceof Error ? err : new Error("Failed to send message")
          );
        } finally {
          setLocalLoading(false);
        }
        return;
      }

      // Existing thread case
      if (!threadId) return;

      setInputValue("");
      setLocalLoading(true);
      setError(undefined);

      try {
        // Use prospect-specific mutation for prospect threads (outreach agent)
        if (prospectId) {
          await sendProspectMessageMutation({
            threadId,
            prompt: messageContent.trim(),
          });
        } else {
          // Use general mutation for setup threads (setup agent)
          await sendMessageMutation({
            threadId,
            prompt: messageContent.trim(),
          });
        }
      } catch (err) {
        console.error("[useAgentChat] Failed to send message:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to send message")
        );
      } finally {
        setLocalLoading(false);
      }
    },
    [
      inputValue,
      threadId,
      prospectId,
      sendMessageMutation,
      sendProspectMessageMutation,
      createProspectThreadWithPromptMutation,
    ]
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
    generatedThreadId,
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
