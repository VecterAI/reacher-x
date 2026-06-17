"use client";

/**
 * AgentChat - Main agent chat interface with streaming support
 *
 * Per docs: https://docs.convex.dev/agents/streaming#text-smoothing-with-smoothtext-and-usesmoothtext
 * Uses useSmoothText from @convex-dev/agent/react for smooth streaming text.
 */

import {
  useAgentChat,
  type PendingTurnState,
  type UIMessage,
} from "../hooks/useAgentChat";
import { useSmoothText } from "@convex-dev/agent/react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  extractAssistantReasoning,
  extractAssistantReasoningSteps,
  extractAssistantReasoningSummary,
  extractAssistantSources,
  getAssistantMessageModel,
  getToolNameFromPart,
  hasRedactedReasoning,
  isToolPart,
  type InlinePanelOpenPayload,
  type ToolPartLike,
} from "../lib";
import { getUIMessageDisplayText } from "../lib/uiMessageText";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/shared/ui/components/ChatContainer";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/shared/ui/components/PromptInput";
import { ThinkingBar } from "@/shared/ui/components/ThinkingBar";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/shared/ui/components/Message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/shared/ui/components/Reasoning";
import {
  Steps,
  StepsTrigger,
  StepsContent,
  StepsItem,
} from "@/shared/ui/components/Steps";
import {
  Source,
  SourceTrigger,
  SourceContent,
} from "@/shared/ui/components/Source";
import { ScrollButton } from "@/shared/ui/components/ScrollButton";
import { SystemMessage } from "@/shared/ui/components/SystemMessage";
import { Tool, type ToolPart } from "@/shared/ui/components/Tool";
import { AgentArtifactRenderer } from "@/shared/ui/components/json-render";
import { getAgentArtifactFromResult } from "@/shared/lib/json-render/agentArtifacts";
import { logger } from "@/shared/lib/logger";
import { AgentProspectEmptyState } from "./components/AgentProspectEmptyState";
import { OutreachPlanCard } from "@/features/prospects/ui/components/outreach-plan";
import { Button, buttonVariants } from "@/shared/ui/components/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";
import {
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from "lucide-react";
import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  startTransition,
} from "react";
import { useStore } from "@nanostores/react";
import { getProspectDisplayData } from "@/features/prospects/lib/getProspectDisplayData";
import { useProspectDmState } from "@/features/prospects/hooks/useProspectDmState";
import { $onboardingLock } from "@/shared/stores/onboarding";
import {
  ArrowUpwardIcon,
  AttachFileIcon,
  StopIcon,
  AddIcon,
  SearchActivityIcon,
  ArrowBackIcon,
  RefreshIcon,
  MoreHorizIcon,
  MailIcon,
  PersonIcon,
} from "@/shared/ui/components/icons";

const agentChatUiLogger = logger.withScope("AgentChat");
import { Avatar, AvatarFallback } from "@/shared/ui/components/Avatar";
import {
  usePreferredShellQueryArgs,
  useQueryWithStatus,
  useSetupThreadDraft,
} from "@/shared/hooks";
import { getSetupPanelStepTitle } from "@/features/agent/lib/setupOnboardingStepTitles";
import { SetupOnboardingInlineCard } from "./components/SetupOnboardingInlineCard";
import { WorkspacePlanLimitAlert } from "@/features/billing/ui/components/WorkspacePlanLimitAlert";
import { motion, AnimatePresence } from "motion/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";

// ============================================================================
// Types
// ============================================================================

interface ToolCallInfo {
  toolName: string;
  // States: call/partial-call (in progress), result (completed - convex-agent)
  // AI SDK also uses: input-available, output-available, output-error
  state:
    | "call"
    | "result"
    | "partial-call"
    | "input-available"
    | "output-available"
    | "output-error";
  args?: Record<string, unknown>;
  result?: unknown;
  toolCallId?: string;
  errorText?: string;
}

type MessagePart = NonNullable<UIMessage["parts"]>[number];
type ToolMessagePart = MessagePart & ToolPartLike;

interface ProgressStep {
  step: string;
  status: "pending" | "running" | "completed" | "failed";
  details?: string;
  count?: number;
}

const EMPTY_UI_MESSAGES: UIMessage[] = [];

function buildStableKey(base: string, sequence: Map<string, number>) {
  const nextCount = (sequence.get(base) ?? 0) + 1;
  sequence.set(base, nextCount);
  return `${base}-${nextCount}`;
}

function getProgressStatusIcon(status: ProgressStep["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    default:
      return <Circle className="text-muted-foreground h-4 w-4" />;
  }
}

const TOOL_LABELS: Record<string, string> = {
  analyzeUrl: "Analyzing website",
  generateImprovedDescriptionAndICPs: "Generating ICPs",
  getUserStatus: "Checking account",
  createWorkspace: "Creating workspace",
  updateWorkspace: "Updating workspace",
  searchProspects: "Finding prospects",
  generateSeedKeywords: "Generating keywords",
  convertToSocialQueries: "Converting to social queries",
  getSocialContext: "Fetching social context",
  displayEntity: "Showing entity",
  socialAction: "Taking social action",
};

const AGENT_DISPLAY_NAME = "△ Agent";
const AGENT_AVATAR_FALLBACK = "△";

export interface AgentChatProps {
  /** Prospect ID for context (from URL) */
  prospectId?: string;
  /** Thread ID to load (from URL) */
  threadId?: string;
  /** Action mode: "generatePlan" for plan generation */
  action?: string;
  /** Notification ID to mark seen (from URL) */
  notificationId?: string;
  /** Handler for back button click */
  onBack?: () => void;
  /** Handler for History button click */
  onHistoryClick?: () => void;
  /** Handler for New thread button click */
  onNewThread?: () => void;
  /** Incremented when the parent wants to force a fresh local thread. */
  newThreadSignal?: number;
  /** Callback when effective thread ID changes (resolved from URL or internal state) */
  onEffectiveThreadIdChange?: (threadId: string | null) => void;
  /** Open dynamic panel from inline card */
  onOpenPanelFromCard?: (payload: InlinePanelOpenPayload) => void;
  /** Open the current prospect's plan panel */
  onOpenPlanPanel?: () => void;
  /** Open the current prospect profile */
  onViewProfile?: () => void;
  /** Open the current prospect's platform conversation panel */
  onOpenDmPanel?: (platform?: "twitter" | "linkedin") => void;
  /** Setup route: open the onboarding side panel (e.g. from inline card Continue) */
  onOpenSetupOnboardingPanel?: () => void;
  /**
   * When set (e.g. from AgentPageShell), AgentChat does not subscribe to `getProspect` — avoids duplicate subscriptions.
   */
  shellProspectQuery?: {
    data: Doc<"prospects"> | null | undefined;
    isPending: boolean;
  };
}

// ============================================================================
// Progress Steps Component (for searchProspects and similar tools)
// ============================================================================

function ProgressStepsDisplay({ progress }: { progress: ProgressStep[] }) {
  if (!progress.length) return null;

  return (
    <div className="bg-muted/30 rounded-lg border p-3">
      <div className="space-y-2">
        {progress.map((step) => (
          <div
            key={`${step.step}-${step.status}-${step.count ?? "none"}-${step.details ?? "none"}`}
            className="flex items-start gap-2"
          >
            <div className="mt-0.5 shrink-0">
              {getProgressStatusIcon(step.status)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    step.status === "completed" &&
                      "text-green-700 dark:text-green-400",
                    step.status === "failed" &&
                      "text-red-700 dark:text-red-400",
                    step.status === "running" &&
                      "text-blue-700 dark:text-blue-400"
                  )}
                >
                  {step.step}
                </span>
                {step.count !== undefined && step.count > 0 && (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                    {step.count}
                  </span>
                )}
              </div>
              {step.details && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {step.details}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Tool Call Visualization Component
// ============================================================================

function ArtifactToolResult({
  artifact,
  onOpenPanelFromCard,
  onOpenPlanPanel,
  onApprovePlan,
}: {
  artifact: NonNullable<ReturnType<typeof getAgentArtifactFromResult>>;
  onOpenPanelFromCard?: (payload: InlinePanelOpenPayload) => void;
  onOpenPlanPanel?: () => void;
  onApprovePlan: (planId: string) => void;
}) {
  return (
    <AgentArtifactRenderer
      artifact={artifact}
      onOpenPanel={onOpenPanelFromCard}
      onOpenPlanPanel={onOpenPlanPanel}
      onApprovePlan={onApprovePlan}
    />
  );
}

function ToolCallVisualization({
  toolCalls,
  onOpenPanelFromCard,
  onOpenPlanPanel,
}: {
  toolCalls: ToolCallInfo[];
  onOpenPanelFromCard?: (payload: InlinePanelOpenPayload) => void;
  onOpenPlanPanel?: () => void;
}) {
  const approvePlan = useMutation(api.outreach.approvePlan);

  if (!toolCalls.length) return null;

  const renderedToolCallNodes = toolCalls.map((tc, idx) => {
    // Check if this tool result has a progress array (e.g., searchProspects)
    const result = tc.result as Record<string, unknown> | undefined;
    const hasProgress =
      result && Array.isArray(result.progress) && result.progress.length > 0;

    // Handle both Convex Agent states ("result") and AI SDK states ("output-available")
    const isToolComplete =
      tc.state === "result" || tc.state === "output-available";
    const artifact =
      isToolComplete && result ? getAgentArtifactFromResult(result) : null;
    if (artifact) {
      return (
        <ArtifactToolResult
          key={`${tc.toolName}-${idx}`}
          artifact={artifact}
          onOpenPanelFromCard={onOpenPanelFromCard}
          onOpenPlanPanel={onOpenPlanPanel}
          onApprovePlan={(planId: string) => {
            void approvePlan({ planId: planId as Id<"outreachPlans"> });
          }}
        />
      );
    }

    if (
      isToolComplete &&
      result &&
      typeof result.plan === "object" &&
      result.plan !== null &&
      Array.isArray(result.tasks)
    ) {
      const plan = result.plan as {
        id?: string;
        status?: string;
        strategy?: { rationale?: string };
      };
      const tasks = (result.tasks as Array<Record<string, unknown>>).map(
        (task, taskIndex) => {
          const resolvedId =
            typeof task.id === "string"
              ? task.id
              : typeof task._id === "string"
                ? task._id
                : `plan-task-${idx}-${taskIndex}`;

          return {
            _id: resolvedId,
            order: typeof task.order === "number" ? task.order : taskIndex + 1,
            type: typeof task.type === "string" ? task.type : "comment",
            description:
              typeof task.description === "string" ? task.description : "",
            status: typeof task.status === "string" ? task.status : "pending",
            content:
              typeof task.content === "string" ? task.content : undefined,
            targetTweetId:
              typeof task.targetTweetId === "string"
                ? task.targetTweetId
                : undefined,
          };
        }
      );

      if (
        typeof plan.status === "string" &&
        typeof plan.strategy?.rationale === "string"
      ) {
        const planId = typeof plan.id === "string" ? plan.id : undefined;
        return (
          <OutreachPlanCard
            key={`${tc.toolName}-${idx}`}
            variant="preview"
            status={plan.status}
            rationale={plan.strategy.rationale}
            tasks={tasks}
            onApprove={
              plan.status === "draft" && planId
                ? () => {
                    void approvePlan({
                      planId: planId as Id<"outreachPlans">,
                    });
                  }
                : undefined
            }
            footerAction={
              onOpenPlanPanel
                ? {
                    label: "Show plan",
                    onClick: onOpenPlanPanel,
                  }
                : undefined
            }
          />
        );
      }
    }

    // If tool has progress steps, show the progress display instead of raw Tool
    if (hasProgress && tc.state === "result") {
      return (
        <div key={`${tc.toolName}-${idx}`} className="space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="font-medium">
              {TOOL_LABELS[tc.toolName] || tc.toolName}
            </span>
          </div>
          <ProgressStepsDisplay progress={result.progress as ProgressStep[]} />
          {/* Show results summary if available */}
          {result.results != null &&
            typeof result.results === "object" &&
            "totalProspects" in result.results && (
              <div className="text-muted-foreground mt-2 text-xs">
                Found{" "}
                {(result.results as { totalProspects?: number })
                  .totalProspects ?? 0}{" "}
                prospects
              </div>
            )}
        </div>
      );
    }

    // Default: show the Tool component
    const toolPart: ToolPart = {
      type: TOOL_LABELS[tc.toolName] || tc.toolName,
      state:
        tc.state === "call" || tc.state === "partial-call"
          ? "input-streaming"
          : tc.state === "output-error"
            ? "output-error"
            : tc.result
              ? "output-available"
              : "input-available",
      input: tc.args,
      output: tc.result as Record<string, unknown> | undefined,
      toolCallId: tc.toolCallId,
      errorText: tc.errorText,
    };

    return <Tool key={`${tc.toolName}-${idx}`} toolPart={toolPart} />;
  });

  if (renderedToolCallNodes.every((node) => node === null)) {
    return null;
  }

  return <div className="space-y-2">{renderedToolCallNodes}</div>;
}

function getPendingTurnLabel(pendingTurn: PendingTurnState): string {
  switch (pendingTurn.phase) {
    case "submitting":
      return "Sending message";
    case "stopping":
      return "Stopping";
    default:
      return pendingTurn.assistantLabel || "Deep reasoning in progress";
  }
}

function PendingAssistantMessage({
  pendingTurn,
  onStop,
}: {
  pendingTurn: PendingTurnState;
  onStop: () => void;
}) {
  return (
    <Message className="items-start">
      <MessageAvatar
        alt="Agent"
        fallback={AGENT_AVATAR_FALLBACK}
        className="bg-background text-foreground"
        avatarClassName="rounded-md"
      />
      <div className="flex max-w-[85%] flex-col gap-2 pt-1">
        <ThinkingBar
          text={getPendingTurnLabel(pendingTurn)}
          onStop={pendingTurn.phase === "stopping" ? undefined : onStop}
          stopLabel="Skip thinking"
        />
      </div>
    </Message>
  );
}

function LocalUserMessage({
  text,
  userImage,
  userName,
}: {
  text: string;
  userImage?: string;
  userName?: string;
}) {
  return (
    <Message className="flex-row-reverse items-start">
      <MessageAvatar
        src={userImage}
        alt="You"
        fallback={getUserInitials(userName)}
        className="bg-primary text-primary-foreground"
      />
      <div className="flex max-w-[80%] flex-col items-end gap-1">
        <MessageContent
          className="bg-primary text-primary-foreground"
          textSize="sm"
        >
          {text}
        </MessageContent>
      </div>
    </Message>
  );
}

function ReasoningSection({
  message,
  isStreaming,
}: {
  message: UIMessage;
  isStreaming: boolean;
}) {
  const reasoning = extractAssistantReasoning(message);
  const summary = extractAssistantReasoningSummary(message);
  const steps = extractAssistantReasoningSteps(message);
  const redacted = hasRedactedReasoning(message);

  if (!reasoning && !redacted) {
    return null;
  }

  return (
    <Reasoning isStreaming={isStreaming} className="mt-1">
      <ReasoningTrigger className="text-xs font-medium">
        {isStreaming ? "Thinking" : "Analysis"}
      </ReasoningTrigger>
      <ReasoningContent
        className="mt-2"
        contentClassName="prose-invert:inherit"
      >
        <div className="space-y-3 text-sm">
          {summary && <p className="text-foreground">{summary}</p>}
          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((step, index) => (
                <Steps key={`${index}-${step}`}>
                  <StepsTrigger
                    leftIcon={
                      isStreaming ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="text-muted-foreground size-3.5" />
                      )
                    }
                  >
                    Thinking
                  </StepsTrigger>
                  <StepsContent>
                    <StepsItem>{step}</StepsItem>
                  </StepsContent>
                </Steps>
              ))}
            </div>
          )}
          {!steps.length && reasoning && summary !== reasoning && (
            <MessageContent markdown variant="plain" textSize="sm">
              {reasoning}
            </MessageContent>
          )}
          {redacted && !reasoning && (
            <p className="text-muted-foreground">
              Detailed reasoning is unavailable for this response.
            </p>
          )}
        </div>
      </ReasoningContent>
    </Reasoning>
  );
}

function SourceChips({ message }: { message: UIMessage }) {
  const sources = extractAssistantSources(message);

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <Source key={`${source.id}-${source.href}`} href={source.href}>
          <SourceTrigger label={source.label} showFavicon />
          <SourceContent
            title={source.title}
            description={source.description}
          />
        </Source>
      ))}
    </div>
  );
}

// ============================================================================
// Message Renderer with Streaming Support
// ============================================================================

/**
 * Helper to get user initials from name
 */
function getUserInitials(name?: string): string {
  if (!name) return "U";
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

/**
 * Copy button component with feedback
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      agentChatUiLogger.error("Failed to copy message text", err);
    }
  }, [text]);

  return (
    <MessageAction tooltip={copied ? "Copied!" : "Copy"}>
      <Button
        variant="ghost"
        size="xsIcon"
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </MessageAction>
  );
}

function AssistantModelBadge({ model }: { model: string }) {
  return (
    <span className="text-muted-foreground font-mono text-xs" title={model}>
      ·&nbsp;{model}
    </span>
  );
}

/**
 * Per docs: https://docs.convex.dev/agents/streaming#text-smoothing-with-smoothtext-and-usesmoothtext
 * Use useSmoothText hook for smooth streaming text display.
 */
function ChatMessage({
  message,
  userImage,
  userName,
  threadModelName,
  onOpenPanelFromCard,
  onOpenPlanPanel,
}: {
  message: UIMessage;
  userImage?: string;
  userName?: string;
  threadModelName?: string | null;
  onOpenPanelFromCard?: (payload: InlinePanelOpenPayload) => void;
  onOpenPlanPanel?: () => void;
}) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isStreaming = message.status === "streaming";
  const messageText = getUIMessageDisplayText(message);

  // Per docs: useSmoothText smooths text as it streams
  // Pass startStreaming: true when message is actively streaming
  // IMPORTANT: Hook must be called unconditionally (Rules of Hooks)
  const [visibleText] = useSmoothText(messageText, {
    startStreaming: isStreaming,
  });

  // Early return AFTER hook call to satisfy Rules of Hooks
  if (!isUser && !isAssistant) return null;

  const displayText = visibleText;
  const assistantModel = isAssistant
    ? (getAssistantMessageModel(message) ?? threadModelName ?? null)
    : null;
  const assistantReasoning = isAssistant
    ? extractAssistantReasoning(message)
    : null;
  const assistantSources = isAssistant ? extractAssistantSources(message) : [];
  const hasAssistantMetadata =
    Boolean(assistantReasoning) || assistantSources.length > 0;
  const partKeySequence = new Map<string, number>();

  // Extract tool calls from message parts for streaming fallback
  const toolCalls: ToolCallInfo[] = [];
  const seenToolCallIds = new Set<string>();
  const toolParts = (message.parts || []).filter(
    (part): part is ToolMessagePart => isToolPart(part)
  );

  for (const part of toolParts) {
    const toolCallId = part.toolCallId;
    if (toolCallId && seenToolCallIds.has(toolCallId)) continue;
    if (toolCallId) seenToolCallIds.add(toolCallId);

    const toolName = getToolNameFromPart(part);
    toolCalls.push({
      toolName,
      state: (part.state as ToolCallInfo["state"]) || "result",
      args: part.input as Record<string, unknown> | undefined,
      result: part.output as Record<string, unknown> | undefined,
      toolCallId,
      errorText:
        typeof part.errorText === "string" ? part.errorText : undefined,
    });
  }

  const failedStateMessage =
    isAssistant &&
    message.status === "failed" &&
    !displayText &&
    !toolCalls.length
      ? "That response couldn't be completed."
      : "";

  // Don't render empty messages unless streaming or there is rich metadata.
  if (
    !displayText &&
    !failedStateMessage &&
    !isStreaming &&
    !toolCalls.length &&
    !hasAssistantMetadata
  )
    return null;

  if (isUser) {
    return (
      <Message className="flex-row-reverse items-start">
        <MessageAvatar
          src={userImage}
          alt="You"
          fallback={getUserInitials(userName)}
          className="bg-primary text-primary-foreground"
        />
        <div className="flex max-w-[80%] flex-col items-end gap-1">
          <MessageContent
            className="bg-primary text-primary-foreground"
            textSize="sm"
          >
            {displayText}
          </MessageContent>
          {displayText && (
            <MessageActions>
              <CopyButton text={displayText} />
            </MessageActions>
          )}
        </div>
      </Message>
    );
  }

  // For completed messages, render parts in their natural order so that
  // text and tool-call cards interleave correctly (the card appears right
  // where the agent placed the displayEntity call, not before/after all text).
  // For streaming messages, use smooth text as a single block.
  const usePartsOrder =
    !isStreaming && message.parts && message.parts.length > 0;

  // Assistant message
  return (
    <Message className="items-start">
      <MessageAvatar
        alt="Agent"
        fallback={AGENT_AVATAR_FALLBACK}
        className="bg-background text-foreground"
        avatarClassName="rounded-md"
      />
      <div className="flex max-w-[85%] flex-col gap-2">
        {(assistantReasoning || hasRedactedReasoning(message)) && (
          <ReasoningSection message={message} isStreaming={isStreaming} />
        )}

        {usePartsOrder ? (
          (() => {
            const dedup = new Set<string>();
            return message.parts!.map((part) => {
              // Text parts
              if ((part as { type: string }).type === "text") {
                const text = (part as { text?: string }).text;
                if (!text?.trim()) return null;
                return (
                  <MessageContent
                    key={buildStableKey(`text-${text}`, partKeySequence)}
                    markdown
                    variant="plain"
                    textSize="sm"
                  >
                    {text}
                  </MessageContent>
                );
              }

              // Tool parts
              if (isToolPart(part)) {
                const tp = part as ToolMessagePart;
                const toolCallId = tp.toolCallId;
                if (toolCallId && dedup.has(toolCallId)) return null;
                if (toolCallId) dedup.add(toolCallId);

                const toolName = getToolNameFromPart(tp);
                const tc: ToolCallInfo = {
                  toolName,
                  state: (tp.state as ToolCallInfo["state"]) || "result",
                  args: tp.input as Record<string, unknown> | undefined,
                  result: tp.output as Record<string, unknown> | undefined,
                  toolCallId,
                };

                return (
                  <motion.div
                    key={
                      toolCallId
                        ? `tool-${toolCallId}`
                        : buildStableKey(
                            `tool-${toolName}-${tc.state}`,
                            partKeySequence
                          )
                    }
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ToolCallVisualization
                      toolCalls={[tc]}
                      onOpenPanelFromCard={onOpenPanelFromCard}
                      onOpenPlanPanel={onOpenPlanPanel}
                    />
                  </motion.div>
                );
              }

              return null;
            });
          })()
        ) : (
          <>
            {/* Streaming fallback: all tools then smooth text */}
            {toolCalls.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <ToolCallVisualization
                  toolCalls={toolCalls}
                  onOpenPanelFromCard={onOpenPanelFromCard}
                  onOpenPlanPanel={onOpenPlanPanel}
                />
              </motion.div>
            )}

            {(displayText || failedStateMessage || isStreaming) && (
              <MessageContent
                markdown
                variant="plain"
                textSize="sm"
                className={cn(
                  isStreaming &&
                    !displayText &&
                    !failedStateMessage &&
                    !hasAssistantMetadata &&
                    "animate-pulse"
                )}
              >
                {displayText || failedStateMessage || " "}
              </MessageContent>
            )}

            {isStreaming && displayText && (
              <motion.span
                className="bg-foreground/50 ml-1 inline-block h-4 w-1"
                animate={{ opacity: [1, 0] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}
          </>
        )}

        {assistantSources.length > 0 && <SourceChips message={message} />}

        {/* Copy action for assistant messages */}
        {displayText && !isStreaming && (
          <MessageActions>
            <CopyButton text={displayText} />
            {assistantModel && <AssistantModelBadge model={assistantModel} />}
          </MessageActions>
        )}

        {/* Error indicator */}
        {message.status === "failed" &&
          (displayText || toolCalls.length > 0 || hasAssistantMetadata) && (
            <SystemMessage variant="error" className="mt-1">
              That response couldn&apos;t be completed. Please try again.
            </SystemMessage>
          )}
      </div>
    </Message>
  );
}

// ============================================================================
// Chat Header Component
// ============================================================================

interface ChatHeaderProps {
  onBack?: () => void;
  onHistoryClick?: () => void;
  onNewThread?: () => void;
  /** Whether workspace setup is complete - buttons disabled if false */
  isSetupComplete?: boolean;
  /** When the open prospect is archived, New thread is disabled; History stays available. */
  prospectArchived?: boolean;
  onViewProfile?: () => void;
  onOpenDmPanel?: (platform?: "twitter" | "linkedin") => void;
  dmEligibility?: {
    enabled: boolean;
    reasonLabel: string;
  } | null;
  dmPlatform?: "twitter" | "linkedin" | null;
  isBusy?: boolean;
}

function ChatHeader({
  onBack,
  onHistoryClick,
  onNewThread,
  isSetupComplete = false,
  prospectArchived = false,
  onViewProfile,
  onOpenDmPanel,
  dmEligibility,
  dmPlatform,
  isBusy = false,
}: ChatHeaderProps) {
  const showButtons = onHistoryClick !== undefined;
  const setupIncomplete = !isSetupComplete;
  const newThreadDisabled = setupIncomplete || prospectArchived;
  const resolvedDmPlatform = dmPlatform === "linkedin" ? "linkedin" : "twitter";

  return (
    <header className="bg-background sticky top-0 right-0 left-0 z-10 flex h-10 shrink-0 items-center justify-between border-b py-2 pr-4 pl-2.5">
      <div className="flex items-center gap-1">
        {onBack && (
          <Button
            variant="ghost"
            size="xsIcon"
            onClick={onBack}
            disabled={setupIncomplete}
            aria-label="Go back"
          >
            <ArrowBackIcon className="fill-current" />
          </Button>
        )}
        <h1 className="text-sm font-medium">{AGENT_DISPLAY_NAME}</h1>
      </div>
      {showButtons && (
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                aria-disabled={setupIncomplete}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "xs" }),
                  setupIncomplete && "opacity-50"
                )}
                onClick={setupIncomplete ? undefined : onHistoryClick}
                type="button"
              >
                <SearchActivityIcon className="fill-current" />
                History
              </TooltipTrigger>
              {setupIncomplete && (
                <TooltipContent>Complete workspace setup first</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {onNewThread && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  aria-disabled={newThreadDisabled}
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "xs" }),
                    newThreadDisabled && "opacity-50"
                  )}
                  onClick={newThreadDisabled ? undefined : onNewThread}
                  type="button"
                >
                  <AddIcon className="fill-current" />
                  New
                </TooltipTrigger>
                {newThreadDisabled && (
                  <TooltipContent>
                    {setupIncomplete
                      ? "Complete workspace setup first"
                      : "Unarchive this profile to start a new thread"}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          {onViewProfile || (onOpenDmPanel && dmEligibility) ? (
            isBusy ? (
              <Button
                variant="outline"
                size="xsIcon"
                aria-label="Agent menu"
                disabled
              >
                <MoreHorizIcon className="fill-muted-foreground" />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Agent menu"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "xsIcon" })
                  )}
                  type="button"
                >
                  <MoreHorizIcon className="fill-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {onViewProfile && (
                    <DropdownMenuItem onClick={onViewProfile}>
                      <PersonIcon className="fill-current" aria-hidden />
                      View profile
                    </DropdownMenuItem>
                  )}
                  {onOpenDmPanel && dmEligibility && (
                    <DropdownMenuItem
                      disabled={!dmEligibility.enabled}
                      onClick={
                        dmEligibility.enabled
                          ? () => onOpenDmPanel(resolvedDmPlatform)
                          : undefined
                      }
                      title={
                        !dmEligibility.enabled
                          ? dmEligibility.reasonLabel
                          : undefined
                      }
                    >
                      <MailIcon className="fill-current" aria-hidden />
                      {resolvedDmPlatform === "linkedin"
                        ? "Message on LinkedIn"
                        : "DM on X/Twitter"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          ) : null}
        </div>
      )}
    </header>
  );
}

// ============================================================================
// Chat Skeleton Loading Component
// ============================================================================

/**
 * Skeleton loading UI that mimics the chat layout to prevent CLS.
 * Uses the same ChatContainer components to ensure consistent scroll behavior.
 * Matches real UI: avatars, border radii, and text line styling.
 * Receives header props to render buttons matching the loaded state, preventing layout shift.
 */
function ChatSkeleton({
  onBack,
  onHistoryClick,
  onNewThread,
  onOpenDmPanel,
}: Pick<
  AgentChatProps,
  "onBack" | "onHistoryClick" | "onNewThread" | "onOpenDmPanel"
>) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header - renders same buttons as loaded state to prevent CLS */}
      <ChatHeader
        onBack={onBack}
        onHistoryClick={onHistoryClick}
        onNewThread={onNewThread}
        onOpenDmPanel={onOpenDmPanel}
        isSetupComplete={false}
      />

      {/* Skeleton messages area - uses same container structure for consistent scroll */}
      <ChatContainerRoot className="min-h-0 flex-1">
        <ChatContainerContent className="px-4 py-4">
          <div className="space-y-6">
            {/* Skeleton assistant message 1 - welcome/intro */}
            <div className="flex items-start gap-3">
              {/* Agent avatar - rounded-md like real UI */}
              <Skeleton className="size-6 shrink-0 rounded-md" />
              <div className="flex max-w-[85%] flex-col gap-2">
                <Skeleton className="h-4 w-72 rounded-sm" />
                <Skeleton className="h-4 w-56 rounded-sm" />
                <Skeleton className="h-4 w-64 rounded-sm" />
              </div>
            </div>

            {/* Skeleton user message 1 */}
            <div className="flex flex-row-reverse items-start gap-3">
              {/* User avatar - rounded-full like real UI */}
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-10 w-48 rounded-lg" />
              </div>
            </div>

            {/* Skeleton assistant message 2 - analyzing */}
            <div className="flex items-start gap-3">
              <Skeleton className="size-6 shrink-0 rounded-md" />
              <div className="flex max-w-[85%] flex-col gap-2">
                <Skeleton className="h-4 w-64 rounded-sm" />
                <Skeleton className="h-4 w-80 rounded-sm" />
                <Skeleton className="h-4 w-72 rounded-sm" />
                <Skeleton className="h-4 w-56 rounded-sm" />
              </div>
            </div>

            {/* Skeleton user message 2 */}
            <div className="flex flex-row-reverse items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-10 w-36 rounded-lg" />
              </div>
            </div>

            {/* Skeleton assistant message 3 - longer response with list-like content */}
            <div className="flex items-start gap-3">
              <Skeleton className="size-6 shrink-0 rounded-md" />
              <div className="flex max-w-[85%] flex-col gap-2">
                <Skeleton className="h-4 w-80 rounded-sm" />
                <Skeleton className="h-4 w-64 rounded-sm" />
                <div className="mt-2 space-y-2 pl-4">
                  <Skeleton className="h-4 w-56 rounded-sm" />
                  <Skeleton className="h-4 w-48 rounded-sm" />
                  <Skeleton className="h-4 w-52 rounded-sm" />
                </div>
                <Skeleton className="mt-2 h-4 w-72 rounded-sm" />
                <Skeleton className="h-4 w-60 rounded-sm" />
              </div>
            </div>

            {/* Skeleton user message 3 */}
            <div className="flex flex-row-reverse items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-10 w-52 rounded-lg" />
              </div>
            </div>

            {/* Skeleton assistant message 4 - final response */}
            <div className="flex items-start gap-3">
              <Skeleton className="size-6 shrink-0 rounded-md" />
              <div className="flex max-w-[85%] flex-col gap-2">
                <Skeleton className="h-4 w-72 rounded-sm" />
                <Skeleton className="h-4 w-80 rounded-sm" />
                <Skeleton className="h-4 w-64 rounded-sm" />
              </div>
            </div>
          </div>

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Skeleton input area - matches actual input structure */}
      <div className="bg-background shrink-0 px-4 pt-3 pb-4 backdrop-blur-xl">
        {/* Skeleton suggestions */}
        <div className="flex gap-2 pb-2">
          <Skeleton className="h-7 w-32 rounded-md" />
          <Skeleton className="h-7 w-40 rounded-md" />
        </div>
        {/* Skeleton prompt input - rounded-xl to match PromptInput */}
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentChat({
  prospectId,
  threadId,
  action,
  notificationId: _notificationId,
  onBack,
  onHistoryClick,
  onNewThread,
  newThreadSignal,
  onEffectiveThreadIdChange,
  onOpenPanelFromCard,
  onOpenPlanPanel,
  onViewProfile,
  onOpenDmPanel,
  onOpenSetupOnboardingPanel,
  shellProspectQuery,
}: AgentChatProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Get WorkOS auth user for profile image (same as Header)
  const { user: authUser } = useAuth();

  const {
    messages,
    messageStatus,
    input,
    isLoading,
    isStreaming,
    error,
    pendingTurn,
    isInitialized,
    generatedThreadId,
    threadId: effectiveThreadId,
    setInput,
    sendMessage,
    stop,
    loadMore,
    hasMore,
  } = useAgentChat({
    threadId: threadId ?? null,
    prospectId: prospectId ?? null,
    action: action ?? null,
    newThreadSignal,
  });

  const rawDisplayMessages = useMemo(
    () => messages.filter((m) => m.key !== "welcome-message"),
    [messages]
  );
  const shouldHidePersistedTranscript =
    !effectiveThreadId || messageStatus === "LoadingFirstPage";
  const displayMessages = shouldHidePersistedTranscript
    ? EMPTY_UI_MESSAGES
    : rawDisplayMessages;

  const hasMaterializedAssistantReply = useMemo(
    () =>
      displayMessages.some(
        (m) =>
          m.role === "assistant" &&
          m.status !== "streaming" &&
          m.status !== "pending"
      ),
    [displayMessages]
  );

  const pendingUserPrompt =
    pendingTurn?.showUserPrompt && pendingTurn.prompt
      ? pendingTurn.prompt
      : null;
  const hasPersistedPendingUserMessage =
    pendingTurn !== null &&
    pendingUserPrompt !== null &&
    displayMessages.some((message) =>
      message.role !== "user"
        ? false
        : pendingTurn.order !== null
          ? message.order === pendingTurn.order &&
            getUIMessageDisplayText(message) === pendingUserPrompt
          : getUIMessageDisplayText(message) === pendingUserPrompt
    );
  const shouldShowPendingUserMessage =
    pendingUserPrompt !== null && !hasPersistedPendingUserMessage;
  const shouldShowPendingAssistantRow =
    pendingTurn !== null &&
    (pendingTurn.phase === "submitting" ||
      pendingTurn.phase === "queued" ||
      pendingTurn.phase === "stopping");
  const shouldShowPendingError = pendingTurn?.phase === "failed";
  const shouldShowHydrationSkeleton =
    Boolean(effectiveThreadId) &&
    messageStatus === "LoadingFirstPage" &&
    pendingTurn === null &&
    !error;

  const threadModelName = useQuery(
    api.agentTelemetry.getThreadModelName,
    effectiveThreadId ? { threadId: effectiveThreadId } : "skip"
  );

  const internalProspectQuery = useQueryWithStatus(
    api.prospects.getProspect,
    prospectId && shellProspectQuery === undefined
      ? { prospectId: prospectId as Id<"prospects"> }
      : "skip"
  );
  const prospectQuery = shellProspectQuery ?? internalProspectQuery;
  const prospect = prospectQuery.data;
  const prospectArchived = prospect?.status === "archived";
  const preferredShellQueryArgs = usePreferredShellQueryArgs();
  const prospectDisplayData = useMemo(
    () => (prospect ? getProspectDisplayData(prospect) : null),
    [prospect]
  );
  const prospectPlatform =
    prospect?.platform === "linkedin" || prospect?.platform === "twitter"
      ? prospect.platform
      : null;
  const dmState = useProspectDmState(prospectId, {
    enabled: Boolean(prospectId && prospectPlatform),
    platform: prospectPlatform ?? "twitter",
  });
  const emptyPromptPlaceholder = useMemo(() => {
    if (!prospectId) {
      return `Type and hit ↵ to chat with ${AGENT_DISPLAY_NAME}.`;
    }

    return prospectDisplayData
      ? `Chat about ${prospectDisplayData.conversationPlaceholderLabel} with ${AGENT_DISPLAY_NAME}.`
      : `Chat about this person/org with ${AGENT_DISPLAY_NAME}.`;
  }, [prospectDisplayData, prospectId]);

  // Get workspace to check for prospects
  const workspaceStatusQuery = useQueryWithStatus(
    api.workspaces.getWorkspaceSetupStatus,
    preferredShellQueryArgs
  );
  const workspaceStatus = workspaceStatusQuery.data;

  const onboardingLock = useStore($onboardingLock);
  const isSetupRoute = pathname === "/agent/setup";
  const {
    setupDraft: setupSessionForInlineCard,
    isLoading: isSetupDraftLoading,
  } = useSetupThreadDraft(effectiveThreadId);
  const discardedSetupThreadRedirectRef = useRef(false);
  const setupUrlCanonOnceRef = useRef(false);

  useLayoutEffect(() => {
    setupUrlCanonOnceRef.current = false;
  }, [threadId]);

  // Canonical setup URLs only carry threadId. Strip any stale sessionId so
  // route actions can never depend on URL-provided setup IDs.
  useLayoutEffect(() => {
    if (!isSetupRoute || !threadId || typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (!params.has("sessionId")) {
      return;
    }
    if (setupUrlCanonOnceRef.current) {
      return;
    }
    setupUrlCanonOnceRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.set("threadId", threadId);
    url.searchParams.delete("sessionId");
    router.replace(url.pathname + url.search);
  }, [isSetupRoute, router, threadId]);

  useEffect(() => {
    discardedSetupThreadRedirectRef.current = false;
  }, [effectiveThreadId]);

  // A discarded setup session still has a real agent threadId; bookmarks/shell
  // redirects can leave ?threadId= on the URL so we strip it and bootstrap fresh.
  useEffect(() => {
    if (!isSetupRoute || !effectiveThreadId || isSetupDraftLoading) {
      return;
    }
    if (setupSessionForInlineCard?.status !== "discarded") {
      return;
    }
    if (discardedSetupThreadRedirectRef.current) {
      return;
    }
    discardedSetupThreadRedirectRef.current = true;
    startTransition(() => {
      router.replace("/agent/setup");
    });
  }, [
    effectiveThreadId,
    isSetupDraftLoading,
    isSetupRoute,
    router,
    setupSessionForInlineCard?.status,
  ]);
  const isAssistantResponding = shouldShowPendingAssistantRow || isStreaming;
  const showSetupInlineCard =
    isSetupRoute &&
    hasMaterializedAssistantReply &&
    !isAssistantResponding &&
    setupSessionForInlineCard &&
    !["discarded", "failed"].includes(setupSessionForInlineCard.status);
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    preferredShellQueryArgs
  );
  const setupSessionLocksComposer =
    isSetupRoute &&
    (setupSessionForInlineCard?.composerLocked ??
      (shellStateQuery.data?.activeContextType === "setup_session" &&
        Boolean(shellStateQuery.data?.activeSetupSession) &&
        !["ready", "failed", "discarded"].includes(
          shellStateQuery.data?.activeSetupSession?.status ?? ""
        )));
  const isComposerLocked =
    isLoading ||
    isStreaming ||
    (onboardingLock && !isSetupRoute) ||
    setupSessionLocksComposer ||
    (Boolean(prospectId) && prospectArchived);
  const agentInlineAutocompleteContext = useMemo(
    () => ({
      surfaceLabel: "agent_chat",
      prospectId,
      threadId: effectiveThreadId ?? threadId,
      platform: "generic" as const,
    }),
    [effectiveThreadId, prospectId, threadId]
  );

  // Track if we've synced generatedThreadId to URL
  const hasUrlUpdated = useRef(false);
  const lastNotifiedEffectiveThreadIdRef = useRef<
    string | null | undefined
  >(undefined);

  useEffect(() => {
    if (!threadId) {
      hasUrlUpdated.current = false;
    }
  }, [threadId]);

  // Sync generatedThreadId to URL when auto-generation completes
  // This ensures messages load correctly and page can be reloaded
  useEffect(() => {
    if (generatedThreadId && !threadId && !hasUrlUpdated.current) {
      hasUrlUpdated.current = true;
      // Keep setup-route action params until the route guard can transition
      // to a persisted onboarding thread, otherwise we can bounce out early.
      const url = new URL(window.location.href);
      url.searchParams.set("threadId", generatedThreadId);
      url.searchParams.delete("sessionId");
      if (pathname !== "/agent/setup") {
        url.searchParams.delete("action");
      }
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search
      );
    }
  }, [generatedThreadId, pathname, threadId]);

  // Notify parent of effective thread ID changes (for HistoryPanel "Current" badge)
  useEffect(() => {
    if (
      !onEffectiveThreadIdChange ||
      lastNotifiedEffectiveThreadIdRef.current === effectiveThreadId
    ) {
      return;
    }

    lastNotifiedEffectiveThreadIdRef.current = effectiveThreadId;
    onEffectiveThreadIdChange(effectiveThreadId);
  }, [effectiveThreadId, onEffectiveThreadIdChange]);

  // Get user display info from WorkOS auth
  const userDisplayImage = authUser?.profilePictureUrl;
  const userDisplayName = authUser?.firstName || authUser?.email || "User";

  // Loading state while initializing - use skeleton UI to prevent CLS
  if (!isInitialized) {
    return (
      <ChatSkeleton
        onBack={onBack}
        onHistoryClick={onHistoryClick}
        onNewThread={onNewThread}
        onOpenDmPanel={onOpenDmPanel}
      />
    );
  }

  if (shouldShowHydrationSkeleton && !showSetupInlineCard) {
    return (
      <ChatSkeleton
        onBack={onBack}
        onHistoryClick={onHistoryClick}
        onNewThread={onNewThread}
        onOpenDmPanel={onOpenDmPanel}
      />
    );
  }

  const hasTranscriptActivity =
    displayMessages.length > 0 ||
    shouldShowPendingUserMessage ||
    shouldShowPendingAssistantRow ||
    shouldShowPendingError;
  const showEmptyState =
    !hasTranscriptActivity && !showSetupInlineCard && !isLoading;
  const showProspectEmptyState =
    showEmptyState && !!prospectId && prospect !== null;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <ChatHeader
        onBack={onBack}
        onHistoryClick={onHistoryClick}
        onNewThread={onNewThread}
        onViewProfile={onViewProfile}
        onOpenDmPanel={onOpenDmPanel}
        dmPlatform={prospectPlatform}
        dmEligibility={
          dmState.data?.eligibility
            ? {
                enabled: Boolean(dmState.data.eligibility.enabled),
                reasonLabel: String(dmState.data.eligibility.reasonLabel ?? ""),
              }
            : null
        }
        isSetupComplete={
          workspaceStatus?.status === "complete" && !onboardingLock
        }
        prospectArchived={Boolean(prospectId) && prospectArchived}
        isBusy={isLoading}
      />

      {/* Chat Messages Area - scrollable container */}
      <div className="relative min-h-0 flex-1">
        <ChatContainerRoot className="relative h-full min-h-0">
          <ChatContainerContent className="px-4 pt-4 pb-16">
            {!isSetupRoute ? (
              <WorkspacePlanLimitAlert className="mb-4" />
            ) : null}
            {/* Load more button */}
            {hasMore && (
              <div className="mb-4 text-center">
                <Button size="xsIcon" onClick={loadMore}>
                  <RefreshIcon className="fill-current" />
                </Button>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-6">
              {displayMessages.map((message) => (
                <motion.div
                  key={message.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <ChatMessage
                    message={message}
                    userImage={userDisplayImage ?? undefined}
                    userName={userDisplayName}
                    threadModelName={threadModelName}
                    onOpenPanelFromCard={onOpenPanelFromCard}
                    onOpenPlanPanel={onOpenPlanPanel}
                  />
                </motion.div>
              ))}

              {shouldShowPendingUserMessage && pendingUserPrompt && (
                <motion.div
                  key="pending-user"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <LocalUserMessage
                    text={pendingUserPrompt}
                    userImage={userDisplayImage ?? undefined}
                    userName={userDisplayName}
                  />
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {shouldShowPendingAssistantRow && pendingTurn ? (
                  <motion.div
                    key="pending-turn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <PendingAssistantMessage
                      pendingTurn={pendingTurn}
                      onStop={stop}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {shouldShowPendingError && pendingTurn?.errorMessage && (
                <SystemMessage variant="error">
                  {pendingTurn.errorMessage}
                </SystemMessage>
              )}

              {showSetupInlineCard && setupSessionForInlineCard ? (
                <div className="min-w-0">
                  <SetupOnboardingInlineCard
                    sessionId={setupSessionForInlineCard.sessionId}
                    mode={setupSessionForInlineCard.mode}
                    useCaseKey={setupSessionForInlineCard.useCaseKey}
                    title={getSetupPanelStepTitle(
                      setupSessionForInlineCard.currentStepId
                    )}
                    stepNumber={setupSessionForInlineCard.currentStepNumber}
                    stepTotal={setupSessionForInlineCard.totalSteps}
                    onContinue={onOpenSetupOnboardingPanel}
                  />
                </div>
              ) : null}

              {/* Empty state - show when no messages and not loading */}
              {showProspectEmptyState ? (
                <div className="flex min-h-96 items-start justify-center">
                  <AgentProspectEmptyState
                    prospect={prospectDisplayData}
                    isLoading={prospectQuery.isPending}
                    onViewProfile={onViewProfile}
                  />
                </div>
              ) : (
                showEmptyState && (
                  <div className="pt-6 text-center">
                    <Avatar
                      className={cn(
                        "ring-border mx-auto size-12 rounded-xl ring-1"
                      )}
                    >
                      <AvatarFallback className="bg-background text-foreground text-3xl">
                        {AGENT_AVATAR_FALLBACK}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-foreground mt-2 text-lg font-medium">
                      {AGENT_DISPLAY_NAME}
                    </h3>
                  </div>
                )
              )}

              {/* Error display */}
              {error && pendingTurn?.phase !== "failed" && (
                <SystemMessage variant="error">
                  {error.message || "Please try again."}
                </SystemMessage>
              )}
              {workspaceStatusQuery.isError && (
                <SystemMessage variant="warning">
                  {workspaceStatusQuery.error.message ||
                    "Workspace status is unavailable. Agent actions may be limited until this resolves."}
                </SystemMessage>
              )}
            </div>

            <ChatContainerScrollAnchor />
          </ChatContainerContent>
          <div className="pointer-events-none absolute right-4 bottom-16 z-10">
            <ScrollButton className="pointer-events-auto" />
          </div>
        </ChatContainerRoot>
      </div>

      {/* Input Area - with backdrop blur */}
      <div className="bg-background shrink-0 px-4 pt-3 pb-4 backdrop-blur-xl">
        {/* Input */}
        <PromptInput
          value={input}
          onValueChange={setInput}
          onSubmit={() => sendMessage()}
          isLoading={isLoading}
          disabled={isComposerLocked}
        >
          <PromptInputTextarea
            autoFocus
            className="px-1 pt-0.5 text-sm"
            placeholder={
              displayMessages.length > 0
                ? "Type here..."
                : emptyPromptPlaceholder
            }
            inlineAutocompleteContext={agentInlineAutocompleteContext}
            disabled={isComposerLocked}
          />
          <PromptInputActions className="justify-between pt-1">
            {/* Left actions - Coming soon features */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    aria-disabled
                    className={cn(
                      buttonVariants({ variant: "outline", size: "xsIcon" }),
                      "opacity-50"
                    )}
                    type="button"
                  >
                    <AttachFileIcon className="fill-current" />
                  </TooltipTrigger>
                  <TooltipContent>Coming soon!</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    aria-disabled
                    className={cn(
                      buttonVariants({ variant: "outline", size: "xsIcon" }),
                      "opacity-50"
                    )}
                    type="button"
                  >
                    <MailIcon className="fill-current" />
                  </TooltipTrigger>
                  <TooltipContent>Coming soon!</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Right action - Send/Stop */}
            {isLoading || isStreaming ? (
              <PromptInputAction tooltip="Stop generating">
                <Button
                  type="button"
                  variant="ghost"
                  size="xsIcon"
                  onClick={stop}
                >
                  <StopIcon className="fill-current" />
                </Button>
              </PromptInputAction>
            ) : (
              <PromptInputAction tooltip="Send message">
                <Button
                  type="button"
                  variant="default"
                  size="xsIcon"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isComposerLocked}
                >
                  <ArrowUpwardIcon className="fill-current" />
                </Button>
              </PromptInputAction>
            )}
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
