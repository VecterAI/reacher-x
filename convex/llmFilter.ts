// convex/llmFilter.ts
import { action } from "./_generated/server";
import { filterTweetsWithLLMArgsValidator } from "./validators";
import { generateObject } from "ai";
import { z } from "zod";
import { createLLMModel } from "./lib/llmConfig";

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

export const filterTweetsWithLLM = action({
  args: filterTweetsWithLLMArgsValidator,
  handler: async (ctx, { tweets, originalQuery, userDescription }) => {
    const startTime = Date.now();
    const requestId = generateRequestId("llm_filter");

    console.log(`[LLM_FILTER] Starting request ${requestId}`, {
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
        console.warn(
          `[LLM_FILTER] ${requestId} - Missing or too short description; returning unfiltered tweets`
        );
        return {
          success: true,
          data: {
            ...tweets,
            meta: {
              ...tweets.meta,
              originalCount: tweets.tweets.length || 0,
              filteredCount: tweets.tweets.length || 0,
              filterSummary: undefined,
              processingTimeMs: Date.now() - startTime,
            },
          },
        };
      }
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

      // Enhanced schema for structured output (wrapped in object as required by generateObject)
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

${createPromptSection("Search query", originalQuery)}
${createPromptSection("Description", userDescription, "None provided")}

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

      // Get the model configuration using centralized system
      const modelConfig = createLLMModel("filtering");

      console.log(`[LLM_FILTER] ${requestId} - Calling LLM with prompt:`, {
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
      const llmResults: Array<{
        id: string;
        keep: boolean;
        confidence: number;
        reason: string;
      }> = result.object.results as Array<{
        id: string;
        keep: boolean;
        confidence: number;
        reason: string;
      }>;

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
