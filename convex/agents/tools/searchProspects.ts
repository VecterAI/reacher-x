"use node";

// convex/agents/tools/searchProspects.ts
// Agent tool to search for prospects
// Thin wrapper - delegates to prospecting workflow

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { hasRequiredWorkspaceAgentData } from "../../lib/workspaceSetup";
import { getWorkspaceUseCase } from "../../../shared/lib/workspaceUseCases";
import {
  createProgressStatusArtifact,
  type AgentArtifactEnvelope,
  type AgentArtifactProgressStep,
} from "../../../shared/lib/json-render/agentArtifacts";
import { runLoggedAgentTool } from "./logging";

// ============================================================================
// Tool
// ============================================================================

/**
 * Agent tool to search for prospects.
 * Thin wrapper that validates args and starts the background prospecting workflow.
 */
export const searchProspects = createTool({
  description:
    "Search for matching targets on Twitter and LinkedIn based on the workspace profiles. Internally this runs the prospecting workflow: generates keywords, converts to social queries, searches platforms, and saves internal prospect records. Use this when the user wants to start discovery after workspace setup is complete.",
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
    progress?: AgentArtifactProgressStep[];
    artifact?: AgentArtifactEnvelope;
    error?: string;
  }> =>
    runLoggedAgentTool(
      ctx,
      {
        moduleName: "searchProspects",
        args,
        includeArgKeys: ["workspaceId"],
      },
      async (logEvent) => {
        try {
          // Validate workspace exists and is ready
          const workspace = await ctx.runQuery(internal.workspaces.getById, {
            workspaceId: args.workspaceId as Id<"workspaces">,
          });

          if (!workspace) {
            logEvent.warn("Workspace not found for prospect search");
            return {
              success: false,
              message: "Workspace not found",
              error: "Workspace not found",
            };
          }

          const hasRequiredSetupData = hasRequiredWorkspaceAgentData(workspace);
          if (!hasRequiredSetupData) {
            logEvent.warn("Workspace setup incomplete for prospect search", {
              workspace: {
                id: workspace._id,
              },
            });
            return {
              success: false,
              message:
                "Workspace setup incomplete. Please complete setup first.",
              error: "Workspace setup incomplete",
            };
          }

          const useCase = getWorkspaceUseCase(workspace.useCaseKey);
          const entityPlural = useCase.entityPlural;
          const entityPluralLower = entityPlural.toLowerCase();

          // Check if already running
          if (workspace.prospectingWorkflowStatus === "running") {
            logEvent.set({
              workflow: {
                id: workspace.prospectingWorkflowId,
                status: workspace.prospectingWorkflowStatus,
              },
              workspace: {
                id: workspace._id,
              },
            });
            return {
              success: true,
              message: `Search is already running for this workspace's ${entityPluralLower}.`,
              workflowId: workspace.prospectingWorkflowId,
              progress: [
                {
                  step: `Finding ${entityPluralLower}`,
                  status: "running",
                  details: `New ${entityPluralLower} will appear automatically as they are found.`,
                },
              ],
              artifact: createProgressStatusArtifact({
                title: `Finding ${entityPlural}`,
                message: `Search is already running in the background for this workspace's ${entityPluralLower}.`,
                progress: [
                  {
                    step: `Finding ${entityPluralLower}`,
                    status: "running",
                    details: `New ${entityPluralLower} will appear automatically as they are found.`,
                  },
                ],
              }),
            };
          }

          const result = await ctx.runAction(
            internal.workspaces.startProspectingWorkflowInternal,
            { workspaceId: args.workspaceId as Id<"workspaces"> }
          );

          if (result.success) {
            logEvent.set({
              workflow: {
                id: result.workflowId,
                status: "running",
              },
              workspace: {
                id: workspace._id,
              },
            });

            return {
              success: true,
              message: `Search started. I'll look for ${entityPluralLower} that match this workspace in the background. New ${entityPluralLower} will appear in your dashboard.`,
              workflowId: result.workflowId,
              progress: [
                {
                  step: `Finding ${entityPluralLower}`,
                  status: "running",
                  details:
                    "Generating keywords, searching platforms, and saving matches.",
                },
              ],
              artifact: createProgressStatusArtifact({
                title: `Finding ${entityPlural}`,
                message: `Search has started in the background. New ${entityPluralLower} will appear in your dashboard.`,
                progress: [
                  {
                    step: `Finding ${entityPluralLower}`,
                    status: "running",
                    details:
                      "Generating keywords, searching platforms, and saving matches.",
                  },
                ],
              }),
            };
          }

          logEvent.warn("Failed to start prospecting workflow", {
            workspace: {
              id: workspace._id,
            },
            workflow: {
              status: "failed_to_start",
            },
          });
          return {
            success: false,
            message: result.error || "Failed to start workflow",
            error: result.error,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logEvent.error(error);
          return {
            success: false,
            message: `Failed to start prospecting: ${errorMessage}`,
            error: errorMessage,
          };
        }
      }
    ),
});
