import { query, internalMutation, mutation } from "./_generated/server";
import { logger } from "../shared/lib/logger";
import {
  getSuggestionsArgsValidator,
  markSuggestionAsUsedArgsValidator,
  storeSuggestionsArgsValidator,
} from "./validators";

export const getSuggestions = query({
  args: getSuggestionsArgsValidator,
  handler: async (ctx, { workspaceId, limit }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const suggestions = await ctx.db
      .query("keywordSuggestions")
      .withIndex("by_workspace_isUsed_generatedAt", (q) =>
        q.eq("workspaceId", workspaceId).eq("isUsed", false)
      )
      .order("desc")
      .take(limit ?? 5);

    return suggestions;
  },
});

export const storeSuggestions = internalMutation({
  args: storeSuggestionsArgsValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();
    // Load existing unused suggestions for dedupe
    const existing = await ctx.db
      .query("keywordSuggestions")
      .withIndex("by_workspace_isUsed_generatedAt", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("isUsed", false)
      )
      .take(500);
    const existingSet = new Set(
      existing.map(
        (e) =>
          `${e.keyword.trim().toLowerCase()}|${e.metadata?.exactMatch ? 1 : 0}`
      )
    );

    let inserted = 0;
    let skipped = 0;
    // Sanitize metadata to allowed keys before persisting, to avoid validation errors
    const allowMetadataKeys = new Set([
      "source",
      "generatedAt",
      "usedFallback",
      "exactMatch",
      "verificationScore",
      "examplesCount",
      "validatedAt",
      "validationModel",
      "resultCount",
      "battleTested",
    ]);

    for (let i = 0; i < args.suggestions.length; i++) {
      const s = args.suggestions[i];
      const key = `${s.keyword.trim().toLowerCase()}|${s.metadata?.exactMatch ? 1 : 0}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      const sanitizedMetadata = s.metadata
        ? Object.fromEntries(
            Object.entries(s.metadata).filter(([k]) => allowMetadataKeys.has(k))
          )
        : undefined;
      await ctx.db.insert("keywordSuggestions", {
        userId: user._id,
        workspaceId: args.workspaceId,
        keyword: s.keyword.trim().toLowerCase(),
        isUsed: false,
        generatedAt: s.generatedAt ?? now + i,
        userDescription: args.userDescription,
        batchRequestId: args.batchRequestId,
        metadata: sanitizedMetadata,
      });
      existingSet.add(key);
      inserted++;
    }
    logger.info("[KEYWORD_STORE] StoreSuggestions summary", {
      workspaceId: args.workspaceId,
      batchRequestId: args.batchRequestId,
      attempted: args.suggestions.length,
      inserted,
      skipped,
    });
  },
});

export const markSuggestionAsUsed = mutation({
  args: markSuggestionAsUsedArgsValidator,
  handler: async (ctx, { suggestionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", identity.subject)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion || suggestion.userId !== user._id) {
      throw new Error("Suggestion not found or not authorized");
    }

    if (!suggestion.isUsed) {
      await ctx.db.patch(suggestionId, { isUsed: true, usedAt: Date.now() });
    }

    return true;
  },
});

import { action } from "./_generated/server";
import { generateKeywordsArgsValidator } from "./validators";
import { internal, api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

// =============================================================================
// KEYWORD GENERATION SYSTEM
// =============================================================================
/**
 * USAGE:
 *
 * This action generates targeted keywords based on user descriptions
 * using Grok (preferred) or GPT-4o (fallback) for optimal Twitter/X understanding.
 *
 * Key features:
 * - Uses Grok (grok-4-fast) for Twitter-optimized generation when available
 * - Falls back to GPT-4o if Grok is unavailable or misconfigured
 * - Generates configurable number of high-quality keywords
 * - Follows established logging and error handling patterns
 * - Returns structured data compatible with frontend KeywordItem interface
 */

// Import shared validation and request utilities
import { validateDescriptionForKeywords } from "../shared/lib/utils/validation";
import { makeKeywordGenProgressKey } from "../shared/lib/utils/progressKey";
import { generateRequestId } from "../shared/lib/utils/request";

// (Battle-tested flow delegates to xAI live search action)

type KeywordSuggestionDoc = Doc<"keywordSuggestions">;

export const generateKeywords = action({
  args: generateKeywordsArgsValidator,
  handler: async (
    ctx,
    { userDescription, workspaceId }
  ): Promise<
    | {
        success: true;
        data: {
          keywords: Array<{
            id: string;
            keyword: string;
            timestamp: string;
            metadata: Record<string, unknown>;
          }>;
          metadata: {
            requestId: string;
            generatedAt: number;
            processingTimeMs: number;
            userDescriptionLength: number;
            modelUsed: string;
            usedFallback: boolean;
          };
        };
      }
    | {
        success: false;
        error: string;
        data: null;
        metadata: {
          requestId: string;
          processingTimeMs: number;
          fallbackUsed: boolean;
        };
      }
  > => {
    const startTime = Date.now();
    const requestId = generateRequestId("keyword_gen");
    // Resolve workspace first to stabilize the progress key used by the client subscription
    let resolvedWorkspaceId = workspaceId ?? null;
    if (!resolvedWorkspaceId) {
      try {
        const defaultWorkspace = await ctx.runQuery(
          api.workspaces.getDefaultWorkspace,
          {}
        );
        if (defaultWorkspace) {
          resolvedWorkspaceId = defaultWorkspace._id;
        }
      } catch {}
    }

    const progressKey = makeKeywordGenProgressKey(
      (resolvedWorkspaceId as unknown as string) || null,
      userDescription
    );

    logger.info(`[KEYWORD_GEN] Starting request ${requestId}`, {
      userDescription: userDescription.substring(0, 100) + "...",
      descriptionLength: userDescription.length,
      timestamp: new Date().toISOString(),
    });

    try {
      // Emit initial queued progress
      try {
        await ctx.runMutation(api.searchProgress.upsertProgress, {
          keywordKey: progressKey,
          operation: "initial",
          phase: "queued",
          value: 5,
        });
      } catch {}

      // Validate user description with comprehensive logging
      const descriptionValidation =
        validateDescriptionForKeywords(userDescription);
      if (!descriptionValidation.isValid) {
        logger.error(
          `[KEYWORD_GEN] ${requestId} - Description validation failed:`,
          {
            error: descriptionValidation.error,
            providedDescription: userDescription.substring(0, 100) + "...",
          }
        );
        throw new Error(`Invalid description: ${descriptionValidation.error}`);
      }

      logger.info(
        `[KEYWORD_GEN] ${requestId} - Description validation passed`,
        {
          descriptionLength: userDescription.length,
        }
      );

      // Emit progress: begin generating (prompting)
      try {
        await ctx.runMutation(api.searchProgress.upsertProgress, {
          keywordKey: progressKey,
          operation: "initial",
          phase: "searching",
          value: 30,
        });
      } catch {}

      // Short-circuit: reuse fresh unused suggestions for the same description
      const FRESH_MS = 2 * 60 * 1000;
      const targetWorkspaceId = resolvedWorkspaceId;
      if (targetWorkspaceId) {
        try {
          const existing = (await ctx.runQuery(
            api.keywordSuggestions.getSuggestions,
            { workspaceId: targetWorkspaceId, limit: 200 }
          )) as KeywordSuggestionDoc[];
          const freshForDesc = (existing || [])
            .filter(
              (s: KeywordSuggestionDoc) =>
                s.userDescription === userDescription && !s.isUsed
            )
            .filter(
              (s: KeywordSuggestionDoc) => Date.now() - s.generatedAt < FRESH_MS
            );
          if (freshForDesc.length > 0) {
            logger.info(`[KEYWORD_GEN] ${requestId} - Short-circuit reuse`, {
              reused: freshForDesc.length,
              workspaceId: targetWorkspaceId,
            });
            const frontendKeywords = freshForDesc.map(
              (s: KeywordSuggestionDoc, index: number) => ({
                id: `existing_${String(s._id)}_${index}`,
                keyword: s.keyword,
                timestamp: new Date(s.generatedAt).toISOString(),
                metadata: {
                  ...(s.metadata || {}),
                  usedFallback: false,
                },
              })
            );
            const endTime = Date.now();
            return {
              success: true,
              data: {
                keywords: frontendKeywords,
                metadata: {
                  requestId,
                  generatedAt: Date.now(),
                  processingTimeMs: endTime - startTime,
                  userDescriptionLength: userDescription.length,
                  modelUsed: "reuse:fresh",
                  usedFallback: false,
                },
              },
            };
          }
        } catch (e) {
          // If short-circuit probe fails, proceed to generation normally
          logger.warn(
            `[KEYWORD_GEN] ${requestId} - Short-circuit probe failed`,
            {
              error: e instanceof Error ? e.message : String(e),
            }
          );
        }
      }

      // No prompt needed here; we delegate to battle-tested generator

      // Delegate to battle-tested generator with xAI live search
      // Build args for battle-tested generator; omit workspaceId when not available
      const battleArgs: {
        userDescription: string;
        workspaceId?: typeof targetWorkspaceId;
        progressKey?: string;
      } = { userDescription, progressKey };
      if (targetWorkspaceId) {
        battleArgs.workspaceId = targetWorkspaceId;
      }
      const battle = await ctx.runAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (api as any).keywordSuggestionsBattleTested
          .generateBattleTestedKeywords,
        battleArgs
      );
      if (!battle?.success || !battle.data) {
        throw new Error(battle?.error || "Battle-tested generation failed");
      }
      const keywords = battle.data as Array<{
        keyword: string;
        exactMatch: boolean;
        score?: number;
        examplesCount?: number;
        resultCount?: number;
      }>;
      const frontendKeywords = keywords.map((kw, index) => ({
        id: `generated_${Date.now()}_${index}`,
        keyword: kw.keyword,
        timestamp: new Date().toISOString(),
        metadata: {
          generatedAt: Date.now(),
          source: "grok-4-fast-reasoning",
          usedFallback: false,
          exactMatch: kw.exactMatch,
          battleTested: true,
          verificationScore: kw.score,
          examplesCount: kw.examplesCount,
          validatedAt: Date.now(),
          validationModel: "grok-4-fast-reasoning",
          resultCount: kw.resultCount,
        },
      }));

      const endTime = Date.now();

      // Emit progress: ranking complete
      try {
        await ctx.runMutation(api.searchProgress.upsertProgress, {
          keywordKey: progressKey,
          operation: "initial",
          phase: "chunking",
          value: 60,
        });
      } catch {}

      // Persist suggestions to Convex for authenticated users
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        const targetWorkspaceId = resolvedWorkspaceId;
        if (targetWorkspaceId) {
          const suggestionsPayload = frontendKeywords.map((k) => ({
            keyword: k.keyword,
            metadata: k.metadata,
          }));
          // Server-side dedupe before insert: skip if same keyword|exact exists unused
          // Fetch current pool for this workspace/description
          const existing = (await ctx.runQuery(
            api.keywordSuggestions.getSuggestions,
            { workspaceId: targetWorkspaceId, limit: 200 }
          )) as KeywordSuggestionDoc[];
          const existingSet = new Set(
            (existing || []).map(
              (s: KeywordSuggestionDoc) =>
                `${s.keyword.trim().toLowerCase()}|${s.metadata?.exactMatch ? 1 : 0}`
            )
          );
          const dedupedPayload = suggestionsPayload.filter((s) => {
            const key = `${s.keyword.trim().toLowerCase()}|${s.metadata?.exactMatch ? 1 : 0}`;
            return !existingSet.has(key);
          });
          // Emit progress: deduping/persist prep
          try {
            await ctx.runMutation(api.searchProgress.upsertProgress, {
              keywordKey: progressKey,
              operation: "initial",
              phase: "filtering",
              value: 80,
            });
          } catch {}

          await ctx.runMutation(internal.keywordSuggestions.storeSuggestions, {
            workspaceId: targetWorkspaceId,
            userDescription,
            batchRequestId: requestId,
            suggestions: dedupedPayload,
          });
        }
      }
      logger.info(
        `[KEYWORD_GEN] ${requestId} - Request completed successfully:`,
        {
          totalProcessingTimeMs: endTime - startTime,
          finalKeywordCount: frontendKeywords.length,
          modelUsed: "grok-4-fast-reasoning",
          usedFallback: false,
        }
      );

      // Emit progress: finalize and complete
      try {
        await ctx.runMutation(api.searchProgress.upsertProgress, {
          keywordKey: progressKey,
          operation: "initial",
          phase: "finalizing",
          value: 95,
        });
        await ctx.runMutation(api.searchProgress.completeProgress, {
          keywordKey: progressKey,
          operation: "initial",
        });
      } catch {}

      return {
        success: true,
        data: {
          keywords: frontendKeywords,
          metadata: {
            requestId,
            generatedAt: Date.now(),
            processingTimeMs: endTime - startTime,
            userDescriptionLength: userDescription.length,
            modelUsed: "grok-4-fast-reasoning",
            usedFallback: false,
          },
        },
      };
    } catch (error) {
      const endTime = Date.now();
      logger.error(`[KEYWORD_GEN] ${requestId} - Request failed:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: endTime - startTime,
        userDescriptionLength: userDescription.length,
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Keyword generation failed",
        data: null,
        metadata: {
          requestId,
          processingTimeMs: endTime - startTime,
          fallbackUsed: true,
        },
      };
    }
  },
});
