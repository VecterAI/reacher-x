import { inferFileVisualKind } from "../../../shared/lib/utils/media/inferFileVisualKind";
import type { ConversationAttachment } from "../ui/components/conversation-message/types";

const MAX_CONVERSATION_ATTACHMENT_DOWNLOAD_BYTES = 100 * 1024 * 1024;
const OBJECT_URL_REVOKE_DELAY_MS = 30_000;

const NON_DOWNLOADABLE_ATTACHMENT_TYPES = new Set([
  "link",
  "linkedin_post",
  "post",
  "url",
]);

const MIME_TYPE_EXTENSIONS: Readonly<Record<string, string>> = {
  "application/msword": "doc",
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/zip": "zip",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/csv": "csv",
  "text/plain": "txt",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type ConversationAttachmentKind = "audio" | "file" | "image" | "video";

export interface ConversationAttachmentDownloadItem {
  attachment: ConversationAttachment;
  fileName: string;
  id: string;
  label: string;
  sourceUrl?: string;
}

function getNormalizedMimeType(
  mimeType: string | undefined
): string | undefined {
  return mimeType?.split(";", 1)[0]?.trim().toLowerCase() || undefined;
}

function getFileExtensionFromUrl(url: string | undefined): string | undefined {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
    return undefined;
  }

  try {
    const pathSegment = new URL(url).pathname.split("/").pop();
    const extension = pathSegment?.match(/\.([a-z0-9]{1,10})$/iu)?.[1];
    return extension?.toLowerCase();
  } catch {
    return undefined;
  }
}

function sanitizeDownloadFileName(value: string): string {
  const normalized = value
    .trim()
    .replaceAll("\\", "_")
    .replaceAll("/", "_")
    .split("")
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint > 31 && codePoint !== 127;
    })
    .join("")
    .slice(0, 255);
  return normalized || "attachment";
}

function getAttachmentDownloadExtension(
  attachment: ConversationAttachment,
  sourceUrl: string | undefined
): string | undefined {
  const mimeType = getNormalizedMimeType(attachment.mimeType);
  return (
    (mimeType ? MIME_TYPE_EXTENSIONS[mimeType] : undefined) ??
    getFileExtensionFromUrl(sourceUrl)
  );
}

function getFallbackDownloadName(
  kind: ConversationAttachmentKind,
  index: number
): string {
  if (kind === "audio") return `voice-note-${index + 1}`;
  if (kind === "file") return `attachment-${index + 1}`;
  return `${kind}-${index + 1}`;
}

function getDownloadLabel(
  attachment: ConversationAttachment,
  kind: ConversationAttachmentKind,
  index: number
): string {
  const fileName = attachment.fileName?.trim();
  if (fileName) return fileName;
  if (kind === "audio") return `Voice note ${index + 1}`;
  if (kind === "file") return `Attachment ${index + 1}`;
  return `${kind === "image" ? "Image" : "Video"} ${index + 1}`;
}

export function getConversationAttachmentKind(
  attachment: ConversationAttachment
): ConversationAttachmentKind {
  const providerType = attachment.type.trim().toLowerCase();
  if (["img", "image", "photo", "sticker"].includes(providerType)) {
    return "image";
  }
  if (["video", "animated_gif"].includes(providerType)) {
    return "video";
  }
  if (providerType === "gif") {
    return attachment.variants?.length ? "video" : "image";
  }
  if (
    ["audio", "voice", "voice_note", "voice_message"].includes(providerType)
  ) {
    return "audio";
  }

  const inferredKind = inferFileVisualKind({
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    url: attachment.url ?? attachment.previewUrl,
  });
  return inferredKind === "image" ||
    inferredKind === "video" ||
    inferredKind === "audio"
    ? inferredKind
    : "file";
}

export function getConversationAttachmentDownloadUrl(
  attachment: ConversationAttachment
): string | undefined {
  const kind = getConversationAttachmentKind(attachment);
  const downloadableVariant = attachment.variants
    ?.filter((variant) => {
      const mimeType = getNormalizedMimeType(variant.mimeType);
      return (
        variant.url.trim().length > 0 &&
        mimeType !== "application/vnd.apple.mpegurl" &&
        mimeType !== "application/x-mpegurl"
      );
    })
    .sort((left, right) => (right.bitrate ?? 0) - (left.bitrate ?? 0))[0];

  if (kind === "video" || kind === "audio") {
    return downloadableVariant?.url ?? attachment.url ?? attachment.previewUrl;
  }
  return attachment.url ?? attachment.previewUrl ?? downloadableVariant?.url;
}

export function getConversationAttachmentDownloadItems(
  attachments: ConversationAttachment[] | undefined
): ConversationAttachmentDownloadItem[] {
  const candidates = (attachments ?? []).filter((attachment) => {
    const providerType = attachment.type.trim().toLowerCase();
    return (
      !attachment.unavailable &&
      !NON_DOWNLOADABLE_ATTACHMENT_TYPES.has(providerType) &&
      Boolean(
        attachment.url ||
        attachment.previewUrl ||
        attachment.variants?.length ||
        attachment.id
      )
    );
  });

  return candidates.map((attachment, index) => {
    const kind = getConversationAttachmentKind(attachment);
    const sourceUrl = getConversationAttachmentDownloadUrl(attachment);
    const extension = getAttachmentDownloadExtension(attachment, sourceUrl);
    const suppliedFileName = attachment.fileName?.trim();
    const fallbackName = getFallbackDownloadName(kind, index);
    const fileName = sanitizeDownloadFileName(
      suppliedFileName || `${fallbackName}${extension ? `.${extension}` : ""}`
    );

    return {
      attachment,
      fileName,
      id: attachment.id ?? attachment.mediaKey ?? `${kind}-${index}`,
      label: getDownloadLabel(attachment, kind, index),
      sourceUrl,
    };
  });
}

function assertSupportedDownloadUrl(sourceUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl, window.location.href);
  } catch {
    throw new Error("Attachment URL is invalid.");
  }

  if (!["blob:", "data:", "http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Attachment URL scheme is unsupported.");
  }
}

function triggerBrowserDownload(sourceUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = sourceUrl;
  link.download = sanitizeDownloadFileName(fileName);
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
}

export async function downloadConversationAttachment(args: {
  fileName: string;
  sourceUrl: string;
}): Promise<void> {
  assertSupportedDownloadUrl(args.sourceUrl);

  if (
    args.sourceUrl.startsWith("blob:") ||
    args.sourceUrl.startsWith("data:")
  ) {
    triggerBrowserDownload(args.sourceUrl, args.fileName);
    return;
  }

  const response = await fetch(args.sourceUrl, {
    credentials: "omit",
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(
      `Attachment request failed with status ${response.status}.`
    );
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_CONVERSATION_ATTACHMENT_DOWNLOAD_BYTES
  ) {
    throw new Error("Attachment exceeds the supported download limit.");
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("Attachment did not contain any bytes.");
  }
  if (blob.size > MAX_CONVERSATION_ATTACHMENT_DOWNLOAD_BYTES) {
    throw new Error("Attachment exceeds the supported download limit.");
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    triggerBrowserDownload(objectUrl, args.fileName);
  } finally {
    window.setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      OBJECT_URL_REVOKE_DELAY_MS
    );
  }
}
