"use node";

// convex/agents/outreach/tools/approveTask.ts
// Agent tool for approving pending tasks (Layer 1: thin wrapper)
// Following Three-Layer Architecture from AGENT_CONTEXT.txt

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import { extractProspectIdFromThread } from "./helpers";
import { runLoggedAgentTool } from "../../tools/logging";

// ============================================================================
// Types
// ============================================================================

export interface ApproveTaskResult {
  success: boolean;
  message: string;
  error?: string;
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Approve a pending reply/comment task to resume workflow execution.
 * Call this when the user confirms they want to proceed with posting a reply.
 *
 * NOTE: This tool does NOT accept taskId from LLM to prevent ID hallucination.
 * The pending task is automatically found from thread context.
 * Per AGENT_CONTEXT.txt line 419-423.
 */
export const approveTask = createTool({
  description:
    "Approve the pending reply/comment task (like posting a tweet) and resume workflow execution. " +
    "Call this when the user says 'yes', 'approved', 'go ahead', or similar confirmation to proceed with posting. " +
    "The pending task is automatically found from context - no task ID needed.",
  args: z.object({}), // No args - taskId extracted from context to prevent hallucination
  handler: async (ctx): Promise<ApproveTaskResult> =>
    runLoggedAgentTool(
      ctx,
      {
        moduleName: "approveTask",
      },
      async (logEvent) => {
        try {
          // Step 1: Extract prospectId from canonical thread context
          const prospectId = await extractProspectIdFromThread(
            ctx,
            "approveTask",
            logEvent
          );

          if (!prospectId) {
            logEvent.warn("Could not extract prospectId from thread context");
            return {
              success: false,
              message:
                "Could not determine prospect. Please call this from a prospect thread.",
              error: "No prospect context found",
            };
          }

          // Step 2: Find pending task for this prospect
          const pendingTask = await ctx.runQuery(
            internal.outreach.getPendingTaskForProspect,
            { prospectId }
          );

          if (!pendingTask) {
            logEvent.warn("No pending task found for prospect", {
              prospect: {
                id: prospectId,
              },
            });
            return {
              success: false,
              message:
                "No pending task found for this prospect. The task may have already been approved or completed.",
              error: "No pending task",
            };
          }

          if (pendingTask.status === "waiting_response") {
            logEvent.warn("Task already posted and waiting for response", {
              prospect: {
                id: prospectId,
              },
              task: {
                id: pendingTask._id,
                status: pendingTask.status,
              },
            });
            return {
              success: false,
              message:
                "This reply was already posted and is waiting for prospect response.",
              error: "Task already posted",
            };
          }

          // Step 3: Approve the task
          await ctx.runMutation(internal.outreach.approveTaskInternal, {
            taskId: pendingTask._id,
          });

          logEvent.set({
            prospect: {
              id: prospectId,
            },
            task: {
              id: pendingTask._id,
              status: "approved",
            },
          });

          return {
            success: true,
            message:
              "Approval accepted. Execution is now pending in the workflow. I will only confirm posting after persisted task state shows a postedTweetId.",
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          logEvent.error(error);

          return {
            success: false,
            message: "Failed to approve task",
            error: errorMessage,
          };
        }
      }
    ),
});
