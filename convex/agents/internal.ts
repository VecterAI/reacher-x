"use node";

// convex/agents/internal.ts
// Internal actions for AI-powered keyword generation
// These are called by both standalone tools and the searchProspects orchestrator

import { internalAction } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { z } from "zod";
import { robustGenerateObject, logAI } from "../lib/ai";
import { KEYWORD_GENERATION_PROMPT } from "./prompts";

// ============================================================================
// Schemas
// ============================================================================

const seedKeywordsSchema = z.object({
  keywords: z.array(z.string()).min(5).max(20),
  reasoning: z.string(),
});

const socialQueriesSchema = z.object({
  queries: z.array(z.string()).min(5).max(30),
  reasoning: z.string(),
});

// ============================================================================
// Generate Seed Keywords
// ============================================================================

export const generateSeedKeywordsAction = internalAction({
  args: {
    improvedDescription: v.string(),
    icps: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        painPoints: v.array(v.string()),
        channels: v.array(v.string()),
      })
    ),
  },
  handler: async (
    _,
    args
  ): Promise<{
    success: boolean;
    seedKeywords?: string[];
    reasoning?: string;
    error?: string;
  }> => {
    const startTime = Date.now();

    logAI("info", "Starting seed keyword generation", {
      operation: "generateSeedKeywords",
      icpCount: args.icps.length,
    });

    const icpDetails = args.icps
      .map(
        (icp, i) => `
**ICP ${i + 1}: ${icp.title}**
- Description: ${icp.description}
- Pain Points: ${icp.painPoints.join(", ")}
- Active on: ${icp.channels.join(", ")}`
      )
      .join("\n");

    const userPrompt = `Generate search keywords for finding prospects on social media.

**Business Description:**
${args.improvedDescription}

**Ideal Customer Profiles:**
${icpDetails}

Generate 10-15 keywords or short phrases that:
1. Prospects might use when expressing frustration or needs
2. Indicate pain points related to this product
3. Would appear naturally in social media posts
4. Are specific enough to filter relevant results

Focus on:
- Problem-aware keywords ("struggling with X", "need help with Y")
- Outcome-seeking keywords ("looking for Z", "how to achieve W")
- Frustration expressions ("tired of X", "can't figure out Y")
- Industry-specific terms the target audience uses

Do NOT include:
- Generic business terms
- The product/company name
- Overly broad terms that would match too many irrelevant posts`;

    try {
      const { object, model } = await robustGenerateObject({
        operation: "generateSeedKeywords",
        schema: seedKeywordsSchema,
        system: KEYWORD_GENERATION_PROMPT,
        prompt: userPrompt,
        temperature: 0.7,
        maxRetries: 2,
      });

      const durationMs = Date.now() - startTime;

      logAI("info", "Seed keywords generated", {
        operation: "generateSeedKeywords",
        model,
        keywordsCount: object.keywords.length,
        durationMs,
      });

      return {
        success: true,
        seedKeywords: object.keywords,
        reasoning: object.reasoning,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logAI("error", "Failed to generate seed keywords", {
        operation: "generateSeedKeywords",
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        error: `Failed to generate keywords: ${errorMessage}`,
      };
    }
  },
});

// ============================================================================
// Convert to Social Queries
// ============================================================================

const CONVERSION_PROMPT = `You are an expert at social media language and prospecting.

Your task is to convert search engine keywords into natural social media queries that would match real posts from people experiencing problems or needs.

**CRITICAL: CHARACTER LIMIT**
Every query MUST be 40 characters or less. Count the characters before including each query.
Queries longer than 40 characters will NOT return results on social platforms.
Aim for 25-40 characters. Shorter is better for search matching.

Key principles:
1. Social media language is conversational, not search-engine-like
2. People express problems with emotion and context
3. Real posts contain complaints, questions, or seeking recommendations
4. Use first-person perspective ("I'm struggling", "can anyone recommend")

Transform formal keywords into natural expressions:
- "best CRM software" → "need a better CRM" (17 chars ✓)
- "lead generation tools" → "struggling to find leads" (24 chars ✓)
- "customer acquisition" → "how do you find customers" (26 chars ✓)
- "email marketing automation" → "tired of manual emails" (22 chars ✓)

Each query should be:
- MAXIMUM 40 characters (this is mandatory)
- 3-6 words (optimal for social search)
- Natural, conversational tone
- Something a real person would type/say`;


export const convertToSocialQueriesAction = internalAction({
  args: {
    keywords: v.array(v.string()),
    platforms: v.array(v.union(v.literal("twitter"), v.literal("linkedin"))),
    businessContext: v.optional(v.string()),
  },
  handler: async (
    _,
    args
  ): Promise<{
    success: boolean;
    socialQueries?: string[];
    reasoning?: string;
    error?: string;
  }> => {
    const startTime = Date.now();

    logAI("info", "Starting keyword to social query conversion", {
      operation: "convertToSocialQueries",
      keywordsCount: args.keywords.length,
      platforms: args.platforms.join(", "),
    });

    const platformContext =
      args.platforms.length === 2
        ? "Twitter and LinkedIn"
        : args.platforms[0] === "twitter"
          ? "Twitter/X"
          : "LinkedIn";

    const userPrompt = `Convert these keywords into natural social media search queries for ${platformContext}.

**Keywords to convert:**
${args.keywords.map((kw, i) => `${i + 1}. ${kw}`).join("\n")}
${args.businessContext ? `\n**Business context:**\n${args.businessContext}` : ""}

Generate 15-25 natural social media queries that:
1. Sound like real posts from people with problems
2. Use conversational, first-person language
3. Include expressions of frustration, questions, or seeking help
4. Would match posts from potential customers

Examples of good conversions:
- Keyword: "project management software" → Query: "need a better way to manage projects"
- Keyword: "customer support tool" → Query: "support tickets are killing me"
- Keyword: "marketing automation" → Query: "anyone automate their marketing"

Generate varied query types:
- Frustration expressions (3-5)
- Questions/seeking advice (3-5)
- Looking for recommendations (3-5)
- General pain point expressions (3-5)`;

    try {
      const { object, model } = await robustGenerateObject({
        operation: "convertToSocialQueries",
        schema: socialQueriesSchema,
        system: CONVERSION_PROMPT,
        prompt: userPrompt,
        temperature: 0.8,
        maxRetries: 2,
      });

      const durationMs = Date.now() - startTime;

      logAI("info", "Social queries generated", {
        operation: "convertToSocialQueries",
        model,
        queriesCount: object.queries.length,
        durationMs,
      });

      return {
        success: true,
        socialQueries: object.queries,
        reasoning: object.reasoning,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logAI("error", "Failed to convert to social queries", {
        operation: "convertToSocialQueries",
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        error: `Failed to convert keywords: ${errorMessage}`,
      };
    }
  },
});

// ============================================================================
// Discover Keywords via Bishopi
// ============================================================================

// Import for local use, re-export for consumers
import type { DiscoveredKeyword } from "../integrations/bishopi";
export type { DiscoveredKeyword };

export const discoverKeywordsAction = internalAction({
  args: {
    seedKeywords: v.array(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    discoveredKeywords?: DiscoveredKeyword[];
    keywordStrings?: string[];
    error?: string;
    stats?: {
      seedKeywordsCount: number;
      discoveredCount: number;
      durationMs: number;
    };
  }> => {
    const startTime = Date.now();

    logAI("info", "Starting keyword discovery via Bishopi", {
      operation: "discoverKeywords",
      seedKeywordsCount: args.seedKeywords.length,
    });

    try {
      const result = await ctx.runAction(
        api.integrations.bishopi.fetchKeywordIdeas,
        {
          seedKeywords: args.seedKeywords,
        }
      );

      const durationMs = Date.now() - startTime;

      if (!result.success) {
        logAI("warn", "Bishopi API returned error", {
          operation: "discoverKeywords",
          error: result.error,
          durationMs,
        });

        return {
          success: false,
          error: result.error,
          stats: {
            seedKeywordsCount: args.seedKeywords.length,
            discoveredCount: 0,
            durationMs,
          },
        };
      }

      // Extract just the keyword strings for convenience
      const keywordStrings = result.keywords.map((kw) => kw.keyword);

      logAI("info", "Keyword discovery completed", {
        operation: "discoverKeywords",
        seedKeywordsCount: args.seedKeywords.length,
        discoveredCount: result.keywords.length,
        durationMs,
      });

      return {
        success: true,
        discoveredKeywords: result.keywords,
        keywordStrings,
        stats: {
          seedKeywordsCount: args.seedKeywords.length,
          discoveredCount: result.keywords.length,
          durationMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const durationMs = Date.now() - startTime;

      logAI("error", "Keyword discovery failed", {
        operation: "discoverKeywords",
        error: errorMessage,
        durationMs,
      });

      return {
        success: false,
        error: `Failed to discover keywords: ${errorMessage}`,
        stats: {
          seedKeywordsCount: args.seedKeywords.length,
          discoveredCount: 0,
          durationMs,
        },
      };
    }
  },
});
