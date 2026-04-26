"use node";

// convex/integrations/linkedin/getCompany.ts
// Fetch LinkedIn company details via LinkdAPI

import { internalAction } from "../../lib/functionBuilders";
import { v } from "convex/values";
import { requestLinkdApiData } from "./linkdapiClient";

// ============================================================================
// Types
// ============================================================================

/** LinkedIn company headquarters */
export interface LinkedInHeadquarter {
  countryCode: string;
  geographicArea: string;
  country: string;
  city: string;
  postalCode?: string;
  headquarter: boolean;
  line1?: string;
}

/** LinkedIn funding round */
export interface LinkedInFundingRound {
  fundingType: string;
  moneyRaised: {
    amount: string;
    currencyCode: string;
  };
  announcedOn: {
    year: number;
    month: number;
    day: number;
  };
  fundingRoundCrunchbaseUrl: string;
}

/** LinkedIn funding data */
export interface LinkedInFundingData {
  updatedAt: string;
  numFundingRounds: number;
  lastFundingRound: LinkedInFundingRound | null;
  crunchbaseUrl: string;
}

/** LinkedIn company images */
export interface LinkedInCompanyImages {
  logo: string;
  cover: string;
}

/** LinkedIn company from LinkdAPI */
export interface LinkedInCompany {
  id: string;
  name: string;
  universalName: string;
  linkedinUrl: string;
  description: string;
  type: string;
  images: LinkedInCompanyImages;
  staffCount: number;
  headquarter: LinkedInHeadquarter;
  locations: LinkedInHeadquarter[];
  industriesV2: string[];
  specialities: string[];
  website: string;
  founded: { year: number; month: number; day: number };
  followerCount: number;
  staffCountRange: string;
  crunchbaseUrl?: string;
  fundingData?: LinkedInFundingData;
}

/** Company result */
export interface CompanyResult {
  success: boolean;
  company?: LinkedInCompany;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

// ============================================================================
// Internal Actions
// ============================================================================

/**
 * Fetch LinkedIn company details by ID or name.
 */
export const getCompany = internalAction({
  args: {
    id: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CompanyResult> => {
    if (!args.id && !args.name) {
      return {
        success: false,
        error: "Either id or name must be provided",
      };
    }

    try {
      const company = await requestLinkdApiData<LinkedInCompany>(ctx, {
        path: "/api/v1/companies/company/info",
        query: {
          id: args.id,
          name: args.name,
        },
        consumer: `linkedin.getCompany:${args.id ?? args.name ?? "unknown"}`,
      });

      console.info("[linkedin/getCompany] Company fetched:", {
        name: company.name,
        hasFunding: !!company.fundingData,
      });

      return {
        success: true,
        company,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[linkedin/getCompany] Error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
