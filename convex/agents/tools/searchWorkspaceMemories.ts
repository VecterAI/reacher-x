"use node";

// convex/agents/tools/searchWorkspaceMemories.ts
// Agent tool to retrieve relevant workspace memories for the current context.
//
// Thin Layer-1 wrapper:
// - Resolves workspace from thread context
// - Queries built-in agent memories + optional semantic matches
// - Returns a compact list of memories for the LLM to summarize in natural language

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import {
  WORKSPACE_MEMORY_CATEGORIES,
  type WorkspaceMemoryCategory,
} from "../../lib/agentMemoryCore";
import {
  resolveWorkspaceMemoryContext,
  type WorkspaceMemoryContext,
} from "./workspaceMemoryHelpers";

const workspaceMemoryCategoryEnum = z.enum(WORKSPACE_MEMORY_CATEGORIES);

type MemorySummary = {
  memoryId: string;
  category: WorkspaceMemoryCategory;
  source: "qualification" | "enrichment" | "outreach" | "operator";
  title: string;
  summary: string;
  confidence: number;
  impactScore: number;
  createdAt: number;
  promptLine: string;
};

type SemanticMatchSummary = {
  namespace: string;
  score: number;
  text: string;
  promptLine: string;
};

export const searchWorkspaceMemories = createTool({
  description:
    "Search for relevant workspace memories (including operator- and evaluator-generated lessons) that match the current question. Use this before answering questions like 'what have we learned so far', 'what patterns work best', or 'what should we avoid'.",
  args: z.object({
    query: z
      .string()
      .min(4)
      .describe(
        "What you want to recall, expressed in natural language (e.g. 'great prospects', 'losing patterns', 'Mor Raphael Shabtai')."
      ),
    categories: z
      .array(workspaceMemoryCategoryEnum)
      .optional()
      .describe(
        "Optional filter to restrict results to specific memory categories."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe(
        "Maximum number of direct memory matches to return (default 5)."
      ),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    message: string;
    workspaceId?: string;
    memories?: MemorySummary[];
    semanticMatches?: SemanticMatchSummary[];
  }> => {
    const context: WorkspaceMemoryContext = await resolveWorkspaceMemoryContext(
      ctx,
      "searchWorkspaceMemories"
    );

    if (!context.userId) {
      return {
        success: false,
        message:
          "Unable to search memories because the user is not authenticated in this thread.",
      };
    }

    if (!context.workspaceId) {
      return {
        success: false,
        message:
          "I couldn't determine which workspace to search memories for. Please make sure you're in a valid setup or outreach conversation.",
      };
    }

    try {
      const limit = args.limit ?? 5;

      // 1) Direct matches from built-in agent memories
      const directMatches = await ctx.runQuery(
        internal.memory.findRelevantBuiltInAgentMemoriesInternal,
        {
          userId: String(context.userId),
          workspaceId: context.workspaceId,
          query: args.query,
          limit,
          categories: args.categories,
        }
      );

      const memories: MemorySummary[] = directMatches.map((match) => ({
        memoryId: match.memoryId,
        category: match.parsed.category,
        source: match.parsed.source,
        title: match.parsed.title,
        summary: match.parsed.summary,
        confidence: match.parsed.confidence,
        impactScore: match.parsed.impactScore,
        createdAt: match.createdAt,
        promptLine: match.promptLine,
      }));

      // 2) Optional semantic matches from workspace RAG namespaces
      const namespaces = ["wins", "losses", "patterns", "objections"] as const;

      const semanticResults = await Promise.all(
        namespaces.map(async (namespace) => {
          const result = await ctx.runAction(
            internal.memory.searchWorkspaceMemoryNamespaceInternal,
            {
              workspaceId: context.workspaceId as string,
              namespace,
              query: args.query,
              limit: Math.min(3, limit),
            }
          );

          return result.matches.map((match) => ({
            namespace,
            score: match.score,
            text: match.text,
            promptLine: match.promptLine,
          }));
        })
      );

      const semanticMatches: SemanticMatchSummary[] =
        semanticResults.flat() ?? [];

      return {
        success: true,
        message:
          "Retrieved relevant workspace memories and semantic matches you can use to answer the user's question.",
        workspaceId: context.workspaceId,
        memories,
        semanticMatches,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[searchWorkspaceMemories] Failed to search workspace memories:",
        error
      );

      return {
        success: false,
        message: `Unable to search workspace memories: ${errorMessage}`,
      };
    }
  },
});
