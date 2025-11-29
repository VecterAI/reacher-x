import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { rePromptKeywordsArgsValidator } from "./validators";
import { generateObject } from "ai";
import { z } from "zod";
import { createLLMModel } from "./lib/llmConfig";
import { logger } from "../shared/lib/logger";

// =============================================================================
// KEYWORD RE-PROMPT SYSTEM
// =============================================================================
/**
 * This action implements dynamic keyword re-prompting based on performance feedback.
 * When keywords cross performance thresholds, it generates improved suggestions.
 *
 * Key features:
 * - Analyzes keyword performance patterns
 * - Generates improved keyword suggestions based on successful/failed keywords
 * - Maintains context about user preferences through voting patterns
 * - Prevents keyword stagnation and improves over time
 *
 * References:
 * - Reinforcement Learning from Human Feedback (RLHF)
 * - Active Learning principles for keyword optimization
 * - Netflix's approach to content recommendation improvement
 * - Post-check: Only keep keywords that yield at least 1 Twitter/X result
 */

import { validateDescriptionForKeywords } from "../shared/lib/utils/validation";
import { generateRequestId } from "../shared/lib/utils/request";
import { createPromptSection } from "../shared/lib/utils/prompt";

// Configuration constants for re-prompt
const KEYWORD_REPROMPT_CONFIG = {
  TARGET_KEYWORD_COUNT: 10,
} as const;

// Local type to keep metadata augmentation type-safe during post-check
type RePromptKeywordItem = {
  id: string;
  keyword: string;
  timestamp: string;
  metadata: {
    generatedAt: number;
    source: string;
    isRePrompt: boolean;
    basedOnPerformance: boolean;
    exactMatch: boolean;
    validationModel: string;
    validatedAt?: number;
    resultCount?: number;
  };
};

// Simplified schema for re-prompt results (MVP)
const KeywordRePromptSchema = z
  .object({
    improvedKeywords: z
      .array(
        z.object({
          keyword: z
            .string()
            .min(1)
            .max(100)
            .describe("Improved keyword based on performance analysis"),
          exactMatch: z.boolean().describe("Whether to search as exact phrase"),
        })
      )
      .length(KEYWORD_REPROMPT_CONFIG.TARGET_KEYWORD_COUNT)
      .describe(
        `Array of ${KEYWORD_REPROMPT_CONFIG.TARGET_KEYWORD_COUNT} improved keywords`
      ),

    analysisInsights: z
      .object({
        highPerformingPatterns: z.array(z.string()),
        lowPerformingPatterns: z.array(z.string()),
        recommendedAdjustments: z.array(z.string()),
      })
      .describe("Analysis insights from keyword performance"),
  })
  .describe("Keyword re-prompt results with performance-based improvements");

export const rePromptKeywords = action({
  args: rePromptKeywordsArgsValidator,
  handler: async (ctx, { userDescription, flaggedKeywords }) => {
    const startTime = Date.now();
    const requestId = generateRequestId("keyword_reprompt");

    logger.info(`[KEYWORD_REPROMPT] Starting request ${requestId}`, {
      userDescription: userDescription.substring(0, 100) + "...",
      flaggedKeywordsCount: flaggedKeywords.length,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate user description
      const descriptionValidation =
        validateDescriptionForKeywords(userDescription);
      if (!descriptionValidation.isValid) {
        logger.error(
          `[KEYWORD_REPROMPT] ${requestId} - Description validation failed:`,
          {
            error: descriptionValidation.error,
          }
        );
        throw new Error(`Invalid description: ${descriptionValidation.error}`);
      }

      if (flaggedKeywords.length === 0) {
        logger.info(
          `[KEYWORD_REPROMPT] ${requestId} - No flagged keywords to process`
        );
        return {
          success: false,
          error: "No flagged keywords provided for re-prompting",
          data: null,
        };
      }

      // Analyze keyword performance patterns
      const highPerformingKeywords = flaggedKeywords.filter(
        (k) => k.status === "high_value"
      );
      const lowPerformingKeywords = flaggedKeywords.filter(
        (k) => k.status === "discarded"
      );

      logger.info(
        `[KEYWORD_REPROMPT] ${requestId} - Analyzing keyword performance:`,
        {
          highPerformingCount: highPerformingKeywords.length,
          lowPerformingCount: lowPerformingKeywords.length,
        }
      );

      // Fetch real tweets referenced in votes (via SocialAPI, batch by ids)
      const tweetIds = Array.from(
        new Set(
          flaggedKeywords
            .flatMap((k) => k.tweetIds || [])
            .filter((id): id is string => !!id)
        )
      ).slice(0, 50);

      let realTweetsText: string[] = [];
      if (tweetIds.length > 0) {
        try {
          const apiKey = process.env.SOCIALAPI_API_KEY;
          if (apiKey) {
            const res = await fetch(
              "https://api.socialapi.me/twitter/tweets-by-ids",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({ ids: tweetIds }),
              }
            );
            if (res.ok) {
              const data = (await res.json()) as Array<{
                full_text?: string;
                text?: string;
              }>;
              realTweetsText = data
                .map((t) => (t.full_text || t.text || "").trim())
                .filter((t) => t.length > 0)
                .slice(0, 15);
            }
          }
        } catch {}
      }

      // Enhanced prompt for performance-based keyword improvement with tweet grounding
      const prompt = `You are an expert keyword optimization AI agent for ReacherX, tasked with improving keyword suggestions based on user voting performance data. Build on the core expertise of crafting creative, emotionally resonant queries that surface genuine buyer intent on Twitter/X—using personal, human language (e.g., frustration like 'I suck at', humor like 'lol this sucks') to filter out promotional noise.

${createPromptSection("Description provided by user:", userDescription)}

PERFORMANCE ANALYSIS:

High-Performing Keywords (Users voted 👍 - these are working well):
${
  highPerformingKeywords.length > 0
    ? highPerformingKeywords
        .map(
          (k) =>
            `- "${k.keyword}" (Score: ${k.decayedScore.toFixed(2)}, Votes: ${k.upVotes}👍/${k.downVotes}👎)`
        )
        .join("\n")
    : "- None identified yet"
}

Low-Performing Keywords (Users voted 👎 - these need improvement):
${
  lowPerformingKeywords.length > 0
    ? lowPerformingKeywords
        .map(
          (k) =>
            `- "${k.keyword}" (Score: ${k.decayedScore.toFixed(2)}, Votes: ${k.upVotes}👍/${k.downVotes}👎)`
        )
        .join("\n")
    : "- None identified yet"
}

TASK: Generate exactly ${KEYWORD_REPROMPT_CONFIG.TARGET_KEYWORD_COUNT} IMPROVED keywords as creative evolutions based on this performance feedback and the user's description. These will replace or augment existing ones, shown in batches of 5, so ensure diversity in emotional tone, phrasing, and specificity. Each must tie directly to pains/features from the user description and use organic buyer language (2-4 words max). Mentally simulate searching each on Twitter/X: Only include if it likely yields 70%+ buyer-intent results (personal vents/questions) over promotions.

ANALYSIS STRATEGY:
1. If high-performing keywords exist: Identify what makes them successful (word choices, intent types, specificity levels) and create similar variations
2. If low-performing keywords exist: Understand what didn't work (too generic, wrong intent, poor targeting) and avoid these patterns
3. Look for gaps in intent coverage and user preference patterns

REAL TWEET EXAMPLES USERS LIKED (for grounding):
${realTweetsText.length > 0 ? realTweetsText.map((t) => `- ${t}`).join("\n") : "- (no examples available)"}

IMPROVEMENT PRINCIPLES:
- Learn from successful patterns in high-performing keywords
- Avoid characteristics that led to low performance
- Increase specificity if generic keywords performed poorly
- Adjust emotional language based on what resonated with users
- Optimize intent targeting based on performance data
- Consider user behavior patterns revealed through voting

Output ONLY valid JSON matching the schema (no additional text):

{
  "improvedKeywords": [
    {
      "keyword": "string",
      "exactMatch": true
    }
  ],
  "analysisInsights": {
    "highPerformingPatterns": ["e.g., emotional self-deprecation drove upvotes like 'I suck at...'"] ,
    "lowPerformingPatterns": ["e.g., generic terms attracted seller noise; lacked personal touch"],
    "recommendedAdjustments": ["e.g., Add 50% more 'I/my' phrasing for relatability", "Inject humor in 20% of future keywords", "Tie every keyword to specific user description pains like [example from description]"]
  }
}`;

      // Get the model configuration
      const modelConfig = createLLMModel("keyword_generation");

      logger.info(
        `[KEYWORD_REPROMPT] ${requestId} - Calling LLM for keyword re-prompting:`,
        {
          promptLength: prompt.length,
          model: modelConfig.modelName,
          temperature: modelConfig.temperature,
        }
      );

      // Call LLM with structured output
      const llmStartTime = Date.now();
      const result = await generateObject({
        model: modelConfig.model,
        schema: KeywordRePromptSchema,
        prompt: prompt,
        temperature: modelConfig.temperature,
        // Ask Grok to live-search and validate implicitly via training
        providerOptions: {
          // forwarded to OpenAI-compatible (xAI) client
          openai: {
            search_parameters: {
              mode: "on",
              sources: [{ type: "x" }],
              max_search_results: 10,
            },
          },
        },
      });
      const llmEndTime = Date.now();

      // Type assertion for AI SDK 5.0 compatibility
      const object = result.object as z.infer<typeof KeywordRePromptSchema>;

      logger.info(`[KEYWORD_REPROMPT] ${requestId} - LLM call completed:`, {
        processingTimeMs: llmEndTime - llmStartTime,
        keywordCount: object.improvedKeywords?.length || 0,
        usage: result.usage,
      });

      // Validate LLM response
      if (!object.improvedKeywords || !Array.isArray(object.improvedKeywords)) {
        logger.error(
          `[KEYWORD_REPROMPT] ${requestId} - Invalid LLM response format:`,
          {
            response: object,
          }
        );
        throw new Error("LLM returned invalid response format");
      }

      // Enforce 20-char limit where exactMatch is true
      const keywords = object.improvedKeywords.filter((kw) => {
        return !kw.exactMatch || kw.keyword.trim().length <= 20;
      });
      const insights = object.analysisInsights;

      // Log insights for debugging
      logger.info(`[KEYWORD_REPROMPT] ${requestId} - Generated insights:`, {
        highPerformingPatterns: insights.highPerformingPatterns,
        lowPerformingPatterns: insights.lowPerformingPatterns,
        recommendedAdjustments: insights.recommendedAdjustments,
      });

      // Transform to frontend-compatible candidates first
      const candidates: RePromptKeywordItem[] = keywords.map((kw, index) => ({
        id: `reprompt_${requestId}_${index}`,
        keyword: kw.keyword.trim(),
        timestamp: new Date().toISOString(),
        metadata: {
          generatedAt: Date.now(),
          source: `${modelConfig.modelName}_reprompt`,
          isRePrompt: true,
          basedOnPerformance: true,
          exactMatch: kw.exactMatch,
          validationModel: modelConfig.modelName,
        },
      }));

      // POST-CHECK: Validate each candidate against our Twitter search action
      const validated: typeof candidates = [];
      for (const c of candidates) {
        try {
          logger.info("[KEYWORD_REPROMPT] POST_CHECK.Query", {
            requestId,
            keyword: c.keyword,
            exactMatch: c.metadata?.exactMatch,
          });
          const res: unknown = await ctx.runAction(
            api.twitterSearch.searchTwitter,
            {
              query: c.keyword,
              exactMatch: !!c.metadata?.exactMatch,
            }
          );
          const anyRes = res as {
            success?: boolean;
            data?: { tweets?: unknown[] };
          };
          const count =
            anyRes?.success && anyRes?.data?.tweets
              ? anyRes.data.tweets.length
              : 0;
          logger.info("[KEYWORD_REPROMPT] POST_CHECK.Result", {
            requestId,
            keyword: c.keyword,
            results: count,
          });
          if (count >= 1) {
            validated.push({
              ...c,
              metadata: {
                ...c.metadata,
                resultCount: count,
                validatedAt: Date.now(),
              },
            });
          }
          if (validated.length >= KEYWORD_REPROMPT_CONFIG.TARGET_KEYWORD_COUNT)
            break;
        } catch (err) {
          logger.error("[KEYWORD_REPROMPT] POST_CHECK.Error", {
            keyword: c.keyword,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const improvedKeywords = validated.slice(
        0,
        KEYWORD_REPROMPT_CONFIG.TARGET_KEYWORD_COUNT
      );

      const endTime = Date.now();
      logger.info(
        `[KEYWORD_REPROMPT] ${requestId} - Request completed successfully:`,
        {
          totalProcessingTimeMs: endTime - startTime,
          llmProcessingTimeMs: llmEndTime - llmStartTime,
          finalKeywordCount: improvedKeywords.length,
        }
      );

      return {
        success: true,
        data: {
          improvedKeywords,
          insights,
          metadata: {
            requestId,
            generatedAt: Date.now(),
            processingTimeMs: endTime - startTime,
            llmProcessingTimeMs: llmEndTime - llmStartTime,
            basedOnKeywords: flaggedKeywords.map((k) => k.keyword),
            performanceContext: {
              highPerformingCount: highPerformingKeywords.length,
              lowPerformingCount: lowPerformingKeywords.length,
            },
          },
        },
      };
    } catch (error) {
      const endTime = Date.now();
      logger.error(`[KEYWORD_REPROMPT] ${requestId} - Request failed:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: endTime - startTime,
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Keyword re-prompting failed",
        data: null,
        metadata: {
          requestId,
          processingTimeMs: endTime - startTime,
        },
      };
    }
  },
});
