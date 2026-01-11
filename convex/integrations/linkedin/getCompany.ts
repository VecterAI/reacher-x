"use node";

// convex/integrations/linkedin/getCompany.ts
// Fetch LinkedIn company details via LinkdAPI

import { internalAction } from "../../_generated/server";
import { v } from "convex/values";

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

/** Company API response */
interface CompanyResponse {
  success: boolean;
  statusCode: number;
  message: string;
  errors: unknown;
  data: LinkedInCompany;
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

function getApiKey(): string | null {
  return process.env.LINKDAPI_API_KEY ?? null;
}

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
  handler: async (_, args): Promise<CompanyResult> => {
    const apiKey = getApiKey();

    if (!apiKey) {
      return {
        success: false,
        error: "LINKDAPI_API_KEY environment variable not set",
      };
    }

    if (!args.id && !args.name) {
      return {
        success: false,
        error: "Either id or name must be provided",
      };
    }

    try {
      // Build query params
      const params = new URLSearchParams();
      if (args.id) {
        params.set("id", args.id);
      }
      if (args.name) {
        params.set("name", args.name);
      }

      const url = `https://linkdapi.com/api/v1/companies/company/info?${params.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-linkdapi-apikey": apiKey,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[linkedin/getCompany] Company fetch failed:",
          response.status,
          errorText
        );
        return {
          success: false,
          error: `Failed to fetch company: ${response.status}`,
        };
      }

      const data: CompanyResponse = await response.json();

      if (!data.success) {
        return {
          success: false,
          error: data.message || "Failed to fetch company",
        };
      }

      console.info("[linkedin/getCompany] Company fetched:", {
        name: data.data.name,
        hasFunding: !!data.data.fundingData,
      });

      return {
        success: true,
        company: data.data,
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
