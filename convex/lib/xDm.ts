"use node";

import type {
  XDmAttachmentSummary,
  XDmMessage,
} from "../../shared/lib/twitter/dm";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getMediaByKey(
  response: unknown,
  mediaKey?: string
): Record<string, unknown> | null {
  if (!mediaKey) {
    return null;
  }
  const includes = asRecord(asRecord(response)?.includes);
  const media = Array.isArray(includes?.media) ? includes.media : [];
  const match = media.find((item) => {
    const record = asRecord(item);
    return (
      asString(record?.mediaKey) === mediaKey ||
      asString(record?.media_key) === mediaKey
    );
  });
  return asRecord(match);
}

function getUserById(
  response: unknown,
  userId?: string
): Record<string, unknown> | null {
  if (!userId) {
    return null;
  }
  const includes = asRecord(asRecord(response)?.includes);
  const users = Array.isArray(includes?.users) ? includes.users : [];
  const match = users.find((item) => asString(asRecord(item)?.id) === userId);
  return asRecord(match);
}

export function normalizeDmAttachments(
  response: unknown,
  event: Record<string, unknown>
): XDmAttachmentSummary[] {
  const attachments = Array.isArray(event.attachments) ? event.attachments : [];
  const results: XDmAttachmentSummary[] = [];

  for (const attachment of attachments) {
    const mediaKey =
      asString(asRecord(attachment)?.media_key) ??
      asString(asRecord(attachment)?.mediaKey);
    const media = getMediaByKey(response, mediaKey);
    if (!media) {
      continue;
    }
    results.push({
      mediaKey,
      type: asString(media.type) ?? "unknown",
      url: asString(media.url),
      previewUrl:
        asString(media.previewImageUrl) ?? asString(media.preview_image_url),
      altText: asString(media.altText) ?? asString(media.alt_text),
      width: typeof media.width === "number" ? media.width : undefined,
      height: typeof media.height === "number" ? media.height : undefined,
    });
  }

  return results;
}

export function normalizeDmMessages(
  response: unknown,
  viewerXUserId?: string
): XDmMessage[] {
  const events: unknown[] = Array.isArray(asRecord(response)?.data)
    ? (asRecord(response)?.data as unknown[])
    : [];
  const normalized: XDmMessage[] = events
    .map<XDmMessage | null>((rawEvent) => {
      const event = asRecord(rawEvent);
      if (!event) {
        return null;
      }

      const senderUserId =
        asString(event.sender_id) ?? asString(event.senderId);
      const sender = getUserById(response, senderUserId);
      return {
        id: asString(event.id) ?? "",
        conversationId:
          asString(event.dm_conversation_id) ??
          asString(event.dmConversationId) ??
          "",
        senderUserId,
        text: asString(event.text) ?? "",
        createdAt: asString(event.created_at) ?? asString(event.createdAt),
        direction:
          viewerXUserId && senderUserId === viewerXUserId ? "sent" : "received",
        attachments: normalizeDmAttachments(response, event),
        sender: sender
          ? {
              userId: asString(sender.id) ?? "",
              username: asString(sender.username) ?? "",
              name:
                asString(sender.name) ?? asString(sender.username) ?? "Unknown",
              avatarUrl:
                asString(sender.profileImageUrl) ??
                asString(sender.profile_image_url),
              verified:
                asBoolean(sender.verified) ??
                (typeof sender.verified_type === "string" &&
                  sender.verified_type !== "none"),
            }
          : undefined,
      };
    })
    .filter((event): event is XDmMessage => Boolean(event && event.id));

  normalized.sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return leftTime - rightTime;
  });

  return normalized;
}

export function mergeDmMessages(
  primary: XDmMessage[],
  secondary: XDmMessage[]
): XDmMessage[] {
  const merged = new Map<string, XDmMessage>();
  for (const message of [...secondary, ...primary]) {
    merged.set(message.id, {
      ...merged.get(message.id),
      ...message,
    });
  }
  return [...merged.values()].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return leftTime - rightTime;
  });
}

export function buildDraftDmAttachments(
  mediaUrls?: string[],
  mediaDescriptions?: string[]
): XDmAttachmentSummary[] {
  return (mediaUrls ?? []).map((url, index) => ({
    type: "draft",
    url,
    previewUrl: url,
    altText: mediaDescriptions?.[index],
  }));
}
