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

export const LINKEDIN_MESSAGE_DOCUMENT_ACCEPT = [
  ...LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES,
].join(",");

export function isLinkedInMessageDocumentMimeType(
  mimeType: string | null | undefined
): boolean {
  return LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES.has(
    mimeType?.trim().toLowerCase() ?? ""
  );
}
