/**
 * Central registry of Mux playback IDs for landing-page demo videos.
 * Each key maps to light-mode and dark-mode variants so we can
 * swap theme-specific recordings later without changing component APIs.
 */

type VideoSource = {
  playbackId?: string;
  mp4Url: string;
  posterUrl?: string;
  posterTime?: number;
};

export type VideoAsset = {
  light: VideoSource;
  dark: VideoSource;
};

export const LANDING_USE_CASES_PLAYBACK_ID =
  "SkBT1UBcuNCnDbeE5lThj00901Ql02xuYTyh01hJaMXkFS8";

export const LANDING_PRIMARY_PLAYBACK_ID =
  "SkBT1UBcuNCnDbeE5lThj00901Ql02xuYTyh01hJaMXkFS8";

export const LANDING_PLACEHOLDER_VIDEO_URL =
  "https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4Ne4o1rZgyRbrWdIGZK0sCkx5o6azDVPMBptAj";

export const VIDEO_ASSETS = {
  hero: {
    light: {
      playbackId: LANDING_PRIMARY_PLAYBACK_ID,
      mp4Url: LANDING_PLACEHOLDER_VIDEO_URL,
      posterTime: 0,
    },
    dark: {
      playbackId: LANDING_PRIMARY_PLAYBACK_ID,
      mp4Url: LANDING_PLACEHOLDER_VIDEO_URL,
      posterTime: 0,
    },
  },
} as const satisfies Record<string, VideoAsset>;

export type VideoAssetKey = keyof typeof VIDEO_ASSETS;
