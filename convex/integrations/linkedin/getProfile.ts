"use node";

// convex/integrations/linkedin/getProfile.ts
// Fetch LinkedIn user profile and contact info via LinkdAPI

import { internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { requestLinkdApiData } from "./linkdapiClient";

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
  handler: async (ctx, args): Promise<ProfileResult> => {
    if (!args.username && !args.urn) {
      return {
        success: false,
        error: "Either username or urn must be provided",
      };
    }

    try {
      const profile = await requestLinkdApiData<LinkedInProfile>(ctx, {
        path: "/api/v1/profile/full",
        query: {
          username: args.username,
          urn: args.urn,
        },
        consumer: `linkedin.getProfile:${args.username ?? args.urn ?? "unknown"}`,
      });

      // Optionally fetch contact info
      let contactInfo: LinkedInContactInfo | undefined;

      if (args.includeContactInfo && (args.username || profile.username)) {
        try {
          contactInfo = await requestLinkdApiData<LinkedInContactInfo>(ctx, {
            path: "/api/v1/profile/contact-info",
            query: {
              username: args.username || profile.username,
            },
            consumer: `linkedin.getProfileContactInfo:${args.username ?? profile.username}`,
          });
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
