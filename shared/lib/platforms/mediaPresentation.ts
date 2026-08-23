export const DEFAULT_MEDIA_ASPECT_RATIO = 16 / 9;

export interface IntrinsicMediaSize {
  width?: number;
  height?: number;
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Returns a layout-safe intrinsic ratio without discarding portrait media. */
export function getMediaAspectRatio(
  media: IntrinsicMediaSize,
  fallback = DEFAULT_MEDIA_ASPECT_RATIO
): number {
  if (isPositiveFinite(media.width) && isPositiveFinite(media.height)) {
    return media.width / media.height;
  }
  return fallback;
}
