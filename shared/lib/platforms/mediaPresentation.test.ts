import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIA_ASPECT_RATIO,
  getMediaAspectRatio,
} from "./mediaPresentation";

describe("getMediaAspectRatio", () => {
  it.each([
    [{ width: 1080, height: 1920 }, 9 / 16],
    [{ width: 1080, height: 1350 }, 4 / 5],
    [{ width: 1200, height: 1200 }, 1],
    [{ width: 1920, height: 1080 }, 16 / 9],
  ])("preserves the intrinsic ratio for %o", (media, expected) => {
    expect(getMediaAspectRatio(media)).toBeCloseTo(expected);
  });

  it.each([{}, { width: 0, height: 100 }, { width: 100, height: Number.NaN }])(
    "uses a stable fallback for invalid metadata",
    (media) => {
      expect(getMediaAspectRatio(media)).toBe(DEFAULT_MEDIA_ASPECT_RATIO);
    }
  );
});
