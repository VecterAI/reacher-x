import { getStringProperty, isRecord } from "@/convex/lib/typeGuards";
import { BLOG_AUTHOR } from "./blogHelpers";

export type BlogAuthorProfile = {
  name: string;
  image: string;
  url: string;
  verified: boolean;
};

export const BLOG_AUTHOR_USERNAME = "ReacherXfounder";
export const BLOG_AUTHOR_FALLBACK: BlogAuthorProfile = {
  name: BLOG_AUTHOR.name,
  image: "",
  url: BLOG_AUTHOR.url,
  verified: false,
};

/** Only trust provider fields that can safely be rendered as public identity. */
export function resolveBlogAuthorProfile(profile: unknown): BlogAuthorProfile {
  const name = getStringProperty(profile, "name")?.trim();
  const handle = getStringProperty(profile, "screen_name")?.trim();
  if (!name || !handle || !/^[a-zA-Z0-9_]{1,15}$/.test(handle)) {
    return BLOG_AUTHOR_FALLBACK;
  }
  const rawImage = getStringProperty(profile, "profile_image_url_https");
  let image = BLOG_AUTHOR_FALLBACK.image;
  try {
    const url = new URL(rawImage ?? "");
    if (
      url.protocol === "https:" &&
      url.hostname === "pbs.twimg.com" &&
      !url.username &&
      !url.password &&
      !url.port
    ) {
      image = url.href;
    }
  } catch {
    // Keep the skeleton placeholder when the provider omits or corrupts the image.
  }
  return {
    name,
    image,
    url: `https://x.com/${handle}`,
    // SocialAPI's profile contract exposes verified, not a subscription tier.
    verified: isRecord(profile) && profile.verified === true,
  };
}
