"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/shared/lib/utils";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { useAgentProspectQuery } from "../hooks";
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
} from "../lib";
import {
  AgentDynamicPanel,
  AgentOnboardingPanel,
  AgentPlanPanel,
  HistoryPanel,
} from "./components";
import { PageLayout, PageContent } from "@/features/webapp/ui/components";
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { TwitterProfilePanel } from "@/features/profile/ui/components/TwitterProfilePanel";

export function AgentPageShell() {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { routes } = useActiveUseCaseLabels();
  const {
    openProspect,
    closeProspect,
    prospectId: activeProspectPanelId,
  } = useProspectProfile();
  const { pushPanel } = usePanelStack();
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

  const [effectiveThreadId, setEffectiveThreadId] = useState<string | null>(
    null
  );
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
  });

  const prevProspectIdRef = useRef<string | null>(null);
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
    if (
      prevProspectIdRef.current !== null &&
      prevProspectIdRef.current !== prospectId &&
      threadId
    ) {
      setParams({ threadId: null });
    }
    prevProspectIdRef.current = prospectId;
  }, [prospectId, threadId, setParams]);

  const handleEffectiveThreadIdChange = useCallback(
    (newThreadId: string | null) => {
      setEffectiveThreadId(newThreadId);
    },
    []
  );

  const handleHistoryClick = useCallback(() => {
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
    setParams({
      threadId: null,
      action: null,
      panel: null,
      taskId: null,
      actionRequestId: null,
      panelState: null,
      targetTweetId: null,
    });
    setHistoryOpen(false);
    setRightPanelSessionActive(false);
  }, [setParams, setRightPanelSessionActive]);

  const handleDeleteCurrentThread = useCallback(() => {
    setParams({
      threadId: null,
      action: null,
      panel: null,
      taskId: null,
      actionRequestId: null,
      panelState: null,
      targetTweetId: null,
    });
    setRightPanelSessionActive(false);
  }, [setParams, setRightPanelSessionActive]);

  const handleSelectThread = useCallback(
    (newThreadId: string) => {
      setParams({
        threadId: newThreadId,
        panel: null,
        taskId: null,
        actionRequestId: null,
        panelState: null,
        targetTweetId: null,
      });
      setHistoryOpen(false);
      setCardPayload(null);
      setRightPanelSessionActive(false);
    },
    [setParams, setRightPanelSessionActive]
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenSetupOnboardingPanel = useCallback(() => {
    setSetupOnboardingPanelOpen(true);
  }, []);

  const hasProspectContext = !!prospectId;
  const isSetupRoute = pathname === "/agent/setup";

  const agentProspectQuery = useAgentProspectQuery(prospectId);
  const historyProspectArchived =
    agentProspectQuery.data?.status === "archived";

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

  useEffect(() => {
    if (isSetupRoute) {
      queueMicrotask(() => {
        setSetupOnboardingPanelOpen(true);
      });
    }
  }, [isSetupRoute]);

  const isPlanPanelRequested = panel === "plan";
  const isDmPanelRequested = panel === "dm";
  const requestedPanelMode: AgentPanelMode | null =
    panel === "approval" || panel === "posted"
      ? panel
      : panelState === "approval" || panelState === "posted"
        ? panelState
        : null;
  const hasPanelContext =
    !!prospectId &&
    rightPanelSessionOpen &&
    (isDmPanelRequested || !!requestedPanelMode);
  const isPlanPanelActive =
    !!prospectId && rightPanelSessionOpen && isPlanPanelRequested;

  useEffect(() => {
    const nextRoutePanelKey = `${prospectId ?? ""}:${threadId ?? ""}`;

    if (routePanelKeyRef.current === null) {
      routePanelKeyRef.current = nextRoutePanelKey;
      return;
    }

    if (routePanelKeyRef.current !== nextRoutePanelKey) {
      setRightPanelSessionActive(false);
      setCardPayload(null);
      closeProfile();
      closeProspect();
      routePanelKeyRef.current = nextRoutePanelKey;
    }
  }, [
    closeProfile,
    closeProspect,
    prospectId,
    setRightPanelSessionActive,
    threadId,
  ]);

  useEffect(() => {
    const hasPanelQueryParams = Boolean(
      panel || taskId || actionRequestId || panelState || targetTweetId
    );

    if (rightPanelSessionOpenRef.current || !hasPanelQueryParams) {
      return;
    }

    void setParams(
      {
        panel: null,
        taskId: null,
        actionRequestId: null,
        panelState: null,
        targetTweetId: null,
      },
      { history: "replace" }
    );
  }, [actionRequestId, panel, panelState, setParams, targetTweetId, taskId]);

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
      closeProspect();
      setHistoryOpen(false);
      setRightPanelSessionActive(true);
      setCardPayload(payload);

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

  const handleOpenPlanPanel = useCallback(() => {
    if (!prospectId) return;

    setProspectPanelSessionProspectId(null);
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
    });
  }, [closeProspect, prospectId, setParams, setRightPanelSessionActive]);

  const handleOpenDmPanel = useCallback(() => {
    if (!prospectId) return;

    setProspectPanelSessionProspectId(null);
    closeProspect();
    setHistoryOpen(false);
    setRightPanelSessionActive(true);
    setCardPayload({
      kind: "dm",
      platform: "twitter",
      prospectId,
    });
    setParams({
      panel: "dm",
      panelState: null,
      taskId: null,
      actionRequestId: null,
      targetTweetId: null,
    });
  }, [closeProspect, prospectId, setParams, setRightPanelSessionActive]);

  const handleClosePanel = useCallback(() => {
    setRightPanelSessionActive(false);
    setCardPayload(null);
    setParams({
      panel: null,
      panelState: null,
      taskId: null,
      actionRequestId: null,
      targetTweetId: null,
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

  const handleViewProfile = useCallback(() => {
    if (!prospectId) return;

    if (isMobile) {
      router.push(routes.detailHref(prospectId));
      return;
    }

    closeProfile();
    setHistoryOpen(false);
    setCardPayload(null);
    setProspectPanelSessionProspectId(prospectId);
    closeProspect();
    openProspect(prospectId as Id<"prospects">);
  }, [
    closeProfile,
    closeProspect,
    isMobile,
    openProspect,
    prospectId,
    router,
    routes,
  ]);

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
    }: {
      taskId: string;
      targetTweetId?: string;
      kind?: "post" | "dm";
      panelMode: "approval" | "posted";
    }) => {
      setProspectPanelSessionProspectId(null);
      closeProspect();
      setHistoryOpen(false);
      setRightPanelSessionActive(true);
      setCardPayload(null);
      setParams({
        panel: kind === "dm" ? "dm" : panelMode,
        panelState: panelMode,
        taskId: nextTaskId,
        actionRequestId: null,
        targetTweetId: nextTargetTweetId ?? null,
      });
    },
    [closeProspect, setParams, setRightPanelSessionActive]
  );

  const agentRightSurfaceActive =
    !!prospectId &&
    (!isMobile || rightPanelSessionOpen || isPlanPanelActive || hasPanelContext);

  const showHistoryPanel = historyOpen && !isMobile && !!prospectId;

  const showProspectPanel =
    !isMobile &&
    prospectPanelSessionProspectId === prospectId &&
    activeProspectPanelId === prospectId &&
    !showHistoryPanel &&
    ((!hasPanelContext && !isPlanPanelActive) ||
      (agentRightSurfaceActive && (hasPanelContext || isPlanPanelActive)));

  const showAgentTwitterPanel =
    !isMobile &&
    isTwitterProfileOpen &&
    !showProspectPanel &&
    !showHistoryPanel &&
    agentRightSurfaceActive &&
    (hasPanelContext || isPlanPanelActive);

  const showDynamicPanel =
    hasPanelContext &&
    (!isMobile || rightPanelSessionOpen) &&
    !showProspectPanel &&
    !showAgentTwitterPanel;
  const showPlanPanel =
    !!prospectId &&
    isPlanPanelActive &&
    (!isMobile || rightPanelSessionOpen) &&
    !showProspectPanel &&
    !showAgentTwitterPanel;
  const showSetupPanel = isSetupRoute && setupOnboardingPanelOpen;
  const showSetupChatOnly =
    isSetupRoute && isMobile && setupOnboardingPanelOpen;
  const showRightSurface =
    showDynamicPanel ||
    showPlanPanel ||
    showHistoryPanel ||
    showProspectPanel ||
    showAgentTwitterPanel ||
    (showSetupPanel && !isMobile);

  return (
    <div className="flex h-full min-h-0 w-full">
      <PageLayout
        className={cn(
          "h-full w-full",
          showRightSurface && !isMobile && "border-r",
          ((showDynamicPanel || showPlanPanel) && isMobile) || showSetupChatOnly
            ? "hidden"
            : null
        )}
      >
        <PageContent className="h-full p-0">
          <AgentChat
            key={`${prospectId ?? "setup"}-${threadId ?? "new"}`}
            prospectId={prospectId ?? undefined}
            threadId={threadId ?? undefined}
            action={action ?? undefined}
            notificationId={notificationId ?? undefined}
            onBack={handleBack}
            onHistoryClick={hasProspectContext ? handleHistoryClick : undefined}
            onNewThread={hasProspectContext ? handleNewThread : undefined}
            onEffectiveThreadIdChange={handleEffectiveThreadIdChange}
            onOpenPanelFromCard={
              hasProspectContext ? handleOpenPanelFromCard : undefined
            }
            onOpenPlanPanel={
              hasProspectContext ? handleOpenPlanPanel : undefined
            }
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
          prospectId={prospectId as Id<"prospects">}
          currentThreadId={effectiveThreadId ?? threadId ?? undefined}
          onClose={() => setHistoryOpen(false)}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
          onDeleteCurrentThread={handleDeleteCurrentThread}
          prospectArchived={historyProspectArchived}
        />
      )}

      {showAgentTwitterPanel && (
        <aside className="flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0">
          <TwitterProfilePanel
            className="flex h-full min-h-0 w-full flex-1 flex-col"
            prospectId={prospectId ?? undefined}
            onOpenConversation={
              hasProspectContext ? handleOpenDmPanel : undefined
            }
          />
        </aside>
      )}

      {showProspectPanel && <ProspectPanelRenderer />}

      {showDynamicPanel && prospectId && (
        <AgentDynamicPanel
          prospectId={prospectId}
          taskId={taskId}
          actionRequestId={actionRequestId}
          targetTweetId={targetTweetId}
          requestedMode={requestedPanelMode}
          requestedKind={
            isDmPanelRequested
              ? "dm"
              : cardPayload?.kind === "dm"
                ? "dm"
                : "post"
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
          onViewProfile={handleViewProfile}
          onViewTwitterProfile={handleViewTwitterProfile}
          onClose={handleClosePanel}
          onResolvedTaskId={handleResolvedTaskId}
          onResolvedMode={handleResolvedPanelMode}
          onMismatchedTaskTarget={handleMismatchedTaskTarget}
        />
      )}

      {showPlanPanel && prospectId && (
        <AgentPlanPanel
          prospectId={prospectId}
          currentThreadId={effectiveThreadId ?? threadId ?? null}
          onClose={handleClosePanel}
          onViewTask={handleViewTask}
        />
      )}

      {showSetupPanel && (
        <AgentOnboardingPanel
          threadId={effectiveThreadId ?? threadId ?? null}
          className={cn(showSetupChatOnly && "border-l-0")}
        />
      )}
    </div>
  );
}
