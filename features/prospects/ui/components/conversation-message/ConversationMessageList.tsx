"use client";

import {
  formatConversationDayLabel,
  getConversationMessageGrouping,
  shouldShowConversationDaySeparator,
} from "../../../lib/conversationMessagePresentation";
import { ConversationDaySeparator } from "./ConversationDaySeparator";
import { ConversationMessageItem } from "./ConversationMessageItem";
import { MessageScrollerItem } from "@/shared/ui/components/MessageScroller";
import type {
  ConversationMessagePlatform,
  RichConversationMessage,
} from "./types";

interface ConversationMessageListProps {
  messages: RichConversationMessage[];
  platform: ConversationMessagePlatform;
  participantAvatarUrl?: string;
  participantName?: string;
  onReply?: (message: RichConversationMessage) => void;
  onReactionClick?: (message: RichConversationMessage, emoji: string) => void;
  canReplyToMessage?: (message: RichConversationMessage) => boolean;
  canReactToMessage?: (message: RichConversationMessage) => boolean;
  isReactionPending?: (message: RichConversationMessage) => boolean;
  onRetry?: (message: RichConversationMessage) => void;
  prospectId?: string;
  /** Render rows as direct shadcn MessageScroller items in full DM panels. */
  scrollerItems?: boolean;
}

export function ConversationMessageList({
  messages,
  platform,
  participantAvatarUrl,
  participantName,
  onReply,
  onReactionClick,
  canReplyToMessage,
  canReactToMessage,
  isReactionPending,
  onRetry,
  prospectId,
  scrollerItems = false,
}: ConversationMessageListProps) {
  const rows = messages.map((message, index) => {
    const row = (
      <>
        {shouldShowConversationDaySeparator(messages, index) ? (
          <ConversationDaySeparator
            label={formatConversationDayLabel(message.createdAt)}
          />
        ) : null}
        <ConversationMessageItem
          message={message}
          platform={platform}
          grouping={getConversationMessageGrouping(messages, index)}
          participantAvatarUrl={participantAvatarUrl}
          participantName={participantName}
          onReply={
            !canReplyToMessage || canReplyToMessage(message)
              ? onReply
              : undefined
          }
          onReactionClick={
            !canReactToMessage || canReactToMessage(message)
              ? onReactionClick
              : undefined
          }
          onRetry={onRetry}
          isReactionPending={isReactionPending?.(message)}
          prospectId={prospectId}
        />
      </>
    );

    return scrollerItems ? (
      <MessageScrollerItem key={message.id} messageId={message.id}>
        {row}
      </MessageScrollerItem>
    ) : (
      <div key={message.id} className="contents">
        {row}
      </div>
    );
  });

  if (scrollerItems) {
    return rows;
  }

  return (
    <section aria-label="Conversation messages" className="flex flex-col">
      {rows}
    </section>
  );
}
