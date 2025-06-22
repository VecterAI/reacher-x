// convex/llmFilter.ts
import { v } from "convex/values";
import { action } from "./_generated/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// =============================================================================
// LLM CONFIGURATION SYSTEM
// =============================================================================
/**
 * USAGE:
 *
 * 1. To switch models, set the LLM_MODEL environment variable:
 *    - LLM_MODEL=gpt-4o (for production/high-quality)
 *    - LLM_MODEL=gpt-4o-mini (for development/cost-effective - default)
 *    - LLM_MODEL=gpt-3.5-turbo (for speed/economy)
 *
 * 2. To add a new model:
 *    - Add it to LLM_CONFIGS object
 *    - Set appropriate temperature and description
 *    - Deploy and use via environment variable
 *
 * 3. All model references are now centralized - no more duplicated model names!
 */

interface LLMConfig {
  modelName: string;
  temperature: number;
  maxTokens?: number;
  description: string;
}

/**
 * Centralized LLM model configurations
 * Add new models here and they'll be available throughout the system
 */
const LLM_CONFIGS = {
  "gpt-4o-mini": {
    modelName: "gpt-4o-mini",
    temperature: 0.3,
    description: "OpenAI GPT-4o Mini - Fast and cost-effective",
  },
  "gpt-4o": {
    modelName: "gpt-4o",
    temperature: 0.3,
    description: "OpenAI GPT-4o - Most capable model",
  },
  "gpt-4-turbo": {
    modelName: "gpt-4-turbo",
    temperature: 0.3,
    description: "OpenAI GPT-4 Turbo - Balanced performance",
  },
  "gpt-3.5-turbo": {
    modelName: "gpt-3.5-turbo",
    temperature: 0.3,
    description: "OpenAI GPT-3.5 Turbo - Fast and economical",
  },
} as const;

type LLMModelType = keyof typeof LLM_CONFIGS;

/**
 * Get the current LLM configuration based on environment variable
 * Fallback to gpt-4o-mini if not specified or invalid
 */
const getCurrentLLMConfig = (): LLMConfig => {
  const envModel = process.env.LLM_MODEL as LLMModelType;
  const defaultModel: LLMModelType = "gpt-4o";

  if (envModel && envModel in LLM_CONFIGS) {
    return LLM_CONFIGS[envModel];
  }

  if (envModel) {
    console.warn(
      `[LLM_CONFIG] Unknown model "${envModel}", falling back to ${defaultModel}`
    );
  }

  return LLM_CONFIGS[defaultModel];
};

/**
 * Create the OpenAI model instance using current configuration
 */
const createLLMModel = () => {
  const config = getCurrentLLMConfig();
  return openai(config.modelName);
};

// Current configuration (computed once per module load)
const LLM_CONFIG = getCurrentLLMConfig();

// Log the active configuration for debugging
console.log(
  `[LLM_CONFIG] Active model: ${LLM_CONFIG.modelName} (${LLM_CONFIG.description})`
);

// =============================================================================
// EXISTING CODE (with model references updated)
// =============================================================================

// Enhanced Tweet interface for better type safety
interface ProcessedTweet {
  id: string;
  id_str: string;
  text: string | null;
  user?: {
    name?: string;
    screen_name?: string;
    description?: string;
  };
}

// Validation schema for user description (matching frontend validation)
const DESCRIPTION_MIN_LENGTH = 64;
const DESCRIPTION_MAX_LENGTH = 512;

function validateDescription(description: string | undefined): {
  isValid: boolean;
  error?: string;
} {
  if (!description) {
    return { isValid: true }; // Description is optional
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

export const filterTweetsWithLLM = action({
  args: {
    tweets: v.any(),
    originalQuery: v.string(),
    userDescription: v.optional(v.string()),
  },
  handler: async (ctx, { tweets, originalQuery, userDescription }) => {
    const startTime = Date.now();
    const requestId = `llm_filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[LLM_FILTER] Starting request ${requestId}`, {
      originalQuery,
      hasDescription: !!userDescription,
      descriptionLength: userDescription?.length || 0,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate user description with comprehensive logging
      const descriptionValidation = validateDescription(userDescription);
      if (!descriptionValidation.isValid) {
        console.error(
          `[LLM_FILTER] ${requestId} - Description validation failed:`,
          {
            error: descriptionValidation.error,
            providedDescription: userDescription?.substring(0, 100) + "...",
          }
        );
        throw new Error(`Invalid description: ${descriptionValidation.error}`);
      }

      console.log(`[LLM_FILTER] ${requestId} - Description validation passed`, {
        descriptionLength: userDescription?.length || 0,
        hasDescription: !!userDescription,
      });

      // Validate tweets data structure
      if (!tweets?.tweets || !Array.isArray(tweets.tweets)) {
        console.error(
          `[LLM_FILTER] ${requestId} - Invalid tweets data structure:`,
          {
            hasTweets: !!tweets,
            hasTweetsArray: !!tweets?.tweets,
            isArray: Array.isArray(tweets?.tweets),
            tweetsType: typeof tweets?.tweets,
          }
        );
        throw new Error(
          "Invalid tweets data structure - expected array of tweets"
        );
      }

      if (tweets.tweets.length === 0) {
        console.log(
          `[LLM_FILTER] ${requestId} - No tweets to filter, returning empty result`
        );
        return {
          success: true,
          data: {
            ...tweets,
            meta: {
              ...tweets.meta,
              originalCount: 0,
              filteredCount: 0,
              filterSummary: "No tweets to filter",
              processingTimeMs: Date.now() - startTime,
            },
          },
        };
      }

      console.log(
        `[LLM_FILTER] ${requestId} - Processing ${tweets.tweets.length} tweets`,
        {
          totalTweets: tweets.tweets.length,
          willProcessFirst: Math.min(tweets.tweets.length, 20),
        }
      );

      // AI SDK dependencies are now statically imported for better performance
      console.log(
        `[LLM_FILTER] ${requestId} - Using statically imported AI SDK dependencies`
      );

      // Define the enhanced schema for structured output (wrapped in object as required by generateObject)
      const LLMFilterResultSchema = z
        .object({
          results: z
            .array(
              z.object({
                id: z.string().describe("Tweet ID"),
                keep: z
                  .boolean()
                  .describe(
                    "True if tweet represents a genuine business opportunity"
                  ),
                confidence: z
                  .number()
                  .min(0)
                  .max(1)
                  .describe("Confidence score from 0.0 to 1.0"),
                reason: z
                  .string()
                  .max(100)
                  .describe("Brief rationale for the decision (max 100 chars)"),
              })
            )
            .describe("Array of tweet analysis results"),
        })
        .describe("LLM filtering results for lead qualification");

      // Prepare tweets for LLM analysis with enhanced data extraction
      const tweetsForAnalysis = tweets.tweets
        .slice(0, 20) // Process first 20 to manage token limits
        .map((tweet: ProcessedTweet) => ({
          id: tweet.id_str || tweet.id,
          text: tweet.text || "",
          user_bio: tweet.user?.description || "",
          handle: tweet.user?.screen_name || "",
          name: tweet.user?.name || "",
        }));

      console.log(`[LLM_FILTER] ${requestId} - Prepared tweets for analysis:`, {
        count: tweetsForAnalysis.length,
        firstTweetPreview: {
          id: tweetsForAnalysis[0]?.id,
          textLength: tweetsForAnalysis[0]?.text?.length || 0,
          hasBio: !!tweetsForAnalysis[0]?.user_bio,
          handle: tweetsForAnalysis[0]?.handle,
        },
      });

      // Use the exact prompt provided by the user
      const prompt = `You are an expert lead-qualification specialist powering ReacherX, a universal search engine that finds high-value sales prospects on platforms like Twitter, LinkedIn, Threads, Bluesky, and Reddit.

Search query: "${originalQuery}"
Description: "${userDescription || "None provided"}"

Below is a list of tweets matching that query, along with the user's bio and handle.

For each tweet, decide whether it represents a genuine new business opportunity for the described person or organization. Base your judgment on:
• Explicit problems or pain points  
• Questions revealing buying intent (recommendations, comparisons)  
• Mentions of budget, pricing, or investment considerations  
• Urgency cues ("need ASAP," deadlines, time-sensitive)  
• Decision-making context (requirements, vendor research)  
• Emotional language that amplifies the need  

Additionally, consider the user's bio and handle:
• If the bio indicates a relevant professional role (e.g., "CEO," "project manager") or interest (e.g., "looking for tools"), increase the confidence score.
• If the handle includes keywords related to the industry (e.g., "PMtools"), that can also be a positive signal.

Filter out tweets that are purely promotional, generic informational (articles, tutorials without personal need), chatty/conversational, or spammy/bot-like.

Output ONLY a JSON object with a "results" array (no extra prose):

{
  "results": [
    {
      "id": string,       // tweet ID
      "keep": boolean,    // true = worth showing the user
      "confidence": number,  // 0.0–1.0 strength of buying signal
      "reason": string    // brief rationale (max 100 chars), mention if profile influenced decision
    },
    …
  ]
}

Tweets to classify:
${JSON.stringify(tweetsForAnalysis, null, 2)}`;

      console.log(`[LLM_FILTER] ${requestId} - Calling LLM with prompt:`, {
        promptLength: prompt.length,
        model: LLM_CONFIG.modelName,
        temperature: LLM_CONFIG.temperature,
        description: LLM_CONFIG.description,
        tweetsCount: tweetsForAnalysis.length,
      });

      // Call LLM with structured output
      const llmStartTime = Date.now();
      const result = await generateObject({
        model: createLLMModel(),
        schema: LLMFilterResultSchema,
        prompt: prompt,
        temperature: LLM_CONFIG.temperature,
      });
      const llmEndTime = Date.now();

      console.log(`[LLM_FILTER] ${requestId} - LLM call completed:`, {
        processingTimeMs: llmEndTime - llmStartTime,
        resultCount: result.object?.results?.length || 0,
        usage: result.usage,
      });

      // Validate LLM response
      if (!result.object?.results || !Array.isArray(result.object.results)) {
        console.error(
          `[LLM_FILTER] ${requestId} - Invalid LLM response format:`,
          {
            responseType: typeof result.object,
            hasResults: !!result.object?.results,
            resultsType: typeof result.object?.results,
            isArray: Array.isArray(result.object?.results),
            response: result.object,
          }
        );
        throw new Error(
          "LLM returned invalid response format - expected object with results array"
        );
      }

      // Process LLM results with comprehensive logging
      const llmResults = result.object.results;
      const keptTweetIds = new Set(
        llmResults.filter((item) => item.keep).map((item) => item.id)
      );

      const confidenceStats = {
        min: Math.min(...llmResults.map((r) => r.confidence)),
        max: Math.max(...llmResults.map((r) => r.confidence)),
        avg:
          llmResults.reduce((sum, r) => sum + r.confidence, 0) /
          llmResults.length,
      };

      console.log(`[LLM_FILTER] ${requestId} - LLM filtering results:`, {
        totalAnalyzed: llmResults.length,
        keptCount: keptTweetIds.size,
        filteredOutCount: llmResults.length - keptTweetIds.size,
        keepRate:
          ((keptTweetIds.size / llmResults.length) * 100).toFixed(1) + "%",
        confidenceStats,
        reasonsSample: llmResults
          .slice(0, 3)
          .map((r) => ({ id: r.id, keep: r.keep, reason: r.reason })),
      });

      // Filter original tweets based on LLM decisions
      const filteredTweets = tweets.tweets.filter((tweet: ProcessedTweet) =>
        keptTweetIds.has(tweet.id_str || tweet.id)
      );

      // Create enhanced metadata
      const filteredResults = {
        ...tweets,
        tweets: filteredTweets,
        meta: {
          ...tweets.meta,
          originalCount: tweets.tweets.length,
          filteredCount: filteredTweets.length,
          llmProcessedCount: llmResults.length,
          filterSummary: `Kept ${keptTweetIds.size} out of ${llmResults.length} analyzed tweets`,
          confidenceStats,
          processingTimeMs: Date.now() - startTime,
          llmProcessingTimeMs: llmEndTime - llmStartTime,
          requestId,
        },
      };

      const endTime = Date.now();
      console.log(
        `[LLM_FILTER] ${requestId} - Request completed successfully:`,
        {
          totalProcessingTimeMs: endTime - startTime,
          originalTweets: tweets.tweets.length,
          filteredTweets: filteredTweets.length,
          reductionPercentage:
            (
              ((tweets.tweets.length - filteredTweets.length) /
                tweets.tweets.length) *
              100
            ).toFixed(1) + "%",
        }
      );

      return {
        success: true,
        data: filteredResults,
        metadata: {
          requestId,
          processingTimeMs: endTime - startTime,
          llmProcessingTimeMs: llmEndTime - llmStartTime,
        },
      };
    } catch (error) {
      const endTime = Date.now();
      console.error(`[LLM_FILTER] ${requestId} - Request failed:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: endTime - startTime,
        originalQuery,
        hasDescription: !!userDescription,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "LLM filtering failed",
        data: tweets, // Return original tweets if filtering fails
        metadata: {
          requestId,
          processingTimeMs: endTime - startTime,
          fallbackUsed: true,
        },
      };
    }
  },
});
