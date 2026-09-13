import {
  isLinkedInMessageDocumentMimeType,
  normalizeMediaMimeType,
} from "@/shared/lib/utils/media/linkedinMessageAttachmentTypes";

const imageTypes = new Set([
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const videoTypes = new Set(["video/mp4", "video/quicktime"]);

export function isDemoUploadMimeType(value: string) {
  const type = normalizeMediaMimeType(value);
  return (
    type.startsWith("audio/") ||
    imageTypes.has(type) ||
    videoTypes.has(type) ||
    isLinkedInMessageDocumentMimeType(type)
  );
}

export function isDemoUploadedImageUrl(url: string) {
  return /^\/api\/upload\?id=[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}&kind=(?:image|gif)$/.test(
    url
  );
}

/** Bound anonymous demo uploads while reading, even without Content-Length. */
export async function readDemoUpload(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) return new Blob();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(chunks, {
    type: request.headers.get("content-type") ?? "",
  });
}
