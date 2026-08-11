import type { BrowserXChatSession } from "@/features/agent/lib/xChatBrowserSession";
import type { XDmMessage } from "@/shared/lib/twitter/dm";
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
    conversationId: session.conversationId,
    senderUserId: message.senderId,
    text: message.text,
    createdAt: toIsoTimestamp(message.occurredAt),
    direction: message.direction,
  }));
}

/** Chronologically merges browser-verified XChat with legacy X/Twitter DMs. */
export function mergeXChatConversationMessages(
  legacyMessages: XDmMessage[],
  session: BrowserXChatSession | null | undefined
): XDmMessage[] {
  return mergeConversationHistoryMessages(
    toXChatConversationMessages(session),
    legacyMessages
  );
}
