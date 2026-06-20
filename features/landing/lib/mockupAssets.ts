export type LandingMockupAssetKey =
  | "landing-image-1"
  | "landing-image-2"
  | "landing-image-3"
  | "landing-image-4"
  | "landing-image-5"
  | "landing-image-6"
  | "landing-image-7"
  | "landing-image-8"
  | "landing-image-9"
  | "landing-image-10";

type MockupImageSource = {
  src: string;
  width: number;
  height: number;
};

type PatternTransform = {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
};

export type LandingMockupAsset = {
  back: MockupImageSource;
  front: MockupImageSource;
  frontPattern: PatternTransform;
};

const FRONT_PATTERN_BASE = {
  scaleX: 0.000978474,
  scaleY: 0.000601685,
  translateY: -0.055355,
} as const;

const makeAsset = (
  index: number,
  frontTranslateX: number,
  backSize: Pick<MockupImageSource, "width" | "height"> = {
    width: 3024,
    height: 1754,
  }
): LandingMockupAsset => ({
  back: {
    src: `/landing/mockups/landing-image-${index}-back.webp`,
    ...backSize,
  },
  front: {
    src: `/landing/mockups/landing-image-${index}-front.webp`,
    width: 3024,
    height: 1754,
  },
  frontPattern: {
    ...FRONT_PATTERN_BASE,
    translateX: frontTranslateX,
  },
});

export const LANDING_MOCKUP_ASSETS = {
  "landing-image-1": makeAsset(1, -1.50294),
  "landing-image-2": makeAsset(2, -0.0939335),
  "landing-image-3": makeAsset(3, -0.0939335),
  "landing-image-4": makeAsset(4, -1.09589),
  "landing-image-5": makeAsset(5, -0.500978),
  "landing-image-6": makeAsset(6, -0.500978),
  "landing-image-7": makeAsset(7, -0.500978),
  "landing-image-8": makeAsset(8, -1.09589),
  "landing-image-9": makeAsset(9, -0.500978, {
    width: 3376,
    height: 1959,
  }),
  "landing-image-10": makeAsset(10, -0.500978),
} as const satisfies Record<LandingMockupAssetKey, LandingMockupAsset>;
