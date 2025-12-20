"use node";

// convex/agents/internal.ts
// Internal actions for AI-powered keyword generation
// These are called by both standalone tools and the searchProspects orchestrator

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { z } from "zod";
import { robustGenerateObject, logAI } from "../lib/ai";

// ============================================================================
// Schemas
// ============================================================================

const prospectingKeywordsSchema = z.object({
  keywords: z.array(z.string()).min(5).max(20),
  reasoning: z.string(),
});

const socialQueriesSchema = z.object({
  queries: z.array(z.string()).min(5).max(30),
  reasoning: z.string(),
});

// ============================================================================
// Generate Prospecting Keywords from Synthetic Posts
// ============================================================================

const PROSPECTING_KEYWORDS_PROMPT = `You are an expert at extracting search keywords from social media posts.

Your task is to analyze synthetic posts (realistic examples of what prospects would write) and extract keywords/phrases that can be used to find similar posts on Twitter and LinkedIn.

Extract keywords that:
1. Capture the essence of the pain point expressed
2. Are short phrases (2-5 words, max 40 characters)
3. Would match real posts from people with similar problems
4. Are specific enough to filter out irrelevant results

Focus on:
- Problem-aware keywords ("struggling with X", "need help with Y")
- Outcome-seeking keywords ("looking for Z", "how to achieve W")
- Frustration expressions ("tired of X", "can't figure out Y")
- Action phrases ("looking for recommendations", "anyone know")

Do NOT extract:
- Generic filler words
- Complete sentences
- Overly broad terms`;

export const generateProspectingKeywordsAction = internalAction({
  args: {
    syntheticPosts: v.array(v.string()),
    businessContext: v.optional(v.string()),
  },
  handler: async (
    _,
    args
  ): Promise<{
    success: boolean;
    prospectingKeywords?: string[];
    reasoning?: string;
    error?: string;
  }> => {
    const startTime = Date.now();

    logAI("info", "Starting prospecting keyword generation from synthetic posts", {
      operation: "generateProspectingKeywords",
      syntheticPostsCount: args.syntheticPosts.length,
    });

    const userPrompt = `Extract prospecting keywords from these synthetic posts.

**Synthetic Posts (realistic examples of what prospects would write):**
${args.syntheticPosts.map((post, i) => `${i + 1}. "${post}"`).join("\n")}

${args.businessContext ? `**Business context:**\n${args.businessContext}` : ""}

Extract 10-15 unique keywords or short phrases that:
1. Capture pain points expressed in these posts
2. Would help find similar posts on social media
3. Are short and searchable (2-5 words, max 40 characters each)
4. Are varied - don't repeat similar concepts

Focus on extracting the core problem/need expressions from each post.`;

    try {
      const { object, model } = await robustGenerateObject({
        operation: "generateProspectingKeywords",
        schema: prospectingKeywordsSchema,
        system: PROSPECTING_KEYWORDS_PROMPT,
        prompt: userPrompt,
        temperature: 0.7,
        maxRetries: 2,
      });

      const durationMs = Date.now() - startTime;

      logAI("info", "Prospecting keywords generated", {
        operation: "generateProspectingKeywords",
        model,
        keywordsCount: object.keywords.length,
        durationMs,
      });

      return {
        success: true,
        prospectingKeywords: object.keywords,
        reasoning: object.reasoning,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logAI("error", "Failed to generate prospecting keywords", {
        operation: "generateProspectingKeywords",
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


