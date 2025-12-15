"use node";

// convex/agents/tools/generateSeedKeywords.ts
// AI tool to generate seed keywords from workspace ICP and description

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";

// ============================================================================
// Tool
// ============================================================================

/**
 * Generates seed keywords from workspace ICP and improved description.
 * These keywords represent terms that prospects might use when expressing
 * pain points or needs on social media.
 *
 * @example
 * const result = await generateSeedKeywords({
 *   improvedDescription: "ReacherX helps SaaS founders find customers...",
 *   icps: [{ title: "Solo Founders", description: "...", painPoints: [...], channels: [...] }]
 * });
 */
export const generateSeedKeywords = createTool({
  description:
    "Generate seed keywords from the workspace's improved description and ICPs. Use this to start the prospecting workflow after a workspace is set up.",
  args: z.object({
    improvedDescription: z
      .string()
      .min(50)
      .describe("The AI-improved description of the business"),
    icps: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
          painPoints: z.array(z.string()),
          channels: z.array(z.string()),
        })
      )
      .min(1)
      .describe("Array of Ideal Customer Profiles"),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    seedKeywords?: string[];
    reasoning?: string;
    error?: string;
  }> => {
    // Delegate to internal action (shared logic)
    return await ctx.runAction(internal.agents.internal.generateSeedKeywordsAction, {
      improvedDescription: args.improvedDescription,
      icps: args.icps,
    });
  },
});
