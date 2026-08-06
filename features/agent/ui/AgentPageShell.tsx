"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/shared/lib/utils";
import {
  useActiveUseCaseLabels,
  useQueryWithStatus,
  useWorkspace,
} from "@/shared/hooks";
import { useAgentProspectQuery } from "../hooks/useAgentProspectQuery";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import {
  ProspectPanelRenderer,
  usePanelStack,
  useProspectProfile,
} from "@/features/prospects";
import { AgentChat } from "./AgentChat";
import {
  getTweetIdFromPostPayload,
  type AgentPanelMode,
  type InlinePanelOpenPayload,
} from "../lib/panel";
import { AgentDynamicPanel } from "./components/AgentDynamicPanel";
import { AgentOnboardingPanel } from "./components/AgentOnboardingPanel";
import { AgentPlanPanel } from "./components/AgentPlanPanel";
import { AgentOnboardingPanelSpinner } from "./components/AgentOnboardingPanelSpinner";
import { HistoryPanel } from "./components/HistoryPanel";
import { WorkspaceProfileReviewPanel } from "./components/WorkspaceProfileReviewPanel";
import {
  DESKTOP_PANEL_BORDER_CLASS_NAME,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { TwitterProfilePanel } from "@/features/profile/ui/components/TwitterProfilePanel";
import { useSetupThreadDraft } from "@/shared/hooks/useSetupThreadDraft";
import { shouldSyncAgentThreadToRoute } from "../lib/agentThreadInitialization";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";
import {
  clearStoredLandingPromptHandoff,
  type LandingPromptHandoff,
  readStoredLandingPromptHandoff,
  writeStoredLandingPromptHandoff,
} from "@/features/landing/lib/landingPromptStorage";
import { submitLandingSetupHandoffToThread } from "../lib/landingSetupHandoff";
import { useNewWorkspaceDraftFlow } from "@/features/webapp/hooks/useNewWorkspaceDraftFlow";
import { setPreferredShellContext } from "@/shared/stores/preferredShellContext";
import { optimisticallySendMessage } from "@convex-dev/agent/react";

export function AgentPageShell() {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { routes } = useActiveUseCaseLabels();
  const { workspace } = useWorkspace();
  const workspaceId = workspace?._id ?? null;
  const {
    openProspect,
    closeProspect,
    prospectId: activeProspectPanelId,
  } = useProspectProfile();
  const { currentPanel, pushPanel } = usePanelStack();
  const {
    openProfile,
    closeProfile,
    isOpen: isTwitterProfileOpen,
  } = useProfile();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rightPanelSessionOpen, setRightPanelSessionOpen] = useState(false);
  const rightPanelSessionOpenRef = useRef(false);
  const [prospectPanelSessionProspectId, setProspectPanelSessionProspectId] =
    useState<string | null>(null);
  const [planPanelProspectId, setPlanPanelProspectId] = useState<string | null>(
    null
  );

  const [effectiveThreadId, setEffectiveThreadId] = useState<string | null>(
    null
  );
  const [newThreadSignal, setNewThreadSignal] = useState(0);
  const [setupOnboardingPanelOpen, setSetupOnboardingPanelOpen] =
    useState(false);

  const [
    {
      prospectId,
      threadId,
      action,
      notificationId,
      panel,
      taskId,
      actionRequestId,
      panelState,
      targetTweetId,
      workspaceProfileRequestId,
    },
    setParams,
  ] = useQueryStates({
    prospectId: parseAsString,
    threadId: parseAsString,
    action: parseAsString,
    notificationId: parseAsString,
    panel: parseAsString,
    taskId: parseAsString,
    actionRequestId: parseAsString,
    panelState: parseAsString,
    targetTweetId: parseAsString,
    workspaceProfileRequestId: parseAsString,
  });
  const previousRouteThreadIdRef = useRef<string | null>(threadId);
  const staleEffectiveThreadIdRef = useRef<string | null>(null);
  const threadRouteContext = useQuery(
    api.chat.getThreadRouteContext,
    threadId ? { threadId } : "skip"
  );
  const threadSelectedContext = useQuery(
    api.chat.getThreadSelectedContext,
    threadId ? { threadId } : "skip"
  );

  const prevProspectIdRef = useRef<string | null>(null);
  const suppressNextProspectThreadResetRef = useRef(false);
  const routePanelKeyRef = useRef<string | null>(null);
  const [cardPayload, setCardPayload] = useState<InlinePanelOpenPayload | null>(
    null
  );

  const setRightPanelSessionActive = useCallback((nextIsOpen: boolean) => {
    rightPanelSessionOpenRef.current = nextIsOpen;
    setRightPanelSessionOpen(nextIsOpen);
  }, []);

  useEffect(() => {
    if (activeProspectPanelId === null && prospectPanelSessionProspectId) {
      queueMicrotask(() => {
        setProspectPanelSessionProspectId(null);
      });
    }
  }, [activeProspectPanelId, prospectPanelSessionProspectId]);

  useEffect(() => {
    if (
      prospectPanelSessionProspectId &&
      prospectId &&
      prospectPanelSessionProspectId !== prospectId
    ) {
      queueMicrotask(() => {
        setProspectPanelSessionProspectId(null);
      });
    }
  }, [prospectId, prospectPanelSessionProspectId]);

  useEffect(() => {
    if (!threadId || !threadRouteContext) {
      return;
    }

    if (
      threadRouteContext.kind === "prospect" &&
      prospectId !== String(threadRouteContext.prospectId)
    ) {
      suppressNextProspectThreadResetRef.current = true;
      setParams({
        prospectId: String(threadRouteContext.prospectId),
      });
      return;
    }

    if (threadRouteContext.kind === "missing") {
      setParams({ threadId: null });
      return;
    }

    if (threadRouteContext.kind === "workspace" && prospectId !== null) {
      suppressNextProspectThreadResetRef.current = true;
      setParams({
        prospectId: null,
        panel: null,
        panelState: null,
        taskId: null,
        actionRequestId: null,
        targetTweetId: null,
        workspaceProfileRequestId: null,
      });
    }
  }, [prospectId, setParams, threadId, threadRouteContext]);

  useEffect(() => {
    if (
      prevProspectIdRef.current !== null &&
      prevProspectIdRef.current !== prospectId &&
      threadId
    ) {
      if (suppressNextProspectThreadResetRef.current) {
        suppressNextProspectThreadResetRef.current = false;
      } else {
        setParams({ threadId: null });
      }
    }
    prevProspectIdRef.current = prospectId;
  }, [prospectId, threadId, setParams]);

  const handleEffectiveThreadIdChange = useCallback(
    (newThreadId: string | null) => {
      setEffectiveThreadId((current) =>
        current === newThreadId ? current : newThreadId
      );
    },
    []
  );

  const handleHistoryClick = useCallback(() => {
    setPlanPanelProspectId(null);
    setProspectPanelSessionProspectId(null);
    closeProspect();

    if (isMobile) {
      router.push(
        `/agent/history${prospectId ? `?prospectId=${prospectId}` : ""}`
      );
    } else {
      setParams({
        panel: null,
        panelState: null,
        actionRequestId: null,
        targetTweetId: null,
        workspaceProfileRequestId: null,
      });
      setRightPanelSessionActive(false);
      setHistoryOpen(true);
    }
  }, [
    closeProspect,
    isMobile,
    router,
    prospectId,
    setParams,
    setRightPanelSessionActive,
  ]);

  const handleNewThread = useCallback(() => {
    setNewThreadSignal((current) => current + 1);
    setEffectiveThreadId(null);
    setPlanPanelProspectId(null);
    setParams({
      threadId: null,
      action: null,
      panel: null,
      taskId: null,
      actionRequestId: null,
      panelState: null,
      targetTweetId: null,
      workspaceProfileRequestId: null,
    });
    setHistoryOpen(false);
    setRightPanelSessionActive(false);
  }, [setParams, setRightPanelSessionActive]);

  const handleDeleteCurrentThread = useCallback(() => {
    setPlanPanelProspectId(null);
    setParams({
      threadId: null,
      action: null,
      panel: null,
      taskId: null,
      actionRequestId: null,
      panelState: null,
      targetTweetId: null,
      workspaceProfileRequestId: null,
    });
    setRightPanelSessionActive(false);
  }, [setParams, setRightPanelSessionActive]);

  const handleSelectThread = useCallback(
    (newThreadId: string) => {
      setPlanPanelProspectId(null);
      setParams({
        threadId: newThreadId,
        panel: null,
        taskId: null,
        actionRequestId: null,
        panelState: null,
        targetTweetId: null,
        workspaceProfileRequestId: null,
      });
      setHistoryOpen(false);
      setCardPayload(null);
      setRightPanelSessionActive(false);
    },
    [setParams, setRightPanelSessionActive]
  );

  const handleOpenSetupOnboardingPanel = useCallback(() => {
    setSetupOnboardingPanelOpen(true);
  }, []);

  const hasProspectContext = !!prospectId;
  const isSetupRoute = pathname === "/agent/setup";
  const canUseThreadHistory = !isSetupRoute && (!!prospectId || !!workspaceId);
  const shouldResolveLandingDraftDecision =
    isSetupRoute && action === "newWorkspace";
  const [landingDraftHandoff, setLandingDraftHandoff] =
    useState<LandingPromptHandoff | null>(null);
  const [isLandingDraftDecisionPending, setIsLandingDraftDecisionPending] =
    useState(shouldResolveLandingDraftDecision);
  const landingDraftDecisionRequestedRef = useRef(false);
  const submitSetupMessageMutation = useMutation(
    api.chat.initiateStreamingMessage
  );
  const landingSetupBootstrapQuery = useQueryWithStatus(
    api.setupSessions.getSetupBootstrapState,
    shouldResolveLandingDraftDecision ? {} : "skip"
  );
  const landingSetupMode =
    landingSetupBootstrapQuery.data?.activeSession?.mode ===
      "first_workspace" ||
    landingSetupBootstrapQuery.data?.suggestedMode === "first_workspace"
      ? "first_workspace"
      : "new_workspace";

  useLayoutEffect(() => {
    if (!shouldResolveLandingDraftDecision || typeof window === "undefined") {
      landingDraftDecisionRequestedRef.current = false;
      setLandingDraftHandoff(null);
      setIsLandingDraftDecisionPending(false);
      return;
    }

    const storedHandoff = readStoredLandingPromptHandoff(window.sessionStorage);
    if (!storedHandoff?.requiresNewWorkspaceDecision) {
      landingDraftDecisionRequestedRef.current = false;
      setLandingDraftHandoff(null);
      setIsLandingDraftDecisionPending(false);
      return;
    }

    setLandingDraftHandoff(storedHandoff);
    setIsLandingDraftDecisionPending(true);
  }, [shouldResolveLandingDraftDecision]);

  const resolveLandingDraftRoute = useCallback(
    async (nextThreadId: string) => {
      setPreferredShellContext("setup_session");
      await setParams({ threadId: nextThreadId, action: null });
      setLandingDraftHandoff(null);
      setIsLandingDraftDecisionPending(false);
    },
    [setParams]
  );

  const cancelPostAuthLandingDraftDecision = useCallback(() => {
    if (typeof window !== "undefined") {
      clearStoredLandingPromptHandoff(window.sessionStorage);
    }
    landingDraftDecisionRequestedRef.current = false;
    setLandingDraftHandoff(null);
    setIsLandingDraftDecisionPending(false);
    router.replace("/home");
  }, [router]);

  const handlePostAuthLandingSessionSelected = useCallback(
    async ({
      kind,
      threadId: selectedThreadId,
    }: {
      kind: "created" | "continued";
      threadId: string;
    }) => {
      if (typeof window === "undefined" || !landingDraftHandoff) {
        throw new Error("The landing description is no longer available.");
      }

      if (kind === "continued") {
        // Match the in-app New workspace flow: resume the existing draft
        // without applying the newly submitted landing description to it.
        clearStoredLandingPromptHandoff(window.sessionStorage);
        await resolveLandingDraftRoute(selectedThreadId);
        return;
      }

      const submittedHandoff = await submitLandingSetupHandoffToThread({
        threadId: selectedThreadId,
        handoff: landingDraftHandoff,
        submitSetupMessage: submitSetupMessageMutation,
      });
      writeStoredLandingPromptHandoff(window.sessionStorage, submittedHandoff);
      await resolveLandingDraftRoute(selectedThreadId);
    },
    [landingDraftHandoff, resolveLandingDraftRoute, submitSetupMessageMutation]
  );

  const landingDraftFlow = useNewWorkspaceDraftFlow({
    enabled:
      shouldResolveLandingDraftDecision &&
      isLandingDraftDecisionPending &&
      Boolean(landingDraftHandoff) &&
      !landingSetupBootstrapQuery.isPending,
    mode: landingSetupMode,
    onCancel: cancelPostAuthLandingDraftDecision,
    onError: cancelPostAuthLandingDraftDecision,
    onSessionSelected: handlePostAuthLandingSessionSelected,
  });

  useEffect(() => {
    if (
      !landingDraftHandoff ||
      !isLandingDraftDecisionPending ||
      landingSetupBootstrapQuery.isPending ||
      landingDraftDecisionRequestedRef.current
    ) {
      return;
    }

    landingDraftDecisionRequestedRef.current = true;
    void landingDraftFlow.requestNewWorkspace();
  }, [
    isLandingDraftDecisionPending,
    landingDraftFlow,
    landingDraftHandoff,
    landingSetupBootstrapQuery.isPending,
  ]);

  useEffect(() => {
    const previousRouteThreadId = previousRouteThreadIdRef.current;
    previousRouteThreadIdRef.current = threadId;

    if (previousRouteThreadId && !threadId) {
      staleEffectiveThreadIdRef.current = previousRouteThreadId;
    } else if (threadId) {
      staleEffectiveThreadIdRef.current = null;
    }
  }, [threadId]);

  useEffect(() => {
    if (
      !shouldSyncAgentThreadToRoute({
        effectiveThreadId,
        routeThreadId: threadId,
        staleThreadId: staleEffectiveThreadIdRef.current,
        isSetupRoute,
      })
    ) {
      return;
    }

    staleEffectiveThreadIdRef.current = null;
    setParams({
      threadId: effectiveThreadId,
      action: null,
    });
  }, [effectiveThreadId, isSetupRoute, setParams, threadId]);

  const agentProspectQuery = useAgentProspectQuery(prospectId);
  const historyProspectArchived =
    agentProspectQuery.data?.status === "archived";
  const setupPanelThreadId = effectiveThreadId ?? threadId ?? null;

  // ---- Setup panel: approve ICPs through the chat thread ----
  const APPROVE_ICP_PROMPT =
    "I approve these ideal profiles. Continue with setup.";
  const initiateStreamingMessage = useMutation(
    api.chat.initiateStreamingMessage
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages)
  );
  const handlePanelApproveIdealProfiles = useCallback(async () => {
    const resolvedThreadId = setupPanelThreadId;
    if (!resolvedThreadId) return;
    await initiateStreamingMessage({
      threadId: resolvedThreadId,
      prompt: APPROVE_ICP_PROMPT,
      expectedSurface: "setup" as const,
    });
  }, [initiateStreamingMessage, setupPanelThreadId]);
  const setupPanelDraft = useSetupThreadDraft(
    isSetupRoute ? setupPanelThreadId : null
  );

  const setupPanelThreadRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const next = threadId ?? null;
    if (setupPanelThreadRef.current === undefined) {
      setupPanelThreadRef.current = next;
      return;
    }
    const prev = setupPanelThreadRef.current;
    if (prev !== next) {
      // Keep panel open when URL first picks up threadId after bootstrap (null -> id)
      if (prev === null && next !== null) {
        setupPanelThreadRef.current = next;
        return;
      }
      queueMicrotask(() => {
        setSetupOnboardingPanelOpen(false);
      });
    }
    setupPanelThreadRef.current = next;
  }, [threadId]);

  useEffect(() => {
    if (!isSetupRoute) {
      queueMicrotask(() => {
        setSetupOnboardingPanelOpen(false);
      });
      setupPanelThreadRef.current = undefined;
    }
  }, [isSetupRoute]);

  // Chat-first setup: panel stays closed for audience entry. It opens only via
  // Continue / Open from chat strips (or later review steps).
  useEffect(() => {
    if (!isSetupRoute) {
      return;
    }
    const draft = setupPanelDraft.setupDraft;
    if (!draft) {
      return;
    }
    const collecting =
      draft.inputPhase === "collecting_input" ||
      draft.status === "draft" ||
      draft.status === "awaiting_input" ||
      draft.status === "failed";
    if (collecting || draft.status === "ready") {
      queueMicrotask(() => {
        setSetupOnboardingPanelOpen(false);
      });
    }
  }, [
    isSetupRoute,
    setupPanelDraft.setupDraft,
    setupPanelDraft.setupDraft?.inputPhase,
    setupPanelDraft.setupDraft?.status,
  ]);

  const isPlanPanelRequested = panel === "plan";
  const isWorkspaceProfilePanelRequested = panel === "workspace_profiles";
  const isDmPanelRequested = panel === "dm";
  const requestedPanelMode: AgentPanelMode | null =
    panel === "approval" || panel === "posted"
      ? panel
      : panelState === "approval" || panelState === "posted"
        ? panelState
        : null;
  const activePlanPanelProspectId = prospectId ?? planPanelProspectId;
  const activeDynamicPanelProspectId =
    prospectId ?? cardPayload?.prospectId ?? null;
  const activeProspectSurfaceId =
    prospectPanelSessionProspectId ?? activeDynamicPanelProspectId;
  const hasPanelContext =
    !!activeDynamicPanelProspectId &&
    rightPanelSessionOpen &&
    ((!!prospectId && (isDmPanelRequested || !!requestedPanelMode)) ||
      (!!cardPayload &&
        (cardPayload.kind === "dm" || cardPayload.kind === "post")));
  const isPlanPanelActive =
    !!activePlanPanelProspectId &&
    rightPanelSessionOpen &&
    isPlanPanelRequested;

  useEffect(() => {
    const nextRoutePanelKey = `${prospectId ?? ""}:${threadId ?? ""}`;

    if (routePanelKeyRef.current === null) {
      routePanelKeyRef.current = nextRoutePanelKey;
      return;
    }

    if (routePanelKeyRef.current !== nextRoutePanelKey) {
      queueMicrotask(() => {
        setRightPanelSessionActive(false);
        setCardPayload(null);
        closeProfile();
        closeProspect();
        setPlanPanelProspectId(null);
        setProspectPanelSessionProspectId(null);
      });
      routePanelKeyRef.current = nextRoutePanelKey;
    }
  }, [
    closeProfile,
    closeProspect,
    prospectId,
    setRightPanelSessionActive,
    threadId,
  ]);

  const selectedThreadProspectId = threadSelectedContext?.prospectId
    ? String(threadSelectedContext.prospectId)
    : null;

  useEffect(() => {
    const hasPanelQueryParams = Boolean(
      panel || taskId || actionRequestId || panelState || targetTweetId
    );

    if (
      !hasPanelQueryParams ||
      !prospectId ||
      rightPanelSessionOpenRef.current
    ) {
      return;
    }

    queueMicrotask(() => {
      setRightPanelSessionActive(true);
    });
  }, [
    actionRequestId,
    panel,
    panelState,
    prospectId,
    setRightPanelSessionActive,
    targetTweetId,
    taskId,
  ]);

  const handleOpenPanelFromCard = useCallback(
    (payload: InlinePanelOpenPayload) => {
      const nextProspectId = payload.prospectId ?? prospectId ?? null;

      if (
        payload.kind === "prospect_profile" ||
        payload.kind === "twitter_profile" ||
        payload.kind === "linkedin_profile" ||
        payload.kind === "post_list"
      ) {
        if (!nextProspectId) {
          return;
        }

        if (isMobile) {
          router.push(routes.detailHref(nextProspectId));
          return;
        }

        setHistoryOpen(false);
        setCardPayload(null);
        setPlanPanelProspectId(null);
        setRightPanelSessionActive(false);
        closeProfile();
        closeProspect();
        setProspectPanelSessionProspectId(nextProspectId);
        openProspect(nextProspectId as Id<"prospects">);

        if (payload.kind === "twitter_profile") {
          const username =
            payload.profileData &&
            typeof payload.profileData === "object" &&
            typeof (payload.profileData as Record<string, unknown>).username ===
              "string"
              ? ((payload.profileData as Record<string, unknown>)
                  .username as string)
              : undefined;
          if (username) {
            void openProfile({ username });
          }
          pushPanel("twitter-profile", { prospectId: nextProspectId });
        } else if (payload.kind === "linkedin_profile") {
          pushPanel("linkedin-profile", { prospectId: nextProspectId });
        } else if (payload.kind === "post_list") {
          pushPanel("evidence-posts", {
            prospectId: nextProspectId,
            title: payload.title ?? "Posts",
            posts: payload.posts ?? [],
            platform: payload.platform,
          });
        }

        return;
      }

      const mode = payload.panelMode || "approval";
      const nextPanel = payload.kind === "dm" ? "dm" : mode;
      const nextTargetTweetId =
        payload.kind === "dm"
          ? undefined
          : (payload.targetTweetId ?? getTweetIdFromPostPayload(payload));

      setProspectPanelSessionProspectId(null);
      setPlanPanelProspectId(null);
      closeProspect();
      setHistoryOpen(false);
      setRightPanelSessionActive(true);
      setCardPayload({
        ...payload,
        prospectId: nextProspectId ?? undefined,
      });

      if (!prospectId) {
        return;
      }

      setParams({
        panel: nextPanel,
        panelState: payload.kind === "dm" ? null : mode,
        taskId: payload.taskId ?? null,
        actionRequestId: payload.actionRequestId ?? null,
        targetTweetId: nextTargetTweetId ?? null,
      });
    },
    [
      closeProfile,
      closeProspect,
      isMobile,
      openProfile,
      openProspect,
      prospectId,
      pushPanel,
      router,
      routes,
      setParams,
      setRightPanelSessionActive,
    ]
  );

  const handleOpenPlanPanel = useCallback(
    (targetProspectId?: string | null) => {
      const resolvedProspectId =
        typeof targetProspectId === "string" &&
        targetProspectId.trim().length > 0
          ? targetProspectId
          : (prospectId ?? selectedThreadProspectId);
      if (!resolvedProspectId) return;

      setProspectPanelSessionProspectId(null);
      setPlanPanelProspectId(resolvedProspectId);
      closeProspect();
      setHistoryOpen(false);
      setRightPanelSessionActive(true);
      setCardPayload(null);
      setParams({
        panel: "plan",
        panelState: null,
        taskId: null,
        actionRequestId: null,
        targetTweetId: null,
        workspaceProfileRequestId: null,
      });
    },
    [
      closeProspect,
      prospectId,
      selectedThreadProspectId,
      setParams,
      setRightPanelSessionActive,
    ]
  );

  const handleOpenWorkspaceProfilePanel = useCallback(
    (requestId: string) => {
      setProspectPanelSessionProspectId(null);
      setPlanPanelProspectId(null);
      closeProspect();
      setHistoryOpen(false);
      setCardPayload(null);
      setRightPanelSessionActive(true);
      setParams({
        panel: "workspace_profiles",
        panelState: null,
        taskId: null,
        actionRequestId: null,
        targetTweetId: null,
        workspaceProfileRequestId: requestId,
      });
    },
    [closeProspect, setParams, setRightPanelSessionActive]
  );

  const handleOpenDmPanel = useCallback(
    (platform?: "twitter" | "linkedin") => {
      if (!prospectId) return;

      const requestedPlatform =
        platform ??
        (agentProspectQuery.data?.platform === "linkedin"
          ? "linkedin"
          : "twitter");

      setProspectPanelSessionProspectId(null);
      setPlanPanelProspectId(null);
      closeProspect();
      setHistoryOpen(false);
      setRightPanelSessionActive(true);
      setCardPayload({
        kind: "dm",
        platform: requestedPlatform,
        prospectId,
      });
      setParams({
        panel: "dm",
        panelState: null,
        taskId: null,
        actionRequestId: null,
        targetTweetId: null,
      });
    },
    [
      agentProspectQuery.data?.platform,
      closeProspect,
      prospectId,
      setParams,
      setRightPanelSessionActive,
    ]
  );

  const handleClosePanel = useCallback(() => {
    setRightPanelSessionActive(false);
    setCardPayload(null);
    setPlanPanelProspectId(null);
    setParams({
      panel: null,
      panelState: null,
      taskId: null,
      actionRequestId: null,
      targetTweetId: null,
      workspaceProfileRequestId: null,
    });
  }, [setParams, setRightPanelSessionActive]);

  const handleResolvedTaskId = useCallback(
    (resolvedTaskId: string, resolvedTargetTweetId?: string | null) => {
      const nextTargetTweetId = resolvedTargetTweetId ?? null;
      if (
        !resolvedTaskId ||
        (taskId === resolvedTaskId &&
          (targetTweetId ?? null) === nextTargetTweetId)
      ) {
        return;
      }
      setParams({
        taskId: resolvedTaskId,
        targetTweetId: nextTargetTweetId,
      });
    },
    [setParams, targetTweetId, taskId]
  );

  const handleMismatchedTaskTarget = useCallback(() => {
    if (!taskId || !targetTweetId) return;
    setParams({ taskId: null });
  }, [setParams, targetTweetId, taskId]);

  const handleResolvedPanelMode = useCallback(
    (mode: AgentPanelMode) => {
      if (panel === "dm") return;
      if (requestedPanelMode === mode) return;
      setParams({ panel: mode, panelState: mode });
    },
    [panel, requestedPanelMode, setParams]
  );

  const handleViewProfile = useCallback(
    (targetProspectId?: string | null) => {
      const resolvedProspectId =
        typeof targetProspectId === "string" &&
        targetProspectId.trim().length > 0
          ? targetProspectId
          : prospectId;
      if (!resolvedProspectId) return;

      if (isMobile) {
        router.push(routes.detailHref(resolvedProspectId));
        return;
      }

      closeProfile();
      setHistoryOpen(false);
      setCardPayload(null);
      setPlanPanelProspectId(null);
      setProspectPanelSessionProspectId(resolvedProspectId);
      closeProspect();
      openProspect(resolvedProspectId as Id<"prospects">);
    },
    [
      closeProfile,
      closeProspect,
      isMobile,
      openProspect,
      prospectId,
      router,
      routes,
    ]
  );

  const handleViewTwitterProfile = useCallback(
    (username: string) => {
      const trimmed = username.trim();
      if (!trimmed) return;
      void openProfile({ username: trimmed });
    },
    [openProfile]
  );

  const handleViewTask = useCallback(
    ({
      taskId: nextTaskId,
      targetTweetId: nextTargetTweetId,
      kind,
      panelMode,
      fallbackPost,
    }: {
      taskId: string;
      targetTweetId?: string;
      kind?: "post" | "dm";
      panelMode: "approval" | "posted";
      fallbackPost?: {
        platform: "twitter" | "linkedin";
        postData?: unknown;
        postRef?: import("@/shared/lib/twitter/contracts").TwitterPostRef;
        postSummary?: import("@/shared/lib/twitter/contracts").TwitterPostSummary;
      };
    }) => {
      setProspectPanelSessionProspectId(null);
      setPlanPanelProspectId(null);
      closeProspect();
      setHistoryOpen(false);
      setRightPanelSessionActive(true);
      setCardPayload(
        fallbackPost
          ? {
              kind: kind === "dm" ? "dm" : "post",
              platform: fallbackPost.platform,
              prospectId: activePlanPanelProspectId ?? prospectId ?? undefined,
              taskId: nextTaskId,
              targetTweetId: nextTargetTweetId,
              panelMode,
              postData: fallbackPost.postData,
              postRef: fallbackPost.postRef,
              postSummary: fallbackPost.postSummary,
            }
          : null
      );
      setParams({
        panel: kind === "dm" ? "dm" : panelMode,
        panelState: panelMode,
        taskId: nextTaskId,
        actionRequestId: null,
        targetTweetId: nextTargetTweetId ?? null,
      });
    },
    [
      activePlanPanelProspectId,
      closeProspect,
      prospectId,
      setParams,
      setRightPanelSessionActive,
    ]
  );

  const agentRightSurfaceActive =
    !!activeProspectSurfaceId &&
    (!isMobile ||
      rightPanelSessionOpen ||
      isPlanPanelActive ||
      hasPanelContext);

  const showHistoryPanel = historyOpen && !isMobile && canUseThreadHistory;

  // Prospect context selects the chat. Only an explicit profile action starts
  // a profile-panel session, so client-side navigation cannot reopen it.
  const showStandalonePanel =
    currentPanel !== null &&
    activeProspectPanelId === null &&
    !showHistoryPanel &&
    !hasPanelContext &&
    !isPlanPanelActive;
  const showProspectPanel =
    showStandalonePanel ||
    (!isMobile &&
      !!prospectPanelSessionProspectId &&
      activeProspectPanelId === prospectPanelSessionProspectId &&
      !showHistoryPanel &&
      !hasPanelContext &&
      !isPlanPanelActive);

  const showAgentTwitterPanel =
    !isMobile &&
    isTwitterProfileOpen &&
    !showProspectPanel &&
    !showHistoryPanel &&
    agentRightSurfaceActive &&
    (hasPanelContext || isPlanPanelActive);

  const showDynamicPanel =
    hasPanelContext &&
    !!activeDynamicPanelProspectId &&
    (!isMobile || rightPanelSessionOpen) &&
    !showProspectPanel &&
    !showAgentTwitterPanel;
  const showPlanPanel =
    !!activePlanPanelProspectId &&
    isPlanPanelActive &&
    (!isMobile || rightPanelSessionOpen) &&
    !showProspectPanel &&
    !showAgentTwitterPanel;
  const planPanelThreadId =
    threadRouteContext?.kind === "prospect" &&
    String(threadRouteContext.prospectId) === activePlanPanelProspectId
      ? (effectiveThreadId ?? threadId ?? null)
      : null;
  const showSetupPanel = isSetupRoute && setupOnboardingPanelOpen;
  const showSetupPanelSpinner =
    showSetupPanel &&
    Boolean(setupPanelThreadId) &&
    !setupPanelDraft.error &&
    (setupPanelDraft.isLoading || setupPanelDraft.setupDraft === null);
  const setupProfileReviewDraft =
    setupPanelDraft.setupDraft?.inputPhase === "awaiting_icp_approval"
      ? setupPanelDraft.setupDraft
      : null;
  const showSetupChatOnly =
    isSetupRoute && isMobile && setupOnboardingPanelOpen;
  const showWorkspaceProfilePanel =
    isWorkspaceProfilePanelRequested &&
    Boolean(workspaceProfileRequestId) &&
    rightPanelSessionOpen &&
    !showHistoryPanel &&
    !showProspectPanel &&
    !showAgentTwitterPanel;
  return (
    <div className="flex h-full min-h-0 w-full">
      <PageLayout
        className={cn(
          "h-full w-full max-w-none flex-1 basis-0 border-none",
          ((showDynamicPanel || showPlanPanel || showWorkspaceProfilePanel) &&
            isMobile) ||
            showSetupChatOnly
            ? "hidden"
            : null
        )}
      >
        <PageContent className="h-full p-0">
          <AgentChat
            prospectId={prospectId ?? undefined}
            threadId={threadId ?? undefined}
            action={action ?? undefined}
            notificationId={notificationId ?? undefined}
            threadActionsReady={canUseThreadHistory}
            onHistoryClick={!isSetupRoute ? handleHistoryClick : undefined}
            onNewThread={!isSetupRoute ? handleNewThread : undefined}
            newThreadSignal={newThreadSignal}
            deferSetupHandoff={isLandingDraftDecisionPending}
            onEffectiveThreadIdChange={handleEffectiveThreadIdChange}
            onOpenPanelFromCard={handleOpenPanelFromCard}
            onOpenPlanPanel={handleOpenPlanPanel}
            onOpenWorkspaceProfilePanel={handleOpenWorkspaceProfilePanel}
            onViewProfile={hasProspectContext ? handleViewProfile : undefined}
            onOpenDmPanel={hasProspectContext ? handleOpenDmPanel : undefined}
            onOpenSetupOnboardingPanel={handleOpenSetupOnboardingPanel}
            shellProspectQuery={
              prospectId
                ? {
                    data: agentProspectQuery.data,
                    isPending: agentProspectQuery.isPending,
                  }
                : undefined
            }
          />
        </PageContent>
      </PageLayout>

      {showHistoryPanel && (
        <HistoryPanel
          scope={
            prospectId
              ? {
                  kind: "prospect" as const,
                  prospectId: prospectId as Id<"prospects">,
                  prospectArchived: historyProspectArchived,
                }
              : {
                  kind: "workspace" as const,
                  workspaceId: workspaceId as Id<"workspaces">,
                }
          }
          currentThreadId={effectiveThreadId ?? threadId ?? undefined}
          onClose={() => setHistoryOpen(false)}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
          onDeleteCurrentThread={handleDeleteCurrentThread}
          className={DESKTOP_PANEL_BORDER_CLASS_NAME}
        />
      )}

      {showAgentTwitterPanel && (
        <aside
          className={cn(
            "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
            DESKTOP_PANEL_BORDER_CLASS_NAME
          )}
        >
          <TwitterProfilePanel
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            prospectId={prospectId ?? undefined}
            onOpenConversationAction={
              hasProspectContext ? handleOpenDmPanel : undefined
            }
          />
        </aside>
      )}

      {showProspectPanel && (
        <ProspectPanelRenderer className={DESKTOP_PANEL_BORDER_CLASS_NAME} />
      )}

      {showDynamicPanel && activeDynamicPanelProspectId && (
        <AgentDynamicPanel
          prospectId={activeDynamicPanelProspectId}
          taskId={prospectId ? taskId : (cardPayload?.taskId ?? null)}
          actionRequestId={
            prospectId
              ? actionRequestId
              : (cardPayload?.actionRequestId ?? null)
          }
          targetTweetId={
            prospectId
              ? targetTweetId
              : (cardPayload?.targetTweetId ??
                getTweetIdFromPostPayload(cardPayload ?? {}) ??
                null)
          }
          requestedMode={requestedPanelMode}
          requestedKind={
            isDmPanelRequested
              ? "dm"
              : cardPayload?.kind === "dm"
                ? "dm"
                : "post"
          }
          requestedDmPlatform={
            cardPayload?.kind === "dm"
              ? cardPayload.platform
              : isDmPanelRequested
                ? agentProspectQuery.data?.platform
                : undefined
          }
          fallbackPost={
            cardPayload && cardPayload.kind !== "dm"
              ? {
                  platform: cardPayload.platform,
                  postData: cardPayload.postData,
                  postRef: cardPayload.postRef,
                  postSummary: cardPayload.postSummary,
                }
              : undefined
          }
          onViewProfile={() => handleViewProfile(activeDynamicPanelProspectId)}
          onViewTwitterProfile={handleViewTwitterProfile}
          onClose={handleClosePanel}
          onResolvedTaskId={prospectId ? handleResolvedTaskId : undefined}
          onResolvedMode={prospectId ? handleResolvedPanelMode : undefined}
          onMismatchedTaskTarget={
            prospectId ? handleMismatchedTaskTarget : undefined
          }
          className={DESKTOP_PANEL_BORDER_CLASS_NAME}
        />
      )}

      {showPlanPanel && activePlanPanelProspectId && (
        <AgentPlanPanel
          prospectId={activePlanPanelProspectId}
          currentThreadId={planPanelThreadId}
          onClose={handleClosePanel}
          onViewTask={handleViewTask}
          className={DESKTOP_PANEL_BORDER_CLASS_NAME}
        />
      )}

      {showWorkspaceProfilePanel && workspaceProfileRequestId && (
        <WorkspaceProfileReviewPanel
          requestId={workspaceProfileRequestId}
          onClose={handleClosePanel}
          className={DESKTOP_PANEL_BORDER_CLASS_NAME}
        />
      )}

      {showSetupPanel &&
        (showSetupPanelSpinner ? (
          <AgentOnboardingPanelSpinner
            className={cn(
              DESKTOP_PANEL_BORDER_CLASS_NAME,
              showSetupChatOnly && "border-l-0"
            )}
          />
        ) : setupProfileReviewDraft ? (
          <div id="rx-onboarding-panel" className="contents">
            <WorkspaceProfileReviewPanel
              onClose={() => setSetupOnboardingPanelOpen(false)}
              onApproveIdealProfiles={handlePanelApproveIdealProfiles}
              setupProposal={{
                sessionId: setupProfileReviewDraft.sessionId,
                revision: setupProfileReviewDraft.statusUpdatedAt,
                profileLabelPlural: getWorkspaceUseCase(
                  setupProfileReviewDraft.useCaseKey
                ).profileLabelPlural,
                proposedProfiles: setupProfileReviewDraft.generatedProfiles,
                errorMessage: setupProfileReviewDraft.errorMessage,
              }}
              className={cn(
                DESKTOP_PANEL_BORDER_CLASS_NAME,
                showSetupChatOnly && "max-w-none border-l-0"
              )}
            />
          </div>
        ) : (
          <AgentOnboardingPanel
            threadId={setupPanelThreadId}
            onClose={() => setSetupOnboardingPanelOpen(false)}
            className={cn(
              DESKTOP_PANEL_BORDER_CLASS_NAME,
              showSetupChatOnly && "border-l-0"
            )}
          />
        ))}
      {landingDraftFlow.modal}
    </div>
  );
}
