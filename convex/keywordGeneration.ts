// // convex/keywordGeneration.ts
// "use node";

// import { action } from "./_generated/server";
// import { v } from "convex/values";
// import { generateObject } from "ai";
// import { z } from "zod";
// import { createLLMModel } from "./lib/llmConfig";
// import { logger } from "../shared/lib/logger";
// import { validateDescriptionForKeywords } from "../shared/lib/utils/validation";
// import { generateRequestId } from "../shared/lib/utils/request";

// /**
//  * SEED KEYWORD GENERATION
//  *
//  * Generates a single high-quality keyword for immediate search
//  * This is optimized for speed - generates just 1 keyword instead of 15
//  */

// const SeedKeywordSchema = z
//   .object({
//     keyword: z
//       .string()
//       .min(1)
//       .max(100)
//       .describe("A single high-quality buyer-intent keyword"),
//     exactMatch: z
//       .boolean()
//       .describe(
//         "Whether this keyword should be searched as an exact phrase match"
//       ),
//   })
//   .describe("Single seed keyword for immediate search");

// export const generateSeedKeyword = action({
//   args: {
//     userDescription: v.string(),
//   },
//   handler: async (ctx, { userDescription }) => {
//     const startTime = Date.now();
//     const requestId = generateRequestId("seed_keyword");

//     logger.info(`[SEED_KEYWORD] Starting request ${requestId}`, {
//       descriptionLength: userDescription.length,
//       timestamp: new Date().toISOString(),
//     });

//     try {
//       // Validate user description
//       const descriptionValidation =
//         validateDescriptionForKeywords(userDescription);
//       if (!descriptionValidation.isValid) {
//         logger.error(
//           `[SEED_KEYWORD] ${requestId} - Description validation failed:`,
//           {
//             error: descriptionValidation.error,
//           }
//         );
//         throw new Error(`Invalid description: ${descriptionValidation.error}`);
//       }

//       // Updated prompt for single seed keyword generation
//       const prompt = `You are an expert potential customer finding AI agent for ReacherX, a platform that helps anyone find potential customers on social media. Your expertise lies in crafting inventive, emotionally resonant search queries that surface genuine buyer intent on Twitter/X, using creative language to mimic real people's frustrations, humor, and vulnerabilities—while filtering out promotional noise from sellers, affiliates, and spammers. Prioritize a memorable, "wow factor" phrasing that feels human and personal.

// The following is the description that the user has provided:
// "${userDescription}"

// Your task: Generate exactly ONE creative, precise search query (a keyword/phrase) to discover potential customers actively expressing needs for the described product/service/skill. Focus on organic, personal language that reveals unmet needs through emotions like frustration, self-doubt, or light humor (e.g., "I suck at [pain point]", "lol this [issue] sucks"). The query should minimize seller hijacks by sounding like an everyday user vent. Mentally simulate searching on Twitter/X: Only include if it likely yields 70%+ buyer-intent results (e.g., personal stories/questions) over promotions.

// Strict constraints:
// - If you mark exactMatch=true, the keyword MUST be ≤ 25 characters. Count characters precisely.
// - The keyword MUST be ≤ 100 characters overall.

// Guidelines to Avoid Hijacked Keywords:
// 1. Keep concise: 2-3 words max (for platform limits), blending specificity from user description with creative flair.
// 2. Buyer-oriented modifiers: Use words like 'help me', 'stuck on', 'recommend something', but make them personal/emotional.
// 3. Natural exclusions: Imply individual struggles (e.g., 'my [pain] is embarrassing' to avoid commercial pitches).
// 4. Blend formal/industry terms with slang, typos, abbreviations, and creative twists (e.g., 'lead managment fail' or 'CRM nightmare vibes').
// 5. Prioritize low-competition signals: Target small user vibes (individuals/teams), not marketer lingo.
// 8. Creativity Mandate: Infuse personal touch—use first-person ("I", "my team") (e.g., "suck at customer tracking"), or casual exclamations to evoke relatability.

// For the query, provide:
// - The exact keyword/phrase to search for (Do not add quotes).
// - exactMatch: boolean (true for precise emotional phrases/questions to catch exact vents; false for broader emotional themes).

// Output ONLY valid JSON (no additional text):
// {
//   "keyword": "string",
//   "exactMatch": true or false
// }`;

//       // Get model config - use a dedicated fast path for seed generation
//       const modelConfig = createLLMModel("seed_generation");

//       logger.info(`[SEED_KEYWORD] ${requestId} - Calling LLM:`, {
//         model: modelConfig.modelName,
//         temperature: modelConfig.temperature,
//       });

//       // Call LLM
//       const llmStartTime = Date.now();
//       const result = await generateObject({
//         model: modelConfig.model,
//         schema: SeedKeywordSchema,
//         prompt: prompt,
//         temperature: modelConfig.temperature,
//       });
//       const llmEndTime = Date.now();

//       logger.info(`[SEED_KEYWORD] ${requestId} - LLM call completed:`, {
//         processingTimeMs: llmEndTime - llmStartTime,
//         keyword: result.object.keyword,
//         exactMatch: result.object.exactMatch,
//       });

//       // Validate response
//       if (!result.object?.keyword) {
//         throw new Error("LLM returned invalid response - missing keyword");
//       }

//       // Enforce 20-char limit when exactMatch is true
//       const proposedKeyword = result.object.keyword.trim();
//       const isExact = !!result.object.exactMatch;
//       if (isExact && proposedKeyword.length > 25) {
//         throw new Error(
//           `Exact match keywords must be 25 characters or fewer. Received ${proposedKeyword.length} characters.`
//         );
//       }

//       const endTime = Date.now();
//       logger.info(`[SEED_KEYWORD] ${requestId} - Completed successfully:`, {
//         totalTimeMs: endTime - startTime,
//         keyword: result.object.keyword,
//         exactMatch: result.object.exactMatch,
//       });

//       return {
//         success: true,
//         data: {
//           keyword: result.object.keyword,
//           exactMatch: result.object.exactMatch,
//           metadata: {
//             requestId,
//             generatedAt: Date.now(),
//             processingTimeMs: endTime - startTime,
//             modelUsed: modelConfig.modelName,
//           },
//         },
//       };
//     } catch (error) {
//       const endTime = Date.now();
//       logger.error(`[SEED_KEYWORD] ${requestId} - Failed:`, {
//         error: error instanceof Error ? error.message : "Unknown error",
//         processingTimeMs: endTime - startTime,
//       });

//       return {
//         success: false,
//         error:
//           error instanceof Error
//             ? error.message
//             : "Seed keyword generation failed",
//         data: null,
//       };
//     }
//   },
// });

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
      .describe(
        "A single high-quality buyer-intent keyword (if exactMatch=true, runtime enforces ≤25 chars)"
      ),
    exactMatch: z
      .boolean()
      .describe(
        "Whether this keyword should be searched as an exact phrase match (if true, keyword must be ≤25 chars)"
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

      // Updated prompt for single seed keyword generation
      const prompt = `You are an expert potential-customer finder for ReacherX. Your job: craft inventive, emotionally resonant search queries that surface genuine buyer intent on Twitter/X while filtering sellers/affiliates/spam. Favor human, vent-like phrasing with a memorable "wow factor."

User description:
"${userDescription}"

Your task:
Generate exactly ONE creative, precise search query (a keyword/phrase) to find potential customers actively expressing needs related to the user description. Aim for organic, first-person, emotional language (e.g., "I suck at [pain point]", "lol this [issue] sucks") that would yield mostly personal stories/questions rather than promotions.

Hard constraints:
- Output MUST be valid JSON only with fields: keyword (string), exactMatch (boolean).
- keyword length ≤ 100 characters.
- If exactMatch = true, keyword length MUST be ≤ 25 characters. Count characters precisely; include spaces and punctuation.
- Prefer exactMatch = true only if the phrase is short, natural, and likely to catch high-intent vents.
- Avoid generic marketer terms that attract promotions.

Targeting heuristics:
1) Keep concise (2–3 words when possible) yet specific to the user description.
2) Use buyer/struggle cues: "help me", "stuck on", "need advice", "my [pain]"—but keep it personal/emotional.
3) Imply individual struggles to deter seller hijacks (e.g., "my crm is chaos").
4) Mix light slang/typos if natural ("lead managment fail", "crm nightmare vibes")—only if it stays concise.
5) Low-competition feel: small-team/individual vibe; avoid agency/sales lingo.
6) Use first-person ("I", "my team") when helpful.

ExactMatch decision rule:
- If the best phrase naturally fits ≤ 25 chars and feels like a precise vent, set exactMatch = true.
- Otherwise, choose a slightly broader but still emotional phrase and set exactMatch = false.

Return JSON ONLY (no extra text):
{
  "keyword": "string (≤100 chars; if exactMatch=true then ≤25 chars)",
  "exactMatch": true or false
}`;

      // Get model config - use a dedicated fast path for seed generation
      const modelConfig = createLLMModel("seed_generation");

      logger.info(`[SEED_KEYWORD] ${requestId} - Calling LLM:`, {
        model: modelConfig.modelName,
        temperature: modelConfig.temperature,
      });

      // Call LLM (with minimal retry for transient errors)
      const llmStartTime = Date.now();
      const callWithRetry = async () => {
        let lastErr: unknown;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            return await generateObject({
              model: modelConfig.model,
              schema: SeedKeywordSchema,
              prompt: prompt,
              temperature: modelConfig.temperature,
            });
          } catch (e) {
            lastErr = e;
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, attempt * 300));
            }
          }
        }
        throw lastErr;
      };
      const result = await callWithRetry();
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

      // Enforce 25-char limit when exactMatch is true
      // If LLM miscounts and generates >25 chars with exactMatch=true,
      // automatically set exactMatch=false instead of failing the request
      const normalizedKeyword = result.object.keyword
        .replace(/\s+/g, " ")
        .trim();
      let finalExactMatch = !!result.object.exactMatch;

      if (finalExactMatch && normalizedKeyword.length > 25) {
        logger.warn(
          `[SEED_KEYWORD] ${requestId} - Auto-correcting exactMatch from true to false (keyword length ${normalizedKeyword.length} > 25):`,
          {
            keyword: normalizedKeyword,
            originalExactMatch: true,
            correctedExactMatch: false,
          }
        );
        finalExactMatch = false;
      }

      const endTime = Date.now();
      logger.info(`[SEED_KEYWORD] ${requestId} - Completed successfully:`, {
        totalTimeMs: endTime - startTime,
        keyword: normalizedKeyword,
        keywordLength: normalizedKeyword.length,
        exactMatch: finalExactMatch,
      });

      return {
        success: true,
        data: {
          keyword: normalizedKeyword,
          exactMatch: finalExactMatch,
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
