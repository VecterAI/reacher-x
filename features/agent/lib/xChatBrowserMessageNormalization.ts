import type { AttachmentInfo, Event } from "@xdevplatform/chat-xdk";

export type BrowserDecryptedXChatAttachment = {
  id?: string;
  mediaKey?: string;
  type: string;
  url?: string;
  previewUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  durationMs?: number;
  variants?: Array<{
    url: string;
    mimeType?: string;
    bitrate?: number;
    width?: number;
    height?: number;
  }>;
  isGif?: boolean;
  isVoiceNote?: boolean;
  isLoading?: boolean;
  unavailable?: boolean;
  urlExpiresAt?: string;
  linkedinPostUrl?: string;
};

export type BrowserDecryptedXChatMessage = {
  id: string;
  sequenceId?: string;
  /** The exact conversation key version used for this message's media. */
  keyVersion?: string;
  senderId: string;
  direction: "sent" | "received";
  occurredAt: number;
  text: string;
  attachments?: BrowserDecryptedXChatAttachment[];
  quotedMessageId?: string;
  quotedMessage?: {
    id: string;
    text?: string;
    direction?: "sent" | "received";
    attachmentType?: string;
    attachments?: BrowserDecryptedXChatAttachment[];
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    reactedByViewer?: boolean;
  }>;
  editedAt?: string;
  deletedAt?: string;
  readAt?: string;
  deliveryStatus?: "sending" | "sent" | "failed";
  deliveryError?: string;
  clientRequestId?: string;
};

export type BrowserDecryptedXChatMessageUpdate = {
  targetMessageId: string;
  reactions?: BrowserDecryptedXChatMessage["reactions"];
  text?: string;
  editedAt?: string;
  deletedAt?: string;
};

export type BrowserDecryptedXChatReadReceipt = {
  senderId: string;
  seenUntilSequenceId?: string;
  seenAt: string;
  occurredAt: number;
};

export type BrowserDecryptedXChatConversation = {
  messages: BrowserDecryptedXChatMessage[];
  messageUpdates: BrowserDecryptedXChatMessageUpdate[];
  readReceipts: BrowserDecryptedXChatReadReceipt[];
};

export function hydrateXChatQuotedMessages(
  messages: BrowserDecryptedXChatMessage[]
): BrowserDecryptedXChatMessage[] {
  const messagesByProviderId = new Map<string, BrowserDecryptedXChatMessage>();
  for (const message of messages) {
    messagesByProviderId.set(message.id, message);
    if (message.sequenceId) {
      messagesByProviderId.set(message.sequenceId, message);
    }
  }

  return messages.map((message) => {
    const quote = message.quotedMessage;
    if (!quote) return message;
    const target = messagesByProviderId.get(quote.id);
    if (!target) return message;
    return {
      ...message,
      quotedMessage: {
        ...quote,
        text: quote.text ?? target.text,
        direction: quote.direction ?? target.direction,
        attachmentType: quote.attachmentType ?? target.attachments?.[0]?.type,
        attachments: target.attachments ?? quote.attachments,
      },
    };
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function getString(
  record: Record<string, unknown> | undefined,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function getStringArray(
  record: Record<string, unknown>,
  ...keys: string[]
): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
  }
  return [];
}

function getFiniteNumber(
  record: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

const XCHAT_MEDIA_TYPE_BY_WIRE_VALUE: Readonly<Record<number, string>> = {
  1: "image",
  2: "gif",
  3: "video",
  4: "audio",
  5: "file",
  6: "svg",
};

function normalizeXChatMediaType(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim();
    const numericValue = Number(normalized);
    return Number.isInteger(numericValue)
      ? XCHAT_MEDIA_TYPE_BY_WIRE_VALUE[numericValue]
      : normalized;
  }
  return typeof value === "number" && Number.isInteger(value)
    ? XCHAT_MEDIA_TYPE_BY_WIRE_VALUE[value]
    : undefined;
}

function normalizeAttachmentVariants(
  attachment: AttachmentInfo
): BrowserDecryptedXChatAttachment["variants"] {
  const attachmentRecord = attachment as Record<string, unknown>;
  const source = attachmentRecord.variants;
  if (!Array.isArray(source)) {
    return undefined;
  }

  const variants: NonNullable<BrowserDecryptedXChatAttachment["variants"]> = [];
  for (const value of source) {
    const variant = asRecord(value);
    const url = getString(variant, "url");
    if (!url) {
      continue;
    }
    const mimeType = getString(
      variant,
      "mimeType",
      "mime_type",
      "contentType",
      "content_type"
    );
    const bitrate = getFiniteNumber(variant, "bitrate", "bitRate", "bit_rate");
    const width = getFiniteNumber(variant, "width");
    const height = getFiniteNumber(variant, "height");
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

function normalizeAttachment(
  attachment: AttachmentInfo
): BrowserDecryptedXChatAttachment {
  const attachmentRecord = attachment as Record<string, unknown>;
  const mediaType = normalizeXChatMediaType(
    attachmentRecord.mediaType ?? attachmentRecord.media_type
  );
  const type = mediaType ?? attachment.attachmentType ?? "attachment";
  const pathLikeValue = `${type} ${attachment.filename ?? ""}`.toLowerCase();
  const isVoiceNote =
    pathLikeValue.includes("audio") ||
    /\.(aac|flac|m4a|mp3|oga|ogg|wav)$/.test(pathLikeValue);
  const directUrl =
    attachment.legacyMediaUrlHttps ?? attachment.url ?? attachment.postUrl;
  const variants = normalizeAttachmentVariants(attachment);
  const url =
    directUrl ??
    variants?.find((variant) =>
      variant.mimeType?.toLowerCase().startsWith("audio/")
    )?.url ??
    variants?.find((variant) =>
      variant.mimeType?.toLowerCase().startsWith("video/")
    )?.url;
  const mimeType = mediaType?.includes("/") ? mediaType : undefined;

  return {
    id: attachment.attachmentId ?? attachment.restId,
    mediaKey: attachment.mediaHashKey,
    type,
    url,
    previewUrl: attachment.legacyMediaPreviewUrl,
    altText: attachment.fallbackText,
    width: attachment.dimensions?.width,
    height: attachment.dimensions?.height,
    fileName: attachment.filename,
    mimeType,
    fileSize: attachment.filesizeBytes,
    durationMs: attachment.durationMillis,
    variants,
    isGif: /(?:animated_)?gif/iu.test(pathLikeValue),
    isVoiceNote,
    // A media hash identifies encrypted XChat bytes, not a browser-playable
    // resource. Rendering it requires an authenticated X media download,
    // followed by browser-only decryption with this event's conversation key.
    unavailable: !url,
    urlExpiresAt: getString(
      attachmentRecord,
      "urlExpiresAt",
      "url_expires_at",
      "expiresAt",
      "expires_at"
    ),
  };
}

function normalizeContentAttachment(value: unknown): AttachmentInfo | null {
  const attachment = asRecord(value);
  if (!attachment) return null;
  const dimensions = asRecord(attachment.dimensions);
  const width =
    getFiniteNumber(dimensions, "width") ??
    getFiniteNumber(attachment, "width");
  const height =
    getFiniteNumber(dimensions, "height") ??
    getFiniteNumber(attachment, "height");

  return {
    attachmentType: getString(attachment, "attachmentType", "attachment_type"),
    mediaHashKey: getString(attachment, "mediaHashKey", "media_hash_key"),
    ...(typeof width === "number" || typeof height === "number"
      ? { dimensions: { width, height } }
      : {}),
    mediaType: normalizeXChatMediaType(
      attachment.mediaType ??
        attachment.media_type ??
        attachment.mimeType ??
        attachment.mime_type ??
        attachment.contentType ??
        attachment.content_type
    ),
    durationMillis: getFiniteNumber(
      attachment,
      "durationMillis",
      "duration_millis"
    ),
    filesizeBytes: getFiniteNumber(
      attachment,
      "filesizeBytes",
      "filesize_bytes"
    ),
    filename: getString(attachment, "filename", "fileName", "file_name"),
    attachmentId: getString(attachment, "attachmentId", "attachment_id"),
    legacyMediaUrlHttps: getString(
      attachment,
      "legacyMediaUrlHttps",
      "legacy_media_url_https"
    ),
    legacyMediaPreviewUrl: getString(
      attachment,
      "legacyMediaPreviewUrl",
      "legacy_media_preview_url"
    ),
    url: getString(attachment, "url"),
    restId: getString(attachment, "restId", "rest_id"),
    postUrl: getString(attachment, "postUrl", "post_url"),
    fallbackText: getString(attachment, "fallbackText", "fallback_text"),
    variants: attachment.variants,
  };
}

function normalizeMessageAttachments(
  event: Event
): BrowserDecryptedXChatAttachment[] {
  const contentAttachments = Array.isArray(event.content?.attachments)
    ? event.content.attachments
        .map(normalizeContentAttachment)
        .filter((attachment): attachment is AttachmentInfo =>
          Boolean(attachment)
        )
    : [];
  const attachments = (
    event.attachments?.length ? event.attachments : contentAttachments
  ).map(normalizeAttachment);
  const existingMediaKeys = new Set(
    attachments.flatMap((attachment) =>
      attachment.mediaKey ? [attachment.mediaKey] : []
    )
  );

  for (const mediaHash of event.mediaHashes ?? []) {
    if (
      !mediaHash.mediaHashKey ||
      existingMediaKeys.has(mediaHash.mediaHashKey)
    ) {
      continue;
    }
    const type = mediaHash.source?.trim() || "attachment";
    attachments.push({
      mediaKey: mediaHash.mediaHashKey,
      type,
      isVoiceNote: /audio|voice/iu.test(type),
      unavailable: true,
    });
    existingMediaKeys.add(mediaHash.mediaHashKey);
  }

  return attachments;
}

function normalizeReplyPreview(
  event: Event,
  viewerUserId: string
): BrowserDecryptedXChatMessage["quotedMessage"] {
  if (event.replyPreviewValidation === "invalid") return undefined;
  const content = asRecord(event.content);
  const preview = asRecord(
    content?.replyingToPreview ?? content?.replying_to_preview
  );
  if (!preview) return undefined;
  const id = getString(
    preview,
    "id",
    "sequenceId",
    "sequence_id",
    "messageId",
    "replyingToMessageSequenceId",
    "replying_to_message_sequence_id",
    "replyingToMessageId",
    "replying_to_message_id"
  );
  if (!id) return undefined;
  const senderId = getString(preview, "senderId", "sender_id");
  const previewAttachments = preview.attachments;
  const attachments = Array.isArray(previewAttachments)
    ? previewAttachments
        .map(normalizeContentAttachment)
        .filter((attachment): attachment is AttachmentInfo =>
          Boolean(attachment)
        )
        .map(normalizeAttachment)
    : [];
  const attachmentType = attachments[0]?.type;

  return {
    id,
    text: getString(preview, "text", "messageText", "message_text"),
    direction: senderId
      ? senderId === viewerUserId
        ? "sent"
        : "received"
      : undefined,
    attachmentType,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

function toIsoTimestamp(timestamp: number): string | undefined {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return new Date(timestamp).toISOString();
}

function compareNumericSequenceIds(left: string, right: string) {
  if (!/^\d+$/u.test(left) || !/^\d+$/u.test(right)) return undefined;
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
}

export function applyXChatReadReceipts(
  messages: BrowserDecryptedXChatMessage[],
  receipts: BrowserDecryptedXChatReadReceipt[]
): BrowserDecryptedXChatMessage[] {
  if (receipts.length === 0) return messages;
  const messageBySequenceId = new Map(
    messages.flatMap((message) =>
      message.sequenceId ? [[message.sequenceId, message] as const] : []
    )
  );

  return messages.map((message) => {
    if (message.direction !== "sent") return message;
    let readAt = message.readAt;
    for (const receipt of receipts) {
      const targetSequenceId = receipt.seenUntilSequenceId;
      const sequenceComparison =
        message.sequenceId && targetSequenceId
          ? compareNumericSequenceIds(message.sequenceId, targetSequenceId)
          : undefined;
      const targetMessage = targetSequenceId
        ? messageBySequenceId.get(targetSequenceId)
        : undefined;
      const isRead = targetSequenceId
        ? message.sequenceId === targetSequenceId ||
          sequenceComparison === -1 ||
          (sequenceComparison === undefined &&
            Boolean(targetMessage) &&
            message.occurredAt <= (targetMessage?.occurredAt ?? 0))
        : message.occurredAt <= receipt.occurredAt;
      if (isRead && (!readAt || receipt.seenAt > readAt)) {
        readAt = receipt.seenAt;
      }
    }
    return readAt && readAt !== message.readAt
      ? { ...message, readAt }
      : message;
  });
}

export function normalizeVerifiedXChatConversation(args: {
  events: Event[];
  viewerUserId: string;
}): BrowserDecryptedXChatConversation {
  const messages: BrowserDecryptedXChatMessage[] = [];
  const messagesByProviderId = new Map<string, BrowserDecryptedXChatMessage>();
  const reactionsByMessage = new Map<string, Map<string, Set<string>>>();
  const updatesByMessageId = new Map<
    string,
    BrowserDecryptedXChatMessageUpdate
  >();
  const readReceipts: BrowserDecryptedXChatReadReceipt[] = [];

  for (const event of args.events) {
    if (
      event.type !== "message" ||
      event.verified !== true ||
      typeof event.senderId !== "string"
    ) {
      continue;
    }
    const content = asRecord(event.content);
    const contentType =
      getString(content, "contentType", "content_type") ?? "text";
    const text = getString(content, "text")?.trim() ?? "";
    const attachments = normalizeMessageAttachments(event);
    if (
      contentType !== "text" &&
      contentType !== "unknown" &&
      attachments.length === 0
    ) {
      continue;
    }
    if (!text && attachments.length === 0) continue;

    const occurredAt =
      typeof event.createdAtMsec === "number" &&
      Number.isFinite(event.createdAtMsec)
        ? event.createdAtMsec
        : 0;
    const id =
      event.id ?? event.sequenceId ?? `${event.senderId}:${occurredAt}`;
    const keyVersion =
      typeof event.keyVersion === "string" && event.keyVersion.trim()
        ? event.keyVersion.trim()
        : undefined;
    const quotedMessage = normalizeReplyPreview(event, args.viewerUserId);
    const message: BrowserDecryptedXChatMessage = {
      id,
      sequenceId: event.sequenceId,
      ...(keyVersion ? { keyVersion } : {}),
      senderId: event.senderId,
      direction: event.senderId === args.viewerUserId ? "sent" : "received",
      occurredAt,
      text,
      attachments: attachments.length ? attachments : undefined,
      quotedMessageId: quotedMessage?.id,
      quotedMessage,
    };
    messages.push(message);
    messagesByProviderId.set(id, message);
    if (event.sequenceId) messagesByProviderId.set(event.sequenceId, message);
  }

  for (const event of args.events) {
    if (event.verified !== true) continue;
    const occurredAt =
      typeof event.createdAtMsec === "number" &&
      Number.isFinite(event.createdAtMsec)
        ? event.createdAtMsec
        : 0;
    const timestamp = toIsoTimestamp(occurredAt);

    if (event.type === "message") {
      // chat-xdk's runtime objects currently preserve X's snake_case content
      // keys even though its TypeScript convenience interface is camelCase.
      // Normalize both forms at this boundary so reactions, edits, and replies
      // are not silently discarded when the provider shape changes casing.
      const content = asRecord(event.content);
      const contentType = getString(content, "contentType", "content_type");
      const targetMessageId = getString(
        content,
        "targetMessageId",
        "target_message_id"
      );
      const newText = getString(content, "newText", "new_text");
      const emoji = getString(content, "emoji");
      const targetMessage = targetMessageId
        ? messagesByProviderId.get(targetMessageId)
        : undefined;
      if (contentType === "edit" && targetMessage) {
        if (newText) {
          targetMessage.text = newText.trim();
        }
        targetMessage.editedAt = timestamp;
      } else if (contentType === "edit" && targetMessageId && newText) {
        updatesByMessageId.set(targetMessageId, {
          ...updatesByMessageId.get(targetMessageId),
          targetMessageId,
          text: newText.trim(),
          editedAt: timestamp,
        });
      }
      if (
        (contentType === "reaction" || contentType === "reactionRemoved") &&
        targetMessageId &&
        typeof event.senderId === "string" &&
        emoji
      ) {
        const messageReactions =
          reactionsByMessage.get(targetMessageId) ??
          new Map<string, Set<string>>();
        const senders = messageReactions.get(emoji) ?? new Set<string>();
        if (contentType === "reaction") senders.add(event.senderId);
        else senders.delete(event.senderId);
        messageReactions.set(emoji, senders);
        reactionsByMessage.set(targetMessageId, messageReactions);
      }
      continue;
    }

    const eventRecord = event as unknown as Record<string, unknown>;
    if (event.type === "messageDeleted") {
      const deletedIds = [
        ...getStringArray(
          eventRecord,
          "messageIds",
          "message_ids",
          "deletedMessageIds"
        ),
      ];
      const singleDeletedId = getString(
        eventRecord,
        "messageId",
        "message_id",
        "targetMessageId",
        "sequenceId"
      );
      if (singleDeletedId) deletedIds.push(singleDeletedId);
      for (const deletedId of deletedIds) {
        const message = messagesByProviderId.get(deletedId);
        if (message) {
          message.deletedAt = timestamp;
        } else {
          updatesByMessageId.set(deletedId, {
            ...updatesByMessageId.get(deletedId),
            targetMessageId: deletedId,
            deletedAt: timestamp,
          });
        }
      }
    }

    if (
      event.type === "readReceipt" &&
      typeof event.senderId === "string" &&
      event.senderId !== args.viewerUserId &&
      timestamp
    ) {
      const content = asRecord(event.content);
      const seenUntilSequenceId =
        getString(
          eventRecord,
          "seenUntilSequenceId",
          "seen_until_sequence_id"
        ) ??
        getString(content, "seenUntilSequenceId", "seen_until_sequence_id");
      const seenAtMillis =
        getFiniteNumber(eventRecord, "seenAtMillis", "seen_at_millis") ??
        getFiniteNumber(content, "seenAtMillis", "seen_at_millis") ??
        occurredAt;
      readReceipts.push({
        senderId: event.senderId,
        ...(seenUntilSequenceId ? { seenUntilSequenceId } : {}),
        seenAt: toIsoTimestamp(seenAtMillis) ?? timestamp,
        occurredAt,
      });
    }
  }

  for (const [targetId, reactionMap] of reactionsByMessage) {
    const message = messagesByProviderId.get(targetId);
    const reactions = Array.from(reactionMap.entries()).flatMap(
      ([emoji, senders]) =>
        senders.size
          ? [
              {
                emoji,
                count: senders.size,
                reactedByViewer: senders.has(args.viewerUserId),
              },
            ]
          : []
    );
    if (message) {
      message.reactions = reactions;
    } else {
      updatesByMessageId.set(targetId, {
        ...updatesByMessageId.get(targetId),
        targetMessageId: targetId,
        reactions,
      });
    }
  }

  return {
    messages: applyXChatReadReceipts(
      hydrateXChatQuotedMessages(messages),
      readReceipts
    ).sort((left, right) => left.occurredAt - right.occurredAt),
    messageUpdates: [...updatesByMessageId.values()],
    readReceipts,
  };
}

export function normalizeVerifiedXChatMessages(args: {
  events: Event[];
  viewerUserId: string;
}): BrowserDecryptedXChatMessage[] {
  return normalizeVerifiedXChatConversation(args).messages;
}
