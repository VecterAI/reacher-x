// convex/agent/tools/keywordGeneration.ts
// AI-powered keyword generation for prospect discovery

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import {
  createGatewayProvider,
  DEFAULT_MODEL,
  logAIOperation,
} from "../../lib/ai";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extracts token counts from AI SDK usage object.
 * Handles different property names across SDK versions.
 */
function extractTokenCounts(usage: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  if (!usage || typeof usage !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }

  const u = usage as Record<string, unknown>;

  // Try different property names used across AI SDK versions
  const inputTokens =
    (u.promptTokens as number) ??
    (u.inputTokens as number) ??
    (u.input_tokens as number) ??
    0;

  const outputTokens =
    (u.completionTokens as number) ??
    (u.outputTokens as number) ??
    (u.output_tokens as number) ??
    0;

  return { inputTokens, outputTokens };
}

// ============================================================================
// Schemas
// ============================================================================

const seedKeywordsSchema = z.object({
  keywords: z
    .array(z.string())
    .min(3)
    .max(15)
    .describe("Array of seed keywords for prospect discovery"),
  reasoning: z
    .string()
    .describe("Brief explanation of why these keywords were chosen"),
});

const socialQueriesSchema = z.object({
  queries: z
    .array(z.string())
    .min(5)
    .max(30)
    .describe("Social media search queries to find prospects"),
  queryTypes: z
    .array(
      z.object({
        query: z.string(),
        type: z.enum([
          "pain_point",
          "question",
          "recommendation_request",
          "complaint",
          "looking_for",
        ]),
      })
    )
    .describe("Categorized queries by intent type"),
});

// ============================================================================
// Types
// ============================================================================

export interface SeedKeywordsResult {
  success: boolean;
  keywords: string[];
  reasoning?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  };
}

export interface SocialQueriesResult {
  success: boolean;
  queries: string[];
  categorizedQueries?: Array<{
    query: string;
    type: string;
  }>;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  };
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Generates seed keywords from workspace description and ICP.
 *
 * Uses AI to analyze the product/service and target audience,
 * then generates relevant search keywords that potential customers
 * would use when looking for solutions.
 *
 * @example
 * ```typescript
 * const result = await ctx.runAction(api.agent.tools.keywordGeneration.generateSeedKeywords, {
 *   description: "ReacherX helps founders find customers on social media",
 *   icp: ["Solo founders", "Startups", "Agencies"],
 *   maxKeywords: 10,
 * });
 * ```
 */
export const generateSeedKeywords = action({
  args: {
    description: v.string(),
    icp: v.array(v.string()),
    maxKeywords: v.optional(v.number()),
  },
  handler: async (_, args): Promise<SeedKeywordsResult> => {
    const startTime = Date.now();
    const maxKeywords = args.maxKeywords ?? 10;

    // Validate inputs
    if (!args.description || args.description.trim().length < 10) {
      return {
        success: false,
        keywords: [],
        error: "Description must be at least 10 characters",
      };
    }

    if (!args.icp || args.icp.length === 0) {
      return {
        success: false,
        keywords: [],
        error: "At least one ICP segment is required",
      };
    }

    try {
      const gateway = createGatewayProvider();

      const systemPrompt = `You are an expert at understanding customer acquisition and search behavior.
Your task is to generate seed keywords that potential customers would search for when looking for a solution like the one described.

Focus on:
- Pain points the target audience experiences
- Problems they're trying to solve
- Questions they might ask
- Industry-specific terminology
- Action-oriented search terms (e.g., "how to", "best way to", "tools for")

Do NOT include:
- Brand names
- Generic single words
- Keywords unrelated to customer acquisition intent`;

      const userPrompt = `Based on this product/service and target audience, generate ${maxKeywords} seed keywords for finding potential customers.

**Product/Service Description:**
${args.description}

**Target Audience (ICP):**
${args.icp.map((segment, i) => `${i + 1}. ${segment}`).join("\n")}

Generate keywords that these people would search when looking for a solution to their problems.`;

      logAIOperation("info", "Generating seed keywords", {
        operation: "generateSeedKeywords",
        model: DEFAULT_MODEL,
      });

      const { object, usage } = await generateObject({
        model: gateway(DEFAULT_MODEL),
        schema: seedKeywordsSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      });

      const durationMs = Date.now() - startTime;

      const tokenCounts = extractTokenCounts(usage);

      logAIOperation("info", "Seed keywords generated successfully", {
        operation: "generateSeedKeywords",
        model: DEFAULT_MODEL,
        inputTokens: tokenCounts.inputTokens,
        outputTokens: tokenCounts.outputTokens,
        durationMs,
      });

      // Deduplicate and normalize keywords
      const uniqueKeywords = [
        ...new Set(
          object.keywords.map((kw) => kw.toLowerCase().trim()).filter(Boolean)
        ),
      ];

      // Log generated keywords for debugging
      console.log("[AI] Generated seed keywords:", {
        count: uniqueKeywords.length,
        keywords: uniqueKeywords,
        reasoning: object.reasoning,
      });

      return {
        success: true,
        keywords: uniqueKeywords,
        reasoning: object.reasoning,
        usage: {
          inputTokens: tokenCounts.inputTokens,
          outputTokens: tokenCounts.outputTokens,
          durationMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logAIOperation("error", "Failed to generate seed keywords", {
        operation: "generateSeedKeywords",
        model: DEFAULT_MODEL,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        keywords: [],
        error: `Failed to generate keywords: ${errorMessage}`,
      };
    }
  },
});

/**
 * Converts discovered keywords into social media search queries.
 *
 * Takes keywords with search data and generates natural language queries
 * that people would actually post on Twitter/LinkedIn when experiencing
 * the problems these keywords represent.
 *
 * @example
 * ```typescript
 * const result = await ctx.runAction(api.agent.tools.keywordGeneration.generateSocialQueries, {
 *   keywords: ["customer acquisition", "lead generation", "cold outreach"],
 *   description: "Tool for finding customers on social media",
 *   maxQueries: 20,
 * });
 * ```
 */
export const generateSocialQueries = action({
  args: {
    keywords: v.array(v.string()),
    description: v.string(),
    maxQueries: v.optional(v.number()),
  },
  handler: async (_, args): Promise<SocialQueriesResult> => {
    const startTime = Date.now();
    const maxQueries = args.maxQueries ?? 20;

    // Validate inputs
    if (!args.keywords || args.keywords.length === 0) {
      return {
        success: false,
        queries: [],
        error: "At least one keyword is required",
      };
    }

    try {
      const gateway = createGatewayProvider();

      const systemPrompt = `You are an expert at understanding how people express their problems on social media.
Your task is to generate search queries that would find posts from people experiencing problems related to the given keywords.

Focus on generating queries that match:
- Pain point expressions ("struggling with X", "frustrated by X")
- Questions ("how do I X?", "what's the best way to X?")
- Recommendation requests ("looking for X", "can anyone recommend X")
- Complaints ("X is so hard", "hate dealing with X")
- Looking for solutions ("need help with X", "trying to find X")

Make queries natural and varied - how real people actually write on social media.
Include both Twitter-style (short, casual) and LinkedIn-style (professional) queries.`;

      const userPrompt = `Generate ${maxQueries} social media search queries to find potential customers based on these keywords.

**Keywords:**
${args.keywords.slice(0, 20).join(", ")}

**Product or Service Context:**
${args.description}

Generate diverse queries covering different intents (questions, pain points, recommendations, etc.).
Make them sound natural - like how real people post on Twitter and LinkedIn.`;

      logAIOperation("info", "Generating social queries", {
        operation: "generateSocialQueries",
        model: DEFAULT_MODEL,
      });

      const { object, usage } = await generateObject({
        model: gateway(DEFAULT_MODEL),
        schema: socialQueriesSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.8,
      });

      const durationMs = Date.now() - startTime;

      const tokenCounts = extractTokenCounts(usage);

      logAIOperation("info", "Social queries generated successfully", {
        operation: "generateSocialQueries",
        model: DEFAULT_MODEL,
        inputTokens: tokenCounts.inputTokens,
        outputTokens: tokenCounts.outputTokens,
        durationMs,
      });

      // Deduplicate queries (case-insensitive)
      const seen = new Set<string>();
      const uniqueQueries: string[] = [];
      for (const query of object.queries) {
        const normalized = query.toLowerCase().trim();
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          uniqueQueries.push(query.trim());
        }
      }

      // Log generated social queries for debugging
      console.log("[AI] Generated social queries:", {
        count: uniqueQueries.length,
        queries: uniqueQueries,
        categorized: object.queryTypes?.slice(0, 5),
      });

      return {
        success: true,
        queries: uniqueQueries,
        categorizedQueries: object.queryTypes,
        usage: {
          inputTokens: tokenCounts.inputTokens,
          outputTokens: tokenCounts.outputTokens,
          durationMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logAIOperation("error", "Failed to generate social queries", {
        operation: "generateSocialQueries",
        model: DEFAULT_MODEL,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        queries: [],
        error: `Failed to generate queries: ${errorMessage}`,
      };
    }
  },
});

/**
 * Simple text generation for agent responses.
 *
 * Used for generating conversational responses during the agent flow.
 */
export const generateAgentResponse = action({
  args: {
    systemPrompt: v.string(),
    userPrompt: v.string(),
    temperature: v.optional(v.number()),
  },
  handler: async (_, args): Promise<{
    success: boolean;
    text: string;
    error?: string;
  }> => {
    const startTime = Date.now();

    try {
      const gateway = createGatewayProvider();

      logAIOperation("info", "Generating agent response", {
        operation: "generateAgentResponse",
        model: DEFAULT_MODEL,
      });

      const { text, usage } = await generateText({
        model: gateway(DEFAULT_MODEL),
        system: args.systemPrompt,
        prompt: args.userPrompt,
        temperature: args.temperature ?? 0.7,
      });

      const tokenCounts = extractTokenCounts(usage);

      logAIOperation("info", "Agent response generated", {
        operation: "generateAgentResponse",
        model: DEFAULT_MODEL,
        inputTokens: tokenCounts.inputTokens,
        outputTokens: tokenCounts.outputTokens,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        text,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logAIOperation("error", "Failed to generate agent response", {
        operation: "generateAgentResponse",
        model: DEFAULT_MODEL,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        text: "",
        error: errorMessage,
      };
    }
  },
});

