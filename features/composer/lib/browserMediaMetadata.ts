import type { ComposerUploadType, MediaUpload } from "../types";

export interface BrowserMediaMetadata {
  durationMs?: number;
  height?: number;
  width?: number;
}

const MEDIA_METADATA_TIMEOUT_MS = 3_000;

const mediaMetadataRequests = new WeakMap<
  File,
  Promise<BrowserMediaMetadata>
>();

function getPositiveDimension(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

function getDurationMs(value: number): number | undefined {
  return Number.isFinite(value) && value > 0
    ? Math.round(value * 1000)
    : undefined;
}

/** Reads browser-decoded dimensions before an optimistic message is published. */
function readBrowserMediaMetadataUncached(
  file: File,
  type: ComposerUploadType
): Promise<BrowserMediaMetadata> {
  const isAudio = file.type.toLowerCase().startsWith("audio/");
  if ((type === "file" && !isAudio) || typeof window === "undefined") {
    return Promise.resolve({});
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const finish = (metadata: BrowserMediaMetadata = {}) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      resolve(metadata);
    };
    const timeoutId = window.setTimeout(finish, MEDIA_METADATA_TIMEOUT_MS);

    if (type === "image") {
      const image = new window.Image();
      image.onload = () =>
        finish({
          width: getPositiveDimension(image.naturalWidth),
          height: getPositiveDimension(image.naturalHeight),
        });
      image.onerror = () => finish();
      image.src = objectUrl;
      return;
    }

    const media = document.createElement(isAudio ? "audio" : "video");
    media.preload = "metadata";
    media.onloadedmetadata = () =>
      finish({
        ...(!isAudio && media instanceof HTMLVideoElement
          ? {
              width: getPositiveDimension(media.videoWidth),
              height: getPositiveDimension(media.videoHeight),
            }
          : {}),
        durationMs: getDurationMs(media.duration),
      });
    media.onerror = () => finish();
    media.src = objectUrl;
  });
}

export function readBrowserMediaMetadata(
  file: File,
  type: ComposerUploadType
): Promise<BrowserMediaMetadata> {
  const cachedRequest = mediaMetadataRequests.get(file);
  if (cachedRequest) {
    return cachedRequest;
  }

  const request = readBrowserMediaMetadataUncached(file, type);
  mediaMetadataRequests.set(file, request);
  return request;
}

export async function withBrowserMediaMetadata(
  upload: MediaUpload
): Promise<MediaUpload> {
  if (
    (upload.type === "file" && !upload.file.type.startsWith("audio/")) ||
    upload.durationMs ||
    (upload.width && upload.height)
  ) {
    return upload;
  }
  const metadata = await readBrowserMediaMetadata(upload.file, upload.type);
  return { ...upload, ...metadata };
}
