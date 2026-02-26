"use client";

/**
 * AgentChat - Main agent chat interface with streaming support
 *
 * Per docs: https://docs.convex.dev/agents/streaming#text-smoothing-with-smoothtext-and-usesmoothtext
 * Uses useSmoothText from @convex-dev/agent/react for smooth streaming text.
 */

import { useAgentChat, type UIMessage } from "../hooks";
import { useSmoothText } from "@convex-dev/agent/react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  getSuggestions,
  getToolNameFromPart,
  isSuccessfulToolCall,
  isToolPart,
  type ToolPartLike,
} from "../lib";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/shared/ui/components/ChatContainer";
import { TextShimmerLoader } from "@/shared/ui/components/Loader";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/shared/ui/components/PromptInput";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/shared/ui/components/Message";
import { PromptSuggestion } from "@/shared/ui/components/PromptSuggestion";
import { ScrollArea, ScrollBar } from "@/shared/ui/components/ScrollArea";
import { Tool, type ToolPart } from "@/shared/ui/components/Tool";
import { PostCard } from "./components/PostCard";
import { Button } from "@/shared/ui/components/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";
import { useWorkspaceTransition } from "@/features/webapp/contexts/WorkspaceTransitionContext";
import {
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowUpwardIcon,
  AttachFileIcon,
  StopIcon,
  AlternateEmailIcon,
  AddIcon,
  SearchActivityIcon,
  ArrowBackIcon,
} from "@/shared/ui/components/icons";

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
}

type MessagePart = NonNullable<UIMessage["parts"]>[number];
type ToolMessagePart = MessagePart & ToolPartLike;

interface ProgressStep {
  step: string;
  status: "pending" | "running" | "completed" | "failed";
  details?: string;
  count?: number;
}

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
  /** Callback when effective thread ID changes (resolved from URL or internal state) */
  onEffectiveThreadIdChange?: (threadId: string | null) => void;
}

// ============================================================================
// Progress Steps Component (for searchProspects and similar tools)
// ============================================================================

function ProgressStepsDisplay({ progress }: { progress: ProgressStep[] }) {
  if (!progress.length) return null;

  const getStatusIcon = (status: ProgressStep["status"]) => {
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
  };

  return (
    <div className="bg-muted/30 rounded-lg border p-3">
      <div className="space-y-2">
        {progress.map((step, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <div className="mt-0.5 shrink-0">{getStatusIcon(step.status)}</div>
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

function ToolCallVisualization({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  if (!toolCalls.length) return null;

  // Map tool names to user-friendly labels
  const toolLabels: Record<string, string> = {
    analyzeUrl: "Analyzing website",
    generateImprovedDescriptionAndICPs: "Generating ICPs",
    getUserStatus: "Checking account",
    createWorkspace: "Creating workspace",
    updateWorkspace: "Updating workspace",
    searchProspects: "Finding prospects",
    generateSeedKeywords: "Generating keywords",
    convertToSocialQueries: "Converting to social queries",
    displayPost: "Showing post",
    analyzeBestEngagement: "Analyzing engagement opportunity",
  };

  // Tools that should render PostCard for generative UI
  const postRenderingTools = ["displayPost", "analyzeBestEngagement"];

  return (
    <div className="space-y-2">
      {toolCalls.map((tc, idx) => {
        // Check if this tool result has a progress array (e.g., searchProspects)
        const result = tc.result as Record<string, unknown> | undefined;
        const hasProgress =
          result &&
          Array.isArray(result.progress) &&
          result.progress.length > 0;

        // Generative UI: Render PostCard for displayPost/analyzeBestEngagement tools
        // Handle both Convex Agent states ("result") and AI SDK states ("output-available")
        const isToolComplete =
          tc.state === "result" || tc.state === "output-available";
        if (
          postRenderingTools.includes(tc.toolName) &&
          isToolComplete &&
          result
        ) {
          // displayPost returns { success, platform, postData, context }
          // analyzeBestEngagement returns { success, tweets: [...] }
          const hasPostData = result.postData !== undefined;
          const hasTweets =
            Array.isArray(result.tweets) && result.tweets.length > 0;

          if (hasPostData || hasTweets) {
            // For displayPost, show single post
            if (hasPostData) {
              return (
                <PostCard
                  key={`${tc.toolName}-${idx}`}
                  platform={
                    (result.platform as "twitter" | "linkedin") || "twitter"
                  }
                  postData={result.postData}
                  context={result.context as string | undefined}
                />
              );
            }

            // For analyzeBestEngagement, show first/recommended tweet
            if (hasTweets) {
              const tweets = result.tweets as Array<Record<string, unknown>>;
              return (
                <div key={`${tc.toolName}-${idx}`} className="space-y-2">
                  {tweets.slice(0, 1).map((tweet, tweetIdx) => (
                    <PostCard
                      key={`tweet-${tweetIdx}`}
                      platform="twitter"
                      postData={tweet}
                      context={
                        tweetIdx === 0 ? "Tweet to engage with:" : undefined
                      }
                    />
                  ))}
                </div>
              );
            }
          }
        }

        // If tool has progress steps, show the progress display instead of raw Tool
        if (hasProgress && tc.state === "result") {
          return (
            <div key={`${tc.toolName}-${idx}`} className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">
                  {toolLabels[tc.toolName] || tc.toolName}
                </span>
              </div>
              <ProgressStepsDisplay
                progress={result.progress as ProgressStep[]}
              />
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
          type: toolLabels[tc.toolName] || tc.toolName,
          state:
            tc.state === "call" || tc.state === "partial-call"
              ? "input-streaming"
              : tc.result
                ? "output-available"
                : "input-available",
          input: tc.args,
          output: tc.result as Record<string, unknown> | undefined,
          toolCallId: tc.toolCallId,
        };

        return <Tool key={`${tc.toolName}-${idx}`} toolPart={toolPart} />;
      })}
    </div>
  );
}

// ============================================================================
// Thinking Indicator Component
// ============================================================================

function ThinkingIndicator() {
  return (
    <Message className="items-start">
      <div className="flex items-center gap-2 py-2">
        <Sparkles className="text-primary h-4 w-4 animate-pulse" />
        <TextShimmerLoader text="Thinking" size="sm" />
      </div>
    </Message>
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
      console.error("Failed to copy:", err);
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

/**
 * Per docs: https://docs.convex.dev/agents/streaming#text-smoothing-with-smoothtext-and-usesmoothtext
 * Use useSmoothText hook for smooth streaming text display.
 */
function ChatMessage({
  message,
  userImage,
  userName,
}: {
  message: UIMessage;
  userImage?: string;
  userName?: string;
}) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isStreaming = message.status === "streaming";

  // Per docs: useSmoothText smooths text as it streams
  // Pass startStreaming: true when message is actively streaming
  // IMPORTANT: Hook must be called unconditionally (Rules of Hooks)
  const [visibleText] = useSmoothText(message.text ?? "", {
    startStreaming: isStreaming,
  });

  // Early return AFTER hook call to satisfy Rules of Hooks
  if (!isUser && !isAssistant) return null;

  const displayText = visibleText;

  // Extract tool calls from message parts

  // Convex-agent uses AI SDK UIMessage with parts: "tool-{toolName}" pattern
  // e.g., "tool-displayPost", "tool-analyzeBestEngagement"
  // Per AI SDK 5.0 generative UI docs
  const toolCalls: ToolCallInfo[] = [];
  const toolParts = (message.parts || []).filter(
    (part): part is ToolMessagePart => isToolPart(part)
  );

  // Build tool calls from parts - deduplicate by toolCallId
  // Tool parts can appear multiple times with different states (call -> result)
  // We only want the final state for each unique toolCallId
  const seenToolCallIds = new Set<string>();
  for (const part of toolParts) {
    const toolCallId = part.toolCallId;

    // Skip duplicates by toolCallId (keep first occurrence which has final state)
    if (toolCallId && seenToolCallIds.has(toolCallId)) continue;
    if (toolCallId) seenToolCallIds.add(toolCallId);

    // Extract toolName from part.type (e.g., "tool-displayPost" -> "displayPost")
    const toolName = getToolNameFromPart(part);

    const toolCall: ToolCallInfo = {
      toolName,
      // State indicates progress: "call" | "partial-call" | "result"
      state: (part.state as ToolCallInfo["state"]) || "result",
      args: part.input as Record<string, unknown> | undefined,
      result: part.output as Record<string, unknown> | undefined,
      toolCallId,
    };

    toolCalls.push(toolCall);
  }

  // Don't render empty messages unless streaming
  if (!displayText && !isStreaming && !toolCalls.length) return null;

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

  // Assistant message - with agent avatar, no bubble (plain text), sm font size
  return (
    <Message className="items-start">
      <MessageAvatar
        alt="Agent"
        fallback="🆁"
        className="bg-background text-foreground"
        avatarClassName="rounded-md"
      />
      <div className="flex max-w-[85%] flex-col gap-2">
        {/* Tool calls visualization */}
        {toolCalls.length > 0 && (
          <ToolCallVisualization toolCalls={toolCalls} />
        )}

        {/* Message content with markdown - plain variant (no bubble), xs font size */}
        {(displayText || isStreaming) && (
          <MessageContent
            markdown={true}
            variant="plain"
            textSize="sm"
            className={cn(isStreaming && !displayText && "animate-pulse")}
          >
            {displayText || " "}
          </MessageContent>
        )}

        {/* Streaming cursor */}
        {isStreaming && displayText && (
          <span className="bg-foreground/50 ml-1 inline-block h-4 w-1 animate-pulse" />
        )}

        {/* Copy action for assistant messages - always visible */}
        {displayText && !isStreaming && (
          <MessageActions>
            <CopyButton text={displayText} />
          </MessageActions>
        )}

        {/* Error indicator per docs */}
        {message.status === "failed" && (
          <div className="text-destructive mt-1 text-sm">
            Error generating response. Please try again.
          </div>
        )}
      </div>
    </Message>
  );
}

// ============================================================================
// Dynamic Suggestions Component
// ============================================================================

interface SuggestionsProps {
  onSelect: (suggestion: string) => void;
  phase: ReturnType<typeof getSuggestions> extends (infer T)[] ? string : never;
  disabled: boolean;
}

function Suggestions({ onSelect, phase, disabled }: SuggestionsProps) {
  const suggestions = getSuggestions(
    phase as Parameters<typeof getSuggestions>[0]
  );

  if (!suggestions.length || disabled) return null;

  return (
    <ScrollArea className="w-full pb-2">
      <div className="flex gap-2">
        {suggestions.map((suggestion) => (
          <PromptSuggestion
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            disabled={disabled}
            size="xs"
            className="shrink-0 rounded-md"
          >
            {suggestion}
          </PromptSuggestion>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
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
}

function ChatHeader({
  onBack,
  onHistoryClick,
  onNewThread,
  isSetupComplete = false,
}: ChatHeaderProps) {
  const showButtons = onHistoryClick !== undefined;
  const buttonsDisabled = !isSetupComplete;

  return (
    <header className="bg-background sticky top-0 right-0 left-0 z-10 flex h-10 shrink-0 items-center justify-between border-b py-2 pr-4 pl-2.5">
      <div className="flex items-center gap-1">
        {onBack && (
          <Button
            variant="ghost"
            size="xsIcon"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowBackIcon className="fill-current" />
          </Button>
        )}
        <h1 className="text-sm font-medium">🆁 Agent</h1>
      </div>
      {showButtons && (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={onHistoryClick}
                    disabled={buttonsDisabled}
                  >
                    <SearchActivityIcon className="fill-current" />
                    History
                  </Button>
                </span>
              </TooltipTrigger>
              {buttonsDisabled && (
                <TooltipContent>Complete workspace setup first</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {onNewThread && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={onNewThread}
                      disabled={buttonsDisabled}
                    >
                      <AddIcon className="fill-current" />
                      New
                    </Button>
                  </span>
                </TooltipTrigger>
                {buttonsDisabled && (
                  <TooltipContent>
                    Complete workspace setup first
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
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
}: Pick<AgentChatProps, "onBack" | "onHistoryClick" | "onNewThread">) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header - renders same buttons as loaded state to prevent CLS */}
      <ChatHeader
        onBack={onBack}
        onHistoryClick={onHistoryClick}
        onNewThread={onNewThread}
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
  notificationId,
  onBack,
  onHistoryClick,
  onNewThread,
  onEffectiveThreadIdChange,
}: AgentChatProps) {
  const router = useRouter();
  const { startTransition } = useWorkspaceTransition();

  // Get WorkOS auth user for profile image (same as Header)
  const { user: authUser } = useAuth();

  const {
    messages,
    input,
    isLoading,
    isStreaming,
    error,
    isInitialized,
    generatedThreadId,
    threadId: effectiveThreadId,
    suggestionPhase,
    setInput,
    sendMessage,
    stop,
    loadMore,
    hasMore,
  } = useAgentChat({
    threadId: threadId ?? null,
    prospectId: prospectId ?? null,
    action: action ?? null,
  });

  // Get workspace to check for prospects
  const workspaceStatus = useQuery(api.workspaces.getWorkspaceSetupStatus);
  const workspaceId =
    workspaceStatus?.status === "complete"
      ? workspaceStatus.workspace.id
      : null;

  // Check if workspace has prospects (for auto-redirect)
  const hasProspects = useQuery(
    api.prospects.hasProspects,
    workspaceId ? { workspaceId } : "skip"
  );

  // Track if we've already redirected to prevent multiple redirects
  const hasSearchRedirected = useRef(false);
  const hasCreateWorkspaceRedirected = useRef(false);
  // Track if we've synced generatedThreadId to URL
  const hasUrlUpdated = useRef(false);

  // Sync generatedThreadId to URL when auto-generation completes
  // This ensures messages load correctly and page can be reloaded
  useEffect(() => {
    if (generatedThreadId && !threadId && !hasUrlUpdated.current) {
      hasUrlUpdated.current = true;
      // Update URL with new threadId and clear action param
      const url = new URL(window.location.href);
      url.searchParams.set("threadId", generatedThreadId);
      url.searchParams.delete("action");
      router.replace(url.pathname + url.search);
    }
  }, [generatedThreadId, threadId, router]);

  // Notify parent of effective thread ID changes (for HistoryPanel "Current" badge)
  useEffect(() => {
    if (onEffectiveThreadIdChange) {
      onEffectiveThreadIdChange(effectiveThreadId);
    }
  }, [effectiveThreadId, onEffectiveThreadIdChange]);

  // Auto-redirect to prospects page when prospects are found after searchProspects
  useEffect(() => {
    // Only redirect if:
    // 1. We have prospects
    // 2. We haven't already redirected
    // 3. We're not currently loading/streaming
    // 4. The last tool call was searchProspects with success
    if (
      hasProspects &&
      !hasSearchRedirected.current &&
      !isLoading &&
      !isStreaming
    ) {
      // Check if searchProspects was completed successfully
      const lastAssistantMessage = [...messages]
        .reverse()
        .find((m) => m.role === "assistant");
      if (lastAssistantMessage?.parts) {
        const searchProspectsResult = lastAssistantMessage.parts.find((part) =>
          isSuccessfulToolCall(part, "searchProspects")
        );

        if (searchProspectsResult) {
          hasSearchRedirected.current = true;
          // Small delay to let user see the success message
          setTimeout(() => {
            router.push("/");
          }, 2000);
        }
      }
    }
  }, [hasProspects, isLoading, isStreaming, messages, router]);

  // Redirect to prospects page immediately after successful createWorkspace.
  useEffect(() => {
    if (hasCreateWorkspaceRedirected.current || isLoading || isStreaming) {
      return;
    }

    const lastAssistantMessage = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");

    if (!lastAssistantMessage?.parts) {
      return;
    }

    const createWorkspaceResult = lastAssistantMessage.parts.find((part) =>
      isSuccessfulToolCall(part, "createWorkspace")
    );

    if (!createWorkspaceResult) {
      return;
    }

    hasCreateWorkspaceRedirected.current = true;
    startTransition("redirecting_after_create");
    router.push("/");
  }, [isLoading, isStreaming, messages, router, startTransition]);

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
      />
    );
  }

  // Filter out synthetic welcome message
  const displayMessages = messages.filter((m) => m.key !== "welcome-message");

  // Show suggestions when not loading/streaming
  const showSuggestions = !isLoading && !isStreaming;

  // Show thinking indicator when loading but not yet streaming
  const showThinking = isLoading && !isStreaming;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <ChatHeader
        onBack={onBack}
        onHistoryClick={onHistoryClick}
        onNewThread={onNewThread}
        isSetupComplete={workspaceStatus?.status === "complete"}
      />

      {/* Chat Messages Area - scrollable container */}
      <ChatContainerRoot className="min-h-0 flex-1">
        <ChatContainerContent className="px-4 py-4">
          {/* Load more button */}
          {hasMore && (
            <div className="mb-4 text-center">
              <Button size="xs" onClick={loadMore}>
                Load earlier messages
              </Button>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-6">
            {displayMessages.map((message) => (
              <ChatMessage
                key={message.key}
                message={message}
                userImage={userDisplayImage ?? undefined}
                userName={userDisplayName}
              />
            ))}

            {/* Thinking indicator when waiting for first token */}
            {showThinking && <ThinkingIndicator />}

            {/* Empty state - show when no messages and not loading */}
            {displayMessages.length === 0 && !showThinking && !isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-muted-foreground mb-4 text-4xl">💬</div>
                <h3 className="text-foreground mb-2 text-lg font-medium">
                  Start a new conversation
                </h3>
                <p className="text-muted-foreground max-w-sm text-sm">
                  {prospectId
                    ? "Ask the agent anything about this prospect, or click History to view past conversations."
                    : "Enter your website URL or describe your business to get started."}
                </p>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="border-destructive bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
                <p className="font-medium">Something went wrong</p>
                <p className="text-destructive/80 mt-1">
                  {error.message || "Please try again."}
                </p>
              </div>
            )}
          </div>

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Input Area - with backdrop blur */}
      <div className="bg-background shrink-0 px-4 pt-3 pb-4 backdrop-blur-xl">
        {/* Dynamic Suggestions */}
        <Suggestions
          phase={suggestionPhase}
          onSelect={(suggestion) => sendMessage(suggestion)}
          disabled={isLoading || isStreaming}
        />

        {/* Input */}
        <PromptInput
          value={input}
          onValueChange={setInput}
          onSubmit={() => sendMessage()}
          isLoading={isLoading}
        >
          <PromptInputTextarea
            className="px-1 pt-0.5"
            placeholder={
              displayMessages.length > 0
                ? "Type here..."
                : "Enter your website URL or describe your business..."
            }
            disabled={isLoading || isStreaming}
          />
          <PromptInputActions className="justify-between pt-1">
            {/* Left actions - Coming soon features */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="xsIcon" disabled>
                      <AttachFileIcon className="fill-current" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Coming soon!</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="xsIcon" disabled>
                      <AlternateEmailIcon className="fill-current" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Coming soon!</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Right action - Send/Stop */}
            {isLoading || isStreaming ? (
              <PromptInputAction tooltip="Stop generating">
                <Button variant="ghost" size="xsIcon" onClick={stop}>
                  <StopIcon className="fill-current" />
                </Button>
              </PromptInputAction>
            ) : (
              <PromptInputAction tooltip="Send message">
                <Button
                  variant="default"
                  size="xsIcon"
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
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
