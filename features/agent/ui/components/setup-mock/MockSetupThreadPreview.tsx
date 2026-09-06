"use client";

/**
 * Dev-only mock of the FINAL chat-first setup thread.
 * Reuses real /agent presentational pieces (DemoAgentPage pattern + live panels).
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/shared/ui/components/Button";
import { Progress } from "@/shared/ui/components/Progress";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  AlternateEmailIcon,
  ArrowUpwardIcon,
  AttachFileIcon,
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
import { MockConnectionsStep } from "./MockConnectionsStep";
import { AgentWorkspaceEmptyState } from "@/features/agent/ui/components/AgentWorkspaceEmptyState";
import { OnboardingProgressCard } from "@/features/agent/ui/components/OnboardingProgressCard";
import { InlineProgressCard } from "@/features/agent/ui/components/InlineProgressCard";
import { PlanStep } from "@/features/agent/ui/components/onboarding/PlanStep";
import { SetupOnboardingCardMenu } from "@/features/agent/ui/components/SetupOnboardingCardMenu";
import {
  getMockUseCaseLabels,
  MOCK_DESCRIPTIONS,
  getMockSetupRefinement,
  getMockSetupProspects,
  MOCK_SETUP_CASES,
  MOCK_USE_CASE_OPTIONS,
  type MockSetupCaseId,
  type MockUseCaseOptionId,
} from "./mockSetupData";

import { ProspectCard } from "@/features/prospects/ui/components/prospect-card/ProspectCard";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/components/Popover";
import { useActiveUseCaseLabels } from "@/shared/hooks/useActiveUseCaseLabels";
import { getWorkspaceDiscoveryVerb } from "@/shared/lib/workspaceUseCases";
import { getRunningWorkspaceStatusCopy } from "@/shared/lib/workspaceStatusCopyHelpers";
import { extractTextFromEditorState } from "@/shared/lib/utils/url/urlDetection";

const AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME = "mx-auto w-full max-w-[48rem]";
const AGENT_DISPLAY_NAME = "Agent";
const AGENT_AVATAR_FALLBACK = "△";
const AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME =
  "[&_[data-slot=avatar-fallback]]:rounded-md";
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
  onSend,
}: {
  placeholder: string;
  disabled?: boolean;
  initialText?: string;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState(initialText);
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
    >
      <ComposerEditor
        key={`${placeholder}-${initialText}-${disabled ? "locked" : "open"}`}
        className="min-h-10 text-sm"
        initialContent={initialContent}
        placeholder={placeholder}
        maxLength={10000}
        characterCountMode="raw"
        showCharacterCount={false}
        onContentChange={(state) => setText(extractTextFromEditorState(state))}
        submitOnEnter
        onSubmitShortcut={() => {
          if (!disabled && text.trim()) onSend(text.trim());
        }}
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
            disabled
          >
            <AttachFileIcon className="fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="xsIcon"
            type="button"
            aria-label="Add a mention"
            disabled
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
            disabled={disabled || !text.trim()}
            onClick={() => onSend(text.trim())}
          >
            <ArrowUpwardIcon className="fill-current" />
          </Button>
        </MessageAction>
      </div>
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
  onTryEdit,
}: {
  activeCase: MockSetupCaseId;
  activeUseCase: MockUseCaseOptionId;
  onCaseChange: (id: MockSetupCaseId) => void;
  onUseCaseChange: (id: MockUseCaseOptionId) => void;
  onTryEdit: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="fixed right-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="xs">
            Mock
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          className="max-h-[60dvh] w-80 max-w-[calc(100vw-1.5rem)] space-y-3 overflow-y-auto"
        >
          <p className="text-muted-foreground text-xs text-pretty">
            UI preview with sample data. No live actions.
          </p>
          <label htmlFor="mock-use-case" className="block text-xs">
            Use case
          </label>
          <select
            id="mock-use-case"
            className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-xs"
            value={activeUseCase}
            onChange={(event) => {
              onUseCaseChange(event.target.value as MockUseCaseOptionId);
            }}
          >
            {MOCK_USE_CASE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-1">
            {MOCK_SETUP_CASES.map((item) => (
              <Button
                key={item.id}
                size="xs"
                variant={activeCase === item.id ? "secondary" : "ghost"}
                onClick={() => {
                  onCaseChange(item.id);
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <Button
            size="xs"
            variant="outline"
            className="w-full"
            onClick={() => {
              onTryEdit();
              setOpen(false);
            }}
          >
            Try a chat edit
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function MockSetupThreadPreview() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [caseId, setCaseId] = useState<MockSetupCaseId>("review");
  const { activeUseCaseKey } = useActiveUseCaseLabels();
  const [useCaseOverride, setUseCaseOverride] =
    useState<MockUseCaseOptionId | null>(null);
  const useCaseId = useCaseOverride ?? activeUseCaseKey;
  const [panelOpen, setPanelOpen] = useState(true);
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState("");
  const [composerDraft, setComposerDraft] = useState("");
  const [revised, setRevised] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [postSetupMessage, setPostSetupMessage] = useState("");
  const labels = getMockUseCaseLabels(useCaseId);
  const prospects = getMockSetupProspects(useCaseId);
  const displayedProspects = revised ? prospects.slice(0, 2) : prospects;
  const entityPlural = labels.entityPlural.toLowerCase();
  const entitySingular = labels.entitySingular.toLowerCase();
  const runningStatusCopy = getRunningWorkspaceStatusCopy({
    discoveryVerb: getWorkspaceDiscoveryVerb(useCaseId),
    entityPlural,
    useCaseName: labels.displayName,
  });
  const isReview =
    caseId === "review" || caseId === "updated" || caseId === "start_failed";
  const isWorking = caseId === "generating";
  const isComplete = caseId === "done" || caseId === "results";
  const isPlan = caseId === "plan" || caseId === "checkout_failed";
  const composerLocked =
    isWorking ||
    caseId === "starting" ||
    caseId === "connections" ||
    isPlan ||
    caseId === "checkout";

  const selectCase = (id: MockSetupCaseId) => {
    setAutoAdvance(false);
    setCaseId(id);
    if (id === "updated") setRevised(true);
    if (id === "empty" || id === "review") {
      setRevised(false);
      setFeedback("");
    }
    setPanelOpen(
      id === "review" ||
        id === "updated" ||
        id === "start_failed" ||
        id === "connections" ||
        id === "plan" ||
        id === "checkout" ||
        id === "checkout_failed"
    );
  };

  // States selected in the floating menu stay still for inspection.
  // Only user-triggered demo transitions advance automatically.
  useEffect(() => {
    if (!autoAdvance) return;
    const timer = window.setTimeout(() => {
      const next =
        caseId === "generating"
          ? revised
            ? "updated"
            : "review"
          : caseId === "starting"
            ? "connections"
            : caseId === "checkout"
              ? "done"
              : null;
      if (next) {
        setCaseId(next);
        setPanelOpen(next !== "done");
      }
      setAutoAdvance(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [caseId, revised, autoAdvance]);

  const advance = (id: MockSetupCaseId) => {
    selectCase(id);
    setAutoAdvance(true);
  };

  const selectUseCase = (id: MockUseCaseOptionId) => {
    setUseCaseOverride(id);
    setComposerDraft("");
    setDescription("");
    selectCase("review");
  };

  const showPanel =
    panelOpen &&
    (isReview || caseId === "connections" || isPlan || caseId === "checkout");
  const mobilePanel = isMobile && showPanel;
  const sendDescription = (text: string) => {
    setDescription(text);
    advance("generating");
  };
  const composer = (
    <AgentComposer
      key={`${caseId}-${useCaseId}-${composerDraft}`}
      placeholder={
        composerLocked
          ? isWorking
            ? "Generating examples..."
            : caseId === "starting"
              ? "Saving your approval..."
              : caseId === "connections"
                ? "Connect your accounts now, or choose Connect later."
                : "Choose a plan to finish setup."
          : isComplete
            ? "Message Agent..."
            : isReview
              ? `Tell me what to change about these ${entityPlural}...`
              : "Describe who you want to reach..."
      }
      initialText={
        caseId === "empty" ? MOCK_DESCRIPTIONS[useCaseId] : composerDraft
      }
      disabled={composerLocked}
      onSend={
        isComplete
          ? (text) => {
              setPostSetupMessage(text);
              toast.info("Chat messages aren't sent from this preview.");
            }
          : isReview
            ? (text) => {
                if (
                  text.toLowerCase().replace(/[.!]+$/, "") !==
                  getMockSetupRefinement(useCaseId)
                    .toLowerCase()
                    .replace(/[.!]+$/, "")
                ) {
                  toast.info("This preview uses sample data.", {
                    description:
                      "Use Mock > Try a chat edit to test an update.",
                  });
                  return;
                }
                setFeedback(text);
                setComposerDraft("");
                setRevised(true);
                advance("generating");
              }
            : sendDescription
      }
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden">
      <PageLayout
        className={cn(
          "h-full w-full max-w-none flex-1 basis-0 border-none",
          mobilePanel && "hidden"
        )}
      >
        <PageContent className="h-full p-0">
          <div className="flex h-full min-h-0 flex-col">
            <SetupChatHeader
              setupMenu={
                <>
                  <SetupOnboardingCardMenu
                    onConfirmReset={() => selectCase("empty")}
                    onConfirmDeleteDraft={() => {
                      setDescription("");
                      selectCase("empty");
                    }}
                  />
                </>
              }
            />
            <div className="relative min-h-0 flex-1">
              <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                <MessageScroller className="relative h-full min-h-0">
                  <MessageScrollerViewport>
                    <MessageScrollerContent
                      className={cn(
                        AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME,
                        "gap-0 px-4 pt-4 pb-16",
                        caseId === "empty" &&
                          "flex min-h-full flex-col justify-center"
                      )}
                    >
                      {caseId === "empty" ? (
                        <AgentWorkspaceEmptyState
                          isResolving={false}
                          headline="Who should Agent find?"
                        >
                          {composer}
                        </AgentWorkspaceEmptyState>
                      ) : (
                        <>
                          <MessageScrollerItem
                            messageId="description"
                            className="mb-6"
                          >
                            <UserMessageRow
                              text={description || MOCK_DESCRIPTIONS[useCaseId]}
                            />
                          </MessageScrollerItem>
                          {feedback ? (
                            <MessageScrollerItem
                              messageId="feedback"
                              className="mb-6"
                            >
                              <UserMessageRow text={feedback} />
                            </MessageScrollerItem>
                          ) : null}
                          {isWorking ? (
                            <MessageScrollerItem
                              messageId="generating"
                              className="mb-6"
                            >
                              <AgentMessageRow
                                text={
                                  revised
                                    ? `Updating your example ${entityPlural}.`
                                    : `I'll put together a few example ${entityPlural} for you to review.`
                                }
                              >
                                <InlineProgressCard
                                  title={
                                    revised
                                      ? `Updating example ${entityPlural}`
                                      : `Creating example ${entityPlural}`
                                  }
                                  progress={45}
                                  status="Working..."
                                  headerAction={<MockActivitySpinner />}
                                />
                              </AgentMessageRow>
                            </MessageScrollerItem>
                          ) : null}
                          {isReview ? (
                            <MessageScrollerItem
                              messageId="review"
                              className="mb-6"
                            >
                              <AgentMessageRow
                                text={
                                  revised
                                    ? `Updated. Take a look at the example ${displayedProspects.length === 1 ? entitySingular : entityPlural}, then continue when it looks right.`
                                    : `Review these example ${entityPlural}. Tell me what to change, or continue to finish setup.`
                                }
                              >
                                <InlineProgressCard
                                  title={`Example ${entityPlural}`}
                                  progress={100}
                                  status={`${displayedProspects.length} ${displayedProspects.length === 1 ? entitySingular : entityPlural} ready to review`}
                                  footerAction={
                                    <Button
                                      size="xs"
                                      onClick={() => setPanelOpen(true)}
                                    >
                                      Review
                                    </Button>
                                  }
                                />
                              </AgentMessageRow>
                            </MessageScrollerItem>
                          ) : null}
                          {caseId === "connections" ||
                          isPlan ||
                          caseId === "checkout" ? (
                            <MessageScrollerItem
                              messageId="finish-setup"
                              className="mb-6"
                            >
                              <AgentMessageRow
                                text={
                                  caseId === "connections"
                                    ? "Connect your accounts now, or choose Connect later."
                                    : "Choose your plan to finish setup."
                                }
                              >
                                <InlineProgressCard
                                  title={
                                    caseId === "connections"
                                      ? "Connect accounts"
                                      : "Choose a plan"
                                  }
                                  progress={caseId === "connections" ? 67 : 100}
                                  status={
                                    caseId === "connections"
                                      ? "Step 2 of 3"
                                      : "Step 3 of 3"
                                  }
                                  footerAction={
                                    <Button
                                      size="xs"
                                      onClick={() => setPanelOpen(true)}
                                    >
                                      {caseId === "connections"
                                        ? "Connect accounts"
                                        : "View plans"}
                                    </Button>
                                  }
                                />
                              </AgentMessageRow>
                            </MessageScrollerItem>
                          ) : null}
                          {caseId === "starting" ? (
                            <MessageScrollerItem
                              messageId="saving"
                              className="mb-6"
                            >
                              <AgentMessageRow>
                                <InlineProgressCard
                                  title="Saving your approval"
                                  progress={80}
                                  status="Preparing your workspace..."
                                  headerAction={<MockActivitySpinner />}
                                />
                              </AgentMessageRow>
                            </MessageScrollerItem>
                          ) : null}
                          {caseId === "generation_failed" ? (
                            <MessageScrollerItem
                              messageId="generation-error"
                              className="mb-6"
                            >
                              <AgentMessageRow>
                                <InlineProgressCard
                                  title={`Couldn't generate example ${entityPlural}`}
                                  progress={0}
                                  status={
                                    <span role="alert">
                                      Your description is saved. Try again.
                                    </span>
                                  }
                                  footerAction={
                                    <Button
                                      size="xs"
                                      onClick={() => advance("generating")}
                                    >
                                      Retry
                                    </Button>
                                  }
                                />
                              </AgentMessageRow>
                            </MessageScrollerItem>
                          ) : null}
                          {isComplete ? (
                            <MessageScrollerItem
                              messageId="done"
                              className="mb-6"
                            >
                              <AgentMessageRow text="You can open your workspace while I keep working in the background.">
                                <OnboardingProgressCard
                                  key={caseId}
                                  previewData={{
                                    found: caseId === "results" ? 24 : 0,
                                    twitterProspectsCount:
                                      caseId === "results" ? 10 : 0,
                                    linkedInProspectsCount:
                                      caseId === "results" ? 14 : 0,
                                    qualified: caseId === "results" ? 7 : 0,
                                    enriched: caseId === "results" ? 3 : 0,
                                    plansGenerated:
                                      caseId === "results" ? 1 : 0,
                                    avgQualificationScore:
                                      caseId === "results" ? 86 : 0,
                                    actionableReadyCount:
                                      caseId === "results" ? 3 : 0,
                                    pipelineStartedAt: null,
                                    phase:
                                      caseId === "results"
                                        ? "enriching"
                                        : "searching",
                                  }}
                                  headlineOverride={runningStatusCopy.title}
                                  metaLabelOverride={runningStatusCopy.meta}
                                  timerMode="hidden"
                                  footerMode="action"
                                  footerActionLabel={`View ${entityPlural}`}
                                  onFooterAction={() => router.push("/")}
                                />
                              </AgentMessageRow>
                            </MessageScrollerItem>
                          ) : null}
                          {isComplete && postSetupMessage ? (
                            <MessageScrollerItem
                              messageId="after-setup"
                              className="mb-6"
                            >
                              <UserMessageRow text={postSetupMessage} />
                            </MessageScrollerItem>
                          ) : null}
                        </>
                      )}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                </MessageScroller>
              </MessageScrollerProvider>
            </div>
            {caseId !== "empty" ? (
              <div className="bg-background shrink-0 px-4 pb-4">{composer}</div>
            ) : null}
          </div>
        </PageContent>
      </PageLayout>

      {showPanel ? (
        <MockOnboardingPanelShell
          title={
            caseId === "connections"
              ? "Connect accounts"
              : isPlan || caseId === "checkout"
                ? "Choose a plan"
                : `Example ${entityPlural}`
          }
          stepNumber={
            caseId === "connections"
              ? 2
              : isPlan || caseId === "checkout"
                ? 3
                : 1
          }
          stepTotal={3}
          onBack={() => setPanelOpen(false)}
          className={mobilePanel ? "max-w-none border-l-0" : undefined}
        >
          {caseId === "connections" ? (
            <MockConnectionsStep onComplete={() => selectCase("plan")} />
          ) : (
            <>
              <ScrollArea className="min-h-0 flex-1">
                <section className="space-y-4 px-4 py-4">
                  {isReview ? (
                    <>
                      <p className="text-muted-foreground text-sm text-pretty">
                        These are{" "}
                        <span className="text-foreground">
                          example {entityPlural}
                        </span>{" "}
                        generated by the Agent to steer it in the{" "}
                        <span className="text-foreground">right direction</span>
                        .{" "}
                        <span className="text-foreground">
                          Continue if these look right.
                        </span>
                      </p>
                      <div className="flex flex-col gap-3">
                        {displayedProspects.map((prospect) => (
                          <ProspectCard
                            key={prospect.exampleKey}
                            prospect={prospect}
                            interactive={false}
                            showMenu={false}
                            mode="ui_preview"
                            entityLabel={labels.entitySingular}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                  {caseId === "checkout_failed" ? (
                    <p role="alert" className="text-destructive text-sm">
                      Checkout wasn't completed. Choose a plan to try again.
                    </p>
                  ) : null}
                  {caseId === "checkout" ? (
                    <p role="status" className="text-muted-foreground text-sm">
                      Waiting for payment confirmation...
                    </p>
                  ) : null}
                  {isPlan ? (
                    <PlanStep
                      onUpgradePaid={() => advance("checkout")}
                      entityPlural={labels.entityPlural}
                    />
                  ) : null}
                </section>
              </ScrollArea>
              {isReview ? (
                <footer className="bg-background shrink-0 border-t px-4 py-2">
                  {caseId === "start_failed" ? (
                    <p role="alert" className="text-destructive mb-2 text-sm">
                      Your approval couldn't be saved. Please try again.
                    </p>
                  ) : null}
                  <div className="flex w-full min-w-0 items-center justify-end gap-2">
                    <Button
                      type="button"
                      size="xs"
                      className="w-full"
                      onClick={() => advance("starting")}
                    >
                      Continue
                    </Button>
                  </div>
                </footer>
              ) : null}
            </>
          )}
        </MockOnboardingPanelShell>
      ) : null}
      <CaseSwitcher
        activeCase={caseId}
        activeUseCase={useCaseId}
        onCaseChange={selectCase}
        onUseCaseChange={selectUseCase}
        onTryEdit={() => {
          selectCase("review");
          setPanelOpen(false);
          setComposerDraft(getMockSetupRefinement(useCaseId));
        }}
      />
    </div>
  );
}
