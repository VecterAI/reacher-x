"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvex, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQueryWithStatus } from "@/shared/hooks";
import { NewWorkspaceDraftModal } from "@/features/webapp/ui/components/NewWorkspaceDraftModal";
import { setPreferredShellContext } from "@/shared/stores/preferredShellContext";
import { buildSetupHref } from "@/shared/lib/urls/setupHref";

type NewWorkspaceDraftDecision = {
  sessionId: Id<"workspaceSetupSessions">;
  threadId: string;
  displayName: string;
};

export function useNewWorkspaceDraftFlow(args?: { enabled?: boolean }) {
  const enabled = args?.enabled ?? true;
  const convex = useConvex();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [dialogDraft, setDialogDraft] =
    useState<NewWorkspaceDraftDecision | null>(null);
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
    (nextArgs: { threadId: string }) => {
      setPreferredShellContext("setup_session");
      router.push(buildSetupHref(nextArgs.threadId));
    },
    [router]
  );

  const startFresh = useCallback(async () => {
    const result = await startSetupSession({ mode: "new_workspace" });
    navigateToSetup({
      threadId: result.threadId,
    });
  }, [navigateToSetup, startSetupSession]);

  const requestNewWorkspace = useCallback(async () => {
    if (!enabled || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      // `startSetupSession` is the authoritative race-free decision: it either
      // creates a draft or returns the existing active draft without mutating it.
      const result = await startSetupSession({ mode: "new_workspace" });
      if (result.reused) {
        const decision = await convex.query(
          api.setupSessions.getNewWorkspaceDecisionState,
          {}
        );
        if (decision.activeDraft) {
          setDialogDraft({
            sessionId: decision.activeDraft.sessionId,
            threadId: decision.activeDraft.threadId,
            displayName: decision.activeDraft.displayName,
          });
          setOpen(true);
          return;
        }
      }

      navigateToSetup({ threadId: result.threadId });
    } catch (error) {
      toast.error("Could not start a new workspace", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [convex, enabled, isSubmitting, navigateToSetup, startSetupSession]);

  const continueDraft = useCallback(() => {
    if (!dialogDraft) {
      setOpen(false);
      return;
    }

    setOpen(false);
    navigateToSetup({
      threadId: dialogDraft.threadId,
    });
  }, [dialogDraft, navigateToSetup]);

  const discardAndStartFresh = useCallback(async () => {
    if (!dialogDraft) {
      setOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await discardSetupSession({ sessionId: dialogDraft.sessionId });
      setOpen(false);
      setDialogDraft(null);
      await startFresh();
    } catch (error) {
      toast.error("Could not replace the existing draft", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [dialogDraft, discardSetupSession, startFresh]);

  const modal = useMemo(
    () =>
      dialogDraft ? (
        <NewWorkspaceDraftModal
          draftLabel={dialogDraft.displayName}
          isSubmitting={isSubmitting}
          open={open}
          onCancel={() => setOpen(false)}
          onContinueDraft={continueDraft}
          onDiscardAndStartFresh={discardAndStartFresh}
        />
      ) : null,
    [dialogDraft, continueDraft, discardAndStartFresh, isSubmitting, open]
  );

  return {
    activeDraft,
    isCheckingDrafts: enabled && decisionStateQuery.isPending,
    isSubmitting,
    modal,
    requestNewWorkspace,
  };
}
