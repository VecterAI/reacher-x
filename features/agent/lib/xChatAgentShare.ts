import type { BrowserDecryptedXChatMessage } from "./xChatBrowserMessageNormalization";

export const MAX_SHARED_XCHAT_MESSAGES = 100;

export const XCHAT_AGENT_MEDIA_LIMITATION_COPY =
  "The Agent will analyze the message text. Images, voice messages, videos, and files shared in the conversation won’t be included.";

export type SharedXChatMessage = Pick<
  BrowserDecryptedXChatMessage,
  "id" | "senderId" | "direction" | "occurredAt" | "text"
>;

export type XChatAgentSharePayload = {
  messages: SharedXChatMessage[];
  excludedAttachmentCount: number;
};

/**
 * Converts browser-only XChat rows into the narrow, transient Agent contract.
 * Decrypted attachment data and provider metadata must never cross this boundary.
 */
export function buildXChatAgentSharePayload(
  messages: BrowserDecryptedXChatMessage[]
): XChatAgentSharePayload {
  const selectedMessages = messages.slice(-MAX_SHARED_XCHAT_MESSAGES);

  return {
    excludedAttachmentCount: selectedMessages.reduce(
      (count, message) => count + (message.attachments?.length ?? 0),
      0
    ),
    messages: selectedMessages.map(
      ({ id, senderId, direction, occurredAt, text }) => ({
        id,
        senderId,
        direction,
        occurredAt,
        text,
      })
    ),
  };
}
