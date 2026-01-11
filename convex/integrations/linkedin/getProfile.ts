"use node";

// convex/integrations/linkedin/getProfile.ts
// Fetch LinkedIn user profile and contact info via LinkdAPI

import { internalAction } from "../../_generated/server";
import { v } from "convex/values";

// ============================================================================
// Types
// ============================================================================

/** LinkedIn position/job */
export interface LinkedInPosition {
  companyId: number;
  companyName: string;
  companyUsername: string;
  companyURL: string;
  companyLogo: string;
  companyIndustry: string;
  companyStaffCountRange: string;
  title: string;
  location: string;
  description: string;
  employmentType: string;
  start: { year: number; month: number; day: number };
  end: { year: number; month: number; day: number };
}

/** LinkedIn geo info */
export interface LinkedInGeo {
  country: string;
  city: string;
  full: string;
  countryCode: string;
}

/** LinkedIn profile from LinkdAPI full profile endpoint */
export interface LinkedInProfile {
  id: number;
  urn: string;
  username: string;
  firstName: string;
  lastName: string;
  isCreator: boolean;
  isPremium: boolean;
  profilePicture: string;
  summary: string;
  headline: string;
  geo: LinkedInGeo;
  position: LinkedInPosition[];
  fullPositions: LinkedInPosition[];
  skills: Array<{ name: string; passedSkillAssessment: boolean }>;
  languages: Array<{ name: string; proficiency: string }>;
  educations: unknown[];
  certifications: unknown[];
}

/** LinkedIn contact info */
export interface LinkedInContactInfo {
  emailAddress: string | null;
  phoneNumber: string | null;
  websites: Array<{
    url: string;
    category: string;
  }>;
}

/** Full profile API response */
interface FullProfileResponse {
  success: boolean;
  statusCode: number;
  message: string;
  errors: unknown;
  data: LinkedInProfile;
}

/** Contact info API response */
interface ContactInfoResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: LinkedInContactInfo;
}

/** Combined profile result */
export interface ProfileResult {
  success: boolean;
  profile?: LinkedInProfile;
  contactInfo?: LinkedInContactInfo;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getApiKey(): string | null {
  return process.env.LINKDAPI_API_KEY ?? null;
}

// ============================================================================
// Internal Actions
// ============================================================================

/**
 * Fetch LinkedIn user profile by username or URN.
 * Optionally includes contact info.
 */
export const getProfile = internalAction({
  args: {
    username: v.optional(v.string()),
    urn: v.optional(v.string()),
    includeContactInfo: v.optional(v.boolean()),
  },
  handler: async (_, args): Promise<ProfileResult> => {
    const apiKey = getApiKey();

    if (!apiKey) {
      return {
        success: false,
        error: "LINKDAPI_API_KEY environment variable not set",
      };
    }

    if (!args.username && !args.urn) {
      return {
        success: false,
        error: "Either username or urn must be provided",
      };
    }

    try {
      // Build query params
      const params = new URLSearchParams();
      if (args.username) {
        params.set("username", args.username);
      }
      if (args.urn) {
        params.set("urn", args.urn);
      }

      // Fetch full profile
      const profileUrl = `https://linkdapi.com/api/v1/profile/full?${params.toString()}`;
      const profileResponse = await fetch(profileUrl, {
        method: "GET",
        headers: {
          "X-linkdapi-apikey": apiKey,
          Accept: "application/json",
        },
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error(
          "[linkedin/getProfile] Profile fetch failed:",
          profileResponse.status,
          errorText
        );
        return {
          success: false,
          error: `Failed to fetch profile: ${profileResponse.status}`,
        };
      }

      const profileData: FullProfileResponse = await profileResponse.json();

      if (!profileData.success) {
        return {
          success: false,
          error: profileData.message || "Failed to fetch profile",
        };
      }

      const profile = profileData.data;

      // Optionally fetch contact info
      let contactInfo: LinkedInContactInfo | undefined;

      if (args.includeContactInfo && (args.username || profile.username)) {
        try {
          const contactParams = new URLSearchParams();
          contactParams.set("username", args.username || profile.username);

          const contactUrl = `https://linkdapi.com/api/v1/profile/contact-info?${contactParams.toString()}`;
          const contactResponse = await fetch(contactUrl, {
            method: "GET",
            headers: {
              "X-linkdapi-apikey": apiKey,
              Accept: "application/json",
            },
          });

          if (contactResponse.ok) {
            const contactData: ContactInfoResponse =
              await contactResponse.json();
            if (contactData.success) {
              contactInfo = contactData.data;
            }
          }
        } catch (contactError) {
          console.warn(
            "[linkedin/getProfile] Contact info fetch failed:",
            contactError
          );
        }
      }

      console.info("[linkedin/getProfile] Profile fetched:", {
        username: profile.username,
        hasContactInfo: !!contactInfo,
      });

      return {
        success: true,
        profile,
        contactInfo,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[linkedin/getProfile] Error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
