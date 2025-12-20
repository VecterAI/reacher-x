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
import { getSuggestions } from "../lib/suggestions";
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
import { Button } from "@/shared/ui/components/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/components/Tooltip";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";
import {
  Send,
  Square,
  Sparkles,
  Copy,
  Check,
  Paperclip,
  AtSign,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

interface ToolCallInfo {
  toolName: string;
  state: "call" | "result" | "partial-call";
  args?: Record<string, unknown>;
  result?: unknown;
  toolCallId?: string;
}

interface ProgressStep {
  step: string;
  status: "pending" | "running" | "completed" | "failed";
  details?: string;
  count?: number;
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
                    step.status === "completed" && "text-green-700 dark:text-green-400",
                    step.status === "failed" && "text-red-700 dark:text-red-400",
                    step.status === "running" && "text-blue-700 dark:text-blue-400"
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
  };

  return (
    <div className="space-y-2">
      {toolCalls.map((tc, idx) => {
        // Check if this tool result has a progress array (e.g., searchProspects)
        const result = tc.result as Record<string, unknown> | undefined;
        const hasProgress =
          result &&
          Array.isArray(result.progress) &&
          result.progress.length > 0;

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
  const toolCalls: ToolCallInfo[] = (message.parts || [])
    .filter((part) => part.type === "tool-invocation")
    .map((part) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = part as any;
      return {
        toolName: p.toolName || "unknown",
        state: p.state || "call",
        args: p.input as Record<string, unknown> | undefined,
        result: p.output,
        toolCallId: p.toolCallId,
      };
    });

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

  // Assistant message - no avatar, no bubble (plain text), xs font size
  return (
    <Message className="items-start">
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

function ChatHeader() {
  return (
    <header className="bg-background sticky top-0 right-0 left-0 z-10 flex h-10 shrink-0 items-center justify-between border-b px-4 py-2">
      <h1 className="text-sm font-medium">🆁 ReacherX Agent</h1>
    </header>
  );
}

// ============================================================================
// Chat Skeleton Loading Component
// ============================================================================

/**
 * Skeleton loading UI that mimics the chat layout to prevent CLS.
 * Uses the same ChatContainer components to ensure consistent scroll behavior.
 */
function ChatSkeleton() {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header - same as loaded state */}
      <ChatHeader />

      {/* Skeleton messages area - uses same container structure for consistent scroll */}
      <ChatContainerRoot className="min-h-0 flex-1">
        <ChatContainerContent className="px-4 py-4">
          <div className="space-y-6">
            {/* Skeleton assistant message 1 - welcome/intro */}
            <div className="flex items-start">
              <div className="flex max-w-[85%] flex-col gap-2">
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>

            {/* Skeleton user message 1 */}
            <div className="flex flex-row-reverse items-start gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-10 w-48 rounded-lg" />
              </div>
            </div>

            {/* Skeleton assistant message 2 - analyzing */}
            <div className="flex items-start">
              <div className="flex max-w-[85%] flex-col gap-2">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>

            {/* Skeleton user message 2 */}
            <div className="flex flex-row-reverse items-start gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-10 w-36 rounded-lg" />
              </div>
            </div>

            {/* Skeleton assistant message 3 - longer response with list-like content */}
            <div className="flex items-start">
              <div className="flex max-w-[85%] flex-col gap-2">
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-4 w-64" />
                <div className="mt-2 space-y-2 pl-4">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-52" />
                </div>
                <Skeleton className="mt-2 h-4 w-72" />
                <Skeleton className="h-4 w-60" />
              </div>
            </div>

            {/* Skeleton user message 3 */}
            <div className="flex flex-row-reverse items-start gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-10 w-52 rounded-lg" />
              </div>
            </div>

            {/* Skeleton assistant message 4 - final response */}
            <div className="flex items-start">
              <div className="flex max-w-[85%] flex-col gap-2">
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-4 w-64" />
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
        {/* Skeleton prompt input */}
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentChat() {
  const router = useRouter();
  
  // Get WorkOS auth user for profile image (same as Header)
  const { user: authUser } = useAuth();

  const {
    messages,
    input,
    isLoading,
    isStreaming,
    error,
    isInitialized,
    suggestionPhase,
    setInput,
    sendMessage,
    stop,
    loadMore,
    hasMore,
  } = useAgentChat();

  // Get workspace to check for prospects
  const workspaceStatus = useQuery(api.workspaces.getWorkspaceSetupStatus);
  const workspaceId = workspaceStatus?.status === "complete" 
    ? workspaceStatus.workspace.id 
    : null;
  
  // Check if workspace has prospects (for auto-redirect)
  const hasProspects = useQuery(
    api.prospects.hasProspects,
    workspaceId ? { workspaceId } : "skip"
  );

  // Track if we've already redirected to prevent multiple redirects
  const hasRedirected = useRef(false);

  // Auto-redirect to prospects page when prospects are found after searchProspects
  useEffect(() => {
    // Only redirect if:
    // 1. We have prospects
    // 2. We haven't already redirected
    // 3. We're not currently loading/streaming
    // 4. The last tool call was searchProspects with success
    if (hasProspects && !hasRedirected.current && !isLoading && !isStreaming) {
      // Check if searchProspects was completed successfully
      const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
      if (lastAssistantMessage?.parts) {
        const searchProspectsResult = lastAssistantMessage.parts.find(
          (p): p is typeof p & { toolName: string; state: string; output: { success: boolean } } => 
            p.type === "tool-invocation" && 
            (p as { toolName?: string }).toolName === "searchProspects" &&
            (p as { state?: string }).state === "result" &&
            (p as { output?: { success?: boolean } }).output?.success === true
        );
        
        if (searchProspectsResult) {
          hasRedirected.current = true;
          // Small delay to let user see the success message
          setTimeout(() => {
            router.push("/");
          }, 2000);
        }
      }
    }
  }, [hasProspects, isLoading, isStreaming, messages, router]);

  // Get user display info from WorkOS auth
  const userDisplayImage = authUser?.profilePictureUrl;
  const userDisplayName = authUser?.firstName || authUser?.email || "User";

  // Loading state while initializing - use skeleton UI to prevent CLS
  if (!isInitialized) {
    return <ChatSkeleton />;
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
      <ChatHeader />

      {/* Chat Messages Area - scrollable container */}
      <ChatContainerRoot className="min-h-0 flex-1">
        <ChatContainerContent className="px-4 py-4">
          {/* Load more button */}
          {hasMore && (
            <div className="mb-4 text-center">
              <Button
                size="xs"
                onClick={loadMore}
              >
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
            className="px-0 pt-0"
            placeholder={
              displayMessages.length > 0
                ? "Type a message..."
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
                    <Button
                      variant="ghost"
                      size="xsIcon"
                      disabled
                      className="text-muted-foreground"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Coming soon!</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xsIcon"
                      disabled
                      className="text-muted-foreground"
                    >
                      <AtSign className="h-4 w-4" />
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
                  <Square className="h-4 w-4" />
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
                  <Send className="h-4 w-4" />
                </Button>
              </PromptInputAction>
            )}
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
