import type { MediaUpload } from "../types";

const MAX_BROWSER_MEDIA_FILE_BYTES = 100 * 1024 * 1024;

function assertSupportedRemoteMediaUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("The attachment URL is invalid.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("The attachment URL must use HTTPS.");
  }
}

/**
 * Rehydrates a server-backed composer placeholder before browser-only media
 * processing such as XChat encryption. User-selected files already contain
 * bytes and return without a network request.
 */
export async function materializeBrowserMediaFile(
  upload: MediaUpload
): Promise<MediaUpload> {
  if (upload.file.size > 0) {
    return upload;
  }
  if (!upload.serverUrl) {
    throw new Error("The attachment bytes are unavailable.");
  }

  assertSupportedRemoteMediaUrl(upload.serverUrl);
  const response = await fetch(upload.serverUrl, {
    credentials: "omit",
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Attachment request failed (${response.status}).`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BROWSER_MEDIA_FILE_BYTES
  ) {
    throw new Error("The attachment exceeds the 100 MB XChat limit.");
  }

  const blob = await response.blob();
  if (blob.size <= 0) {
    throw new Error("The attachment did not contain any bytes.");
  }
  if (blob.size > MAX_BROWSER_MEDIA_FILE_BYTES) {
    throw new Error("The attachment exceeds the 100 MB XChat limit.");
  }

  return {
    ...upload,
    file: new File([blob], upload.file.name, {
      type: blob.type || upload.file.type,
      lastModified: upload.file.lastModified,
    }),
    size: blob.size,
  };
}
