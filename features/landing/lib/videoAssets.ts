/**
 * Central registry of demo video URLs for the landing page.
 * Each key maps to light-mode and dark-mode variants.
 *
 * Replace placeholder URLs with real Screen Studio recordings
 * once they are uploaded to UploadThing.
 */

type VideoSource = {
  mp4Url: string;
  posterUrl?: string;
};

export type VideoAsset = {
  light: VideoSource;
  dark: VideoSource;
};

/** Shared placeholder video used until real Screen Studio recordings are ready. */
export const LANDING_PLACEHOLDER_VIDEO_URL =
  "https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4Ne4o1rZgyRbrWdIGZK0sCkx5o6azDVPMBptAj";

export const VIDEO_ASSETS = {
  hero: {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
  "how-step-1": {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
  "how-step-2": {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
  "how-step-3": {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
  "how-step-4": {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
  "smarter-writes": {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
  "smarter-context": {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
  "smarter-feedback": {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
  "control-delegate": {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
  "control-workspaces": {
    light: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
    dark: { mp4Url: LANDING_PLACEHOLDER_VIDEO_URL },
  },
} as const satisfies Record<string, VideoAsset>;

export type VideoAssetKey = keyof typeof VIDEO_ASSETS;
