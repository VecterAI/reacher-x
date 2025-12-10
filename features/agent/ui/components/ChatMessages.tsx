/**
 * ChatMessages - Message list component
 *
 * Renders the list of messages from useChat.
 * Uses the new UIMessage format from AI SDK v5.
 */

import { memo } from "react";
import { cn } from "@/shared/lib/utils";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/shared/ui/components/Message";
import type { Message as UIMessage } from "../../hooks";

// ============================================================================
// Types
// ============================================================================

interface ChatMessagesProps {
  messages: UIMessage[];
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract text content from a UIMessage
 */
function getMessageText(message: UIMessage): string {
  if (message.parts) {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; text: string }).text)
      .join("");
  }
  return "";
}

// ============================================================================
// Component
// ============================================================================

export const ChatMessages = memo(function ChatMessages({
  messages,
  className,
}: ChatMessagesProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
});

// ============================================================================
// Message Item
// ============================================================================

interface MessageItemProps {
  message: UIMessage;
}

const MessageItem = memo(function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";
  const text = getMessageText(message);

  // Skip empty messages
  if (!text) return null;

  return (
    <Message className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <MessageAvatar
          src="/og-default.jpg"
          alt="ReacherX"
          fallback="RX"
          className="bg-primary/10"
        />
      )}

      <MessageContent
        markdown={!isUser}
        className={cn(
          "max-w-[85%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}
      >
        {text}
      </MessageContent>
    </Message>
  );
});
