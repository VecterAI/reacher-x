"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import Link from "next/link";
import type { SerializedEditorState } from "lexical";
import { useMutation } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { toast } from "sonner";
import { ComposerEditor } from "@/features/composer/lib/ComposerEditor";
import type { ComposerEditorAPI } from "@/features/composer/lib/ToolbarBridgePlugin";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import {
  getCustomWorkspaceLimitHref,
  getPlansUpgradeHref,
} from "@/features/billing/lib/plansUpgradeUrl";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { useUrlDescription } from "@/shared/hooks/useUrlDescription";
import { navigateDocumentIntentionally } from "@/shared/lib/convex/intentionalDocumentNavigation";
import {
  type AuthRouteHref,
  buildLoginHref,
  NEW_WORKSPACE_SETUP_AUTH_RETURN_TO,
} from "@/shared/lib/urls/authRoutes";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";
import { resolveUrlDescriptionStatusText } from "@/shared/lib/urls/urlDescriptionStatus";
import { setPreferredShellContext } from "@/shared/stores/preferredShellContext";
import { extractTextFromEditorState } from "@/shared/lib/utils/url/urlDetection";
import { cn } from "@/shared/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button, buttonVariants } from "@/shared/ui/components/Button";
import {
  ArrowUpwardIcon,
  AttachFileIcon,
  ChangeHistoryIcon,
} from "@/shared/ui/components/icons";
import { UrlDescriptionFooterSlot } from "@/shared/ui/components/UrlDescriptionStatus";
import {
  clearStoredLandingPromptHandoff,
  type LandingPromptHandoff,
  LANDING_PROMPT_STORAGE_KEY,
  writeStoredLandingPromptHandoff,
} from "@/features/landing/lib/landingPromptStorage";
import { isLandingWorkspaceCapacityBlocked } from "@/features/landing/lib/landingSetupDestination";
import { submitLandingSetupHandoffToThread } from "@/features/agent/lib/landingSetupHandoff";
import { useNewWorkspaceDraftFlow } from "@/features/webapp/hooks/useNewWorkspaceDraftFlow";
import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks";
import { buildSetupHref } from "@/shared/lib/urls/setupHref";
import { LandingAuthLink } from "./LandingAuthLink";

export { LANDING_PROMPT_STORAGE_KEY };

const DEFAULT_PLACEHOLDER =
  "Find founders posting about hiring their first SDR...";

interface LandingPromptCtaProps {
  authenticatedHref?: string;
  anonymousHref?: AuthRouteHref;
  placeholder?: string;
  className?: string;
  /** Show the full "Reach people" pill under the composer shell. */
  showLabeledCta?: boolean;
}

function persistPromptHandoff(handoff: LandingPromptHandoff) {
  if (!handoff.prompt.trim() || typeof window === "undefined") return;
  writeStoredLandingPromptHandoff(window.sessionStorage, handoff);
}

function persistPrompt(value: string, sourceUrl: string | null) {
  if (!value.trim()) return;
  persistPromptHandoff({
    prompt: value,
    sourceUrl,
    requiresNewWorkspaceDecision: true,
  });
}

/**
 * Landing acquisition composer. Same shell as AgentChat (ComposerEditor +
 * attach row + send), but submit only stores the prompt and routes into auth /
 * setup. Mentions and attachments stay visual-only here.
 *
 * URL paste / whole-value URL submit uses the shared Exa auto-fill path
 * (`useUrlDescription`) with the same status labels as setup step 2.
 */
export function LandingPromptCta({
  authenticatedHref,
  anonymousHref = buildLoginHref(NEW_WORKSPACE_SETUP_AUTH_RETURN_TO),
  placeholder = DEFAULT_PLACEHOLDER,
  className,
  showLabeledCta = true,
}: LandingPromptCtaProps) {
  const { user, loading } = useAuth();
  const contentEditableId = useId();
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const editorApiRef = useRef<ComposerEditorAPI | null>(null);
  const pendingAuthenticatedHandoffRef = useRef<LandingPromptHandoff | null>(
    null
  );
  const isReadingRef = useRef(false);
  const lastToastedError = useRef<string | null>(null);

  const applyExtractedText = useCallback((next: string) => {
    setText(next);
    editorApiRef.current?.replaceContent(next || undefined);
  }, []);

  const {
    isReadingUrl,
    readError,
    scheduleReadIfValid,
    beginRead,
    cancelRead,
  } = useUrlDescription({
    setText: (next) => {
      applyExtractedText(next);
    },
    onReadingChange: (reading) => {
      isReadingRef.current = reading;
    },
    onSourceUrlChange: setSourceUrl,
  });

  const setupBootstrapQuery = useQueryWithStatus(
    api.setupSessions.getSetupBootstrapState,
    user ? {} : "skip"
  );
  const workspaceEligibilityQuery = useQueryWithStatus(
    api.plans.getWorkspaceCreationEligibility,
    user ? {} : "skip"
  );
  const submitSetupMessageMutation = useMutation(
    api.chat.initiateStreamingMessage
  );
  const requiresFirstWorkspace =
    setupBootstrapQuery.data?.requiresFirstWorkspace ?? false;
  const workspaceCapacityBlocked = isLandingWorkspaceCapacityBlocked({
    isAuthenticated: Boolean(user),
    requiresFirstWorkspace,
    workspaceCreationAllowed: workspaceEligibilityQuery.data?.allowed,
  });
  const workspaceCapacityReason =
    workspaceEligibilityQuery.data?.reason ??
    "Your current plan has no workspace slots available.";
  const isHighestTierAtCapacity =
    workspaceCapacityBlocked && workspaceEligibilityQuery.data?.tier === "pro";
  const authenticatedStatePending = Boolean(
    user &&
    (setupBootstrapQuery.isPending || workspaceEligibilityQuery.isPending)
  );

  const handleDraftFlowError = useCallback(() => {
    if (typeof window !== "undefined") {
      clearStoredLandingPromptHandoff(window.sessionStorage);
    }
    // Keep the in-memory handoff so an open draft dialog can retry a failed
    // Continue or Replace action without losing the submitted description.
    setIsSubmittingPrompt(false);
  }, []);

  const handleDraftFlowCancel = useCallback(() => {
    if (typeof window !== "undefined") {
      clearStoredLandingPromptHandoff(window.sessionStorage);
    }
    pendingAuthenticatedHandoffRef.current = null;
    setIsSubmittingPrompt(false);
  }, []);

  const handleDraftSessionSelected = useCallback(
    async ({
      kind,
      threadId,
    }: {
      kind: "created" | "continued";
      threadId: string;
    }) => {
      const handoff = pendingAuthenticatedHandoffRef.current;
      if (!handoff) {
        throw new Error("The landing description is no longer available.");
      }

      if (kind === "continued") {
        // Continue means resume the existing setup exactly as-is. The landing
        // description belongs only to a new workspace and must not edit it.
        if (typeof window !== "undefined") {
          clearStoredLandingPromptHandoff(window.sessionStorage);
        }
        pendingAuthenticatedHandoffRef.current = null;
        setPreferredShellContext("setup_session");
        navigateDocumentIntentionally(
          authenticatedHref ?? buildSetupHref(threadId)
        );
        return;
      }

      const submittedHandoff = await submitLandingSetupHandoffToThread({
        threadId,
        handoff,
        submitSetupMessage: submitSetupMessageMutation,
      });
      pendingAuthenticatedHandoffRef.current = null;
      persistPromptHandoff(submittedHandoff);
      setPreferredShellContext("setup_session");
      navigateDocumentIntentionally(
        authenticatedHref ?? buildSetupHref(threadId)
      );
    },
    [authenticatedHref, submitSetupMessageMutation]
  );

  const draftFlow = useNewWorkspaceDraftFlow({
    enabled: Boolean(user) && !authenticatedStatePending,
    mode: requiresFirstWorkspace ? "first_workspace" : "new_workspace",
    onCancel: handleDraftFlowCancel,
    onError: handleDraftFlowError,
    onSessionSelected: handleDraftSessionSelected,
  });
  const statusText = resolveUrlDescriptionStatusText({
    isReadingUrl,
  });
  const composerBusy =
    loading ||
    isReadingUrl ||
    isSubmittingPrompt ||
    authenticatedStatePending ||
    workspaceCapacityBlocked;
  const canSubmitPrompt = text.trim().length > 0 && !composerBusy;

  useEffect(() => {
    if (readError && readError !== lastToastedError.current) {
      lastToastedError.current = readError;
      toast.error("Couldn't read the URL", {
        description: readError,
      });
    }
    if (!readError) {
      lastToastedError.current = null;
    }
  }, [readError]);

  const go = useCallback(async () => {
    if (composerBusy) {
      if (workspaceCapacityBlocked) {
        toast.error("Workspace limit reached", {
          description: workspaceCapacityReason,
        });
      }
      return;
    }

    if (!text.trim()) {
      return;
    }
    const prompt = text;

    if (!user) {
      persistPrompt(prompt, sourceUrl);
      navigateDocumentIntentionally(anonymousHref);
      return;
    }

    setIsSubmittingPrompt(true);
    pendingAuthenticatedHandoffRef.current = { prompt, sourceUrl };
    try {
      await draftFlow.requestNewWorkspace();
    } catch (submissionError) {
      pendingAuthenticatedHandoffRef.current = null;
      setIsSubmittingPrompt(false);
      toast.error("Couldn't start setup", {
        description:
          submissionError instanceof Error
            ? submissionError.message
            : "Please try again.",
      });
    }
  }, [
    anonymousHref,
    sourceUrl,
    text,
    user,
    composerBusy,
    draftFlow,
    workspaceCapacityBlocked,
    workspaceCapacityReason,
  ]);

  const handleContentChange = useCallback(
    (next: SerializedEditorState) => {
      const plain = extractTextFromEditorState(next);
      setText(plain);

      if (isReadingRef.current) {
        return;
      }

      scheduleReadIfValid(plain);
    },
    [scheduleReadIfValid]
  );

  const handleBridgeReady = useCallback((api: ComposerEditorAPI) => {
    editorApiRef.current = api;
  }, []);

  const handleSend = useCallback(() => {
    if (!canSubmitPrompt) return;

    const trimmed = text.trim();
    const candidate = getUrlFromWholeValue(trimmed);
    if (candidate) {
      void beginRead(candidate);
      return;
    }

    void go();
  }, [beginRead, canSubmitPrompt, go, text]);

  const handlePasteCapture = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (composerBusy) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const pasted = event.clipboardData.getData("text");
      const candidate = getUrlFromWholeValue(pasted);
      if (!candidate) return;

      event.preventDefault();
      event.stopPropagation();
      applyExtractedText(pasted);
      void beginRead(candidate);
    },
    [applyExtractedText, beginRead, composerBusy]
  );

  const labeledButtonClassName = cn(
    buttonVariants({ variant: "default" }),
    "rounded-full shrink-0"
  );

  const labeledCta = loading ? (
    <span
      className={labeledButtonClassName}
      aria-busy="true"
      aria-disabled="true"
    >
      <ChangeHistoryIcon className="size-4 fill-current" />
      Reach people
    </span>
  ) : user ? (
    <button
      type="button"
      className={cn(
        labeledButtonClassName,
        composerBusy && "cursor-not-allowed opacity-50"
      )}
      onClick={() => void go()}
      disabled={composerBusy}
    >
      <ChangeHistoryIcon className="size-4 fill-current" />
      Reach people
    </button>
  ) : (
    <LandingAuthLink
      href={anonymousHref}
      className={cn(
        labeledButtonClassName,
        isReadingUrl && "pointer-events-none opacity-50"
      )}
      onClick={() => {
        if (isReadingUrl) return;
        persistPrompt(text, sourceUrl);
      }}
    >
      <ChangeHistoryIcon className="size-4 fill-current" />
      Reach people
    </LandingAuthLink>
  );

  return (
    <div
      className={cn("mx-auto w-full max-w-2xl min-w-0 text-left", className)}
    >
      <div
        className={cn(
          "border-input bg-background ring-offset-background focus-within:ring-ring rounded-xl border p-3 transition-shadow focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-hidden",
          composerBusy ? "cursor-not-allowed opacity-60" : "cursor-text"
        )}
        aria-disabled={composerBusy}
        onPasteCapture={handlePasteCapture}
      >
        <label className="sr-only" htmlFor={contentEditableId}>
          Describe who you need Agent to find
        </label>
        <ComposerEditor
          className="min-h-20 w-full min-w-0 text-left text-sm"
          initialContent={buildSerializedTextState("")}
          placeholder={placeholder}
          maxLength={10000}
          characterCountMode="raw"
          showCharacterCount={false}
          disabled={composerBusy}
          contentEditableId={contentEditableId}
          contentEditableClassName={cn(
            DM_COMPOSER_CONTENT_EDITABLE_CLASS,
            "min-h-20 max-h-60 w-full min-w-0 overflow-x-hidden overflow-y-auto text-left wrap-anywhere"
          )}
          composerPlaceholderClassName={DM_COMPOSER_PLACEHOLDER_CLASS}
          onContentChange={handleContentChange}
          onBridgeReady={handleBridgeReady}
          submitOnEnter
          onSubmitShortcut={handleSend}
        />
        <div className="pt-2">
          <UrlDescriptionFooterSlot
            statusText={statusText}
            isReadingUrl={isReadingUrl}
            onCancel={cancelRead}
            idleLeft={
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xsIcon"
                  type="button"
                  disabled
                  aria-label="Attach media"
                  title="Available after you start with Agent"
                >
                  <AttachFileIcon className="fill-current" />
                </Button>
              </div>
            }
            idleRight={
              <Button
                type="button"
                variant="default"
                size="xsIcon"
                onClick={handleSend}
                aria-label="Reach people"
                title="Reach people"
                disabled={!canSubmitPrompt}
              >
                <ArrowUpwardIcon className="fill-current" />
              </Button>
            }
          />
        </div>
      </div>

      {workspaceCapacityBlocked ? (
        <Alert className="mt-3 text-left">
          <AlertTitle>Workspace limit reached</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{workspaceCapacityReason}</p>
            <Button asChild size="xs">
              <Link
                href={
                  isHighestTierAtCapacity
                    ? getCustomWorkspaceLimitHref()
                    : getPlansUpgradeHref()
                }
              >
                {isHighestTierAtCapacity
                  ? "Request custom limit"
                  : "Upgrade plan"}
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {showLabeledCta ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Nothing sends without your approval.
          </p>
          {labeledCta}
        </div>
      ) : null}

      <noscript>
        <Link href={anonymousHref} className={labeledButtonClassName}>
          Reach people
        </Link>
      </noscript>
      {draftFlow.modal}
    </div>
  );
}
