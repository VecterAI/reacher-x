"use node";

// convex/lib/enrichmentCore.ts
// Core enrichment logic - single source of truth
// Uses a SINGLE unified LLM call for all extraction
// Used by: workflows/enrichment.ts, agents/tools/enrichProspect.ts

import { z } from "zod";
import { robustGenerateObject } from "./ai";
import { formatLargeNumber } from "../../shared/lib/utils/encoding/format";
import { extractLinkedInUsername } from "../../shared/lib/utils/url/socialProfiles";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

// ============================================================================
// Types
// ============================================================================

/** Prospect type: individual or organization */
export type ProspectType = "individual" | "organization" | "unknown";

/** Evidence post for pain points and finance */
export interface EvidencePost {
  id: string;
  text: string;
  url?: string;
  platform: "twitter" | "linkedin";
  /**
   * Full provider payload used by UI renderers (Tweet/LinkedInPostCard).
   * Kept optional for backward compatibility with already-enriched records.
   */
  raw?: Record<string, unknown>;
}

/** Extracted pain point with solution */
export interface PainPointWithSolution {
  pain: string;
  solution: string | null;
  evidencePosts: EvidencePost[];
}

/** Extracted finance data */
export interface FinanceData {
  displayValue: string;
  type?: string;
  amount?: number;
  currency?: string;
  evidencePosts: EvidencePost[];
}

/** Full enrichment result */
export interface EnrichmentResult {
  prospectType: ProspectType;
  displayName?: string;
  title?: string;
  briefIntro?: string;
  company?: string;
  websiteUrl?: string;
  email?: string;
  location?: string;
  finance?: FinanceData;
  painPoints: PainPointWithSolution[];
  pipelineStage: "new";
  enrichedAt: number;
  enrichmentStatus: "enriched" | "partial" | "failed";
  /** Social profile links for UI rendering */
  socialProfiles?: {
    twitter?: {
      username: string;
      url: string;
      profileId?: string;
    };
    linkedin?: {
      username: string;
      url: string;
      urn?: string;
    };
  };
}

/** ICP structure from workspace */
export interface ICP {
  title: string;
  description: string;
  painPoints: string[];
}

// ============================================================================
// Evidence Post Helpers (Single Source of Truth)
// ============================================================================

/**
 * Convert raw posts from API to EvidencePost format.
 * Handles both Twitter and LinkedIn post structures.
 */
export function convertToEvidencePosts(
  rawPosts: Array<Record<string, unknown>>,
  platform: "twitter" | "linkedin"
): EvidencePost[] {
  return rawPosts.map((p) => ({
    id: (p.id_str as string) || (p.postID as string) || String(p.id || ""),
    text: (p.full_text as string) || (p.text as string) || "",
    url: (p.postURL as string) || undefined,
    platform,
    raw: p,
  }));
}

/**
 * Deduplicate evidence posts by ID.
 */
export function deduplicateEvidencePosts(
  posts: EvidencePost[]
): EvidencePost[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

// ============================================================================
// Unified Enrichment Schema
// ============================================================================

const unifiedEnrichmentSchema = z.object({
  // Type detection
  prospectType: z
    .enum(["individual", "organization"])
    .describe(
      "Whether this is an individual person or an organization/company account"
    ),

  // Title generation
  title: z
    .string()
    .describe(
      "A short professional title for this person/org (max 5 words, e.g., 'Solo SaaS Founder', 'AI Startup')"
    ),

  // Company extraction (for individuals)
  company: z
    .string()
    .optional()
    .describe(
      "Company name/affiliation if this is an individual. Leave empty for organizations."
    ),

  // Website extraction from bio
  websiteUrl: z
    .string()
    .optional()
    .describe(
      "Website URL found in bio (not social media links). Leave empty if none."
    ),

  // Pain points with solution matching
  painPoints: z
    .array(
      z.object({
        pain: z
          .string()
          .describe("A specific pain point or challenge mentioned"),
        postIds: z
          .array(z.string())
          .describe("IDs of posts where this pain was mentioned"),
        solution: z
          .string()
          .optional()
          .describe(
            "If this matches one of the user's ICP pain points, how their offering addresses it. Otherwise leave empty."
          ),
      })
    )
    .describe(
      "Pain points extracted from posts, matched against user's ICP pain points"
    ),

  // Finance extraction
  finance: z.object({
    found: z
      .boolean()
      .describe("Whether any finance/revenue information was found"),
    displayValue: z
      .string()
      .optional()
      .describe(
        "Formatted display value (e.g., '$9K-$14K MRR', '$1.2M ARR', 'Raised $5M Series A')"
      ),
    type: z
      .string()
      .optional()
      .describe("Type: 'mrr', 'arr', 'revenue', 'profit', 'funding'"),
    amount: z.number().optional().describe("Numeric amount if parseable"),
    currency: z
      .string()
      .optional()
      .describe("Currency code if detected (USD, EUR, etc)"),
    postIds: z
      .array(z.string())
      .optional()
      .describe("IDs of posts that mention this"),
  }),
});

// ============================================================================
// Unified Enrichment Prompt
// ============================================================================

const UNIFIED_ENRICHMENT_PROMPT = `You are an expert at analyzing social media profiles and extracting business intelligence.

Your task is to analyze the profile data and posts to extract:
1. **Prospect Type**: Is this an individual person or an organization/company?
2. **Title**: A short professional title (max 5 words)
3. **Company**: Company affiliation (for individuals only)
4. **Website**: Website URL from bio (not social media links)
5. **Pain Points**: Specific challenges or problems mentioned, with solutions if they match the user's ICP
6. **Finance**: Any MRR, ARR, revenue, profit, or funding mentions

PAIN POINT MATCHING RULES:
- Extract pain points from the posts
- For each pain, check if it matches any of the provided ICP pain points
- If there's a match, provide a brief solution statement (how the user's product addresses it)
- If no match, leave solution empty

FINANCE EXTRACTION RULES:
- Only extract if explicitly mentioned (don't guess)
- Format nicely: "$9K MRR", "$1.2M ARR", "Raised $5M Series A"
- Include the post IDs where it was mentioned`;

// ============================================================================
// Main Unified Extraction Function
// ============================================================================

/**
 * Single unified LLM call to extract all enrichment data.
 * Combines type detection, title generation, pain points, and finance extraction.
 */
async function extractAllEnrichmentData(params: {
  platform: "twitter" | "linkedin";
  profileData: Record<string, unknown>;
  evidencePosts: EvidencePost[];
  icpPainPoints: string[];
  workspaceName: string;
}): Promise<{
  prospectType: ProspectType;
  title: string;
  company?: string;
  websiteUrl?: string;
  painPoints: Array<{ pain: string; postIds: string[]; solution?: string }>;
  finance?: {
    found: boolean;
    displayValue?: string;
    type?: string;
    amount?: number;
    currency?: string;
    postIds?: string[];
  };
}> {
  const { platform, profileData, evidencePosts, icpPainPoints, workspaceName } =
    params;

  // Build profile summary for the LLM
  const profileSummary = buildProfileSummary(profileData, platform);

  // Build posts text with IDs
  const postsText =
    evidencePosts.length > 0
      ? evidencePosts.map((p) => `[${p.id}]: ${p.text}`).join("\n\n")
      : "No posts available.";

  // Build ICP pain points context
  const icpContext =
    icpPainPoints.length > 0
      ? `\nUSER'S ICP PAIN POINTS (for solution matching):\n${icpPainPoints.map((p) => `- ${p}`).join("\n")}`
      : "";

  const prompt = `PROFILE (${platform}):
${profileSummary}

POSTS:
${postsText}
${icpContext}

User's product/workspace: "${workspaceName}"

Analyze and extract all enrichment data.`;

  try {
    const { object } = await robustGenerateObject({
      operation: "unifiedEnrichment",
      schema: unifiedEnrichmentSchema,
      system: UNIFIED_ENRICHMENT_PROMPT,
      prompt,
      temperature: 0.3,
      maxRetries: 2,
    });

    return {
      prospectType: object.prospectType,
      title: object.title,
      company: object.company,
      websiteUrl: object.websiteUrl,
      painPoints: object.painPoints,
      finance: object.finance.found ? object.finance : undefined,
    };
  } catch (error) {
    console.error(
      "[extractAllEnrichmentData] LLM failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Build a concise profile summary for LLM analysis
 */
function buildProfileSummary(
  profileData: Record<string, unknown>,
  platform: "twitter" | "linkedin"
): string {
  const parts: string[] = [];

  if (platform === "twitter") {
    if (profileData.name) parts.push(`Name: ${profileData.name}`);
    if (profileData.screen_name)
      parts.push(`Handle: @${profileData.screen_name}`);
    if (profileData.description) parts.push(`Bio: ${profileData.description}`);
    if (profileData.location) parts.push(`Location: ${profileData.location}`);
    if (profileData.url) parts.push(`URL: ${profileData.url}`);
    if (profileData.followers_count)
      parts.push(`Followers: ${profileData.followers_count}`);
  } else {
    // LinkedIn individual
    if (profileData.firstName || profileData.lastName) {
      parts.push(
        `Name: ${profileData.firstName || ""} ${profileData.lastName || ""}`.trim()
      );
    }
    if (profileData.headline) parts.push(`Headline: ${profileData.headline}`);
    if (profileData.summary) parts.push(`Summary: ${profileData.summary}`);

    const geo = profileData.geo as Record<string, unknown> | undefined;
    if (geo?.full) parts.push(`Location: ${geo.full}`);

    // LinkedIn company
    if (profileData.name && !profileData.firstName) {
      parts.push(`Company Name: ${profileData.name}`);
    }
    if (profileData.description)
      parts.push(`Description: ${profileData.description}`);
    if (profileData.website) parts.push(`Website: ${profileData.website}`);
  }

  return parts.join("\n") || "No profile data available.";
}

// ============================================================================
// Main Enrichment Functions
// ============================================================================

/**
 * Core enrichment function for Twitter profiles.
 * Uses a single unified LLM call.
 */
export async function enrichTwitterProfile(params: {
  profile: Record<string, unknown>;
  extendedBio?: string;
  evidencePosts: EvidencePost[];
  icps: ICP[];
  workspaceName: string;
}): Promise<EnrichmentResult> {
  const { profile, extendedBio, evidencePosts, icps, workspaceName } = params;

  try {
    // Collect all ICP pain points
    const icpPainPoints = icps.flatMap((icp) => icp.painPoints);

    // Merge extended bio into profile if available
    const enrichedProfile = extendedBio ? { ...profile, extendedBio } : profile;

    // Single unified LLM call
    const extracted = await extractAllEnrichmentData({
      platform: "twitter",
      profileData: enrichedProfile,
      evidencePosts,
      icpPainPoints,
      workspaceName,
    });

    // Map results to EnrichmentResult
    const painPoints: PainPointWithSolution[] = extracted.painPoints.map(
      (pp) => ({
        pain: pp.pain,
        solution: pp.solution || null,
        evidencePosts: pp.postIds
          .map((id) => evidencePosts.find((ep) => ep.id === id))
          .filter((ep): ep is EvidencePost => ep !== undefined),
      })
    );

    const finance: FinanceData | undefined = extracted.finance
      ? {
          displayValue: extracted.finance.displayValue || "",
          type: extracted.finance.type,
          amount: extracted.finance.amount,
          currency: extracted.finance.currency,
          evidencePosts: (extracted.finance.postIds || [])
            .map((id) => evidencePosts.find((ep) => ep.id === id))
            .filter((ep): ep is EvidencePost => ep !== undefined),
        }
      : undefined;

    console.info("[enrichTwitterProfile] Completed:", {
      prospectType: extracted.prospectType,
      painPointsCount: painPoints.length,
      hasFinance: !!finance,
    });

    return {
      prospectType: extracted.prospectType,
      displayName: (profile.name as string) || undefined,
      title: extracted.title,
      briefIntro: (profile.description as string) || undefined,
      company: extracted.company,
      websiteUrl: extracted.websiteUrl || (profile.url as string) || undefined,
      location: (profile.location as string) || undefined,
      finance,
      painPoints,
      pipelineStage: "new",
      enrichedAt: getCurrentUTCTimestamp(),
      enrichmentStatus: "enriched",
      socialProfiles: (profile.screen_name as string)
        ? {
            twitter: {
              username: profile.screen_name as string,
              url: `https://x.com/${profile.screen_name}`,
              profileId: (profile.id_str as string) || undefined,
            },
          }
        : undefined,
    };
  } catch (error) {
    console.error(
      "[enrichTwitterProfile] Failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return {
      prospectType: "unknown",
      painPoints: [],
      pipelineStage: "new",
      enrichedAt: getCurrentUTCTimestamp(),
      enrichmentStatus: "failed",
    };
  }
}

/**
 * Core enrichment function for LinkedIn profiles.
 * Uses a single unified LLM call.
 * For companies with fundingData from API, uses that directly (no LLM needed for finance).
 */
export async function enrichLinkedInProfile(params: {
  profile: Record<string, unknown>;
  contactInfo?: Record<string, unknown>;
  companyData?: Record<string, unknown>;
  evidencePosts: EvidencePost[];
  icps: ICP[];
  workspaceName: string;
}): Promise<EnrichmentResult> {
  const {
    profile,
    contactInfo,
    companyData,
    evidencePosts,
    icps,
    workspaceName,
  } = params;

  try {
    // Detect if this is a company based on URL pattern
    const linkedinUrl =
      (companyData?.linkedinUrl as string) ||
      (profile.linkedinUrl as string) ||
      "";
    const isCompany = linkedinUrl.includes("/company/") || !!companyData;

    // Use company data if available, otherwise profile
    const primaryData = companyData || profile;

    // Check for LinkedIn API funding data (no LLM needed)
    let apiFundingData: FinanceData | undefined;
    if (isCompany && companyData?.fundingData) {
      const funding = companyData.fundingData as Record<string, unknown>;
      const lastRound = funding.lastFundingRound as
        | Record<string, unknown>
        | undefined;

      if (lastRound?.moneyRaised) {
        const money = lastRound.moneyRaised as {
          amount: string;
          currencyCode: string;
        };
        const amount = parseInt(money.amount, 10);
        const fundingType = (lastRound.fundingType as string) || "";

        apiFundingData = {
          displayValue:
            `Raised $${formatLargeNumber(amount)} ${fundingType}`.trim(),
          type: "funding",
          amount,
          currency: money.currencyCode,
          evidencePosts: [], // From API, not posts
        };
      }
    }

    // Collect all ICP pain points
    const icpPainPoints = icps.flatMap((icp) => icp.painPoints);

    // Single unified LLM call
    const extracted = await extractAllEnrichmentData({
      platform: "linkedin",
      profileData: primaryData,
      evidencePosts,
      icpPainPoints,
      workspaceName,
    });

    // Map results to EnrichmentResult
    const painPoints: PainPointWithSolution[] = extracted.painPoints.map(
      (pp) => ({
        pain: pp.pain,
        solution: pp.solution || null,
        evidencePosts: pp.postIds
          .map((id) => evidencePosts.find((ep) => ep.id === id))
          .filter((ep): ep is EvidencePost => ep !== undefined),
      })
    );

    // Use API funding data if available, otherwise LLM-extracted
    let finance: FinanceData | undefined = apiFundingData;
    if (!finance && extracted.finance) {
      finance = {
        displayValue: extracted.finance.displayValue || "",
        type: extracted.finance.type,
        amount: extracted.finance.amount,
        currency: extracted.finance.currency,
        evidencePosts: (extracted.finance.postIds || [])
          .map((id) => evidencePosts.find((ep) => ep.id === id))
          .filter((ep): ep is EvidencePost => ep !== undefined),
      };
    }

    // Extract basic fields based on profile type
    let displayName: string | undefined;
    let company: string | undefined;
    let websiteUrl: string | undefined;
    let email: string | undefined;
    let location: string | undefined;
    let briefIntro: string | undefined;

    if (isCompany && companyData) {
      displayName = (companyData.name as string) || undefined;
      websiteUrl =
        (companyData.website as string) || extracted.websiteUrl || undefined;
      briefIntro = (companyData.description as string) || undefined;

      const hq = companyData.headquarter as Record<string, unknown> | undefined;
      if (hq) {
        location =
          [hq.city, hq.country].filter(Boolean).join(", ") || undefined;
      }
    } else {
      displayName =
        `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
        undefined;
      briefIntro = (profile.summary as string) || undefined;
      company = extracted.company;

      // Position company from first position if not extracted
      if (!company) {
        const positions = profile.position as
          | Array<Record<string, unknown>>
          | undefined;
        if (positions && positions.length > 0) {
          company = (positions[0].companyName as string) || undefined;
        }
      }

      const geo = profile.geo as Record<string, unknown> | undefined;
      if (geo) {
        location = (geo.full as string) || undefined;
      }

      // Contact info
      if (contactInfo) {
        email = (contactInfo.emailAddress as string) || undefined;

        const websites = contactInfo.websites as
          | Array<{ url: string }>
          | undefined;
        if (!websiteUrl && websites && websites.length > 0) {
          websiteUrl = websites[0].url;
        }
      }
    }

    console.info("[enrichLinkedInProfile] Completed:", {
      prospectType: isCompany ? "organization" : extracted.prospectType,
      painPointsCount: painPoints.length,
      hasFinance: !!finance,
      usedApiFunding: !!apiFundingData,
    });

    return {
      prospectType: isCompany ? "organization" : extracted.prospectType,
      displayName,
      title: extracted.title,
      briefIntro,
      company,
      websiteUrl,
      email,
      location,
      finance,
      painPoints,
      pipelineStage: "new",
      enrichedAt: getCurrentUTCTimestamp(),
      enrichmentStatus: "enriched",
      socialProfiles: (() => {
        // Extract username from LinkedIn URL using utility
        const linkedinUsername =
          extractLinkedInUsername(linkedinUrl) ||
          (profile.publicIdentifier as string) ||
          undefined;
        const profileUrn = (profile.urn as string) || undefined;

        if (!linkedinUsername) return undefined;

        return {
          linkedin: {
            username: linkedinUsername,
            url: linkedinUrl || `https://linkedin.com/in/${linkedinUsername}`,
            urn: profileUrn,
          },
        };
      })(),
    };
  } catch (error) {
    console.error(
      "[enrichLinkedInProfile] Failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return {
      prospectType: "unknown",
      painPoints: [],
      pipelineStage: "new",
      enrichedAt: getCurrentUTCTimestamp(),
      enrichmentStatus: "failed",
    };
  }
}
