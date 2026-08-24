import type {
  UnifiedAuthor,
  UnifiedMedia,
  UnifiedPost,
  UnifiedPostActivity,
  UnifiedPostActivityType,
} from "../platforms/types";
import { parseIsoToTimestamp } from "../utils/time/timeUtils";
import { resolveLinkedInPostReference } from "./comments";
import { normalizeLinkedInMediaType } from "./media";

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function getFirstString(
  value: LooseRecord,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const candidate = getString(value[key]);
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
}

function getFirstNumber(
  value: LooseRecord,
  keys: readonly string[]
): number | undefined {
  for (const key of keys) {
    const candidate = getNumber(value[key]);
    if (typeof candidate === "number") {
      return candidate;
    }
  }
  return undefined;
}

function getTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = parseIsoToTimestamp(value);
  return parsed && parsed > 0 ? parsed : undefined;
}

function normalizeAuthor(value: unknown): UnifiedAuthor | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const author: UnifiedAuthor = {
    id:
      getString(value.id) ??
      getString(value.urn) ??
      getString(value.providerId),
    handle: getString(value.handle) ?? getString(value.public_identifier),
    name: getString(value.name),
    avatarUrl:
      getString(value.avatarUrl) ??
      getString(value.profilePictureURL) ??
      getString(value.profile_picture_url),
    profileUrl:
      getString(value.profileUrl) ??
      getString(value.url) ??
      getString(value.profile_url),
    headline: getString(value.headline),
    type:
      getString(value.type) ??
      (value.is_company === true ? "COMPANY" : undefined),
  };

  return Object.values(author).some((entry) => entry !== undefined)
    ? author
    : undefined;
}

function normalizeActivityType(
  value: unknown
): UnifiedPostActivityType | undefined {
  const normalized = getString(value)?.toLowerCase();
  if (
    normalized === "like" ||
    normalized === "likes" ||
    normalized === "liked"
  ) {
    return "like";
  }
  if (
    normalized === "repost" ||
    normalized === "reposts" ||
    normalized === "reposted"
  ) {
    return "repost";
  }
  return undefined;
}

function parseActivityHeader(
  value: unknown
): { type: UnifiedPostActivityType; actorName: string } | undefined {
  const header = getString(value);
  const match = header?.match(
    /^(.+?)\s+(likes|liked|reposts|reposted)\s+this$/i
  );
  const type = normalizeActivityType(match?.[2]);
  const actorName = getString(match?.[1]);
  return type && actorName ? { type, actorName } : undefined;
}

export function normalizeLinkedInActivity(
  value: unknown
): UnifiedPostActivity | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const raw = isRecord(value.raw) ? value.raw : value;
  const activity = isRecord(value.activity)
    ? value.activity
    : isRecord(raw.activity)
      ? raw.activity
      : undefined;
  const parsedHeader = parseActivityHeader(
    value.header ?? value.activityHeader ?? raw.header ?? raw.activityHeader
  );
  const type = normalizeActivityType(activity?.type) ?? parsedHeader?.type;
  const actor =
    normalizeAuthor(activity?.actor) ??
    (parsedHeader ? { name: parsedHeader.actorName } : undefined);

  return type && actor?.name ? { type, actor } : undefined;
}

const LINKEDIN_ACTIVITY_TIMESTAMP_SHIFT = BigInt(22);
const LINKEDIN_LAUNCH_TIMESTAMP_MS = Date.UTC(2003, 0, 1);

export function getLinkedInActivityTimestamp(
  value: string | null | undefined
): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = value
    .trim()
    .match(/(?:(?:activity|ugcPost|share):)?(\d{16,20})(?:\D|$)/i);
  const activityId = match?.[1];
  if (!activityId) {
    return undefined;
  }

  try {
    const timestamp = Number(
      BigInt(activityId) >> LINKEDIN_ACTIVITY_TIMESTAMP_SHIFT
    );
    return Number.isFinite(timestamp) &&
      timestamp >= LINKEDIN_LAUNCH_TIMESTAMP_MS
      ? timestamp
      : undefined;
  } catch {
    return undefined;
  }
}

export function isRenderableLinkedInMediaUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isUnavailableAttachment(value: LooseRecord): boolean {
  if (
    value.unavailable === true ||
    value.is_unavailable === true ||
    value.isUnavailable === true
  ) {
    return true;
  }

  const availability = isRecord(value.availability)
    ? value.availability
    : undefined;
  const status =
    getFirstString(availability ?? value, ["status"]) ??
    getFirstString(value, ["availability_status", "availabilityStatus"]);

  return /^(?:unavailable|failed|expired|not_available)$/iu.test(status ?? "");
}

function inferAttachmentMediaType(value: LooseRecord): string | undefined {
  const declaredType = getFirstString(value, [
    "type",
    "attachment_type",
    "attachmentType",
    "media_type",
    "mediaType",
  ]);
  if (declaredType) {
    return declaredType;
  }

  const mimeType = getFirstString(value, [
    "mime_type",
    "mimeType",
    "mimetype",
    "content_type",
    "contentType",
  ])?.toLowerCase();
  if (mimeType?.startsWith("video/")) {
    return "video";
  }
  if (mimeType?.startsWith("image/")) {
    return "image";
  }
  if (mimeType === "application/pdf") {
    return "document";
  }
  return undefined;
}

function getUnipileAttachmentUrl(value: LooseRecord): string | undefined {
  return getFirstString(value, [
    "url",
    "media_url",
    "mediaUrl",
    "download_url",
    "downloadUrl",
    "file_url",
    "fileUrl",
  ]);
}

function getUnipileAttachmentMetadata(value: LooseRecord) {
  const id = getFirstString(value, [
    "id",
    "attachment_id",
    "attachmentId",
    "media_key",
    "mediaKey",
  ]);
  const dimensions = isRecord(value.dimensions)
    ? value.dimensions
    : isRecord(value.size)
      ? value.size
      : undefined;
  const width =
    getFirstNumber(value, ["width"]) ??
    getFirstNumber(dimensions ?? value, ["width"]);
  const height =
    getFirstNumber(value, ["height"]) ??
    getFirstNumber(dimensions ?? value, ["height"]);
  const title = getFirstString(value, [
    "title",
    "file_name",
    "fileName",
    "name",
  ]);
  const description = getFirstString(value, [
    "description",
    "alt_text",
    "altText",
  ]);

  return {
    ...(id ? { id } : {}),
    ...(typeof width === "number" ? { width } : {}),
    ...(typeof height === "number" ? { height } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  };
}

function getUnavailableAttachmentMediaType(
  value: LooseRecord
): UnifiedMedia["type"] {
  const type = inferAttachmentMediaType(value)?.toLowerCase();
  if (type === "video" || type === "animated_gif") {
    return "video";
  }
  if (
    type === "image" ||
    type === "photo" ||
    type === "gif" ||
    type === "sticker"
  ) {
    return "image";
  }
  return "link";
}

function hasUnipileAttachmentIdentity(value: LooseRecord): boolean {
  return Boolean(
    inferAttachmentMediaType(value) ??
    getFirstString(value, [
      "id",
      "attachment_id",
      "attachmentId",
      "media_key",
      "mediaKey",
      "file_name",
      "fileName",
      "name",
      "title",
    ])
  );
}

function normalizeUnavailableUnipileAttachment(
  value: LooseRecord
): UnifiedMedia | undefined {
  if (!isUnavailableAttachment(value) && !hasUnipileAttachmentIdentity(value)) {
    return undefined;
  }

  return {
    type: getUnavailableAttachmentMediaType(value),
    unavailable: true,
    ...getUnipileAttachmentMetadata(value),
  };
}

function normalizeUnipileAttachment(value: unknown): UnifiedMedia | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const url = getUnipileAttachmentUrl(value);
  if (
    isUnavailableAttachment(value) ||
    !url ||
    !isRenderableLinkedInMediaUrl(url)
  ) {
    return normalizeUnavailableUnipileAttachment(value);
  }

  const type = normalizeLinkedInMediaType(inferAttachmentMediaType(value), url);
  if (!type) {
    return undefined;
  }

  const posterUrl = getFirstString(value, [
    "poster_url",
    "posterUrl",
    "preview_url",
    "previewUrl",
    "thumbnail_url",
    "thumbnailUrl",
  ]);

  return {
    type,
    url,
    ...getUnipileAttachmentMetadata(value),
    ...(posterUrl && isRenderableLinkedInMediaUrl(posterUrl)
      ? { posterUrl }
      : {}),
  };
}

function normalizeUnipileAttachments(
  value: unknown
): UnifiedMedia[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const media: UnifiedMedia[] = [];
  const mediaUrls = new Set<string>();

  for (const item of value) {
    const normalizedMedia = normalizeUnipileAttachment(item);
    if (!normalizedMedia) {
      continue;
    }
    if (normalizedMedia.unavailable) {
      media.push(normalizedMedia);
      continue;
    }
    if (!mediaUrls.has(normalizedMedia.url)) {
      mediaUrls.add(normalizedMedia.url);
      media.push(normalizedMedia);
    }
  }

  return media.length > 0 ? media : undefined;
}

function normalizeMedia(value: unknown): UnifiedMedia[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const media = value.flatMap((item): UnifiedMedia[] => {
    if (!isRecord(item)) {
      return [];
    }
    const url = getString(item.url);
    if (!url) {
      return [];
    }
    const rawType = getString(item.type);
    const type: UnifiedMedia["type"] =
      rawType === "image" || rawType === "video" ? rawType : "link";
    return [
      {
        type,
        url,
        width: getNumber(item.width),
        height: getNumber(item.height),
        posterUrl: getString(item.posterUrl),
        title: getString(item.title),
        description: getString(item.description),
      },
    ];
  });

  return media.length > 0 ? media : undefined;
}

export function isLinkedInPostLike(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const raw = isRecord(value.raw) ? value.raw : value;
  const provider = getString(value.provider) ?? getString(raw.provider);
  return Boolean(
    value.platform === "linkedin" ||
    getString(value.postID) ||
    getString(value.postURL) ||
    getString(value.share_url) ||
    getString(value.urn)?.startsWith("urn:li:") ||
    getString(raw.postID) ||
    getString(raw.postURL) ||
    getString(raw.share_url) ||
    getString(raw.urn)?.startsWith("urn:li:") ||
    (provider?.toUpperCase() === "LINKEDIN" &&
      Boolean(getString(value.id) ?? getString(raw.id))) ||
    isRecord(raw.postedAt) ||
    isRecord(raw.engagements)
  );
}

export function normalizeLinkedInPost(
  value: unknown,
  options?: { fallbackId?: string; fallbackUrl?: string }
): UnifiedPost | null {
  if (!isRecord(value) || !isLinkedInPostLike(value)) {
    return null;
  }

  const raw = isRecord(value.raw) ? value.raw : value;
  const author = normalizeAuthor(value.author) ?? normalizeAuthor(raw.author);
  const postedAt = isRecord(raw.postedAt) ? raw.postedAt : undefined;
  const engagements = isRecord(raw.engagements) ? raw.engagements : undefined;
  const metrics = isRecord(value.metrics)
    ? value.metrics
    : isRecord(raw.metrics)
      ? raw.metrics
      : undefined;
  const reference = resolveLinkedInPostReference({
    explicitPostId: options?.fallbackId,
    postData: value,
  });
  const canonicalMedia = normalizeMedia(value.media);
  const providerMedia = normalizeMedia(raw.mediaContent);
  const unipileAttachmentMedia = normalizeUnipileAttachments(raw.attachments);

  return {
    id: reference.resolvedPostId ?? options?.fallbackId ?? "",
    platform: "linkedin",
    url:
      getString(value.url) ??
      getString(value.share_url) ??
      getString(raw.postURL) ??
      getString(raw.share_url) ??
      reference.permalink ??
      options?.fallbackUrl,
    author: {
      ...author,
      name: author?.name ?? "LinkedIn user",
    },
    text:
      getString(value.text) ??
      getString(raw.text) ??
      getString(raw.comment) ??
      "",
    createdAt:
      getTimestamp(value.createdAt) ??
      getTimestamp(postedAt?.timestamp) ??
      getTimestamp(raw.postedAt) ??
      getTimestamp(raw.date) ??
      getTimestamp(raw.parsed_datetime) ??
      getLinkedInActivityTimestamp(reference.readUrn) ??
      getLinkedInActivityTimestamp(reference.resolvedPostId) ??
      0,
    metrics: {
      reactions:
        getNumber(metrics?.reactions) ??
        getNumber(engagements?.totalReactions) ??
        getNumber(raw.reaction_counter),
      comments:
        getNumber(metrics?.comments) ??
        getNumber(engagements?.commentsCount) ??
        getNumber(raw.comment_counter),
      reposts:
        getNumber(metrics?.reposts) ??
        getNumber(engagements?.repostsCount) ??
        getNumber(raw.repost_counter),
    },
    media: canonicalMedia ?? providerMedia ?? unipileAttachmentMedia,
    activity: normalizeLinkedInActivity(value),
    raw,
  };
}

export function getLinkedInResharedPost(value: unknown): UnifiedPost | null {
  if (!isRecord(value)) {
    return null;
  }

  const raw = isRecord(value.raw) ? value.raw : value;
  const resharedPostContent = isRecord(value.resharedPostContent)
    ? value.resharedPostContent
    : isRecord(raw.resharedPostContent)
      ? raw.resharedPostContent
      : null;

  return resharedPostContent
    ? normalizeLinkedInPost(resharedPostContent)
    : null;
}
