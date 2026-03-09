"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import {
  ProspectPanelRenderer,
  useProspectProfile,
} from "@/features/prospects";
import { AgentChat } from "./AgentChat";
import type { AgentPanelMode, InlinePanelOpenPayload } from "../lib";
import { AgentDynamicPanel, AgentPlanPanel, HistoryPanel } from "./components";
import { PageLayout, PageContent } from "@/features/webapp/ui/components";

export function AgentPageShell() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const {
    openProspect,
    closeProspect,
    prospectId: activeProspectPanelId,
  } = useProspectProfile();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobilePanelSessionOpen, setMobilePanelSessionOpen] = useState(false);
  const [prospectPanelSessionProspectId, setProspectPanelSessionProspectId] =
    useState<string | null>(null);

  const [effectiveThreadId, setEffectiveThreadId] = useState<string | null>(
    null
  );

  const [
    {
      prospectId,
      threadId,
      action,
      notificationId,
      panel,
      taskId,
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
    panelState: parseAsString,
    targetTweetId: parseAsString,
  });

  const prevProspectIdRef = useRef<string | null>(null);

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
        targetTweetId: null,
      });
      setMobilePanelSessionOpen(false);
      setHistoryOpen(true);
    }
  }, [closeProspect, isMobile, router, prospectId, setParams]);

  const handleNewThread = useCallback(() => {
    setParams({
      threadId: null,
      action: null,
      panel: null,
      taskId: null,
      panelState: null,
      targetTweetId: null,
    });
    setHistoryOpen(false);
    setMobilePanelSessionOpen(false);
  }, [setParams]);

  const handleSelectThread = useCallback(
    (newThreadId: string) => {
      setParams({
        threadId: newThreadId,
        panel: null,
        panelState: null,
        targetTweetId: null,
      });
      setHistoryOpen(false);
      setMobilePanelSessionOpen(false);
    },
    [setParams]
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const hasProspectContext = !!prospectId;
  const isPlanPanelRequested = panel === "plan";
  const requestedPanelMode: AgentPanelMode | null =
    panel === "approval" || panel === "posted"
      ? panel
      : panelState === "approval" || panelState === "posted"
        ? panelState
        : null;
  const hasPanelContext = !!prospectId && !!requestedPanelMode;
  const mobilePanelRequested = isPlanPanelRequested || hasPanelContext;

  const [cardPayload, setCardPayload] = useState<InlinePanelOpenPayload | null>(
    null
  );

  const handleOpenPanelFromCard = useCallback(
    (payload: InlinePanelOpenPayload) => {
      const mode = payload.panelMode || "approval";

      setProspectPanelSessionProspectId(null);
      closeProspect();
      setHistoryOpen(false);
      setMobilePanelSessionOpen(true);
      setCardPayload(payload);

      setParams({
        panel: mode,
        panelState: mode,
        taskId: payload.taskId ?? null,
        targetTweetId: payload.targetTweetId ?? null,
      });
    },
    [closeProspect, setParams]
  );

  const handleOpenPlanPanel = useCallback(() => {
    if (!prospectId) return;

    setProspectPanelSessionProspectId(null);
    closeProspect();
    setHistoryOpen(false);
    setMobilePanelSessionOpen(true);
    setCardPayload(null);
    setParams({
      panel: "plan",
      panelState: null,
      taskId: null,
      targetTweetId: null,
    });
  }, [closeProspect, prospectId, setParams]);

  const handleClosePanel = useCallback(() => {
    setMobilePanelSessionOpen(false);
    setCardPayload(null);
    setParams({
      panel: null,
      panelState: null,
      taskId: null,
      targetTweetId: null,
    });
  }, [setParams]);

  const handleEditPlanThread = useCallback(
    (resolvedThreadId: string | null) => {
      setHistoryOpen(false);
      setMobilePanelSessionOpen(false);
      setCardPayload(null);
      setParams({
        threadId: resolvedThreadId,
        action: null,
        panel: null,
        panelState: null,
        taskId: null,
        targetTweetId: null,
      });
    },
    [setParams]
  );

  const handleResolvedTaskId = useCallback(
    (resolvedTaskId: string) => {
      if (!resolvedTaskId || taskId === resolvedTaskId) return;
      setParams({ taskId: resolvedTaskId });
    },
    [setParams, taskId]
  );

  const handleResolvedPanelMode = useCallback(
    (mode: AgentPanelMode) => {
      if (requestedPanelMode === mode) return;
      setParams({ panel: mode, panelState: mode });
    },
    [requestedPanelMode, setParams]
  );

  const handleViewProfile = useCallback(() => {
    if (!prospectId) return;

    if (isMobile) {
      router.push(`/prospects/${prospectId}`);
      return;
    }

    setHistoryOpen(false);
    setMobilePanelSessionOpen(false);
    setCardPayload(null);
    setProspectPanelSessionProspectId(prospectId);
    closeProspect();
    openProspect(prospectId as Id<"prospects">);
    setParams({
      panel: null,
      panelState: null,
      taskId: null,
      targetTweetId: null,
    });
  }, [closeProspect, isMobile, openProspect, prospectId, router, setParams]);

  const showDynamicPanel =
    hasPanelContext &&
    (!isMobile || mobilePanelSessionOpen || mobilePanelRequested);
  const showPlanPanel =
    !!prospectId &&
    isPlanPanelRequested &&
    (!isMobile || mobilePanelSessionOpen || mobilePanelRequested);
  const showHistoryPanel =
    historyOpen &&
    !isMobile &&
    !!prospectId &&
    !showDynamicPanel &&
    !showPlanPanel;
  const showProspectPanel =
    !isMobile &&
    prospectPanelSessionProspectId === prospectId &&
    activeProspectPanelId === prospectId &&
    !showDynamicPanel &&
    !showPlanPanel &&
    !showHistoryPanel;
  const showRightSurface =
    showDynamicPanel || showPlanPanel || showHistoryPanel || showProspectPanel;

  return (
    <div className="flex h-full min-h-0 w-full">
      <PageLayout
        className={cn(
          "h-full w-full",
          showRightSurface && !isMobile && "border-r",
          (showDynamicPanel || showPlanPanel) && isMobile && "hidden"
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
        />
      )}

      {showDynamicPanel && prospectId && (
        <AgentDynamicPanel
          prospectId={prospectId}
          taskId={taskId}
          targetTweetId={targetTweetId}
          requestedMode={requestedPanelMode}
          fallbackPost={
            cardPayload
              ? {
                  platform: cardPayload.platform,
                  postData: cardPayload.postData,
                }
              : undefined
          }
          onClose={handleClosePanel}
          onResolvedTaskId={handleResolvedTaskId}
          onResolvedMode={handleResolvedPanelMode}
        />
      )}

      {showPlanPanel && prospectId && (
        <AgentPlanPanel
          prospectId={prospectId}
          currentThreadId={effectiveThreadId ?? threadId ?? null}
          onClose={handleClosePanel}
          onEditThread={handleEditPlanThread}
        />
      )}

      {showProspectPanel && <ProspectPanelRenderer />}
    </div>
  );
}
