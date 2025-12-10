// convex/agents/tools/createWorkspace.ts
// Create a new workspace with v4 fields

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

// ============================================================================
// Schema
// ============================================================================

const icpSchema = z.object({
  title: z.string().describe("ICP segment title"),
  description: z.string().describe("Who this segment is"),
  painPoints: z.array(z.string()).describe("Their pain points"),
  channels: z.array(z.string()).describe("Where to find them"),
});

// ============================================================================
// Tool
// ============================================================================

/**
 * Creates a new workspace with the approved description and ICPs.
 * Only use this after the user explicitly approves the generated content.
 */
export const createWorkspace = createTool({
  description:
    "Create a new workspace with the approved business description and ICPs. ONLY call this after the user explicitly approves the generated content by saying something like 'looks good' or 'create workspace'.",
  args: z.object({
    name: z.string().describe("The workspace name (usually the business name)"),
    seedDescription: z.string().describe("The original seed description"),
    improvedDescription: z.string().describe("The AI-improved description"),
    icps: z.array(icpSchema).min(2).max(4).describe("The approved ICP segments"),
    sourceUrl: z.string().url().optional().describe("The source URL if provided"),
    descriptionSource: z
      .enum(["url", "manual"])
      .describe("Whether description came from URL analysis or manual input"),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    workspaceId?: string;
    error?: string;
  }> => {
    if (!ctx.userId) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    try {
      const workspaceId = await ctx.runMutation(
        internal.workspaces.createWorkspaceInternal,
        {
          userId: ctx.userId as Id<"users">,
          name: args.name,
          description: args.improvedDescription, // Use improved as the main description
          seedDescription: args.seedDescription,
          improvedDescription: args.improvedDescription,
          icps: args.icps,
          sourceUrl: args.sourceUrl,
          descriptionSource: args.descriptionSource,
          isDefault: true, // Make it the default workspace
        }
      );

      return {
        success: true,
        workspaceId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to create workspace: ${errorMessage}`,
      };
    }
  },
});
