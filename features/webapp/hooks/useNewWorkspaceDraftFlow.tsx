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
import {
  replaceWorkspaceDraft,
  type NewWorkspaceSessionSelection,
} from "@/features/webapp/lib/newWorkspaceDraftFlowCore";

export type { NewWorkspaceSessionSelection } from "@/features/webapp/lib/newWorkspaceDraftFlowCore";

type NewWorkspaceDraftDecision = {
  sessionId: Id<"workspaceSetupSessions">;
  threadId: string;
  displayName: string;
};

type NewWorkspaceDraftFlowArgs = {
  enabled?: boolean;
  mode?: "first_workspace" | "new_workspace";
  onCancel?: () => void;
  onError?: () => void;
  onSessionSelected?: (
    selection: NewWorkspaceSessionSelection
  ) => Promise<void> | void;
};

export function useNewWorkspaceDraftFlow(args?: NewWorkspaceDraftFlowArgs) {
  const enabled = args?.enabled ?? true;
  const mode = args?.mode ?? "new_workspace";
  const onCancel = args?.onCancel;
  const onError = args?.onError;
  const onSessionSelected = args?.onSessionSelected;
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

  const selectSession = useCallback(
    async (selection: NewWorkspaceSessionSelection) => {
      if (onSessionSelected) {
        await onSessionSelected(selection);
        return;
      }

      navigateToSetup({ threadId: selection.threadId });
    },
    [navigateToSetup, onSessionSelected]
  );

  const requestNewWorkspace = useCallback(async () => {
    if (!enabled || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      // `startSetupSession` is the authoritative race-free decision: it either
      // creates a draft or returns the existing active draft without mutating it.
      const result = await startSetupSession({ mode });
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

      await selectSession({ kind: "created", threadId: result.threadId });
    } catch (error) {
      onError?.();
      toast.error("Could not start a new workspace", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    convex,
    enabled,
    isSubmitting,
    mode,
    onError,
    selectSession,
    startSetupSession,
  ]);

  const continueDraft = useCallback(async () => {
    if (!dialogDraft) {
      setOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await selectSession({
        kind: "continued",
        threadId: dialogDraft.threadId,
      });
      setOpen(false);
      setDialogDraft(null);
    } catch (error) {
      onError?.();
      toast.error("Could not continue the existing draft", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [dialogDraft, onError, selectSession]);

  const cancel = useCallback(() => {
    setOpen(false);
    setDialogDraft(null);
    onCancel?.();
  }, [onCancel]);

  const discardAndStartFresh = useCallback(async () => {
    if (!dialogDraft) {
      setOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await replaceWorkspaceDraft({
        sessionId: dialogDraft.sessionId,
        mode,
        discardSetupSession,
        startSetupSession,
        selectSession,
      });
      setOpen(false);
      setDialogDraft(null);
    } catch (error) {
      onError?.();
      toast.error("Could not replace the existing draft", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    dialogDraft,
    discardSetupSession,
    mode,
    onError,
    selectSession,
    startSetupSession,
  ]);

  const modal = useMemo(
    () =>
      dialogDraft ? (
        <NewWorkspaceDraftModal
          draftLabel={dialogDraft.displayName}
          isSubmitting={isSubmitting}
          open={open}
          onCancel={cancel}
          onContinueDraft={() => void continueDraft()}
          onDiscardAndStartFresh={discardAndStartFresh}
        />
      ) : null,
    [
      cancel,
      dialogDraft,
      continueDraft,
      discardAndStartFresh,
      isSubmitting,
      open,
    ]
  );

  return {
    activeDraft,
    isCheckingDrafts: enabled && decisionStateQuery.isPending,
    isSubmitting,
    modal,
    requestNewWorkspace,
  };
}
