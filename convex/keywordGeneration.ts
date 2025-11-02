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
import { api } from "./_generated/api";
import { validateKeywordWithLlmFilter } from "./lib/keywordValidation";

/**
 * SEED KEYWORD GENERATION
 *
 * Generates a single high-quality keyword for immediate search
 * This is optimized for speed - generates just 1 keyword instead of 15
 */

const SeedSetSchema = z
  .object({
    keywords: z
      .array(
        z.object({
          keyword: z.string().min(1).max(100),
          exactMatch: z.boolean(),
        })
      )
      .min(3)
      .max(5),
  })
  .describe("Up to five seed candidates for immediate search");

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

      // Updated prompt for multiple seed candidates (up to 5)
      const prompt = `You are an expert potential-customer finder for ReacherX. Your job: craft inventive, emotionally resonant search queries that surface genuine buyer intent on Twitter/X while filtering sellers/affiliates/spam. Favor human, vent-like phrasing with a memorable "wow factor."

User description:
"${userDescription}"

Your task:
Generate between 3 and 5 distinct search queries (keywords/phrases). Aim for organic, first-person, emotional language (e.g., "I suck at [pain point]", "lol this [issue] sucks") that would yield mostly personal stories/questions rather than promotions.

Hard constraints:
- Output MUST be valid JSON ONLY with structure: { "keywords": [{ "keyword": string (≤100), "exactMatch": boolean }, ...] }.
- If exactMatch = true, keyword MUST be ≤ 25 characters. Count characters precisely; include spaces and punctuation.
- Prefer exactMatch = true only if the phrase is short, natural, and likely to catch high-intent vents.
- Avoid generic marketer terms that attract promotions.

Targeting heuristics:
1) Keep concise (2–4 words when possible) yet specific to the user description.
2) Use buyer/struggle cues: "help me", "stuck on", "need advice", "my [pain]"—but keep it personal/emotional.
3) Imply individual struggles to deter seller hijacks (e.g., "my crm is chaos").
4) Light slang/typos if natural ("lead managment fail", "crm nightmare vibes").
5) Low-competition feel: small-team/individual vibe; avoid agency/sales lingo.
6) Use first-person ("I", "my team") when helpful.
`;

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
              schema: SeedSetSchema,
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
        candidates: Array.isArray(result.object?.keywords)
          ? result.object.keywords.length
          : 0,
      });

      // Normalize candidates and enforce exactMatch length locally
      type Candidate = { keyword: string; exactMatch: boolean };
      const rawCandidates: Array<{ keyword: string; exactMatch: boolean }> =
        Array.isArray(result.object?.keywords) ? result.object!.keywords : [];
      const candidates: Candidate[] = rawCandidates
        .map((c) => ({
          keyword: String(c.keyword || "")
            .replace(/\s+/g, " ")
            .trim(),
          exactMatch: !!c.exactMatch,
        }))
        .filter((c) => c.keyword.length > 0)
        .slice(0, 5)
        .map((c) => {
          if (c.exactMatch && c.keyword.length > 25) {
            return { ...c, exactMatch: false };
          }
          return c;
        });

      if (candidates.length === 0) {
        throw new Error("LLM returned no seed candidates");
      }

      // Helper using shared validation: returns kept count for each candidate
      const validateCandidate = async (
        cand: Candidate
      ): Promise<{ kept: number; cand: Candidate }> => {
        const { kept } = await validateKeywordWithLlmFilter(
          ctx,
          cand.keyword,
          cand.exactMatch,
          userDescription
        );
        return { kept, cand };
      };

      // Validate all candidates in parallel, pick the best with kept >= 1
      const validations = await Promise.all(
        candidates.map((c) => validateCandidate(c))
      );
      const passing = validations
        .filter((v) => v.kept > 0)
        .sort((a, b) => b.kept - a.kept);

      const endTime = Date.now();
      if (passing.length > 0) {
        const best = passing[0];
        logger.info(
          `[SEED_KEYWORD] ${requestId} - Completed with validated seed:`,
          {
            totalTimeMs: endTime - startTime,
            keyword: best.cand.keyword,
            kept: best.kept,
            exactMatch: best.cand.exactMatch,
          }
        );

        return {
          success: true,
          data: {
            keyword: best.cand.keyword,
            exactMatch: best.cand.exactMatch,
            metadata: {
              requestId,
              generatedAt: Date.now(),
              processingTimeMs: endTime - startTime,
              modelUsed: modelConfig.modelName,
              kept: best.kept,
              validatedWithLLM: true,
            },
          },
        };
      }

      // Secondary fallback: try existing server suggestions pool (authenticated only)
      try {
        const identity = await ctx.auth.getUserIdentity();
        if (identity) {
          let workspaceId: string | null = null;
          try {
            const ws = await ctx.runQuery(
              api.workspaces.getDefaultWorkspace,
              {}
            );
            workspaceId = (ws && (ws as { _id?: string })._id) || null;
          } catch {}

          if (workspaceId) {
            const normDesc = userDescription
              .trim()
              .toLowerCase()
              .replace(/\s+/g, " ");
            const pool = (await ctx.runQuery(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (api as any).keywordSuggestions.getSuggestions,
              {
                workspaceId,
                userDescription: normDesc,
                limit: 10,
              }
            )) as Array<{
              keyword: string;
              metadata?: { exactMatch?: boolean };
            }>;

            for (const s of pool) {
              const cand = {
                keyword: String(s.keyword || "")
                  .replace(/\s+/g, " ")
                  .trim(),
                exactMatch: !!s?.metadata?.exactMatch,
              };
              const check = await validateCandidate(cand);
              if (check.kept > 0) {
                const endPool = Date.now();
                logger.info(
                  `[SEED_KEYWORD] ${requestId} - Completed from suggestions pool`,
                  {
                    totalTimeMs: endPool - startTime,
                    keyword: check.cand.keyword,
                    kept: check.kept,
                    exactMatch: check.cand.exactMatch,
                  }
                );
                return {
                  success: true,
                  data: {
                    keyword: check.cand.keyword,
                    exactMatch: check.cand.exactMatch,
                    metadata: {
                      requestId,
                      generatedAt: Date.now(),
                      processingTimeMs: endPool - startTime,
                      modelUsed: modelConfig.modelName,
                      kept: check.kept,
                      validatedWithLLM: true,
                      source: "suggestions_pool",
                    },
                  },
                };
              }
            }
          }
        }
      } catch {}

      // Fallback: battle-tested keywords (still validate with LLM)
      try {
        const bt = await ctx.runAction(
          api.keywordSuggestionsBattleTested.generateBattleTestedKeywords,
          { userDescription }
        );
        const firstBT = Array.isArray(bt?.data) ? bt.data[0] : null;
        if (firstBT && firstBT.keyword) {
          const cand = {
            keyword: String(firstBT.keyword).replace(/\s+/g, " ").trim(),
            exactMatch: !!firstBT.exactMatch,
          };
          const check = await validateCandidate(cand);
          if (check.kept > 0) {
            const endBT = Date.now();
            logger.info(
              `[SEED_KEYWORD] ${requestId} - Completed with battle-tested fallback:`,
              {
                totalTimeMs: endBT - startTime,
                keyword: check.cand.keyword,
                kept: check.kept,
                exactMatch: check.cand.exactMatch,
              }
            );
            return {
              success: true,
              data: {
                keyword: check.cand.keyword,
                exactMatch: check.cand.exactMatch,
                metadata: {
                  requestId,
                  generatedAt: Date.now(),
                  processingTimeMs: endBT - startTime,
                  modelUsed: modelConfig.modelName,
                  kept: check.kept,
                  validatedWithLLM: true,
                  fallback: "battle_tested",
                },
              },
            };
          }
        }
      } catch {}

      // No validated seed found
      logger.warn(`[SEED_KEYWORD] ${requestId} - No validated seed found`);
      return {
        success: false,
        error: "No validated seed found",
        data: null,
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
