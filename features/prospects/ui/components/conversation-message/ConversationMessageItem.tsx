"use client";

import { parseLinkedInText, parseText } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { MessageBubble } from "@/shared/ui/components/MessageBubble";
import { Button } from "@/shared/ui/components/Button";
import { CheckIcon, DoneAllIcon } from "@/shared/ui/components/icons/index";
import { useConversationMessageDownloads } from "../../../hooks/useConversationMessageDownloads";
import {
  formatConversationMessageTime,
  getConversationMessageDisplayText,
  getSharedXPostFromText,
  hasConversationMessageRichSurface,
} from "../../../lib/conversationMessagePresentation";
import { ConversationMessageActions } from "./ConversationMessageActions";
import { ConversationReactions } from "./ConversationReactions";
import { ConversationReplyQuote } from "./ConversationReplyPreview";
import { ConversationRichAttachments } from "./ConversationRichAttachments";
import type {
  ConversationMessagePlatform,
  RichConversationMessage,
} from "./types";

interface ConversationMessageItemProps {
  message: RichConversationMessage;
  platform: ConversationMessagePlatform;
  grouping: "first" | "middle" | "last" | "none";
  participantAvatarUrl?: string;
  participantName?: string;
  onReply?: (message: RichConversationMessage) => void;
  onReactionClick?: (message: RichConversationMessage, emoji: string) => void;
  isReactionPending?: boolean;
  onRetry?: (message: RichConversationMessage) => void;
  prospectId?: string;
}

function getReceiptLabel(message: RichConversationMessage) {
  if (message.readAt || message.seenBy?.length) return "Read";
  if (message.deliveredAt) return "Delivered";
  return "Sent";
}

export function ConversationMessageItem({
  message,
  platform,
  grouping,
  participantAvatarUrl,
  participantName,
  onReply,
  onReactionClick,
  isReactionPending = false,
  onRetry,
  prospectId,
}: ConversationMessageItemProps) {
  const showMetadata = grouping === "none" || grouping === "last";
  const showAvatar =
    message.direction === "received" &&
    (grouping === "none" || grouping === "first");
  const isDeleted = Boolean(message.deletedAt);
  const isSent = message.direction === "sent";
  const isPendingDelivery =
    message.deliveryStatus === "queued" || message.deliveryStatus === "sending";
  const didDeliveryFail = message.deliveryStatus === "failed";
  const downloadActions = useConversationMessageDownloads({
    attachments:
      !isDeleted && !isPendingDelivery && !didDeliveryFail
        ? message.attachments
        : undefined,
    messageId: message.id,
    platform,
    prospectId,
  });
  const receiptLabel = getReceiptLabel(message);
  const hasSharedPost = Boolean(
    message.sharedPost ||
    (platform === "twitter" && getSharedXPostFromText(message.text))
  );
  const displayText = getConversationMessageDisplayText(message.text, {
    hideFirstUrl: hasSharedPost,
  });
  const hasRichSurface = hasConversationMessageRichSurface(message, platform);
  const hasBubble = Boolean(displayText || isDeleted || message.quotedMessage);
  const messageActions = (
    <ConversationMessageActions
      platform={platform}
      reactions={message.reactions}
      isReacting={isReactionPending}
      className={cn(
        "absolute top-1",
        isSent ? "right-full mr-1.5" : "left-full ml-1.5"
      )}
      onReply={
        onReply && !isDeleted && !isPendingDelivery && !didDeliveryFail
          ? () => onReply(message)
          : undefined
      }
      onReact={
        onReactionClick && !isDeleted && !isPendingDelivery && !didDeliveryFail
          ? (emoji) => onReactionClick(message, emoji)
          : undefined
      }
      downloadActions={downloadActions}
    />
  );

  if (message.isEvent) {
    return (
      <div className="text-muted-foreground mx-auto max-w-sm px-6 py-2 text-center text-xs">
        {message.eventMetadata?.eventLabel ||
          message.text ||
          message.sourceEventType ||
          "Conversation updated"}
      </div>
    );
  }

  return (
    <article
      className={cn(
        "group/message relative flex w-full min-w-0 items-start gap-3",
        isSent && "flex-row-reverse",
        showMetadata ? "mb-3.5" : "mb-1"
      )}
    >
      {!isSent ? (
        <div
          className="flex size-8 shrink-0 items-start justify-center pt-0.5"
          aria-hidden={showAvatar ? undefined : true}
        >
          {showAvatar ? (
            <Avatar className="ring-border/80 size-8 ring-1">
              <AvatarImage
                src={participantAvatarUrl}
                alt={participantName || "Conversation participant"}
                className="object-cover"
              />
              <AvatarFallback className="text-xs">
                {(participantName || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      ) : null}

      <div
        data-message-cluster
        data-rich-surface={hasRichSurface ? "true" : "false"}
        className={cn(
          "relative flex max-w-[min(70%,36rem)] min-w-0 flex-col gap-1.5",
          isSent
            ? "[@media(pointer:fine)]:max-w-[min(70%,calc(100%_-_5.25rem),36rem)]"
            : "[@media(pointer:fine)]:max-w-[min(70%,calc(100%_-_8rem),36rem)]",
          hasRichSurface ? "w-full" : "w-fit",
          isSent ? "items-end" : "items-start"
        )}
      >
        {hasRichSurface ? (
          <div className="relative flex w-full max-w-full flex-col gap-1.5">
            <ConversationRichAttachments
              attachments={message.attachments}
              text={message.text}
              sharedPost={message.sharedPost}
              platform={platform}
              direction={message.direction}
              prospectId={prospectId}
              messageId={message.id}
            />
            {!hasBubble ? messageActions : null}
          </div>
        ) : null}

        {hasBubble ? (
          <div className="relative w-fit max-w-full">
            <MessageBubble variant={message.direction} grouped={grouping}>
              {message.quotedMessage ? (
                <ConversationReplyQuote
                  quote={message.quotedMessage}
                  participantName={participantName}
                />
              ) : null}
              {displayText || isDeleted ? (
                <p
                  lang="auto"
                  className={cn(
                    "wrap-break-word whitespace-pre-wrap",
                    isDeleted && "italic opacity-70",
                    "[&_a]:underline [&_a]:underline-offset-2"
                  )}
                >
                  {isDeleted
                    ? "This message was deleted"
                    : platform === "linkedin"
                      ? parseLinkedInText(displayText)
                      : parseText(displayText)}
                </p>
              ) : null}
            </MessageBubble>
            {messageActions}
          </div>
        ) : null}

        <ConversationReactions
          reactions={message.reactions}
          platform={platform}
          direction={message.direction}
          isReacting={isReactionPending}
          onReactionClick={
            onReactionClick && !isDeleted && !isPendingDelivery
              ? (emoji) => onReactionClick(message, emoji)
              : undefined
          }
        />

        {showMetadata ? (
          <footer className="text-muted-foreground flex items-center gap-1 px-1 text-[11px]">
            {message.createdAt ? (
              <time dateTime={message.createdAt}>
                {formatConversationMessageTime(message.createdAt)}
              </time>
            ) : null}
            {message.editedAt ? <span>· Edited</span> : null}
            {isSent && isPendingDelivery ? (
              <span role="status">Sending</span>
            ) : isSent && didDeliveryFail ? (
              <span
                className="text-destructive inline-flex items-center gap-1"
                title={message.deliveryError}
              >
                Not sent
                {onRetry ? (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="text-destructive h-auto p-0 text-[11px]"
                    onClick={() => onRetry(message)}
                  >
                    Retry
                  </Button>
                ) : null}
              </span>
            ) : isSent ? (
              <span
                className="inline-flex items-center"
                aria-label={receiptLabel}
                title={receiptLabel}
              >
                {message.readAt ||
                message.seenBy?.length ||
                message.deliveredAt ? (
                  <DoneAllIcon
                    className={cn(
                      "size-3 fill-current",
                      (message.readAt || message.seenBy?.length) &&
                        "text-foreground"
                    )}
                    aria-hidden="true"
                  />
                ) : (
                  <CheckIcon
                    className="size-3 fill-current"
                    aria-hidden="true"
                  />
                )}
                <span className="sr-only">{receiptLabel}</span>
              </span>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}
