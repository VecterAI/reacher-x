import type { BrowserXChatSession } from "@/features/agent/lib/xChatBrowserSession";
import type { XDmMessage } from "@/shared/lib/twitter/dm";
import { parseIsoToTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { mergeConversationHistoryMessages } from "./conversationHistoryHelpers";

function toIsoTimestamp(occurredAt: number): string | undefined {
  if (!Number.isFinite(occurredAt) || occurredAt <= 0) {
    return undefined;
  }

  const date = new Date(occurredAt);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Converts only browser-verified XChat plaintext into panel message rows. */
export function toXChatConversationMessages(
  session: BrowserXChatSession | null | undefined
): XDmMessage[] {
  if (!session) {
    return [];
  }

  return session.messages.map((message) => ({
    // XChat and legacy DM identifiers use separate namespaces, so their rows
    // cannot overwrite each other when the histories are merged.
    id: `xchat:${session.conversationId}:${message.id}`,
    sequenceId: message.sequenceId,
    conversationId: session.conversationId,
    senderUserId: message.senderId,
    text: message.text,
    createdAt: toIsoTimestamp(message.occurredAt),
    direction: message.direction,
    attachments: message.attachments,
    quotedMessageId: message.quotedMessageId,
    quotedMessage: message.quotedMessage,
    reactions: message.reactions,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    readAt: message.readAt,
    deliveryStatus: message.deliveryStatus,
    deliveryError: message.deliveryError,
    outboundClientRequestId: message.clientRequestId,
  }));
}

function getLegacyMessagesBeforeXChat(
  legacyMessages: XDmMessage[],
  xChatMessages: XDmMessage[],
  session: BrowserXChatSession | null | undefined
): XDmMessage[] {
  if (!session) return legacyMessages;

  // Never cross into the legacy source while the canonical XChat history still
  // has provider pages. Doing so is what made a partial legacy transcript flash
  // before the decrypted history reached the same time range.
  if (session.hasMore) return [];
  if (xChatMessages.length === 0) return legacyMessages;

  const earliestXChatTimestamp = xChatMessages.reduce<number | null>(
    (earliest, message) => {
      const timestamp = message.createdAt
        ? (parseIsoToTimestamp(message.createdAt) ?? null)
        : null;
      if (timestamp === null) return earliest;
      return earliest === null ? timestamp : Math.min(earliest, timestamp);
    },
    null
  );
  if (earliestXChatTimestamp === null) return [];

  return legacyMessages.filter((message) => {
    const timestamp = message.createdAt
      ? (parseIsoToTimestamp(message.createdAt) ?? null)
      : null;
    return timestamp !== null && timestamp < earliestXChatTimestamp;
  });
}

/**
 * Uses XChat as the canonical source, then crosses into legacy history only
 * after XChat pagination is exhausted and only before its earliest event.
 */
export function mergeXChatConversationMessages(
  legacyMessages: XDmMessage[],
  session: BrowserXChatSession | null | undefined
): XDmMessage[] {
  const xChatMessages = toXChatConversationMessages(session);
  const mergedMessages = mergeConversationHistoryMessages(
    xChatMessages,
    getLegacyMessagesBeforeXChat(legacyMessages, xChatMessages, session)
  );
  if (!session?.messageUpdates?.length) return mergedMessages;

  const updatesByTargetId = new Map(
    session.messageUpdates.map((update) => [update.targetMessageId, update])
  );
  return mergedMessages.map((message) => {
    const xChatPrefix = `xchat:${session.conversationId}:`;
    const providerMessageId = message.id.startsWith(xChatPrefix)
      ? message.id.slice(xChatPrefix.length)
      : message.id;
    const update =
      updatesByTargetId.get(message.id) ??
      updatesByTargetId.get(providerMessageId);
    return update
      ? {
          ...message,
          ...(update.text !== undefined ? { text: update.text } : {}),
          ...(update.reactions !== undefined
            ? { reactions: update.reactions }
            : {}),
          ...(update.editedAt !== undefined
            ? { editedAt: update.editedAt }
            : {}),
          ...(update.deletedAt !== undefined
            ? { deletedAt: update.deletedAt }
            : {}),
        }
      : message;
  });
}
