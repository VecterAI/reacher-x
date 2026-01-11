"use node";

// convex/agents/outreach/tools/approveTask.ts
// Agent tool for approving pending tasks (Layer 1: thin wrapper)
// Following Three-Layer Architecture from AGENT_CONTEXT.txt

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import { extractProspectIdFromThread } from "./helpers";

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
 * Approve a pending task to resume workflow execution.
 * Call this when the user confirms they want to proceed with posting a tweet.
 *
 * NOTE: This tool does NOT accept taskId from LLM to prevent ID hallucination.
 * The pending task is automatically found from thread context.
 * Per AGENT_CONTEXT.txt line 419-423.
 */
export const approveTask = createTool({
  description:
    "Approve the pending outreach task (like posting a tweet) and resume workflow execution. " +
    "Call this when the user says 'yes', 'approved', 'go ahead', or similar confirmation to proceed with posting. " +
    "The pending task is automatically found from context - no task ID needed.",
  args: z.object({}), // No args - taskId extracted from context to prevent hallucination
  handler: async (ctx): Promise<ApproveTaskResult> => {
    try {
      // Step 1: Extract prospectId from thread title
      const prospectId = await extractProspectIdFromThread(ctx, "approveTask");

      if (!prospectId) {
        console.error(
          "[approveTask] Could not extract prospectId from thread context"
        );
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
        console.warn(
          `[approveTask] No pending task found for prospect: ${prospectId}`
        );
        return {
          success: false,
          message:
            "No pending task found for this prospect. The task may have already been approved or completed.",
          error: "No pending task",
        };
      }

      // Step 3: Approve the task
      await ctx.runMutation(internal.outreach.approveTaskInternal, {
        taskId: pendingTask._id,
      });

      console.info(
        `[approveTask] Task ${pendingTask._id} approved for prospect ${prospectId}`
      );

      return {
        success: true,
        message:
          "Task approved! The tweet will be posted now. I'll let you know once it's done.",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("[approveTask] Failed:", errorMessage);

      return {
        success: false,
        message: "Failed to approve task",
        error: errorMessage,
      };
    }
  },
});
