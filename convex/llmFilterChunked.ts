// convex/llmFilterChunked.ts
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { generateObject } from "ai";
import { z } from "zod";
import { createLLMModel } from "./lib/llmConfig";
import { logger } from "../shared/lib/logger";
import { validateDescriptionForFiltering } from "../shared/lib/utils/validation";
import { generateRequestId } from "../shared/lib/utils/request";
import { createPromptSection } from "../shared/lib/utils/prompt";
import { LLM_FILTER_THRESHOLD } from "./lib/llmFilterConfig";
import { chunkTweets } from "../shared/lib/utils/chunkTweets";

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

      // Generate prompt (aligned with llmFilter.ts)
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
        prompt,
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

      const SCORE_THRESHOLD = LLM_FILTER_THRESHOLD;
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

export const processChunkServer = internalAction({
  args: {
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    chunkSetId: v.string(),
    chunkIndex: v.number(),
    tweets: v.any(),
    originalQuery: v.string(),
    userDescription: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      keywordKey,
      operation,
      chunkSetId,
      chunkIndex,
      tweets,
      originalQuery,
      userDescription,
    }
  ) => {
    const requestId = generateRequestId(`chunk_${chunkIndex}`);
    try {
      const descriptionValidation =
        validateDescriptionForFiltering(userDescription);
      if (!userDescription || (userDescription?.trim().length || 0) < 64) {
        await ctx.runMutation(api.searchChunks.recordChunkResult, {
          keywordKey,
          operation,
          chunkSetId,
          chunkIndex,
          tweets: [],
          originalCount: tweets.tweets?.length || 0,
          filteredCount: 0,
        });
        return;
      }
      if (!descriptionValidation.isValid) {
        throw new Error(`Invalid description: ${descriptionValidation.error}`);
      }
      if (!tweets?.tweets || !Array.isArray(tweets.tweets)) {
        throw new Error("Invalid tweets data structure");
      }

      const tweetsForAnalysis = (tweets.tweets || []).map(
        (tweet: ProcessedTweet) => ({
          id: tweet.id_str || tweet.id,
          text: tweet.text || "",
          user_bio: tweet.user?.description || "",
          handle: tweet.user?.screen_name || "",
          name: tweet.user?.name || "",
        })
      );
      const prompt = `You are an expert potential customer finding AI agent for ReacherX...\n${createPromptSection("The keyword/phrase the user searched:", originalQuery)}\n${createPromptSection("Description provided by user:", userDescription, "None provided")}\nTweets to classify:\n${JSON.stringify(tweetsForAnalysis, null, 2)}`;
      const modelConfig = createLLMModel("filtering");
      const LLMFilterChunkSchema = z.object({
        results: z.array(
          z.object({ id: z.string(), score: z.number().min(0).max(1) })
        ),
      });
      const result = await generateObject({
        model: modelConfig.model,
        schema: LLMFilterChunkSchema,
        prompt,
        temperature: modelConfig.temperature,
      });

      const SCORE_THRESHOLD = LLM_FILTER_THRESHOLD;
      const keptTweetIds = new Set(
        ((result.object?.results || []) as Array<{ id: string; score: number }>)
          .filter(
            (item) =>
              typeof item.score === "number" && item.score >= SCORE_THRESHOLD
          )
          .map((item) => item.id)
      );
      const filteredTweets = (tweets.tweets || []).filter(
        (tweet: ProcessedTweet) => keptTweetIds.has(tweet.id_str || tweet.id)
      );

      await ctx.runMutation(api.searchChunks.recordChunkResult, {
        keywordKey,
        operation,
        chunkSetId,
        chunkIndex,
        tweets: filteredTweets,
        originalCount: tweets.tweets?.length || 0,
        filteredCount: filteredTweets.length,
      });

      const status = await ctx.runQuery(api.searchChunks.getChunkSetStatus, {
        chunkSetId,
      });
      if (status && status.total > 0) {
        const value = 40 + Math.round((45 * status.resolved) / status.total);
        await ctx.runMutation(api.searchProgress.upsertProgress, {
          keywordKey,
          operation,
          phase: "filtering",
          value,
        });
      }
    } catch (error) {
      await ctx.runMutation(api.searchChunks.recordChunkResult, {
        keywordKey,
        operation,
        chunkSetId,
        chunkIndex,
        tweets: tweets.tweets || [],
        originalCount: tweets.tweets?.length || 0,
        filteredCount: 0,
      });
      logger.error(`[CHUNK_FILTER] ${requestId} failed`, {
        chunkIndex,
        error: error instanceof Error ? error.message : "Unknown",
      });
    }
  },
});

export const startServerChunking = action({
  args: {
    keywordKey: v.string(),
    operation: v.union(v.literal("initial"), v.literal("loadMore")),
    originalQuery: v.string(),
    userDescription: v.optional(v.string()),
    tweets: v.optional(v.any()),
    items: v.optional(v.any()),
    chunkSetId: v.string(),
    pollMs: v.optional(v.number()),
  },
  handler: async (
    ctx,
    {
      keywordKey,
      operation,
      originalQuery,
      userDescription,
      tweets,
      items,
      chunkSetId,
      pollMs,
    }
  ) => {
    const all = Array.isArray(items?.items)
      ? items.items
      : Array.isArray(tweets?.tweets)
        ? tweets.tweets
        : [];
    const chunks = chunkTweets(all, 5);
    if (chunks.length === 0) {
      return {
        success: true,
        data: { firstChunkTweets: [], firstChunkItems: [], chunkSetId },
      };
    }

    await ctx.runMutation(api.searchChunks.upsertChunkSet, {
      keywordKey,
      operation,
      chunkSetId,
      total: chunks.length,
    });
    await ctx.runMutation(api.searchProgress.upsertProgress, {
      keywordKey,
      operation,
      phase: "chunking",
      value: 40,
    });

    await Promise.all(
      chunks.map((chunk, index) =>
        ctx.scheduler.runAfter(
          0,
          internal.llmFilterChunked.processChunkServer,
          {
            keywordKey,
            operation,
            chunkSetId,
            chunkIndex: index,
            tweets: { tweets: chunk },
            originalQuery,
            userDescription,
          }
        )
      )
    );

    const deadline = Date.now() + (pollMs ?? 3000);
    let firstTweets: unknown[] = [];
    while (Date.now() < deadline) {
      const resolved = await ctx.runQuery(
        api.searchChunks.getResolvedTweetsForSet,
        {
          chunkSetId,
        }
      );
      if (resolved.count > 0) {
        firstTweets = resolved.tweets.slice(0, Math.min(resolved.count, 5));
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    // Final check in case resolved tweets arrived exactly at the deadline
    if (firstTweets.length === 0) {
      const resolvedFinal = await ctx.runQuery(
        api.searchChunks.getResolvedTweetsForSet,
        {
          chunkSetId,
        }
      );
      if (resolvedFinal.count > 0) {
        firstTweets = resolvedFinal.tweets.slice(
          0,
          Math.min(resolvedFinal.count, 5)
        );
      }
    }

    return {
      success: true,
      data: {
        firstChunkTweets: firstTweets,
        firstChunkItems: firstTweets,
        chunkSetId,
      },
    };
  },
});
