"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks";
import { NewWorkspaceDraftModal } from "@/features/webapp/ui/components/NewWorkspaceDraftModal";
import { setPreferredShellContext } from "@/shared/stores/preferredShellContext";

function buildSetupHref(args: { sessionId: string; threadId: string }): string {
  const params = new URLSearchParams();
  params.set("sessionId", args.sessionId);
  params.set("threadId", args.threadId);
  return `/agent/setup?${params.toString()}`;
}

export function useNewWorkspaceDraftFlow(args?: { enabled?: boolean }) {
  const enabled = args?.enabled ?? true;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const startSetupSession = useMutation(api.setupSessions.startSetupSession);
  const discardSetupSession = useMutation(
    api.setupSessions.discardSetupSession
  );
  const decisionStateQuery = useQueryWithStatus(
    api.setupSessions.getNewWorkspaceDecisionState,
    enabled ? {} : "skip"
  );
  const activeDraft = decisionStateQuery.data?.activeDraft ?? null;

  const navigateToSetup = useCallback(
    (nextArgs: { sessionId: string; threadId: string }) => {
      setPreferredShellContext("setup_session");
      router.push(buildSetupHref(nextArgs));
    },
    [router]
  );

  const startFresh = useCallback(async () => {
    const result = await startSetupSession({ mode: "new_workspace" });
    navigateToSetup({
      sessionId: result.sessionId,
      threadId: result.threadId,
    });
  }, [navigateToSetup, startSetupSession]);

  const requestNewWorkspace = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (activeDraft) {
      setOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await startFresh();
    } catch (error) {
      toast.error("Could not start a new workspace", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [activeDraft, enabled, startFresh]);

  const continueDraft = useCallback(() => {
    if (!activeDraft) {
      setOpen(false);
      return;
    }

    setOpen(false);
    navigateToSetup({
      sessionId: activeDraft.sessionId,
      threadId: activeDraft.threadId,
    });
  }, [activeDraft, navigateToSetup]);

  const discardAndStartFresh = useCallback(async () => {
    if (!activeDraft) {
      setOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await discardSetupSession({ sessionId: activeDraft.sessionId });
      setOpen(false);
      await startFresh();
    } catch (error) {
      toast.error("Could not replace the existing draft", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [activeDraft, discardSetupSession, startFresh]);

  const modal = useMemo(
    () =>
      activeDraft ? (
        <NewWorkspaceDraftModal
          draftLabel={activeDraft.displayName}
          isSubmitting={isSubmitting}
          open={open}
          onCancel={() => setOpen(false)}
          onContinueDraft={continueDraft}
          onDiscardAndStartFresh={discardAndStartFresh}
        />
      ) : null,
    [activeDraft, continueDraft, discardAndStartFresh, isSubmitting, open]
  );

  return {
    activeDraft,
    isCheckingDrafts: enabled && decisionStateQuery.isPending,
    isSubmitting,
    modal,
    requestNewWorkspace,
  };
}
