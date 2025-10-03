// convex/llmFilterChunked.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateObject } from "ai";
import { z } from "zod";
import { createLLMModel } from "./lib/llmConfig";
import { logger } from "../shared/lib/logger";
import { validateDescriptionForFiltering } from "../shared/lib/utils/validation";
import { generateRequestId } from "../shared/lib/utils/request";
import { createPromptSection } from "../shared/lib/utils/prompt";

/**
 * CHUNKED LLM FILTERING
 *
 * Filters a small chunk of tweets (max 5) for parallel processing
 * This enables showing results as soon as the first chunk resolves
 */

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

const LLMFilterChunkSchema = z
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
      .describe("Array of tweet scoring results for this chunk"),
  })
  .describe("LLM filtering results for a single chunk");

export const filterTweetChunk = action({
  args: {
    tweets: v.any(), // Array of tweets in the chunk
    chunkIndex: v.number(),
    originalQuery: v.string(),
    userDescription: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { tweets, chunkIndex, originalQuery, userDescription }
  ) => {
    const startTime = Date.now();
    const requestId = generateRequestId(`chunk_${chunkIndex}`);

    logger.info(`[CHUNK_FILTER] Starting chunk ${chunkIndex} - ${requestId}`, {
      chunkIndex,
      tweetCount: tweets.tweets?.length || 0,
      hasDescription: !!userDescription,
    });

    try {
      // Validate user description
      const descriptionValidation =
        validateDescriptionForFiltering(userDescription);
      if (!userDescription || (userDescription?.trim().length || 0) < 64) {
        logger.warn(
          `[CHUNK_FILTER] ${requestId} - No description, returning unfiltered`
        );
        return {
          success: true,
          data: {
            tweets: tweets.tweets || [],
            chunkIndex,
            meta: {
              originalCount: tweets.tweets?.length || 0,
              filteredCount: tweets.tweets?.length || 0,
              processingTimeMs: Date.now() - startTime,
            },
          },
        };
      }

      if (!descriptionValidation.isValid) {
        throw new Error(`Invalid description: ${descriptionValidation.error}`);
      }

      // Validate tweets structure
      if (!tweets?.tweets || !Array.isArray(tweets.tweets)) {
        throw new Error("Invalid tweets data structure");
      }

      if (tweets.tweets.length === 0) {
        return {
          success: true,
          data: {
            tweets: [],
            chunkIndex,
            meta: {
              originalCount: 0,
              filteredCount: 0,
              processingTimeMs: Date.now() - startTime,
            },
          },
        };
      }

      // Prepare tweets for analysis
      const tweetsForAnalysis = tweets.tweets.map((tweet: ProcessedTweet) => ({
        id: tweet.id_str || tweet.id,
        text: tweet.text || "",
        user_bio: tweet.user?.description || "",
        handle: tweet.user?.screen_name || "",
        name: tweet.user?.name || "",
      }));

      // Generate prompt
      const prompt = `You are an expert potential customer finding AI agent for ReacherX. Evaluate tweets for usefulness as potential customers.

${createPromptSection("The keyword/phrase the user searched:", originalQuery)}
${createPromptSection("Description provided by user:", userDescription, "None provided")}

Below are tweets/posts/replies/quotes retrieved using the keyword, with user bio and handle.

For each tweet:
- Assign a usefulness score (0.0-1.0) as a potential opportunity to convert into a customer.
- Scoring guidelines:
  • 0.7-1.0 → Strong opportunity (highly useful)  
  • 0.4-0.69 → Moderate opportunity  
  • 0.0-0.39 → Noise / not useful

IMPORTANT:  
- Only include tweets if they score ≥ 0.4 (moderate or strong opportunity).  
- Exclude all tweets that score < 0.4 (do not include them in the output).  

Output ONLY a JSON object with a "results" array:

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

      // Get model config
      const modelConfig = createLLMModel("filtering");

      logger.info(`[CHUNK_FILTER] ${requestId} - Calling LLM:`, {
        chunkIndex,
        tweetCount: tweetsForAnalysis.length,
        model: modelConfig.modelName,
      });

      // Call LLM
      const llmStartTime = Date.now();
      const result = await generateObject({
        model: modelConfig.model,
        schema: LLMFilterChunkSchema,
        prompt: prompt,
        temperature: modelConfig.temperature,
      });
      const llmEndTime = Date.now();

      logger.info(`[CHUNK_FILTER] ${requestId} - LLM completed:`, {
        chunkIndex,
        processingTimeMs: llmEndTime - llmStartTime,
        resultCount: result.object?.results?.length || 0,
      });

      // Validate response
      if (!result.object?.results || !Array.isArray(result.object.results)) {
        throw new Error("LLM returned invalid response format");
      }

      // Process results
      const llmResults = result.object.results as Array<{
        id: string;
        score: number;
      }>;

      const SCORE_THRESHOLD = 0.4;
      const keptTweetIds = new Set(
        llmResults
          .filter(
            (item) =>
              typeof item.score === "number" && item.score >= SCORE_THRESHOLD
          )
          .map((item) => item.id)
      );

      // Filter original tweets
      const filteredTweets = tweets.tweets.filter((tweet: ProcessedTweet) =>
        keptTweetIds.has(tweet.id_str || tweet.id)
      );

      const endTime = Date.now();
      logger.info(`[CHUNK_FILTER] ${requestId} - Completed:`, {
        chunkIndex,
        originalCount: tweets.tweets.length,
        filteredCount: filteredTweets.length,
        totalTimeMs: endTime - startTime,
      });

      return {
        success: true,
        data: {
          tweets: filteredTweets,
          chunkIndex,
          meta: {
            originalCount: tweets.tweets.length,
            filteredCount: filteredTweets.length,
            llmProcessedCount: llmResults.length,
            processingTimeMs: endTime - startTime,
            llmProcessingTimeMs: llmEndTime - llmStartTime,
            requestId,
          },
        },
      };
    } catch (error) {
      const endTime = Date.now();
      logger.error(`[CHUNK_FILTER] ${requestId} - Failed:`, {
        chunkIndex,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: endTime - startTime,
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Chunk filtering failed",
        data: {
          tweets: tweets.tweets || [],
          chunkIndex,
          meta: {
            originalCount: tweets.tweets?.length || 0,
            filteredCount: tweets.tweets?.length || 0,
            processingTimeMs: endTime - startTime,
            fallbackUsed: true,
          },
        },
      };
    }
  },
});
