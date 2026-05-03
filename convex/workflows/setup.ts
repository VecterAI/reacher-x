import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { workflow as workflowManager } from "../lib/workflow";
import { getSetupWorkflowEventName } from "../lib/setupWorkflowEvents";

export const setupSessionWorkflow = workflowManager.define({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
  },
  returns: v.object({
    success: v.boolean(),
    status: v.string(),
    targetWorkspaceId: v.optional(v.id("workspaces")),
    error: v.optional(v.string()),
  }),
  handler: async (
    step,
    { sessionId }
  ): Promise<{
    success: boolean;
    status: string;
    targetWorkspaceId?: Id<"workspaces">;
    error?: string;
  }> => {
    const stateChangedEventName = getSetupWorkflowEventName(
      String(sessionId),
      "stateChanged"
    );

    await step.runAction(
      internal.setupSessions.postSetupSessionGreetingInternal,
      {
        sessionId,
      }
    );

    while (true) {
      const session: Doc<"workspaceSetupSessions"> | null = await step.runQuery(
        internal.setupSessions.getByIdInternal,
        {
          sessionId,
        }
      );

      if (!session) {
        return {
          success: false,
          status: "missing",
          error: "Setup session not found",
        };
      }

      switch (session.status) {
        case "draft":
        case "awaiting_input":
        case "awaiting_icp_confirmation":
        case "awaiting_preview_confirmation":
        case "awaiting_connections":
        case "awaiting_plan":
        case "awaiting_preferences": {
          await step.awaitEvent({ name: stateChangedEventName });
          break;
        }

        case "generating_profiles": {
          await step.runAction(
            internal.setupSessions.runSetupGenerationInternal,
            {
              sessionId,
            }
          );
          break;
        }

        case "provisioning_preview_workspace": {
          await step.runAction(
            internal.setupSessions.provisionDraftWorkspaceForPreviewInternal,
            {
              sessionId,
            }
          );
          break;
        }

        case "discovering_preview_prospects": {
          await step.awaitEvent({ name: stateChangedEventName });
          break;
        }

        case "ready":
          return {
            success: true,
            status: "ready",
            targetWorkspaceId: session.targetWorkspaceId,
          };

        case "failed":
          return {
            success: false,
            status: "failed",
            targetWorkspaceId: session.targetWorkspaceId,
            error: session.errorMessage ?? "Setup session failed",
          };

        case "discarded":
          return {
            success: false,
            status: "discarded",
            targetWorkspaceId: session.targetWorkspaceId,
          };

        default:
          return {
            success: false,
            status: "unknown",
            error: `Unhandled setup session status: ${String(session.status)}`,
          };
      }
    }
  },
});
