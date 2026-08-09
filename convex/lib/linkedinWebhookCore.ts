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
  const accountProviderId = linkedAccount.providerId?.trim();
  const userProviderId = getWebhookString(
    payload,
    "user_provider_id",
    "userProviderId"
  );
  if (userProviderId && userProviderId !== accountProviderId) {
    return userProviderId;
  }

  const sender = getNestedRecord(payload, "sender");
  const senderProviderId = getWebhookString(sender, "provider_id", "id");
  if (senderProviderId && senderProviderId !== accountProviderId) {
    return senderProviderId;
  }

  const attendees = getWebhookArray(payload, "attendees");
  for (const attendee of attendees) {
    const providerId = getWebhookString(attendee, "provider_id", "id");
    if (providerId && providerId !== accountProviderId) {
      return providerId;
    }
  }

  const attendeeProviderId = getWebhookString(
    payload,
    "attendee_provider_id",
    "attendee_id"
  );
  if (attendeeProviderId && attendeeProviderId !== accountProviderId) {
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

  if (knownDirection) {
    return knownDirection;
  }

  const senderProviderId = getWebhookString(
    getNestedRecord(payload, "sender"),
    "provider_id",
    "id"
  );
  return senderProviderId &&
    senderProviderId === linkedAccount.providerId?.trim()
    ? "sent"
    : "received";
}
