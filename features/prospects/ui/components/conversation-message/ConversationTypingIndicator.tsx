"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { MessageBubble } from "@/shared/ui/components/MessageBubble";

type ConversationTypingIndicatorProps = {
  participantAvatarUrl?: string;
  participantName?: string;
};

export function ConversationTypingIndicator({
  participantAvatarUrl,
  participantName,
}: ConversationTypingIndicatorProps) {
  const accessibleName = participantName || "Conversation participant";

  return (
    <article
      role="status"
      aria-live="polite"
      aria-label={`${accessibleName} is typing`}
      className="mb-3.5 flex w-full min-w-0 items-start gap-3"
    >
      <div className="flex size-8 shrink-0 items-start justify-center pt-0.5">
        <Avatar className="ring-border/80 size-8 ring-1">
          <AvatarImage
            src={participantAvatarUrl}
            alt=""
            className="object-cover"
          />
          <AvatarFallback className="text-xs" aria-hidden="true">
            {accessibleName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      <MessageBubble variant="received" className="flex items-center">
        <span aria-hidden="true" className="flex h-4 items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="conversation-typing-dot bg-muted-foreground/85 size-1.25 rounded-full"
            />
          ))}
        </span>
        <span className="sr-only">{accessibleName} is typing</span>
      </MessageBubble>
    </article>
  );
}
