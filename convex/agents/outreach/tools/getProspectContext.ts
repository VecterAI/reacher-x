"use node";

// convex/agents/outreach/tools/getProspectContext.ts
// Agent tool for fetching prospect context with RAG search
// Thin wrapper - Layer 1 following Three-Layer Architecture

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api, internal } from "../../../_generated/api";
import { prospectRag, getProspectNamespace } from "../rag";
import { extractProspectIdWithFallback } from "./helpers";

// ============================================================================
// Types
// ============================================================================

export interface ProspectContextResult {
  success: boolean;
  prospect: {
    id: string;
    workspaceId: string;
    displayName?: string;
    title?: string;
    briefIntro?: string;
    platform: string;
    status: string;
  } | null;
  painPoints: Array<{ pain: string; solution?: string }>;
  evidenceHighlights: Array<{ text: string; score: number }>;
  workspaceMemories: string[];
  winningPatterns: string[];
  objections: string[];
  similarCases: string[];
  existingPlan: {
    id: string;
    status: string;
    rationale: string;
  } | null;
  error?: string;
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Get prospect context for plan generation.
 * Combines DB data with semantic search of evidence.
 *
 * The prospectId is optional - if not provided, it's resolved from the thread context.
 * This prevents issues with LLM hallucinating/modifying IDs.
 */
export const getProspectContext = createTool({
  description:
    "Fetch prospect profile data and semantic search of relevant evidence posts. Use this before generating an outreach plan to understand the prospect. The prospectId is automatically extracted from the thread - you don't need to provide it.",
  args: z.object({
    prospectId: z
      .string()
      .optional()
      .describe(
        "Optional: The ID of the prospect. If not provided, extracted from thread context."
      ),
    query: z
      .string()
      .optional()
      .describe("Optional semantic search query to find relevant evidence"),
  }),
  handler: async (ctx, args): Promise<ProspectContextResult> => {
    try {
      // Extract prospectId from thread if not provided or invalid
      const prospectId = await extractProspectIdWithFallback(
        ctx,
        "getProspectContext",
        args.prospectId
      );

      if (!prospectId) {
        return {
          success: false,
          prospect: null,
          painPoints: [],
          evidenceHighlights: [],
          workspaceMemories: [],
          winningPatterns: [],
          objections: [],
          similarCases: [],
          existingPlan: null,
          error:
            "Could not determine prospect. Please call this from a prospect thread.",
        };
      }

      // 1. Get prospect data using internal query (no auth required in node context)
      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        { prospectId }
      );

      if (!prospect) {
        return {
          success: false,
          prospect: null,
          painPoints: [],
          evidenceHighlights: [],
          workspaceMemories: [],
          winningPatterns: [],
          objections: [],
          similarCases: [],
          existingPlan: null,
          error: "Prospect not found",
        };
      }

      // 2. Get existing plan if any
      let existingPlan = null;
      const plans = await ctx.runQuery(api.outreach.getProspectPlan, {
        prospectId,
      });

      if (plans) {
        existingPlan = {
          id: plans.plan._id,
          status: plans.plan.status,
          rationale: plans.plan.strategy.rationale,
        };
      }

      // 3. Extract pain points from prospect data
      const painPoints =
        prospect.painPoints?.map((p: { pain: string; solution?: string }) => ({
          pain: p.pain,
          solution: p.solution,
        })) || [];

      // 4. Semantic search for evidence if query provided
      let evidenceHighlights: Array<{ text: string; score: number }> = [];

      const outreachLearningContext = await ctx.runAction(
        internal.memory.getOutreachLearningContextInternal,
        {
          workspaceId: String(prospect.workspaceId),
          userId: String(prospect.userId),
          title: prospect.title,
          briefIntro: prospect.briefIntro,
          painPoints: painPoints.map((item: { pain: string }) => item.pain),
          matchedKeywords: prospect.matchedKeywords || [],
          finance: prospect.finance?.displayValue,
        }
      );

      if (args.query) {
        try {
          const searchResults = await prospectRag.search(ctx, {
            namespace: getProspectNamespace(prospectId),
            query: args.query,
            limit: 5,
          });

          evidenceHighlights = searchResults.results.map((r) => ({
            text: r.content.join(" ").slice(0, 200),
            score: r.score,
          }));
        } catch (ragError) {
          // RAG search failed, continue without semantic results
          console.warn("[getProspectContext] RAG search failed:", ragError);
        }
      }

      return {
        success: true,
        prospect: {
          id: prospect._id,
          workspaceId: prospect.workspaceId,
          displayName: prospect.displayName,
          title: prospect.title,
          briefIntro: prospect.briefIntro,
          platform: prospect.platform,
          status: prospect.status,
        },
        painPoints,
        evidenceHighlights,
        workspaceMemories: outreachLearningContext.relevantMemories,
        winningPatterns: outreachLearningContext.winningPatterns,
        objections: outreachLearningContext.objections,
        similarCases: outreachLearningContext.similarCases,
        existingPlan,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        prospect: null,
        painPoints: [],
        evidenceHighlights: [],
        workspaceMemories: [],
        winningPatterns: [],
        objections: [],
        similarCases: [],
        existingPlan: null,
        error: errorMessage,
      };
    }
  },
});
