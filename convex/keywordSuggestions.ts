import { query, internalMutation, mutation } from "./_generated/server";
import {
  getSuggestionsArgsValidator,
  markSuggestionAsUsedArgsValidator,
  storeSuggestionsArgsValidator,
} from "./validators";

export const getSuggestions = query({
  args: getSuggestionsArgsValidator,
  handler: async (ctx, { workspaceId, limit }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const suggestions = await ctx.db
      .query("keywordSuggestions")
      .withIndex("by_workspace_isUsed_generatedAt", (q) =>
        q.eq("workspaceId", workspaceId).eq("isUsed", false)
      )
      .order("desc")
      .take(limit ?? 5);

    return suggestions;
  },
});

export const storeSuggestions = internalMutation({
  args: storeSuggestionsArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();
    for (let i = 0; i < args.suggestions.length; i++) {
      const s = args.suggestions[i];
      await ctx.db.insert("keywordSuggestions", {
        userId: user._id,
        workspaceId: args.workspaceId,
        keyword: s.keyword.trim().toLowerCase(),
        isUsed: false,
        generatedAt: s.generatedAt ?? now + i,
        userDescription: args.userDescription,
        batchRequestId: args.batchRequestId,
        metadata: s.metadata,
      });
    }
  },
});

export const markSuggestionAsUsed = mutation({
  args: markSuggestionAsUsedArgsValidator,
  handler: async (ctx, { suggestionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion || suggestion.userId !== user._id) {
      throw new Error("Suggestion not found or not authorized");
    }

    if (!suggestion.isUsed) {
      await ctx.db.patch(suggestionId, { isUsed: true, usedAt: Date.now() });
    }

    return true;
  },
});

import { action } from "./_generated/server";
import { generateKeywordsArgsValidator } from "./validators";
import { generateObject } from "ai";
import { z } from "zod";
import { createLLMModel } from "./lib/llmConfig";
import { internal, api } from "./_generated/api";

// =============================================================================
// KEYWORD GENERATION SYSTEM
// =============================================================================
/**
 * USAGE:
 *
 * This action generates targeted keywords based on user descriptions
 * using Grok (preferred) or GPT-4o (fallback) for optimal Twitter/X understanding.
 *
 * Key features:
 * - Uses Grok (grok-4-fast) for Twitter-optimized generation when available
 * - Falls back to GPT-4o if Grok is unavailable or misconfigured
 * - Generates configurable number of high-quality keywords
 * - Follows established logging and error handling patterns
 * - Returns structured data compatible with frontend KeywordItem interface
 */

// Import shared validation and request utilities
import { validateDescriptionForKeywords } from "../shared/lib/utils/validation";
import { generateRequestId } from "../shared/lib/utils/request";

// Configuration constants
const KEYWORD_GENERATION_CONFIG = {
  TARGET_KEYWORD_COUNT: 15, // Generate 15 keywords at a time
} as const;

// Enhanced schema for keyword generation results (strict)
const KeywordGenerationSchema = z
  .object({
    keywords: z
      .array(
        z.object({
          keyword: z
            .string()
            .min(3)
            .max(100)
            .describe(
              "A search keyword or phrase optimized for finding potential customers"
            ),
          rationale: z
            .string()
            .max(200)
            .describe(
              "Brief explanation of why this keyword targets potential customers"
            ),
          searchIntent: z
            .enum([
              "pain_point",
              "solution_seeking",
              "comparison",
              "urgent_need",
              "budget_indication",
            ])
            .describe("The type of buying intent this keyword targets"),
          confidence: z
            .number()
            .min(0)
            .max(1)
            .describe(
              "Confidence score for keyword effectiveness (0.0 to 1.0)"
            ),
          exactMatch: z
            .boolean()
            .describe(
              "Whether this keyword should be searched as an exact phrase match"
            ),
        })
      )
      .length(KEYWORD_GENERATION_CONFIG.TARGET_KEYWORD_COUNT)
      .describe(
        `Array of ${KEYWORD_GENERATION_CONFIG.TARGET_KEYWORD_COUNT} optimized keywords for lead generation`
      ),
  })
  .describe("Keyword generation results for lead qualification");

export const generateKeywords = action({
  args: generateKeywordsArgsValidator,
  handler: async (ctx, { userDescription, workspaceId }) => {
    const startTime = Date.now();
    const requestId = generateRequestId("keyword_gen");

    console.log(`[KEYWORD_GEN] Starting request ${requestId}`, {
      userDescription: userDescription.substring(0, 100) + "...",
      descriptionLength: userDescription.length,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate user description with comprehensive logging
      const descriptionValidation =
        validateDescriptionForKeywords(userDescription);
      if (!descriptionValidation.isValid) {
        console.error(
          `[KEYWORD_GEN] ${requestId} - Description validation failed:`,
          {
            error: descriptionValidation.error,
            providedDescription: userDescription.substring(0, 100) + "...",
          }
        );
        throw new Error(`Invalid description: ${descriptionValidation.error}`);
      }

      console.log(
        `[KEYWORD_GEN] ${requestId} - Description validation passed`,
        {
          descriptionLength: userDescription.length,
        }
      );

      // Updated prompt with adjusted keyword length for platform constraints
      const prompt = `You are an expert potential customer finding AI agent for ReacherX, a platform that helps anyone find potential customers on social media. Your expertise lies in crafting search queries that surface genuine buyer intent while filtering out promotional noise from sellers, affiliates, and spammers.

The following is the description that the user has provided:
"${userDescription}"

Your task: Generate exactly ${KEYWORD_GENERATION_CONFIG.TARGET_KEYWORD_COUNT} precise, high-intent search queries (as keywords/phrases) that will help this user discover potential customers on Twitter/X who are actively expressing buying needs for the described product/service/skill. These queries should be designed to minimize results from sellers hijacking popular terms—focus on organic user language that reveals unmet needs. Queries will be shown to the user in batches of 5, so ensure diversity in phrasing, intent, and specificity across all ${KEYWORD_GENERATION_CONFIG.TARGET_KEYWORD_COUNT} items. Make sure you first test each keyword/phrase by searching it; if it really gives better results, only then add it so that it's battle-tested and proven

Core Focus: Target phrases capturing authentic buyer signals related to the user's offering, such as:
• Frustrations or pain points
• Active solution hunting
• Research and comparison queries
• Budget or readiness cues
• Time-sensitive or urgent appeals
• Emotional or casual expressions of need

Guidelines to Avoid Hijacked Keywords:
1. Craft 2-4 word phrases (keep concise for platform query limits) using question formats, complaints, or direct asks—avoid generic product names alone.
2. Incorporate buyer-oriented modifiers like "recommend", "help", "fix", "alternative to", "suggestions for" to steer toward seekers, not pitchers.
3. Build in natural exclusions via phrasing (e.g., imply non-commercial intent); suggest query tweaks like adding "-ad -sponsored -buy now" if relevant, but keep the core phrase clean.
4. Blend formal industry terms with everyday slang, typos, or abbreviations (e.g., "CRM recs" vs. "customer relationship management software").
5. Diversify across intent types.
6. Prioritize low-competition, high-conversion signals: queries likely from individuals or small teams, not marketers.

For each query, provide:
- The exact keyword/phrase to search for (Do not add quotes if exact match recommended)
- Brief rationale: How this targets buyers while dodging seller spam (1-2 sentences)
- Search intent category
- Confidence score (0.0-1.0): Based on buyer intent strength and low spam risk (aim for 0.7+)
- exactMatch: boolean (true if the keyword should be searched as an exact phrase match, false for loose matching)

Output ONLY valid JSON matching the schema (no additional text):

{
  "keywords": [
    {
      "keyword": "string",
      "rationale": "string", 
      "searchIntent": "pain_point|solution_seeking|comparison|urgent_need|budget_indication",
      "confidence": 0.0-1.0,
      "exactMatch": true
    }
  ]
}`;

      // Get the model configuration using centralized system
      const modelConfig = createLLMModel("keyword_generation");

      console.log(
        `[KEYWORD_GEN] ${requestId} - Calling LLM for keyword generation:`,
        {
          promptLength: prompt.length,
          model: modelConfig.modelName,
          temperature: modelConfig.temperature,
          usedFallback: modelConfig.usedFallback,
          configSource: modelConfig.configSource,
        }
      );

      // Call LLM with structured output
      const llmStartTime = Date.now();
      const result = await generateObject({
        model: modelConfig.model,
        schema: KeywordGenerationSchema,
        prompt: prompt,
        temperature: modelConfig.temperature,
      });
      const llmEndTime = Date.now();

      console.log(`[KEYWORD_GEN] ${requestId} - LLM call completed:`, {
        processingTimeMs: llmEndTime - llmStartTime,
        keywordCount: result.object?.keywords?.length || 0,
        modelUsed: modelConfig.modelName,
        usedFallback: modelConfig.usedFallback,
        usage: result.usage,
      });

      // Validate LLM response
      if (!result.object?.keywords || !Array.isArray(result.object.keywords)) {
        console.error(
          `[KEYWORD_GEN] ${requestId} - Invalid LLM response format:`,
          {
            responseType: typeof result.object,
            hasKeywords: !!result.object?.keywords,
            keywordsType: typeof result.object?.keywords,
            isArray: Array.isArray(result.object?.keywords),
            response: result.object,
            modelUsed: modelConfig.modelName,
          }
        );
        throw new Error(
          `${modelConfig.modelName} returned invalid response format - expected object with keywords array`
        );
      }

      const keywords = result.object.keywords;

      // Validate keyword quality (log-only if count mismatch; proceed with what we have)
      if (keywords.length !== KEYWORD_GENERATION_CONFIG.TARGET_KEYWORD_COUNT) {
        console.warn(`[KEYWORD_GEN] ${requestId} - Keyword count mismatch`, {
          expected: KEYWORD_GENERATION_CONFIG.TARGET_KEYWORD_COUNT,
          received: keywords.length,
          modelUsed: modelConfig.modelName,
        });
      }

      // Log keyword analysis for debugging
      const confidenceStats = {
        min: Math.min(...keywords.map((k) => k.confidence)),
        max: Math.max(...keywords.map((k) => k.confidence)),
        avg:
          keywords.reduce((sum, k) => sum + k.confidence, 0) / keywords.length,
      };

      const intentDistribution = keywords.reduce(
        (acc, k) => {
          acc[k.searchIntent] = (acc[k.searchIntent] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(`[KEYWORD_GEN] ${requestId} - Generated keywords analysis:`, {
        keywordCount: keywords.length,
        confidenceStats,
        intentDistribution,
        keywordSample: keywords.slice(0, 3).map((k) => ({
          keyword: k.keyword,
          intent: k.searchIntent,
          confidence: k.confidence,
        })),
      });

      // Transform to frontend-compatible format
      const frontendKeywords = keywords.map((kw, index) => ({
        id: `generated_${Date.now()}_${index}`,
        keyword: kw.keyword,
        timestamp: new Date().toISOString(),
        metadata: {
          rationale: kw.rationale,
          searchIntent: kw.searchIntent,
          confidence: kw.confidence,
          generatedAt: Date.now(),
          source: modelConfig.modelName,
          usedFallback: modelConfig.usedFallback,
          exactMatch: kw.exactMatch,
        },
      }));

      const endTime = Date.now();

      // Persist suggestions to Convex for authenticated users
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        let targetWorkspaceId = workspaceId ?? null;
        if (!targetWorkspaceId) {
          const defaultWorkspace = await ctx.runQuery(
            api.workspaces.getDefaultWorkspace,
            {}
          );
          if (defaultWorkspace) {
            targetWorkspaceId = defaultWorkspace._id;
          }
        }
        if (targetWorkspaceId) {
          const suggestionsPayload = frontendKeywords.map((k) => ({
            keyword: k.keyword,
            metadata: k.metadata,
          }));
          await ctx.runMutation(internal.keywordSuggestions.storeSuggestions, {
            workspaceId: targetWorkspaceId,
            userDescription,
            batchRequestId: requestId,
            suggestions: suggestionsPayload,
          });
        }
      }
      console.log(
        `[KEYWORD_GEN] ${requestId} - Request completed successfully:`,
        {
          totalProcessingTimeMs: endTime - startTime,
          llmProcessingTimeMs: llmEndTime - llmStartTime,
          finalKeywordCount: frontendKeywords.length,
          avgConfidence: confidenceStats.avg.toFixed(3),
          modelUsed: modelConfig.modelName,
          usedFallback: modelConfig.usedFallback,
        }
      );

      return {
        success: true,
        data: {
          keywords: frontendKeywords,
          metadata: {
            requestId,
            generatedAt: Date.now(),
            processingTimeMs: endTime - startTime,
            llmProcessingTimeMs: llmEndTime - llmStartTime,
            confidenceStats,
            intentDistribution,
            userDescriptionLength: userDescription.length,
            modelUsed: modelConfig.modelName,
            usedFallback: modelConfig.usedFallback,
          },
        },
      };
    } catch (error) {
      const endTime = Date.now();
      console.error(`[KEYWORD_GEN] ${requestId} - Request failed:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: endTime - startTime,
        userDescriptionLength: userDescription.length,
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Keyword generation failed",
        data: null,
        metadata: {
          requestId,
          processingTimeMs: endTime - startTime,
          fallbackUsed: true,
        },
      };
    }
  },
});
