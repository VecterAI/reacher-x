type VideoVariant = {
  content_type: string;
  url: string;
  bitrate?: number;
};

const HLS_CONTENT_TYPES = new Set([
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
  "application/mpegurl",
  "audio/mpegurl",
]);

function normalizeContentType(contentType?: string): string {
  return contentType?.trim().toLowerCase() ?? "";
}

export function getHlsVariantUrl(
  variants?: VideoVariant[]
): string | undefined {
  return variants?.find((variant) =>
    HLS_CONTENT_TYPES.has(normalizeContentType(variant.content_type))
  )?.url;
}

export function getBestMp4VariantUrl(
  variants?: VideoVariant[]
): string | undefined {
  if (!variants) {
    return undefined;
  }

  return variants
    .filter(
      (variant) => normalizeContentType(variant.content_type) === "video/mp4"
    )
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]?.url;
}

export type { VideoVariant };
