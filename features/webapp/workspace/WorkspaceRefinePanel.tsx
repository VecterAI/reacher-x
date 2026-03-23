"use client";

import dynamic from "next/dynamic";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/shared/lib/utils";

const AgentOnboardingPanel = dynamic(
  () =>
    import("@/features/agent/ui/components/AgentOnboardingPanel").then(
      (m) => m.AgentOnboardingPanel
    ),
  { ssr: false }
);

export interface WorkspaceRefinePanelProps {
  threadId: string | null;
  sessionId: Id<"workspaceSetupSessions"> | null;
  /** Full-width on mobile (replaces main content). */
  isMobile: boolean;
  onRefineCancel: () => void | Promise<void>;
  onRefineComplete: () => void;
}

/**
 * Right-hand refine surface: reuses setup input / preview via AgentOnboardingPanel.
 */
export function WorkspaceRefinePanel({
  threadId,
  sessionId,
  isMobile,
  onRefineCancel,
  onRefineComplete,
}: WorkspaceRefinePanelProps) {
  const discardSetupSession = useMutation(
    api.setupSessions.discardSetupSession
  );

  const handleCancel = async () => {
    if (sessionId) {
      try {
        await discardSetupSession({ sessionId });
      } catch {
        // Still close UI if discard fails (session may already be terminal).
      }
    }
    await onRefineCancel();
  };

  if (!threadId) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-background flex h-full min-h-0 flex-col overflow-hidden md:max-w-lg md:min-w-0 md:flex-1 md:basis-0",
        isMobile ? "w-full" : "w-full"
      )}
    >
      <AgentOnboardingPanel
        threadId={threadId}
        embedRefine
        className="max-w-none border-r"
        onRefineCancel={handleCancel}
        onRefineComplete={onRefineComplete}
      />
    </div>
  );
}
