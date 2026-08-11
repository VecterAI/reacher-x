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
import type { SerializedEditorState } from "lexical";
import { usePathname, useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
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
import { isAssistantPlaceholderMessage } from "../lib/assistantMessageState";
import {
  resolveReasoningDisclosureOpen,
  resolveReasoningDisclosureRequest,
} from "../lib/reasoningDisclosure";
import { getUIMessageDisplayText } from "../lib/uiMessageText";
import {
  indexSetupProfileSnapshotsByAssistantMessage,
  type SetupProfileSnapshot,
} from "../lib/setupProfileSnapshots";
import { ThinkingBar } from "@/shared/ui/components/ThinkingBar";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/shared/ui/components/Message";
import { Bubble, BubbleContent } from "@/shared/ui/components/Bubble";
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
} from "@/shared/ui/components/Attachment";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/shared/ui/components/MessageScroller";
import {
  ChatContainerRoot,
  ChatContainerContent,
} from "@/shared/ui/components/ChatContainer";
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
import { SystemMessage } from "@/shared/ui/components/SystemMessage";
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@/shared/ui/components/Marker";
import { AgentArtifactRenderer } from "@/shared/ui/components/json-render";
import {
  extractPostMentionCandidatesFromArtifact,
  getAgentArtifactFromResult,
  getAgentArtifactSemanticKey,
  type AgentArtifactEnvelope,
} from "@/shared/lib/json-render/agentArtifacts";
import { logger } from "@/shared/lib/logger";
import { setPreferredShellContext } from "@/shared/stores/preferredShellContext";
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import {
  normalizeAgentMessageContextMetadata,
  parseLegacyAgentMessageContent,
} from "@/shared/lib/mentions/messageContext";
import { buildPostMentionEntity } from "@/shared/lib/mentions/postMentions";
import {
  getAgentArtifactsFromToolResult,
  getSupersededArtifactKeysByToolCallId,
} from "@/features/agent/lib/toolArtifacts";
import { AgentProspectEmptyState } from "./components/AgentProspectEmptyState";
import { AgentWorkspaceEmptyState } from "./components/AgentWorkspaceEmptyState";
import {
  OutreachPlanCard,
  type OutreachPlanCardTask,
} from "@/features/prospects/ui/components/outreach-plan";
import { Button, buttonVariants } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Spinner } from "@/shared/ui/components/Spinner";
import { Markdown } from "@/shared/ui/components/Markdown";
import { cn, extractTextFromEditorState } from "@/shared/lib/utils";
import { inferAttachmentMediaKind } from "@/shared/lib/utils/media/inferAttachmentMediaKind";
import { inferFileVisualKind } from "@/shared/lib/utils/media/inferFileVisualKind";
import {
  isLinkedInMessageDocumentMimeType,
  LINKEDIN_MESSAGE_DOCUMENT_ACCEPT,
} from "@/shared/lib/utils/media/linkedinMessageAttachmentTypes";
import {
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  X,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from "lucide-react";
import { toast } from "sonner";
import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  startTransition,
  type ClipboardEvent,
  type UIEvent,
} from "react";
import { useStore } from "@nanostores/react";
import { getProspectDisplayData } from "@/features/prospects/lib/getProspectDisplayData";
import { useProspectDmState } from "@/features/prospects/hooks/useProspectDmState";
import { ComposerEditor } from "@/features/composer/lib/ComposerEditor";
import type { ComposerEditorAPI } from "@/features/composer/lib/ToolbarBridgePlugin";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { $onboardingLock } from "@/shared/stores/onboarding";
import {
  ArrowUpwardIcon,
  AlternateEmailIcon,
  AttachFileIcon,
  StopIcon,
  AddIcon,
  SearchActivityIcon,
  ArrowBackIcon,
  MoreHorizIcon,
  MailIcon,
  PersonIcon,
  ChangeHistoryIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import {
  useOutreachPlanPreviewState,
  usePreferredShellQueryArgs,
  useQueryWithStatus,
  useSetupThreadDraft,
  useUrlDescription,
  useWorkspace,
} from "@/shared/hooks";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { getSetupPanelStepTitle } from "@/features/agent/lib/setupOnboardingStepTitles";
import { buildAgentComposerSubmission } from "@/features/agent/lib/buildAgentComposerMessage";
import { getLatestUserMessageScrollAnchorKey } from "@/features/agent/lib/agentMessageScrollHelpers";
import {
  buildAgentMentionReplacementText,
  filterSelectedMentionEntitiesByInput,
} from "@/features/agent/lib/entityMentions";
import { SetupOnboardingInlineCard } from "./components/SetupOnboardingInlineCard";
import { SetupOnboardingCardMenu } from "./components/SetupOnboardingCardMenu";
import { XChatUnlockCard } from "./components/xchat-history";
import { getLockedXChatToolEvidence } from "@/features/agent/lib/xChatToolEvidence";
import { WorkspacePlanLimitAlert } from "@/features/billing/ui/components/WorkspacePlanLimitAlert";
import { buildSetupHref } from "@/shared/lib/urls/setupHref";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";
import { resolveUrlDescriptionStatusText } from "@/shared/lib/urls/urlDescriptionStatus";
import { isSetupComposerLocked } from "@/convex/lib/setupFlowCore";
import { buildSetupPreviewProfileData } from "@/features/agent/lib/setupPreviewProfileData";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";
import { AvatarStack } from "@/shared/ui/components/AvatarStack";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { UrlDescriptionFooterSlot } from "@/shared/ui/components/UrlDescriptionStatus";
import { motion, AnimatePresence } from "motion/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";

const agentChatUiLogger = logger.withScope("AgentChat");
const AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME =
  "self-start group-has-data-[slot=message-footer]/message:translate-y-0";
/** Matches MockSetupThreadPreview empty-case composer copy. */
const SETUP_AUDIENCE_COMPOSER_PLACEHOLDER =
  "Paste a link or describe who you’re looking for…";

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

interface MentionPickerButtonProps {
  disabled?: boolean;
  onTriggerMention: () => void;
}

function MentionPickerButton({
  disabled,
  onTriggerMention,
}: MentionPickerButtonProps) {
  return (
    <Button
      variant="ghost"
      size="xsIcon"
      type="button"
      disabled={disabled}
      aria-label="Tag people, plans, tasks, posts, or attachments"
      title="Tag people, plans, tasks, posts, or attachments"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onTriggerMention}
    >
      <AlternateEmailIcon className="fill-current" />
    </Button>
  );
}

interface ChatAttachment {
  id: string;
  uploadId: string | null;
  fileName: string;
  mediaUrl: string | null;
  status: "uploading" | "ready";
}

const MAX_CHAT_ATTACHMENTS = 4;
const MAX_CHAT_ATTACHMENT_BYTES = 512 * 1024 * 1024;
const MAX_CHAT_DOCUMENT_BYTES = 15 * 1024 * 1024;
const MAX_CHAT_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_CHAT_WEBP_BYTES = 5 * 1024 * 1024;
const CHAT_IMAGE_MIME_TYPES = new Set([
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const CHAT_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const CHAT_ATTACHMENT_ACCEPT = [
  ...CHAT_IMAGE_MIME_TYPES,
  ...CHAT_VIDEO_MIME_TYPES,
  LINKEDIN_MESSAGE_DOCUMENT_ACCEPT,
].join(",");

function buildStableKey(base: string, sequence: Map<string, number>) {
  const nextCount = (sequence.get(base) ?? 0) + 1;
  sequence.set(base, nextCount);
  return `${base}-${nextCount}`;
}

function getAgentArtifactStableKey(artifact: AgentArtifactEnvelope): string {
  const semanticKey = getAgentArtifactSemanticKey(artifact);
  if (semanticKey) {
    return semanticKey;
  }

  const rootElement = artifact.spec.elements[artifact.spec.root];
  const rootType = rootElement?.type ?? "artifact";
  const props = rootElement?.props;

  if (!props || typeof props !== "object") {
    return `${rootType}:${artifact.spec.root}`;
  }

  const propsRecord = props as Record<string, unknown>;
  const stableIdKeys = [
    "planId",
    "runId",
    "memoryId",
    "actionRequestId",
    "prospectId",
    "postId",
  ] as const;

  for (const key of stableIdKeys) {
    const value = propsRecord[key];
    if (typeof value === "string" && value.length > 0) {
      return `${rootType}:${value}`;
    }
  }

  return `${rootType}:${artifact.spec.root}:${JSON.stringify(propsRecord)}`;
}

function getProgressStatusIcon(status: ProgressStep["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "running":
      // Persisted tool results are historical snapshots, not a live workflow
      // subscription. Keep this static so old chat cards never imply work is
      // currently running.
      return <Circle className="h-4 w-4 text-blue-500" />;
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

const AGENT_DISPLAY_NAME = "Agent";
const AGENT_AVATAR_FALLBACK = "△";
const AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME = "mx-auto w-full max-w-[48rem]";
const AGENT_HISTORY_PRELOAD_DISTANCE = 160;

export interface AgentChatProps {
  /** Prospect ID for context (from URL) */
  prospectId?: string;
  /** Thread ID to load (from URL) */
  threadId?: string;
  /** Workspace resolved from the active thread, including setup drafts. */
  workspaceId?: Id<"workspaces"> | null;
  /** Action mode: "generatePlan" for plan generation */
  action?: string;
  /** Notification ID to mark seen (from URL) */
  notificationId?: string;
  /** Handler for back button click */
  onBack?: () => void;
  /** Whether workspace context is ready for History and New thread actions. */
  threadActionsReady?: boolean;
  /** Handler for History button click */
  onHistoryClick?: () => void;
  /** Handler for New thread button click */
  onNewThread?: () => void;
  /** Incremented when the parent wants to force a fresh local thread. */
  newThreadSignal?: number;
  /** Prevent setup bootstrap while a landing draft decision is unresolved. */
  deferSetupHandoff?: boolean;
  /** Callback when effective thread ID changes (resolved from URL or internal state) */
  onEffectiveThreadIdChange?: (threadId: string | null) => void;
  /** Open dynamic panel from inline card */
  onOpenPanelFromCard?: (payload: InlinePanelOpenPayload) => void;
  /** Open the current prospect's plan panel */
  onOpenPlanPanel?: (prospectId?: string | null) => void;
  /** Review a pending workspace profile proposal in the Workspace panel. */
  onOpenWorkspaceProfilePanel?: (requestId: string) => void;
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
  onOpenWorkspaceProfilePanel,
  onApprovePlan,
  onDeletePlan,
}: {
  artifact: NonNullable<ReturnType<typeof getAgentArtifactFromResult>>;
  onOpenPanelFromCard?: (payload: InlinePanelOpenPayload) => void;
  onOpenPlanPanel?: (prospectId?: string | null) => void;
  onOpenWorkspaceProfilePanel?: (requestId: string) => void;
  onApprovePlan: (planId: string) => void;
  onDeletePlan: (planId: string) => void | Promise<void>;
}) {
  return (
    <AgentArtifactRenderer
      artifact={artifact}
      onOpenPanel={onOpenPanelFromCard}
      onOpenPlanPanel={onOpenPlanPanel}
      onOpenWorkspaceProfilePanel={onOpenWorkspaceProfilePanel}
      onApprovePlan={onApprovePlan}
      onDeletePlan={onDeletePlan}
    />
  );
}

function LivePlanPreviewCard({
  planId,
  prospectId,
  fallbackStatus,
  fallbackRationale,
  fallbackTasks,
  onOpenPlanPanel,
  onApprovePlan,
  onDeletePlan,
}: {
  planId?: string;
  prospectId?: string;
  fallbackStatus: string;
  fallbackRationale: string;
  fallbackTasks: OutreachPlanCardTask[];
  onOpenPlanPanel?: (prospectId?: string | null) => void;
  onApprovePlan: (planId: string) => void;
  onDeletePlan: (planId: string) => void | Promise<void>;
}) {
  const { resolvedPlanPreview } = useOutreachPlanPreviewState({
    planId,
    fallbackStatus,
    fallbackRationale,
    fallbackTasks,
  });

  if (!resolvedPlanPreview) {
    return null;
  }

  return (
    <OutreachPlanCard
      variant="preview"
      status={resolvedPlanPreview.status}
      rationale={resolvedPlanPreview.rationale}
      tasks={resolvedPlanPreview.tasks}
      actionsDisabled={resolvedPlanPreview.actionsDisabled}
      onApprove={
        resolvedPlanPreview.status === "draft" && planId
          ? () => {
              onApprovePlan(planId);
            }
          : undefined
      }
      onDeletePlan={planId ? () => onDeletePlan(planId) : undefined}
      footerAction={
        onOpenPlanPanel
          ? {
              label: "Show plan",
              onClick: () => onOpenPlanPanel(prospectId ?? null),
              disabled: resolvedPlanPreview.showPlanDisabled,
              title: resolvedPlanPreview.showPlanDisabled
                ? "This plan has been deleted"
                : undefined,
            }
          : undefined
      }
    />
  );
}

function ToolCallMarker({
  toolCall,
}: {
  toolCall: Pick<ToolCallInfo, "toolName" | "state">;
}) {
  const isComplete =
    toolCall.state === "result" || toolCall.state === "output-available";
  const isError = toolCall.state === "output-error";
  const label = TOOL_LABELS[toolCall.toolName] || toolCall.toolName;
  const showsPendingState = !isComplete && !isError;
  const showsTrailingState = showsPendingState || isError;

  return (
    <Marker role="status" className="w-full gap-2 py-0.5 text-xs">
      <MarkerIcon className="border-border bg-background text-primary flex size-5 items-center justify-center rounded-md border">
        <ChangeHistoryIcon className="text-primary size-3.5 fill-current" />
      </MarkerIcon>
      <MarkerContent
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2",
          showsTrailingState && "justify-between"
        )}
      >
        <span
          className={cn(
            "truncate text-xs leading-none font-medium",
            isComplete && !isError ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {label}
        </span>
        {showsTrailingState ? (
          <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
            {showsPendingState ? (
              <span className="shimmer font-mono">Running</span>
            ) : null}
            {isError ? (
              <XCircle className="text-destructive size-4" />
            ) : showsPendingState ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
          </span>
        ) : null}
      </MarkerContent>
    </Marker>
  );
}

function ToolCallGroup({
  toolCalls,
}: {
  toolCalls: Pick<ToolCallInfo, "toolName" | "state">[];
}) {
  const totalCalls = toolCalls.length;
  const hasError = toolCalls.some(
    (toolCall) => toolCall.state === "output-error"
  );
  const hasPending = toolCalls.some(
    (toolCall) =>
      toolCall.state !== "result" &&
      toolCall.state !== "output-available" &&
      toolCall.state !== "output-error"
  );
  const triggerLabel =
    totalCalls === 1 ? "1 tool used" : `${totalCalls} tools used`;

  return (
    <Steps defaultOpen={hasPending} className="w-full">
      <StepsTrigger
        className="text-xs font-medium"
        leftIcon={
          hasError ? (
            <XCircle className="text-destructive size-3.5" />
          ) : hasPending ? (
            <Loader2 className="text-primary size-3.5 animate-spin" />
          ) : (
            <ChangeHistoryIcon className="text-primary size-3.5 fill-current" />
          )
        }
      >
        {triggerLabel}
      </StepsTrigger>
      <StepsContent className="mt-0">
        {toolCalls.map((toolCall, index) => (
          <StepsItem key={`${toolCall.toolName}-${toolCall.state}-${index}`}>
            <ToolCallMarker toolCall={toolCall} />
          </StepsItem>
        ))}
      </StepsContent>
    </Steps>
  );
}

function ToolCallVisualization({
  toolCalls,
  threadId,
  onOpenPanelFromCard,
  onOpenPlanPanel,
  onOpenWorkspaceProfilePanel,
  supersededArtifactKeysByToolCallId,
}: {
  toolCalls: ToolCallInfo[];
  threadId?: string;
  onOpenPanelFromCard?: (payload: InlinePanelOpenPayload) => void;
  onOpenPlanPanel?: (prospectId?: string | null) => void;
  onOpenWorkspaceProfilePanel?: (requestId: string) => void;
  supersededArtifactKeysByToolCallId?: ReadonlyMap<string, ReadonlySet<string>>;
}) {
  const approvePlan = useMutation(api.outreach.approvePlan);
  const deletePlan = useMutation(api.outreach.deletePlan);

  if (!toolCalls.length) return null;

  const renderedToolCallNodes: React.ReactNode[] = [];
  const pendingMarkerToolCalls: Pick<ToolCallInfo, "toolName" | "state">[] = [];

  for (const [idx, tc] of toolCalls.entries()) {
    // Check if this tool result has a progress array (e.g., searchProspects)
    const result = tc.result as Record<string, unknown> | undefined;
    const hasProgress =
      result && Array.isArray(result.progress) && result.progress.length > 0;

    // Handle both Convex Agent states ("result") and AI SDK states ("output-available")
    const isToolComplete =
      tc.state === "result" || tc.state === "output-available";
    const lockedXChatEvidence =
      isToolComplete && tc.toolName === "getProspectInteractionHistory"
        ? getLockedXChatToolEvidence(result)
        : null;
    if (lockedXChatEvidence && threadId) {
      if (pendingMarkerToolCalls.length > 0) {
        renderedToolCallNodes.push(
          <ToolCallGroup
            key={`tool-group-${idx}`}
            toolCalls={[...pendingMarkerToolCalls]}
          />
        );
        pendingMarkerToolCalls.length = 0;
      }
      renderedToolCallNodes.push(
        <XChatUnlockCard
          key={`${tc.toolCallId ?? tc.toolName}:xchat-unlock`}
          threadId={threadId}
          evidence={lockedXChatEvidence}
        />
      );
      continue;
    }
    const allArtifacts =
      isToolComplete && result ? getAgentArtifactsFromToolResult(result) : [];
    const supersededArtifactKeys =
      tc.toolCallId && tc.toolCallId.length > 0
        ? supersededArtifactKeysByToolCallId?.get(tc.toolCallId)
        : undefined;
    const artifacts = allArtifacts.filter((artifact) => {
      const semanticKey = getAgentArtifactSemanticKey(artifact);
      return !semanticKey || !supersededArtifactKeys?.has(semanticKey);
    });
    if (artifacts.length > 0) {
      if (pendingMarkerToolCalls.length > 0) {
        renderedToolCallNodes.push(
          <ToolCallGroup
            key={`tool-group-${idx}`}
            toolCalls={[...pendingMarkerToolCalls]}
          />
        );
        pendingMarkerToolCalls.length = 0;
      }
      for (const resultArtifact of artifacts) {
        renderedToolCallNodes.push(
          <ArtifactToolResult
            key={`${tc.toolCallId ?? tc.toolName}:${getAgentArtifactStableKey(resultArtifact)}`}
            artifact={resultArtifact}
            onOpenPanelFromCard={onOpenPanelFromCard}
            onOpenPlanPanel={onOpenPlanPanel}
            onOpenWorkspaceProfilePanel={onOpenWorkspaceProfilePanel}
            onApprovePlan={(planId: string) => {
              void approvePlan({ planId: planId as Id<"outreachPlans"> });
            }}
            onDeletePlan={(planId: string) => {
              toast.promise(
                deletePlan({ planId: planId as Id<"outreachPlans"> }),
                {
                  loading: "Deleting plan...",
                  success: "Plan deleted",
                  error: "Failed to delete plan",
                }
              );
            }}
          />
        );
      }
      continue;
    }
    if (allArtifacts.length > 0) {
      pendingMarkerToolCalls.push(tc);
      continue;
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
        prospectId?: string;
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
        const legacyPlanSemanticKey = planId
          ? `PlanPreviewCard:${planId}`
          : null;
        if (
          legacyPlanSemanticKey &&
          supersededArtifactKeys?.has(legacyPlanSemanticKey)
        ) {
          pendingMarkerToolCalls.push(tc);
          continue;
        }
        if (pendingMarkerToolCalls.length > 0) {
          renderedToolCallNodes.push(
            <ToolCallGroup
              key={`tool-group-${idx}`}
              toolCalls={[...pendingMarkerToolCalls]}
            />
          );
          pendingMarkerToolCalls.length = 0;
        }

        renderedToolCallNodes.push(
          <LivePlanPreviewCard
            key={`${tc.toolName}-${idx}`}
            planId={planId}
            prospectId={
              typeof plan.prospectId === "string" ? plan.prospectId : undefined
            }
            fallbackStatus={plan.status}
            fallbackRationale={plan.strategy.rationale}
            fallbackTasks={tasks}
            onOpenPlanPanel={onOpenPlanPanel}
            onApprovePlan={(resolvedPlanId: string) => {
              void approvePlan({
                planId: resolvedPlanId as Id<"outreachPlans">,
              });
            }}
            onDeletePlan={(resolvedPlanId: string) => {
              toast.promise(
                deletePlan({
                  planId: resolvedPlanId as Id<"outreachPlans">,
                }),
                {
                  loading: "Deleting plan...",
                  success: "Plan deleted",
                  error: "Failed to delete plan",
                }
              );
            }}
          />
        );
        continue;
      }
    }

    // If tool has progress steps, show the progress display instead of raw Tool
    if (hasProgress && tc.state === "result") {
      if (pendingMarkerToolCalls.length > 0) {
        renderedToolCallNodes.push(
          <ToolCallGroup
            key={`tool-group-${idx}`}
            toolCalls={[...pendingMarkerToolCalls]}
          />
        );
        pendingMarkerToolCalls.length = 0;
      }

      renderedToolCallNodes.push(
        <div key={`${tc.toolName}-${idx}`} className="space-y-2">
          <ToolCallMarker toolCall={tc} />
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
      continue;
    }

    pendingMarkerToolCalls.push(tc);
  }

  if (pendingMarkerToolCalls.length > 0) {
    renderedToolCallNodes.push(
      <ToolCallGroup
        key={`tool-group-${renderedToolCallNodes.length}`}
        toolCalls={pendingMarkerToolCalls}
      />
    );
  }

  if (renderedToolCallNodes.every((node) => node === null)) {
    return null;
  }

  return <div className="space-y-2">{renderedToolCallNodes}</div>;
}

function getPendingTurnLabel(pendingTurn: PendingTurnState): string {
  switch (pendingTurn.phase) {
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
    <Message align="start" className="items-start">
      <MessageAvatar
        alt="Agent"
        fallback={AGENT_AVATAR_FALLBACK}
        className="bg-background text-foreground"
        avatarClassName="size-6 rounded-md"
        slotClassName={AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME}
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

function SetupInlineAgentMessage({ children }: { children: React.ReactNode }) {
  return (
    <Message align="start" className="items-start">
      <MessageAvatar
        alt="Agent"
        fallback={AGENT_AVATAR_FALLBACK}
        className="bg-background text-foreground"
        avatarClassName="size-6 rounded-md"
        slotClassName={AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME}
      />
      <MessageContent className="max-w-[85%] gap-2">{children}</MessageContent>
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
    <Message align="end" className="items-start">
      <MessageAvatar
        src={userImage}
        alt="You"
        fallback={getUserInitials(userName)}
        className="bg-primary text-primary-foreground"
        avatarClassName="size-6"
      />
      <div className="flex max-w-[80%] flex-col items-end gap-1">
        <UserBubble>
          <div className="whitespace-pre-wrap">{text}</div>
        </UserBubble>
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
  const [completedOpen, setCompletedOpen] = useState(false);
  const isOpen = resolveReasoningDisclosureOpen({
    isStreaming,
    completedOpen,
  });

  const handleOpenChange = useCallback(
    (requestedOpen: boolean) => {
      setCompletedOpen((currentCompletedOpen) =>
        resolveReasoningDisclosureRequest({
          isStreaming,
          currentCompletedOpen,
          requestedOpen,
        })
      );
    },
    [isStreaming]
  );

  if (!reasoning && !redacted) {
    return null;
  }

  return (
    <Reasoning className="mt-1" open={isOpen} onOpenChange={handleOpenChange}>
      <ReasoningTrigger className="text-xs font-medium">
        Analysis
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
            <AssistantMessageBody text={reasoning} />
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

type DisplayAttachment = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  mediaUrl: string | null;
  status: "uploading" | "ready";
  sourceLabel?: string;
  onRemove?: () => void;
};

function buildAttachmentReferenceFromEntity(
  entity: MentionEntitySearchResult
): {
  id: string;
  uploadId: string | null;
  fileName: string;
  mimeType: string | null;
  mediaUrl: string | null;
} | null {
  if (entity.kind !== "attachment") {
    return null;
  }

  return {
    id: entity.id,
    uploadId: entity.entityId || null,
    fileName: entity.label,
    mimeType: entity.attachmentMimeType ?? null,
    mediaUrl: entity.attachmentUrl ?? null,
  };
}

function buildDisplayAttachmentFromEntity(
  entity: MentionEntitySearchResult,
  onRemove?: () => void
): DisplayAttachment | null {
  const attachment = buildAttachmentReferenceFromEntity(entity);
  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    mediaUrl: attachment.mediaUrl,
    status: "ready",
    sourceLabel: "Tagged attachment",
    onRemove,
  };
}

function inferDisplayAttachmentMediaKind(
  attachment: Pick<DisplayAttachment, "fileName" | "mediaUrl" | "mimeType">
): "image" | "gif" | "video" | null {
  return inferAttachmentMediaKind({
    mimeType: attachment.mimeType,
    url: [attachment.fileName, attachment.mediaUrl].filter(Boolean).join(" "),
  });
}

function getDisplayAttachmentIcon(
  attachment: Pick<DisplayAttachment, "fileName" | "mediaUrl" | "mimeType">
) {
  const visualKind = inferFileVisualKind({
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    url: attachment.mediaUrl,
  });

  if (visualKind === "video") {
    return <FileVideo className="size-4" />;
  }
  if (visualKind === "image") {
    return <FileImage className="size-4" />;
  }
  if (visualKind === "spreadsheet") {
    return <FileSpreadsheet className="size-4" />;
  }
  if (visualKind === "code") {
    return <FileCode2 className="size-4" />;
  }

  return <FileText className="size-4" />;
}

function AgentAttachmentList({
  attachments,
  variant = "composer",
}: {
  attachments: DisplayAttachment[];
  variant?: "message" | "composer";
}) {
  if (attachments.length === 0) {
    return null;
  }

  const isMessage = variant === "message";
  const isComposer = variant === "composer";
  const hasMultipleAttachments = attachments.length > 1;
  const attachmentCards = attachments.map((attachment) => {
    const state = attachment.status === "uploading" ? "uploading" : "done";
    const mediaKind = inferDisplayAttachmentMediaKind(attachment);
    const showsImagePreview =
      attachment.status === "ready" &&
      Boolean(attachment.mediaUrl) &&
      (mediaKind === "image" || mediaKind === "gif");
    return (
      <Attachment
        key={attachment.id}
        state={state}
        size="sm"
        orientation="horizontal"
        className={cn(
          "border-border bg-card text-card-foreground shadow-none",
          "min-w-0 overflow-hidden rounded-xl",
          hasMultipleAttachments
            ? "w-64 max-w-[16rem]"
            : isComposer
              ? "w-fit max-w-sm"
              : "w-full max-w-sm",
          isMessage && "dark:bg-card"
        )}
      >
        <AttachmentMedia
          variant={showsImagePreview ? "image" : "icon"}
          className={cn(
            "text-foreground",
            showsImagePreview ? "bg-muted/40 rounded-lg" : "bg-muted rounded-lg"
          )}
        >
          {showsImagePreview && attachment.mediaUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.mediaUrl}
                alt={attachment.fileName}
                loading="lazy"
                decoding="async"
              />
            </>
          ) : attachment.status === "uploading" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            getDisplayAttachmentIcon(attachment)
          )}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle title={attachment.fileName}>
            {attachment.fileName}
          </AttachmentTitle>
          <AttachmentDescription className="text-muted-foreground">
            {attachment.status === "uploading"
              ? "Uploading"
              : (attachment.sourceLabel ?? "Attachment")}
          </AttachmentDescription>
        </AttachmentContent>
        {attachment.onRemove ? (
          <AttachmentActions>
            <AttachmentAction
              aria-label={`Remove ${attachment.fileName}`}
              title={`Remove ${attachment.fileName}`}
              onClick={attachment.onRemove}
            >
              <X className="size-3.5" />
            </AttachmentAction>
          </AttachmentActions>
        ) : null}
        {attachment.mediaUrl ? (
          <AttachmentTrigger asChild>
            <a
              href={attachment.mediaUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${attachment.fileName}`}
            />
          </AttachmentTrigger>
        ) : null}
      </Attachment>
    );
  });

  if (hasMultipleAttachments) {
    return (
      <div
        className={cn(
          "max-w-full min-w-0",
          isMessage ? "max-w-sm self-end" : "w-full"
        )}
      >
        <AttachmentGroup
          className={cn(
            "max-w-full gap-2.5 pr-1",
            isMessage ? "ml-auto w-fit" : "w-full"
          )}
        >
          {attachmentCards}
        </AttachmentGroup>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "max-w-full min-w-0",
        isMessage
          ? "flex max-w-sm justify-end self-end"
          : isComposer
            ? "flex w-fit"
            : "flex"
      )}
    >
      {attachmentCards}
    </div>
  );
}

function HighlightTaggedText({
  text,
  taggedEntities,
  className,
}: {
  text: string;
  taggedEntities: MentionEntitySearchResult[];
  className?: string;
}) {
  if (!text) {
    return null;
  }

  const mentionLabels = taggedEntities
    .filter((entity) => entity.kind !== "attachment")
    .map((entity) => entity.mentionText.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  const pattern =
    mentionLabels.length > 0
      ? new RegExp(
          `(^|[\\s(])(@(?:${mentionLabels
            .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|")})(?=$|[\\s),.!?:;\\]]))`,
          "g"
        )
      : /(^|[\s(])(@[A-Za-z0-9][A-Za-z0-9:_-]*(?: [A-Za-z0-9][A-Za-z0-9:_-]*)*)(?=$|[\s),.!?:;\]])/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const prefix = match[1] ?? "";
    const token = match[2] ?? "";
    const matchStart = match.index;
    const tokenStart = matchStart + prefix.length;

    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    if (prefix) {
      parts.push(prefix);
    }

    parts.push(
      <span
        key={`${tokenStart}-${token}`}
        className="text-primary-foreground/70 font-mono"
      >
        {token}
      </span>
    );

    lastIndex = tokenStart + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <div className={cn("whitespace-pre-wrap", className)}>
      {parts.length > 0 ? parts : text}
    </div>
  );
}

function UserMessageContextContent({
  text,
  taggedEntities,
}: {
  text: string;
  taggedEntities: MentionEntitySearchResult[];
}) {
  const nonAttachmentTags = taggedEntities.filter(
    (entity) => entity.kind !== "attachment"
  );
  const tagOnlyState = !text && nonAttachmentTags.length > 0;

  if (!text && !tagOnlyState) {
    return null;
  }

  return (
    <div className="space-y-2">
      {text ? (
        <HighlightTaggedText text={text} taggedEntities={nonAttachmentTags} />
      ) : null}
      {tagOnlyState ? (
        <div className="flex flex-wrap justify-end gap-2 text-sm">
          {nonAttachmentTags.map((entity) => (
            <span
              key={entity.id}
              className="text-primary-foreground/70 font-mono"
            >
              @{entity.mentionText.trim()}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getAssistantMarkdownClassName() {
  return cn(
    "markdown-content text-foreground break-words whitespace-normal text-sm text-pretty",
    "prose dark:prose-invert max-w-none prose-sm",
    "[&>:first-child]:mt-0 [&>:last-child]:mb-0",
    "prose-p:my-3 prose-p:leading-6",
    "prose-ul:my-3 prose-ol:my-3 prose-li:my-0 prose-li:leading-6 prose-li:marker:text-muted-foreground",
    "prose-h1:mt-6 prose-h1:mb-3 prose-h1:text-xl prose-h1:font-bold",
    "prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-lg prose-h2:font-semibold",
    "prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-base prose-h3:font-semibold",
    "prose-h4:mt-3 prose-h4:mb-1.5 prose-h4:text-sm prose-h4:font-medium",
    "prose-blockquote:border-border prose-blockquote:my-4 prose-blockquote:pl-4 prose-blockquote:not-italic",
    "prose-hr:border-border/80 prose-hr:my-6",
    "prose-table:my-0",
    "prose-code:border prose-code:bg-transparent prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-medium prose-code:text-sm prose-code:text-inherit prose-code:before:content-none prose-code:after:content-none",
    "prose-strong:font-semibold"
  );
}

function AssistantMessageBody({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Markdown className={getAssistantMarkdownClassName()}>{text}</Markdown>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <Bubble align="end" variant="default" className="max-w-full">
      <BubbleContent className="bg-primary text-primary-foreground w-auto max-w-full rounded-lg border-transparent p-2 break-words whitespace-pre-wrap">
        {children}
      </BubbleContent>
    </Bubble>
  );
}

function getUserMessageDisplayAttachments(args: {
  taggedEntities: MentionEntitySearchResult[];
  attachments: Array<{
    fileName: string;
    mediaUrl: string | null;
  }>;
}) {
  const taggedAttachmentDisplays = args.taggedEntities
    .map((entity) => buildDisplayAttachmentFromEntity(entity))
    .filter(
      (attachment): attachment is DisplayAttachment => attachment !== null
    );

  return [
    ...taggedAttachmentDisplays,
    ...args.attachments.map((attachment, index) => ({
      id: `${attachment.fileName}-${index}`,
      fileName: attachment.fileName,
      mediaUrl: attachment.mediaUrl,
      status: "ready" as const,
    })),
  ];
}

/**
 * Per docs: https://docs.convex.dev/agents/streaming#text-smoothing-with-smoothtext-and-usesmoothtext
 * Use useSmoothText hook for smooth streaming text display.
 */
function ChatMessage({
  message,
  threadId,
  userImage,
  userName,
  threadModelName,
  onOpenPanelFromCard,
  onOpenPlanPanel,
  onOpenWorkspaceProfilePanel,
  showReasoning = true,
  supplementalContent,
}: {
  message: UIMessage;
  threadId?: string;
  userImage?: string;
  userName?: string;
  threadModelName?: string | null;
  onOpenPanelFromCard?: (payload: InlinePanelOpenPayload) => void;
  onOpenPlanPanel?: (prospectId?: string | null) => void;
  onOpenWorkspaceProfilePanel?: (requestId: string) => void;
  showReasoning?: boolean;
  supplementalContent?: React.ReactNode;
}) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isPending = message.status === "pending";
  const isStreaming = message.status === "streaming";
  const messageText = getUIMessageDisplayText(message);
  const previousMessageTextRef = useRef(messageText);
  const shouldStartVisibleTextStreaming =
    isAssistant &&
    !isUser &&
    // eslint-disable-next-line react-hooks/refs
    previousMessageTextRef.current.length === 0 &&
    messageText.length > 0;
  const userMessageContext = isUser
    ? normalizeAgentMessageContextMetadata(
        (message as UIMessage & { metadata?: unknown }).metadata
      )
    : null;
  const legacyUserMessageContent =
    isUser && !userMessageContext
      ? parseLegacyAgentMessageContent(messageText)
      : null;
  const effectiveUserMessageContext =
    userMessageContext ?? legacyUserMessageContent?.metadata ?? null;
  const hasUserContext =
    Boolean(effectiveUserMessageContext) &&
    ((effectiveUserMessageContext?.taggedEntities.length ?? 0) > 0 ||
      (effectiveUserMessageContext?.attachments.length ?? 0) > 0);

  // Per docs: useSmoothText smooths text as it streams
  // Pass startStreaming: true when message is actively streaming
  // IMPORTANT: Hook must be called unconditionally (Rules of Hooks)
  const [visibleText] = useSmoothText(messageText, {
    startStreaming: isStreaming || shouldStartVisibleTextStreaming,
  });

  useEffect(() => {
    previousMessageTextRef.current = messageText;
  }, [messageText]);

  // Early return AFTER hook call to satisfy Rules of Hooks
  if (!isUser && !isAssistant) return null;

  const hideSyntheticUserText =
    isUser &&
    hasUserContext &&
    effectiveUserMessageContext?.promptTextSource === "synthetic";
  const displayText = isUser
    ? legacyUserMessageContent
      ? legacyUserMessageContent.displayText
      : hideSyntheticUserText
        ? ""
        : visibleText
    : visibleText;
  const assistantModel = isAssistant
    ? (getAssistantMessageModel(message) ?? threadModelName ?? null)
    : null;
  const assistantReasoning = isAssistant
    ? extractAssistantReasoning(message)
    : null;
  const assistantSources = isAssistant ? extractAssistantSources(message) : [];
  const hasAssistantMetadata =
    (showReasoning && Boolean(assistantReasoning)) ||
    assistantSources.length > 0;
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
  const supersededArtifactKeysByToolCallId =
    getSupersededArtifactKeysByToolCallId(toolCalls);

  const failedStateMessage =
    isAssistant &&
    message.status === "failed" &&
    !displayText &&
    !toolCalls.length
      ? "That response couldn't be completed."
      : "";

  if (
    isAssistant &&
    (isPending || isStreaming) &&
    !displayText &&
    !toolCalls.length &&
    !hasAssistantMetadata
  ) {
    return (
      <Message align="start" className="items-start">
        <MessageAvatar
          alt="Agent"
          fallback={AGENT_AVATAR_FALLBACK}
          className="bg-background text-foreground"
          avatarClassName="size-6 rounded-md"
          slotClassName={AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME}
        />
        <div className="flex max-w-[85%] flex-col gap-2 pt-1">
          <ThinkingBar text="Thinking" />
          {supplementalContent}
        </div>
      </Message>
    );
  }

  // Don't render empty messages unless streaming or there is rich metadata.
  if (
    !displayText &&
    !failedStateMessage &&
    !isStreaming &&
    !toolCalls.length &&
    !hasAssistantMetadata &&
    !hasUserContext &&
    !supplementalContent
  )
    return null;

  if (isUser) {
    const userDisplayAttachments = getUserMessageDisplayAttachments({
      taggedEntities: effectiveUserMessageContext?.taggedEntities ?? [],
      attachments: effectiveUserMessageContext?.attachments ?? [],
    });

    return (
      <Message align="end" className="items-start">
        <MessageAvatar
          src={userImage}
          alt="You"
          fallback={getUserInitials(userName)}
          className="bg-primary text-primary-foreground"
          avatarClassName="size-6"
        />
        <MessageContent className="max-w-[80%] items-end gap-1">
          {displayText ||
          (effectiveUserMessageContext?.taggedEntities.length ?? 0) > 0 ? (
            <UserBubble>
              <UserMessageContextContent
                text={displayText}
                taggedEntities={
                  effectiveUserMessageContext?.taggedEntities ?? []
                }
              />
            </UserBubble>
          ) : null}
          {userDisplayAttachments.length > 0 ? (
            <AgentAttachmentList
              attachments={userDisplayAttachments}
              variant="message"
            />
          ) : null}
          {displayText && (
            <MessageActions>
              <CopyButton text={displayText} />
            </MessageActions>
          )}
        </MessageContent>
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
    <Message align="start" className="items-start">
      <MessageAvatar
        alt="Agent"
        fallback={AGENT_AVATAR_FALLBACK}
        className="bg-background text-foreground"
        avatarClassName="size-6 rounded-md"
        slotClassName={AGENT_MESSAGE_AVATAR_SLOT_CLASSNAME}
      />
      <MessageContent className="max-w-[85%] gap-2">
        {showReasoning &&
        (assistantReasoning || hasRedactedReasoning(message)) ? (
          <ReasoningSection message={message} isStreaming={isStreaming} />
        ) : null}

        {usePartsOrder ? (
          (() => {
            const dedup = new Set<string>();
            return message.parts!.map((part) => {
              // Text parts
              if ((part as { type: string }).type === "text") {
                const text = (part as { text?: string }).text;
                if (!text?.trim()) return null;
                return (
                  <AssistantMessageBody
                    key={buildStableKey(`text-${text}`, partKeySequence)}
                    text={text}
                  />
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
                      threadId={threadId}
                      onOpenPanelFromCard={onOpenPanelFromCard}
                      onOpenPlanPanel={onOpenPlanPanel}
                      onOpenWorkspaceProfilePanel={onOpenWorkspaceProfilePanel}
                      supersededArtifactKeysByToolCallId={
                        supersededArtifactKeysByToolCallId
                      }
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
                  threadId={threadId}
                  onOpenPanelFromCard={onOpenPanelFromCard}
                  onOpenPlanPanel={onOpenPlanPanel}
                  onOpenWorkspaceProfilePanel={onOpenWorkspaceProfilePanel}
                  supersededArtifactKeysByToolCallId={
                    supersededArtifactKeysByToolCallId
                  }
                />
              </motion.div>
            )}

            {(displayText || failedStateMessage || isStreaming) && (
              <AssistantMessageBody
                text={displayText || failedStateMessage || " "}
                className={cn(
                  isStreaming &&
                    !displayText &&
                    !failedStateMessage &&
                    !hasAssistantMetadata &&
                    "animate-pulse"
                )}
              />
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

        {supplementalContent}

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
      </MessageContent>
    </Message>
  );
}

// ============================================================================
// Chat Header Component
// ============================================================================

function AgentHistoryLoadingIndicator({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading earlier messages"
    >
      <Spinner variant="circle" className="size-5" />
    </div>
  );
}

interface ChatHeaderProps {
  onBack?: () => void;
  onHistoryClick?: () => void;
  onNewThread?: () => void;
  threadActionsReady?: boolean;
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
  /** Setup-route draft actions (Reset / Delete draft) — header far-right. */
  setupDraftMenu?: React.ReactNode;
}

function ChatHeader({
  onBack,
  onHistoryClick,
  onNewThread,
  threadActionsReady = true,
  isSetupComplete = false,
  prospectArchived = false,
  onViewProfile,
  onOpenDmPanel,
  dmEligibility,
  dmPlatform,
  isBusy = false,
  setupDraftMenu,
}: ChatHeaderProps) {
  const showButtons = onHistoryClick !== undefined;
  const setupIncomplete = !isSetupComplete;
  const historyDisabled = setupIncomplete || !threadActionsReady;
  const newThreadDisabled = historyDisabled || prospectArchived;
  const resolvedDmPlatform = dmPlatform === "linkedin" ? "linkedin" : "twitter";
  const showRightActions = showButtons || Boolean(setupDraftMenu);

  return (
    <header className="bg-background sticky top-0 right-0 left-0 z-10 flex h-10 shrink-0 items-center justify-between border-b px-4 py-2">
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
      {showRightActions ? (
        <div className="flex items-center gap-1">
          {showButtons ? (
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={onHistoryClick}
                type="button"
                disabled={historyDisabled}
                title={
                  !threadActionsReady
                    ? "Loading workspace"
                    : setupIncomplete
                      ? "Complete workspace setup first"
                      : "History"
                }
              >
                <SearchActivityIcon className="fill-current" />
                History
              </Button>
              {onNewThread && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={onNewThread}
                  type="button"
                  disabled={newThreadDisabled}
                  title={
                    !threadActionsReady
                      ? "Loading workspace"
                      : setupIncomplete
                        ? "Complete workspace setup first"
                        : prospectArchived
                          ? "Unarchive this profile to start a new thread"
                          : "New thread"
                  }
                >
                  <AddIcon className="fill-current" />
                  New
                </Button>
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
                        <DropdownMenuItem onClick={() => onViewProfile()}>
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
            </>
          ) : null}
          {setupDraftMenu}
        </div>
      ) : null}
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
  threadActionsReady = true,
  onHistoryClick,
  onNewThread,
  onOpenDmPanel,
}: Pick<
  AgentChatProps,
  | "onBack"
  | "threadActionsReady"
  | "onHistoryClick"
  | "onNewThread"
  | "onOpenDmPanel"
>) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header - renders same buttons as loaded state to prevent CLS */}
      <ChatHeader
        onBack={onBack}
        onHistoryClick={onHistoryClick}
        onNewThread={onNewThread}
        threadActionsReady={threadActionsReady}
        onOpenDmPanel={onOpenDmPanel}
        isSetupComplete={false}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Skeleton messages area - uses same container structure for consistent scroll */}
        <ChatContainerRoot className="min-h-0 flex-1">
          <ChatContainerContent
            className={cn(AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME, "px-4 py-4")}
          >
            <div className="card-fade-bottom space-y-6">
              {/* Skeleton assistant message 1 - welcome/intro */}
              <div className="card-fade-bottom-mid flex items-start gap-3">
                {/* Agent avatar - rounded-md like real UI */}
                <Skeleton className="size-6 shrink-0 rounded-md" />
                <div className="flex max-w-[85%] flex-col gap-2">
                  <Skeleton className="h-4 w-72 rounded-sm" />
                  <Skeleton className="h-4 w-56 rounded-sm" />
                  <Skeleton className="h-4 w-64 rounded-sm" />
                </div>
              </div>

              {/* Skeleton user message 1 */}
              <div className="card-fade-bottom-mid flex flex-row-reverse items-start gap-3">
                {/* User avatar - rounded-full like real UI */}
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-10 w-48 rounded-lg" />
                </div>
              </div>

              {/* Skeleton assistant message 2 - analyzing */}
              <div className="card-fade-bottom-mid flex items-start gap-3">
                <Skeleton className="size-6 shrink-0 rounded-md" />
                <div className="flex max-w-[85%] flex-col gap-2">
                  <Skeleton className="h-4 w-64 rounded-sm" />
                  <Skeleton className="h-4 w-80 rounded-sm" />
                  <Skeleton className="h-4 w-72 rounded-sm" />
                  <Skeleton className="h-4 w-56 rounded-sm" />
                </div>
              </div>

              {/* Skeleton user message 2 */}
              <div className="card-fade-bottom-mid flex flex-row-reverse items-start gap-3">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-10 w-36 rounded-lg" />
                </div>
              </div>

              {/* Skeleton assistant message 3 - longer response with list-like content */}
              <div className="card-fade-bottom-mid flex items-start gap-3">
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
              <div className="card-fade-bottom-mid flex flex-row-reverse items-start gap-3">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-10 w-52 rounded-lg" />
                </div>
              </div>

              {/* Skeleton assistant message 4 - final response */}
              <div className="card-fade-bottom-mid flex items-start gap-3">
                <Skeleton className="size-6 shrink-0 rounded-md" />
                <div className="flex max-w-[85%] flex-col gap-2">
                  <Skeleton className="h-4 w-72 rounded-sm" />
                  <Skeleton className="h-4 w-80 rounded-sm" />
                  <Skeleton className="h-4 w-64 rounded-sm" />
                </div>
              </div>
            </div>
          </ChatContainerContent>
        </ChatContainerRoot>

        {/* Skeleton input area - matches actual input structure */}
        <div className="bg-background shrink-0 px-4 pb-4 backdrop-blur-xl">
          <div
            className={cn(
              AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME,
              "border-input bg-background rounded-xl border p-2 opacity-60"
            )}
          >
            <div
              className={cn(
                DM_COMPOSER_CONTENT_EDITABLE_CLASS,
                "text-muted-foreground min-h-10"
              )}
            >
              Type here...
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="xsIcon" type="button" disabled>
                  <AttachFileIcon className="fill-current" />
                </Button>
                <Button variant="outline" size="xsIcon" type="button" disabled>
                  <AlternateEmailIcon className="fill-current" />
                </Button>
              </div>

              <Button variant="default" size="xsIcon" type="button" disabled>
                <ArrowUpwardIcon className="fill-current" />
              </Button>
            </div>
          </div>
        </div>
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
  workspaceId,
  action,
  notificationId: _notificationId,
  onBack,
  threadActionsReady = true,
  onHistoryClick,
  onNewThread,
  newThreadSignal,
  deferSetupHandoff = false,
  onEffectiveThreadIdChange,
  onOpenPanelFromCard,
  onOpenPlanPanel,
  onOpenWorkspaceProfilePanel,
  onViewProfile,
  onOpenDmPanel,
  onOpenSetupOnboardingPanel,
  shellProspectQuery,
}: AgentChatProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Get WorkOS auth user for profile image (same as Header)
  const { user: authUser } = useAuth();
  const { workspace: currentWorkspace, isLoading: isWorkspaceLoading } =
    useWorkspace();
  const effectiveWorkspaceId = workspaceId ?? currentWorkspace?._id ?? null;

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
    workspaceId: effectiveWorkspaceId,
    action: action ?? null,
    newThreadSignal,
    deferSetupHandoff,
  });

  const handleMessageScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (
        !hasMore ||
        messageStatus === "LoadingMore" ||
        event.currentTarget.scrollTop > AGENT_HISTORY_PRELOAD_DISTANCE
      ) {
        return;
      }

      loadMore();
    },
    [hasMore, loadMore, messageStatus]
  );

  const rawDisplayMessages = useMemo(
    () => messages.filter((m) => m.key !== "welcome-message"),
    [messages]
  );
  const shouldHidePersistedTranscript =
    !effectiveThreadId ||
    (messageStatus === "LoadingFirstPage" &&
      rawDisplayMessages.length === 0 &&
      pendingTurn === null);
  const displayMessages = shouldHidePersistedTranscript
    ? EMPTY_UI_MESSAGES
    : rawDisplayMessages;

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
  const currentPendingTurnOrder = pendingTurn?.order ?? null;
  const currentTurnAssistantMessage =
    currentPendingTurnOrder !== null
      ? displayMessages.find(
          (message) =>
            message.role === "assistant" &&
            message.order === currentPendingTurnOrder
        )
      : [...displayMessages]
          .reverse()
          .find(
            (message) =>
              message.role === "assistant" &&
              (message.status === "pending" || message.status === "streaming")
          );
  const shouldKeepPendingAssistantRowVisible =
    !currentTurnAssistantMessage ||
    isAssistantPlaceholderMessage(currentTurnAssistantMessage);
  const shouldShowPendingAssistantRow =
    pendingTurn !== null &&
    pendingTurn.phase !== "failed" &&
    pendingTurn.phase !== "finished" &&
    shouldKeepPendingAssistantRowVisible;
  const renderedDisplayMessages = useMemo(
    () =>
      displayMessages.filter((message) => {
        if (currentPendingTurnOrder === null) {
          return !shouldShowPendingAssistantRow || message.role !== "assistant"
            ? true
            : !isAssistantPlaceholderMessage(message);
        }

        if (
          !shouldShowPendingAssistantRow ||
          message.role !== "assistant" ||
          message.order !== currentPendingTurnOrder
        ) {
          return true;
        }

        return !isAssistantPlaceholderMessage(message);
      }),
    [currentPendingTurnOrder, displayMessages, shouldShowPendingAssistantRow]
  );
  const currentUserMessageScrollAnchorKey = useMemo(
    () =>
      shouldShowPendingUserMessage
        ? null
        : getLatestUserMessageScrollAnchorKey(renderedDisplayMessages),
    [renderedDisplayMessages, shouldShowPendingUserMessage]
  );
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

  // Attachments: upload files to the shared media library, then reference them
  // in the message so the △ Agent can reuse them in posts/DMs.
  const generateUploadUrl = useMutation(
    api.mediaUploadMutations.generateUploadUrl
  );
  const processUploadedMedia = useAction(api.mediaUpload.processUploadedMedia);
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const hasUploadingAttachment = chatAttachments.some(
    (attachment) => attachment.status === "uploading"
  );
  const readyAttachments = useMemo(
    () =>
      chatAttachments.filter(
        (attachment) => attachment.status === "ready" && attachment.mediaUrl
      ),
    [chatAttachments]
  );
  const mentionScopeKey = `${effectiveThreadId ?? "new"}:${prospectId ?? "workspace"}`;
  const [mentionComposerState, setMentionComposerState] = useState<{
    scopeKey: string;
    selectedEntities: MentionEntitySearchResult[];
  }>({
    scopeKey: mentionScopeKey,
    selectedEntities: [],
  });
  const [agentComposerContent, setAgentComposerContent] = useState<
    SerializedEditorState | undefined
  >(buildSerializedTextState(input));
  const [agentComposerApi, setAgentComposerApi] =
    useState<ComposerEditorAPI | null>(null);
  const isSetupRouteEarly = pathname === "/agent/setup";
  const isSetupAudienceEntryRef = useRef(false);
  const setupUrlReadingRef = useRef(false);
  const setupUrlReadErrorToastRef = useRef<string | null>(null);
  const [setupSourceUrl, setSetupSourceUrl] = useState<string | null>(null);
  const {
    isReadingUrl: isSetupReadingUrl,
    readError: setupUrlReadError,
    scheduleReadIfValid: scheduleSetupUrlRead,
    beginRead: beginSetupUrlRead,
    cancelRead: cancelSetupUrlRead,
  } = useUrlDescription({
    setText: (next) => {
      setInput(next);
    },
    onSourceUrlChange: setSetupSourceUrl,
    onReadingChange: (reading) => {
      setupUrlReadingRef.current = reading;
    },
  });
  const selectedMentionEntities = mentionComposerState.selectedEntities;
  const selectedAttachmentEntities = useMemo(
    () =>
      selectedMentionEntities.filter((entity) => entity.kind === "attachment"),
    [selectedMentionEntities]
  );
  const selectedTaggedEntities = useMemo(
    () =>
      selectedMentionEntities.filter((entity) => entity.kind !== "attachment"),
    [selectedMentionEntities]
  );
  const threadPostMentionEntities = useMemo(() => {
    const collected: MentionEntitySearchResult[] = [];
    const seenIds = new Set<string>();

    for (const message of displayMessages) {
      if (message.role !== "assistant" || !Array.isArray(message.parts)) {
        continue;
      }

      for (const part of message.parts) {
        if (!isToolPart(part)) {
          continue;
        }

        const artifact = getAgentArtifactFromResult(
          part.output as Record<string, unknown> | undefined
        );
        if (!artifact) {
          continue;
        }

        for (const candidate of extractPostMentionCandidatesFromArtifact(
          artifact
        )) {
          const entity = buildPostMentionEntity({
            post:
              candidate.postSummary ?? candidate.postData ?? candidate.postRef,
            platformHint: candidate.platform,
            workspaceId: effectiveWorkspaceId ?? undefined,
            prospectId: candidate.prospectId ?? prospectId ?? undefined,
          });
          if (!entity || seenIds.has(entity.id)) {
            continue;
          }
          seenIds.add(entity.id);
          collected.push(entity);
        }
      }
    }

    return collected.slice(0, 8);
  }, [displayMessages, effectiveWorkspaceId, prospectId]);

  useEffect(() => {
    setMentionComposerState((current) =>
      current.scopeKey === mentionScopeKey
        ? current
        : {
            scopeKey: mentionScopeKey,
            selectedEntities: [],
          }
    );
    setAgentComposerContent(buildSerializedTextState(""));
  }, [mentionScopeKey]);

  useEffect(() => {
    setMentionComposerState((current) => {
      const inlineEntities = current.selectedEntities.filter(
        (entity) => entity.kind !== "attachment"
      );
      const attachmentEntities = current.selectedEntities.filter(
        (entity) => entity.kind === "attachment"
      );
      const filteredInlineEntities = filterSelectedMentionEntitiesByInput({
        input,
        entities: inlineEntities,
      });
      const nextSelectedEntities = [
        ...filteredInlineEntities,
        ...attachmentEntities,
      ];

      if (
        nextSelectedEntities.length === current.selectedEntities.length &&
        nextSelectedEntities.every(
          (entity, index) => entity.id === current.selectedEntities[index]?.id
        )
      ) {
        return current;
      }

      return {
        ...current,
        selectedEntities: nextSelectedEntities,
      };
    });
  }, [input]);

  useEffect(() => {
    const editorText = agentComposerContent
      ? extractTextFromEditorState(agentComposerContent)
      : "";

    if (!agentComposerApi || input === editorText) {
      return;
    }

    if (!input) {
      agentComposerApi.clearContent();
      setAgentComposerContent(undefined);
      return;
    }

    agentComposerApi.replaceContent(input);
    setAgentComposerContent(buildSerializedTextState(input));
  }, [agentComposerApi, agentComposerContent, input]);

  const handleAgentComposerContentChange = useCallback(
    (nextContent?: SerializedEditorState) => {
      setAgentComposerContent(nextContent);
      const nextInput = nextContent
        ? extractTextFromEditorState(nextContent)
        : "";
      if (nextInput !== input) {
        setInput(nextInput);
      }

      if (!isSetupAudienceEntryRef.current || setupUrlReadingRef.current) {
        return;
      }

      // Keep Exa sourceUrl while the user edits the filled description; only
      // drop it when the composer is cleared (a new whole-value URL rebinds it).
      if (!nextInput.trim() && setupSourceUrl) {
        setSetupSourceUrl(null);
      }

      scheduleSetupUrlRead(nextInput);
    },
    [input, scheduleSetupUrlRead, setInput, setupSourceUrl]
  );

  useEffect(() => {
    if (
      setupUrlReadError &&
      setupUrlReadError !== setupUrlReadErrorToastRef.current
    ) {
      setupUrlReadErrorToastRef.current = setupUrlReadError;
      toast.error("Couldn't read the URL", {
        description: setupUrlReadError,
      });
    }
    if (!setupUrlReadError) {
      setupUrlReadErrorToastRef.current = null;
    }
  }, [setupUrlReadError]);

  const handleAttachFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!effectiveWorkspaceId) {
        toast.error("Attachment unavailable", {
          description: "Select a workspace before uploading an attachment.",
        });
        return;
      }

      const availableSlots = Math.max(
        0,
        MAX_CHAT_ATTACHMENTS - chatAttachments.length
      );
      if (availableSlots === 0) {
        toast.error(`Maximum ${MAX_CHAT_ATTACHMENTS} attachments are allowed.`);
        return;
      }
      const fileArray = Array.from(files).slice(0, availableSlots);

      for (const file of fileArray) {
        const normalizedMimeType = file.type.toLowerCase();
        const isDocument =
          isLinkedInMessageDocumentMimeType(normalizedMimeType);
        const isSupportedAttachment =
          CHAT_IMAGE_MIME_TYPES.has(normalizedMimeType) ||
          CHAT_VIDEO_MIME_TYPES.has(normalizedMimeType) ||
          isDocument;
        if (!isSupportedAttachment) {
          toast.error("Unsupported attachment", {
            description: `${file.name} is not supported. Use an image, GIF, video, or supported LinkedIn document.`,
          });
          continue;
        }
        const maxBytes = isDocument
          ? MAX_CHAT_DOCUMENT_BYTES
          : normalizedMimeType === "image/webp"
            ? MAX_CHAT_WEBP_BYTES
            : CHAT_IMAGE_MIME_TYPES.has(normalizedMimeType)
              ? MAX_CHAT_IMAGE_BYTES
              : MAX_CHAT_ATTACHMENT_BYTES;
        if (file.size > maxBytes) {
          toast.error("File too large", {
            description: `${file.name} exceeds ${Math.round(maxBytes / (1024 * 1024))} MB.`,
          });
          continue;
        }

        const attachmentId = `chat-attachment-${getCurrentUTCTimestamp()}-${file.name}`;
        setChatAttachments((prev) => [
          ...prev,
          {
            id: attachmentId,
            uploadId: null,
            fileName: file.name,
            mediaUrl: null,
            status: "uploading",
          },
        ]);

        try {
          const uploadUrl = await generateUploadUrl({
            workspaceId: effectiveWorkspaceId,
          });
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });
          if (!uploadResponse.ok) {
            throw new Error(`Upload failed (${uploadResponse.status})`);
          }
          const { storageId } = (await uploadResponse.json()) as {
            storageId: Id<"_storage">;
          };
          const result = await processUploadedMedia({
            storageId,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            workspaceId: effectiveWorkspaceId,
            displayName: file.name,
          });

          if (!result.mediaUrl) {
            throw new Error("Upload processed without a media URL");
          }

          setChatAttachments((prev) =>
            prev.map((attachment) =>
              attachment.id === attachmentId
                ? {
                    ...attachment,
                    uploadId: result.uploadId,
                    mediaUrl: result.mediaUrl,
                    status: "ready",
                  }
                : attachment
            )
          );
        } catch (uploadError) {
          agentChatUiLogger.error("Attachment upload failed", uploadError);
          setChatAttachments((prev) =>
            prev.filter((attachment) => attachment.id !== attachmentId)
          );
          toast.error("Attachment upload failed", {
            description: file.name,
          });
        }
      }
    },
    [
      chatAttachments.length,
      effectiveWorkspaceId,
      generateUploadUrl,
      processUploadedMedia,
    ]
  );

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setChatAttachments((prev) =>
      prev.filter((attachment) => attachment.id !== attachmentId)
    );
  }, []);

  const handleSelectMentionEntity = useCallback(
    (entity: MentionEntitySearchResult) => {
      setMentionComposerState((current) => {
        if (current.selectedEntities.some((item) => item.id === entity.id)) {
          return current;
        }
        return {
          ...current,
          selectedEntities: [...current.selectedEntities, entity],
        };
      });
    },
    []
  );

  const handleSendWithAttachments = useCallback(() => {
    if (isSetupReadingUrl) {
      return;
    }

    const trimmedInput = input.trim();

    // Chat-first setup: whole-value URL → Exa auto-fill first (same as landing CTA).
    if (isSetupAudienceEntryRef.current) {
      const candidate = getUrlFromWholeValue(trimmedInput);
      if (candidate) {
        void beginSetupUrlRead(candidate);
        return;
      }
    }

    const selectedAttachmentReferences = selectedAttachmentEntities
      .map((entity) => buildAttachmentReferenceFromEntity(entity))
      .filter(
        (
          attachment
        ): attachment is NonNullable<
          ReturnType<typeof buildAttachmentReferenceFromEntity>
        > => attachment !== null
      )
      .map((attachment) => ({
        uploadId: attachment.uploadId,
        fileName: attachment.fileName,
        mediaUrl: attachment.mediaUrl,
      }));

    if (
      !trimmedInput &&
      readyAttachments.length === 0 &&
      selectedMentionEntities.length === 0
    ) {
      return;
    }
    if (hasUploadingAttachment) {
      toast.info("Hold on", {
        description: "Attachments are still uploading.",
      });
      return;
    }

    const submission = buildAgentComposerSubmission({
      input: trimmedInput,
      taggedEntities: selectedTaggedEntities,
      attachments: [...readyAttachments, ...selectedAttachmentReferences],
    });
    if (!submission) {
      return;
    }

    const setupSourceUrlForSubmit = isSetupAudienceEntryRef.current
      ? setupSourceUrl
      : null;

    setChatAttachments([]);
    setMentionComposerState((current) => ({
      ...current,
      selectedEntities: [],
    }));
    agentComposerApi?.clearContent();
    setAgentComposerContent(undefined);
    setInput("");
    setSetupSourceUrl(null);
    void sendMessage({
      ...submission,
      ...(setupSourceUrlForSubmit
        ? { setupSourceUrl: setupSourceUrlForSubmit }
        : {}),
    });
  }, [
    agentComposerApi,
    beginSetupUrlRead,
    hasUploadingAttachment,
    input,
    isSetupReadingUrl,
    readyAttachments,
    selectedAttachmentEntities,
    selectedMentionEntities,
    selectedTaggedEntities,
    sendMessage,
    setInput,
    setupSourceUrl,
  ]);

  const handleSetupUrlPasteCapture = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!isSetupAudienceEntryRef.current || isSetupReadingUrl) {
        return;
      }

      const pasted = event.clipboardData.getData("text");
      const candidate = getUrlFromWholeValue(pasted);
      if (!candidate) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setInput(pasted);
      void beginSetupUrlRead(candidate);
    },
    [beginSetupUrlRead, isSetupReadingUrl, setInput]
  );

  const onboardingLock = useStore($onboardingLock);
  const isSetupRoute = isSetupRouteEarly;
  const isBareWorkspaceDraft =
    !threadId && !prospectId && !action && !isSetupRoute;
  const {
    setupDraft: setupSessionForInlineCard,
    isLoading: isSetupDraftLoading,
  } = useSetupThreadDraft(effectiveThreadId);
  const setupProfileSnapshots = useQuery(
    api.setupSessions.listSetupProfileSnapshots,
    isSetupRouteEarly && effectiveThreadId
      ? { threadId: effectiveThreadId }
      : "skip"
  );
  const setupProfileSnapshotByAssistantKey = useMemo(
    () =>
      indexSetupProfileSnapshotsByAssistantMessage(
        renderedDisplayMessages,
        setupProfileSnapshots ?? []
      ),
    [renderedDisplayMessages, setupProfileSnapshots]
  );
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
  const hasSetupUserMessage =
    shouldShowPendingUserMessage ||
    displayMessages.some((message) => {
      if (message.role !== "user") {
        return false;
      }
      const text = getUIMessageDisplayText(message).trim();
      return text.length > 0 && text !== "__INIT__";
    });
  const isExplicitSetupThreadHydrating =
    isSetupRoute &&
    Boolean(threadId) &&
    !hasSetupUserMessage &&
    ((isSetupDraftLoading && !setupSessionForInlineCard) ||
      messageStatus === "LoadingFirstPage");
  const isSetupAudienceEntry =
    isSetupRoute &&
    !isExplicitSetupThreadHydrating &&
    !hasSetupUserMessage &&
    (isSetupDraftLoading ||
      Boolean(
        setupSessionForInlineCard &&
        !setupSessionForInlineCard.seedDescription &&
        (setupSessionForInlineCard.inputPhase === "collecting_input" ||
          setupSessionForInlineCard.status === "draft" ||
          setupSessionForInlineCard.status === "awaiting_input" ||
          setupSessionForInlineCard.status === "failed")
      ));
  const isSetupCollectingAudience =
    isSetupRoute &&
    !isExplicitSetupThreadHydrating &&
    ((isSetupDraftLoading && !hasSetupUserMessage) ||
      setupSessionForInlineCard?.inputPhase === "collecting_input");
  useEffect(() => {
    isSetupAudienceEntryRef.current = isSetupCollectingAudience;
  }, [isSetupCollectingAudience]);
  const setupUrlStatusText = resolveUrlDescriptionStatusText({
    isReadingUrl: isSetupCollectingAudience && isSetupReadingUrl,
  });

  // Chat-first: no progress card / panel entry while collecting audience in chat.
  const showSetupInlineCard =
    isSetupRoute &&
    !isSetupAudienceEntry &&
    !isSetupCollectingAudience &&
    setupSessionForInlineCard &&
    !["discarded", "failed", "ready"].includes(
      setupSessionForInlineCard.status
    );
  const showSetupDraftMenu =
    isSetupRoute &&
    Boolean(setupSessionForInlineCard) &&
    !["discarded", "failed", "ready"].includes(
      setupSessionForInlineCard?.status ?? ""
    );
  const discardSetupSession = useMutation(
    api.setupSessions.discardSetupSession
  );
  const startSetupSession = useMutation(api.setupSessions.startSetupSession);

  const handleSetupReset = useCallback(async () => {
    if (!setupSessionForInlineCard) {
      return;
    }
    try {
      await discardSetupSession({
        sessionId: setupSessionForInlineCard.sessionId,
      });
      const next = await startSetupSession({
        mode: setupSessionForInlineCard.mode,
      });
      router.push(buildSetupHref(next.threadId));
      toast.success("Starting a fresh setup from step one.");
    } catch (error) {
      toast.error("Could not reset setup", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [
    discardSetupSession,
    router,
    setupSessionForInlineCard,
    startSetupSession,
  ]);

  const handleSetupDeleteDraft = useCallback(async () => {
    if (!setupSessionForInlineCard) {
      return;
    }
    try {
      const result = await discardSetupSession({
        sessionId: setupSessionForInlineCard.sessionId,
      });
      if (!result.hasDefaultWorkspace) {
        const next = await startSetupSession({
          mode: setupSessionForInlineCard.mode,
        });
        router.push(buildSetupHref(next.threadId));
        toast.success("Draft removed. Starting setup again.");
        return;
      }
      setPreferredShellContext("workspace");
      router.push("/");
      toast.success("Draft removed. Switched back to your workspace.");
    } catch (error) {
      toast.error("Could not delete draft", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [
    discardSetupSession,
    router,
    setupSessionForInlineCard,
    startSetupSession,
  ]);

  const setupDraftMenu = showSetupDraftMenu ? (
    <SetupOnboardingCardMenu
      onConfirmReset={handleSetupReset}
      onConfirmDeleteDraft={handleSetupDeleteDraft}
    />
  ) : null;
  const shellStateQuery = useQueryWithStatus(
    api.shell.getAppShellState,
    preferredShellQueryArgs
  );
  const shellSetupSessionStatus = shellStateQuery.data?.activeSetupSession
    ?.status as Parameters<typeof isSetupComposerLocked>[0] | undefined;
  const setupSessionLocksComposer =
    isSetupRoute &&
    (setupSessionForInlineCard
      ? setupSessionForInlineCard.composerLocked
      : shellStateQuery.data?.activeContextType === "setup_session" &&
        shellSetupSessionStatus != null &&
        isSetupComposerLocked(shellSetupSessionStatus));
  const setupSessionUnavailable =
    isSetupRoute && !isSetupDraftLoading && !setupSessionForInlineCard;
  const isComposerLocked = isSetupCollectingAudience
    ? isSetupReadingUrl
    : !isInitialized ||
      isLoading ||
      isStreaming ||
      (onboardingLock && !isSetupRoute) ||
      setupSessionLocksComposer ||
      setupSessionUnavailable ||
      (Boolean(prospectId) && prospectArchived) ||
      (isSetupRoute && isSetupReadingUrl);
  const showComposerStop =
    !isSetupAudienceEntry &&
    (isSetupRoute ? isStreaming : isLoading || isStreaming);
  const showSetupPreviewStrip =
    showSetupInlineCard &&
    setupSessionForInlineCard?.inputPhase === "awaiting_preview_approval";
  const setupPreviewSummariesQuery = useQueryWithStatus(
    api.setupSessions.getSetupPreviewSummaries,
    showSetupPreviewStrip && setupSessionForInlineCard
      ? { sessionId: setupSessionForInlineCard.sessionId }
      : "skip"
  );
  const setupPreviewStripParticipants = useMemo(() => {
    const rows = setupPreviewSummariesQuery.data ?? [];
    return rows.slice(0, 4).map((prospect) => {
      const card = buildSetupPreviewProfileData(prospect);
      const name =
        typeof card.profileData.displayName === "string"
          ? card.profileData.displayName
          : "Preview";
      const avatarUrl =
        typeof card.profileData.avatarUrl === "string"
          ? card.profileData.avatarUrl
          : undefined;
      return { name, avatarUrl };
    });
  }, [setupPreviewSummariesQuery.data]);
  const setupPreviewEntityPlural = useMemo(() => {
    if (!setupSessionForInlineCard) {
      return "people";
    }
    return getWorkspaceUseCase(
      setupSessionForInlineCard.useCaseKey
    ).entityPlural.toLowerCase();
  }, [setupSessionForInlineCard]);
  const approveSetupGeneration = useMutation(
    api.setupSessions.approveSetupGeneration
  );
  const [isApprovingSetupPreview, setIsApprovingSetupPreview] = useState(false);
  const approvingSetupPreviewRef = useRef(false);
  const [isApprovingSetupIcps, setIsApprovingSetupIcps] = useState(false);
  const approvingSetupIcpsRef = useRef(false);
  const handleApproveSetupIdealProfiles = useCallback(async () => {
    if (!setupSessionForInlineCard || approvingSetupIcpsRef.current) return;

    approvingSetupIcpsRef.current = true;
    setIsApprovingSetupIcps(true);
    try {
      await sendMessage("I approve these ideal profiles. Continue with setup.");
    } finally {
      approvingSetupIcpsRef.current = false;
      setIsApprovingSetupIcps(false);
    }
  }, [sendMessage, setupSessionForInlineCard]);
  const isSetupApprovalTurnPending =
    isApprovingSetupIcps ||
    (pendingTurn?.prompt ===
      "I approve these ideal profiles. Continue with setup." &&
      pendingTurn.phase !== "failed" &&
      pendingTurn.phase !== "finished");
  const handleApproveSetupPreview = useCallback(async () => {
    if (!setupSessionForInlineCard || approvingSetupPreviewRef.current) {
      return;
    }

    approvingSetupPreviewRef.current = true;
    setIsApprovingSetupPreview(true);
    try {
      await approveSetupGeneration({
        sessionId: setupSessionForInlineCard.sessionId,
      });
    } catch (error) {
      toast.error("Could not continue setup", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      approvingSetupPreviewRef.current = false;
      setIsApprovingSetupPreview(false);
    }
  }, [approveSetupGeneration, setupSessionForInlineCard]);
  const currentGenerationHasSnapshot = Boolean(
    setupSessionForInlineCard &&
    setupProfileSnapshots?.some(
      (snapshot) =>
        snapshot.generationRevision ===
        setupSessionForInlineCard.generationRevision
    )
  );
  const shouldShowLiveSetupCard =
    showSetupInlineCard &&
    setupSessionForInlineCard &&
    !(
      setupSessionForInlineCard.inputPhase === "awaiting_icp_approval" &&
      currentGenerationHasSnapshot
    );
  const setupInlineContent =
    shouldShowLiveSetupCard && setupSessionForInlineCard ? (
      <div className="flex min-w-0 flex-col gap-3">
        {showSetupPreviewStrip && setupPreviewStripParticipants.length > 0 ? (
          <section aria-label="Preview results">
            <InlineFeatureStrip
              leading={
                <>
                  <AvatarStack
                    size="sm"
                    maxVisible={4}
                    participants={setupPreviewStripParticipants}
                  />
                  <span className="min-w-0 truncate text-sm font-medium">
                    <span className="font-mono tabular-nums">
                      {setupSessionForInlineCard.previewProspectIds.length ||
                        setupPreviewStripParticipants.length}
                    </span>
                    {` preview ${setupPreviewEntityPlural}`}
                  </span>
                </>
              }
              trailing={
                <>
                  <Button
                    type="button"
                    size="xs"
                    disabled={isApprovingSetupPreview}
                    onClick={() => void handleApproveSetupPreview()}
                  >
                    {isApprovingSetupPreview ? "Continuing..." : "Continue"}
                  </Button>
                  <Button
                    type="button"
                    size="xsIcon"
                    variant="outline"
                    aria-label="Open preview panel"
                    onClick={onOpenSetupOnboardingPanel}
                  >
                    <OpenInNewIcon className="fill-current" />
                  </Button>
                </>
              }
            />
          </section>
        ) : null}
        <SetupOnboardingInlineCard
          sessionId={setupSessionForInlineCard.sessionId}
          mode={setupSessionForInlineCard.mode}
          useCaseKey={setupSessionForInlineCard.useCaseKey}
          title={getSetupPanelStepTitle(
            setupSessionForInlineCard.currentStepId
          )}
          stepNumber={setupSessionForInlineCard.currentStepNumber}
          stepTotal={setupSessionForInlineCard.totalSteps}
          inputPhase={setupSessionForInlineCard.inputPhase}
          generatedProfiles={setupSessionForInlineCard.generatedProfiles}
          previewProgress={setupSessionForInlineCard.previewProgress}
          statusUpdatedAt={setupSessionForInlineCard.statusUpdatedAt}
          onContinue={onOpenSetupOnboardingPanel}
          onApproveIdealProfiles={handleApproveSetupIdealProfiles}
          isApprovalPending={isSetupApprovalTurnPending}
        />
      </div>
    ) : null;
  const activeGenerationSourceOrder =
    setupSessionForInlineCard?.generationSourceMessageId
      ? renderedDisplayMessages.find(
          (message) =>
            message.role === "user" &&
            message.id === setupSessionForInlineCard.generationSourceMessageId
        )?.order
      : undefined;
  const setupInlineAnchorMessageKey =
    setupInlineContent && !shouldShowPendingUserMessage
      ? (renderedDisplayMessages.find(
          (message) =>
            message.role === "assistant" &&
            message.order === activeGenerationSourceOrder
        )?.key ?? null)
      : null;
  const renderSetupProfileSnapshot = useCallback(
    (snapshot: SetupProfileSnapshot) => {
      const isCurrentApproval =
        setupSessionForInlineCard?.status === "awaiting_icp_confirmation" &&
        setupSessionForInlineCard.generationRevision ===
          snapshot.generationRevision;

      return (
        <SetupOnboardingInlineCard
          sessionId={snapshot.sessionId}
          mode={snapshot.mode}
          useCaseKey={snapshot.useCaseKey}
          title="Review ideal profiles"
          stepNumber={1}
          stepTotal={1}
          inputPhase="awaiting_icp_approval"
          generatedProfiles={snapshot.generatedProfiles}
          previewProgress={{
            discoveredCount: 0,
            qualifiedCount: 0,
            enrichedCount: 0,
            selectedCount: 0,
          }}
          statusUpdatedAt={snapshot.createdAt}
          isApprovalPending={isSetupApprovalTurnPending}
          onContinue={
            isCurrentApproval ? onOpenSetupOnboardingPanel : undefined
          }
          onApproveIdealProfiles={
            isCurrentApproval ? handleApproveSetupIdealProfiles : undefined
          }
        />
      );
    },
    [
      handleApproveSetupIdealProfiles,
      isSetupApprovalTurnPending,
      onOpenSetupOnboardingPanel,
      setupSessionForInlineCard,
    ]
  );
  const handleTriggerMentionInsertion = useCallback(() => {
    if (!agentComposerApi || isComposerLocked) {
      return;
    }

    agentComposerApi.insertEmoji("@");
  }, [agentComposerApi, isComposerLocked]);
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
  const lastNotifiedEffectiveThreadIdRef = useRef<string | null | undefined>(
    undefined
  );

  useEffect(() => {
    if (!threadId) {
      hasUrlUpdated.current = false;
    }
  }, [threadId]);

  // The setup route owns a couple of transient query params, so it still needs
  // a local URL canon step before the parent shell takes over thread syncing.
  useEffect(() => {
    if (pathname !== "/agent/setup") {
      return;
    }

    const nextThreadId = generatedThreadId ?? effectiveThreadId;
    if (nextThreadId && !threadId && !hasUrlUpdated.current) {
      hasUrlUpdated.current = true;
      const url = new URL(window.location.href);
      url.searchParams.set("threadId", nextThreadId);
      url.searchParams.delete("sessionId");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search
      );
    }
  }, [effectiveThreadId, generatedThreadId, pathname, threadId]);

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
  const composerDisplayAttachments = useMemo(
    () => [
      ...chatAttachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mediaUrl: attachment.mediaUrl,
        status: attachment.status,
        onRemove: () => handleRemoveAttachment(attachment.id),
      })),
      ...selectedAttachmentEntities
        .map((entity) =>
          buildDisplayAttachmentFromEntity(entity, () => {
            setMentionComposerState((current) => ({
              ...current,
              selectedEntities: current.selectedEntities.filter(
                (item) => item.id !== entity.id
              ),
            }));
          })
        )
        .filter(
          (attachment): attachment is DisplayAttachment => attachment !== null
        ),
    ],
    [chatAttachments, handleRemoveAttachment, selectedAttachmentEntities]
  );

  if ((deferSetupHandoff && isSetupRoute) || isExplicitSetupThreadHydrating) {
    return (
      <div className="flex h-full w-full flex-col">
        <ChatHeader
          onBack={onBack}
          threadActionsReady={threadActionsReady}
          isSetupComplete={false}
        />
        <div
          className="flex min-h-0 flex-1 items-center justify-center"
          role="status"
          aria-label="Loading setup conversation"
        >
          <Spinner variant="circle" className="size-5" />
        </div>
      </div>
    );
  }

  // Bare /agent already knows its final empty-state layout. Render that exact
  // centered composer disabled during initialization so it never jumps from a
  // bottom-positioned skeleton. Contextual routes still need a chat skeleton.
  // Setup audience entry uses the chat-first empty state instead of skeleton.
  if (
    !isInitialized &&
    !isBareWorkspaceDraft &&
    !isSetupAudienceEntry &&
    !hasSetupUserMessage
  ) {
    return (
      <ChatSkeleton
        onBack={onBack}
        threadActionsReady={threadActionsReady}
        onHistoryClick={onHistoryClick}
        onNewThread={onNewThread}
        onOpenDmPanel={onOpenDmPanel}
      />
    );
  }

  if (
    shouldShowHydrationSkeleton &&
    !showSetupInlineCard &&
    !isSetupAudienceEntry
  ) {
    return (
      <ChatSkeleton
        onBack={onBack}
        threadActionsReady={threadActionsReady}
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
  // Setup audience entry: hide greeting noise and show chat-first empty entry.
  // Keep empty entry visible even while bootstrap/greeting isLoading.
  const showEmptyState =
    isSetupAudienceEntry ||
    (!hasTranscriptActivity && !showSetupInlineCard && !isLoading);
  const showProspectEmptyState =
    showEmptyState && !!prospectId && prospect !== null;
  const showCenteredWorkspaceEmptyState =
    showEmptyState && !showProspectEmptyState;
  const visibleSetupDisplayMessages = isSetupAudienceEntry
    ? EMPTY_UI_MESSAGES
    : renderedDisplayMessages;

  const composerContent = (
    <>
      {composerDisplayAttachments.length > 0 ? (
        <div className={cn(AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME, "mb-2")}>
          <AgentAttachmentList attachments={composerDisplayAttachments} />
        </div>
      ) : null}
      <div
        className={cn(
          AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME,
          "border-input bg-background ring-offset-background focus-within:ring-ring cursor-text rounded-xl border p-2 transition-shadow focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-hidden",
          isComposerLocked && "cursor-not-allowed opacity-60"
        )}
        onClick={(event) => {
          if (isSetupReadingUrl) {
            return;
          }
          const target = event.currentTarget.querySelector<HTMLElement>(
            "[contenteditable='true']"
          );
          target?.focus();
        }}
        onPasteCapture={
          isSetupCollectingAudience ? handleSetupUrlPasteCapture : undefined
        }
      >
        <ComposerEditor
          key={mentionScopeKey}
          className="min-h-10 text-sm"
          initialContent={buildSerializedTextState(input)}
          placeholder={
            isSetupCollectingAudience
              ? SETUP_AUDIENCE_COMPOSER_PLACEHOLDER
              : isSetupRoute &&
                  setupSessionForInlineCard?.inputPhase ===
                    "awaiting_icp_approval"
                ? "Ask to add, remove, or refine an ideal profile…"
                : isSetupRoute && setupSessionLocksComposer
                  ? "Chat is locked during this setup step."
                  : displayMessages.length > 0
                    ? "Type here..."
                    : emptyPromptPlaceholder
          }
          maxLength={10000}
          characterCountMode="raw"
          showCharacterCount={false}
          disabled={isComposerLocked}
          contentEditableClassName={cn(
            DM_COMPOSER_CONTENT_EDITABLE_CLASS,
            "max-h-60"
          )}
          composerPlaceholderClassName={DM_COMPOSER_PLACEHOLDER_CLASS}
          inlineAutocompleteContext={
            isSetupCollectingAudience
              ? undefined
              : agentInlineAutocompleteContext
          }
          enableEntityMentions={!isSetupCollectingAudience}
          entityMentions={
            isSetupCollectingAudience
              ? undefined
              : {
                  workspaceId: effectiveWorkspaceId,
                  prospectId: prospectId ?? null,
                  localEntities: threadPostMentionEntities,
                  remoteAllowedKinds: [
                    "prospect",
                    "plan",
                    "task",
                    "post",
                    "attachment",
                  ],
                  onSelectEntity: handleSelectMentionEntity,
                  buildInsertionText: buildAgentMentionReplacementText,
                }
          }
          onContentChange={handleAgentComposerContentChange}
          onBridgeReady={setAgentComposerApi}
          submitOnEnter
          onSubmitShortcut={handleSendWithAttachments}
        />
        <div className="pt-0.5">
          <UrlDescriptionFooterSlot
            statusText={setupUrlStatusText}
            isReadingUrl={Boolean(setupUrlStatusText)}
            onCancel={cancelSetupUrlRead}
            idleLeft={
              <div className="flex items-center gap-1">
                <input
                  ref={attachFileInputRef}
                  type="file"
                  multiple
                  accept={CHAT_ATTACHMENT_ACCEPT}
                  className="hidden"
                  onChange={(event) => {
                    void handleAttachFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <Button
                  variant="ghost"
                  size="xsIcon"
                  type="button"
                  onClick={() => attachFileInputRef.current?.click()}
                  disabled={isComposerLocked || isSetupCollectingAudience}
                  aria-label="Attach media"
                  title={
                    isSetupCollectingAudience
                      ? "Available after setup"
                      : "Attach media for the △ Agent to use"
                  }
                >
                  <AttachFileIcon className="fill-current" />
                </Button>
                {!isSetupCollectingAudience ? (
                  <MentionPickerButton
                    disabled={isComposerLocked}
                    onTriggerMention={handleTriggerMentionInsertion}
                  />
                ) : null}
              </div>
            }
            idleRight={
              showComposerStop ? (
                <MessageAction tooltip="Stop generating">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xsIcon"
                    onClick={stop}
                    aria-label="Stop generating"
                    title="Stop generating"
                  >
                    <StopIcon className="fill-current" />
                  </Button>
                </MessageAction>
              ) : (
                <MessageAction tooltip="Send message">
                  <Button
                    type="button"
                    variant="default"
                    size="xsIcon"
                    onClick={handleSendWithAttachments}
                    aria-label="Send message"
                    title="Send message"
                    disabled={
                      (!input.trim() &&
                        readyAttachments.length === 0 &&
                        selectedMentionEntities.length === 0) ||
                      hasUploadingAttachment ||
                      isComposerLocked
                    }
                  >
                    <ArrowUpwardIcon className="fill-current" />
                  </Button>
                </MessageAction>
              )
            }
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <ChatHeader
        onBack={onBack}
        onHistoryClick={onHistoryClick}
        onNewThread={onNewThread}
        threadActionsReady={threadActionsReady}
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
        setupDraftMenu={setupDraftMenu}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Chat Messages Area - scrollable container */}
        <div className="relative min-h-0 flex-1">
          <MessageScrollerProvider autoScroll defaultScrollPosition="end">
            <MessageScroller className="relative h-full min-h-0">
              <AgentHistoryLoadingIndicator
                isLoading={messageStatus === "LoadingMore"}
              />
              <MessageScrollerViewport onScroll={handleMessageScroll}>
                <MessageScrollerContent
                  className={cn(
                    AGENT_CHAT_CONTENT_COLUMN_CLASS_NAME,
                    "gap-0 px-4 pt-4 pb-16",
                    showCenteredWorkspaceEmptyState &&
                      "flex min-h-full flex-col justify-center"
                  )}
                >
                  {!isSetupRoute ? (
                    <MessageScrollerItem
                      messageId="plan-limit"
                      className="mb-4"
                    >
                      <WorkspacePlanLimitAlert />
                    </MessageScrollerItem>
                  ) : null}

                  {visibleSetupDisplayMessages.map((message) => (
                    <MessageScrollerItem
                      key={message.key}
                      messageId={message.key}
                      className="mb-6"
                      scrollAnchor={
                        message.key === currentUserMessageScrollAnchorKey
                      }
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.25,
                          ease: [0.25, 0.1, 0.25, 1],
                        }}
                      >
                        <ChatMessage
                          message={message}
                          threadId={effectiveThreadId ?? undefined}
                          userImage={userDisplayImage ?? undefined}
                          userName={userDisplayName}
                          threadModelName={threadModelName}
                          onOpenPanelFromCard={onOpenPanelFromCard}
                          onOpenPlanPanel={onOpenPlanPanel}
                          onOpenWorkspaceProfilePanel={
                            onOpenWorkspaceProfilePanel
                          }
                          showReasoning={!isSetupRoute}
                          supplementalContent={
                            setupProfileSnapshotByAssistantKey.has(message.key)
                              ? renderSetupProfileSnapshot(
                                  setupProfileSnapshotByAssistantKey.get(
                                    message.key
                                  )!
                                )
                              : message.key === setupInlineAnchorMessageKey
                                ? setupInlineContent
                                : undefined
                          }
                        />
                      </motion.div>
                    </MessageScrollerItem>
                  ))}

                  {shouldShowPendingUserMessage && pendingUserPrompt && (
                    <MessageScrollerItem
                      key="pending-user"
                      messageId="pending-user"
                      className="mb-6"
                      scrollAnchor
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.25,
                          ease: [0.25, 0.1, 0.25, 1],
                        }}
                      >
                        <LocalUserMessage
                          text={pendingUserPrompt}
                          userImage={userDisplayImage ?? undefined}
                          userName={userDisplayName}
                        />
                      </motion.div>
                    </MessageScrollerItem>
                  )}

                  <AnimatePresence mode="wait">
                    {shouldShowPendingAssistantRow &&
                    pendingTurn &&
                    !isSetupAudienceEntry ? (
                      <MessageScrollerItem
                        key="pending-turn"
                        messageId="pending-turn"
                        className="mb-6"
                      >
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            duration: 0.2,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                        >
                          <PendingAssistantMessage
                            pendingTurn={pendingTurn}
                            onStop={stop}
                          />
                        </motion.div>
                      </MessageScrollerItem>
                    ) : null}
                  </AnimatePresence>

                  {shouldShowPendingError && pendingTurn?.errorMessage && (
                    <MessageScrollerItem
                      messageId="pending-error"
                      className="mb-6"
                    >
                      <SystemMessage variant="error">
                        {pendingTurn.errorMessage}
                      </SystemMessage>
                    </MessageScrollerItem>
                  )}

                  {setupInlineContent &&
                  setupInlineAnchorMessageKey === null &&
                  !shouldShowPendingAssistantRow ? (
                    <MessageScrollerItem
                      messageId="setup-inline-status"
                      className="mb-6"
                    >
                      <SetupInlineAgentMessage>
                        {setupInlineContent}
                      </SetupInlineAgentMessage>
                    </MessageScrollerItem>
                  ) : null}

                  {showProspectEmptyState ? (
                    <MessageScrollerItem
                      messageId="prospect-empty"
                      className="mb-6"
                    >
                      <div className="flex min-h-96 items-start justify-center">
                        <AgentProspectEmptyState
                          prospect={prospectDisplayData}
                          isLoading={prospectQuery.isPending}
                          onViewProfile={onViewProfile}
                        />
                      </div>
                    </MessageScrollerItem>
                  ) : (
                    showEmptyState && (
                      <MessageScrollerItem
                        messageId="chat-empty"
                        className="mb-6"
                      >
                        <AgentWorkspaceEmptyState
                          isResolving={
                            !isInitialized ||
                            isWorkspaceLoading ||
                            workspaceStatusQuery.isPending
                          }
                          headline={
                            isSetupRoute ? "Who should Agent find?" : undefined
                          }
                        >
                          {composerContent}
                        </AgentWorkspaceEmptyState>
                      </MessageScrollerItem>
                    )
                  )}

                  {error && pendingTurn?.phase !== "failed" && (
                    <MessageScrollerItem
                      messageId="chat-error"
                      className="mb-6"
                    >
                      <SystemMessage variant="error">
                        {error.message || "Please try again."}
                      </SystemMessage>
                    </MessageScrollerItem>
                  )}
                  {workspaceStatusQuery.isError && (
                    <MessageScrollerItem
                      messageId="workspace-status-error"
                      className="mb-6"
                    >
                      <SystemMessage variant="warning">
                        {workspaceStatusQuery.error.message ||
                          "Workspace status is unavailable. Agent actions may be limited until this resolves."}
                      </SystemMessage>
                    </MessageScrollerItem>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton variant="outline" className="shadow-sm" />
            </MessageScroller>
          </MessageScrollerProvider>
        </div>

        {!showCenteredWorkspaceEmptyState ? (
          <div className="bg-background shrink-0 px-4 pb-4 backdrop-blur-xl">
            {composerContent}
          </div>
        ) : null}
      </div>
    </div>
  );
}
