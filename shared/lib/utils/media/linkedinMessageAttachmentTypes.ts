export const LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
]);

export const LINKEDIN_VOICE_MESSAGE_MIME_TYPES = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
  "audio/x-m4a",
]);

/** LinkedIn's v1 voice-note endpoint classifies M4A as native audio by MIME. */
export const LINKEDIN_NATIVE_VOICE_MESSAGE_MIME_TYPE = "audio/x-m4a";

export const LINKEDIN_MESSAGE_DOCUMENT_ACCEPT = [
  ...LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES,
].join(",");

export function normalizeMediaMimeType(
  mimeType: string | null | undefined
): string {
  return mimeType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function isLinkedInMessageDocumentMimeType(
  mimeType: string | null | undefined
): boolean {
  return LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES.has(
    normalizeMediaMimeType(mimeType)
  );
}

export function isLinkedInVoiceMessageMimeType(
  mimeType: string | null | undefined
): boolean {
  return LINKEDIN_VOICE_MESSAGE_MIME_TYPES.has(
    normalizeMediaMimeType(mimeType)
  );
}
