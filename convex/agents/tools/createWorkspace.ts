// convex/agents/tools/createWorkspace.ts
// Create or update workspace with v4 fields and auto-start prospecting

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { icpSchema } from "./schemas";

// ============================================================================
// Tool
// ============================================================================

/**
 * Creates or updates a workspace with the approved description and ICPs.
 * If user has an existing default workspace without ICPs, update it.
 * Otherwise create a new one.
 * After success, automatically starts the prospecting workflow.
 */
export const createWorkspace = createTool({
  description:
    "Create or update a workspace with the approved business description and ICPs. ONLY call this after the user explicitly approves the generated content by saying something like 'looks good' or 'create workspace'. This will also start finding prospects automatically.",
  args: z.object({
    name: z.string().describe("The workspace name (usually the business name)"),
    seedDescription: z.string().describe("The original seed description"),
    improvedDescription: z.string().describe("The AI-improved description"),
    icps: z
      .array(icpSchema)
      .min(2)
      .max(4)
      .describe("The approved ICP segments"),
    sourceUrl: z
      .string()
      .url()
      .optional()
      .describe("The source URL if provided"),
    descriptionSource: z
      .enum(["url", "manual"])
      .describe("Whether description came from URL analysis or manual input"),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    workspaceId?: string;
    isUpdate?: boolean;
    prospectingStarted?: boolean;
    error?: string;
  }> => {
    if (!ctx.userId) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    try {
      const userId = ctx.userId as Id<"users">;

      // Check if user has an existing default workspace without ICPs
      const existingDefault = await ctx.runQuery(
        internal.workspaces.getDefaultWorkspaceByUserId,
        { userId }
      );

      let workspaceId: Id<"workspaces">;
      let isUpdate = false;

      if (
        existingDefault &&
        (!existingDefault.icps || existingDefault.icps.length === 0)
      ) {
        // Update existing incomplete workspace instead of creating new
        await ctx.runMutation(internal.workspaces.updateWorkspaceInternal, {
          workspaceId: existingDefault._id,
          description: args.improvedDescription,
          seedDescription: args.seedDescription,
          improvedDescription: args.improvedDescription,
          icps: args.icps,
          sourceUrl: args.sourceUrl,
          descriptionSource: args.descriptionSource,
          setupCompletedAt: Date.now(),
        });
        workspaceId = existingDefault._id;
        isUpdate = true;
      } else {
        // Create new workspace
        workspaceId = await ctx.runMutation(
          internal.workspaces.createWorkspaceInternal,
          {
            userId,
            name: args.name,
            description: args.improvedDescription,
            seedDescription: args.seedDescription,
            improvedDescription: args.improvedDescription,
            icps: args.icps,
            sourceUrl: args.sourceUrl,
            descriptionSource: args.descriptionSource,
            isDefault: true,
          }
        );
      }

      // Auto-start prospecting workflow
      let prospectingStarted = false;
      try {
        const workflowResult = await ctx.runAction(
          internal.workspaces.startProspectingWorkflowInternal,
          { workspaceId }
        );
        prospectingStarted = workflowResult.success;
      } catch (err) {
        // Log but don't fail - workspace was created successfully
        console.warn("[createWorkspace] Failed to start prospecting:", err);
      }

      return {
        success: true,
        workspaceId,
        isUpdate,
        prospectingStarted,
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
