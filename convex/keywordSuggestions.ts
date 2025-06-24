import { v } from "convex/values";
import { action } from "./_generated/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

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

// Validation schema for user description (matching frontend validation)
const DESCRIPTION_MIN_LENGTH = 64;
const DESCRIPTION_MAX_LENGTH = 512;

function validateDescription(description: string | undefined): {
  isValid: boolean;
  error?: string;
} {
  if (!description) {
    return {
      isValid: false,
      error: "Description is required for keyword generation",
    };
  }

  if (typeof description !== "string") {
    return { isValid: false, error: "Description must be a string" };
  }

  if (description.length < DESCRIPTION_MIN_LENGTH) {
    return {
      isValid: false,
      error: `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters`,
    };
  }

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Description must not exceed ${DESCRIPTION_MAX_LENGTH} characters`,
    };
  }

  return { isValid: true };
}

/**
 * Create Grok model instance for keyword generation
 * Uses xAI's API for optimal Twitter understanding
 * Falls back to GPT-4 if Grok is unavailable
 */
const createKeywordGenerationModel = () => {
  // First, try Grok if XAI API key is available
  if (process.env.XAI_API_KEY) {
    try {
      console.log("[KEYWORD_GEN] Attempting to use Grok model");
      const grokClient = createOpenAI({
        baseURL: "https://api.x.ai/v1",
        apiKey: process.env.XAI_API_KEY,
      });

      // Use grok-3-latest as the model name (this is the correct name according to xAI docs)
      return {
        model: grokClient("grok-3-latest"),
        modelName: "grok-3-latest",
        temperature: 0.7,
        fallback: false,
      };
    } catch (error) {
      console.warn(
        "[KEYWORD_GEN] Failed to create Grok client, falling back to GPT-4:",
        error
      );
    }
  } else {
    console.warn(
      "[KEYWORD_GEN] XAI_API_KEY not configured, using GPT-4 fallback"
    );
  }

  // Fallback to GPT-4
  console.log("[KEYWORD_GEN] Using GPT-4 as fallback for keyword generation");
  return {
    model: openai("gpt-4o"),
    modelName: "gpt-4o",
    temperature: 0.7,
    fallback: true,
  };
};

/**
 * Validate XAI API key configuration
 * This helps debug authentication issues
 */
function validateXaiConfig(): {
  hasApiKey: boolean;
  keyPreview?: string;
  suggestions: string[];
} {
  const apiKey = process.env.XAI_API_KEY;
  const hasApiKey = !!apiKey;

  const suggestions = [];

  if (!hasApiKey) {
    suggestions.push("Add XAI_API_KEY to your Convex environment variables");
    suggestions.push("Get your API key from https://console.x.ai/");
  } else {
    // Show first 8 and last 4 characters for debugging
    const keyPreview = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
    suggestions.push(
      "API key found - if you're getting Forbidden errors, verify the key is valid"
    );
    suggestions.push("Check that your XAI account has sufficient credits");
    return { hasApiKey, keyPreview, suggestions };
  }

  return { hasApiKey, suggestions };
}

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
    const requestId = `keyword_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate XAI configuration for debugging
    const xaiConfig = validateXaiConfig();

    console.log(`[KEYWORD_GEN] Starting request ${requestId}`, {
      userDescription: userDescription.substring(0, 100) + "...",
      descriptionLength: userDescription.length,
      timestamp: new Date().toISOString(),
      xaiConfig: {
        hasApiKey: xaiConfig.hasApiKey,
        keyPreview: xaiConfig.keyPreview,
        suggestions: xaiConfig.suggestions,
      },
    });

    try {
      // Validate user description with comprehensive logging
      const descriptionValidation = validateDescription(userDescription);
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

      // Get the model configuration
      const modelConfig = createKeywordGenerationModel();

      console.log(
        `[KEYWORD_GEN] ${requestId} - Calling LLM for keyword generation:`,
        {
          promptLength: prompt.length,
          model: modelConfig.modelName,
          temperature: modelConfig.temperature,
          isGrokFallback: modelConfig.fallback,
          hasXaiApiKey: !!process.env.XAI_API_KEY,
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
        wasGrokFallback: modelConfig.fallback,
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
          usedFallback: modelConfig.fallback,
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
          usedFallback: modelConfig.fallback,
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
            usedFallback: modelConfig.fallback,
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
