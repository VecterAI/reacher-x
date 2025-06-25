import { v } from "convex/values";
import { action } from "./_generated/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createLLMModel } from "./lib/llmConfig";

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
 */

import { validateDescriptionForKeywords } from "../shared/lib/utils/validation";
import { generateRequestId } from "../shared/lib/utils/request";

// Enhanced schema for re-prompt results
const KeywordRePromptSchema = z
  .object({
    improvedKeywords: z
      .array(
        z.object({
          keyword: z
            .string()
            .min(3)
            .max(100)
            .describe("An improved keyword based on performance analysis"),
          improvementReason: z
            .string()
            .max(200)
            .describe(
              "Explanation of how this keyword improves on previous performance"
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
      .describe("Array of 5 improved keywords based on performance feedback"),

    analysisInsights: z
      .object({
        highPerformingPatterns: z
          .array(z.string())
          .describe("Patterns found in high-performing keywords"),
        lowPerformingPatterns: z
          .array(z.string())
          .describe("Patterns found in low-performing keywords"),
        recommendedAdjustments: z
          .array(z.string())
          .describe("Specific adjustments to improve keyword performance"),
      })
      .describe("Analysis insights from keyword performance"),
  })
  .describe("Keyword re-prompt results with performance-based improvements");

export const rePromptKeywords = action({
  args: {
    userDescription: v.string(),
    flaggedKeywords: v.array(
      v.object({
        keyword: v.string(),
        status: v.string(),
        decayedScore: v.number(),
        totalVotes: v.number(),
        upVotes: v.number(),
        downVotes: v.number(),
      })
    ),
  },
  handler: async (ctx, { userDescription, flaggedKeywords }) => {
    const startTime = Date.now();
    const requestId = generateRequestId("keyword_reprompt");

    console.log(`[KEYWORD_REPROMPT] Starting request ${requestId}`, {
      userDescription: userDescription.substring(0, 100) + "...",
      flaggedKeywordsCount: flaggedKeywords.length,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate user description
      const descriptionValidation =
        validateDescriptionForKeywords(userDescription);
      if (!descriptionValidation.isValid) {
        console.error(
          `[KEYWORD_REPROMPT] ${requestId} - Description validation failed:`,
          {
            error: descriptionValidation.error,
          }
        );
        throw new Error(`Invalid description: ${descriptionValidation.error}`);
      }

      if (flaggedKeywords.length === 0) {
        console.log(
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

      console.log(
        `[KEYWORD_REPROMPT] ${requestId} - Analyzing keyword performance:`,
        {
          highPerformingCount: highPerformingKeywords.length,
          lowPerformingCount: lowPerformingKeywords.length,
        }
      );

      // Enhanced prompt for performance-based keyword improvement
      const prompt = `You are an expert keyword optimization specialist for ReacherX, tasked with improving keyword suggestions based on user voting performance data.

User's Business Description:
"${userDescription}"

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

TASK: Generate 5 IMPROVED keywords based on this performance feedback.

ANALYSIS STRATEGY:
1. If high-performing keywords exist: Identify what makes them successful (word choices, intent types, specificity levels) and create similar variations
2. If low-performing keywords exist: Understand what didn't work (too generic, wrong intent, poor targeting) and avoid these patterns
3. Look for gaps in intent coverage and user preference patterns

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
      "improvementReason": "string explaining how this improves on previous performance",
      "searchIntent": "pain_point|solution_seeking|comparison|urgent_need|budget_indication",
      "confidence": 0.0-1.0
    }
  ],
  "analysisInsights": {
    "highPerformingPatterns": ["pattern1", "pattern2"],
    "lowPerformingPatterns": ["pattern1", "pattern2"], 
    "recommendedAdjustments": ["adjustment1", "adjustment2"]
  }
}`;

      // Get the model configuration
      const modelConfig = createLLMModel("keyword_generation");

      console.log(
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
      });
      const llmEndTime = Date.now();

      console.log(`[KEYWORD_REPROMPT] ${requestId} - LLM call completed:`, {
        processingTimeMs: llmEndTime - llmStartTime,
        keywordCount: result.object?.improvedKeywords?.length || 0,
        usage: result.usage,
      });

      // Validate LLM response
      if (
        !result.object?.improvedKeywords ||
        !Array.isArray(result.object.improvedKeywords)
      ) {
        console.error(
          `[KEYWORD_REPROMPT] ${requestId} - Invalid LLM response format:`,
          {
            response: result.object,
          }
        );
        throw new Error("LLM returned invalid response format");
      }

      const keywords = result.object.improvedKeywords;
      const insights = result.object.analysisInsights;

      // Log insights for debugging
      console.log(`[KEYWORD_REPROMPT] ${requestId} - Generated insights:`, {
        highPerformingPatterns: insights.highPerformingPatterns,
        lowPerformingPatterns: insights.lowPerformingPatterns,
        recommendedAdjustments: insights.recommendedAdjustments,
      });

      // Transform to frontend-compatible format
      const improvedKeywords = keywords.map((kw, index) => ({
        id: `reprompt_${Date.now()}_${index}`,
        keyword: kw.keyword,
        timestamp: new Date().toISOString(),
        metadata: {
          improvementReason: kw.improvementReason,
          searchIntent: kw.searchIntent,
          confidence: kw.confidence,
          generatedAt: Date.now(),
          source: `${modelConfig.modelName}_reprompt`,
          isRePrompt: true,
          basedOnPerformance: true,
        },
      }));

      const endTime = Date.now();
      console.log(
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
      console.error(`[KEYWORD_REPROMPT] ${requestId} - Request failed:`, {
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
