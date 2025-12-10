"use client";

/**
 * AgentChat - Main agent chat interface with streaming support
 *
 * Per docs: https://docs.convex.dev/agents/streaming#text-smoothing-with-smoothtext-and-usesmoothtext
 * Uses useSmoothText from @convex-dev/agent/react for smooth streaming text.
 */

import { useAgentChat, type UIMessage } from "../hooks";
import { useSmoothText } from "@convex-dev/agent/react";
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
import { Send, Square, Sparkles, Copy, Check, Paperclip, AtSign } from "lucide-react";
import { useState, useCallback } from "react";

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
  };

  return (
    <div className="space-y-2">
      {toolCalls.map((tc, idx) => {
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
        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
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
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";
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
        <div className="flex flex-col items-end gap-1 max-w-[80%]">
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
        {toolCalls.length > 0 && <ToolCallVisualization toolCalls={toolCalls} />}

        {/* Message content with markdown - plain variant (no bubble), xs font size */}
        {(displayText || isStreaming) && (
          <MessageContent
            markdown={true}
            variant="plain"
            textSize="sm"
            className={cn(
              isStreaming && !displayText && "animate-pulse"
            )}
          >
            {displayText || " "}
          </MessageContent>
        )}

        {/* Streaming cursor */}
        {isStreaming && displayText && (
          <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-foreground/50" />
        )}

        {/* Copy action for assistant messages - always visible */}
        {displayText && !isStreaming && (
          <MessageActions>
            <CopyButton text={displayText} />
          </MessageActions>
        )}

        {/* Error indicator per docs */}
        {message.status === "failed" && (
          <div className="mt-1 text-sm text-destructive">
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
    <header className="sticky left-0 right-0 top-0 z-10 flex shrink-0 items-center justify-between border-b bg-background py-2 px-4">
      <h1 className="text-sm font-medium">🆁 Agent</h1>
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
    <div className="flex h-full w-full max-w-lg flex-col md:border-r md:border-border">
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
      <div className="shrink-0 bg-background px-4 pb-4 pt-3 backdrop-blur-xl">
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
    <div className="flex h-full w-full max-w-lg flex-col md:border-r md:border-border">
      {/* Header */}
      <ChatHeader />

      {/* Chat Messages Area - scrollable container */}
      <ChatContainerRoot className="min-h-0 flex-1">
        <ChatContainerContent className="px-4 py-4">
          {/* Load more button */}
          {hasMore && (
            <div className="mb-4 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                className="text-muted-foreground"
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
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1 text-destructive/80">
                  {error.message || "Please try again."}
                </p>
              </div>
            )}
          </div>

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Input Area - with backdrop blur */}
      <div className="shrink-0 bg-background px-4 pb-4 pt-3 backdrop-blur-xl">
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
          <PromptInputTextarea className="px-0 pt-0"
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
                <Button
                  variant="ghost"
                  size="xsIcon"
                  onClick={stop}
                >
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
