"use node";

// convex/agents/tools/discoverKeywords.ts
// AI tool to discover related keywords using Bishopi API

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { DiscoveredKeyword } from "../internal";

// ============================================================================
// Tool
// ============================================================================

/**
 * Discovers related keywords using the Bishopi API.
 * Takes seed keywords and returns discovered keywords with search volume,
 * competition, and other SEO metadata.
 *
 * @example
 * const result = await discoverKeywords({
 *   seedKeywords: ["customer acquisition", "lead generation"]
 * });
 */
export const discoverKeywords = createTool({
  description:
    "Discover related keywords from seed keywords using Bishopi API. Returns keywords with search volume, competition, and SEO metadata. Use this after generating seed keywords to expand keyword coverage.",
  args: z.object({
    seedKeywords: z
      .array(z.string())
      .min(1)
      .max(20)
      .describe("Array of seed keywords to discover related keywords from"),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    discoveredKeywords?: DiscoveredKeyword[];
    keywordStrings?: string[];
    error?: string;
    stats?: {
      seedKeywordsCount: number;
      discoveredCount: number;
      durationMs: number;
    };
  }> => {
    // Delegate to internal action (shared logic)
    return await ctx.runAction(internal.agents.internal.discoverKeywordsAction, {
      seedKeywords: args.seedKeywords,
    });
  },
});
