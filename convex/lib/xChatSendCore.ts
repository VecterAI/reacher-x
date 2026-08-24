const MAX_XCHAT_MESSAGE_ID_LENGTH = 128;
const MAX_XCHAT_CLIENT_REQUEST_ID_LENGTH = 128;
const MAX_XCHAT_ENCODED_CONTENT_LENGTH = 256 * 1024;
const MAX_XCHAT_SIGNATURE_LENGTH = 32 * 1024;

export const XCHAT_SEND_LEASE_MS = 60 * 1000;
export const XCHAT_SEND_OPERATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type EncryptedXChatSendPayload = {
  clientRequestId: string;
  messageId: string;
  encodedMessageCreateEvent: string;
  encodedMessageEventSignature: string;
};

const XCHAT_OUTREACH_COMPLETION_ERROR_MESSAGE =
  "[XChatSend] Sent message but could not complete outreach task";

/**
 * Preserve a durable provider-send result when follow-up outreach bookkeeping
 * fails. Returning the successful send prevents a client retry from creating a
 * duplicate message at X.
 */
export async function finalizeSuccessfulXChatSend<T>(args: {
  sendResult: T;
  completeOutreachTask: () => Promise<void>;
  logError?: (message: string, error: unknown) => void;
}): Promise<T> {
  try {
    await args.completeOutreachTask();
  } catch (error) {
    (args.logError ?? console.error)(
      XCHAT_OUTREACH_COMPLETION_ERROR_MESSAGE,
      error
    );
  }
  return args.sendResult;
}

function requireOpaqueValue(
  value: string,
  label: string,
  maxLength: number
): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`XChat ${label} is missing.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`XChat ${label} is too large.`);
  }
  return normalized;
}

/**
 * Validate only transport boundaries. The signed/encrypted payload remains
 * opaque to the server and is verified by X against the registered key.
 */
export function normalizeEncryptedXChatSendPayload(args: {
  clientRequestId: string;
  messageId: string;
  encodedMessageCreateEvent: string;
  encodedMessageEventSignature: string;
}): EncryptedXChatSendPayload {
  return {
    clientRequestId: requireOpaqueValue(
      args.clientRequestId,
      "client request ID",
      MAX_XCHAT_CLIENT_REQUEST_ID_LENGTH
    ),
    messageId: requireOpaqueValue(
      args.messageId,
      "message ID",
      MAX_XCHAT_MESSAGE_ID_LENGTH
    ),
    encodedMessageCreateEvent: requireOpaqueValue(
      args.encodedMessageCreateEvent,
      "encrypted message",
      MAX_XCHAT_ENCODED_CONTENT_LENGTH
    ),
    encodedMessageEventSignature: requireOpaqueValue(
      args.encodedMessageEventSignature,
      "event signature",
      MAX_XCHAT_SIGNATURE_LENGTH
    ),
  };
}

/**
 * A client request ID permanently binds to one opaque SDK payload during its
 * retention window. Reusing it with different ciphertext could otherwise turn
 * an ordinary retry into an unrelated second user intent.
 */
export function assertMatchingEncryptedXChatSendOperation(
  existing: EncryptedXChatSendPayload & {
    prospectId: string;
    conversationId: string;
    taskId?: string;
  },
  requested: EncryptedXChatSendPayload & {
    prospectId: string;
    conversationId: string;
    taskId?: string;
  }
): void {
  if (
    existing.prospectId !== requested.prospectId ||
    existing.conversationId !== requested.conversationId ||
    existing.taskId !== requested.taskId ||
    existing.messageId !== requested.messageId ||
    existing.encodedMessageCreateEvent !==
      requested.encodedMessageCreateEvent ||
    existing.encodedMessageEventSignature !==
      requested.encodedMessageEventSignature
  ) {
    throw new Error(
      "This XChat client request ID is already bound to a different encrypted message."
    );
  }
}
