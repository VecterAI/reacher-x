/**
 * useAgentChat - Hook for AI agent chat using @convex-dev/agent with streaming
 *
 * Per docs: https://docs.convex.dev/agents/messages#showing-messages-in-react
 * Uses useUIMessages from @convex-dev/agent/react for streaming support.
 */

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useMutation } from "convex/react";
import { usePathname } from "next/navigation";
import {
  useUIMessages,
  optimisticallySendMessage,
  type UIMessage,
} from "@convex-dev/agent/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useConvexReady, useQueryWithStatus } from "@/shared/hooks";

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
const AGENT_FAILURE_TOAST_TITLE = "We couldn't finish that response";
const AGENT_FAILURE_TOAST_MESSAGE =
  "That response couldn't be completed. Please try again.";
const AGENT_TIMEOUT_TOAST_MESSAGE =
  "That response took too long and stopped before it finished. Please try again.";

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
  const pathname = usePathname();

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
  const {
    currentUser,
    isReady: isConvexReady,
    isLoading: isConvexReadyLoading,
    error: convexReadyError,
  } = useConvexReady();
  const isSetupRoute = pathname === "/agent/setup";
  const shouldResolveSetupBootstrap =
    isSetupRoute && !prospectId && !propThreadId;
  const getOrCreateThread = useMutation(api.chat.getOrCreateThread);

  // Query for existing prospect thread (lazy: doesn't create, only finds)
  // Skip query if we have a threadId or no prospectId
  const existingProspectThreadQuery = useQueryWithStatus(
    api.chat.getProspectThread,
    isConvexReady && prospectId
      ? { prospectId: prospectId as Id<"prospects"> }
      : "skip"
  );
  const existingProspectThread = existingProspectThreadQuery.data;
  const setupStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus,
    isConvexReady && shouldResolveSetupBootstrap ? {} : "skip"
  );
  const setupStatus = setupStatusQuery.data?.status ?? null;
  const shouldBootstrapNewWorkspace =
    shouldResolveSetupBootstrap && action === "newWorkspace";
  const shouldBootstrapDefaultSetup =
    shouldResolveSetupBootstrap &&
    action !== "newWorkspace" &&
    (setupStatus === "no_workspace" || setupStatus === "needs_icp");
  const shouldAutoBootstrapSetup =
    shouldBootstrapNewWorkspace || shouldBootstrapDefaultSetup;

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
  const abortThreadStreamMutation = useMutation(api.chat.abortThreadStream);
  const reconcileThreadGenerationFailureMutation = useMutation(
    api.chat.reconcileThreadGenerationFailure
  );

  // Track if we've already triggered auto-generation to prevent duplicate calls
  const hasTriggeredAutoGenRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const stopTargetThreadIdRef = useRef<string | null>(null);
  const abortInFlightRef = useRef(false);
  const seenFailedMessageKeysRef = useRef<Set<string>>(new Set());
  const reconciledIssueKeysRef = useRef<Set<string>>(new Set());
  const timeoutIssueKeysRef = useRef<Set<string>>(new Set());
  const suppressNextFailureToastThreadIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedFailedMessagesRef = useRef(false);

  // Sync with prop changes (URL navigation) - properly handle null for "New" button
  useEffect(() => {
    // Sync when propThreadId changes (including to null for "New" button)
    if (propThreadId !== internalThreadId) {
      setInternalThreadId(propThreadId ?? null);
      hasTriggeredAutoGenRef.current = false;
      stopRequestedRef.current = false;
      stopTargetThreadIdRef.current = null;
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
      stopRequestedRef.current = false;
      stopTargetThreadIdRef.current = null;

      // Mark as initialized to prevent getOrCreateThread from running
      setIsInitialized(true);

      prevProspectIdRef.current = prospectId;
    }
  }, [prospectId, propThreadId]);

  // Initialize thread on mount
  useEffect(() => {
    if (convexReadyError) {
      setError(convexReadyError);
      setIsInitialized(true);
      return;
    }
    if (!isConvexReady || isInitialized) return;

    // If threadId is provided via props, we're ready
    if (propThreadId) {
      setIsInitialized(true);
      return;
    }

    // If prospectId is provided, use the reactive query result
    // This enables lazy thread creation - no thread created until first message
    if (prospectId) {
      if (existingProspectThreadQuery.isPending) {
        return; // Still loading
      }

      if (existingProspectThreadQuery.isError) {
        setError(existingProspectThreadQuery.error);
        setIsInitialized(true);
        return;
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

    // The setup route bootstraps its own setup thread. If no bootstrap is needed,
    // let the route guard redirect away instead of creating a generic chat thread.
    if (shouldResolveSetupBootstrap) {
      if (setupStatusQuery.isPending) {
        return;
      }

      if (setupStatusQuery.isError) {
        setError(setupStatusQuery.error);
        setIsInitialized(true);
        return;
      }

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
    convexReadyError,
    isConvexReady,
    isInitialized,
    propThreadId,
    prospectId,
    action,
    shouldResolveSetupBootstrap,
    getOrCreateThread,
    existingProspectThread,
    existingProspectThreadQuery.error,
    existingProspectThreadQuery.isError,
    existingProspectThreadQuery.isPending,
    setupStatusQuery.error,
    setupStatusQuery.isError,
    setupStatusQuery.isPending,
  ]);

  // Auto-generation effect for action=generatePlan
  // Creates thread with auto-prompt when user clicks "Generate Plan"
  useEffect(() => {
    // Only trigger for generatePlan action with prospectId but no existing threadId
    if (
      action !== "generatePlan" ||
      !prospectId ||
      propThreadId ||
      !isConvexReady ||
      hasTriggeredAutoGenRef.current
    ) {
      return;
    }

    // Mark as triggered to prevent duplicate calls
    hasTriggeredAutoGenRef.current = true;
    stopRequestedRef.current = false;
    stopTargetThreadIdRef.current = null;

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
    isConvexReady,
    createProspectThreadWithPromptMutation,
  ]);

  // Auto-generation effect for the setup route.
  // Bootstraps either the normal greeting flow or the additional-workspace flow.
  useEffect(() => {
    if (
      !shouldAutoBootstrapSetup ||
      !!prospectId ||
      !!propThreadId ||
      !isConvexReady ||
      hasTriggeredAutoGenRef.current
    ) {
      return;
    }

    hasTriggeredAutoGenRef.current = true;
    stopRequestedRef.current = false;
    stopTargetThreadIdRef.current = null;

    const triggerSetupBootstrap = async () => {
      try {
        setLocalLoading(true);
        const result = await createSetupThreadWithPromptMutation(
          shouldBootstrapNewWorkspace ? { mode: "newWorkspace" } : {}
        );
        setInternalThreadId(result.threadId);
        setGeneratedThreadId(result.threadId);
        setIsInitialized(true);
      } catch (err) {
        console.error("[useAgentChat] Failed to create setup thread:", err);
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to start workspace setup")
        );
      } finally {
        setLocalLoading(false);
      }
    };

    triggerSetupBootstrap();
  }, [
    shouldAutoBootstrapSetup,
    shouldBootstrapNewWorkspace,
    prospectId,
    propThreadId,
    isConvexReady,
    createSetupThreadWithPromptMutation,
  ]);

  // NOTE: Auto-approval effect removed. Clicking on task approval notifications
  // now just routes to the thread - users manually type their approval message.

  // Current threadId (prop takes precedence)
  const threadId = propThreadId ?? internalThreadId;
  const threadGenerationStateQuery = useQueryWithStatus(
    api.chat.getThreadGenerationState,
    isConvexReady && isInitialized && threadId ? { threadId } : "skip"
  );

  useEffect(() => {
    seenFailedMessageKeysRef.current.clear();
    reconciledIssueKeysRef.current.clear();
    timeoutIssueKeysRef.current.clear();
    suppressNextFailureToastThreadIdsRef.current.clear();
    hasInitializedFailedMessagesRef.current = false;
  }, [threadId]);

  // Per docs: https://docs.convex.dev/agents/messages#useuimessages-hook
  // Use useUIMessages with stream: true for streaming support
  const {
    results: agentMessages,
    status: messageStatus,
    loadMore: loadMoreMessages,
  } = useUIMessages(
    api.chat.listThreadMessages,
    isConvexReady && isInitialized && threadId ? { threadId } : "skip",
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

  const abortActiveStream = useCallback(
    async (targetThreadId: string | null) => {
      if (!targetThreadId || abortInFlightRef.current) {
        return false;
      }

      abortInFlightRef.current = true;
      try {
        const result = await abortThreadStreamMutation({
          threadId: targetThreadId,
          reason: "Stopped by user",
        });

        if (result.abortedCount > 0) {
          stopRequestedRef.current = false;
          stopTargetThreadIdRef.current = null;
          return true;
        }

        return false;
      } catch (err) {
        console.error("[useAgentChat] Failed to abort stream:", err);
        return false;
      } finally {
        abortInFlightRef.current = false;
      }
    },
    [abortThreadStreamMutation]
  );

  useEffect(() => {
    if (!stopRequestedRef.current) return;

    const targetThreadId = stopTargetThreadIdRef.current ?? threadId;
    if (!targetThreadId) return;

    void abortActiveStream(targetThreadId);
  }, [abortActiveStream, isStreaming, threadId]);

  useEffect(() => {
    if (!threadId || !threadGenerationStateQuery.isSuccess) return;

    const generationState = threadGenerationStateQuery.data;
    if (generationState?.status !== "stalled") return;

    const issueKey = `${threadId}:${generationState.order}`;
    if (reconciledIssueKeysRef.current.has(issueKey)) return;

    reconciledIssueKeysRef.current.add(issueKey);
    timeoutIssueKeysRef.current.add(issueKey);

    void reconcileThreadGenerationFailureMutation({
      threadId,
      order: generationState.order,
    })
      .then((result) => {
        if (!result.resolved && result.reason === "still_streaming") {
          reconciledIssueKeysRef.current.delete(issueKey);
          timeoutIssueKeysRef.current.delete(issueKey);
        }
      })
      .catch((err) => {
        console.error(
          "[useAgentChat] Failed to reconcile stalled generation:",
          err
        );
        reconciledIssueKeysRef.current.delete(issueKey);
        timeoutIssueKeysRef.current.delete(issueKey);
      });
  }, [
    threadId,
    threadGenerationStateQuery.data,
    threadGenerationStateQuery.isSuccess,
    reconcileThreadGenerationFailureMutation,
  ]);

  useEffect(() => {
    const failedAssistantMessages = messages.filter(
      (message) => message.role === "assistant" && message.status === "failed"
    );

    if (!hasInitializedFailedMessagesRef.current) {
      seenFailedMessageKeysRef.current = new Set(
        failedAssistantMessages.map((message) => message.key)
      );
      hasInitializedFailedMessagesRef.current = true;
      return;
    }

    for (const message of failedAssistantMessages) {
      if (seenFailedMessageKeysRef.current.has(message.key)) continue;

      seenFailedMessageKeysRef.current.add(message.key);

      if (
        threadId &&
        suppressNextFailureToastThreadIdsRef.current.has(threadId)
      ) {
        suppressNextFailureToastThreadIdsRef.current.delete(threadId);
        continue;
      }

      const issueKey = threadId ? `${threadId}:${message.order}` : message.key;
      const description = timeoutIssueKeysRef.current.has(issueKey)
        ? AGENT_TIMEOUT_TOAST_MESSAGE
        : AGENT_FAILURE_TOAST_MESSAGE;

      toast.error(AGENT_FAILURE_TOAST_TITLE, {
        id: `agent-failure-${issueKey}`,
        description,
      });
    }
  }, [messages, threadId]);

  // Send message handler - uses different mutation based on context
  const sendMessage = useCallback(
    async (content?: string) => {
      const messageContent = content ?? inputValue;
      if (!messageContent.trim()) return;
      if (!isConvexReady || isConvexReadyLoading) return;

      stopRequestedRef.current = false;
      stopTargetThreadIdRef.current = null;

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
      isConvexReady,
      isConvexReadyLoading,
      sendMessageMutation,
      sendProspectMessageMutation,
      createProspectThreadWithPromptMutation,
    ]
  );

  // Stop handler - abort any active stream for the current thread
  const stop = useCallback(() => {
    setLocalLoading(false);
    stopRequestedRef.current = true;
    stopTargetThreadIdRef.current = threadId;
    if (threadId) {
      suppressNextFailureToastThreadIdsRef.current.add(threadId);
    }
    void abortActiveStream(threadId);
  }, [abortActiveStream, threadId]);

  // Load more messages
  const loadMore = useCallback(() => {
    loadMoreMessages(20);
  }, [loadMoreMessages]);

  // Memoize user data to avoid unnecessary re-renders
  const userData = useMemo((): UserData | null => {
    if (!currentUser) return null;
    return {
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      profileImageUrl: currentUser.profileImageUrl,
    };
  }, [currentUser]);

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
