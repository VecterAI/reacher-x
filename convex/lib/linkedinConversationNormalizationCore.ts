"use node";

import type {
  LinkedInConversationAttachmentSummary,
  LinkedInConversationAttachmentVariant,
  LinkedInConversationEventMetadata,
  LinkedInConversationMessage,
  LinkedInConversationQuotedMessage,
  LinkedInConversationReaction,
  LinkedInConversationSeenBy,
  LinkedInConversationSharedPost,
} from "../../shared/lib/linkedin/conversation";
import {
  extractLinkedInCanonicalPostIdFromUrl,
  findLinkedInPostUrl,
} from "../../shared/lib/linkedin/comments";
import { isRenderableLinkedInMediaUrl } from "../../shared/lib/linkedin/post";
import { parseIsoToTimestamp } from "../../shared/lib/utils/time/timeUtils";
import type { UnipileMessage } from "./unipileClient";
import { isRecord } from "./typeGuards";

const PLATFORM_CONVERSATION_EVENT_TYPES = new Set([
  "dm.sent",
  "dm.received",
  "dm.read",
  "chat.sent",
  "chat.received",
  "chat.conversation_join",
  "message_received",
  "message_sent",
  "message_read",
  "message_reaction",
  "message_edited",
  "message_deleted",
  "message_delivered",
  "new_relation",
]);

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === 0 || value === "0" || value === "false") {
    return false;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function getFirstString(
  source: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = asString(source?.[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function getFirstNumber(
  source: Record<string, unknown> | undefined,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = asNumber(source?.[key]);
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

function getFirstBoolean(
  source: Record<string, unknown> | undefined,
  keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const value = asBoolean(source?.[key]);
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function getRecordArray(
  source: Record<string, unknown> | undefined,
  keys: string[]
): Record<string, unknown>[] {
  for (const key of keys) {
    const value = source?.[key];
    if (Array.isArray(value)) {
      return value
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item));
    }
  }
  return [];
}

function normalizeTimestamp(value: unknown): string | undefined {
  const stringValue = asString(value);
  if (stringValue && parseIsoToTimestamp(stringValue) !== undefined) {
    return stringValue;
  }
  const numberValue = asNumber(value);
  if (typeof numberValue !== "number") return undefined;
  const milliseconds =
    numberValue < 1_000_000_000_000 ? numberValue * 1000 : numberValue;
  return new Date(milliseconds).toISOString();
}

function normalizeAttachmentVariants(
  source: Record<string, unknown>
): LinkedInConversationAttachmentVariant[] | undefined {
  const variants: LinkedInConversationAttachmentVariant[] = [];
  for (const variant of getRecordArray(source, [
    "variants",
    "media_variants",
  ])) {
    const url = getFirstString(variant, ["url", "media_url"]);
    if (!url) {
      continue;
    }
    const mimeType = getFirstString(variant, [
      "mime_type",
      "mimeType",
      "content_type",
      "contentType",
    ]);
    const bitrate = getFirstNumber(variant, ["bitrate", "bit_rate", "bitRate"]);
    const width = getFirstNumber(variant, ["width"]);
    const height = getFirstNumber(variant, ["height"]);
    variants.push({
      url,
      ...(mimeType ? { mimeType } : {}),
      ...(typeof bitrate === "number" ? { bitrate } : {}),
      ...(typeof width === "number" ? { width } : {}),
      ...(typeof height === "number" ? { height } : {}),
    });
  }
  return variants.length > 0 ? variants : undefined;
}

export function normalizeLinkedInConversationAttachment(
  value: unknown
): LinkedInConversationAttachmentSummary | undefined {
  const source = asRecord(value);
  if (!source) {
    return undefined;
  }
  const dimensions = asRecord(source.size) ?? asRecord(source.dimensions);
  const type =
    getFirstString(source, ["type", "attachment_type", "media_type"]) ??
    "attachment";
  const normalizedType = type.toLowerCase();
  const mimeType = getFirstString(source, [
    "mime_type",
    "mimeType",
    "mimetype",
    "content_type",
    "contentType",
  ]);
  const availability = asRecord(source.availability);
  const availabilityStatus = getFirstString(availability, ["status"]);
  const rawUrl = getFirstString(source, [
    "url",
    "media_url",
    "mediaUrl",
    "download_url",
    "downloadUrl",
  ]);
  const rawPreviewUrl = getFirstString(source, [
    "preview_url",
    "previewUrl",
    "thumbnail_url",
    "thumbnailUrl",
  ]);
  return {
    id: getFirstString(source, ["id", "attachment_id", "attachmentId"]),
    mediaKey: getFirstString(source, ["media_key", "mediaKey"]),
    type,
    url:
      rawUrl && isRenderableLinkedInMediaUrl(rawUrl) ? rawUrl : undefined,
    previewUrl:
      rawPreviewUrl && isRenderableLinkedInMediaUrl(rawPreviewUrl)
        ? rawPreviewUrl
        : undefined,
    altText: getFirstString(source, ["alt_text", "altText", "description"]),
    width:
      getFirstNumber(source, ["width"]) ??
      getFirstNumber(dimensions, ["width"]),
    height:
      getFirstNumber(source, ["height"]) ??
      getFirstNumber(dimensions, ["height"]),
    fileName: getFirstString(source, [
      "file_name",
      "fileName",
      "filename",
      "name",
    ]),
    mimeType,
    fileSize: getFirstNumber(source, [
      "file_size",
      "fileSize",
      "filesize_bytes",
      "filesizeBytes",
      "size_bytes",
    ]),
    durationMs: getFirstNumber(source, [
      "duration_ms",
      "durationMs",
      "duration_millis",
      "durationMillis",
      "duration",
    ]),
    variants: normalizeAttachmentVariants(source),
    isGif:
      getFirstBoolean(source, ["is_gif", "isGif", "gif"]) ??
      (normalizedType === "gif" || normalizedType === "animated_gif"),
    isVoiceNote:
      getFirstBoolean(source, [
        "is_voice_note",
        "isVoiceNote",
        "voice_note",
        "voiceNote",
      ]) ?? normalizedType.includes("voice"),
    unavailable:
      getFirstBoolean(source, [
        "unavailable",
        "is_unavailable",
        "isUnavailable",
      ]) ??
      (availabilityStatus &&
      /^(?:unavailable|failed|expired|not_available)$/iu.test(
        availabilityStatus
      )
        ? true
        : undefined),
    urlExpiresAt: normalizeTimestamp(
      source.url_expires_at ??
        source.urlExpiresAt ??
        source.expires_at ??
        source.expiresAt
    ),
    linkedinPostUrl: getFirstString(source, [
      "linkedin_post_url",
      "linkedinPostUrl",
      "post_url",
      "postUrl",
    ]),
  };
}

export function normalizeLinkedInConversationAttachments(
  value: unknown
): LinkedInConversationAttachmentSummary[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const attachments = value
    .map(normalizeLinkedInConversationAttachment)
    .filter((attachment): attachment is LinkedInConversationAttachmentSummary =>
      Boolean(attachment)
    );
  return attachments.length > 0 ? attachments : undefined;
}

function normalizeLinkedInSharedPost(
  value: unknown,
  fallbackUrl?: string
): LinkedInConversationSharedPost | undefined {
  const source = asRecord(value);
  const url =
    getFirstString(source, [
      "url",
      "post_url",
      "postUrl",
      "linkedin_post_url",
      "linkedinPostUrl",
      "permalink",
    ]) ?? fallbackUrl;
  if (!url) {
    return undefined;
  }
  const author = asRecord(source?.author) ?? asRecord(source?.sender);
  const id =
    getFirstString(source, [
      "id",
      "post_id",
      "postId",
      "social_id",
      "socialId",
      "urn",
    ]) ??
    extractLinkedInCanonicalPostIdFromUrl(url) ??
    url;
  const media = normalizeLinkedInConversationAttachments(
    source?.media ?? source?.attachments
  );
  return {
    id,
    url,
    text: getFirstString(source, ["text", "commentary", "description"]),
    authorId:
      getFirstString(source, ["author_id", "authorId"]) ??
      getFirstString(author, ["id", "urn", "provider_id", "providerId"]),
    authorHandle: getFirstString(author, [
      "public_identifier",
      "publicIdentifier",
      "username",
    ]),
    authorName: getFirstString(author, ["name", "display_name", "displayName"]),
    authorAvatarUrl: getFirstString(author, [
      "profile_picture_url",
      "profilePictureUrl",
      "avatar_url",
      "avatarUrl",
    ]),
    createdAt: normalizeTimestamp(
      source?.created_at ?? source?.createdAt ?? source?.timestamp
    ),
    ...(media ? { media } : {}),
  };
}

function getLinkedInSharedPostFromAttachments(
  attachments?: LinkedInConversationAttachmentSummary[]
): LinkedInConversationSharedPost | undefined {
  const attachment = attachments?.find(
    (candidate) => candidate.linkedinPostUrl
  );
  return attachment?.linkedinPostUrl
    ? normalizeLinkedInSharedPost(undefined, attachment.linkedinPostUrl)
    : undefined;
}

function normalizeQuotedMessage(
  value: unknown,
  args: { viewerIsSender?: boolean; currentSenderId?: string }
): LinkedInConversationQuotedMessage | undefined {
  const source = asRecord(value);
  const id = getFirstString(source, [
    "provider_id",
    "providerId",
    "message_id",
    "messageId",
    "id",
  ]);
  if (!source || !id) {
    return undefined;
  }
  const sender = asRecord(source.sender);
  const rawAttachments = getRecordArray(source, ["attachments"]);
  const attachment = rawAttachments[0];
  const attachments = normalizeLinkedInConversationAttachments(rawAttachments);
  const text = getFirstString(source, ["text", "message"]);
  const sharedPost =
    normalizeLinkedInSharedPost(
      source.shared_post ?? source.sharedPost ?? source.post
    ) ??
    getLinkedInSharedPostFromAttachments(attachments) ??
    normalizeLinkedInSharedPost(undefined, findLinkedInPostUrl(text));
  const isSender = getFirstBoolean(source, ["is_sender", "isSender"]);
  const quotedSenderId = getFirstString(source, ["sender_id", "senderId"]);
  const directionState =
    isSender ??
    (quotedSenderId &&
    args.currentSenderId &&
    quotedSenderId !== args.currentSenderId
      ? args.viewerIsSender === undefined
        ? undefined
        : !args.viewerIsSender
      : args.viewerIsSender);
  return {
    id,
    text,
    senderName:
      getFirstString(source, ["sender_name", "senderName", "name"]) ??
      getFirstString(sender, ["name", "display_name", "displayName"]),
    direction:
      directionState === true
        ? "sent"
        : directionState === false
          ? "received"
          : undefined,
    attachmentType: getFirstString(attachment, ["type", "attachment_type"]),
    ...(attachments ? { attachments } : {}),
    ...(sharedPost ? { sharedPost } : {}),
  };
}

function normalizeReactions(
  value: unknown
): LinkedInConversationReaction[] | undefined {
  const isArraySnapshot = Array.isArray(value);
  const sources = Array.isArray(value)
    ? value
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : asRecord(value)
      ? [asRecord(value)!]
      : [];
  const reactions: LinkedInConversationReaction[] = [];
  for (const source of sources) {
    const emoji = getFirstString(source, [
      "value",
      "emoji",
      "reaction",
      "reaction_type",
      "type",
    ]);
    if (!emoji) {
      continue;
    }
    const reactedByViewer = getFirstBoolean(source, [
      "reacted_by_viewer",
      "reactedByViewer",
      "viewer_reacted",
      "viewerReacted",
      "is_sender",
      "isSender",
    ]);
    const existingReaction = reactions.find(
      (reaction) => reaction.emoji === emoji
    );
    const count = Math.max(
      0,
      getFirstNumber(source, ["count", "total_count", "totalCount"]) ?? 1
    );
    if (existingReaction) {
      existingReaction.count += count;
      existingReaction.reactedByViewer =
        existingReaction.reactedByViewer || reactedByViewer;
      continue;
    }
    reactions.push({
      emoji,
      count,
      ...(typeof reactedByViewer === "boolean" ? { reactedByViewer } : {}),
    });
  }
  // Unipile documents `reactions` as a full array on a message. Preserve an
  // explicit empty array so a provider refresh can clear a removed reaction
  // instead of retaining stale cached state. An absent field remains unknown.
  return reactions.length > 0 || isArraySnapshot ? reactions : undefined;
}

function normalizeSeenBy(
  value: unknown
): LinkedInConversationSeenBy[] | undefined {
  const sources = Array.isArray(value)
    ? value
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : asRecord(value)
      ? [asRecord(value)!]
      : [];
  const seenBy: LinkedInConversationSeenBy[] = [];
  const providerMap = asRecord(value);
  if (providerMap && !Array.isArray(value)) {
    const structuredKeys = new Set([
      "user_id",
      "userId",
      "sender_id",
      "attendee_id",
      "attendeeId",
      "sender_name",
      "senderName",
      "name",
      "seen_at",
      "seenAt",
      "read_at",
      "readAt",
      "timestamp",
      "attendee",
    ]);
    if (!Object.keys(providerMap).some((key) => structuredKeys.has(key))) {
      for (const [attendeeId, receiptValue] of Object.entries(providerMap)) {
        if (!receiptValue) continue;
        const seenAt = normalizeTimestamp(receiptValue);
        seenBy.push({
          attendeeId,
          ...(seenAt ? { seenAt } : {}),
        });
      }
      return seenBy.length > 0 ? seenBy : undefined;
    }
  }
  for (const source of sources) {
    const attendee = asRecord(source.attendee);
    const userId = getFirstString(source, ["user_id", "userId", "sender_id"]);
    const attendeeId = getFirstString(source, ["attendee_id", "attendeeId"]);
    const senderName =
      getFirstString(source, ["sender_name", "senderName", "name"]) ??
      getFirstString(attendee, ["name", "display_name", "displayName"]);
    const seenAt = normalizeTimestamp(
      source.seen_at ??
        source.seenAt ??
        source.read_at ??
        source.readAt ??
        source.timestamp
    );
    if (!userId && !attendeeId && !senderName && !seenAt) {
      continue;
    }
    seenBy.push({
      ...(userId ? { userId } : {}),
      ...(attendeeId ? { attendeeId } : {}),
      ...(senderName ? { senderName } : {}),
      ...(seenAt ? { seenAt } : {}),
    });
  }
  return seenBy.length > 0 ? seenBy : undefined;
}

function normalizeEventMetadata(args: {
  source: Record<string, unknown>;
  rawEventType?: string | number;
}): LinkedInConversationEventMetadata | undefined {
  const eventMetadata =
    asRecord(args.source.event_metadata) ?? asRecord(args.source.eventMetadata);
  const actor = asRecord(args.source.actor) ?? asRecord(args.source.sender);
  const providerEventType =
    typeof args.rawEventType === "string" ||
    typeof args.rawEventType === "number"
      ? String(args.rawEventType)
      : getFirstString(args.source, ["event_type", "eventType", "type"]);
  const result: LinkedInConversationEventMetadata = {
    providerEventType,
    eventLabel:
      getFirstString(args.source, ["event_label", "eventLabel", "label"]) ??
      getFirstString(eventMetadata, ["event_label", "eventLabel", "label"]),
    actorUserId:
      getFirstString(args.source, ["actor_id", "actorId"]) ??
      getFirstString(actor, ["id", "user_id", "userId"]),
    actorName:
      getFirstString(args.source, ["actor_name", "actorName"]) ??
      getFirstString(actor, ["name", "display_name", "displayName"]),
    targetMessageId:
      getFirstString(args.source, ["target_message_id", "targetMessageId"]) ??
      getFirstString(eventMetadata, ["target_message_id", "targetMessageId"]),
  };
  return Object.values(result).some((value) => typeof value === "string")
    ? result
    : undefined;
}

function normalizeSourceEventType(value: unknown): string | undefined {
  const eventType = asString(value);
  return eventType && PLATFORM_CONVERSATION_EVENT_TYPES.has(eventType)
    ? eventType
    : undefined;
}

function normalizeMessageType(
  value: unknown
): LinkedInConversationMessage["messageType"] {
  switch (value) {
    case "MESSAGE":
    case "INVITATION":
    case "INMAIL":
    case "INMAIL_DECLINE":
    case "INMAIL_REPLY":
    case "INMAIL_ACCEPT":
      return value;
    default:
      return undefined;
  }
}

function normalizeMessageMetadata(args: {
  source: Record<string, unknown>;
  timestamp?: string;
  isSender?: boolean;
  rawEventType?: string | number;
}) {
  const quotedMessage = normalizeQuotedMessage(
    args.source.quoted ??
      args.source.quote ??
      args.source.quoted_message ??
      args.source.quotedMessage,
    {
      viewerIsSender: args.isSender,
      currentSenderId: getFirstString(args.source, ["sender_id", "senderId"]),
    }
  );
  const readAt = normalizeTimestamp(
    args.source.read_at ??
      args.source.readAt ??
      args.source.seen_at ??
      args.source.seenAt
  );
  const deliveredAt = normalizeTimestamp(
    args.source.delivered_at ?? args.source.deliveredAt
  );
  const editedAt = normalizeTimestamp(
    args.source.edited_at ?? args.source.editedAt
  );
  const deletedAt = normalizeTimestamp(
    args.source.deleted_at ?? args.source.deletedAt
  );
  // Unipile sometimes exposes only the boolean state. The original message
  // timestamp preserves that state without fabricating a separate event time.
  const edited = getFirstBoolean(args.source, [
    "edited",
    "is_edited",
    "isEdited",
  ]);
  const deleted = getFirstBoolean(args.source, [
    "deleted",
    "is_deleted",
    "isDeleted",
  ]);
  const webhookReaction = asString(args.source.reaction);
  const webhookReactionSender = asRecord(args.source.reaction_sender);
  const reactionSource = webhookReaction
    ? [
        {
          value: webhookReaction,
          ...webhookReactionSender,
        },
      ]
    : (args.source.reactions ??
      args.source.message_reactions ??
      args.source.messageReactions);
  return {
    readAt:
      readAt ??
      (getFirstBoolean(args.source, ["seen"]) ? args.timestamp : undefined),
    deliveredAt:
      deliveredAt ??
      (getFirstBoolean(args.source, ["delivered"])
        ? args.timestamp
        : undefined),
    quotedMessageId:
      getFirstString(args.source, [
        "quoted_message_id",
        "quotedMessageId",
        "quote_id",
        "quoteId",
        "parent",
      ]) ?? quotedMessage?.id,
    quotedMessage,
    reactions: normalizeReactions(reactionSource),
    editedAt: editedAt ?? (edited ? args.timestamp : undefined),
    deletedAt: deletedAt ?? (deleted ? args.timestamp : undefined),
    seenBy: normalizeSeenBy(
      args.source.seen_by ??
        args.source.seenBy ??
        args.source.read_by ??
        args.source.readBy
    ),
    sourceEventType: normalizeSourceEventType(args.rawEventType),
    eventMetadata: normalizeEventMetadata({
      source: args.source,
      rawEventType: args.rawEventType,
    }),
  };
}

export function normalizeUnipileConversationMessage(
  message: UnipileMessage
): LinkedInConversationMessage {
  const source: Record<string, unknown> = {
    id: message.id,
    message_id: message.message_id,
    provider_id: message.provider_id,
    parent: message.parent,
    sender_id: message.sender_id,
    sender_attendee_id: message.sender_attendee_id,
    text: message.text,
    timestamp: message.timestamp,
    is_sender: message.is_sender,
    seen: message.seen,
    seen_at: message.seen_at,
    read_at: message.read_at,
    delivered: message.delivered,
    delivered_at: message.delivered_at,
    edited: message.edited,
    edited_at: message.edited_at,
    deleted: message.deleted,
    deleted_at: message.deleted_at,
    is_event: message.is_event,
    event_type: message.event_type,
    event_metadata: message.event_metadata,
    reactions: message.reactions,
    seen_by: message.seen_by,
    quoted: message.quoted,
  };
  const isSender = message.is_sender === 1;
  const attachments = normalizeLinkedInConversationAttachments(
    message.attachments
  );
  const text = message.text ?? "";
  const sharedPost =
    getLinkedInSharedPostFromAttachments(attachments) ??
    normalizeLinkedInSharedPost(undefined, findLinkedInPostUrl(text));
  return {
    // Unipile documents `id` as its stable message identifier. `provider_id`
    // identifies the native-platform message and is intentionally not used as
    // the cache key or quote_id sent back to Unipile.
    id: message.id,
    providerMessageId: message.provider_id,
    conversationId: message.chat_id,
    senderUserId: message.sender_id,
    senderAttendeeId: message.sender_attendee_id,
    text,
    createdAt: message.timestamp,
    direction: isSender ? "sent" : "received",
    attachments,
    ...(sharedPost ? { sharedPost } : {}),
    ...normalizeMessageMetadata({
      source,
      timestamp: message.timestamp,
      isSender,
      rawEventType: message.event_type,
    }),
    messageType: normalizeMessageType(message.message_type),
    isEvent: message.is_event === 1,
  };
}

/**
 * Normalizes a provider page and fills reply previews when Unipile returns only
 * the parent identifier instead of embedding its `quoted` object.
 */
export function normalizeUnipileConversationMessages(
  messages: UnipileMessage[]
): LinkedInConversationMessage[] {
  const normalizedMessages = messages.map(normalizeUnipileConversationMessage);
  return hydrateLinkedInConversationReplyPreviews(normalizedMessages);
}

export function hydrateLinkedInConversationReplyPreviews(
  messages: LinkedInConversationMessage[]
): LinkedInConversationMessage[] {
  const messageByIdentifier = new Map<string, LinkedInConversationMessage>();
  for (const message of messages) {
    messageByIdentifier.set(message.id, message);
    if (message.providerMessageId) {
      messageByIdentifier.set(message.providerMessageId, message);
    }
  }

  return messages.map((message) => {
    if (message.quotedMessage || !message.quotedMessageId) return message;

    const parent = messageByIdentifier.get(message.quotedMessageId);
    if (!parent) return message;

    return {
      ...message,
      quotedMessage: {
        id: parent.id,
        ...(parent.text ? { text: parent.text } : {}),
        direction: parent.direction,
        ...(parent.attachments?.[0]?.type
          ? { attachmentType: parent.attachments[0].type }
          : {}),
        ...(parent.attachments ? { attachments: parent.attachments } : {}),
        ...(parent.sharedPost ? { sharedPost: parent.sharedPost } : {}),
      },
    };
  });
}

export function normalizeLinkedInWebhookMessageMetadata(payload: unknown) {
  const envelope = asRecord(payload);
  const message = asRecord(envelope?.message);
  const source = { ...envelope, ...message };
  const timestamp = getFirstString(source, [
    "timestamp",
    "created_at",
    "createdAt",
  ]);
  const rawEventType = source.event_type ?? source.eventType;
  return {
    attachments: normalizeLinkedInConversationAttachments(source.attachments),
    ...normalizeMessageMetadata({
      source,
      timestamp,
      isSender: getFirstBoolean(source, ["is_sender", "isSender"]),
      rawEventType:
        typeof rawEventType === "string" || typeof rawEventType === "number"
          ? rawEventType
          : undefined,
    }),
  };
}
