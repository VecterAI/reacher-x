"use client";

/**
 * Dev-only mock of the FINAL chat-first setup thread.
 * Reuses real /agent presentational pieces (DemoAgentPage pattern + live panels).
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import {
  Message,
  MessageAction,
  MessageAvatar,
  MessageContent,
} from "@/shared/ui/components/Message";
import { Markdown } from "@/shared/ui/components/Markdown";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/shared/ui/components/MessageScroller";
import { AvatarStack } from "@/shared/ui/components/AvatarStack";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { Button, buttonVariants } from "@/shared/ui/components/Button";
import { Progress } from "@/shared/ui/components/Progress";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { AnimatedElapsedTimer } from "@/shared/ui/components/AnimatedElapsedTimer";
import {
  AlternateEmailIcon,
  ArrowUpwardIcon,
  AttachFileIcon,
  ChangeHistoryIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { ComposerEditor } from "@/features/composer/lib/ComposerEditor";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import {
  DESKTOP_PANEL_BORDER_CLASS_NAME,
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import {
  IdealCustomerProfileCard,
  IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME,
} from "@/features/prospects/ui/components/ideal-customer-profile";
import { ConnectedAccountsList } from "@/features/linked-accounts/ui/components";
import { AgentWorkspaceEmptyState } from "@/features/agent/ui/components/AgentWorkspaceEmptyState";
import { InlineProgressCard } from "@/features/agent/ui/components/InlineProgressCard";
import { InlineProfilePreviewCard } from "@/features/agent/ui/components/InlineProfilePreviewCard";
import { PlanStep } from "@/features/agent/ui/components/onboarding/PlanStep";
import { SetupPreviewWaitingState } from "@/features/agent/ui/components/onboarding/SetupPreviewWaitingState";
import { SetupOnboardingCardMenu } from "@/features/agent/ui/components/SetupOnboardingCardMenu";
import { WorkspaceProfileReviewPanel } from "@/features/agent/ui/components/WorkspaceProfileReviewPanel";
import {
  getMockUseCaseLabels,
  MOCK_DESCRIPTION,
  MOCK_IDEAL_PROFILES,
  MOCK_PREVIEW_PROGRESS,
  MOCK_SETUP_CASES,
  MOCK_TWITTER_PROFILES,
  MOCK_USE_CASE_OPTIONS,
  type MockSetupCaseId,
  type MockUseCaseLabels,
  type MockUseCaseOptionId,
} from "./mockSetupData";

const AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME = "mx-auto w-full max-w-[48rem]";
const AGENT_DISPLAY_NAME = "Agent";
const AGENT_AVATAR_FALLBACK = "△";
const AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME =
  "[&_[data-slot=avatar-fallback]]:rounded-md";
const CASE_STORAGE_KEY = "reacherx:mock-setup-case";
const USE_CASE_STORAGE_KEY = "reacherx:mock-setup-use-case";
const PANEL_ANCHOR_ID = "rx-mock-setup-panel";

function getAssistantMarkdownClassName() {
  return cn(
    "markdown-content text-foreground break-words whitespace-normal text-sm text-pretty",
    "prose dark:prose-invert max-w-none prose-sm",
    "[&>:first-child]:mt-0 [&>:last-child]:mb-0",
    "prose-p:my-3 prose-p:leading-6",
    "prose-ul:my-3 prose-ol:my-3 prose-li:my-0 prose-li:leading-6 prose-li:marker:text-muted-foreground",
    "prose-strong:font-semibold"
  );
}

function SetupChatHeader({ setupMenu }: { setupMenu?: ReactNode }) {
  return (
    <header className="bg-background sticky top-0 right-0 left-0 z-10 flex h-10 shrink-0 items-center justify-between border-b px-4 py-2">
      <h1 className="text-sm font-medium">{AGENT_DISPLAY_NAME}</h1>
      {setupMenu ? (
        <div className="flex items-center gap-1">{setupMenu}</div>
      ) : null}
    </header>
  );
}

function AgentMessageRow({
  text,
  children,
}: {
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <Message align="start" className="items-start">
      <MessageAvatar
        alt={AGENT_DISPLAY_NAME}
        fallback={AGENT_AVATAR_FALLBACK}
        className="bg-background text-foreground"
        avatarClassName="size-6 rounded-md"
        slotClassName={AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME}
      />
      <MessageContent className="max-w-[85%] gap-2">
        {text ? (
          <div className="min-w-0">
            <Markdown className={getAssistantMarkdownClassName()}>
              {text}
            </Markdown>
          </div>
        ) : null}
        {children}
      </MessageContent>
    </Message>
  );
}

function UserMessageRow({ text }: { text: string }) {
  return (
    <Message align="end" className="items-start">
      <MessageAvatar
        alt="You"
        fallback="U"
        className="bg-primary text-primary-foreground"
        avatarClassName="size-6"
      />
      <MessageContent className="max-w-[80%] items-end gap-1">
        <div className="bg-primary text-primary-foreground w-auto max-w-full rounded-lg p-2 text-sm break-words whitespace-pre-wrap">
          {text}
        </div>
      </MessageContent>
    </Message>
  );
}

function AgentComposer({
  placeholder,
  disabled = false,
  initialText = "",
}: {
  placeholder: string;
  disabled?: boolean;
  initialText?: string;
}) {
  const initialContent = useMemo(
    () => buildSerializedTextState(initialText),
    [initialText]
  );

  return (
    <div
      className={cn(
        AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME,
        "border-input bg-background ring-offset-background focus-within:ring-ring cursor-text rounded-xl border p-2 transition-shadow focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-hidden",
        disabled && "cursor-not-allowed opacity-60"
      )}
      onClick={(event) => {
        if (disabled) return;
        event.currentTarget
          .querySelector<HTMLElement>("[contenteditable='true']")
          ?.focus();
      }}
    >
      <ComposerEditor
        key={`${placeholder}-${initialText}-${disabled ? "locked" : "open"}`}
        className="min-h-10 text-sm"
        initialContent={initialContent}
        placeholder={placeholder}
        maxLength={10000}
        characterCountMode="raw"
        showCharacterCount={false}
        disabled={disabled}
        contentEditableClassName={cn(
          DM_COMPOSER_CONTENT_EDITABLE_CLASS,
          "max-h-60"
        )}
        composerPlaceholderClassName={DM_COMPOSER_PLACEHOLDER_CLASS}
      />
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xsIcon"
            type="button"
            aria-label="Attach media"
            disabled={disabled}
          >
            <AttachFileIcon className="fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="xsIcon"
            type="button"
            aria-label="Tag people, plans, tasks, posts, or attachments"
            disabled={disabled}
          >
            <AlternateEmailIcon className="fill-current" />
          </Button>
        </div>
        <MessageAction tooltip="Send message">
          <Button
            type="button"
            variant="default"
            size="xsIcon"
            aria-label="Send message"
            disabled={disabled}
          >
            <ArrowUpwardIcon className="fill-current" />
          </Button>
        </MessageAction>
      </div>
    </div>
  );
}

function MockIdealProfilesProposal({
  labels,
  onOpenPanel,
}: {
  labels: MockUseCaseLabels;
  onOpenPanel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <section className="space-y-3" aria-label={labels.profileLabelPlural}>
        <p className="text-muted-foreground text-xs font-medium">
          {labels.profileLabelPlural}
        </p>
        <div className="flex flex-col gap-3">
          {MOCK_IDEAL_PROFILES.map((profile) => (
            <IdealCustomerProfileCard
              key={profile.title}
              profile={profile}
              maxPainBadges={2}
              className={IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME}
            />
          ))}
        </div>
      </section>
      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border shrink-0 rounded-md border p-1">
              <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            </div>
            <span className="min-w-0 truncate text-sm font-medium">
              Input required →
            </span>
          </>
        }
        trailing={
          <>
            <Button type="button" size="xs" variant="ghost">
              Reject
            </Button>
            <Button type="button" size="xs">
              Approve
            </Button>
            <Button
              type="button"
              size="xsIcon"
              variant="outline"
              aria-label="Open profile proposal"
              onClick={onOpenPanel}
            >
              <OpenInNewIcon className="fill-current" />
            </Button>
          </>
        }
      />
    </div>
  );
}

function MockOnboardingPanelShell({
  title,
  stepNumber,
  stepTotal,
  onBack,
  actions,
  children,
  className,
}: {
  title: string;
  stepNumber: number;
  stepTotal: number;
  onBack?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const progressValue =
    stepTotal > 0 ? Math.min(100, (stepNumber / stepTotal) * 100) : 0;

  return (
    <aside
      id={PANEL_ANCHOR_ID}
      className={cn(
        "bg-background flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        DESKTOP_PANEL_BORDER_CLASS_NAME,
        className
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <PageHeader
          title={title}
          titleSuffix={
            <span className="text-muted-foreground font-mono text-sm">
              {" "}
              · {stepNumber}/{stepTotal}
            </span>
          }
          className="rounded-none"
          onBack={onBack}
          actions={actions}
        />
        <Progress
          aria-label={`Setup progress: step ${stepNumber} of ${stepTotal}`}
          className="h-0.5 rounded-none border-0"
          indicatorClassName="bg-foreground rounded-none"
          value={progressValue}
        />
        {children}
      </div>
    </aside>
  );
}

function MockActivitySpinner() {
  return (
    <span className="text-muted-foreground shrink-0" aria-hidden="true">
      <AsciiSpinnerText
        variant="spinner"
        className="block font-mono text-sm leading-5"
      />
    </span>
  );
}

function CaseSwitcher({
  activeCase,
  activeUseCase,
  onCaseChange,
  onUseCaseChange,
}: {
  activeCase: MockSetupCaseId;
  activeUseCase: MockUseCaseOptionId;
  onCaseChange: (id: MockSetupCaseId) => void;
  onUseCaseChange: (id: MockUseCaseOptionId) => void;
}) {
  const [mode, setMode] = useState<"open" | "collapsed">("open");
  const labels = getMockUseCaseLabels(activeUseCase);

  if (mode === "collapsed") {
    return (
      <div className="fixed right-3 bottom-3 z-50">
        <button
          type="button"
          onClick={() => setMode("open")}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "rounded-full font-mono text-xs"
          )}
        >
          Mock
        </button>
      </div>
    );
  }

  return (
    <div className="border-border bg-background/95 fixed right-3 bottom-3 z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-xs font-medium">Setup preview</p>
        <button
          type="button"
          className="text-muted-foreground font-mono text-xs"
          onClick={() => setMode("collapsed")}
        >
          hide
        </button>
      </div>

      <label className="text-muted-foreground mb-1 block font-mono text-[11px]">
        Use case / terminology
      </label>
      <select
        className="border-input bg-background mb-3 w-full rounded-md border px-2 py-1.5 text-xs"
        value={activeUseCase}
        onChange={(event) =>
          onUseCaseChange(event.target.value as MockUseCaseOptionId)
        }
      >
        {MOCK_USE_CASE_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-muted-foreground mb-3 text-[11px]">
        Sidebar labels: {labels.entityPlural} / {labels.successLabel}
      </p>

      <div className="grid max-h-72 gap-1 overflow-y-auto">
        {MOCK_SETUP_CASES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onCaseChange(item.id)}
            className={cn(
              "rounded-lg px-2 py-1.5 text-left transition-colors",
              activeCase === item.id
                ? "bg-foreground text-background"
                : "hover:bg-muted"
            )}
          >
            <span className="block text-xs font-medium">{item.label}</span>
            <span
              className={cn(
                "block text-[11px]",
                activeCase === item.id
                  ? "text-background/80"
                  : "text-muted-foreground"
              )}
            >
              {item.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MockSetupThreadPreview() {
  const isMobile = useIsMobile();
  const [caseId, setCaseId] = useState<MockSetupCaseId>("empty");
  const [useCaseId, setUseCaseId] =
    useState<MockUseCaseOptionId>("general_outreach");
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const previewStartedAt = useMemo(() => Date.now() - 95_000, []);
  const labels = getMockUseCaseLabels(useCaseId);
  const entitiesLower = labels.entityPlural.toLowerCase();
  const profilesLower = labels.profileLabelPlural.toLowerCase();

  useEffect(() => {
    try {
      const storedCase = window.sessionStorage.getItem(CASE_STORAGE_KEY);
      if (
        storedCase &&
        MOCK_SETUP_CASES.some((item) => item.id === storedCase)
      ) {
        setCaseId(storedCase as MockSetupCaseId);
      }
      const storedUseCase = window.sessionStorage.getItem(USE_CASE_STORAGE_KEY);
      if (
        storedUseCase &&
        MOCK_USE_CASE_OPTIONS.some((item) => item.id === storedUseCase)
      ) {
        setUseCaseId(storedUseCase as MockUseCaseOptionId);
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (
      caseId === "connections" ||
      caseId === "plan" ||
      caseId === "preview_ready" ||
      caseId === "preview_running" ||
      caseId === "icp_review"
    ) {
      setPanelOpen(true);
      return;
    }
    setPanelOpen(false);
  }, [caseId]);

  const selectCase = (id: MockSetupCaseId) => {
    setCaseId(id);
    try {
      window.sessionStorage.setItem(CASE_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  const selectUseCase = (id: MockUseCaseOptionId) => {
    setUseCaseId(id);
    try {
      window.sessionStorage.setItem(USE_CASE_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  const openPanel = () => {
    setPanelOpen(true);
    window.requestAnimationFrame(() => {
      document
        .getElementById(PANEL_ANCHOR_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const handleMockResetSetup = () => {
    selectCase("empty");
    toast.success("Starting a fresh setup from step one.");
  };

  const handleMockDeleteDraft = () => {
    selectCase("empty");
    toast.success("Draft removed. Starting setup again.");
  };

  // Header-level escape hatch — not on progress cards (those feel card-scoped).
  const showSetupDraftMenu =
    caseId !== "empty" && caseId !== "done" && caseId !== "prospecting";
  const setupDraftMenu = showSetupDraftMenu ? (
    <SetupOnboardingCardMenu
      onConfirmReset={handleMockResetSetup}
      onConfirmDeleteDraft={handleMockDeleteDraft}
    />
  ) : null;

  if (!ready) {
    return null;
  }

  const isEmpty = caseId === "empty";
  const composerLocked =
    caseId === "generating_icps" ||
    caseId === "preview_running" ||
    caseId === "preview_ready" ||
    caseId === "connections" ||
    caseId === "plan" ||
    caseId === "prospecting";

  const composerPlaceholder =
    caseId === "empty"
      ? "Paste a link or describe who you’re looking for…"
      : caseId === "icp_review"
        ? "Ask to add, remove, or refine an ideal profile…"
        : caseId === "done"
          ? `Type and hit ↵ to chat with ${AGENT_DISPLAY_NAME}.`
          : "Chat is locked during this setup step.";

  const composerInitialText =
    caseId === "icp_review"
      ? "Also add a profile for technical founders with 10k followers."
      : "";

  const showPanel =
    panelOpen &&
    (caseId === "icp_review" ||
      caseId === "preview_running" ||
      caseId === "preview_ready" ||
      caseId === "connections" ||
      caseId === "plan");

  // Match AgentPageShell setup: on mobile, open panel replaces chat (no split).
  const showMobilePanelOnly = isMobile && showPanel;
  const panelSurfaceClassName = cn(
    DESKTOP_PANEL_BORDER_CLASS_NAME,
    showMobilePanelOnly && "max-w-none border-l-0"
  );

  const composer = (
    <AgentComposer
      placeholder={composerPlaceholder}
      disabled={composerLocked}
      initialText={composerInitialText}
    />
  );

  const prospectingReadyCount = 3;
  const canViewProspects = prospectingReadyCount > 1;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden">
      <PageLayout
        className={cn(
          "h-full w-full max-w-none flex-1 basis-0 border-none",
          showMobilePanelOnly && "hidden"
        )}
      >
        <PageContent className="h-full p-0">
          <div className="flex h-full min-h-0 w-full flex-col">
            <SetupChatHeader setupMenu={setupDraftMenu} />

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="relative min-h-0 flex-1">
                <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                  <MessageScroller className="relative h-full min-h-0">
                    <MessageScrollerViewport>
                      <MessageScrollerContent
                        className={cn(
                          AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME,
                          "gap-0 px-4 pt-4 pb-16",
                          isEmpty && "flex min-h-full flex-col justify-center"
                        )}
                      >
                        {isEmpty ? (
                          <AgentWorkspaceEmptyState
                            isResolving={false}
                            headline="Who should Agent find?"
                          >
                            {composer}
                          </AgentWorkspaceEmptyState>
                        ) : null}

                        {caseId === "generating_icps" ? (
                          <>
                            <MessageScrollerItem
                              messageId="user-desc"
                              className="mb-6"
                            >
                              <UserMessageRow text={MOCK_DESCRIPTION} />
                            </MessageScrollerItem>
                            <MessageScrollerItem
                              messageId="gen"
                              className="mb-6"
                            >
                              <AgentMessageRow
                                text={`Got it. I’m treating this as **${labels.displayName.toLowerCase()}** and building ${profilesLower} from your description now.`}
                              >
                                <InlineProgressCard
                                  title={`Building ${profilesLower}`}
                                  progress={45}
                                  status={
                                    <AsciiSpinnerText
                                      text={`Turning your description into ${profilesLower}…`}
                                      variant="spinner"
                                      className="text-muted-foreground text-xs"
                                    />
                                  }
                                />
                              </AgentMessageRow>
                            </MessageScrollerItem>
                          </>
                        ) : null}

                        {caseId === "icp_review" ? (
                          <MessageScrollerItem messageId="icp" className="mb-6">
                            <AgentMessageRow
                              text={`Here are the ${profilesLower} I’d use. Approve them, open the panel to edit/add, or tell me what to change in chat.`}
                            >
                              <MockIdealProfilesProposal
                                labels={labels}
                                onOpenPanel={openPanel}
                              />
                            </AgentMessageRow>
                          </MessageScrollerItem>
                        ) : null}

                        {caseId === "preview_running" ? (
                          <MessageScrollerItem
                            messageId="preview-run"
                            className="mb-6"
                          >
                            <AgentMessageRow
                              text={`Locked in. Running a quick preview search for matching ${entitiesLower}…`}
                            >
                              <InlineProgressCard
                                title={`Finding preview ${entitiesLower}`}
                                progress={55}
                                headerAction={<MockActivitySpinner />}
                                status={
                                  <AnimatedElapsedTimer
                                    startedAt={previewStartedAt}
                                    className="text-muted-foreground text-xs tabular-nums"
                                  />
                                }
                                footerAction={
                                  <Button
                                    type="button"
                                    size="xs"
                                    onClick={openPanel}
                                  >
                                    Open
                                  </Button>
                                }
                              />
                            </AgentMessageRow>
                          </MessageScrollerItem>
                        ) : null}

                        {caseId === "preview_ready" ? (
                          <MessageScrollerItem
                            messageId="preview-ready"
                            className="mb-6"
                          >
                            <AgentMessageRow
                              text={`Preview’s ready. These ${entitiesLower} look directionally right — open the panel to review, then continue when you want to finish setup.`}
                            >
                              <section aria-label="Preview results">
                                <InlineFeatureStrip
                                  leading={
                                    <>
                                      <AvatarStack
                                        size="sm"
                                        maxVisible={4}
                                        participants={MOCK_TWITTER_PROFILES.map(
                                          (person) => ({
                                            name: String(
                                              person.profileData.displayName ??
                                                "Preview"
                                            ),
                                            avatarUrl:
                                              typeof person.profileData
                                                .avatarUrl === "string"
                                                ? person.profileData.avatarUrl
                                                : undefined,
                                          })
                                        )}
                                      />
                                      <span className="min-w-0 truncate text-sm font-medium">
                                        <span className="font-mono tabular-nums">
                                          {MOCK_TWITTER_PROFILES.length}
                                        </span>
                                        {` preview ${entitiesLower}`}
                                      </span>
                                    </>
                                  }
                                  trailing={
                                    <>
                                      <Button
                                        type="button"
                                        size="xs"
                                        onClick={() =>
                                          selectCase("connections")
                                        }
                                      >
                                        Continue
                                      </Button>
                                      <Button
                                        type="button"
                                        size="xsIcon"
                                        variant="outline"
                                        aria-label="Open preview panel"
                                        onClick={openPanel}
                                      >
                                        <OpenInNewIcon className="fill-current" />
                                      </Button>
                                    </>
                                  }
                                />
                              </section>
                            </AgentMessageRow>
                          </MessageScrollerItem>
                        ) : null}

                        {caseId === "connections" ? (
                          <MessageScrollerItem
                            messageId="connections"
                            className="mb-6"
                          >
                            <AgentMessageRow
                              text={`Connect your accounts so I can actually reach ${entitiesLower} for you.`}
                            >
                              <InlineProgressCard
                                title="Connect accounts"
                                progress={75}
                                status={
                                  <p>
                                    Step <span className="font-mono">3/4</span>
                                  </p>
                                }
                                footerAction={
                                  <Button
                                    type="button"
                                    size="xs"
                                    onClick={openPanel}
                                  >
                                    Continue
                                  </Button>
                                }
                              />
                            </AgentMessageRow>
                          </MessageScrollerItem>
                        ) : null}

                        {caseId === "plan" ? (
                          <MessageScrollerItem
                            messageId="plan"
                            className="mb-6"
                          >
                            <AgentMessageRow text="Pick a plan to unlock the workspace. After that you’re ready to go.">
                              <InlineProgressCard
                                title="Choose a plan"
                                progress={100}
                                status={
                                  <p>
                                    Step <span className="font-mono">4/4</span>
                                  </p>
                                }
                                footerAction={
                                  <Button
                                    type="button"
                                    size="xs"
                                    onClick={openPanel}
                                  >
                                    Continue
                                  </Button>
                                }
                              />
                            </AgentMessageRow>
                          </MessageScrollerItem>
                        ) : null}

                        {caseId === "done" ? (
                          <MessageScrollerItem
                            messageId="done"
                            className="mb-6"
                          >
                            <AgentMessageRow
                              text={`You’re set — setup is complete and this workspace is unlocked.\n\nI already started finding ${entitiesLower} in the background. You can keep chatting here, or browse the app while that runs.`}
                            />
                          </MessageScrollerItem>
                        ) : null}

                        {caseId === "prospecting" ? (
                          <MessageScrollerItem
                            messageId="prospecting"
                            className="mb-6"
                          >
                            <AgentMessageRow
                              text={`Starting discovery for ${entitiesLower} against your approved ideal profiles.\n\nSetup is done — the sidebar is unlocked so you can roam. Home may still show the wait triangle until enough ${entitiesLower} are ready.`}
                            >
                              <InlineProgressCard
                                title={`Finding ${entitiesLower}`}
                                progress={62}
                                headerAction={<MockActivitySpinner />}
                                status={
                                  <AnimatedElapsedTimer
                                    startedAt={previewStartedAt}
                                    className="text-muted-foreground text-xs tabular-nums"
                                  />
                                }
                                footerAction={
                                  <Button
                                    type="button"
                                    size="xs"
                                    disabled={!canViewProspects}
                                    onClick={() => {
                                      window.location.assign("/");
                                    }}
                                  >
                                    {`View ${entitiesLower}`}
                                  </Button>
                                }
                              />
                            </AgentMessageRow>
                          </MessageScrollerItem>
                        ) : null}
                      </MessageScrollerContent>
                    </MessageScrollerViewport>
                  </MessageScroller>
                </MessageScrollerProvider>
              </div>

              {!isEmpty ? (
                <div className="bg-background shrink-0 px-4 pb-4 backdrop-blur-xl">
                  {composer}
                </div>
              ) : null}
            </div>
          </div>
        </PageContent>
      </PageLayout>

      {showPanel && caseId === "icp_review" ? (
        <div id={PANEL_ANCHOR_ID} className="contents">
          <WorkspaceProfileReviewPanel
            className={panelSurfaceClassName}
            onClose={() => setPanelOpen(false)}
            previewProposal={{
              profileLabelPlural: labels.profileLabelPlural,
              proposedProfiles: MOCK_IDEAL_PROFILES,
              addedTitles: MOCK_IDEAL_PROFILES.map((profile) => profile.title),
            }}
          />
        </div>
      ) : null}

      {showPanel && caseId === "preview_running" ? (
        <MockOnboardingPanelShell
          title="Your audience"
          stepNumber={2}
          stepTotal={4}
          onBack={() => setPanelOpen(false)}
          className={showMobilePanelOnly ? "max-w-none border-l-0" : undefined}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <SetupPreviewWaitingState
              entityPlural={labels.entityPlural}
              progress={MOCK_PREVIEW_PROGRESS}
              startedAt={previewStartedAt}
              targetCount={3}
            />
          </div>
        </MockOnboardingPanelShell>
      ) : null}

      {showPanel && caseId === "preview_ready" ? (
        <MockOnboardingPanelShell
          title="Your audience"
          stepNumber={2}
          stepTotal={4}
          onBack={() => setPanelOpen(false)}
          className={showMobilePanelOnly ? "max-w-none border-l-0" : undefined}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ScrollArea className="min-h-0 flex-1">
              <section
                className="space-y-3 px-4 py-4"
                aria-label="Preview results"
              >
                {MOCK_TWITTER_PROFILES.map((person) => (
                  <InlineProfilePreviewCard
                    key={person.id}
                    variant="twitter"
                    platform="twitter"
                    profileData={person.profileData}
                    showActions={false}
                    showFeatureStrip={false}
                    interactive={false}
                  />
                ))}
              </section>
            </ScrollArea>
            <div className="bg-background shrink-0 border-t px-4 py-2">
              <div className="flex w-full min-w-0 items-center justify-end gap-2">
                <Button
                  type="button"
                  size="xs"
                  className="w-full"
                  onClick={() => selectCase("connections")}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </MockOnboardingPanelShell>
      ) : null}

      {showPanel && caseId === "connections" ? (
        <MockOnboardingPanelShell
          title="Connect accounts"
          stepNumber={3}
          stepTotal={4}
          onBack={() => setPanelOpen(false)}
          className={showMobilePanelOnly ? "max-w-none border-l-0" : undefined}
        >
          {/* Same flex shell as ConnectionsStep — footer pinned to panel bottom */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ScrollArea className="min-h-0 flex-1">
              <PageContent className="min-w-0 overflow-x-hidden px-4 py-4">
                <header className="space-y-1">
                  <h2 className="text-xl font-semibold">
                    Let the △ Agent take action
                  </h2>
                  <p className="text-muted-foreground text-sm wrap-break-word">
                    Connect your accounts so the Agent can send DMs, reply to
                    posts, and engage on your behalf.
                  </p>
                </header>
                <div className="mt-4">
                  <ConnectedAccountsList
                    loading={false}
                    googleEmail="sara@gmail.com"
                    googleConnectedAt={new Date()}
                    isGoogleConnected
                    xStatus={null}
                    linkedinStatus={null}
                    onConnectX={() => undefined}
                    onDisconnectX={() => undefined}
                    onConnectLinkedIn={() => undefined}
                    onDisconnectLinkedIn={() => undefined}
                    hideXDisconnect
                    hideLinkedInDisconnect
                  />
                </div>
              </PageContent>
            </ScrollArea>
            <div className="bg-background shrink-0 border-t px-4 py-2">
              <div className="flex w-full min-w-0 items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="xs">
                  Connect later
                </Button>
                <Button type="button" size="xs" disabled>
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </MockOnboardingPanelShell>
      ) : null}

      {showPanel && caseId === "plan" ? (
        <MockOnboardingPanelShell
          title="Plans"
          stepNumber={4}
          stepTotal={4}
          onBack={() => setPanelOpen(false)}
          className={showMobilePanelOnly ? "max-w-none border-l-0" : undefined}
        >
          <ScrollArea className="min-h-0 flex-1">
            <PageContent className="px-4 py-4">
              <PlanStep
                onUpgradePaid={() => undefined}
                entityPlural={labels.entityPlural}
              />
            </PageContent>
          </ScrollArea>
        </MockOnboardingPanelShell>
      ) : null}

      {/* Keep mock controls off panel footers on mobile */}
      {!(isMobile && showPanel) ? (
        <CaseSwitcher
          activeCase={caseId}
          activeUseCase={useCaseId}
          onCaseChange={selectCase}
          onUseCaseChange={selectUseCase}
        />
      ) : null}
    </div>
  );
}
