"use node";

// convex/integrations/twitter/getProfile.ts
// Fetch Twitter user profile and extended bio via SocialAPI

import { internalAction } from "../../_generated/server";
import { v } from "convex/values";

// ============================================================================
// Types
// ============================================================================

/** Twitter user profile from SocialAPI */
export interface TwitterProfile {
  id: number;
  id_str: string;
  name: string;
  screen_name: string;
  location?: string;
  url?: string;
  description?: string;
  protected: boolean;
  verified: boolean;
  followers_count: number;
  friends_count: number;
  listed_count: number;
  favourites_count: number;
  statuses_count: number;
  created_at: string;
  profile_banner_url?: string;
  profile_image_url_https: string;
  can_dm: boolean;
}

/** Extended bio block from SocialAPI */
interface ExtendedBioBlock {
  text: string;
  type: string;
  inlineStyleRanges: unknown[];
  entityRanges: unknown[];
  depth: number;
  key: string;
}

/** Extended bio response */
interface ExtendedBioResponse {
  blocks?: ExtendedBioBlock[];
  entityMap?: unknown[];
}

/** Combined profile result */
export interface ProfileResult {
  success: boolean;
  profile?: TwitterProfile;
  extendedBio?: string;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getApiKey(): string | null {
  return process.env.SOCIALAPI_API_KEY ?? null;
}

/**
 * Extracts text from extended bio blocks
 */
function parseExtendedBio(response: ExtendedBioResponse): string {
  if (!response.blocks || response.blocks.length === 0) {
    return "";
  }

  return response.blocks
    .map((block) => block.text)
    .filter((text) => text.trim().length > 0)
    .join("\n\n");
}

// ============================================================================
// Internal Actions
// ============================================================================

/**
 * Fetch Twitter user profile by username or ID.
 * Returns profile data and extended bio if available.
 */
export const getProfile = internalAction({
  args: {
    username: v.optional(v.string()),
    userId: v.optional(v.string()),
    includeExtendedBio: v.optional(v.boolean()),
  },
  handler: async (_, args): Promise<ProfileResult> => {
    const apiKey = getApiKey();

    if (!apiKey) {
      return {
        success: false,
        error: "SOCIALAPI_API_KEY environment variable not set",
      };
    }

    const identifier = args.username || args.userId;
    if (!identifier) {
      return {
        success: false,
        error: "Either username or userId must be provided",
      };
    }

    try {
      // Fetch main profile
      const profileUrl = `https://api.socialapi.me/twitter/user/${identifier}`;
      const profileResponse = await fetch(profileUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error(
          "[twitter/getProfile] Profile fetch failed:",
          profileResponse.status,
          errorText
        );
        return {
          success: false,
          error: `Failed to fetch profile: ${profileResponse.status}`,
        };
      }

      const profile: TwitterProfile = await profileResponse.json();

      // Optionally fetch extended bio
      let extendedBio: string | undefined;

      if (args.includeExtendedBio && args.username) {
        try {
          const extendedBioUrl = `https://api.socialapi.me/twitter/user/${args.username}/extended-bio`;
          const extendedBioResponse = await fetch(extendedBioUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/json",
            },
          });

          if (extendedBioResponse.ok) {
            const extendedBioData: ExtendedBioResponse =
              await extendedBioResponse.json();
            extendedBio = parseExtendedBio(extendedBioData);
          }
          // Don't fail if extended bio is not available
        } catch (extError) {
          console.warn(
            "[twitter/getProfile] Extended bio fetch failed:",
            extError
          );
        }
      }

      console.info("[twitter/getProfile] Profile fetched:", {
        username: profile.screen_name,
        hasExtendedBio: !!extendedBio,
      });

      return {
        success: true,
        profile,
        extendedBio,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[twitter/getProfile] Error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
