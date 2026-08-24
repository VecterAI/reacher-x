import { getNestedRecord, getStringProperty } from "./typeGuards";

export const X_TYPING_PRESENCE_TTL_MS = 7_000;

export type XTypingActivityPayload = {
  senderUserId: string;
  recipientUserId?: string;
};

/**
 * Normalize the documented legacy X DM typing payload. X Activity wraps this
 * object in `data[].payload`; Account Activity documents the same sender and
 * target fields directly inside `direct_message_indicate_typing_events`.
 */
export function normalizeXTypingActivityPayload(
  payload: unknown
): XTypingActivityPayload | null {
  const senderUserId =
    getStringProperty(payload, "sender_id") ??
    getStringProperty(payload, "senderId");
  if (!senderUserId) {
    return null;
  }

  const target = getNestedRecord(payload, "target");
  const recipientUserId =
    getStringProperty(target, "recipient_id") ??
    getStringProperty(target, "recipientId");

  return {
    senderUserId,
    recipientUserId,
  };
}
