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
