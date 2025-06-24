import { v } from "convex/values";
import { action } from "./_generated/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createLLMModel } from "./lib/llmConfig";

// =============================================================================
// KEYWORD GENERATION SYSTEM
// =============================================================================
/**
 * USAGE:
 *
 * This action generates targeted keywords based on user descriptions
 * using Grok (preferred) or GPT-4 (fallback) for optimal Twitter/X understanding.
 *
 * Key features:
 * - Uses Grok (grok-3-latest) for Twitter-optimized generation when available
 * - Falls back to GPT-4 if Grok is unavailable or misconfigured
 * - Generates 5 high-quality keywords
 * - Follows established logging and error handling patterns
 * - Returns structured data compatible with frontend KeywordItem interface
 */

// Import shared validation and request utilities
import { validateDescriptionForKeywords } from "../shared/lib/utils/validation";
import { generateRequestId } from "../shared/lib/utils/request";

// Enhanced schema for keyword generation results
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
        })
      )
      .length(5)
      .describe("Array of 5 optimized keywords for lead generation"),
  })
  .describe("Keyword generation results for lead qualification");

export const generateKeywords = action({
  args: {
    userDescription: v.string(),
  },
  handler: async (ctx, { userDescription }) => {
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

      // Enhanced prompt for Grok3 optimized for Twitter lead generation
      const prompt = `You are an expert Twitter lead generation specialist for ReacherX, a platform that helps businesses find potential customers on social media.

User's Business Description:
"${userDescription}"

Your task: Generate exactly 5 powerful keywords/phrases that will help this user find potential customers expressing buying intent on Twitter/X.

Focus on keywords that capture:
• People expressing pain points or problems
• Users seeking solutions, recommendations, or comparisons  
• Mentions of budget, pricing, or investment considerations
• Urgency indicators ("need ASAP", deadlines, time-sensitive needs)
• Decision-making context (requirements gathering, vendor research)
• Emotional language that amplifies the need

Guidelines:
1. Keywords should be 2-6 words long for optimal search effectiveness
2. Mix different intent types (pain points, solution seeking, comparisons, etc.)
3. Include both direct and indirect ways people express needs
4. Consider industry-specific terminology and casual language
5. Prioritize phrases that indicate immediate action or decision-making

For each keyword, provide:
- The exact keyword/phrase to search for
- Brief rationale explaining the targeting strategy
- Search intent category
- Confidence score based on lead generation potential

Output ONLY valid JSON matching the schema (no additional text):

{
  "keywords": [
    {
      "keyword": "string",
      "rationale": "string", 
      "searchIntent": "pain_point|solution_seeking|comparison|urgent_need|budget_indication",
      "confidence": 0.0-1.0
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

      // Validate keyword quality
      if (keywords.length !== 5) {
        console.error(`[KEYWORD_GEN] ${requestId} - Incorrect keyword count:`, {
          expected: 5,
          received: keywords.length,
          modelUsed: modelConfig.modelName,
        });
        throw new Error(
          `Expected exactly 5 keywords from ${modelConfig.modelName}`
        );
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
        },
      }));

      const endTime = Date.now();
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
