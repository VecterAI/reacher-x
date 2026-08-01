"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import Link from "next/link";
import type { SerializedEditorState } from "lexical";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { toast } from "sonner";
import { ComposerEditor } from "@/features/composer/lib/ComposerEditor";
import type { ComposerEditorAPI } from "@/features/composer/lib/ToolbarBridgePlugin";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
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
import { extractTextFromEditorState } from "@/shared/lib/utils/url/urlDetection";
import { cn } from "@/shared/lib/utils";
import { Button, buttonVariants } from "@/shared/ui/components/Button";
import {
  ArrowUpwardIcon,
  AttachFileIcon,
  ChangeHistoryIcon,
} from "@/shared/ui/components/icons";
import { UrlDescriptionFooterSlot } from "@/shared/ui/components/UrlDescriptionStatus";
import {
  LANDING_PROMPT_STORAGE_KEY,
  serializeLandingPromptHandoff,
} from "@/features/landing/lib/landingPromptStorage";
import {
  isLandingWorkspaceCapacityBlocked,
  resolveAuthenticatedLandingSetupHref,
} from "@/features/landing/lib/landingSetupDestination";
import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks";
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

function persistPrompt(value: string, sourceUrl: string | null) {
  const trimmed = value.trim();
  if (!trimmed || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      LANDING_PROMPT_STORAGE_KEY,
      serializeLandingPromptHandoff({ prompt: trimmed, sourceUrl })
    );
  } catch {
    // Ignore storage failures. Auth navigation must still proceed.
  }
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
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const editorApiRef = useRef<ComposerEditorAPI | null>(null);
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
  const requiresFirstWorkspace =
    setupBootstrapQuery.data?.requiresFirstWorkspace ?? false;
  const activeSetupSession = setupBootstrapQuery.data?.activeSession ?? null;
  const hasActiveNewWorkspaceDraft =
    activeSetupSession?.mode === "new_workspace";
  const workspaceCapacityBlocked = isLandingWorkspaceCapacityBlocked({
    isAuthenticated: Boolean(user),
    requiresFirstWorkspace,
    hasActiveNewWorkspaceDraft,
    workspaceCreationAllowed: workspaceEligibilityQuery.data?.allowed,
  });
  const authenticatedStatePending = Boolean(
    user &&
    (setupBootstrapQuery.isPending || workspaceEligibilityQuery.isPending)
  );
  const resolvedAuthenticatedHref =
    authenticatedHref ??
    resolveAuthenticatedLandingSetupHref(
      requiresFirstWorkspace,
      activeSetupSession?.threadId
    );

  const statusText = resolveUrlDescriptionStatusText({
    isReadingUrl,
  });
  const composerBusy =
    loading ||
    isReadingUrl ||
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

  const go = useCallback(() => {
    if (workspaceCapacityBlocked) {
      toast.error("Workspace limit reached", {
        description:
          workspaceEligibilityQuery.data?.reason ??
          "Your current plan cannot create another workspace.",
      });
      return;
    }
    persistPrompt(text, sourceUrl);
    if (user) {
      window.location.assign(resolvedAuthenticatedHref);
      return;
    }
    navigateDocumentIntentionally(anonymousHref);
  }, [
    anonymousHref,
    resolvedAuthenticatedHref,
    sourceUrl,
    text,
    user,
    workspaceCapacityBlocked,
    workspaceEligibilityQuery.data?.reason,
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

    go();
  }, [beginRead, canSubmitPrompt, go, text]);

  const handlePasteCapture = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (composerBusy) return;

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
      onClick={go}
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
    <div className={cn("mx-auto w-full max-w-2xl", className)}>
      <div
        className="border-input bg-background ring-offset-background focus-within:ring-ring cursor-text rounded-xl border p-3 transition-shadow focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-hidden"
        onClick={(event) => {
          if (composerBusy) return;
          const target = event.currentTarget.querySelector<HTMLElement>(
            "[contenteditable='true']"
          );
          target?.focus();
        }}
        onPasteCapture={handlePasteCapture}
      >
        <label className="sr-only" htmlFor="landing-agent-composer">
          Describe who you need Agent to find
        </label>
        <ComposerEditor
          className="min-h-20 text-sm"
          initialContent={buildSerializedTextState("")}
          placeholder={placeholder}
          maxLength={10000}
          characterCountMode="raw"
          showCharacterCount={false}
          disabled={composerBusy}
          contentEditableClassName={cn(
            DM_COMPOSER_CONTENT_EDITABLE_CLASS,
            "max-h-60"
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
    </div>
  );
}
