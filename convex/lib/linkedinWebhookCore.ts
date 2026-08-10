import { getNestedRecord, isRecord } from "./typeGuards";

type LinkedInWebhookAccount = {
  providerId?: string | null;
};

export type LinkedInWebhookMessageDirection = "sent" | "received";

export function getWebhookString(
  value: unknown,
  ...keys: string[]
): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return undefined;
}

export function getWebhookArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) {
    return [];
  }

  const candidate = value[key];
  return Array.isArray(candidate) ? candidate : [];
}

function getWebhookBoolean(
  value: unknown,
  ...keys: string[]
): boolean | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const candidate = value[key];
    if (
      candidate === true ||
      candidate === 1 ||
      candidate === "1" ||
      candidate === "true"
    ) {
      return true;
    }
    if (
      candidate === false ||
      candidate === 0 ||
      candidate === "0" ||
      candidate === "false"
    ) {
      return false;
    }
  }

  return undefined;
}

/**
 * Extract the LinkedIn participant from Unipile webhook payloads.
 *
 * `new_relation` events identify the other LinkedIn user with the top-level
 * `user_provider_id` field. Messaging events use sender/attendee fields, so
 * those remain as fallbacks for the other webhook sources.
 */
export function getWebhookParticipantProviderId(
  payload: unknown,
  linkedAccount: LinkedInWebhookAccount
): string | undefined {
  const accountInfo = getNestedRecord(payload, "account_info");
  const ownProviderIds = new Set(
    [
      linkedAccount.providerId,
      getWebhookString(accountInfo, "user_id", "provider_id", "id"),
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
  );
  const isOtherParticipant = (value?: string) =>
    Boolean(value && !ownProviderIds.has(value));
  const userProviderId = getWebhookString(
    payload,
    "user_provider_id",
    "userProviderId"
  );
  if (isOtherParticipant(userProviderId)) {
    return userProviderId;
  }

  const sender = getNestedRecord(payload, "sender");
  const senderProviderId = getWebhookString(
    sender,
    "attendee_provider_id",
    "provider_id",
    "id"
  );
  if (isOtherParticipant(senderProviderId)) {
    return senderProviderId;
  }

  const attendees = getWebhookArray(payload, "attendees");
  for (const attendee of attendees) {
    const providerId = getWebhookString(
      attendee,
      "attendee_provider_id",
      "provider_id",
      "id"
    );
    if (isOtherParticipant(providerId)) {
      return providerId;
    }
  }

  const attendeeProviderId = getWebhookString(
    payload,
    "attendee_provider_id",
    "attendee_id"
  );
  if (isOtherParticipant(attendeeProviderId)) {
    return attendeeProviderId;
  }

  return undefined;
}

/**
 * Resolve message direction without turning ReacherX's own outbound message
 * webhook into a prospect response.
 *
 * Unipile may include `is_sender` while some payloads only identify the
 * sender. A previously persisted outbound message is also authoritative when
 * the provider omits the explicit sender flag.
 */
export function getWebhookMessageDirection(
  payload: unknown,
  linkedAccount: LinkedInWebhookAccount,
  knownDirection?: LinkedInWebhookMessageDirection
): LinkedInWebhookMessageDirection {
  const explicitDirection =
    getWebhookBoolean(payload, "is_sender", "isSender") ??
    getWebhookBoolean(
      getNestedRecord(payload, "message"),
      "is_sender",
      "isSender"
    );
  if (explicitDirection !== undefined) {
    return explicitDirection ? "sent" : "received";
  }

  const event = getWebhookString(payload, "event", "type", "name");
  if (event === "message_sent") {
    return "sent";
  }

  // Unipile's documented v1 messaging shape identifies the mailbox owner at
  // account_info.user_id and the sender at sender.attendee_provider_id.
  const accountInfo = getNestedRecord(payload, "account_info");
  const accountProviderId =
    getWebhookString(accountInfo, "user_id", "provider_id", "id") ??
    linkedAccount.providerId?.trim();
  const sender = getNestedRecord(payload, "sender");
  const senderProviderId = getWebhookString(
    sender,
    "attendee_provider_id",
    "provider_id",
    "id"
  );
  if (senderProviderId && accountProviderId) {
    return senderProviderId === accountProviderId ? "sent" : "received";
  }

  return knownDirection ?? "received";
}
