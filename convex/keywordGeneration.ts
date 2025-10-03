// convex/keywordGeneration.ts
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateObject } from "ai";
import { z } from "zod";
import { createLLMModel } from "./lib/llmConfig";
import { logger } from "../shared/lib/logger";
import { validateDescriptionForKeywords } from "../shared/lib/utils/validation";
import { generateRequestId } from "../shared/lib/utils/request";

/**
 * SEED KEYWORD GENERATION
 *
 * Generates a single high-quality keyword for immediate search
 * This is optimized for speed - generates just 1 keyword instead of 15
 */

const SeedKeywordSchema = z
  .object({
    keyword: z
      .string()
      .min(1)
      .max(100)
      .describe("A single high-quality buyer-intent keyword"),
    exactMatch: z
      .boolean()
      .describe(
        "Whether this keyword should be searched as an exact phrase match"
      ),
  })
  .describe("Single seed keyword for immediate search");

export const generateSeedKeyword = action({
  args: {
    userDescription: v.string(),
  },
  handler: async (ctx, { userDescription }) => {
    const startTime = Date.now();
    const requestId = generateRequestId("seed_keyword");

    logger.info(`[SEED_KEYWORD] Starting request ${requestId}`, {
      descriptionLength: userDescription.length,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate user description
      const descriptionValidation =
        validateDescriptionForKeywords(userDescription);
      if (!descriptionValidation.isValid) {
        logger.error(
          `[SEED_KEYWORD] ${requestId} - Description validation failed:`,
          {
            error: descriptionValidation.error,
          }
        );
        throw new Error(`Invalid description: ${descriptionValidation.error}`);
      }

      // Optimized prompt for single keyword generation
      const prompt = `You are an expert at finding potential customers on Twitter/X. Generate exactly ONE high-quality, creative buyer-intent keyword that will find people actively expressing need for the described product/service/skill.

User's description:
"${userDescription}"

Your task: Generate the SINGLE BEST search query that will discover potential customers with genuine buying intent. This keyword should:
1. Sound like everyday personal language (not marketing speak)
2. Express frustration, need, or desire (e.g., "I suck at [pain point]", "why is [issue] so hard?")
3. Minimize seller hijacks by sounding personal/emotional
4. Be concise (2-4 words max)
5. Blend specificity from user description with creative emotional flair

Example patterns (adapt to user description):
- "CRM for small businesses" → "I suck at lead tracking lol" (frustration, exactMatch: true)
- "Social media manager" → "help me post consistently" (plea, exactMatch: false)
- "Email marketing tool" → "email automation nightmare" (pain, exactMatch: false)

Output ONLY valid JSON:
{
  "keyword": "string",
  "exactMatch": true or false
}

This is the SEED keyword that will be searched immediately, so make it count!`;

      // Get model config - use a dedicated fast path for seed generation
      const modelConfig = createLLMModel("seed_generation");

      logger.info(`[SEED_KEYWORD] ${requestId} - Calling LLM:`, {
        model: modelConfig.modelName,
        temperature: modelConfig.temperature,
      });

      // Call LLM
      const llmStartTime = Date.now();
      const result = await generateObject({
        model: modelConfig.model,
        schema: SeedKeywordSchema,
        prompt: prompt,
        temperature: modelConfig.temperature,
      });
      const llmEndTime = Date.now();

      logger.info(`[SEED_KEYWORD] ${requestId} - LLM call completed:`, {
        processingTimeMs: llmEndTime - llmStartTime,
        keyword: result.object.keyword,
        exactMatch: result.object.exactMatch,
      });

      // Validate response
      if (!result.object?.keyword) {
        throw new Error("LLM returned invalid response - missing keyword");
      }

      const endTime = Date.now();
      logger.info(`[SEED_KEYWORD] ${requestId} - Completed successfully:`, {
        totalTimeMs: endTime - startTime,
        keyword: result.object.keyword,
        exactMatch: result.object.exactMatch,
      });

      return {
        success: true,
        data: {
          keyword: result.object.keyword,
          exactMatch: result.object.exactMatch,
          metadata: {
            requestId,
            generatedAt: Date.now(),
            processingTimeMs: endTime - startTime,
            modelUsed: modelConfig.modelName,
          },
        },
      };
    } catch (error) {
      const endTime = Date.now();
      logger.error(`[SEED_KEYWORD] ${requestId} - Failed:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: endTime - startTime,
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Seed keyword generation failed",
        data: null,
      };
    }
  },
});
