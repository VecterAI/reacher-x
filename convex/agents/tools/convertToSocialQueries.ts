"use node";

// convex/agents/tools/convertToSocialQueries.ts
// AI tool to convert search keywords to social media queries

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import { WORKSPACE_USE_CASE_KEYS } from "../../../shared/lib/workspaceUseCases";

// ============================================================================
// Tool
// ============================================================================

/**
 * Converts seed keywords and discovered keywords into social media queries.
 * These queries use natural language that matches how people actually post
 * on Twitter and LinkedIn.
 *
 * @example
 * const result = await convertToSocialQueries({
 *   keywords: ["customer acquisition", "lead generation", "sales automation"],
 *   platforms: ["twitter", "linkedin"]
 * });
 */
export const convertToSocialQueries = createTool({
  description:
    "Convert keywords to natural social media queries. Use this after generating seed keywords to prepare for discovery search.",
  inputSchema: z.object({
    keywords: z
      .array(z.string())
      .min(1)
      .describe("Array of keywords to convert"),
    platforms: z
      .array(z.union([z.literal("twitter"), z.literal("linkedin")]))
      .describe("Target social platforms"),
    businessContext: z
      .string()
      .optional()
      .describe("Optional business description for context"),
    useCaseKey: z
      .enum(WORKSPACE_USE_CASE_KEYS)
      .optional()
      .describe("Optional workspace use case to align search framing"),
  }),
  execute: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    socialQueries?: string[];
    reasoning?: string;
    error?: string;
  }> => {
    // Delegate to internal action (shared logic)
    return await ctx.runAction(
      internal.agents.internal.convertToSocialQueriesAction,
      {
        keywords: args.keywords,
        platforms: args.platforms,
        businessContext: args.businessContext,
        useCaseKey: args.useCaseKey,
      }
    );
  },
});
