// convex/llmFilter.ts
import { action } from "./_generated/server";
import { filterTweetsWithLLMArgsValidator } from "./validators";
import { generateObject } from "ai";
import { z } from "zod";
import { createLLMModel } from "./lib/llmConfig";
import { logger } from "../shared/lib/logger";

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

// Import shared validation and request utilities
import { validateDescriptionForFiltering } from "../shared/lib/utils/validation";
import { generateRequestId } from "../shared/lib/utils/request";
import { createPromptSection } from "../shared/lib/utils/prompt";
import { LLM_FILTER_THRESHOLD } from "./lib/llmFilterConfig";

export const filterTweetsWithLLM = action({
  args: filterTweetsWithLLMArgsValidator,
  handler: async (ctx, { tweets, originalQuery, userDescription }) => {
    const startTime = Date.now();
    const requestId = generateRequestId("llm_filter");

    logger.info(`[LLM_FILTER] Starting request ${requestId}`, {
      originalQuery,
      hasDescription: !!userDescription,
      descriptionLength: userDescription?.length || 0,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate user description with comprehensive logging
      const descriptionValidation =
        validateDescriptionForFiltering(userDescription);
      // Enforce required description for filtering (64-512)
      if (!userDescription || (userDescription?.trim().length || 0) < 64) {
        logger.warn(
          `[LLM_FILTER] ${requestId} - Missing or too short description; returning empty filtered set to avoid raw output`
        );
        return {
          success: true,
          data: {
            ...tweets,
            tweets: [],
            meta: {
              ...tweets.meta,
              originalCount: (tweets.tweets || []).length || 0,
              filteredCount: 0,
              filterSummary: undefined,
              processingTimeMs: Date.now() - startTime,
            },
          },
        };
      }
      if (!descriptionValidation.isValid) {
        logger.error(
          `[LLM_FILTER] ${requestId} - Description validation failed:`,
          {
            error: descriptionValidation.error,
            providedDescription: userDescription?.substring(0, 100) + "...",
          }
        );
        throw new Error(`Invalid description: ${descriptionValidation.error}`);
      }

      logger.info(`[LLM_FILTER] ${requestId} - Description validation passed`, {
        descriptionLength: userDescription?.length || 0,
        hasDescription: !!userDescription,
      });

      // Validate tweets data structure
      if (!tweets?.tweets || !Array.isArray(tweets.tweets)) {
        logger.error(
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
        logger.info(
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

      logger.info(
        `[LLM_FILTER] ${requestId} - Processing ${tweets.tweets.length} tweets`,
        {
          totalTweets: tweets.tweets.length,
          willProcessFirst: Math.min(tweets.tweets.length, 20),
        }
      );

      // AI SDK dependencies are now statically imported for better performance
      logger.info(
        `[LLM_FILTER] ${requestId} - Using statically imported AI SDK dependencies`
      );

      // Enhanced schema for structured output (wrapped in object as required by generateObject)
      const LLMFilterResultSchema = z
        .object({
          results: z
            .array(
              z.object({
                id: z.string().describe("Tweet ID"),
                score: z
                  .number()
                  .min(0)
                  .max(1)
                  .describe("Usefulness score from 0.0 to 1.0"),
              })
            )
            .describe("Array of tweet scoring results"),
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

      logger.info(`[LLM_FILTER] ${requestId} - Prepared tweets for analysis:`, {
        count: tweetsForAnalysis.length,
        firstTweetPreview: {
          id: tweetsForAnalysis[0]?.id,
          textLength: tweetsForAnalysis[0]?.text?.length || 0,
          hasBio: !!tweetsForAnalysis[0]?.user_bio,
          handle: tweetsForAnalysis[0]?.handle,
        },
      });

      // Use the updated prompt and output schema
      const prompt = `You are an expert potential customer finding AI agent for ReacherX, a platform that helps anyone find potential customers on social media. Your role is to evaluate tweets/posts/replies/quotes for usefulness as potential customers for the user's product/service/skill (described below).

${createPromptSection("The keyword/phrase the user searched:", originalQuery)}
${createPromptSection("Description provided by user:", userDescription, "None provided")}

Below are tweets/posts/replies/quotes that are retrieved using the keyword/phrase the user searched, along with the user's bio and handle.

For each tweet:
- Assign a usefulness score (0.0-1.0) as a potential opportunity to convert into a customer.
- Use a mental 0-10 scale, then normalize to 0.0-1.0.
- Scoring guidelines:
  • 0.8-1.0 → Strong opportunity (highly useful)  
  • 0.6-0.79 → Moderate opportunity (may need follow-up)  
  • 0.0-0.59 → Noise / not useful

Important:  
- Only include tweets if they score ≥ 0.6 (moderate or strong opportunity).  
- Exclude all tweets that score < 0.6 (do not include them in the output).  

Output ONLY a JSON object with a "results" array containing included tweets/posts/replies/quotes scored. No extra prose:

{
  "results": [
    {
      "id": "string",
      "score": 0.0-1.0
    }
  ]
}

(If no tweets qualify, return: "results": [])

Tweets to classify:
${JSON.stringify(tweetsForAnalysis, null, 2)}`;

      // Get the model configuration using centralized system
      const modelConfig = createLLMModel("filtering");

      logger.info(`[LLM_FILTER] ${requestId} - Calling LLM with prompt:`, {
        promptLength: prompt.length,
        model: modelConfig.modelName,
        temperature: modelConfig.temperature,
        description: modelConfig.description,
        tweetsCount: tweetsForAnalysis.length,
        usedFallback: modelConfig.usedFallback,
        configSource: modelConfig.configSource,
      });

      // Call LLM with structured output
      const llmStartTime = Date.now();
      const result = await generateObject({
        model: modelConfig.model,
        schema: LLMFilterResultSchema,
        prompt: prompt,
        temperature: modelConfig.temperature,
      });
      const llmEndTime = Date.now();

      // Type assertion for AI SDK 5.0 compatibility
      const object = result.object as z.infer<typeof LLMFilterResultSchema>;

      logger.info(`[LLM_FILTER] ${requestId} - LLM call completed:`, {
        processingTimeMs: llmEndTime - llmStartTime,
        resultCount: object.results?.length || 0,
        usage: result.usage,
      });

      // Validate LLM response
      if (!object.results || !Array.isArray(object.results)) {
        logger.error(
          `[LLM_FILTER] ${requestId} - Invalid LLM response format:`,
          {
            responseType: typeof object,
            hasResults: !!object.results,
            resultsType: typeof object.results,
            isArray: Array.isArray(object.results),
            response: object,
          }
        );
        throw new Error(
          "LLM returned invalid response format - expected object with results array"
        );
      }

      // Process LLM results with comprehensive logging
      const llmResults = object.results;

      const SCORE_THRESHOLD = LLM_FILTER_THRESHOLD;
      const keptTweetIds = new Set(
        llmResults
          .filter(
            (item) =>
              typeof item.score === "number" && item.score >= SCORE_THRESHOLD
          )
          .map((item) => item.id)
      );

      logger.info(`[LLM_FILTER] ${requestId} - LLM filtering results:`, {
        totalAnalyzed: llmResults.length,
        keptCount: keptTweetIds.size,
        filteredOutCount: llmResults.length - keptTweetIds.size,
        keepRate:
          ((keptTweetIds.size / llmResults.length) * 100).toFixed(1) + "%",
        threshold: SCORE_THRESHOLD,
        sample: llmResults
          .slice(0, 3)
          .map((r) => ({ id: r.id, score: r.score })),
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
          filterSummary: `Kept ${keptTweetIds.size} out of ${llmResults.length} analyzed tweets (≥ ${SCORE_THRESHOLD})`,
          processingTimeMs: Date.now() - startTime,
          llmProcessingTimeMs: llmEndTime - llmStartTime,
          requestId,
        },
      };

      const endTime = Date.now();
      logger.info(
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
      logger.error(`[LLM_FILTER] ${requestId} - Request failed:`, {
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
