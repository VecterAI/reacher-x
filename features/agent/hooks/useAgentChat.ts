/**
 * useAgentChat - Hook for AI agent chat using @convex-dev/agent with streaming
 *
 * Per docs: https://docs.convex.dev/agents/messages#showing-messages-in-react
 * Uses useUIMessages from @convex-dev/agent/react for streaming support.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useRef,
} from "react";
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
import {
  normalizeAgentMessageContextMetadata,
  type AgentMessageContextMetadata,
} from "@/shared/lib/mentions/messageContext";
import { useConvexReady, useQueryWithStatus } from "@/shared/hooks";
import { logger } from "@/shared/lib/logger";
import { resolveAgentThreadInitializationMode } from "@/features/agent/lib/agentThreadInitialization";
import {
  isPlanBatchTurnWaiting,
  updatePendingTurnPhase,
} from "@/features/agent/lib/pendingTurnState";
import { getUIMessageDisplayText } from "@/features/agent/lib/uiMessageText";
import {
  deliverStoredLandingPromptHandoff,
  readStoredLandingPromptHandoff,
} from "@/features/landing/lib/landingPromptStorage";
import { buildLandingSetupHandoffRequest } from "@/features/agent/lib/landingSetupHandoff";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";

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
  /** Workspace ID for workspace-scoped `/agent` chat. */
  workspaceId?: string | null;
  /** Action to perform. "generatePlan"/"newWorkspace" trigger auto-prompting. */
  action?: string | null;
  /** Incremented by the parent when the user explicitly asks for a fresh thread. */
  newThreadSignal?: number;
  /** Hold setup bootstrap/prompt delivery while a landing draft choice is open. */
  deferSetupHandoff?: boolean;
}

export interface UserData {
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

export interface AgentChatMessageInput {
  prompt: string;
  metadata?: AgentMessageContextMetadata | null;
  /**
   * When chat-first setup submits after Exa URL auto-fill, the original URL
   * (composer text is the extracted description).
   */
  setupSourceUrl?: string | null;
}

export type PendingTurnPhase =
  | "submitting"
  | "queued"
  | "streaming"
  | "stopping"
  | "failed"
  | "finished";

export type MessageStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

export interface PendingTurnState {
  id: string;
  prompt: string;
  phase: PendingTurnPhase;
  threadId: string | null;
  messageId: string | null;
  order: number | null;
  showUserPrompt: boolean;
  assistantLabel: string;
  errorMessage?: string;
}

export interface UseAgentChatReturn {
  // Chat state - returns UIMessage[] directly from the agent
  messages: UIMessage[];
  messageStatus: MessageStatus;
  input: string;
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | undefined;
  pendingTurn: PendingTurnState | null;

  // Chat info
  threadId: string | null;
  isInitialized: boolean;

  /** Thread ID created by auto-generation (for URL sync) */
  generatedThreadId: string | null;

  // User data for avatars
  user: UserData | null;

  // Actions
  setInput: (value: string) => void;
  sendMessage: (content?: string | AgentChatMessageInput) => Promise<void>;
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
const agentChatLogger = logger.withScope("useAgentChat");

// ============================================================================
// Helpers
// ============================================================================

// ============================================================================
// Hook
// ============================================================================

export function useAgentChat(
  options: UseAgentChatOptions = {}
): UseAgentChatReturn {
  const {
    threadId: propThreadId,
    prospectId,
    workspaceId,
    action,
    newThreadSignal,
    deferSetupHandoff = false,
  } = options;
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
  const [pendingTurn, setPendingTurn] = useState<PendingTurnState | null>(null);

  // Track previous prospectId to detect changes for isolation
  const prevProspectIdRef = useRef<string | null | undefined>(undefined);
  const prevWorkspaceIdRef = useRef<string | null | undefined>(workspaceId);
  const prevPropThreadIdRef = useRef<string | null | undefined>(propThreadId);
  const syncedPropThreadIdRef = useRef<string | null | undefined>(propThreadId);
  const prevNewThreadSignalRef = useRef(newThreadSignal);
  const pendingTurnSequenceRef = useRef(0);
  const explicitNewThreadRef = useRef(false);
  const generatedThreadUrlSyncRef = useRef<string | null>(null);
  const chatSessionEpochRef = useRef(0);

  // Convex hooks
  const {
    currentUser,
    isReady: isConvexReady,
    isLoading: isConvexReadyLoading,
    error: convexReadyError,
  } = useConvexReady();
  const isSetupRoute = pathname === "/agent/setup";
  const shouldResolveSetupBootstrap =
    isSetupRoute && !prospectId && !propThreadId && !deferSetupHandoff;

  const setupBootstrapStateQuery = useQueryWithStatus(
    api.setupSessions.getSetupBootstrapState,
    isConvexReady && shouldResolveSetupBootstrap ? {} : "skip"
  );
  const setupBootstrapState = setupBootstrapStateQuery.data;
  const existingSetupSession = setupBootstrapState?.activeSession ?? null;
  const shouldBootstrapNewWorkspace =
    shouldResolveSetupBootstrap && action === "newWorkspace";
  const shouldBootstrapDefaultSetup =
    shouldResolveSetupBootstrap &&
    action !== "newWorkspace" &&
    setupBootstrapState?.suggestedMode === "first_workspace";
  const shouldAutoBootstrapSetup =
    !deferSetupHandoff &&
    !existingSetupSession &&
    (shouldBootstrapNewWorkspace || shouldBootstrapDefaultSetup);

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
  const createWorkspaceThreadWithPromptMutation = useMutation(
    api.chat.createWorkspaceThreadWithPrompt
  );
  // For setup bootstrap / resume
  const startSetupSessionMutation = useMutation(
    api.setupSessions.startSetupSession
  );
  const ensureSetupSessionWorkflowMutation = useMutation(
    api.setupSessions.ensureSetupSessionWorkflow
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
  const setupWorkflowRecoveryAttemptedRef = useRef<Set<string>>(new Set());
  const landingPromptHandoffAttemptedRef = useRef(false);
  const landingPromptHandoffPreparedRef = useRef(false);
  const landingPromptPendingTurnIdRef = useRef<string | null>(null);

  const createPendingTurn = useCallback(
    ({
      prompt,
      showUserPrompt = true,
      assistantLabel = "Thinking",
    }: {
      prompt: string;
      showUserPrompt?: boolean;
      assistantLabel?: string;
    }): PendingTurnState => {
      pendingTurnSequenceRef.current += 1;

      return {
        id: `pending-turn-${pendingTurnSequenceRef.current}`,
        prompt,
        phase: "submitting",
        threadId: null,
        messageId: null,
        order: null,
        showUserPrompt,
        assistantLabel,
      };
    },
    []
  );

  const hasExplicitNewThreadIntent =
    propThreadId === null &&
    (explicitNewThreadRef.current ||
      typeof prevPropThreadIdRef.current === "string");

  useEffect(() => {
    if (typeof propThreadId === "string") {
      explicitNewThreadRef.current = false;
    } else if (
      propThreadId === null &&
      typeof prevPropThreadIdRef.current === "string"
    ) {
      explicitNewThreadRef.current = true;
    }

    prevPropThreadIdRef.current = propThreadId;
  }, [propThreadId]);

  useEffect(() => {
    if (
      newThreadSignal === undefined ||
      newThreadSignal === prevNewThreadSignalRef.current
    ) {
      return;
    }

    prevNewThreadSignalRef.current = newThreadSignal;
    chatSessionEpochRef.current += 1;
    explicitNewThreadRef.current = true;
    generatedThreadUrlSyncRef.current = null;
    hasTriggeredAutoGenRef.current = false;
    stopRequestedRef.current = false;
    stopTargetThreadIdRef.current = null;

    setInternalThreadId((current) => (current === null ? current : null));
    setGeneratedThreadId((current) => (current === null ? current : null));
    setError((current) => (current === undefined ? current : undefined));
    setInputValue("");
    setPendingTurn((current) => (current === null ? current : null));
    setLocalLoading((current) => (current ? false : current));
    setIsInitialized((current) => (current ? current : true));
  }, [newThreadSignal]);

  // Sync with prop changes (URL navigation) - properly handle null for "New" button
  useEffect(() => {
    if (propThreadId === syncedPropThreadIdRef.current) {
      return;
    }

    syncedPropThreadIdRef.current = propThreadId;
    const isGeneratedThreadUrlSync =
      typeof propThreadId === "string" &&
      propThreadId === generatedThreadUrlSyncRef.current;
    const nextThreadId = propThreadId ?? null;

    setInternalThreadId((current) =>
      current === nextThreadId ? current : nextThreadId
    );
    setGeneratedThreadId((current) => (current === null ? current : null));

    if (!isGeneratedThreadUrlSync) {
      chatSessionEpochRef.current += 1;
      generatedThreadUrlSyncRef.current = null;
      setError((current) => (current === undefined ? current : undefined));
      setPendingTurn((current) => (current === null ? current : null));
      hasTriggeredAutoGenRef.current = false;
      stopRequestedRef.current = false;
      stopTargetThreadIdRef.current = null;
      return;
    }

    generatedThreadUrlSyncRef.current = null;
  }, [propThreadId]);

  // Reset all thread state when prospectId changes (prospect isolation)
  useEffect(() => {
    // Skip first render (when prevProspectIdRef is undefined)
    if (prevProspectIdRef.current === undefined) {
      prevProspectIdRef.current = prospectId;
      return;
    }

    // If prospectId changed, reset thread state for clean isolation
    if (prevProspectIdRef.current !== prospectId) {
      // Clear all thread-related state
      setInternalThreadId((current) =>
        current === (propThreadId ?? null) ? current : (propThreadId ?? null)
      );
      setGeneratedThreadId((current) => (current === null ? current : null));
      setError((current) => (current === undefined ? current : undefined));
      setInputValue("");
      setPendingTurn((current) => (current === null ? current : null));
      generatedThreadUrlSyncRef.current = null;
      chatSessionEpochRef.current += 1;
      explicitNewThreadRef.current = false;
      hasTriggeredAutoGenRef.current = false;
      stopRequestedRef.current = false;
      stopTargetThreadIdRef.current = null;

      // Mark as initialized to prevent getOrCreateThread from running
      setIsInitialized(true);

      prevProspectIdRef.current = prospectId;
    }
  }, [prospectId, propThreadId]);

  useEffect(() => {
    if (prospectId) {
      prevWorkspaceIdRef.current = workspaceId;
      return;
    }

    if (prevWorkspaceIdRef.current === undefined) {
      prevWorkspaceIdRef.current = workspaceId;
      return;
    }

    if (prevWorkspaceIdRef.current !== workspaceId) {
      setInternalThreadId((current) =>
        current === (propThreadId ?? null) ? current : (propThreadId ?? null)
      );
      setGeneratedThreadId((current) => (current === null ? current : null));
      setError((current) => (current === undefined ? current : undefined));
      setInputValue("");
      setPendingTurn((current) => (current === null ? current : null));
      generatedThreadUrlSyncRef.current = null;
      chatSessionEpochRef.current += 1;
      explicitNewThreadRef.current = false;
      hasTriggeredAutoGenRef.current = false;
      stopRequestedRef.current = false;
      stopTargetThreadIdRef.current = null;
      setIsInitialized(false);
      prevWorkspaceIdRef.current = workspaceId;
      return;
    }

    prevWorkspaceIdRef.current = workspaceId;
  }, [prospectId, propThreadId, workspaceId]);

  // Resolve initial route state on mount. Bare workspace `/agent` stays a draft
  // composer until the user selects a history item or sends the first message.
  useEffect(() => {
    if (convexReadyError) {
      setError(convexReadyError);
      setIsInitialized(true);
      return;
    }
    if (!isConvexReady || isInitialized) return;

    const initializationMode = resolveAgentThreadInitializationMode({
      threadId: propThreadId ?? null,
      prospectId: prospectId ?? null,
      shouldResolveSetupBootstrap,
    });

    if (initializationMode === "explicitThread") {
      setIsInitialized(true);
      return;
    }

    // Prospect and workspace routes are fresh by default. History/thread links
    // pass threadId explicitly.
    if (
      initializationMode === "prospectDraft" ||
      initializationMode === "workspaceDraft"
    ) {
      setIsInitialized(true);
      return;
    }

    // The setup route bootstraps its own setup thread. If no bootstrap is needed,
    // let the route guard redirect away instead of creating a generic chat thread.
    if (initializationMode === "setupBootstrap") {
      if (setupBootstrapStateQuery.isPending) {
        return;
      }

      if (setupBootstrapStateQuery.isError) {
        setError(setupBootstrapStateQuery.error);
        setIsInitialized(true);
        return;
      }

      if (existingSetupSession?.threadId) {
        setInternalThreadId(existingSetupSession.threadId);
        setGeneratedThreadId(existingSetupSession.threadId);
      }
      setIsInitialized(true);
      return;
    }
  }, [
    convexReadyError,
    isConvexReady,
    isInitialized,
    propThreadId,
    prospectId,
    shouldResolveSetupBootstrap,
    existingSetupSession?.sessionId,
    existingSetupSession?.threadId,
    setupBootstrapStateQuery.error,
    setupBootstrapStateQuery.isError,
    setupBootstrapStateQuery.isPending,
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
    const startedChatSessionEpoch = chatSessionEpochRef.current;
    const nextPendingTurn = createPendingTurn({
      prompt:
        "Generate an outreach plan for this prospect. Analyze their profile, recent activity, and pain points to create a personalized engagement strategy.",
      showUserPrompt: false,
      assistantLabel: "Generating plan",
    });
    setPendingTurn(nextPendingTurn);

    const triggerAutoGeneration = async () => {
      try {
        setLocalLoading(true);
        // Create thread with auto-prompt for plan generation
        // NOTE: Do NOT include prospect ID in prompt - context is injected via
        // outreach agent's contextHandler automatically
        const result = await createProspectThreadWithPromptMutation({
          prospectId:
            prospectId as import("@/convex/_generated/dataModel").Id<"prospects">,
          prompt: nextPendingTurn.prompt,
        });

        if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
          return;
        }

        // Update internal state with new threadId
        generatedThreadUrlSyncRef.current = result.threadId;
        setInternalThreadId(result.threadId);
        // Set generatedThreadId for URL sync in AgentChat
        setGeneratedThreadId(result.threadId);
        setPendingTurn((current) =>
          current?.id !== nextPendingTurn.id
            ? current
            : {
                ...current,
                threadId: result.threadId,
                messageId: result.messageId,
                order: result.order,
                phase: current.phase === "stopping" ? "stopping" : "queued",
              }
        );
        setIsInitialized(true);
      } catch (err) {
        if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
          return;
        }

        agentChatLogger.error("Failed to auto-generate plan", err);
        const nextError =
          err instanceof Error ? err : new Error("Failed to generate plan");
        setError(nextError);
        setPendingTurn((current) =>
          current?.id !== nextPendingTurn.id
            ? current
            : {
                ...current,
                phase: "failed",
                errorMessage: nextError.message,
              }
        );
      } finally {
        if (chatSessionEpochRef.current === startedChatSessionEpoch) {
          setLocalLoading(false);
        }
      }
    };

    triggerAutoGeneration();
  }, [
    action,
    prospectId,
    propThreadId,
    isConvexReady,
    createProspectThreadWithPromptMutation,
    createPendingTurn,
  ]);

  // Bootstrap the setup thread without starting a hidden greeting turn. The
  // empty thread is intentional: the user supplies the first message.
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
    const startedChatSessionEpoch = chatSessionEpochRef.current;
    const triggerSetupBootstrap = async () => {
      try {
        setLocalLoading(true);
        const result = await startSetupSessionMutation({
          mode: shouldBootstrapNewWorkspace
            ? "new_workspace"
            : "first_workspace",
        });

        if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
          return;
        }

        generatedThreadUrlSyncRef.current = result.threadId;
        setInternalThreadId(result.threadId);
        setGeneratedThreadId(result.threadId);
        setIsInitialized(true);
      } catch (err) {
        if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
          return;
        }

        agentChatLogger.error("Failed to create setup thread", err);
        const nextError =
          err instanceof Error
            ? err
            : new Error("Failed to start workspace setup");
        setError(nextError);
      } finally {
        if (chatSessionEpochRef.current === startedChatSessionEpoch) {
          setLocalLoading(false);
        }
      }
    };

    triggerSetupBootstrap();
  }, [
    shouldAutoBootstrapSetup,
    shouldBootstrapNewWorkspace,
    prospectId,
    propThreadId,
    isConvexReady,
    startSetupSessionMutation,
  ]);

  // NOTE: Auto-approval effect removed. Clicking on task approval notifications
  // now just routes to the thread - users manually type their approval message.

  // Current threadId (prop takes precedence)
  const threadId =
    typeof propThreadId === "string"
      ? propThreadId
      : hasExplicitNewThreadIntent
        ? null
        : internalThreadId;
  const setupSessionStateQuery = useQueryWithStatus(
    api.setupSessions.getSetupSessionState,
    isConvexReady && isSetupRoute && threadId ? { threadId } : "skip"
  );
  const setupSessionForChat =
    setupSessionStateQuery.data ?? existingSetupSession;
  const setupSessionForChatId = setupSessionForChat?.sessionId ?? null;

  // Prepare a stored `/home` prompt before the browser paints the empty setup
  // state. The durable send still waits for the server-owned setup session.
  useLayoutEffect(() => {
    if (!isSetupRoute || deferSetupHandoff) {
      landingPromptHandoffPreparedRef.current = false;
      landingPromptPendingTurnIdRef.current = null;
      return;
    }
    if (
      landingPromptHandoffPreparedRef.current ||
      typeof window === "undefined"
    ) {
      return;
    }

    landingPromptHandoffPreparedRef.current = true;
    const handoff = readStoredLandingPromptHandoff(window.sessionStorage);
    if (!handoff || handoff.requiresNewWorkspaceDecision) {
      return;
    }

    const nextPendingTurn = createPendingTurn({ prompt: handoff.prompt });
    landingPromptPendingTurnIdRef.current = nextPendingTurn.id;
    setPendingTurn(nextPendingTurn);
  }, [createPendingTurn, deferSetupHandoff, isSetupRoute]);

  // Landing composer handoff: one-shot prompt becomes a real Setup Agent turn.
  useEffect(() => {
    if (
      landingPromptHandoffAttemptedRef.current ||
      !isSetupRoute ||
      deferSetupHandoff ||
      !isConvexReady ||
      !setupSessionForChat
    ) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const storedHandoff = readStoredLandingPromptHandoff(window.sessionStorage);
    if (!storedHandoff || storedHandoff.requiresNewWorkspaceDecision) {
      return;
    }

    const status = setupSessionForChat.status;
    const canSubmitStoredPrompt =
      status === "draft" || status === "awaiting_input" || status === "failed";
    // An authenticated `/home` send is already durable and only needs to be
    // presented and consumed here. Legacy/post-auth handoffs still require an
    // input-accepting session because this effect must submit them itself.
    if (!storedHandoff.submittedTurn && !canSubmitStoredPrompt) {
      return;
    }

    landingPromptHandoffAttemptedRef.current = true;
    const startedChatSessionEpoch = chatSessionEpochRef.current;
    const pendingTurnId = landingPromptPendingTurnIdRef.current;
    void deliverStoredLandingPromptHandoff(
      window.sessionStorage,
      async (handoff) => {
        const submittedTurn = handoff.submittedTurn;
        if (submittedTurn) {
          if (submittedTurn.threadId !== setupSessionForChat.threadId) {
            throw new Error("Stored setup turn does not match this thread.");
          }

          setPendingTurn((current) =>
            !pendingTurnId || current?.id !== pendingTurnId
              ? current
              : {
                  ...current,
                  threadId: submittedTurn.threadId,
                  messageId: submittedTurn.messageId,
                  order: submittedTurn.order,
                  phase: current.phase === "stopping" ? "stopping" : "queued",
                }
          );
          return;
        }

        setLocalLoading(true);
        setError(undefined);
        try {
          const result = await sendMessageMutation(
            buildLandingSetupHandoffRequest(
              setupSessionForChat.threadId,
              handoff
            )
          );

          if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
            return;
          }

          setPendingTurn((current) =>
            !pendingTurnId || current?.id !== pendingTurnId
              ? current
              : {
                  ...current,
                  threadId: setupSessionForChat.threadId,
                  messageId: result.messageId,
                  order: result.order,
                  phase: current.phase === "stopping" ? "stopping" : "queued",
                }
          );
        } finally {
          if (chatSessionEpochRef.current === startedChatSessionEpoch) {
            setLocalLoading(false);
          }
        }
      }
    )
      .then((outcome) => {
        if (outcome === "missing") {
          landingPromptHandoffAttemptedRef.current = false;
          if (pendingTurnId) {
            setPendingTurn((current) =>
              current?.id === pendingTurnId ? null : current
            );
          }
        }
      })
      .catch((handoffError) => {
        landingPromptHandoffAttemptedRef.current = false;
        const nextError =
          handoffError instanceof Error
            ? handoffError
            : new Error("Failed to submit the setup description");
        setError(nextError);
        if (pendingTurnId) {
          setPendingTurn((current) =>
            current?.id !== pendingTurnId
              ? current
              : {
                  ...current,
                  phase: "failed",
                  errorMessage: nextError.message,
                }
          );
        }
        agentChatLogger.error(
          "Failed to apply landing setup prompt",
          handoffError
        );
      });
  }, [
    deferSetupHandoff,
    isConvexReady,
    isSetupRoute,
    setupSessionForChat,
    sendMessageMutation,
  ]);

  const threadGenerationStateQuery = useQueryWithStatus(
    api.chat.getThreadGenerationState,
    isConvexReady && isInitialized && threadId ? { threadId } : "skip"
  );
  const planBatchTurnStateQuery = useQueryWithStatus(
    api.planBatches.getPlanBatchTurnState,
    isConvexReady && pendingTurn?.messageId
      ? { messageId: pendingTurn.messageId }
      : "skip"
  );

  useEffect(() => {
    seenFailedMessageKeysRef.current.clear();
    reconciledIssueKeysRef.current.clear();
    timeoutIssueKeysRef.current.clear();
    suppressNextFailureToastThreadIdsRef.current.clear();
    hasInitializedFailedMessagesRef.current = false;
    setupWorkflowRecoveryAttemptedRef.current.clear();
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

  // Keep legacy hidden greeting turns out of setup transcripts. New setup
  // sessions no longer create these, but existing drafts may still contain one.
  const messages = useMemo(() => {
    if (!threadId || !agentMessages) return [];
    const legacySetupGreetingOrders = agentMessages.reduce(
      (orders, message) => {
        if (
          message.role === "user" &&
          getUIMessageDisplayText(message).trim() === INIT_PROMPT
        ) {
          orders.add(message.order);
        }
        return orders;
      },
      new Set<number>()
    );

    return agentMessages.filter((m) => {
      if (
        m.role === "user" &&
        getUIMessageDisplayText(m).trim() === INIT_PROMPT
      ) {
        return false;
      }

      return !(
        isSetupRoute &&
        m.role === "assistant" &&
        legacySetupGreetingOrders.has(m.order)
      );
    });
  }, [agentMessages, isSetupRoute, threadId]);
  const visibleMessageStatus: MessageStatus = threadId
    ? messageStatus
    : "Exhausted";

  const hasPersistedPendingAssistant =
    Boolean(threadId) &&
    messages.some(
      (message) => message.role === "assistant" && message.status === "pending"
    );

  // Per docs: UIMessage has status field - check for streaming
  const isStreaming =
    Boolean(threadId) && messages.some((m) => m.status === "streaming");

  useEffect(() => {
    if (!pendingTurn) {
      return;
    }

    if (pendingTurn.messageId && planBatchTurnStateQuery.isPending) {
      return;
    }

    const planBatchTurnState = planBatchTurnStateQuery.data;
    if (isPlanBatchTurnWaiting(planBatchTurnState)) {
      setPendingTurn((current) =>
        updatePendingTurnPhase(current, pendingTurn.id, "streaming")
      );
      return;
    }

    const canRenderPersistedMessages =
      visibleMessageStatus !== "LoadingFirstPage";
    const hasVisiblePersistedUserPrompt =
      !pendingTurn.showUserPrompt ||
      (canRenderPersistedMessages &&
        messages.some((message) => {
          if (message.role !== "user") {
            return false;
          }

          if (getUIMessageDisplayText(message) !== pendingTurn.prompt) {
            return false;
          }

          return pendingTurn.order === null
            ? true
            : message.order === pendingTurn.order;
        }));

    if (pendingTurn.order === null) {
      if (isStreaming) {
        setPendingTurn((current) =>
          updatePendingTurnPhase(current, pendingTurn.id, "streaming")
        );
        return;
      }

      if (
        pendingTurn.phase === "streaming" &&
        hasVisiblePersistedUserPrompt &&
        messages.some((message) => message.role === "assistant")
      ) {
        setPendingTurn((current) =>
          current?.id === pendingTurn.id ? null : current
        );
      }
      return;
    }

    const matchingAssistantMessage = messages.find(
      (message) =>
        message.role === "assistant" && message.order === pendingTurn.order
    );

    if (!matchingAssistantMessage) {
      return;
    }

    if (matchingAssistantMessage.status === "streaming") {
      setPendingTurn((current) =>
        updatePendingTurnPhase(current, pendingTurn.id, "streaming")
      );
      return;
    }

    if (!hasVisiblePersistedUserPrompt) {
      setPendingTurn((current) =>
        updatePendingTurnPhase(current, pendingTurn.id, "streaming")
      );
      return;
    }

    setPendingTurn((current) =>
      current?.id === pendingTurn.id ? null : current
    );
  }, [
    isStreaming,
    visibleMessageStatus,
    messages,
    pendingTurn,
    planBatchTurnStateQuery.data,
    planBatchTurnStateQuery.isPending,
  ]);

  useEffect(() => {
    if (!error) {
      return;
    }

    setPendingTurn((current) =>
      current
        ? {
            ...current,
            phase: "failed",
            errorMessage: error.message,
          }
        : current
    );
  }, [error]);

  const hasPendingTurn =
    pendingTurn !== null &&
    pendingTurn.phase !== "failed" &&
    pendingTurn.phase !== "finished";

  const setupDurableStatusSettledChatTurn = Boolean(
    isSetupRoute &&
    setupSessionForChat &&
    !["draft", "awaiting_input", "failed"].includes(
      setupSessionForChat.status
    ) &&
    !isStreaming
  );

  // Combined loading state. Setup's durable status owns long-running locks;
  // stale local/persisted pending rows must not keep showing a Stop button once
  // the setup Agent turn itself has stopped streaming.
  const isLoading =
    localLoading ||
    (!setupDurableStatusSettledChatTurn &&
      (hasPendingTurn || hasPersistedPendingAssistant)) ||
    isStreaming;

  useEffect(() => {
    if (
      !isSetupRoute ||
      !threadId ||
      !setupSessionForChatId ||
      setupWorkflowRecoveryAttemptedRef.current.has(threadId)
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setupWorkflowRecoveryAttemptedRef.current.add(threadId);
      void ensureSetupSessionWorkflowMutation({ threadId }).catch((err) => {
        setupWorkflowRecoveryAttemptedRef.current.delete(threadId);
        agentChatLogger.error("Failed to recover setup workflow", err);
      });
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    ensureSetupSessionWorkflowMutation,
    isSetupRoute,
    setupSessionForChatId,
    threadId,
  ]);

  useEffect(() => {
    if (!setupDurableStatusSettledChatTurn || isStreaming || !pendingTurn) {
      return;
    }

    setPendingTurn((current) =>
      current?.id === pendingTurn.id ? null : current
    );
  }, [pendingTurn, setupDurableStatusSettledChatTurn, isStreaming]);

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
        agentChatLogger.error("Failed to abort stream", err);
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
        agentChatLogger.error("Failed to reconcile stalled generation", err);
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
    async (content?: string | AgentChatMessageInput) => {
      const payload =
        typeof content === "string"
          ? {
              prompt: content,
              metadata: null,
            }
          : (content ?? {
              prompt: inputValue,
              metadata: null,
            });
      const normalizedMetadata = normalizeAgentMessageContextMetadata(
        payload.metadata
      );
      const messageContent = payload.prompt.trim();
      if (!messageContent && !normalizedMetadata) return;
      if (!isConvexReady || isConvexReadyLoading) return;

      if (isSetupRoute && !threadId) {
        const setupError = new Error(
          "Setup is not ready. Resolve the setup error before sending a message."
        );
        setError(setupError);
        return;
      }

      const startedChatSessionEpoch = chatSessionEpochRef.current;
      stopRequestedRef.current = false;
      stopTargetThreadIdRef.current = null;
      const nextPendingTurn = createPendingTurn({
        prompt: messageContent,
      });
      setPendingTurn(nextPendingTurn);

      // If prospectId provided but no thread, create one with the first message
      if (prospectId && !threadId) {
        setInputValue("");
        setLocalLoading(true);
        setError(undefined);

        try {
          const result = await createProspectThreadWithPromptMutation({
            prospectId: prospectId as Id<"prospects">,
            prompt: messageContent,
            metadata: normalizedMetadata ?? undefined,
          });

          if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
            return;
          }

          generatedThreadUrlSyncRef.current = result.threadId;
          explicitNewThreadRef.current = false;
          setInternalThreadId(result.threadId);
          setGeneratedThreadId(result.threadId);
          setPendingTurn((current) =>
            current?.id !== nextPendingTurn.id
              ? current
              : {
                  ...current,
                  threadId: result.threadId,
                  messageId: result.messageId,
                  order: result.order,
                  phase: current.phase === "stopping" ? "stopping" : "queued",
                }
          );
        } catch (err) {
          if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
            return;
          }

          agentChatLogger.error("Failed to create thread", err);
          const nextError =
            err instanceof Error ? err : new Error("Failed to send message");
          setError(nextError);
          setPendingTurn((current) =>
            current?.id !== nextPendingTurn.id
              ? current
              : {
                  ...current,
                  phase: "failed",
                  errorMessage: nextError.message,
                }
          );
        } finally {
          if (chatSessionEpochRef.current === startedChatSessionEpoch) {
            setLocalLoading(false);
          }
        }
        return;
      }

      if (!threadId) {
        if (!prospectId) {
          setInputValue("");
          setLocalLoading(true);
          setError(undefined);

          try {
            const result = await createWorkspaceThreadWithPromptMutation({
              workspaceId:
                workspaceId !== null && workspaceId !== undefined
                  ? (workspaceId as Id<"workspaces">)
                  : undefined,
              prompt: messageContent,
              metadata: normalizedMetadata ?? undefined,
            });

            if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
              return;
            }

            generatedThreadUrlSyncRef.current = result.threadId;
            explicitNewThreadRef.current = false;
            setInternalThreadId(result.threadId);
            setGeneratedThreadId(result.threadId);
            setPendingTurn((current) =>
              current?.id !== nextPendingTurn.id
                ? current
                : {
                    ...current,
                    threadId: result.threadId,
                    messageId: result.messageId,
                    order: result.order,
                    phase: current.phase === "stopping" ? "stopping" : "queued",
                  }
            );
          } catch (err) {
            if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
              return;
            }

            agentChatLogger.error("Failed to create workspace thread", err);
            const nextError =
              err instanceof Error ? err : new Error("Failed to send message");
            setError(nextError);
            setPendingTurn((current) =>
              current?.id !== nextPendingTurn.id
                ? current
                : {
                    ...current,
                    phase: "failed",
                    errorMessage: nextError.message,
                  }
            );
          } finally {
            if (chatSessionEpochRef.current === startedChatSessionEpoch) {
              setLocalLoading(false);
            }
          }
        }
        return;
      }

      setInputValue("");
      setLocalLoading(true);
      setError(undefined);

      try {
        // Use prospect-specific mutation for prospect threads (outreach agent)
        if (prospectId) {
          const result = await sendProspectMessageMutation({
            threadId,
            prompt: messageContent,
            metadata: normalizedMetadata ?? undefined,
          });

          if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
            return;
          }

          setPendingTurn((current) =>
            current?.id !== nextPendingTurn.id
              ? current
              : {
                  ...current,
                  threadId,
                  messageId: result.messageId,
                  order: result.order,
                  phase: current.phase === "stopping" ? "stopping" : "queued",
                }
          );
        } else {
          // Use general mutation for setup/workspace threads
          const pastedUrl = isSetupRoute
            ? getUrlFromWholeValue(messageContent)
            : null;
          const setupSourceUrl =
            pastedUrl ?? payload.setupSourceUrl?.trim() ?? null;
          const result = await sendMessageMutation({
            threadId,
            prompt: messageContent,
            metadata: normalizedMetadata ?? undefined,
            ...(setupSourceUrl ? { setupSourceUrl } : {}),
            ...(isSetupRoute ? { expectedSurface: "setup" as const } : {}),
          });

          if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
            return;
          }

          setPendingTurn((current) =>
            current?.id !== nextPendingTurn.id
              ? current
              : {
                  ...current,
                  threadId,
                  messageId: result.messageId,
                  order: result.order,
                  phase: current.phase === "stopping" ? "stopping" : "queued",
                }
          );
        }
      } catch (err) {
        if (chatSessionEpochRef.current !== startedChatSessionEpoch) {
          return;
        }

        agentChatLogger.error("Failed to send message", err);
        const nextError =
          err instanceof Error ? err : new Error("Failed to send message");
        setError(nextError);
        setPendingTurn((current) =>
          current?.id !== nextPendingTurn.id
            ? current
            : {
                ...current,
                phase: "failed",
                errorMessage: nextError.message,
              }
        );
      } finally {
        if (chatSessionEpochRef.current === startedChatSessionEpoch) {
          setLocalLoading(false);
        }
      }
    },
    [
      inputValue,
      threadId,
      prospectId,
      isConvexReady,
      isConvexReadyLoading,
      createPendingTurn,
      sendMessageMutation,
      sendProspectMessageMutation,
      createProspectThreadWithPromptMutation,
      createWorkspaceThreadWithPromptMutation,
      workspaceId,
      isSetupRoute,
    ]
  );

  // Stop handler - abort any active stream for the current thread
  const stop = useCallback(() => {
    setLocalLoading(false);
    stopRequestedRef.current = true;
    const targetThreadId = pendingTurn?.threadId ?? threadId;
    stopTargetThreadIdRef.current = targetThreadId;
    setPendingTurn((current) =>
      current === null
        ? current
        : updatePendingTurnPhase(current, current.id, "stopping")
    );
    if (targetThreadId) {
      suppressNextFailureToastThreadIdsRef.current.add(targetThreadId);
    }
    void abortActiveStream(targetThreadId);
  }, [abortActiveStream, pendingTurn, threadId]);

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
    messageStatus: visibleMessageStatus,
    input: inputValue,
    isLoading,
    isStreaming,
    error,
    pendingTurn,

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
    hasMore: visibleMessageStatus === "CanLoadMore",
  };
}
