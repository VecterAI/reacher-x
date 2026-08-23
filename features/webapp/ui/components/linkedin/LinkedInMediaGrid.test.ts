import { describe, expect, it } from "vitest";
import {
  isRenderableLinkedInImageUrl,
  normalizeLinkedInMediaType,
} from "../../../../../shared/lib/linkedin/media";
import {
  getRememberedMediaAspectRatio,
  rememberMediaAspectRatio,
} from "../../../../../shared/ui/lib/mediaAspectRatioCache";

describe("LinkedIn media URL normalization", () => {
  it("keeps authenticated Convex attachment URLs as images", () => {
    const url =
      "https://fast-poodle-167.convex.cloud/api/storage/attachment-id";

    expect(isRenderableLinkedInImageUrl(url)).toBe(true);
    expect(normalizeLinkedInMediaType("image", url)).toBe("image");
  });

  it("does not trust an arbitrary non-image URL labeled as an image", () => {
    expect(
      normalizeLinkedInMediaType("image", "https://example.com/page")
    ).toBe("link");
  });
});

describe("LinkedIn media aspect ratios", () => {
  it("preserves an observed ratio for a responsive component remount", () => {
    const key = "https://example.com/media/remount-test.jpg";
    rememberMediaAspectRatio(key, 437 / 229);

    expect(getRememberedMediaAspectRatio(key, 1)).toBeCloseTo(437 / 229);
  });

  it("ignores invalid observed ratios", () => {
    const key = "https://example.com/media/invalid-ratio.jpg";
    rememberMediaAspectRatio(key, Number.NaN);

    expect(getRememberedMediaAspectRatio(key, 4 / 3)).toBeCloseTo(4 / 3);
  });
});
