"use client";

/**
 * Agent Chat Page
 *
 * Supports URL params via nuqs:
 * - prospectId: Chat about a specific prospect
 * - threadId: Load a specific thread
 * - action: "edit" to edit prospect plan
 * - notificationId: Handle notification action
 *
 * On desktop, History panel renders to the right (split-panel layout).
 * On mobile, History routes to /agent/history.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { AgentChat } from "@/features/agent/ui/AgentChat";
import { HistoryPanel } from "@/features/agent/ui/components";
import { PageLayout, PageContent } from "@/features/webapp/ui/components";

export default function AgentPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Track effective thread ID from AgentChat hook (for HistoryPanel "Current" badge)
  const [effectiveThreadId, setEffectiveThreadId] = useState<string | null>(
    null
  );

  // URL params via nuqs
  const [{ prospectId, threadId, action, notificationId }, setParams] =
    useQueryStates({
      prospectId: parseAsString,
      threadId: parseAsString,
      action: parseAsString,
      notificationId: parseAsString,
    });

  // Track previous prospectId to clear threadId when switching prospects
  const prevProspectIdRef = useRef<string | null>(null);

  // Clear threadId when prospectId changes (prevents showing wrong thread)
  useEffect(() => {
    if (
      prevProspectIdRef.current !== null &&
      prevProspectIdRef.current !== prospectId &&
      threadId
    ) {
      // Prospect changed but we have a threadId - clear it for isolation
      setParams({ threadId: null });
    }
    prevProspectIdRef.current = prospectId;
  }, [prospectId, threadId, setParams]);

  // Handle effective thread ID changes from AgentChat
  const handleEffectiveThreadIdChange = useCallback(
    (newThreadId: string | null) => {
      setEffectiveThreadId(newThreadId);
    },
    []
  );

  // Handle History button click
  const handleHistoryClick = useCallback(() => {
    if (isMobile) {
      router.push(
        `/agent/history${prospectId ? `?prospectId=${prospectId}` : ""}`
      );
    } else {
      setHistoryOpen(true);
    }
  }, [isMobile, router, prospectId]);

  // Handle New thread button - lazy creation
  // Just clear threadId to show empty chat. Thread is created on first message.
  // This prevents ghost "New conversation" threads from appearing in history.
  const handleNewThread = useCallback(() => {
    // Clear threadId to reset to empty state
    setParams({ threadId: null, action: null });
    setHistoryOpen(false);
  }, [setParams]);

  // Handle thread selection from history
  const handleSelectThread = useCallback(
    (newThreadId: string) => {
      setParams({ threadId: newThreadId });
      setHistoryOpen(false);
    },
    [setParams]
  );

  // Handle back button - navigate to previous location
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const hasProspectContext = !!prospectId;

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Main: Agent Chat */}
      <PageLayout
        className={cn(
          "h-full w-full",
          historyOpen && !isMobile && "hidden border-r md:block"
        )}
      >
        <PageContent className="h-full p-0">
          {/* Key forces remount when prospectId or threadId changes, clearing all hook state */}
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
          />
        </PageContent>
      </PageLayout>

      {/* Right: History Panel (desktop only) */}
      {historyOpen && !isMobile && prospectId && (
        <HistoryPanel
          prospectId={prospectId as Id<"prospects">}
          currentThreadId={effectiveThreadId ?? threadId ?? undefined}
          onClose={() => setHistoryOpen(false)}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
        />
      )}
    </div>
  );
}
