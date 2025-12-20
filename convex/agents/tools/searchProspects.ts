"use node";

// convex/agents/tools/searchProspects.ts
// Agent tool to search for prospects
// Thin wrapper - delegates to prospecting workflow

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

// ============================================================================
// Tool
// ============================================================================

/**
 * Agent tool to search for prospects.
 * Thin wrapper that validates args and starts the background prospecting workflow.
 */
export const searchProspects = createTool({
  description:
    "Search for prospects on Twitter and LinkedIn based on the workspace's ICP. This runs the full prospecting workflow: generates keywords, converts to social queries, searches platforms, and saves results. Use this when the user wants to find prospects or after workspace setup is complete.",
  args: z.object({
    workspaceId: z
      .string()
      .describe("The workspace ID to search prospects for"),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    message: string;
    workflowId?: string;
    error?: string;
  }> => {
    try {
      console.log(`[searchProspects] Starting prospecting workflow for workspace ${args.workspaceId}`);

      // Validate workspace exists and is ready
      const workspace = await ctx.runQuery(internal.workspaces.getById, {
        workspaceId: args.workspaceId as Id<"workspaces">,
      });

      if (!workspace) {
        return {
          success: false,
          message: "Workspace not found",
          error: "Workspace not found",
        };
      }

      if (!workspace.improvedDescription || !workspace.icps?.length) {
        return {
          success: false,
          message: "Workspace setup incomplete. Please complete setup first.",
          error: "Workspace setup incomplete",
        };
      }

      // Check if already running
      if (workspace.prospectingWorkflowStatus === "running") {
        return {
          success: true,
          message: "Prospecting workflow is already running for this workspace.",
          workflowId: workspace.prospectingWorkflowId,
        };
      }

      // Start the workflow
      const result = await ctx.runAction(
        internal.workspaces.startProspectingWorkflowInternal,
        { workspaceId: args.workspaceId as Id<"workspaces"> }
      );

      if (result.success) {
        console.log(`[searchProspects] Workflow started for workspace ${args.workspaceId}, workflowId: ${result.workflowId}`);

        return {
          success: true,
          message: "Prospecting workflow started! I'll search for prospects matching your ICP in the background. New prospects will appear in your dashboard.",
          workflowId: result.workflowId,
        };
      } else {
        return {
          success: false,
          message: result.error || "Failed to start workflow",
          error: result.error,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[searchProspects] Failed to start prospecting for workspace ${args.workspaceId}:`, errorMessage);

      return {
        success: false,
        message: `Failed to start prospecting: ${errorMessage}`,
        error: errorMessage,
      };
    }
  },
});
