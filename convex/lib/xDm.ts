"use node";

import {
  type XDmAttachmentSummary,
  type XDmAttachmentVariant,
  type XDmEventMetadata,
  type XDmMessage,
  type XDmQuotedMessage,
  type XDmReaction,
  type XDmSeenBy,
  type XDmSharedPost,
} from "../../shared/lib/twitter/dm";
import {
  isTwitterShortUrl,
  normalizeHttpUrl,
} from "../../shared/lib/twitter/profileLinks";
import {
  buildTwitterPostUrl,
  extractTwitterPostIdFromUrl,
} from "../../shared/lib/twitter/contracts";
import { parseIsoToTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { detectUrls } from "../../shared/lib/utils/url/urlDetection";
import { inferAttachmentMediaKind } from "../../shared/lib/utils/media/inferAttachmentMediaKind";
import { resolveExternalUrl } from "./twitterProfileLinkResolver";
import { isRecord } from "./typeGuards";

type ConversationAttachmentLike = {
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
  variants?: XDmAttachmentVariant[];
  isGif?: boolean;
  isVoiceNote?: boolean;
  unavailable?: boolean;
  urlExpiresAt?: string;
  linkedinPostUrl?: string;
};

type ConversationQuotedMessageLike = {
  id: string;
  text?: string;
  senderName?: string;
  direction?: "sent" | "received";
  attachmentType?: string;
  attachments?: ConversationAttachmentLike[];
  sharedPost?: ConversationSharedPostLike;
};

type ConversationSharedPostLike = {
  id: string;
  url: string;
  text?: string;
  authorId?: string;
  authorHandle?: string;
  authorName?: string;
  authorAvatarUrl?: string;
  createdAt?: string;
  media?: ConversationAttachmentLike[];
};

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

const MAX_DM_SHORT_URL_RESOLUTIONS = 8;

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
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

function getFirstString(
  record: Record<string, unknown> | null | undefined,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = asString(record?.[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function getFirstNumber(
  record: Record<string, unknown> | null | undefined,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = asFiniteNumber(record?.[key]);
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

function getFirstBoolean(
  record: Record<string, unknown> | null | undefined,
  keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const value = asBoolean(record?.[key]);
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function getRecordArray(
  record: Record<string, unknown> | null | undefined,
  keys: string[]
): Record<string, unknown>[] {
  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) {
      return value
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item));
    }
  }
  return [];
}

function normalizeTimestamp(value: unknown): string | undefined {
  const source = asString(value);
  if (source && parseIsoToTimestamp(source) !== undefined) {
    return source;
  }
  const milliseconds = asFiniteNumber(value);
  return typeof milliseconds === "number"
    ? new Date(milliseconds).toISOString()
    : undefined;
}

function getMediaByKey(
  response: unknown,
  mediaKey?: string
): Record<string, unknown> | null {
  if (!mediaKey) {
    return null;
  }
  const includes = asRecord(asRecord(response)?.includes);
  const media = getRecordArray(includes, ["media"]);
  return (
    media.find(
      (item) => getFirstString(item, ["mediaKey", "media_key"]) === mediaKey
    ) ?? null
  );
}

function getTweetById(
  response: unknown,
  tweetId?: string
): Record<string, unknown> | null {
  if (!tweetId) {
    return null;
  }
  const includes = asRecord(asRecord(response)?.includes);
  const tweets = getRecordArray(includes, ["tweets"]);
  return tweets.find((tweet) => asString(tweet.id) === tweetId) ?? null;
}

function getUserById(
  response: unknown,
  userId?: string
): Record<string, unknown> | null {
  if (!userId) {
    return null;
  }
  const includes = asRecord(asRecord(response)?.includes);
  const users = getRecordArray(includes, ["users"]);
  return users.find((item) => asString(item.id) === userId) ?? null;
}

function getAttachmentMediaKeys(event: Record<string, unknown>): string[] {
  const attachments = asRecord(event.attachments);
  const mediaKeys = Array.isArray(attachments?.media_keys)
    ? attachments.media_keys
    : Array.isArray(attachments?.mediaKeys)
      ? attachments.mediaKeys
      : [];

  return mediaKeys
    .map((mediaKey) => asString(mediaKey))
    .filter((mediaKey): mediaKey is string => Boolean(mediaKey));
}

function normalizeAttachmentVariants(
  media: Record<string, unknown>
): XDmAttachmentVariant[] | undefined {
  const variants: XDmAttachmentVariant[] = [];
  const videoInfo = asRecord(media.video_info) ?? asRecord(media.videoInfo);
  const sourceVariants = [
    ...getRecordArray(media, ["variants"]),
    ...getRecordArray(videoInfo, ["variants"]),
  ];
  for (const variant of sourceVariants) {
    const url = getFirstString(variant, ["url"]);
    if (!url) {
      continue;
    }
    const mimeType = getFirstString(variant, [
      "contentType",
      "content_type",
      "mimeType",
      "mime_type",
    ]);
    const bitrate = getFirstNumber(variant, ["bitRate", "bit_rate", "bitrate"]);
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

function getMediaUnavailable(
  media: Record<string, unknown>
): boolean | undefined {
  const explicit = getFirstBoolean(media, [
    "unavailable",
    "isUnavailable",
    "is_unavailable",
  ]);
  if (typeof explicit === "boolean") {
    return explicit;
  }

  const availability = asRecord(media.availability);
  const status = getFirstString(availability, ["status"]);
  return status &&
    /^(?:unavailable|failed|expired|not_available)$/iu.test(status)
    ? true
    : undefined;
}

function normalizeMediaAttachment(
  mediaKey: string,
  media: Record<string, unknown>
): XDmAttachmentSummary {
  const rawType = getFirstString(media, ["type", "mediaType", "media_type"]);
  const mimeType = getFirstString(media, [
    "mimeType",
    "mime_type",
    "contentType",
    "content_type",
  ]);
  const fileName = getFirstString(media, [
    "fileName",
    "file_name",
    "filename",
    "name",
  ]);
  const type =
    rawType ?? (mimeType?.startsWith("audio/") ? "audio" : "unknown");
  const normalizedType = type.toLowerCase();
  const variants = normalizeAttachmentVariants(media);
  const explicitUrl = getFirstString(media, [
    "url",
    "mediaUrl",
    "media_url",
    "mediaUrlHttps",
    "media_url_https",
    "downloadUrl",
    "download_url",
  ]);
  const previewUrl = getFirstString(media, [
    "previewImageUrl",
    "preview_image_url",
    "previewUrl",
    "preview_url",
  ]);
  const isAudio =
    normalizedType.includes("audio") ||
    mimeType?.toLowerCase().startsWith("audio/") === true ||
    /\.(?:aac|flac|m4a|mp3|oga|ogg|wav)$/iu.test(fileName ?? "");
  const playableVariantUrl = variants?.find(
    (variant) =>
      variant.mimeType?.toLowerCase().startsWith("audio/") ||
      variant.mimeType?.toLowerCase().startsWith("video/")
  )?.url;
  const url = explicitUrl ?? playableVariantUrl;
  const videoInfo = asRecord(media.video_info) ?? asRecord(media.videoInfo);
  const explicitUnavailable = getMediaUnavailable(media);
  return {
    id: getFirstString(media, [
      "id",
      "id_str",
      "mediaId",
      "media_id",
      "attachmentId",
    ]),
    mediaKey,
    type,
    url,
    previewUrl,
    altText: getFirstString(media, ["altText", "alt_text"]),
    width:
      getFirstNumber(media, ["width"]) ??
      getFirstNumber(asRecord(media.original_info), ["width"]),
    height:
      getFirstNumber(media, ["height"]) ??
      getFirstNumber(asRecord(media.original_info), ["height"]),
    fileName,
    mimeType,
    fileSize: getFirstNumber(media, [
      "fileSize",
      "file_size",
      "filesizeBytes",
      "filesize_bytes",
      "size",
    ]),
    durationMs:
      getFirstNumber(media, [
        "durationMs",
        "duration_ms",
        "durationMillis",
        "duration_millis",
      ]) ??
      getFirstNumber(videoInfo, [
        "durationMs",
        "duration_millis",
        "durationMillis",
      ]),
    variants,
    isGif:
      getFirstBoolean(media, ["isGif", "is_gif"]) ??
      (normalizedType === "animated_gif" || normalizedType === "gif"),
    isVoiceNote:
      getFirstBoolean(media, [
        "isVoiceNote",
        "is_voice_note",
        "voiceNote",
        "voice_note",
      ]) ??
      (normalizedType.includes("voice") || isAudio),
    unavailable:
      explicitUnavailable ?? !(url || previewUrl || variants?.length),
    urlExpiresAt: normalizeTimestamp(
      media.urlExpiresAt ??
        media.url_expires_at ??
        media.expiresAt ??
        media.expires_at
    ),
    linkedinPostUrl: getFirstString(media, [
      "linkedinPostUrl",
      "linkedin_post_url",
    ]),
  };
}

function getReferencedTweetRecords(
  event: Record<string, unknown>
): Record<string, unknown>[] {
  return getRecordArray(event, ["referenced_tweets", "referencedTweets"]);
}

function normalizeReferencedTweetMedia(
  response: unknown,
  tweet: Record<string, unknown> | null
): XDmAttachmentSummary[] | undefined {
  if (!tweet) {
    return undefined;
  }

  const media = getAttachmentMediaKeys(tweet)
    .map((mediaKey) => {
      const includedMedia = getMediaByKey(response, mediaKey);
      return includedMedia
        ? normalizeMediaAttachment(mediaKey, includedMedia)
        : undefined;
    })
    .filter((attachment): attachment is XDmAttachmentSummary =>
      Boolean(attachment)
    );

  return media.length > 0 ? media : undefined;
}

function normalizeReferencedTweetSharedPost(
  response: unknown,
  event: Record<string, unknown>
): XDmSharedPost | undefined {
  const reference = getReferencedTweetRecords(event).find((candidate) =>
    Boolean(getFirstString(candidate, ["id", "tweet_id", "tweetId"]))
  );
  const id = getFirstString(reference, ["id", "tweet_id", "tweetId"]);
  if (!id) {
    return undefined;
  }

  const tweet = getTweetById(response, id);
  const authorId = getFirstString(tweet, ["author_id", "authorId"]);
  const author = getUserById(response, authorId);
  const media = normalizeReferencedTweetMedia(response, tweet);
  const text = getFirstString(tweet, ["text"]);
  const authorHandle = getFirstString(author, ["username"]);
  const authorName = getFirstString(author, ["name"]);
  const authorAvatarUrl = getFirstString(author, [
    "profileImageUrl",
    "profile_image_url",
  ]);
  const createdAt = normalizeTimestamp(tweet?.created_at ?? tweet?.createdAt);
  return {
    id,
    url: buildTwitterPostUrl({ postId: id }),
    ...(text ? { text } : {}),
    ...(authorId ? { authorId } : {}),
    ...(authorHandle ? { authorHandle } : {}),
    ...(authorName ? { authorName } : {}),
    ...(authorAvatarUrl ? { authorAvatarUrl } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(media ? { media } : {}),
  };
}

function getReferencedTweetAttachments(
  response: unknown,
  event: Record<string, unknown>
): XDmAttachmentSummary[] {
  const attachments: XDmAttachmentSummary[] = [];
  for (const reference of getReferencedTweetRecords(event)) {
    const id = getFirstString(reference, ["id", "tweet_id", "tweetId"]);
    if (!id) {
      continue;
    }
    const altText = getFirstString(getTweetById(response, id), ["text"]);
    attachments.push({
      id,
      type: "post",
      url: buildTwitterPostUrl({ postId: id }),
      ...(altText ? { altText } : {}),
    });
  }
  return attachments;
}

function stripTrailingMediaTcoUrl(
  text: string,
  attachments: XDmAttachmentSummary[]
): string {
  const hasMediaAttachment = attachments.some(
    (attachment) => attachment.type.trim().toLowerCase() !== "post"
  );
  if (!hasMediaAttachment) {
    return text;
  }

  return text.replace(/\s*https:\/\/t\.co\/[A-Za-z0-9]+\s*$/u, "").trimEnd();
}

function getDmUrlRecords(
  event: Record<string, unknown>
): Record<string, unknown>[] {
  const entities = asRecord(event.entities);
  return [
    ...getRecordArray(event, ["urls"]),
    ...getRecordArray(entities, ["urls"]),
  ];
}

function replaceDmTextUrlsFromProvider(
  text: string,
  event: Record<string, unknown>
): string {
  let normalizedText = text;
  for (const urlEntity of getDmUrlRecords(event)) {
    const sourceUrl = getFirstString(urlEntity, [
      "url",
      "shortUrl",
      "short_url",
    ]);
    const expandedUrl = getFirstString(urlEntity, [
      "expandedUrl",
      "expanded_url",
      "unwoundUrl",
      "unwound_url",
    ]);
    const canonicalExpandedUrl = expandedUrl
      ? normalizeHttpUrl(expandedUrl)
      : undefined;
    if (
      !sourceUrl ||
      !canonicalExpandedUrl ||
      sourceUrl === canonicalExpandedUrl
    ) {
      continue;
    }
    normalizedText = normalizedText.split(sourceUrl).join(canonicalExpandedUrl);
  }
  return normalizedText;
}

function getSharedPostFromText(text: string): XDmSharedPost | undefined {
  for (const candidate of detectUrls(text)) {
    if (!candidate.isValid) {
      continue;
    }
    const id = extractTwitterPostIdFromUrl(candidate.url);
    if (id) {
      return { id, url: buildTwitterPostUrl({ postId: id }) };
    }
  }
  return undefined;
}

function normalizeDmText(
  event: Record<string, unknown>,
  attachments: XDmAttachmentSummary[]
): string {
  const text = asString(event.text) ?? "";
  return replaceDmTextUrlsFromProvider(
    stripTrailingMediaTcoUrl(text, attachments),
    event
  );
}

/**
 * Providers usually include expanded URL entities. For sparse restored events,
 * resolve only a bounded number of remaining t.co URLs before persistence.
 */
export async function resolveDmMessageUrls(
  messages: XDmMessage[],
  resolveUrl: (url: string) => Promise<string | undefined> = resolveExternalUrl
): Promise<XDmMessage[]> {
  const unresolvedUrls: string[] = [];
  const seenUrls = new Set<string>();
  for (const message of messages) {
    for (const candidate of detectUrls(message.text)) {
      if (
        candidate.isValid &&
        isTwitterShortUrl(candidate.url) &&
        !seenUrls.has(candidate.url)
      ) {
        seenUrls.add(candidate.url);
        unresolvedUrls.push(candidate.url);
      }
    }
  }

  const resolvedUrls: Array<[string, string | undefined]> = await Promise.all(
    unresolvedUrls
      .slice(0, MAX_DM_SHORT_URL_RESOLUTIONS)
      .map(
        async (url): Promise<[string, string | undefined]> => [
          url,
          await resolveUrl(url),
        ]
      )
  );
  const replacements = new Map<string, string>();
  for (const [shortUrl, resolvedUrl] of resolvedUrls) {
    if (typeof resolvedUrl === "string" && !isTwitterShortUrl(resolvedUrl)) {
      replacements.set(shortUrl, resolvedUrl);
    }
  }

  if (replacements.size === 0) {
    return messages;
  }

  return messages.map((message) => {
    let text = message.text;
    for (const [shortUrl, expandedUrl] of replacements) {
      text = text.split(shortUrl).join(expandedUrl);
    }
    const sharedPost = message.sharedPost ?? getSharedPostFromText(text);
    return {
      ...message,
      text,
      ...(sharedPost ? { sharedPost } : {}),
    };
  });
}

export function normalizeDmAttachments(
  response: unknown,
  event: Record<string, unknown>
): XDmAttachmentSummary[] {
  const mediaAttachments = getAttachmentMediaKeys(event)
    .map((mediaKey) => {
      const media = getMediaByKey(response, mediaKey);
      return media ? normalizeMediaAttachment(mediaKey, media) : null;
    })
    .filter((attachment): attachment is XDmAttachmentSummary =>
      Boolean(attachment)
    );

  return [
    ...mediaAttachments,
    ...getReferencedTweetAttachments(response, event),
  ];
}

function normalizeDirection(
  value: unknown,
  viewerXUserId?: string,
  senderUserId?: string
): "sent" | "received" {
  const source = asString(value)?.toLowerCase();
  if (source === "sent" || source === "outbound" || source === "outgoing") {
    return "sent";
  }
  if (source === "received" || source === "inbound" || source === "incoming") {
    return "received";
  }
  return viewerXUserId && senderUserId === viewerXUserId ? "sent" : "received";
}

function normalizeQuotedMessage(
  event: Record<string, unknown>,
  viewerXUserId?: string
): XDmQuotedMessage | undefined {
  const quoted =
    asRecord(event.quoted_message) ??
    asRecord(event.quotedMessage) ??
    asRecord(event.reply_to) ??
    asRecord(event.replyTo);
  const id = getFirstString(quoted, ["id", "message_id", "messageId"]);
  if (!quoted || !id) {
    return undefined;
  }
  const sender = asRecord(quoted.sender);
  const senderUserId = getFirstString(quoted, ["sender_id", "senderId"]);
  const rawAttachments = getRecordArray(quoted, ["attachments"]);
  const attachments = rawAttachments.map((attachment, index) =>
    normalizeMediaAttachment(
      getFirstString(attachment, ["media_key", "mediaKey", "id"]) ??
        `quoted-${id}-${index}`,
      attachment
    )
  );
  const attachment = rawAttachments[0];
  return {
    id,
    text: getFirstString(quoted, ["text", "message"]),
    senderName:
      getFirstString(quoted, ["senderName", "sender_name", "name"]) ??
      getFirstString(sender, ["name", "username"]),
    direction: normalizeDirection(
      quoted.direction,
      viewerXUserId,
      senderUserId
    ),
    attachmentType: getFirstString(attachment, [
      "type",
      "media_type",
      "mediaType",
    ]),
    ...(attachments.length > 0 ? { attachments } : {}),
  };
}

function normalizeReactions(
  event: Record<string, unknown>
): XDmReaction[] | undefined {
  const source =
    event.reactions ??
    event.message_reactions ??
    event.messageReactions ??
    event.reaction;
  const records = Array.isArray(source)
    ? source
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : asRecord(source)
      ? [asRecord(source)!]
      : [];
  const reactions: XDmReaction[] = [];
  for (const reaction of records) {
    const emoji = getFirstString(reaction, [
      "emoji",
      "reaction",
      "type",
      "name",
    ]);
    if (!emoji) {
      continue;
    }
    const reactedByViewer = getFirstBoolean(reaction, [
      "reactedByViewer",
      "reacted_by_viewer",
      "viewer_reacted",
      "is_viewer",
    ]);
    reactions.push({
      emoji,
      count: Math.max(
        0,
        getFirstNumber(reaction, ["count", "total_count", "totalCount"]) ?? 1
      ),
      ...(typeof reactedByViewer === "boolean" ? { reactedByViewer } : {}),
    });
  }
  return reactions.length > 0 ? reactions : undefined;
}

function normalizeSeenBy(
  event: Record<string, unknown>
): XDmSeenBy[] | undefined {
  const value = event.seen_by ?? event.seenBy ?? event.read_by ?? event.readBy;
  const records = Array.isArray(value)
    ? value
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : asRecord(value)
      ? [asRecord(value)!]
      : [];
  const seenBy: XDmSeenBy[] = [];
  for (const receipt of records) {
    const user = asRecord(receipt.user);
    const userId = getFirstString(receipt, [
      "user_id",
      "userId",
      "sender_id",
      "senderId",
    ]);
    const attendeeId = getFirstString(receipt, ["attendee_id", "attendeeId"]);
    const senderName =
      getFirstString(receipt, ["senderName", "sender_name", "name"]) ??
      getFirstString(user, ["name", "username"]);
    const seenAt = normalizeTimestamp(
      receipt.seen_at ??
        receipt.seenAt ??
        receipt.read_at ??
        receipt.readAt ??
        receipt.timestamp
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

function normalizeEventMetadata(
  event: Record<string, unknown>
): XDmEventMetadata | undefined {
  const actor = asRecord(event.actor) ?? asRecord(event.sender);
  const metadata =
    asRecord(event.event_metadata) ?? asRecord(event.eventMetadata);
  const result: XDmEventMetadata = {
    providerEventType:
      getFirstString(event, ["event_type", "eventType", "type"]) ??
      getFirstString(metadata, ["providerEventType", "event_type", "type"]),
    eventLabel:
      getFirstString(event, ["event_label", "eventLabel", "label"]) ??
      getFirstString(metadata, ["eventLabel", "event_label", "label"]),
    actorUserId:
      getFirstString(event, ["actor_id", "actorId"]) ??
      getFirstString(actor, ["id", "user_id", "userId"]),
    actorName:
      getFirstString(event, ["actor_name", "actorName"]) ??
      getFirstString(actor, ["name", "username"]),
    targetMessageId:
      getFirstString(event, ["target_message_id", "targetMessageId"]) ??
      getFirstString(metadata, ["targetMessageId", "target_message_id"]),
  };
  return Object.values(result).some((value) => typeof value === "string")
    ? result
    : undefined;
}

function normalizeSourceEventType(
  event: Record<string, unknown>
): string | undefined {
  const value = getFirstString(event, ["event_type", "eventType"]);
  return value && PLATFORM_CONVERSATION_EVENT_TYPES.has(value)
    ? value
    : undefined;
}

function mergeConversationAttachment<T extends ConversationAttachmentLike>(
  incoming: T,
  existing?: T
): T {
  if (!existing) {
    return incoming;
  }

  return {
    ...existing,
    ...incoming,
    id: incoming.id ?? existing.id,
    mediaKey: incoming.mediaKey ?? existing.mediaKey,
    type: incoming.type ?? existing.type,
    url: incoming.url ?? existing.url,
    previewUrl: incoming.previewUrl ?? existing.previewUrl,
    altText: incoming.altText ?? existing.altText,
    width: incoming.width ?? existing.width,
    height: incoming.height ?? existing.height,
    fileName: incoming.fileName ?? existing.fileName,
    mimeType: incoming.mimeType ?? existing.mimeType,
    fileSize: incoming.fileSize ?? existing.fileSize,
    durationMs: incoming.durationMs ?? existing.durationMs,
    variants: incoming.variants ?? existing.variants,
    isGif: incoming.isGif ?? existing.isGif,
    isVoiceNote: incoming.isVoiceNote ?? existing.isVoiceNote,
    unavailable: incoming.unavailable ?? existing.unavailable,
    urlExpiresAt: incoming.urlExpiresAt ?? existing.urlExpiresAt,
    linkedinPostUrl: incoming.linkedinPostUrl ?? existing.linkedinPostUrl,
  };
}

export function mergeConversationAttachments<
  T extends ConversationAttachmentLike,
>(primary?: T[], secondary?: T[]): T[] | undefined {
  if (!primary?.length) {
    return secondary?.length ? [...secondary] : primary;
  }
  if (!secondary?.length) {
    return [...primary];
  }

  const usedSecondaryIndexes = new Set<number>();
  const merged = primary.map((attachment, index) => {
    let secondaryIndex = -1;

    if (attachment.id) {
      secondaryIndex = secondary.findIndex(
        (candidate, candidateIndex) =>
          !usedSecondaryIndexes.has(candidateIndex) &&
          candidate.id === attachment.id
      );
    }
    if (secondaryIndex < 0 && attachment.mediaKey) {
      secondaryIndex = secondary.findIndex(
        (candidate, candidateIndex) =>
          !usedSecondaryIndexes.has(candidateIndex) &&
          candidate.mediaKey === attachment.mediaKey
      );
    }
    if (secondaryIndex < 0 && index < secondary.length) {
      secondaryIndex = index;
    }

    if (secondaryIndex >= 0) {
      usedSecondaryIndexes.add(secondaryIndex);
    }

    return mergeConversationAttachment(
      attachment,
      secondaryIndex >= 0 ? secondary[secondaryIndex] : undefined
    );
  });

  for (const [index, attachment] of secondary.entries()) {
    if (!usedSecondaryIndexes.has(index)) {
      merged.push(attachment);
    }
  }

  return merged;
}

/**
 * Keep hydrated post-card metadata when a later provider page only repeats the
 * post identity and canonical URL.
 */
export function mergeConversationSharedPost<
  T extends ConversationSharedPostLike,
>(incoming?: T, existing?: T): T | undefined {
  if (!incoming) {
    return existing;
  }
  if (!existing || existing.id !== incoming.id) {
    return incoming;
  }

  const media = mergeConversationAttachments(incoming.media, existing.media);
  return {
    ...existing,
    ...incoming,
    id: incoming.id,
    url: incoming.url,
    ...((incoming.text ?? existing.text)
      ? { text: incoming.text ?? existing.text }
      : {}),
    ...((incoming.authorId ?? existing.authorId)
      ? { authorId: incoming.authorId ?? existing.authorId }
      : {}),
    ...((incoming.authorHandle ?? existing.authorHandle)
      ? { authorHandle: incoming.authorHandle ?? existing.authorHandle }
      : {}),
    ...((incoming.authorName ?? existing.authorName)
      ? { authorName: incoming.authorName ?? existing.authorName }
      : {}),
    ...((incoming.authorAvatarUrl ?? existing.authorAvatarUrl)
      ? {
          authorAvatarUrl: incoming.authorAvatarUrl ?? existing.authorAvatarUrl,
        }
      : {}),
    ...((incoming.createdAt ?? existing.createdAt)
      ? { createdAt: incoming.createdAt ?? existing.createdAt }
      : {}),
    ...(media ? { media } : {}),
  } as T;
}

/**
 * Provider refreshes can contain a quote identity without repeating the
 * preview fields. Keep verified cached preview fields for the same quote while
 * accepting any newly supplied fields from the provider.
 */
export function mergeConversationQuotedMessage<
  T extends ConversationQuotedMessageLike,
>(incoming?: T, existing?: T): T | undefined {
  if (!incoming) {
    return existing;
  }
  if (!existing || existing.id !== incoming.id) {
    return incoming;
  }

  const attachments = mergeConversationAttachments(
    incoming.attachments,
    existing.attachments
  );
  const sharedPost = mergeConversationSharedPost(
    incoming.sharedPost,
    existing.sharedPost
  );
  return {
    ...existing,
    ...incoming,
    id: incoming.id,
    ...((incoming.text ?? existing.text)
      ? { text: incoming.text ?? existing.text }
      : {}),
    ...((incoming.senderName ?? existing.senderName)
      ? { senderName: incoming.senderName ?? existing.senderName }
      : {}),
    ...((incoming.direction ?? existing.direction)
      ? { direction: incoming.direction ?? existing.direction }
      : {}),
    ...((incoming.attachmentType ?? existing.attachmentType)
      ? {
          attachmentType: incoming.attachmentType ?? existing.attachmentType,
        }
      : {}),
    ...(attachments ? { attachments } : {}),
    ...(sharedPost ? { sharedPost } : {}),
  } as T;
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

      const senderUserId = getFirstString(event, ["sender_id", "senderId"]);
      const sender = getUserById(response, senderUserId);
      const attachments = normalizeDmAttachments(response, event);
      const text = normalizeDmText(event, attachments);
      const quotedMessage = normalizeQuotedMessage(event, viewerXUserId);
      const sharedPost =
        normalizeReferencedTweetSharedPost(response, event) ??
        getSharedPostFromText(text);
      return {
        id: asString(event.id) ?? "",
        conversationId:
          getFirstString(event, ["dm_conversation_id", "dmConversationId"]) ??
          "",
        senderUserId,
        text,
        createdAt: normalizeTimestamp(event.created_at ?? event.createdAt),
        direction: normalizeDirection(
          event.direction,
          viewerXUserId,
          senderUserId
        ),
        attachments,
        sender: sender
          ? {
              userId: asString(sender.id) ?? "",
              username: asString(sender.username) ?? "",
              name:
                asString(sender.name) ?? asString(sender.username) ?? "Unknown",
              avatarUrl: getFirstString(sender, [
                "profileImageUrl",
                "profile_image_url",
              ]),
              verified:
                asBoolean(sender.verified) ??
                (typeof sender.verified_type === "string" &&
                  sender.verified_type !== "none"),
            }
          : undefined,
        readAt: normalizeTimestamp(event.read_at ?? event.readAt),
        deliveredAt: normalizeTimestamp(
          event.delivered_at ?? event.deliveredAt
        ),
        quotedMessageId:
          getFirstString(event, [
            "quoted_message_id",
            "quotedMessageId",
            "reply_to_id",
            "replyToId",
          ]) ?? quotedMessage?.id,
        quotedMessage,
        sharedPost,
        reactions: normalizeReactions(event),
        editedAt: normalizeTimestamp(event.edited_at ?? event.editedAt),
        deletedAt: normalizeTimestamp(event.deleted_at ?? event.deletedAt),
        seenBy: normalizeSeenBy(event),
        sourceEventType: normalizeSourceEventType(event),
        eventMetadata: normalizeEventMetadata(event),
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
    const existing = merged.get(message.id);
    merged.set(message.id, {
      ...existing,
      ...message,
      attachments: mergeConversationAttachments(
        message.attachments,
        existing?.attachments
      ),
      sender: message.sender ?? existing?.sender,
      readAt: message.readAt ?? existing?.readAt,
      deliveredAt: message.deliveredAt ?? existing?.deliveredAt,
      quotedMessageId: message.quotedMessageId ?? existing?.quotedMessageId,
      quotedMessage: mergeConversationQuotedMessage(
        message.quotedMessage,
        existing?.quotedMessage
      ),
      sharedPost: mergeConversationSharedPost(
        message.sharedPost,
        existing?.sharedPost
      ),
      reactions: message.reactions ?? existing?.reactions,
      editedAt: message.editedAt ?? existing?.editedAt,
      deletedAt: message.deletedAt ?? existing?.deletedAt,
      seenBy: message.seenBy ?? existing?.seenBy,
      sourceEventType: message.sourceEventType ?? existing?.sourceEventType,
      eventMetadata: message.eventMetadata ?? existing?.eventMetadata,
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
  return (mediaUrls ?? []).map((url, index) => {
    const kind = inferAttachmentMediaKind({ url });
    return {
      type: kind ?? "file",
      url,
      previewUrl: url,
      altText: mediaDescriptions?.[index],
      ...(kind === "gif" ? { isGif: true } : {}),
    };
  });
}
