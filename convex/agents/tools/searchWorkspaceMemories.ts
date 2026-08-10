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
import type { Id } from "../../_generated/dataModel";
import {
  WORKSPACE_MEMORY_CATEGORIES,
  type WorkspaceMemoryCategory,
} from "../../lib/agentMemoryCore";
import {
  resolveWorkspaceMemoryContext,
  type WorkspaceMemoryContext,
} from "./workspaceMemoryHelpers";
import { runLoggedAgentTool } from "./logging";

const workspaceMemoryCategoryEnum = z.enum(WORKSPACE_MEMORY_CATEGORIES);

type MemorySummary = {
  memoryId: string;
  category: WorkspaceMemoryCategory;
  source:
    | "qualification"
    | "enrichment"
    | "outreach"
    | "operator"
    | "style_analysis";
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
  inputSchema: z.object({
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
  execute: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    message: string;
    workspaceId?: string;
    memories?: MemorySummary[];
    semanticMatches?: SemanticMatchSummary[];
  }> =>
    runLoggedAgentTool(
      ctx,
      {
        moduleName: "searchWorkspaceMemories",
        args,
      },
      async (logEvent) => {
        const context: WorkspaceMemoryContext =
          await resolveWorkspaceMemoryContext(
            ctx,
            "searchWorkspaceMemories",
            logEvent
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

          const memoryContext = await ctx.runAction(
            internal.memory.buildWorkspaceMemoryContextInternal,
            {
              userId: context.userId,
              workspaceId: context.workspaceId as Id<"workspaces">,
              query: args.query,
              surface: context.prospectId ? "manual_prospect" : "main",
              prospectId: context.prospectId
                ? (context.prospectId as Id<"prospects">)
                : undefined,
            }
          );
          const categoryFilter = args.categories?.length
            ? new Set(args.categories)
            : null;
          const memories: MemorySummary[] = [
            ...memoryContext.operatorInstructions,
            ...memoryContext.learnedMemories,
          ]
            .filter(
              (memory) =>
                memory.category &&
                (!categoryFilter || categoryFilter.has(memory.category))
            )
            .slice(0, limit)
            .map((memory) => ({
              memoryId: memory.memoryId,
              category: memory.category as WorkspaceMemoryCategory,
              source: memory.source,
              title: memory.title,
              summary: memory.summary,
              confidence: memory.confidence,
              impactScore: memory.impactScore,
              createdAt: memory.createdAt,
              promptLine: memory.instruction ?? memory.canonicalContent,
            }));
          const semanticMatches: SemanticMatchSummary[] = [];

          logEvent.set({
            memory: {
              direct_match_count: memories.length,
              semantic_match_count: semanticMatches.length,
            },
            workspace: {
              id: context.workspaceId,
            },
          });

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
          logEvent.error(error);
          return {
            success: false,
            message: `Unable to search workspace memories: ${errorMessage}`,
          };
        }
      }
    ),
});
