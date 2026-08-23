"use client";

const MAX_REMEMBERED_MEDIA_ASPECT_RATIOS = 200;
const rememberedMediaAspectRatios = new Map<string, number>();

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Keeps observed media geometry stable across responsive component remounts. */
export function rememberMediaAspectRatio(key: string, aspectRatio: number) {
  if (!key || !isPositiveFinite(aspectRatio)) return;

  rememberedMediaAspectRatios.delete(key);
  rememberedMediaAspectRatios.set(key, aspectRatio);

  if (rememberedMediaAspectRatios.size > MAX_REMEMBERED_MEDIA_ASPECT_RATIOS) {
    const oldestKey = rememberedMediaAspectRatios.keys().next().value;
    if (oldestKey) rememberedMediaAspectRatios.delete(oldestKey);
  }
}

export function getRememberedMediaAspectRatio(
  key: string,
  fallback: number
): number {
  return rememberedMediaAspectRatios.get(key) ?? fallback;
}
